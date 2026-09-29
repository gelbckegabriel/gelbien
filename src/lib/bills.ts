/**
 * Recurring bills (the Subscriptions list): when they are charged, whether a charge was already
 * logged, and the expense to log for one. Pure, so it runs the same in demo and Google mode.
 */
import type { Cycle, Dataset, Subscription, Transaction } from "./types";
import { addMonths, daysInMonth, monthOf, normalize, round2, todayISO, uid } from "./utils";

export interface BillCharge {
  sub: Subscription;
  /** YYYY-MM-DD */
  date: string;
}

const CYCLE_MONTHS: Record<Exclude<Cycle, "weekly">, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 };

export function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return todayISO(d);
}

const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

/**
 * Charge dates of an active bill between `from` and `to` (inclusive). Monthly bills follow their
 * billing day (clamped to short months); other cycles step from `nextCharge`. [] when unknown.
 */
export function billDates(sub: Subscription, from: string, to: string): string[] {
  if (sub.status !== "active" || from > to) return [];
  const out: string[] = [];
  if (sub.cycle === "weekly") {
    if (!sub.nextCharge) return [];
    const offset = Math.round((Date.parse(from) - Date.parse(sub.nextCharge)) / 86400000);
    for (let d = addDays(sub.nextCharge, Math.ceil(offset / 7) * 7); d <= to; d = addDays(d, 7)) out.push(d);
    return out;
  }
  const step = CYCLE_MONTHS[sub.cycle];
  let anchor: string;
  let day: number;
  if (step === 1 && sub.billingDay) {
    anchor = monthOf(from);
    day = sub.billingDay;
  } else if (sub.nextCharge) {
    anchor = monthOf(sub.nextCharge);
    day = Number(sub.nextCharge.slice(8, 10));
  } else {
    return [];
  }
  const first = Math.ceil(monthsBetween(anchor, monthOf(from)) / step);
  for (let m = addMonths(anchor, first * step); m <= monthOf(to); m = addMonths(m, step)) {
    const d = `${m}-${String(Math.min(day, daysInMonth(m))).padStart(2, "0")}`;
    if (d >= from && d <= to) out.push(d);
  }
  return out;
}

/** An expense logged by hand for this bill: same category and the bill's name in merchant or description. */
function looksLikeBill(t: Transaction, sub: Subscription): boolean {
  if (t.category !== sub.category) return false;
  const name = normalize(sub.name);
  return [t.merchant, t.description].some((x) => {
    const v = normalize(x);
    return !!v && !!name && (v.includes(name) || (v.length >= 4 && name.includes(v)));
  });
}

/** The expense that covers the charge on `date`, if one was logged (linked, or a matching one typed by hand). */
export function paidBy(sub: Subscription, date: string, txs: Transaction[]): Transaction | undefined {
  const tolerance = sub.cycle === "weekly" ? 3 : sub.cycle === "monthly" ? 7 : 20;
  const lo = addDays(date, -tolerance);
  const hi = addDays(date, tolerance);
  return txs.find((t) => {
    // a monthly bill paid any day of its month counts (early or late)
    const near = (t.date >= lo && t.date <= hi) || (sub.cycle === "monthly" && monthOf(t.date) === monthOf(date));
    return near && (t.billId === sub.id || (!t.billId && looksLikeBill(t, sub)));
  });
}

export const chargeKey = (c: BillCharge) => `${c.sub.id}|${c.date}`;

/**
 * Charges this month up to today (plus the last week, across a month boundary) that nothing
 * was logged for and that weren't skipped.
 */
export function dueBills(ds: Pick<Dataset, "subscriptions" | "transactions">, today = todayISO(), skipped: ReadonlySet<string> = new Set()): BillCharge[] {
  const weekAgo = addDays(today, -7);
  const monthStart = `${monthOf(today)}-01`;
  const from = weekAgo < monthStart ? weekAgo : monthStart;
  return ds.subscriptions
    .flatMap((sub) => billDates(sub, from, today).map((date) => ({ sub, date })))
    .filter((c) => !skipped.has(chargeKey(c)) && !paidBy(c.sub, c.date, ds.transactions))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Bills in `month` with nothing logged for them yet — still to come, or charged but not logged:
 * money already spoken for. None once the month is over (what happened is in the expenses by then).
 */
export function committedBills(
  ds: Pick<Dataset, "subscriptions" | "transactions">,
  month: string,
  today = todayISO(),
  skipped: ReadonlySet<string> = new Set(),
): BillCharge[] {
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  if (last < today) return [];
  return ds.subscriptions
    .flatMap((sub) => billDates(sub, `${month}-01`, last).map((date) => ({ sub, date })))
    .filter((c) => !skipped.has(chargeKey(c)) && !paidBy(c.sub, c.date, ds.transactions))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Charges after today, within `days`, not already paid early. */
export function upcomingBills(ds: Pick<Dataset, "subscriptions" | "transactions">, today = todayISO(), days = 30): BillCharge[] {
  return ds.subscriptions
    .flatMap((sub) => billDates(sub, addDays(today, 1), addDays(today, days)).map((date) => ({ sub, date })))
    .filter((c) => !paidBy(c.sub, c.date, ds.transactions))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** The expense to log when a bill is marked paid — copying how the last one was logged, if any. */
export function billTransaction(c: BillCharge, ds: Pick<Dataset, "transactions" | "settings">, now = new Date().toISOString()): Transaction {
  const { sub } = c;
  const last = ds.transactions.find((t) => t.billId === sub.id || (!t.billId && looksLikeBill(t, sub)));
  return {
    id: uid("t"),
    date: c.date,
    category: sub.category,
    subcategory: last?.subcategory ?? "",
    description: sub.name,
    amount: round2(sub.amount),
    payment: sub.payment || last?.payment || ds.settings.paymentMethods[0] || "",
    type: last?.type ?? "fixed",
    priority: last?.priority ?? "important",
    merchant: last?.merchant || sub.name,
    recurring: true,
    notes: "",
    receiptUrl: "",
    createdAt: now,
    updatedAt: now,
    group: "",
    billId: sub.id,
  };
}

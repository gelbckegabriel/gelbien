/**
 * Recurring bills (the Subscriptions list): when they are charged, whether a charge was already
 * logged, and the expense to log for one. Pure, so it runs the same in demo and Google mode.
 */
import { guessKind } from "./defaults";
import type { Cycle, Dataset, Subscription, Transaction } from "./types";
import { addMonths, daysInMonth, monthOf, normalize, round2, todayISO, uid } from "./utils";

export interface BillCharge {
  sub: Subscription;
  /** YYYY-MM-DD */
  date: string;
}

/** A charge and the expense that paid it, if one was logged */
export interface LoggedCharge extends BillCharge {
  paid?: Transaction;
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

/** An expense logged by hand for this bill: same category, and the bill's name in merchant or description (or the bill's merchant). */
export function looksLikeBill(t: Pick<Transaction, "category" | "merchant" | "description">, sub: Subscription): boolean {
  if (t.category !== sub.category) return false;
  const name = normalize(sub.name);
  const merchant = normalize(sub.merchant);
  if (merchant && normalize(t.merchant) === merchant) return true;
  return [t.merchant, t.description].some((x) => {
    const v = normalize(x);
    return !!v && !!name && (v.includes(name) || (v.length >= 4 && name.includes(v)));
  });
}

/**
 * The expense that covers the charge on `date`, if one was logged (linked, or a matching one typed
 * by hand) — the closest to that date, when more than one could.
 */
export function paidBy<T extends Pick<Transaction, "date" | "billId" | "category" | "merchant" | "description">>(sub: Subscription, date: string, txs: T[]): T | undefined {
  const tolerance = sub.cycle === "weekly" ? 3 : sub.cycle === "monthly" ? 7 : 20;
  const lo = addDays(date, -tolerance);
  const hi = addDays(date, tolerance);
  const at = Date.parse(date);
  let best: T | undefined;
  let bestGap = Infinity;
  for (const t of txs) {
    // a monthly bill paid any day of its month counts (early or late)
    const near = (t.date >= lo && t.date <= hi) || (sub.cycle === "monthly" && monthOf(t.date) === monthOf(date));
    if (!near || !(t.billId === sub.id || (!t.billId && looksLikeBill(t, sub)))) continue;
    const gap = Math.abs(Date.parse(t.date) - at);
    if (gap < bestGap) [best, bestGap] = [t, gap];
  }
  return best;
}

export const chargeKey = (c: BillCharge) => `${c.sub.id}|${c.date}`;

/** Every charge between `from` and `to` (inclusive), by date, each with the expense that paid it, if any. */
export function chargesBetween(ds: Pick<Dataset, "subscriptions" | "transactions">, from: string, to: string): LoggedCharge[] {
  return ds.subscriptions
    .flatMap((sub) => billDates(sub, from, to).map((date) => ({ sub, date, paid: paidBy(sub, date, ds.transactions) })))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Charges this month up to today (plus the last week, across a month boundary) that nothing
 * was logged for and that weren't skipped.
 */
export function dueBills(ds: Pick<Dataset, "subscriptions" | "transactions">, today = todayISO(), skipped: ReadonlySet<string> = new Set()): BillCharge[] {
  const weekAgo = addDays(today, -7);
  const monthStart = `${monthOf(today)}-01`;
  const from = weekAgo < monthStart ? weekAgo : monthStart;
  return chargesBetween(ds, from, today).filter((c) => !c.paid && !skipped.has(chargeKey(c)));
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
  return chargesBetween(ds, `${month}-01`, last).filter((c) => !c.paid && !skipped.has(chargeKey(c)));
}

/** Charges after today, within `days` — `paid` when one was paid early. */
export function upcomingBills(ds: Pick<Dataset, "subscriptions" | "transactions">, today = todayISO(), days = 30): LoggedCharge[] {
  return chargesBetween(ds, addDays(today, 1), addDays(today, days));
}

/** The charge of each bill in `month` to show as logged or not: the first one not logged yet, else the last one. By bill id. */
export function monthCharges(ds: Pick<Dataset, "subscriptions" | "transactions">, month: string): Map<string, LoggedCharge> {
  const out = new Map<string, LoggedCharge>();
  for (const c of chargesBetween(ds, `${month}-01`, `${month}-${String(daysInMonth(month)).padStart(2, "0")}`)) {
    const cur = out.get(c.sub.id);
    // dates ascending: keep the first one not logged; while all so far are logged, move on to the latest
    if (!cur || cur.paid) out.set(c.sub.id, c);
  }
  return out;
}

/**
 * The expense to log when a bill is marked paid — copying how the last one was logged, if any.
 * `paidOn` is for a charge paid ahead of time: the expense is dated that day when it still counts
 * for this charge (see paidBy), otherwise on the charge date.
 */
export function billTransaction(c: BillCharge, ds: Pick<Dataset, "transactions" | "settings">, now = new Date().toISOString(), paidOn?: string): Transaction {
  const { sub } = c;
  const last = ds.transactions.find((t) => t.billId === sub.id || (!t.billId && looksLikeBill(t, sub)));
  const early = paidOn && paidOn < c.date && paidBy(sub, c.date, [{ date: paidOn, billId: sub.id, category: "", merchant: "", description: "" }]) ? paidOn : undefined;
  return {
    id: uid("t"),
    date: early ?? c.date,
    category: sub.category,
    subcategory: sub.subcategory || last?.subcategory || "",
    description: sub.name,
    amount: round2(sub.amount),
    payment: sub.payment || last?.payment || ds.settings.paymentMethods[0] || "",
    type: last?.type ?? "fixed",
    priority: last?.priority ?? "important",
    // the bill's merchant, else the last one's — not the bill's name, which is what it was paid for
    merchant: sub.merchant || last?.merchant || "",
    recurring: true,
    notes: "",
    receiptUrl: "",
    createdAt: now,
    updatedAt: now,
    group: "",
    billId: sub.id,
  };
}

/** A new recurring bill for an expense that repeats: charged again every `cycle` from that expense's date. */
export function billFromTransaction(
  tx: Pick<Transaction, "date" | "description" | "merchant" | "category" | "subcategory" | "amount" | "payment">,
  cycle: Cycle,
  today = todayISO(),
): Subscription {
  const sub: Subscription = {
    id: uid("sub"),
    name: (tx.description || tx.merchant || tx.category).slice(0, 120),
    category: tx.category,
    subcategory: tx.subcategory,
    merchant: tx.merchant,
    amount: round2(Math.abs(tx.amount)),
    cycle,
    billingDay: cycle === "monthly" ? Number(tx.date.slice(8, 10)) : null,
    nextCharge: cycle === "monthly" ? "" : tx.date,
    payment: tx.payment,
    status: "active",
    trialEnd: "",
    worthIt: "yes",
    notes: "",
    kind: guessKind(tx.category),
  };
  // longer cycles step from a known charge date: this expense's, moved on to the next one still to come
  if (cycle !== "monthly") sub.nextCharge = billDates(sub, addDays(today, 1), addDays(today, 400))[0] ?? tx.date;
  return sub;
}

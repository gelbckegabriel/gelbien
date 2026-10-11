/**
 * Recurring bills (the Subscriptions list): when they are charged, whether a charge was already
 * logged, and the expense to log for one. Pure, so it runs the same in demo and Google mode.
 */
import { addDays, looksLikeBill, paidBy } from "./bill-match";
import { guessKind } from "./defaults";
import { loanPayments, planCharges, planSchedule } from "./plans";
import type { Cycle, Dataset, Plan, Subscription, Transaction } from "./types";
import { addMonths, daysInMonth, monthOf, round2, todayISO, uid } from "./utils";

export { addDays, looksLikeBill, paidBy } from "./bill-match";

export interface BillCharge {
  sub: Subscription;
  /** YYYY-MM-DD */
  date: string;
  /** a loan's payment, shown as a bill: the plan it belongs to */
  plan?: Plan;
}

/** What the bill functions read: the recurring payments, and the loans whose payments show up as bills */
export type BillsData = Pick<Dataset, "subscriptions" | "transactions"> & Partial<Pick<Dataset, "plans" | "settings">>;

/** A charge and the expense that paid it, if one was logged */
export interface LoggedCharge extends BillCharge {
  paid?: Transaction;
}

const CYCLE_MONTHS: Record<Exclude<Cycle, "weekly">, number> = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, annual: 12 };

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

export const chargeKey = (c: BillCharge) => `${c.sub.id}|${c.date}`;

/** Every charge between `from` and `to` (inclusive) — loan payments included — by date, each with the expense that paid it, if any. */
export function chargesBetween(ds: BillsData, from: string, to: string): LoggedCharge[] {
  const loans = (ds.plans ?? []).flatMap((p) => planCharges(p, from, to, ds.settings?.currency));
  // a loan payment counts as paid whenever the loan counts it (one logged on another day, paid ahead)
  const byLoan = new Map<string, { dates: string[]; by: (Transaction | undefined)[] }>();
  const loanPaid = (c: BillCharge) => {
    const p = c.plan!;
    let m = byLoan.get(p.id);
    if (!m) {
      const schedule = planSchedule(p, ds.settings?.currency);
      m = { dates: schedule.map((x) => x.date), by: loanPayments(p, schedule, ds.transactions).by };
      byLoan.set(p.id, m);
    }
    return m.by[m.dates.indexOf(c.date)];
  };
  return [...ds.subscriptions.flatMap((sub) => billDates(sub, from, to).map((date): BillCharge => ({ sub, date }))), ...loans]
    .map((c) => ({ ...c, paid: paidBy(c.sub, c.date, ds.transactions) ?? (c.plan ? loanPaid(c) : undefined) }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * Charges this month up to today (plus the last week, across a month boundary) that nothing
 * was logged for and that weren't skipped.
 */
export function dueBills(ds: BillsData, today = todayISO(), skipped: ReadonlySet<string> = new Set()): BillCharge[] {
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
  ds: BillsData,
  month: string,
  today = todayISO(),
  skipped: ReadonlySet<string> = new Set(),
): BillCharge[] {
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  if (last < today) return [];
  return chargesBetween(ds, `${month}-01`, last).filter((c) => !c.paid && !skipped.has(chargeKey(c)));
}

/** Charges after today, within `days` — `paid` when one was paid early. */
export function upcomingBills(ds: BillsData, today = todayISO(), days = 30): LoggedCharge[] {
  return chargesBetween(ds, addDays(today, 1), addDays(today, days));
}

/** The charge of each bill in `month` to show as logged or not: the first one not logged yet, else the last one. By bill id. */
export function monthCharges(ds: BillsData, month: string): Map<string, LoggedCharge> {
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

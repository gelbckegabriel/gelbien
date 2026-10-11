/**
 * Payment plans: purchases split into installments, and loans (mortgages, car loans…), paid off month by
 * month. The schedule — each payment, how much of it is interest, what's still owed — is worked out from
 * the plan; nothing of it is stored. Pure, so it runs the same in demo and Google mode.
 */
import { addDays, paidBy } from "./bill-match";
import type { Dataset, Plan, PlanExtra, Prepayment, PrepayMode, Subscription, Transaction } from "./types";
import { addMonths, daysInMonth, monthOf, round2, todayISO } from "./utils";

export interface PlanPayment {
  /** 1-based */
  seq: number;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  interest: number;
  principal: number;
  /** owed after this payment (and any one-time payment that month) */
  balance: number;
}

/** What was borrowed: the price less the down payment (installments: the whole price) */
export const financed = (p: Pick<Plan, "kind" | "price" | "downPayment">) => round2(Math.max(0, p.kind === "installments" ? p.price : p.price - p.downPayment));

/** The same day `months` later, kept inside shorter months (31 January → 28 February) */
export function shiftDate(iso: string, months: number, day = Number(iso.slice(8, 10))): string {
  const m = addMonths(iso.slice(0, 7), months);
  return `${m}-${String(Math.min(day, daysInMonth(m))).padStart(2, "0")}`;
}

/**
 * Interest per month. Canadian fixed-rate mortgages compound twice a year (it's the law), so theirs is the
 * monthly rate that matches that; everything else compounds monthly.
 */
export function monthlyRate(p: Pick<Plan, "kind" | "rate">, currency = ""): number {
  if (p.rate <= 0) return 0;
  return p.kind === "mortgage" && currency === "CAD" ? (1 + p.rate / 200) ** (1 / 6) - 1 : p.rate / 1200;
}

/** The extra paid on top of the payment in `month`: the latest change on or before it */
export function extraIn(extras: PlanExtra[], month: string): number {
  let out = 0;
  let at = "";
  for (const e of extras) if (e.from <= month && e.from >= at) [out, at] = [e.amount, e.from];
  return out;
}

const schedules = new WeakMap<Plan, Map<string, PlanPayment[]>>();

/** Every payment of a plan, first to last, with its extras and one-time payments. */
export function planSchedule(p: Plan, currency = ""): PlanPayment[] {
  const byCurrency = schedules.get(p) ?? new Map<string, PlanPayment[]>();
  let out = byCurrency.get(currency);
  if (!out) {
    out = buildSchedule(p, currency);
    byCurrency.set(currency, out);
    schedules.set(p, byCurrency);
  }
  return out;
}

function buildSchedule(p: Plan, currency: string): PlanPayment[] {
  const out: PlanPayment[] = [];
  const n = Math.max(1, Math.round(p.count));
  let balance = financed(p);
  if (balance <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.firstDate)) return out;
  const day = Number(p.firstDate.slice(8, 10));

  if (p.kind === "installments") {
    // interest-free parts of the total: equal, the last one taking the cents left over
    const part = round2(balance / n);
    for (let k = 1; k <= n; k++) {
      const amount = k === n ? balance : part;
      balance = round2(balance - amount);
      out.push({ seq: k, date: shiftDate(p.firstDate, k - 1, day), amount, interest: 0, principal: amount, balance });
    }
    return out;
  }

  const sac = p.amortization === "sac";
  const rateOf = (rate: number) => monthlyRate({ kind: p.kind, rate }, currency);
  let r = monthlyRate(p, currency);
  // the payment that clears `owed` in `left` equal payments at the rate in effect
  const level = (owed: number, left: number, rr = r) => (left <= 0 ? owed : rr > 0 ? (owed * rr) / (1 - (1 + rr) ** -left) : owed / left);
  // how many payments of `pay` (extras aside) it takes to clear `owed` at `rr`: where the loan is heading
  const paymentsLeft = (owed: number, pay: number, rr = r) => {
    if (owed <= 0.005) return 0;
    if (sac) return Math.ceil(owed / share - 1e-9);
    if (pay <= 0) return Infinity;
    if (rr <= 0) return Math.ceil(owed / pay - 1e-9);
    const x = 1 - (rr * owed) / pay;
    return x <= 0 ? Infinity : Math.ceil(-Math.log(x) / Math.log(1 + rr) - 1e-9);
  };
  let payment = level(balance, n); // fixed payments (Price)
  let share = balance / n; // decreasing payments (SAC): the same part of the debt every month
  // the payment planned to be the last: the term, until a one-time payment or a new rate moves it
  let last = n;
  const oneTime = new Map<string, Prepayment[]>();
  const firstMonth = p.firstDate.slice(0, 7);
  for (const x of [...p.prepayments].sort((a, b) => (a.month < b.month ? -1 : 1))) {
    if (x.month >= firstMonth) {
      oneTime.set(x.month, [...(oneTime.get(x.month) ?? []), x]);
      continue;
    }
    // paid before the first payment: straight off what's borrowed
    balance = round2(balance - Math.min(balance, x.amount));
    if (x.mode === "lower") {
      payment = level(balance, last);
      share = balance / last;
    } else last = Math.max(1, Math.min(last, paymentsLeft(balance, payment)));
  }
  const changes = (p.rateChanges ?? []).filter((c) => /^\d{4}-\d{2}$/.test(c.from)).sort((a, b) => (a.from < b.from ? -1 : 1));
  let next = 0; // the next rate change to apply

  // 1200 months is the end of any loan
  for (let k = 1; balance > 0.005 && k <= 1200; k++) {
    const date = shiftDate(p.firstDate, k - 1, day);
    const month = date.slice(0, 7);
    // a new rate from this payment on: what's owed now is all it works on, earlier payments stay as they were
    while (next < changes.length && changes[next].from <= month) {
      const c = changes[next++];
      const nr = rateOf(c.rate);
      // where it's heading at the old rate (never past the term): the end date a renewal keeps
      const heading = Math.max(1, Math.min(last - k + 1, paymentsLeft(balance, payment)));
      if (sac) {
        // the same part of the debt every month: only the interest on it changes
      } else if (c.keep === "payment" && payment > balance * nr + 0.005 && k - 1 + paymentsLeft(balance, payment, nr) <= 1200) {
        // the payment stays, the end moves (later with a higher rate, sooner with a lower one)
        last = k - 1 + paymentsLeft(balance, payment, nr);
      } else {
        // the end stays and the payment changes — also when the old payment wouldn't even cover the new
        // interest, or only just (it would take past a hundred years)
        payment = level(balance, heading, nr);
        last = k - 1 + heading;
      }
      r = nr;
    }
    const interest = round2(balance * r);
    // the last planned payment clears what's left (the cents rounding leaves behind)
    // in cents, so the payment is exactly its interest plus its principal
    const principal = k >= last ? balance : round2(Math.min(balance, Math.max(0, (sac ? share : payment - interest) + extraIn(p.extras, month))));
    balance = round2(balance - principal);
    for (const x of oneTime.get(month) ?? []) {
      balance = round2(balance - Math.min(balance, x.amount));
      if (balance <= 0.005) break;
      if (x.mode === "lower") {
        // keep the end date: spread what's left over the payments still to come
        const left = Math.max(1, last - k);
        payment = level(balance, left);
        share = balance / left;
      } else {
        // same payment, fewer of them
        last = Math.max(k + 1, Math.min(last, k + paymentsLeft(balance, payment)));
      }
    }
    out.push({ seq: k, date, amount: round2(interest + principal), interest, principal, balance });
  }
  return out;
}

/**
 * Where a loan's payments go, year by year: what pays the loan itself down (principal) and what's
 * interest — early on, mostly interest — with what's still owed at the end of each year.
 */
export function yearlySplit(schedule: PlanPayment[]): { year: string; principal: number; interest: number; balance: number }[] {
  const out: { year: string; principal: number; interest: number; balance: number }[] = [];
  for (const pay of schedule) {
    const year = pay.date.slice(0, 4);
    let row = out[out.length - 1];
    if (!row || row.year !== year) out.push((row = { year, principal: 0, interest: 0, balance: 0 }));
    row.principal = round2(row.principal + pay.principal);
    row.interest = round2(row.interest + pay.interest);
    row.balance = pay.balance;
  }
  return out;
}

/** What the payments made (see planStanding's `made`) came to: paying the loan down (principal) and interest. */
export function paidSoFar(schedule: PlanPayment[], made: boolean[]): { principal: number; interest: number } {
  let principal = 0;
  let interest = 0;
  schedule.forEach((pay, i) => {
    if (!made[i]) return;
    principal += pay.principal;
    interest += pay.interest;
  });
  return { principal: round2(principal), interest: round2(interest) };
}

/** Owed on `asOf`, after the payments made by then: what was borrowed before the first one. */
export function balanceAt(p: Plan, asOf = todayISO(), currency = ""): number {
  let owed = financed(p);
  let through = ""; // month of the last payment made by then
  for (const pay of planSchedule(p, currency)) {
    if (pay.date > asOf) break;
    owed = pay.balance;
    through = pay.date.slice(0, 7);
  }
  // the schedule counts a one-time payment along with its month's payment: one made this month ahead of
  // that payment (or before the first one) is already off what's owed
  const month = asOf.slice(0, 7);
  const early = p.prepayments.filter((x) => x.month > through && x.month <= month).reduce((a, x) => a + x.amount, 0);
  return round2(Math.max(0, owed - early));
}

export interface PlanStanding {
  schedule: PlanPayment[];
  /** payments made: a loan's, the ones marked paid (and those before it was added); installments', those past */
  paid: number;
  /** for each payment of the schedule, whether it's been made */
  made: boolean[];
  /** the first payment not made yet (it may be overdue) */
  next: PlanPayment | null;
  /** still owed */
  owed: number;
  /** month of the first and last payments (YYYY-MM) */
  start: string;
  end: string;
  done: boolean;
  /** interest still to pay */
  interestLeft: number;
}

/**
 * Which of a loan's payments have been made, and the expense that paid each (none for one made before
 * Gelbien knew of the loan). Those before it was added to Gelbien happened before it
 * knew of the loan; since then, a payment is made once it's marked paid — the expense that covers it the
 * way "were these paid?" sees it (linked, or typed in looking like it, around its date), or any other
 * payment logged for the loan (ahead of time, or late), which goes to the earliest one still open.
 */
export function loanPayments<T extends Pick<Transaction, "id" | "date" | "billId" | "category" | "merchant" | "description">>(
  p: Plan,
  schedule: PlanPayment[],
  transactions: T[],
  today = todayISO(),
): { made: boolean[]; by: (T | undefined)[] } {
  const tracked = trackedFrom(p);
  const made = schedule.map((pay) => pay.date < tracked);
  const by: (T | undefined)[] = schedule.map(() => undefined);
  const candidates = transactions.filter((t) => t.billId === p.id || (!t.billId && t.category === p.category));
  if (!candidates.length) return { made, by };
  const used = new Set<string>();
  // the payments that are due (or about to be): by the expense around their date
  const horizon = addDays(today, 45);
  schedule.forEach((pay, i) => {
    if (made[i] || pay.date > horizon) return;
    const t = paidBy(planBill(p, pay, schedule.length), pay.date, candidates.filter((x) => !used.has(x.id)));
    if (t) {
      made[i] = true;
      by[i] = t;
      used.add(t.id);
    }
  });
  // the rest of the payments logged for it (paid well ahead, or late): one payment each, in order
  const lo = addDays(tracked, -31);
  for (const t of [...candidates].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    if (used.has(t.id) || t.billId !== p.id || t.date < lo) continue;
    const i = made.indexOf(false);
    if (i < 0) break;
    made[i] = true;
    by[i] = t;
    used.add(t.id);
  }
  return { made, by };
}

/**
 * Where a plan stands today. Installments go by their expenses (`transactions`), which can be edited or
 * deleted one by one; a loan by the payments marked paid (see loanPayments): what's owed is what was
 * borrowed less what those paid down and the one-time payments made so far.
 */
export function planStanding(p: Plan, ds: Pick<Dataset, "transactions"> & Partial<Pick<Dataset, "settings">>, today = todayISO()): PlanStanding {
  const schedule = planSchedule(p, ds.settings?.currency);
  const start = schedule[0]?.date.slice(0, 7) ?? monthOf(p.firstDate || today);
  if (p.kind === "installments") {
    const parts = installmentsOf(p, ds.transactions);
    const left = p.status === "cancelled" ? [] : parts.filter((t) => t.date > today);
    const last = parts[parts.length - 1]?.date ?? schedule[schedule.length - 1]?.date ?? p.firstDate;
    const owed = round2(left.reduce((a, t) => a + t.amount, 0));
    return {
      schedule,
      paid: parts.length - left.length,
      made: schedule.map((_, i) => i < parts.length - left.length),
      next: left.length ? { seq: parts.length - left.length + 1, date: left[0].date, amount: left[0].amount, interest: 0, principal: left[0].amount, balance: round2(owed - left[0].amount) } : null,
      owed,
      start,
      end: monthOf(last),
      done: left.length === 0,
      interestLeft: 0,
    };
  }
  const cancelled = p.status === "cancelled";
  const { made } = loanPayments(p, schedule, ds.transactions, today);
  const nextIndex = made.indexOf(false);
  const month = monthOf(today);
  const paidDown = schedule.reduce((a, pay, i) => (made[i] ? a + pay.principal : a), 0);
  const oneTime = p.prepayments.filter((x) => x.month <= month).reduce((a, x) => a + x.amount, 0);
  return {
    schedule,
    paid: made.filter(Boolean).length,
    made,
    next: cancelled || nextIndex < 0 ? null : schedule[nextIndex],
    owed: cancelled ? 0 : round2(Math.max(0, financed(p) - paidDown - oneTime)),
    start,
    end: schedule[schedule.length - 1]?.date.slice(0, 7) ?? start,
    done: cancelled || nextIndex < 0,
    interestLeft: round2(schedule.reduce((a, pay, i) => (made[i] ? a : a + pay.interest), 0)),
  };
}

/**
 * What's owed on a loan on `date`: today (or later), going by the payments marked paid (planStanding);
 * an earlier day, by its schedule — as if each payment went out on its date.
 */
export function owedOn(p: Plan, ds: Pick<Dataset, "transactions"> & Partial<Pick<Dataset, "settings">>, date: string, today = todayISO()): number {
  return date >= today ? planStanding(p, ds, today).owed : balanceAt(p, date, ds.settings?.currency);
}

/**
 * What links an extra payment's expense to its loan. Not the plan's id: an expense with that one is the
 * month's regular payment (see paidBy), and the extra would stand in for it.
 */
export const extraPaymentLink = (planId: string) => `${planId}~extra`;

/**
 * Tells the expenses that pay a plan — its installments, loan payments and extra payments — from the
 * rest. They count on the budget's own Commitments line, not against their category's limit.
 */
export function planPaymentTest(plans: Pick<Plan, "id">[] | undefined): (t: Pick<Transaction, "billId">) => boolean {
  const ids = new Set((plans ?? []).map((p) => p.id));
  if (!ids.size) return () => false;
  return (t) => !!t.billId && (ids.has(t.billId) || (t.billId.endsWith("~extra") && ids.has(t.billId.slice(0, -"~extra".length))));
}

/**
 * Keeps a loan's extra payments in step with the expenses that record them (paid from the month's
 * money): an expense deleted takes its extra payment off the loan, one edited moves or resizes it, one
 * brought back (undo) puts it back. Compares the data before and after a change and returns the plan
 * updates to make with it. `modes` remembers, by expense, whether a removed one finished the loan
 * sooner or lowered the payment, so an undo restores it as it was.
 */
export function linkedPlanChanges(
  before: Pick<Dataset, "transactions" | "plans">,
  after: Pick<Dataset, "transactions" | "plans">,
  modes: Map<string, PrepayMode>,
): { op: "upsertPlan"; plan: Plan }[] {
  const extras = (txs: Transaction[]) => new Map(txs.filter((t) => t.billId.endsWith("~extra")).map((t) => [t.id, t]));
  const was = extras(before.transactions);
  const now = extras(after.transactions);
  const same = (a: Transaction, b: Transaction) => a.billId === b.billId && monthOf(a.date) === monthOf(b.date) && Math.abs(a.amount - b.amount) < 0.005;
  const removed = [...was.values()].filter((t) => !now.has(t.id) || !same(t, now.get(t.id)!));
  const added = [...now.values()].filter((t) => !was.has(t.id) || !same(t, was.get(t.id)!));
  if (!removed.length && !added.length) return [];

  const plans = new Map(after.plans.map((p) => [p.id, p]));
  const changed = new Map<string, Plan>();
  const planOf = (t: Transaction) => {
    const id = t.billId.slice(0, -"~extra".length);
    return changed.get(id) ?? plans.get(id);
  };
  const matches = (t: Transaction) => (x: Prepayment) => x.month === monthOf(t.date) && Math.abs(x.amount - t.amount) < 0.005;
  for (const t of removed) {
    const p = planOf(t);
    const i = p?.prepayments.findIndex(matches(t)) ?? -1;
    if (!p || i < 0) continue; // already gone (taken off in the plan itself)
    modes.set(t.id, p.prepayments[i].mode);
    changed.set(p.id, { ...p, prepayments: p.prepayments.filter((_, j) => j !== i) });
  }
  for (const t of added) {
    const p = planOf(t);
    if (!p || p.kind === "installments" || p.prepayments.some(matches(t))) continue; // already there (recorded with the plan)
    changed.set(p.id, { ...p, prepayments: [...p.prepayments, { month: monthOf(t.date), amount: round2(t.amount), mode: modes.get(t.id) ?? "shorten" }] });
  }
  return [...changed.values()].map((plan) => ({ op: "upsertPlan" as const, plan }));
}

/**
 * Keeps a loan's logged payments in step with its plan. When the plan changes, a payment logged at what
 * the plan said it would be follows the new figure — and its "Name · 3/60" label a new name or count, its
 * category a new one. One typed in differently (what the bank actually took) is left as it is. A change
 * that starts later (an extra, a new rate, a one-time payment) leaves the plan's earlier payments as they
 * were, so their logs don't move either: only a correction of the loan itself reaches back.
 */
export function linkedPaymentChanges(
  before: Pick<Dataset, "transactions" | "plans">,
  after: Pick<Dataset, "transactions" | "plans">,
  currency = "",
  now = new Date().toISOString(),
): { op: "updateTransaction"; tx: Transaction }[] {
  const out: { op: "updateTransaction"; tx: Transaction }[] = [];
  const previous = new Map(before.plans.map((p) => [p.id, p]));
  for (const p of after.plans) {
    const prev = previous.get(p.id);
    if (!prev || prev === p || p.kind === "installments") continue;
    const was = planSchedule(prev, currency);
    const is = planSchedule(p, currency);
    const label = (plan: Plan, pay: PlanPayment, count: number) => `${plan.name} · ${pay.seq}/${count}`;
    for (const t of after.transactions) {
      if (t.billId !== p.id) continue;
      // which payment it was: by its label, else the payment due closest to it (within three weeks)
      const bySeq = was.find((pay) => t.description === label(prev, pay, was.length));
      const near = bySeq ?? was.reduce<PlanPayment | undefined>((best, pay) => {
        const gap = Math.abs(Date.parse(pay.date) - Date.parse(t.date));
        return gap <= 21 * 86400000 && (!best || gap < Math.abs(Date.parse(best.date) - Date.parse(t.date))) ? pay : best;
      }, undefined);
      if (!near) continue;
      const then = near;
      const nowPay = is[then.seq - 1];
      if (!nowPay) continue;
      const atPlan = Math.abs(t.amount - then.amount) < 0.005;
      const amount = atPlan ? nowPay.amount : t.amount;
      // the label follows a new name, or a correction that reaches this payment — not a count that a
      // change starting later shortened
      const relabel = prev.name !== p.name || Math.abs(nowPay.amount - then.amount) >= 0.005;
      const description = relabel && t.description === label(prev, then, was.length) ? label(p, nowPay, is.length) : t.description;
      const moved = t.category === prev.category && prev.category !== p.category;
      const category = moved ? p.category : t.category;
      const subcategory = moved || (t.category === p.category && t.subcategory === prev.subcategory) ? p.subcategory : t.subcategory;
      if (Math.abs(amount - t.amount) >= 0.005 || description !== t.description || category !== t.category || subcategory !== t.subcategory) {
        out.push({ op: "updateTransaction", tx: { ...t, amount, description, category, subcategory, updatedAt: now } });
      }
    }
  }
  return out;
}

/**
 * The budget's Commitments line for `month`: what the plans take (installments falling in it, loan
 * payments due — from when each loan was added) and what's been logged against them. An extra payment
 * made from the month's money counts as planned too (`extra`): it was decided, not overspent.
 */
export function commitmentsIn(ds: Partial<Pick<Dataset, "plans" | "settings">> & Pick<Dataset, "transactions">, month: string): { planned: number; paid: number; extra: number } {
  let planned = 0;
  for (const p of ds.plans ?? []) {
    if (p.kind === "installments") planned += installmentsOf(p, ds.transactions).filter((t) => monthOf(t.date) === month).reduce((a, t) => a + t.amount, 0);
    else if (p.status === "active" && month >= trackedFrom(p).slice(0, 7)) planned += planSchedule(p, ds.settings?.currency).filter((s) => s.date.slice(0, 7) === month).reduce((a, s) => a + s.amount, 0);
  }
  const pays = planPaymentTest(ds.plans);
  let paid = 0;
  let extra = 0;
  for (const t of ds.transactions) {
    if (monthOf(t.date) !== month || !pays(t)) continue;
    paid += t.amount;
    if (t.billId.endsWith("~extra")) extra += t.amount;
  }
  return { planned: round2(planned + extra), paid: round2(paid), extra: round2(extra) };
}

/** The expenses of an installment plan, by date */
export function installmentsOf(p: Pick<Plan, "id">, transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => t.billId === p.id).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/**
 * The expenses for a purchase split into installments: one per month from the plan's first date, each
 * labelled "3/12" and linked to the plan by `billId`. `base` is the expense as typed (category, priority…).
 */
export function installmentTransactions(p: Plan, base: Omit<Transaction, "id" | "date" | "amount" | "description" | "billId" | "group">, newId: () => string): Transaction[] {
  const schedule = planSchedule(p);
  return schedule.map((pay) => ({
    ...base,
    id: newId(),
    date: pay.date,
    amount: pay.amount,
    description: `${p.name} · ${pay.seq}/${schedule.length}`,
    group: "",
    billId: p.id,
  }));
}

/** Whether a plan's payment shows up as a bill: a loan still running, from the month it was added */
const billed = (p: Plan) => p.kind !== "installments" && p.status === "active";

/** From when a plan's payments are tracked: the month it was added (earlier ones happened before Gelbien knew of it) */
export function trackedFrom(p: Plan): string {
  const added = /^\d{4}-\d{2}/.test(p.createdAt) ? `${p.createdAt.slice(0, 7)}-01` : "";
  return added > p.firstDate ? added : p.firstDate;
}

/** A loan payment as a bill, so it shows wherever bills do — upcoming, "were these paid?", the budget's committed money */
export function planBill(p: Plan, pay: PlanPayment, count: number): Subscription {
  return {
    id: p.id,
    name: `${p.name} · ${pay.seq}/${count}`,
    category: p.category,
    amount: pay.amount,
    cycle: "monthly",
    billingDay: Number(p.firstDate.slice(8, 10)),
    payment: p.payment,
    status: "active",
    trialEnd: "",
    worthIt: "yes",
    notes: "",
    nextCharge: "",
    kind: "bill",
    subcategory: p.subcategory,
    merchant: p.merchant,
  };
}

/** A loan's payments due between `from` and `to` (inclusive), as bills */
export function planCharges(p: Plan, from: string, to: string, currency = ""): { sub: Subscription; date: string; plan: Plan }[] {
  if (!billed(p)) return [];
  const schedule = planSchedule(p, currency);
  const start = trackedFrom(p);
  return schedule.filter((s) => s.date >= from && s.date <= to && s.date >= start).map((s) => ({ sub: planBill(p, s, schedule.length), date: s.date, plan: p }));
}

/** What a plan takes out of `month`: its installment(s) that month, or the loan's payment */
export function planAmountIn(p: Plan, month: string, ds: Pick<Dataset, "transactions"> & Partial<Pick<Dataset, "settings">>): number {
  if (p.status !== "active") return 0;
  if (p.kind === "installments") return round2(installmentsOf(p, ds.transactions).filter((t) => monthOf(t.date) === month).reduce((a, t) => a + t.amount, 0));
  return round2(planSchedule(p, ds.settings?.currency).filter((s) => s.date.slice(0, 7) === month).reduce((a, s) => a + s.amount, 0));
}

/** Installments still to pay on `asOf` that count as a debt in net worth (from plans bought by then) */
export function installmentsOwed(ds: Partial<Pick<Dataset, "plans" | "transactions">>, asOf = todayISO()): number {
  let owed = 0;
  for (const p of ds.plans ?? []) {
    if (p.kind !== "installments" || p.status !== "active" || !p.countAsDebt || (p.createdAt && p.createdAt.slice(0, 10) > asOf)) continue;
    for (const t of installmentsOf(p, ds.transactions ?? [])) if (t.date > asOf) owed += t.amount;
  }
  return round2(owed);
}

export interface Commitments {
  /** committed in the current month, and in the next one that's different (a plan starting or ending) */
  thisMonth: number;
  change: { month: string; total: number } | null;
  /** everything still owed across the plans */
  owed: number;
  lines: { plan: Plan; standing: PlanStanding; monthly: number }[];
  /** plans ending in the next five years: the month money frees up, and how much */
  frees: { plan: Plan; month: string; amount: number }[];
}

/** The plans still running: what they take each month, what's still owed, when money frees up. */
export function commitments(ds: Pick<Dataset, "plans" | "transactions"> & Partial<Pick<Dataset, "settings">>, today = todayISO()): Commitments {
  const month = monthOf(today);
  const lines = ds.plans
    .filter((p) => p.status === "active")
    .map((plan) => {
      const standing = planStanding(plan, ds, today);
      // this month's payment, or the next one when it hasn't started (or this month's is already behind it)
      const monthly = planAmountIn(plan, month, ds) || standing.next?.amount || 0;
      return { plan, standing, monthly };
    })
    .filter((l) => !l.standing.done || planAmountIn(l.plan, month, ds) > 0)
    .sort((a, b) => (a.standing.end < b.standing.end ? -1 : a.standing.end > b.standing.end ? 1 : 0));
  const total = (m: string) => round2(lines.reduce((a, l) => a + planAmountIn(l.plan, m, ds), 0));
  const thisMonth = total(month);
  let change: Commitments["change"] = null;
  for (let i = 1; i <= 24 && !change; i++) {
    const m = addMonths(month, i);
    const t = total(m);
    // a last installment a few cents off (what's left after rounding) isn't a change worth showing
    if (Math.abs(t - thisMonth) >= 1) change = { month: m, total: t };
  }
  const horizon = addMonths(month, 60);
  return {
    thisMonth,
    change,
    owed: round2(lines.reduce((a, l) => a + l.standing.owed, 0)),
    lines,
    frees: lines
      .filter((l) => l.standing.end < horizon)
      // the regular payment, not the last one (often a smaller remainder)
      .map((l) => ({ plan: l.plan, month: addMonths(l.standing.end, 1), amount: l.monthly }))
      .filter((f) => f.month > month),
  };
}

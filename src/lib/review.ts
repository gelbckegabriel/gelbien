/**
 * Month-end review: how a finished month went against the plan, how it compares with the usual,
 * and what to change. Pure (built on summarizeMonth) so it is unit-tested and identical in demo
 * and Google mode.
 */
import { COMMITMENTS_STYLE } from "./defaults";
import { monthlyCost, summarizeMonth, type MonthSummary } from "./finance";
import { accountsReserve } from "./goals";
import { planPaymentTest } from "./plans";
import type { Dataset, Transaction } from "./types";
import { addMonths, daysInMonth, round2, todayISO } from "./utils";

export interface ReviewLine {
  name: string;
  spent: number;
  budget: number;
  /** over budget (positive) or left over (positive), depending on the list */
  amount: number;
}

/** A category this month next to its limit (for the plan-vs-actual bars) */
export interface CategoryRow {
  name: string;
  color: string;
  icon: string;
  spent: number;
  budget: number;
  /** the folded "everything else" row */
  rest?: boolean;
  /** the Commitments line: installments and loans, against what they were due to take */
  commitments?: boolean;
}

/** A category that moved against its usual level (average of the months before) */
export interface Mover {
  name: string;
  color: string;
  icon: string;
  spent: number;
  usual: number;
  delta: number;
}

/** Something to change, with how much it's worth (to rank them) */
export type Suggestion = { impact: number } & (
  /** over the limit most months: the limit is unrealistic */
  | { kind: "raiseLimit"; category: string; limit: number; average: number; suggested: number; months: number }
  /** far under the limit every month: money parked there could go to savings */
  | { kind: "lowerLimit"; category: string; limit: number; average: number; suggested: number }
  /** over this month only */
  | { kind: "overspent"; category: string; over: number; biggest: Transaction | null }
  /** real spending in categories with no limit to plan for it (biggest first) */
  | { kind: "unplanned"; categories: string[]; spent: number }
  /** subscriptions the user isn't sure are worth it */
  | { kind: "subscriptions"; names: string[]; monthly: number }
  | { kind: "superfluous"; amount: number; share: number; half: number }
  /** nothing to fix */
  | { kind: "wellDone"; under: number }
);

const roundUp = (n: number, to = 10) => Math.ceil(n / to) * to;
const spentIn = (s: MonthSummary, name: string) => s.byCategory.find((c) => c.name === name)?.spent ?? 0;
// against a limit: without installments and loans, which have their own line
const ownIn = (s: MonthSummary, name: string) => s.byCategory.find((c) => c.name === name)?.own ?? 0;
const budgetIn = (s: MonthSummary, name: string) => s.byCategory.find((c) => c.name === name)?.budget ?? 0;

/** The Commitments line first (when there are any), then the top `n` categories by spending against their limits, the rest folded into one row */
export function categoryRows(s: MonthSummary, n = 6): CategoryRow[] {
  const { planned, paid } = s.commitments;
  const commitments: CategoryRow[] = planned > 0 || paid > 0 ? [{ name: "", commitments: true, ...COMMITMENTS_STYLE, spent: paid, budget: planned }] : [];
  const rows = s.byCategory
    .filter((c) => c.own > 0 || c.budget > 0)
    .sort((a, b) => b.own - a.own || b.budget - a.budget)
    .map(({ name, color, icon, own, budget }) => ({ name, color, icon, spent: own, budget }));
  if (rows.length <= n + 1) return [...commitments, ...rows];
  const rest = rows.slice(n);
  return [
    ...commitments,
    ...rows.slice(0, n),
    { name: "", rest: true, color: "#46454c", icon: "Package", spent: round2(rest.reduce((a, r) => a + r.spent, 0)), budget: round2(rest.reduce((a, r) => a + r.budget, 0)) },
  ];
}

/** Categories well above or below their average of the `prior` months (at least $25 and 20% apart) */
export function movers(s: MonthSummary, prior: MonthSummary[], n = 4): Mover[] {
  if (!prior.length) return [];
  const names = new Set([...s.byCategory.map((c) => c.name), ...prior.flatMap((p) => p.byCategory.map((c) => c.name))]);
  const cat = new Map([...prior, s].flatMap((x) => x.byCategory.map((c) => [c.name, c] as const)));
  return [...names]
    .map((name) => {
      const usual = round2(prior.reduce((a, p) => a + spentIn(p, name), 0) / prior.length);
      const spent = spentIn(s, name);
      const c = cat.get(name)!;
      return { name, color: c.color, icon: c.icon, spent, usual, delta: round2(spent - usual) };
    })
    .filter((m) => Math.abs(m.delta) >= 25 && Math.abs(m.delta) >= 0.2 * Math.max(m.usual, m.spent))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, n);
}

/**
 * What to change, most valuable first. `recent` is this month and the ones before it (newest first)
 * that have spending — patterns across them say whether a limit is off or the month was a one-off.
 */
export function suggestions(ds: Dataset, s: MonthSummary, recent: MonthSummary[], n = 4): Suggestion[] {
  const out: Suggestion[] = [];
  const paysPlan = planPaymentTest(ds.plans);
  for (const c of s.byCategory.filter((x) => x.budget > 0)) {
    const window = recent.filter((r) => budgetIn(r, c.name) > 0);
    const overMonths = window.filter((r) => ownIn(r, c.name) > budgetIn(r, c.name)).length;
    const average = round2(window.reduce((a, r) => a + ownIn(r, c.name), 0) / Math.max(1, window.length));
    if (c.own > c.budget && overMonths >= 2) {
      const suggested = roundUp(average);
      if (suggested > c.budget) {
        out.push({ kind: "raiseLimit", category: c.name, limit: c.budget, average, suggested, months: overMonths, impact: round2(c.own - c.budget) });
        continue;
      }
    }
    // a few dollars over isn't worth a suggestion
    if (c.own - c.budget >= Math.max(20, 0.05 * c.budget)) {
      const biggest = ds.transactions.filter((t) => t.category === c.name && t.date.startsWith(s.month) && !paysPlan(t)).sort((a, b) => b.amount - a.amount)[0] ?? null;
      out.push({ kind: "overspent", category: c.name, over: round2(c.own - c.budget), biggest, impact: round2(c.own - c.budget) });
      continue;
    }
    if (c.own > c.budget) continue;
    // a limit that's barely touched, three months running
    if (window.length >= 3 && window.every((r) => ownIn(r, c.name) <= 0.6 * budgetIn(r, c.name))) {
      const suggested = Math.max(10, roundUp(average * 1.1));
      if (c.budget - suggested >= 20) out.push({ kind: "lowerLimit", category: c.name, limit: c.budget, average, suggested, impact: c.budget - suggested });
    }
  }
  const unplanned = s.byCategory.filter((x) => x.budget <= 0 && x.own >= 50);
  if (unplanned.length) {
    const spent = round2(unplanned.reduce((a, c) => a + c.own, 0));
    out.push({ kind: "unplanned", categories: unplanned.map((c) => c.name), spent, impact: spent });
  }
  const doubtful = ds.subscriptions.filter((x) => x.status === "active" && x.kind === "subscription" && x.worthIt !== "yes");
  if (doubtful.length) {
    const monthly = round2(doubtful.reduce((a, x) => a + monthlyCost(x), 0));
    out.push({ kind: "subscriptions", names: doubtful.map((x) => x.name), monthly, impact: monthly });
  }
  if (s.superfluousShare >= 0.15 && s.byPriority.superfluous >= 100) {
    const amount = round2(s.byPriority.superfluous);
    out.push({ kind: "superfluous", amount, share: s.superfluousShare, half: round2(amount / 2), impact: round2(amount / 2) });
  }
  // what went wrong first, then what could be better; the bigger amount first within each
  const problem = (x: Suggestion) => (x.kind === "raiseLimit" || x.kind === "overspent" ? 0 : 1);
  const ranked = out.sort((a, b) => problem(a) - problem(b) || b.impact - a.impact).slice(0, n);
  const troubled = ranked.some((x) => x.kind === "raiseLimit" || x.kind === "overspent");
  // a good month says so (last), so the list never reads as only criticism
  if (!troubled && s.budgetTotal > s.total && ranked.length < n) ranked.push({ kind: "wellDone", under: round2(s.budgetTotal - s.total), impact: 0 });
  return ranked;
}

export function monthReview(ds: Dataset, month: string, today = todayISO()) {
  const s = summarizeMonth(ds, month, today);
  const prev = summarizeMonth(ds, addMonths(month, -1), today);
  // the three months before, with spending: "usual" levels and repeating patterns
  const prior = [1, 2, 3].map((i) => summarizeMonth(ds, addMonths(month, -i), today)).filter((x) => x.count > 0);
  const budgeted = s.byCategory.filter((c) => c.budget > 0);
  const line = (c: (typeof s.byCategory)[number], amount: number): ReviewLine => ({ name: c.name, spent: c.own, budget: c.budget, amount: round2(amount) });
  const monthEnd = (m: string) => `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
  const nwStart = accountsReserve(ds, monthEnd(addMonths(month, -1)));
  const nwEnd = accountsReserve(ds, monthEnd(month));

  return {
    month,
    spent: s.total,
    planned: s.budgetTotal,
    /** planned − spent: positive = under plan */
    diff: round2(s.budgetTotal - s.total),
    net: s.income.net,
    saved: s.saved,
    plannedSavings: round2(s.income.net - s.budgetTotal),
    prevTotal: prev.total,
    change: prev.total > 0 ? (s.total - prev.total) / prev.total : null,
    /** up to 3 categories that went over, biggest overrun first */
    over: budgeted.filter((c) => c.own > c.budget).map((c) => line(c, c.own - c.budget)).sort((a, b) => b.amount - a.amount).slice(0, 3),
    /** up to 3 categories with the most left over */
    under: budgeted.filter((c) => c.own < c.budget).map((c) => line(c, c.budget - c.own)).sort((a, b) => b.amount - a.amount).slice(0, 3),
    /** spending in categories without a limit (installments and loans have their own line) */
    unplanned: round2(s.byCategory.filter((c) => c.budget <= 0).reduce((a, c) => a + c.own, 0)),
    largest: s.largest,
    /** net worth at the end of the previous month vs. the end of this one, when balances exist for both */
    netWorth: nwStart !== null && nwEnd !== null ? { start: nwStart, end: nwEnd, change: round2(nwEnd - nwStart) } : null,
    count: s.count,
    /** the full summary, for charts that take one (pace, priorities) */
    summary: s,
    categories: categoryRows(s),
    movers: movers(s, prior),
    /** the five biggest expenses */
    top: s.top.slice(0, 5),
    suggestions: suggestions(ds, s, [s, ...prior.slice(0, 2)]),
  };
}

export type MonthReview = ReturnType<typeof monthReview>;

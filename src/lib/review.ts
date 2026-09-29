/**
 * Month-end review: how a finished month went against the plan, in a handful of numbers.
 * Pure (built on summarizeMonth) so it is unit-tested and identical in demo and Google mode.
 */
import { summarizeMonth } from "./finance";
import { accountsReserve } from "./goals";
import type { Dataset } from "./types";
import { addMonths, daysInMonth, round2, todayISO } from "./utils";

export interface ReviewLine {
  name: string;
  spent: number;
  budget: number;
  /** over budget (positive) or left over (positive), depending on the list */
  amount: number;
}

export function monthReview(ds: Dataset, month: string, today = todayISO()) {
  const s = summarizeMonth(ds, month, today);
  const prev = summarizeMonth(ds, addMonths(month, -1), today);
  const budgeted = s.byCategory.filter((c) => c.budget > 0);
  const line = (c: (typeof s.byCategory)[number], amount: number): ReviewLine => ({ name: c.name, spent: c.spent, budget: c.budget, amount: round2(amount) });
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
    over: budgeted.filter((c) => c.spent > c.budget).map((c) => line(c, c.spent - c.budget)).sort((a, b) => b.amount - a.amount).slice(0, 3),
    /** up to 3 categories with the most left over */
    under: budgeted.filter((c) => c.spent < c.budget).map((c) => line(c, c.budget - c.spent)).sort((a, b) => b.amount - a.amount).slice(0, 3),
    /** spending in categories without a limit */
    unplanned: round2(s.byCategory.filter((c) => c.budget <= 0).reduce((a, c) => a + c.spent, 0)),
    largest: s.largest,
    /** net worth at the end of the previous month vs. the end of this one, when balances exist for both */
    netWorth: nwStart !== null && nwEnd !== null ? { start: nwStart, end: nwEnd, change: round2(nwEnd - nwStart) } : null,
    count: s.count,
  };
}

export type MonthReview = ReturnType<typeof monthReview>;

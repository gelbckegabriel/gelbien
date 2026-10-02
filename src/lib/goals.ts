/**
 * Goals, accounts and net worth — pure functions so they can be unit-tested.
 *
 * Money growth model: an amount `current` today, `monthly` added at the end of
 * every month, compounding monthly at the rate equivalent to `annualReturn` %.
 */
import { recentAverages, summarizeMonth } from "./finance";
import type { Account, BalanceSnapshot, Dataset, Goal } from "./types";
import { addMonths, currentMonth, daysInMonth, monthOf, monthRange, round2, todayISO } from "./utils";

/** Cap projections at 50 years — anything later is "not reachable" for planning purposes. */
export const MAX_MONTHS = 600;

export function monthlyRate(annualReturnPct: number): number {
  return Math.pow(1 + annualReturnPct / 100, 1 / 12) - 1;
}

/** Whole months until `current` (plus contributions and growth) reaches `target`; null if never. */
export function monthsToTarget(current: number, target: number, monthly: number, annualReturnPct: number): number | null {
  if (current >= target) return 0;
  const i = monthlyRate(annualReturnPct);
  let n: number;
  if (Math.abs(i) < 1e-12) {
    if (monthly <= 0) return null;
    n = (target - current) / monthly;
  } else {
    // FV(n) = C(1+i)^n + M((1+i)^n - 1)/i  ≥  T   →   (1+i)^n ≥ (T·i + M) / (C·i + M)
    const num = target * i + monthly;
    const den = current * i + monthly;
    if (den <= 0 || num / den <= 0) return null;
    n = Math.log(num / den) / Math.log(1 + i);
    if (!Number.isFinite(n) || n < 0) return null;
  }
  const months = Math.ceil(n - 1e-9);
  return months > MAX_MONTHS ? null : months;
}

/** Monthly amount needed to go from `current` to `target` in `months` months. */
export function requiredMonthly(current: number, target: number, months: number, annualReturnPct: number): number {
  if (current >= target) return 0;
  if (months <= 0) return target - current;
  const i = monthlyRate(annualReturnPct);
  if (Math.abs(i) < 1e-12) return (target - current) / months;
  const g = Math.pow(1 + i, months);
  return Math.max(0, ((target - current * g) * i) / (g - 1));
}

/** Balance at the end of each month, index 0 = today. */
export function projectBalance(current: number, monthly: number, annualReturnPct: number, months: number): number[] {
  const i = monthlyRate(annualReturnPct);
  const out = [round2(current)];
  let v = current;
  for (let m = 1; m <= months; m++) {
    v = v * (1 + i) + monthly;
    out.push(round2(v));
  }
  return out;
}

/** Whole months from `fromMonth` (YYYY-MM) to `toMonth`. */
export function monthsBetween(fromMonth: string, toMonth: string): number {
  const [fy, fm] = fromMonth.split("-").map(Number);
  const [ty, tm] = toMonth.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

// ---------------------------------------------------------------------------
// Accounts & balances
// ---------------------------------------------------------------------------

/** Credit accounts store what you owe; count it against net worth. */
export function signedBalance(account: Pick<Account, "type">, balance: number): number {
  return account.type === "credit" ? -Math.abs(balance) : balance;
}

/** Most recent snapshot per account on or before `asOf`. */
export function latestBalances(balances: BalanceSnapshot[], asOf = todayISO()): Map<string, BalanceSnapshot> {
  const out = new Map<string, BalanceSnapshot>();
  for (const b of balances) {
    if (b.date > asOf) continue;
    const cur = out.get(b.accountId);
    if (!cur || b.date >= cur.date) out.set(b.accountId, b);
  }
  return out;
}

export function netWorth(ds: Pick<Dataset, "accounts" | "balances">, asOf = todayISO()) {
  const latest = latestBalances(ds.balances, asOf);
  let assets = 0;
  let debts = 0;
  for (const a of ds.accounts) {
    const b = latest.get(a.id);
    if (!b) continue;
    const v = signedBalance(a, b.balance);
    if (v >= 0) assets += v;
    else debts += -v;
  }
  return { assets: round2(assets), debts: round2(debts), total: round2(assets - debts) };
}

/**
 * What the user has across their accounts today (credit card balances subtract) — the reserve the
 * runway and the reserve projection start from. null until a balance has been recorded.
 */
export function accountsReserve(ds: Pick<Dataset, "accounts" | "balances">, asOf = todayISO()): number | null {
  const latest = latestBalances(ds.balances, asOf);
  return ds.accounts.some((a) => latest.has(a.id)) ? netWorth(ds, asOf).total : null;
}

/** Month-end net worth for the last `count` months, carrying each account's last known balance forward. */
export function netWorthSeries(ds: Pick<Dataset, "accounts" | "balances">, endMonth = currentMonth(), count = 12) {
  if (!ds.balances.length) return [];
  const first = monthOf(ds.balances.reduce((m, b) => (b.date < m ? b.date : m), ds.balances[0].date));
  const months = monthRange(endMonth, count).filter((m) => m >= first);
  return months.map((m) => {
    const end = `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
    return { month: m, ...netWorth(ds, end) };
  });
}

/** Average monthly change of the given accounts, measured from their check-ins over the last `months` months. */
export function accountsMonthlyGrowth(ds: Pick<Dataset, "accounts" | "balances">, accountIds: string[], months = 6, today = todayISO()): number | null {
  if (!accountIds.length) return null;
  const since = `${addMonths(monthOf(today), -months)}-01`;
  let total = 0;
  let span = 0;
  for (const id of accountIds) {
    const account = ds.accounts.find((a) => a.id === id);
    if (!account) continue;
    const snaps = ds.balances.filter((b) => b.accountId === id && b.date >= since && b.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1));
    if (snaps.length < 2) continue;
    const first = snaps[0];
    const last = snaps[snaps.length - 1];
    const days = (Date.parse(last.date) - Date.parse(first.date)) / 86400000;
    if (days < 20) continue;
    total += signedBalance(account, last.balance) - signedBalance(account, first.balance);
    span = Math.max(span, days / 30.44);
  }
  return span > 0 ? round2(total / span) : null;
}

export interface CheckInStatus {
  /** Most recent check-in date across all accounts */
  last: string | null;
  /** This month's check-in date */
  dueDate: string;
  /** A check-in is due: we're past this month's check-in day and haven't checked in since */
  due: boolean;
  /** Active accounts whose latest balance is older than ~5 weeks */
  stale: Account[];
  nextDate: string;
}

export function checkInStatus(ds: Pick<Dataset, "accounts" | "balances" | "settings">, today = todayISO()): CheckInStatus {
  const day = Math.min(Math.max(ds.settings.checkInDay || 1, 1), 28);
  const month = monthOf(today);
  const dueDate = `${month}-${String(day).padStart(2, "0")}`;
  const active = ds.accounts.filter((a) => !a.archived);
  const latest = latestBalances(ds.balances, today);
  const dates = active.map((a) => latest.get(a.id)?.date).filter((d): d is string => !!d);
  const last = dates.length ? dates.reduce((m, d) => (d > m ? d : m)) : null;
  const staleCutoff = new Date(`${today}T12:00:00`);
  staleCutoff.setDate(staleCutoff.getDate() - 35);
  const cutoff = todayISO(staleCutoff);
  const stale = active.filter((a) => (latest.get(a.id)?.date ?? "") < cutoff);
  const due = active.length > 0 && today >= dueDate && (last === null || last < dueDate);
  const nextDate = today < dueDate ? dueDate : `${addMonths(month, 1)}-${String(day).padStart(2, "0")}`;
  return { last, dueDate, due, stale, nextDate };
}

// ---------------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------------

/** What a goal has today: its linked accounts' balances, or the amount tracked by hand. */
export function goalCurrent(ds: Pick<Dataset, "accounts" | "balances">, goal: Goal, asOf = todayISO()): number {
  if (!goal.accountIds.length) return goal.saved;
  const latest = latestBalances(ds.balances, asOf);
  let total = 0;
  for (const id of goal.accountIds) {
    const account = ds.accounts.find((a) => a.id === id);
    const b = latest.get(id);
    if (account && b && account.type !== "credit") total += b.balance;
  }
  return round2(total);
}

export interface PlanInput {
  current: number;
  target: number;
  monthly: number;
  annualReturn: number;
  /** YYYY-MM-DD or "" */
  targetDate: string;
}

export interface GoalPlan extends PlanInput {
  remaining: number;
  progress: number;
  /** Months until reached from now; null = never at this pace */
  months: number | null;
  /** YYYY-MM the goal is reached; null = never */
  eta: string | null;
  /** Months left until the deadline (null = no deadline) */
  monthsToDeadline: number | null;
  /** Monthly amount needed to make the deadline (null = no deadline) */
  requiredMonthly: number | null;
  /** null when there is no deadline */
  onTrack: boolean | null;
  achieved: boolean;
}

export function planGoal(input: PlanInput, today = todayISO()): GoalPlan {
  const { current, target, monthly, annualReturn, targetDate } = input;
  const achieved = current >= target && target > 0;
  const months = monthsToTarget(current, target, monthly, annualReturn);
  const nowMonth = monthOf(today);
  const eta = months === null ? null : addMonths(nowMonth, months);
  const monthsToDeadline = targetDate ? Math.max(0, monthsBetween(nowMonth, monthOf(targetDate))) : null;
  const required = monthsToDeadline === null ? null : round2(requiredMonthly(current, target, monthsToDeadline, annualReturn));
  const onTrack = targetDate ? achieved || (eta !== null && eta <= monthOf(targetDate)) : null;
  return {
    ...input,
    remaining: round2(Math.max(0, target - current)),
    progress: target > 0 ? Math.min(1, Math.max(0, current / target)) : 0,
    months,
    eta,
    monthsToDeadline,
    requiredMonthly: required,
    onTrack,
    achieved,
  };
}

export function goalPlanFor(ds: Pick<Dataset, "accounts" | "balances">, goal: Goal, today = todayISO()): GoalPlan {
  return planGoal(
    { current: goalCurrent(ds, goal, today), target: goal.target, monthly: goal.monthlyContribution, annualReturn: goal.annualReturn, targetDate: goal.targetDate },
    today,
  );
}

/** Average monthly spending marked "superfluous" over the previous `n` complete months. */
export function avgSuperfluous(ds: Pick<Dataset, "transactions">, today = todayISO(), n = 3): number {
  const months = monthRange(addMonths(monthOf(today), -1), n);
  let total = 0;
  for (const t of ds.transactions) if (t.priority === "superfluous" && months.includes(monthOf(t.date))) total += t.amount;
  return round2(Math.max(0, total / n));
}

/**
 * Goal contributions against what's there to save each month. The yardstick is the budget's
 * planned savings (income − planned spending), the number the user set out to save; without a
 * budget, what was actually saved lately. The actual average comes along either way, as a check.
 */
export function savingsPlan(ds: Dataset, month = currentMonth(), today = todayISO()) {
  const active = ds.goals.filter((g) => g.status === "active" && !goalPlanFor(ds, g, today).achieved);
  const allocated = round2(active.reduce((a, g) => a + g.monthlyContribution, 0));
  const s = summarizeMonth(ds, month);
  const planned = s.budgetTotal > 0 && s.income.net > 0 ? { saved: round2(s.income.net - s.budgetTotal), income: s.income.net, spending: s.budgetTotal } : null;
  const r = recentAverages(ds, month);
  // full months only: with none, recentAverages falls back on the plan, which isn't "actual"
  const actual = r.months > 0 && r.income > 0 ? r : null;
  const basis = planned?.saved ?? actual?.saved ?? null;
  return { active, allocated, planned, actual, basis, free: basis === null ? null : round2(basis - allocated) };
}

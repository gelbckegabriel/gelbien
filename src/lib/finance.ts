/**
 * Pure analytics over a Dataset. Everything the dashboard, budget page and AI
 * context need is computed here so it can be unit-tested without React.
 */
import { chargesBetween, committedBills } from "./bills";
import { OTHER_COLOR, REST_COLOR } from "./defaults";
import type {
  BudgetLine,
  Category,
  Cycle,
  Dataset,
  IncomeLine,
  Priority,
  Subscription,
  Transaction,
} from "./types";
import { addMonths, currentMonth, daysInMonth, monthOf, monthRange, normalize, round2, sum, todayISO } from "./utils";

export type BudgetStatus = "within" | "attention" | "over" | "none";

export function budgetStatus(spent: number, budget: number, warnAt = 0.85): BudgetStatus {
  if (budget <= 0) return "none";
  if (spent > budget) return "over";
  if (spent >= budget * warnAt) return "attention";
  return "within";
}

export function txInMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((t) => monthOf(t.date) === month);
}

/** Month-specific budget lines win; otherwise the "default" lines apply. */
export function effectiveBudget(budgets: BudgetLine[], month: string): { lines: Record<string, number>; isOverride: boolean } {
  const override = budgets.filter((b) => b.month === month);
  const source = override.length ? override : budgets.filter((b) => b.month === "default");
  const lines: Record<string, number> = {};
  for (const b of source) lines[b.category] = (lines[b.category] ?? 0) + b.amount;
  return { lines, isOverride: override.length > 0 };
}

export function effectiveIncome(incomes: IncomeLine[], month: string): IncomeLine {
  return (
    incomes.find((i) => i.month === month) ??
    incomes.find((i) => i.month === "default") ?? { month: "default", gross: 0, net: 0, note: "" }
  );
}

const CYCLE_FACTOR: Record<Cycle, number> = {
  weekly: 52 / 12,
  monthly: 1,
  bimonthly: 1 / 2,
  quarterly: 1 / 3,
  semiannual: 1 / 6,
  annual: 1 / 12,
};

export function monthlyCost(sub: Pick<Subscription, "amount" | "cycle">): number {
  return sub.amount * (CYCLE_FACTOR[sub.cycle] ?? 1);
}

export function subscriptionTotals(subs: Subscription[]) {
  const active = subs.filter((s) => s.status === "active");
  const trial = subs.filter((s) => s.status === "trial");
  const activeMonthly = sum(active, monthlyCost);
  const trialMonthly = sum(trial, monthlyCost);
  const subscriptions = active.filter((s) => s.kind === "subscription");
  return {
    activeCount: active.length,
    activeMonthly: round2(activeMonthly),
    activeYearly: round2(activeMonthly * 12),
    /** of the active ones: bills (rent, utilities…) vs subscriptions */
    billsMonthly: round2(sum(active.filter((s) => s.kind === "bill"), monthlyCost)),
    subscriptionCount: subscriptions.length,
    subscriptionsMonthly: round2(sum(subscriptions, monthlyCost)),
    trialCount: trial.length,
    trialMonthly: round2(trialMonthly),
    trialYearly: round2(trialMonthly * 12),
  };
}

export interface CategorySpend {
  name: string;
  color: string;
  icon: string;
  spent: number;
  budget: number;
  remaining: number;
  /** spent / budget (0 when no budget) */
  used: number;
  /** spent / month total */
  share: number;
  status: BudgetStatus;
  count: number;
}

export interface MonthSummary {
  month: string;
  days: number;
  /** Days of the month that have happened (full month for past months). */
  elapsed: number;
  daysLeft: number;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  total: number;
  count: number;
  dailyAvg: number;
  fixed: number;
  variable: number;
  byCategory: CategorySpend[];
  byPriority: Record<Priority, number>;
  byPayment: { name: string; amount: number }[];
  top: Transaction[];
  largest: Transaction | null;
  daily: number[];
  budgetTotal: number;
  budgetIsOverride: boolean;
  remaining: number;
  income: IncomeLine;
  saved: number;
  savingsRate: number;
  superfluousShare: number;
  perDayLeft: number;
}

export function categoryLookup(categories: Category[]) {
  const map = new Map(categories.map((c) => [c.name, c]));
  return (name: string) => map.get(name);
}

export function summarizeMonth(ds: Dataset, month: string, today = todayISO()): MonthSummary {
  const days = daysInMonth(month);
  const thisMonth = monthOf(today);
  const isCurrent = month === thisMonth;
  const isPast = month < thisMonth;
  const isFuture = month > thisMonth;
  const elapsed = isPast ? days : isCurrent ? Number(today.slice(8, 10)) : 0;
  const daysLeft = isCurrent ? days - elapsed + 1 : isFuture ? days : 0;

  const txs = txInMonth(ds.transactions, month);
  const total = round2(sum(txs, (t) => t.amount));
  const lookup = categoryLookup(ds.categories);
  const { lines: budgetLines, isOverride } = effectiveBudget(ds.budgets, month);
  const warnAt = ds.settings.warnAt || 0.85;

  const spentByCat = new Map<string, { spent: number; count: number }>();
  for (const t of txs) {
    const cur = spentByCat.get(t.category) ?? { spent: 0, count: 0 };
    cur.spent += t.amount;
    cur.count += 1;
    spentByCat.set(t.category, cur);
  }

  const names = new Set<string>([...spentByCat.keys(), ...Object.keys(budgetLines).filter((k) => budgetLines[k] > 0)]);
  const byCategory: CategorySpend[] = [...names].map((name) => {
    const cat = lookup(name);
    const spent = round2(spentByCat.get(name)?.spent ?? 0);
    const budget = round2(budgetLines[name] ?? 0);
    return {
      name,
      color: cat?.color ?? OTHER_COLOR,
      icon: cat?.icon ?? "Package",
      spent,
      budget,
      remaining: round2(budget - spent),
      used: budget > 0 ? spent / budget : 0,
      share: total > 0 ? spent / total : 0,
      status: budgetStatus(spent, budget, warnAt),
      count: spentByCat.get(name)?.count ?? 0,
    };
  });
  byCategory.sort((a, b) => b.spent - a.spent || b.budget - a.budget || a.name.localeCompare(b.name));

  const byPriority: Record<Priority, number> = { essential: 0, important: 0, superfluous: 0 };
  const payments = new Map<string, number>();
  let fixed = 0;
  let variable = 0;
  const daily = Array.from({ length: days }, () => 0);
  for (const t of txs) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + t.amount;
    payments.set(t.payment || "—", (payments.get(t.payment || "—") ?? 0) + t.amount);
    if (t.type === "fixed") fixed += t.amount;
    else variable += t.amount;
    const d = Number(t.date.slice(8, 10));
    if (d >= 1 && d <= days) daily[d - 1] += t.amount;
  }

  const sorted = [...txs].sort((a, b) => b.amount - a.amount);
  const budgetTotal = round2(Object.values(budgetLines).reduce((a, b) => a + b, 0));
  const income = effectiveIncome(ds.incomes, month);
  const saved = round2(income.net - total);

  return {
    month,
    days,
    elapsed,
    daysLeft,
    isCurrent,
    isPast,
    isFuture,
    total,
    count: txs.length,
    dailyAvg: elapsed > 0 ? total / elapsed : 0,
    fixed: round2(fixed),
    variable: round2(variable),
    byCategory,
    byPriority: {
      essential: round2(byPriority.essential),
      important: round2(byPriority.important),
      superfluous: round2(byPriority.superfluous),
    },
    byPayment: [...payments.entries()]
      .map(([name, amount]) => ({ name, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    top: sorted.slice(0, 10),
    largest: sorted[0] ?? null,
    daily: daily.map(round2),
    budgetTotal,
    budgetIsOverride: isOverride,
    remaining: round2(budgetTotal - total),
    income,
    saved,
    savingsRate: income.net > 0 ? saved / income.net : 0,
    superfluousShare: total > 0 ? byPriority.superfluous / total : 0,
    perDayLeft: daysLeft > 0 ? (budgetTotal - total) / daysLeft : 0,
  };
}

/**
 * Spending on plan, day by day (cumulative; index 0 = day 1): recurring bills and other fixed costs
 * on the day they land, and the rest of each category's limit spread evenly over the month — so rent
 * on the 1st is a step at the start, not "overspending" for three weeks. A bill already logged counts
 * where and as much as it went out (not at all if that was in another month), one still to come on
 * its due day. A fixed cost bigger than its limit (or in a category without one) still counts in
 * full. Empty without a budget.
 */
export function expectedPace(ds: Pick<Dataset, "subscriptions" | "transactions">, month: string, budget: Record<string, number>, today = todayISO()): number[] {
  const days = daysInMonth(month);
  if (Object.values(budget).reduce((a, b) => a + Math.max(0, b), 0) <= 0) return [];
  const last = `${month}-${String(days).padStart(2, "0")}`;
  const steps = new Array<number>(days).fill(0);
  const fixedBy = new Map<string, number>();
  const counted = new Set<string>();
  const add = (date: string, amount: number, category: string) => {
    steps[Number(date.slice(8, 10)) - 1] += amount;
    fixedBy.set(category, (fixedBy.get(category) ?? 0) + amount);
  };
  for (const c of chargesBetween(ds, `${month}-01`, last)) {
    if (c.paid) {
      if (monthOf(c.paid.date) === month && !counted.has(c.paid.id)) {
        counted.add(c.paid.id);
        add(c.paid.date, c.paid.amount, c.paid.category);
      }
    } else if (last >= today) {
      // still to come, or due and not logged yet — once the month is over, a charge nobody logged didn't happen
      add(c.date, c.sub.amount, c.sub.category);
    }
  }
  // fixed costs and bill payments not matched above (rent typed in as a fixed expense, next month's bill paid early)
  for (const t of txInMonth(ds.transactions, month)) {
    if ((t.type === "fixed" || t.billId) && !counted.has(t.id)) {
      counted.add(t.id);
      add(t.date, t.amount, t.category);
    }
  }
  const even = Object.entries(budget).reduce((a, [category, limit]) => a + Math.max(0, limit - Math.max(0, fixedBy.get(category) ?? 0)), 0) / days;
  let run = 0;
  return steps.map((step) => round2((run += step + even)));
}

/** Cumulative spend by day vs. the planned pace (see expectedPace), plus last month for context. */
export function paceSeries(ds: Dataset, month: string, today = todayISO()) {
  const s = summarizeMonth(ds, month, today);
  const prev = summarizeMonth(ds, addMonths(month, -1), today);
  const pace = expectedPace(ds, month, effectiveBudget(ds.budgets, month).lines, today);
  let run = 0;
  let prevRun = 0;
  return Array.from({ length: s.days }, (_, i) => {
    run += s.daily[i];
    prevRun += prev.daily[i] ?? 0;
    const day = i + 1;
    return {
      day,
      actual: day <= s.elapsed ? round2(run) : null,
      pace: pace[i] ?? null,
      last: i < prev.days ? round2(prevRun) : null,
    };
  });
}

export interface TrendPoint {
  month: string;
  spent: number;
  income: number;
  saved: number;
}

export function trend(ds: Dataset, endMonth: string, count = 12): TrendPoint[] {
  const totals = new Map<string, number>();
  for (const t of ds.transactions) {
    const m = monthOf(t.date);
    totals.set(m, (totals.get(m) ?? 0) + t.amount);
  }
  return monthRange(endMonth, count).map((month) => {
    const spent = round2(totals.get(month) ?? 0);
    const income = effectiveIncome(ds.incomes, month).net;
    return { month, spent, income, saved: round2(income - spent) };
  });
}

/** Category × month matrix for a calendar year (the old "Resumo Anual" tab). */
export function yearMatrix(ds: Dataset, year: number) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const cells = new Map<string, number[]>();
  for (const t of ds.transactions) {
    if (!t.date.startsWith(`${year}-`)) continue;
    const row = cells.get(t.category) ?? Array.from({ length: 12 }, () => 0);
    row[Number(t.date.slice(5, 7)) - 1] += t.amount;
    cells.set(t.category, row);
  }
  const order = new Map(ds.categories.map((c) => [c.name, c.order]));
  const rows = [...cells.entries()]
    .map(([name, values]) => ({ name, values: values.map(round2), total: round2(values.reduce((a, b) => a + b, 0)) }))
    .sort((a, b) => (order.get(a.name) ?? 999) - (order.get(b.name) ?? 999));
  const monthTotals = months.map((_, i) => round2(sum(rows, (r) => r.values[i])));
  const activeMonths = monthTotals.filter((v) => v > 0).length;
  const yearTotal = round2(monthTotals.reduce((a, b) => a + b, 0));
  return {
    months,
    rows,
    monthTotals,
    yearTotal,
    activeMonths,
    /** Same rule as the spreadsheet: divide by months that actually have spending. */
    monthlyAverage: activeMonths ? round2(yearTotal / activeMonths) : 0,
    max: Math.max(0, ...rows.flatMap((r) => r.values)),
  };
}

/** Average monthly spend and saving over the last `n` complete months that have data. */
export function recentAverages(ds: Dataset, month: string, n = 3) {
  const points = trend(ds, addMonths(month, -1), 12).filter((p) => p.spent > 0).slice(-n);
  if (!points.length) {
    // no full month recorded yet: this month's plan stands in
    const s = summarizeMonth(ds, month);
    const spent = s.budgetTotal || s.total;
    return { spent, saved: s.income.net - spent, income: s.income.net, months: 0, from: month, to: month, missingIncome: s.income.net <= 0 };
  }
  return {
    spent: round2(sum(points, (p) => p.spent) / points.length),
    saved: round2(sum(points, (p) => p.saved) / points.length),
    income: round2(sum(points, (p) => p.income) / points.length),
    months: points.length,
    /** the months averaged */
    from: points[0].month,
    to: points[points.length - 1].month,
    /** some of them have no income set, so the average saving is understated */
    missingIncome: points.some((p) => p.income <= 0),
  };
}

export function runway(reserve: number, avgSpend: number, netIncome: number) {
  const burn = avgSpend - netIncome;
  if (burn <= 0) return { sustainable: true as const, months: Infinity, burn: 0 };
  return { sustainable: false as const, months: reserve / burn, burn };
}

export function projection(ds: Dataset, month: string, start: number, horizon = 12) {
  const avg = recentAverages(ds, month);
  return Array.from({ length: horizon + 1 }, (_, i) => ({
    month: addMonths(month, i),
    value: round2(start + avg.saved * i),
  }));
}

// ---------------------------------------------------------------------------
// Month-end forecast
// ---------------------------------------------------------------------------

/** Day-to-day spending: not a bill payment, not a fixed cost */
const dayToDay = (t: Transaction) => !t.billId && t.type !== "fixed";

/** Day-to-day spending of each day of `month`, up to day `upTo` */
function dayToDayDays(ds: Pick<Dataset, "transactions">, month: string, upTo = daysInMonth(month)): number[] {
  const days = new Array<number>(upTo).fill(0);
  for (const t of txInMonth(ds.transactions, month)) {
    const d = Number(t.date.slice(8, 10));
    if (d <= upTo && dayToDay(t)) days[d - 1] += t.amount;
  }
  return days;
}

export interface MonthForecast {
  /** spent by the end of the month, most likely, and the usual range around it */
  end: number;
  low: number;
  high: number;
  spent: number;
  /** bills still to pay this month (or due and not logged) */
  billsDue: number;
  /** the usual day of day-to-day spending */
  usualDaily: number;
  daysLeft: number;
  /** cumulative spending from today (day `from`) to the last day; index 0 = today */
  path: { day: number; value: number; low: number; high: number }[];
}

/**
 * Where the current month is heading: what's spent so far, the bills still due on their days (one due and
 * not logged yet counts tomorrow), and a usual day of day-to-day spending (no bills or fixed costs) for every
 * day left. The usual day is the average over the last three months with any spending — this month's own
 * days when there's no history yet. The range is one standard deviation of a day, over the days left (it
 * grows with their square root). Null for any month but the current one, or with nothing to go on.
 */
export function monthForecast(ds: Dataset, month: string, today = todayISO(), skipped: ReadonlySet<string> = new Set()): MonthForecast | null {
  const s = summarizeMonth(ds, month, today);
  if (!s.isCurrent) return null;
  const history = monthRange(addMonths(month, -1), 12)
    .filter((m) => txInMonth(ds.transactions, m).length > 0)
    .slice(-3);
  // this month alone says little until a few days have gone by
  const sample = history.length ? history.flatMap((m) => dayToDayDays(ds, m)) : s.elapsed >= 5 ? dayToDayDays(ds, month, s.elapsed) : [];
  if (!sample.length) return null;
  const usual = sample.reduce((a, b) => a + b, 0) / sample.length;
  const sd = Math.sqrt(sample.reduce((a, b) => a + (b - usual) ** 2, 0) / sample.length);

  const bills = new Array<number>(s.days).fill(0);
  for (const c of committedBills(ds, month, today, skipped)) {
    const day = Math.min(s.days, Math.max(Number(c.date.slice(8, 10)), s.elapsed + 1));
    bills[day - 1] += c.sub.amount;
  }
  const path: MonthForecast["path"] = [];
  let run = s.total;
  let fixed = s.total;
  for (let day = s.elapsed; day <= s.days; day++) {
    if (day > s.elapsed) {
      run += bills[day - 1] + usual;
      fixed += bills[day - 1];
    }
    const spread = sd * Math.sqrt(day - s.elapsed);
    // never below what's certain: spent, plus the bills
    path.push({ day, value: round2(run), low: round2(Math.max(fixed, run - spread)), high: round2(run + spread) });
  }
  const last = path[path.length - 1];
  return {
    end: last.value,
    low: last.low,
    high: last.high,
    spent: s.total,
    billsDue: round2(bills.reduce((a, b) => a + b, 0)),
    usualDaily: round2(usual),
    daysLeft: s.days - s.elapsed,
    path,
  };
}

// ---------------------------------------------------------------------------
// Spending by priority, merchants
// ---------------------------------------------------------------------------

export interface PriorityMonth extends Record<Priority, number> {
  month: string;
  total: number;
  /** the current month, still going */
  partial: boolean;
}

/** Spending by priority for the `count` months up to `endMonth`, from the first with any spending. */
export function priorityTrend(ds: Pick<Dataset, "transactions">, endMonth: string, count = 6, today = todayISO()): PriorityMonth[] {
  const out = monthRange(endMonth, count).map((month) => {
    const by: Record<Priority, number> = { essential: 0, important: 0, superfluous: 0 };
    for (const t of txInMonth(ds.transactions, month)) by[t.priority] += t.amount;
    const total = round2(by.essential + by.important + by.superfluous);
    return { month, essential: round2(by.essential), important: round2(by.important), superfluous: round2(by.superfluous), total, partial: month === monthOf(today) };
  });
  const first = out.findIndex((p) => p.total !== 0);
  return first === -1 ? [] : out.slice(first);
}

export interface MerchantSpend {
  name: string;
  /** where most of its spending went */
  category: string;
  amount: number;
  visits: number;
  /** first time this merchant shows up (only said when there's earlier history) */
  isNew: boolean;
}

/**
 * Where the month's day-to-day money went, by merchant: bills and fixed costs left out (rent would top
 * every month), refunds netted. Biggest first.
 */
export function topMerchants(ds: Pick<Dataset, "transactions">, month: string): MerchantSpend[] {
  const start = `${month}-01`;
  const before = ds.transactions.filter((t) => t.date < start);
  const seen = new Set(before.map((t) => normalize(t.merchant)).filter(Boolean));
  const groups = new Map<string, { name: string; amount: number; visits: number; cats: Map<string, number> }>();
  for (const t of txInMonth(ds.transactions, month)) {
    const key = normalize(t.merchant);
    if (!key || !dayToDay(t) || t.recurring) continue;
    const g = groups.get(key) ?? { name: t.merchant.trim(), amount: 0, visits: 0, cats: new Map<string, number>() };
    g.amount += t.amount;
    if (t.amount > 0) g.visits += 1;
    g.cats.set(t.category, (g.cats.get(t.category) ?? 0) + t.amount);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({
      name: g.name,
      category: [...g.cats.entries()].sort((a, b) => b[1] - a[1])[0][0],
      amount: round2(g.amount),
      visits: g.visits,
      isNew: before.length > 0 && !seen.has(key),
    }))
    .filter((m) => m.amount > 0)
    .sort((a, b) => b.amount - a.amount || b.visits - a.visits);
}

/** Suggest a budget per category from the average of the previous `n` months. */
export function suggestBudget(ds: Dataset, month: string, n = 3): Record<string, number> {
  const months = monthRange(addMonths(month, -1), n);
  const totals = new Map<string, number>();
  for (const t of ds.transactions) {
    if (!months.includes(monthOf(t.date))) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  const out: Record<string, number> = {};
  for (const [name, total] of totals) {
    const avg = total / n;
    if (avg > 0) out[name] = Math.ceil(avg / 10) * 10;
  }
  return out;
}

/** Prefill category/priority/etc. from the most recent expense at the same merchant. */
export function suggestFromHistory(transactions: Transaction[], merchant: string) {
  const key = normalize(merchant);
  if (key.length < 2) return null;
  let best: Transaction | null = null;
  for (const t of transactions) {
    if (normalize(t.merchant) !== key) continue;
    if (!best || t.date > best.date) best = t;
  }
  if (!best) return null;
  return {
    merchant: best.merchant,
    category: best.category,
    subcategory: best.subcategory,
    priority: best.priority,
    type: best.type,
    payment: best.payment,
  };
}

export function knownMerchants(transactions: Transaction[]): string[] {
  const counts = new Map<string, { name: string; n: number }>();
  for (const t of transactions) {
    if (!t.merchant) continue;
    const k = normalize(t.merchant);
    const cur = counts.get(k) ?? { name: t.merchant, n: 0 };
    cur.n += 1;
    counts.set(k, cur);
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((c) => c.name);
}

/** Money flow for the Sankey: income (and savings drawn down) → categories (+ saved). */
export function moneyFlow(summary: MonthSummary, maxCategories = 7) {
  const income = summary.income.net;
  const spend = summary.byCategory.filter((c) => c.spent > 0);
  if (income <= 0 || summary.total <= 0) return null;
  const head = spend.slice(0, maxCategories);
  const tail = spend.slice(maxCategories);
  const cats = [...head.map((c) => ({ name: c.name, color: c.color, value: c.spent }))];
  if (tail.length) cats.push({ name: "__other__", color: REST_COLOR, value: round2(sum(tail, (c) => c.spent)) });
  const deficit = Math.max(0, summary.total - income);
  const saved = Math.max(0, income - summary.total);
  return { income, deficit, saved, categories: cats, total: summary.total };
}

/** Fold a category list to the top `n` plus an "Other" bucket so charts never exceed the palette. */
export function foldCategories<T extends { name: string; color: string; spent: number }>(items: T[], n = 6) {
  const positive = items.filter((i) => i.spent > 0);
  if (positive.length <= n + 1) return positive.map((i) => ({ name: i.name, color: i.color, value: i.spent }));
  const head = positive.slice(0, n).map((i) => ({ name: i.name, color: i.color, value: i.spent }));
  const rest = round2(sum(positive.slice(n), (i) => i.spent));
  return [...head, { name: "__other__", color: REST_COLOR, value: rest }];
}

export interface LocalInsight {
  id: string;
  tone: "good" | "warn" | "bad" | "info";
  key: string;
  vars: Record<string, string | number>;
  weight: number;
}

/**
 * Rule-based insights: free, instant and always available. Values are left raw
 * (numbers) or pre-tagged so the UI can format them in the active locale.
 */
export function localInsights(ds: Dataset, month: string, today = todayISO()): LocalInsight[] {
  const s = summarizeMonth(ds, month, today);
  const out: LocalInsight[] = [];
  if (s.count === 0 && s.budgetTotal === 0) return out;

  const fixedByCat = new Map<string, number>();
  for (const t of txInMonth(ds.transactions, month)) if (t.type === "fixed") fixedByCat.set(t.category, (fixedByCat.get(t.category) ?? 0) + t.amount);

  for (const c of s.byCategory) {
    // Rent & co. always land near their budget — only flag fixed-cost categories when actually over.
    const mostlyFixed = c.spent > 0 && (fixedByCat.get(c.name) ?? 0) / c.spent >= 0.8;
    if (c.status === "over") {
      out.push({ id: `over-${c.name}`, tone: "bad", key: "over", weight: 90 + c.used, vars: { category: c.name, spent: c.spent, budget: c.budget, pct: c.used } });
    } else if (c.status === "attention" && s.daysLeft > 3 && !mostlyFixed) {
      out.push({ id: `att-${c.name}`, tone: "warn", key: "attention", weight: 70 + c.used, vars: { category: c.name, pct: c.used, days: s.daysLeft } });
    }
  }

  if (s.isCurrent && s.budgetTotal > 0 && s.elapsed >= 5) {
    // against the planned pace, so a big bill early in the month isn't "spending ahead"
    const expected = expectedPace(ds, month, effectiveBudget(ds.budgets, month).lines, today)[s.elapsed - 1] ?? 0;
    const spentPct = s.total / s.budgetTotal;
    const expectedPct = expected / s.budgetTotal;
    if (spentPct > expectedPct + 0.1) {
      out.push({ id: "pace-ahead", tone: "warn", key: "paceAhead", weight: 80, vars: { spentPct, expectedPct } });
    } else if (spentPct < expectedPct - 0.15) {
      out.push({ id: "pace-behind", tone: "good", key: "paceBehind", weight: 40, vars: { spentPct, expectedPct } });
    }
  }

  // Spikes / drops vs. the previous three months' average (only for meaningful amounts)
  const prevMonths = monthRange(addMonths(month, -1), 3);
  const prevTotals = new Map<string, number>();
  const monthsWithData = new Set<string>();
  for (const t of ds.transactions) {
    const m = monthOf(t.date);
    if (!prevMonths.includes(m)) continue;
    monthsWithData.add(m);
    prevTotals.set(t.category, (prevTotals.get(t.category) ?? 0) + t.amount);
  }
  if (monthsWithData.size >= 2) {
    const scale = s.isCurrent && s.elapsed > 0 ? s.days / s.elapsed : 1;
    for (const c of s.byCategory) {
      const avg = (prevTotals.get(c.name) ?? 0) / monthsWithData.size;
      if (avg < 40) continue;
      const projected = c.spent * scale;
      const change = (projected - avg) / avg;
      if (change > 0.4 && c.spent > avg * 0.6) {
        out.push({ id: `spike-${c.name}`, tone: "warn", key: "spike", weight: 60 + Math.min(change, 3) * 5, vars: { category: c.name, pct: change, spent: c.spent, avg } });
      } else if (change < -0.35 && s.elapsed >= s.days * 0.6) {
        out.push({ id: `drop-${c.name}`, tone: "good", key: "drop", weight: 35, vars: { category: c.name, pct: -change, spent: c.spent, avg } });
      }
    }
  }

  if (s.total > 0 && s.superfluousShare >= 0.15) {
    out.push({ id: "superfluous", tone: s.superfluousShare >= 0.25 ? "warn" : "info", key: "superfluous", weight: 50 + s.superfluousShare * 20, vars: { pct: s.superfluousShare, amount: s.byPriority.superfluous } });
  }

  if (s.income.net > 0 && s.count > 0) {
    if (s.saved < 0) {
      out.push({ id: "deficit", tone: "bad", key: "deficit", weight: 85, vars: { amount: -s.saved } });
    } else if (ds.settings.savingsGoal > 0 && s.saved >= ds.settings.savingsGoal && (s.isPast || s.elapsed > s.days * 0.8)) {
      out.push({ id: "goal", tone: "good", key: "goalMet", weight: 55, vars: { amount: s.saved, goal: ds.settings.savingsGoal } });
    } else if (s.isCurrent || s.isPast) {
      out.push({ id: "saving", tone: "good", key: "saving", weight: 30, vars: { amount: s.saved, rate: s.savingsRate } });
    }
  }

  for (const sub of ds.subscriptions) {
    if (sub.status !== "trial" || !sub.trialEnd) continue;
    const daysTo = (Date.parse(sub.trialEnd) - Date.parse(today)) / 86400000;
    if (daysTo >= 0 && daysTo <= 14) {
      out.push({ id: `trial-${sub.id}`, tone: "warn", key: "trial", weight: 75, vars: { name: sub.name, date: sub.trialEnd } });
    }
  }

  // subscriptions only: rent and other bills aren't what this nudge is about
  const subs = subscriptionTotals(ds.subscriptions);
  if (subs.subscriptionCount >= 2) {
    out.push({ id: "subs", tone: "info", key: "subs", weight: 20, vars: { amount: round2(subs.subscriptionsMonthly * 12), count: subs.subscriptionCount, monthly: subs.subscriptionsMonthly } });
  }

  if (s.largest && s.total > 0 && s.largest.amount / s.total >= 0.2 && s.count > 3) {
    out.push({ id: "big", tone: "info", key: "big", weight: 25, vars: { description: s.largest.description || s.largest.merchant || s.largest.subcategory, amount: s.largest.amount, pct: s.largest.amount / s.total } });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 6);
}

export { currentMonth };

/**
 * Layout of the Google Sheet that acts as Gelbien's database, and the
 * row <-> object mapping. Pure (no network) so it is shared by the server
 * and unit tests.
 *
 * The sheet is meant to stay human-readable: category names (not ids) are
 * stored on transactions, dates are ISO text, enums are short English codes.
 */
import { defaultSettings, guessKind } from "./defaults";
import type {
  Account,
  AccountType,
  BalanceSnapshot,
  BudgetLine,
  Category,
  Cycle,
  Dataset,
  ExpenseType,
  Goal,
  GoalStatus,
  IncomeLine,
  Locale,
  Plan,
  Prepayment,
  RateChange,
  Priority,
  Settings,
  SubKind,
  SubStatus,
  Subscription,
  Transaction,
  WorthIt,
} from "./types";
import { ACCOUNT_TYPES, AMORTIZATIONS, CYCLES, EXPENSE_TYPES, GOAL_STATUSES, PLAN_KINDS, PLAN_STATUSES, PREPAY_MODES, PRIORITIES, RATE_KEEPS, SUB_KINDS, SUB_STATUSES, WORTH_IT } from "./types";
import { newestFirst, parseAmount, serialToISO } from "./utils";

export const TABS = {
  transactions: {
    title: "Transactions",
    // New columns only ever go at the end: ensureTabs adds their headers to older sheets.
    headers: ["id", "date", "category", "subcategory", "description", "amount", "payment", "type", "priority", "merchant", "recurring", "notes", "receipt", "createdAt", "updatedAt", "group", "bill"],
  },
  categories: { title: "Categories", headers: ["name", "color", "icon", "order", "archived"] },
  subcategories: { title: "Subcategories", headers: ["category", "name"] },
  budgets: { title: "Budgets", headers: ["month", "category", "amount"] },
  income: { title: "Income", headers: ["month", "gross", "net", "note"] },
  subscriptions: {
    title: "Subscriptions",
    headers: ["id", "name", "category", "amount", "cycle", "billingDay", "payment", "status", "trialEnd", "worthIt", "notes", "nextCharge", "kind", "subcategory", "merchant"],
  },
  settings: { title: "Settings", headers: ["key", "value"] },
  accounts: { title: "Accounts", headers: ["id", "name", "institution", "type", "color", "archived", "notes", "depreciation"] },
  balances: { title: "Balances", headers: ["accountId", "date", "balance"] },
  goals: {
    title: "Goals",
    headers: ["id", "name", "icon", "color", "target", "targetDate", "accountIds", "saved", "monthlyContribution", "annualReturn", "status", "order", "notes", "createdAt", "startMonth", "afterGoal", "pausedMonths"],
  },
  plans: {
    title: "Plans",
    // payment stays in column G, as on Transactions and Subscriptions (renaming a payment method rewrites that column)
    headers: ["id", "kind", "name", "category", "subcategory", "merchant", "payment", "price", "downPayment", "rate", "payments", "amortization", "firstDate", "extras", "prepayments", "account", "(unused)", "countAsDebt", "status", "notes", "createdAt", "rateChanges"],
  },
} as const;

export type TabKey = keyof typeof TABS;
export const TAB_KEYS = Object.keys(TABS) as TabKey[];

export type Cell = string | number | boolean | null | undefined;
export type Row = Cell[];

/** A1 column letter for a 1-based index (1 → A, 27 → AA). */
export function colLetter(n: number): string {
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function dataRange(tab: TabKey, fromRow = 2): string {
  const t = TABS[tab];
  return `${t.title}!A${fromRow}:${colLetter(t.headers.length)}`;
}

const str = (v: Cell) => (v === null || v === undefined ? "" : String(v).trim());
const bool = (v: Cell) => v === true || /^(true|yes|sim|oui|1|x)$/i.test(str(v));
const num = (v: Cell) => parseAmount(v as never);
function oneOf<T extends string>(v: Cell, allowed: readonly T[], fallback: T): T {
  const s = str(v).toLowerCase() as T;
  return allowed.includes(s) ? s : fallback;
}
function date(v: Cell): string {
  if (typeof v === "number") return serialToISO(v);
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

// ---------- rows → objects ----------

export function rowToTransaction(r: Row): Transaction | null {
  const id = str(r[0]);
  const d = date(r[1]);
  if (!id || !d) return null;
  return {
    id,
    date: d,
    category: str(r[2]),
    subcategory: str(r[3]),
    description: str(r[4]),
    amount: num(r[5]),
    payment: str(r[6]),
    type: oneOf<ExpenseType>(r[7], EXPENSE_TYPES, "variable"),
    priority: oneOf<Priority>(r[8], PRIORITIES, "important"),
    merchant: str(r[9]),
    recurring: bool(r[10]),
    notes: str(r[11]),
    receiptUrl: str(r[12]),
    createdAt: str(r[13]),
    updatedAt: str(r[14]),
    group: str(r[15]),
    billId: str(r[16]),
  };
}

export function transactionToRow(t: Transaction): Row {
  return [
    t.id, t.date, t.category, t.subcategory, t.description, t.amount, t.payment, t.type, t.priority,
    t.merchant, t.recurring, t.notes, t.receiptUrl, t.createdAt, t.updatedAt, t.group, t.billId,
  ];
}

export function rowsToCategories(catRows: Row[], subRows: Row[]): Category[] {
  const cats: Category[] = catRows
    .map((r, i) => ({
      name: str(r[0]),
      color: str(r[1]) || "#6b6a72",
      icon: str(r[2]) || "Package",
      order: r[3] === "" || r[3] === undefined || r[3] === null ? i : num(r[3]),
      subcategories: [] as string[],
      archived: bool(r[4]),
    }))
    .filter((c) => c.name);
  const byName = new Map(cats.map((c) => [c.name, c]));
  for (const r of subRows) {
    const cat = byName.get(str(r[0]));
    const name = str(r[1]);
    if (cat && name && !cat.subcategories.includes(name)) cat.subcategories.push(name);
  }
  return cats.sort((a, b) => a.order - b.order);
}

export function categoriesToRows(categories: Category[]): { cats: Row[]; subs: Row[] } {
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  return {
    cats: sorted.map((c, i) => [c.name, c.color, c.icon, i, c.archived]),
    subs: sorted.flatMap((c) => c.subcategories.map((s) => [c.name, s])),
  };
}

export function rowToBudget(r: Row): BudgetLine | null {
  const month = str(r[0]);
  const category = str(r[1]);
  if (!month || !category) return null;
  return { month: month === "default" ? month : month.slice(0, 7), category, amount: num(r[2]) };
}

export const budgetToRow = (b: BudgetLine): Row => [b.month, b.category, b.amount];

export function rowToIncome(r: Row): IncomeLine | null {
  const month = str(r[0]);
  if (!month) return null;
  return { month, gross: num(r[1]), net: num(r[2]), note: str(r[3]) };
}

export const incomeToRow = (i: IncomeLine): Row => [i.month, i.gross, i.net, i.note];

export function rowToSubscription(r: Row): Subscription | null {
  const id = str(r[0]);
  const name = str(r[1]);
  if (!id || !name) return null;
  const day = num(r[5]);
  return {
    id,
    name,
    category: str(r[2]),
    amount: num(r[3]),
    cycle: oneOf<Cycle>(r[4], CYCLES, "monthly"),
    billingDay: day >= 1 && day <= 31 ? Math.round(day) : null,
    payment: str(r[6]),
    status: oneOf<SubStatus>(r[7], SUB_STATUSES, "active"),
    trialEnd: date(r[8]),
    worthIt: oneOf<WorthIt>(r[9], WORTH_IT, "maybe"),
    notes: str(r[10]),
    nextCharge: date(r[11]),
    // rows from before bills and subscriptions were told apart
    kind: oneOf<SubKind>(r[12], SUB_KINDS, guessKind(str(r[2]))),
    subcategory: str(r[13]),
    merchant: str(r[14]),
  };
}

export const subscriptionToRow = (s: Subscription): Row => [
  s.id, s.name, s.category, s.amount, s.cycle, s.billingDay ?? "", s.payment, s.status, s.trialEnd, s.worthIt, s.notes, s.nextCharge, s.kind, s.subcategory, s.merchant,
];

export function rowToAccount(r: Row): Account | null {
  const id = str(r[0]);
  const name = str(r[1]);
  if (!id || !name) return null;
  return {
    id,
    name,
    institution: str(r[2]),
    type: oneOf<AccountType>(r[3], ACCOUNT_TYPES, "other"),
    color: str(r[4]) || "#6b6a72",
    archived: bool(r[5]),
    notes: str(r[6]),
    depreciation: Math.max(0, Math.min(100, num(r[7]))),
  };
}

export const accountToRow = (a: Account): Row => [a.id, a.name, a.institution, a.type, a.color, a.archived, a.notes, a.depreciation];

export function rowToBalance(r: Row): BalanceSnapshot | null {
  const accountId = str(r[0]);
  const d = date(r[1]);
  if (!accountId || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  return { accountId, date: d, balance: num(r[2]) };
}

export const balanceToRow = (b: BalanceSnapshot): Row => [b.accountId, b.date, b.balance];

export function rowToGoal(r: Row, index: number): Goal | null {
  const id = str(r[0]);
  const name = str(r[1]);
  if (!id || !name) return null;
  return {
    id,
    name,
    icon: str(r[2]) || "PiggyBank",
    color: str(r[3]) || "#d9b45f",
    target: num(r[4]),
    targetDate: date(r[5]),
    // stored as "id1|id2" so the sheet stays readable
    accountIds: str(r[6]).split("|").map((x) => x.trim()).filter(Boolean),
    saved: num(r[7]),
    monthlyContribution: num(r[8]),
    annualReturn: num(r[9]),
    status: oneOf<GoalStatus>(r[10], GOAL_STATUSES, "active"),
    order: r[11] === "" || r[11] === undefined || r[11] === null ? index : num(r[11]),
    notes: str(r[12]),
    createdAt: str(r[13]),
    startMonth: /^\d{4}-(0[1-9]|1[0-2])$/.test(str(r[14])) ? str(r[14]) : "",
    afterGoalId: str(r[15]),
    // stored as "6|7|8", like accountIds
    pausedMonths: [...new Set(str(r[16]).split("|").map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((a, b) => a - b),
  };
}

export const goalToRow = (g: Goal): Row => [
  g.id, g.name, g.icon, g.color, g.target, g.targetDate, g.accountIds.join("|"), g.saved, g.monthlyContribution, g.annualReturn,
  g.status, g.order, g.notes, g.createdAt, g.startMonth, g.afterGoalId, g.pausedMonths.join("|"),
];

const isMonth = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

export function rowToPlan(r: Row): Plan | null {
  const id = str(r[0]);
  const name = str(r[2]);
  const firstDate = date(r[12]);
  if (!id || !name || !/^\d{4}-\d{2}-\d{2}$/.test(firstDate)) return null;
  return {
    id,
    // camelCase codes ("carLoan"), matched whatever the case typed into the sheet
    kind: PLAN_KINDS.find((k) => k.toLowerCase() === str(r[1]).toLowerCase()) ?? "other",
    name,
    category: str(r[3]),
    subcategory: str(r[4]),
    merchant: str(r[5]),
    payment: str(r[6]),
    price: Math.max(0, num(r[7])),
    downPayment: Math.max(0, num(r[8])),
    rate: Math.max(0, num(r[9])),
    count: Math.max(1, Math.round(num(r[10])) || 1),
    amortization: oneOf(r[11], AMORTIZATIONS, "price"),
    firstDate,
    // stored as "2026-11:300|2027-06:500" so the sheet stays readable
    extras: str(r[13])
      .split("|")
      .map((x) => x.split(":"))
      .filter(([m, a]) => isMonth(m?.trim() ?? "") && a !== undefined)
      .map(([m, a]) => ({ from: m.trim(), amount: Math.max(0, parseAmount(a)) })),
    // "2027-10:10000:shorten|2028-10:5000:lower"
    prepayments: str(r[14])
      .split("|")
      .map((x) => x.split(":"))
      .filter(([m, a]) => isMonth(m?.trim() ?? "") && a !== undefined)
      .map(([m, a, mode]): Prepayment => ({ month: m.trim(), amount: Math.max(0, parseAmount(a)), mode: oneOf(mode, PREPAY_MODES, "shorten") })),
    accountId: str(r[15]),
    // on unless the sheet says otherwise
    countAsDebt: str(r[17]) === "" ? true : bool(r[17]),
    status: oneOf(r[18], PLAN_STATUSES, "active"),
    notes: str(r[19]),
    createdAt: str(r[20]),
    // "2028-11:4.29:end|2031-11:3.9:payment"
    rateChanges: str(r[21])
      .split("|")
      .map((x) => x.split(":"))
      .filter(([m, rate]) => isMonth(m?.trim() ?? "") && rate !== undefined)
      .map(([m, rate, keep]): RateChange => ({ from: m.trim(), rate: Math.max(0, Math.min(100, parseAmount(rate))), keep: oneOf(keep, RATE_KEEPS, "end") })),
  };
}

export const planToRow = (p: Plan): Row => [
  p.id, p.kind, p.name, p.category, p.subcategory, p.merchant, p.payment, p.price, p.downPayment, p.rate, p.count, p.amortization, p.firstDate,
  p.extras.map((e) => `${e.from}:${e.amount}`).join("|"),
  p.prepayments.map((x) => `${x.month}:${x.amount}:${x.mode}`).join("|"),
  // column Q held "logs itself" (loans now always ask "were these paid?"): kept empty so the columns after it stay put
  p.accountId, "", p.countAsDebt, p.status, p.notes, p.createdAt,
  p.rateChanges.map((x) => `${x.from}:${x.rate}:${x.keep}`).join("|"),
];

export function rowsToSettings(rows: Row[], fallbackLocale: Locale): Settings {
  const base = defaultSettings(fallbackLocale);
  const kv = new Map(rows.map((r) => [str(r[0]), r[1]]));
  const parsed: Partial<Settings> = {};
  if (kv.has("currency")) parsed.currency = str(kv.get("currency")) || base.currency;
  if (kv.has("locale")) {
    const l = str(kv.get("locale"));
    if (l === "pt" || l === "en" || l === "fr") parsed.locale = l;
  }
  if (kv.has("reserve")) parsed.reserve = num(kv.get("reserve"));
  if (kv.has("savingsGoal")) parsed.savingsGoal = num(kv.get("savingsGoal"));
  if (kv.has("warnAt")) {
    const w = num(kv.get("warnAt"));
    if (w > 0 && w <= 1) parsed.warnAt = w;
  }
  if (kv.has("checkInDay")) {
    const d = Math.round(num(kv.get("checkInDay")));
    if (d >= 1 && d <= 28) parsed.checkInDay = d;
  }
  if (kv.has("tourSeen")) parsed.tourSeen = Math.max(0, Math.round(num(kv.get("tourSeen"))));
  if (kv.has("paymentStyles")) {
    try {
      const styles = JSON.parse(str(kv.get("paymentStyles")));
      if (styles && typeof styles === "object" && !Array.isArray(styles)) parsed.paymentStyles = styles;
    } catch {
      /* hand-edited into something unreadable: fall back to the built-in looks */
    }
  }
  if (kv.has("paymentMethods")) {
    try {
      const list = JSON.parse(str(kv.get("paymentMethods")));
      if (Array.isArray(list)) parsed.paymentMethods = list.map(String).filter(Boolean);
    } catch {
      parsed.paymentMethods = str(kv.get("paymentMethods")).split("|").map((s) => s.trim()).filter(Boolean);
    }
  }
  return { ...base, ...parsed };
}

export function settingsToRows(s: Settings): Row[] {
  return [
    ["currency", s.currency],
    ["locale", s.locale],
    ["reserve", s.reserve],
    ["savingsGoal", s.savingsGoal],
    ["warnAt", s.warnAt],
    ["checkInDay", s.checkInDay],
    ["tourSeen", s.tourSeen],
    ["paymentMethods", JSON.stringify(s.paymentMethods)],
    ["paymentStyles", JSON.stringify(s.paymentStyles)],
  ];
}

/** Build a Dataset from the raw value ranges of every tab (in TAB_KEYS order). */
export function datasetFromRanges(ranges: Record<TabKey, Row[]>, fallbackLocale: Locale): Omit<Dataset, "meta"> {
  const pick = <T>(rows: Row[], f: (r: Row) => T | null) => rows.map(f).filter((x): x is T => x !== null);
  return {
    transactions: pick(ranges.transactions, rowToTransaction).sort(newestFirst),
    categories: rowsToCategories(ranges.categories, ranges.subcategories),
    budgets: pick(ranges.budgets, rowToBudget),
    incomes: pick(ranges.income, rowToIncome),
    subscriptions: pick(ranges.subscriptions, rowToSubscription),
    accounts: pick(ranges.accounts, rowToAccount),
    balances: pick(ranges.balances, rowToBalance).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    goals: ranges.goals
      .map((r, i) => rowToGoal(r, i))
      .filter((g): g is Goal => g !== null)
      .sort((a, b) => a.order - b.order),
    plans: pick(ranges.plans ?? [], rowToPlan),
    settings: rowsToSettings(ranges.settings, fallbackLocale),
  };
}

/** Every tab's data rows (header excluded) for a full rewrite. */
export function datasetToRanges(data: Omit<Dataset, "meta">): Record<TabKey, Row[]> {
  const { cats, subs } = categoriesToRows(data.categories);
  return {
    transactions: data.transactions.map(transactionToRow),
    categories: cats,
    subcategories: subs,
    budgets: data.budgets.map(budgetToRow),
    income: data.incomes.map(incomeToRow),
    subscriptions: data.subscriptions.map(subscriptionToRow),
    settings: settingsToRows(data.settings),
    accounts: data.accounts.map(accountToRow),
    balances: data.balances.map(balanceToRow),
    goals: data.goals.map(goalToRow),
    plans: data.plans.map(planToRow),
  };
}

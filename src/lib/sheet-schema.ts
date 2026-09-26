/**
 * Layout of the Google Sheet that acts as Gelbien's database, and the
 * row <-> object mapping. Pure (no network) so it is shared by the server
 * and unit tests.
 *
 * The sheet is meant to stay human-readable: category names (not ids) are
 * stored on transactions, dates are ISO text, enums are short English codes.
 */
import { defaultSettings } from "./defaults";
import type {
  BudgetLine,
  Category,
  Cycle,
  Dataset,
  ExpenseType,
  IncomeLine,
  Locale,
  Priority,
  Settings,
  SubStatus,
  Subscription,
  Transaction,
  WorthIt,
} from "./types";
import { CYCLES, EXPENSE_TYPES, PRIORITIES, SUB_STATUSES, WORTH_IT } from "./types";
import { parseAmount, serialToISO } from "./utils";

export const TABS = {
  transactions: {
    title: "Transactions",
    headers: ["id", "date", "category", "subcategory", "description", "amount", "payment", "type", "priority", "merchant", "recurring", "notes", "receipt", "createdAt", "updatedAt"],
  },
  categories: { title: "Categories", headers: ["name", "color", "icon", "order", "archived"] },
  subcategories: { title: "Subcategories", headers: ["category", "name"] },
  budgets: { title: "Budgets", headers: ["month", "category", "amount"] },
  income: { title: "Income", headers: ["month", "gross", "net", "note"] },
  subscriptions: {
    title: "Subscriptions",
    headers: ["id", "name", "category", "amount", "cycle", "billingDay", "payment", "status", "trialEnd", "worthIt", "notes"],
  },
  settings: { title: "Settings", headers: ["key", "value"] },
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
  };
}

export function transactionToRow(t: Transaction): Row {
  return [
    t.id, t.date, t.category, t.subcategory, t.description, t.amount, t.payment, t.type, t.priority,
    t.merchant, t.recurring, t.notes, t.receiptUrl, t.createdAt, t.updatedAt,
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
  };
}

export const subscriptionToRow = (s: Subscription): Row => [
  s.id, s.name, s.category, s.amount, s.cycle, s.billingDay ?? "", s.payment, s.status, s.trialEnd, s.worthIt, s.notes,
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
    ["paymentMethods", JSON.stringify(s.paymentMethods)],
  ];
}

/** Build a Dataset from the raw value ranges of every tab (in TAB_KEYS order). */
export function datasetFromRanges(ranges: Record<TabKey, Row[]>, fallbackLocale: Locale): Omit<Dataset, "meta"> {
  const pick = <T>(rows: Row[], f: (r: Row) => T | null) => rows.map(f).filter((x): x is T => x !== null);
  return {
    transactions: pick(ranges.transactions, rowToTransaction).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    categories: rowsToCategories(ranges.categories, ranges.subcategories),
    budgets: pick(ranges.budgets, rowToBudget),
    incomes: pick(ranges.income, rowToIncome),
    subscriptions: pick(ranges.subscriptions, rowToSubscription),
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
  };
}

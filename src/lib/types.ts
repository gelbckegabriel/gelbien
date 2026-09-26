export type Locale = "pt" | "en" | "fr";

export type Priority = "essential" | "important" | "superfluous";
export type ExpenseType = "fixed" | "variable";
export type Cycle = "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
export type SubStatus = "active" | "trial" | "paused" | "cancelled";
export type WorthIt = "yes" | "maybe" | "no";

export const PRIORITIES: Priority[] = ["essential", "important", "superfluous"];
export const EXPENSE_TYPES: ExpenseType[] = ["fixed", "variable"];
export const CYCLES: Cycle[] = ["weekly", "monthly", "bimonthly", "quarterly", "semiannual", "annual"];
export const SUB_STATUSES: SubStatus[] = ["active", "trial", "paused", "cancelled"];
export const WORTH_IT: WorthIt[] = ["yes", "maybe", "no"];

export interface Transaction {
  id: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  category: string;
  subcategory: string;
  description: string;
  /** Positive = expense; negative = refund / money back */
  amount: number;
  payment: string;
  type: ExpenseType;
  priority: Priority;
  merchant: string;
  recurring: boolean;
  notes: string;
  receiptUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  name: string;
  color: string;
  icon: string;
  order: number;
  subcategories: string[];
  archived: boolean;
}

/** month is "default" (applies to every month) or a YYYY-MM override */
export interface BudgetLine {
  month: string;
  category: string;
  amount: number;
}

export interface IncomeLine {
  month: string;
  gross: number;
  net: number;
  note: string;
}

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  cycle: Cycle;
  billingDay: number | null;
  payment: string;
  status: SubStatus;
  trialEnd: string;
  worthIt: WorthIt;
  notes: string;
}

export interface Settings {
  currency: string;
  locale: Locale;
  /** Emergency fund / savings available today, used for runway */
  reserve: number;
  /** Monthly savings target */
  savingsGoal: number;
  paymentMethods: string[];
  /** Fraction of a budget at which a category flips to "attention" */
  warnAt: number;
}

export interface DatasetMeta {
  source: "demo" | "google";
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  syncedAt: string;
}

export interface Dataset {
  transactions: Transaction[];
  categories: Category[];
  budgets: BudgetLine[];
  incomes: IncomeLine[];
  subscriptions: Subscription[];
  settings: Settings;
  meta: DatasetMeta;
}

/** Every write the app can make. Both data sources (demo + Google Sheets) implement these. */
export type Mutation =
  | { op: "addTransaction"; tx: Transaction }
  | { op: "updateTransaction"; tx: Transaction }
  | { op: "deleteTransaction"; id: string }
  | { op: "saveCategories"; categories: Category[]; renames: { from: string; to: string }[] }
  /** Replaces every budget line for `month`; upserts `income`; `clearIncome` drops that month's income override. */
  | { op: "saveBudget"; month: string; lines: BudgetLine[]; income: IncomeLine | null; clearIncome?: boolean }
  | { op: "upsertSubscription"; sub: Subscription }
  | { op: "deleteSubscription"; id: string }
  | { op: "saveSettings"; settings: Settings }
  | { op: "replaceAll"; data: Omit<Dataset, "meta"> };

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
}

export interface SessionInfo {
  googleConfigured: boolean;
  user: SessionUser | null;
  spreadsheetId: string | null;
  spreadsheetUrl: string | null;
}

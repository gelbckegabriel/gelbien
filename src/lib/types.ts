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

export type AccountType = "chequing" | "savings" | "investment" | "credit" | "cash" | "other";
export type GoalStatus = "active" | "paused" | "achieved";
export const ACCOUNT_TYPES: AccountType[] = ["chequing", "savings", "investment", "credit", "cash", "other"];
export const GOAL_STATUSES: GoalStatus[] = ["active", "paused", "achieved"];

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
  /** Day of the month (1-28) when balances should be checked in */
  checkInDay: number;
}

/** A bank account, card, investment or cash pot whose balance is checked in monthly. */
export interface Account {
  id: string;
  name: string;
  /** e.g. "Neo Financial", "Scotiabank" */
  institution: string;
  type: AccountType;
  color: string;
  archived: boolean;
  notes: string;
}

/** Balance of one account on one date. Credit accounts store what you owe as a positive number. */
export interface BalanceSnapshot {
  accountId: string;
  /** ISO date, YYYY-MM-DD */
  date: string;
  balance: number;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  color: string;
  target: number;
  /** YYYY-MM-DD or "" when there is no deadline */
  targetDate: string;
  /** Accounts that hold this goal's money; when empty, `saved` is tracked by hand */
  accountIds: string[];
  saved: number;
  monthlyContribution: number;
  /** Expected yearly return in %, e.g. 3 for a high-interest savings account */
  annualReturn: number;
  status: GoalStatus;
  order: number;
  notes: string;
  createdAt: string;
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
  accounts: Account[];
  balances: BalanceSnapshot[];
  goals: Goal[];
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
  | { op: "upsertAccount"; account: Account }
  | { op: "deleteAccount"; id: string }
  /** Upserts snapshots by (accountId, date) */
  | { op: "saveBalances"; balances: BalanceSnapshot[] }
  | { op: "upsertGoal"; goal: Goal }
  | { op: "deleteGoal"; id: string }
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

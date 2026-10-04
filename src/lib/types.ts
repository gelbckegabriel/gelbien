export type Locale = "pt" | "en" | "fr";

export type Priority = "essential" | "important" | "superfluous";
export type ExpenseType = "fixed" | "variable";
export type Cycle = "weekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
export type SubStatus = "active" | "trial" | "paused" | "cancelled";
export type WorthIt = "yes" | "maybe" | "no";
/** A bill (rent, utilities, insurance) or a subscription (streaming, apps) — both repeat */
export type SubKind = "bill" | "subscription";

export const PRIORITIES: Priority[] = ["essential", "important", "superfluous"];
export const EXPENSE_TYPES: ExpenseType[] = ["fixed", "variable"];
export const CYCLES: Cycle[] = ["weekly", "monthly", "bimonthly", "quarterly", "semiannual", "annual"];
export const SUB_STATUSES: SubStatus[] = ["active", "trial", "paused", "cancelled"];
export const WORTH_IT: WorthIt[] = ["yes", "maybe", "no"];
export const SUB_KINDS: SubKind[] = ["bill", "subscription"];

export type AccountType = "chequing" | "savings" | "investment" | "cash" | "property" | "other" | "credit" | "lineOfCredit" | "loan" | "mortgage";
export type GoalStatus = "active" | "paused" | "achieved";
export const ACCOUNT_TYPES: AccountType[] = ["chequing", "savings", "investment", "cash", "property", "other", "credit", "lineOfCredit", "loan", "mortgage"];
/** Accounts that hold what you owe: their balance is the amount owed, and it counts against net worth. */
export const DEBT_TYPES: readonly AccountType[] = ["credit", "lineOfCredit", "loan", "mortgage"];
export const isDebt = (type: AccountType) => DEBT_TYPES.includes(type);
/** A home or car, a loan, a mortgage: part of net worth, but not money to live on (see accountsReserve). */
export const isLongTerm = (type: AccountType) => type === "property" || type === "loan" || type === "mortgage";
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
  /** Shared by the parts of one purchase split across categories; "" for a normal expense */
  group: string;
  /** The subscription / recurring bill this expense pays; "" otherwise */
  billId: string;
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
  /** A known upcoming charge date (YYYY-MM-DD) — anchors non-monthly cycles; "" when unknown */
  nextCharge: string;
  /** Free trials and "worth it?" only apply to subscriptions */
  kind: SubKind;
  /** Logged with each charge marked paid; "" for none */
  subcategory: string;
  /** Who charges it (landlord, utility, app store) — logged with each charge marked paid; "" when not set */
  merchant: string;
}

export interface PaymentStyle {
  icon: string;
  color: string;
}

export interface Settings {
  currency: string;
  locale: Locale;
  /** Emergency fund / savings available today, used for runway */
  /** Legacy: the runway now uses the account balances (see accountsReserve). Kept so older sheets still load. */
  reserve: number;
  /** Monthly savings target */
  savingsGoal: number;
  paymentMethods: string[];
  /** Icon + colour the user picked for a payment method, by name. Others use the built-in look (see paymentLook). */
  paymentStyles: Record<string, PaymentStyle>;
  /** Fraction of a budget at which a category flips to "attention" */
  warnAt: number;
  /** Day of the month (1-28) when balances should be checked in */
  checkInDay: number;
  /** Version of the welcome tour this user last finished or skipped (see welcome-tour.tsx); 0 = never seen */
  tourSeen: number;
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
  /** The sheet could be read but not written — why (an error code, e.g. "storage"); changes won't save */
  warning?: string;
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
  /** Several new expenses in one write (e.g. marking bills paid) */
  | { op: "addTransactions"; txs: Transaction[] }
  | { op: "deleteTransactions"; ids: string[] }
  /** Replaces every part of split purchase `group` with `txs` (parts left out are deleted). */
  | { op: "saveTransactionGroup"; group: string; txs: Transaction[] }
  | { op: "deleteTransactionGroup"; group: string }
  | {
      op: "saveCategories";
      categories: Category[];
      renames: { from: string; to: string }[];
      /** Subcategory renames, keyed by the category's name before this save */
      subRenames?: { category: string; from: string; to: string }[];
    }
  /** Replaces every budget line for `month`; upserts `income`; `clearIncome` drops that month's income override. */
  | { op: "saveBudget"; month: string; lines: BudgetLine[]; income: IncomeLine | null; clearIncome?: boolean }
  | { op: "upsertSubscription"; sub: Subscription }
  | { op: "deleteSubscription"; id: string }
  /** `paymentRenames` renames a payment method on past expenses and recurring payments too */
  | { op: "saveSettings"; settings: Settings; paymentRenames?: { from: string; to: string }[] }
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

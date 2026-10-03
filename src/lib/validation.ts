import { z } from "zod";
import { guessKind } from "./defaults";
import { ACCOUNT_TYPES, CYCLES, EXPENSE_TYPES, GOAL_STATUSES, PRIORITIES, SUB_KINDS, SUB_STATUSES, WORTH_IT, type Dataset, type Mutation } from "./types";

const text = (max = 500) => z.string().max(max);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthKey = z.union([z.literal("default"), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)]);
const money = z.number().finite().gte(-1e9).lte(1e9);

export const transactionSchema = z.object({
  id: text(64).min(1),
  date: isoDate,
  category: text(120),
  subcategory: text(160),
  description: text(500),
  amount: money,
  payment: text(120),
  type: z.enum(EXPENSE_TYPES),
  priority: z.enum(PRIORITIES),
  merchant: text(160),
  recurring: z.boolean(),
  notes: text(2000),
  receiptUrl: text(1000),
  createdAt: text(40),
  updatedAt: text(40),
  // defaults: backups made before splits / bills existed still restore
  group: text(64).default(""),
  billId: text(64).default(""),
});

export const categorySchema = z.object({
  name: text(120).min(1),
  color: text(20),
  icon: text(40),
  order: z.number().finite(),
  subcategories: z.array(text(160)).max(200),
  archived: z.boolean(),
});

const budgetLine = z.object({ month: monthKey, category: text(120), amount: money });
const incomeLine = z.object({ month: monthKey, gross: money, net: money, note: text(500) });

export const subscriptionSchema = z.object({
  id: text(64).min(1),
  name: text(160).min(1),
  category: text(120),
  amount: money,
  cycle: z.enum(CYCLES),
  billingDay: z.number().int().min(1).max(31).nullable(),
  payment: text(120),
  status: z.enum(SUB_STATUSES),
  trialEnd: z.union([isoDate, z.literal("")]),
  worthIt: z.enum(WORTH_IT),
  notes: text(2000),
  nextCharge: z.union([isoDate, z.literal("")]).default(""),
  // optional so backups from before bills and subscriptions were told apart still restore
  kind: z.enum(SUB_KINDS).optional(),
  subcategory: text(160).default(""),
  merchant: text(160).default(""),
}).transform((s) => ({ ...s, kind: s.kind ?? guessKind(s.category) }));

export const settingsSchema = z.object({
  currency: text(8).min(3),
  locale: z.enum(["pt", "en", "fr"]),
  reserve: money,
  savingsGoal: money,
  paymentMethods: z.array(text(120)).max(50),
  paymentStyles: z.record(text(120), z.object({ icon: text(40), color: text(20) })).default({}),
  warnAt: z.number().gt(0).lte(1),
  // optional so backups made before Goals existed still restore
  checkInDay: z.number().int().min(1).max(28).default(1),
  tourSeen: z.number().int().min(0).max(1000).default(0),
});

export const accountSchema = z.object({
  id: text(64).min(1),
  name: text(120).min(1),
  institution: text(120),
  type: z.enum(ACCOUNT_TYPES),
  color: text(20),
  archived: z.boolean(),
  notes: text(1000),
});

export const balanceSchema = z.object({ accountId: text(64).min(1), date: isoDate, balance: money });

export const goalSchema = z.object({
  id: text(64).min(1),
  name: text(120).min(1),
  icon: text(40),
  color: text(20),
  target: money,
  targetDate: z.union([isoDate, z.literal("")]),
  accountIds: z.array(text(64)).max(20),
  saved: money,
  monthlyContribution: money,
  annualReturn: z.number().finite().gte(-50).lte(50),
  status: z.enum(GOAL_STATUSES),
  order: z.number().finite(),
  notes: text(2000),
  createdAt: text(40),
});

/** A full dataset (also the JSON backup format). */
export const datasetSchema = z.object({
  transactions: z.array(transactionSchema).max(50000),
  categories: z.array(categorySchema).max(100),
  budgets: z.array(budgetLine).max(5000),
  incomes: z.array(incomeLine).max(1000),
  subscriptions: z.array(subscriptionSchema).max(500),
  accounts: z.array(accountSchema).max(200).default([]),
  balances: z.array(balanceSchema).max(20000).default([]),
  goals: z.array(goalSchema).max(200).default([]),
  settings: settingsSchema,
});

// The schemas must match the app's types field for field: one a schema doesn't know is silently
// dropped from what gets saved, and one it requires breaks restoring older backups (give new fields a
// .default()). This stops compiling when the two drift apart.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
export type SchemasMatchTypes = Assert<Same<z.output<typeof datasetSchema>, Omit<Dataset, "meta">>>;

export const mutationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("addTransaction"), tx: transactionSchema }),
  z.object({ op: z.literal("updateTransaction"), tx: transactionSchema }),
  z.object({ op: z.literal("deleteTransaction"), id: text(64).min(1) }),
  z.object({ op: z.literal("addTransactions"), txs: z.array(transactionSchema).min(1).max(50) }),
  z.object({ op: z.literal("deleteTransactions"), ids: z.array(text(64).min(1)).min(1).max(50) }),
  z.object({ op: z.literal("saveTransactionGroup"), group: text(64).min(1), txs: z.array(transactionSchema).max(50) }),
  z.object({ op: z.literal("deleteTransactionGroup"), group: text(64).min(1) }),
  z.object({
    op: z.literal("saveCategories"),
    categories: z.array(categorySchema).max(100),
    renames: z.array(z.object({ from: text(120), to: text(120) })).max(100),
    subRenames: z.array(z.object({ category: text(120), from: text(160), to: text(160) })).max(1000).optional(),
  }),
  z.object({ op: z.literal("saveBudget"), month: monthKey, lines: z.array(budgetLine).max(200), income: incomeLine.nullable(), clearIncome: z.boolean().optional() }),
  z.object({ op: z.literal("upsertSubscription"), sub: subscriptionSchema }),
  z.object({ op: z.literal("deleteSubscription"), id: text(64).min(1) }),
  z.object({
    op: z.literal("saveSettings"),
    settings: settingsSchema,
    paymentRenames: z.array(z.object({ from: text(120).min(1), to: text(120).min(1) })).max(50).optional(),
  }),
  z.object({ op: z.literal("upsertAccount"), account: accountSchema }),
  z.object({ op: z.literal("deleteAccount"), id: text(64).min(1) }),
  z.object({ op: z.literal("saveBalances"), balances: z.array(balanceSchema).min(1).max(200) }),
  z.object({ op: z.literal("upsertGoal"), goal: goalSchema }),
  z.object({ op: z.literal("deleteGoal"), id: text(64).min(1) }),
  z.object({ op: z.literal("replaceAll"), data: datasetSchema }),
]);

export function parseMutation(input: unknown): Mutation {
  return mutationSchema.parse(input) as Mutation;
}

import type { Dataset, Mutation } from "../types";

const byDateDesc = (a: { date: string }, b: { date: string }) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0);

/**
 * Apply a mutation to an in-memory dataset. Used for optimistic updates (Google
 * mode) and as the actual write path in demo mode — so both behave identically.
 */
export function applyMutationToDataset(ds: Dataset, m: Mutation): Dataset {
  switch (m.op) {
    case "addTransaction":
      return { ...ds, transactions: [m.tx, ...ds.transactions.filter((t) => t.id !== m.tx.id)].sort(byDateDesc) };
    case "updateTransaction":
      return {
        ...ds,
        transactions: (ds.transactions.some((t) => t.id === m.tx.id)
          ? ds.transactions.map((t) => (t.id === m.tx.id ? m.tx : t))
          : [m.tx, ...ds.transactions]
        ).sort(byDateDesc),
      };
    case "deleteTransaction":
      return { ...ds, transactions: ds.transactions.filter((t) => t.id !== m.id) };
    case "saveCategories": {
      const rename = (name: string) => m.renames.find((r) => r.from === name)?.to ?? name;
      if (!m.renames.length) return { ...ds, categories: m.categories };
      return {
        ...ds,
        categories: m.categories,
        transactions: ds.transactions.map((t) => ({ ...t, category: rename(t.category) })),
        budgets: ds.budgets.map((b) => ({ ...b, category: rename(b.category) })),
        subscriptions: ds.subscriptions.map((s) => ({ ...s, category: rename(s.category) })),
      };
    }
    case "saveBudget": {
      const budgets = [...ds.budgets.filter((b) => b.month !== m.month), ...m.lines.filter((l) => l.amount > 0)];
      const income = m.income;
      let incomes = m.clearIncome ? ds.incomes.filter((i) => i.month !== m.month) : ds.incomes;
      if (income) incomes = [...incomes.filter((i) => i.month !== income.month), income];
      return { ...ds, budgets, incomes };
    }
    case "upsertSubscription":
      return {
        ...ds,
        subscriptions: ds.subscriptions.some((s) => s.id === m.sub.id)
          ? ds.subscriptions.map((s) => (s.id === m.sub.id ? m.sub : s))
          : [...ds.subscriptions, m.sub],
      };
    case "deleteSubscription":
      return { ...ds, subscriptions: ds.subscriptions.filter((s) => s.id !== m.id) };
    case "saveSettings":
      return { ...ds, settings: m.settings };
    case "replaceAll":
      return { ...m.data, transactions: [...m.data.transactions].sort(byDateDesc), meta: ds.meta };
  }
}

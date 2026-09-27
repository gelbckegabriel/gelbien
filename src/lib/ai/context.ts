import { effectiveBudget, effectiveIncome, monthlyCost, trend } from "../finance";
import { goalPlanFor, latestBalances, netWorth } from "../goals";
import type { Dataset, Locale } from "../types";
import { addMonths, currentMonth, monthOf, monthRange } from "../utils";

export const LANGUAGE_NAME: Record<Locale, string> = {
  pt: "Brazilian Portuguese",
  en: "English",
  fr: "Canadian French",
};

const csv = (v: string | number | boolean) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const MAX_TX = 900;

/**
 * A compact, deterministic text snapshot of the user's finances for the model.
 * Deterministic ordering keeps it byte-stable between requests so it can be prompt-cached.
 */
export function buildFinanceContext(ds: Dataset, anchorMonth = currentMonth()): string {
  const cur = ds.settings.currency;
  const lines: string[] = [];
  const income = effectiveIncome(ds.incomes, anchorMonth);
  const { lines: budget } = effectiveBudget(ds.budgets, anchorMonth);

  lines.push(`# Financial snapshot (amounts in ${cur})`);
  lines.push("");
  lines.push("## Profile");
  lines.push(`- Monthly income: gross ${income.gross.toFixed(2)}, net ${income.net.toFixed(2)}`);
  lines.push(`- Monthly savings goal: ${ds.settings.savingsGoal.toFixed(2)}`);
  lines.push(`- Payment methods: ${ds.settings.paymentMethods.join(", ")}`);
  lines.push("");

  lines.push("## Categories (monthly budget) and subcategories");
  for (const c of [...ds.categories].sort((a, b) => a.order - b.order)) {
    if (c.archived) continue;
    lines.push(`- ${c.name} (budget ${(budget[c.name] ?? 0).toFixed(2)}): ${c.subcategories.join("; ")}`);
  }
  lines.push("");

  lines.push("## Monthly totals, last 12 months (month, spent, net income, saved)");
  for (const p of trend(ds, anchorMonth, 12)) {
    lines.push(`${p.month}, ${p.spent.toFixed(2)}, ${p.income.toFixed(2)}, ${p.saved.toFixed(2)}`);
  }
  lines.push("");

  const months = monthRange(anchorMonth, 6);
  const byCat = new Map<string, number[]>();
  for (const t of ds.transactions) {
    const i = months.indexOf(monthOf(t.date));
    if (i === -1) continue;
    const row = byCat.get(t.category) ?? months.map(() => 0);
    row[i] += t.amount;
    byCat.set(t.category, row);
  }
  lines.push(`## Spending by category, last 6 months (${months.join(", ")})`);
  for (const [name, row] of [...byCat.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`${name}: ${row.map((v) => v.toFixed(2)).join(", ")}`);
  }
  lines.push("");

  if (ds.subscriptions.length) {
    lines.push("## Subscriptions (name, category, price, cycle, monthly equivalent, status, worth it?, trial end)");
    for (const s of ds.subscriptions) {
      lines.push(
        [s.name, s.category, s.amount.toFixed(2), s.cycle, monthlyCost(s).toFixed(2), s.status, s.worthIt, s.trialEnd || "-"].map(csv).join(", "),
      );
    }
    lines.push("");
  }

  if (ds.accounts.length) {
    const latest = latestBalances(ds.balances);
    const nw = netWorth(ds);
    lines.push(`## Accounts — latest monthly check-in (net worth ${nw.total.toFixed(2)}: assets ${nw.assets.toFixed(2)}, debts ${nw.debts.toFixed(2)})`);
    lines.push("name, institution, type, balance (credit = amount owed), as of, state");
    for (const a of ds.accounts) {
      const b = latest.get(a.id);
      lines.push([a.name, a.institution, a.type, b ? b.balance.toFixed(2) : "-", b?.date ?? "-", a.archived ? "closed" : "open"].map(csv).join(", "));
    }
    lines.push("");
  }

  if (ds.goals.length) {
    lines.push("## Savings goals (name, target, saved now, monthly contribution, expected yearly return %, deadline, projected month reached at this pace, status)");
    for (const g of ds.goals) {
      const p = goalPlanFor(ds, g);
      lines.push(
        [g.name, g.target.toFixed(2), p.current.toFixed(2), g.monthlyContribution.toFixed(2), g.annualReturn, g.targetDate || "none", p.achieved ? "reached" : p.eta ?? "never", g.status]
          .map(csv)
          .join(", "),
      );
    }
    lines.push("");
  }

  const since = `${addMonths(anchorMonth, -11)}-01`;
  const recent = ds.transactions.filter((t) => t.date >= since).slice(0, MAX_TX);
  lines.push(`## Transactions since ${since}, newest first (${recent.length} rows; negative amount = refund)`);
  lines.push("date,amount,category,subcategory,merchant,description,priority,type,payment,recurring");
  for (const t of recent) {
    lines.push(
      [t.date, t.amount.toFixed(2), t.category, t.subcategory, t.merchant, t.description, t.priority, t.type, t.payment, t.recurring ? "yes" : "no"]
        .map(csv)
        .join(","),
    );
  }
  return lines.join("\n");
}

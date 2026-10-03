import { describe, expect, it } from "vitest";
import { defaultCategories, defaultSettings } from "./defaults";
import { buildDemoDataset } from "./demo";
import {
  budgetStatus,
  effectiveBudget,
  effectiveIncome,
  foldCategories,
  localInsights,
  monthlyCost,
  paceSeries,
  recentAverages,
  runway,
  subscriptionTotals,
  suggestBudget,
  suggestFromHistory,
  summarizeMonth,
  trend,
  yearMatrix,
} from "./finance";
import { applyMutationToDataset } from "./data/reducer";
import { monthReview } from "./review";
import type { Dataset, Transaction } from "./types";

function tx(partial: Partial<Transaction> & Pick<Transaction, "date" | "amount" | "category">): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    subcategory: "",
    description: "",
    payment: "Credit",
    type: "variable",
    priority: "important",
    merchant: "",
    recurring: false,
    notes: "",
    receiptUrl: "",
    createdAt: "",
    updatedAt: "",
    group: "",
    billId: "",
    ...partial,
  };
}

function dataset(transactions: Transaction[], extra: Partial<Dataset> = {}): Dataset {
  return {
    transactions,
    categories: defaultCategories("en"),
    budgets: [],
    incomes: [],
    subscriptions: [],
    accounts: [],
    balances: [],
    goals: [],
    settings: defaultSettings("en"),
    meta: { source: "demo", syncedAt: "" },
    ...extra,
  };
}

describe("budgetStatus (spreadsheet rule: >100% over, >=85% attention)", () => {
  it("classifies spend against a limit", () => {
    expect(budgetStatus(50, 0)).toBe("none");
    expect(budgetStatus(101, 100)).toBe("over");
    expect(budgetStatus(85, 100)).toBe("attention");
    expect(budgetStatus(84.99, 100)).toBe("within");
    expect(budgetStatus(90, 100, 0.95)).toBe("within");
  });
});

describe("effective budget and income", () => {
  const budgets = [
    { month: "default", category: "Groceries", amount: 500 },
    { month: "default", category: "Housing", amount: 1700 },
    { month: "2026-09", category: "Groceries", amount: 650 },
  ];
  it("uses a month override when present, else the default", () => {
    expect(effectiveBudget(budgets, "2026-08")).toEqual({ lines: { Groceries: 500, Housing: 1700 }, isOverride: false });
    expect(effectiveBudget(budgets, "2026-09")).toEqual({ lines: { Groceries: 650 }, isOverride: true });
  });
  it("falls back to default income and then to zero", () => {
    const incomes = [{ month: "default", gross: 6000, net: 4800, note: "" }, { month: "2026-12", gross: 9000, net: 7000, note: "bonus" }];
    expect(effectiveIncome(incomes, "2026-12").net).toBe(7000);
    expect(effectiveIncome(incomes, "2026-11").net).toBe(4800);
    expect(effectiveIncome([], "2026-11").net).toBe(0);
  });
});

describe("summarizeMonth", () => {
  const ds = dataset(
    [
      tx({ date: "2026-09-01", amount: 1650, category: "Housing", type: "fixed", priority: "essential" }),
      tx({ date: "2026-09-03", amount: 120, category: "Groceries", priority: "essential", payment: "Debit" }),
      tx({ date: "2026-09-10", amount: 60, category: "Eating out", priority: "superfluous" }),
      tx({ date: "2026-09-10", amount: -20, category: "Eating out", priority: "superfluous", description: "refund" }),
      tx({ date: "2026-08-15", amount: 999, category: "Groceries" }),
    ],
    {
      budgets: [
        { month: "default", category: "Housing", amount: 1700 },
        { month: "default", category: "Groceries", amount: 400 },
        { month: "default", category: "Leisure", amount: 100 },
      ],
      incomes: [{ month: "default", gross: 6000, net: 4800, note: "" }],
    },
  );
  const s = summarizeMonth(ds, "2026-09", "2026-09-15");

  it("totals only the month, with refunds netted", () => {
    expect(s.total).toBe(1810);
    expect(s.count).toBe(4);
    expect(s.fixed).toBe(1650);
    expect(s.variable).toBe(160);
    expect(s.byPriority).toEqual({ essential: 1770, important: 0, superfluous: 40 });
  });

  it("computes pace and savings for the current month", () => {
    expect(s.isCurrent).toBe(true);
    expect(s.elapsed).toBe(15);
    expect(s.daysLeft).toBe(16);
    expect(s.budgetTotal).toBe(2200);
    expect(s.remaining).toBe(390);
    expect(s.perDayLeft).toBeCloseTo(390 / 16);
    expect(s.saved).toBe(4800 - 1810);
    expect(s.savingsRate).toBeCloseTo((4800 - 1810) / 4800);
  });

  it("includes budgeted categories with no spend and sorts by spend", () => {
    expect(s.byCategory.map((c) => c.name)).toEqual(["Housing", "Groceries", "Eating out", "Leisure"]);
    const leisure = s.byCategory.find((c) => c.name === "Leisure")!;
    expect(leisure.spent).toBe(0);
    expect(leisure.status).toBe("within");
  });

  it("builds a daily series and top list", () => {
    expect(s.daily[0]).toBe(1650);
    expect(s.daily[9]).toBe(40);
    expect(s.largest?.amount).toBe(1650);
  });

  it("builds a cumulative pace series that stops at today", () => {
    const pace = paceSeries(ds, "2026-09", "2026-09-15");
    expect(pace).toHaveLength(30);
    expect(pace[14].actual).toBe(1810);
    expect(pace[15].actual).toBeNull();
    expect(pace[29].pace).toBe(2200);
  });
});

describe("trend, year matrix, subscriptions and runway", () => {
  const ds = dataset([
    tx({ date: "2026-01-05", amount: 100, category: "Housing" }),
    tx({ date: "2026-03-05", amount: 300, category: "Housing" }),
    tx({ date: "2026-03-09", amount: 50, category: "Groceries" }),
  ], { incomes: [{ month: "default", gross: 0, net: 1000, note: "" }] });

  it("averages only months with spending, like the spreadsheet", () => {
    const m = yearMatrix(ds, 2026);
    expect(m.yearTotal).toBe(450);
    expect(m.activeMonths).toBe(2);
    expect(m.monthlyAverage).toBe(225);
    expect(m.rows.find((r) => r.name === "Housing")?.values[2]).toBe(300);
  });

  it("reports saved = net income - spent per month", () => {
    const t = trend(ds, "2026-03", 3);
    expect(t.map((p) => p.saved)).toEqual([900, 1000, 650]);
  });

  it("normalizes subscription cycles to monthly cost", () => {
    expect(monthlyCost({ amount: 120, cycle: "annual" })).toBe(10);
    expect(monthlyCost({ amount: 30, cycle: "quarterly" })).toBe(10);
    const totals = subscriptionTotals([
      { id: "a", name: "A", category: "", amount: 10, cycle: "monthly", billingDay: 1, payment: "", status: "active", trialEnd: "", worthIt: "yes", notes: "", nextCharge: "", kind: "bill", subcategory: "", merchant: "" },
      { id: "b", name: "B", category: "", amount: 120, cycle: "annual", billingDay: 1, payment: "", status: "active", trialEnd: "", worthIt: "yes", notes: "", nextCharge: "", kind: "subscription", subcategory: "", merchant: "" },
      { id: "c", name: "C", category: "", amount: 15, cycle: "monthly", billingDay: 1, payment: "", status: "trial", trialEnd: "", worthIt: "no", notes: "", nextCharge: "", kind: "subscription", subcategory: "", merchant: "" },
      { id: "d", name: "D", category: "", amount: 99, cycle: "monthly", billingDay: 1, payment: "", status: "cancelled", trialEnd: "", worthIt: "no", notes: "", nextCharge: "", kind: "subscription", subcategory: "", merchant: "" },
    ]);
    expect(totals.activeMonthly).toBe(20);
    expect(totals).toMatchObject({ billsMonthly: 10, subscriptionsMonthly: 10, subscriptionCount: 1 });
    expect(totals.activeYearly).toBe(240);
    expect(totals.trialMonthly).toBe(15);
  });

  it("computes runway from net burn (spreadsheet: reserve ÷ burn)", () => {
    expect(runway(20000, 3000, 5000).sustainable).toBe(true);
    const r = runway(20000, 6000, 5000);
    expect(r.sustainable).toBe(false);
    expect(r.months).toBe(20);
  });
});

describe("helpers", () => {
  it("folds long category lists into Other", () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ name: `C${i}`, color: "#000", spent: 100 - i }));
    const folded = foldCategories(items, 6);
    expect(folded).toHaveLength(7);
    expect(folded[6]).toMatchObject({ name: "__other__", value: 94 + 93 + 92 });
  });

  it("suggests budgets from the previous 3 months, rounded up to 10", () => {
    const ds = dataset([
      tx({ date: "2026-06-02", amount: 100, category: "Groceries" }),
      tx({ date: "2026-07-02", amount: 200, category: "Groceries" }),
      tx({ date: "2026-08-02", amount: 305, category: "Groceries" }),
    ]);
    expect(suggestBudget(ds, "2026-09")).toEqual({ Groceries: 210 });
  });

  it("prefills from the latest expense at the same merchant (accent/case-insensitive)", () => {
    const hist = [
      tx({ date: "2026-08-01", amount: 5, category: "Eating out", subcategory: "Coffee", merchant: "Café Olé" }),
      tx({ date: "2026-09-01", amount: 5, category: "Groceries", subcategory: "Bakery", merchant: "cafe ole" }),
    ];
    expect(suggestFromHistory(hist, "CAFÉ OLÉ")).toMatchObject({ category: "Groceries", subcategory: "Bakery" });
    expect(suggestFromHistory(hist, "x")).toBeNull();
  });

  it("produces over-budget and deficit insights", () => {
    const ds = dataset(
      [tx({ date: "2026-09-02", amount: 900, category: "Groceries" })],
      { budgets: [{ month: "default", category: "Groceries", amount: 500 }], incomes: [{ month: "default", gross: 0, net: 800, note: "" }] },
    );
    const keys = localInsights(ds, "2026-09", "2026-09-20").map((i) => i.key);
    expect(keys).toContain("over");
    expect(keys).toContain("deficit");
  });
});

describe("recentAverages", () => {
  it("shows overspending as a negative saving, over the months it averaged", () => {
    const ds = dataset(
      [tx({ date: "2026-08-10", amount: 5000, category: "Groceries" }), tx({ date: "2026-09-10", amount: 4000, category: "Groceries" })],
      { incomes: [{ month: "default", gross: 0, net: 4000, note: "" }] },
    );
    expect(recentAverages(ds, "2026-10")).toMatchObject({ saved: -500, income: 4000, spent: 4500, from: "2026-08", to: "2026-09", missingIncome: false });
  });

  it("flags months without income", () => {
    const ds = dataset([tx({ date: "2026-08-10", amount: 100, category: "Groceries" }), tx({ date: "2026-09-10", amount: 100, category: "Groceries" })], {
      incomes: [{ month: "2026-09", gross: 0, net: 3000, note: "" }],
    });
    expect(recentAverages(ds, "2026-10")).toMatchObject({ income: 1500, missingIncome: true });
  });
});

describe("reducer", () => {
  it("renames categories everywhere", () => {
    const ds = dataset([tx({ date: "2026-09-01", amount: 1, category: "Groceries" })], {
      budgets: [{ month: "default", category: "Groceries", amount: 10 }],
    });
    const cats = ds.categories.map((c) => (c.name === "Groceries" ? { ...c, name: "Food" } : c));
    const next = applyMutationToDataset(ds, { op: "saveCategories", categories: cats, renames: [{ from: "Groceries", to: "Food" }] });
    expect(next.transactions[0].category).toBe("Food");
    expect(next.budgets[0].category).toBe("Food");
  });

  it("adds several expenses and replaces a split purchase's parts", () => {
    const ds = dataset([tx({ id: "a", date: "2026-09-01", amount: 5, category: "Groceries", group: "g1" }), tx({ id: "b", date: "2026-09-01", amount: 7, category: "Home", group: "g1" })]);
    const added = applyMutationToDataset(ds, { op: "addTransactions", txs: [tx({ id: "c", date: "2026-09-02", amount: 1, category: "Fees" }), tx({ id: "d", date: "2026-09-03", amount: 2, category: "Fees" })] });
    expect(added.transactions.map((t) => t.id)).toEqual(["d", "c", "a", "b"]);
    const regrouped = applyMutationToDataset(ds, { op: "saveTransactionGroup", group: "g1", txs: [tx({ id: "a", date: "2026-09-01", amount: 12, category: "Groceries", group: "" })] });
    expect(regrouped.transactions.map((t) => [t.id, t.amount, t.group])).toEqual([["a", 12, ""]]);
    expect(applyMutationToDataset(ds, { op: "deleteTransactionGroup", group: "g1" }).transactions).toEqual([]);
  });

  it("renames subcategories only within their category", () => {
    const ds = dataset([
      tx({ date: "2026-09-01", amount: 1, category: "Moradia", subcategory: "Aluguel" }),
      tx({ date: "2026-09-02", amount: 1, category: "Outros", subcategory: "Aluguel" }),
    ]);
    const next = applyMutationToDataset(ds, {
      op: "saveCategories",
      categories: ds.categories,
      renames: [{ from: "Moradia", to: "Housing" }],
      subRenames: [{ category: "Moradia", from: "Aluguel", to: "Rent" }],
    });
    expect(next.transactions.map((t) => [t.category, t.subcategory])).toEqual([
      ["Housing", "Rent"],
      ["Outros", "Aluguel"],
    ]);
    const withBill = applyMutationToDataset(
      { ...ds, subscriptions: [{ id: "s", name: "Aluguel", category: "Moradia", amount: 1, cycle: "monthly", billingDay: 1, payment: "", status: "active", trialEnd: "", worthIt: "yes", notes: "", nextCharge: "", kind: "bill", subcategory: "Aluguel", merchant: "" }] },
      { op: "saveCategories", categories: ds.categories, renames: [{ from: "Moradia", to: "Housing" }], subRenames: [{ category: "Moradia", from: "Aluguel", to: "Rent" }] },
    );
    expect(withBill.subscriptions.map((s) => [s.category, s.subcategory])).toEqual([["Housing", "Rent"]]);
  });

  it("renames a payment method on expenses and recurring payments", () => {
    const base = dataset([tx({ date: "2026-09-01", amount: 1, category: "A", payment: "Crédito" }), tx({ date: "2026-09-02", amount: 1, category: "A", payment: "Pix" })]);
    const ds = {
      ...base,
      subscriptions: [{ id: "s", name: "Netflix", category: "A", amount: 1, cycle: "monthly" as const, billingDay: 1, payment: "Crédito", status: "active" as const, trialEnd: "", worthIt: "yes" as const, notes: "", nextCharge: "", kind: "subscription" as const, subcategory: "", merchant: "" }],
    };
    const settings = { ...ds.settings, paymentMethods: ["Credit", "Pix"] };
    const next = applyMutationToDataset(ds, { op: "saveSettings", settings, paymentRenames: [{ from: "Crédito", to: "Credit" }] });
    expect(next.transactions.map((t) => t.payment)).toEqual(["Credit", "Pix"]);
    expect(next.subscriptions[0].payment).toBe("Credit");
    expect(next.settings.paymentMethods).toEqual(["Credit", "Pix"]);
  });

  it("replaces only the edited month's budget lines", () => {
    const ds = dataset([], { budgets: [{ month: "default", category: "A", amount: 1 }, { month: "2026-09", category: "A", amount: 2 }] });
    const next = applyMutationToDataset(ds, {
      op: "saveBudget",
      month: "2026-09",
      lines: [{ month: "2026-09", category: "B", amount: 3 }],
      income: { month: "2026-09", gross: 1, net: 1, note: "" },
    });
    expect(next.budgets).toEqual([{ month: "default", category: "A", amount: 1 }, { month: "2026-09", category: "B", amount: 3 }]);
    expect(next.incomes).toHaveLength(1);
  });
});

describe("demo data", () => {
  it("is deterministic and spans six months up to today", () => {
    const a = buildDemoDataset("pt", "2026-09-25");
    const b = buildDemoDataset("pt", "2026-09-25");
    expect(a.transactions.length).toBe(b.transactions.length);
    expect(a.transactions.length).toBeGreaterThan(150);
    expect(a.transactions.every((t) => t.date <= "2026-09-25" && t.date >= "2026-04-01")).toBe(true);
    expect(a.categories[0].name).toBe("Moradia");
    expect(buildDemoDataset("fr", "2026-09-25").categories[0].name).toBe("Logement");
  });
});

describe("month review", () => {
  it("reviews a month against the plan", () => {
    const ds = dataset(
      [
        tx({ date: "2026-08-03", amount: 700, category: "Groceries" }),
        tx({ date: "2026-08-05", amount: 100, category: "Leisure" }),
        tx({ date: "2026-08-06", amount: 50, category: "Gifts" }),
        tx({ date: "2026-07-06", amount: 425, category: "Groceries" }),
      ],
      { budgets: [{ month: "default", category: "Groceries", amount: 600 }, { month: "default", category: "Leisure", amount: 300 }] },
    );
    const r = monthReview(ds, "2026-08", "2026-09-28");
    expect(r).toMatchObject({ spent: 850, planned: 900, diff: 50, unplanned: 50, change: 1 });
    expect(r.over).toEqual([{ name: "Groceries", spent: 700, budget: 600, amount: 100 }]);
    expect(r.under).toEqual([{ name: "Leisure", spent: 100, budget: 300, amount: 200 }]);
  });

  it("suggests what to change from patterns across the last months", () => {
    const months = ["2026-06", "2026-07", "2026-08"];
    const ds = dataset(
      [
        // over the limit every month: the limit is unrealistic
        ...[650, 680, 700].map((amount, i) => tx({ date: `${months[i]}-03`, amount, category: "Groceries" })),
        // over once: a one-off
        ...[100, 100].map((amount, i) => tx({ date: `${months[i]}-05`, amount, category: "Leisure" })),
        tx({ date: "2026-08-05", amount: 330, category: "Leisure", description: "Concert" }),
        tx({ date: "2026-08-06", amount: 70, category: "Leisure" }),
        // barely touched
        ...[40, 50, 60].map((amount, i) => tx({ date: `${months[i]}-07`, amount, category: "Personal care" })),
        // no limit
        tx({ date: "2026-08-08", amount: 120, category: "Gifts" }),
      ],
      {
        budgets: [
          { month: "default", category: "Groceries", amount: 600 },
          { month: "default", category: "Leisure", amount: 300 },
          { month: "default", category: "Personal care", amount: 200 },
        ],
      },
    );
    const r = monthReview(ds, "2026-08", "2026-09-28");
    const byKind = Object.fromEntries(r.suggestions.map((s) => [s.kind, s]));
    expect(byKind.raiseLimit).toMatchObject({ category: "Groceries", months: 3, suggested: 680 });
    expect(byKind.overspent).toMatchObject({ category: "Leisure", over: 100, biggest: { description: "Concert" } });
    expect(byKind.lowerLimit).toMatchObject({ category: "Personal care", suggested: 60 });
    expect(byKind.unplanned).toMatchObject({ categories: ["Gifts"], spent: 120 });
    // problems first, then opportunities; with overspending there's no "well done"
    expect(r.suggestions.map((s) => s.kind)).toEqual(["raiseLimit", "overspent", "lowerLimit", "unplanned"]);
    expect(byKind.wellDone).toBeUndefined();
    // Leisure jumped against the two months before
    expect(r.movers.find((m) => m.name === "Leisure")).toMatchObject({ spent: 400, usual: 100, delta: 300 });
  });

  it("says well done on a calm month, and folds small categories into one row", () => {
    const names = ["Housing", "Utilities", "Groceries", "Eating out", "Transportation", "Health", "Personal care", "Gifts"];
    const ds = dataset(
      names.map((category, i) => tx({ date: "2026-08-03", amount: 100 - i * 10, category })),
      { budgets: [{ month: "default", category: "Housing", amount: 2000 }] },
    );
    const r = monthReview(ds, "2026-08", "2026-09-28");
    expect(r.suggestions.at(-1)).toMatchObject({ kind: "wellDone", under: 1480 });
    expect(r.categories).toHaveLength(7);
    expect(r.categories[6]).toMatchObject({ rest: true, spent: 70 });
  });
});

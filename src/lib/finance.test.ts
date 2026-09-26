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
  runway,
  subscriptionTotals,
  suggestBudget,
  suggestFromHistory,
  summarizeMonth,
  trend,
  yearMatrix,
} from "./finance";
import { applyMutationToDataset } from "./data/reducer";
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
      { id: "a", name: "A", category: "", amount: 10, cycle: "monthly", billingDay: 1, payment: "", status: "active", trialEnd: "", worthIt: "yes", notes: "" },
      { id: "b", name: "B", category: "", amount: 120, cycle: "annual", billingDay: 1, payment: "", status: "active", trialEnd: "", worthIt: "yes", notes: "" },
      { id: "c", name: "C", category: "", amount: 15, cycle: "monthly", billingDay: 1, payment: "", status: "trial", trialEnd: "", worthIt: "no", notes: "" },
      { id: "d", name: "D", category: "", amount: 99, cycle: "monthly", billingDay: 1, payment: "", status: "cancelled", trialEnd: "", worthIt: "no", notes: "" },
    ]);
    expect(totals.activeMonthly).toBe(20);
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

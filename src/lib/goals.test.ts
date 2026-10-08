import { describe, expect, it } from "vitest";
import {
  accountsMonthlyGrowth,
  checkInStatus,
  goalCurrent,
  goalPlanFor,
  goalSchedule,
  goalsWaitingFor,
  latestBalances,
  monthsToTarget,
  netWorth,
  accountsReserve,
  netWorthSeries,
  planGoal,
  projectBalance,
  requiredMonthly,
  savingsPlan,
} from "./goals";
import { defaultCategories, defaultSettings } from "./defaults";
import type { Account, BalanceSnapshot, Dataset, Goal, Transaction } from "./types";

const acct = (id: string, type: Account["type"] = "savings"): Account => ({ id, name: id, institution: "", type, color: "#000", archived: false, notes: "" });
const goal = (patch: Partial<Goal>): Goal => ({
  id: "g",
  name: "Car",
  icon: "Car",
  color: "#000",
  target: 10000,
  targetDate: "",
  accountIds: [],
  saved: 0,
  monthlyContribution: 0,
  annualReturn: 0,
  status: "active",
  order: 0,
  notes: "",
  createdAt: "",
  startMonth: "",
  afterGoalId: "",
  pausedMonths: [],
  ...patch,
});

describe("goal math", () => {
  it("counts months with no growth", () => {
    expect(monthsToTarget(1000, 10000, 1000, 0)).toBe(9);
    expect(monthsToTarget(1000, 10000, 999, 0)).toBe(10);
    expect(monthsToTarget(10000, 10000, 0, 0)).toBe(0);
    expect(monthsToTarget(0, 10000, 0, 0)).toBeNull();
  });

  it("is consistent with the projection when money grows", () => {
    const n = monthsToTarget(5000, 20000, 400, 5)!;
    const path = projectBalance(5000, 400, 5, n);
    expect(path[n]).toBeGreaterThanOrEqual(20000);
    expect(path[n - 1]).toBeLessThan(20000);
  });

  it("reaches a target from growth alone and gives up past 50 years", () => {
    expect(monthsToTarget(10000, 20000, 0, 7)).toBeGreaterThan(100);
    expect(monthsToTarget(100, 1_000_000, 1, 0)).toBeNull();
  });

  it("computes the monthly amount needed for a deadline", () => {
    expect(requiredMonthly(2000, 14000, 12, 0)).toBe(1000);
    const m = requiredMonthly(2000, 14000, 12, 6);
    expect(m).toBeLessThan(1000);
    expect(projectBalance(2000, m, 6, 12)[12]).toBeCloseTo(14000, 0);
  });

  it("plans a goal against its deadline", () => {
    const p = planGoal({ current: 2000, target: 14000, monthly: 1000, annualReturn: 0, targetDate: "2027-06-30" }, "2026-09-26");
    expect(p.months).toBe(12);
    expect(p.eta).toBe("2027-09");
    expect(p.monthsToDeadline).toBe(9);
    expect(p.onTrack).toBe(false);
    expect(p.requiredMonthly).toBeCloseTo(1333.33, 1);
    expect(p.progress).toBeCloseTo(2000 / 14000);
  });
});

describe("contribution schedules", () => {
  it("holds contributions back until the start month, while the money keeps growing", () => {
    const s = { start: "2027-01", paused: [] };
    // nothing in November or December; nine contributions from January
    expect(monthsToTarget(1000, 10000, 1000, 0, s, "2026-10")).toBe(11);
    expect(projectBalance(1000, 1000, 0, 4, s, "2026-10")).toEqual([1000, 1000, 1000, 2000, 3000]);
    expect(projectBalance(1200, 100, 12, 2, { start: "2026-10", paused: [11, 12] }, "2026-10")[2]).toBeCloseTo(1200 * 1.12 ** (2 / 12), 1);
  });

  it("skips paused months every year", () => {
    expect(monthsToTarget(0, 3000, 1000, 0, { start: "2026-10", paused: [12] }, "2026-10")).toBe(4);
    expect(monthsToTarget(0, 3000, 1000, 0, { start: null, paused: [] }, "2026-10")).toBeNull();
    const s = { start: "2027-03", paused: [12] };
    const n = monthsToTarget(5000, 20000, 400, 5, s, "2026-10")!;
    const path = projectBalance(5000, 400, 5, n, s, "2026-10");
    expect(path[n]).toBeGreaterThanOrEqual(20000);
    expect(path[n - 1]).toBeLessThan(20000);
  });

  it("asks more per month when fewer months contribute, and nothing helps without any", () => {
    // ten of the next twelve months contribute
    expect(requiredMonthly(0, 12000, 12, 0, { start: "2026-10", paused: [6, 7] }, "2026-10")).toBe(1200);
    const s = { start: "2027-02", paused: [12] };
    const m = requiredMonthly(2000, 14000, 18, 6, s, "2026-10");
    expect(projectBalance(2000, m, 6, 18, s, "2026-10")[18]).toBeCloseTo(14000, 0);
    expect(requiredMonthly(0, 12000, 3, 0, { start: "2027-06", paused: [] }, "2026-10")).toBe(Infinity);
    const p = planGoal({ current: 0, target: 12000, monthly: 1000, annualReturn: 0, targetDate: "2027-01-01", schedule: { start: "2027-06", paused: [] } }, "2026-10-07");
    expect(p.requiredMonthly).toBeNull();
    expect(p.onTrack).toBe(false);
    expect(p.eta).toBe("2028-05");
  });

  it("starts a goal the month after the one it waits for, down a chain", () => {
    const today = "2026-10-07";
    const car = goal({ id: "car", target: 10000, saved: 4000, monthlyContribution: 1000 });
    const home = goal({ id: "home", target: 2000, monthlyContribution: 1000, afterGoalId: "car", pausedMonths: [12] });
    const trip = goal({ id: "trip", target: 500, monthlyContribution: 100, afterGoalId: "home" });
    const ds = { accounts: [], balances: [], goals: [car, home, trip] };
    expect(goalPlanFor(ds, car, today).eta).toBe("2027-04");
    expect(goalSchedule(ds, home, today)).toEqual({ start: "2027-05", paused: [12] });
    expect(goalPlanFor(ds, home, today).eta).toBe("2027-06");
    expect(goalSchedule(ds, trip, today).start).toBe("2027-07");
    expect(goalsWaitingFor(ds.goals, "car")).toEqual(new Set(["home", "trip"]));

    const withCar = (c: Goal) => ({ ...ds, goals: [c, home, trip] });
    expect(goalSchedule(withCar({ ...car, status: "achieved" }), home, today).start).toBe("2026-10");
    expect(goalSchedule(withCar({ ...car, saved: 10000 }), home, today).start).toBe("2026-10");
    expect(goalSchedule(withCar({ ...car, status: "paused" }), home, today).start).toBeNull();
    expect(goalSchedule(withCar({ ...car, monthlyContribution: 0 }), home, today).start).toBeNull();
    expect(goalSchedule({ ...ds, goals: [home] }, home, today).start).toBe("2026-10"); // car deleted
    // two goals waiting for each other never start, rather than looping
    const loop = { ...ds, goals: [{ ...car, afterGoalId: "home" }, home] };
    expect(goalSchedule(loop, home, today).start).toBeNull();
  });

  it("starts from a month that hasn't come yet", () => {
    const ds = { accounts: [], balances: [], goals: [] };
    expect(goalSchedule(ds, goal({ startMonth: "2027-03" }), "2026-10-07").start).toBe("2027-03");
    expect(goalSchedule(ds, goal({ startMonth: "2026-01" }), "2026-10-07").start).toBe("2026-10");
  });
});

describe("accounts", () => {
  const accounts = [acct("neo"), acct("visa", "credit"), acct("tfsa", "investment")];
  const balances: BalanceSnapshot[] = [
    { accountId: "neo", date: "2026-07-01", balance: 5000 },
    { accountId: "neo", date: "2026-09-01", balance: 6000 },
    { accountId: "visa", date: "2026-09-01", balance: 800 },
    { accountId: "tfsa", date: "2026-08-01", balance: 10000 },
    { accountId: "neo", date: "2026-10-01", balance: 9999 }, // future — ignored
  ];
  const ds = { accounts, balances, settings: defaultSettings("en") };

  it("uses the latest balance on or before a date", () => {
    expect(latestBalances(balances, "2026-09-26").get("neo")?.balance).toBe(6000);
    expect(latestBalances(balances, "2026-08-15").get("neo")?.balance).toBe(5000);
  });

  it("subtracts credit card balances from net worth", () => {
    expect(netWorth(ds, "2026-09-26")).toEqual({ assets: 16000, debts: 800, total: 15200 });
  });

  it("uses the accounts as the runway reserve, once a balance exists", () => {
    expect(accountsReserve(ds, "2026-09-26")).toBe(15200);
    expect(accountsReserve({ accounts, balances: [] }, "2026-09-26")).toBeNull();
  });

  it("counts loans, mortgages and lines of credit as debts, and a home as an asset", () => {
    const more = {
      accounts: [...accounts, acct("home", "property"), acct("mortgage", "mortgage"), acct("car", "loan"), acct("loc", "lineOfCredit")],
      balances: [
        ...balances,
        { accountId: "home", date: "2026-09-01", balance: 450000 },
        { accountId: "mortgage", date: "2026-09-01", balance: 380000 },
        { accountId: "car", date: "2026-09-01", balance: 12000 },
        // typed as a negative by mistake: still what's owed
        { accountId: "loc", date: "2026-09-01", balance: -1500 },
      ],
    };
    expect(netWorth(more, "2026-09-26")).toEqual({ assets: 466000, debts: 394300, total: 71700 });
    // the runway lives on bank accounts and investments, less cards and lines of credit — not the house or its mortgage
    expect(accountsReserve(more, "2026-09-26")).toBe(15200 - 1500);
    expect(accountsReserve({ accounts: [acct("home", "property")], balances: [{ accountId: "home", date: "2026-09-01", balance: 450000 }] }, "2026-09-26")).toBeNull();
  });

  it("carries balances forward month by month", () => {
    const s = netWorthSeries(ds, "2026-09", 12);
    expect(s.map((p) => p.month)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(s.map((p) => p.total)).toEqual([5000, 15000, 15200]);
  });

  it("measures how fast linked accounts grow", () => {
    expect(accountsMonthlyGrowth(ds, ["neo"], 6, "2026-09-26")).toBeCloseTo(1000 / (62 / 30.44), 0);
    expect(accountsMonthlyGrowth(ds, ["tfsa"], 6, "2026-09-26")).toBeNull(); // one check-in only
  });

  it("sums linked accounts (never credit) or uses the manual amount", () => {
    expect(goalCurrent(ds, goal({ accountIds: ["neo", "tfsa", "visa"] }), "2026-09-26")).toBe(16000);
    expect(goalCurrent(ds, goal({ saved: 1234 }), "2026-09-26")).toBe(1234);
  });

  it("knows when a monthly check-in is due", () => {
    const settings = { ...defaultSettings("en"), checkInDay: 1 };
    const due = checkInStatus({ accounts, balances: balances.filter((b) => b.date < "2026-09-01"), settings }, "2026-09-26");
    expect(due.due).toBe(true);
    const done = checkInStatus({ accounts, balances, settings }, "2026-09-26");
    expect(done.due).toBe(false);
    expect(done.nextDate).toBe("2026-10-01");
    expect(checkInStatus({ accounts: [], balances: [], settings }, "2026-09-26").due).toBe(false);
  });
});

describe("savingsPlan", () => {
  const spend = (date: string, amount: number): Transaction => ({
    id: date, date, category: "Groceries", subcategory: "", description: "", amount, payment: "", type: "variable", priority: "important",
    merchant: "", recurring: false, notes: "", receiptUrl: "", createdAt: "", updatedAt: "", group: "", billId: "",
  });
  const ds = (extra: Partial<Dataset>): Dataset => ({
    transactions: [], categories: defaultCategories("en"), budgets: [], incomes: [], subscriptions: [], accounts: [], balances: [],
    goals: [goal({ id: "car", monthlyContribution: 1100, target: 30000 }), goal({ id: "home", monthlyContribution: 900, target: 50000 })],
    settings: defaultSettings("en"), meta: { source: "demo", syncedAt: "" }, ...extra,
  });

  it("weighs goals against planned savings, with what was actually saved alongside", () => {
    const plan = savingsPlan(
      ds({
        incomes: [{ month: "default", gross: 0, net: 4980, note: "" }],
        budgets: [{ month: "default", category: "Housing", amount: 2791 }],
        // overspent both months: 5985 spent on 4980 income
        transactions: [spend("2026-08-05", 5985), spend("2026-09-05", 5985)],
      }),
      "2026-10",
      "2026-10-02",
    );
    expect(plan).toMatchObject({ allocated: 2000, planned: { saved: 2189 }, basis: 2189, free: 189 });
    expect(plan.actual).toMatchObject({ saved: -1005, from: "2026-08", to: "2026-09" });
  });

  it("falls back on what was actually saved without a budget, and has nothing to go on without income", () => {
    const history = { incomes: [{ month: "default", gross: 0, net: 3000, note: "" }], transactions: [spend("2026-09-05", 2500)] };
    expect(savingsPlan(ds(history), "2026-10", "2026-10-02")).toMatchObject({ planned: null, basis: 500, free: -1500 });
    expect(savingsPlan(ds({}), "2026-10", "2026-10-02")).toMatchObject({ basis: null, free: null });
  });

  it("only counts the goals that get a contribution this month", () => {
    const goals = [
      goal({ id: "car", monthlyContribution: 1100, target: 30000 }),
      goal({ id: "home", monthlyContribution: 900, target: 50000, startMonth: "2027-01" }),
      goal({ id: "trip", monthlyContribution: 200, target: 3000, pausedMonths: [10] }),
      goal({ id: "boat", monthlyContribution: 300, target: 9000, afterGoalId: "car" }),
    ];
    const plan = savingsPlan(ds({ goals }), "2026-10", "2026-10-02");
    expect(plan.active.map((g) => g.id)).toEqual(["car"]);
    expect(plan.allocated).toBe(1100);
    expect(plan.waiting.map(({ goal: g, from, skipping }) => [g.id, from, skipping])).toEqual([
      ["home", "2027-01", false],
      ["trip", null, true],
      ["boat", "2029-03", false], // car: 28 contributions of 1,100 → Feb 2029,
    ]);
  });
});

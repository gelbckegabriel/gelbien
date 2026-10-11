import { describe, expect, it } from "vitest";
import { chargesBetween, dueBills } from "./bills";
import { defaultCategories, defaultSettings } from "./defaults";
import { expectedPace, suggestBudget, summarizeMonth } from "./finance";
import { netWorth } from "./goals";
import { balanceAt, commitments, commitmentsIn, extraPaymentLink, linkedPlanChanges, installmentTransactions, installmentsOwed, monthlyRate, paidSoFar, planSchedule, planStanding, yearlySplit } from "./plans";
import type { Dataset, Plan, Transaction } from "./types";
import { round2 } from "./utils";

const plan = (patch: Partial<Plan>): Plan => ({
  id: "p",
  kind: "mortgage",
  name: "Our home",
  category: "Housing",
  subcategory: "",
  merchant: "",
  payment: "Debit",
  price: 480000,
  downPayment: 96000,
  rate: 4.89,
  count: 300,
  amortization: "price",
  firstDate: "2026-11-01",
  extras: [],
  prepayments: [],
  rateChanges: [],
  accountId: "",
  countAsDebt: true,
  status: "active",
  notes: "",
  createdAt: "2026-10-10T00:00:00.000Z",
  ...patch,
});
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const interest = (p: Plan, currency = "") => sum(planSchedule(p, currency).map((s) => s.interest));
const base: Omit<Transaction, "id" | "date" | "amount" | "description" | "billId" | "group"> = {
  category: "Shopping", subcategory: "", payment: "Credit", type: "variable", priority: "important", merchant: "Apple", recurring: false,
  notes: "", receiptUrl: "", createdAt: "", updatedAt: "",
};

describe("loan schedules", () => {
  it("pays a fixed-payment loan off in its term, the down payment left out", () => {
    const s = planSchedule(plan({}));
    expect(s).toHaveLength(300);
    expect(s[0]).toMatchObject({ seq: 1, date: "2026-11-01", amount: 2220.28, interest: 1564.8 });
    expect(s[299].date).toBe("2051-10-01");
    expect(s[299].balance).toBe(0);
    expect(interest(plan({}))).toBeCloseTo(282085.37, -1);
  });

  it("compounds a Canadian mortgage twice a year", () => {
    expect(monthlyRate(plan({}), "CAD")).toBeLessThan(monthlyRate(plan({})));
    expect(planSchedule(plan({}), "CAD")[0].amount).toBeLessThan(2220.28);
    // not for a car loan
    expect(monthlyRate(plan({ kind: "carLoan" }), "CAD")).toBe(monthlyRate(plan({ kind: "carLoan" })));
  });

  it("shrinks decreasing payments (SAC) and charges less interest", () => {
    const s = planSchedule(plan({ amortization: "sac" }));
    expect(s).toHaveLength(300);
    expect(s[0].amount).toBe(2844.8);
    expect(s[0].principal).toBe(1280);
    expect(s[299].amount).toBeCloseTo(1285.22, 1);
    expect(interest(plan({ amortization: "sac" }))).toBeCloseTo(235502.4, -1);
  });

  it("finishes sooner with an extra every month, and with a one-time payment", () => {
    const extra = plan({ extras: [{ from: "2026-11", amount: 300 }] });
    expect(planSchedule(extra)).toHaveLength(239);
    expect(planSchedule(extra)[0].amount).toBe(2520.28);
    expect(interest(extra)).toBeCloseTo(217086.58, -1);
    const both = plan({ extras: [{ from: "2026-11", amount: 300 }], prepayments: [{ month: "2027-10", amount: 10000, mode: "shorten" }] });
    expect(planSchedule(both)).toHaveLength(229);
    expect(planSchedule(both).at(-1)!.date).toBe("2045-11-01");
    // an extra that starts later leaves the earlier payments alone
    const later = planSchedule(plan({ extras: [{ from: "2027-06", amount: 300 }] }));
    expect(later[0].amount).toBe(2220.28);
    expect(later.find((s) => s.date === "2027-06-01")!.amount).toBe(2520.28);
  });

  it("keeps the end date and lowers the payment when asked to", () => {
    const s = planSchedule(plan({ prepayments: [{ month: "2027-10", amount: 10000, mode: "lower" }] }));
    expect(s).toHaveLength(300);
    expect(s[11].balance).toBeCloseTo(365955.48, 0);
    expect(s[12].amount).toBeCloseTo(2161.23, 1);
  });

  it("takes a one-time payment made before the first payment straight off what's borrowed", () => {
    const shorten = planSchedule(plan({ prepayments: [{ month: "2026-10", amount: 84000, mode: "shorten" }] }));
    expect(shorten[0].amount).toBe(2220.28);
    expect(shorten.length).toBeLessThan(300);
    const lower = planSchedule(plan({ prepayments: [{ month: "2026-10", amount: 84000, mode: "lower" }] }));
    expect(lower).toHaveLength(300);
    expect(lower[0].amount).toBeCloseTo(planSchedule(plan({ downPayment: 180000 }))[0].amount, 2);
  });

  it("knows what's owed on a date", () => {
    expect(balanceAt(plan({}), "2026-10-31")).toBe(384000);
    expect(balanceAt(plan({}), "2026-11-01")).toBeCloseTo(384000 - (2220.28 - 1564.8), 1);
    expect(balanceAt(plan({}), "2052-01-01")).toBe(0);
  });

  it("takes an extra payment off what's owed as soon as it's made, not with that month's payment", () => {
    // made before the first payment
    const early = plan({ prepayments: [{ month: "2026-10", amount: 10000, mode: "shorten" }] });
    expect(balanceAt(early, "2026-09-30")).toBe(384000);
    expect(balanceAt(early, "2026-10-20")).toBe(374000);
    // made on 10 December, ahead of December's payment on the 15th: already off
    const mid = plan({ firstDate: "2026-11-15", prepayments: [{ month: "2026-12", amount: 5000, mode: "shorten" }] });
    const noExtra = plan({ firstDate: "2026-11-15" });
    expect(balanceAt(mid, "2026-12-10")).toBeCloseTo(balanceAt(noExtra, "2026-12-10") - 5000, 2);
    // with November's payment marked paid, the loan agrees
    const novPaid = { ...base, id: "n", date: "2026-11-15", amount: 2220.28, description: "Our home · 1/300", category: "Housing", billId: "p", group: "" };
    expect(planStanding(mid, { transactions: [novPaid] }, "2026-12-10").owed).toBeCloseTo(balanceAt(mid, "2026-12-10"), 2);
    // and once that payment is made the schedule has it, counted once
    expect(balanceAt(mid, "2026-12-20")).toBeCloseTo(balanceAt(noExtra, "2026-12-20") - 5000, 2);
    expect(balanceAt(mid, "2027-01-20")).toBeLessThan(balanceAt(noExtra, "2027-01-20") - 5000);
  });
});

describe("where the payments go", () => {
  it("splits each year into principal and interest, mostly interest at first", () => {
    const years = yearlySplit(planSchedule(plan({})));
    expect(years[0].year).toBe("2026");
    expect(years.at(-1)!.year).toBe("2051");
    expect(years.at(-1)!.balance).toBe(0);
    const first = years[1]; // 2027, a full year
    expect(first.interest).toBeGreaterThan(first.principal);
    expect(years.at(-2)!.principal).toBeGreaterThan(years.at(-2)!.interest);
    // it all adds up: principal is what was borrowed, interest the plan's interest
    expect(sum(years.map((y) => y.principal))).toBeCloseTo(384000, 1);
    expect(sum(years.map((y) => y.interest))).toBeCloseTo(interest(plan({})), 1);
  });

  it("adds up the payments made so far", () => {
    const schedule = planSchedule(plan({}));
    expect(paidSoFar(schedule, schedule.map(() => false))).toEqual({ principal: 0, interest: 0 });
    const two = paidSoFar(schedule, schedule.map((_, i) => i < 2));
    expect(two.principal).toBeCloseTo(schedule[0].principal + schedule[1].principal, 2);
    expect(two.interest).toBeCloseTo(schedule[0].interest + schedule[1].interest, 2);
  });
});

describe("installments", () => {
  const laptop = plan({ id: "mac", kind: "installments", name: "MacBook Air", price: 1299.99, downPayment: 0, rate: 0, count: 12, firstDate: "2026-10-10" });

  it("splits a purchase into equal parts, the last one taking the leftover cents", () => {
    const s = planSchedule(laptop);
    expect(s.map((p) => p.amount)).toEqual([...Array(11).fill(108.33), 108.36]);
    expect(sum(s.map((p) => p.amount))).toBeCloseTo(1299.99, 2);
    expect(s.at(-1)!.date).toBe("2027-09-10");
  });

  it("makes one labelled expense per month, linked to the plan", () => {
    let n = 0;
    const txs = installmentTransactions(laptop, base, () => `t${n++}`);
    expect(txs).toHaveLength(12);
    expect(txs[0]).toMatchObject({ id: "t0", date: "2026-10-10", amount: 108.33, description: "MacBook Air · 1/12", billId: "mac", category: "Shopping" });
    expect(txs[11]).toMatchObject({ date: "2027-09-10", amount: 108.36, description: "MacBook Air · 12/12" });
  });

  it("counts what's left as a debt, from the expenses (so deleting one counts)", () => {
    let n = 0;
    const txs = installmentTransactions(laptop, base, () => `t${n++}`);
    const ds = { plans: [laptop], transactions: txs, accounts: [], balances: [] };
    expect(installmentsOwed(ds, "2026-10-15")).toBeCloseTo(1299.99 - 108.33, 2);
    expect(netWorth(ds, "2026-10-15")).toEqual({ assets: 0, debts: 1191.66, total: -1191.66 });
    expect(installmentsOwed({ ...ds, transactions: txs.slice(0, 6) }, "2026-10-15")).toBeCloseTo(108.33 * 5, 2);
    expect(installmentsOwed({ ...ds, plans: [{ ...laptop, countAsDebt: false }] }, "2026-10-15")).toBe(0);
    expect(installmentsOwed(ds, "2026-10-01")).toBe(0); // not bought yet
    expect(planStanding(laptop, ds, "2026-12-20")).toMatchObject({ paid: 3, owed: 975.0, end: "2027-09", done: false });
  });
});

describe("loan payments as bills", () => {
  const car = plan({ id: "car", kind: "carLoan", name: "Car loan", price: 34000, downPayment: 6000, rate: 6.49, count: 60, firstDate: "2025-08-15", createdAt: "2026-09-02T00:00:00.000Z" });
  const ds = (p: Plan, transactions: Transaction[] = []) => ({ subscriptions: [], transactions, plans: [p], settings: defaultSettings("en") });

  it("shows payments from the month the loan was added, labelled with their number", () => {
    const charges = chargesBetween(ds(car), "2026-01-01", "2026-12-31");
    expect(charges.map((c) => c.date)).toEqual(["2026-09-15", "2026-10-15", "2026-11-15", "2026-12-15"]);
    expect(charges[1].sub).toMatchObject({ id: "car", name: "Car loan · 15/60", amount: 547.72, category: "Housing" });
    expect(charges[1].plan?.id).toBe("car");
  });

  it("asks \"was it paid?\" about each payment once due, until it's marked paid", () => {
    expect(dueBills(ds(car), "2026-10-14")).toEqual([]);
    expect(dueBills(ds(car), "2026-10-16").map((c) => c.date)).toEqual(["2026-10-15"]);
    const paid = { ...base, id: "x", date: "2026-10-15", amount: 547.72, description: "Car loan · 15/60", billId: "car", group: "" };
    expect(dueBills(ds(car, [paid]), "2026-10-16")).toEqual([]);
    // an extra payment logged that month doesn't stand in for the regular one
    const extra = { ...paid, id: "y", amount: 2000, description: "Car loan · extra payment", billId: extraPaymentLink("car") };
    expect(dueBills(ds(car, [extra]), "2026-10-16").map((c) => c.date)).toEqual(["2026-10-15"]);
    // skipped on this device: not asked again
    expect(dueBills(ds(car), "2026-10-16", new Set(["car|2026-10-15"]))).toEqual([]);
  });
});

describe("commitments", () => {
  it("adds up what the plans take each month, and when money frees up", () => {
    const car = plan({ id: "car", kind: "carLoan", price: 34000, downPayment: 6000, rate: 6.49, count: 60, firstDate: "2025-08-15" });
    const home = plan({ id: "home" });
    const phone = plan({ id: "phone", kind: "installments", price: 540, downPayment: 0, rate: 0, count: 12, firstDate: "2026-04-05" });
    let n = 0;
    const txs = installmentTransactions(phone, base, () => `t${n++}`);
    const c = commitments({ plans: [car, home, phone], transactions: txs, settings: defaultSettings("en") }, "2026-10-10");
    expect(c.thisMonth).toBeCloseTo(547.72 + 45, 2);
    // the default settings are Canadian: the mortgage compounds twice a year
    expect(c.change?.month).toBe("2026-11");
    expect(c.change?.total).toBeCloseTo(planSchedule(home, "CAD")[0].amount + 547.72 + 45, 2);
    expect(c.lines.map((l) => l.plan.id)).toEqual(["phone", "car", "home"]);
    expect(c.frees.map((f) => [f.plan.id, f.month, f.amount])).toEqual([
      ["phone", "2027-04", 45],
      ["car", "2030-08", 547.72],
    ]);
    expect(c.owed).toBeCloseTo(225 + balanceAt(car, "2026-10-10") + 384000, 2);
  });
});

describe("commitments in the budget", () => {
  const car = plan({ id: "car", kind: "carLoan", name: "Car loan", category: "Transportation", price: 34000, downPayment: 6000, rate: 6.49, count: 60, firstDate: "2025-08-15", createdAt: "2026-09-02T00:00:00.000Z" });
  const phone = plan({ id: "phone", kind: "installments", name: "Phone", category: "Shopping", price: 540, downPayment: 0, rate: 0, count: 12, firstDate: "2026-04-05" });
  let n = 0;
  const parts = installmentTransactions(phone, base, () => `p${n++}`);
  const loanPaid = { ...base, id: "l", date: "2026-10-15", amount: 547.72, description: "Car loan · 15/60", category: "Transportation", billId: "car", group: "", type: "fixed" as const };
  const bus = { ...base, id: "b", date: "2026-10-03", amount: 115, description: "Transit pass", category: "Transportation", billId: "", group: "" };
  const ds: Dataset = {
    transactions: [...parts, loanPaid, bus],
    categories: defaultCategories("en"),
    budgets: [
      { month: "default", category: "Transportation", amount: 200 },
      { month: "default", category: "Shopping", amount: 100 },
    ],
    incomes: [{ month: "default", gross: 6000, net: 4500, note: "" }],
    subscriptions: [],
    accounts: [],
    balances: [],
    goals: [],
    plans: [car, phone],
    settings: defaultSettings("en"),
    meta: { source: "demo", syncedAt: "" },
  };

  it("is a line of its own: due this month vs. paid, out of its categories' limits", () => {
    expect(commitmentsIn(ds, "2026-10")).toEqual({ planned: round2(547.72 + 45), paid: round2(547.72 + 45), extra: 0 });
    // before the loan was added, only the phone
    expect(commitmentsIn(ds, "2026-08").planned).toBe(45);
    const s = summarizeMonth(ds, "2026-10", "2026-10-20");
    const transport = s.byCategory.find((c) => c.name === "Transportation")!;
    expect(transport).toMatchObject({ spent: round2(115 + 547.72), committed: 547.72, own: 115, budget: 200, status: "within" });
    expect(s.byCategory.find((c) => c.name === "Shopping")).toMatchObject({ committed: 45, own: 0 });
    // planned spending: the limits plus what's committed — so goals see it too
    expect(s.budgetTotal).toBeCloseTo(300 + 547.72 + 45, 2);
    expect(s.commitments.planned).toBeCloseTo(592.72, 2);
  });

  it("counts an extra payment from the month's money as planned: decided, not overspent", () => {
    const extra = { ...loanPaid, id: "x", amount: 2000, description: "Car loan · extra payment", billId: extraPaymentLink("car") };
    const withExtra = { ...ds, transactions: [...ds.transactions, extra] };
    expect(commitmentsIn(withExtra, "2026-10")).toEqual({ planned: round2(547.72 + 45 + 2000), paid: round2(547.72 + 45 + 2000), extra: 2000 });
    const s = summarizeMonth(withExtra, "2026-10", "2026-10-20");
    // not against Transportation's limit, and in planned spending (so planned savings drop by it)
    expect(s.byCategory.find((c) => c.name === "Transportation")).toMatchObject({ own: 115, status: "within" });
    expect(s.budgetTotal).toBeCloseTo(300 + 547.72 + 45 + 2000, 2);
  });

  it("doesn't let a loan payment eat its category's share of the planned pace, or its suggested limit", () => {
    const pace = expectedPace(ds, "2026-10", { Transportation: 200, Shopping: 100 }, "2026-10-20");
    // the limits spread over the month, plus the plan payments on their days
    expect(pace.at(-1)).toBeCloseTo(300 + 547.72 + 45, 1);
    expect(suggestBudget(ds, "2026-11", 1)).toEqual({ Transportation: 120 });
  });
});

describe("extra payments and their expenses", () => {
  const car = plan({ id: "car", kind: "carLoan", name: "Car loan", price: 34000, downPayment: 6000, rate: 6.49, count: 60, firstDate: "2025-08-15", prepayments: [{ month: "2026-10", amount: 2000, mode: "lower" }] });
  const extra = { ...base, id: "x", date: "2026-10-10", amount: 2000, description: "Car loan · extra payment", billId: extraPaymentLink("car"), group: "" };
  const ds = { plans: [car], transactions: [extra] };

  it("takes the extra payment off the loan when its expense is deleted, and puts it back on undo", () => {
    const modes = new Map();
    const deleted = { ...ds, transactions: [] };
    const off = linkedPlanChanges(ds, deleted, modes);
    expect(off).toHaveLength(1);
    expect(off[0].plan.prepayments).toEqual([]);
    // the undo brings the expense back: the extra payment returns as it was (lowering the payment)
    const back = linkedPlanChanges({ ...deleted, plans: [off[0].plan] }, { transactions: [extra], plans: [off[0].plan] }, modes);
    expect(back[0].plan.prepayments).toEqual([{ month: "2026-10", amount: 2000, mode: "lower" }]);
  });

  it("follows an edit of the amount or the month", () => {
    const edited = { ...ds, transactions: [{ ...extra, amount: 1500, date: "2026-09-28" }] };
    expect(linkedPlanChanges(ds, edited, new Map())[0].plan.prepayments).toEqual([{ month: "2026-09", amount: 1500, mode: "lower" }]);
    // a different description changes nothing
    expect(linkedPlanChanges(ds, { ...ds, transactions: [{ ...extra, description: "Paid extra" }] }, new Map())).toEqual([]);
  });

  it("does nothing when the plan already has it (recorded together) or already lost it (taken off in the plan)", () => {
    expect(linkedPlanChanges({ ...ds, transactions: [] }, ds, new Map())).toEqual([]);
    const without = { ...car, prepayments: [] };
    expect(linkedPlanChanges({ plans: [without], transactions: [extra] }, { plans: [without], transactions: [] }, new Map())).toEqual([]);
  });
});

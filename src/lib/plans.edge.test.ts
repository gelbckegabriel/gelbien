import { describe, expect, it } from "vitest";
import { chargesBetween, dueBills, upcomingBills } from "./bills";
import { defaultSettings } from "./defaults";
import {
  balanceAt,
  commitments,
  commitmentsIn,
  installmentTransactions,
  linkedPaymentChanges,
  monthlyRate,
  owedOn,
  planSchedule,
  planStanding,
  type PlanPayment,
} from "./plans";
import type { Plan, RateChange, Transaction } from "./types";
import { newestFirst, round2 } from "./utils";

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
const tx = (patch: Partial<Transaction>): Transaction => ({
  id: "t",
  date: "2026-11-01",
  category: "Housing",
  subcategory: "",
  description: "",
  amount: 0,
  payment: "Debit",
  type: "fixed",
  priority: "essential",
  merchant: "",
  recurring: true,
  notes: "",
  receiptUrl: "",
  createdAt: "",
  updatedAt: "",
  group: "",
  billId: "p",
  ...patch,
});
const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
const endOf = (s: PlanPayment[]) => s.at(-1)!.date.slice(0, 7);
const at = (s: PlanPayment[], month: string) => s.find((p) => p.date.slice(0, 7) === month)!;
const rateChange = (from: string, rate: number, keep: RateChange["keep"] = "end"): RateChange => ({ from, rate, keep });

/** What every schedule must hold, whatever the plan */
function expectSound(p: Plan, currency = "") {
  const s = planSchedule(p, currency);
  const borrowed = p.kind === "installments" ? p.price : p.price - p.downPayment;
  const oneTime = sum(p.prepayments.map((x) => x.amount));
  // everything borrowed is paid back: by the payments' principal and the one-time payments (never more)
  expect(sum(s.map((x) => x.principal)) + oneTime).toBeGreaterThanOrEqual(borrowed - 0.05);
  expect(s.at(-1)!.balance).toBe(0);
  let owed = borrowed;
  for (const pay of s) {
    expect(pay.amount).toBeCloseTo(pay.interest + pay.principal, 2);
    expect(pay.principal).toBeGreaterThanOrEqual(0);
    expect(pay.balance).toBeLessThanOrEqual(owed + 0.005);
    owed = pay.balance;
  }
  return s;
}

describe("a new rate only changes the payments from then on", () => {
  const base = plan({});
  const renewed = plan({ rateChanges: [rateChange("2031-11", 6.5)] });

  it("leaves every earlier payment exactly as it was", () => {
    const a = planSchedule(base);
    const b = expectSound(renewed);
    const k = a.findIndex((p) => p.date.slice(0, 7) === "2031-11");
    expect(k).toBe(60);
    expect(b.slice(0, k)).toEqual(a.slice(0, k));
    expect(balanceAt(renewed, "2031-10-15")).toBe(balanceAt(base, "2031-10-15"));
  });

  it("keeps the end date by default: a higher rate, a higher payment", () => {
    const a = planSchedule(base);
    const b = planSchedule(renewed);
    expect(endOf(b)).toBe(endOf(a));
    expect(b).toHaveLength(a.length);
    expect(at(b, "2031-11").amount).toBeGreaterThan(at(a, "2031-11").amount);
    // and it's the payment that clears what's owed then in the payments left, at the new rate
    const owed = at(a, "2031-10").balance;
    const r = 6.5 / 1200;
    const left = 300 - 60;
    expect(at(b, "2031-11").amount).toBeCloseTo((owed * r) / (1 - (1 + r) ** -left), 1);
    expect(sum(b.map((p) => p.interest))).toBeGreaterThan(sum(a.map((p) => p.interest)));
  });

  it("can keep the payment instead: a higher rate ends later, a lower one sooner", () => {
    const a = planSchedule(base);
    const up = expectSound(plan({ rateChanges: [rateChange("2031-11", 5.5, "payment")] }));
    const down = expectSound(plan({ rateChanges: [rateChange("2031-11", 3.5, "payment")] }));
    expect(at(up, "2031-11").amount).toBeCloseTo(at(a, "2031-11").amount, 2);
    expect(at(down, "2031-11").amount).toBeCloseTo(at(a, "2031-11").amount, 2);
    expect(endOf(up) > endOf(a)).toBe(true);
    expect(endOf(down) < endOf(a)).toBe(true);
  });

  it("raises the payment when the old one wouldn't even cover the new interest", () => {
    const a = planSchedule(base);
    const huge = expectSound(plan({ rateChanges: [rateChange("2031-11", 12, "payment")] }));
    expect(at(huge, "2031-11").amount).toBeGreaterThan(at(a, "2031-11").amount);
    expect(endOf(huge)).toBe(endOf(a));
    expect(huge.length).toBeLessThan(1200);
  });

  it("works from before the first payment: as if the loan had that rate", () => {
    const early = planSchedule(plan({ rateChanges: [rateChange("2026-01", 5.2)] }));
    expect(early).toEqual(planSchedule(plan({ rate: 5.2 })));
  });

  it("does nothing after the loan is paid off, and the latest of several changes wins", () => {
    expect(planSchedule(plan({ rateChanges: [rateChange("2060-01", 9)] }))).toEqual(planSchedule(base));
    const two = expectSound(plan({ rateChanges: [rateChange("2031-11", 6.5), rateChange("2036-11", 3)] }));
    const one = planSchedule(renewed);
    const k = two.findIndex((p) => p.date.slice(0, 7) === "2036-11");
    expect(two.slice(0, k)).toEqual(one.slice(0, k));
    expect(at(two, "2036-11").amount).toBeLessThan(at(one, "2036-11").amount);
    expect(endOf(two)).toBe(endOf(one));
    // listed in any order: same schedule
    expect(planSchedule(plan({ rateChanges: [rateChange("2036-11", 3), rateChange("2031-11", 6.5)] }))).toEqual(two);
  });

  it("drops to 0% cleanly", () => {
    const free = expectSound(plan({ rateChanges: [rateChange("2031-11", 0)] }));
    expect(at(free, "2031-11").interest).toBe(0);
    expect(endOf(free)).toBe(endOf(planSchedule(base)));
  });

  it("with decreasing payments (SAC), pays the same part of the debt: only the interest moves", () => {
    const a = planSchedule(plan({ amortization: "sac" }));
    const b = expectSound(plan({ amortization: "sac", rateChanges: [rateChange("2031-11", 6.5, "payment")] }));
    expect(at(b, "2031-11").principal).toBeCloseTo(at(a, "2031-11").principal, 2);
    expect(at(b, "2031-11").interest).toBeGreaterThan(at(a, "2031-11").interest);
    expect(endOf(b)).toBe(endOf(a));
  });

  it("compounds a Canadian mortgage's new rate twice a year too", () => {
    const cad = planSchedule(plan({ rateChanges: [rateChange("2031-11", 6.5)] }), "CAD");
    const owed = at(planSchedule(base, "CAD"), "2031-10").balance;
    const r = monthlyRate({ kind: "mortgage", rate: 6.5 }, "CAD");
    expect(at(cad, "2031-11").interest).toBeCloseTo(owed * r, 1);
  });

  it("keeps the sooner end a one-time payment brought, instead of stretching back to the term", () => {
    const shortened = plan({ prepayments: [{ month: "2028-11", amount: 50000, mode: "shorten" }] });
    const before = planSchedule(shortened);
    const renewedAfter = expectSound({ ...shortened, rateChanges: [rateChange("2031-11", 6.5)] });
    expect(endOf(renewedAfter)).toBe(endOf(before));
    expect(endOf(before) < endOf(planSchedule(base))).toBe(true);
  });

  it("works alongside an extra every month and a one-time payment in the same month", () => {
    const busy = plan({
      extras: [{ from: "2027-01", amount: 300 }],
      prepayments: [{ month: "2031-11", amount: 20000, mode: "lower" }],
      rateChanges: [rateChange("2031-11", 6.5)],
    });
    const s = expectSound(busy);
    // the rate applies to the November payment, the one-time payment comes off right after it
    expect(at(s, "2031-11").balance).toBeLessThan(at(s, "2031-10").balance - 20000);
  });
});

describe("one-time payments and extras, at the edges", () => {
  it("pays the loan off when the one-time payment is more than what's owed", () => {
    // added once it was all paid: every payment before then happened
    const p = plan({ price: 30000, downPayment: 0, count: 60, prepayments: [{ month: "2027-06", amount: 999999, mode: "shorten" }], createdAt: "2027-07-01T00:00:00.000Z" });
    const s = expectSound(p);
    expect(endOf(s)).toBe("2027-06");
    expect(balanceAt(p, "2027-06-15")).toBe(0);
    expect(planStanding(p, { transactions: [] }, "2027-07-01").done).toBe(true);
  });

  it("adds up several one-time payments in one month", () => {
    const one = planSchedule(plan({ prepayments: [{ month: "2027-06", amount: 10000, mode: "shorten" }] }));
    const two = planSchedule(plan({ prepayments: [{ month: "2027-06", amount: 4000, mode: "shorten" }, { month: "2027-06", amount: 6000, mode: "shorten" }] }));
    expect(at(two, "2027-06").balance).toBeCloseTo(at(one, "2027-06").balance, 2);
  });

  it("keeps the end date with 'pay less' even after an earlier 'finish sooner'", () => {
    const shortened = plan({ prepayments: [{ month: "2028-11", amount: 50000, mode: "shorten" }] });
    const both = expectSound(plan({ prepayments: [...shortened.prepayments, { month: "2030-11", amount: 20000, mode: "lower" }] }));
    expect(endOf(both)).toBe(endOf(planSchedule(shortened)));
    expect(at(both, "2030-12").amount).toBeLessThan(at(planSchedule(shortened), "2030-12").amount);
  });

  it("stops an extra with a change to 0, and applies one set before the first payment from the first", () => {
    const s = expectSound(plan({ extras: [{ from: "2020-01", amount: 300 }, { from: "2027-06", amount: 0 }] }));
    const plain = planSchedule(plan({}));
    expect(s[0].amount).toBeCloseTo(plain[0].amount + 300, 2);
    expect(at(s, "2027-06").amount).toBeCloseTo(at(plain, "2027-06").amount, 2);
  });

  it("ends with a smaller last payment when an extra covers more than what's left", () => {
    const s = expectSound(plan({ price: 5000, downPayment: 0, rate: 6, count: 12, extras: [{ from: "2026-11", amount: 2000 }] }));
    expect(s.length).toBeLessThan(12);
    expect(s.at(-1)!.amount).toBeLessThan(s[0].amount);
  });

  it("keeps the payment day inside short months, leap years included", () => {
    const s = planSchedule(plan({ firstDate: "2027-12-31", count: 3, price: 3000, downPayment: 0, rate: 0 }));
    expect(s.map((p) => p.date)).toEqual(["2027-12-31", "2028-01-31", "2028-02-29"]);
  });

  it("handles one payment, and no interest with cents to spare", () => {
    expect(planSchedule(plan({ count: 1, price: 1000, downPayment: 0, rate: 5 }))).toHaveLength(1);
    const s = expectSound(plan({ count: 3, price: 100, downPayment: 0, rate: 0 }));
    expect(s.map((p) => p.amount)).toEqual([33.33, 33.33, 33.34]);
  });

  it("ignores a plan with nothing to pay back or a bad date", () => {
    expect(planSchedule(plan({ price: 1000, downPayment: 1000 }))).toEqual([]);
    expect(planSchedule(plan({ firstDate: "" }))).toEqual([]);
  });
});

describe("logged payments follow a corrected plan, not a later change", () => {
  // a 2,000 a month loan, its first payment logged at that figure
  const two = plan({ id: "m", kind: "mortgage", name: "Home", price: 480000, downPayment: 0, rate: 0, count: 240, firstDate: "2026-10-01", createdAt: "2026-10-01T00:00:00.000Z" });
  const logged = tx({ id: "a", billId: "m", date: "2026-10-01", amount: 2000, description: "Home · 1/240" });
  const ds = (p: Plan, txs: Transaction[] = [logged]) => ({ plans: [p], transactions: txs });

  it("updates a payment logged at the old figure when the loan is corrected (2,000 → 3,000 a month)", () => {
    const three = { ...two, price: 3000 * 160, count: 160 };
    const fixes = linkedPaymentChanges(ds(two), ds(three), "", "2026-10-10T00:00:00.000Z");
    expect(fixes).toHaveLength(1);
    expect(fixes[0].tx).toMatchObject({ id: "a", amount: 3000, description: "Home · 1/160", updatedAt: "2026-10-10T00:00:00.000Z" });
  });

  it("leaves it when the change starts later (an extra from next month, a new rate)", () => {
    expect(linkedPaymentChanges(ds(two), ds({ ...two, extras: [{ from: "2026-11", amount: 1000 }] }))).toEqual([]);
    const withRate = { ...two, rate: 4 };
    const logged4 = tx({ id: "a", billId: "m", date: "2026-10-01", amount: planSchedule(withRate)[0].amount, description: "Home · 1/240" });
    expect(linkedPaymentChanges(ds(withRate, [logged4]), ds({ ...withRate, rateChanges: [rateChange("2026-11", 6)] }, [logged4]))).toEqual([]);
  });

  it("keeps an amount typed in by hand (what the bank actually took)", () => {
    const typed = { ...logged, amount: 2000.37 };
    const fixes = linkedPaymentChanges(ds(two, [typed]), ds({ ...two, price: 3000 * 160, count: 160 }, [typed]));
    expect(fixes[0].tx.amount).toBe(2000.37);
    expect(fixes[0].tx.description).toBe("Home · 1/160");
  });

  it("follows a rename and a new category; leaves a description written by hand", () => {
    const renamed = { ...two, name: "Our home", category: "Mortgage" };
    expect(linkedPaymentChanges(ds(two), ds(renamed))[0].tx).toMatchObject({ amount: 2000, description: "Our home · 1/240", category: "Mortgage" });
    const own = { ...logged, description: "October mortgage" };
    expect(linkedPaymentChanges(ds(two, [own]), ds({ ...two, name: "Our home" }, [own]))).toEqual([]);
  });

  it("finds a payment logged a few days early by its label", () => {
    const early = { ...logged, date: "2026-09-28" };
    expect(linkedPaymentChanges(ds(two, [early]), ds({ ...two, price: 3000 * 160, count: 160 }, [early]))[0].tx.amount).toBe(3000);
  });

  it("does nothing for installments, unchanged plans or new ones", () => {
    const inst = plan({ id: "i", kind: "installments", price: 1200, downPayment: 0, rate: 0, count: 12 });
    expect(linkedPaymentChanges({ plans: [inst], transactions: [] }, { plans: [{ ...inst, name: "x" }], transactions: [] })).toEqual([]);
    const same = ds(two);
    expect(linkedPaymentChanges(same, same)).toEqual([]);
    expect(linkedPaymentChanges({ plans: [], transactions: [logged] }, ds(two))).toEqual([]);
  });
});

describe("installments, bills and commitments at the edges", () => {
  const base = { category: "Shopping", subcategory: "", payment: "Credit", type: "variable" as const, priority: "important" as const, merchant: "", recurring: false, notes: "", receiptUrl: "", createdAt: "", updatedAt: "" };

  it("splits evenly when it divides, and keeps the leftover cents on the last part otherwise", () => {
    const even = planSchedule(plan({ kind: "installments", price: 1200, downPayment: 0, rate: 0, count: 12 }));
    expect(new Set(even.map((p) => p.amount))).toEqual(new Set([100]));
    const odd = planSchedule(plan({ kind: "installments", price: 1000, downPayment: 0, rate: 0, count: 3 }));
    expect(odd.map((p) => p.amount)).toEqual([333.33, 333.33, 333.34]);
  });

  it("counts installments by their expenses: one deleted is one less to pay; cancelled, nothing", () => {
    const inst = plan({ id: "i", kind: "installments", price: 1200, downPayment: 0, rate: 0, count: 12, firstDate: "2026-10-05" });
    let n = 0;
    const parts = installmentTransactions(inst, base, () => `i${n++}`);
    const ds = { transactions: parts.filter((t) => t.id !== "i5") };
    expect(planStanding(inst, ds, "2026-10-20")).toMatchObject({ paid: 1, owed: 1000 });
    expect(planStanding({ ...inst, status: "cancelled" }, ds, "2026-10-20")).toMatchObject({ owed: 0, done: true });
    expect(commitmentsIn({ plans: [inst], transactions: parts }, "2027-02").planned).toBe(100);
  });

  it("bills a loan from the month it was added, labels payments with the count after a sooner end, and stops when cancelled", () => {
    const loan = plan({ id: "c", kind: "carLoan", name: "Car", price: 30000, downPayment: 0, rate: 6, count: 60, firstDate: "2025-01-15", createdAt: "2026-10-03T00:00:00.000Z", prepayments: [{ month: "2025-06", amount: 5000, mode: "shorten" }] });
    const ds = (p: Plan) => ({ subscriptions: [], transactions: [], plans: [p], settings: defaultSettings("en") });
    const charges = chargesBetween(ds(loan), "2026-01-01", "2026-12-31");
    expect(charges[0].date).toBe("2026-10-15");
    expect(charges[0].sub.name).toBe(`Car · 22/${planSchedule(loan).length}`);
    expect(planSchedule(loan).length).toBeLessThan(60);
    expect(dueBills(ds(loan), "2026-10-20").map((c) => c.date)).toEqual(["2026-10-15"]);
    expect(chargesBetween(ds({ ...loan, status: "cancelled" }), "2026-01-01", "2026-12-31")).toEqual([]);
    expect(commitments({ plans: [{ ...loan, status: "cancelled" }], transactions: [] }, "2026-10-20").lines).toEqual([]);
  });

  it("shows a loan starting next month by its first payment, and the month it starts as the change", () => {
    const later = plan({ id: "l", firstDate: "2026-11-01" });
    const c = commitments({ plans: [later], transactions: [], settings: defaultSettings("en") }, "2026-10-10");
    expect(c.thisMonth).toBe(0);
    expect(c.lines[0].monthly).toBeCloseTo(planSchedule(later, "CAD")[0].amount, 2);
    expect(c.change?.month).toBe("2026-11");
  });
});

describe("expense order", () => {
  it("puts the newest day first, and within a day the one added last", () => {
    const xs = [
      { id: "a", date: "2026-10-01", createdAt: "2026-10-01T09:00:00Z" },
      { id: "b", date: "2026-10-02", createdAt: "2026-10-02T08:00:00Z" },
      { id: "c", date: "2026-10-02", createdAt: "2026-10-02T18:00:00Z" },
    ];
    expect([...xs].sort(newestFirst).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });
});

describe("hundreds of random loans", () => {
  // a fixed seed: the same loans every run
  let seed = 20261010;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const month = (y0: number, spanYears: number) => {
    const n = Math.floor(rand() * spanYears * 12);
    return `${y0 + Math.floor(n / 12)}-${String((n % 12) + 1).padStart(2, "0")}`;
  };

  it("always pay back what was borrowed, keep earlier payments when the rate changes, and owe less over time", () => {
    for (let i = 0; i < 400; i++) {
      const price = Math.round(1000 + rand() * 900000);
      const p = plan({
        kind: pick(["mortgage", "carLoan", "personalLoan", "studentLoan", "other"]),
        price,
        downPayment: Math.round(rand() * 0.3 * price),
        rate: pick([0, 0.9, 2.5, 4.89, 6.49, 9.99, 19.99]),
        count: pick([1, 6, 12, 36, 60, 120, 300, 360]),
        amortization: pick(["price", "price", "sac"]),
        firstDate: `${month(2020, 6)}-${String(1 + Math.floor(rand() * 31)).padStart(2, "0")}`.replace(/-(29|30|31)$/, "-28"),
        extras: rand() < 0.4 ? [{ from: month(2020, 10), amount: Math.round(rand() * 800) }] : [],
        prepayments: rand() < 0.4 ? [{ month: month(2020, 10), amount: Math.round(rand() * price * 0.3), mode: pick(["shorten", "lower"]) }] : [],
      });
      const currency = pick(["CAD", "BRL", ""]);
      const changes = Array.from({ length: Math.floor(rand() * 3) }, () => rateChange(month(2021, 12), pick([0, 1.5, 3.9, 5.25, 8, 25]), pick(["end", "payment"])));
      const changed = { ...p, rateChanges: changes };
      const plain = planSchedule(p, currency);
      const s = planSchedule(changed, currency);
      if (!plain.length) continue;
      expect(s.length).toBeLessThanOrEqual(1200);
      expect(s.at(-1)!.balance).toBe(0);
      for (const pay of s) {
        expect(pay.principal).toBeGreaterThanOrEqual(0);
        expect(pay.amount).toBeCloseTo(pay.interest + pay.principal, 2);
      }
      // before the first change, nothing moved
      const first = [...changes].sort((a, b) => (a.from < b.from ? -1 : 1))[0]?.from;
      const k = first ? plain.findIndex((x) => x.date.slice(0, 7) >= first) : plain.length;
      expect(s.slice(0, k < 0 ? plain.length : k)).toEqual(plain.slice(0, k < 0 ? plain.length : k));
      // what's owed only goes down, month after month, and never below zero
      let owed = Infinity;
      for (let m = 0; m < s.length + 2; m += 7) {
        const d = `${s[0].date.slice(0, 7)}-28`;
        const asOf = `${new Date(Date.parse(d) + m * 30.44 * 86400000).toISOString().slice(0, 10)}`;
        const b = balanceAt(changed, asOf, currency);
        expect(b).toBeGreaterThanOrEqual(0);
        expect(b).toBeLessThanOrEqual(owed + 0.01);
        owed = b;
      }
    }
  });
});

describe("a rate the payment only just covers", () => {
  it("raises the payment rather than stretching the loan past a hundred years", () => {
    // the 2,220.28 payment against ~384,000 owed: around 6.93% it only just covers the interest
    let stretched = 0;
    for (let rate = 6.88; rate <= 6.96; rate += 0.002) {
      const s = planSchedule(plan({ rateChanges: [rateChange("2026-12", round2(rate * 1000) / 1000, "payment")] }));
      expect(s.length).toBeLessThanOrEqual(1200);
      expect(s.at(-1)!.balance).toBe(0);
      if (s.length > 900) stretched++;
    }
    // some of them do keep the payment and end very late, the rest raise it
    expect(stretched).toBeGreaterThan(0);
  });
});

describe("a loan's progress follows the payments marked paid", () => {
  // a new mortgage, its first payment on 1 November, added on 10 October
  const home = plan({ id: "h", name: "Our home", merchant: "RBC", firstDate: "2026-11-01", createdAt: "2026-10-10T00:00:00.000Z" });
  const s = planSchedule(home);
  const logged = (patch: Partial<Transaction>) => tx({ id: patch.id ?? "x", billId: "h", amount: s[0].amount, description: "Our home · 1/300", ...patch });
  const standing = (txs: Transaction[], today: string) => planStanding(home, { transactions: txs }, today);

  it("counts a payment marked paid ahead of its date (from Upcoming bills)", () => {
    expect(standing([], "2026-10-12")).toMatchObject({ paid: 0, owed: 384000 });
    // logged on its date, 1 November, while it's still October
    const ahead = standing([logged({ date: "2026-11-01" })], "2026-10-12");
    expect(ahead.paid).toBe(1);
    expect(ahead.next?.seq).toBe(2);
    expect(ahead.owed).toBeCloseTo(s[0].balance, 2);
    // or dated the day it was marked
    expect(standing([logged({ date: "2026-10-12" })], "2026-10-12").paid).toBe(1);
    expect(commitments({ plans: [home], transactions: [logged({ date: "2026-11-01" })] }, "2026-10-12").lines[0].standing.paid).toBe(1);
  });

  it("agrees with \"were these paid?\": a payment dated the day it was paid ahead isn't asked about again", () => {
    const bills = (txs: Transaction[]) => ({ subscriptions: [], transactions: txs, plans: [home], settings: defaultSettings("en") });
    const early = [logged({ date: "2026-10-12" })];
    expect(dueBills(bills([]), "2026-11-05").map((c) => c.date)).toEqual(["2026-11-01"]);
    expect(dueBills(bills(early), "2026-11-05")).toEqual([]);
    expect(upcomingBills(bills(early), "2026-10-12").find((c) => c.date === "2026-11-01")?.paid?.id).toBe("x");
  });

  it("leaves a payment that's due but not marked paid as the next one (overdue), owing what it did", () => {
    const late = standing([], "2026-11-10");
    expect(late).toMatchObject({ paid: 0, owed: 384000 });
    expect(late.next?.date).toBe("2026-11-01");
    // marked paid late, a few days after: it counts
    expect(standing([logged({ date: "2026-11-09" })], "2026-11-10").paid).toBe(1);
  });

  it("counts the payments from before the loan was added, and doesn't count an old one twice", () => {
    const old = plan({ id: "o", firstDate: "2024-01-01", createdAt: "2026-10-10T00:00:00.000Z" });
    const so = planSchedule(old);
    const before = so.filter((p) => p.date < "2026-10-01").length;
    expect(planStanding(old, { transactions: [] }, "2026-10-12").paid).toBe(before);
    // one typed in for March 2025 (long before it was added) changes nothing
    expect(planStanding(old, { transactions: [tx({ billId: "o", date: "2025-03-01", amount: 100 })] }, "2026-10-12").paid).toBe(before);
    // October's, marked paid, does
    expect(planStanding(old, { transactions: [tx({ billId: "o", date: "2026-10-01", amount: so[before].amount })] }, "2026-10-12").paid).toBe(before + 1);
  });

  it("counts one typed in by hand that looks like it, but not an extra payment or another loan's", () => {
    const byHand = tx({ id: "m", billId: "", merchant: "RBC", category: "Housing", date: "2026-11-02", amount: s[0].amount, description: "mortgage" });
    expect(standing([byHand], "2026-11-05").paid).toBe(1);
    const extra = tx({ id: "e", billId: "h~extra", date: "2026-11-01", amount: 5000 });
    expect(standing([extra], "2026-11-05").paid).toBe(0);
    const other = tx({ id: "z", billId: "car", date: "2026-11-01", amount: s[0].amount });
    expect(standing([other], "2026-11-05").paid).toBe(0);
  });

  it("goes back when a payment's expense is deleted, and agrees with what's owed on a day", () => {
    const one = [logged({ date: "2026-11-01" })];
    expect(standing(one, "2026-11-05").paid).toBe(1);
    expect(standing([], "2026-11-05").paid).toBe(0);
    expect(owedOn(home, { transactions: one }, "2026-11-05", "2026-11-05")).toBeCloseTo(s[0].balance, 2);
    // an earlier day goes by the schedule
    expect(owedOn(home, { transactions: [] }, "2026-10-01", "2026-11-05")).toBe(384000);
  });

  it("doesn't count more payments than there are, and says it's done once all are marked paid", () => {
    const short = plan({ id: "s", price: 1200, downPayment: 0, rate: 0, count: 3, firstDate: "2026-11-01", createdAt: "2026-10-10T00:00:00.000Z" });
    const txs = ["2026-11-01", "2026-12-01", "2027-01-01", "2027-02-01"].map((date, i) => tx({ id: `p${i}`, billId: "s", date, amount: 400 }));
    expect(planStanding(short, { transactions: txs }, "2027-02-05")).toMatchObject({ paid: 3, owed: 0, done: true, next: null });
  });
});

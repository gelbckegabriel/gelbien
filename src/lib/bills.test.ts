import { describe, expect, it } from "vitest";
import { billDates, billTransaction, committedBills, dueBills, paidBy, upcomingBills } from "./bills";
import { defaultSettings } from "./defaults";
import type { Subscription, Transaction } from "./types";

const sub = (patch: Partial<Subscription>): Subscription => ({
  id: "s1",
  name: "Netflix",
  category: "Subscriptions",
  amount: 18.99,
  cycle: "monthly",
  billingDay: 18,
  payment: "Visa",
  status: "active",
  trialEnd: "",
  worthIt: "yes",
  notes: "",
  nextCharge: "",
  kind: "subscription",
  subcategory: "",
  ...patch,
});

const tx = (patch: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36).slice(2),
  date: "2026-09-18",
  category: "Subscriptions",
  subcategory: "",
  description: "",
  amount: 18.99,
  payment: "Visa",
  type: "fixed",
  priority: "superfluous",
  merchant: "",
  recurring: true,
  notes: "",
  receiptUrl: "",
  createdAt: "",
  updatedAt: "",
  group: "",
  billId: "",
  ...patch,
});

describe("billDates", () => {
  it("follows the billing day, clamped to short months", () => {
    expect(billDates(sub({ billingDay: 31 }), "2027-01-15", "2027-03-31")).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("steps longer cycles from the known next charge", () => {
    const yearly = sub({ cycle: "annual", billingDay: null, nextCharge: "2026-11-03" });
    expect(billDates(yearly, "2026-01-01", "2027-12-31")).toEqual(["2026-11-03", "2027-11-03"]);
    const quarterly = sub({ cycle: "quarterly", billingDay: null, nextCharge: "2026-10-10" });
    expect(billDates(quarterly, "2026-06-01", "2027-01-31")).toEqual(["2026-07-10", "2026-10-10", "2027-01-10"]);
  });

  it("returns nothing when the schedule is unknown or the bill isn't active", () => {
    expect(billDates(sub({ cycle: "annual", billingDay: 14 }), "2026-01-01", "2026-12-31")).toEqual([]);
    expect(billDates(sub({ status: "paused" }), "2026-09-01", "2026-09-30")).toEqual([]);
  });

  it("repeats weekly bills every 7 days from the anchor", () => {
    expect(billDates(sub({ cycle: "weekly", billingDay: null, nextCharge: "2026-09-02" }), "2026-09-10", "2026-09-30")).toEqual(["2026-09-16", "2026-09-23", "2026-09-30"]);
  });
});

describe("paid bills", () => {
  const netflix = sub({});

  it("counts a linked expense, or one logged by hand with the bill's name", () => {
    expect(paidBy(netflix, "2026-09-18", [tx({ billId: "s1", date: "2026-09-18" })])).toBeTruthy();
    expect(paidBy(netflix, "2026-09-18", [tx({ merchant: "Netflix.com", date: "2026-09-02" })])).toBeTruthy();
    expect(paidBy(netflix, "2026-09-18", [tx({ merchant: "Netflix", date: "2026-08-18" })])).toBeUndefined();
    expect(paidBy(netflix, "2026-09-18", [tx({ merchant: "Netflix", category: "Leisure" })])).toBeUndefined();
  });

  it("lists what's due, minus paid and skipped charges", () => {
    const subs = [netflix, sub({ id: "s2", name: "Spotify", billingDay: 5 }), sub({ id: "s3", name: "Gym", billingDay: 30 })];
    const ds = { subscriptions: subs, transactions: [tx({ merchant: "Spotify", date: "2026-09-05" })] };
    expect(dueBills(ds, "2026-09-28").map((c) => `${c.sub.name} ${c.date}`)).toEqual(["Netflix 2026-09-18"]);
    expect(dueBills(ds, "2026-09-28", new Set(["s1|2026-09-18"]))).toEqual([]);
    expect(upcomingBills(ds, "2026-09-28", 10).map((c) => `${c.sub.name} ${c.date}`)).toEqual(["Gym 2026-09-30", "Spotify 2026-10-05"]);
  });

  it("logs a paid bill like the last time it was paid", () => {
    const ds = { transactions: [tx({ merchant: "Netflix", subcategory: "Streaming", priority: "superfluous" })], settings: defaultSettings("en") };
    const logged = billTransaction({ sub: netflix, date: "2026-10-18" }, ds);
    expect(logged).toMatchObject({ date: "2026-10-18", amount: 18.99, billId: "s1", subcategory: "Streaming", priority: "superfluous", recurring: true });
    // the subcategory set on the bill itself wins
    expect(billTransaction({ sub: sub({ subcategory: "Video streaming" }), date: "2026-10-18" }, ds).subcategory).toBe("Video streaming");
  });
});

describe("due window", () => {
  it("covers this month and the last week across a month boundary", () => {
    const ds = { subscriptions: [sub({ billingDay: 30 })], transactions: [] };
    expect(dueBills(ds, "2026-10-02").map((c) => c.date)).toEqual(["2026-09-30"]);
    expect(dueBills(ds, "2026-10-20")).toEqual([]);
  });
});

describe("committed bills", () => {
  const subs = [
    sub({ id: "s1", name: "Netflix", billingDay: 18 }),
    sub({ id: "s2", name: "Spotify", billingDay: 5 }),
    sub({ id: "s3", name: "Rent", category: "Housing", amount: 1650, billingDay: 1 }),
    sub({ id: "s4", name: "Gym", billingDay: 30 }),
  ];
  // Spotify and Rent logged; Netflix charged on the 18th with nothing logged; Gym still to come
  const ds = { subscriptions: subs, transactions: [tx({ merchant: "Spotify", date: "2026-09-05" }), tx({ description: "Rent", category: "Housing", date: "2026-09-01" })] };

  it("counts this month's bills with nothing logged, whether still to come or charged but not logged", () => {
    expect(committedBills(ds, "2026-09", "2026-09-28").map((c) => c.sub.name)).toEqual(["Netflix", "Gym"]);
    expect(committedBills(ds, "2026-09", "2026-09-28", new Set(["s1|2026-09-18"])).map((c) => c.sub.name)).toEqual(["Gym"]);
  });

  it("counts a coming month in full, and nothing once a month is over", () => {
    expect(committedBills(ds, "2026-10", "2026-09-28").map((c) => c.sub.name)).toEqual(["Rent", "Spotify", "Netflix", "Gym"]);
    expect(committedBills(ds, "2026-08", "2026-09-28")).toEqual([]);
  });
});

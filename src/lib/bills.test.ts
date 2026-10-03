import { describe, expect, it } from "vitest";
import { billDates, billFromTransaction, billTransaction, committedBills, dueBills, monthCharges, paidBy, upcomingBills } from "./bills";
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
  merchant: "",
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

  it("picks the expense closest to the charge when more than one could cover it", () => {
    const rent = sub({ id: "r", name: "Rent", category: "Housing", billingDay: 1 });
    // September's rent, and October's paid a few days early (still in September)
    const sep = tx({ id: "sep", billId: "r", category: "Housing", date: "2026-09-01" });
    const oct = tx({ id: "oct", billId: "r", category: "Housing", date: "2026-09-27" });
    expect(paidBy(rent, "2026-09-01", [oct, sep])?.id).toBe("sep");
    expect(paidBy(rent, "2026-10-01", [sep, oct])?.id).toBe("oct");
  });

  it("also recognizes the bill's merchant on an expense typed by hand", () => {
    const phone = sub({ name: "Phone plan", category: "Utilities", merchant: "Koodo", billingDay: 11 });
    expect(paidBy(phone, "2026-09-11", [tx({ merchant: "koodo", category: "Utilities", date: "2026-09-10" })])).toBeTruthy();
    // the same merchant in another category is something else
    expect(paidBy(phone, "2026-09-11", [tx({ merchant: "Koodo", category: "Shopping", date: "2026-09-10" })])).toBeUndefined();
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

  it("logs the merchant set on the bill, else the last one's — not the bill's name", () => {
    const rent = sub({ id: "r", name: "Rent", category: "Housing", billingDay: 1 });
    const settings = defaultSettings("en");
    expect(billTransaction({ sub: rent, date: "2026-10-01" }, { transactions: [], settings })).toMatchObject({ merchant: "", description: "Rent" });
    const last = { transactions: [tx({ billId: "r", category: "Housing", merchant: "Boardwalk", description: "Rent" })], settings };
    expect(billTransaction({ sub: rent, date: "2026-10-01" }, last).merchant).toBe("Boardwalk");
    expect(billTransaction({ sub: { ...rent, merchant: "Bow River Apartments" }, date: "2026-10-01" }, last).merchant).toBe("Bow River Apartments");
  });

  it("dates a bill paid ahead of time on the day it was paid, when that still counts for the charge", () => {
    const ds = { transactions: [], settings: defaultSettings("en") };
    const gym = sub({ id: "g", name: "Gym", billingDay: 8 });
    const early = billTransaction({ sub: gym, date: "2026-10-08" }, ds, undefined, "2026-10-03");
    expect(early.date).toBe("2026-10-03");
    // it shows as paid among the upcoming charges, and isn't due on the 8th
    const after = { subscriptions: [gym], transactions: [early] };
    expect(upcomingBills(after, "2026-10-03", 40).map((c) => [c.date, c.paid?.id ?? null])).toEqual([["2026-10-08", early.id], ["2026-11-08", null]]);
    expect(dueBills(after, "2026-10-09")).toEqual([]);
    // three weeks ahead, across a month, it wouldn't count for this charge: logged on the charge date
    expect(billTransaction({ sub: sub({ billingDay: 1 }), date: "2026-11-01" }, ds, undefined, "2026-10-10").date).toBe("2026-11-01");
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

describe("billFromTransaction", () => {
  const phone = tx({ date: "2026-10-02", category: "Utilities", subcategory: "Phone", description: "Phone plan", merchant: "Koodo", amount: 45, payment: "Debit" });

  it("repeats a monthly expense on its day of the month, and counts it as this month's charge", () => {
    const bill = billFromTransaction(phone, "monthly", "2026-10-02");
    expect(bill).toMatchObject({ name: "Phone plan", merchant: "Koodo", category: "Utilities", subcategory: "Phone", amount: 45, payment: "Debit", cycle: "monthly", billingDay: 2, nextCharge: "", status: "active", kind: "bill" });
    expect(paidBy(bill, "2026-10-02", [{ ...phone, billId: bill.id }])).toBeTruthy();
  });

  it("anchors longer cycles on the next charge still to come", () => {
    expect(billFromTransaction(phone, "annual", "2026-10-02").nextCharge).toBe("2027-10-02");
    expect(billFromTransaction({ ...phone, date: "2026-01-31" }, "quarterly", "2026-10-02").nextCharge).toBe("2026-10-31");
    expect(billFromTransaction(phone, "weekly", "2026-10-05").nextCharge).toBe("2026-10-09");
  });

  it("names it after the merchant when there's no description", () => {
    expect(billFromTransaction({ ...phone, description: "" }, "monthly").name).toBe("Koodo");
  });
});

describe("monthCharges", () => {
  it("shows each bill's charge in the month, logged or not", () => {
    const subs = [sub({ id: "n", name: "Netflix", billingDay: 18 }), sub({ id: "s", name: "Spotify", billingDay: 5 }), sub({ id: "a", name: "Prime", cycle: "annual", billingDay: null, nextCharge: "2027-03-14" })];
    const paid = tx({ billId: "s", date: "2026-10-04" });
    const m = monthCharges({ subscriptions: subs, transactions: [paid] }, "2026-10");
    expect([...m.values()].map((c) => [c.sub.name, c.date, c.paid?.id ?? null])).toEqual([["Spotify", "2026-10-05", paid.id], ["Netflix", "2026-10-18", null]]);
  });

  it("points a weekly bill at its first charge not logged yet, or the last one once all are", () => {
    const weekly = sub({ id: "w", cycle: "weekly", billingDay: null, nextCharge: "2026-10-01" });
    const first = tx({ billId: "w", date: "2026-10-01" });
    expect(monthCharges({ subscriptions: [weekly], transactions: [first] }, "2026-10").get("w")?.date).toBe("2026-10-08");
    const all = ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29"].map((date) => tx({ billId: "w", date }));
    expect(monthCharges({ subscriptions: [weekly], transactions: all }, "2026-10").get("w")).toMatchObject({ date: "2026-10-29", paid: all[4] });
  });
});

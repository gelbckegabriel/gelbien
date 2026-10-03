import { describe, expect, it } from "vitest";
import { defaultSettings } from "../defaults";
import type { Dataset } from "../types";
import { datasetSchema } from "../validation";
import { RECORD, restoreCache, upgradeDataset } from "./upgrade";

// A dataset as the first release stored it: before split purchases, bill links, recurring kinds /
// subcategories / merchants, accounts, balances and goals. Frozen — never add fields here: every field
// added since must still load from it (this browser's cached copy) and restore from it (a backup).
const FIRST_RELEASE = {
  transactions: [
    {
      id: "t1", date: "2026-08-03", category: "Groceries", subcategory: "Supermarket", description: "Weekly groceries", amount: 120.5, payment: "Debit",
      type: "variable", priority: "essential", merchant: "Superstore", recurring: false, notes: "", receiptUrl: "", createdAt: "2026-08-03T10:00:00Z", updatedAt: "2026-08-03T10:00:00Z",
    },
  ],
  categories: [{ name: "Groceries", color: "#2fb37a", icon: "ShoppingCart", order: 0, subcategories: ["Supermarket"], archived: false }],
  budgets: [{ month: "default", category: "Groceries", amount: 600 }],
  incomes: [{ month: "default", gross: 6000, net: 4800, note: "" }],
  subscriptions: [{ id: "s1", name: "Netflix", category: "Subscriptions", amount: 18.99, cycle: "monthly", billingDay: 18, payment: "Credit", status: "active", trialEnd: "", worthIt: "maybe", notes: "" }],
  settings: { currency: "CAD", locale: "en", reserve: 0, savingsGoal: 500, paymentMethods: ["Credit", "Debit"], warnAt: 0.8 },
  meta: { source: "google", syncedAt: "2026-08-03T10:00:00Z" },
};

const stored = () => structuredClone(FIRST_RELEASE) as unknown as Dataset;
const keys = (o: object) => Object.keys(o).sort();

describe("upgradeDataset", () => {
  it("gives every record of a first-release dataset every field added since", () => {
    const ds = upgradeDataset(stored());
    for (const k of Object.keys(RECORD) as (keyof typeof RECORD)[]) {
      for (const r of ds[k]) expect(keys(r), k).toEqual(keys(RECORD[k]));
    }
    expect(keys(ds.settings)).toEqual(keys(defaultSettings("en")));
    expect(ds).toMatchObject({ accounts: [], balances: [], goals: [], settings: { paymentStyles: {}, checkInDay: 1, currency: "CAD" } });
    expect(ds.transactions[0]).toMatchObject({ amount: 120.5, merchant: "Superstore", group: "", billId: "" });
    // a recurring payment from before bills and subscriptions were told apart: guessed from its category
    expect(ds.subscriptions[0]).toMatchObject({ name: "Netflix", kind: "subscription", subcategory: "", merchant: "", nextCharge: "" });
  });

  it("restores the same first-release data from a backup", () => {
    const upgraded: Partial<Dataset> = upgradeDataset(stored());
    delete upgraded.meta;
    expect(datasetSchema.parse(stored())).toEqual(upgraded);
  });

  it("leaves records that are already up to date as they are", () => {
    const ds = upgradeDataset(stored());
    const again = upgradeDataset(ds);
    expect(again.transactions[0]).toBe(ds.transactions[0]);
    expect(again.subscriptions[0]).toBe(ds.subscriptions[0]);
  });
});

describe("restoreCache", () => {
  it("upgrades the sheet this browser cached under an older version, before anything reads it", () => {
    const session = { user: { email: "me@example.com" } };
    const cached = JSON.stringify({
      timestamp: 1,
      buster: "v5",
      clientState: {
        mutations: [],
        queries: [
          { queryKey: ["dataset", "google", "user-1"], queryHash: "d", state: { data: FIRST_RELEASE, status: "success" } },
          { queryKey: ["session"], queryHash: "s", state: { data: session, status: "success" } },
        ],
      },
    });
    const [dataset, other] = restoreCache(cached).clientState.queries.map((q) => q.state.data);
    expect((dataset as Dataset).subscriptions[0]).toMatchObject({ merchant: "", kind: "subscription" });
    expect(other).toEqual(session);
  });
});

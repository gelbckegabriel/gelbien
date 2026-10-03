import { describe, expect, it } from "vitest";
import { defaultCategories, defaultSettings } from "./defaults";
import {
  colLetter,
  dataRange,
  datasetFromRanges,
  datasetToRanges,
  rowToSubscription,
  rowToTransaction,
  rowsToSettings,
} from "./sheet-schema";
import type { Dataset } from "./types";
import { parseAmount } from "./utils";

describe("sheet schema", () => {
  it("builds A1 ranges", () => {
    expect(colLetter(1)).toBe("A");
    expect(colLetter(15)).toBe("O");
    expect(colLetter(27)).toBe("AA");
    expect(dataRange("transactions")).toBe("Transactions!A2:Q");
  });

  it("round-trips a whole dataset through sheet rows", () => {
    const data: Omit<Dataset, "meta"> = {
      transactions: [
        {
          id: "t1", date: "2026-09-20", category: "Groceries", subcategory: "Bakery", description: "=SUM(A1)", amount: 12.5,
          payment: "Debit", type: "variable", priority: "essential", merchant: "Cobs", recurring: false, notes: "",
          receiptUrl: "", createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z",
          group: "g1", billId: "s1",
        },
      ],
      categories: defaultCategories("en"),
      budgets: [{ month: "default", category: "Groceries", amount: 500 }],
      incomes: [{ month: "default", gross: 6000, net: 4800, note: "" }],
      subscriptions: [
        { id: "s1", name: "Spotify", category: "Subscriptions", amount: 11.99, cycle: "monthly", billingDay: 5, payment: "Credit", status: "active", trialEnd: "", worthIt: "yes", notes: "", nextCharge: "2026-10-05", kind: "subscription", subcategory: "Music streaming", merchant: "Spotify AB" },
      ],
      accounts: [
        { id: "a1", name: "HISA", institution: "Neo Financial", type: "savings", color: "#199e70", archived: false, notes: "" },
        { id: "a2", name: "Visa", institution: "Scotiabank", type: "credit", color: "#e0707a", archived: true, notes: "closed" },
      ],
      balances: [
        { accountId: "a1", date: "2026-08-01", balance: 4200.5 },
        { accountId: "a2", date: "2026-09-01", balance: 310 },
      ],
      goals: [
        {
          id: "g1", name: "Car", icon: "Car", color: "#3987e5", target: 18000, targetDate: "2027-12-01", accountIds: ["a1", "a2"], saved: 0,
          monthlyContribution: 500, annualReturn: 3.5, status: "active", order: 0, notes: "", createdAt: "2026-09-26T00:00:00.000Z",
        },
        {
          id: "g2", name: "Trip", icon: "Plane", color: "#d9b45f", target: 3500, targetDate: "", accountIds: [], saved: 1200,
          monthlyContribution: 150, annualReturn: 0, status: "paused", order: 1, notes: "Brazil", createdAt: "",
        },
      ],
      settings: { ...defaultSettings("en"), reserve: 15000, checkInDay: 5, paymentStyles: { Credit: { icon: "Gift", color: "#d55181" } } },
    };
    const back = datasetFromRanges(datasetToRanges(data), "en");
    expect(back).toEqual(data);
  });

  it("tolerates hand-edited cells (serial dates, comma decimals, missing enums)", () => {
    const t = rowToTransaction(["x", 46265, "Food", "", "", "31,90", "", "", "Supérfluo"]);
    expect(t?.date).toBe("2026-08-31");
    expect(t?.amount).toBe(31.9);
    expect(t?.type).toBe("variable");
    expect(t?.priority).toBe("important");
    expect(rowToTransaction(["", "2026-01-01"])).toBeNull();
  });

  it("parses settings with defaults for missing keys", () => {
    const s = rowsToSettings([["currency", "BRL"], ["warnAt", 2], ["paymentMethods", "Pix|Cartão"]], "pt");
    expect(s.currency).toBe("BRL");
    expect(s.warnAt).toBe(0.85);
    expect(s.paymentMethods).toEqual(["Pix", "Cartão"]);
    expect(s.locale).toBe("pt");
    expect(s.paymentStyles).toEqual({});
    const styled = rowsToSettings([["paymentStyles", JSON.stringify({ Pix: { icon: "QrCode", color: "#199e70" } })]], "pt");
    expect(styled.paymentStyles).toEqual({ Pix: { icon: "QrCode", color: "#199e70" } });
  });

  it("tells bills from subscriptions on rows saved before the kind column", () => {
    expect(rowToSubscription(["s1", "Netflix", "Subscriptions", 18.99, "monthly", 5])?.kind).toBe("subscription");
    expect(rowToSubscription(["s2", "Rent", "Housing", 1650, "monthly", 1])?.kind).toBe("bill");
    expect(rowToSubscription(["s3", "Gym", "Health", 50, "monthly", 1, "", "active", "", "yes", "", "", "subscription"])?.kind).toBe("subscription");
  });

  it("parses human-typed amounts", () => {
    expect(parseAmount("31,90")).toBe(31.9);
    expect(parseAmount("$1,234.50")).toBe(1234.5);
    expect(parseAmount("1.234,50")).toBe(1234.5);
    expect(parseAmount("1,234")).toBe(1234);
    expect(parseAmount("-12,5")).toBe(-12.5);
    expect(parseAmount("abc")).toBe(0);
  });
});

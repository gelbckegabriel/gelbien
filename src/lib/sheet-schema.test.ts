import { describe, expect, it } from "vitest";
import { defaultCategories, defaultSettings } from "./defaults";
import {
  colLetter,
  dataRange,
  datasetFromRanges,
  datasetToRanges,
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
    expect(dataRange("transactions")).toBe("Transactions!A2:O");
  });

  it("round-trips a whole dataset through sheet rows", () => {
    const data: Omit<Dataset, "meta"> = {
      transactions: [
        {
          id: "t1", date: "2026-09-20", category: "Groceries", subcategory: "Bakery", description: "=SUM(A1)", amount: 12.5,
          payment: "Debit", type: "variable", priority: "essential", merchant: "Cobs", recurring: false, notes: "",
          receiptUrl: "", createdAt: "2026-09-20T10:00:00.000Z", updatedAt: "2026-09-20T10:00:00.000Z",
        },
      ],
      categories: defaultCategories("en"),
      budgets: [{ month: "default", category: "Groceries", amount: 500 }],
      incomes: [{ month: "default", gross: 6000, net: 4800, note: "" }],
      subscriptions: [
        { id: "s1", name: "Spotify", category: "Subscriptions", amount: 11.99, cycle: "monthly", billingDay: 5, payment: "Credit", status: "active", trialEnd: "", worthIt: "yes", notes: "" },
      ],
      settings: { ...defaultSettings("en"), reserve: 15000 },
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

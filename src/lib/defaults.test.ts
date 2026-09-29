import { describe, expect, it } from "vitest";
import { builtInTranslation, guessKind, paymentLook, paymentTranslations } from "./defaults";

describe("builtInTranslation", () => {
  it("translates built-in names from any language", () => {
    expect(builtInTranslation("Moradia", ["Aluguel", "Mudança"], "en")).toEqual({ name: "Housing", subcategories: ["Rent", "Moving"] });
    expect(builtInTranslation("housing", ["rent"], "fr")).toEqual({ name: "Logement", subcategories: ["Loyer"] });
  });

  it("leaves the user's own names untranslated", () => {
    expect(builtInTranslation("Coisas do Theo", ["Padaria da esquina", "Aluguel"], "en")).toEqual({
      name: null,
      subcategories: [null, "Rent"],
    });
  });
});

describe("payment methods", () => {
  it("gives built-in methods the same look in every language, and guesses one for the user's own", () => {
    expect(paymentLook("Crédito")).toEqual(paymentLook("Credit"));
    expect(paymentLook("Credit").icon).toBe("CreditCard");
    expect(paymentLook("Pix").icon).toBe("QrCode");
    expect(paymentLook("Visa Scotiabank").icon).toBe("CreditCard");
    expect(paymentLook("Débito automático Nubank").icon).toBe("CalendarSync");
    expect(paymentLook("Nubank").icon).toBe("Wallet");
    // a stable colour per name
    expect(paymentLook("Nubank").color).toBe(paymentLook("nubank").color);
  });

  it("prefers the look the user picked", () => {
    expect(paymentLook("Credit", { Credit: { icon: "Gift", color: "#000000" } })).toEqual({ icon: "Gift", color: "#000000" });
  });

  it("translates only built-in names that differ", () => {
    expect(paymentTranslations(["Crédito", "Nubank", "Interac e-Transfer", "Credit"], "en")).toEqual([{ from: "Crédito", to: "Credit" }]);
    expect(paymentTranslations(["Cash"], "fr")).toEqual([{ from: "Cash", to: "Comptant" }]);
  });
});

describe("guessKind", () => {
  it("treats the built-in Subscriptions category as subscriptions and the rest as bills", () => {
    expect(guessKind("Assinaturas")).toBe("subscription");
    expect(guessKind("subscriptions")).toBe("subscription");
    expect(guessKind("Housing")).toBe("bill");
  });
});

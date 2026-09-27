import { describe, expect, it } from "vitest";
import { builtInTranslation } from "./defaults";

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

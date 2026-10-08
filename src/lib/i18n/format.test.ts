import { describe, expect, it } from "vitest";
import { moneyTextWidth } from "@/components/ui/misc";
import { makeFormatters } from "./index";

describe("money formats", () => {
  const f = makeFormatters("en", "CAD");

  it("never rounds an amount: cents when there are any, no .00 on whole ones", () => {
    expect(f.amount(4.5)).toBe("$4.50");
    expect(f.amount(1200)).toBe("$1,200");
    expect(f.amount(2401.24)).toBe("$2,401.24");
    expect(f.amount(-12.3)).toBe("-$12.30");
    expect(f.amount(0.1 + 0.2)).toBe("$0.30");
    expect(f.amount(1199.999)).toBe("$1,200");
  });

  it("only abbreviates with a visible K in compact spots", () => {
    expect(f.moneyCompact(4.5)).toBe("$4.50");
    expect(f.moneyCompact(245.6)).toBe("$245.60");
    expect(f.moneyCompact(1250)).toBe("$1.3K");
  });

  it("measures an amount with its smaller cents", () => {
    expect(moneyTextWidth("$2,578.76")).toBeCloseTo(0.65 + 4 * 0.6 + 0.2 + (0.2 + 1.2) * 0.7);
    expect(moneyTextWidth("2 578,76 $")).toBeCloseTo(0.6 + 0.25 + 3 * 0.6 + (0.2 + 1.2) * 0.7 + 0.25 + 0.65);
    expect(moneyTextWidth("$1,200")).toBeCloseTo(0.65 + 0.2 + 4 * 0.6);
  });
});

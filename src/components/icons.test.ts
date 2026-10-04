import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS, CATEGORY_ICON_GROUPS, GOAL_ICONS, PAYMENT_ICONS, defaultCategories } from "@/lib/defaults";
import { ACCOUNT_TYPE_ICON, ICONS } from "./icons";

describe("icons", () => {
  it("has every icon the pickers and built-in categories offer", () => {
    const offered = [
      ...CATEGORY_ICON_GROUPS.flatMap((g) => g.icons),
      ...GOAL_ICONS,
      ...PAYMENT_ICONS,
      ...Object.values(ACCOUNT_TYPE_ICON),
      ...(["en", "pt", "fr"] as const).flatMap((l) => defaultCategories(l).map((c) => c.icon)),
    ];
    expect(offered.filter((name) => !ICONS[name])).toEqual([]);
  });

  it("offers each category icon once", () => {
    const all = CATEGORY_ICON_GROUPS.flatMap((g) => g.icons);
    expect(all.length).toBe(new Set(all).size);
  });
});

describe("colours", () => {
  it("offers distinct #rrggbb colours (icon backgrounds append an alpha to them)", () => {
    expect(CATEGORY_COLORS.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true);
    expect(new Set(CATEGORY_COLORS).size).toBe(CATEGORY_COLORS.length);
  });

  it("gives the built-in categories colours from the palette", () => {
    const used = (["en", "pt", "fr"] as const).flatMap((l) => defaultCategories(l).map((c) => c.color));
    expect(used.filter((c) => !CATEGORY_COLORS.includes(c))).toEqual([]);
  });
});

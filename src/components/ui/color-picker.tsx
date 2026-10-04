"use client";

import { Pipette } from "lucide-react";
import { CATEGORY_COLORS } from "@/lib/defaults";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The colour picker everywhere a colour is chosen (categories, payment methods, goals, accounts): the
 * palette 8 per row, then a custom swatch that opens the device's own colour picker for anything else.
 * A colour that isn't in the palette shows on the custom swatch.
 */
export function ColorPicker({ value, onChange, className }: { value: string; onChange: (color: string) => void; className?: string }) {
  const { t } = useI18n();
  const custom = !CATEGORY_COLORS.includes(value.toLowerCase());
  const ring = "ring-2 ring-white ring-offset-2 ring-offset-[#16161b]";
  return (
    <div className={cn("rise-list grid w-full max-w-[18rem] grid-cols-8 gap-1.5", className)}>
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn("aspect-square w-full rounded-full transition hover:scale-110", value.toLowerCase() === c && ring)}
          style={{ background: c }}
          aria-label={c}
          aria-pressed={value.toLowerCase() === c}
        />
      ))}
      <label
        title={t("cfg.customColor")}
        className={cn("relative grid aspect-square w-full cursor-pointer place-items-center overflow-hidden rounded-full transition hover:scale-110", custom && ring)}
        // the chosen custom colour, or a colour wheel inviting one
        style={{ background: custom ? value : "conic-gradient(#e5484d, #e8c65f, #30a46c, #2aa3c7, #6b5ccc, #d55181, #e5484d)" }}
      >
        <Pipette className="h-3.5 w-3.5 text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]" aria-hidden />
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#d9b45f"}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t("cfg.customColor")}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}

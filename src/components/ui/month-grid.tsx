"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn, currentMonth } from "@/lib/utils";

/** Year switcher + 12-month grid, shared by the top-bar month picker and MonthField. Months are "YYYY-MM". */
export function MonthGrid({
  year,
  onYear,
  value,
  onPick,
  min,
  marked,
}: {
  year: number;
  onYear: (year: number) => void;
  value: string;
  onPick: (month: string) => void;
  /** Earliest month that can be picked */
  min?: string;
  /** Months that get a dot (e.g. months with data) */
  marked?: Set<string>;
}) {
  const { t, f } = useI18n();
  const now = currentMonth();
  const minYear = min ? Number(min.slice(0, 4)) : -Infinity;
  const nav = "grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30";
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => onYear(year - 1)} disabled={year - 1 < minYear} aria-label={t("month.prevYear")} className={nav}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-ink">{year}</span>
        <button type="button" onClick={() => onYear(year + 1)} aria-label={t("month.nextYear")} className={nav}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      {/* the months cascade in, and again when the year changes */}
      <div key={year} className="rise-list grid grid-cols-3 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => {
          const m = `${year}-${String(i + 1).padStart(2, "0")}`;
          const selected = m === value;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onPick(m)}
              disabled={!!min && m < min}
              className={cn(
                "relative h-10 rounded-xl text-sm capitalize transition-colors disabled:pointer-events-none disabled:opacity-30",
                selected ? "bg-gold text-[#1b1406] font-semibold" : "text-ink-2 hover:bg-white/5",
                m === now && !selected && "ring-1 ring-gold/40",
              )}
            >
              {f.monthShort(m)}
              {marked?.has(m) && !selected && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold/70" />}
            </button>
          );
        })}
      </div>
    </>
  );
}

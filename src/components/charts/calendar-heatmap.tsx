"use client";

import { motion } from "motion/react";
import { useState } from "react";
import type { MonthSummary } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { cn, todayISO } from "@/lib/utils";
import { ChartCard, DataTable, GOLD_RAMP, rampColor, rampInk } from "./kit";

export function CalendarHeatmap({ summary, className }: { summary: MonthSummary; className?: string }) {
  const { t, f } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const [y, m] = summary.month.split("-").map(Number);
  const firstDow = new Date(y, m - 1, 1).getDay(); // 0 = Sunday
  const max = Math.max(...summary.daily, 0);
  const today = todayISO();
  const cells: (number | null)[] = [...Array.from({ length: firstDow }, () => null), ...summary.daily.map((_, i) => i + 1)];
  const iso = (day: number) => `${summary.month}-${String(day).padStart(2, "0")}`;

  return (
    <ChartCard
      className={className}
      title={t("dash.cal.title")}
      subtitle={t("dash.cal.subtitle")}
      table={
        <DataTable
          head={[t("exp.col.date"), t("exp.col.amount")]}
          rows={summary.daily.map((v, i) => [f.day(iso(i + 1)), f.money(v)]).filter((_row, i) => summary.daily[i] !== 0)}
        />
      }
    >
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <span key={i} className="pb-1 text-center text-[10px] font-medium uppercase text-ink-3">
            {f.weekday(i).slice(0, 3)}
          </span>
        ))}
        {cells.map((day, i) =>
          day === null ? (
            <span key={`e${i}`} />
          ) : (
            <motion.button
              type="button"
              key={day}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.01 * i, type: "spring", stiffness: 400, damping: 26 }}
              onMouseEnter={() => setHover(day)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(day)}
              onBlur={() => setHover(null)}
              className={cn(
                "relative aspect-square rounded-lg text-[11px] font-medium outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-gold",
                iso(day) === today && "ring-1 ring-gold",
                iso(day) > today && "opacity-40",
              )}
              style={{
                background: rampColor(summary.daily[day - 1], max),
                color: summary.daily[day - 1] > 0 ? rampInk(summary.daily[day - 1], max) : "#85817a",
              }}
              aria-label={`${f.day(iso(day))}: ${f.money(summary.daily[day - 1])}`}
            >
              {day}
            </motion.button>
          ),
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-xs">
        <span className="min-h-5 text-ink-2">
          {hover !== null ? (
            <>
              <span className="text-ink-3">{f.day(iso(hover))} · </span>
              <span className="tabular font-semibold text-ink">{f.money(summary.daily[hover - 1])}</span>
            </>
          ) : null}
        </span>
        <span className="flex items-center gap-1 text-ink-3">
          {t("dash.cal.less")}
          {GOLD_RAMP.map((c) => (
            <span key={c} className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c }} />
          ))}
          {t("dash.cal.more")}
        </span>
      </div>
    </ChartCard>
  );
}

"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { yearMatrix } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { ChartCard, DataTable, rampColor, rampInk } from "./kit";

// Phones: the categories stay pinned on the left (on the card's own colour) while the months swipe under them.
// The shadow fills the gap to their left too, or the months would show through it.
const PIN = "sticky left-0 z-10 bg-[#131316] shadow-[-8px_0_0_0_#131316] sm:static sm:bg-transparent sm:shadow-none";
// and, once the months have moved, a soft shadow off the pinned column
const PIN_SHADOW = "after:pointer-events-none after:absolute after:inset-y-0 after:left-full after:w-3 after:bg-gradient-to-r after:from-black/40 after:to-transparent sm:after:hidden";

/**
 * The old "Resumo Anual" tab as a heatmap: categories × months, brighter = more spent. Wide screens
 * show the whole year; phones keep readable cells and swipe through the months instead, starting at
 * the one being looked at.
 */
export function YearMatrix({ ds, month }: { ds: Dataset; month: string }) {
  const { t, f } = useI18n();
  const setMonth = useUi((s) => s.setMonth);
  const year = Number(month.slice(0, 4));
  const m = yearMatrix(ds, year);
  const colorOf = new Map(ds.categories.map((c) => [c.name, c.color]));
  const scroller = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const onScroll = () => {
    const el = scroller.current;
    if (el) setEdge({ start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 });
  };

  // the month being looked at, in the middle of what's visible (only matters when the table is wider than the card)
  useEffect(() => {
    const el = scroller.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    const th = el.querySelector<HTMLElement>(`[data-month="${month}"]`);
    const pinned = el.querySelector<HTMLElement>("[data-pinned]")?.offsetWidth ?? 0;
    if (th) el.scrollLeft = th.offsetLeft - pinned - (el.clientWidth - pinned - th.offsetWidth) / 2;
  }, [month, m.rows.length]);

  return (
    <ChartCard
      title={t("dash.matrix.title")}
      subtitle={t("dash.matrix.subtitle", { year })}
      table={
        <DataTable
          head={["", ...m.months.map((mm) => f.monthShort(mm)), t("common.total")]}
          rows={[...m.rows.map((r) => [r.name, ...r.values.map((v) => (v ? f.money0(v) : "—")), f.money0(r.total)]), [t("common.total"), ...m.monthTotals.map((v) => f.money0(v)), f.money0(m.yearTotal)]]}
        />
      }
    >
      {m.rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-3">—</p>
      ) : (
        <div className="relative">
          <div
            ref={scroller}
            onScroll={onScroll}
            // snapping to months, and never under the pinned names
            className="-mx-1 snap-x snap-proximity scroll-pl-[7rem] overflow-x-auto overscroll-x-contain px-1 pb-1 sm:scroll-pl-0"
          >
            <table className="w-max border-separate border-spacing-1 text-[11px] sm:w-full sm:min-w-[720px]">
              <thead>
                <tr>
                  <th data-pinned className={PIN} />
                  {m.months.map((mm) => (
                    <th key={mm} data-month={mm} className={cn("snap-start pb-1 text-center font-medium", mm === month ? "text-gold" : "text-ink-3")}>
                      <button onClick={() => setMonth(mm)} className="hover:text-ink">
                        {f.monthShort(mm)}
                      </button>
                    </th>
                  ))}
                  <th className="pb-1 pl-2 text-right font-medium text-ink-3">{t("common.total")}</th>
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r, ri) => (
                  <tr key={r.name}>
                    <td className={cn("max-w-[6.5rem] truncate pr-2 text-[12px] text-ink-2 sm:max-w-40", PIN, !edge.start && PIN_SHADOW)}>
                      <span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: colorOf.get(r.name) ?? "#6b6a72" }} />
                      {r.name}
                    </td>
                    {r.values.map((v, i) => (
                      <td key={i} className="p-0">
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.015 * (ri * 12 + i) }}
                          title={`${r.name} · ${f.monthLong(m.months[i])}: ${f.money(v)}`}
                          className={cn("tabular grid h-9 w-12 place-items-center rounded-md sm:h-8 sm:w-auto", m.months[i] === month && "ring-1 ring-gold/60")}
                          style={{ background: rampColor(v, m.max), color: rampInk(v, m.max) }}
                        >
                          {v ? f.moneyCompact(v) : ""}
                        </motion.div>
                      </td>
                    ))}
                    <td className="tabular pl-2 text-right text-[12px] font-medium text-ink">{f.money0(r.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td className={cn("pr-2 pt-2 text-[12px] font-semibold text-ink", PIN, !edge.start && PIN_SHADOW)}>{t("common.total")}</td>
                  {m.monthTotals.map((v, i) => (
                    <td key={i} className="tabular pt-2 text-center text-[11px] font-semibold text-ink-2">
                      {v ? f.moneyCompact(v) : "—"}
                    </td>
                  ))}
                  <td className="tabular pl-2 pt-2 text-right text-[12px] font-semibold text-gold-bright">{f.money0(m.yearTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {/* more months this way */}
          <div
            aria-hidden
            className={cn("pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[#131316] to-transparent transition-opacity sm:hidden", edge.end && "opacity-0")}
          />
        </div>
      )}
    </ChartCard>
  );
}

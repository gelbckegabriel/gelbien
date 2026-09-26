"use client";

import { motion } from "motion/react";
import { yearMatrix } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { ChartCard, DataTable, rampColor, rampInk } from "./kit";

/** The old "Resumo Anual" tab as a heatmap: categories × months, brighter = more spent. */
export function YearMatrix({ ds, month }: { ds: Dataset; month: string }) {
  const { t, f } = useI18n();
  const setMonth = useUi((s) => s.setMonth);
  const year = Number(month.slice(0, 4));
  const m = yearMatrix(ds, year);
  const colorOf = new Map(ds.categories.map((c) => [c.name, c.color]));

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
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-[11px]">
            <thead>
              <tr>
                <th />
                {m.months.map((mm) => (
                  <th key={mm} className={cn("pb-1 text-center font-medium", mm === month ? "text-gold" : "text-ink-3")}>
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
                  <td className="max-w-40 truncate pr-2 text-[12px] text-ink-2">
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
                        className={cn("tabular grid h-8 place-items-center rounded-md", m.months[i] === month && "ring-1 ring-gold/60")}
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
                <td className="pr-2 pt-2 text-[12px] font-semibold text-ink">{t("common.total")}</td>
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
      )}
    </ChartCard>
  );
}

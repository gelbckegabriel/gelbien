"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { foldCategories, type MonthSummary } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "../ui/misc";
import { ChartCard, DataTable, INK, TooltipBox } from "./kit";

export function CategoryDonut({ summary, className }: { summary: MonthSummary; className?: string }) {
  const { t, f } = useI18n();
  const [hover, setHover] = useState<number | null>(null);
  const data = foldCategories(summary.byCategory, 6).map((d) => ({ ...d, label: d.name === "__other__" ? t("common.rest") : d.name }));
  const total = data.reduce((a, b) => a + b.value, 0);
  const focus = hover !== null ? data[hover] : null;

  return (
    <ChartCard viewKey="dash.donut"
      className={className}
      title={t("dash.cat.title")}
      subtitle={t("dash.cat.subtitle")}
      table={
        <DataTable
          head={[t("exp.col.category"), t("exp.col.amount"), "%"]}
          rows={summary.byCategory.filter((c) => c.spent > 0).map((c) => [c.name, f.money(c.spent), f.pct(c.share)])}
        />
      }
    >
      <div className="@container flex flex-1 flex-col justify-center">
      <div className="flex flex-col items-center gap-5 @md:flex-row">
        <div className="relative h-52 w-52 shrink-0">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={data.length > 1 ? 2 : 0}
                cornerRadius={4}
                stroke={INK.surface}
                strokeWidth={2}
                animationDuration={900}
                onMouseEnter={(_, i) => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {data.map((d, i) => (
                  <Cell key={d.name} fill={d.color} fillOpacity={hover === null || hover === i ? 1 : 0.35} style={{ transition: "fill-opacity 200ms" }} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox rows={[{ label: String(payload[0].name), value: f.money(Number(payload[0].value)), color: String(payload[0].payload.color), kind: "rect" }]} />
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="max-w-28 truncate text-[11px] text-ink-3">{focus ? focus.label : t("common.total")}</span>
            <AnimatedNumber smallCents value={focus ? focus.value : total} format={f.amount} className="text-xl font-semibold text-ink" />
            {focus && <span className="text-[11px] text-ink-3">{f.pct(focus.value / total)}</span>}
          </div>
        </div>
        <ul className="w-full min-w-0 space-y-1">
          {data.map((d, i) => (
            <li
              key={d.name}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors", hover === i && "bg-white/[0.04]")}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: d.color }} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{d.label}</span>
              <span className="tabular text-ink">{f.amount(d.value)}</span>
              <span className="tabular w-10 text-right text-xs text-ink-3">{f.pct(d.value / total)}</span>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </ChartCard>
  );
}

"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { trend } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { axisProps, BAD, ChartArea, ChartCard, DataTable, GOLD, GOOD, INK, Legend, TooltipBox } from "./kit";

export function TrendChart({ ds, month, className }: { ds: Dataset; month: string; className?: string }) {
  const { t, f } = useI18n();
  const setMonth = useUi((s) => s.setMonth);
  // Start at the first month with any spending, so months before you began tracking don't read as "saved everything".
  const all = trend(ds, month, 12);
  const first = all.findIndex((d) => d.spent !== 0);
  const data = first > 0 ? all.slice(first) : all;
  const hasIncome = data.some((d) => d.income > 0);

  return (
    <ChartCard
      className={className}
      title={t("dash.trend.title")}
      subtitle={t("dash.trend.subtitle")}
      legend={
        <Legend
          items={[
            ...(hasIncome ? [{ label: t("dash.trend.income"), color: GOOD }] : []),
            { label: t("dash.trend.spent"), color: BAD },
            ...(hasIncome ? [{ label: t("dash.trend.saved"), color: GOLD, kind: "line" as const }] : []),
          ]}
        />
      }
      table={
        <DataTable
          head={["", t("dash.trend.income"), t("dash.trend.spent"), t("dash.trend.saved")]}
          rows={data.map((d) => [f.monthLong(d.month), f.money(d.income), f.money(d.spent), f.money(d.saved)])}
        />
      }
    >
      <ChartArea min="min-h-56">
        <ResponsiveContainer>
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
            barGap={2}
            barCategoryGap="22%"
            onClick={(e) => {
              const m = (e as { activeLabel?: string } | null)?.activeLabel;
              if (m) setMonth(m);
            }}
          >
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="month" {...axisProps} tickFormatter={(m: string) => f.monthShort(m)} interval={0} minTickGap={4} />
            <YAxis {...axisProps} width={56} tickFormatter={(v: number) => f.moneyCompact(v)} />
            <ReferenceLine y={0} stroke={INK.axis} />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={f.monthLong(String(label))}
                    rows={payload.map((p) => ({
                      label: p.dataKey === "income" ? t("dash.trend.income") : p.dataKey === "spent" ? t("dash.trend.spent") : t("dash.trend.saved"),
                      value: f.money(Number(p.value)),
                      color: p.dataKey === "income" ? GOOD : p.dataKey === "spent" ? BAD : GOLD,
                      kind: p.dataKey === "saved" ? "line" : "rect",
                    }))}
                  />
                ) : null
              }
            />
            {hasIncome && <Bar dataKey="income" fill={GOOD} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={900} />}
            <Bar dataKey="spent" fill={BAD} fillOpacity={0.85} radius={[4, 4, 0, 0]} maxBarSize={18} animationDuration={900} className="cursor-pointer" />
            {hasIncome && (
              <Line type="monotone" dataKey="saved" stroke={GOLD} strokeWidth={2} dot={{ r: 3, fill: GOLD, stroke: INK.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={1100} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </ChartArea>
    </ChartCard>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { weekdayPattern } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { axisProps, ChartCard, DataTable, GOLD, INK, TooltipBox } from "./kit";

export function WeekdayChart({ ds }: { ds: Dataset }) {
  const { t, f } = useI18n();
  const data = weekdayPattern(ds).map((d) => ({ ...d, label: f.weekday(d.weekday) }));
  const max = Math.max(...data.map((d) => d.avg));

  return (
    <ChartCard
      title={t("dash.weekday.title")}
      subtitle={t("dash.weekday.subtitle")}
      table={<DataTable head={["", t("exp.col.amount")]} rows={data.map((d) => [d.label, f.money(d.avg)])} />}
    >
      <div className="h-44 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis {...axisProps} width={48} tickFormatter={(v: number) => f.moneyCompact(v)} />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? <TooltipBox title={String(label)} rows={[{ label: "", value: f.money(Number(payload[0].value)), color: GOLD, kind: "rect" }]} /> : null
              }
            />
            <Bar dataKey="avg" radius={[4, 4, 0, 0]} maxBarSize={24} animationDuration={900}>
              {data.map((d) => (
                <Cell key={d.weekday} fill={GOLD} fillOpacity={d.avg === max ? 1 : 0.4} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

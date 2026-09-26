"use client";

import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dataset } from "@/lib/types";
import { paceSeries } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { addMonths } from "@/lib/utils";
import { axisProps, ChartCard, DataTable, GOLD, INK, Legend, TooltipBox } from "./kit";

export function PaceChart({ ds, month }: { ds: Dataset; month: string }) {
  const { t, f } = useI18n();
  const data = paceSeries(ds, month);
  const hasPace = data.some((d) => d.pace !== null);
  const lastLabel = `${t("dash.pace.last")} (${f.monthShort(addMonths(month, -1))})`;

  return (
    <ChartCard
      title={t("dash.pace.title")}
      subtitle={t("dash.pace.subtitle")}
      legend={
        <Legend
          items={[
            { label: t("dash.pace.actual"), color: GOLD, kind: "line" },
            ...(hasPace ? [{ label: t("dash.pace.budget"), color: INK.secondary, kind: "line" as const }] : []),
            { label: lastLabel, color: "#5b5953", kind: "line" },
          ]}
        />
      }
      table={
        <DataTable
          head={["#", t("dash.pace.actual"), t("dash.pace.budget"), t("dash.pace.last")]}
          rows={data.map((d) => [d.day, d.actual === null ? "—" : f.money(d.actual), d.pace === null ? "—" : f.money(d.pace), d.last === null ? "—" : f.money(d.last)])}
        />
      }
    >
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="pace-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="day" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...axisProps} width={56} tickFormatter={(v: number) => f.moneyCompact(v)} />
            <Tooltip
              cursor={{ stroke: "#ffffff30", strokeWidth: 1 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={f.dayLong(`${month}-${String(label).padStart(2, "0")}`)}
                    rows={payload
                      .filter((p) => p.value !== null && p.value !== undefined)
                      .map((p) => ({
                        label: p.dataKey === "actual" ? t("dash.pace.actual") : p.dataKey === "pace" ? t("dash.pace.budget") : lastLabel,
                        value: f.money(Number(p.value)),
                        color: p.dataKey === "actual" ? GOLD : p.dataKey === "pace" ? INK.secondary : "#5b5953",
                      }))}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey="last" stroke="#5b5953" strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive animationDuration={900} />
            {hasPace && <Line type="linear" dataKey="pace" stroke={INK.secondary} strokeWidth={1.5} strokeOpacity={0.7} dot={false} activeDot={false} animationDuration={900} />}
            <Area
              type="monotone"
              dataKey="actual"
              stroke={GOLD}
              strokeWidth={2.25}
              fill="url(#pace-fill)"
              dot={false}
              activeDot={{ r: 4.5, stroke: INK.surface, strokeWidth: 2, fill: GOLD }}
              connectNulls={false}
              animationDuration={1100}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

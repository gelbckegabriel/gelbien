"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Dataset } from "@/lib/types";
import { paceSeries, type MonthForecast } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { addMonths, cn } from "@/lib/utils";
import { axisProps, ChartArea, ChartCard, DataTable, GOLD, INK, Legend, TooltipBox, type TooltipRow } from "./kit";

const LAST = "#5b5953";

export function PaceChart({ ds, month, forecast, budget = 0, className }: { ds: Dataset; month: string; forecast?: MonthForecast | null; budget?: number; className?: string }) {
  const { t, f } = useI18n();
  // nothing left to forecast on the last day
  const fc = forecast && forecast.daysLeft > 0 ? forecast : null;
  const ahead = new Map(fc?.path.map((p) => [p.day, p]));
  const data = paceSeries(ds, month).map((d) => {
    const p = ahead.get(d.day);
    return { ...d, forecast: p?.value ?? null, band: p ? [p.low, p.high] : null };
  });
  const hasPace = data.some((d) => d.pace !== null);
  const lastLabel = `${t("dash.pace.last")} (${f.monthShort(addMonths(month, -1))})`;
  const endDay = data.length;
  const over = fc && budget > 0 ? fc.end - budget : null;
  const label = (key: string) =>
    key === "actual" ? t("dash.pace.actual") : key === "pace" ? t("dash.pace.budget") : key === "forecast" ? t("dash.pace.forecast") : lastLabel;
  const color = (key: string) => (key === "actual" || key === "forecast" ? GOLD : key === "pace" ? INK.secondary : LAST);

  return (
    <ChartCard viewKey="dash.pace"
      className={className}
      title={t("dash.pace.title")}
      subtitle={t("dash.pace.subtitle")}
      legend={
        <Legend
          items={[
            { label: t("dash.pace.actual"), color: GOLD, kind: "line" },
            ...(fc ? [{ label: t("dash.pace.forecast"), color: GOLD, kind: "dash" as const }] : []),
            ...(hasPace ? [{ label: t("dash.pace.budget"), color: INK.secondary, kind: "line" as const }] : []),
            { label: lastLabel, color: LAST, kind: "line" },
          ]}
        />
      }
      table={
        <DataTable
          head={["#", t("dash.pace.actual"), ...(fc ? [t("dash.pace.forecast")] : []), t("dash.pace.budget"), t("dash.pace.last")]}
          rows={data.map((d) => [
            d.day,
            d.actual === null ? "—" : f.money(d.actual),
            ...(fc ? [d.forecast === null ? "—" : f.money(d.forecast)] : []),
            d.pace === null ? "—" : f.money(d.pace),
            d.last === null ? "—" : f.money(d.last),
          ])}
        />
      }
    >
      {fc && (
        // where the month is heading, in words: over or under the plan, and what it's made of
        <div
          className={cn(
            "mb-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
            over === null ? "border-line bg-white/[0.03]" : over > 0 ? "border-warn/25 bg-warn-soft" : "border-good/25 bg-good-soft",
          )}
        >
          {over !== null && over <= 0 ? (
            <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-good" />
          ) : (
            <TrendingUp className={cn("mt-0.5 h-4 w-4 shrink-0", over === null ? "text-ink-3" : "text-warn")} />
          )}
          <div className="min-w-0 text-[13px] leading-snug text-ink">
            <p>
              {t("dash.fc.heading", { amount: f.amount(fc.end), date: f.dateShort(`${month}-${String(endDay).padStart(2, "0")}`) })}
              {over !== null && (
                <span className={over > 0 ? "text-warn" : "text-good"}>
                  {" · "}
                  {t(over > 0 ? "dash.fc.over" : "dash.fc.under", { amount: f.amount(Math.abs(over)) })}
                </span>
              )}
            </p>
            <p className="mt-0.5 text-xs text-ink-3">
              {fc.billsDue > 0
                ? t("dash.fc.detail", { spent: f.amount(fc.spent), bills: f.amount(fc.billsDue), daily: f.amount(fc.usualDaily) })
                : t("dash.fc.detailNoBills", { spent: f.amount(fc.spent), daily: f.amount(fc.usualDaily) })}
            </p>
          </div>
        </div>
      )}
      <ChartArea min="min-h-60">
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
              content={({ active, payload, label: day }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={f.dayLong(`${month}-${String(day).padStart(2, "0")}`)}
                    rows={payload
                      .filter((p) => p.value !== null && p.value !== undefined && p.dataKey !== "band")
                      .map((p): TooltipRow => ({ label: label(String(p.dataKey)), value: f.money(Number(p.value)), color: color(String(p.dataKey)) }))
                      .concat(
                        // the likely range, once the forecast has spread out
                        payload
                          .filter((p) => p.dataKey === "band" && Array.isArray(p.value) && p.value[1] > p.value[0])
                          .map((p) => {
                            const [low, high] = p.value as unknown as [number, number];
                            return { label: t("dash.fc.range"), value: `${f.amount(low)} – ${f.amount(high)}` };
                          }),
                      )}
                  />
                ) : null
              }
            />
            <Line type="monotone" dataKey="last" stroke={LAST} strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive animationDuration={900} />
            {hasPace && <Line type="linear" dataKey="pace" stroke={INK.secondary} strokeWidth={1.5} strokeOpacity={0.7} dot={false} activeDot={false} animationDuration={900} />}
            {fc && <Area type="monotone" dataKey="band" stroke="none" fill={GOLD} fillOpacity={0.1} activeDot={false} isAnimationActive={false} />}
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
            {fc && (
              <>
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke={GOLD}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  activeDot={{ r: 4, stroke: GOLD, strokeWidth: 2, fill: INK.surface }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <ReferenceLine x={fc.path[0].day} stroke="#ffffff40" strokeDasharray="2 3" label={{ value: t("dash.fc.today"), position: "insideTopLeft", fill: INK.muted, fontSize: 11 }} />
                <ReferenceDot x={endDay} y={fc.end} r={4} fill={INK.surface} stroke={GOLD} strokeWidth={2} />
              </>
            )}
          </AreaChart>
        </ResponsiveContainer>
      </ChartArea>
    </ChartCard>
  );
}

"use client";

import { TrendingDown, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { priorityTrend, type PriorityMonth } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import type { Dataset, Priority } from "@/lib/types";
import { useView } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { Segmented } from "../ui/form";
import { axisProps, ChartArea, ChartCard, DataTable, INK, Legend, PRIORITY_COLORS, TooltipBox } from "./kit";

// bottom to top: what has to be paid, then what matters, then what could go
const STACK: Priority[] = ["essential", "important", "superfluous"];

/**
 * Superfluous spending, first full month against the latest: a sentence that says which way it's going.
 * Null without two full months to compare, or nothing superfluous to start from.
 */
function superfluousChange(points: PriorityMonth[]) {
  const full = points.filter((p) => !p.partial && p.total > 0);
  if (full.length < 2 || full[0].superfluous <= 0) return null;
  const first = full[0];
  const last = full[full.length - 1];
  return { first, last, change: (last.superfluous - first.superfluous) / first.superfluous };
}

/** Essential, important and superfluous by month: whether spending is shifting, not just what this month looks like. */
export function PriorityTrend({ ds, month, className }: { ds: Dataset; month: string; className?: string }) {
  const { t, f } = useI18n();
  const [mode, setMode] = useView("dash.priority", "amount", ["amount", "share"] as const);
  const points = priorityTrend(ds, month);
  const share = mode === "share";
  const data = points.map((p) => ({
    ...p,
    label: p.partial ? `${f.monthShort(p.month)} · ${t("dash.prio.soFar")}` : f.monthShort(p.month),
    // the bars: amounts, or each part's share of the month (refund-heavy months can't go past 100%)
    ...Object.fromEntries(STACK.map((k) => [k, share ? (p.total > 0 ? Math.max(0, p[k]) / p.total : 0) : p[k]])),
  }));
  const trend = superfluousChange(points);
  const steady = trend !== null && Math.abs(trend.change) < 0.1;
  const name = (p: PriorityMonth) => f.monthLong(p.month);

  return (
    <ChartCard viewKey="dash.priority"
      className={className}
      title={t("dash.prio.title")}
      subtitle={t("dash.prio.subtitle")}
      action={
        points.length > 0 && (
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: "amount" as const, label: t("dash.prio.amount") },
              { value: "share" as const, label: t("dash.prio.share") },
            ]}
          />
        )
      }
      legend={points.length > 0 && <Legend items={[...STACK].reverse().map((k) => ({ label: t(`priority.${k}`), color: PRIORITY_COLORS[k] }))} />}
      table={
        <DataTable
          head={["", ...STACK.map((k) => t(`priority.${k}`)), t("common.total")]}
          rows={points.map((p) => [name(p), ...STACK.map((k) => f.money(p[k])), f.money(p.total)])}
        />
      }
    >
      {points.length === 0 ? (
        <p className="text-sm text-ink-3">{t("dash.prio.empty")}</p>
      ) : (
        <>
          {trend && (
            <div
              className={cn(
                "mb-3 flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
                steady ? "border-line bg-white/[0.03]" : trend.change < 0 ? "border-good/25 bg-good-soft" : "border-warn/25 bg-warn-soft",
              )}
            >
              {trend.change < 0 ? (
                <TrendingDown className={cn("mt-0.5 h-4 w-4 shrink-0", steady ? "text-ink-3" : "text-good")} />
              ) : (
                <TrendingUp className={cn("mt-0.5 h-4 w-4 shrink-0", steady ? "text-ink-3" : "text-warn")} />
              )}
              <div className="min-w-0 text-[13px] leading-snug text-ink">
                <p>
                  {t(steady ? "dash.prio.steady" : trend.change < 0 ? "dash.prio.down" : "dash.prio.up", {
                    pct: f.pct(Math.abs(trend.change)),
                    from: f.amount(trend.first.superfluous),
                    fromMonth: f.monthName(trend.first.month),
                    to: f.amount(trend.last.superfluous),
                    toMonth: f.monthName(trend.last.month),
                  })}
                </p>
                <p className="mt-0.5 text-xs text-ink-3">
                  {t("dash.prio.shareLine", {
                    to: f.pct(trend.last.superfluous / trend.last.total),
                    toMonth: f.monthName(trend.last.month),
                    from: f.pct(trend.first.superfluous / trend.first.total),
                  })}
                </p>
              </div>
            </div>
          )}
          <ChartArea min="min-h-56">
            <ResponsiveContainer>
              <BarChart data={data} margin={{ top: share ? 4 : 20, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="label" {...axisProps} interval={0} />
                <YAxis {...axisProps} width={share ? 40 : 56} domain={share ? [0, 1] : undefined} tickFormatter={(v: number) => (share ? f.pct(v) : f.moneyCompact(v))} />
                <Tooltip
                  cursor={{ fill: "#ffffff08" }}
                  content={({ active, payload }) => {
                    const p = active && payload?.length ? (payload[0].payload as PriorityMonth) : null;
                    return p ? (
                      <TooltipBox
                        title={`${name(p)}${p.partial ? ` · ${t("dash.prio.soFar")}` : ""}`}
                        rows={[...STACK].reverse().map((k) => ({
                          label: `${t(`priority.${k}`)} · ${f.pct(p.total > 0 ? p[k] / p.total : 0)}`,
                          value: f.money(p[k]),
                          color: PRIORITY_COLORS[k],
                          kind: "rect" as const,
                        }))}
                      />
                    ) : null;
                  }}
                />
                {STACK.map((k, i) => (
                  <Bar
                    key={k}
                    dataKey={k}
                    stackId="priority"
                    fill={PRIORITY_COLORS[k]}
                    // a sliver of the card between the parts, and a rounded end on top
                    stroke={INK.surface}
                    strokeWidth={2}
                    radius={i === STACK.length - 1 ? [4, 4, 0, 0] : 0}
                    maxBarSize={44}
                    animationDuration={900}
                  >
                    {/* the month still going is drawn lighter */}
                    {data.map((d) => (
                      <Cell key={d.month} fillOpacity={d.partial ? 0.45 : 1} />
                    ))}
                    {!share && i === STACK.length - 1 && (
                      <LabelList dataKey="total" position="top" offset={6} fill={INK.secondary} fontSize={11} formatter={(v) => f.amount(Number(v))} />
                    )}
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </ChartArea>
        </>
      )}
    </ChartCard>
  );
}

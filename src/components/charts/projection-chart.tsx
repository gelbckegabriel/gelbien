"use client";

import { Landmark } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { projection, recentAverages } from "@/lib/finance";
import { accountsReserve } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { buttonClasses } from "../ui/button";
import { AnimatedNumber, EmptyState } from "../ui/misc";
import { axisProps, BAD, ChartArea, ChartCard, DataTable, GOOD, INK, TooltipBox } from "./kit";

export function ProjectionChart({ ds, month, className }: { ds: Dataset; month: string; className?: string }) {
  const { t, f } = useI18n();
  // starts from what's across the accounts; without any there's nothing to project from
  const reserve = accountsReserve(ds);
  if (reserve === null) {
    return (
      <ChartCard className={className} title={t("dash.proj.title")} subtitle={t("dash.proj.subtitle")}>
        <EmptyState
          icon={<Landmark className="h-6 w-6" />}
          title={t("dash.proj.noAccounts")}
          action={
            <Link href="/goals" className={buttonClasses("secondary", "sm")}>
              {t("dash.proj.addAccounts")}
            </Link>
          }
        />
      </ChartCard>
    );
  }
  const data = projection(ds, month, reserve, 12);
  const avg = recentAverages(ds, month);
  const end = data[data.length - 1].value;
  const rising = avg.saved >= 0;
  const color = rising ? GOOD : BAD;

  return (
    <ChartCard
      className={className}
      title={t("dash.proj.title")}
      subtitle={t("dash.proj.subtitle")}
      table={<DataTable head={["", t("dash.proj.reserve")]} rows={data.map((d) => [f.monthLong(d.month), f.money(d.value)])} />}
    >
      <div className="mb-3 flex items-baseline gap-2">
        <AnimatedNumber smallCents value={end} format={f.amount} className={rising ? "text-2xl font-semibold text-good" : "text-2xl font-semibold text-bad"} />
        <span className="text-xs text-ink-3">
          {t("dash.proj.in12")} · {f.moneySigned(avg.saved)}/{t("cycle.monthly").toLowerCase()}
        </span>
      </div>
      <ChartArea min="min-h-40">
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="proj-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                <stop offset="100%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={INK.grid} />
            <XAxis dataKey="month" {...axisProps} tickFormatter={(m: string) => f.monthShort(m)} interval="preserveStartEnd" minTickGap={20} />
            <YAxis {...axisProps} width={56} tickFormatter={(v: number) => f.moneyCompact(v)} />
            <ReferenceLine y={0} stroke={INK.axis} />
            <Tooltip
              cursor={{ stroke: "#ffffff30" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox title={f.monthLong(String(label))} rows={[{ label: t("dash.proj.reserve"), value: f.money(Number(payload[0].value)), color }]} />
                ) : null
              }
            />
            <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#proj-fill)" dot={false} activeDot={{ r: 4, stroke: INK.surface, strokeWidth: 2 }} animationDuration={1100} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartArea>
    </ChartCard>
  );
}

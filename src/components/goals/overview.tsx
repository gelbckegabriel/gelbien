"use client";

import { AlertTriangle, BellRing, CalendarPlus, Landmark, Plus } from "lucide-react";
import { motion } from "motion/react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { recentAverages } from "@/lib/finance";
import { checkInStatus, goalPlanFor, latestBalances, netWorth, netWorthSeries, signedBalance } from "@/lib/goals";
import { downloadFile } from "@/lib/files";
import { monthlyReminderIcs } from "@/lib/ics";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { useMutate } from "@/lib/data/hooks";
import { cn, currentMonth } from "@/lib/utils";
import { axisProps, ChartArea, ChartCard, DataTable, GOLD, INK, TooltipBox } from "../charts/kit";
import { ACCOUNT_TYPE_ICON, CategoryIcon } from "../icons";
import { GuardedLink } from "../shell/unsaved";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { Select } from "../ui/form";
import { AnimatedNumber, Delta, EmptyState } from "../ui/misc";

/** Goal contributions side by side with what the user actually saves each month. */
export function PlanCard({ ds }: { ds: Dataset }) {
  const { t, f } = useI18n();
  const r = recentAverages(ds, currentMonth());
  // income minus spending — negative when spending ran over (shown as is, not as $0)
  const saved = r.saved;
  const noIncome = r.income <= 0;
  const avg = Math.max(0, saved);
  const active = ds.goals.filter((g) => g.status === "active" && !goalPlanFor(ds, g).achieved);
  const allocated = active.reduce((a, g) => a + g.monthlyContribution, 0);
  const scale = Math.max(avg, allocated, 1);
  const free = saved - allocated;
  const range = r.from === r.to ? f.monthShort(r.from) : `${f.monthShort(r.from)} – ${f.monthShort(r.to)}`;

  return (
    <Card>
      <CardHeader title={t("goals.plan.title")} subtitle={t("goals.plan.subtitle")} />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <div>
          <p className="text-xs text-ink-3">{t("goals.plan.allocatedLabel")}</p>
          <AnimatedNumber value={allocated} format={f.money0} className="mt-1 block text-xl font-semibold text-ink" />
        </div>
        <div>
          <p className="text-xs text-ink-3">{t("goals.plan.savedLabel")}</p>
          {noIncome ? (
            <p className="mt-1 text-xl font-semibold text-ink-3">—</p>
          ) : (
            <AnimatedNumber value={saved} format={f.money0} className={cn("mt-1 block text-xl font-semibold", saved >= 0 ? "text-good" : "text-bad")} />
          )}
        </div>
        {!noIncome && (
          <p className={cn("col-span-2 flex items-center gap-1.5 self-end text-sm font-medium sm:col-span-1", free >= 0 ? "text-gold-bright" : "text-bad")}>
            {free < 0 && <AlertTriangle className="h-4 w-4 shrink-0" />}
            {free >= 0 ? t("goals.plan.free", { amount: f.money0(free) }) : t("goals.plan.over", { amount: f.money0(-free) })}
          </p>
        )}
      </div>
      {/* where "you save" comes from, so a surprising number can be checked */}
      <p className="mt-3 text-xs text-ink-3">
        {noIncome ? (
          <>
            {t("goals.plan.noIncome")}{" "}
            <GuardedLink href="/budget" className="text-gold hover:underline">
              {t("nav.budget")} →
            </GuardedLink>
          </>
        ) : (
          <>
            {r.months === 0
              ? t("goals.plan.fromBudget", { income: f.money0(r.income), spent: f.money0(r.spent) })
              : t("goals.plan.basis", { range, income: f.money0(r.income), spent: f.money0(r.spent) })}
            {r.missingIncome && r.months > 0 && <span className="text-warn"> {t("goals.plan.someMissing")}</span>}
          </>
        )}
      </p>

      <div className="relative mt-5 flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-white/[0.06]">
        {active.map((g, i) => (
          <motion.div
            key={g.id}
            className="h-full first:rounded-l-full"
            style={{ background: g.color }}
            title={`${g.name}: ${f.money0(g.monthlyContribution)}`}
            initial={{ width: 0 }}
            animate={{ width: `${(g.monthlyContribution / scale) * 100}%` }}
            transition={{ type: "spring", stiffness: 90, damping: 20, delay: i * 0.05 }}
          />
        ))}
        {/* marker for what you actually save */}
        {avg > 0 && <div className="absolute inset-y-0 w-0.5 bg-ink" style={{ left: `calc(${(avg / scale) * 100}% - 1px)` }} />}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {active.map((g) => (
          <li key={g.id} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: g.color }} />
            {g.name} <span className="tabular text-ink-3">{f.money0(g.monthlyContribution)}</span>
          </li>
        ))}
        {avg > 0 && (
          <li className="inline-flex items-center gap-1.5 text-xs text-ink-2">
            <span className="h-3 w-0.5 bg-ink" /> {t("goals.plan.avgSaved", { amount: f.money0(avg) })}
          </li>
        )}
      </ul>
    </Card>
  );
}

export function NetWorthCard({ ds, className }: { ds: Dataset; className?: string }) {
  const { t, f } = useI18n();
  const series = netWorthSeries(ds, currentMonth(), 12);
  const now = netWorth(ds);
  const prev = series.length > 1 ? series[series.length - 2].total : null;

  return (
    <ChartCard
      className={className}
      title={t("nw.title")}
      subtitle={t("nw.subtitle")}
      table={
        series.length ? (
          <DataTable
            head={["", t("nw.assets"), t("nw.debts"), t("nw.total")]}
            rows={series.map((p) => [f.monthLong(p.month), f.money0(p.assets), f.money0(p.debts), f.money0(p.total)])}
          />
        ) : undefined
      }
    >
      <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <AnimatedNumber value={now.total} format={f.money0} className={cn("text-3xl font-semibold tracking-tight", now.total < 0 ? "text-bad" : "text-ink")} />
        {prev !== null && prev !== 0 && prev !== now.total && <Delta value={(now.total - prev) / Math.abs(prev)} goodWhenUp format={f.pct1} />}
        <span className="text-xs text-ink-3">
          {t("nw.assets")} {f.money0(now.assets)} · {t("nw.debts")} {f.money0(now.debts)}
        </span>
      </div>
      {series.length === 0 ? (
        <p className="flex flex-1 items-center justify-center py-10 text-center text-sm text-ink-3">{t("nw.empty")}</p>
      ) : (
        <ChartArea min="min-h-52">
          <ResponsiveContainer>
            <AreaChart data={series} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="month" {...axisProps} tickFormatter={(m: string) => f.monthShort(m)} interval="preserveStartEnd" minTickGap={16} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => f.moneyCompact(v)} />
              <ReferenceLine y={0} stroke={INK.axis} />
              <Tooltip
                cursor={{ stroke: "#ffffff30" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as { assets: number; debts: number; total: number };
                  return (
                    <TooltipBox
                      title={f.monthLong(String(label))}
                      rows={[
                        { label: t("nw.total"), value: f.money0(p.total), color: GOLD },
                        { label: t("nw.assets"), value: f.money0(p.assets) },
                        { label: t("nw.debts"), value: f.money0(p.debts) },
                      ]}
                    />
                  );
                }}
              />
              <Area type="monotone" dataKey="total" stroke={GOLD} strokeWidth={2.25} fill="url(#nw-fill)" dot={{ r: 3, fill: GOLD, stroke: INK.surface, strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={1000} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartArea>
      )}
    </ChartCard>
  );
}

export function AccountsCard({
  ds,
  onAdd,
  onEdit,
  onCheckIn,
  className,
}: {
  ds: Dataset;
  onAdd: () => void;
  onEdit: (id: string) => void;
  onCheckIn: () => void;
  className?: string;
}) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const latest = latestBalances(ds.balances);
  const status = checkInStatus(ds);
  const stale = new Set(status.stale.map((a) => a.id));
  const accounts = [...ds.accounts].sort((a, b) => Number(a.archived) - Number(b.archived));

  const addReminder = () => {
    const ics = monthlyReminderIcs({
      title: t("ci.calendarEvent"),
      description: t("ci.due.body"),
      url: `${window.location.origin}/goals?checkin=1`,
      firstDate: status.nextDate,
      day: ds.settings.checkInDay,
    });
    downloadFile("gelbien-checkin.ics", ics, "text/calendar;charset=utf-8");
  };

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title={t("acc.title")}
        subtitle={t("acc.subtitle")}
        action={
          <Button size="icon-sm" variant="outline" onClick={onAdd} aria-label={t("acc.add")} title={t("acc.add")}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      />
      {accounts.length === 0 ? (
        <EmptyState icon={<Landmark className="h-6 w-6" />} title={t("acc.empty.title")} body={t("acc.empty.body")} />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {accounts.map((a) => {
            const b = latest.get(a.id);
            const value = b ? signedBalance(a, b.balance) : null;
            return (
              <li key={a.id}>
                <button
                  onClick={() => onEdit(a.id)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]", a.archived && "opacity-50")}
                >
                  <CategoryIcon icon={ACCOUNT_TYPE_ICON[a.type]} color={a.color} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">{a.name}</span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {a.institution || t(`acc.type.${a.type}`)}
                      {!a.archived && (
                        <span className={cn(stale.has(a.id) && "text-warn")} title={stale.has(a.id) ? t("acc.stale") : undefined}>
                          {" · "}
                          {b ? f.dateShort(b.date) : t("acc.noBalance")}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={cn("tabular shrink-0 text-[13px] font-medium", value !== null && value < 0 ? "text-bad" : "text-ink")}>
                    {value === null ? "—" : f.money0(value)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Check-in routine lives at the bottom of the card */}
      <div className="mt-auto space-y-3 border-t border-line pt-4">
        <div className="flex items-center gap-2">
          <BellRing className="h-4 w-4 shrink-0 text-gold" />
          <span className="flex-1 text-xs text-ink-3">{t("ci.next", { date: f.dateShort(status.nextDate) })}</span>
          <div className="w-28">
            <Select
              aria-label={t("ci.day")}
              value={ds.settings.checkInDay}
              onChange={(e) => mutate.mutate({ op: "saveSettings", settings: { ...ds.settings, checkInDay: Number(e.target.value) } })}
              className="h-9 text-base sm:text-sm"
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {t("ci.dayN", { day: d })}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {ds.accounts.some((a) => !a.archived) && (
            <Button size="sm" variant={status.due ? "primary" : "secondary"} onClick={onCheckIn}>
              {t("ci.button")}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={addReminder}>
            <CalendarPlus className="h-4 w-4" /> {t("ci.calendar")}
          </Button>
        </div>
      </div>
    </Card>
  );
}


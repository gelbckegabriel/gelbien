"use client";

import { BarChart3, Table2 } from "lucide-react";
import { motion } from "motion/react";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useI18n } from "@/lib/i18n";
import { growX } from "@/lib/motion";
import { balanceAt, planSchedule, yearlySplit } from "@/lib/plans";
import type { Plan } from "@/lib/types";
import { useView } from "@/lib/ui-store";
import { addMonths, cn, monthOf, round2, todayISO } from "@/lib/utils";
import { axisProps, DataTable, GOLD, INK, Legend, TooltipBox } from "../charts/kit";
import { Segmented } from "../ui/form";

/** What pays the loan itself down is gold (it becomes yours); interest is blue — a pair that stays apart for colour-blind eyes */
export const PRINCIPAL_COLOR = GOLD;
export const INTEREST_COLOR = "#3987e5";

const niceMax = (v: number, step: number) => Math.max(step, Math.ceil(v / step) * step);
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

/** One payment split in two: the part that pays the loan down and the interest, as a bar with both amounts. */
export function PaymentSplit({ label, principal, interest, className }: { label: React.ReactNode; principal: number; interest: number; className?: string }) {
  const { t, f } = useI18n();
  const total = round2(principal + interest);
  const share = total > 0 ? interest / total : 0;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="min-w-0 text-ink-3">{label}</span>
        <span className="tabular shrink-0 text-ink-2">{f.amount(total)}</span>
      </div>
      <div className="mt-1.5 flex h-2 gap-[2px] overflow-hidden rounded-full bg-white/5">
        {principal > 0 && <motion.div className="h-full origin-left" style={{ width: `${(1 - share) * 100}%`, background: PRINCIPAL_COLOR }} {...growX(0.05)} />}
        {interest > 0 && <motion.div className="h-full origin-left" style={{ width: `${share * 100}%`, background: INTEREST_COLOR }} {...growX(0.12)} />}
      </div>
      <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: PRINCIPAL_COLOR }} />
          {t("plans.split.principal")} <span className="tabular text-ink-2">{f.amount(principal)}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ background: INTEREST_COLOR }} />
          {t("plans.split.interest")} <span className="tabular text-ink-2">{f.amount(interest)}</span> · {f.pct(share)}
        </span>
      </div>
    </div>
  );
}

/**
 * A loan, two ways: what's still owed month by month (the current plan against the one being tried), or
 * where each year's payments go — paying the loan down, or interest (early on, mostly interest). Both have
 * the numbers as a table.
 */
export function LoanCharts({ plan, scenario, currency, marker }: { plan: Plan; scenario: Plan; currency: string; marker?: string }) {
  const { t, f } = useI18n();
  const [view, setView] = useView("plans.chart", "owed", ["owed", "split"] as const);
  const [shown, setShown] = useView("plans.chart.table", "chart", ["chart", "table"] as const);
  const today = todayISO();
  const base = planSchedule(plan, currency);
  const next = planSchedule(scenario, currency);
  const changed = JSON.stringify(plan.extras) !== JSON.stringify(scenario.extras) || plan.prepayments.length !== scenario.prepayments.length;

  // what's owed: one point a month from now to the later of the two ends
  const start = monthOf(today);
  const endBase = base.at(-1)?.date.slice(0, 7) ?? start;
  const endNext = next.at(-1)?.date.slice(0, 7) ?? start;
  const span = Math.max(12, monthsBetween(start, endBase > endNext ? endBase : endNext) + 1);
  const owedData = Array.from({ length: span + 1 }, (_, i) => {
    const m = addMonths(start, i);
    return { month: m, current: balanceAt(plan, `${m}-28`, currency), scenario: balanceAt(scenario, `${m}-28`, currency) };
  });
  const owedNow = balanceAt(plan, today, currency);

  // where it goes: each year of the plan being tried
  const years = yearlySplit(next);
  const baseYears = new Map(yearlySplit(base).map((y) => [y.year, y]));
  const thisYear = years.find((y) => y.year === today.slice(0, 4)) ?? years[0];
  const lastYear = years.at(-1);
  const share = (y?: { principal: number; interest: number }) => (y && y.principal + y.interest > 0 ? y.interest / (y.principal + y.interest) : 0);

  const table = (
    <DataTable
      head={[t("plans.split.year"), t("plans.split.principal"), t("plans.split.interest"), t("plans.split.owedEnd"), ...(changed ? [t("plans.sim.current")] : [])]}
      rows={years.map((y) => [y.year, f.money(y.principal), f.money(y.interest), f.money(y.balance), ...(changed ? [f.money(baseYears.get(y.year)?.balance ?? 0)] : [])])}
    />
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Segmented
          size="sm"
          value={view}
          onChange={setView}
          options={[
            { value: "owed" as const, label: t("plans.chart.owed") },
            { value: "split" as const, label: t("plans.chart.split") },
          ]}
        />
        <button
          type="button"
          onClick={() => setShown(shown === "table" ? "chart" : "table")}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-3 transition hover:bg-white/5 hover:text-ink"
          aria-label={shown === "table" ? t("common.chartView") : t("common.tableView")}
          title={shown === "table" ? t("common.chartView") : t("common.tableView")}
        >
          {shown === "table" ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
        </button>
      </div>

      {shown === "table" ? (
        <div className="mt-3 max-h-72 overflow-auto">{table}</div>
      ) : view === "owed" ? (
        <div className="mt-3">
          <Legend
            items={[
              { label: t("plans.sim.withExtras"), color: GOLD, kind: "line" },
              { label: t("plans.sim.current"), color: INK.secondary, kind: "line" },
            ]}
          />
          <div className="mt-2 h-56 w-full sm:h-64">
            <ResponsiveContainer>
              <ComposedChart data={owedData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="loan-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GOLD} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="month" {...axisProps} tickFormatter={(m: string) => m.slice(0, 4)} interval="preserveStartEnd" minTickGap={36} />
                <YAxis {...axisProps} width={56} tickFormatter={(v: number) => f.moneyCompact(v)} domain={[0, niceMax(owedNow, 1000)]} />
                {marker && <ReferenceLine x={marker} stroke={GOLD} strokeOpacity={0.4} strokeDasharray="2 3" />}
                <Tooltip
                  cursor={{ stroke: "#ffffff30" }}
                  content={({ active, payload, label }) =>
                    active && payload?.length ? (
                      <TooltipBox
                        title={f.monthLong(String(label))}
                        rows={[
                          { label: t("plans.sim.withExtras"), value: f.amount(Number(payload.find((p) => p.dataKey === "scenario")?.value ?? 0)), color: GOLD },
                          { label: t("plans.sim.current"), value: f.amount(Number(payload.find((p) => p.dataKey === "current")?.value ?? 0)), color: INK.secondary },
                        ]}
                      />
                    ) : null
                  }
                />
                <Line type="monotone" dataKey="current" stroke={INK.secondary} strokeWidth={1.5} strokeOpacity={0.8} dot={false} isAnimationActive={false} />
                <Area type="monotone" dataKey="scenario" stroke={GOLD} strokeWidth={2.25} fill="url(#loan-fill)" dot={false} isAnimationActive={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Legend
            items={[
              { label: t("plans.split.principal"), color: PRINCIPAL_COLOR, kind: "rect" },
              { label: t("plans.split.interest"), color: INTEREST_COLOR, kind: "rect" },
            ]}
          />
          <div className="mt-2 h-56 w-full sm:h-64">
            <ResponsiveContainer>
              <BarChart data={years} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={INK.grid} />
                <XAxis dataKey="year" {...axisProps} interval="preserveStartEnd" minTickGap={24} />
                <YAxis {...axisProps} width={56} tickFormatter={(v: number) => f.moneyCompact(v)} />
                <Tooltip
                  cursor={{ fill: "#ffffff0a" }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const y = years.find((x) => x.year === String(label));
                    return y ? (
                      <TooltipBox
                        title={String(label)}
                        rows={[
                          { label: t("plans.split.principal"), value: f.amount(y.principal), color: PRINCIPAL_COLOR },
                          { label: t("plans.split.interest"), value: `${f.amount(y.interest)} · ${f.pct(share(y))}`, color: INTEREST_COLOR },
                          { label: t("plans.split.owedEnd"), value: f.amount(y.balance) },
                        ]}
                      />
                    ) : null;
                  }}
                />
                <Bar dataKey="principal" stackId="pay" fill={PRINCIPAL_COLOR} isAnimationActive={false} />
                <Bar dataKey="interest" stackId="pay" fill={INTEREST_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className={cn("mt-2 text-xs leading-relaxed text-ink-3")}>
            {share(thisYear) > 0
              ? t("plans.split.caption", { year: thisYear!.year, pct: f.pct(share(thisYear)), last: lastYear!.year, lastPct: f.pct(share(lastYear)) })
              : t("plans.split.noInterest")}
          </p>
        </div>
      )}
    </div>
  );
}

"use client";

import { CalendarRange, Flame, Gauge, PiggyBank, Receipt, Repeat, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { CategoryDonut } from "@/components/charts/category-donut";
import { FlowSankey } from "@/components/charts/flow-sankey";
import { StatTile } from "@/components/charts/kit";
import { PaceChart } from "@/components/charts/pace-chart";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { WeekdayChart } from "@/components/charts/weekday-chart";
import { YearMatrix } from "@/components/charts/year-matrix";
import { BudgetBars, PaymentBreakdown, PrioritySplit, TopExpenses } from "@/components/dashboard/breakdowns";
import { Hero } from "@/components/dashboard/hero";
import { Insights } from "@/components/dashboard/insights";
import { Button } from "@/components/ui/button";
import { Card, Stagger } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { recentAverages, runway, subscriptionTotals, summarizeMonth, yearMatrix } from "@/lib/finance";
import { useDataset, useMode } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { addMonths } from "@/lib/utils";

export default function DashboardPage() {
  const ds = useDataset().data as Dataset;
  const month = useUi((s) => s.month);
  const openExpense = useUi((s) => s.openExpense);
  const { session } = useMode();
  const { t, f } = useI18n();

  const s = summarizeMonth(ds, month);
  const prev = summarizeMonth(ds, addMonths(month, -1));
  const subs = subscriptionTotals(ds.subscriptions);
  const year = yearMatrix(ds, Number(month.slice(0, 4)));
  const avg = recentAverages(ds, month);
  const run = runway(ds.settings.reserve, avg.spent, s.income.net);
  const change = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : NaN);

  return (
    // Every row is one grid row whose height comes from a "natural" block (text, lists, tiles);
    // the cards beside it stretch to that height and their charts grow to fill it — no gaps.
    <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="flex flex-col gap-4 lg:col-span-8">
        <Hero s={s} prevTotal={prev.total} name={session?.user?.name} />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile
            label={s.saved >= 0 ? t("dash.kpi.saved") : t("dash.kpi.deficit")}
            value={s.income.net > 0 ? s.saved : 0}
            format={f.money0}
            tone={s.income.net > 0 ? (s.saved >= 0 ? "good" : "bad") : undefined}
            icon={<PiggyBank className="h-4 w-4" />}
            sub={s.income.net > 0 ? `${f.pct(s.savingsRate)} · ${t("dash.kpi.income").toLowerCase()} ${f.money0(s.income.net)}` : "—"}
          />
          <StatTile
            label={t("dash.kpi.dailyAvg")}
            value={s.dailyAvg}
            format={f.money}
            icon={<Gauge className="h-4 w-4" />}
            delta={{ value: change(s.dailyAvg, prev.dailyAvg), goodWhenUp: false, format: f.pct, label: t("dash.vsLast") }}
          />
          <StatTile
            label={t("dash.kpi.superfluous")}
            value={s.superfluousShare}
            format={f.pct}
            tone={s.superfluousShare >= 0.25 ? "warn" : undefined}
            icon={<Flame className="h-4 w-4" />}
            sub={f.money0(s.byPriority.superfluous)}
          />
          <StatTile
            label={t("dash.kpi.runway")}
            value={run.sustainable ? 0 : run.months}
            format={(n) => (run.sustainable ? "∞" : t("dash.kpi.runwayValue", { n: f.num(n) }))}
            tone={run.sustainable ? "good" : run.months < 6 ? "bad" : undefined}
            icon={<ShieldCheck className="h-4 w-4" />}
            sub={`${run.sustainable ? `${t("dash.kpi.sustainable")} · ` : ""}${t("dash.proj.reserve")} ${f.money0(ds.settings.reserve)}`}
          />
          <StatTile label={t("dash.kpi.fixed")} value={s.fixed} format={f.money0} icon={<Wallet className="h-4 w-4" />} sub={`${t("dash.kpi.variable")} ${f.money0(s.variable)}`} />
          <StatTile
            label={t("dash.kpi.count")}
            value={s.count}
            format={(n) => String(Math.round(n))}
            icon={<Receipt className="h-4 w-4" />}
            sub={s.largest ? `${t("dash.kpi.largest")} ${f.money0(s.largest.amount)}` : undefined}
          />
          <StatTile
            label={t("dash.kpi.subscriptions")}
            value={subs.activeMonthly}
            format={f.money}
            icon={<Repeat className="h-4 w-4" />}
            sub={`${f.money0(subs.activeYearly)} / ${t("cycle.annual").toLowerCase()}`}
          />
          <StatTile
            label={t("dash.kpi.yearTotal", { year: month.slice(0, 4) })}
            value={year.yearTotal}
            format={f.money0}
            icon={<CalendarRange className="h-4 w-4" />}
            sub={`${t("dash.kpi.monthlyAvg")} ${f.money0(year.monthlyAverage)}`}
          />
        </div>
      </div>
      {/* Height-bound to the hero + KPI column on desktop; the insight list scrolls inside. */}
      <div className="relative lg:col-span-4">
        <Insights ds={ds} month={month} className="h-full lg:absolute lg:inset-0" />
      </div>

      {s.count === 0 ? (
        <Card className="lg:col-span-12">
          <EmptyState
            icon={<Receipt className="h-6 w-6" />}
            title={t("dash.empty.title", { month: f.monthLong(month) })}
            body={t("dash.empty.body")}
            action={
              <Button variant="primary" onClick={() => openExpense()}>
                {t("nav.add")}
              </Button>
            }
          />
        </Card>
      ) : null}

      <div className="lg:col-span-8">
        <PaceChart ds={ds} month={month} className="h-full" />
      </div>
      <div className="lg:col-span-4">
        <CategoryDonut summary={s} className="h-full" />
      </div>

      <div className="lg:col-span-12">
        <BudgetBars summary={s} />
      </div>

      <div className="lg:col-span-8">
        <TrendChart ds={ds} month={month} className="h-full" />
      </div>
      <div className="lg:col-span-4">
        <CalendarHeatmap summary={s} className="h-full" />
      </div>

      <div className="lg:col-span-8">
        <FlowSankey summary={s} className="h-full" />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-4">
        <PrioritySplit summary={s} />
        <PaymentBreakdown summary={s} className="flex-1" />
      </div>

      <div className="lg:col-span-5">
        <TopExpenses summary={s} ds={ds} className="h-full" />
      </div>
      <div className="flex flex-col gap-4 lg:col-span-7">
        <ProjectionChart ds={ds} month={month} className="flex-1" />
        <WeekdayChart ds={ds} className="flex-1" />
      </div>

      <div className="lg:col-span-12">
        <YearMatrix ds={ds} month={month} />
      </div>

      <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-ink-3 lg:col-span-12">
        <TrendingUp className="h-3.5 w-3.5" /> {t("app.tagline")}
      </p>
    </Stagger>
  );
}

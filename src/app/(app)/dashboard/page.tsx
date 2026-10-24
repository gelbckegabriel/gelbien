"use client";

import { CalendarRange, Flame, Gauge, PiggyBank, Receipt, Repeat, ShieldCheck, TrendingUp, Wallet } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { CategoryDonut } from "@/components/charts/category-donut";
import { FlowSankey } from "@/components/charts/flow-sankey";
import { StatTile } from "@/components/charts/kit";
import { PaceChart } from "@/components/charts/pace-chart";
import { PriorityTrend } from "@/components/charts/priority-trend";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { TrendChart } from "@/components/charts/trend-chart";
import { YearMatrix } from "@/components/charts/year-matrix";
import { DueBills, UpcomingBills, useSkippedBills } from "@/components/dashboard/bills";
import { BudgetBars, PaymentBreakdown, TopExpenses } from "@/components/dashboard/breakdowns";
import { GoalsSnapshot } from "@/components/dashboard/goals-snapshot";
import { Hero } from "@/components/dashboard/hero";
import { CheckInBanner } from "@/components/goals/checkin-banner";
import { ReviewPrompt } from "@/components/month-review";
import { Insights } from "@/components/dashboard/insights";
import { Commitments } from "@/components/plans/commitments";
import { TopMerchants } from "@/components/dashboard/merchants";
import { Button } from "@/components/ui/button";
import { Card, Stagger } from "@/components/ui/card";
import { Deferred } from "@/components/ui/deferred";
import { Delta, EmptyState } from "@/components/ui/misc";
import { monthForecast, recentAverages, runway, subscriptionTotals, summarizeMonth, yearMatrix } from "@/lib/finance";
import { committedBills } from "@/lib/bills";
import { commitments } from "@/lib/plans";
import { accountsReserve } from "@/lib/goals";
import { useDataset, useMode } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { useMediaQuery } from "@/lib/use-media";
import { addMonths, round2, todayISO } from "@/lib/utils";

export default function DashboardPage() {
  const ds = useDataset().data as Dataset;
  const month = useUi((s) => s.month);
  const openExpense = useUi((s) => s.openExpense);
  const { session } = useMode();
  const { t, f } = useI18n();
  const skipped = useSkippedBills();
  // a twelve-month grid needs the width: not even built on phones and small tablets
  const wide = useMediaQuery("(min-width: 768px)");

  // the month's numbers, worked out once per change of data or month — not on every render
  const { s, prev, subs, year, reserve, run, bills, forecast, hasPlans } = useMemo(() => {
    const s = summarizeMonth(ds, month);
    // the reserve is what's across the accounts (Goals), not a number typed in by hand
    const reserve = accountsReserve(ds);
    const today = todayISO();
    return {
      s,
      prev: summarizeMonth(ds, addMonths(month, -1)),
      subs: subscriptionTotals(ds.subscriptions),
      year: yearMatrix(ds, Number(month.slice(0, 4))),
      reserve,
      run: runway(reserve ?? 0, recentAverages(ds, month).spent, s.income.net),
      // bills this month with nothing logged yet — taken out of what's left to spend
      bills: round2(committedBills(ds, month, today, skipped).reduce((a, c) => a + c.sub.amount, 0)),
      // where this month is heading (the current month only)
      forecast: monthForecast(ds, month, today, skipped),
      // installments and loans still being paid: their card shows only while there are some
      hasPlans: commitments(ds).lines.length > 0,
    };
  }, [ds, month, skipped]);
  const noReserve = reserve === null && !run.sustainable;
  const change = (a: number, b: number) => (b ? (a - b) / Math.abs(b) : NaN);

  return (
    <>
      <CheckInBanner ds={ds} className="mb-4" />
      <ReviewPrompt ds={ds} className="mb-4" />
      <DueBills ds={ds} className="mb-4" />
      {/* Every row is one grid row whose height comes from a "natural" block (text, lists, tiles);
          the cards beside it stretch to that height and their charts grow to fill it — no gaps. */}
      <Stagger className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-8">
          <Hero s={s} prevTotal={prev.total} name={session?.user?.name} bills={bills} forecast={forecast} />
          {/* four across, except beside the insights on a laptop (lg), where four would be too narrow */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label={s.saved >= 0 ? t("dash.kpi.saved") : t("dash.kpi.deficit")}
              value={s.income.net > 0 ? s.saved : 0}
              format={f.amount}
              tone={s.income.net > 0 ? (s.saved >= 0 ? "good" : "bad") : undefined}
              icon={<PiggyBank className="h-4 w-4" />}
              detail={
                s.income.net > 0
                  ? { label: t("dash.kpi.savingsRate"), value: t("dash.kpi.rateOf", { pct: f.pct(s.savingsRate), amount: f.amount(s.income.net) }) }
                  : { label: t("dash.kpi.income"), value: "—" }
              }
            />
            <StatTile
              label={t("dash.kpi.dailyAvg")}
              value={s.dailyAvg}
              format={f.amount}
              icon={<Gauge className="h-4 w-4" />}
              detail={{ label: t("dash.vsLast"), value: <Delta value={change(s.dailyAvg, prev.dailyAvg)} goodWhenUp={false} format={f.pct} /> }}
            />
            <StatTile
              label={t("dash.kpi.superfluous")}
              value={s.superfluousShare}
              format={f.pct}
              tone={s.superfluousShare >= 0.25 ? "warn" : undefined}
              icon={<Flame className="h-4 w-4" />}
              detail={{ label: t("dash.kpi.spent"), value: f.amount(s.byPriority.superfluous) }}
            />
            <StatTile
              label={t("dash.kpi.runway")}
              value={run.sustainable || noReserve ? 0 : run.months}
              format={(n) => (run.sustainable ? "∞" : noReserve ? "—" : t("dash.kpi.runwayValue", { n: f.num(n) }))}
              tone={run.sustainable ? "good" : !noReserve && run.months < 6 ? "bad" : undefined}
              icon={<ShieldCheck className="h-4 w-4" />}
              detail={
                reserve === null
                  ? {
                      label: t("dash.proj.reserve"),
                      value: (
                        <Link href="/goals" className="text-gold hover:underline">
                          {t("dash.kpi.addAccounts")}
                        </Link>
                      ),
                    }
                  : { label: run.sustainable ? t("dash.kpi.reserveSustainable") : t("dash.proj.reserve"), value: f.amount(reserve) }
              }
            />
            <StatTile label={t("dash.kpi.fixed")} value={s.fixed} format={f.amount} icon={<Wallet className="h-4 w-4" />} detail={{ label: t("dash.kpi.variable"), value: f.amount(s.variable) }} />
            <StatTile
              label={t("dash.kpi.count")}
              value={s.count}
              format={(n) => String(Math.round(n))}
              icon={<Receipt className="h-4 w-4" />}
              detail={{ label: t("dash.kpi.largest"), value: s.largest ? f.amount(s.largest.amount) : "—" }}
            />
            <StatTile
              label={t("dash.kpi.recurring")}
              value={subs.activeMonthly}
              format={f.amount}
              icon={<Repeat className="h-4 w-4" />}
              detail={{ label: t("dash.kpi.subscriptions"), value: f.amount(subs.subscriptionsMonthly) }}
            />
            <StatTile
              label={t("dash.kpi.yearTotal", { year: month.slice(0, 4) })}
              value={year.yearTotal}
              format={f.amount}
              icon={<CalendarRange className="h-4 w-4" />}
              detail={{ label: t("dash.kpi.monthlyAvg"), value: f.amount(year.monthlyAverage) }}
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

        {/* Below the hero, each row pairs a wide chart or list with one narrow card of about the same height, and
            nothing narrower than a third of the page (on a laptop the narrow side gets a little more). */}
        <Deferred className="lg:col-span-7 xl:col-span-8" estimate={340}>
          <PaceChart ds={ds} month={month} forecast={forecast} budget={s.budgetTotal} className="h-full" />
        </Deferred>
        <Deferred className="lg:col-span-5 xl:col-span-4" estimate={340}>
          <CategoryDonut summary={s} className="h-full" />
        </Deferred>

        {/* big screens: budgets beside the bills, then goals beside the projection; a laptop: budgets across,
            bills and goals side by side, the projection across */}
        <Deferred className="lg:col-span-12 xl:col-span-8">
          <BudgetBars summary={s} className="h-full" />
        </Deferred>
        <Deferred className="lg:col-span-6 xl:col-span-4">
          <UpcomingBills ds={ds} className="h-full" />
        </Deferred>
        <Deferred className="lg:col-span-6 xl:col-span-4">
          <GoalsSnapshot ds={ds} className="h-full" />
        </Deferred>
        <Deferred className="lg:col-span-12 xl:col-span-8" estimate={340}>
          <ProjectionChart ds={ds} month={month} className="h-full" />
        </Deferred>
        {hasPlans && (
          <Deferred className="lg:col-span-12">
            <Commitments ds={ds} />
          </Deferred>
        )}

        <Deferred className="lg:col-span-7 xl:col-span-8" estimate={340}>
          <TrendChart ds={ds} month={month} className="h-full" />
        </Deferred>
        <Deferred className="lg:col-span-5 xl:col-span-4" estimate={300}>
          <CalendarHeatmap summary={s} className="h-full" />
        </Deferred>

        <Deferred className="lg:col-span-7 xl:col-span-8" estimate={360}>
          <FlowSankey summary={s} className="h-full" />
        </Deferred>
        <Deferred className="lg:col-span-5 xl:col-span-4">
          <TopMerchants ds={ds} month={month} className="h-full" />
        </Deferred>

        <Deferred className="lg:col-span-5 xl:col-span-6">
          <TopExpenses summary={s} ds={ds} className="h-full" />
        </Deferred>
        {/* stacked cards are never squeezed below their content (cards clip overflow, so flex would otherwise shrink them past it) */}
        <div className="flex flex-col gap-4 lg:col-span-7 xl:col-span-6">
          <Deferred className="flex-auto shrink-0">
            <PriorityTrend ds={ds} month={month} className="h-full" />
          </Deferred>
          <Deferred className="flex-auto shrink-0" estimate={200}>
            <PaymentBreakdown summary={s} styles={ds.settings.paymentStyles} className="h-full" />
          </Deferred>
        </div>

        {wide && (
          <Deferred className="lg:col-span-12" estimate={300}>
            <YearMatrix ds={ds} month={month} />
          </Deferred>
        )}

        <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-xs text-ink-3 lg:col-span-12">
          <TrendingUp className="h-3.5 w-3.5" /> {t("app.tagline")}
        </p>
      </Stagger>
    </>
  );
}

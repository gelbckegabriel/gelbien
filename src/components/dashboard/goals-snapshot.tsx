"use client";

import { Target } from "lucide-react";
import { motion } from "motion/react";
import { goalPlanFor, netWorthSeries } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import { growX } from "@/lib/motion";
import type { Dataset } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";
import { goalBadge, goalHold, HoldBadge } from "../goals/goal-card";
import { CategoryIcon } from "../icons";
import { GuardedLink } from "../shell/unsaved";
import { Card, CardHeader } from "../ui/card";
import { MoneyText } from "../ui/misc";

const SHOWN = 4;

/** The Goals page in a glance: each goal's progress and when it lands, and net worth. */
export function GoalsSnapshot({ ds, className }: { ds: Dataset; className?: string }) {
  const { t, f } = useI18n();
  const today = todayISO();
  const ym = (m: string) => `${f.monthShort(m)} ${m.slice(0, 4)}`;
  // the ones still being worked on first, then paused, then reached — each group in its own order
  const rank = (done: boolean, status: string) => (done ? 2 : status === "paused" ? 1 : 0);
  const goals = ds.goals
    .map((goal) => ({ goal, plan: goalPlanFor(ds, goal, today) }))
    .sort((a, b) => rank(a.plan.achieved || a.goal.status === "achieved", a.goal.status) - rank(b.plan.achieved || b.goal.status === "achieved", b.goal.status) || a.goal.order - b.goal.order);
  const series = netWorthSeries(ds, today.slice(0, 7), 6);

  const open = (
    <GuardedLink href="/goals" className="text-[13px] text-gold hover:underline">
      {t("dash.goals.open")} →
    </GuardedLink>
  );

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title={t("goals.title")} subtitle={t("dash.goals.subtitle")} action={goals.length ? open : undefined} />
      {goals.length === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-3">
          <p className="flex items-start gap-2 text-sm text-ink-3">
            <Target className="mt-0.5 h-4 w-4 shrink-0" /> {t("dash.goals.empty")}
          </p>
          <GuardedLink href="/goals" className="text-[13px] text-gold hover:underline">
            {t("dash.goals.create")} →
          </GuardedLink>
        </div>
      ) : (
        <ul className="space-y-4">
          {goals.slice(0, SHOWN).map(({ goal, plan: p }, i) => {
            const achieved = p.achieved || goal.status === "achieved";
            const hold = goalHold(goal, p);
            const when = achieved
              ? t("dash.goals.reached")
              : hold && hold.kind !== "skipping"
                ? hold.start
                  ? t("dash.goals.starts", { date: ym(hold.start) })
                  : t("goals.hold.waiting")
                : p.eta
                  ? ym(p.eta)
                  : "—";
            return (
              <li key={goal.id}>
                <div className="flex items-center gap-2.5">
                  <CategoryIcon icon={goal.icon} color={goal.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{goal.name}</span>
                  {hold ? <HoldBadge hold={hold} /> : goalBadge(goal, p, t)}
                </div>
                <div className="ml-[2.375rem] mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <motion.div
                    className="h-full origin-left rounded-full"
                    style={{
                      width: `${p.progress * 100}%`,
                      background: achieved
                        ? "linear-gradient(90deg,#f3d894,#d9b45f)"
                        : hold
                          ? `repeating-linear-gradient(135deg, ${goal.color} 0 5px, ${goal.color}73 5px 10px)`
                          : goal.color,
                    }}
                    {...growX(0.1 + i * 0.05, 70, 18)}
                  />
                </div>
                {/* the bar shows how far along; the date drops under the amounts when the card is narrow */}
                <div className="ml-[2.375rem] mt-1.5 flex flex-wrap items-baseline justify-between gap-x-2 text-xs">
                  <span className="tabular text-ink-2">
                    {f.amount(p.current)} <span className="text-ink-3">{t("goals.of", { target: f.amount(p.target) })}</span>
                  </span>
                  <span className="text-ink-3">{when}</span>
                </div>
              </li>
            );
          })}
          {goals.length > SHOWN && <li className="ml-[2.375rem] text-xs text-ink-3">{t("dash.goals.more", { n: goals.length - SHOWN })}</li>}
        </ul>
      )}

      {/* pushed to the bottom when the card is stretched to its row */}
      <div className="flex-1" />
      {series.length > 0 && (
        <div className="mt-5 border-t border-line/70 pt-4">
          <NetWorthMini series={series} />
        </div>
      )}
    </Card>
  );
}

/** Net worth now, a six-month line, and the change since the line starts */
function NetWorthMini({ series }: { series: { month: string; total: number }[] }) {
  const { t, f } = useI18n();
  const now = series[series.length - 1].total;
  const change = series.length > 1 ? now - series[0].total : null;
  const lo = Math.min(...series.map((p) => p.total));
  const hi = Math.max(...series.map((p) => p.total));
  const pts = series.map((p, i) => [series.length > 1 ? (i / (series.length - 1)) * 60 : 30, hi > lo ? 18 - ((p.total - lo) / (hi - lo)) * 16 : 10] as const);
  const rising = change === null || change >= 0;
  const stroke = rising ? "#36c47c" : "#f2605f";
  return (
    <div className="flex items-end justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs text-ink-3">{t("nw.total")}</p>
        <p className={cn("tabular-nums mt-1 text-lg font-semibold", now < 0 ? "text-bad" : "text-ink")}>
          <MoneyText text={f.amount(now)} />
        </p>
        {change !== null && (
          <p className={cn("tabular text-xs", rising ? "text-good" : "text-bad")}>
            {t("dash.goals.nwChange", { amount: `${change >= 0 ? "+" : "−"}${f.amount(Math.abs(change))}`, month: f.monthShort(series[0].month) })}
          </p>
        )}
      </div>
      {series.length > 1 && (
        <svg viewBox="-2 -2 64 24" className="mb-1 h-9 w-24 shrink-0 overflow-visible" aria-hidden>
          <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={2.5} fill={stroke} />
        </svg>
      )}
    </div>
  );
}

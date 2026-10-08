"use client";

import { CalendarCheck, CalendarClock, CalendarOff, Flag, Hourglass, Link2, Plus, SlidersHorizontal, Trophy } from "lucide-react";
import { motion } from "motion/react";
import { contributes, type GoalPlan } from "@/lib/goals";
import { useI18n, type Formatters, type TFn } from "@/lib/i18n";
import { growX } from "@/lib/motion";
import type { Account, Goal } from "@/lib/types";
import { cn, currentMonth, monthOf } from "@/lib/utils";
import { CategoryIcon } from "../icons";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge, MoneyText } from "../ui/misc";
import { monthList } from "./schedule-fields";

/** "in 14 months" / "in ~4.5 years" / "not reachable at this pace" */
export function durationText(t: TFn, f: Formatters, months: number | null): string {
  if (months === null) return t("goals.never");
  if (months < 24) return t("goals.inMonths", { n: months });
  return t("goals.inYears", { n: f.num(Math.round(months / 6) / 2) });
}

export function goalBadge(goal: Goal, plan: GoalPlan, t: TFn) {
  if (plan.achieved || goal.status === "achieved") return <Badge tone="gold">{t("goals.status.achieved")}</Badge>;
  if (goal.status === "paused") return <Badge>{t("goals.status.paused")}</Badge>;
  if (plan.onTrack === null) return <Badge>{t("goals.status.noDeadline")}</Badge>;
  return plan.onTrack ? <Badge tone="good">{t("goals.status.onTrack")}</Badge> : <Badge tone="warn">{t("goals.status.behind")}</Badge>;
}

/** Why nothing goes into an active goal this month, if nothing does */
export function goalHold(goal: Goal, plan: GoalPlan, month = currentMonth()): { kind: "waiting" | "later" | "skipping"; start: string | null } | null {
  const s = plan.schedule;
  if (!s || plan.achieved || goal.status !== "active" || contributes(s, month)) return null;
  if (s.start !== null && s.start <= month) return { kind: "skipping", start: s.start };
  return { kind: goal.afterGoalId ? "waiting" : "later", start: s.start };
}

/** Next to On track / Behind: a dashed tag for a goal nothing goes into right now, and why */
function HoldBadge({ hold, title }: { hold: NonNullable<ReturnType<typeof goalHold>>; title?: string }) {
  const { t, f } = useI18n();
  const Icon = { waiting: Hourglass, later: CalendarClock, skipping: CalendarOff }[hold.kind];
  const start = hold.start ?? "";
  // "Jan", or "Jan ’28" when it isn't this year
  const when = start ? `${f.monthShort(start)}${start.slice(0, 4) !== currentMonth().slice(0, 4) ? ` ’${start.slice(2, 4)}` : ""}` : "";
  return (
    <span title={title}>
      <Badge className="border-dashed border-line-strong bg-transparent text-ink-2">
        <Icon className="h-3 w-3" aria-hidden />
        {hold.kind === "waiting" ? t("goals.hold.waiting") : hold.kind === "later" ? t("goals.hold.later", { month: when }) : t("goals.hold.skipping")}
      </Badge>
    </span>
  );
}

export function GoalCard({
  goal,
  plan,
  accounts,
  after,
  onEdit,
  onSimulate,
  onAddMoney,
  index,
}: {
  goal: Goal;
  plan: GoalPlan;
  accounts: Account[];
  /** the goal this one waits for */
  after?: Goal;
  onEdit: () => void;
  onSimulate: () => void;
  onAddMoney: () => void;
  index: number;
}) {
  const { t, f } = useI18n();
  const achieved = plan.achieved || goal.status === "achieved";
  const linked = accounts.filter((a) => goal.accountIds.includes(a.id));
  // when the contributions start, if that isn't now
  const now = currentMonth();
  const start = plan.schedule?.start;
  const startText = after
    ? start === null
      ? t(after.status === "paused" ? "goals.waitsForPaused" : "goals.waitsForNever", { goal: after.name })
      : start && start > now
        ? t("goals.startsAfter", { date: f.monthLong(start), goal: after.name })
        : null
    : goal.startMonth > now
      ? t("goals.startsOn", { date: f.monthLong(goal.startMonth) })
      : null;
  const hold = goalHold(goal, plan, now);

  return (
    <Card className={cn("flex flex-col", goal.status === "paused" && "opacity-70")}>
      {achieved && <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,#d9b45f40,transparent_70%)]" />}
      <button onClick={onEdit} className="-m-2 flex flex-1 flex-col rounded-2xl p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/50">
        <div className="flex items-start gap-3">
          <CategoryIcon icon={goal.icon} color={goal.color} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink">{goal.name}</p>
            {linked.length > 0 ? (
              <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
                <Link2 className="h-3 w-3 shrink-0" />
                {t("goals.linkedTo", { accounts: linked.map((a) => a.institution || a.name).join(", ") })}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            {goalBadge(goal, plan, t)}
            {hold && <HoldBadge hold={hold} title={startText ?? (hold.kind === "skipping" ? t("goals.skips", { months: monthList(f, goal.pausedMonths) }) : undefined)} />}
          </div>
        </div>

        <div className="mt-5 flex items-baseline gap-2">
          <span className="tabular-nums text-2xl font-semibold tracking-tight text-ink">
            <MoneyText text={f.amount(plan.current)} />
          </span>
          <span className="text-sm text-ink-3">{t("goals.of", { target: f.amount(plan.target) })}</span>
          <span className="tabular ml-auto text-sm font-medium text-ink-2">{f.pct(plan.progress)}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full origin-left transition-[width] duration-500 ease-out"
            style={{
              // striped while nothing goes in
              background: achieved
                ? "linear-gradient(90deg,#f3d894,#d9b45f)"
                : hold
                  ? `repeating-linear-gradient(135deg, ${goal.color} 0 5px, ${goal.color}73 5px 10px)`
                  : goal.color,
              width: `${plan.progress * 100}%`,
            }}
            {...growX(0.1 + index * 0.05, 70, 18)}
          />
        </div>

        <ul className="mt-4 space-y-1.5 text-[13px]">
          <li className="flex items-start gap-2 text-ink-2 [&>svg]:mt-[3px]">
            {achieved ? <Trophy className="h-3.5 w-3.5 shrink-0 text-gold" /> : <CalendarCheck className="h-3.5 w-3.5 shrink-0 text-ink-3" />}
            <span className="min-w-0">
              {achieved
                ? t("goals.congrats")
                : plan.eta
                  ? `${t("goals.eta", { date: f.monthLong(plan.eta) })} · ${durationText(t, f, plan.months)}`
                  : t("goals.never")}
            </span>
          </li>
          {goal.targetDate && !achieved && (
            <li className="flex items-start gap-2 text-ink-3 [&>svg]:mt-[3px]">
              <Flag className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">
                {t("goals.deadline", { date: f.monthLong(monthOf(goal.targetDate)) })}
                {plan.requiredMonthly !== null && plan.requiredMonthly > 0 && (
                  <span className={cn(!plan.onTrack && "text-warn")}> · {t("goals.needs", { amount: f.amount(plan.requiredMonthly) })}</span>
                )}
              </span>
            </li>
          )}
          {startText && !achieved && (
            <li className={cn("flex items-start gap-2 [&>svg]:mt-[3px]", start === null ? "text-warn" : "text-ink-3")}>
              <Hourglass className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">{startText}</span>
            </li>
          )}
          {goal.pausedMonths.length > 0 && !achieved && (
            <li className="flex items-start gap-2 text-ink-3 [&>svg]:mt-[3px]">
              <CalendarOff className="h-3.5 w-3.5 shrink-0" />
              <span className="min-w-0">{t("goals.skips", { months: monthList(f, goal.pausedMonths) })}</span>
            </li>
          )}
        </ul>
      </button>

      <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
        <span className="tabular text-[13px] font-medium text-ink">{t("goals.perMonth", { amount: f.amount(goal.monthlyContribution) })}</span>
        {goal.annualReturn !== 0 && <span className="text-xs text-ink-3">· {t("goals.perYear", { pct: f.pct1(goal.annualReturn / 100) })}</span>}
        <div className="ml-auto flex gap-1">
          {!goal.accountIds.length && !achieved && (
            <Button size="icon-sm" variant="ghost" onClick={onAddMoney} aria-label={t("goals.addMoney")} title={t("goals.addMoney")}>
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onSimulate}>
            <SlidersHorizontal className="h-3.5 w-3.5" /> {t("goals.simulate")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

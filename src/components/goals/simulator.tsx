"use client";

import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useMutate, useSaving } from "@/lib/data/hooks";
import { avgSuperfluous, goalCurrent, goalPlanFor, MAX_MONTHS, planGoal, projectBalance } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import type { Dataset, Goal } from "@/lib/types";
import { addMonths, cn, currentMonth, round2 } from "@/lib/utils";
import { axisProps, GOLD, INK, Legend, TooltipBox } from "../charts/kit";
import { CategoryIcon } from "../icons";
import { Button } from "../ui/button";
import { Field, MonthField } from "../ui/form";
import { AnimatedNumber } from "../ui/misc";
import { Sheet } from "../ui/sheet";
import { Slider } from "../ui/slider";
import { durationText } from "./goal-card";

const niceMax = (v: number, step: number) => Math.max(step, Math.ceil(v / step) * step);

export function Simulator({ ds, goal, open, onClose }: { ds: Dataset; goal: Goal | null; open: boolean; onClose: () => void }) {
  if (!goal) return null;
  return <SimulatorInner key={goal.id} ds={ds} goal={goal} open={open} onClose={onClose} />;
}

function SimulatorInner({ ds, goal, open, onClose }: { ds: Dataset; goal: Goal; open: boolean; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const base = goalPlanFor(ds, goal);
  const current = goalCurrent(ds, goal);
  const superfluous = avgSuperfluous(ds);

  const initial = {
    monthly: goal.monthlyContribution,
    annualReturn: goal.annualReturn,
    boost: 0,
    target: goal.target,
    targetMonth: goal.targetDate ? goal.targetDate.slice(0, 7) : "",
    cut: 0,
  };
  const [s, setS] = useState(initial);
  const set = (patch: Partial<typeof initial>) => setS((cur) => ({ ...cur, ...patch }));

  const extra = round2((superfluous * s.cut) / 100);
  const scenario = planGoal({
    current: current + s.boost,
    target: s.target,
    monthly: s.monthly + extra,
    annualReturn: s.annualReturn,
    targetDate: s.targetMonth ? `${s.targetMonth}-01` : "",
  });

  // Chart horizon: long enough to show both plans (and the deadline) reaching the target.
  const now = currentMonth();
  const horizon = Math.min(
    MAX_MONTHS,
    Math.max(12, Math.max(base.months ?? 0, scenario.months ?? 0, scenario.monthsToDeadline ?? 0, base.months === null && scenario.months === null ? 120 : 0) + 3),
  );
  const planPath = projectBalance(base.current, base.monthly, base.annualReturn, horizon);
  const scenPath = projectBalance(scenario.current, scenario.monthly, scenario.annualReturn, horizon);
  const data = planPath.map((p, i) => ({ month: addMonths(now, i), plan: p, scenario: scenPath[i] }));

  const diff = base.months !== null && scenario.months !== null ? base.months - scenario.months : null;
  const monthlyMax = niceMax(Math.max(goal.monthlyContribution * 3, (scenario.requiredMonthly ?? 0) * 1.5, 1000), 100);
  const targetStep = goal.target >= 20000 ? 500 : 100;
  const tick = (m: string) => `${f.monthShort(m)} ’${m.slice(2, 4)}`;

  const apply = async () => {
    if (saving) return;
    const next: Goal = {
      ...goal,
      monthlyContribution: Math.round(s.monthly + extra),
      annualReturn: s.annualReturn,
      target: round2(s.target),
      targetDate: s.targetMonth ? `${s.targetMonth}-01` : "",
      // a deposit can only be recorded on goals tracked by hand; linked accounts show it at the next check-in
      saved: goal.accountIds.length ? goal.saved : round2(goal.saved + s.boost),
    };
    if (!(await run(() => mutate.save({ op: "upsertGoal", goal: next })))) return;
    toast.success(t("sim.applied"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={
        <span className="flex items-center gap-3">
          <CategoryIcon icon={goal.icon} color={goal.color} size="sm" /> {t("sim.title", { name: goal.name })}
        </span>
      }
      description={t("sim.subtitle")}
      wide
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setS(initial)}>
            <RotateCcw className="h-4 w-4" /> {t("common.reset")}
          </Button>
          <Button variant="primary" className="ml-auto px-6" onClick={apply} disabled={saving}>
            {saving ? t("common.saving") : t("sim.apply")}
          </Button>
        </div>
      }
    >
      {/* Outcome — on phones the headline date gets its own row so no tile is squeezed */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 rounded-2xl border border-gold/25 bg-gold-soft/60 p-3 sm:col-span-1">
          <p className="text-[11px] text-ink-3">{t("sim.reached")}</p>
          <p className="mt-1 text-lg font-semibold text-gold-bright">{scenario.achieved ? "✓" : scenario.eta ? f.monthLong(scenario.eta) : "—"}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
          <p className="text-[11px] text-ink-3">{t("sim.time")}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{scenario.achieved ? "—" : durationText(t, f, scenario.months)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
          <p className="text-[11px] text-ink-3">{t("sim.needed")}</p>
          {scenario.requiredMonthly === null ? (
            <p className="mt-1 text-lg font-semibold text-ink-3">—</p>
          ) : (
            <AnimatedNumber
              value={scenario.requiredMonthly}
              format={(n) => t("goals.perMonth", { amount: f.money0(n) })}
              className={cn("mt-1 block text-lg font-semibold", scenario.onTrack ? "text-good" : "text-warn")}
            />
          )}
        </div>
      </div>
      <p
        className={cn(
          "mt-3 flex items-center gap-1.5 text-sm",
          diff === null || diff === 0 ? "text-ink-3" : diff > 0 ? "text-good" : "text-bad",
        )}
      >
        {diff !== null && diff > 0 && <ArrowUp className="h-4 w-4" />}
        {diff !== null && diff < 0 && <ArrowDown className="h-4 w-4" />}
        {diff === null || diff === 0 ? t("sim.same") : diff > 0 ? t("sim.sooner", { n: diff }) : t("sim.later", { n: -diff })}
      </p>

      {/* Chart */}
      <div className="mt-4">
        <Legend
          items={[
            { label: t("sim.scenario"), color: GOLD, kind: "line" },
            { label: t("sim.plan"), color: INK.secondary, kind: "line" },
            { label: t("sim.targetLine"), color: "#36c47c", kind: "line" },
          ]}
        />
        <div className="mt-2 h-56 w-full sm:h-64">
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="sim-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={GOLD} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={INK.grid} />
              <XAxis dataKey="month" {...axisProps} tickFormatter={tick} interval="preserveStartEnd" minTickGap={28} />
              <YAxis {...axisProps} width={56} tickFormatter={(v: number) => f.moneyCompact(v)} />
              <ReferenceLine y={s.target} stroke="#36c47c" strokeOpacity={0.7} />
              {s.targetMonth && s.targetMonth <= data[data.length - 1].month && (
                <ReferenceLine x={s.targetMonth} stroke={INK.muted} label={{ value: tick(s.targetMonth), position: "insideTopRight", fill: INK.muted, fontSize: 11 }} />
              )}
              <Tooltip
                cursor={{ stroke: "#ffffff30" }}
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipBox
                      title={f.monthLong(String(label))}
                      rows={[
                        { label: t("sim.scenario"), value: f.money0(Number(payload.find((p) => p.dataKey === "scenario")?.value ?? 0)), color: GOLD },
                        { label: t("sim.plan"), value: f.money0(Number(payload.find((p) => p.dataKey === "plan")?.value ?? 0)), color: INK.secondary },
                      ]}
                    />
                  ) : null
                }
              />
              <Line type="monotone" dataKey="plan" stroke={INK.secondary} strokeWidth={1.5} strokeOpacity={0.8} dot={false} isAnimationActive={false} />
              <Area type="monotone" dataKey="scenario" stroke={GOLD} strokeWidth={2.25} fill="url(#sim-fill)" dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
        <Slider
          label={t("sim.monthly")}
          value={s.monthly}
          min={0}
          max={monthlyMax}
          step={10}
          onChange={(v) => set({ monthly: v })}
          display={t("goals.perMonth", { amount: f.money0(s.monthly) })}
        />
        <Slider
          label={t("sim.return")}
          value={s.annualReturn}
          min={0}
          max={12}
          step={0.5}
          onChange={(v) => set({ annualReturn: v })}
          display={t("goals.perYear", { pct: f.pct1(s.annualReturn / 100) })}
        />
        <Slider
          label={t("sim.boost")}
          value={s.boost}
          min={0}
          max={niceMax(Math.max(goal.target - current, 1000), 100)}
          step={100}
          onChange={(v) => set({ boost: v })}
          display={f.money0(s.boost)}
        />
        <Slider
          label={t("sim.target")}
          value={s.target}
          min={Math.max(targetStep, Math.floor((goal.target * 0.5) / targetStep) * targetStep)}
          max={niceMax(goal.target * 1.5, targetStep)}
          step={targetStep}
          onChange={(v) => set({ target: v })}
          display={f.money0(s.target)}
        />
        <Slider
          label={t("sim.cut")}
          value={s.cut}
          min={0}
          max={100}
          step={5}
          onChange={(v) => set({ cut: v })}
          display={f.pct(s.cut / 100)}
          hint={superfluous > 0 ? t("sim.cutHint", { amount: f.money0(extra), avg: f.money0(superfluous) }) : undefined}
        />
        <Field label={t("sim.date")} hint={t("goals.f.optional")}>
          <MonthField value={s.targetMonth} min={addMonths(now, 1)} onChange={(targetMonth) => set({ targetMonth })} />
        </Field>
      </div>
    </Sheet>
  );
}

"use client";

import { ArrowDownToLine, FastForward, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutate, useSaving } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { planSchedule, planStanding } from "@/lib/plans";
import type { Dataset, Plan, PrepayMode } from "@/lib/types";
import { addMonths, cn, currentMonth, round2, todayISO } from "@/lib/utils";
import { Button } from "../ui/button";
import { ChoiceCards, Field, MonthField } from "../ui/form";
import { AnimatedNumber } from "../ui/misc";
import { Sheet } from "../ui/sheet";
import { Slider } from "../ui/slider";
import { LoanCharts } from "./loan-charts";
import { PLAN_ICON, termText } from "./plan-dialog";

const niceMax = (v: number, step: number) => Math.max(step, Math.ceil(v / step) * step);

export function PlanSimulator({ ds, plan, open, onClose }: { ds: Dataset; plan: Plan | null; open: boolean; onClose: () => void }) {
  if (!plan) return null;
  return <SimulatorInner key={plan.id} ds={ds} plan={plan} open={open} onClose={onClose} />;
}

/**
 * What paying more does to a loan: an extra amount every month from now on, and/or a one-time payment in
 * a month to come — finishing sooner, or keeping the end date and paying less each month.
 */
function SimulatorInner({ ds, plan, open, onClose }: { ds: Dataset; plan: Plan; open: boolean; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const today = todayISO();
  const currency = ds.settings.currency;
  const now = planStanding(plan, ds, today);
  // changes start with the next payment
  const from = now.next ? now.next.date.slice(0, 7) : addMonths(currentMonth(), 1);
  const currentExtra = plan.extras.filter((e) => e.from <= from).sort((a, b) => (a.from < b.from ? -1 : 1)).at(-1)?.amount ?? 0;
  const initial = { extra: currentExtra, oneTime: 0, month: addMonths(from, 11), mode: "shorten" as PrepayMode };
  const [s, setS] = useState(initial);
  const set = (patch: Partial<typeof initial>) => setS((cur) => ({ ...cur, ...patch }));

  const scenario: Plan = {
    ...plan,
    // the extra each month changes only when it was moved: applying just a one-time payment keeps the
    // loan's extras as they are (a stop planned for later included)
    extras: s.extra === currentExtra ? plan.extras : [...plan.extras.filter((e) => e.from < from), { from, amount: round2(s.extra) }],
    prepayments: s.oneTime > 0 ? [...plan.prepayments, { month: s.month, amount: round2(s.oneTime), mode: s.mode }] : plan.prepayments,
  };
  const base = planSchedule(plan, currency);
  const next = planSchedule(scenario, currency);
  // what's still to pay: from the first payment not made yet (one paid ahead of time isn't counted again)
  const fromSeq = now.next?.seq ?? Infinity;
  const ahead = (xs: typeof base) => xs.filter((p) => p.seq >= fromSeq);
  const interestBase = round2(ahead(base).reduce((a, p) => a + p.interest, 0));
  const interestNext = round2(ahead(next).reduce((a, p) => a + p.interest, 0));
  const endBase = base[base.length - 1]?.date.slice(0, 7) ?? from;
  const endNext = next[next.length - 1]?.date.slice(0, 7) ?? from;
  const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  const sooner = monthsBetween(endNext, endBase);
  const paymentNow = ahead(next)[0]?.amount ?? 0;
  const regular = ahead(base)[0]?.amount ?? 0;
  // the payment after the one-time payment, when it lowers it
  const lowered = s.oneTime > 0 && s.mode === "lower" ? next.find((p) => p.date.slice(0, 7) > s.month) : undefined;

  const owed = now.owed;
  const Icon = PLAN_ICON[plan.kind];

  const apply = async () => {
    if (saving) return;
    if (!(await run(() => mutate.save({ op: "upsertPlan", plan: scenario })))) return;
    toast.success(t("plans.sim.applied"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={
        <span className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 text-gold" /> {t("plans.sim.title", { name: plan.name })}
        </span>
      }
      description={t("plans.sim.subtitle")}
      wide
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => setS(initial)}>
            <RotateCcw className="h-4 w-4" /> {t("common.reset")}
          </Button>
          <Button variant="primary" className="ml-auto px-6" onClick={apply} disabled={saving || (s.extra === currentExtra && s.oneTime === 0)}>
            {saving ? t("common.saving") : t("plans.sim.apply")}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 rounded-2xl border border-gold/25 bg-gold-soft/60 p-3 sm:col-span-1">
          <p className="text-[11px] text-ink-3">{t("plans.sim.paidOff")}</p>
          <p className="mt-1 text-lg font-semibold text-gold-bright">{f.monthLong(endNext)}</p>
          <p className={cn("text-[11px]", sooner > 0 ? "text-good" : sooner < 0 ? "text-bad" : "text-ink-3")}>
            {sooner > 0 ? t("plans.sim.sooner", { time: termText(t, sooner) }) : sooner < 0 ? t("plans.sim.later", { time: termText(t, -sooner) }) : t("plans.sim.same")}
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
          <p className="text-[11px] text-ink-3">{t("plans.sim.saved")}</p>
          <AnimatedNumber smallCents value={Math.max(0, interestBase - interestNext)} format={f.amount} className="mt-1 block text-lg font-semibold text-good" />
          <p className="text-[11px] text-ink-3">{t("plans.sim.of", { amount: f.amount(interestBase) })}</p>
        </div>
        <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
          <p className="text-[11px] text-ink-3">{t("plans.sim.eachMonth")}</p>
          <AnimatedNumber smallCents value={paymentNow} format={f.amount} className="mt-1 block text-lg font-semibold text-ink" />
          {s.extra > 0 && <p className="text-[11px] text-ink-3">{t("plans.sim.eachMonthSub", { payment: f.amount(round2(regular - currentExtra)), extra: f.amount(s.extra) })}</p>}
        </div>
      </div>

      <div className="mt-4">
        <LoanCharts plan={plan} scenario={scenario} currency={currency} marker={s.oneTime > 0 ? s.month : undefined} />
      </div>

      <div className="mt-6 grid gap-x-8 gap-y-5 md:grid-cols-2">
        <div>
          <Slider
            label={t("plans.sim.extra")}
            value={s.extra}
            min={0}
            max={niceMax(Math.max(regular, 500), 100)}
            step={10}
            onChange={(v) => set({ extra: v })}
            prefix={f.currencySymbol}
            suffix={t("goals.perMonth", { amount: "" })}
          />
          {/* it goes on the regular payment: still one bill a month, just a bigger one */}
          <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
            {s.extra > 0
              ? t("plans.sim.extraNote", { month: f.monthLong(from), total: f.amount(paymentNow), regular: f.amount(round2(regular - currentExtra)) })
              : t("plans.sim.extraNone")}
          </p>
        </div>
        <Slider label={t("plans.sim.oneTime")} value={s.oneTime} min={0} max={niceMax(owed / 4, 1000)} step={500} onChange={(v) => set({ oneTime: v })} prefix={f.currencySymbol} inputMax={owed} />
        {s.oneTime > 0 && (
          <>
            <Field label={t("plans.sim.oneTimeMonth")}>
              <MonthField value={s.month} min={from} onChange={(month) => month && set({ month })} />
            </Field>
            <Field label={t("plans.sim.mode")} className="md:col-span-2">
              <ChoiceCards
                value={s.mode}
                onChange={(mode) => set({ mode })}
                options={[
                  { value: "shorten" as PrepayMode, icon: <FastForward />, title: t("plans.sim.shorten"), hint: t("plans.mode.shortenHint") },
                  { value: "lower" as PrepayMode, icon: <ArrowDownToLine />, title: t("plans.sim.lower"), hint: t("plans.mode.lowerHint", { date: f.monthLong(endBase) }) },
                ]}
              />
              {lowered && (
                <p className="mt-1.5 text-xs text-ink-3">
                  {/* with an extra every month too, the end still comes sooner */}
                  {t(s.extra > 0 ? "plans.sim.lowerHintExtra" : "plans.sim.lowerHint", { date: f.monthLong(endBase), amount: f.amount(lowered.amount), month: f.monthLong(lowered.date.slice(0, 7)) })}
                </p>
              )}
            </Field>
          </>
        )}
      </div>
      <p className="mt-4 text-xs text-ink-3">{t("plans.sim.limits")}</p>
    </Sheet>
  );
}

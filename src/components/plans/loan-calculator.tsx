"use client";

import { Calculator, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { summarizeMonth } from "@/lib/finance";
import { goalCurrent, savingsPlan } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import { planSchedule } from "@/lib/plans";
import { LOAN_KINDS, type Amortization, type Dataset, type Plan, type PlanKind } from "@/lib/types";
import { addMonths, cn, currentMonth, parseAmount, round2 } from "@/lib/utils";
import { Button } from "../ui/button";
import { Field, Input, MoneyInput, MonthField, Segmented } from "../ui/form";
import { AnimatedNumber } from "../ui/misc";
import { Sheet } from "../ui/sheet";
import { Slider } from "../ui/slider";
import { LoanCharts } from "./loan-charts";
import { DOWN, NO_DOWN, PLAN_ICON, PlanDialog, TERMS, termText } from "./plan-dialog";

/** what can be tried here: loans with a price and a rate (a lease is only its payment) */
const KINDS = LOAN_KINDS.filter((k) => k !== "lease");
const KEY = "gelbien.loanCalc";

interface Inputs {
  kind: PlanKind;
  price: string;
  down: string;
  rate: string;
  count: number;
  amortization: Amortization;
  /** month of the first payment, YYYY-MM */
  start: string;
  /** paid on top of every payment */
  extra: number;
  /** what it would replace each month (rent, say) */
  instead: string;
}

const fresh = (): Inputs => ({ kind: "mortgage", price: "", down: "", rate: "", count: 300, amortization: "price", start: addMonths(currentMonth(), 1), extra: 0, instead: "" });

function readInputs(): Inputs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Inputs> | null;
    return saved ? { ...fresh(), ...saved } : fresh();
  } catch {
    return fresh();
  }
}

/**
 * A mortgage or a loan tried out before taking it on: what each payment would be, the interest in all,
 * when it'd be paid off, how it fits the budget, and what paying more would do. Nothing is saved — the
 * inputs are kept in this browser — until it's added to the commitments (the loan form, filled in).
 */
export function LoanCalculator({ ds, open, onClose }: { ds: Dataset; open: boolean; onClose: () => void }) {
  const { t, f } = useI18n();
  // the last inputs, as left in this browser (the sheet starts closed, so nothing renders from them on the server)
  const [v, setV] = useState<Inputs>(readInputs);
  const [saving, setSaving] = useState<{ open: boolean; nonce: number; initial?: Partial<Plan> }>({ open: false, nonce: 0 });
  const set = (patch: Partial<Inputs>) => setV((cur) => ({ ...cur, ...patch }));
  const currency = ds.settings.currency;

  // kept as they change
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  }, [v]);

  const price = parseAmount(v.price);
  const down = NO_DOWN.includes(v.kind) ? 0 : Math.min(parseAmount(v.down), price);
  const rate = Math.max(0, Math.min(100, parseAmount(v.rate)));
  const loan: Plan = {
    id: "calculator",
    kind: v.kind,
    name: t(`plans.kind.${v.kind}`),
    category: "",
    subcategory: "",
    merchant: "",
    payment: "",
    price: round2(price),
    downPayment: round2(down),
    rate,
    count: Math.max(1, Math.min(1200, Math.round(v.count))),
    amortization: rate > 0 ? v.amortization : "price",
    firstDate: `${v.start}-01`,
    extras: [],
    prepayments: [],
    rateChanges: [],
    accountId: "",
    countAsDebt: true,
    status: "active",
    notes: "",
    createdAt: "",
  };
  const extra = Math.max(0, v.extra);
  const withExtra: Plan = extra > 0 ? { ...loan, extras: [{ from: v.start, amount: round2(extra) }] } : loan;
  const base = planSchedule(loan, currency);
  const schedule = planSchedule(withExtra, currency);
  const ready = price > down && schedule.length > 0;
  const first = schedule[0];
  const interestOf = (xs: typeof base) => round2(xs.reduce((a, p) => a + p.interest, 0));
  const interest = interestOf(schedule);
  const borrowed = round2(price - down);
  const end = schedule.at(-1)?.date.slice(0, 7);
  const months = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  const sooner = end && base.length ? months(end, base.at(-1)!.date.slice(0, 7)) : 0;
  const saved = round2(interestOf(base) - interest);

  // how it fits: against the net income, and what the budget plans to save (less the payment, plus what it replaces)
  const month = summarizeMonth(ds, currentMonth());
  const net = month.income.net;
  const planned = month.budgetTotal > 0 && net > 0 ? round2(net - month.budgetTotal) : null;
  const payment = first?.amount ?? 0;
  const share = net > 0 ? payment / net : null;
  // what it would replace each month (rent, say): added back
  const instead = parseAmount(v.instead);
  const after = planned !== null ? round2(planned - payment + instead) : null;
  const shareTone = share === null ? "" : share < 0.3 ? "text-good" : share < 0.4 ? "text-warn" : "text-bad";
  const shareBar = share === null ? "" : share < 0.3 ? "bg-good" : share < 0.4 ? "bg-warn" : "bg-bad";
  // what the goals take each month (the ones contributing now)
  const goalsNeed = savingsPlan(ds).allocated;
  // a goal's savings as the down payment
  const goals = ds.goals.filter((g) => g.status !== "paused").map((g) => ({ g, amount: goalCurrent(ds, g) })).filter((x) => x.amount > 0);
  const Icon = PLAN_ICON[v.kind];

  const pickKind = (kind: PlanKind) => set({ kind, count: kind === "mortgage" ? 300 : (TERMS[kind]?.[TERMS[kind]!.length - 2] ?? 36), down: NO_DOWN.includes(kind) ? "" : v.down });
  const saveAsPlan = () => {
    onClose();
    setSaving({ open: true, nonce: Date.now(), initial: { ...withExtra, name: "" } });
  };

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(o) => !o && onClose()}
        title={
          <span className="flex items-center gap-2.5">
            <Calculator className="h-5 w-5 text-gold" /> {t("calc.title")}
          </span>
        }
        description={t("calc.subtitle")}
        wide
        footer={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setV(fresh())}>
              <RotateCcw className="h-4 w-4" /> {t("common.reset")}
            </Button>
            <Button variant="primary" className="ml-auto px-6" onClick={saveAsPlan} disabled={!ready}>
              {t("calc.save")}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {/* an even grid (an odd last one takes the rest of its row), so the rows end flush */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 [&>:last-child:nth-child(odd)]:col-span-2">
            {KINDS.map((k) => {
              const KindIcon = PLAN_ICON[k];
              const on = v.kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => pickKind(k)}
                  className={cn(
                    "flex min-w-0 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] transition-colors",
                    on ? "border-gold/50 bg-gold-soft text-ink" : "border-line text-ink-3 hover:text-ink",
                  )}
                >
                  <KindIcon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{t(`plans.kind.${k}`)}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t(`plans.f.price.${v.kind}`)}>
              <MoneyInput value={v.price} onChange={(price) => set({ price })} placeholder="0.00" data-autofocus className="text-lg font-semibold" />
            </Field>
            {!NO_DOWN.includes(v.kind) ? (
              <Field label={t("plans.f.down")} hint={price > 0 && down > 0 ? f.pct(down / price) : undefined}>
                <MoneyInput value={v.down} onChange={(down) => set({ down })} placeholder="0.00" />
                {(price > 0 || goals.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {price > 0 &&
                      (DOWN[v.kind] ?? []).map((share) => (
                        <button
                          key={share}
                          type="button"
                          onClick={() => set({ down: String(round2(price * share)) })}
                          className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors", Math.abs(down - price * share) < 0.01 ? "border-gold/40 bg-gold-soft text-gold-bright" : "border-line text-ink-3 hover:text-ink")}
                        >
                          {f.pct(share)}
                        </button>
                      ))}
                    {/* what a goal has saved so far, as the down payment */}
                    {goals.map(({ g, amount }) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => set({ down: String(amount) })}
                        title={t("calc.fromGoal")}
                        className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors", Math.abs(down - amount) < 0.01 ? "border-gold/40 bg-gold-soft text-gold-bright" : "border-line text-ink-3 hover:text-ink")}
                      >
                        {g.name} · {f.amount(amount)}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            <Field label={t("plans.f.rate")}>
              <div className="relative">
                <Input inputMode="decimal" value={v.rate} onChange={(e) => set({ rate: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0" className="pr-24" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{t("plans.f.rateUnit")}</span>
              </div>
            </Field>
            <Field label={t("plans.f.term")} hint={termText(t, v.count)}>
              <Segmented
                value={String(v.count)}
                onChange={(c) => set({ count: Number(c) })}
                options={(TERMS[v.kind] ?? [12, 24, 36, 60]).map((m) => ({ value: String(m), label: termText(t, m) }))}
              />
            </Field>
            <Field label={t("plans.f.first")}>
              <MonthField value={v.start} onChange={(start) => start && set({ start })} />
            </Field>
            {rate > 0 && (
              <Field label={t("plans.f.payments")}>
                <Segmented
                  value={v.amortization}
                  onChange={(amortization) => set({ amortization })}
                  options={[
                    { value: "price" as const, label: t("plans.amort.price") },
                    { value: "sac" as const, label: t("plans.amort.sac") },
                  ]}
                />
              </Field>
            )}
          </div>

          {ready && first && end && (
            <>
              {/* what it comes to */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                <div className="rounded-2xl border border-gold/25 bg-gold-soft/60 p-3">
                  <p className="flex items-center gap-1.5 text-[11px] text-ink-3">
                    <Icon className="h-3.5 w-3.5" /> {loan.amortization === "sac" ? t("plans.sum.firstPayment") : t("plans.sum.monthly")}
                  </p>
                  <AnimatedNumber smallCents value={payment} format={f.amount} className="mt-1 block text-lg font-semibold text-gold-bright" />
                  {extra > 0 && <p className="text-[11px] text-ink-3">{t("plans.sim.eachMonthSub", { payment: f.amount(round2(payment - extra)), extra: f.amount(extra) })}</p>}
                </div>
                <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
                  <p className="text-[11px] text-ink-3">{t("calc.interest")}</p>
                  <AnimatedNumber smallCents value={interest} format={f.amount} className="mt-1 block text-lg font-semibold text-ink" />
                  <p className="text-[11px] text-ink-3">{t("calc.interestShare", { pct: f.pct(borrowed > 0 ? interest / borrowed : 0) })}</p>
                </div>
                <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
                  <p className="text-[11px] text-ink-3">{t("plans.sum.paidOff")}</p>
                  <p className="mt-1 text-lg font-semibold text-ink">{f.monthLong(end)}</p>
                  <p className="text-[11px] text-ink-3">{termText(t, schedule.length)}</p>
                </div>
                <div className="rounded-2xl border border-line bg-surface-2/60 p-3">
                  <p className="text-[11px] text-ink-3">{t("calc.total")}</p>
                  <AnimatedNumber smallCents value={round2(price + interest)} format={f.amount} className="mt-1 block text-lg font-semibold text-ink" />
                  <p className="text-[11px] text-ink-3">{t("calc.totalHint")}</p>
                </div>
              </div>

              {/* how it fits the budget: its share of take-home pay, then what's left to save, as a sum */}
              <div className="rounded-2xl border border-line p-3.5">
                <p className="text-[13px] font-medium text-ink">{t("calc.fit")}</p>
                {share === null ? (
                  <p className="mt-1 text-xs text-ink-3">{t("calc.noBudget")}</p>
                ) : (
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <AnimatedNumber value={share} format={f.pct} className={cn("text-xl font-semibold", shareTone)} />
                        <span className="text-[13px] text-ink-2">{t("calc.shareOf", { income: f.amount(net) })}</span>
                      </p>
                      {/* where it sits: comfortable under 30%, tight past 40% */}
                      <div className="relative mt-2 h-1.5 rounded-full bg-white/[0.06]">
                        <div className={cn("h-full rounded-full transition-[width] duration-300", shareBar)} style={{ width: `${Math.min(100, share * 100)}%` }} />
                        <span className="absolute -top-0.5 h-2.5 w-px bg-ink-3" style={{ left: "30%" }} />
                        <span className="absolute -top-0.5 h-2.5 w-px bg-ink-3" style={{ left: "40%" }} />
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-3">
                        {t("calc.shareHint")}
                        {instead > 0 && ` ${t("calc.insteadShare", { pct: f.pct(instead / net) })}`}
                      </p>
                    </div>

                    {planned !== null && after !== null ? (
                      <div>
                        <ul className="divide-y divide-line/60 rounded-xl border border-line/70 text-[13px]">
                          <li className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="text-ink-2">{t("calc.rowPlanned")}</span>
                            <AnimatedNumber smallCents value={planned} format={f.amount} className="tabular text-ink" />
                          </li>
                          <li className="flex items-center justify-between gap-3 px-3 py-2">
                            <span className="text-ink-2">{t("calc.rowPayment")}</span>
                            <AnimatedNumber smallCents value={payment} format={(n) => `${n > 0 ? "−" : ""}${f.amount(n)}`} className="tabular text-bad" />
                          </li>
                          <li className="flex items-center justify-between gap-3 px-3 py-1.5">
                            <span className="text-ink-2">{t("calc.rowInstead")}</span>
                            <MoneyInput value={v.instead} onChange={(instead) => set({ instead })} placeholder="0.00" aria-label={t("calc.rowInstead")} className="h-9 w-32 text-right text-good" />
                          </li>
                          <li className="flex items-center justify-between gap-3 bg-white/[0.02] px-3 py-2.5">
                            <span className="font-medium text-ink">{t("calc.rowLeft")}</span>
                            <AnimatedNumber smallCents value={after} format={f.amount} className={cn("tabular text-base font-semibold", after >= 0 ? "text-good" : "text-bad")} />
                          </li>
                        </ul>
                        {/* and whether that still covers the goals' monthly contributions */}
                        {goalsNeed > 0 && (
                          <p className={cn("mt-2 text-xs", after >= goalsNeed ? "text-good" : "text-warn")}>
                            {after >= goalsNeed
                              ? t("calc.goalsOk", { amount: f.amount(goalsNeed), spare: f.amount(round2(after - goalsNeed)) })
                              : t("calc.goalsShort", { amount: f.amount(goalsNeed), short: f.amount(round2(goalsNeed - after)) })}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-ink-3">{t("calc.noLimits")}</p>
                    )}
                  </div>
                )}
              </div>

              {/* paying more */}
              <div>
                <Slider
                  label={t("calc.payMore")}
                  value={extra}
                  min={0}
                  max={Math.max(500, Math.ceil(payment / 100) * 100)}
                  step={10}
                  onChange={(n) => set({ extra: n })}
                  prefix={f.currencySymbol}
                  suffix={t("goals.perMonth", { amount: "" })}
                />
                {extra > 0 && sooner > 0 && <p className="mt-1.5 text-xs text-good">{t("calc.payMoreHint", { time: termText(t, sooner), amount: f.amount(saved) })}</p>}
              </div>

              <LoanCharts plan={loan} scenario={withExtra} currency={currency} labels={{ scenario: t("calc.withExtra"), plan: t("calc.without") }} />
            </>
          )}
        </div>
      </Sheet>

      {/* saved as a plan: the loan form, filled in (a name is all it needs) */}
      <PlanDialog key={`calc-plan-${saving.nonce}`} ds={ds} open={saving.open} plan={null} initial={saving.initial} onClose={() => setSaving((s) => ({ ...s, open: false }))} />
    </>
  );
}

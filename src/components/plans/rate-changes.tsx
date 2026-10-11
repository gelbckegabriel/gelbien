"use client";

import { CalendarClock, Percent, Plus, X } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { planSchedule } from "@/lib/plans";
import type { Plan, RateChange, RateKeep } from "@/lib/types";
import { cn, parseAmount, round2 } from "@/lib/utils";
import { Button } from "../ui/button";
import { Collapse } from "../ui/collapse";
import { ChoiceCards, Field, Input, MonthField } from "../ui/form";

/**
 * A loan's rate changing along the way — a mortgage renewed, a variable rate moving — from a given payment
 * on. The payments before it stay exactly as they were; the new rate works on what's still owed by then,
 * either changing the payment so the loan still ends when it would, or keeping the payment and moving the
 * end. A new rate the old payment wouldn't even cover raises the payment instead.
 */
export function RateChanges({
  plan,
  currency,
  value,
  onChange,
  nextMonth,
}: {
  /** the loan as it is in the form, its rate changes included */
  plan: Plan;
  currency: string;
  value: RateChange[];
  onChange: (v: RateChange[]) => void;
  /** the month of the next payment: where a new rate starts unless told otherwise */
  nextMonth: string;
}) {
  const { t, f } = useI18n();
  const [adding, setAdding] = useState(false);
  const [from, setFrom] = useState(nextMonth);
  const [rate, setRate] = useState("");
  const [keep, setKeep] = useState<RateKeep>("end");
  const sac = plan.amortization === "sac";
  const ym = (m: string) => `${f.monthShort(m)} ${m.slice(0, 4)}`;
  const firstMonth = plan.firstDate.slice(0, 7);

  const schedule = planSchedule(plan, currency);
  const end = schedule.at(-1)?.date.slice(0, 7);
  const payIn = (s: typeof schedule, m: string) => s.find((p) => p.date.slice(0, 7) >= m);
  // the current rate at a month: the plan's, or the latest change on or before it
  const rateAt = (m: string) => [...value].filter((c) => c.from <= m).sort((a, b) => (a.from < b.from ? -1 : 1)).at(-1)?.rate ?? plan.rate;

  // what the change being typed would do
  const newRate = parseAmount(rate);
  // a payment still to come from that month: after the loan is paid off a new rate changes nothing
  const valid = rate.trim() !== "" && newRate >= 0 && newRate <= 100 && /^\d{4}-\d{2}$/.test(from) && from >= firstMonth && !!payIn(schedule, from);
  const draft: RateChange = { from, rate: round2(newRate * 1000) / 1000, keep: sac ? "end" : keep };
  const tried = valid ? planSchedule({ ...plan, rateChanges: [...value.filter((c) => c.from !== from), draft] }, currency) : [];
  const before = payIn(schedule, from);
  const after = payIn(tried, from);
  const triedEnd = tried.at(-1)?.date.slice(0, 7);
  // keeping the payment, but it wouldn't cover the interest: it went up instead
  const raised = valid && !sac && keep === "payment" && !!before && !!after && after.amount > before.amount + 0.005 && after.interest >= before.amount - 0.005;

  const add = () => {
    if (!valid) return;
    onChange([...value.filter((c) => c.from !== from), draft].sort((a, b) => (a.from < b.from ? -1 : 1)));
    setAdding(false);
    setRate("");
  };

  return (
    <Field label={t("plans.rates.title")}>
      {value.length > 0 && (
        <ul className="mb-2 divide-y divide-line/60 rounded-2xl border border-line">
          {[...value]
            .sort((a, b) => (a.from < b.from ? -1 : 1))
            .map((c) => {
              const pay = payIn(schedule, c.from);
              return (
                <li key={c.from} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
                  <span className="shrink-0 text-ink-2">{t("plans.extraMonthly.from", { month: ym(c.from) })}</span>
                  <span className="tabular font-medium text-ink">{f.rate(c.rate)}%</span>
                  <span className="min-w-0 flex-1 truncate text-xs text-ink-3">
                    {sac || c.keep === "end"
                      ? pay && t("plans.rates.rowEnd", { amount: f.amount(pay.amount) })
                      : end && t("plans.rates.rowPayment", { date: f.monthLong(end) })}
                  </span>
                  <button
                    type="button"
                    onClick={() => onChange(value.filter((x) => x !== c))}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-bad"
                    aria-label={t("common.delete")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
        </ul>
      )}

      {!adding && (
        <button
          type="button"
          onClick={() => {
            setFrom(nextMonth);
            setAdding(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-[13px] text-ink-2 transition-colors hover:border-gold/40 hover:text-ink"
        >
          <Plus className="h-4 w-4 text-gold" /> {t("plans.rates.add")}
        </button>
      )}

      <Collapse show={adding}>
        <div className="space-y-3.5 rounded-2xl border border-line bg-surface-2/40 p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t("plans.rates.from")}>
              <MonthField value={from} min={firstMonth} onChange={(m) => m && setFrom(m)} />
            </Field>
            <Field label={t("plans.rates.rate")} hint={t("plans.rates.was", { rate: f.rate(rateAt(from)) })}>
              <div className="relative">
                <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ""))} placeholder={f.rate(rateAt(from))} className="pr-24" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{t("plans.f.rateUnit")}</span>
              </div>
            </Field>
          </div>
          {sac ? (
            <p className="text-xs leading-relaxed text-ink-3">{t("plans.rates.sac")}</p>
          ) : (
            <ChoiceCards
              value={keep}
              onChange={setKeep}
              options={[
                { value: "end" as RateKeep, icon: <CalendarClock />, title: t("plans.rates.keepEnd"), hint: t("plans.rates.keepEndHint") },
                { value: "payment" as RateKeep, icon: <Percent />, title: t("plans.rates.keepPayment"), hint: t("plans.rates.keepPaymentHint") },
              ]}
            />
          )}
          {/* what it does, in numbers */}
          {valid && before && after && (
            <p className={cn("rounded-xl border p-3 text-[13px] leading-relaxed", raised ? "border-warn/30 bg-warn-soft text-ink-2" : "border-gold/20 bg-gold-soft/50 text-ink")}>
              {raised
                ? t("plans.rates.raised", { rate: f.rate(newRate), payment: f.amount(before.amount), amount: f.amount(after.amount) })
                : sac || keep === "end"
                  ? t("plans.rates.resultEnd", { month: f.monthLong(after.date.slice(0, 7)), was: f.amount(before.amount), amount: f.amount(after.amount) })
                  : t("plans.rates.resultPayment", { amount: f.amount(after.amount), date: f.monthLong(triedEnd ?? from), was: f.monthLong(end ?? from) })}{" "}
              {t("plans.rates.past")}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" variant="primary" onClick={add} disabled={!valid}>
              {t("plans.rates.save")}
            </Button>
          </div>
        </div>
      </Collapse>
    </Field>
  );
}

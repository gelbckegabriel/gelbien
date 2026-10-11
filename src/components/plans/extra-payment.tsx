"use client";

import { ArrowDownToLine, FastForward, PiggyBank, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutate, useSaving } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { extraPaymentLink, owedOn, planSchedule, planStanding } from "@/lib/plans";
import type { Dataset, Plan, PrepayMode, Transaction } from "@/lib/types";
import { isValidISODate, parseAmount, round2, todayISO, uid } from "@/lib/utils";
import { Button } from "../ui/button";
import { Collapse } from "../ui/collapse";
import { ChoiceCards, Field, Input, MoneyInput } from "../ui/form";
import { Sheet } from "../ui/sheet";
import { PLAN_ICON, termText } from "./plan-dialog";

export function ExtraPaymentDialog({ ds, plan, open, onClose }: { ds: Dataset; plan: Plan | null; open: boolean; onClose: () => void }) {
  if (!plan) return null;
  return <ExtraForm key={plan.id} ds={ds} plan={plan} open={open} onClose={onClose} />;
}

/**
 * A payment on top of a loan's regular one, straight off what's owed: finish sooner or pay less each
 * month. The regular payment stays as it is. Paid from savings it's recorded on the loan only; paid from
 * the month's money it's logged as an expense too (linked apart from the regular payment).
 */
function ExtraForm({ ds, plan, open, onClose }: { ds: Dataset; plan: Plan; open: boolean; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const currency = ds.settings.currency;
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PrepayMode>("shorten");
  // logged as an expense unless it came out of savings
  const [source, setSource] = useState<"savings" | "budget">("budget");
  // what it can pay off at most: owed after the payments marked paid (on an earlier day, by the schedule)
  const owed = owedOn(plan, ds, date);
  const value = Math.min(round2(parseAmount(amount)), owed);
  const month = (isValidISODate(date) ? date : todayISO()).slice(0, 7);
  const next: Plan = { ...plan, prepayments: [...plan.prepayments, { month, amount: value, mode }] };

  const base = planSchedule(plan, currency);
  const after = planSchedule(next, currency);
  const later = (xs: typeof base) => xs.filter((p) => p.date.slice(0, 7) > month);
  const interestSaved = round2(later(base).reduce((a, p) => a + p.interest, 0) - later(after).reduce((a, p) => a + p.interest, 0));
  const endBase = base.at(-1)?.date.slice(0, 7) ?? month;
  const endAfter = after.at(-1)?.date.slice(0, 7) ?? month;
  const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
  const lowered = later(after)[0];
  const valid = value > 0 && isValidISODate(date);
  const Icon = PLAN_ICON[plan.kind];

  const save = async () => {
    if (!valid || saving) return;
    const writes: Promise<unknown>[] = [mutate.save({ op: "upsertPlan", plan: next })];
    if (source === "budget") {
      const now = new Date().toISOString();
      const tx: Transaction = {
        id: uid("t"),
        date,
        category: plan.category,
        subcategory: plan.subcategory,
        description: `${plan.name} · ${t("plans.extra.label")}`.slice(0, 500),
        amount: value,
        payment: plan.payment,
        type: "variable",
        priority: "important",
        merchant: plan.merchant,
        recurring: false,
        notes: "",
        receiptUrl: "",
        createdAt: now,
        updatedAt: now,
        group: "",
        billId: extraPaymentLink(plan.id),
      };
      writes.push(mutate.save({ op: "addTransaction", tx }));
    }
    if (!(await run(() => Promise.all(writes)))) return;
    toast.success(t("plans.extra.saved"), { description: `${f.amount(value)} · ${plan.name}` });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={
        <span className="flex items-center gap-2.5">
          <Icon className="h-5 w-5 text-gold" /> {t("plans.extra.title", { name: plan.name })}
        </span>
      }
      description={t("plans.extra.subtitle", { owed: f.amount(planStanding(plan, ds).owed) })}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" className="px-6" onClick={save} disabled={!valid || saving}>
            {saving ? t("common.saving") : t("plans.extra.save")}
          </Button>
        </div>
      }
    >
      {/* one child, so the sheet's cascade (rise-in) runs over these fields once, and not again when the result opens */}
      <div>
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("plans.extra.amount")}>
              <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" data-autofocus className="text-lg font-semibold" />
            </Field>
            <Field label={t("plans.extra.date")}>
              <Input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} />
            </Field>
          </div>

          <Field label={t("plans.extra.effect")}>
            <ChoiceCards
              value={mode}
              onChange={setMode}
              options={[
                { value: "shorten" as PrepayMode, icon: <FastForward />, title: t("plans.sim.shorten"), hint: t("plans.mode.shortenHint") },
                { value: "lower" as PrepayMode, icon: <ArrowDownToLine />, title: t("plans.sim.lower"), hint: t("plans.mode.lowerHint", { date: f.monthLong(endBase) }) },
              ]}
            />
          </Field>

          <Field label={t("plans.extra.source")}>
            <ChoiceCards
              value={source}
              onChange={setSource}
              options={[
                { value: "budget" as const, icon: <Wallet />, title: t("plans.extra.budget"), hint: t("plans.extra.budgetHint", { month: f.monthName(month) }) },
                { value: "savings" as const, icon: <PiggyBank />, title: t("plans.extra.savings"), hint: t("plans.extra.savingsHint") },
              ]}
            />
          </Field>
        </div>

        {/* what it does to the loan */}
        <Collapse show={valid} gap="pt-5">
          <div className="rounded-2xl border border-good/25 bg-good-soft p-3.5 text-[13px] leading-relaxed text-ink">
            {mode === "shorten" || !lowered
              ? t("plans.extra.resultShorten", {
                  date: f.monthLong(endAfter),
                  time: termText(t, Math.max(0, monthsBetween(endAfter, endBase))),
                  interest: f.amount(Math.max(0, interestSaved)),
                })
              : t("plans.extra.resultLower", { amount: f.amount(lowered.amount), month: f.monthLong(lowered.date.slice(0, 7)), interest: f.amount(Math.max(0, interestSaved)) })}
          </div>
        </Collapse>
      </div>
    </Sheet>
  );
}

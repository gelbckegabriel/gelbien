"use client";

import { CalendarRange } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { planSchedule, shiftDate } from "@/lib/plans";
import type { Plan } from "@/lib/types";
import { cn, parseAmount, round2 } from "@/lib/utils";
import { Field, MoneyInput, Segmented, ToggleCard } from "../ui/form";
import { MoneyText } from "../ui/misc";
import { CountStepper } from "./plan-dialog";

/** "Pay in installments" in the expense form, as typed */
export interface InstallmentsDraft {
  on: boolean;
  count: number;
  /** with interest: the total paid (more than the price) is typed in */
  interest: boolean;
  total: string;
  first: "this" | "next";
}

export const NO_INSTALLMENTS: InstallmentsDraft = { on: false, count: 12, interest: false, total: "", first: "this" };

/** The plan for an expense paid in installments: `amount` is the price; the total with interest, when given, is what's split */
export function installmentPlan(
  d: InstallmentsDraft,
  e: { amount: number; date: string; name: string; category: string; subcategory: string; merchant: string; payment: string },
  id: string,
  now = new Date().toISOString(),
): Plan {
  const total = d.interest && parseAmount(d.total) > e.amount ? parseAmount(d.total) : e.amount;
  return {
    id,
    kind: "installments",
    name: e.name.slice(0, 120),
    category: e.category,
    subcategory: e.subcategory,
    merchant: e.merchant,
    payment: e.payment,
    price: round2(total),
    downPayment: 0,
    rate: 0,
    count: d.count,
    amortization: "price",
    firstDate: shiftDate(e.date, d.first === "next" ? 1 : 0),
    extras: [],
    prepayments: [],
    rateChanges: [],
    accountId: "",
    countAsDebt: true,
    status: "active",
    notes: "",
    createdAt: now,
  };
}

/** The switch, and once on: how many, interest, which month the first falls in, and what each month gets */
export function InstallmentsFields({ value, onChange, amount, date }: { value: InstallmentsDraft; onChange: (d: InstallmentsDraft) => void; amount: number; date: string }) {
  const { t, f } = useI18n();
  const set = (patch: Partial<InstallmentsDraft>) => onChange({ ...value, ...patch });
  const preview = amount > 0 ? planSchedule(installmentPlan(value, { amount, date, name: "", category: "", subcategory: "", merchant: "", payment: "" }, "preview")) : [];
  const first = preview[0];
  const last = preview[preview.length - 1];

  return (
    <ToggleCard checked={value.on} onChange={(on) => set({ on })} icon={<CalendarRange />} title={t("plans.inst.toggle")} description={t("plans.inst.toggleDesc")}>
      <div className="border-t border-line/60 pt-3.5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("plans.f.installments")}>
            <CountStepper value={value.count} onChange={(count) => set({ count })} min={2} max={48} />
          </Field>
          <Field label={t("plans.inst.interest")}>
            <Segmented
              value={value.interest ? "with" : "none"}
              onChange={(v) => set({ interest: v === "with" })}
              options={[
                { value: "none", label: t("plans.inst.none") },
                { value: "with", label: t("plans.inst.with") },
              ]}
            />
          </Field>
          {value.interest && (
            <Field label={t("plans.inst.totalWith")} className="sm:col-span-2">
              <MoneyInput value={value.total} onChange={(total) => set({ total })} placeholder="0.00" />
            </Field>
          )}
          <Field label={t("plans.f.firstInstallment")} className="sm:col-span-2">
            <Segmented
              value={value.first}
              onChange={(first) => set({ first })}
              options={[
                { value: "this" as const, label: t("plans.f.thisMonth") },
                { value: "next" as const, label: t("plans.f.nextMonth") },
              ]}
            />
            <p className="mt-1.5 text-xs text-ink-3">{t("plans.f.firstHint")}</p>
          </Field>
        </div>
        {first && last && (
          <div className="mt-3">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="tabular-nums text-lg font-semibold text-gold-bright">
                <MoneyText text={f.amount(first.amount)} />
              </span>
              <span className="text-sm text-ink-2">{t("plans.sum.installments", { n: preview.length })}</span>
              {last.amount !== first.amount && <span className="text-xs text-ink-3">· {t("plans.sum.lastOne", { amount: f.amount(last.amount) })}</span>}
            </p>
            <ul className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-6">
              {preview.slice(0, 12).map((p) => (
                <li key={p.seq} className={cn("rounded-lg border px-1 py-1 text-center text-[11px] leading-tight", p.seq === 1 ? "border-gold/40 bg-gold-soft text-gold-bright" : "border-line text-ink-3")}>
                  {f.monthShort(p.date.slice(0, 7))}
                  <span className="block">
                    {p.seq}/{preview.length}
                  </span>
                </li>
              ))}
            </ul>
            {preview.length > 12 && <p className="mt-1 text-[11px] text-ink-3">… {f.monthLong(last.date.slice(0, 7))}</p>}
            <p className="mt-2 text-xs text-ink-3">{t("plans.sum.installmentsNote")}</p>
          </div>
        )}
      </div>
    </ToggleCard>
  );
}

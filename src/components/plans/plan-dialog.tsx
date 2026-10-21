"use client";

import { Banknote, Car, CircleEllipsis, CirclePlus, GraduationCap, Home, KeyRound, Landmark, Minus, Plus, Scale, SlidersHorizontal, Trash2, TrendingDown, X, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutate, useSaving } from "@/lib/data/hooks";
import { CATEGORY_COLORS } from "@/lib/defaults";
import { estimatedValue } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import { extraIn, extraPaymentLink, financed, installmentsOf, installmentTransactions, paidSoFar, planSchedule, planStanding, shiftDate } from "@/lib/plans";
import { LOAN_KINDS, type Account, type Amortization, type Dataset, type Plan, type PlanKind } from "@/lib/types";
import { addMonths, cn, currentMonth, parseAmount, round2, todayISO, uid } from "@/lib/utils";
import { CategorySelect, PaymentSelect, SubcategorySelect } from "../pickers";
import { Button } from "../ui/button";
import { Collapse } from "../ui/collapse";
import { Field, Input, MoneyInput, Segmented, Switch, Textarea, ToggleCard } from "../ui/form";
import { MoneyText } from "../ui/misc";
import { Sheet } from "../ui/sheet";
import { PaymentSplit } from "./loan-charts";
import { RateChanges } from "./rate-changes";

export const PLAN_ICON: Record<PlanKind, typeof Home> = {
  installments: Banknote,
  mortgage: Home,
  carLoan: Car,
  personalLoan: Banknote,
  studentLoan: GraduationCap,
  lease: KeyRound,
  other: CircleEllipsis,
};

// quick picks for the term, in months
export const TERMS: Partial<Record<PlanKind, number[]>> = {
  mortgage: [180, 240, 300, 360],
  carLoan: [36, 48, 60, 72],
  personalLoan: [12, 24, 36, 60],
  studentLoan: [60, 120, 180],
  lease: [24, 36, 48],
  other: [12, 24, 36],
};
// down payment quick picks, as a share of the price
export const DOWN: Partial<Record<PlanKind, number[]>> = { mortgage: [0.05, 0.1, 0.2], carLoan: [0.1, 0.2], lease: [0.1], other: [0.1, 0.2] };
// what a loan is usually for: the category with this icon
const CATEGORY_ICON: Partial<Record<PlanKind, string[]>> = { mortgage: ["Home"], carLoan: ["Bus", "Car"], lease: ["Bus", "Car"], studentLoan: ["GraduationCap", "BookOpen"] };
// kinds that hold what's borrowed against something owned (an asset worth the price)
const OWNED: PlanKind[] = ["mortgage", "carLoan"];
export const NO_DOWN: PlanKind[] = ["personalLoan", "studentLoan"];

/** "25 years", "5 years 6 months", "18 months" */
export function termText(t: ReturnType<typeof useI18n>["t"], months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (!y) return t("plans.months", { n: m });
  if (!m) return t("plans.years", { n: y });
  return t("plans.yearsMonths", { y, m });
}

/**
 * Adds or edits a payment plan. A new one is a loan (down payment, rate, term — or just the payment)
 * or installments (split into equal parts, logged as an expense each month at once). Saved installments
 * can be cancelled (what's still to come is deleted); a loan can be simulated (onSimulate) and take an
 * extra payment (onExtra).
 */
export function PlanDialog({
  ds,
  open,
  plan,
  onClose,
  onSimulate,
  onExtra,
  initial,
}: {
  ds: Dataset;
  open: boolean;
  /** the plan to edit; null for a new one */
  plan: Plan | null;
  onClose: () => void;
  onSimulate?: (plan: Plan) => void;
  onExtra?: (plan: Plan) => void;
  /** a new loan's starting values (from the loan calculator) */
  initial?: Partial<Plan>;
}) {
  const { t, f } = useI18n();
  if (plan?.kind === "installments") return <InstallmentsView ds={ds} open={open} plan={plan} onClose={onClose} />;
  return <PlanForm ds={ds} open={open} plan={plan} onClose={onClose} onSimulate={onSimulate} onExtra={onExtra} initial={plan ? undefined : initial} t={t} f={f} />;
}

function PlanForm({
  ds,
  open,
  plan,
  onClose,
  onSimulate,
  onExtra,
  initial,
  t,
  f,
}: {
  ds: Dataset;
  open: boolean;
  plan: Plan | null;
  onClose: () => void;
  onSimulate?: (plan: Plan) => void;
  onExtra?: (plan: Plan) => void;
  initial?: Partial<Plan>;
  t: ReturnType<typeof useI18n>["t"];
  f: ReturnType<typeof useI18n>["f"];
}) {
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const today = todayISO();
  const currency = ds.settings.currency;
  const shown = ds.categories.filter((c) => !c.archived || c.name === plan?.category);
  const categoryFor = (k: PlanKind) => shown.find((c) => CATEGORY_ICON[k]?.includes(c.icon))?.name ?? shown[0]?.name ?? "";

  const [mode, setMode] = useState<"loan" | "installments">("loan");
  const [kind, setKind] = useState<PlanKind>(plan?.kind ?? initial?.kind ?? "mortgage");
  const [name, setName] = useState(plan?.name ?? initial?.name ?? "");
  const [category, setCategory] = useState(plan?.category ?? categoryFor(initial?.kind ?? "mortgage"));
  const [subcategory, setSubcategory] = useState(plan?.subcategory ?? "");
  const [merchant, setMerchant] = useState(plan?.merchant ?? "");
  const [payment, setPayment] = useState(plan?.payment ?? ds.settings.paymentMethods[0] ?? "");
  // a lease, say: only the monthly payment is known (stored as interest-free payments adding up to the price)
  const [knowPayment, setKnowPayment] = useState(!!plan && plan.rate === 0);
  const [price, setPrice] = useState(plan ? String(plan.price) : initial?.price ? String(initial.price) : "");
  const [down, setDown] = useState(plan?.downPayment ? String(plan.downPayment) : initial?.downPayment ? String(initial.downPayment) : "");
  // the payment as the form shows it at first: unchanged (with the term and down payment), the price stays
  // exactly as saved — worked back from a rounded payment, it would drift by cents
  const [startMonthly] = useState(() => (plan && plan.rate === 0 ? String(round2((plan.price - plan.downPayment) / plan.count)) : ""));
  const [monthlyIn, setMonthlyIn] = useState(startMonthly);
  const [rate, setRate] = useState(plan ? String(plan.rate) : initial?.rate ? String(initial.rate) : "");
  const [count, setCountValue] = useState(plan?.count ?? initial?.count ?? 300);
  // the term as typed: it can be emptied on the way to a new number (count keeps the last valid one)
  const [countText, setCountText] = useState(String(plan?.count ?? initial?.count ?? 300));
  const setCount = (n: number) => {
    setCountValue(n);
    setCountText(String(n));
  };
  const [firstDate, setFirstDate] = useState(plan?.firstDate ?? initial?.firstDate ?? `${addMonths(currentMonth(), 1)}-01`);
  const [amortization, setAmortization] = useState<Amortization>(plan?.amortization ?? initial?.amortization ?? "price");
  const [addAccounts, setAddAccounts] = useState(!plan);
  // what the home or car loses a year, until typed: a car about 15%, a home nothing
  const [lossIn, setLossIn] = useState<string | null>(null);
  const lossText = lossIn ?? (kind === "carLoan" ? "15" : "0");
  const loss = Math.max(0, Math.min(100, parseAmount(lossText)));
  const [notes, setNotes] = useState(plan?.notes ?? "");
  // installments started from here (an expense dialog does the same)
  const [instCount, setInstCount] = useState(12);
  const [instFirst, setInstFirst] = useState<"this" | "next">("this");
  const [countAsDebt, setCountAsDebt] = useState(true);
  // extra payments made (or planned in the simulator): removed here, gone on save
  const [prepayments, setPrepayments] = useState(plan?.prepayments ?? []);
  // what's added to every payment from a month on (set from the simulator)
  const [extras, setExtras] = useState(plan?.extras ?? initial?.extras ?? []);
  // new rates along the way (renewals, variable rates), from a payment on
  const [rateChanges, setRateChanges] = useState(plan?.rateChanges ?? []);

  const pickKind = (k: PlanKind) => {
    setKind(k);
    if (!plan) {
      setCount(k === "mortgage" ? 300 : (TERMS[k]?.[TERMS[k]!.length - 2] ?? 36));
      setCategory(categoryFor(k));
      setSubcategory("");
      setKnowPayment(k === "lease");
      setAddAccounts(k !== "lease" && k !== "other");
      if (NO_DOWN.includes(k)) setDown("");
    }
  };

  const priceValue = parseAmount(price);
  // with only the payment known there's no price to cap it at: the down payment is as typed
  const downValue = NO_DOWN.includes(kind) ? 0 : knowPayment ? parseAmount(down) : Math.min(parseAmount(down), priceValue);
  const isInst = !plan && mode === "installments";
  const draft: Plan = useMemo(() => {
    const base = {
      id: plan?.id ?? "draft",
      name: name.trim(),
      category,
      subcategory,
      merchant: merchant.trim(),
      payment,
      extras,
      prepayments,
      rateChanges,
      accountId: plan?.accountId ?? "",
      status: plan?.status ?? ("active" as const),
      notes: notes.trim(),
      createdAt: plan?.createdAt || new Date().toISOString(),
    };
    if (isInst) {
      return { ...base, kind: "installments", price: round2(priceValue), downPayment: 0, rate: 0, count: instCount, amortization: "price", firstDate: shiftDate(today, instFirst === "next" ? 1 : 0), countAsDebt };
    }
    const monthly = parseAmount(monthlyIn);
    return {
      ...base,
      kind,
      // only the payment known: payments with no interest that add up to the price
      price: knowPayment
        ? plan && plan.rate === 0 && monthlyIn === startMonthly && Math.round(count) === plan.count && round2(downValue) === plan.downPayment
          ? plan.price
          : round2(monthly * count + downValue)
        : round2(priceValue),
      downPayment: round2(downValue),
      rate: knowPayment ? 0 : Math.max(0, Math.min(100, parseAmount(rate))),
      count: Math.max(1, Math.min(1200, Math.round(count))),
      amortization: knowPayment ? "price" : amortization,
      firstDate,
      countAsDebt: true,
    };
  }, [plan, name, category, subcategory, merchant, payment, notes, prepayments, extras, rateChanges, isInst, priceValue, instCount, instFirst, countAsDebt, today, monthlyIn, startMonthly, kind, knowPayment, count, downValue, rate, amortization, firstDate]);

  const schedule = planSchedule(draft, currency);
  const other = planSchedule({ ...draft, amortization: draft.amortization === "price" ? "sac" : "price" }, currency);
  const interest = round2(schedule.reduce((a, s) => a + s.interest, 0));
  const otherInterest = round2(other.reduce((a, s) => a + s.interest, 0));
  // where it stands: the payments marked paid (and those before it was added), what's owed after them
  const standing = planStanding(draft, ds, today);
  const owedNow = standing.owed;
  // what the home or car is worth today: bought about a month before the first payment, it may already
  // have lost some of its value (a car)
  const bought = shiftDate(draft.firstDate || today, -1);
  const assetNow = loss > 0 && bought < today ? estimatedValue({ depreciation: loss }, { date: bought, balance: draft.price }, today) : draft.price;
  // a loan already running: its next payment (the first not made, maybe overdue) and what the ones made came to
  const nextPay = standing.next ?? undefined;
  const soFar = paidSoFar(schedule, standing.made);
  // the extra every month, as periods: from one change to the next (an amount of 0 ends one). One already
  // paid with can only be stopped from the next payment; one not started yet can be taken off.
  const nextMonth = nextPay?.date.slice(0, 7);
  const lastPaid = schedule.filter((_, i) => standing.made[i]).at(-1)?.date.slice(0, 7) ?? "";
  const sortedExtras = [...extras].sort((a, b) => (a.from < b.from ? -1 : 1));
  const extraPeriods = sortedExtras
    .map((x, i) => {
      const end = sortedExtras[i + 1]?.from;
      const until = end ? addMonths(end, -1) : schedule.at(-1)?.date.slice(0, 7);
      return {
        from: x.from,
        amount: x.amount,
        until: end ? until : undefined,
        started: !!lastPaid && x.from <= lastPaid,
        past: !!end && end <= (nextMonth ?? "9999"),
        payment: schedule.find((p) => p.date.slice(0, 7) >= x.from)?.amount,
      };
    })
    .filter((x) => x.amount > 0);
  const ym = (m: string) => `${f.monthShort(m)} ${m.slice(0, 4)}`;
  // the loan's own terms changed while it's running: that rewrites it from the first payment, made ones too
  const rewrites =
    !!plan &&
    plan.kind !== "installments" &&
    !!lastPaid &&
    (draft.price !== plan.price || draft.downPayment !== plan.downPayment || draft.rate !== plan.rate || draft.count !== plan.count || draft.amortization !== plan.amortization || draft.firstDate !== plan.firstDate);
  const valid = draft.name.length > 0 && financed(draft) > 0 && schedule.length > 0 && !!draft.category;
  const currentCat = ds.categories.find((c) => c.name === category);

  const save = async () => {
    if (!valid || saving) return;
    const id = plan?.id ?? uid("plan");
    let next: Plan = { ...draft, id };
    const writes: Promise<unknown>[] = [];
    if (isInst) {
      const stamp = new Date().toISOString();
      const txs = installmentTransactions(next, { category, subcategory, payment, type: "variable", priority: "important", merchant: next.merchant, recurring: false, notes: "", receiptUrl: "", createdAt: stamp, updatedAt: stamp }, () => uid("t"));
      writes.push(mutate.save({ op: "upsertPlan", plan: next }), mutate.save({ op: "addTransactions", txs }));
    } else {
      // what it's worth and what's owed, in Goals: net worth then shows the down payment as equity
      if (!plan && addAccounts && kind !== "lease" && kind !== "other") {
        const color = (i: number) => CATEGORY_COLORS[(ds.accounts.length + i) % CATEGORY_COLORS.length];
        const debt: Account = {
          id: uid("acc"),
          name: t(kind === "mortgage" ? "plans.debtName.mortgage" : "plans.debtName.loan", { name: next.name }).slice(0, 80),
          institution: next.merchant,
          type: kind === "mortgage" ? "mortgage" : "loan",
          color: color(1),
          archived: false,
          notes: "",
          depreciation: 0,
        };
        next = { ...next, accountId: debt.id };
        const balances = [{ accountId: debt.id, date: today, balance: owedNow }];
        if (OWNED.includes(kind)) {
          const asset: Account = { id: uid("acc"), name: next.name.slice(0, 80), institution: "", type: "property", color: color(0), archived: false, notes: "", depreciation: round2(loss) };
          writes.push(mutate.save({ op: "upsertAccount", account: asset }));
          balances.push({ accountId: asset.id, date: today, balance: assetNow });
        }
        writes.push(mutate.save({ op: "upsertAccount", account: debt }), mutate.save({ op: "saveBalances", balances }));
      }
      writes.push(mutate.save({ op: "upsertPlan", plan: next }));
      // an extra payment taken off: its expense goes too (when it was logged as one)
      const removed = (plan?.prepayments ?? []).filter((x) => !prepayments.includes(x));
      const link = extraPaymentLink(next.id);
      const orphans = ds.transactions.filter((tx) => tx.billId === link && removed.some((x) => x.month === tx.date.slice(0, 7) && Math.abs(x.amount - tx.amount) < 0.005));
      if (orphans.length) writes.push(mutate.save({ op: "deleteTransactions", ids: orphans.map((tx) => tx.id) }));
    }
    if (!(await run(() => Promise.all(writes)))) return;
    toast.success(t("plans.saved"));
    onClose();
  };

  const remove = () => {
    if (!plan || !window.confirm(t("plans.deleteConfirm"))) return;
    mutate.mutate({ op: "deletePlan", id: plan.id });
    toast(t("plans.deleted"), { action: { label: t("common.undo"), onClick: () => mutate.mutate({ op: "upsertPlan", plan }) } });
    onClose();
  };

  const termChips = TERMS[kind] ?? [];
  const first = schedule[0];
  const last = schedule[schedule.length - 1];

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={plan ? plan.name : t("plans.new")}
      wide
      footer={
        <div className="flex items-center gap-2">
          {plan && (
            <Button variant="danger" size="icon" onClick={remove} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          {/* on phones these sit under the summary instead, with room for their labels */}
          {plan && onExtra && (
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => onExtra(plan)}>
              <CirclePlus className="h-4 w-4" /> {t("plans.extra.button")}
            </Button>
          )}
          {plan && onSimulate && (
            <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => onSimulate(plan)}>
              <SlidersHorizontal className="h-4 w-4" /> {t("plans.simulate")}
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" className="px-8" onClick={save} disabled={!valid || saving}>
            {saving ? t("common.saving") : isInst ? t("plans.saveInstallments", { n: instCount }) : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {!plan && (
          <Segmented
            value={mode}
            onChange={setMode}
            options={[
              { value: "installments" as const, label: t("plans.mode.installments") },
              { value: "loan" as const, label: t("plans.mode.loan") },
            ]}
          />
        )}

        {!isInst && (
          <div className="flex flex-wrap gap-1.5">
            {LOAN_KINDS.map((k) => {
              const Icon = PLAN_ICON[k];
              const on = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  disabled={!!plan && !on}
                  onClick={() => pickKind(k)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-40",
                    on ? "border-gold/50 bg-gold-soft text-ink" : "border-line text-ink-3 hover:text-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" /> {t(`plans.kind.${k}`)}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("plans.f.name")} className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t(`plans.f.namePh.${isInst ? "installments" : kind}`)} data-autofocus={plan ? undefined : ""} maxLength={120} />
          </Field>

          {isInst ? (
            <>
              <Field label={t("plans.f.total")}>
                <MoneyInput value={price} onChange={setPrice} placeholder="0.00" className="text-lg font-semibold" />
              </Field>
              <Field label={t("plans.f.installments")}>
                <CountStepper value={instCount} onChange={setInstCount} min={2} max={48} />
              </Field>
              <Field label={t("plans.f.firstInstallment")} className="sm:col-span-2">
                <Segmented
                  value={instFirst}
                  onChange={setInstFirst}
                  options={[
                    { value: "this" as const, label: t("plans.f.thisMonth") },
                    { value: "next" as const, label: t("plans.f.nextMonth") },
                  ]}
                />
                <p className="mt-1.5 text-xs text-ink-3">{t("plans.f.firstHint")}</p>
              </Field>
            </>
          ) : (
            <>
              {!knowPayment ? (
                <>
                  <Field label={t(`plans.f.price.${kind}`)}>
                    <MoneyInput value={price} onChange={setPrice} placeholder="0.00" className="text-lg font-semibold" />
                  </Field>
                  {!NO_DOWN.includes(kind) ? (
                    <Field label={t("plans.f.down")} hint={priceValue > 0 && downValue > 0 ? f.pct(downValue / priceValue) : undefined}>
                      <MoneyInput value={down} onChange={setDown} placeholder="0.00" />
                      {priceValue > 0 && (DOWN[kind] ?? []).length > 0 && (
                        <div className="mt-1.5 flex gap-1.5">
                          {(DOWN[kind] ?? []).map((share) => (
                            <button
                              key={share}
                              type="button"
                              onClick={() => setDown(String(round2(priceValue * share)))}
                              className={cn(
                                "rounded-full border px-2 py-0.5 text-[11px] transition-colors",
                                Math.abs(downValue - priceValue * share) < 0.01 ? "border-gold/40 bg-gold-soft text-gold-bright" : "border-line text-ink-3 hover:text-ink",
                              )}
                            >
                              {f.pct(share)}
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
                      <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value.replace(/[^\d.,]/g, ""))} placeholder="0" className="pr-24" />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{t("plans.f.rateUnit")}</span>
                    </div>
                  </Field>
                </>
              ) : (
                <>
                  <Field label={t("plans.f.monthly")}>
                    <MoneyInput value={monthlyIn} onChange={setMonthlyIn} placeholder="0.00" className="text-lg font-semibold" />
                  </Field>
                  <Field label={t("plans.f.down")} hint={t("common.optional")}>
                    <MoneyInput value={down} onChange={setDown} placeholder="0.00" />
                  </Field>
                </>
              )}
              <Field label={t("plans.f.term")} hint={termText(t, count)}>
                <div className="relative">
                  <Input
                    inputMode="numeric"
                    value={countText}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
                      setCountText(digits);
                      const n = Number.parseInt(digits, 10);
                      if (n >= 1) setCountValue(Math.min(1200, n));
                    }}
                    onBlur={() => setCountText(String(count))}
                    aria-label={t("plans.f.term")}
                    className="pr-28"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{t("plans.f.paymentsUnit")}</span>
                </div>
                {termChips.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {termChips.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setCount(m)}
                        className={cn("rounded-full border px-2 py-0.5 text-[11px] transition-colors", count === m ? "border-gold/40 bg-gold-soft text-gold-bright" : "border-line text-ink-3 hover:text-ink")}
                      >
                        {termText(t, m)}
                      </button>
                    ))}
                  </div>
                )}
              </Field>
              <Field label={t("plans.f.first")}>
                <Input type="date" value={firstDate} onChange={(e) => e.target.value && setFirstDate(e.target.value)} />
              </Field>
              {!knowPayment && parseAmount(rate) > 0 && (
                <Field label={t("plans.f.payments")}>
                  <Segmented
                    value={amortization}
                    onChange={setAmortization}
                    options={[
                      { value: "price" as const, label: t("plans.amort.price") },
                      { value: "sac" as const, label: t("plans.amort.sac") },
                    ]}
                  />
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{t(amortization === "sac" ? "plans.amort.sacHint" : "plans.amort.priceHint")}</p>
                </Field>
              )}
              <div className="sm:col-span-2">
                <Switch checked={knowPayment} onChange={setKnowPayment} label={t("plans.f.knowPayment")} />
              </div>
            </>
          )}
        </div>

        {/* what it comes to */}
        <Collapse show={!!(valid && first && last)} gap="pb-5">
          {first && last && (
            <div className="rounded-2xl border border-gold/20 bg-gold-soft/50 p-4">
              {isInst ? (
                <>
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="tabular-nums text-xl font-semibold text-gold-bright">
                      <MoneyText text={f.amount(first.amount)} />
                    </span>
                    <span className="text-sm text-ink-2">{t("plans.sum.installments", { n: schedule.length })}</span>
                    {last.amount !== first.amount && <span className="text-xs text-ink-3">· {t("plans.sum.lastOne", { amount: f.amount(last.amount) })}</span>}
                  </p>
                  <p className="mt-2 text-xs text-ink-3">{t("plans.sum.installmentsNote")}</p>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
                    <div>
                      <p className="text-xs text-ink-3">{t("plans.sum.financed")}</p>
                      <p className="tabular text-base font-semibold text-ink">{f.amount(financed(draft))}</p>
                    </div>
                    {/* a loan already running: the payment as it is now, its extra included */}
                    <div>
                      <p className="text-xs text-ink-3">{plan && nextPay ? t("plans.sum.nextPayment") : draft.amortization === "sac" ? t("plans.sum.firstPayment") : t("plans.sum.monthly")}</p>
                      <p className="tabular-nums text-xl font-semibold text-gold-bright">
                        <MoneyText text={f.amount((plan && nextPay ? nextPay : first).amount)} />
                      </p>
                      {plan && nextPay && extraIn(draft.extras, nextPay.date.slice(0, 7)) > 0 && (
                        <p className="text-[11px] text-ink-3">
                          {t("plans.sum.withExtra", { extra: f.amount(extraIn(draft.extras, nextPay.date.slice(0, 7))) })}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-ink-3">{t("plans.sum.paidOff")}</p>
                      <p className="text-base font-semibold text-ink">{f.monthLong(last.date.slice(0, 7))}</p>
                    </div>
                  </div>
                  {draft.rate > 0 && (
                    <p className="mt-3 text-xs leading-relaxed text-ink-3">
                      {t(draft.downPayment > 0 ? "plans.sum.interest" : "plans.sum.interestNoDown", {
                        interest: f.amount(interest),
                        term: termText(t, schedule.length),
                        total: f.amount(round2(interest + financed(draft) + draft.downPayment)),
                      })}{" "}
                      {draft.amortization === "price"
                        ? t("plans.sum.sacCompare", { first: f.amount(other[0]?.amount ?? 0), interest: f.amount(otherInterest) })
                        : t("plans.sum.priceCompare", { payment: f.amount(other[0]?.amount ?? 0), interest: f.amount(otherInterest) })}
                    </p>
                  )}
                  {knowPayment && <p className="mt-3 text-xs text-ink-3">{t("plans.sum.noInterest")}</p>}
                  {/* where the money goes: early payments are mostly interest */}
                  {draft.rate > 0 && (nextPay ?? first) && (
                    <div className="mt-3 border-t border-gold/15 pt-3">
                      <PaymentSplit
                        label={nextPay && plan ? t("plans.split.next", { date: f.dateShort(nextPay.date) }) : t("plans.split.first")}
                        principal={(nextPay && plan ? nextPay : first).principal}
                        interest={(nextPay && plan ? nextPay : first).interest}
                      />
                      {plan && soFar.principal + soFar.interest > 0 && (
                        <p className="mt-2 text-[11px] text-ink-3">
                          {t("plans.split.soFar", { principal: f.amount(soFar.principal), interest: f.amount(soFar.interest) })}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Collapse>

        <Collapse show={rewrites} gap="pb-5">
          <p className="rounded-2xl border border-warn/30 bg-warn-soft p-3.5 text-xs leading-relaxed text-ink-2">{t("plans.f.rewrites")}</p>
        </Collapse>

        {plan && !isInst && (onExtra || onSimulate) && (
          <div className="grid grid-cols-2 gap-2 sm:hidden">
            {onExtra && (
              <Button onClick={() => onExtra(plan)}>
                <CirclePlus className="h-4 w-4" /> {t("plans.extra.button")}
              </Button>
            )}
            {onSimulate && (
              <Button onClick={() => onSimulate(plan)}>
                <SlidersHorizontal className="h-4 w-4" /> {t("plans.simulate")}
              </Button>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.category")}>
            <CategorySelect
              value={category}
              onChange={(c) => {
                setCategory(c);
                setSubcategory("");
              }}
              categories={shown}
              placeholder={t("split.pickCategory")}
              aria-label={t("form.category")}
            />
          </Field>
          {currentCat && currentCat.subcategories.length > 0 ? (
            <Field label={t("form.subcategory")} hint={t("common.optional")}>
              <SubcategorySelect value={subcategory} onChange={setSubcategory} category={currentCat} anyLabel={t("split.noSub")} placeholder={t("split.anySub")} aria-label={t("form.subcategory")} />
            </Field>
          ) : (
            <div className="hidden sm:block" />
          )}
          <Field label={isInst ? t("form.merchant") : t("plans.f.lender")} hint={t("common.optional")}>
            <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} maxLength={120} />
          </Field>
          <Field label={t("form.payment")}>
            <PaymentSelect
              value={payment}
              onChange={setPayment}
              methods={[...new Set([...ds.settings.paymentMethods, payment].filter(Boolean))]}
              styles={ds.settings.paymentStyles}
              placeholder={t("form.payment")}
              aria-label={t("form.payment")}
            />
          </Field>
        </div>

        {/* a new rate from a payment on: a running loan with interest */}
        {plan && !isInst && !knowPayment && (draft.rate > 0 || rateChanges.length > 0) && (
          <RateChanges plan={draft} currency={currency} value={rateChanges} onChange={setRateChanges} nextMonth={nextMonth ?? addMonths(currentMonth(), 1)} />
        )}

        {/* what's added to every payment from a month on: one bigger payment a month, not a second one.
            Payments already made keep their extra — a change only ever starts with the next payment. */}
        <Collapse show={!isInst && extraPeriods.length > 0} gap="pb-5">
          <Field label={t("plans.extraMonthly.list")}>
            <ul className="divide-y divide-line/60 rounded-2xl border border-line">
              {extraPeriods.map((x) => (
                <li key={x.from} className={cn("flex items-center gap-3 px-3.5 py-2.5 text-[13px]", x.past && "text-ink-3")}>
                  <span className={cn("shrink-0", x.past ? "text-ink-3" : "text-ink-2")}>
                    {x.until ? t("plans.extraMonthly.range", { from: ym(x.from), until: ym(x.until) }) : t("plans.extraMonthly.from", { month: ym(x.from) })}
                  </span>
                  <span className={cn("tabular flex-1 font-medium", x.past ? "text-ink-3" : "text-ink")}>{t("plans.extraMonthly.amount", { amount: f.amount(x.amount) })}</span>
                  {x.payment !== undefined && !x.past && <span className="hidden text-xs text-ink-3 sm:inline">{t("plans.extraMonthly.becomes", { amount: f.amount(x.payment) })}</span>}
                  {x.started && !x.past && nextMonth ? (
                    // already paid with it: ends from the next payment, the payments made keep it
                    <button
                      type="button"
                      onClick={() => setExtras((cur) => [...cur.filter((e) => e.from < nextMonth), { from: nextMonth, amount: 0 }])}
                      className="rounded-lg px-2 py-1 text-xs text-ink-3 hover:bg-white/5 hover:text-bad"
                      title={t("plans.extraMonthly.stopHint", { month: f.monthLong(nextMonth) })}
                    >
                      {t("plans.extraMonthly.stop")}
                    </button>
                  ) : !x.started ? (
                    <button
                      type="button"
                      onClick={() => setExtras((cur) => cur.filter((e) => e.from !== x.from))}
                      className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-bad"
                      aria-label={t("common.delete")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-3">{t("plans.extraMonthly.hint")}</p>
          </Field>
        </Collapse>

        {/* extra payments on this loan, made or planned: what each did, and a way to take one back */}
        <Collapse show={!isInst && prepayments.length > 0} gap="pb-5">
          <Field label={t("plans.extra.list")}>
            <ul className="divide-y divide-line/60 rounded-2xl border border-line">
              {[...prepayments]
                .sort((a, b) => (a.month < b.month ? -1 : 1))
                .map((x) => (
                  <li key={`${x.month}|${x.amount}|${x.mode}`} className="flex items-center gap-3 px-3.5 py-2.5 text-[13px]">
                    <span className="w-24 shrink-0 text-ink-2">{f.monthShort(x.month)} {x.month.slice(0, 4)}</span>
                    <span className="tabular flex-1 font-medium text-ink">{f.amount(x.amount)}</span>
                    <span className="hidden text-xs text-ink-3 sm:inline">
                      {t(x.mode === "shorten" ? "plans.sim.shorten" : "plans.sim.lower")}
                      {x.month > currentMonth() && ` · ${t("plans.extra.planned")}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPrepayments((cur) => cur.filter((y) => y !== x))}
                      className="grid h-7 w-7 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-bad"
                      aria-label={t("common.delete")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
          </Field>
        </Collapse>

        {isInst ? (
          <ToggleCard checked={countAsDebt} onChange={setCountAsDebt} icon={<Scale />} title={t("plans.f.countAsDebt")} description={t("plans.f.countAsDebtHint")} />
        ) : (
          <Collapse show={!plan && kind !== "lease" && kind !== "other"} gap="pb-5">
            <ToggleCard checked={addAccounts} onChange={setAddAccounts} icon={<Landmark />} title={t("plans.f.netWorth")} description={t("plans.f.netWorthDesc")}>
              {/* the accounts it will add to Goals */}
              <ul className="space-y-1.5 border-t border-line/60 pt-3 text-xs">
                {OWNED.includes(kind) && (
                  <li className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="h-2 w-2 shrink-0 rounded-full bg-good" />
                      <span className="truncate text-ink-2">{draft.name || t(`plans.kind.${kind}`)}</span>
                      <span className="shrink-0 text-ink-3">{t("plans.f.asset")}</span>
                    </span>
                    <span className="tabular shrink-0 text-good">{f.amount(assetNow)}</span>
                  </li>
                )}
                {/* cars lose value: check-ins start from that estimate instead of the price */}
                {OWNED.includes(kind) && (
                  <li className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-4 text-ink-3">
                    <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("plans.f.loses")}</span>
                    <input
                      inputMode="decimal"
                      value={lossText}
                      onChange={(e) => setLossIn(e.target.value.replace(/[^\d.,]/g, "").slice(0, 5))}
                      onFocus={(e) => e.target.select()}
                      aria-label={t("acc.depreciation")}
                      className="h-6 w-11 rounded-md border border-line bg-surface-2/80 px-1.5 text-right text-xs text-ink tabular-nums focus:border-gold/60 focus:outline-none"
                    />
                    <span>{t("plans.f.rateUnit")}</span>
                    <span className="basis-full pl-5 sm:basis-auto sm:pl-0">
                      · {loss > 0 ? t("plans.f.inAYear", { amount: f.amount(round2(assetNow * (1 - loss / 100))) }) : t("plans.f.keepsValue")}
                    </span>
                  </li>
                )}
                <li className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-bad" />
                    <span className="truncate text-ink-2">{t(kind === "mortgage" ? "plans.debtName.mortgage" : "plans.debtName.loan", { name: draft.name || t(`plans.kind.${kind}`) })}</span>
                    <span className="shrink-0 text-ink-3">{t("plans.f.debt")}</span>
                  </span>
                  <span className="tabular shrink-0 text-bad">−{f.amount(owedNow)}</span>
                </li>
              </ul>
            </ToggleCard>
          </Collapse>
        )}

        <Field label={t("goals.f.notes")}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="min-h-16" />
        </Field>
      </div>
    </Sheet>
  );
}

/** 2× … 48×: typed, or nudged with − and + */
export function CountStepper({ value, onChange, min, max }: { value: number; onChange: (n: number) => void; min: number; max: number }) {
  const { t } = useI18n();
  const [text, setText] = useState(String(value));
  // follow − and + (and a reset from outside) unless a number is being typed
  const [typing, setTyping] = useState(false);
  const shown = typing ? text : String(value);
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  const step = (d: number) => onChange(clamp(value + d));
  const commit = () => {
    setTyping(false);
    const n = Number.parseInt(text, 10);
    onChange(Number.isFinite(n) ? clamp(n) : value);
  };
  return (
    <div className="flex h-11 items-center justify-between rounded-xl border border-line bg-surface-2/80 px-1.5 focus-within:border-gold/50">
      <button type="button" onClick={() => step(-1)} disabled={value <= min} className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-white/5 disabled:opacity-30" aria-label="−">
        <Minus className="h-4 w-4" />
      </button>
      <label className="flex items-baseline gap-0.5">
        <input
          inputMode="numeric"
          value={shown}
          aria-label={t("plans.f.installments")}
          onFocus={(e) => {
            setText(String(value));
            setTyping(true);
            e.target.select();
          }}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 3);
            setText(digits);
            // the preview follows as long as it's a count that works
            const n = Number.parseInt(digits, 10);
            if (n >= min && n <= max) onChange(n);
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className="tabular w-10 bg-transparent text-right text-base font-semibold text-ink outline-none"
        />
        <span className="text-base font-semibold text-ink-3">×</span>
      </label>
      <button type="button" onClick={() => step(1)} disabled={value >= max} className="grid h-8 w-8 place-items-center rounded-lg text-ink-2 hover:bg-white/5 disabled:opacity-30" aria-label="+">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** A saved installment plan: its parts, and cancelling what's still to come */
function InstallmentsView({ ds, open, plan, onClose }: { ds: Dataset; open: boolean; plan: Plan; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const today = todayISO();
  const parts = installmentsOf(plan, ds.transactions);
  const standing = planStanding(plan, ds, today);
  const future = parts.filter((p) => p.date > today);

  const cancelRemaining = () => {
    if (!window.confirm(t("plans.cancelConfirm"))) return;
    if (future.length) mutate.mutate({ op: "deleteTransactions", ids: future.map((p) => p.id) });
    mutate.mutate({ op: "upsertPlan", plan: { ...plan, status: "cancelled" } });
    toast(t("plans.cancelled"));
    onClose();
  };
  const remove = () => {
    if (!window.confirm(t("plans.deleteInstallmentsConfirm"))) return;
    if (future.length) mutate.mutate({ op: "deleteTransactions", ids: future.map((p) => p.id) });
    mutate.mutate({ op: "deletePlan", id: plan.id });
    toast(t("plans.deleted"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={plan.name}
      description={`${t("plans.kind.installments")} · ${t("plans.progress", { paid: standing.paid, count: parts.length || plan.count })}${standing.owed > 0 ? ` · ${t("plans.owed", { amount: f.amount(standing.owed) })}` : ""}`}
      footer={
        <div className="flex items-center gap-2">
          <Button variant="danger" size="icon" onClick={remove} aria-label={t("common.delete")}>
            <Trash2 className="h-4 w-4" />
          </Button>
          {plan.status === "active" && future.length > 0 && (
            <Button variant="ghost" onClick={cancelRemaining}>
              <XCircle className="h-4 w-4" /> {t("plans.cancelRemaining")}
            </Button>
          )}
          <Button variant="primary" className="ml-auto px-8" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {parts.map((p, i) => {
            const paid = p.date <= today;
            return (
              <li key={p.id} className={cn("rounded-xl border px-2.5 py-2 text-xs", paid ? "border-line bg-white/[0.03] text-ink-3" : "border-gold/25 bg-gold-soft/40 text-ink-2")}>
                <span className="block">
                  {f.monthShort(p.date.slice(0, 7))} {p.date.slice(2, 4) !== today.slice(2, 4) ? `’${p.date.slice(2, 4)}` : ""} · {i + 1}/{parts.length}
                </span>
                <span className={cn("tabular block text-[13px]", paid ? "text-ink-2" : "text-ink")}>{f.amount(p.amount)}</span>
              </li>
            );
          })}
        </ul>
        {plan.status === "active" && (
          <ToggleCard
            checked={plan.countAsDebt}
            onChange={(v) => mutate.mutate({ op: "upsertPlan", plan: { ...plan, countAsDebt: v } })}
            icon={<Scale />}
            title={t("plans.f.countAsDebt")}
            description={t("plans.f.countAsDebtHint")}
          />
        )}
      </div>
    </Sheet>
  );
}

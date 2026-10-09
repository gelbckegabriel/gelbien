"use client";

import { AlertTriangle, CalendarClock, ChevronRight, ClipboardCheck, Copy, Plus, Repeat, RotateCcw, Wand2 } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { toast } from "sonner";
import { BillCheck, useSkippedBills } from "@/components/dashboard/bills";
import { CategoryIcon } from "@/components/icons";
import { GuardedLink } from "@/components/shell/unsaved";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader, Stagger } from "@/components/ui/card";
import { Field, MoneyInput, Segmented } from "@/components/ui/form";
import { AnimatedNumber, Badge, EmptyState, Progress, STATUS_TONE } from "@/components/ui/misc";
import { SaveBar } from "@/components/ui/save-bar";
import { committedBills, monthCharges, type BillCharge } from "@/lib/bills";
import { useDataset, useMutate } from "@/lib/data/hooks";
import { budgetStatus, effectiveBudget, effectiveIncome, expectedPace, monthlyCost, subscriptionTotals, suggestBudget, summarizeMonth } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { growX } from "@/lib/motion";
import { SUB_KINDS, type Dataset, type Subscription } from "@/lib/types";
import { useUi, useView } from "@/lib/ui-store";
import { stashDraft, useStashedDraft, useUnsavedChanges } from "@/lib/unsaved";
import { addMonths, cn, parseAmount, round2, todayISO } from "@/lib/utils";

type Scope = "month" | "default";

const TONE_TEXT = { good: "text-good", warn: "text-warn", bad: "text-bad", gold: "text-gold" } as const;

interface Draft {
  scope: Scope;
  gross: string;
  net: string;
  lines: Record<string, string>;
}

const str = (n: number) => (n ? String(round2(n)) : "");

function draftFor(ds: Dataset, month: string): Draft {
  const { lines, isOverride } = effectiveBudget(ds.budgets, month);
  const income = effectiveIncome(ds.incomes, month);
  const hasIncomeOverride = ds.incomes.some((i) => i.month === month);
  return {
    scope: isOverride || hasIncomeOverride ? "month" : "default",
    gross: str(income.gross),
    net: str(income.net),
    lines: Object.fromEntries(ds.categories.map((c) => [c.name, str(lines[c.name] ?? 0)])),
  };
}

export default function BudgetPage() {
  const ds = useDataset().data as Dataset;
  const month = useUi((s) => s.month);
  // Remount the editor when the month or the underlying data changes.
  const version = `${month}|${JSON.stringify(ds.budgets)}|${JSON.stringify(ds.incomes)}|${ds.categories.length}`;
  return (
    <Stagger className="space-y-4">
      <BudgetEditor key={version} ds={ds} month={month} />
      <Subscriptions ds={ds} month={month} />
    </Stagger>
  );
}

function BudgetEditor({ ds, month }: { ds: Dataset; month: string }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const initial = useMemo(() => draftFor(ds, month), [ds, month]);
  const draftId = `budget:${month}`;
  const [draft, setDraft] = useStashedDraft<Draft>(draftId, () => initial);
  const summary = summarizeMonth(ds, month);
  const spentBy = new Map(summary.byCategory.map((c) => [c.name, c.spent]));
  const skipped = useSkippedBills();
  const committed = useMemo(() => committedBills(ds, month, todayISO(), skipped), [ds, month, skipped]);
  const { isOverride } = effectiveBudget(ds.budgets, month);
  const hasIncomeOverride = ds.incomes.some((i) => i.month === month);
  const categories = ds.categories.filter((c) => !c.archived || parseAmount(draft.lines[c.name]) > 0);
  const [order, setOrder] = useView("budget.limits", "spent", ["spent", "category"] as const);
  // biggest spending first (ties keep the category order); spending doesn't change while limits are typed, so rows stay put
  const rows = order === "spent" ? [...categories].sort((a, b) => (spentBy.get(b.name) ?? 0) - (spentBy.get(a.name) ?? 0)) : categories;

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const gross = parseAmount(draft.gross);
  const net = parseAmount(draft.net);
  const planned = categories.reduce((a, c) => a + parseAmount(draft.lines[c.name]), 0);
  const unallocated = net - planned;
  const taxRate = gross > 0 && net > 0 ? 1 - net / gross : 0;

  const setLine = (name: string, v: string) => setDraft((d) => ({ ...d, lines: { ...d.lines, [name]: v } }));

  const save = () => {
    const target = draft.scope === "month" ? month : "default";
    const lines = ds.categories
      .map((c) => ({ month: target, category: c.name, amount: round2(parseAmount(draft.lines[c.name])) }))
      .filter((l) => l.amount > 0);
    const onFailure = () => stashDraft(draftId, draft);
    mutate.mutate({ op: "saveBudget", month: target, lines, income: { month: target, gross: round2(gross), net: round2(net), note: "" } }, { onFailure });
    // Saving to "every month" drops this month's overrides so the default actually applies here.
    if (draft.scope === "default" && (isOverride || hasIncomeOverride)) {
      mutate.mutate({ op: "saveBudget", month, lines: [], income: null, clearIncome: true }, { onFailure });
    }
    toast.success(t("budget.saved"));
  };
  useUnsavedChanges(dirty, { save, monthScoped: true });

  const useDefault = () => {
    mutate.mutate({ op: "saveBudget", month, lines: [], income: null, clearIncome: true });
    toast.success(t("budget.saved"));
  };

  const suggest = () => {
    const s = suggestBudget(ds, month);
    setDraft((d) => ({ ...d, lines: Object.fromEntries(ds.categories.map((c) => [c.name, str(s[c.name] ?? 0)])) }));
  };

  const copyPrev = () => {
    const prev = draftFor(ds, addMonths(month, -1));
    setDraft((d) => ({ ...d, gross: prev.gross, net: prev.net, lines: prev.lines }));
  };

  // allocation bar: each category's share of net income, then what's left to save
  const base = Math.max(net, planned, 1);
  const segments = categories
    .map((c) => ({ name: c.name, color: c.color, value: parseAmount(draft.lines[c.name]) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <PageHeader
        title={t("budget.title")}
        subtitle={t("budget.subtitle", { month: f.monthLong(month) })}
        action={
          <>
            <Button size="sm" variant="ghost" onClick={copyPrev}>
              <Copy className="h-4 w-4" /> {t("budget.copyPrev")}
            </Button>
            <Button size="sm" variant="outline" onClick={suggest}>
              <Wand2 className="h-4 w-4" /> {t("budget.suggest")}
            </Button>
          </>
        }
      />

      {/* Income and the plan it funds share one card, so the two halves always line up. */}
      <Card className="p-6">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <div className="space-y-4 xl:border-r xl:border-line xl:pr-8">
            <h2 className="text-[15px] font-semibold tracking-tight text-ink">{t("budget.income.title")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("budget.income.gross")}>
                <MoneyInput value={draft.gross} onChange={(v) => setDraft((d) => ({ ...d, gross: v }))} placeholder="0.00" />
              </Field>
              <Field label={t("budget.income.net")}>
                <MoneyInput value={draft.net} onChange={(v) => setDraft((d) => ({ ...d, net: v }))} placeholder="0.00" className="text-good" />
              </Field>
            </div>
            {gross > 0 && net > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm">
                <span className="min-w-0 text-ink-2">
                  {t("budget.income.tax")}
                  <span className="block text-xs text-ink-3">{t("budget.income.taxRate", { pct: f.pct1(taxRate) })}</span>
                </span>
                <span className="tabular shrink-0 whitespace-nowrap text-bad">−{f.money(gross - net)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-2 items-end gap-4 sm:grid-cols-4">
              <div>
                <p className="text-xs text-ink-3">{t("dash.kpi.income")}</p>
                <AnimatedNumber smallCents value={net} format={f.amount} className="mt-1 block text-2xl font-semibold text-good" />
              </div>
              <div>
                <p className="text-xs text-ink-3">{t("budget.plan.planned")}</p>
                <AnimatedNumber smallCents value={planned} format={f.amount} className="mt-1 block text-2xl font-semibold text-ink" />
              </div>
              <div>
                <p className="text-xs text-ink-3">{unallocated >= 0 ? t("budget.plan.savings") : t("budget.plan.overAllocated")}</p>
                <AnimatedNumber smallCents value={Math.abs(unallocated)} format={f.amount} className={cn("mt-1 block text-2xl font-semibold", unallocated >= 0 ? "text-gold-bright" : "text-bad")} />
              </div>
              <div>
                <p className="text-xs text-ink-3">{t("dash.kpi.savingsRate")}</p>
                <AnimatedNumber value={net > 0 ? unallocated / net : 0} format={f.pct} className="mt-1 block text-2xl font-semibold text-ink" />
              </div>
            </div>

            <div>
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-white/5">
                {segments.map((s, i) => (
                  <motion.div
                    key={s.name}
                    title={`${s.name}: ${f.amount(s.value)}`}
                    className="h-full origin-left transition-[width] duration-500 ease-out first:rounded-l-full"
                    style={{ background: s.color, width: `${(s.value / base) * 100}%` }}
                    {...growX(i * 0.03, 90, 20)}
                  />
                ))}
                {unallocated > 0 && (
                  <motion.div
                    className="gold-fill h-full rounded-r-full origin-left transition-[width] duration-500 ease-out"
                    style={{ width: `${(unallocated / base) * 100}%` }}
                    {...growX(segments.length * 0.03, 90, 20)}
                    title={`${t("budget.plan.savings")}: ${f.amount(unallocated)}`}
                  />
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
                <CalendarClock className="h-3.5 w-3.5" />
                {isOverride || hasIncomeOverride ? t("budget.hasOverride") : t("budget.usingDefault")}
                {(isOverride || hasIncomeOverride) && (
                  <button onClick={useDefault} className="inline-flex items-center gap-1 text-gold hover:underline">
                    <RotateCcw className="h-3 w-3" /> {t("budget.resetDefault")}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-3">
              <span className="text-xs text-ink-3">{t("budget.scope.label")}</span>
              <Segmented
                value={draft.scope}
                onChange={(scope) => setDraft((d) => ({ ...d, scope }))}
                options={[
                  { value: "month" as Scope, label: t("budget.scope.month", { month: f.monthName(month) }) },
                  { value: "default" as Scope, label: t("budget.scope.default") },
                ]}
              />
            </div>
          </div>
        </div>
      </Card>

      <PlanVsActual
        s={summary}
        planned={planned}
        net={net}
        // spending the plan doesn't cover: categories without a limit
        unplanned={round2(summary.byCategory.filter((c) => !(parseAmount(draft.lines[c.name]) > 0)).reduce((a, c) => a + c.spent, 0))}
        warnAt={ds.settings.warnAt}
        committed={committed}
        // the limits as they're being edited
        paceByDay={expectedPace(ds, month, Object.fromEntries(categories.map((c) => [c.name, parseAmount(draft.lines[c.name])])))}
      />

      <Card>
        <CardHeader
          title={t("budget.plan.title")}
          subtitle={`${t("budget.plan.planned")}: ${f.amount(planned)} · ${unallocated >= 0 ? t("budget.plan.unallocated") : t("budget.plan.overAllocated")}: ${f.amount(Math.abs(unallocated))}`}
          action={
            <Segmented
              size="sm"
              value={order}
              onChange={setOrder}
              options={[
                { value: "spent" as const, label: t("budget.plan.order.spent") },
                { value: "category" as const, label: t("budget.plan.order.category") },
              ]}
            />
          }
        />
        <ul className="grid grid-cols-1 gap-x-10 xl:grid-cols-2">
          {rows.map((c, i) => {
            const limit = parseAmount(draft.lines[c.name]);
            const spent = spentBy.get(c.name) ?? 0;
            const status = budgetStatus(spent, limit, ds.settings.warnAt);
            return (
              // Phones: two lines — name and limit, then the progress bar across the card. Larger screens:
              // the bar under the name, the limit beside both (a grid, so it's one set of elements for both).
              <li
                key={c.name}
                className="group relative isolate grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 border-b border-line/50 py-3 sm:gap-y-1.5"
              >
                {/* hover highlight behind everything but the limit field */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-1.5 -left-1.5 right-[calc(6rem+0.75rem)] -z-10 rounded-xl bg-white/[0.04] opacity-0 transition-opacity group-has-[a:hover]:opacity-100 sm:right-[calc(8rem+0.75rem)]"
                />
                <CategoryIcon icon={c.icon} color={c.color} className="row-span-2" />
                <div className="flex min-w-0 items-center gap-2">
                  {/* the whole row (but the limit field) opens this month's expenses for the category */}
                  <GuardedLink
                    href={`/expenses?category=${encodeURIComponent(c.name)}`}
                    title={t("budget.plan.viewExpenses", { category: c.name })}
                    className="truncate text-sm text-ink outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-gold/60"
                  >
                    {c.name}
                  </GuardedLink>
                  {limit > 0 && status !== "within" && (
                    // Icon-only on phones so long names fit; the coloured % below carries the same status
                    <Badge tone={STATUS_TONE[status]} className="px-1.5 sm:px-2">
                      <span title={t(`budgetStatus.${status}`)} className="sm:hidden">
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                      </span>
                      <span className="sr-only sm:not-sr-only">{t(`budgetStatus.${status}`)}</span>
                    </Badge>
                  )}
                </div>
                <div className="relative z-10 w-24 sm:row-span-2 sm:w-32">
                  <MoneyInput value={draft.lines[c.name] ?? ""} onChange={(v) => setLine(c.name, v)} placeholder="0" className="h-10 text-right" aria-label={c.name} />
                </div>
                <div className="col-span-2 col-start-2 flex items-center gap-2 sm:col-span-1">
                  {limit > 0 ? <Progress value={spent / limit} tone={STATUS_TONE[status]} className="h-1.5" delay={i * 0.03} /> : <div className="h-1.5 flex-1 rounded-full bg-white/5" />}
                  <span className="tabular min-w-20 shrink-0 whitespace-nowrap text-right text-[11px] text-ink-3 sm:min-w-28">
                    {limit > 0 ? (
                      <>
                        <span className={cn("font-semibold", TONE_TEXT[STATUS_TONE[status]])}>{f.pct(spent / limit)}</span> · {f.amount(spent)}
                      </>
                    ) : (
                      t("budget.plan.spent", { amount: f.amount(spent) })
                    )}
                  </span>
                  <ChevronRight className="-ml-1 h-3.5 w-3.5 shrink-0 text-ink-3" />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <SaveBar show={dirty} label={t("budget.unsaved")} onSave={save} onReset={() => setDraft(initial)} />
    </>
  );
}

/** How the month is going against the plan: spent vs. planned, pace for the current month, savings once it's over. */
// the part of the plan already spoken for by bills
const BILL_STRIPES = { background: "repeating-linear-gradient(135deg, #d9b45fb3 0 3px, #d9b45f40 3px 6px)" };

function PlanVsActual({
  s,
  planned,
  net,
  unplanned,
  warnAt,
  committed,
  paceByDay,
}: {
  s: ReturnType<typeof summarizeMonth>;
  planned: number;
  net: number;
  unplanned: number;
  warnAt: number;
  /** bills this month with nothing logged yet */
  committed: BillCharge[];
  /** spending on plan by day, cumulative (expectedPace) */
  paceByDay: number[];
}) {
  const { t, f } = useI18n();
  const openReview = useUi((st) => st.openReview);
  const spent = s.total;
  const bills = round2(committed.reduce((a, c) => a + c.sub.amount, 0));
  // what's free once the bills still to pay are set aside
  const left = planned - spent - bills;
  const tone = STATUS_TONE[budgetStatus(spent + bills, planned, warnAt)];
  const at = (amount: number) => Math.min(100, (amount / planned) * 100);
  const names = [...new Set(committed.map((c) => c.sub.name))];
  // bills on their day and the rest spread evenly, same as the dashboard's pace chart
  const expected = s.isCurrent && planned > 0 ? (paceByDay[s.elapsed - 1] ?? null) : null;
  const pace = expected === null ? 0 : expected - spent;
  const month = f.monthName(s.month);
  // a month that hasn't started has nothing to compare yet (unless something was already logged in it)
  const compare = planned > 0 && (!s.isFuture || spent > 0 || bills > 0);
  const subtitle = s.isCurrent
    ? t("budget.vs.soFar", { month, day: s.elapsed, days: s.days })
    : s.isPast
      ? t("budget.vs.closed", { month })
      : t("budget.vs.notStarted", { month });

  return (
    <Card>
      <CardHeader title={t("budget.vs.title")} subtitle={subtitle} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <AnimatedNumber smallCents value={spent} format={f.amount} className="text-2xl font-semibold text-ink" />
          <span className="text-sm text-ink-3">
            {planned > 0 ? t("budget.vs.ofPlanned", { pct: f.pct(spent / planned), amount: f.amount(planned) }) : t("budget.vs.noPlan", { month })}
          </span>
        </p>
        {compare && (
          <Badge tone={left >= 0 ? "good" : "bad"}>
            {left < 0 ? t("budget.vs.over") : s.isPast ? t("budget.vs.under") : t("budget.vs.left")} · {f.amount(Math.abs(left))}
          </Badge>
        )}
      </div>
      {compare && (
        <div className="relative mt-3">
          <Progress value={spent / planned} tone={tone} className="h-2.5" />
          {bills > 0 && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <span className="absolute inset-y-0" style={{ left: `${at(spent)}%`, width: `${Math.max(0, at(spent + bills) - at(spent))}%`, ...BILL_STRIPES }} />
            </div>
          )}
          {expected !== null && (
            <span
              title={t("budget.vs.todayMarker")}
              className="absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded-full bg-ink/80"
              style={{ left: `${Math.min(100, (expected / planned) * 100)}%` }}
            />
          )}
        </div>
      )}
      <div className="mt-3 space-y-1 text-xs text-ink-3">
        {bills > 0 && (
          <p className="flex items-start gap-1.5">
            <span className="mt-0.5 h-2.5 w-3 shrink-0 rounded-sm" style={BILL_STRIPES} />
            <span>
              {t("budget.vs.bills", {
                amount: f.amount(bills),
                month,
                names: `${names.slice(0, 3).join(", ")}${names.length > 3 ? ` +${names.length - 3}` : ""}`,
              })}
            </span>
          </p>
        )}
        {expected !== null && (
          <p>
            {t("budget.vs.pace", { expected: f.amount(expected) })} ·{" "}
            <span className={pace >= 0 ? "text-good" : "text-bad"}>
              {pace >= 0 ? t("budget.vs.paceBehind", { amount: f.amount(pace) }) : t("budget.vs.paceAhead", { amount: f.amount(-pace) })}
            </span>
          </p>
        )}
        {s.isPast && net > 0 && <p>{t("budget.vs.savings", { actual: f.amount(net - spent), planned: f.amount(net - planned) })}</p>}
        {unplanned > 0 && <p>{t("budget.vs.unplanned", { amount: f.amount(unplanned) })}</p>}
      </div>
      {s.isPast && s.count > 0 && (
        <button onClick={() => openReview(s.month)} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-gold hover:underline">
          <ClipboardCheck className="h-4 w-4" /> {t("review.openFull")}
        </button>
      )}
    </Card>
  );
}

function Subscriptions({ ds, month }: { ds: Dataset; month: string }) {
  const { t, f } = useI18n();
  const open = useUi((s) => s.openSubscription);
  // this month's charge of each one, logged or not — ticked off right here
  const charges = useMemo(() => monthCharges(ds, month), [ds, month]);
  const totals = subscriptionTotals(ds.subscriptions);
  const order: Record<Subscription["status"], number> = { trial: 0, active: 1, paused: 2, cancelled: 3 };
  const sorted = [...ds.subscriptions].sort((a, b) => order[a.status] - order[b.status] || monthlyCost(b) - monthlyCost(a));
  const groups = SUB_KINDS.map((kind) => ({ kind, items: sorted.filter((s) => s.kind === kind) })).filter((g) => g.items.length);
  const cats = new Map(ds.categories.map((c) => [c.name, c]));
  const perMonth = (n: number) => t("budget.subs.perMonth", { amount: f.money(n) });

  return (
    <Card>
      <CardHeader
        title={t("budget.subs.title")}
        subtitle={t("budget.subs.subtitle")}
        action={
          <Button size="sm" variant="outline" onClick={() => open()}>
            <Plus className="h-4 w-4" /> {t("budget.subs.add")}
          </Button>
        }
      />
      <div className="mb-5 grid gap-2 sm:grid-cols-3 sm:gap-3">
        {[
          { label: `${t("budget.subs.active")} · ${t("budget.subs.monthly")}`, value: totals.activeMonthly, cls: "text-ink" },
          { label: `${t("budget.subs.active")} · ${t("budget.subs.yearly")}`, value: totals.activeYearly, cls: "text-gold-bright" },
          {
            // the part that's easiest to cut
            label: `${t("budget.subs.group.subscription")} · ${t("budget.subs.monthly")}`,
            value: totals.subscriptionsMonthly,
            cls: "text-ink",
            note: totals.trialCount ? t("budget.subs.trialExtra", { amount: f.money(totals.trialMonthly) }) : undefined,
          },
        ].map((k) => (
          <div key={k.label} className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 sm:block sm:p-3">
            <p className="text-xs text-ink-3 sm:text-[11px]">{k.label}</p>
            <span className="text-right sm:text-left">
              <AnimatedNumber smallCents value={k.value} format={f.money} className={cn("block whitespace-nowrap text-lg font-semibold sm:mt-1", k.cls)} />
              {k.note && <span className="block text-[11px] text-warn">{k.note}</span>}
            </span>
          </div>
        ))}
      </div>
      {groups.length === 0 ? (
        <EmptyState icon={<Repeat className="h-6 w-6" />} title={t("budget.subs.empty")} />
      ) : (
        <div className="-mx-2 space-y-3">
          {groups.map((g) => (
            <section key={g.kind}>
              {/* headed only when both kinds are there */}
              {groups.length > 1 && (
                <h3 className="flex items-baseline justify-between px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
                  <span>{t(`budget.subs.group.${g.kind}`)}</span>
                  <span className="tabular normal-case tracking-normal">{perMonth(g.kind === "bill" ? totals.billsMonthly : totals.subscriptionsMonthly)}</span>
                </h3>
              )}
              <ul className="space-y-0.5">
                {g.items.map((s, i) => {
                  const c = cats.get(s.category);
                  const tone = s.status === "trial" ? "warn" : "neutral";
                  const charge = charges.get(s.id);
                  return (
                    <motion.li key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-1 pr-2">
                      <button
                        onClick={() => open(s)}
                        className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]", s.status === "cancelled" && "opacity-50")}
                      >
                        <CategoryIcon icon={c?.icon ?? "Repeat"} color={c?.color ?? "#6f7fe0"} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm text-ink">{s.name}</span>
                            {/* active is the norm; only the exceptions get a badge */}
                            {s.status !== "active" && <Badge tone={tone}>{t(`status.${s.status}`)}</Badge>}
                          </span>
                          <span className="block truncate text-[11px] text-ink-3">
                            {t(`cycle.${s.cycle}`)}
                            {s.billingDay && s.cycle === "monthly" ? ` · ${t("budget.subs.dayN", { day: s.billingDay })}` : ""}
                            {s.cycle !== "monthly" && s.nextCharge ? ` · ${t("budget.subs.nextCharge")} ${f.dateShort(s.nextCharge)}` : ""}
                            {s.status === "trial" && s.trialEnd ? ` · ${t("budget.subs.trialEnd")} ${f.dateShort(s.trialEnd)}` : ""}
                            {s.kind === "subscription" && s.worthIt !== "yes" ? ` · ${t("budget.subs.worth")} ${t(`worth.${s.worthIt}`)}` : ""}
                            {charge?.paid && <span className="text-good"> · {t("bills.loggedOn", { date: f.dateShort(charge.paid.date) })}</span>}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="tabular block text-sm font-medium text-ink">{f.money(s.amount)}</span>
                          {s.cycle !== "monthly" && <span className="tabular block text-[11px] text-ink-3">{perMonth(monthlyCost(s))}</span>}
                        </span>
                      </button>
                      {/* nothing to tick when it isn't charged this month (paused, yearly, no billing day…) */}
                      {charge ? <BillCheck ds={ds} charge={charge} /> : <span aria-hidden className="w-8 shrink-0" />}
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

"use client";

import { AlertTriangle, CalendarClock, ChevronRight, Copy, Plus, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/icons";
import { GuardedLink } from "@/components/shell/unsaved";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader, Stagger } from "@/components/ui/card";
import { Field, MoneyInput, Segmented } from "@/components/ui/form";
import { AnimatedNumber, Badge, EmptyState, Progress, STATUS_TONE } from "@/components/ui/misc";
import { SaveBar } from "@/components/ui/save-bar";
import { useDataset, useMutate } from "@/lib/data/hooks";
import { budgetStatus, effectiveBudget, effectiveIncome, monthlyCost, subscriptionTotals, suggestBudget, summarizeMonth } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import type { Dataset, Subscription } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { stashDraft, useStashedDraft, useUnsavedChanges } from "@/lib/unsaved";
import { addMonths, cn, parseAmount, round2 } from "@/lib/utils";

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
      <Subscriptions ds={ds} />
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
  const { isOverride } = effectiveBudget(ds.budgets, month);
  const hasIncomeOverride = ds.incomes.some((i) => i.month === month);
  const categories = ds.categories.filter((c) => !c.archived || parseAmount(draft.lines[c.name]) > 0);

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
                <AnimatedNumber value={net} format={f.money0} className="mt-1 block text-2xl font-semibold text-good" />
              </div>
              <div>
                <p className="text-xs text-ink-3">{t("budget.plan.planned")}</p>
                <AnimatedNumber value={planned} format={f.money0} className="mt-1 block text-2xl font-semibold text-ink" />
              </div>
              <div>
                <p className="text-xs text-ink-3">{unallocated >= 0 ? t("budget.plan.savings") : t("budget.plan.overAllocated")}</p>
                <AnimatedNumber value={Math.abs(unallocated)} format={f.money0} className={cn("mt-1 block text-2xl font-semibold", unallocated >= 0 ? "text-gold-bright" : "text-bad")} />
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
                    title={`${s.name}: ${f.money0(s.value)}`}
                    className="h-full first:rounded-l-full"
                    style={{ background: s.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${(s.value / base) * 100}%` }}
                    transition={{ type: "spring", stiffness: 90, damping: 20, delay: i * 0.03 }}
                  />
                ))}
                {unallocated > 0 && (
                  <motion.div
                    className="gold-fill h-full rounded-r-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(unallocated / base) * 100}%` }}
                    transition={{ type: "spring", stiffness: 90, damping: 20 }}
                    title={`${t("budget.plan.savings")}: ${f.money0(unallocated)}`}
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

      <Card>
        <CardHeader
          title={t("budget.plan.title")}
          subtitle={`${t("budget.plan.planned")}: ${f.money0(planned)} · ${unallocated >= 0 ? t("budget.plan.unallocated") : t("budget.plan.overAllocated")}: ${f.money0(Math.abs(unallocated))}`}
        />
        <ul className="grid grid-cols-1 gap-x-10 xl:grid-cols-2">
          {categories.map((c, i) => {
            const limit = parseAmount(draft.lines[c.name]);
            const spent = spentBy.get(c.name) ?? 0;
            const status = budgetStatus(spent, limit, ds.settings.warnAt);
            return (
              <li key={c.name} className="flex items-center gap-3 border-b border-line/50 py-3">
                {/* Everything but the input opens this month's expenses for the category */}
                <GuardedLink
                  href={`/expenses?category=${encodeURIComponent(c.name)}`}
                  title={t("budget.plan.viewExpenses", { category: c.name })}
                  className="-my-1.5 -ml-1.5 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm text-ink">{c.name}</span>
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
                    <div className="mt-1.5 flex items-center gap-2">
                      {limit > 0 ? <Progress value={spent / limit} tone={STATUS_TONE[status]} className="h-1.5" delay={i * 0.03} /> : <div className="h-1.5 flex-1 rounded-full bg-white/5" />}
                      <span className="tabular min-w-20 shrink-0 whitespace-nowrap text-right text-[11px] text-ink-3 sm:min-w-28">
                        {limit > 0 ? (
                          <>
                            <span className={cn("font-semibold", TONE_TEXT[STATUS_TONE[status]])}>{f.pct(spent / limit)}</span> · {f.money0(spent)}
                          </>
                        ) : (
                          t("budget.plan.spent", { amount: f.money0(spent) })
                        )}
                      </span>
                      <ChevronRight className="-ml-1 h-3.5 w-3.5 shrink-0 text-ink-3" />
                    </div>
                  </div>
                </GuardedLink>
                <div className="w-24 shrink-0 sm:w-32">
                  <MoneyInput value={draft.lines[c.name] ?? ""} onChange={(v) => setLine(c.name, v)} placeholder="0" className="h-10 text-right" aria-label={c.name} />
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

function Subscriptions({ ds }: { ds: Dataset }) {
  const { t, f } = useI18n();
  const open = useUi((s) => s.openSubscription);
  const totals = subscriptionTotals(ds.subscriptions);
  const order: Record<Subscription["status"], number> = { trial: 0, active: 1, paused: 2, cancelled: 3 };
  const subs = [...ds.subscriptions].sort((a, b) => order[a.status] - order[b.status] || monthlyCost(b) - monthlyCost(a));
  const cats = new Map(ds.categories.map((c) => [c.name, c]));

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
          { label: t("budget.subs.inTrial"), value: totals.trialMonthly, cls: totals.trialCount ? "text-warn" : "text-ink-3" },
        ].map((k) => (
          <div key={k.label} className="flex items-baseline justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 sm:block sm:p-3">
            <p className="text-xs text-ink-3 sm:text-[11px]">{k.label}</p>
            <AnimatedNumber value={k.value} format={f.money} className={cn("block whitespace-nowrap text-lg font-semibold sm:mt-1", k.cls)} />
          </div>
        ))}
      </div>
      {subs.length === 0 ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title={t("budget.subs.empty")} />
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {subs.map((s, i) => {
            const c = cats.get(s.category);
            const tone = s.status === "active" ? "good" : s.status === "trial" ? "warn" : "neutral";
            return (
              <motion.li key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
                <button
                  onClick={() => open(s)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]", s.status === "cancelled" && "opacity-50")}
                >
                  <CategoryIcon icon={c?.icon ?? "Repeat"} color={c?.color ?? "#6f7fe0"} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm text-ink">{s.name}</span>
                      <Badge tone={tone}>{t(`status.${s.status}`)}</Badge>
                    </span>
                    <span className="block truncate text-[11px] text-ink-3">
                      {t(`cycle.${s.cycle}`)}
                      {s.billingDay ? ` · ${t("budget.subs.dayN", { day: s.billingDay })}` : ""}
                      {s.status === "trial" && s.trialEnd ? ` · ${t("budget.subs.trialEnd")} ${f.dateShort(s.trialEnd)}` : ""}
                      {` · ${t("budget.subs.worth")} ${t(`worth.${s.worthIt}`)}`}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-sm font-medium text-ink">{f.money(s.amount)}</span>
                    {s.cycle !== "monthly" && <span className="tabular block text-[11px] text-ink-3">{f.money(monthlyCost(s))}/{t("cycle.monthly").toLowerCase()}</span>}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

"use client";

import { Paperclip, Repeat } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import type { MonthSummary } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { PRIORITIES, type Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { ChartCard, DataTable, GOLD, PRIORITY_COLORS } from "../charts/kit";
import { CategoryIcon } from "../icons";
import { Card, CardHeader } from "../ui/card";
import { Badge, Progress, STATUS_TONE } from "../ui/misc";

export function BudgetBars({ summary, className }: { summary: MonthSummary; className?: string }) {
  const { t, f } = useI18n();
  const rows = summary.byCategory.filter((c) => c.budget > 0 || c.spent > 0);
  return (
    <ChartCard
      className={className}
      title={t("dash.budgets.title")}
      subtitle={t("dash.budgets.subtitle")}
      action={
        <Link href="/budget" className="text-xs text-gold hover:underline">
          {t("nav.budget")} →
        </Link>
      }
      table={
        <DataTable
          head={[t("exp.col.category"), t("budget.plan.spent", { amount: "" }).trim(), t("nav.budget"), ""]}
          rows={rows.map((c) => [c.name, f.money(c.spent), c.budget ? f.money(c.budget) : "—", t(`budgetStatus.${c.status}`)])}
        />
      }
    >
      <ul className="grid gap-x-10 gap-y-3.5 xl:grid-cols-2">
        {rows.map((c, i) => (
          <li key={c.name} className="flex items-center gap-3">
            <CategoryIcon icon={c.icon} color={c.color} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2 text-[13px]">
                <span className="truncate text-ink-2">{c.name}</span>
                <span className="tabular shrink-0 text-ink">
                  {f.money0(c.spent)}
                  {c.budget > 0 && <span className="text-ink-3"> / {f.money0(c.budget)}</span>}
                </span>
              </div>
              {c.budget > 0 ? (
                <Progress value={c.used} tone={STATUS_TONE[c.status]} className="mt-1.5 h-1.5" delay={i * 0.04} />
              ) : (
                <div className="mt-1.5 h-1.5 rounded-full bg-white/5" />
              )}
            </div>
            <Badge tone={c.status === "none" ? "neutral" : STATUS_TONE[c.status]} className="hidden w-20 justify-center sm:inline-flex">
              {t(`budgetStatus.${c.status}`)}
            </Badge>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export function PrioritySplit({ summary, className }: { summary: MonthSummary; className?: string }) {
  const { t, f } = useI18n();
  const total = PRIORITIES.reduce((a, p) => a + Math.max(0, summary.byPriority[p]), 0);
  return (
    <ChartCard
      className={className}
      title={t("dash.priority.title")}
      subtitle={t("dash.priority.subtitle")}
      table={<DataTable head={["", t("exp.col.amount"), "%"]} rows={PRIORITIES.map((p) => [t(`priority.${p}`), f.money(summary.byPriority[p]), f.pct(total ? summary.byPriority[p] / total : 0)])} />}
    >
      <div className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full">
        {PRIORITIES.map((p, i) => {
          const share = total ? Math.max(0, summary.byPriority[p]) / total : 0;
          return share > 0 ? (
            <motion.div
              key={p}
              initial={{ width: 0 }}
              animate={{ width: `${share * 100}%` }}
              transition={{ type: "spring", stiffness: 90, damping: 20, delay: i * 0.08 }}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ background: PRIORITY_COLORS[p] }}
              title={`${t(`priority.${p}`)}: ${f.money(summary.byPriority[p])}`}
            />
          ) : null;
        })}
      </div>
      <ul className="mt-4 space-y-2">
        {PRIORITIES.map((p) => (
          <li key={p} className="flex items-center gap-2.5 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PRIORITY_COLORS[p] }} />
            <span className="flex-1 text-ink-2">{t(`priority.${p}`)}</span>
            <span className="tabular text-ink">{f.money0(summary.byPriority[p])}</span>
            <span className="tabular w-10 text-right text-xs text-ink-3">{f.pct(total ? summary.byPriority[p] / total : 0)}</span>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export function PaymentBreakdown({ summary, className }: { summary: MonthSummary; className?: string }) {
  const { t, f } = useI18n();
  const max = Math.max(...summary.byPayment.map((p) => p.amount), 1);
  return (
    <ChartCard className={className} title={t("dash.payment.title")} table={<DataTable head={["", t("exp.col.amount")]} rows={summary.byPayment.map((p) => [p.name, f.money(p.amount)])} />}>
      <ul className="space-y-3">
        {summary.byPayment.map((p, i) => (
          <li key={p.name}>
            <div className="mb-1 flex justify-between text-[13px]">
              <span className="text-ink-2">{p.name}</span>
              <span className="tabular text-ink">{f.money0(p.amount)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: GOLD }}
                initial={{ width: 0 }}
                animate={{ width: `${(Math.max(0, p.amount) / max) * 100}%` }}
                transition={{ type: "spring", stiffness: 90, damping: 20, delay: i * 0.05 }}
              />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

export function TopExpenses({ summary, ds, className }: { summary: MonthSummary; ds: Dataset; className?: string }) {
  const { t, f } = useI18n();
  const openExpense = useUi((s) => s.openExpense);
  const cats = new Map(ds.categories.map((c) => [c.name, c]));
  return (
    <Card className={className}>
      <CardHeader
        title={t("dash.top.title")}
        subtitle={t("dash.top.subtitle")}
        action={
          <Link href="/expenses" className="text-xs text-gold hover:underline">
            {t("nav.expenses")} →
          </Link>
        }
      />
      <ol className="-mx-2 space-y-0.5">
        {summary.top.map((tx, i) => {
          const c = cats.get(tx.category);
          return (
            <motion.li key={tx.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <button
                onClick={() => openExpense({ editing: tx })}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]"
              >
                <span className="tabular w-4 text-xs text-ink-3">{i + 1}</span>
                <CategoryIcon icon={c?.icon ?? "Package"} color={c?.color ?? "#6b6a72"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 truncate text-[13px] text-ink">
                    {tx.description || tx.merchant || tx.subcategory || tx.category}
                    {tx.recurring && <Repeat className="h-3 w-3 shrink-0 text-ink-3" />}
                    {tx.receiptUrl && <Paperclip className="h-3 w-3 shrink-0 text-ink-3" />}
                  </span>
                  <span className="block truncate text-[11px] text-ink-3">
                    {f.dateShort(tx.date)} · {tx.merchant || tx.category}
                  </span>
                </span>
                <span className={cn("tabular text-[13px] font-medium", tx.amount < 0 ? "text-good" : "text-ink")}>{f.money(tx.amount)}</span>
              </button>
            </motion.li>
          );
        })}
      </ol>
    </Card>
  );
}

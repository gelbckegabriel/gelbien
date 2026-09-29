"use client";

import { ClipboardCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDataset } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { monthReview, type ReviewLine } from "@/lib/review";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { askToLeave, hasUnsaved } from "@/lib/unsaved";
import { addMonths, cn, currentMonth, monthOf, todayISO } from "@/lib/utils";
import { CategoryIcon } from "./icons";
import { Button } from "./ui/button";
import { Badge, Delta, EmptyState } from "./ui/misc";
import { Sheet } from "./ui/sheet";

/** The review sheet, opened from the dashboard prompt or the budget page (see useUi().openReview). */
export function MonthReviewSheet() {
  const { open, month } = useUi((s) => s.review);
  const close = useUi((s) => s.closeReview);
  const { data } = useDataset();
  if (!data) return null;
  return <Review ds={data} month={month} open={open} onClose={close} />;
}

function Review({ ds, month, open, onClose }: { ds: Dataset; month: string; open: boolean; onClose: () => void }) {
  const { t, f } = useI18n();
  const router = useRouter();
  const setMonth = useUi((s) => s.setMonth);
  const r = useMemo(() => monthReview(ds, month), [ds, month]);
  const cats = new Map(ds.categories.map((c) => [c.name, c]));
  const next = addMonths(month, 1);
  // from the rounded ends, so "$14,970 → $15,707" reads as +$737, not +$736
  const nwChange = r.netWorth ? Math.round(r.netWorth.end) - Math.round(r.netWorth.start) : 0;

  const go = (href: string, m: string) => {
    const run = () => {
      onClose();
      setMonth(m);
      router.push(href);
    };
    if (hasUnsaved()) askToLeave(run);
    else run();
  };

  const lines = (title: string, items: ReviewLine[], tone: "good" | "bad") => (
    <section>
      <h3 className="mb-2 text-[13px] font-medium text-ink-2">{title}</h3>
      <ul className="space-y-2">
        {items.map((l) => {
          const c = cats.get(l.name);
          return (
            <li key={l.name} className="flex items-center gap-3">
              <CategoryIcon icon={c?.icon ?? "Package"} color={c?.color ?? "#6b6a72"} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-ink">{l.name}</span>
                <span className="block text-xs text-ink-3">{t("review.ofLimit", { spent: f.money0(l.spent), budget: f.money0(l.budget) })}</span>
              </span>
              <span className={cn("tabular shrink-0 text-sm font-medium", tone === "bad" ? "text-bad" : "text-good")}>
                {tone === "bad" ? t("review.overBy", { amount: f.money0(l.amount) }) : t("review.leftOver", { amount: f.money0(l.amount) })}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );

  const mentions = [
    r.largest && t("review.largest", { name: r.largest.description || r.largest.merchant || r.largest.category, amount: f.money0(r.largest.amount) }),
    r.unplanned > 0 && t("budget.vs.unplanned", { amount: f.money0(r.unplanned) }),
    r.netWorth &&
      t("review.netWorth", { start: f.money0(r.netWorth.start), end: f.money0(r.netWorth.end), change: `${nwChange >= 0 ? "+" : "−"}${f.money0(Math.abs(nwChange))}` }),
  ].filter(Boolean) as string[];

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={t("review.title", { month: f.monthLong(month) })}
      description={t("review.subtitle")}
      wide
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" onClick={() => go("/expenses", month)}>
            {t("review.seeExpenses")}
          </Button>
          <Button variant="primary" onClick={() => go("/budget", next)}>
            {t("review.planNext", { month: f.monthName(next) })}
          </Button>
        </div>
      }
    >
      {r.count === 0 ? (
        <EmptyState icon={<ClipboardCheck className="h-6 w-6" />} title={t("review.empty", { month: f.monthLong(month) })} />
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-line bg-surface-2/50 p-4">
            <p className="text-[13px] text-ink-3">{t("review.spent")}</p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="tabular text-3xl font-semibold tracking-tight text-ink">{f.money0(r.spent)}</span>
              {r.planned > 0 && <span className="text-sm text-ink-3">{t("review.ofPlanned", { amount: f.money0(r.planned) })}</span>}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              {r.planned > 0 && (
                <Badge tone={r.diff >= 0 ? "good" : "bad"}>
                  {r.diff >= 0 ? t("budget.vs.under") : t("budget.vs.over")} · {f.money0(Math.abs(r.diff))}
                </Badge>
              )}
              {r.change !== null && (
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-3">
                  <Delta value={r.change} goodWhenUp={false} format={f.pct} /> {t("review.vsPrev", { month: f.monthName(addMonths(month, -1)) })}
                </span>
              )}
            </div>
            {r.net > 0 && (
              <p className="mt-3 text-sm text-ink-2">
                {t("review.savings", { saved: f.money0(r.saved), planned: f.money0(r.plannedSavings) })}
              </p>
            )}
          </div>

          {r.over.length > 0 && lines(t("review.overTitle"), r.over, "bad")}
          {r.under.length > 0 && lines(t("review.underTitle"), r.under, "good")}

          {mentions.length > 0 && (
            <section>
              <h3 className="mb-2 text-[13px] font-medium text-ink-2">{t("review.alsoTitle")}</h3>
              <ul className="space-y-1.5 text-sm text-ink-2">
                {mentions.map((m) => (
                  <li key={m} className="flex gap-2">
                    <span className="text-gold">•</span>
                    <span className="min-w-0">{m}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

// The prompt shows in the first days of a month, for the month that just ended, until opened or dismissed.
const SEEN_KEY = "gelbien.review.seen";
const PROMPT_DAYS = 10;

function seenMonth() {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function ReviewPrompt({ ds, className }: { ds: Dataset; className?: string }) {
  const { t, f } = useI18n();
  const openReview = useUi((s) => s.openReview);
  const [seen, setSeen] = useState(seenMonth);
  const last = addMonths(currentMonth(), -1);
  const show = Number(todayISO().slice(8, 10)) <= PROMPT_DAYS && seen !== last && ds.transactions.some((x) => monthOf(x.date) === last);

  const markSeen = () => {
    try {
      localStorage.setItem(SEEN_KEY, last);
    } catch {
      /* ignore */
    }
    setSeen(last);
  };

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className={cn("overflow-hidden", className)}>
          <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/[0.03] p-4 sm:flex-row sm:items-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t("review.prompt", { month: f.monthName(last) })}</p>
              <p className="text-[13px] text-ink-3">{t("review.promptBody")}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  markSeen();
                  openReview(last);
                }}
              >
                {t("review.open")}
              </Button>
              <button onClick={markSeen} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink" aria-label={t("ci.later")} title={t("ci.later")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

"use client";

import { AlertTriangle, ArrowRight, CalendarDays, CircleDashed, ClipboardCheck, Flame, Landmark, PiggyBank, Repeat, Sparkles, Wallet, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useDataset } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { growX } from "@/lib/motion";
import { monthReview, type CategoryRow, type MonthReview, type Suggestion } from "@/lib/review";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { askToLeave, hasUnsaved } from "@/lib/unsaved";
import { addMonths, cn, currentMonth, monthOf, todayISO } from "@/lib/utils";
import { BAD, ChartCard, DataTable, GOLD, INK, Legend, StatTile } from "./charts/kit";
import { PaceChart } from "./charts/pace-chart";
import { PrioritySplit } from "./dashboard/breakdowns";
import { CategoryIcon } from "./icons";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/misc";
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
  const next = addMonths(month, 1);

  const go = (href: string, m: string) => {
    const run = () => {
      onClose();
      setMonth(m);
      router.push(href);
    };
    if (hasUnsaved()) askToLeave(run);
    else run();
  };

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
          <Tiles r={r} />
          {r.suggestions.length > 0 && <Suggestions r={r} go={go} />}
          <PlanBars r={r} />
          <div className="grid gap-4 md:grid-cols-2">
            <PaceChart ds={ds} month={month} />
            <PrioritySplit summary={r.summary} />
          </div>
          {r.movers.length > 0 && <Movers r={r} />}
          <TopList r={r} />
        </div>
      )}
    </Sheet>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The month in three numbers: spent vs plan, saved vs plan, net worth (or daily average). */
function Tiles({ r }: { r: MonthReview }) {
  const { t, f } = useI18n();
  const prevMonth = f.monthShort(addMonths(r.month, -1));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatTile
        label={t("review.tile.spent")}
        value={r.spent}
        format={f.money0}
        icon={<Wallet className="h-4 w-4" />}
        tone={r.planned > 0 && r.diff < 0 ? "bad" : undefined}
        sub={r.planned > 0 ? t("review.ofPlanned", { amount: f.money0(r.planned) }) : undefined}
        delta={r.change !== null ? { value: r.change, goodWhenUp: false, format: f.pct, label: t("review.vsPrev", { month: prevMonth }), showLabel: true } : undefined}
      />
      <StatTile
        label={t("review.tile.saved")}
        value={r.net > 0 ? r.saved : 0}
        format={(n) => (r.net > 0 ? f.money0(n) : "—")}
        icon={<PiggyBank className="h-4 w-4" />}
        tone={r.net > 0 ? (r.saved >= r.plannedSavings ? "good" : r.saved < 0 ? "bad" : "warn") : undefined}
        sub={r.net > 0 ? (r.planned > 0 ? t("review.tile.planSaved", { amount: f.money0(r.plannedSavings) }) : undefined) : t("review.tile.noIncome")}
      />
      {r.netWorth ? (
        <StatTile
          label={t("review.tile.netWorth")}
          value={r.netWorth.end}
          format={f.money0}
          icon={<Landmark className="h-4 w-4" />}
          className="col-span-2 sm:col-span-1"
          sub={t("review.tile.nwChange", { change: `${r.netWorth.change >= 0 ? "+" : "−"}${f.money0(Math.abs(Math.round(r.netWorth.end) - Math.round(r.netWorth.start)))}` })}
        />
      ) : (
        <StatTile
          label={t("review.tile.daily")}
          value={r.summary.dailyAvg}
          format={f.money0}
          icon={<CalendarDays className="h-4 w-4" />}
          className="col-span-2 sm:col-span-1"
          sub={t("review.tile.count", { count: r.count })}
        />
      )}
    </div>
  );
}

const SUGGESTION_LOOK = {
  raiseLimit: { icon: AlertTriangle, tone: "text-warn bg-warn/10" },
  overspent: { icon: AlertTriangle, tone: "text-bad bg-bad/10" },
  lowerLimit: { icon: PiggyBank, tone: "text-good bg-good/10" },
  unplanned: { icon: CircleDashed, tone: "text-warn bg-warn/10" },
  subscriptions: { icon: Repeat, tone: "text-gold bg-gold-soft" },
  superfluous: { icon: Flame, tone: "text-warn bg-warn/10" },
  wellDone: { icon: Sparkles, tone: "text-good bg-good/10" },
} as const;

/** "What to change": each suggestion says why, and links to where to act on it. */
function Suggestions({ r, go }: { r: MonthReview; go: (href: string, month: string) => void }) {
  const { t, f } = useI18n();
  const next = addMonths(r.month, 1);
  const perMonth = (n: number) => t("budget.subs.perMonth", { amount: f.money0(n) });
  const adjust = { label: t("review.a.budget", { month: f.monthName(next) }), run: () => go("/budget", next) };

  const content = (s: Suggestion): { title: string; body: string; action?: { label: string; run: () => void } } => {
    switch (s.kind) {
      case "raiseLimit":
        return {
          title: t("review.s.raise.title", { category: s.category }),
          body: t("review.s.raise.body", { months: s.months, average: f.money0(s.average), limit: f.money0(s.limit), suggested: f.money0(s.suggested) }),
          action: adjust,
        };
      case "lowerLimit":
        return {
          title: t("review.s.lower.title", { category: s.category }),
          body: t("review.s.lower.body", { average: f.money0(s.average), limit: f.money0(s.limit), suggested: f.money0(s.suggested), frees: perMonth(s.limit - s.suggested) }),
          action: adjust,
        };
      case "overspent":
        return {
          title: t("review.s.over.title", { category: s.category, over: f.money0(s.over) }),
          body: [s.biggest ? t("review.s.over.biggest", { name: s.biggest.description || s.biggest.merchant || s.category, amount: f.money0(s.biggest.amount) }) : "", t("review.s.over.body")]
            .filter(Boolean)
            .join(" "),
          action: { label: t("review.a.expenses"), run: () => go(`/expenses?category=${encodeURIComponent(s.category)}`, r.month) },
        };
      case "unplanned":
        return {
          title: t("review.s.unplanned.title", { amount: f.money0(s.spent) }),
          body: t("review.s.unplanned.body", { categories: s.categories.slice(0, 3).join(", ") + (s.categories.length > 3 ? ` +${s.categories.length - 3}` : "") }),
          action: adjust,
        };
      case "subscriptions":
        return {
          title: t("review.s.subs.title"),
          body: t("review.s.subs.body", { names: s.names.join(", "), monthly: perMonth(s.monthly), yearly: f.money0(s.monthly * 12) }),
          action: { label: t("review.a.recurring"), run: () => go("/budget", r.month) },
        };
      case "superfluous":
        return {
          title: t("review.s.superfluous.title", { share: f.pct(s.share) }),
          body: t("review.s.superfluous.body", { amount: f.money0(s.amount), half: perMonth(s.half), yearly: f.money0(s.half * 12) }),
        };
      case "wellDone":
        return { title: t("review.s.wellDone.title", { amount: f.money0(s.under) }), body: t("review.s.wellDone.body"), action: { label: t("review.a.goals"), run: () => go("/goals", r.month) } };
    }
  };

  return (
    <Section title={t("review.changeTitle")}>
      <ul className="space-y-2.5">
        {r.suggestions.map((s, i) => {
          const c = content(s);
          const look = SUGGESTION_LOOK[s.kind];
          const Icon = look.icon;
          return (
            <motion.li
              key={`${s.kind}-${i}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex gap-3 rounded-2xl border border-line bg-surface-2/50 p-3.5"
            >
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", look.tone)}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{c.title}</p>
                <p className="mt-0.5 text-[13px] text-ink-2">{c.body}</p>
                {c.action && (
                  <button onClick={c.action.run} className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-gold hover:underline">
                    {c.action.label} <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </motion.li>
          );
        })}
      </ul>
    </Section>
  );
}

/** Plan vs. actual per category: spent as a bar, the limit as a tick, overruns in red with the amount. */
function PlanBars({ r }: { r: MonthReview }) {
  const { t, f } = useI18n();
  const rows = r.categories;
  const scale = Math.max(1, ...rows.map((c) => Math.max(c.spent, c.budget)));
  const name = (c: CategoryRow) => (c.rest ? t("common.rest") : c.name);
  return (
    <ChartCard
      title={t("review.barsTitle")}
      subtitle={t("review.barsSubtitle")}
      legend={
        <Legend
          items={[
            { label: t("review.legend.spent"), color: GOLD },
            { label: t("review.legend.over"), color: BAD },
            { label: t("review.legend.limit"), color: INK.primary, kind: "line" },
          ]}
        />
      }
      table={
        <DataTable
          head={[t("exp.col.category"), t("review.legend.spent"), t("review.legend.limit"), t("review.col.diff")]}
          rows={rows.map((c) => [name(c), f.money0(c.spent), c.budget > 0 ? f.money0(c.budget) : "—", c.budget > 0 ? f.money0(c.budget - c.spent) : "—"])}
        />
      }
    >
      <ul className="space-y-3.5">
        {rows.map((c, i) => {
          const over = c.budget > 0 && c.spent > c.budget;
          return (
            <li key={c.rest ? "rest" : c.name} title={`${name(c)}: ${f.money0(c.spent)}${c.budget > 0 ? ` / ${f.money0(c.budget)}` : ""}`}>
              <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
                <span className="flex min-w-0 items-center gap-2">
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" className="h-6 w-6 rounded-md" />
                  <span className="truncate text-ink-2">{name(c)}</span>
                </span>
                <span className="tabular shrink-0 text-ink">
                  {f.money0(c.spent)}
                  <span className="text-ink-3"> / {c.budget > 0 ? f.money0(c.budget) : t("review.noLimit")}</span>
                  {over && <span className="ml-1.5 font-medium text-bad">▲ {f.money0(c.spent - c.budget)}</span>}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-white/[0.06]">
                <motion.div
                  className="h-full rounded-full origin-left transition-[width] duration-500 ease-out"
                  style={{ background: over ? BAD : GOLD, width: `${(Math.max(0, c.spent) / scale) * 100}%` }}
                  {...growX(i * 0.04, 90, 20)}
                />
                {c.budget > 0 && <span className="absolute -bottom-1 -top-1 w-0.5 -translate-x-1/2 rounded-full bg-ink" style={{ left: `${(c.budget / scale) * 100}%` }} />}
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}

/** Categories that moved most against the months before. */
function Movers({ r }: { r: MonthReview }) {
  const { t, f } = useI18n();
  return (
    <Section title={t("review.moversTitle")} subtitle={t("review.moversSubtitle")}>
      <ul className="divide-y divide-line/50">
        {r.movers.map((m) => (
          <li key={m.name} className="flex items-center gap-3 py-2.5">
            <CategoryIcon icon={m.icon} color={m.color} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{m.name}</span>
              <span className="block text-xs text-ink-3">{t("review.usual", { amount: f.money0(m.usual) })}</span>
            </span>
            <span className="text-right">
              <span className="tabular block text-sm text-ink">{f.money0(m.spent)}</span>
              {/* more spending reads as bad, less as good */}
              <span className={cn("tabular block text-xs font-medium", m.delta > 0 ? "text-bad" : "text-good")}>
                {m.delta > 0 ? "▲" : "▼"} {f.money0(Math.abs(m.delta))}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function TopList({ r }: { r: MonthReview }) {
  const { t, f } = useI18n();
  return (
    <Section title={t("review.topTitle")}>
      <ol className="divide-y divide-line/50">
        {r.top.map((tx, i) => (
          <li key={tx.id} className="flex items-center gap-3 py-2.5">
            <span className="tabular w-4 text-xs text-ink-3">{i + 1}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-ink">{tx.description || tx.merchant || tx.category}</span>
              <span className="block truncate text-xs text-ink-3">
                {f.dateShort(tx.date)} · {tx.subcategory || tx.category}
              </span>
            </span>
            <span className="tabular shrink-0 text-sm font-medium text-ink">{f.money(tx.amount)}</span>
          </li>
        ))}
      </ol>
    </Section>
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

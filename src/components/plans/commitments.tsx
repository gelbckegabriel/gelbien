"use client";

import { ArrowRight, Calculator, Plus } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { commitments, planAmountIn } from "@/lib/plans";
import type { Dataset, Plan } from "@/lib/types";
import { addMonths, cn, currentMonth, todayISO } from "@/lib/utils";
import { CategoryIcon } from "../icons";
import { GuardedLink } from "../shell/unsaved";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { MoneyText } from "../ui/misc";
import { PlanDialog } from "./plan-dialog";
import { ExtraPaymentDialog } from "./extra-payment";
import { LoanCalculator } from "./loan-calculator";
import { PlanSimulator } from "./plan-simulator";

// the timeline's window: five years from this month
const SPAN = 60;

/**
 * Installments and loans: what they take this month and from the next change, what's still owed, and a
 * timeline of when each one ends — the money that frees up then, with a way to put it toward a goal.
 */
export function Commitments({ ds }: { ds: Dataset }) {
  const { t, f } = useI18n();
  const today = todayISO();
  const month = currentMonth();
  const c = commitments(ds, today);
  // kept mounted while they close, so the sheets can animate out; the nonce starts a fresh form each time
  const [editing, setEditing] = useState<{ plan: Plan | null; nonce: number; open: boolean }>({ plan: null, nonce: 0, open: false });
  const [simulating, setSimulating] = useState<{ plan: Plan | null; open: boolean }>({ plan: null, open: false });
  const [paying, setPaying] = useState<{ plan: Plan | null; open: boolean; nonce: number }>({ plan: null, open: false, nonce: 0 });
  const edit = (plan: Plan | null) => setEditing({ plan, nonce: Date.now(), open: true });
  const [calculating, setCalculating] = useState(false);
  const cats = new Map(ds.categories.map((x) => [x.name, x]));
  const monthsFrom = (m: string) => (Number(m.slice(0, 4)) - Number(month.slice(0, 4))) * 12 + Number(m.slice(5, 7)) - Number(month.slice(5, 7));
  const pos = (m: string) => Math.max(0, Math.min(1, monthsFrom(m) / SPAN));
  const years = Array.from({ length: 6 }, (_, i) => `${Number(month.slice(0, 4)) + i + 1}-01`).filter((m) => monthsFrom(m) <= SPAN);
  const ym = (m: string) => `${f.monthShort(m)} ${m.slice(0, 4)}`;

  return (
    <Card id="commitments">
      <CardHeader
        title={t("plans.c.title")}
        subtitle={t("plans.c.subtitle")}
        action={
          <div className="flex items-center gap-1.5">
            {/* try one before taking it on */}
            <Button size="sm" variant="ghost" onClick={() => setCalculating(true)}>
              <Calculator className="h-4 w-4" /> <span className="hidden sm:inline">{t("plans.simulate")}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => edit(null)}>
              <Plus className="h-4 w-4" /> {t("plans.c.new")}
            </Button>
          </div>
        }
      />
      {c.lines.length === 0 ? (
        <p className="text-sm text-ink-3">{t("plans.c.empty")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
            <Tile label={t("plans.c.thisMonth")} value={f.amount(c.thisMonth)} />
            {c.change && <Tile label={c.change.month === addMonths(month, 1) ? t("plans.c.nextMonth") : t("plans.c.from", { month: c.change.month.slice(0, 4) === month.slice(0, 4) ? f.monthName(c.change.month) : f.monthLong(c.change.month) })} value={f.amount(c.change.total)} />}
            <Tile label={t("plans.c.owed")} value={f.amount(c.owed)} className="col-span-2 sm:col-span-1" />
          </div>

          {/* one bar per plan, from its first payment (or this month) to its last, over the next five years */}
          <div className="mt-5">
            <div className="relative ml-[7.5rem] h-4 text-[11px] text-ink-3 sm:ml-[10rem]">
              {years.map((m) => (
                <span key={m} className="absolute -translate-x-1/2" style={{ left: `${pos(m) * 100}%` }}>
                  {m.slice(0, 4)}
                </span>
              ))}
            </div>
            <ul className="mt-1 space-y-1.5">
              {c.lines.map(({ plan, standing, monthly }, i) => {
                const color = cats.get(plan.category)?.color ?? "#6b6a72";
                const left = pos(standing.start);
                const right = pos(addMonths(standing.end, 1));
                const beyond = monthsFrom(standing.end) >= SPAN;
                const count = standing.schedule.length;
                // an extra every month starting next month (or a payment changing then): shown on the bar
                const nextAmount = planAmountIn(plan, addMonths(month, 1), ds);
                const changes = nextAmount > 0 && Math.abs(nextAmount - monthly) >= 1;
                return (
                  <li key={plan.id}>
                    <button
                      onClick={() => edit(plan)}
                      className="group flex w-full items-center gap-3 rounded-xl py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
                    >
                      <span className="flex w-[6.75rem] shrink-0 items-center gap-2 sm:w-[9.25rem]">
                        <CategoryIcon icon={cats.get(plan.category)?.icon ?? "Package"} color={color} size="sm" className="hidden sm:grid" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] text-ink group-hover:text-gold-bright">{plan.name}</span>
                          <span className="block truncate text-[11px] text-ink-3">
                            {standing.paid === 0 && standing.start > month ? t("plans.c.starts", { month: f.monthShort(standing.start) }) : t("plans.c.paidOf", { paid: standing.paid, count })}
                          </span>
                        </span>
                      </span>
                      <span className="relative h-7 min-w-0 flex-1 rounded-lg bg-white/[0.03]">
                        {years.map((m) => (
                          <span key={m} className="absolute inset-y-0 w-px bg-white/[0.05]" style={{ left: `${pos(m) * 100}%` }} />
                        ))}
                        <motion.span
                          className="absolute inset-y-0.5 flex origin-left items-center overflow-hidden rounded-md px-2"
                          style={{ left: `${left * 100}%`, width: `${Math.max(0.02, right - left) * 100}%`, background: color }}
                          initial={{ transform: "scaleX(0)" }}
                          animate={{ transform: "scaleX(1)" }}
                          transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.1 + i * 0.05 }}
                        />
                        {/* the label sits on the bar when it's long enough, after it otherwise */}
                        <span
                          className={cn("pointer-events-none absolute inset-y-0 flex items-center whitespace-nowrap px-2 text-[11px]", right - left > 0.42 ? "text-white" : "text-ink-2")}
                          style={right - left > 0.42 ? { left: `${left * 100}%` } : { left: `${right * 100}%` }}
                        >
                          <span className="tabular">{t("plans.c.perMonth", { amount: f.amount(monthly) })}</span>
                          {changes && (
                            <span className={cn("tabular ml-1", right - left > 0.42 ? "text-white" : "text-ink")} title={t("plans.c.changes", { amount: f.amount(nextAmount), month: f.monthName(addMonths(month, 1)) })}>
                              → {f.amount(nextAmount)}
                            </span>
                          )}
                          <span className={cn("ml-1.5 hidden sm:inline", right - left > 0.42 ? "text-white/80" : "text-ink-3")}>
                            · {beyond ? t("plans.c.until", { date: ym(standing.end) }) : t("plans.c.endsOn", { date: ym(standing.end) })}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {c.frees.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line/70 pt-3 text-xs">
              <p className="text-ink-3">
                {t("plans.c.frees")}{" "}
                {c.frees.slice(0, 3).map((x, i) => (
                  <span key={x.plan.id}>
                    {i > 0 && " · "}
                    <span className="tabular text-good">{t("plans.c.freesAmount", { amount: f.amount(x.amount) })}</span> {t("plans.c.freesWhen", { month: ym(x.month) })}
                  </span>
                ))}
              </p>
              <GuardedLink href="/goals" className="inline-flex items-center gap-1 text-gold hover:underline">
                {t("plans.c.toGoal")} <ArrowRight className="h-3.5 w-3.5" />
              </GuardedLink>
            </div>
          )}
        </>
      )}

      <PlanDialog
        key={`plan-${editing.nonce}`}
        ds={ds}
        open={editing.open}
        plan={editing.plan}
        onClose={() => setEditing((e) => ({ ...e, open: false }))}
        onSimulate={(plan) => {
          setEditing((e) => ({ ...e, open: false }));
          setSimulating({ plan, open: true });
        }}
        onExtra={(plan) => {
          setEditing((e) => ({ ...e, open: false }));
          setPaying({ plan, open: true, nonce: Date.now() });
        }}
      />
      <ExtraPaymentDialog key={`extra-${paying.nonce}`} ds={ds} plan={paying.plan} open={paying.open} onClose={() => setPaying((x) => ({ ...x, open: false }))} />
      <PlanSimulator ds={ds} plan={simulating.plan} open={simulating.open} onClose={() => setSimulating((x) => ({ ...x, open: false }))} />
      <LoanCalculator ds={ds} open={calculating} onClose={() => setCalculating(false)} />
    </Card>
  );
}

function Tile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-line bg-surface-2/50 px-3 py-2.5", className)}>
      <p className="text-[11px] text-ink-3">{label}</p>
      <p className="tabular-nums mt-0.5 text-lg font-semibold text-ink">
        <MoneyText text={value} />
      </p>
    </div>
  );
}

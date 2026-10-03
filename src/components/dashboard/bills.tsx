"use client";

import { CalendarClock, Check, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { create } from "zustand";
import { addDays, billTransaction, chargeKey, dueBills, upcomingBills, type BillCharge, type LoggedCharge } from "@/lib/bills";
import { useMutate } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import type { Dataset, Mutation } from "@/lib/types";
import { cn, round2, todayISO } from "@/lib/utils";
import { CategoryIcon } from "../icons";
import { GuardedLink } from "../shell/unsaved";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";

// Charges the user said not to log (paid by someone else, cancelled…). Per device is enough:
// they only matter for a few weeks, until the charge falls out of the "due" window.
const SKIPPED_KEY = "gelbien.bills.skipped";

function readSkipped(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(SKIPPED_KEY) ?? "[]") as string[];
    const cutoff = addDays(todayISO(), -45);
    return new Set(raw.filter((k) => k.split("|")[1] >= cutoff));
  } catch {
    return new Set();
  }
}

function writeSkipped(keys: Set<string>) {
  try {
    localStorage.setItem(SKIPPED_KEY, JSON.stringify([...keys]));
  } catch {
    /* ignore */
  }
}

// shared, so skipping a bill on the "due" card also updates what's left to spend
const useSkipped = create<{ keys: ReadonlySet<string>; skip: (key: string) => void }>((set, get) => ({
  keys: readSkipped(),
  skip: (key) => {
    const next = new Set(get().keys).add(key);
    writeSkipped(next);
    set({ keys: next });
  },
}));

/** Charges skipped on this device */
export const useSkippedBills = () => useSkipped((s) => s.keys);

/** Logs charges as paid in one write (not one queued save per bill), with an undo. `paidOn`: paid ahead of the charge (see billTransaction). */
function usePayBills(ds: Dataset) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  return (charges: BillCharge[], paidOn?: string) => {
    const txs = charges.map((c) => billTransaction(c, ds, undefined, paidOn));
    mutate.mutate(txs.length > 1 ? { op: "addTransactions", txs } : { op: "addTransaction", tx: txs[0] });
    const total = f.money(round2(txs.reduce((a, x) => a + x.amount, 0)));
    toast.success(txs.length > 1 ? t("bills.paidMany", { count: txs.length }) : t("bills.paidOne", { name: charges[0].sub.name }), {
      // the date too, when it isn't the charge date shown on the row
      description: paidOn && txs.length === 1 ? `${total} · ${f.dateShort(txs[0].date)}` : total,
      action: { label: t("common.undo"), onClick: () => mutate.mutate({ op: "deleteTransactions", ids: txs.map((tx) => tx.id) }) },
    });
  };
}

/**
 * The ✓ beside a bill's charge. Not logged yet: logs it (dated today when paid ahead of the charge).
 * Logged: green, and on hover a red ✗ that deletes that expense, after a confirm.
 */
export function BillCheck({ ds, charge, className }: { ds: Dataset; charge: LoggedCharge; className?: string }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const pay = usePayBills(ds);
  const { sub, paid } = charge;
  const base = "group grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60";

  if (!paid) {
    const label = t("bills.payEarly", { name: sub.name });
    return (
      <button onClick={() => pay([charge], todayISO())} className={cn(base, "border-line text-ink-3 hover:border-good/40 hover:bg-good-soft hover:text-good", className)} aria-label={label} title={label}>
        <Check className="h-4 w-4" />
      </button>
    );
  }

  const remove = () => {
    if (!window.confirm(t("bills.unpayConfirm", { name: sub.name, amount: f.money(paid.amount), date: f.dateShort(paid.date) }))) return;
    const parts = paid.group ? ds.transactions.filter((x) => x.group === paid.group) : [];
    let undo: Mutation;
    if (parts.length > 1) {
      // one part of a split purchase: the other parts stay (a plain expense when only one is left)
      const rest = parts.filter((x) => x.id !== paid.id);
      mutate.mutate({ op: "saveTransactionGroup", group: paid.group, txs: rest.length > 1 ? rest : rest.map((x) => ({ ...x, group: "" })) });
      undo = { op: "saveTransactionGroup", group: paid.group, txs: parts };
    } else {
      mutate.mutate({ op: "deleteTransaction", id: paid.id });
      undo = { op: "addTransaction", tx: paid };
    }
    toast(t("exp.deleted"), { description: `${f.money(paid.amount)} · ${sub.name}`, action: { label: t("common.undo"), onClick: () => mutate.mutate(undo) } });
  };
  const label = t("bills.unpay", { date: f.dateShort(paid.date) });
  return (
    <button
      onClick={remove}
      className={cn(base, "border-good/40 bg-good-soft text-good hover:border-bad/40 hover:bg-bad-soft hover:text-bad", className)}
      aria-label={`${sub.name}: ${label}`}
      title={label}
    >
      <Check className="h-4 w-4 group-hover:hidden group-focus-visible:hidden" />
      <X className="hidden h-4 w-4 group-hover:block group-focus-visible:block" />
    </button>
  );
}

/** "Were these paid?" — one row per bill charged recently with nothing logged for it. Hidden when there is none. */
export function DueBills({ ds, className }: { ds: Dataset; className?: string }) {
  const { t, f } = useI18n();
  const pay = usePayBills(ds);
  const skipped = useSkippedBills();
  const skipKey = useSkipped((s) => s.skip);
  const [showAll, setShowAll] = useState(false);
  const today = todayISO();
  const due = useMemo(() => dueBills(ds, today, skipped), [ds, today, skipped]);
  const cats = new Map(ds.categories.map((c) => [c.name, c]));
  if (!due.length) return null;

  const skip = (c: BillCharge) => skipKey(chargeKey(c));
  const when = (date: string) => (date === today ? t("bills.today") : t("bills.chargedOn", { date: f.dateShort(date) }));
  const visible = showAll ? due : due.slice(0, 4);

  return (
    <Card className={cn("border-gold/25", className)}>
      <CardHeader
        title={t("bills.due.title")}
        subtitle={t("bills.due.subtitle")}
        action={
          due.length > 1 ? (
            <Button size="sm" variant="outline" onClick={() => pay(due)}>
              <Check className="h-4 w-4" /> {t("bills.payAll")}
            </Button>
          ) : undefined
        }
      />
      {/* a divided list on phones; side-by-side tiles on wide screens, where full-width rows would be mostly gap */}
      <ul className="-mx-1 divide-y divide-line/50 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:divide-y-0">
        <AnimatePresence initial={false}>
          {visible.map((c) => {
            const cat = cats.get(c.sub.category);
            return (
              <motion.li key={chargeKey(c)} layout exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3 px-1 py-2.5 lg:rounded-xl lg:border lg:border-line lg:bg-surface-2/40 lg:px-3 lg:py-2">
                <CategoryIcon icon={cat?.icon ?? "Repeat"} color={cat?.color ?? "#6f7fe0"} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{c.sub.name}</span>
                  <span className="block truncate text-xs text-ink-3">
                    {when(c.date)} · <span className="tabular">{f.money(c.sub.amount)}</span>
                    {/* what "Paid" logs it under */}
                    {c.sub.subcategory && ` · ${c.sub.subcategory}`}
                  </span>
                </span>
                <button onClick={() => skip(c)} className="rounded-lg p-2 text-ink-3 hover:bg-white/5 hover:text-ink" aria-label={t("bills.skip", { name: c.sub.name })} title={t("bills.skip", { name: c.sub.name })}>
                  <X className="h-4 w-4" />
                </button>
                <Button size="sm" variant="primary" onClick={() => pay([c])} className="px-3">
                  <Check className="h-4 w-4" /> {t("bills.paid")}
                </Button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {due.length > 4 && (
        <button onClick={() => setShowAll((s) => !s)} className="mt-2 text-[13px] text-gold hover:underline">
          {showAll ? t("bills.showLess") : t("bills.showMore", { count: due.length - 4 })}
        </button>
      )}
    </Card>
  );
}

/** Bills charged in the next 30 days — kept short so it reads at a glance. */
export function UpcomingBills({ ds, className }: { ds: Dataset; className?: string }) {
  const { t, f } = useI18n();
  const [showAll, setShowAll] = useState(false);
  const today = todayISO();
  // paid-early ones stay, ticked green, so they can be seen (and undone)
  const items = useMemo(() => upcomingBills(ds, today, 30), [ds, today]);
  const total = round2(items.filter((c) => !c.paid).reduce((a, c) => a + c.sub.amount, 0));
  const cats = new Map(ds.categories.map((c) => [c.name, c]));
  // active bills we can't place on a calendar (no billing day / next charge date)
  const unscheduled = ds.subscriptions.filter((s) => s.status === "active" && !(s.cycle === "monthly" && s.billingDay) && !s.nextCharge).length;
  const visible = showAll ? items : items.slice(0, 5);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader title={t("bills.upcoming.title")} subtitle={items.length ? t("bills.upcoming.subtitle", { total: f.money(total) }) : undefined} />
      {items.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-ink-3">
          <CalendarClock className="h-4 w-4 shrink-0" /> {t("bills.upcoming.none")}
        </p>
      ) : (
        <ul className="-mx-1 space-y-0.5">
          {visible.map((c) => {
            const cat = cats.get(c.sub.category);
            return (
              <li key={chargeKey(c)} className="flex items-center gap-3 rounded-xl px-1 py-2">
                <span className="grid w-10 shrink-0 place-items-center rounded-xl border border-line bg-surface-2/60 py-1 leading-none">
                  <span className="text-[15px] font-semibold text-ink">{Number(c.date.slice(8, 10))}</span>
                  <span className="mt-0.5 text-[10px] uppercase text-ink-3">{f.monthShort(c.date.slice(0, 7))}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-sm", c.paid ? "text-ink-2" : "text-ink")}>{c.sub.name}</span>
                  {c.paid ? (
                    <span className="block truncate text-xs text-good">{t("bills.loggedOn", { date: f.dateShort(c.paid.date) })}</span>
                  ) : (
                    <span className="flex items-center gap-1.5 truncate text-xs text-ink-3">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: cat?.color ?? "#6f7fe0" }} />
                      <span className="truncate">{c.sub.subcategory ? `${c.sub.category} · ${c.sub.subcategory}` : c.sub.category}</span>
                    </span>
                  )}
                </span>
                <span className={cn("tabular shrink-0 text-sm font-medium", c.paid ? "text-ink-3" : "text-ink")}>{f.money(c.paid?.amount ?? c.sub.amount)}</span>
                <BillCheck ds={ds} charge={c} />
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3 text-[13px]">
        {items.length > 5 ? (
          <button onClick={() => setShowAll((s) => !s)} className="text-gold hover:underline">
            {showAll ? t("bills.showLess") : t("bills.showMore", { count: items.length - 5 })}
          </button>
        ) : (
          <span />
        )}
        <GuardedLink href="/budget" className="text-ink-3 hover:text-ink">
          {unscheduled > 0 ? t("bills.unscheduled", { count: unscheduled }) : t("bills.manage")} →
        </GuardedLink>
      </div>
    </Card>
  );
}

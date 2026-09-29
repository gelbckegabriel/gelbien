"use client";

import { Download, Paperclip, Plus, Repeat, Search, SlidersHorizontal, Split, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { CategorySelect, PaymentSelect } from "@/components/pickers";
import { PRIORITY_COLORS } from "@/components/charts/kit";
import { CategoryIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { useDataset } from "@/lib/data/hooks";
import { toCsv } from "@/lib/csv";
import { downloadFile } from "@/lib/files";
import { useI18n } from "@/lib/i18n";
import { PRIORITIES, type Dataset, type Priority, type Transaction } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { addMonths, cn, monthOf, normalize, round2, todayISO } from "@/lib/utils";

const PAGE = 120;

export default function ExpensesPage() {
  return (
    <Suspense>
      <Expenses />
    </Suspense>
  );
}

function Expenses() {
  const ds = useDataset().data as Dataset;
  // /expenses?category=… (from the budget page) opens with that filter applied
  const params = useSearchParams();
  const linked = params.get("category") ?? "";
  const initialCategory = ds.categories.some((c) => c.name === linked) ? linked : "";
  const month = useUi((s) => s.month);
  const openExpense = useUi((s) => s.openExpense);
  const { t, f } = useI18n();
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"month" | "all">("month");
  const [category, setCategory] = useState(initialCategory);
  const [priority, setPriority] = useState<Priority | "">("");
  const [payment, setPayment] = useState("");
  const [sort, setSort] = useState<"date" | "amount">("date");
  const [showFilters, setShowFilters] = useState(!!initialCategory);
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(normalize(query));

  const cats = useMemo(() => new Map(ds.categories.map((c) => [c.name, c])), [ds.categories]);
  const rows = useMemo(() => {
    const out = ds.transactions.filter(
      (tx) =>
        (scope === "all" || monthOf(tx.date) === month) &&
        (!category || tx.category === category) &&
        (!priority || tx.priority === priority) &&
        (!payment || tx.payment === payment) &&
        (!q || normalize(`${tx.description} ${tx.merchant} ${tx.notes} ${tx.subcategory} ${tx.category}`).includes(q)),
    );
    return sort === "amount" ? [...out].sort((a, b) => b.amount - a.amount) : out;
  }, [ds.transactions, scope, month, category, priority, payment, q, sort]);
  // parts per split purchase: a purchase shows as one row when all of its parts are listed
  const groupSize = useMemo(() => {
    const m = new Map<string, number>();
    for (const tx of ds.transactions) if (tx.group) m.set(tx.group, (m.get(tx.group) ?? 0) + 1);
    return m;
  }, [ds.transactions]);

  const total = round2(rows.reduce((a, r) => a + r.amount, 0));
  const visible = rows.slice(0, limit);
  const groups = useMemo(() => {
    if (sort === "amount") return [{ key: "all", date: "", items: visible }];
    const map = new Map<string, Transaction[]>();
    for (const tx of visible) map.set(tx.date, [...(map.get(tx.date) ?? []), tx]);
    return [...map.entries()].map(([date, items]) => ({ key: date, date, items }));
  }, [visible, sort]);

  const today = todayISO();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return todayISO(d);
  })();
  const dayLabel = (iso: string) => (iso === today ? t("common.today") : iso === yesterday ? t("common.yesterday") : f.dayLong(iso));
  // A split purchase shows as one row when all of its parts are in the list (a category
  // filter can leave only some — those show on their own).
  const rowsOf = (items: Transaction[]) => {
    const out: ({ kind: "tx"; tx: Transaction } | { kind: "split"; txs: Transaction[] })[] = [];
    const done = new Set<string>();
    for (const tx of items) {
      const size = tx.group ? (groupSize.get(tx.group) ?? 0) : 0;
      if (size > 1) {
        if (done.has(tx.group)) continue;
        const parts = items.filter((x) => x.group === tx.group);
        if (parts.length === size) {
          done.add(tx.group);
          out.push({ kind: "split", txs: parts });
          continue;
        }
      }
      out.push({ kind: "tx", tx });
    }
    return out;
  };
  const filtersActive = !!(category || priority || payment || query);
  const payments = [...new Set([...ds.settings.paymentMethods, ...ds.transactions.map((x) => x.payment)].filter(Boolean))];

  return (
    <div>
      <PageHeader
        title={t("exp.title")}
        subtitle={t("exp.summary", { count: rows.length, total: f.money(total) })}
        action={
          <>
            <Button size="sm" variant="ghost" onClick={() => downloadFile(`gelbien-${scope === "all" ? "all" : month}.csv`, toCsv(rows), "text/csv;charset=utf-8")}>
              <Download className="h-4 w-4" /> {t("exp.exportCsv")}
            </Button>
            <Button size="sm" variant="primary" onClick={() => openExpense()}>
              <Plus className="h-4 w-4" /> {t("nav.add")}
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-60">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("exp.search")} className="pl-10" />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink" aria-label={t("common.clear")}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={scope} onChange={(e) => setScope(e.target.value as "month" | "all")} className="w-auto" aria-label={t("exp.thisMonth")}>
          <option value="month">{f.monthLong(month)}</option>
          <option value="all">{t("exp.allTime")}</option>
        </Select>
        <Button variant={showFilters || filtersActive ? "outline" : "secondary"} onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
          <SlidersHorizontal className="h-4 w-4" />
          {filtersActive && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <CategorySelect
                value={category}
                onChange={setCategory}
                categories={ds.categories}
                placeholder={t("exp.allCategories")}
                allLabel={t("exp.allCategories")}
                aria-label={t("exp.col.category")}
              />
              <Select value={priority} onChange={(e) => setPriority(e.target.value as Priority | "")} aria-label={t("exp.col.priority")}>
                <option value="">{t("exp.allPriorities")}</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {t(`priority.${p}`)}
                  </option>
                ))}
              </Select>
              <PaymentSelect
                value={payment}
                onChange={setPayment}
                methods={payments}
                styles={ds.settings.paymentStyles}
                placeholder={t("exp.allPayments")}
                allLabel={t("exp.allPayments")}
                aria-label={t("exp.col.payment")}
              />
              <Select value={sort} onChange={(e) => setSort(e.target.value as "date" | "amount")} aria-label="Sort">
                <option value="date">{t("exp.sort.date")}</option>
                <option value="amount">{t("exp.sort.amount")}</option>
              </Select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title={filtersActive ? t("exp.empty") : t("exp.emptyMonth")}
            action={
              filtersActive ? (
                <Button
                  onClick={() => {
                    setQuery("");
                    setCategory("");
                    setPriority("");
                    setPayment("");
                  }}
                >
                  {t("exp.clearFilters")}
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => useUi.getState().setMonth(addMonths(month, -1))}>
                    ← {f.monthShort(addMonths(month, -1))}
                  </Button>
                  <Button variant="primary" onClick={() => openExpense()}>
                    {t("nav.add")}
                  </Button>
                </div>
              )
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g, gi) => (
            <motion.section
              key={g.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(gi, 10) * 0.03, type: "spring", stiffness: 300, damping: 30 }}
              className="card overflow-hidden"
            >
              {g.date && (
                <header className="flex items-center justify-between border-b border-line/70 bg-white/[0.015] px-4 py-2.5">
                  <span className="text-[13px] font-medium text-ink-2">{dayLabel(g.date)}</span>
                  <span className="tabular text-[13px] text-ink-3">{f.money(round2(g.items.reduce((a, x) => a + x.amount, 0)))}</span>
                </header>
              )}
              <ul className="divide-y divide-line/50">
                <AnimatePresence initial={false}>
                  {rowsOf(g.items).map((row) => {
                    if (row.kind === "split") {
                      const [first] = row.txs;
                      const c = cats.get(first.category);
                      const sumAll = round2(row.txs.reduce((a, x) => a + x.amount, 0));
                      return (
                        <motion.li key={first.group} layout exit={{ opacity: 0, height: 0 }}>
                          <button onClick={() => openExpense({ editing: first })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]">
                            <span className="relative shrink-0">
                              <CategoryIcon icon={c?.icon ?? "Package"} color={c?.color ?? "#6b6a72"} />
                              <span className="absolute -bottom-1 -right-1 grid h-4 min-w-4 place-items-center rounded-full border border-bg bg-surface-3 px-1 text-[9px] font-semibold text-ink-2">
                                +{row.txs.length - 1}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[14px] text-ink">{first.merchant || row.txs.map((x) => x.description).filter(Boolean).join(", ") || first.category}</span>
                                <Split className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label={t("exp.split")} />
                                {first.receiptUrl && <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label={t("exp.receipt")} />}
                              </span>
                              <span className="block truncate text-xs text-ink-3">
                                {[sort === "amount" ? f.dateShort(first.date) : null, row.txs.map((x) => x.category).join(" + "), first.payment]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                              <span className={cn("tabular text-[14px] font-medium", sumAll < 0 ? "text-good" : "text-ink")}>{f.money(sumAll)}</span>
                              <span className="text-[10px] text-ink-3">{t("split.nParts", { n: row.txs.length })}</span>
                            </span>
                          </button>
                        </motion.li>
                      );
                    }
                    const tx = row.tx;
                    const c = cats.get(tx.category);
                    return (
                      <motion.li key={tx.id} layout exit={{ opacity: 0, height: 0 }}>
                        <button onClick={() => openExpense({ editing: tx })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]">
                          <CategoryIcon icon={c?.icon ?? "Package"} color={c?.color ?? "#6b6a72"} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[14px] text-ink">{tx.description || tx.merchant || tx.subcategory || tx.category}</span>
                              {tx.recurring && <Repeat className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label={t("exp.recurring")} />}
                              {tx.group && <Split className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label={t("exp.split")} />}
                              {tx.receiptUrl && <Paperclip className="h-3.5 w-3.5 shrink-0 text-ink-3" aria-label={t("exp.receipt")} />}
                            </span>
                            <span className="block truncate text-xs text-ink-3">
                              {[sort === "amount" ? f.dateShort(tx.date) : null, tx.subcategory || tx.category, tx.merchant, tx.payment].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <span className={cn("tabular text-[14px] font-medium", tx.amount < 0 ? "text-good" : "text-ink")}>
                              {tx.amount < 0 ? f.moneySigned(-tx.amount).replace("−", "+") : f.money(tx.amount)}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-ink-3">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLORS[tx.priority] }} />
                              {t(`priority.${tx.priority}`)}
                            </span>
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </AnimatePresence>
              </ul>
            </motion.section>
          ))}
          {rows.length > limit && (
            <div className="flex justify-center pt-2">
              <Button onClick={() => setLimit((l) => l + PAGE)}>
                +{Math.min(PAGE, rows.length - limit)} · {rows.length - limit}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

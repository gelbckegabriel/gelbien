"use client";

import { Repeat, Sparkles, Store } from "lucide-react";
import { motion } from "motion/react";
import { topMerchants } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { growX } from "@/lib/motion";
import type { Dataset } from "@/lib/types";
import { useView } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "../icons";
import { GuardedLink } from "../shell/unsaved";
import { Card, CardHeader } from "../ui/card";
import { Segmented } from "../ui/form";

const SHOWN = 6;

/** Where the month's day-to-day money went, by merchant — biggest or most visited — with what's new. */
export function TopMerchants({ ds, month, className }: { ds: Dataset; month: string; className?: string }) {
  const { t, f } = useI18n();
  const [by, setBy] = useView("dash.merchants", "amount", ["amount", "visits"] as const);
  const all = topMerchants(ds, month);
  const list = by === "amount" ? all : [...all].sort((a, b) => b.visits - a.visits || b.amount - a.amount);
  const visible = list.slice(0, SHOWN);
  const max = Math.max(1, ...visible.map((m) => (by === "amount" ? m.amount : m.visits)));
  const cats = new Map(ds.categories.map((c) => [c.name, c]));
  const regular = [...all].sort((a, b) => b.visits - a.visits || b.amount - a.amount)[0];
  const fresh = all.filter((m) => m.isNew).map((m) => m.name);
  const visits = (n: number) => (n === 1 ? t("dash.merchants.visit") : t("dash.merchants.visits", { n }));

  return (
    // a size container: in a narrow column the category icons step aside so the names have room
    <Card className={cn("flex flex-col @container", className)}>
      <CardHeader
        title={t("dash.merchants.title")}
        subtitle={t("dash.merchants.subtitle", { month: f.monthName(month) })}
        action={
          all.length > 1 && (
            <Segmented
              size="sm"
              value={by}
              onChange={setBy}
              options={[
                { value: "amount" as const, label: t("dash.merchants.byAmount") },
                { value: "visits" as const, label: t("dash.merchants.byVisits") },
              ]}
            />
          )
        }
      />
      {all.length === 0 ? (
        <p className="flex items-start gap-2 text-sm text-ink-3">
          <Store className="mt-0.5 h-4 w-4 shrink-0" /> {t("dash.merchants.empty")}
        </p>
      ) : (
        <ul className="-mx-2 space-y-0.5">
          {visible.map((m, i) => {
            const cat = cats.get(m.category);
            const color = cat?.color ?? "#6b6a72";
            return (
              <li key={m.name}>
                {/* opens this month's expenses there */}
                <GuardedLink
                  href={`/expenses?q=${encodeURIComponent(m.name)}`}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 rounded-xl @min-[17rem]:grid-cols-[auto_minmax(0,1fr)_auto] px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
                >
                  <CategoryIcon icon={cat?.icon ?? "Package"} color={color} size="sm" className="@max-[17rem]:hidden" />
                  <span className="min-w-0">
                    <span className="flex items-baseline gap-1.5">
                      <span className="truncate text-[13px] text-ink">{m.name}</span>
                      {m.isNew && <span className="shrink-0 text-[11px] text-gold">{t("dash.merchants.new")}</span>}
                    </span>
                    <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.05]">
                      <motion.span
                        className="block h-full origin-left rounded-full"
                        style={{ width: `${((by === "amount" ? m.amount : m.visits) / max) * 100}%`, background: color }}
                        {...growX(0.05 + i * 0.04, 90, 20)}
                      />
                    </span>
                    <span className="mt-1 block truncate text-[11px] text-ink-3">
                      {m.category} · {visits(m.visits)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="tabular block text-[13px] text-ink">{f.amount(m.amount)}</span>
                    {m.visits > 1 && <span className="tabular block text-[11px] text-ink-3">{t("dash.merchants.each", { amount: f.amount(m.amount / m.visits) })}</span>}
                  </span>
                </GuardedLink>
              </li>
            );
          })}
        </ul>
      )}
      {/* pushed to the bottom when the card is stretched to its row */}
      <div className="flex-1" />
      {(regular?.visits >= 3 || fresh.length > 0) && (
        <div className="mt-4 space-y-1 border-t border-line/70 pt-3 text-xs text-ink-3">
          {regular?.visits >= 3 && (
            <p className="flex items-start gap-1.5">
              <Repeat className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("dash.merchants.regular", { name: regular.name, n: regular.visits, avg: f.amount(regular.amount / regular.visits) })}</span>
            </p>
          )}
          {fresh.length > 0 && (
            <p className="flex items-start gap-1.5">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("dash.merchants.fresh", { names: `${fresh.slice(0, 3).join(", ")}${fresh.length > 3 ? ` +${fresh.length - 3}` : ""}` })}</span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

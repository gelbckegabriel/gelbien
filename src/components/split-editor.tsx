"use client";

import { Plus, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/lib/i18n";
import type { Category } from "@/lib/types";
import { cn, parseAmount, round2, uid } from "@/lib/utils";
import { CategorySelect, SubcategorySelect } from "./pickers";
import { Input, MoneyInput } from "./ui/form";

export interface SplitItem {
  key: string;
  name: string;
  amount: string;
}

/** One category of a split purchase. Its items add up to the part's amount. */
export interface SplitPart {
  key: string;
  /** Row this part was loaded from, reused when saving so an edit doesn't duplicate it */
  txId?: string;
  category: string;
  subcategory: string;
  items: SplitItem[];
}

export const newItem = (amount = "", name = ""): SplitItem => ({ key: uid("i"), name, amount });
export const newPart = (category = "", subcategory = "", items: SplitItem[] = [newItem()], txId?: string): SplitPart => ({
  key: uid("p"),
  txId,
  category,
  subcategory,
  items,
});
export const partTotal = (p: SplitPart) => round2(p.items.reduce((a, i) => a + parseAmount(i.amount), 0));

/**
 * Split one purchase across categories: each part picks a category and lists what was bought;
 * amounts add up per category and into the purchase total shown above.
 */
export function SplitEditor({
  parts,
  onChange,
  categories,
  currency,
  missingCategory,
}: {
  parts: SplitPart[];
  onChange: (parts: SplitPart[]) => void;
  categories: Category[];
  currency: string;
  /** parts with an amount but no category, highlighted after a save attempt */
  missingCategory: Set<string>;
}) {
  const { t, f } = useI18n();
  const cats = new Map(categories.map((c) => [c.name, c]));
  const update = (key: string, patch: Partial<SplitPart>) => onChange(parts.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const updateItem = (part: SplitPart, key: string, patch: Partial<SplitItem>) => update(part.key, { items: part.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {parts.map((p, index) => {
          const cat = cats.get(p.category);
          const bad = missingCategory.has(p.key);
          return (
            <motion.div
              key={p.key}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, height: 0 }}
              className={cn("rounded-2xl border bg-surface-2/40 p-3", bad ? "border-bad/50" : "border-line")}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <CategorySelect
                    value={p.category}
                    onChange={(category) => update(p.key, { category, subcategory: "" })}
                    categories={categories.filter((c) => !c.archived || c.name === p.category)}
                    placeholder={t("split.pickCategory")}
                    aria-label={t("split.category", { n: index + 1 })}
                    className="h-10"
                  />
                </div>
                <span className="tabular shrink-0 text-sm font-semibold text-ink">{f.money(partTotal(p))}</span>
                {parts.length > 1 && (
                  <button type="button" onClick={() => onChange(parts.filter((x) => x.key !== p.key))} className="rounded-lg p-1.5 text-ink-3 hover:bg-white/5 hover:text-bad" aria-label={t("split.removePart")}>
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {cat && cat.subcategories.length > 0 && (
                <SubcategorySelect
                  value={p.subcategory}
                  onChange={(subcategory) => update(p.key, { subcategory })}
                  category={cat}
                  anyLabel={t("split.noSub")}
                  placeholder={t("split.anySub")}
                  aria-label={t("form.subcategory")}
                  className="mt-2 h-10"
                />
              )}
              {bad && <p className="mt-1.5 text-xs text-bad">{t("split.needsCategory")}</p>}

              <ul className="mt-2 space-y-2">
                {p.items.map((item) => (
                  <li key={item.key} className="flex items-center gap-2">
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(p, item.key, { name: e.target.value })}
                      placeholder={t("split.itemPh")}
                      maxLength={80}
                      className="h-10 min-w-0 flex-1"
                    />
                    <div className="w-28 shrink-0">
                      <MoneyInput value={item.amount} onChange={(v) => updateItem(p, item.key, { amount: v })} prefix={currency} placeholder="0.00" aria-label={t("form.amount")} className="h-10 text-right" />
                    </div>
                    {p.items.length > 1 && (
                      <button type="button" onClick={() => update(p.key, { items: p.items.filter((i) => i.key !== item.key) })} className="rounded-lg p-1 text-ink-3 hover:text-bad" aria-label={t("split.removeItem")}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => update(p.key, { items: [...p.items, newItem()] })} className="mt-2 inline-flex items-center gap-1 text-[13px] text-gold hover:underline">
                <Plus className="h-3.5 w-3.5" /> {t("split.addItem")}
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => onChange([...parts, newPart()])}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-line-strong py-2.5 text-sm text-ink-2 transition-colors hover:border-gold/40 hover:text-gold-bright"
      >
        <Plus className="h-4 w-4" /> {t("split.addPart")}
      </button>
    </div>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { friendlyAiError, translateCategoryNames, type NameGroup } from "@/lib/ai/client";
import { useActiveAi } from "@/lib/ai/config";
import { useMutate, useSaving } from "@/lib/data/hooks";
import { builtInTranslation, paymentTranslations } from "@/lib/defaults";
import { LOCALES, useI18n } from "@/lib/i18n";
import type { Category, Dataset, Locale } from "@/lib/types";
import { cn, normalize } from "@/lib/utils";
import { Button } from "./ui/button";
import { Input } from "./ui/form";
import { Sheet } from "./ui/sheet";

interface Row {
  id: string;
  /** Current name of the category (for a subcategory: of its category) */
  category: string;
  /** null on the category's own row */
  sub: string | null;
  from: string;
  to: string;
  include: boolean;
  /** Where `to` came from: our fixed translations, the AI, or nowhere yet (the user's own name) */
  source: "builtin" | "ai" | "none";
  edited: boolean;
}

const rowId = (category: string, sub: string | null) => `${category}\u0000${sub ?? ""}`;
/** The name a row ends up with */
const final = (r: Row) => (r.include && r.to.trim() ? r.to.trim() : r.from);
/** Only what would change, plus the user's own names nothing translated yet (so they can type them) */
const visible = (r: Row) => r.to !== r.from || r.source === "none";

function initialRows(categories: Category[], locale: Locale): Row[] {
  return categories.flatMap((c) => {
    const tr = builtInTranslation(c.name, c.subcategories, locale);
    const row = (sub: string | null, to: string | null): Row => {
      const from = sub ?? c.name;
      return { id: rowId(c.name, sub), category: c.name, sub, from, to: to ?? from, include: !!to && to !== from, source: to ? "builtin" : "none", edited: false };
    };
    return [row(null, tr.name), ...c.subcategories.map((s, i) => row(s, tr.subcategories[i]))];
  });
}

/** Rows for the built-in payment methods whose name reads differently in `locale` */
const paymentRows = (methods: string[], locale: Locale): Row[] =>
  paymentTranslations(methods, locale).map(({ from, to }) => ({
    id: `\u0001${from}`,
    category: "",
    sub: null,
    from,
    to,
    include: true,
    source: "builtin",
    edited: false,
  }));

/**
 * Review screen for translating categories and subcategories into the app's language.
 * Built-in names use fixed translations; the user's own names go to the AI when one is set up.
 * Nothing is written until "Apply", which renames everywhere (expenses, budgets, subscriptions).
 * Built-in payment methods ("Crédito" → "Credit") are offered at the end, renamed the same way.
 */
export function TranslateCategoriesDialog({ ds, open, onClose }: { ds: Dataset; open: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const ai = useActiveAi();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  // The categories as they were when the review opened: applying renames them in `ds` right away
  // (optimistically), and the rows below are keyed by these names.
  const [base] = useState(() => ds.categories);
  const [rows, setRows] = useState<Row[]>(() => initialRows(base, locale));
  const [baseSettings] = useState(() => ds.settings);
  const [payRows, setPayRows] = useState<Row[]>(() => paymentRows(baseSettings.paymentMethods, locale));
  const [aiState, setAiState] = useState<{ status: "idle" | "running" | "failed"; error?: string }>({ status: "idle" });
  const language = new Intl.DisplayNames([LOCALES[locale].intl], { type: "language" }).of(locale) ?? LOCALES[locale].label;

  const needsAi = rows.some((r) => r.source === "none" && !r.edited);
  const translateWithAi = async () => {
    if (!ai) return;
    const pending = rows.filter((r) => r.source === "none" && !r.edited);
    const groups = new Map<string, NameGroup>();
    for (const r of pending) {
      const g = groups.get(r.category) ?? { name: r.category, subcategories: [] };
      if (r.sub !== null) g.subcategories.push(r.sub);
      groups.set(r.category, g);
    }
    setAiState({ status: "running" });
    try {
      const result = await translateCategoryNames(ai, [...groups.values()], locale);
      setRows((cur) =>
        cur.map((r) => {
          if (r.source !== "none" || r.edited) return r;
          const hit = result.get(r.category);
          const to = r.sub === null ? hit?.name : hit?.subcategories.get(r.sub);
          return to ? { ...r, to, include: to !== r.from, source: "ai" } : r;
        }),
      );
      setAiState({ status: "idle" });
    } catch (err) {
      setAiState({ status: "failed", error: friendlyAiError(err) });
    }
  };

  // Opening the review is the request to translate: start on the user's own names right away.
  const started = useRef(false);
  useEffect(() => {
    if (!open || started.current || !ai || !needsAi) return;
    started.current = true;
    void translateWithAi();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per opening
  }, [open]);

  const update = (id: string, patch: Partial<Row>) => setRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const updatePay = (id: string, patch: Partial<Row>) => setPayRows((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const groups = useMemo(
    () =>
      base
        .map((c) => ({
          name: c.name,
          self: rows.find((r) => r.id === rowId(c.name, null))!,
          subs: rows.filter((r) => r.category === c.name && r.sub !== null && visible(r)),
        }))
        .filter((g) => visible(g.self) || g.subs.length),
    [base, rows],
  );

  // Two names ending up the same would merge categories (or subcategories) — block that.
  const duplicates = useMemo(() => {
    const dup = new Set<string>();
    const mark = (list: Row[]) => {
      const seen = new Map<string, string>();
      for (const r of list) {
        const key = normalize(final(r));
        if (seen.has(key)) dup.add(r.id).add(seen.get(key)!);
        else seen.set(key, r.id);
      }
    };
    mark(rows.filter((r) => r.sub === null));
    for (const c of base) mark(rows.filter((r) => r.category === c.name && r.sub !== null));
    // payment methods, against the ones that aren't being renamed too
    const renamed = new Set(payRows.map((r) => r.from));
    mark([
      ...payRows,
      ...baseSettings.paymentMethods.filter((p) => !renamed.has(p)).map((p) => ({ id: `\u0002${p}`, from: p, to: p, include: false }) as Row),
    ]);
    return dup;
  }, [rows, base, payRows, baseSettings]);
  const categoryChanges = rows.filter((r) => final(r) !== r.from).length;
  const paymentChanges = payRows.filter((r) => final(r) !== r.from);
  const changes = categoryChanges + paymentChanges.length;

  const apply = async () => {
    if (!changes || duplicates.size || saving) return;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const nameOf = (c: string, s: string | null) => final(byId.get(rowId(c, s))!);
    const categories = base.map((c) => ({ ...c, name: nameOf(c.name, null), subcategories: c.subcategories.map((s) => nameOf(c.name, s)) }));
    const renames = base.filter((c) => nameOf(c.name, null) !== c.name).map((c) => ({ from: c.name, to: nameOf(c.name, null) }));
    const subRenames = base.flatMap((c) =>
      c.subcategories.filter((s) => nameOf(c.name, s) !== s).map((s) => ({ category: c.name, from: s, to: nameOf(c.name, s) })),
    );
    const paymentRenames = paymentChanges.map((r) => ({ from: r.from, to: final(r) }));
    const newName = (p: string) => paymentRenames.find((r) => r.from === p)?.to ?? p;
    const settings = {
      ...baseSettings,
      paymentMethods: baseSettings.paymentMethods.map(newName),
      paymentStyles: Object.fromEntries(Object.entries(baseSettings.paymentStyles).map(([name, style]) => [newName(name), style])),
    };
    const ok = await run(async () => {
      if (categoryChanges) await mutate.save({ op: "saveCategories", categories, renames, subRenames });
      if (paymentRenames.length) await mutate.save({ op: "saveSettings", settings, paymentRenames });
    });
    if (!ok) return;
    toast.success(t("cfg.tr.done"));
    onClose();
  };

  const busy = aiState.status === "running";
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={t("cfg.tr.title")}
      description={t("cfg.tr.subtitle", { language })}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {duplicates.size > 0 && <p className="w-full text-xs text-bad">{t("cfg.tr.duplicate")}</p>}
          <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" className="px-6" onClick={apply} disabled={!changes || duplicates.size > 0 || busy || saving}>
            {saving ? t("common.saving") : t("cfg.tr.apply", { count: changes })}
          </Button>
        </div>
      }
    >
      {needsAi && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/60 px-3 py-2.5 text-sm text-ink-2">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-gold" /> {t("cfg.tr.aiRunning")}
            </>
          ) : aiState.status === "failed" ? (
            <>
              <span className="text-bad">{t("cfg.tr.aiFailed", { error: aiState.error ?? "" })}</span>
              <Button size="sm" variant="outline" onClick={() => void translateWithAi()}>
                {t("common.retry")}
              </Button>
            </>
          ) : ai ? (
            <Button size="sm" variant="outline" onClick={() => void translateWithAi()}>
              {t("cfg.tr.aiAgain")}
            </Button>
          ) : (
            t("cfg.tr.noAi")
          )}
        </div>
      )}

      {groups.length === 0 && payRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">{t("cfg.tr.none", { language })}</p>
      ) : (
        <ul className="space-y-5">
          {groups.map((g) => (
            <li key={g.name}>
              {visible(g.self) ? (
                <RowEditor row={g.self} strong duplicate={duplicates.has(g.self.id)} loading={busy} onChange={(p) => update(g.self.id, p)} />
              ) : (
                // unchanged category shown only as a header for its subcategories
                <p className="text-sm font-medium text-ink-2">{g.name}</p>
              )}
              {g.subs.length > 0 && (
                <ul className="ml-2 mt-3 space-y-3 border-l border-line pl-4">
                  {g.subs.map((r) => (
                    <li key={r.id}>
                      <RowEditor row={r} duplicate={duplicates.has(r.id)} loading={busy} onChange={(p) => update(r.id, p)} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
          {payRows.length > 0 && (
            <li>
              <p className="text-sm font-medium text-ink-2">{t("cfg.payments.title")}</p>
              <ul className="ml-2 mt-3 space-y-3 border-l border-line pl-4">
                {payRows.map((r) => (
                  <li key={r.id}>
                    <RowEditor row={r} duplicate={duplicates.has(r.id)} loading={false} onChange={(p) => updatePay(r.id, p)} />
                  </li>
                ))}
              </ul>
            </li>
          )}
        </ul>
      )}
    </Sheet>
  );
}

function RowEditor({
  row,
  strong,
  duplicate,
  loading,
  onChange,
}: {
  row: Row;
  strong?: boolean;
  duplicate: boolean;
  loading: boolean;
  onChange: (patch: Partial<Row>) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={row.include}
        onChange={(e) => onChange({ include: e.target.checked })}
        aria-label={t("cfg.tr.include", { name: row.from })}
        className="mt-8 h-4 w-4 shrink-0 accent-[#d9b45f]"
      />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-xs text-ink-3">
          <span className="truncate">{row.from}</span>
          {row.source === "ai" && !row.edited && (
            <span className="rounded bg-gold-soft px-1.5 text-[10px] font-semibold text-gold-bright">{t("form.receipt.aiTag")}</span>
          )}
          {loading && row.source === "none" && !row.edited && <Loader2 className="h-3 w-3 animate-spin text-gold" />}
        </p>
        <Input
          value={row.to}
          onChange={(e) => onChange({ to: e.target.value, include: e.target.value.trim() !== "" && e.target.value.trim() !== row.from, edited: true })}
          maxLength={row.sub === null ? 60 : 80}
          aria-label={row.from}
          className={cn("mt-1 h-10", strong && "font-medium", !row.include && "text-ink-3", duplicate && "border-bad/60 text-bad")}
        />
      </div>
    </div>
  );
}

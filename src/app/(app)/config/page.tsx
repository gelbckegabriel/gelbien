"use client";

import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Languages, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { useSearchParams } from "next/navigation";
import { Popover } from "radix-ui";
import { Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { CategoryIcon, ICONS } from "@/components/icons";
import { TranslateCategoriesDialog } from "@/components/translate-categories";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/misc";
import { SaveBar } from "@/components/ui/save-bar";
import { useDataset, useMutate } from "@/lib/data/hooks";
import { CATEGORY_COLORS, CATEGORY_ICONS, PAYMENT_ICONS, paymentLook } from "@/lib/defaults";
import { useI18n } from "@/lib/i18n";
import type { Category, Dataset, PaymentStyle, Settings } from "@/lib/types";
import { stashDraft, useStashedDraft, useUnsavedChanges } from "@/lib/unsaved";
import { cn, normalize, uid } from "@/lib/utils";

interface Draft extends Category {
  key: string;
  /** Name when loaded — used to detect renames */
  original: string | null;
}

interface PaymentDraft {
  key: string;
  original: string | null;
  name: string;
  /** The look the user picked; null keeps the built-in one, which follows the name (and its translation) */
  style: PaymentStyle | null;
}

const toPaymentDrafts = (s: Settings): PaymentDraft[] =>
  s.paymentMethods.map((name) => ({ key: uid("p"), original: name, name, style: s.paymentStyles[name] ?? null }));

const sameLook = (a: PaymentStyle, b: PaymentStyle) => a.icon === b.icon && a.color === b.color;
// order-insensitive, so a re-keyed map (after a translation) doesn't read as an unsaved change
const stylesKey = (st: Record<string, PaymentStyle>) => JSON.stringify(Object.keys(st).sort().map((k) => [k, st[k].icon, st[k].color]));

/** The settings a list of payment drafts saves as, plus the renames to carry over to past expenses */
function fromPaymentDrafts(list: PaymentDraft[]) {
  const kept = list.map((d) => ({ ...d, name: d.name.trim() })).filter((d) => d.name);
  return {
    paymentMethods: kept.map((d) => d.name),
    // only looks that differ from the built-in one for that name
    paymentStyles: Object.fromEntries(kept.filter((d) => d.style && !sameLook(d.style, paymentLook(d.name))).map((d) => [d.name, d.style!])),
    paymentRenames: kept.filter((d) => d.original && d.original !== d.name).map((d) => ({ from: d.original!, to: d.name })),
  };
}

/** `list` with the item keyed `key` swapped with its neighbour in direction `dir` */
function moveItem<T extends { key: string }>(list: T[], key: string, dir: -1 | 1): T[] {
  const i = list.findIndex((x) => x.key === key);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const toDraft = (cats: Category[]): Draft[] =>
  [...cats].sort((a, b) => a.order - b.order).map((c) => ({ ...c, subcategories: [...c.subcategories], key: uid("c"), original: c.name }));

export default function ConfigPage() {
  return (
    <Suspense>
      <Config />
    </Suspense>
  );
}

function Config() {
  const ds = useDataset().data as Dataset;
  const version = `${JSON.stringify(ds.categories)}|${ds.settings.paymentMethods.join("|")}|${JSON.stringify(ds.settings.paymentStyles)}`;
  // /config?translate=1 (offered after a language change) opens the review straight away
  const params = useSearchParams();
  const [translate, setTranslate] = useState(() => ({ open: params.get("translate") === "1", nonce: 0 }));
  return (
    <>
      <ConfigEditor key={version} ds={ds} onTranslate={() => setTranslate((s) => ({ open: true, nonce: s.nonce + 1 }))} />
      {/* outside the editor, which re-mounts as soon as the translated names are applied */}
      <TranslateCategoriesDialog key={translate.nonce} ds={ds} open={translate.open} onClose={() => setTranslate((s) => ({ ...s, open: false }))} />
    </>
  );
}

function ConfigEditor({ ds, onTranslate }: { ds: Dataset; onTranslate: () => void }) {
  const { t } = useI18n();
  const mutate = useMutate();
  const initialCats = useMemo(() => toDraft(ds.categories), [ds.categories]);
  const [cats, setCats] = useStashedDraft<Draft[]>("config:categories", () => initialCats);
  const initialPayments = useMemo(() => toPaymentDrafts(ds.settings), [ds.settings]);
  const [payments, setPayments] = useStashedDraft<PaymentDraft[]>("config:payments", () => initialPayments);
  const paymentsOut = fromPaymentDrafts(payments);
  const paymentsDirty =
    paymentsOut.paymentMethods.join("|") !== ds.settings.paymentMethods.join("|") || stylesKey(paymentsOut.paymentStyles) !== stylesKey(ds.settings.paymentStyles);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState("");

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const tx of ds.transactions) m.set(tx.category, (m.get(tx.category) ?? 0) + 1);
    return m;
  }, [ds.transactions]);

  const strip = (list: Draft[]) => list.map(({ name, color, icon, subcategories, archived }) => ({ name: name.trim(), color, icon, subcategories, archived }));
  const dirty = JSON.stringify(strip(cats)) !== JSON.stringify(strip(initialCats)) || paymentsDirty;
  const duplicate = (name: string, key: string) => cats.some((c) => c.key !== key && normalize(c.name) === normalize(name));

  const update = (key: string, patch: Partial<Draft>) => setCats((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const move = (key: string, dir: -1 | 1) => setCats((list) => moveItem(list, key, dir));

  const addCategory = () => {
    const used = new Set(cats.map((c) => c.color));
    const color = CATEGORY_COLORS.find((c) => !used.has(c)) ?? CATEGORY_COLORS[cats.length % CATEGORY_COLORS.length];
    const draft: Draft = { key: uid("c"), original: null, name: t("cfg.newCategory"), color, icon: "Sparkles", order: cats.length, subcategories: [], archived: false };
    setCats((list) => [...list, draft]);
    setExpanded(draft.key);
  };

  const remove = (c: Draft) => {
    const n = c.original ? usage.get(c.original) ?? 0 : 0;
    if (n > 0) {
      update(c.key, { archived: true });
      toast(t("cfg.inUse", { count: n }));
    } else {
      setCats((list) => list.filter((x) => x.key !== c.key));
    }
  };

  const save = () => {
    const clean = cats.map((c) => ({ ...c, name: c.name.trim() })).filter((c) => c.name);
    const names = clean.map((c) => normalize(c.name));
    const paymentNames = paymentsOut.paymentMethods.map(normalize);
    if (new Set(names).size !== names.length || new Set(paymentNames).size !== paymentNames.length) {
      toast.error(t("cfg.duplicate"));
      return false;
    }
    const renames = clean.filter((c) => c.original && c.original !== c.name).map((c) => ({ from: c.original!, to: c.name }));
    const categories: Category[] = clean.map((c, i) => ({ name: c.name, color: c.color, icon: c.icon, order: i, subcategories: c.subcategories, archived: c.archived }));
    const onFailure = () => {
      stashDraft("config:categories", cats);
      stashDraft("config:payments", payments);
    };
    mutate.mutate({ op: "saveCategories", categories, renames }, { onFailure });
    if (paymentsDirty) {
      const { paymentRenames, ...settings } = paymentsOut;
      mutate.mutate({ op: "saveSettings", settings: { ...ds.settings, ...settings }, paymentRenames }, { onFailure });
    }
    toast.success(t("cfg.saved"));
  };
  useUnsavedChanges(dirty, { save });

  const addPayment = () => {
    const v = newPayment.trim();
    if (!v || payments.some((p) => normalize(p.name) === normalize(v))) return;
    setPayments((p) => [...p, { key: uid("p"), original: null, name: v, style: null }]);
    setNewPayment("");
  };
  const updatePayment = (key: string, patch: Partial<PaymentDraft>) => setPayments((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  const movePayment = (key: string, dir: -1 | 1) => setPayments((list) => moveItem(list, key, dir));

  return (
    <div>
      <PageHeader
        title={t("cfg.title")}
        subtitle={t("cfg.subtitle")}
        action={
          <>
            {/* works on the saved categories, so pending edits must be saved first */}
            <Button variant="ghost" size="sm" onClick={onTranslate} disabled={dirty} title={dirty ? t("cfg.translateDirty") : undefined}>
              <Languages className="h-4 w-4" /> {t("cfg.translate")}
            </Button>
            <Button variant="outline" size="sm" onClick={addCategory}>
              <Plus className="h-4 w-4" /> {t("cfg.addCategory")}
            </Button>
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-8">
          <Reorder.Group axis="y" values={cats} onReorder={setCats} className="space-y-2">
            {cats.map((c, i) => {
              const open = expanded === c.key;
              const n = c.original ? usage.get(c.original) ?? 0 : 0;
              return (
                <Reorder.Item key={c.key} value={c} dragListener={false} className={cn("card overflow-hidden", c.archived && "opacity-60")}>
                  <div className="flex items-center gap-3 p-3">
                    <IconPicker value={c} icons={CATEGORY_ICONS} onChange={(patch) => update(c.key, patch)} />
                    <div className="min-w-0 flex-1">
                      <input
                        value={c.name}
                        onChange={(e) => update(c.key, { name: e.target.value })}
                        className={cn(
                          "w-full rounded-lg bg-transparent px-2 py-1 text-base font-medium text-ink outline-none transition focus:bg-white/5",
                          duplicate(c.name, c.key) && "text-bad",
                        )}
                        aria-label={t("cfg.namePh")}
                        maxLength={60}
                      />
                      <p className="px-2 text-xs text-ink-3">
                        {t("cfg.subCount", { count: c.subcategories.length })} · {t("cfg.usage", { count: n })}
                        {c.original && c.original !== c.name.trim() && <span className="text-gold"> · {t("cfg.renameHint")}</span>}
                      </p>
                    </div>
                    {c.archived && <Badge>{t("cfg.hidden")}</Badge>}
                    <div className="hidden items-center sm:flex">
                      <Button size="icon-sm" variant="ghost" onClick={() => move(c.key, -1)} disabled={i === 0} aria-label={t("cfg.moveUp")}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button size="icon-sm" variant="ghost" onClick={() => move(c.key, 1)} disabled={i === cats.length - 1} aria-label={t("cfg.moveDown")}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button size="icon-sm" variant="ghost" onClick={() => setExpanded(open ? null : c.key)} aria-expanded={open} aria-label={t("common.edit")}>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
                    </Button>
                  </div>
                  <AnimatePresence initial={false}>
                    {open && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="border-t border-line/70 p-4">
                          <SubcategoryEditor
                            items={c.subcategories}
                            onChange={(subcategories) => update(c.key, { subcategories })}
                          />
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <div className="flex sm:hidden">
                              <Button size="sm" variant="ghost" onClick={() => move(c.key, -1)} disabled={i === 0}>
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => move(c.key, 1)} disabled={i === cats.length - 1}>
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                            </div>
                            <Button size="sm" variant="secondary" onClick={() => update(c.key, { archived: !c.archived })}>
                              {c.archived ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                              {c.archived ? t("cfg.show") : t("cfg.hide")}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => remove(c)} className="ml-auto">
                              <Trash2 className="h-4 w-4" /> {t("cfg.deleteCat")}
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </div>

        <div className="lg:col-span-4">
          <Card className="lg:sticky lg:top-24">
            <CardHeader title={t("cfg.payments.title")} subtitle={t("cfg.payments.subtitle")} />
            <ul className="space-y-1.5">
              <AnimatePresence initial={false}>
                {payments.map((p, i) => {
                  const look = p.style ?? paymentLook(p.name);
                  const renamed = !!p.original && p.original !== p.name.trim();
                  return (
                    <motion.li
                      key={p.key}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 8 }}
                      className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 py-1.5 pl-1.5 pr-2.5"
                    >
                      <IconPicker value={look} icons={PAYMENT_ICONS} size="md" onChange={(patch) => updatePayment(p.key, { style: { ...look, ...patch } })} />
                      <div className="min-w-0 flex-1">
                        <input
                          value={p.name}
                          // a renamed method keeps the look it had, rather than one guessed from the new name
                          onChange={(e) => updatePayment(p.key, { name: e.target.value, style: p.style ?? (p.original ? paymentLook(p.original) : null) })}
                          className={cn(
                            "w-full rounded-lg bg-transparent px-2 py-1 text-base text-ink outline-none transition focus:bg-white/5 sm:text-sm",
                            payments.some((x) => x.key !== p.key && normalize(x.name) === normalize(p.name)) && "text-bad",
                          )}
                          aria-label={t("cfg.payments.ph")}
                          maxLength={60}
                        />
                        {renamed && <p className="px-2 text-[11px] text-gold">{t("cfg.payments.renameHint")}</p>}
                      </div>
                      {/* the order of every payment picker; stacked in the narrow side column, roomier for fingers on phones */}
                      <div className="flex shrink-0 items-center lg:flex-col">
                        <Button size="icon-sm" variant="ghost" onClick={() => movePayment(p.key, -1)} disabled={i === 0} aria-label={t("cfg.moveUp")} className="w-7 rounded-md lg:h-4 lg:w-6">
                          <ArrowUp className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => movePayment(p.key, 1)} disabled={i === payments.length - 1} aria-label={t("cfg.moveDown")} className="w-7 rounded-md lg:h-4 lg:w-6">
                          <ArrowDown className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                        </Button>
                      </div>
                      <button onClick={() => setPayments((list) => list.filter((x) => x.key !== p.key))} className="text-ink-3 hover:text-bad" aria-label={t("common.delete")}>
                        <X className="h-4 w-4" />
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addPayment();
              }}
            >
              <Input value={newPayment} onChange={(e) => setNewPayment(e.target.value)} placeholder={t("cfg.payments.ph")} maxLength={60} />
              <Button type="submit" size="icon" variant="secondary" aria-label={t("common.add")}>
                <Plus className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        </div>
      </div>
      <SaveBar
        show={dirty}
        label={t("cfg.unsaved")}
        onSave={save}
        onReset={() => {
          setCats(initialCats);
          setPayments(initialPayments);
        }}
      />
    </div>
  );
}

function SubcategoryEditor({ items, onChange }: { items: string[]; onChange: (items: string[]) => void }) {
  const { t } = useI18n();
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim();
    if (!v || items.some((s) => normalize(s) === normalize(v))) return;
    onChange([...items, v]);
    setValue("");
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {items.map((s) => (
            <motion.span
              key={s}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2/70 py-1 pl-3 pr-1.5 text-[13px] text-ink-2"
            >
              {s}
              <button onClick={() => onChange(items.filter((x) => x !== s))} className="rounded-full p-0.5 text-ink-3 hover:bg-white/10 hover:text-bad" aria-label={t("common.delete")}>
                <X className="h-3 w-3" />
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={t("cfg.subPh")} className="h-10" maxLength={80} />
        <Button type="submit" variant="secondary" className="h-10">
          <Plus className="h-4 w-4" /> {t("cfg.addSub")}
        </Button>
      </form>
    </div>
  );
}

/** Icon + colour for a category or a payment method */
function IconPicker({
  value,
  icons,
  size = "lg",
  onChange,
}: {
  value: PaymentStyle;
  icons: readonly string[];
  size?: "md" | "lg";
  onChange: (patch: Partial<PaymentStyle>) => void;
}) {
  const { t } = useI18n();
  return (
    <Popover.Root>
      <Popover.Trigger className="rounded-xl outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-gold" aria-label={`${t("cfg.icon")} / ${t("cfg.color")}`}>
        <CategoryIcon icon={value.icon} color={value.color} size={size} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="start" className="z-50 w-72 rounded-2xl border border-line-strong bg-[#16161b] p-4 shadow-2xl shadow-black/60">
          <p className="mb-2 text-xs font-medium text-ink-3">{t("cfg.color")}</p>
          <div className="grid grid-cols-7 gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                className={cn("h-7 w-7 rounded-full transition hover:scale-110", value.color === c && "ring-2 ring-white ring-offset-2 ring-offset-[#16161b]")}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs font-medium text-ink-3">{t("cfg.icon")}</p>
          <div className="grid grid-cols-8 gap-1">
            {icons.map((name) => {
              const Icon = ICONS[name];
              return (
                <button
                  key={name}
                  onClick={() => onChange({ icon: name })}
                  className={cn("grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white/10", value.icon === name ? "bg-white/10" : "text-ink-3")}
                  style={value.icon === name ? { color: value.color } : undefined}
                  aria-label={name}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

"use client";

import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { AnimatePresence, motion, Reorder } from "motion/react";
import { Popover } from "radix-ui";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CategoryIcon, ICONS } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, PageHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { Badge } from "@/components/ui/misc";
import { SaveBar } from "@/components/ui/save-bar";
import { useDataset, useMutate } from "@/lib/data/hooks";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/defaults";
import { useI18n } from "@/lib/i18n";
import type { Category, Dataset } from "@/lib/types";
import { useUnsavedChanges } from "@/lib/unsaved";
import { cn, normalize, uid } from "@/lib/utils";

interface Draft extends Category {
  key: string;
  /** Name when loaded — used to detect renames */
  original: string | null;
}

const toDraft = (cats: Category[]): Draft[] =>
  [...cats].sort((a, b) => a.order - b.order).map((c) => ({ ...c, subcategories: [...c.subcategories], key: uid("c"), original: c.name }));

export default function ConfigPage() {
  const ds = useDataset().data as Dataset;
  const version = `${JSON.stringify(ds.categories)}|${ds.settings.paymentMethods.join("|")}`;
  return <ConfigEditor key={version} ds={ds} />;
}

function ConfigEditor({ ds }: { ds: Dataset }) {
  const { t } = useI18n();
  const mutate = useMutate();
  const initialCats = useMemo(() => toDraft(ds.categories), [ds.categories]);
  const [cats, setCats] = useState<Draft[]>(initialCats);
  const [payments, setPayments] = useState<string[]>(ds.settings.paymentMethods);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState("");

  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const tx of ds.transactions) m.set(tx.category, (m.get(tx.category) ?? 0) + 1);
    return m;
  }, [ds.transactions]);

  const strip = (list: Draft[]) => list.map(({ name, color, icon, subcategories, archived }) => ({ name: name.trim(), color, icon, subcategories, archived }));
  const dirty = JSON.stringify(strip(cats)) !== JSON.stringify(strip(initialCats)) || payments.join("|") !== ds.settings.paymentMethods.join("|");
  const duplicate = (name: string, key: string) => cats.some((c) => c.key !== key && normalize(c.name) === normalize(name));

  const update = (key: string, patch: Partial<Draft>) => setCats((list) => list.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const move = (key: string, dir: -1 | 1) =>
    setCats((list) => {
      const i = list.findIndex((c) => c.key === key);
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

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
    if (new Set(names).size !== names.length) {
      toast.error(t("cfg.duplicate"));
      return false;
    }
    const renames = clean.filter((c) => c.original && c.original !== c.name).map((c) => ({ from: c.original!, to: c.name }));
    const categories: Category[] = clean.map((c, i) => ({ name: c.name, color: c.color, icon: c.icon, order: i, subcategories: c.subcategories, archived: c.archived }));
    mutate.mutate({ op: "saveCategories", categories, renames });
    if (payments.join("|") !== ds.settings.paymentMethods.join("|")) {
      mutate.mutate({ op: "saveSettings", settings: { ...ds.settings, paymentMethods: payments } });
    }
    toast.success(t("cfg.saved"));
  };
  useUnsavedChanges(dirty, { save });

  const addPayment = () => {
    const v = newPayment.trim();
    if (!v || payments.some((p) => normalize(p) === normalize(v))) return;
    setPayments((p) => [...p, v]);
    setNewPayment("");
  };

  return (
    <div>
      <PageHeader
        title={t("cfg.title")}
        subtitle={t("cfg.subtitle")}
        action={
          <Button variant="outline" size="sm" onClick={addCategory}>
            <Plus className="h-4 w-4" /> {t("cfg.addCategory")}
          </Button>
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
                    <IconPicker category={c} onChange={(patch) => update(c.key, patch)} />
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
                {payments.map((p) => (
                  <motion.li
                    key={p}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    className="flex items-center justify-between rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-sm text-ink-2"
                  >
                    {p}
                    <button onClick={() => setPayments((list) => list.filter((x) => x !== p))} className="text-ink-3 hover:text-bad" aria-label={t("common.delete")}>
                      <X className="h-4 w-4" />
                    </button>
                  </motion.li>
                ))}
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
          setPayments(ds.settings.paymentMethods);
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

function IconPicker({ category, onChange }: { category: Category; onChange: (patch: Partial<Category>) => void }) {
  const { t } = useI18n();
  return (
    <Popover.Root>
      <Popover.Trigger className="rounded-xl outline-none transition hover:scale-105 focus-visible:ring-2 focus-visible:ring-gold" aria-label={`${t("cfg.icon")} / ${t("cfg.color")}`}>
        <CategoryIcon icon={category.icon} color={category.color} size="lg" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content sideOffset={8} align="start" className="z-50 w-72 rounded-2xl border border-line-strong bg-[#16161b] p-4 shadow-2xl shadow-black/60">
          <p className="mb-2 text-xs font-medium text-ink-3">{t("cfg.color")}</p>
          <div className="grid grid-cols-7 gap-2">
            {CATEGORY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChange({ color: c })}
                className={cn("h-7 w-7 rounded-full transition hover:scale-110", category.color === c && "ring-2 ring-white ring-offset-2 ring-offset-[#16161b]")}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
          </div>
          <p className="mb-2 mt-4 text-xs font-medium text-ink-3">{t("cfg.icon")}</p>
          <div className="grid grid-cols-8 gap-1">
            {CATEGORY_ICONS.map((name) => {
              const Icon = ICONS[name];
              return (
                <button
                  key={name}
                  onClick={() => onChange({ icon: name })}
                  className={cn("grid h-8 w-8 place-items-center rounded-lg transition hover:bg-white/10", category.icon === name ? "bg-white/10" : "text-ink-3")}
                  style={category.icon === name ? { color: category.color } : undefined}
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

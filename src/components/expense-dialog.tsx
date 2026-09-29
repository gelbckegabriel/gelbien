"use client";

import { AlertTriangle, Camera, ExternalLink, FileText, Loader2, Paperclip, Sparkles, Split, Trash2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { friendlyAiError, parseReceipt, RECEIPT_FIELDS, type ReceiptField } from "@/lib/ai/client";
import { useActiveAi } from "@/lib/ai/config";
import { useDataset, useMode, useMutate } from "@/lib/data/hooks";
import { errorReason } from "@/lib/data/errors";
import { uploadReceiptFile } from "@/lib/data/sources";
import { knownMerchants, suggestFromHistory } from "@/lib/finance";
import { prepareReceipt, receiptFromTransfer, type PreparedReceipt } from "@/lib/files";
import { useI18n } from "@/lib/i18n";
import { EXPENSE_TYPES, PRIORITIES, type Dataset, type ExpenseType, type Mutation, type Priority, type Transaction } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { cn, isValidISODate, normalize, parseAmount, round2, todayISO, uid } from "@/lib/utils";
import { CategoryIcon } from "./icons";
import { GuardedLink } from "./shell/unsaved";
import { newItem, newPart, partTotal, SplitEditor, type SplitPart } from "./split-editor";
import { Button } from "./ui/button";
import { PaymentSelect } from "./pickers";
import { Field, Input, MoneyInput, Segmented, Switch, Textarea } from "./ui/form";
import { Sheet } from "./ui/sheet";

interface FormState {
  amount: string;
  refund: boolean;
  date: string;
  category: string;
  subcategory: string;
  description: string;
  merchant: string;
  payment: string;
  type: ExpenseType;
  priority: Priority;
  recurring: boolean;
  notes: string;
  receiptUrl: string;
}

const LAST_PAYMENT_KEY = "gelbien.lastPayment";
/** Whether an attached receipt is also uploaded to Drive — remembered from the last expense. */
const KEEP_RECEIPT_KEY = "gelbien.keepReceipt";

function readKeepReceipt() {
  try {
    return localStorage.getItem(KEEP_RECEIPT_KEY) !== "0";
  } catch {
    return true;
  }
}

function initialForm(ds: Dataset, editing: Transaction | null): FormState {
  if (editing) {
    return {
      amount: String(Math.abs(editing.amount)),
      refund: editing.amount < 0,
      date: editing.date,
      category: editing.category,
      subcategory: editing.subcategory,
      description: editing.description,
      merchant: editing.merchant,
      payment: editing.payment,
      type: editing.type,
      priority: editing.priority,
      recurring: editing.recurring,
      notes: editing.notes,
      receiptUrl: editing.receiptUrl,
    };
  }
  let payment = ds.settings.paymentMethods[0] ?? "";
  try {
    const last = localStorage.getItem(LAST_PAYMENT_KEY);
    if (last && ds.settings.paymentMethods.includes(last)) payment = last;
  } catch {
    /* ignore */
  }
  return {
    amount: "",
    refund: false,
    date: todayISO(),
    category: "",
    subcategory: "",
    description: "",
    merchant: "",
    payment,
    type: "variable",
    priority: "important",
    recurring: false,
    notes: "",
    receiptUrl: "",
  };
}

/** Most common priority/type the user picked for a category before. */
function habitsFor(ds: Dataset, category: string) {
  const pr = new Map<Priority, number>();
  const ty = new Map<ExpenseType, number>();
  for (const t of ds.transactions) {
    if (t.category !== category) continue;
    pr.set(t.priority, (pr.get(t.priority) ?? 0) + 1);
    ty.set(t.type, (ty.get(t.type) ?? 0) + 1);
  }
  const top = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return { priority: top(pr), type: top(ty) };
}

export function ExpenseDialog() {
  const state = useUi((s) => s.expense);
  const close = useUi((s) => s.closeExpense);
  const openExpense = useUi((s) => s.openExpense);
  const { data } = useDataset();
  if (!data) return null;
  return (
    <ExpenseForm
      key={state.nonce}
      ds={data}
      open={state.open}
      editing={state.editing}
      draft={state.draft}
      draftGroup={state.draftGroup}
      initialFile={state.file}
      onClose={close}
      onAnother={() => openExpense()}
    />
  );
}

function ExpenseForm({
  ds,
  open,
  editing,
  draft,
  draftGroup,
  initialFile,
  onClose,
  onAnother,
}: {
  ds: Dataset;
  open: boolean;
  editing: Transaction | null;
  /** Prefill from a save that failed (same id, so retrying can't duplicate the row) */
  draft: Transaction | null;
  draftGroup: Transaction[] | null;
  initialFile: File | null;
  onClose: () => void;
  onAnother: () => void;
}) {
  const { t, f, locale } = useI18n();
  const ai = useActiveAi();
  const { mode } = useMode();
  const mutate = useMutate();
  // A split purchase opens with all of its parts (one per category)
  const [groupTxs] = useState(() => draftGroup ?? (editing?.group ? ds.transactions.filter((t) => t.group === editing.group) : null));
  const [form, setFormState] = useState<FormState>(() => {
    const f = initialForm(ds, groupTxs?.[0] ?? draft ?? editing);
    // parts carry their own descriptions
    return groupTxs && groupTxs.length > 1 ? { ...f, description: "", amount: "" } : f;
  });
  const [split, setSplit] = useState<SplitPart[] | null>(() =>
    groupTxs && groupTxs.length > 1
      ? groupTxs.map((t) => newPart(t.category, t.subcategory, [newItem(String(Math.abs(t.amount)), t.description)], t.id))
      : null,
  );
  const [missingCategory, setMissingCategory] = useState<Set<string>>(new Set());
  const splitTotal = split ? round2(split.reduce((a, p) => a + partTotal(p), 0)) : 0;
  const [errors, setErrors] = useState<{ amount?: string; category?: string }>({});
  const [receipt, setReceipt] = useState<PreparedReceipt | null>(null);
  const [keepReceipt, setKeepReceipt] = useState(readKeepReceipt);
  const [reading, setReading] = useState(false);
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [uncertain, setUncertain] = useState<Set<string>>(new Set());
  const [aiNote, setAiNote] = useState<{ tone: "gold" | "bad" | "muted"; text: string } | null>(null);
  const [suggestedFrom, setSuggestedFrom] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(() => !!editing && (!!editing.notes || editing.recurring || editing.amount < 0));
  const [saving, setSaving] = useState(false);
  const touched = useRef(new Set<keyof FormState>());
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ds.categories.filter((c) => !c.archived || c.name === form.category), [ds.categories, form.category]);
  const currentCat = ds.categories.find((c) => c.name === form.category);
  const merchants = useMemo(() => knownMerchants(ds.transactions).slice(0, 200), [ds.transactions]);
  const currencySymbol = useMemo(
    () => new Intl.NumberFormat(f.intl, { style: "currency", currency: ds.settings.currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? "$",
    [f.intl, ds.settings.currency],
  );

  const set = useCallback((patch: Partial<FormState>, userEdit = true) => {
    setFormState((s) => ({ ...s, ...patch }));
    if (userEdit) {
      for (const k of Object.keys(patch) as (keyof FormState)[]) touched.current.add(k);
      setAiFields((prev) => {
        const next = new Set(prev);
        for (const k of Object.keys(patch)) next.delete(k);
        return next;
      });
      setUncertain((prev) => {
        const next = new Set(prev);
        for (const k of Object.keys(patch)) next.delete(k);
        return next;
      });
    }
  }, []);

  const pickCategory = (name: string) => {
    const patch: Partial<FormState> = { category: name };
    if (name !== form.category) patch.subcategory = "";
    const habits = habitsFor(ds, name);
    if (!touched.current.has("priority") && habits.priority) patch.priority = habits.priority;
    if (!touched.current.has("type") && habits.type) patch.type = habits.type;
    set(patch);
    setErrors((e) => ({ ...e, category: undefined }));
  };

  const applyHistory = () => {
    if (editing || touched.current.has("category")) return;
    const s = suggestFromHistory(ds.transactions, form.merchant);
    if (!s) return;
    set(
      {
        category: s.category,
        subcategory: s.subcategory,
        priority: touched.current.has("priority") ? form.priority : s.priority,
        type: touched.current.has("type") ? form.type : s.type,
        payment: touched.current.has("payment") ? form.payment : s.payment || form.payment,
      },
      false,
    );
    setSuggestedFrom(s.merchant);
  };

  // ---- receipts ----
  const handleFile = useCallback(
    async (file: File) => {
      let prepared: PreparedReceipt;
      try {
        prepared = await prepareReceipt(file);
      } catch (err) {
        const code = (err as Error).message;
        toast.error(code === "tooBig" ? t("form.receipt.tooBig") : t("form.receipt.badType"));
        return;
      }
      setReceipt((old) => {
        if (old?.previewUrl) URL.revokeObjectURL(old.previewUrl);
        return prepared;
      });
      if (!ai) {
        setAiNote({ tone: "muted", text: t("form.receipt.noAi") });
        return;
      }
      setReading(true);
      setAiNote(null);
      try {
        const r = await parseReceipt(ai, prepared.ai, ds, locale);
        const patch: Partial<FormState> = {};
        const filled = new Set<string>();
        const put = <K extends keyof FormState>(k: K, v: FormState[K] | null | undefined) => {
          if (v === null || v === undefined || v === "" || touched.current.has(k)) return;
          (patch as Record<string, unknown>)[k] = v;
          filled.add(k);
        };
        if (r.amount !== null) put("amount", String(round2(Math.abs(r.amount))));
        if (r.date && isValidISODate(r.date) && r.date <= todayISO()) put("date", r.date);
        put("merchant", r.merchant);
        put("description", r.description);
        // The model's answers are matched to real names here (accent/case-insensitive) — never trusted verbatim.
        const cat = r.category ? ds.categories.find((c) => normalize(c.name) === normalize(r.category!)) : undefined;
        if (cat) {
          put("category", cat.name);
          put("subcategory", cat.subcategories.find((s) => normalize(s) === normalize(r.subcategory ?? "")) ?? null);
        }
        put("payment", ds.settings.paymentMethods.find((p) => normalize(p) === normalize(r.payment ?? "")) ?? null);
        const priority = PRIORITIES.find((p) => p === normalize(r.priority ?? ""));
        put("priority", priority ?? null);
        set(patch, false);
        setAiFields(filled);
        setUncertain(new Set(r.uncertain.filter((f): f is ReceiptField => (RECEIPT_FIELDS as readonly string[]).includes(f))));
        const foreign = r.currency && r.currency.toUpperCase() !== ds.settings.currency.toUpperCase() ? ` (${r.currency})` : "";
        setAiNote({ tone: "gold", text: t("form.receipt.filled", { count: filled.size }) + foreign });
      } catch (err) {
        setAiNote({ tone: "bad", text: t("form.receipt.failed", { error: friendlyAiError(err) }) });
      } finally {
        setReading(false);
      }
    },
    [ai, ds, locale, set, t],
  );

  // Receipt handed over from a global paste/drop
  const handedOver = useRef(false);
  useEffect(() => {
    if (initialFile && !handedOver.current) {
      handedOver.current = true;
      void handleFile(initialFile);
    }
  }, [initialFile, handleFile]);

  // Paste while the dialog is open
  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = receiptFromTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      void handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, handleFile]);

  useEffect(() => () => {
    if (receipt?.previewUrl) URL.revokeObjectURL(receipt.previewUrl);
  }, [receipt]);

  // ---- split ----
  const startSplit = () => {
    setSplit([newPart(form.category, form.subcategory, [newItem(form.amount, form.description)], editing?.id ?? draft?.id), newPart()]);
    setErrors((e) => ({ ...e, category: undefined }));
  };
  const mergeSplit = () => {
    if (!split) return;
    const first = split.find((p) => p.category) ?? split[0];
    set({ amount: splitTotal ? String(splitTotal) : "", category: first.category, subcategory: first.subcategory });
    setSplit(null);
    setMissingCategory(new Set());
  };

  // ---- save ----
  const save = async (another: boolean) => {
    // parts without an amount are ignored; one part left is just an expense in that category
    const parts = split?.filter((p) => partTotal(p) > 0) ?? null;
    const value = parts ? round2(parts.reduce((a, p) => a + partTotal(p), 0)) : parseAmount(form.amount);
    const nextErrors: typeof errors = {};
    if (!value || value <= 0) nextErrors.amount = t("form.requiredAmount");
    if (!parts && !form.category) nextErrors.category = t("form.requiredCategory");
    const missing = new Set(parts?.filter((p) => !p.category).map((p) => p.key) ?? []);
    setMissingCategory(missing);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || missing.size) {
      if (nextErrors.amount && !split) amountRef.current?.focus();
      return;
    }

    setSaving(true);
    let receiptUrl = form.receiptUrl;
    // Without "Save to Drive" the receipt only fills in the form (and goes to the AI provider, if any).
    if (receipt && mode === "google" && keepReceipt) {
      try {
        toast.loading(t("form.receipt.uploading"), { id: "receipt-upload" });
        receiptUrl = (await uploadReceiptFile(receipt.blob, `${form.date} ${form.merchant || form.description || "receipt"}`.trim())).url;
        toast.dismiss("receipt-upload");
      } catch (err) {
        toast.dismiss("receipt-upload");
        toast.error(t("err.receipt"), { description: errorReason(err, t) });
      }
    }

    const now = new Date().toISOString();
    const sign = form.refund ? -1 : 1;
    const loaded = groupTxs && groupTxs.length > 1 ? groupTxs : null;
    const base: Transaction = {
      id: editing?.id ?? draft?.id ?? uid("t"),
      date: isValidISODate(form.date) ? form.date : todayISO(),
      category: form.category,
      subcategory: form.subcategory,
      description: form.description.trim(),
      amount: round2(sign * value),
      payment: form.payment,
      type: form.type,
      priority: form.priority,
      merchant: form.merchant.trim(),
      recurring: form.recurring,
      notes: form.notes.trim(),
      receiptUrl,
      createdAt: loaded?.[0].createdAt || editing?.createdAt || draft?.createdAt || now,
      updatedAt: now,
      group: "",
      billId: (draft ?? editing)?.billId ?? "",
    };
    // A split is one row per category sharing a group id, so budgets and charts need nothing special
    const groupId = loaded?.[0].group || uid("g");
    const txs: Transaction[] = parts
      ? parts.map((p) => ({
          ...base,
          id: p.txId ?? uid("t"),
          category: p.category,
          subcategory: p.subcategory,
          description: p.items.map((i) => i.name.trim()).filter(Boolean).join(", ") || base.description || base.merchant,
          amount: round2(sign * partTotal(p)),
          group: parts.length > 1 ? groupId : "",
        }))
      : [base];
    const isGroup = txs.length > 1;
    const wasGroup = loaded?.[0].group ?? "";
    // Group writes also delete the parts that were removed (or all but one, when merged back)
    const byGroup = isGroup || !!wasGroup;
    const group = isGroup ? groupId : wasGroup;
    const previous = loaded ?? (editing ? [editing] : null);
    const mutation: Mutation = byGroup ? { op: "saveTransactionGroup", group, txs } : { op: editing ? "updateTransaction" : "addTransaction", tx: txs[0] };
    const undo: Mutation = previous
      ? byGroup
        ? { op: "saveTransactionGroup", group, txs: previous }
        : { op: "updateTransaction", tx: previous[0] }
      : isGroup
        ? { op: "deleteTransactionGroup", group }
        : { op: "deleteTransaction", id: txs[0].id };

    try {
      localStorage.setItem(LAST_PAYMENT_KEY, form.payment);
      if (receipt) localStorage.setItem(KEEP_RECEIPT_KEY, keepReceipt ? "1" : "0");
    } catch {
      /* ignore */
    }
    mutate.mutate(mutation, {
      // The dialog closed optimistically: bring it back with what was typed. If the user is
      // already entering the next expense, don't clobber it — offer "Review" instead.
      onFailure: () => {
        const ui = useUi.getState();
        const reopen = () => (isGroup ? ui.openExpense({ editing, draftGroup: txs }) : ui.openExpense({ editing: previous?.[0] ?? null, draft: txs[0] }));
        if (!ui.expense.open) return reopen();
        return { label: t("err.review"), onClick: reopen };
      },
    });
    setSaving(false);
    toast.success(previous ? t("exp.updated") : t("exp.saved"), {
      description: isGroup ? `${f.money(base.amount)} · ${t("split.nParts", { n: txs.length })}` : `${f.money(txs[0].amount)} · ${txs[0].category}`,
      action: { label: t("common.undo"), onClick: () => mutate.mutate(undo) },
    });
    if (another) onAnother();
    else onClose();
  };

  const remove = () => {
    if (!editing || !window.confirm(t("form.deleteConfirm"))) return;
    if (groupTxs && groupTxs.length > 1) {
      const removed = groupTxs;
      const group = removed[0].group;
      mutate.mutate({ op: "deleteTransactionGroup", group });
      toast(t("exp.deleted"), {
        description: `${f.money(round2(removed.reduce((a, x) => a + x.amount, 0)))} · ${t("split.nParts", { n: removed.length })}`,
        action: { label: t("common.undo"), onClick: () => mutate.mutate({ op: "saveTransactionGroup", group, txs: removed }) },
      });
    } else {
      const removed = editing;
      mutate.mutate({ op: "deleteTransaction", id: removed.id });
      toast(t("exp.deleted"), {
        description: `${f.money(removed.amount)} · ${removed.description || removed.category}`,
        action: { label: t("common.undo"), onClick: () => mutate.mutate({ op: "addTransaction", tx: removed }) },
      });
    }
    onClose();
  };

  const flag = (k: string) => (uncertain.has(k) ? <span className="inline-flex items-center gap-1 text-warn"><AlertTriangle className="h-3 w-3" /></span> : aiFields.has(k) ? <span className="rounded bg-gold-soft px-1.5 text-[10px] font-semibold text-gold-bright">{t("form.receipt.aiTag")}</span> : null);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={editing ? t("form.editTitle") : t("form.newTitle")}
      wide
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="danger" size="icon" onClick={remove} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto hidden sm:inline-flex" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          {!editing && (
            <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => save(true)} disabled={saving || reading}>
              {t("form.saveAndNew")}
            </Button>
          )}
          <Button variant="primary" className="flex-1 sm:flex-none sm:px-8" onClick={() => save(false)} disabled={saving || reading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Receipt zone */}
        <ReceiptZone
          receipt={receipt}
          reading={reading}
          existingUrl={form.receiptUrl}
          // Receipts only go to Drive when signed in with Google
          keep={mode === "google" ? { checked: keepReceipt, onChange: setKeepReceipt } : undefined}
          onPick={() => fileInput.current?.click()}
          onCamera={() => cameraInput.current?.click()}
          onDrop={(file) => void handleFile(file)}
          onRemove={() => {
            setReceipt(null);
            setAiNote(null);
          }}
        />
        <input ref={fileInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <AnimatePresence>
          {aiNote && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className={cn(
                "flex items-start gap-2 rounded-xl border px-3 py-2 text-[13px]",
                aiNote.tone === "gold" && "border-gold/25 bg-gold-soft text-gold-bright",
                aiNote.tone === "bad" && "border-bad/25 bg-bad-soft text-bad",
                aiNote.tone === "muted" && "border-line bg-surface-2 text-ink-3",
              )}
            >
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {aiNote.text}{" "}
                {aiNote.tone === "muted" && (
                  <GuardedLink href="/profile" onClick={onClose} className="underline underline-offset-2">
                    {t("nav.profile")}
                  </GuardedLink>
                )}
              </span>
            </motion.p>
          )}
        </AnimatePresence>

        {/* Amount + date */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <Field label={t("form.amount")} hint={split ? <span className="text-xs text-ink-3">{t("split.totalHint")}</span> : flag("amount")} highlight={aiFields.has("amount")} htmlFor="amount">
              <MoneyInput
                ref={amountRef}
                id="amount"
                prefix={currencySymbol}
                // while split, the amount is the sum of the parts below
                value={split ? (splitTotal ? String(splitTotal) : "") : form.amount}
                readOnly={!!split}
                onChange={(v) => {
                  set({ amount: v });
                  setErrors((e) => ({ ...e, amount: undefined }));
                }}
                placeholder="0.00"
                data-autofocus={!initialFile && !editing ? "" : undefined}
                className={cn("h-14 text-2xl font-semibold", form.refund && "text-good", split && "text-ink-2")}
              />
            </Field>
            {/* under the amount, not the date, now that the two stack on phones */}
            {errors.amount && <p className="mt-1.5 text-xs text-bad">{errors.amount}</p>}
          </div>
          <Field label={t("form.date")} hint={flag("date")} highlight={aiFields.has("date")} htmlFor="date">
            <Input id="date" type="date" value={form.date} max={todayISO()} onChange={(e) => set({ date: e.target.value })} className="h-14" />
          </Field>
        </div>

        {/* Where + what first: picking a known merchant auto-fills the category below */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.merchant")} hint={flag("merchant")} highlight={aiFields.has("merchant")} htmlFor="merchant">
            <Input
              id="merchant"
              list="gelbien-merchants"
              value={form.merchant}
              placeholder={t("form.merchantPh")}
              onChange={(e) => set({ merchant: e.target.value })}
              onBlur={applyHistory}
              maxLength={120}
            />
            <datalist id="gelbien-merchants">
              {merchants.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
          <Field label={t("form.description")} hint={flag("description")} highlight={aiFields.has("description")} htmlFor="desc">
            <Input id="desc" value={form.description} placeholder={t("form.descriptionPh")} onChange={(e) => set({ description: e.target.value })} maxLength={200} />
          </Field>
        </div>

        {/* Category chips — or, for a purchase split across categories, the split editor */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2 text-[13px] font-medium text-ink-2">
            <span className="flex items-center gap-2">
              {split ? t("split.title") : t("form.category")}
              {flag("category")}
            </span>
            <button type="button" onClick={split ? mergeSplit : startSplit} className="inline-flex items-center gap-1 text-[13px] font-medium text-gold hover:underline">
              <Split className="h-3.5 w-3.5" /> {split ? t("split.merge") : t("split.start")}
            </button>
          </div>
          {split ? (
            <SplitEditor parts={split} onChange={setSplit} categories={ds.categories} currency={currencySymbol} missingCategory={missingCategory} />
          ) : (
            <div className={cn("grid grid-cols-3 gap-2 sm:grid-cols-5", errors.category && "rounded-2xl ring-1 ring-bad/50 ring-offset-4 ring-offset-[#141418]")}>
              {categories.map((c) => {
                const active = c.name === form.category;
                return (
                  <motion.button
                    key={c.name}
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => pickCategory(c.name)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-2xl border px-1.5 py-2.5 text-center transition-colors",
                      active ? "border-transparent" : "border-line bg-surface-2/60 hover:border-line-strong",
                    )}
                    style={active ? { background: `${c.color}26`, boxShadow: `inset 0 0 0 1.5px ${c.color}` } : undefined}
                  >
                    <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                    <span className={cn("line-clamp-2 text-[11px] leading-tight", active ? "text-ink" : "text-ink-2")}>{c.name}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
          {errors.category && <p className="mt-2 text-xs text-bad">{errors.category}</p>}
          <AnimatePresence>
            {suggestedFrom && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2 text-xs text-gold">
                {t("form.suggested", { merchant: suggestedFrom })}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Subcategory chips */}
        <AnimatePresence initial={false}>
          {!split && currentCat && currentCat.subcategories.length > 0 && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mb-2 flex items-center justify-between text-[13px] font-medium text-ink-2">
                <span>{t("form.subcategory")}</span>
                {flag("subcategory")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {currentCat.subcategories.map((s) => {
                  const active = s === form.subcategory;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => set({ subcategory: active ? "" : s })}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                        active ? "border-gold/50 bg-gold-soft text-gold-bright" : "border-line bg-surface-2/60 text-ink-2 hover:border-line-strong hover:text-ink",
                      )}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.payment")} hint={flag("payment")} highlight={aiFields.has("payment")} htmlFor="payment">
            <PaymentSelect
              id="payment"
              value={form.payment}
              onChange={(payment) => set({ payment })}
              methods={[...new Set([...ds.settings.paymentMethods, form.payment].filter(Boolean))]}
              styles={ds.settings.paymentStyles}
              placeholder={t("form.payment")}
            />
          </Field>
          <Field label={t("form.type")}>
            <Segmented value={form.type} onChange={(v) => set({ type: v })} options={EXPENSE_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }))} />
          </Field>
        </div>

        <Field label={t("form.priority")} hint={flag("priority")}>
          <Segmented
            value={form.priority}
            onChange={(v) => set({ priority: v })}
            options={PRIORITIES.map((v) => ({
              value: v,
              label: t(`priority.${v}`),
              tone: v === "essential" ? "good" : v === "important" ? "gold" : "bad",
            }))}
          />
        </Field>

        <div>
          <button type="button" onClick={() => setShowMore((s) => !s)} className="text-[13px] font-medium text-ink-3 hover:text-ink">
            {showMore ? "−" : "+"} {t("form.notes")} · {t("form.recurring").toLowerCase()} · {t("exp.refund").toLowerCase()}
          </button>
          <AnimatePresence initial={false}>
            {showMore && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                <div className="space-y-4 pt-4">
                  <Textarea value={form.notes} placeholder={t("form.notesPh")} onChange={(e) => set({ notes: e.target.value })} maxLength={1000} />
                  <div className="flex flex-wrap gap-6">
                    <Switch checked={form.recurring} onChange={(v) => set({ recurring: v })} label={t("form.recurring")} />
                    <Switch checked={form.refund} onChange={(v) => set({ refund: v })} label={t("form.refund")} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </Sheet>
  );
}

function ReceiptZone({
  receipt,
  reading,
  existingUrl,
  keep,
  onPick,
  onCamera,
  onDrop,
  onRemove,
}: {
  receipt: PreparedReceipt | null;
  reading: boolean;
  existingUrl: string;
  keep?: { checked: boolean; onChange: (v: boolean) => void };
  onPick: () => void;
  onCamera: () => void;
  onDrop: (f: File) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const [over, setOver] = useState(false);

  if (receipt) {
    return (
      <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-gold/25 bg-gold-soft/50 p-3">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-surface-2">
          {receipt.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={receipt.previewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center text-gold">
              <FileText className="h-7 w-7" />
            </div>
          )}
          {reading && <div className="shimmer absolute inset-0" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{receipt.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
            {reading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin text-gold" /> {t("form.receipt.reading")}
              </>
            ) : (
              `${(receipt.blob.size / 1024).toFixed(0)} KB`
            )}
          </p>
          {keep && (
            <div className="mt-2">
              <Switch checked={keep.checked} onChange={keep.onChange} label={t("form.receipt.keep")} />
            </div>
          )}
        </div>
        <button type="button" onClick={onRemove} className="rounded-lg p-2 text-ink-3 hover:bg-white/5 hover:text-ink" aria-label={t("form.receipt.remove")}>
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const file = receiptFromTransfer(e.dataTransfer);
        if (file) onDrop(file);
      }}
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-4 text-center transition-colors sm:flex-row sm:text-left",
        over ? "border-gold bg-gold-soft" : "border-line-strong bg-surface-2/40",
      )}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
        <Sparkles className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{t("form.receipt.drop")}</p>
        <p className="text-xs text-ink-3">{t("form.receipt.hint")}</p>
      </div>
      <div className="flex gap-2">
        {existingUrl && (
          <a href={existingUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-ink-2 hover:bg-white/5">
            <ExternalLink className="h-3.5 w-3.5" /> {t("form.receipt.view")}
          </a>
        )}
        <Button size="sm" variant="secondary" onClick={onCamera} className="sm:hidden">
          <Camera className="h-4 w-4" /> {t("form.receipt.camera")}
        </Button>
        <Button size="sm" variant="outline" onClick={onPick}>
          <Paperclip className="h-4 w-4" /> {t("form.receipt.attach")}
        </Button>
      </div>
    </div>
  );
}

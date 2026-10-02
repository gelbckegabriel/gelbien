"use client";

import { Receipt, Repeat, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useDataset, useMutate, useSaving } from "@/lib/data/hooks";
import { monthlyCost } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { CYCLES, SUB_KINDS, SUB_STATUSES, WORTH_IT, type Cycle, type Dataset, type SubKind, type SubStatus, type Subscription, type WorthIt } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { parseAmount, round2, uid } from "@/lib/utils";
import { CategorySelect, PaymentSelect, SubcategorySelect } from "./pickers";
import { Button } from "./ui/button";
import { Field, Input, MoneyInput, Segmented, Select, Textarea } from "./ui/form";
import { Sheet } from "./ui/sheet";

export function SubscriptionDialog() {
  const state = useUi((s) => s.subscription);
  const close = useUi((s) => s.closeSubscription);
  const { data } = useDataset();
  if (!data) return null;
  return <SubscriptionForm key={state.nonce} ds={data} open={state.open} editing={state.editing} onClose={close} />;
}

function SubscriptionForm({ ds, open, editing, onClose }: { ds: Dataset; open: boolean; editing: Subscription | null; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const shown = ds.categories.filter((c) => !c.archived);
  // a new subscription starts in the Subscriptions category; a new bill in the first one (housing, by default)
  const defaultCategory = (kind: SubKind) => (kind === "subscription" ? shown.find((c) => c.icon === "Repeat") : undefined)?.name ?? shown[0]?.name ?? "";
  const categoryPicked = useRef(!!editing);
  const [s, setS] = useState<Subscription>(
    () =>
      editing ?? {
        id: uid("sub"),
        name: "",
        category: defaultCategory("bill"),
        amount: 0,
        cycle: "monthly",
        billingDay: null,
        payment: ds.settings.paymentMethods[0] ?? "",
        status: "active",
        trialEnd: "",
        worthIt: "yes",
        notes: "",
        nextCharge: "",
        kind: "bill",
        subcategory: "",
      },
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const set = (patch: Partial<Subscription>) => setS((cur) => ({ ...cur, ...patch }));
  const value = parseAmount(amount);
  const isSub = s.kind === "subscription";
  const currentCat = ds.categories.find((c) => c.name === s.category);
  const setKind = (kind: SubKind) =>
    set({
      kind,
      // free trials only exist for subscriptions
      ...(kind === "bill" && s.status === "trial" ? { status: "active" as const } : {}),
      ...(categoryPicked.current ? {} : { category: defaultCategory(kind), subcategory: "" }),
    });

  const save = async () => {
    if (!s.name.trim() || !value || saving) return;
    const sub = { ...s, name: s.name.trim(), amount: round2(value), trialEnd: isSub && s.status === "trial" ? s.trialEnd : "" };
    if (!(await run(() => mutate.save({ op: "upsertSubscription", sub })))) return;
    toast.success(t("budget.subs.saved"));
    onClose();
  };

  const remove = () => {
    if (!editing) return;
    mutate.mutate({ op: "deleteSubscription", id: editing.id });
    toast(t("budget.subs.deleted"), { action: { label: t("common.undo"), onClick: () => mutate.mutate({ op: "upsertSubscription", sub: editing }) } });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={editing ? t("budget.subs.edit") : t("budget.subs.new")}
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="danger" size="icon" onClick={remove} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={save} disabled={!s.name.trim() || !value || saving} className="px-8">
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Segmented
          value={s.kind}
          onChange={setKind}
          className="sm:col-span-2"
          options={SUB_KINDS.map((k) => ({
            value: k,
            label: (
              <span className="inline-flex items-center gap-1.5">
                {k === "bill" ? <Receipt className="h-4 w-4" /> : <Repeat className="h-4 w-4" />} {t(`budget.subs.kind.${k}`)}
              </span>
            ),
          }))}
        />
        <Field label={t("budget.subs.name")} className="sm:col-span-2">
          <Input value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder={t(`budget.subs.namePh.${s.kind}`)} data-autofocus maxLength={120} />
        </Field>
        <Field label={t("budget.subs.amount")} hint={value ? `${f.money(monthlyCost({ amount: value, cycle: s.cycle }))} / ${t("cycle.monthly").toLowerCase()}` : undefined}>
          <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" />
        </Field>
        <Field label={t("budget.subs.cycle")}>
          <Select value={s.cycle} onChange={(e) => set({ cycle: e.target.value as Cycle })}>
            {CYCLES.map((c) => (
              <option key={c} value={c}>
                {t(`cycle.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("form.category")}>
          <CategorySelect
            value={s.category}
            onChange={(category) => {
              categoryPicked.current = true;
              set({ category, subcategory: "" });
            }}
            categories={ds.categories.filter((c) => !c.archived || c.name === s.category)}
            placeholder={t("split.pickCategory")}
            aria-label={t("form.category")}
          />
        </Field>
        {/* logged with every charge marked paid */}
        {currentCat && currentCat.subcategories.length > 0 && (
          <Field label={t("form.subcategory")} hint={t("common.optional")}>
            <SubcategorySelect
              value={s.subcategory}
              onChange={(subcategory) => set({ subcategory })}
              category={currentCat}
              anyLabel={t("split.noSub")}
              placeholder={t("split.anySub")}
              aria-label={t("form.subcategory")}
            />
          </Field>
        )}
        {/* Monthly bills repeat on a day of the month; longer (or weekly) cycles need one known charge date */}
        {s.cycle === "monthly" ? (
          <Field label={t("budget.subs.day")}>
            <Input
              type="number"
              min={1}
              max={31}
              inputMode="numeric"
              value={s.billingDay ?? ""}
              onChange={(e) => {
                const n = Number(e.target.value);
                set({ billingDay: n >= 1 && n <= 31 ? Math.round(n) : null });
              }}
            />
          </Field>
        ) : (
          <Field label={t("budget.subs.nextCharge")} hint={t("budget.subs.nextChargeHint")}>
            <Input type="date" value={s.nextCharge} onChange={(e) => set({ nextCharge: e.target.value })} />
          </Field>
        )}
        <Field label={t("form.payment")}>
          <PaymentSelect
            value={s.payment}
            onChange={(payment) => set({ payment })}
            methods={[...new Set([...ds.settings.paymentMethods, s.payment].filter(Boolean))]}
            styles={ds.settings.paymentStyles}
            placeholder={t("form.payment")}
            aria-label={t("form.payment")}
          />
        </Field>
        <Field label={t("budget.subs.status")}>
          <Select value={s.status} onChange={(e) => set({ status: e.target.value as SubStatus })}>
            {SUB_STATUSES.filter((st) => isSub || st !== "trial").map((st) => (
              <option key={st} value={st}>
                {t(`status.${st}`)}
              </option>
            ))}
          </Select>
        </Field>
        {isSub && s.status === "trial" && (
          <Field label={t("budget.subs.trialEnd")}>
            <Input type="date" value={s.trialEnd} onChange={(e) => set({ trialEnd: e.target.value })} />
          </Field>
        )}
        {/* the "is it worth keeping?" check is for subscriptions, not rent */}
        {isSub && (
          <Field label={t("budget.subs.worth")} className="sm:col-span-2">
            <Segmented
              value={s.worthIt}
              onChange={(v: WorthIt) => set({ worthIt: v })}
              options={WORTH_IT.map((w) => ({ value: w, label: t(`worth.${w}`), tone: w === "yes" ? "good" : w === "maybe" ? "warn" : "bad" }))}
            />
          </Field>
        )}
        <Field label={t("budget.subs.notes")} className="sm:col-span-2">
          <Textarea value={s.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} />
        </Field>
      </div>
    </Sheet>
  );
}

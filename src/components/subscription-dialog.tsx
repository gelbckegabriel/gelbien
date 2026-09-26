"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useDataset, useMutate } from "@/lib/data/hooks";
import { monthlyCost } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { CYCLES, SUB_STATUSES, WORTH_IT, type Cycle, type Dataset, type SubStatus, type Subscription, type WorthIt } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { parseAmount, round2, uid } from "@/lib/utils";
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
  const subsCategory = ds.categories.find((c) => c.icon === "Repeat")?.name ?? ds.categories[0]?.name ?? "";
  const [s, setS] = useState<Subscription>(
    () =>
      editing ?? {
        id: uid("sub"),
        name: "",
        category: subsCategory,
        amount: 0,
        cycle: "monthly",
        billingDay: null,
        payment: ds.settings.paymentMethods[0] ?? "",
        status: "active",
        trialEnd: "",
        worthIt: "yes",
        notes: "",
      },
  );
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const set = (patch: Partial<Subscription>) => setS((cur) => ({ ...cur, ...patch }));
  const value = parseAmount(amount);

  const save = () => {
    if (!s.name.trim() || !value) return;
    const sub = { ...s, name: s.name.trim(), amount: round2(value), trialEnd: s.status === "trial" ? s.trialEnd : "" };
    mutate.mutate({ op: "upsertSubscription", sub });
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
      onOpenChange={(o) => !o && onClose()}
      title={editing ? t("budget.subs.edit") : t("budget.subs.add")}
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <Button variant="danger" size="icon" onClick={remove} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={save} disabled={!s.name.trim() || !value} className="px-8">
            {t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("budget.subs.name")} className="sm:col-span-2">
          <Input value={s.name} onChange={(e) => set({ name: e.target.value })} placeholder="Netflix, Spotify, iCloud…" data-autofocus maxLength={120} />
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
          <Select value={s.category} onChange={(e) => set({ category: e.target.value })}>
            {ds.categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
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
        <Field label={t("form.payment")}>
          <Select value={s.payment} onChange={(e) => set({ payment: e.target.value })}>
            {[...new Set([...ds.settings.paymentMethods, s.payment].filter(Boolean))].map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("budget.subs.status")}>
          <Select value={s.status} onChange={(e) => set({ status: e.target.value as SubStatus })}>
            {SUB_STATUSES.map((st) => (
              <option key={st} value={st}>
                {t(`status.${st}`)}
              </option>
            ))}
          </Select>
        </Field>
        {s.status === "trial" && (
          <Field label={t("budget.subs.trialEnd")}>
            <Input type="date" value={s.trialEnd} onChange={(e) => set({ trialEnd: e.target.value })} />
          </Field>
        )}
        <Field label={t("budget.subs.worth")} className="sm:col-span-2">
          <Segmented
            value={s.worthIt}
            onChange={(v: WorthIt) => set({ worthIt: v })}
            options={WORTH_IT.map((w) => ({ value: w, label: t(`worth.${w}`), tone: w === "yes" ? "good" : w === "maybe" ? "warn" : "bad" }))}
          />
        </Field>
        <Field label={t("budget.subs.notes")} className="sm:col-span-2">
          <Textarea value={s.notes} onChange={(e) => set({ notes: e.target.value })} maxLength={500} />
        </Field>
      </div>
    </Sheet>
  );
}

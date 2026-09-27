"use client";

import { Check, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutate, useSaving } from "@/lib/data/hooks";
import { CATEGORY_COLORS, GOAL_ICONS, INSTITUTIONS } from "@/lib/defaults";
import { recentAverages } from "@/lib/finance";
import { accountsMonthlyGrowth, latestBalances, netWorth, signedBalance } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import { ACCOUNT_TYPES, type Account, type AccountType, type BalanceSnapshot, type Dataset, type Goal, type GoalStatus } from "@/lib/types";
import { cn, currentMonth, isValidISODate, parseAmount, round2, todayISO, uid } from "@/lib/utils";
import { ACCOUNT_TYPE_ICON, CategoryIcon, ICONS } from "../icons";
import { Button } from "../ui/button";
import { Field, Input, MoneyInput, Segmented, Select, Switch, Textarea } from "../ui/form";
import { Sheet } from "../ui/sheet";

const str = (n: number) => (n ? String(round2(n)) : "");

function ColorSwatches({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {CATEGORY_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn("h-7 w-7 rounded-full transition hover:scale-110", value === c && "ring-2 ring-white ring-offset-2 ring-offset-[#141418]")}
          style={{ background: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Goal
// ---------------------------------------------------------------------------

export function GoalDialog({ ds, open, goal, onClose }: { ds: Dataset; open: boolean; goal: Goal | null; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const [name, setName] = useState(goal?.name ?? "");
  const [icon, setIcon] = useState(goal?.icon ?? "Target");
  const [color, setColor] = useState(goal?.color ?? CATEGORY_COLORS[ds.goals.length % 8]);
  const [target, setTarget] = useState(str(goal?.target ?? 0));
  const [targetMonth, setTargetMonth] = useState(goal?.targetDate ? goal.targetDate.slice(0, 7) : "");
  const [funding, setFunding] = useState<"linked" | "manual">(goal && !goal.accountIds.length ? "manual" : ds.accounts.some((a) => a.type !== "credit" && !a.archived) ? "linked" : "manual");
  const [accountIds, setAccountIds] = useState<string[]>(goal?.accountIds ?? []);
  const [saved, setSaved] = useState(str(goal?.saved ?? 0));
  const [monthly, setMonthly] = useState(str(goal?.monthlyContribution ?? 0));
  const [annualReturn, setAnnualReturn] = useState(String(goal?.annualReturn ?? 0));
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? "active");
  const [notes, setNotes] = useState(goal?.notes ?? "");

  const eligible = ds.accounts.filter((a) => a.type !== "credit" && (!a.archived || accountIds.includes(a.id)));
  const usedBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of ds.goals) if (g.id !== goal?.id) for (const id of g.accountIds) m.set(id, g.name);
    return m;
  }, [ds.goals, goal?.id]);
  const growth = funding === "linked" ? accountsMonthlyGrowth(ds, accountIds) : null;
  const avgSaved = Math.max(0, recentAverages(ds, currentMonth()).saved);
  const valid = name.trim() && parseAmount(target) > 0 && (funding === "manual" || accountIds.length > 0);

  const save = async () => {
    if (!valid || saving) return;
    const next: Goal = {
      id: goal?.id ?? uid("goal"),
      name: name.trim(),
      icon,
      color,
      target: round2(parseAmount(target)),
      targetDate: targetMonth ? `${targetMonth}-01` : "",
      accountIds: funding === "linked" ? accountIds : [],
      saved: funding === "manual" ? round2(parseAmount(saved)) : 0,
      monthlyContribution: round2(Math.max(0, parseAmount(monthly))),
      annualReturn: Math.min(50, Math.max(-50, parseAmount(annualReturn))),
      status,
      order: goal?.order ?? ds.goals.length,
      notes: notes.trim(),
      createdAt: goal?.createdAt || new Date().toISOString(),
    };
    if (!(await run(() => mutate.save({ op: "upsertGoal", goal: next })))) return;
    toast.success(t("goals.saved"));
    onClose();
  };

  const remove = () => {
    if (!goal || !window.confirm(t("goals.f.deleteConfirm"))) return;
    const removed = goal;
    mutate.mutate({ op: "deleteGoal", id: removed.id });
    toast(t("goals.deleted"), { action: { label: t("common.undo"), onClick: () => mutate.mutate({ op: "upsertGoal", goal: removed }) } });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={goal ? t("goals.edit") : t("goals.new")}
      wide
      footer={
        <div className="flex items-center gap-2">
          {goal && (
            <Button variant="danger" size="icon" onClick={remove} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" className="px-8" onClick={save} disabled={!valid || saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label={t("goals.f.name")}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("goals.f.namePh")} data-autofocus={goal ? undefined : ""} maxLength={80} />
          </Field>
          <Field label={t("goals.f.status")}>
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: "active" as GoalStatus, label: t("status.active") },
                { value: "paused" as GoalStatus, label: t("goals.status.paused") },
                { value: "achieved" as GoalStatus, label: t("goals.status.achieved") },
              ]}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("goals.f.icon")}>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_ICONS.map((name) => {
                const Icon = ICONS[name];
                const active = icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setIcon(name)}
                    className={cn("grid h-9 w-9 place-items-center rounded-xl border transition", active ? "border-transparent" : "border-line text-ink-3 hover:text-ink")}
                    style={active ? { background: `${color}26`, color, boxShadow: `inset 0 0 0 1.5px ${color}` } : undefined}
                    aria-label={name}
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label={t("cfg.color")}>
            <ColorSwatches value={color} onChange={setColor} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("goals.f.target")}>
            <MoneyInput value={target} onChange={setTarget} placeholder="0.00" className="text-lg font-semibold" />
          </Field>
          <Field label={t("goals.f.targetDate")} hint={t("goals.f.optional")}>
            <Input type="month" value={targetMonth} min={currentMonth()} onChange={(e) => setTargetMonth(e.target.value)} />
          </Field>
        </div>

        <Field label={t("goals.f.funding")}>
          <Segmented
            value={funding}
            onChange={setFunding}
            options={[
              { value: "linked" as const, label: t("goals.f.linked") },
              { value: "manual" as const, label: t("goals.f.manual") },
            ]}
          />
        </Field>
        {funding === "linked" ? (
          eligible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-3 py-3 text-sm text-ink-3">{t("goals.f.noAccounts")}</p>
          ) : (
            <div>
              <div className="grid gap-2 sm:grid-cols-2">
                {eligible.map((a) => {
                  const on = accountIds.includes(a.id);
                  const taken = usedBy.get(a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      disabled={!!taken && !on}
                      onClick={() => setAccountIds((ids) => (on ? ids.filter((x) => x !== a.id) : [...ids, a.id]))}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                        on ? "border-gold/50 bg-gold-soft" : "border-line bg-surface-2/60 hover:border-line-strong",
                      )}
                    >
                      <CategoryIcon icon={ACCOUNT_TYPE_ICON[a.type]} color={a.color} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-ink">{a.name}</span>
                        <span className="block truncate text-[11px] text-ink-3">{taken && !on ? t("goals.f.usedBy", { goal: taken }) : a.institution}</span>
                      </span>
                      {on && <Check className="h-4 w-4 text-gold" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-ink-3">{t("goals.f.accountsHint")}</p>
            </div>
          )
        ) : (
          <Field label={t("goals.f.saved")}>
            <MoneyInput value={saved} onChange={setSaved} placeholder="0.00" />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("goals.f.monthly")}>
            <MoneyInput value={monthly} onChange={setMonthly} placeholder="0.00" />
            <p className="mt-1.5 space-x-2 text-xs text-ink-3">
              {growth !== null && (
                <button type="button" className="text-gold hover:underline" onClick={() => setMonthly(str(Math.max(0, Math.round(growth))))}>
                  {t("goals.f.growthHint", { amount: f.money0(growth) })}
                </button>
              )}
              {avgSaved > 0 && <span>{t("goals.f.avgHint", { amount: f.money0(avgSaved) })}</span>}
            </p>
          </Field>
          <Field label={t("goals.f.return")}>
            {/* Phones: the % field gets its own row so the presets aren't squeezed into narrow pills */}
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <div className="relative col-span-3 sm:w-24 sm:shrink-0">
                <Input inputMode="decimal" value={annualReturn} onChange={(e) => setAnnualReturn(e.target.value.replace(/[^\d.,-]/g, ""))} className="pr-7 text-right" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-3">%</span>
              </div>
              {[
                { v: 0, label: t("goals.f.preset.cash") },
                { v: 3, label: t("goals.f.preset.hisa") },
                { v: 5, label: t("goals.f.preset.invest") },
              ].map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => setAnnualReturn(String(p.v))}
                  className={cn(
                    "min-h-11 flex-1 rounded-xl border px-2 py-1.5 text-xs transition-colors",
                    parseAmount(annualReturn) === p.v ? "border-gold/50 bg-gold-soft text-gold-bright" : "border-line text-ink-3 hover:text-ink",
                  )}
                >
                  {p.label}
                  <span className="block tabular">{p.v}%</span>
                </button>
              ))}
            </div>
          </Field>
        </div>

        <Field label={t("goals.f.notes")}>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} className="min-h-16" />
        </Field>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Add money (goals tracked by hand)
// ---------------------------------------------------------------------------

export function AddMoneyDialog({ open, goal, onClose }: { open: boolean; goal: Goal | null; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const [amount, setAmount] = useState("");
  const value = parseAmount(amount);
  if (!goal) return null;
  const save = async () => {
    if (!value || saving) return;
    if (!(await run(() => mutate.save({ op: "upsertGoal", goal: { ...goal, saved: round2(goal.saved + value) } })))) return;
    toast.success(`${goal.name}: ${f.money0(goal.saved + value)}`);
    onClose();
  };
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={t("goals.addMoneyTitle", { name: goal.name })}
      description={t("goals.addMoneyHint")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" onClick={save} disabled={!value || saving} className="px-8">
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }
    >
      <MoneyInput value={amount} onChange={setAmount} placeholder="0.00" data-autofocus className="h-14 text-2xl font-semibold" />
      <p className="mt-2 text-sm text-ink-3">
        {f.money0(goal.saved)} → <span className="text-ink">{f.money0(goal.saved + value)}</span> {t("goals.of", { target: f.money0(goal.target) })}
      </p>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

export function AccountDialog({ ds, open, account, onClose }: { ds: Dataset; open: boolean; account: Account | null; onClose: () => void }) {
  const { t } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const last = account ? latestBalances(ds.balances).get(account.id) : undefined;
  const [name, setName] = useState(account?.name ?? "");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [type, setType] = useState<AccountType>(account?.type ?? "savings");
  const [color, setColor] = useState(account?.color ?? CATEGORY_COLORS[(ds.accounts.length + 2) % 8]);
  const [balance, setBalance] = useState(last ? String(last.balance) : "");
  const [archived, setArchived] = useState(account?.archived ?? false);
  const [notes, setNotes] = useState(account?.notes ?? "");
  const valid = name.trim().length > 0;

  const save = async () => {
    if (!valid || saving) return;
    const next: Account = {
      id: account?.id ?? uid("acc"),
      name: name.trim(),
      institution: institution.trim(),
      type,
      color,
      archived,
      notes: notes.trim(),
    };
    const writes = [mutate.save({ op: "upsertAccount", account: next })];
    const value = round2(parseAmount(balance));
    const closing = archived && !account?.archived;
    // A closed account drops to zero so it stops counting toward net worth from now on.
    if (closing) writes.push(mutate.save({ op: "saveBalances", balances: [{ accountId: next.id, date: todayISO(), balance: 0 }] }));
    else if (balance.trim() !== "" && (!last || last.balance !== value)) {
      writes.push(mutate.save({ op: "saveBalances", balances: [{ accountId: next.id, date: todayISO(), balance: value }] }));
    }
    if (!(await run(() => Promise.all(writes)))) return;
    toast.success(t("acc.saved"));
    onClose();
  };

  const remove = () => {
    if (!account || !window.confirm(t("acc.deleteConfirm"))) return;
    mutate.mutate({ op: "deleteAccount", id: account.id });
    toast(t("acc.deleted"));
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={account ? t("acc.edit") : t("acc.add")}
      footer={
        <div className="flex items-center gap-2">
          {account && (
            <Button variant="danger" size="icon" onClick={remove} aria-label={t("common.delete")}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" className="px-8" onClick={save} disabled={!valid || saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
        </div>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("acc.name")}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("acc.namePh")} data-autofocus={account ? undefined : ""} maxLength={80} />
        </Field>
        <Field label={t("acc.institution")}>
          <Input list="gelbien-institutions" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Neo Financial" maxLength={80} />
          <datalist id="gelbien-institutions">
            {INSTITUTIONS.map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
        </Field>
        <Field label={t("acc.type")}>
          <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((ty) => (
              <option key={ty} value={ty}>
                {t(`acc.type.${ty}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={type === "credit" ? t("acc.owed") : t("acc.balance")}>
          <MoneyInput value={balance} onChange={setBalance} placeholder="0.00" className={cn(type === "credit" && "text-bad")} />
        </Field>
        <Field label={t("cfg.color")} className="sm:col-span-2">
          <ColorSwatches value={color} onChange={setColor} />
        </Field>
        <Field label={t("goals.f.notes")} className="sm:col-span-2">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} className="min-h-16" />
        </Field>
        {account && (
          <div className="sm:col-span-2">
            <Switch checked={archived} onChange={setArchived} label={t("acc.archived")} />
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Monthly check-in
// ---------------------------------------------------------------------------

export function CheckInDialog({ ds, open, onClose }: { ds: Dataset; open: boolean; onClose: () => void }) {
  const { t, f } = useI18n();
  const mutate = useMutate();
  const [saving, run] = useSaving();
  const active = ds.accounts.filter((a) => !a.archived);
  const latest = latestBalances(ds.balances);
  const [date, setDate] = useState(todayISO());
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(active.map((a) => [a.id, latest.has(a.id) ? String(latest.get(a.id)!.balance) : ""])),
  );

  const draft: BalanceSnapshot[] = active
    .filter((a) => values[a.id]?.trim())
    .map((a) => ({ accountId: a.id, date, balance: round2(parseAmount(values[a.id])) }));
  const before = netWorth(ds).total;
  const after = netWorth({ accounts: ds.accounts, balances: [...ds.balances.filter((b) => b.date !== date || !draft.some((d) => d.accountId === b.accountId)), ...draft] }, date).total;

  const save = async () => {
    if (!draft.length || !isValidISODate(date) || saving) return;
    if (!(await run(() => mutate.save({ op: "saveBalances", balances: draft })))) return;
    toast.success(t("ci.saved"), { description: `${t("nw.total")}: ${f.money0(after)}` });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => !o && !saving && onClose()}
      title={t("ci.title")}
      description={t("ci.subtitle")}
      wide
      footer={
        <div className="flex flex-wrap items-center gap-3">
          <div className="text-sm">
            <span className="text-ink-3">{t("ci.preview")}: </span>
            <span className={cn("tabular font-semibold", after < 0 ? "text-bad" : "text-ink")}>{f.money0(after)}</span>{" "}
            <span className={cn("tabular text-xs", after >= before ? "text-good" : "text-bad")}>
              ({after >= before ? "+" : "−"}
              {f.money0(Math.abs(after - before))})
            </span>
          </div>
          <Button variant="ghost" className="ml-auto" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" className="px-8" onClick={save} disabled={!draft.length || saving}>
            {saving ? t("common.saving") : t("ci.save")}
          </Button>
        </div>
      }
    >
      <div className="mb-4 max-w-48">
        <Field label={t("ci.date")}>
          <Input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
      <ul className="grid gap-x-8 gap-y-1 md:grid-cols-2">
        {active.map((a) => {
          const prev = latest.get(a.id);
          return (
            <li key={a.id} className="flex items-center gap-3 border-b border-line/50 py-3">
              <CategoryIcon icon={ACCOUNT_TYPE_ICON[a.type]} color={a.color} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">{a.name}</p>
                <p className="truncate text-[11px] text-ink-3">
                  {prev ? t("ci.lastValue", { amount: f.money0(signedBalance(a, prev.balance)), date: f.dateShort(prev.date) }) : a.institution}
                </p>
              </div>
              <div className="w-32 shrink-0">
                <MoneyInput
                  value={values[a.id] ?? ""}
                  onChange={(v) => setValues((cur) => ({ ...cur, [a.id]: v }))}
                  placeholder="0.00"
                  aria-label={a.name}
                  className={cn("h-10 text-right", a.type === "credit" && "text-bad")}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

/**
 * Brings a dataset saved by an older version up to the current shape. Data reaches the app from
 * places a deploy doesn't update — this browser's cached copy of the sheet, the demo copy — so
 * every field added since must get a value before any code reads it.
 *
 * RECORD has every field of every record, with the value it takes when missing. It's typed against
 * the interfaces in types.ts, so a new field doesn't compile until it's given one here.
 */
import type { PersistedClient } from "@tanstack/react-query-persist-client";
import { defaultSettings, guessKind } from "../defaults";
import type { Dataset } from "../types";

type Collection = { [K in keyof Dataset]: Dataset[K] extends readonly unknown[] ? K : never }[keyof Dataset];
type Records = { [K in Collection]: Dataset[K][number] };

export const RECORD: Records = {
  transactions: {
    id: "", date: "", category: "", subcategory: "", description: "", amount: 0, payment: "", type: "variable", priority: "important",
    merchant: "", recurring: false, notes: "", receiptUrl: "", createdAt: "", updatedAt: "", group: "", billId: "",
  },
  categories: { name: "", color: "#6b6a72", icon: "Package", order: 0, subcategories: [], archived: false },
  budgets: { month: "default", category: "", amount: 0 },
  incomes: { month: "default", gross: 0, net: 0, note: "" },
  subscriptions: {
    id: "", name: "", category: "", amount: 0, cycle: "monthly", billingDay: null, payment: "", status: "active", trialEnd: "", worthIt: "maybe",
    notes: "", nextCharge: "", kind: "bill", subcategory: "", merchant: "",
  },
  accounts: { id: "", name: "", institution: "", type: "other", color: "#6b6a72", archived: false, notes: "" },
  balances: { accountId: "", date: "", balance: 0 },
  goals: {
    id: "", name: "", icon: "Target", color: "#d9b45f", target: 0, targetDate: "", accountIds: [], saved: 0, monthlyContribution: 0,
    annualReturn: 0, status: "active", order: 0, notes: "", createdAt: "", startMonth: "", afterGoalId: "", pausedMonths: [],
  },
};

const COLLECTIONS = Object.keys(RECORD) as Collection[];

/** `value` with the fields it's missing taken from `defaults` — the same object when it has them all. */
function fill<T extends object>(defaults: T, value: Partial<T>): T {
  let out: T | null = null;
  for (const k in defaults) {
    if (value[k] !== undefined) continue;
    out ??= { ...value } as T;
    const d = defaults[k];
    out[k] = (Array.isArray(d) ? [...d] : d) as T[typeof k];
  }
  return out ?? (value as T);
}

export function upgradeDataset(stored: Dataset): Dataset {
  const ds = stored as Partial<Dataset>;
  const out = { ...stored };
  // records from before bills and subscriptions were told apart: guessed from the category
  const subs = (ds.subscriptions ?? []).map((s) => (s.kind ? s : { ...s, kind: guessKind(s.category ?? "") }));
  for (const k of COLLECTIONS) {
    const list = (k === "subscriptions" ? subs : (ds[k] ?? [])) as Partial<Records[typeof k]>[];
    (out as Record<Collection, unknown[]>)[k] = list.map((r) => fill(RECORD[k], r));
  }
  out.settings = fill(defaultSettings(ds.settings?.locale ?? "en"), ds.settings ?? {});
  return out;
}

/** This browser's cached copy of the sheet (see providers.tsx), saved by whichever version ran last, brought up to this one's shape. */
export function restoreCache(cached: string): PersistedClient {
  const client = JSON.parse(cached) as PersistedClient;
  for (const q of client.clientState.queries) {
    if (q.queryKey[0] === "dataset" && q.state.data) q.state.data = upgradeDataset(q.state.data as Dataset);
  }
  return client;
}

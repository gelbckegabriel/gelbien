"use client";

import { guessKind } from "../defaults";
import { buildDemoDataset } from "../demo";
import type { Dataset, Locale, Mutation, SessionInfo } from "../types";
import { applyMutationToDataset } from "./reducer";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error || res.statusText, body.code);
  return body as T;
}

export async function fetchSession(): Promise<SessionInfo> {
  return json(await fetch("/api/auth/session", { cache: "no-store" }));
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

export interface DataSource {
  load(): Promise<Dataset>;
  apply(m: Mutation): Promise<{ syncedAt: string }>;
}

export function googleSource(locale: Locale): DataSource {
  return {
    load: async () => normalizeDataset(await json<Dataset>(await fetch(`/api/data?locale=${locale}`, { cache: "no-store" }))),
    apply: async (m) =>
      json<{ syncedAt: string }>(
        await fetch(`/api/data?locale=${locale}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-gelbien": "1" },
          body: JSON.stringify(m),
        }),
      ),
  };
}

const DEMO_KEY = "gelbien.demo.v1";
export const MODE_KEY = "gelbien.mode";

/** Fill in fields added after a dataset was stored (e.g. accounts/goals), so older copies keep working. */
export function normalizeDataset(ds: Dataset): Dataset {
  return {
    ...ds,
    transactions: ds.transactions.map((t) => ({ ...t, group: t.group ?? "", billId: t.billId ?? "" })),
    subscriptions: ds.subscriptions.map((s) => ({ ...s, nextCharge: s.nextCharge ?? "", kind: s.kind ?? guessKind(s.category), subcategory: s.subcategory ?? "", merchant: s.merchant ?? "" })),
    accounts: ds.accounts ?? [],
    balances: ds.balances ?? [],
    goals: ds.goals ?? [],
    settings: { ...ds.settings, checkInDay: ds.settings?.checkInDay ?? 1, paymentStyles: ds.settings?.paymentStyles ?? {} },
  };
}

export function readDemo(): Dataset | null {
  try {
    const raw = localStorage.getItem(DEMO_KEY);
    return raw ? normalizeDataset(JSON.parse(raw) as Dataset) : null;
  } catch {
    return null;
  }
}

function writeDemo(ds: Dataset) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify(ds));
  } catch {
    /* storage full or blocked — demo keeps working in memory */
  }
}

let memoryDemo: Dataset | null = null;

export function demoSource(locale: Locale): DataSource {
  const current = () => memoryDemo ?? readDemo() ?? buildDemoDataset(locale);
  return {
    load: async () => {
      const ds = current();
      memoryDemo = ds;
      writeDemo(ds);
      return ds;
    },
    apply: async (m) => {
      const syncedAt = new Date().toISOString();
      const next = applyMutationToDataset(current(), m);
      memoryDemo = { ...next, meta: { ...next.meta, syncedAt } };
      writeDemo(memoryDemo);
      return { syncedAt };
    },
  };
}

export function resetDemo(locale: Locale): Dataset {
  memoryDemo = buildDemoDataset(locale);
  writeDemo(memoryDemo);
  return memoryDemo;
}

export function clearDemo() {
  memoryDemo = null;
  try {
    localStorage.removeItem(DEMO_KEY);
  } catch {
    /* ignore */
  }
}

export async function uploadReceiptFile(file: Blob, name: string): Promise<{ id: string; url: string }> {
  const form = new FormData();
  form.set("file", file, name);
  form.set("name", name);
  return json(await fetch("/api/receipts", { method: "POST", headers: { "x-gelbien": "1" }, body: form }));
}

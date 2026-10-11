"use client";

import { buildDemoDataset, DEMO_VERSION } from "../demo";
import { todayISO } from "../utils";
import type { Dataset, Locale, Mutation, SessionInfo } from "../types";
import { applyMutationToDataset } from "./reducer";
import { upgradeDataset } from "./upgrade";

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
    load: async () => upgradeDataset(await json<Dataset>(await fetch(`/api/data?locale=${locale}`, { cache: "no-store" }))),
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

const DEMO_KEY = "gelbien.demo.v2";
const OLD_DEMO_KEYS = ["gelbien.demo.v1"];
export const MODE_KEY = "gelbien.mode";

/** The demo as kept in this browser: which version of it, the day it was built, and whether it's been changed since */
interface StoredDemo {
  version: number;
  builtOn: string;
  edited: boolean;
  data: Dataset;
}

/**
 * The demo is built for the day it's opened, so there's always this month's activity to look at. It's
 * built again when an older version of the demo made it, or on a later day — once played with, it's kept
 * a few days (anything changed in it would be lost).
 */
function stillFresh(d: StoredDemo, today = todayISO()): boolean {
  if (d.version !== DEMO_VERSION || !d.data) return false;
  if (!d.edited) return d.builtOn === today;
  return (Date.parse(today) - Date.parse(d.builtOn)) / 86400000 <= 3;
}

function readStored(): StoredDemo | null {
  try {
    for (const key of OLD_DEMO_KEYS) localStorage.removeItem(key);
    const raw = localStorage.getItem(DEMO_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as StoredDemo;
    return stillFresh(d) ? { ...d, data: upgradeDataset(d.data) } : null;
  } catch {
    return null;
  }
}

function writeDemo(data: Dataset, edited: boolean, builtOn: string) {
  try {
    localStorage.setItem(DEMO_KEY, JSON.stringify({ version: DEMO_VERSION, builtOn, edited, data } satisfies StoredDemo));
  } catch {
    /* storage full or blocked — demo keeps working in memory */
  }
}

let memoryDemo: StoredDemo | null = null;

function fresh(locale: Locale): StoredDemo {
  return { version: DEMO_VERSION, builtOn: todayISO(), edited: false, data: buildDemoDataset(locale) };
}

export function demoSource(locale: Locale): DataSource {
  const current = () => (memoryDemo && stillFresh(memoryDemo) ? memoryDemo : (readStored() ?? fresh(locale)));
  return {
    load: async () => {
      const d = current();
      memoryDemo = d;
      writeDemo(d.data, d.edited, d.builtOn);
      return d.data;
    },
    apply: async (m) => {
      const syncedAt = new Date().toISOString();
      const d = current();
      const next = applyMutationToDataset(d.data, m);
      memoryDemo = { ...d, edited: true, data: { ...next, meta: { ...next.meta, syncedAt } } };
      writeDemo(memoryDemo.data, true, memoryDemo.builtOn);
      return { syncedAt };
    },
  };
}

export function resetDemo(locale: Locale): Dataset {
  memoryDemo = fresh(locale);
  writeDemo(memoryDemo.data, false, memoryDemo.builtOn);
  return memoryDemo.data;
}

export function clearDemo() {
  memoryDemo = null;
  try {
    localStorage.removeItem(DEMO_KEY);
    for (const key of OLD_DEMO_KEYS) localStorage.removeItem(key);
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

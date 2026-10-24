"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n, usePrefs } from "../i18n";
import { linkedPaymentChanges, linkedPlanChanges } from "../plans";
import type { Dataset, Mutation, PrepayMode, SessionInfo } from "../types";
import { useUi } from "../ui-store";
import { errorReason } from "./errors";
import { applyMutationToDataset } from "./reducer";
import { ApiError, demoSource, fetchSession, googleSource } from "./sources";

export type AppMode = "loading" | "google" | "demo" | "signedOut";

// When this page load started: a session answer from before it (the cached copy) isn't confirmed yet
const LOADED_AT = Date.now();

/**
 * `recheck`: ask the server again on mount — the cookie may have changed behind our back (right after
 * the OAuth redirect, say). Only the app's shell and the login page do; everything else that reads the
 * data uses the answer they got. (It used to be every component: a page change mounts dozens of them,
 * so each tap went back to the server and the new page rendered a second time when the answer came.)
 * Coming back to the app re-checks too (refetch on window focus).
 */
export function useSession(recheck = false) {
  return useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 5 * 60_000, retry: 1, refetchOnMount: recheck ? "always" : false });
}

export function useMode(recheck = false): { mode: AppMode; session: SessionInfo | undefined } {
  const { data, dataUpdatedAt } = useSession(recheck);
  const demo = useUi((s) => s.demo);
  if (data?.user) return { mode: "google", session: data };
  if (demo) return { mode: "demo", session: data };
  // Never redirect to /login on a cached answer — wait for the server to confirm.
  if (dataUpdatedAt < LOADED_AT) return { mode: "loading", session: data };
  return { mode: "signedOut", session: data };
}

function useSource() {
  const { mode, session } = useMode();
  const locale = usePrefs((s) => s.locale);
  return useMemo(() => {
    const key = ["dataset", mode, session?.user?.sub ?? "local"] as const;
    const source = mode === "google" ? googleSource(locale) : mode === "demo" ? demoSource(locale) : null;
    return { key, source, mode };
  }, [mode, session?.user?.sub, locale]);
}

export function useDataset() {
  const { key, source, mode } = useSource();
  return useQuery<Dataset>({
    queryKey: key,
    queryFn: () => source!.load(),
    enabled: source !== null,
    // Retry what can clear up by itself (network, rate limits, Google down). Refusals won't: an
    // expired login goes to /login (see AppShell), a full Drive or a lost sheet shows why at once.
    retry: (count, err) => count < 1 && !(err instanceof ApiError && err.status >= 400 && err.status < 500 && err.status !== 429),
    staleTime: mode === "google" ? 60_000 : Infinity,
    refetchOnWindowFocus: mode === "google",
  });
}

export interface MutateOptions {
  /**
   * The save failed: hand the user's edits back (reopen the form, restore the draft).
   * Runs before the optimistic change is rolled back. May return a toast action, e.g. "Review".
   */
  onFailure?: () => { label: string; onClick: () => void } | void;
}

interface Vars extends MutateOptions {
  m: Mutation;
  /** The form stays on screen with the user's edits (onFailure, or a dialog awaiting save()). */
  kept?: boolean;
}

/**
 * Writes that go along with one (see linkedPlanChanges and linkedPaymentChanges: an extra payment's
 * expense deleted takes it off its loan; a loan corrected updates the payments logged at its old figure).
 * Worked out when the change is applied — against everything written before it — and sent right after it.
 */
const followUps = new WeakMap<Vars, Mutation[]>();
/** how removed extra payments affected their loan, so an undo puts them back as they were */
const removedModes = new Map<string, PrepayMode>();

let writes: Promise<unknown> = Promise.resolve();
/** Runs `fn` after every write queued before it has settled (succeeded or failed). */
function inOrder<T>(fn: () => Promise<T>): Promise<T> {
  const run = writes.then(fn, fn);
  writes = run.catch(() => undefined);
  return run;
}

export function useMutate() {
  const qc = useQueryClient();
  const { key, source, mode } = useSource();
  const { t } = useI18n();
  const { mutate, mutateAsync } = useMutation<{ syncedAt: string }, Error, Vars, { prev?: Dataset }>({
    // Writes go one at a time, in order, so row lookups in the sheet never race each other. Our own queue
    // rather than a mutation scope: a scoped write waiting its turn only resumes while the page has focus,
    // so a second write (an extra payment's expense after the loan) sat at "Saving…" in a background tab.
    mutationFn: (vars) =>
      inOrder(async () => {
        let res = await source!.apply(vars.m);
        for (const f of followUps.get(vars) ?? []) res = await source!.apply(f);
        return res;
      }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Dataset>(key);
      if (prev) {
        let next = applyMutationToDataset(prev, vars.m);
        // an extra payment's expense changed: its loan follows…
        const plans = linkedPlanChanges(prev, next, removedModes);
        for (const f of plans) next = applyMutationToDataset(next, f);
        // …and a loan changed (by the user or just above): its logged payments follow
        const payments = linkedPaymentChanges(prev, next, next.settings.currency);
        for (const f of payments) next = applyMutationToDataset(next, f);
        followUps.set(vars, [...plans, ...payments]);
        qc.setQueryData<Dataset>(key, next);
      }
      return { prev };
    },
    // Defined here rather than per mutate() call so it still runs after the calling form unmounts.
    onError: (err, { onFailure, kept }, ctx) => {
      const action = onFailure?.() ?? undefined;
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      if (err instanceof ApiError && err.status === 401) {
        toast.error(t("err.session"));
        qc.invalidateQueries({ queryKey: ["session"] });
        return;
      }
      const reason = errorReason(err, t);
      // The optimistic "Saved" / "Undo" toasts are now wrong — replace them with the explanation.
      toast.dismiss();
      // One toast per failure burst (a budget save can be two writes).
      toast.error(t("err.notSaved"), {
        id: "save-error",
        description: kept || onFailure ? `${reason} ${t("err.kept")}` : reason,
        duration: 12_000,
        action,
      });
    },
    onSuccess: (res) => {
      toast.dismiss("save-error"); // a retry went through
      qc.setQueryData<Dataset>(key, (ds) => (ds ? { ...ds, meta: { ...ds.meta, syncedAt: res.syncedAt } } : ds));
    },
    onSettled: () => {
      // Once the queue drains, re-read the sheet so we match any edits made in Google Sheets.
      if (mode === "google" && qc.isMutating({ mutationKey: undefined }) <= 1) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
  return useMemo(
    () => ({
      /** Apply now, sync in the background. On failure the change is rolled back and explained. */
      mutate: (m: Mutation, opts?: MutateOptions) => mutate({ m, ...opts }),
      /** For dialogs that stay open until the sheet confirms: rejects (after rollback + toast) on failure. */
      save: (m: Mutation) => mutateAsync({ m, kept: true }),
    }),
    [mutate, mutateAsync],
  );
}

/**
 * For dialogs that stay open until the sheet confirms the write. `run` resolves true once saved;
 * on failure it resolves false and the dialog keeps the user's input (the error toast says why).
 */
export function useSaving() {
  const [saving, setSaving] = useState(false);
  const run = async (write: () => Promise<unknown>) => {
    setSaving(true);
    try {
      await write();
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  };
  return [saving, run] as const;
}

export function useRefresh() {
  const qc = useQueryClient();
  const { key } = useSource();
  return () => qc.invalidateQueries({ queryKey: key });
}

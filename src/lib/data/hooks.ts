"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useI18n, usePrefs } from "../i18n";
import type { Dataset, Mutation, SessionInfo } from "../types";
import { useUi } from "../ui-store";
import { errorReason } from "./errors";
import { applyMutationToDataset } from "./reducer";
import { ApiError, demoSource, fetchSession, googleSource } from "./sources";

export type AppMode = "loading" | "google" | "demo" | "signedOut";

export function useSession() {
  // Always re-check on mount: the cookie may have changed behind our back (e.g. right after the OAuth redirect).
  return useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 5 * 60_000, retry: 1, refetchOnMount: "always" });
}

export function useMode(): { mode: AppMode; session: SessionInfo | undefined } {
  const { data, isFetchedAfterMount } = useSession();
  const demo = useUi((s) => s.demo);
  if (data?.user) return { mode: "google", session: data };
  if (demo) return { mode: "demo", session: data };
  // Never redirect to /login on a cached answer — wait for the server to confirm.
  if (!isFetchedAfterMount) return { mode: "loading", session: data };
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

export function useMutate() {
  const qc = useQueryClient();
  const { key, source, mode } = useSource();
  const { t } = useI18n();
  const { mutate, mutateAsync } = useMutation<{ syncedAt: string }, Error, Vars, { prev?: Dataset }>({
    // Serialize writes so row lookups in the sheet never race each other.
    scope: { id: "sheet-writes" },
    mutationFn: ({ m }) => source!.apply(m),
    onMutate: async ({ m }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Dataset>(key);
      if (prev) qc.setQueryData<Dataset>(key, applyMutationToDataset(prev, m));
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

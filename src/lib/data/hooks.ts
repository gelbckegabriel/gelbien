"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { useI18n, usePrefs } from "../i18n";
import type { Dataset, Mutation, SessionInfo } from "../types";
import { useUi } from "../ui-store";
import { applyMutationToDataset } from "./reducer";
import { ApiError, demoSource, fetchSession, googleSource } from "./sources";

export type AppMode = "loading" | "google" | "demo" | "signedOut";

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: fetchSession, staleTime: 5 * 60_000, retry: 1 });
}

export function useMode(): { mode: AppMode; session: SessionInfo | undefined } {
  const { data, isPending } = useSession();
  const demo = useUi((s) => s.demo);
  if (data?.user) return { mode: "google", session: data };
  if (demo) return { mode: "demo", session: data };
  if (isPending) return { mode: "loading", session: data };
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

export function useMutate() {
  const qc = useQueryClient();
  const { key, source, mode } = useSource();
  const { t } = useI18n();
  return useMutation({
    // Serialize writes so row lookups in the sheet never race each other.
    scope: { id: "sheet-writes" },
    mutationFn: (m: Mutation) => source!.apply(m),
    onMutate: async (m) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Dataset>(key);
      if (prev) qc.setQueryData<Dataset>(key, applyMutationToDataset(prev, m));
      return { prev };
    },
    onError: (err, _m, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      if (err instanceof ApiError && err.status === 401) {
        toast.error(t("err.session"));
        qc.invalidateQueries({ queryKey: ["session"] });
      } else {
        toast.error(t("err.save", { error: err.message }));
      }
    },
    onSuccess: (res) => {
      qc.setQueryData<Dataset>(key, (ds) => (ds ? { ...ds, meta: { ...ds.meta, syncedAt: res.syncedAt } } : ds));
    },
    onSettled: () => {
      // Once the queue drains, re-read the sheet so we match any edits made in Google Sheets.
      if (mode === "google" && qc.isMutating({ mutationKey: undefined }) <= 1) {
        qc.invalidateQueries({ queryKey: key });
      }
    },
  });
}

export function useRefresh() {
  const qc = useQueryClient();
  const { key } = useSource();
  return () => qc.invalidateQueries({ queryKey: key });
}

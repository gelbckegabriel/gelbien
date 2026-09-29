"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ExternalLink, LogOut, RefreshCw, Trash2, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { errorReason, reasonForCode } from "@/lib/data/errors";
import { useMode } from "@/lib/data/hooks";
import { ApiError, signOut } from "@/lib/data/sources";
import { useI18n } from "@/lib/i18n";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { CACHE_KEY } from "../providers";
import { Button, buttonClasses } from "../ui/button";
import { Card } from "../ui/card";
import { GuardedLink } from "./unsaved";

/** Forget what this browser keeps from the sheet: the cached data, AI insights and chats. The sheet itself is untouched. */
export function clearCachedData() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k === CACHE_KEY || k.startsWith("gelbien.insights.") || k.startsWith("gelbien.chat.")) localStorage.removeItem(k);
    }
  } catch {
    /* storage blocked: nothing cached either */
  }
}

/** Sign out and forget this browser's copy — works even when the data or the server can't be reached. */
export function useSignOut() {
  const { mode } = useMode();
  const qc = useQueryClient();
  const router = useRouter();
  const setDemo = useUi((s) => s.setDemo);
  return async () => {
    if (mode === "google") await signOut().catch(() => undefined);
    setDemo(false);
    clearCachedData();
    qc.clear();
    router.replace("/login");
  };
}

/**
 * Shown when the data can't be loaded: why, in plain words, and every way out — retry, open the
 * spreadsheet, clear this browser's copy, the profile page, sign out — plus the raw error for support.
 */
export function LoadError({ error, onRetry, className }: { error: unknown; onRetry: () => void; className?: string }) {
  const { t } = useI18n();
  const { session } = useMode();
  const qc = useQueryClient();
  const pathname = usePathname();
  const leave = useSignOut();
  const detail = error instanceof ApiError ? [error.status, error.code, error.message].filter(Boolean).join(" · ") : ((error as Error)?.message ?? String(error));

  const clearAndRetry = () => {
    clearCachedData();
    // starts the load over from nothing (no cached copy to fall back on)
    void qc.resetQueries({ queryKey: ["dataset"] });
    toast.success(t("prof.cache.cleared"));
  };

  return (
    <Card className={cn("mx-auto max-w-2xl", className)}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bad/10 text-bad">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-ink">{t("err.load")}</h2>
          <p className="mt-1 text-sm text-ink-2">{errorReason(error, t)}</p>
          <p className="mt-1.5 text-xs text-ink-3">{t("err.safe")}</p>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" onClick={onRetry}>
          <RefreshCw className="h-4 w-4" /> {t("common.retry")}
        </Button>
        {session?.spreadsheetUrl && (
          <a href={session.spreadsheetUrl} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "md")}>
            <ExternalLink className="h-4 w-4" /> {t("err.openSheet")}
          </a>
        )}
        <Button variant="secondary" onClick={clearAndRetry}>
          <Trash2 className="h-4 w-4" /> {t("prof.cache.clear")}
        </Button>
        {pathname !== "/profile" && (
          <GuardedLink href="/profile" className={buttonClasses("ghost", "md")}>
            <UserRound className="h-4 w-4" /> {t("nav.profile")}
          </GuardedLink>
        )}
        <Button variant="ghost" onClick={() => void leave()}>
          <LogOut className="h-4 w-4" /> {t("prof.signOut")}
        </Button>
      </div>
      <details className="mt-4 text-xs text-ink-3">
        <summary className="cursor-pointer select-none hover:text-ink-2">{t("err.details")}</summary>
        <p className="mt-2 break-words font-mono">{detail}</p>
      </details>
    </Card>
  );
}

/** The data loaded, but Google won't take changes (e.g. a full Drive): say so before anything is typed in vain. */
export function WriteBlocked({ code }: { code: string }) {
  const { t } = useI18n();
  return (
    <div role="status" className="mb-4 flex flex-wrap items-start gap-3 rounded-2xl border border-warn/30 bg-warn/10 p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warn" />
      <div className="min-w-0 flex-1 basis-56 text-sm">
        <p className="font-medium text-ink">{t("err.blocked.title")}</p>
        <p className="mt-0.5 text-ink-2">{reasonForCode(code, t) ?? t("err.why.unknown", { detail: code })}</p>
      </div>
      {code === "storage" && (
        <a href="https://one.google.com/storage" target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm", "shrink-0")}>
          <ExternalLink className="h-4 w-4" /> {t("err.blocked.storage")}
        </a>
      )}
    </div>
  );
}

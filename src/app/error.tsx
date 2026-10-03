"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { CACHE_KEY } from "@/components/providers";
import { clearCachedData } from "@/components/shell/load-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";

// When the last automatic recovery happened (this tab) — so a page that keeps crashing isn't reloaded in a loop
const RECOVERED_KEY = "gelbien.recovered";

function recentlyRecovered() {
  try {
    return Date.now() - Number(sessionStorage.getItem(RECOVERED_KEY) ?? 0) < 60_000;
  } catch {
    return true; // can't remember having tried: don't risk a loop
  }
}

/** Forget this browser's copy of the sheet and load everything fresh — the newest code included. */
function reloadFresh(forgetAll: boolean) {
  try {
    sessionStorage.setItem(RECOVERED_KEY, String(Date.now()));
    if (forgetAll) clearCachedData();
    else localStorage.removeItem(CACHE_KEY);
  } catch {
    /* storage blocked: nothing cached either */
  }
  window.location.reload();
}

/**
 * Last line of defence when a page crashes. Right after a deploy the usual cause is something this
 * browser kept from the previous version (its copy of the sheet, old code), so the first time it
 * quietly reloads with a fresh copy; if the page crashes again, it says so and offers the ways out.
 */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [autoRecover] = useState(() => !recentlyRecovered());

  useEffect(() => {
    console.error(error);
    if (!autoRecover) return;
    // so a throttled save of the cache can't put the old copy back before the reload
    qc.removeQueries({ queryKey: ["dataset"] });
    reloadFresh(false);
  }, [error, autoRecover, qc]);

  if (autoRecover) {
    return (
      <div className="grid min-h-dvh place-items-center p-4 text-sm text-ink-3">
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-gold" /> {t("err.crash.recovering")}
        </span>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-xl">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-bad/10 text-bad">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-ink">{t("err.crash.title")}</h2>
            <p className="mt-1 text-sm text-ink-2">{t("err.crash.body")}</p>
            <p className="mt-1.5 text-xs text-ink-3">{t("err.safe")}</p>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="primary" onClick={() => reloadFresh(true)}>
            <Trash2 className="h-4 w-4" /> {t("prof.cache.clear")}
          </Button>
          <Button variant="secondary" onClick={retry}>
            <RefreshCw className="h-4 w-4" /> {t("common.retry")}
          </Button>
        </div>
        <details className="mt-4 text-xs text-ink-3">
          <summary className="cursor-pointer select-none hover:text-ink-2">{t("err.details")}</summary>
          <p className="mt-2 break-words font-mono">{error.message || error.digest}</p>
        </details>
      </Card>
    </div>
  );
}

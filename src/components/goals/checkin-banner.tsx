"use client";

import { BellRing, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { checkInStatus } from "@/lib/goals";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { cn, monthOf, todayISO } from "@/lib/utils";
import { buttonClasses } from "../ui/button";

const DISMISS_KEY = "gelbien.checkin.dismissed";

function dismissedThisMonth(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === monthOf(todayISO());
  } catch {
    return false;
  }
}

/**
 * "Time for your monthly check-in" — shown once the check-in day has passed without new balances.
 * `onUpdate` opens the check-in in place; without it the banner links to the Goals page.
 */
export function CheckInBanner({ ds, onUpdate, className }: { ds: Dataset; onUpdate?: () => void; className?: string }) {
  const { t } = useI18n();
  const [hidden, setHidden] = useState(dismissedThisMonth);
  const show = checkInStatus(ds).due && !hidden;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, monthOf(todayISO()));
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className={cn("overflow-hidden", className)}
        >
          <div className="flex flex-col gap-3 rounded-2xl border border-gold/30 bg-gradient-to-r from-gold/15 to-gold/[0.03] p-4 sm:flex-row sm:items-center">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-soft text-gold">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t("ci.due.title")}</p>
              <p className="text-[13px] text-ink-3">{t("ci.due.body")}</p>
            </div>
            <div className="flex items-center gap-2">
              {onUpdate ? (
                <button onClick={onUpdate} className={buttonClasses("primary", "sm")}>
                  {t("ci.due.cta")}
                </button>
              ) : (
                <Link href="/goals?checkin=1" className={buttonClasses("primary", "sm")}>
                  {t("ci.due.cta")}
                </Link>
              )}
              <button onClick={dismiss} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink" aria-label={t("ci.later")} title={t("ci.later")}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

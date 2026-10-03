"use client";

import { ArrowLeft, ArrowRight, BookOpen, LayoutDashboard, ListOrdered, MessageCircle, PartyPopper, PiggyBank, Plus, Sparkles, Tags, Target, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useDataset, useMode, useMutate } from "@/lib/data/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { askToLeave, hasUnsaved } from "@/lib/unsaved";
import { cn } from "@/lib/utils";
import { GuardedLink } from "./shell/unsaved";
import { Button } from "./ui/button";

/** Bump to show the tour again to everyone who has seen it — after it changes a lot. */
export const TOUR_VERSION = 1;

type StepId = "welcome" | "add" | "dashboard" | "expenses" | "budget" | "goals" | "chat" | "categories" | "profile" | "done";

// Each step opens its page behind the card, so the tour shows the real thing
const STEPS: { id: StepId; href?: string; icon: typeof Sparkles }[] = [
  { id: "welcome", icon: Sparkles },
  { id: "add", href: "/dashboard", icon: Plus },
  { id: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { id: "expenses", href: "/expenses", icon: ListOrdered },
  { id: "budget", href: "/budget", icon: PiggyBank },
  { id: "goals", href: "/goals", icon: Target },
  { id: "chat", href: "/chat", icon: MessageCircle },
  { id: "categories", href: "/config", icon: Tags },
  { id: "profile", href: "/profile", icon: UserRound },
  { id: "done", href: "/dashboard", icon: PartyPopper },
];

// Also remembered in this browser, in case saving to the sheet fails — the tour shouldn't come back every visit
const seenKey = (who: string) => `gelbien.tourSeen.${who}`;

function seenHere(who: string): number {
  try {
    return Number(localStorage.getItem(seenKey(who))) || 0;
  } catch {
    return 0;
  }
}

function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return !!node && (node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName));
}

/**
 * A walk through every page for new users: a card that stays out of the way while each step opens its
 * page behind it. Starts by itself until finished or skipped once (remembered in the user's sheet, so
 * once per account rather than per device); the guide can replay it.
 */
export function WelcomeTour() {
  const ds = useDataset().data as Dataset;
  const { mode, session } = useMode();
  const { t } = useI18n();
  const mutate = useMutate();
  const router = useRouter();
  const pathname = usePathname();
  const { open, step } = useUi((s) => s.tour);
  const { openTour, setTourStep, closeTour, openExpense } = useUi.getState();
  const who = session?.user?.sub ?? mode;

  // New here: start once, unless they went straight to the guide
  const started = useRef(false);
  useEffect(() => {
    if (started.current || pathname === "/guide") return;
    started.current = true;
    if (ds.settings.tourSeen < TOUR_VERSION && seenHere(who) < TOUR_VERSION) openTour();
  }, [ds.settings.tourSeen, who, pathname, openTour]);

  const go = (i: number) => {
    setTourStep(i);
    const href = STEPS[i].href;
    if (!href || href === pathname) return;
    if (hasUnsaved()) askToLeave(() => router.push(href));
    else router.push(href);
  };

  const finish = () => {
    closeTour();
    try {
      localStorage.setItem(seenKey(who), String(TOUR_VERSION));
    } catch {
      /* storage blocked: the sheet still remembers */
    }
    // a sheet that can't take writes right now (e.g. a full Drive) shouldn't get an error for this
    if (ds.settings.tourSeen < TOUR_VERSION && !ds.meta.warning) mutate.mutate({ op: "saveSettings", settings: { ...ds.settings, tourSeen: TOUR_VERSION } });
  };

  // ← → to move, Esc to leave — unless typing, or a dialog (an expense opened from the tour) has the keyboard
  const keys = useRef({ go, finish, step });
  useEffect(() => {
    keys.current = { go, finish, step };
  });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || document.querySelector("[role=dialog]")) return;
      const k = keys.current;
      if (e.key === "ArrowRight" && k.step < STEPS.length - 1) k.go(k.step + 1);
      else if (e.key === "ArrowLeft" && k.step > 0) k.go(k.step - 1);
      else if (e.key === "Escape") k.finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const current = STEPS[Math.min(step, STEPS.length - 1)];
  const last = step === STEPS.length - 1;
  const body = t(`tour.${current.id}.body` as MessageKey);

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          role="region"
          aria-label={t("tour.label")}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className={cn(
            // below sheets (z-50), so an expense opened from the tour covers it; above the bottom nav it sits over
            "fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[45] flex max-h-[min(30rem,60dvh)] flex-col rounded-2xl border border-gold/30 bg-[#141418]/95 shadow-2xl shadow-black/60 backdrop-blur-xl",
            "sm:left-auto sm:right-6 sm:w-[25rem] lg:bottom-28 lg:right-8",
          )}
        >
          <div className="flex items-center gap-2 px-4 pt-3 text-xs text-ink-3">
            <span>{t("tour.step", { n: step + 1, total: STEPS.length })}</span>
            <button onClick={finish} className="-mr-1.5 ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/5 hover:text-ink" aria-label={t("tour.skip")}>
              {!last && t("tour.skip")} <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-1 pt-2">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={current.id} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold-soft text-gold">
                    <current.icon className="h-5 w-5" />
                  </span>
                  <h2 className="text-base font-semibold tracking-tight text-ink">{t(`tour.${current.id}.title` as MessageKey)}</h2>
                </div>
                <div className="mt-3 space-y-2.5 text-sm leading-relaxed text-ink-2">
                  {body.split("\n\n").map((para, i) => (
                    <p key={i}>
                      {para.split("\n").map((line, j) => (
                        <span key={j} className="block">
                          {line}
                        </span>
                      ))}
                    </p>
                  ))}
                </div>
                {current.id === "add" && (
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => openExpense()}>
                    <Plus className="h-4 w-4" /> {t("tour.tryAdd")}
                  </Button>
                )}
                {last && (
                  <GuardedLink href="/guide" onClick={finish} className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-gold hover:underline">
                    <BookOpen className="h-4 w-4" /> {t("tour.openGuide")}
                  </GuardedLink>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2 border-t border-line/60 px-4 py-3">
            <div className="flex flex-1 flex-wrap gap-1" aria-hidden>
              {STEPS.map((s, i) => (
                <span key={s.id} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-4 bg-gold" : "w-1.5 bg-white/15")} />
              ))}
            </div>
            {step > 0 && (
              <Button size="sm" variant="ghost" onClick={() => go(step - 1)}>
                <ArrowLeft className="h-4 w-4" /> {t("tour.back")}
              </Button>
            )}
            {last ? (
              <Button size="sm" variant="primary" onClick={finish}>
                {t("tour.finish")}
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={() => go(step + 1)}>
                {t("tour.next")} <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

"use client";

import { CircleHelp, CloudCheck, FileUp, MessageCircle, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useDataset, useMode, useRefresh } from "@/lib/data/hooks";
import { receiptFromTransfer } from "@/lib/files";
import { LOCALES, useI18n, usePrefs } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { useHydrated } from "@/lib/use-media";
import { cn } from "@/lib/utils";
import { ExpenseDialog } from "../expense-dialog";
import { Logo, LogoMark } from "../logo";
import { MonthReviewSheet } from "../month-review";
import { SubscriptionDialog } from "../subscription-dialog";
import { buttonClasses } from "../ui/button";
import { Skeleton } from "../ui/misc";
import { WelcomeTour } from "../welcome-tour";
import { MonthPicker } from "./month-picker";
import { BottomNav, DesktopFab, Sidebar } from "./nav";
import { LoadError, WriteBlocked } from "./load-error";
import { GuardedLink, UnsavedDialog } from "./unsaved";
import { AccountMenu, guideHref } from "./user-chip";

function SyncIndicator() {
  const { isFetching, data } = useDataset();
  const refresh = useRefresh();
  const { t, f } = useI18n();
  const { mode } = useMode();
  if (mode !== "google") return null;
  return (
    <button
      onClick={() => refresh()}
      title={data ? t("prof.data.lastSync", { time: f.relative(data.meta.syncedAt) }) : undefined}
      className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 transition hover:bg-white/5 hover:text-ink"
      aria-label={t("prof.data.sync")}
    >
      {isFetching ? <RefreshCw className="h-4 w-4 animate-spin text-gold" /> : <CloudCheck className="h-4 w-4" />}
    </button>
  );
}

/** Computers: the guide at this page's section. (On phones it's in the account menu, where there's room.) */
function HelpButton() {
  const { t } = useI18n();
  const pathname = usePathname();
  if (pathname === "/guide") return null;
  return (
    <GuardedLink
      href={guideHref(pathname)}
      className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 transition hover:bg-white/5 hover:text-ink"
      aria-label={t("guide.help")}
      title={t("guide.help")}
    >
      <CircleHelp className="h-[18px] w-[18px]" />
    </GuardedLink>
  );
}

function TopBar() {
  const { mode } = useMode();
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* the smallest phones (under 360px) need the room; the dashboard is in the bottom bar anyway */}
        <GuardedLink href="/dashboard" className="lg:hidden max-[359px]:hidden" aria-label="Gelbien">
          <LogoMark />
        </GuardedLink>
        <MonthPicker className="mx-auto lg:mx-0" />
        <div className="ml-auto flex items-center gap-1 lg:ml-auto">
          {mode === "demo" && (
            <GuardedLink href="/profile" className="hidden rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-[11px] font-medium text-gold-bright sm:inline">
              {t("common.demo")}
            </GuardedLink>
          )}
          {/* phones keep just Chat and the account menu here, so the bar never gets wider than the screen */}
          <div className="hidden items-center gap-1 lg:flex">
            <SyncIndicator />
            <HelpButton />
          </div>
          <GuardedLink href="/chat" className="grid h-9 w-9 place-items-center rounded-xl text-ink-3 transition hover:bg-white/5 hover:text-ink lg:hidden" aria-label={t("nav.chat")}>
            <MessageCircle className="h-[18px] w-[18px]" />
          </GuardedLink>
          <div className="lg:hidden">
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}

/** Keep language/currency in step with the settings stored in the user's sheet (syncs across devices). */
function PrefsSync() {
  const { data } = useDataset();
  const setLocale = usePrefs((s) => s.setLocale);
  const setCurrency = usePrefs((s) => s.setCurrency);
  const locale = data?.settings.locale;
  const currency = data?.settings.currency;
  useEffect(() => {
    if (locale) setLocale(locale);
  }, [locale, setLocale]);
  useEffect(() => {
    if (currency) setCurrency(currency);
  }, [currency, setCurrency]);
  return null;
}

function isTypingTarget(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  return !!node && (node.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(node.tagName));
}

/** Paste or drop a receipt anywhere to start a new expense; press N to add one. */
function GlobalReceiptCapture() {
  const openExpense = useUi((s) => s.openExpense);
  const { t } = useI18n();
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (useUi.getState().expense.open) return; // the dialog handles its own paste
      const file = receiptFromTransfer(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      toast(t("paste.hint"));
      openExpense({ file });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (useUi.getState().expense.open || document.querySelector("[role=dialog]")) return;
      e.preventDefault();
      openExpense();
    };
    let depth = 0;
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes("Files");
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e) || useUi.getState().expense.open) return;
      depth++;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e) && !useUi.getState().expense.open) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      depth = 0;
      setDragging(false);
      if (useUi.getState().expense.open) return;
      const file = receiptFromTransfer(e.dataTransfer);
      if (!file) return;
      e.preventDefault();
      openExpense({ file });
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("keydown", onKey);
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openExpense, t]);

  return (
    <AnimatePresence>
      {dragging && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-gold/60 bg-gold-soft px-14 py-12 text-gold-bright"
          >
            <FileUp className="h-10 w-10" />
            <p className="text-lg font-medium">{t("form.receipt.drop")}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** The guide for someone not signed in yet (linked from the login page): just the text, a language switch and a way in. */
function PublicShell({ children }: { children: React.ReactNode }) {
  const { t, locale } = useI18n();
  const setLocale = usePrefs((s) => s.setLocale);
  return (
    <div className="relative min-h-dvh">
      <div className="app-aura" />
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/70 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/login" aria-label="Gelbien">
            <Logo />
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <div className="flex rounded-lg border border-line p-0.5">
              {(Object.keys(LOCALES) as Locale[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={cn("rounded-md px-2 py-1 text-xs font-medium uppercase", l === locale ? "bg-gold-soft text-gold-bright" : "text-ink-3 hover:text-ink")}
                >
                  {l}
                </button>
              ))}
            </div>
            <Link href="/login" className={buttonClasses("primary", "sm")}>
              {t("guide.public.cta")}
            </Link>
          </div>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </div>
  );
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <LogoMark className="h-14 w-14 animate-pulse" />
      </motion.div>
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-4 pt-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-44 md:col-span-2" />
        <Skeleton className="h-44" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const { mode } = useMode();
  const ds = useDataset();
  const refresh = useRefresh();
  const pathname = usePathname();
  // Profile works without the data (sign out, clear the cache, AI keys): the way out when loading fails.
  // The guide is only text, so it doesn't wait for the data either — and can be read before signing in.
  const standalone = pathname === "/profile" || pathname === "/guide";
  const isPublic = pathname === "/guide";

  useEffect(() => {
    if (hydrated && mode === "signedOut" && !isPublic) router.replace("/login");
  }, [hydrated, mode, router, isPublic]);

  useEffect(() => {
    const err = ds.error as { status?: number } | null;
    // the server has dropped the expired session cookie by now
    if (err?.status === 401) router.replace("/login?error=expired");
  }, [ds.error, router]);

  if (!hydrated || mode === "loading") return <Splash />;
  if (mode === "signedOut") return isPublic ? <PublicShell>{children}</PublicShell> : <Splash />;

  const ready = !!ds.data;
  return (
    <div className="relative min-h-dvh">
      <div className="app-aura" />
      <Sidebar />
      <div className="relative z-10 lg:pl-64">
        <TopBar />
        <main className={cn("mx-auto max-w-7xl px-4 pb-32 pt-6 sm:px-6 lg:px-8 lg:pb-16")}>
          {ready ? (
            <>
              {ds.data?.meta.warning && <WriteBlocked code={ds.data.meta.warning} />}
              {children}
            </>
          ) : standalone ? (
            // children keep their place whether or not the error shows: remounting the page would
            // start a new load, which hides the error, which remounts the page… (a request loop)
            <>
              {ds.isError && <LoadError error={ds.error} onRetry={() => refresh()} className="mb-4 max-w-none" />}
              {children}
            </>
          ) : ds.isError ? (
            <LoadError error={ds.error} onRetry={() => refresh()} />
          ) : (
            <ContentSkeleton />
          )}
        </main>
      </div>
      <BottomNav />
      {ready && (
        <>
          <DesktopFab />
          <PrefsSync />
          <GlobalReceiptCapture />
          <ExpenseDialog />
          <SubscriptionDialog />
          <MonthReviewSheet />
          <UnsavedDialog />
          <WelcomeTour />
        </>
      )}
    </div>
  );
}

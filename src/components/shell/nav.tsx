"use client";

import { BookOpen, LayoutDashboard, ListOrdered, MessageCircle, PiggyBank, Plus, Tags, Target, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { useIntroDelay } from "@/lib/motion";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { Logo } from "../logo";
import { Burst } from "../ui/burst";
import { Button } from "../ui/button";
import { GuardedLink } from "./unsaved";
import { UserChip } from "./user-chip";

export const NAV: { href: string; label: MessageKey; icon: typeof LayoutDashboard }[] = [
  { href: "/dashboard", label: "nav.dashboard", icon: LayoutDashboard },
  { href: "/budget", label: "nav.budget", icon: PiggyBank },
  { href: "/goals", label: "nav.goals", icon: Target },
  { href: "/expenses", label: "nav.expenses", icon: ListOrdered },
  { href: "/chat", label: "nav.chat", icon: MessageCircle },
  { href: "/config", label: "nav.config", icon: Tags },
  { href: "/profile", label: "nav.profile", icon: UserRound },
  { href: "/guide", label: "nav.guide", icon: BookOpen },
];

/**
 * The + of every "add expense" button: turns into × while the new expense is open, and a press sends
 * a gold ring out of the button (the expense then unfolds from it — see Sheet).
 */
function useAddExpense() {
  const openExpense = useUi((s) => s.openExpense);
  const adding = useUi((s) => s.expense.open);
  const [presses, setPresses] = useState(0);
  const add = () => {
    setPresses((n) => n + 1);
    openExpense();
  };
  const icon = (className: string) => (
    <motion.span className="grid place-items-center" animate={{ rotate: adding ? 135 : 0 }} transition={{ type: "spring", stiffness: 380, damping: 18 }}>
      <Plus className={className} strokeWidth={2.5} />
    </motion.span>
  );
  return { add, icon, burst: <Burst trigger={presses} /> };
}

/** A nav icon that pops when its page becomes the current one */
function NavIcon({ icon: Icon, active, className }: { icon: typeof LayoutDashboard; active: boolean; className: string }) {
  return (
    <motion.span
      key={active ? "on" : "off"}
      className="relative grid place-items-center"
      initial={active ? { scale: 0.55, y: 4, rotate: -12 } : false}
      animate={{ scale: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 520, damping: 14 }}
    >
      <Icon className={className} />
    </motion.span>
  );
}

/**
 * A page's tab in the phone's bottom bar. Lit as soon as it's tapped (useLinkStatus): when the page
 * still has to load — a slow network, the app just woken up — the tap shows it registered.
 */
function TabItem({ item, active, label }: { item: (typeof NAV)[number]; active: boolean; label: string }) {
  const { pending } = useLinkStatus();
  const lit = active || pending;
  return (
    <>
      {pending && !active && <span aria-hidden className="absolute -top-px h-0.5 w-8 animate-pulse rounded-full bg-gold/70" />}
      <NavIcon icon={item.icon} active={active} className={cn("h-5 w-5 transition-colors", lit ? "text-gold" : "text-ink-3")} />
      <span className={cn("text-[10px] font-medium transition-colors", lit ? "text-ink" : "text-ink-3")}>{label}</span>
    </>
  );
}

/** The same in the sidebar */
function SidebarItem({ item, active, label }: { item: (typeof NAV)[number]; active: boolean; label: string }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <NavIcon icon={item.icon} active={active} className={cn("h-[18px] w-[18px] transition-colors", (active || pending) && "text-gold", pending && "animate-pulse")} />
      <span className={cn("relative transition-colors", pending && "text-ink-2")}>{label}</span>
    </>
  );
}

/**
 * Keeps every page ready to open at a tap: fetches them in the background when the app starts and
 * whenever it comes back to the foreground — a phone's home-screen app is often resumed after hours,
 * with what it had fetched gone stale, and the first tap would otherwise wait on the network.
 */
export function RouteWarmup() {
  const router = useRouter();
  useEffect(() => {
    const warm = () => {
      for (const item of NAV) router.prefetch(item.href);
    };
    // once the page has settled (Safari has no requestIdleCallback)
    const start = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(warm, { timeout: 1500 }) : null;
    const fallback = start === null ? setTimeout(warm, 300) : null;
    const onVisible = () => {
      if (document.visibilityState === "visible") warm();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", warm);
    window.addEventListener("online", warm);
    return () => {
      if (start !== null) window.cancelIdleCallback(start);
      if (fallback !== null) clearTimeout(fallback);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", warm);
      window.removeEventListener("online", warm);
    };
  }, [router]);
  return null;
}

/** On the app's first screen, a bar arrives from its edge as the intro parts (see .intro-drop & co. in globals.css). */
function introEntrance(intro: number, className: string, after = 120) {
  return intro > 0 ? { className, style: { ["--intro-delay" as string]: `${intro + after}ms` } } : { className: undefined, style: undefined };
}

export function Sidebar() {
  const path = usePathname();
  const { t } = useI18n();
  const { add, icon, burst } = useAddExpense();
  const entrance = introEntrance(useIntroDelay(), "intro-slide");
  return (
    <aside
      className={cn("fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-[#0c0c0f]/80 px-4 py-6 backdrop-blur-xl lg:flex", entrance.className)}
      style={entrance.style}
    >
      <GuardedLink href="/dashboard" className="px-2">
        <Logo />
      </GuardedLink>
      <Button variant="primary" size="lg" className="relative mt-8 w-full" onClick={add}>
        {burst}
        {icon("h-5 w-5")} {t("nav.add")}
        <kbd className="ml-auto rounded-md bg-black/15 px-1.5 text-[11px] font-medium">N</kbd>
      </Button>
      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map((item) => {
          const active = path.startsWith(item.href);
          return (
            <GuardedLink
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex h-11 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition-colors",
                active ? "text-ink" : "text-ink-3 hover:bg-white/[0.03] hover:text-ink-2",
              )}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-xl border border-gold/20 bg-gradient-to-r from-gold/15 to-transparent"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <SidebarItem item={item} active={active} label={t(item.label)} />
            </GuardedLink>
          );
        })}
      </nav>
      <div className="mt-auto">
        <UserChip />
      </div>
    </aside>
  );
}

// Phones: Dashboard, Budget, +, Expenses, Goals — Chat moves to the top bar.
const MOBILE = [NAV[0], NAV[1], null, NAV[3], NAV[2]] as const;

export function BottomNav() {
  const path = usePathname();
  const { t } = useI18n();
  const { add, icon, burst } = useAddExpense();
  const intro = useIntroDelay();
  const entrance = introEntrance(intro, "intro-lift");
  const pop = introEntrance(intro, "intro-pop");
  return (
    <nav
      className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#0c0c0f]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden", entrance.className)}
      style={entrance.style}
    >
      <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
        {MOBILE.map((item) => {
          if (!item) {
            return (
              <div key="fab" className="flex justify-center">
                <motion.button
                  aria-label={t("nav.add")}
                  onClick={add}
                  whileTap={{ scale: 0.88 }}
                  whileHover={{ scale: 1.05 }}
                  className={cn("gold-fill relative -mt-7 grid h-14 w-14 place-items-center rounded-2xl text-[#1b1406] shadow-[0_10px_30px_-6px_#d9b45fa0] ring-4 ring-bg", pop.className)}
                  style={pop.style}
                >
                  {burst}
                  {icon("h-7 w-7")}
                </motion.button>
              </div>
            );
          }
          const active = path.startsWith(item.href);
          return (
            <GuardedLink key={item.href} href={item.href} className="relative flex flex-col items-center gap-1 py-1.5">
              {/* the current tab's gold bar, with a soft light falling from it — both glide to the next tab */}
              {active && (
                <>
                  <motion.span
                    layoutId="bottom-glow"
                    aria-hidden
                    className="pointer-events-none absolute inset-x-1 -top-px h-14 bg-[radial-gradient(55%_75%_at_50%_0%,#d9b45f2b,transparent)]"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                  <motion.span layoutId="bottom-active" className="absolute -top-px h-0.5 w-8 rounded-full bg-gold" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
                </>
              )}
              <TabItem item={item} active={active} label={t(item.label)} />
            </GuardedLink>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop floating + so adding an expense is always one click away. */
export function DesktopFab() {
  const { t } = useI18n();
  const { add, icon, burst } = useAddExpense();
  const pop = introEntrance(useIntroDelay(), "intro-pop", 380);
  return (
    <motion.button
      aria-label={t("nav.add")}
      title={t("nav.add")}
      onClick={add}
      initial={{ scale: 0, opacity: 0, rotate: -90 }}
      animate={{ scale: 1, opacity: 1, rotate: 0 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      // named so a page changing underneath doesn't cover it (see app-fab in globals.css)
      className={cn(
        "gold-fill fixed bottom-8 right-8 z-30 hidden h-14 w-14 place-items-center rounded-2xl text-[#1b1406] shadow-[0_12px_32px_-8px_#d9b45fb0] [view-transition-name:app-fab] lg:grid",
        pop.className,
      )}
      style={pop.style}
    >
      {burst}
      {icon("h-7 w-7")}
    </motion.button>
  );
}

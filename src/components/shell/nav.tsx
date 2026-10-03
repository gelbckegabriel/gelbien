"use client";

import { BookOpen, LayoutDashboard, ListOrdered, MessageCircle, PiggyBank, Plus, Tags, Target, UserRound } from "lucide-react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
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

export function Sidebar() {
  const path = usePathname();
  const { t } = useI18n();
  const { add, icon, burst } = useAddExpense();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-[#0c0c0f]/80 px-4 py-6 backdrop-blur-xl lg:flex">
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
              <NavIcon icon={item.icon} active={active} className={cn("h-[18px] w-[18px]", active && "text-gold")} />
              <span className="relative">{t(item.label)}</span>
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
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#0c0c0f]/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
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
                  className="gold-fill relative -mt-7 grid h-14 w-14 place-items-center rounded-2xl text-[#1b1406] shadow-[0_10px_30px_-6px_#d9b45fa0] ring-4 ring-bg"
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
              {active && (
                <motion.span layoutId="bottom-active" className="absolute -top-px h-0.5 w-8 rounded-full bg-gold" transition={{ type: "spring", stiffness: 500, damping: 40 }} />
              )}
              <NavIcon icon={item.icon} active={active} className={cn("h-5 w-5 transition-colors", active ? "text-gold" : "text-ink-3")} />
              <span className={cn("text-[10px] font-medium transition-colors", active ? "text-ink" : "text-ink-3")}>{t(item.label)}</span>
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
      className="gold-fill fixed bottom-8 right-8 z-30 hidden h-14 w-14 place-items-center rounded-2xl text-[#1b1406] shadow-[0_12px_32px_-8px_#d9b45fb0] lg:grid"
    >
      {burst}
      {icon("h-7 w-7")}
    </motion.button>
  );
}

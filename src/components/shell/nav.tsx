"use client";

import { BookOpen, LayoutDashboard, ListOrdered, MessageCircle, PiggyBank, Plus, Tags, Target, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link, { useLinkStatus } from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { askToLeave, hasUnsaved } from "@/lib/unsaved";
import { useIntroDelay } from "@/lib/motion";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { CoinMark, Logo } from "../logo";
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
              // each page keeps its place (see template)
              scroll={false}
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

// Phones: Dashboard, Budget, +, Expenses, Goals — Chat moves to the top bar. Five equal columns.
const MOBILE = [NAV[0], NAV[1], null, NAV[3], NAV[2]] as const;
const columnOf = (href: string | null) => (href ? MOBILE.findIndex((i) => i?.href === href) : -1);
const COIN = 22; // px
const GLIDE = "cubic-bezier(0.4, 0.55, 0.2, 1)";

/** When (0–1 of the time) the GLIDE curve has covered `p` of the way — so the coin hops the + as it gets there. */
function timeAt(p: number) {
  const [x1, y1, x2, y2] = [0.4, 0.55, 0.2, 1];
  const at = (u: number, a: number, b: number) => 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u ** 2 * b + u ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid, y1, y2) < p) lo = mid;
    else hi = mid;
  }
  return at((lo + hi) / 2, x1, x2);
}

/**
 * A coin rolls along the top of the tab bar from the tab you left to the one you picked — turning as
 * far as it travels, hopping the + on the way across. Three nested layers (along, up, around), each a
 * Web Animation of its own transform, so it runs on the compositor even while the new page renders.
 */
function rollCoin(mover: HTMLElement, from: number, to: number) {
  const hopper = mover.firstElementChild as HTMLElement;
  const spinner = hopper.firstElementChild as HTMLElement;
  const steps = Math.abs(to - from);
  const duration = 320 + steps * 60;
  const travel = steps * mover.getBoundingClientRect().width;
  mover.animate(
    [
      { transform: `translateX(${from * 100}%)`, opacity: 0 },
      { opacity: 1, offset: 0.12 },
      { opacity: 1, offset: 0.78 },
      { transform: `translateX(${to * 100}%)`, opacity: 0 },
    ],
    { duration, easing: GLIDE },
  );
  spinner.animate([{ transform: "rotate(0deg)" }, { transform: `rotate(${Math.sign(to - from) * (travel / (Math.PI * COIN)) * 360}deg)` }], { duration, easing: GLIDE });
  if (Math.min(from, to) < 2 && Math.max(from, to) > 2) {
    const t = timeAt((2 - from) / (to - from));
    hopper.animate(
      [
        { transform: "none", offset: 0 },
        { transform: "none", offset: Math.max(0, t - 0.14), easing: "cubic-bezier(0.2, 0.6, 0.4, 1)" },
        { transform: "translateY(-24px)", offset: t, easing: "cubic-bezier(0.6, 0, 0.8, 0.4)" },
        { transform: "none", offset: Math.min(1, t + 0.14) },
        { transform: "none", offset: 1 },
      ],
      { duration },
    );
  }
}

/**
 * The phone's tab bar, made to keep up with a thumb. A tab lights the moment it's touched — before its
 * page has even arrived — and the page opens on release. The gold bar and its light glide over to it
 * (a CSS transition) while the coin rolls across: both on the compositor, smooth while the page renders.
 * Tapping the tab you're on takes its page back to the top. Pages keep their place between visits (they
 * stay alive in the background, see template), hence scroll={false}.
 */
export function BottomNav() {
  const path = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const { add, icon, burst } = useAddExpense();
  const intro = useIntroDelay();
  const entrance = introEntrance(intro, "intro-lift");
  const pop = introEntrance(intro, "intro-pop");
  // the tab under the finger shows as current at once (only while still on the page it was pressed from)
  const [pressed, setPressed] = useState<{ href: string; from: string } | null>(null);
  const routeTab = MOBILE.find((i) => i && path.startsWith(i.href))?.href ?? null;
  const current = pressed && pressed.from === path ? pressed.href : routeTab;
  const col = columnOf(current);

  const coin = useRef<HTMLSpanElement>(null);
  const lastCol = useRef(col);
  useEffect(() => {
    const from = lastCol.current;
    lastCol.current = col;
    if (coin.current && !reduce && from >= 0 && col >= 0 && from !== col) rollCoin(coin.current, from, col);
  }, [col, reduce]);

  return (
    <nav
      className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[#0c0c0f]/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden", entrance.className)}
      style={entrance.style}
    >
      <div className="relative mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-2">
        {/* the columns, for what moves between them */}
        <div aria-hidden className="pointer-events-none absolute inset-y-0 inset-x-2">
          {/* the current tab's gold bar, with a soft light falling from it */}
          <span
            className={cn("absolute inset-y-0 left-0 w-1/5 transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)]", col < 0 && "opacity-0")}
            style={{ transform: `translateX(${Math.max(col, 0) * 100}%)` }}
          >
            <span className="absolute inset-x-1 -top-px h-14 bg-[radial-gradient(55%_75%_at_50%_0%,#d9b45f2b,transparent)]" />
            <span className="absolute -top-px left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-gold" />
          </span>
          {/* the coin, resting out of sight between runs */}
          <span ref={coin} className="absolute left-0 z-10 flex w-1/5 justify-center opacity-0" style={{ top: -COIN / 2 }}>
            <span className="block">
              {/* its glow is round, so it holds still while the coin turns */}
              <span
                className="relative block before:absolute before:-inset-2 before:rounded-full before:bg-[radial-gradient(circle,#d9b45f59,transparent_65%)]"
                style={{ width: COIN, height: COIN }}
              >
                <CoinMark className="relative h-full w-full" />
              </span>
            </span>
          </span>
        </div>
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
          const on = item.href === current;
          const here = item.href === routeTab;
          return (
            <Link
              key={item.href}
              href={item.href}
              scroll={false}
              aria-current={here ? "page" : undefined}
              className="relative flex flex-col items-center gap-1 py-1.5"
              onPointerDown={(e) => {
                if (e.button === 0 && !here && !hasUnsaved()) setPressed({ href: item.href, from: path });
              }}
              onPointerCancel={() => setPressed(null)}
              // released somewhere else: no tap after all
              onPointerUp={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setPressed(null);
              }}
              onClick={(e) => {
                if (!here) return;
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
              }}
              onNavigate={(e) => {
                if (!hasUnsaved()) return;
                e.preventDefault();
                setPressed(null);
                askToLeave(() => router.push(item.href, { scroll: false }));
              }}
            >
              <span key={on ? "on" : "off"} className={cn("grid place-items-center", on && !reduce && "tab-pop")}>
                <item.icon className={cn("h-5 w-5 transition-colors duration-200", on ? "text-gold" : "text-ink-3")} />
              </span>
              <span className={cn("text-[10px] font-medium transition-colors duration-200", on ? "text-ink" : "text-ink-3")}>{t(item.label)}</span>
            </Link>
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
      className={cn(
        "gold-fill fixed bottom-8 right-8 z-30 hidden h-14 w-14 place-items-center rounded-2xl text-[#1b1406] shadow-[0_12px_32px_-8px_#d9b45fb0] lg:grid",
        pop.className,
      )}
      style={pop.style}
    >
      {burst}
      {icon("h-7 w-7")}
    </motion.button>
  );
}

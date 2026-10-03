"use client";

import { CircleHelp, RefreshCw, Sparkles, Tags, UserRound } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "motion/react";
import { usePathname } from "next/navigation";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";
import { useDataset, useMode, useRefresh } from "@/lib/data/hooks";
import { EASE_OUT, GLOW, ICON, ROW, STILL } from "@/lib/motion";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Burst } from "../ui/burst";
import { GuardedLink } from "./unsaved";

// The guide section for each page — the ? button and the account menu open the guide there
const GUIDE_SECTION: [string, string][] = [
  ["/dashboard", "dashboard"],
  ["/expenses", "expenses"],
  ["/budget", "budget"],
  ["/goals", "goals"],
  ["/chat", "chat"],
  ["/config", "categories"],
  ["/profile", "profile"],
];

export const guideHref = (pathname: string) => `/guide#${GUIDE_SECTION.find(([path]) => pathname.startsWith(path))?.[1] ?? "start"}`;

export function Avatar({ name, picture, className }: { name: string; picture?: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return picture ? (
    // eslint-disable-next-line @next/next/no-img-element -- Google avatar URLs; no need for the image optimizer
    <img src={picture} alt="" referrerPolicy="no-referrer" className={cn("h-9 w-9 rounded-full border border-line object-cover", className)} />
  ) : (
    <span className={cn("grid h-9 w-9 place-items-center rounded-full border border-gold/30 bg-gold-soft text-xs font-semibold text-gold-bright", className)}>
      {initials || <Sparkles className="h-4 w-4" />}
    </span>
  );
}

export function UserChip({ compact }: { compact?: boolean }) {
  const { mode, session } = useMode();
  const { t } = useI18n();
  const user = session?.user;
  const name = user?.name ?? t("common.demo");
  return (
    <GuardedLink
      href="/profile"
      className={cn("flex items-center gap-3 rounded-xl transition-colors hover:bg-white/[0.04]", compact ? "p-0.5" : "border border-line p-2.5")}
      aria-label={t("nav.profile")}
    >
      <Avatar name={name} picture={user?.picture} className={compact ? "h-8 w-8" : undefined} />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-xs text-ink-3">{mode === "demo" ? t("prof.demoMode").split("—")[0].trim() : user?.email}</span>
        </span>
      )}
    </GuardedLink>
  );
}

const itemClass =
  "flex cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2.5 text-[15px] text-ink outline-none transition-colors data-[highlighted]:bg-white/[0.06]";

// Opening: the panel unfolds in a circle from the picture's corner while it springs into place, a gold
// glow blooms behind it, and the rows follow one by one (see lib/motion). Closing is quick and plain.
// With "reduce motion" on, it only fades.
const PANEL: Variants = {
  hidden: { opacity: 0, scale: 0.86, y: -10, clipPath: "circle(0% at 100% 0%)" },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    clipPath: "circle(150% at 100% 0%)",
    transition: {
      default: { type: "spring", stiffness: 420, damping: 30 },
      opacity: { duration: 0.15 },
      clipPath: { duration: 0.5, ease: EASE_OUT },
      delayChildren: 0.07,
      staggerChildren: 0.05,
    },
  },
  exit: { opacity: 0, scale: 0.96, y: -6, transition: { duration: 0.14, ease: "easeIn" } },
};
const FADE: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.15 } }, exit: { opacity: 0, transition: { duration: 0.1 } } };

/**
 * Phones: the picture at the top right opens what doesn't fit in the bottom bar — Profile, Categories,
 * the guide (at this page's section) and, signed in with Google, syncing. A spinner on the picture
 * shows a sync in progress.
 */
export function AccountMenu() {
  const { mode, session } = useMode();
  const { t, f } = useI18n();
  const { isFetching, data } = useDataset();
  const refresh = useRefresh();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [opens, setOpens] = useState(0);
  const user = session?.user;
  const name = user?.name ?? t("common.demo");
  const links = [
    { href: "/profile", icon: UserRound, label: t("nav.profile") },
    { href: "/config", icon: Tags, label: t("nav.config") },
    { href: guideHref(pathname), icon: CircleHelp, label: t("nav.guide"), hint: t("guide.help") },
  ];
  const row = reduce ? STILL : ROW;
  const icon = reduce ? STILL : ICON;

  return (
    <DropdownMenu.Root
      modal={false}
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setOpens((n) => n + 1);
      }}
    >
      <DropdownMenu.Trigger
        aria-label={t("nav.account")}
        className="relative rounded-full p-0.5 outline-none ring-gold/60 transition focus-visible:ring-2 data-[state=open]:ring-2"
      >
        <motion.span className="block" animate={{ scale: open ? 0.9 : 1 }} transition={{ type: "spring", stiffness: 500, damping: 18 }}>
          <Avatar name={name} picture={user?.picture} className="h-8 w-8" />
        </motion.span>
        {/* a ripple off the picture as the menu opens */}
        <Burst trigger={opens} />
        {mode === "google" && isFetching && (
          <span className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-bg">
            <RefreshCw className="h-3 w-3 animate-spin text-gold" />
          </span>
        )}
      </DropdownMenu.Trigger>
      {/* kept mounted while it animates out, then removed */}
      <AnimatePresence>
        {open && (
          <DropdownMenu.Portal forceMount>
            <DropdownMenu.Content forceMount asChild align="end" sideOffset={8} collisionPadding={12}>
              <motion.div
                variants={reduce ? FADE : PANEL}
                initial="hidden"
                animate="show"
                exit="exit"
                className="relative z-50 w-[min(18rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-line-strong bg-[#16161b] p-1.5 shadow-2xl shadow-black/60"
              >
                {!reduce && (
                  <motion.span
                    variants={GLOW}
                    aria-hidden
                    className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,#d9b45f40,transparent_70%)]"
                  />
                )}
                <motion.div variants={row} className="relative flex items-center gap-3 px-2.5 py-2">
                  <motion.span variants={icon} className="shrink-0">
                    <Avatar name={name} picture={user?.picture} className="h-10 w-10" />
                  </motion.span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{name}</p>
                    <p className="truncate text-xs text-ink-3">{mode === "demo" ? t("prof.demoMode").split("—")[0].trim() : user?.email}</p>
                  </div>
                </motion.div>
                <DropdownMenu.Separator className="relative mx-1 my-1 h-px bg-line" />
                {links.map((l) => {
                  const current = pathname === l.href.split("#")[0];
                  return (
                    <motion.div key={l.href} variants={row} className="relative">
                      <DropdownMenu.Item asChild>
                        <GuardedLink href={l.href} className={itemClass} aria-current={current ? "page" : undefined}>
                          <motion.span variants={icon} className="shrink-0">
                            <l.icon className={cn("h-[18px] w-[18px]", current ? "text-gold" : "text-ink-3")} />
                          </motion.span>
                          <span className="min-w-0 flex-1">
                            <span className="block">{l.label}</span>
                            {l.hint && <span className="block text-xs text-ink-3">{l.hint}</span>}
                          </span>
                        </GuardedLink>
                      </DropdownMenu.Item>
                    </motion.div>
                  );
                })}
                {mode === "google" && (
                  <>
                    <DropdownMenu.Separator className="relative mx-1 my-1 h-px bg-line" />
                    <motion.div variants={row} className="relative">
                      {/* stays open, so the spinner and "last synced" can be watched */}
                      <DropdownMenu.Item
                        className={itemClass}
                        onSelect={(e) => {
                          e.preventDefault();
                          refresh();
                        }}
                      >
                        <motion.span variants={icon} className="shrink-0">
                          <RefreshCw className={cn("h-[18px] w-[18px] text-ink-3", isFetching && "animate-spin text-gold")} />
                        </motion.span>
                        <span className="min-w-0 flex-1">
                          <span className="block">{t("prof.data.sync")}</span>
                          {data && <span className="block text-xs text-ink-3">{t("prof.data.lastSync", { time: f.relative(data.meta.syncedAt) })}</span>}
                        </span>
                      </DropdownMenu.Item>
                    </motion.div>
                  </>
                )}
              </motion.div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        )}
      </AnimatePresence>
    </DropdownMenu.Root>
  );
}

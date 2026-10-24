"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useState, ViewTransition } from "react";
import { CoinMark } from "@/components/logo";
import { NAV } from "@/components/shell/nav";
import { introRemaining } from "@/lib/motion";
import { useUi } from "@/lib/ui-store";

// The order of the pages in each layout's navigation: phones' bottom bar (then the rest), the sidebar
const PHONE_ORDER = ["/dashboard", "/budget", "/expenses", "/goals", "/chat", "/config", "/profile", "/guide"];
const SIDEBAR_ORDER = NAV.map((n) => n.href);
const SIDEBAR_WIDTH = 256; // w-64

// The page we're coming from; templates re-mount on every navigation
let previous: string | null = null;

/** 1: the new page is further along the nav (it comes in from the right), -1: back, 0: neither. */
function direction(from: string | null, to: string, computer: boolean) {
  const order = computer ? SIDEBAR_ORDER : PHONE_ORDER;
  const a = from ? order.findIndex((p) => from.startsWith(p)) : -1;
  const b = order.findIndex((p) => to.startsWith(p));
  return a < 0 || b < 0 || a === b ? 0 : b > a ? 1 : -1;
}

/**
 * How this page arrives. Between pages it's a view transition (globals.css): the new page pushes the
 * old one off to the side it's going, and a gold coin rolls along the gap between them, on the tab bar.
 * All on the compositor, and the new page is there at once — nothing waits for it (a tap mid-roll
 * finishes it, see GuardedLink). The first page (it lands as the intro opens), browsers without view
 * transitions and the welcome tour (its card floats over the page area) get a short CSS slide instead.
 */
function arrival(pathname: string, touring: boolean) {
  const computer = window.matchMedia("(min-width: 1024px)").matches;
  const first = previous === null;
  const dir = direction(previous, pathname, computer);
  const css = first || touring || typeof document.startViewTransition !== "function";
  // the band the pages move in: the whole width, or right of the sidebar
  const left = computer ? SIDEBAR_WIDTH : 0;
  const width = window.innerWidth - left;
  // the coin comes in from beyond one edge and rolls (without slipping) out past the other; it rests
  // where it ends, off screen, so nothing is left behind whatever happens to the transition
  const size = computer ? 48 : 36;
  const travel = dir * (width + size);
  return {
    css,
    delay: first ? introRemaining() : 0,
    from: dir ? `${dir * 40}px 0` : "0 12px",
    push: dir * width,
    coin: css || !dir ? null : { size, rest: dir > 0 ? left - size : left + width, travel, turn: (travel / (Math.PI * size)) * 360 },
  };
}

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const touring = useUi((s) => s.tour.open);
  const [entry] = useState(() => (typeof window === "undefined" ? null : arrival(pathname, touring)));

  useLayoutEffect(() => {
    // read by the transition's CSS, for this page and the one it replaces
    const root = document.documentElement.style;
    root.setProperty("--page-push", `${entry?.push ?? 0}px`);
    root.setProperty("--coin-travel", `${entry?.coin?.travel ?? 0}px`);
    root.setProperty("--coin-turn", `${entry?.coin?.turn ?? 0}deg`);
    previous = pathname;
  }, [pathname, entry]);

  const css = entry?.css ?? true;
  return (
    <>
      <ViewTransition enter={css ? "none" : "page-arrive"} exit={touring ? "none" : "page-leave"} default="none">
        <div
          className={css ? "page-enter" : undefined}
          style={{ ["--page-from" as string]: entry?.from, animationDelay: entry?.delay ? `${entry.delay}ms` : undefined }}
        >
          {children}
        </div>
      </ViewTransition>
      {entry?.coin && (
        <span aria-hidden className="page-coin" style={{ left: entry.coin.rest, width: entry.coin.size, height: entry.coin.size }}>
          <CoinMark className="relative h-full w-full" />
        </span>
      )}
    </>
  );
}

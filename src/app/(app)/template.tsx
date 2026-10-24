"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { NAV } from "@/components/shell/nav";
import { introRemaining } from "@/lib/motion";

// The order of the pages in each layout's navigation: phones' bottom bar (then the rest), the sidebar
const PHONE_ORDER = ["/dashboard", "/budget", "/expenses", "/goals", "/chat", "/config", "/profile", "/guide"];
const SIDEBAR_ORDER = NAV.map((n) => n.href);

// The page shown last, and how far down each page was when it was left
let previous: string | null = null;
const scrolledTo = new Map<string, number>();
// The page on screen and how far down it is: kept by its scroll events, and read once more the moment a
// link is clicked — before anything changes, so it's exact even if the last scroll event hasn't come yet.
let here: { y: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("click", () => here && (here.y = window.scrollY), { capture: true });
}

/** 1: the new page is further along the nav, -1: back, 0: neither (or the first page). */
function direction(from: string | null, to: string, computer: boolean) {
  const order = computer ? SIDEBAR_ORDER : PHONE_ORDER;
  const a = from ? order.findIndex((p) => from.startsWith(p)) : -1;
  const b = order.findIndex((p) => to.startsWith(p));
  return a < 0 || b < 0 || a === b ? 0 : b > a ? 1 : -1;
}

/**
 * Every page arrives through here. Next keeps recently visited pages alive in the background (hidden,
 * with their state — cacheComponents), so going back to a tab doesn't build it again; this runs both
 * when a page first mounts and each time it's shown again: back where you left it (or at the top the
 * first time), sliding in a little from the side of the tab you came from. One layer, opacity and a
 * transform on the compositor, a quarter of a second — the page is there and usable at once.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = previous === null;
    const computer = window.matchMedia("(min-width: 1024px)").matches;
    const dir = direction(previous, pathname, computer);
    window.scrollTo(0, scrolledTo.get(pathname) ?? 0);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const from = dir === 0 ? "translate(0px, 12px)" : computer ? `translate(0px, ${dir * 16}px)` : `translate(${dir * 28}px, 0px)`;
      el.animate([{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], {
        // the first page lands as the intro opens
        duration: first ? 420 : 260,
        delay: first ? introRemaining() : 0,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "backwards",
      });
    }
    previous = pathname;
    // How far down it is, kept as it goes: once it's hidden the page is out of the layout, and the
    // window's own reading may already have been cut short to fit what's left.
    const mine = { y: window.scrollY };
    here = mine;
    const onScroll = () => (mine.y = window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    // hidden (another page shown) or gone: remember where it was
    return () => {
      window.removeEventListener("scroll", onScroll);
      scrolledTo.set(pathname, mine.y);
      if (here === mine) here = null;
    };
  }, [pathname]);

  return <div ref={ref}>{children}</div>;
}

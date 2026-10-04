"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/components/shell/nav";

// The order of the pages in each layout's navigation: phones' bottom bar (then the rest), the sidebar
const PHONE_ORDER = ["/dashboard", "/budget", "/expenses", "/goals", "/chat", "/config", "/profile", "/guide"];
const SIDEBAR_ORDER = NAV.map((n) => n.href);

// The page we're coming from; templates re-mount on every navigation
let previous: string | null = null;

/** Where the new page slides in from (a CSS `translate`): the side (phones) or edge (sidebar) of the page it's ahead of or behind. */
function entranceFrom(from: string | null, to: string) {
  const phone = !window.matchMedia("(min-width: 1024px)").matches;
  const order = phone ? PHONE_ORDER : SIDEBAR_ORDER;
  const a = from ? order.findIndex((p) => from.startsWith(p)) : -1;
  const b = order.findIndex((p) => to.startsWith(p));
  if (a < 0 || b < 0 || a === b) return "0 12px";
  const dir = b > a ? 1 : -1;
  return phone ? `${dir * 36}px 0` : `0 ${dir * 28}px`;
}

/**
 * Re-mounts on every navigation, so each page arrives — from the direction you're moving in. A CSS
 * animation (.page-enter), so it stays smooth while the new page is still rendering its charts.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [from] = useState(() => (typeof window === "undefined" ? "0 12px" : entranceFrom(previous, pathname)));
  useEffect(() => {
    previous = pathname;
  }, [pathname]);

  return (
    <div className="page-enter" style={{ ["--page-from" as string]: from }}>
      {children}
    </div>
  );
}

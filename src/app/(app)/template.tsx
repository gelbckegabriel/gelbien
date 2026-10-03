"use client";

import { motion, useReducedMotion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV } from "@/components/shell/nav";

// The order of the pages in each layout's navigation: phones' bottom bar (then the rest), the sidebar
const PHONE_ORDER = ["/dashboard", "/budget", "/expenses", "/goals", "/chat", "/config", "/profile", "/guide"];
const SIDEBAR_ORDER = NAV.map((n) => n.href);

// The page we're coming from; templates re-mount on every navigation
let previous: string | null = null;

/** Where the new page slides in from: the side (phones) or edge (sidebar) of the page it's ahead of or behind. */
function entranceFrom(from: string | null, to: string) {
  const phone = !window.matchMedia("(min-width: 1024px)").matches;
  const order = phone ? PHONE_ORDER : SIDEBAR_ORDER;
  const a = from ? order.findIndex((p) => from.startsWith(p)) : -1;
  const b = order.findIndex((p) => to.startsWith(p));
  if (a < 0 || b < 0 || a === b) return { y: 12 };
  const dir = b > a ? 1 : -1;
  return phone ? { x: dir * 36 } : { y: dir * 28 };
}

/** Re-mounts on every navigation, so each page arrives — from the direction you're moving in. */
export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [from] = useState(() => (typeof window === "undefined" ? { y: 12 } : entranceFrom(previous, pathname)));
  useEffect(() => {
    previous = pathname;
  }, [pathname]);

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985, ...from }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30, opacity: { duration: 0.25 } }}
    >
      {children}
    </motion.div>
  );
}

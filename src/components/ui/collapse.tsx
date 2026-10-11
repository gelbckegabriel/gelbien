"use client";

import { AnimatePresence, motion } from "motion/react";
import { REVEAL } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A section that opens and closes in place (REVEAL), pushing what's under it along smoothly. In a
 * space-y list pass that space as `gap` (a padding class, e.g. "pb-5"): it opens with the section
 * instead of appearing all at once (the list's own margin is taken off).
 */
export function Collapse({ show, children, gap, className }: { show: boolean; children: React.ReactNode; gap?: string; className?: string }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={REVEAL}
          className={cn("overflow-hidden", gap && "mb-0", className)}
        >
          {gap ? <div className={gap}>{children}</div> : children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

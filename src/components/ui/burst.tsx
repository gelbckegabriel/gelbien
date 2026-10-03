"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * A gold ring bursting out of a button each time `trigger` goes up (count the presses). Place it
 * inside the button, which needs `relative`; it takes the button's rounded corners.
 */
export function Burst({ trigger, className }: { trigger: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <AnimatePresence>
      {trigger > 0 && (
        <motion.span
          key={trigger}
          aria-hidden
          className={cn("pointer-events-none absolute inset-0 rounded-[inherit] border-2 border-gold", className)}
          initial={{ scale: 1, opacity: 0.8 }}
          animate={{ scale: 1.9, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        />
      )}
    </AnimatePresence>
  );
}

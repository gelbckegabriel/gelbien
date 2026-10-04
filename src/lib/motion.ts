"use client";

/**
 * Gelbien's motion language, shared so every popup, menu and page moves the same way: panels unfold
 * from what was tapped, their rows follow one by one (sliding in, coming into focus), icons pop.
 * CSS counterparts for things motion doesn't render (Radix popovers, sheet contents) are the
 * `animate-pop-in` / `rise-in` / `rise-list` utilities in globals.css.
 */
import type { Transition, Variants } from "motion/react";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
export const SPRING: Transition = { type: "spring", stiffness: 420, damping: 32 };
export const SPRING_BOUNCY: Transition = { type: "spring", stiffness: 500, damping: 16 };

/** A row following its panel in (no blur: animating a filter repaints every frame) */
export const ROW: Variants = {
  hidden: { opacity: 0, transform: "translateX(16px)" },
  show: { opacity: 1, transform: "none", transition: { type: "spring", stiffness: 380, damping: 28 } },
};

/** An icon popping into place with a little twist */
export const ICON: Variants = {
  hidden: { scale: 0.4, rotate: -25 },
  show: { scale: 1, rotate: 0, transition: { ...SPRING_BOUNCY, delay: 0.05 } },
};

/** A soft gold glow blooming behind a panel */
export const GLOW: Variants = {
  hidden: { opacity: 0, scale: 0.3 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE_OUT } },
};

/**
 * A bar filling up: it grows from its left edge (scaleX, on the compositor) to the width set in its
 * style — animating the width itself would recalculate the page layout every frame. Give the element
 * `origin-left` and, for later changes, `transition-[width]`.
 */
export const growX = (delay = 0, stiffness = 120, damping = 22) => ({
  initial: { transform: "scaleX(0)" },
  animate: { transform: "scaleX(1)" },
  transition: { type: "spring" as const, stiffness, damping, delay },
});

/** With "reduce motion" on: rows and icons stay put */
export const STILL: Variants = { hidden: {}, show: {} };

// ---- where the last tap happened, so a popup can unfold from the button that opened it ----

let lastTap: { x: number; y: number; at: number } | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", (e) => (lastTap = { x: e.clientX, y: e.clientY, at: performance.now() }), { capture: true, passive: true });
}

/** The point (viewport px) of the tap or click that's opening something — none if it came from the keyboard. */
export function tapOrigin(): { x: number; y: number } | null {
  return lastTap && performance.now() - lastTap.at < 1000 ? { x: lastTap.x, y: lastTap.y } : null;
}

/** How far `p` is from the farthest corner of the screen — enough for anything growing from it to cover everything. */
export function coverRadius(p: { x: number; y: number }) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return Math.ceil(Math.max(Math.hypot(p.x, p.y), Math.hypot(vw - p.x, p.y), Math.hypot(p.x, vh - p.y), Math.hypot(vw - p.x, vh - p.y)));
}

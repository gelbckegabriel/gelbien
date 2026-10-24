"use client";

/**
 * Gelbien's motion language, shared so every popup, menu and page moves the same way: panels unfold
 * from what was tapped, their rows follow one by one (sliding in, coming into focus), icons pop.
 * CSS counterparts for things motion doesn't render (Radix popovers, sheet contents) are the
 * `animate-pop-in` / `rise-in` / `rise-list` utilities in globals.css.
 */
import type { Transition, Variants } from "motion/react";
import { useState } from "react";

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

/**
 * A section opening or closing (see Collapse): eased, never springy — a bouncing height drags
 * everything under it up and down. The fade is quicker so the content never shows half cut off.
 */
export const REVEAL: Transition = { height: { duration: 0.28, ease: EASE_OUT }, opacity: { duration: 0.18, ease: "easeOut" } };

/**
 * Keeps `el` where it is on screen while sections around it open and close — a switch's own details
 * unfolding is fine, but one above it collapsing would pull it from under the finger. For a moment its
 * scroll container follows the layout (until the user scrolls it themselves).
 */
export function holdInPlace(el: HTMLElement, ms = 450) {
  let scroller = el.parentElement;
  while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  if (!scroller) return;
  const box = scroller;
  const offset = () => el.getBoundingClientRect().top - box.getBoundingClientRect().top;
  const start = offset();
  const until = performance.now() + ms;
  let stopped = false;
  const stop = () => (stopped = true);
  box.addEventListener("wheel", stop, { once: true, passive: true });
  box.addEventListener("touchstart", stop, { once: true, passive: true });
  const tick = () => {
    if (stopped || !el.isConnected) return;
    const drift = offset() - start;
    if (Math.abs(drift) >= 0.5) box.scrollTop += drift;
    if (performance.now() < until) requestAnimationFrame(tick);
    else {
      box.removeEventListener("wheel", stop);
      box.removeEventListener("touchstart", stop);
    }
  };
  requestAnimationFrame(tick);
}

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

// ---- the intro (see .intro in globals.css): what it reveals waits for it to open ----

/**
 * How long (ms) until the intro parts, read from its own animation so the CSS stays the one source of
 * the timing — 0 when it isn't playing (a reload, "reduce motion") or has already opened.
 */
export function introRemaining() {
  if (typeof document === "undefined" || document.documentElement.dataset.intro !== "play") return 0;
  const parting = document.querySelector(".intro__half")?.getAnimations()[0];
  if (!parting) return 0;
  const delay = Number(parting.effect?.getTiming().delay ?? 0);
  return Math.max(0, delay - Number(parting.currentTime ?? delay));
}

/** introRemaining() as it was when this mounted: an entrance delayed by it lands as the intro opens. */
export function useIntroDelay() {
  const [ms] = useState(introRemaining);
  return ms;
}

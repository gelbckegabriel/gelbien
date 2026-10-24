"use client";

import { startTransition, useEffect, useLayoutEffect, useRef, useState } from "react";

/*
 * Heavy blocks (charts, mostly) take turns: one renders, the browser gets a moment — to paint, to take a
 * tap — then the next, top to bottom. A page change then only has to render what's cheap (headlines,
 * numbers, lists) before it shows, on a phone too; the charts fill in under it a moment later.
 */
const waiting: (() => void)[] = [];
let busy = false;

function next() {
  const run = waiting.shift();
  busy = !!run;
  run?.();
}
function enqueue(run: () => void) {
  waiting.push(run);
  if (!busy) {
    busy = true;
    setTimeout(next, 0);
  }
}
function dequeue(run: () => void) {
  const i = waiting.indexOf(run);
  if (i >= 0) waiting.splice(i, 1);
}

/**
 * Renders its children only after the page has shown, in turn with the other deferred blocks (as a
 * transition, so a tap is never kept waiting) — once it's within a screen of being seen, or, further
 * down, when the device has a moment to spare: a phone doesn't draw a page's worth of charts nobody has
 * scrolled to yet. Until then, and again whenever the page is hidden (pages
 * stay alive in the background — see template), it holds an empty card as tall as the content last was:
 * nothing jumps when the content arrives, and a page shown again lands exactly where it was scrolled.
 * The content fades in as it arrives.
 */
export function Deferred({ children, className, estimate = 280 }: { children: React.ReactNode; className?: string; estimate?: number }) {
  const [ready, setReady] = useState(false);
  // the placeholder's height: how tall the content was when the page was last hidden
  const [held, setHeld] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const height = useRef<number | null>(null);
  const turn = useRef<"waiting" | "rendering" | "done">("waiting");

  // shown — first mounted, or back from the background: queue up when near the screen (or later, idle);
  // hidden or gone: step out of the line
  useLayoutEffect(() => {
    turn.current = "waiting";
    const run = () => {
      turn.current = "rendering";
      startTransition(() => setReady(true));
    };
    let queued = false;
    const queue = () => {
      if (queued) return;
      queued = true;
      near.disconnect();
      clearTimeout(later);
      enqueue(run);
    };
    const near = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && queue(), { rootMargin: "100% 0px" });
    if (box.current) near.observe(box.current);
    const later = setTimeout(queue, 1500);
    return () => {
      near.disconnect();
      clearTimeout(later);
      dequeue(run);
      // it was the one rendering: let the next go
      if (turn.current === "rendering") setTimeout(next, 0);
      turn.current = "waiting";
      setHeld(height.current);
      setReady(false);
    };
  }, []);

  // its turn is over once the content is on screen
  useEffect(() => {
    if (!ready || turn.current !== "rendering") return;
    turn.current = "done";
    setTimeout(next, 0);
  }, [ready]);

  // how tall the content is, for the placeholder next time (zero once hidden: the last height stays)
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const watch = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) height.current = entry.contentRect.height;
    });
    watch.observe(el);
    return () => watch.disconnect();
  }, []);

  return (
    <div ref={box} className={className}>
      {ready ? <div className="h-full animate-fade-in">{children}</div> : <div aria-hidden className="card h-full" style={{ minHeight: held ?? estimate }} />}
    </div>
  );
}

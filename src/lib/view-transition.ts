"use client";

/**
 * The page transition in progress (see (app)/template.tsx), if any. Kept here because Safari has no
 * document.activeViewTransition: every transition starts through document.startViewTransition (React
 * calls it), so wrapping it once is enough to know.
 */
let active: ViewTransition | null = null;

if (typeof document !== "undefined" && typeof document.startViewTransition === "function") {
  const start = document.startViewTransition.bind(document);
  document.startViewTransition = ((arg?: Parameters<typeof start>[0]) => {
    const vt = start(arg);
    active = vt;
    const done = () => {
      if (active === vt) active = null;
    };
    vt.finished.then(done, done);
    return vt;
  }) as typeof document.startViewTransition;
}

export function activeTransition() {
  return active;
}

/**
 * Cut the running page transition short: as soon as it's ready (the browser has captured the page, a
 * frame), its animation ends and the next page can come in. Not before — React treats a transition
 * skipped while it's still preparing as aborted and reports an error.
 */
export function skipActiveTransition() {
  const vt = active;
  if (!vt) return;
  vt.ready.then(
    () => vt.skipTransition(),
    () => {},
  );
}

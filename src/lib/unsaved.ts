"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";

export interface UnsavedGuard {
  /** Persist the edits. Return false to stay put (e.g. validation failed). */
  save: () => boolean | void;
  /** The draft belongs to the selected month, so switching months would drop it too. */
  monthScoped?: boolean;
}

interface UnsavedState {
  /** The page form that currently has unsaved edits. */
  guard: React.RefObject<UnsavedGuard> | null;
  /** A navigation held back until the user saves or discards. */
  pending: (() => void) | null;
}

export const useUnsaved = create<UnsavedState>()(() => ({ guard: null, pending: null }));

/** True when leaving the page (or, with `month`, changing the month) would drop unsaved edits. */
export function hasUnsaved(month = false): boolean {
  const guard = useUnsaved.getState().guard;
  return !!guard && (!month || !!guard.current.monthScoped);
}

/** Show the "save changes?" prompt; `proceed` runs once the user saves or discards. */
export function askToLeave(proceed: () => void) {
  useUnsaved.setState({ pending: proceed });
}

/** While `dirty`, leaving the page asks to save first — in-app links, the month picker, and reload/close. */
export function useUnsavedChanges(dirty: boolean, guard: UnsavedGuard) {
  const ref = useRef(guard);
  useEffect(() => {
    ref.current = guard;
  });
  useEffect(() => {
    if (!dirty) return;
    useUnsaved.setState({ guard: ref });
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      if (useUnsaved.getState().guard === ref) useUnsaved.setState({ guard: null });
    };
  }, [dirty]);
}

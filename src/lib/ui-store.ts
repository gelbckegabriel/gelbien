"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Subscription, Transaction } from "./types";
import { currentMonth } from "./utils";

interface ExpenseDialogState {
  open: boolean;
  editing: Transaction | null;
  /** A receipt handed over from a global paste/drop */
  file: File | null;
  /** What the user typed last time, when that save failed — prefills the form */
  draft: Transaction | null;
  /** Same, for a split purchase (all its parts) */
  draftGroup: Transaction[] | null;
  /** bump to re-initialize the form when reopened */
  nonce: number;
}

interface UiState {
  month: string;
  setMonth: (m: string) => void;
  demo: boolean;
  setDemo: (on: boolean) => void;
  expense: ExpenseDialogState;
  openExpense: (opts?: { editing?: Transaction | null; file?: File | null; draft?: Transaction | null; draftGroup?: Transaction[] | null }) => void;
  closeExpense: () => void;
  subscription: { open: boolean; editing: Subscription | null; nonce: number };
  openSubscription: (editing?: Subscription | null) => void;
  closeSubscription: () => void;
  /** Month-end review sheet */
  review: { open: boolean; month: string };
  openReview: (month: string) => void;
  closeReview: () => void;
  /** The welcome tour (welcome-tour.tsx) */
  tour: { open: boolean; step: number };
  openTour: () => void;
  setTourStep: (step: number) => void;
  closeTour: () => void;
  /** View choices that stick in this browser, by control (useView): a list's order, a chart shown as a table… */
  views: Record<string, string>;
  setView: (key: string, value: string) => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      month: currentMonth(),
      setMonth: (month) => set({ month }),
      demo: false,
      setDemo: (demo) => set({ demo }),
      expense: { open: false, editing: null, file: null, draft: null, draftGroup: null, nonce: 0 },
      openExpense: (opts) =>
        set((s) => ({
          expense: {
            open: true,
            editing: opts?.editing ?? null,
            file: opts?.file ?? null,
            draft: opts?.draft ?? null,
            draftGroup: opts?.draftGroup ?? null,
            nonce: s.expense.nonce + 1,
          },
        })),
      closeExpense: () => set((s) => ({ expense: { ...s.expense, open: false, file: null, draft: null, draftGroup: null } })),
      subscription: { open: false, editing: null, nonce: 0 },
      openSubscription: (editing) => set((s) => ({ subscription: { open: true, editing: editing ?? null, nonce: s.subscription.nonce + 1 } })),
      closeSubscription: () => set((s) => ({ subscription: { ...s.subscription, open: false } })),
      review: { open: false, month: currentMonth() },
      openReview: (month) => set({ review: { open: true, month } }),
      closeReview: () => set((s) => ({ review: { ...s.review, open: false } })),
      tour: { open: false, step: 0 },
      openTour: () => set({ tour: { open: true, step: 0 } }),
      setTourStep: (step) => set((s) => ({ tour: { ...s.tour, step } })),
      closeTour: () => set((s) => ({ tour: { ...s.tour, open: false } })),
      views: {},
      setView: (key, value) => set((s) => ({ views: { ...s.views, [key]: value } })),
    }),
    {
      name: "gelbien.ui",
      partialize: (s) => ({ demo: s.demo, views: s.views }),
      // the budget limits' order was saved on its own before the other views
      merge: (saved, current) => {
        const { limitsOrder, views, ...rest } = (saved ?? {}) as Partial<UiState> & { limitsOrder?: string };
        return { ...current, ...rest, views: { ...(limitsOrder ? { "budget.limits": limitsOrder } : {}), ...views } };
      },
    },
  ),
);

/**
 * A view choice remembered in this browser — which way a list is sorted, whether a chart shows as a table.
 * `key` names the control; `fallback` holds until a choice is made (or when a saved one isn't among `allowed`).
 */
export function useView<T extends string>(key: string, fallback: T, allowed?: readonly T[]): [T, (value: T) => void] {
  const saved = useUi((s) => s.views[key]) as T | undefined;
  const setView = useUi((s) => s.setView);
  const value = saved !== undefined && (!allowed || allowed.includes(saved)) ? saved : fallback;
  return [value, (v: T) => setView(key, v)];
}

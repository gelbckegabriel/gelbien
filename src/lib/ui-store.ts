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
  /** How the Budget page lists spending limits: biggest spending first, or in category order */
  limitsOrder: "spent" | "category";
  setLimitsOrder: (order: "spent" | "category") => void;
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
      limitsOrder: "spent",
      setLimitsOrder: (limitsOrder) => set({ limitsOrder }),
    }),
    { name: "gelbien.ui", partialize: (s) => ({ demo: s.demo, limitsOrder: s.limitsOrder }) },
  ),
);

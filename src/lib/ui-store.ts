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
  /** bump to re-initialize the form when reopened */
  nonce: number;
}

interface UiState {
  month: string;
  setMonth: (m: string) => void;
  demo: boolean;
  setDemo: (on: boolean) => void;
  expense: ExpenseDialogState;
  openExpense: (opts?: { editing?: Transaction | null; file?: File | null }) => void;
  closeExpense: () => void;
  subscription: { open: boolean; editing: Subscription | null; nonce: number };
  openSubscription: (editing?: Subscription | null) => void;
  closeSubscription: () => void;
}

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      month: currentMonth(),
      setMonth: (month) => set({ month }),
      demo: false,
      setDemo: (demo) => set({ demo }),
      expense: { open: false, editing: null, file: null, nonce: 0 },
      openExpense: (opts) =>
        set((s) => ({
          expense: { open: true, editing: opts?.editing ?? null, file: opts?.file ?? null, nonce: s.expense.nonce + 1 },
        })),
      closeExpense: () => set((s) => ({ expense: { ...s.expense, open: false, file: null } })),
      subscription: { open: false, editing: null, nonce: 0 },
      openSubscription: (editing) => set((s) => ({ subscription: { open: true, editing: editing ?? null, nonce: s.subscription.nonce + 1 } })),
      closeSubscription: () => set((s) => ({ subscription: { ...s.subscription, open: false } })),
    }),
    { name: "gelbien.ui", partialize: (s) => ({ demo: s.demo }) },
  ),
);

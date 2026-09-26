"use client";

import { AnimatePresence, motion } from "motion/react";
import { useI18n } from "@/lib/i18n";
import { Button } from "./button";

/** Floating bar that appears while a form has unsaved changes. */
export function SaveBar({ show, label, onSave, onReset }: { show: boolean; label: string; onSave: () => void; onReset: () => void }) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="fixed inset-x-4 bottom-24 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-gold/30 bg-[#1a1812]/95 px-4 py-3 shadow-2xl shadow-black/60 backdrop-blur lg:bottom-8 lg:left-64"
        >
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-gold" />
          <span className="flex-1 text-sm text-ink-2">{label}</span>
          <Button size="sm" variant="ghost" onClick={onReset}>
            {t("common.reset")}
          </Button>
          <Button size="sm" variant="primary" onClick={onSave} className="px-5">
            {t("common.save")}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

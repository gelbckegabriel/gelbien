"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Popover } from "radix-ui";
import { useMemo, useState } from "react";
import { useDataset } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { useUi } from "@/lib/ui-store";
import { addMonths, cn, currentMonth, monthOf } from "@/lib/utils";

export function MonthPicker({ className }: { className?: string }) {
  const month = useUi((s) => s.month);
  const setMonth = useUi((s) => s.setMonth);
  const { t, f } = useI18n();
  const { data } = useDataset();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  const [dir, setDir] = useState(0);

  const withData = useMemo(() => new Set((data?.transactions ?? []).map((tx) => monthOf(tx.date))), [data?.transactions]);
  const go = (delta: number) => {
    setDir(delta);
    setMonth(addMonths(month, delta));
  };
  const now = currentMonth();

  return (
    <div className={cn("flex items-center gap-1 rounded-xl border border-line bg-surface/70 p-1 backdrop-blur", className)}>
      <button onClick={() => go(-1)} aria-label={t("month.prev")} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <Popover.Root
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setYear(Number(month.slice(0, 4)));
        }}
      >
        <Popover.Trigger className="relative flex h-8 min-w-[9.5rem] items-center justify-center gap-2 overflow-hidden rounded-lg px-2 text-sm font-medium text-ink hover:bg-white/5">
          <CalendarDays className="h-4 w-4 text-gold" />
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.span
              key={month}
              custom={dir}
              initial={{ y: dir >= 0 ? 14 : -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: dir >= 0 ? -14 : 14, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
            >
              {f.monthLong(month)}
            </motion.span>
          </AnimatePresence>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={8} align="center" className="z-50 w-72 rounded-2xl border border-line-strong bg-[#16161b] p-3 shadow-2xl shadow-black/60">
            <div className="mb-2 flex items-center justify-between">
              <button onClick={() => setYear((y) => y - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-ink">{year}</span>
              <button onClick={() => setYear((y) => y + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => {
                const m = `${year}-${String(i + 1).padStart(2, "0")}`;
                const selected = m === month;
                return (
                  <button
                    key={m}
                    onClick={() => {
                      setDir(m > month ? 1 : -1);
                      setMonth(m);
                      setOpen(false);
                    }}
                    className={cn(
                      "relative h-10 rounded-xl text-sm capitalize transition-colors",
                      selected ? "bg-gold text-[#1b1406] font-semibold" : "text-ink-2 hover:bg-white/5",
                      m === now && !selected && "ring-1 ring-gold/40",
                    )}
                  >
                    {f.monthShort(m)}
                    {withData.has(m) && !selected && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-gold/70" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => {
                setMonth(now);
                setOpen(false);
              }}
              className="mt-3 w-full rounded-xl border border-line py-2 text-sm text-ink-2 hover:bg-white/5"
            >
              {t("month.thisMonth")}
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <button onClick={() => go(1)} aria-label={t("month.next")} className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 hover:bg-white/5 hover:text-ink">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

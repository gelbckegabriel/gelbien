"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Popover } from "radix-ui";
import { useMemo, useState } from "react";
import { useDataset } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { useUi } from "@/lib/ui-store";
import { askToLeave, hasUnsaved } from "@/lib/unsaved";
import { addMonths, cn, currentMonth, monthOf } from "@/lib/utils";
import { MonthGrid } from "../ui/month-grid";

export function MonthPicker({ className }: { className?: string }) {
  const month = useUi((s) => s.month);
  const setMonthNow = useUi((s) => s.setMonth);
  const { t, f } = useI18n();
  const { data } = useDataset();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(() => Number(month.slice(0, 4)));
  const [dir, setDir] = useState(0);

  const withData = useMemo(() => new Set((data?.transactions ?? []).map((tx) => monthOf(tx.date))), [data?.transactions]);
  // A month-scoped draft (the budget editor) would be dropped by switching months.
  const setMonth = (m: string) => (hasUnsaved(true) ? askToLeave(() => setMonthNow(m)) : setMonthNow(m));
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
        <Popover.Trigger className="relative flex h-8 min-w-[6.5rem] items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-lg px-2 text-sm font-medium text-ink hover:bg-white/5 min-[360px]:min-w-[7.5rem] sm:min-w-[9.5rem]">
          {/* the smallest phones need the room for the month itself */}
          <CalendarDays className="h-4 w-4 text-gold max-[359px]:hidden" />
          <AnimatePresence mode="popLayout" initial={false} custom={dir}>
            <motion.span
              key={month}
              custom={dir}
              initial={{ y: dir >= 0 ? 14 : -14, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: dir >= 0 ? -14 : 14, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
            >
              {/* short label on phones so the top bar never wraps */}
              <span className="sm:hidden">
                {f.monthShort(month)} {month.slice(0, 4)}
              </span>
              <span className="hidden sm:inline">{f.monthLong(month)}</span>
            </motion.span>
          </AnimatePresence>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content sideOffset={8} align="center" className="z-50 w-72 origin-[var(--radix-popover-content-transform-origin)] rounded-2xl border border-line-strong bg-[#16161b] p-3 shadow-2xl shadow-black/60 data-[side=bottom]:animate-pop-in data-[side=top]:animate-pop-in-up motion-reduce:animate-none">
            <MonthGrid
              year={year}
              onYear={setYear}
              value={month}
              marked={withData}
              onPick={(m) => {
                setDir(m > month ? 1 : -1);
                setMonth(m);
                setOpen(false);
              }}
            />
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

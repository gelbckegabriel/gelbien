"use client";

import { animate, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { BudgetStatus } from "@/lib/finance";
import { growX } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Counts up/down to `value` whenever it changes. */
export function AnimatedNumber({ value, format, className }: { value: number; format: (n: number) => string; className?: string }) {
  const from = useRef(0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const controls = animate(from.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        from.current = v;
        setShown(v);
      },
    });
    return () => controls.stop();
  }, [value]);
  return <span className={className}>{format(shown)}</span>;
}

export function Progress({ value, tone = "gold", className, delay = 0 }: { value: number; tone?: "gold" | "good" | "warn" | "bad"; className?: string; delay?: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const fill = { gold: "bg-gold", good: "bg-good", warn: "bg-warn", bad: "bg-bad" }[tone];
  const track = { gold: "bg-gold/15", good: "bg-good/15", warn: "bg-warn/15", bad: "bg-bad/15" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full", track, className)}>
      <motion.div className={cn("h-full rounded-full origin-left transition-[width] duration-500 ease-out", fill)} style={{ width: `${pct * 100}%` }} {...growX(delay)} />
    </div>
  );
}

export const STATUS_TONE: Record<BudgetStatus, "good" | "warn" | "bad" | "gold"> = {
  within: "good",
  attention: "warn",
  over: "bad",
  none: "gold",
};

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "good" | "warn" | "bad" | "gold"; children: React.ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-white/5 text-ink-2 border-line",
    good: "bg-good-soft text-good border-good/25",
    warn: "bg-warn-soft text-warn border-warn/25",
    bad: "bg-bad-soft text-bad border-bad/25",
    gold: "bg-gold-soft text-gold-bright border-gold/25",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-xl", className)} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: React.ReactNode; title: React.ReactNode; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-gold/20 bg-gold-soft text-gold">{icon}</div>}
      <p className="text-base font-medium text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Delta({ value, goodWhenUp, format }: { value: number; goodWhenUp: boolean; format: (n: number) => string }) {
  if (!Number.isFinite(value) || Math.abs(value) < 0.005) return <span className="text-xs text-ink-3">—</span>;
  const up = value > 0;
  const good = up === goodWhenUp;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", good ? "text-good" : "text-bad")}>
      {up ? "▲" : "▼"} {format(Math.abs(value))}
    </span>
  );
}

export function ColorDot({ color, className }: { color: string; className?: string }) {
  return <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", className)} style={{ background: color }} />;
}

"use client";

import { BarChart3, Table2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "../ui/card";
import { AnimatedNumber, Delta } from "../ui/misc";

export const INK = { primary: "#f4f1ea", secondary: "#bdb8ad", muted: "#85817a", grid: "#ffffff0f", axis: "#ffffff1f", surface: "#131316" };
export const GOLD = "#d9b45f";
export const GOOD = "#36c47c";
export const BAD = "#f2605f";
export const PRIORITY_COLORS = { essential: "#36c47c", important: "#3987e5", superfluous: "#f2605f" } as const;

/** Gold sequential ramp (dark surface → bright gold) for heatmaps. */
export const GOLD_RAMP = ["#1d1b17", "#3a3120", "#5c4a24", "#836828", "#ad8a33", "#d4ad4c", "#f0cf7a"];

/** Square-root scale so one huge value (rent day) doesn't flatten everything else. */
export function rampIndex(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(GOLD_RAMP.length - 1, 1 + Math.floor(Math.sqrt(value / max) * (GOLD_RAMP.length - 1.0001)));
}

export function rampColor(value: number, max: number): string {
  return GOLD_RAMP[rampIndex(value, max)];
}

/** Ink that clears contrast on a ramp cell. */
export function rampInk(value: number, max: number): string {
  return rampIndex(value, max) >= 5 ? "#1b1406" : "#e4dfd3";
}

export const axisProps = {
  stroke: INK.axis,
  tick: { fill: INK.muted, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  kind?: "line" | "rect";
}

/** Values lead, labels follow; series keyed by a short stroke of their color. */
export function TooltipBox({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  return (
    <div className="pointer-events-none min-w-40 rounded-xl border border-line-strong bg-[#1a1a1f]/95 px-3 py-2.5 shadow-xl shadow-black/50 backdrop-blur">
      {title && <p className="mb-1.5 text-[11px] font-medium text-ink-3">{title}</p>}
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2 text-[13px]">
            {r.color && (
              <span
                className={cn("shrink-0", r.kind === "rect" ? "h-2.5 w-2.5 rounded-[3px]" : "h-0.5 w-3 rounded-full")}
                style={{ background: r.color }}
              />
            )}
            <span className="tabular font-semibold text-ink">{r.value}</span>
            <span className="truncate text-ink-3">{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind?: "line" | "rect" }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-xs text-ink-2">
          <span className={cn(i.kind === "line" ? "h-0.5 w-3.5 rounded-full" : "h-2.5 w-2.5 rounded-[3px]")} style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

/**
 * Chart plot area that fills whatever height its card has, without ever making the card taller.
 * The chart is absolutely positioned, so only `min` counts toward layout — neighbouring cards in a
 * row decide the height and the chart stretches to match (no empty gaps between cards).
 */
export function ChartArea({ min = "min-h-56", className, children }: { min?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("relative w-full flex-1", min, className)}>
      <div className="absolute inset-0">{children}</div>
    </div>
  );
}

/** Card with a chart ⇄ table toggle — every chart has an accessible table twin. */
export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
  className,
  action,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  legend?: React.ReactNode;
  table?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  const { t } = useI18n();
  const [showTable, setShowTable] = useState(false);
  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          <div className="flex items-center gap-1">
            {action}
            {table && (
              <button
                onClick={() => setShowTable((s) => !s)}
                className="grid h-8 w-8 place-items-center rounded-lg text-ink-3 transition hover:bg-white/5 hover:text-ink"
                aria-label={showTable ? t("common.chartView") : t("common.tableView")}
                title={showTable ? t("common.chartView") : t("common.tableView")}
              >
                {showTable ? <BarChart3 className="h-4 w-4" /> : <Table2 className="h-4 w-4" />}
              </button>
            )}
          </div>
        }
      />
      {legend && !showTable && <div className="-mt-1 mb-3">{legend}</div>}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={showTable ? "table" : "chart"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="flex min-h-0 flex-1 flex-col"
        >
          {showTable ? <div className="max-h-80 overflow-auto">{table}</div> : children}
        </motion.div>
      </AnimatePresence>
    </Card>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="w-full text-left text-[13px]">
      <thead className="sticky top-0 bg-surface">
        <tr className="border-b border-line text-ink-3">
          {head.map((h, i) => (
            <th key={h} className={cn("py-2 pr-3 font-medium", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-line/50 last:border-0">
            {r.map((c, j) => (
              <td key={j} className={cn("py-1.5 pr-3", j > 0 ? "tabular text-right text-ink" : "text-ink-2")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function StatTile({
  label,
  value,
  format,
  sub,
  delta,
  icon,
  tone,
  className,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  sub?: React.ReactNode;
  delta?: { value: number; goodWhenUp: boolean; format: (n: number) => string; label?: string };
  icon?: React.ReactNode;
  tone?: "good" | "bad" | "warn";
  className?: string;
}) {
  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] font-medium text-ink-3">{label}</p>
        {icon && <span className="text-ink-3">{icon}</span>}
      </div>
      <AnimatedNumber
        value={value}
        format={format}
        className={cn(
          "mt-1.5 block truncate text-[22px] font-semibold tracking-tight",
          tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink",
        )}
      />
      <div className="mt-1 flex min-h-4 min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-ink-3">
        {delta && (
          <span className="flex min-w-0 max-w-full items-center gap-1 whitespace-nowrap">
            <Delta value={delta.value} goodWhenUp={delta.goodWhenUp} format={delta.format} />
            {delta.label && <span className="hidden truncate sm:inline">{delta.label}</span>}
          </span>
        )}
        {/* Narrow tiles wrap between the " · " parts, never inside one (e.g. "Reserve" / "$18,000"). */}
        {typeof sub === "string"
          ? sub.split(" · ").map((part, i) => (
              <Fragment key={i}>
                {i > 0 && <span aria-hidden>·</span>}
                <span className="whitespace-nowrap">{part}</span>
              </Fragment>
            ))
          : sub}
      </div>
    </Card>
  );
}

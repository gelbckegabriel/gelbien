"use client";

import { cn } from "@/lib/utils";

/** Labelled range slider with a live value readout. */
export function Slider({
  label,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: number;
  display: React.ReactNode;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  hint?: React.ReactNode;
  className?: string;
}) {
  const pct = max > min ? ((Math.min(Math.max(value, min), max) - min) / (max - min)) * 100 : 0;
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium text-ink-2">{label}</span>
        <span className="tabular font-semibold text-ink">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(Math.max(value, min), max)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer appearance-none bg-transparent accent-[#d9b45f] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-bright [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_#d9b45f33]"
        style={{ background: `linear-gradient(to right, #d9b45f ${pct}%, #ffffff14 ${pct}%) center / 100% 6px no-repeat` }}
      />
      {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn, parseAmount, round2 } from "@/lib/utils";

/**
 * Labelled range slider whose value can also be typed: the readout is a small field
 * (e.g. "$ 1,250 /mo"). Dragging moves in `step`s within min–max; a typed value is exact
 * and may go past the slider's ends, within `inputMin`–`inputMax`.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  prefix,
  suffix,
  inputMin = min,
  inputMax = Infinity,
  hint,
  className,
}: {
  label: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** shown before the typed number, e.g. the currency symbol */
  prefix?: string;
  /** shown after it, e.g. "/mo" or "%" */
  suffix?: string;
  /** bounds for a typed value (default: min, and no upper limit) */
  inputMin?: number;
  inputMax?: number;
  hint?: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  const clamped = Math.min(Math.max(value, min), max);
  const pct = max > min ? ((clamped - min) / (max - min)) * 100 : 0;
  return (
    <div className={cn("block", className)}>
      <div className="mb-1 flex items-center justify-between gap-3 text-[13px]">
        <span id={`${id}-label`} className="font-medium text-ink-2">
          {label}
        </span>
        <ValueField value={value} onCommit={onChange} prefix={prefix} suffix={suffix} min={inputMin} max={inputMax} labelledBy={`${id}-label`} />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        aria-labelledby={`${id}-label`}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-6 w-full cursor-pointer appearance-none bg-transparent accent-[#d9b45f] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-bright [&::-webkit-slider-thumb]:shadow-[0_0_0_4px_#d9b45f33]"
        style={{ background: `linear-gradient(to right, #d9b45f ${pct}%, #ffffff14 ${pct}%) center / 100% 6px no-repeat` }}
      />
      {hint && <span className="mt-0.5 block text-xs text-ink-3">{hint}</span>}
    </div>
  );
}

/** The slider's readout: shows the formatted value, and the plain number to edit once focused. */
function ValueField({
  value,
  onCommit,
  prefix,
  suffix,
  min,
  max,
  labelledBy,
}: {
  value: number;
  onCommit: (v: number) => void;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
  labelledBy: string;
}) {
  const { f } = useI18n();
  // null while not editing: then the field shows the formatted value
  const [text, setText] = useState<string | null>(null);
  const cancelled = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const selectAll = useRef(false);
  const shown = text ?? f.num(value);
  // Select the plain number as soon as it replaces the formatted one, before any key can land
  // (a later frame would let the first keystroke mix with the old text).
  useLayoutEffect(() => {
    if (selectAll.current && text !== null) {
      selectAll.current = false;
      input.current?.select();
    }
  }, [text]);

  const commit = () => {
    const raw = text;
    setText(null);
    if (cancelled.current || raw === null || !raw.trim()) {
      cancelled.current = false;
      return;
    }
    const n = parseAmount(raw);
    if (Number.isFinite(n)) onCommit(round2(Math.min(Math.max(n, min), max)));
  };

  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-line bg-surface-2/60 px-2 transition-colors focus-within:border-gold/60 focus-within:ring-2 focus-within:ring-gold/20 hover:border-line-strong">
      {prefix && <span className="text-xs text-ink-3">{prefix}</span>}
      <input
        value={shown}
        inputMode="decimal"
        enterKeyHint="done"
        // Escape cancels the edit here; the sheet around it stays open (see Sheet)
        data-escape-local=""
        aria-labelledby={labelledBy}
        ref={input}
        onFocus={() => {
          selectAll.current = true;
          setText(String(value));
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            cancelled.current = true;
            e.currentTarget.blur();
          }
        }}
        // sized to its content; 16px on phones so iOS doesn't zoom in
        style={{ width: `${Math.max(2, shown.length) + 0.5}ch` }}
        className="tabular bg-transparent text-right text-base font-semibold text-ink outline-none sm:text-[13px]"
      />
      {suffix && <span className="text-xs text-ink-3">{suffix}</span>}
    </span>
  );
}

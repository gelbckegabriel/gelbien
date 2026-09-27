"use client";

import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// 16px text: iOS Safari zooms the page into any focused field smaller than that.
const control =
  "w-full rounded-xl border border-line bg-surface-2/80 px-3.5 text-base text-ink placeholder:text-ink-3 transition-colors " +
  "hover:border-line-strong focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/20 disabled:opacity-50";

export function Label({ children, htmlFor, hint, className }: { children: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; className?: string }) {
  return (
    <label htmlFor={htmlFor} className={cn("mb-1.5 flex items-center justify-between gap-2 text-[13px] font-medium text-ink-2", className)}>
      <span>{children}</span>
      {hint && <span className="text-xs font-normal text-ink-3">{hint}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, "h-11", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(control, "min-h-20 py-2.5", className)} {...props} />;
});

/** Native select — best UX on phones — styled to match. */
export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-11 appearance-none pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
    </div>
  );
});

export function Field({
  label,
  hint,
  children,
  className,
  htmlFor,
  highlight,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  /** gold ring when a value was filled by AI */
  highlight?: boolean;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Label htmlFor={htmlFor} hint={hint}>
        {label}
      </Label>
      <div className={cn("rounded-xl transition-shadow", highlight && "shadow-[0_0_0_1.5px_#d9b45f99]")}>{children}</div>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; tone?: "good" | "warn" | "bad" | "gold" }[];
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div role="radiogroup" className={cn("flex rounded-xl border border-line bg-surface-2/80 p-1", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative flex-1 whitespace-nowrap rounded-lg font-medium transition-colors",
              size === "sm" ? "h-7 px-2 text-xs" : "h-9 px-3 text-[13px]",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className={cn(
                  "absolute inset-0 rounded-lg border",
                  o.tone === "good" && "border-good/30 bg-good-soft",
                  o.tone === "warn" && "border-warn/30 bg-warn-soft",
                  o.tone === "bad" && "border-bad/30 bg-bad-soft",
                  (!o.tone || o.tone === "gold") && "border-gold/30 bg-gold-soft",
                )}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Switch({ checked, onChange, label, id }: { checked: boolean; onChange: (v: boolean) => void; label?: React.ReactNode; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-3 text-sm text-ink-2"
    >
      <span className={cn("relative h-6 w-11 rounded-full border transition-colors", checked ? "border-gold/50 bg-gold/80" : "border-line-strong bg-surface-3")}>
        <motion.span
          layout
          className={cn("absolute top-0.5 h-[18px] w-[18px] rounded-full shadow", checked ? "bg-[#1b1406]" : "bg-ink-2")}
          style={{ left: checked ? 22 : 2 }}
          transition={{ type: "spring", stiffness: 600, damping: 35 }}
        />
      </span>
      {label && <span className="group-hover:text-ink">{label}</span>}
    </button>
  );
}

/** Numeric money input that tolerates "12,50" and keeps the raw text while typing. */
export const MoneyInput = forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & { value: string; onChange: (v: string) => void; prefix?: string }
>(function MoneyInput({ value, onChange, prefix = "$", className, style, ...props }, ref) {
  // Pad the text past the symbol's real width — "R$" or "CA$" is much wider than "$".
  const prefixRef = useRef<HTMLSpanElement>(null);
  const [pad, setPad] = useState<number>();
  useLayoutEffect(() => {
    const el = prefixRef.current;
    if (!el) return;
    const measure = () => setPad(el.offsetLeft + el.offsetWidth + 8);
    measure();
    const observer = new ResizeObserver(measure); // re-measure once the web font loads
    observer.observe(el);
    return () => observer.disconnect();
  }, [prefix]);
  return (
    <div className="relative">
      <span ref={prefixRef} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">
        {prefix}
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,\-]/g, ""))}
        className={cn(control, "tabular h-11 pl-8", className)}
        style={{ paddingLeft: pad, ...style }}
        {...props}
      />
    </div>
  );
});

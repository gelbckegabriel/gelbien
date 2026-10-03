"use client";

import { CalendarDays, Check, ChevronDown, ChevronUp } from "lucide-react";
import { motion } from "motion/react";
import { Popover, Select as SelectPrimitive } from "radix-ui";
import { forwardRef, useId, useLayoutEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { cn, currentMonth } from "@/lib/utils";
import { MonthGrid } from "./month-grid";

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

export interface RichOption {
  value: string;
  label: string;
  /** Shown before the label, in the list and in the field (e.g. a category's icon) */
  icon?: React.ReactNode;
}

// Radix reserves "" for "nothing picked yet", so an explicit "none" option uses this instead
const NONE = "__none__";

/**
 * A select whose options carry an icon (categories, subcategories). Built on Radix Select, so it
 * keeps what the native one does well: keyboard, type-to-find, screen readers.
 */
export function RichSelect({
  value,
  onChange,
  options,
  placeholder,
  noneLabel,
  noneIcon,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: RichOption[];
  /** Shown while nothing is picked */
  placeholder: string;
  /** Adds a first option that picks "" (shown as the placeholder) — "All categories", "No subcategory" */
  noneLabel?: string;
  noneIcon?: React.ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const current = options.find((o) => o.value === value);
  const icon = current ? current.icon : value === "" && noneLabel ? noneIcon : undefined;
  const item = (o: RichOption) => (
    <SelectPrimitive.Item
      key={o.value}
      value={o.value}
      className="flex cursor-pointer select-none items-center gap-3 rounded-xl px-2.5 py-2 text-[15px] text-ink outline-none data-[highlighted]:bg-white/[0.06] data-[state=checked]:font-medium"
    >
      {o.icon}
      <span className="min-w-0 flex-1 truncate">
        {/* only the text: Radix copies it into the field once picked */}
        <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
      </span>
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-gold" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectPrimitive.Trigger id={id} aria-label={ariaLabel} className={cn(control, "flex h-11 items-center gap-2.5 pl-2 pr-3 text-left data-[placeholder]:text-ink-3", !icon && "pl-3.5", className)}>
        {icon}
        <span className="min-w-0 flex-1 truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 text-ink-3" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        {/* above the Sheet (z-50) these fields live in */}
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          collisionPadding={12}
          className="z-[60] max-h-[min(var(--radix-select-content-available-height),24rem)] w-[var(--radix-select-trigger-width)] min-w-56 origin-[var(--radix-select-content-transform-origin)] overflow-hidden rounded-2xl border border-line-strong bg-[#16161b] shadow-2xl shadow-black/60 data-[side=bottom]:animate-pop-in data-[side=top]:animate-pop-in-up motion-reduce:animate-none"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-ink-3">
            <ChevronUp className="h-4 w-4" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="rise-list p-1.5">
            {noneLabel && item({ value: NONE, label: noneLabel, icon: noneIcon })}
            {options.map(item)}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-ink-3">
            <ChevronDown className="h-4 w-4" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

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

/**
 * Month field ("YYYY-MM", or "" when empty). Replaces <input type="month">, which has no
 * picker in Safari on macOS or in Firefox — just a bare text box.
 */
export function MonthField({ value, onChange, min, className }: { value: string; onChange: (v: string) => void; min?: string; className?: string }) {
  const { t, f } = useI18n();
  const [open, setOpen] = useState(false);
  const startYear = () => Number((value || min || currentMonth()).slice(0, 4));
  const [year, setYear] = useState(startYear);
  return (
    <Popover.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setYear(startYear());
      }}
    >
      <Popover.Trigger className={cn(control, "flex h-11 items-center justify-between gap-2 text-left", !value && "text-ink-3", className)}>
        <span className="truncate">{value ? f.monthLong(value) : t("month.pick")}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-ink-3" />
      </Popover.Trigger>
      <Popover.Portal>
        {/* above the Sheet (z-50) these fields live in */}
        <Popover.Content sideOffset={8} align="start" collisionPadding={16} className="z-[60] w-72 origin-[var(--radix-popover-content-transform-origin)] rounded-2xl border border-line-strong bg-[#16161b] p-3 shadow-2xl shadow-black/60 data-[side=bottom]:animate-pop-in data-[side=top]:animate-pop-in-up motion-reduce:animate-none">
          <MonthGrid
            year={year}
            onYear={setYear}
            value={value}
            min={min}
            onPick={(m) => {
              onChange(m);
              setOpen(false);
            }}
          />
          {value && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="mt-3 w-full rounded-xl border border-line py-2 text-sm text-ink-2 hover:bg-white/5"
            >
              {t("common.clear")}
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

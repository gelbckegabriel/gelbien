"use client";

import { motion, type HTMLMotionProps } from "motion/react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "gold-fill text-[#1b1406] font-semibold shadow-[0_8px_24px_-8px_#d9b45f80] hover:brightness-110 disabled:brightness-75",
  secondary: "bg-surface-2 text-ink border border-line hover:bg-surface-3 hover:border-line-strong",
  outline: "border border-gold/40 text-gold-bright hover:bg-gold-soft",
  ghost: "text-ink-2 hover:text-ink hover:bg-white/5",
  danger: "bg-bad-soft text-bad border border-bad/30 hover:bg-bad/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-5 text-base gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
  "icon-sm": "h-8 w-8 rounded-lg",
};

/** Button look for links (<a>/<Link>) — never nest a <button> inside a link. */
export function buttonClasses(variant: Variant = "secondary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center whitespace-nowrap transition-[background,border,filter,color] duration-200",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "ref"> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", className, type = "button", disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap transition-[background,border,filter,color] duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
});

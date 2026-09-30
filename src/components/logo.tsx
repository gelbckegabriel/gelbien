"use client";

import { BRAND, MARK } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** The mark: an 11-sided gold coin with a G stamped in (see lib/brand.ts, shared with the icon files). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} aria-hidden>
      <rect x="0.5" y="0.5" width="63" height="63" rx="15.5" fill={BRAND.ink} stroke="#ffffff1f" />
      <polygon points={MARK.coin} fill={BRAND.gold} stroke={BRAND.gold} strokeWidth="2" strokeLinejoin="round" />
      <polygon points={MARK.rim} fill="none" stroke={BRAND.ink} strokeOpacity="0.3" strokeWidth="1" />
      <path d={MARK.g} fill="none" stroke={BRAND.ink} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="gold-text text-lg font-semibold tracking-tight">Gelbien</span>
    </span>
  );
}

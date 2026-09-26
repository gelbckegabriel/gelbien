"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // Unique gradient id per instance: a shared id resolves to whichever copy comes first,
  // and if that copy is inside a display:none container the gradient doesn't paint.
  const gid = `gelbien-g-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 64 64" className={cn("h-8 w-8", className)} aria-hidden>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6dea0" />
          <stop offset="0.5" stopColor="#d9b45f" />
          <stop offset="1" stopColor="#8f6c24" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="#131316" stroke="#ffffff14" />
      <circle cx="32" cy="32" r="21" fill="none" stroke={`url(#${gid})`} strokeWidth="4" />
      <path d="M41 25.5a11 11 0 1 0 1.2 9.5H32.5" fill="none" stroke={`url(#${gid})`} strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
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

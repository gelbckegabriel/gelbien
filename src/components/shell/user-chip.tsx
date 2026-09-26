"use client";

import { Sparkles } from "lucide-react";
import { useMode } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { GuardedLink } from "./unsaved";

export function Avatar({ name, picture, className }: { name: string; picture?: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return picture ? (
    // eslint-disable-next-line @next/next/no-img-element -- Google avatar URLs; no need for the image optimizer
    <img src={picture} alt="" referrerPolicy="no-referrer" className={cn("h-9 w-9 rounded-full border border-line object-cover", className)} />
  ) : (
    <span className={cn("grid h-9 w-9 place-items-center rounded-full border border-gold/30 bg-gold-soft text-xs font-semibold text-gold-bright", className)}>
      {initials || <Sparkles className="h-4 w-4" />}
    </span>
  );
}

export function UserChip({ compact }: { compact?: boolean }) {
  const { mode, session } = useMode();
  const { t } = useI18n();
  const user = session?.user;
  const name = user?.name ?? t("common.demo");
  return (
    <GuardedLink
      href="/profile"
      className={cn("flex items-center gap-3 rounded-xl transition-colors hover:bg-white/[0.04]", compact ? "p-0.5" : "border border-line p-2.5")}
      aria-label={t("nav.profile")}
    >
      <Avatar name={name} picture={user?.picture} className={compact ? "h-8 w-8" : undefined} />
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-ink">{name}</span>
          <span className="block truncate text-xs text-ink-3">{mode === "demo" ? t("prof.demoMode").split("—")[0].trim() : user?.email}</span>
        </span>
      )}
    </GuardedLink>
  );
}

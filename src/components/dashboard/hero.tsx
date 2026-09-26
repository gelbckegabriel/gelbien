"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { MonthSummary } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card } from "../ui/card";
import { AnimatedNumber, Badge, Delta } from "../ui/misc";

function Ring({ value, tone }: { value: number; tone: "gold" | "warn" | "bad" }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const color = { gold: "#d9b45f", warn: "#f2b233", bad: "#f2605f" }[tone];
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#ffffff0f" strokeWidth="10" />
      <motion.circle
        cx="60"
        cy="60"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.15 }}
        style={{ filter: `drop-shadow(0 0 10px ${color}55)` }}
      />
    </svg>
  );
}

export function Hero({ s, prevTotal, name }: { s: MonthSummary; prevTotal: number; name?: string }) {
  const { t, f } = useI18n();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dash.greeting.morning") : hour < 18 ? t("dash.greeting.afternoon") : t("dash.greeting.evening");
  const used = s.budgetTotal > 0 ? s.total / s.budgetTotal : 0;
  const tone = used > 1 ? "bad" : used >= 0.85 ? "warn" : "gold";
  const change = prevTotal > 0 ? (s.total - prevTotal) / prevTotal : NaN;

  return (
    <Card className="p-6 sm:p-7">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-3">
            {greeting}
            {name ? `, ${name.split(" ")[0]}` : ""} ·{" "}
            <span className="text-ink-2">{t("dash.spentIn", { month: f.monthLong(s.month) })}</span>
          </p>
          <AnimatedNumber value={s.total} format={f.money} className="mt-2 block text-5xl font-semibold tracking-tight text-ink sm:text-[56px]" />
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {s.budgetTotal > 0 ? (
              <span className="text-ink-3">{t("dash.ofBudget", { budget: f.money0(s.budgetTotal) })}</span>
            ) : (
              <Link href="/budget" className="text-gold underline-offset-2 hover:underline">
                {t("dash.setBudget")} →
              </Link>
            )}
            {Number.isFinite(change) && (
              <span className="inline-flex items-center gap-1.5 text-ink-3">
                <Delta value={change} goodWhenUp={false} format={f.pct} /> {t("dash.vsLast")}
              </span>
            )}
          </div>
          {s.budgetTotal > 0 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <Badge tone={s.remaining >= 0 ? "good" : "bad"} className="px-3 py-1 text-[13px]">
                {s.remaining >= 0 ? t("dash.left", { amount: f.money(s.remaining) }) : t("dash.overBy", { amount: f.money(-s.remaining) })}
              </Badge>
              {s.isCurrent && s.daysLeft > 0 && (
                <span className="text-[13px] text-ink-2">
                  {s.remaining > 0 ? t("dash.perDay", { amount: f.money(s.perDayLeft), days: s.daysLeft }) : t("dash.perDayOver", { days: s.daysLeft })}
                </span>
              )}
              {s.isPast && <Badge>{t("dash.pastMonth")}</Badge>}
            </div>
          )}
        </div>
        {s.budgetTotal > 0 && (
          <div className="relative mx-auto h-36 w-36 shrink-0 sm:mx-0 sm:h-40 sm:w-40">
            <Ring value={used} tone={tone} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedNumber value={used} format={f.pct} className={cn("text-3xl font-semibold", tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : "text-ink")} />
              <span className="text-[11px] text-ink-3">
                {s.isCurrent ? `${s.elapsed}/${s.days}` : f.monthShort(s.month)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

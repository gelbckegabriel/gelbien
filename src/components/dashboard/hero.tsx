"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { MonthSummary } from "@/lib/finance";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card } from "../ui/card";
import { AnimatedNumber, Badge, Delta, fitFont } from "../ui/misc";

function Ring({ value, tone }: { value: number; tone: "gold" | "warn" | "bad" }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  const color = { gold: "#d9b45f", warn: "#f2b233", bad: "#f2605f" }[tone];
  return (
    <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
      <circle cx="60" cy="60" r={r} fill="none" stroke="#ffffff0f" strokeWidth="10" />
      {/* the glow: a wide faint stroke under the arc. (A drop-shadow filter here flickered as a dark box on phones while it animated.) */}
      {[
        { width: 18, opacity: 0.16 },
        { width: 10, opacity: 1 },
      ].map((l) => (
        <motion.circle
          key={l.width}
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeOpacity={l.opacity}
          strokeWidth={l.width}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ type: "spring", stiffness: 60, damping: 18, delay: 0.15 }}
        />
      ))}
    </svg>
  );
}

export function Hero({ s, prevTotal, name, bills = 0 }: { s: MonthSummary; prevTotal: number; name?: string; /** still to pay this month */ bills?: number }) {
  const { t, f } = useI18n();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? t("dash.greeting.morning") : hour < 18 ? t("dash.greeting.afternoon") : t("dash.greeting.evening");
  const used = s.budgetTotal > 0 ? s.total / s.budgetTotal : 0;
  const tone = used > 1 ? "bad" : used >= 0.85 ? "warn" : "gold";
  const change = prevTotal > 0 ? (s.total - prevTotal) / prevTotal : NaN;
  // bills still to pay this month are already spoken for
  const left = s.remaining - bills;
  const perDay = s.daysLeft > 0 ? left / s.daysLeft : 0;

  return (
    <Card className="p-6 sm:p-7">
{/* a soft glow from a gradient, not a blur filter: blurred layers flicker as dark boxes on phones while the card repaints */}
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,#d9b45f26,transparent_70%)]" />
      <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-3">
            {greeting}
            {name ? `, ${name.split(" ")[0]}` : ""} ·{" "}
            <span className="text-ink-2">{t("dash.spentIn", { month: f.monthLong(s.month) })}</span>
          </p>
          {/* its own size container: the amount shrinks to fit beside the ring instead of running into it */}
          <div className="@container [--hero-size:48px] sm:[--hero-size:56px]">
            <AnimatedNumber
              smallCents
              value={s.total}
              format={f.money}
              style={{ fontSize: fitFont(f.money(s.total), "var(--hero-size)") }}
              className="mt-2 block whitespace-nowrap font-semibold tracking-tight text-ink"
            />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {s.budgetTotal > 0 ? (
              <span className="text-ink-3">{t("dash.ofBudget", { budget: f.amount(s.budgetTotal) })}</span>
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
              <Badge tone={left >= 0 ? "good" : "bad"} className="px-3 py-1 text-[13px]">
                {left >= 0 ? t("dash.left", { amount: f.money(left) }) : t("dash.overBy", { amount: f.money(-left) })}
              </Badge>
              {bills > 0 && <span className="text-[13px] text-ink-3">{t("dash.afterBills", { amount: f.amount(bills) })}</span>}
              {s.isCurrent && s.daysLeft > 0 && (
                <span className="text-[13px] text-ink-2">
                  {left > 0 ? t("dash.perDay", { amount: f.money(perDay), days: s.daysLeft }) : t("dash.perDayOver", { days: s.daysLeft })}
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

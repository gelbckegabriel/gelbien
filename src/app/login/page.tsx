"use client";

import { BookOpen, Camera, FolderLock, Gauge, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Logo } from "@/components/logo";
import { Button, buttonClasses } from "@/components/ui/button";
import { useSession } from "@/lib/data/hooks";
import { LOCALES, useI18n, usePrefs } from "@/lib/i18n";
import type { Locale } from "@/lib/types";
import { useUi } from "@/lib/ui-store";
import { useHydrated } from "@/lib/use-media";
import { cn, currentMonth } from "@/lib/utils";

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

/** Decorative floating preview of the dashboard */
function HeroPreview() {
  const { f, t } = useI18n();
  const bars = [38, 52, 44, 66, 58, 72, 49, 81, 63, 55, 70, 46];
  return (
    <div className="relative mx-auto h-72 w-full max-w-md">
      <motion.div
        className="card absolute left-0 top-4 w-64 p-4"
        initial={{ opacity: 0, y: 20, rotate: -4 }}
        animate={{ opacity: 1, y: 0, rotate: -4 }}
        transition={{ delay: 0.2, type: "spring", stiffness: 120, damping: 18 }}
      >
        <p className="text-xs text-ink-3">{t("dash.spentIn", { month: f.monthLong(currentMonth()) })}</p>
        <p className="mt-1 text-3xl font-semibold text-ink">{f.money(2184.4)}</p>
        <div className="mt-3 h-2 rounded-full bg-gold/15">
          <motion.div className="h-full w-[62%] origin-left rounded-full bg-gold" initial={{ transform: "scaleX(0)" }} animate={{ transform: "scaleX(1)" }} transition={{ delay: 0.8, duration: 1.2, ease: [0.16, 1, 0.3, 1] }} />
        </div>
        <p className="mt-2 text-xs text-good">{t("dash.left", { amount: f.money(1315.6) })}</p>
      </motion.div>
      <motion.div
        className="card absolute bottom-2 right-0 w-72 p-4 animate-float"
        initial={{ opacity: 0, y: 30, rotate: 3 }}
        animate={{ opacity: 1, y: 0, rotate: 3 }}
        transition={{ delay: 0.4, type: "spring", stiffness: 120, damping: 18 }}
      >
        <div className="flex h-24 items-end gap-1.5">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              className={cn("flex-1 rounded-t-[4px]", i === 7 ? "bg-bad" : "bg-good/80")}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 0.7 + i * 0.05, type: "spring", stiffness: 140, damping: 16 }}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-3">{t("dash.trend.subtitle")}</p>
      </motion.div>
    </div>
  );
}

function LoginInner() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const { t, locale } = useI18n();
  const setLocale = usePrefs((s) => s.setLocale);
  const setDemo = useUi((s) => s.setDemo);
  const { data: session, isFetchedAfterMount } = useSession();

  // Only on the server's answer: a cached "signed in" may be a login Google has since expired,
  // and the dashboard would send us straight back here.
  useEffect(() => {
    if (isFetchedAfterMount && session?.user) router.replace("/dashboard");
  }, [isFetchedAfterMount, session?.user, router]);

  const error = params.get("error");
  const errorText =
    error === "scope"
      ? t("login.error.scope")
      : error === "config"
        ? t("login.notConfigured")
        : error === "api"
          ? t("login.error.api")
          : error === "storage"
            ? t("login.error.storage")
            : error === "cookie"
            ? t("login.error.cookie")
            : error === "denied"
              ? t("login.error.denied")
              : error === "expired"
                ? t("err.session")
                : error
                  ? t("login.error.generic")
                  : null;
  const configured = session?.googleConfigured ?? true;

  const features = [
    { icon: Camera, title: t("login.f1.title"), body: t("login.f1.body") },
    { icon: Gauge, title: t("login.f2.title"), body: t("login.f2.body") },
    { icon: FolderLock, title: t("login.f3.title"), body: t("login.f3.body") },
  ];

  if (!hydrated) return null;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="app-aura" />
      <div className="relative z-10 mx-auto grid min-h-dvh max-w-6xl items-center gap-10 px-4 py-10 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div className="order-2 hidden lg:order-1 lg:block">
          <HeroPreview />
          <div className="mt-10 space-y-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                className="flex gap-4"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold-soft text-gold">
                  <f.icon className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-medium text-ink">{f.title}</p>
                  <p className="text-sm text-ink-3">{f.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <motion.div
          className="order-1 mx-auto w-full max-w-md lg:order-2"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 24 }}
        >
          <div className="card p-7 sm:p-9">
            <div className="flex items-center justify-between">
              <Logo />
              <div className="flex rounded-lg border border-line p-0.5">
                {(Object.keys(LOCALES) as Locale[]).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLocale(l)}
                    className={cn("rounded-md px-2 py-1 text-xs font-medium uppercase", l === locale ? "bg-gold-soft text-gold-bright" : "text-ink-3 hover:text-ink")}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <h1 className="mt-8 text-3xl font-semibold tracking-tight text-ink">{t("login.title")}</h1>
            <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t("login.subtitle")}</p>

            {errorText && (
              <div className="mt-6 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm text-bad">{errorText}</div>
            )}

            <div className="mt-8 space-y-3">
              {configured ? (
                <a href={`/api/auth/login?returnTo=/dashboard&locale=${locale}`} className={buttonClasses("primary", "lg", "w-full gap-2")}>
                  <GoogleGlyph /> {t("login.google")}
                </a>
              ) : (
                <Button variant="primary" size="lg" className="w-full" disabled>
                  <GoogleGlyph /> {t("login.google")}
                </Button>
              )}
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={() => {
                  setDemo(true);
                  router.push("/dashboard");
                }}
              >
                <Sparkles className="h-4 w-4 text-gold" /> {t("login.demo")}
              </Button>
              <p className="text-center text-xs text-ink-3">{t("login.demoHint")}</p>
              <Link href="/guide" className="flex items-center justify-center gap-1.5 pt-1 text-[13px] font-medium text-gold hover:underline">
                <BookOpen className="h-4 w-4" /> {t("guide.title")}
              </Link>
            </div>

            {!configured && <p className="mt-6 rounded-xl border border-line bg-surface-2 px-4 py-3 text-xs text-ink-3">{t("login.notConfigured")}</p>}
            <p className="mt-8 border-t border-line pt-5 text-xs leading-relaxed text-ink-3">{t("login.privacy")}</p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

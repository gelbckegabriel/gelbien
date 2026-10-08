"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Locale } from "../types";
import en, { type MessageKey, type Messages } from "./en";
import fr from "./fr";
import pt from "./pt";

export const LOCALES: Record<Locale, { label: string; intl: string; flag: string }> = {
  pt: { label: "Português", intl: "pt-BR", flag: "🇧🇷" },
  en: { label: "English", intl: "en-CA", flag: "🇨🇦" },
  fr: { label: "Français", intl: "fr-CA", flag: "🇫🇷" },
};

const DICTS: Record<Locale, Messages> = { en, pt, fr };

export const CURRENCIES = ["CAD", "USD", "BRL", "EUR", "GBP", "AUD", "MXN"];

interface PrefsState {
  locale: Locale;
  currency: string;
  setLocale: (l: Locale) => void;
  setCurrency: (c: string) => void;
}

function guessLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("pt")) return "pt";
  if (lang.startsWith("fr")) return "fr";
  return "en";
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      locale: guessLocale(),
      currency: "CAD",
      setLocale: (locale) => set({ locale }),
      setCurrency: (currency) => set({ currency }),
    }),
    { name: "gelbien.prefs" },
  ),
);

export type TFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>) {
  const template = DICTS[locale][key] ?? en[key] ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    vars[name] === undefined ? `{${name}}` : String(vars[name]),
  );
}

const capitalize = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

export function makeFormatters(locale: Locale, currency: string) {
  const intl = LOCALES[locale].intl;
  const money2 = new Intl.NumberFormat(intl, { style: "currency", currency, currencyDisplay: "narrowSymbol", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = new Intl.NumberFormat(intl, { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat(intl, { style: "currency", currency, currencyDisplay: "narrowSymbol", notation: "compact", maximumFractionDigits: 1 });
  const pctFmt = new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 0 });
  const pct1Fmt = new Intl.NumberFormat(intl, { style: "percent", maximumFractionDigits: 1 });
  const num = new Intl.NumberFormat(intl, { maximumFractionDigits: 1 });
  const monthLong = new Intl.DateTimeFormat(intl, { month: "long", year: "numeric" });
  const monthOnly = new Intl.DateTimeFormat(intl, { month: "long" });
  const monthShort = new Intl.DateTimeFormat(intl, { month: "short" });
  const dayFmt = new Intl.DateTimeFormat(intl, { weekday: "short", day: "numeric", month: "short" });
  const dayLong = new Intl.DateTimeFormat(intl, { weekday: "long", day: "numeric", month: "long" });
  const dateShort = new Intl.DateTimeFormat(intl, { day: "numeric", month: "short" });
  const weekdayShort = new Intl.DateTimeFormat(intl, { weekday: "short" });
  const rel = new Intl.RelativeTimeFormat(intl, { numeric: "auto" });

  const amount = (n: number) => (Math.round(n * 100) % 100 === 0 ? money0 : money2).format(n);

  const toDate = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  };

  return {
    intl,
    currency,
    /** "$", "R$", "€" — for inputs that show the symbol beside the number */
    currencySymbol: money0.formatToParts(0).find((p) => p.type === "currency")?.value ?? "$",
    /** $1,234.56 */
    money: (n: number) => money2.format(n),
    /** $4.50, $1,200 — to the cent, without the ".00" on whole amounts. Money is never rounded for display. */
    amount,
    /** +$12.00 / −$12.00 */
    moneySigned: (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "") + money2.format(Math.abs(n)),
    /** $245.60, $1.2K — exact under a thousand, abbreviated (visibly, with K/M) above: axes and tight cells */
    moneyCompact: (n: number) => (Math.abs(n) < 1000 ? amount(n) : compact.format(n)),
    pct: (x: number) => pctFmt.format(Number.isFinite(x) ? x : 0),
    pct1: (x: number) => pct1Fmt.format(Number.isFinite(x) ? x : 0),
    num: (n: number) => num.format(n),
    monthLong: (month: string) => capitalize(monthLong.format(toDate(`${month}-01`))),
    monthName: (month: string) => capitalize(monthOnly.format(toDate(`${month}-01`))),
    monthShort: (month: string) => capitalize(monthShort.format(toDate(`${month}-01`)).replace(".", "")),
    day: (iso: string) => capitalize(dayFmt.format(toDate(iso))),
    dayLong: (iso: string) => capitalize(dayLong.format(toDate(iso))),
    dateShort: (iso: string) => dateShort.format(toDate(iso)),
    weekday: (index: number) => capitalize(weekdayShort.format(new Date(2026, 1, 1 + index))), // 2026-02-01 is a Sunday
    relative: (isoTimestamp: string) => {
      const diff = (Date.parse(isoTimestamp) - Date.now()) / 1000;
      const abs = Math.abs(diff);
      if (abs < 60) return rel.format(Math.round(diff), "second");
      if (abs < 3600) return rel.format(Math.round(diff / 60), "minute");
      if (abs < 86400) return rel.format(Math.round(diff / 3600), "hour");
      return rel.format(Math.round(diff / 86400), "day");
    },
  };
}

export type Formatters = ReturnType<typeof makeFormatters>;

export function useI18n() {
  const locale = usePrefs((s) => s.locale);
  const currency = usePrefs((s) => s.currency);
  return useMemo(() => {
    const t: TFn = (key, vars) => translate(locale, key, vars);
    return { locale, t, f: makeFormatters(locale, currency) };
  }, [locale, currency]);
}

export type { MessageKey };

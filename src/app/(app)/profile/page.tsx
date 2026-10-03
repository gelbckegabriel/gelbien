"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, CheckCircle2, Database, Download, ExternalLink, Eye, EyeOff, FileSpreadsheet, HardDrive, KeyRound,
  Loader2, LogIn, LogOut, RefreshCw, RotateCcw, Sparkles, Tags, Trash2, Upload, XCircle,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { clearCachedData, useSignOut } from "@/components/shell/load-error";
import { GuardedLink } from "@/components/shell/unsaved";
import { Avatar } from "@/components/shell/user-chip";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, CardHeader, PageHeader, Stagger } from "@/components/ui/card";
import { Field, Input, MoneyInput, Segmented, Select } from "@/components/ui/form";
import { Badge } from "@/components/ui/misc";
import { Slider } from "@/components/ui/slider";
import { friendlyAiError, testConnection } from "@/lib/ai/client";
import { activeAi, ANTHROPIC_MODELS, GEMINI_MODELS, useAi, type AiProvider } from "@/lib/ai/config";
import { toCsv } from "@/lib/csv";
import { useDataset, useMode, useMutate, useRefresh } from "@/lib/data/hooks";
import { clearDemo, resetDemo } from "@/lib/data/sources";
import { hasBuiltInTranslations, paymentTranslations } from "@/lib/defaults";
import { downloadFile } from "@/lib/files";
import { CURRENCIES, LOCALES, translate, useI18n, usePrefs } from "@/lib/i18n";
import { importMoneySheet, mergeImport, type ImportResult } from "@/lib/import-xlsx";
import type { Dataset, Locale } from "@/lib/types";
import { askToLeave, hasUnsaved, useUnsavedChanges } from "@/lib/unsaved";
import { datasetSchema } from "@/lib/validation";
import { cn, parseAmount, round2 } from "@/lib/utils";

export default function ProfilePage() {
  const { t } = useI18n();
  // Reachable even when the data can't be loaded (see AppShell) — then only what works without it
  const { data } = useDataset();
  return (
    <div>
      <PageHeader title={t("prof.title")} />
      <Stagger className="space-y-4">
        <AccountCard />
        {data && <PreferencesCard />}
        <AiCard />
        {data && <DataCard />}
        <CacheCard />
      </Stagger>
    </div>
  );
}

function AccountCard() {
  const { t } = useI18n();
  const { mode, session } = useMode();
  const leave = useSignOut();
  const user = session?.user;

  return (
    <Card className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <Avatar name={user?.name ?? t("common.demo")} picture={user?.picture} className="h-14 w-14" />
        <div className="min-w-0">
          <p className="flex items-center gap-2">
            <span className="truncate text-base font-medium text-ink">{user?.name ?? t("common.demo")}</span>
            {mode === "google" ? <Badge tone="good">{t("common.connected")}</Badge> : <Badge tone="gold">{t("common.demo")}</Badge>}
          </p>
          <p className="truncate text-sm text-ink-3">{user?.email ?? t("prof.demoMode")}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mode === "demo" && session?.googleConfigured && (
          <a href="/api/auth/login?returnTo=/profile" className={buttonClasses("primary", "md")}>
            <LogIn className="h-4 w-4" /> {t("prof.signIn")}
          </a>
        )}
        <GuardedLink href="/config" className={buttonClasses("secondary", "md")}>
          <Tags className="h-4 w-4" /> {t("nav.config")}
        </GuardedLink>
        <Button variant="ghost" onClick={leave} className="ml-auto sm:ml-0">
          <LogOut className="h-4 w-4" /> {t("prof.signOut")}
        </Button>
      </div>
    </Card>
  );
}

function PreferencesCard() {
  const ds = useDataset().data as Dataset;
  const { t } = useI18n();
  const router = useRouter();
  const mutate = useMutate();
  const setLocale = usePrefs((s) => s.setLocale);
  const setCurrency = usePrefs((s) => s.setCurrency);
  const [goal, setGoal] = useState(String(ds.settings.savingsGoal || ""));
  const dirty = parseAmount(goal) !== ds.settings.savingsGoal;

  const saveSettings = (patch: Partial<Dataset["settings"]>, silent = false) => {
    mutate.mutate({ op: "saveSettings", settings: { ...ds.settings, ...patch } });
    if (!silent) toast.success(t("prof.savedPrefs"));
  };
  const saveAmounts = () => saveSettings({ savingsGoal: round2(parseAmount(goal)) });
  useUnsavedChanges(dirty, { save: saveAmounts });

  return (
    <Card>
      <CardHeader title={t("prof.prefs")} />
      {/* One grid of individual fields: every row lines up across both columns. */}
      <div className="grid items-start gap-x-8 gap-y-5 lg:grid-cols-2">
        <Field label={t("prof.language")}>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(LOCALES) as Locale[]).map((l) => (
              <button
                key={l}
                onClick={() => {
                  setLocale(l);
                  saveSettings({ locale: l }, true);
                  // Built-in categories and payment methods stay in the language the sheet was created in — offer to switch them too.
                  if (l !== ds.settings.locale && (hasBuiltInTranslations(ds.categories, l) || paymentTranslations(ds.settings.paymentMethods, l).length)) {
                    const review = () => router.push("/config?translate=1");
                    toast(translate(l, "cfg.tr.offer"), {
                      duration: 10_000,
                      action: { label: translate(l, "cfg.tr.review"), onClick: () => (hasUnsaved() ? askToLeave(review) : review()) },
                    });
                  }
                }}
                className={cn(
                  "flex h-11 items-center justify-center gap-2 rounded-xl border text-sm transition-colors",
                  ds.settings.locale === l ? "border-gold/50 bg-gold-soft text-gold-bright" : "border-line bg-surface-2/60 text-ink-2 hover:border-line-strong",
                )}
              >
                <span aria-hidden>{LOCALES[l].flag}</span> {LOCALES[l].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("prof.currency")}>
          <Select
            value={ds.settings.currency}
            onChange={(e) => {
              setCurrency(e.target.value);
              saveSettings({ currency: e.target.value }, true);
            }}
          >
            {[...new Set([ds.settings.currency, ...CURRENCIES])].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t("prof.goal")}>
          <MoneyInput value={goal} onChange={setGoal} placeholder="0.00" />
        </Field>
        <Slider
          label={t("prof.warnAt")}
          value={Math.round(ds.settings.warnAt * 100)}
          min={50}
          max={100}
          step={5}
          suffix="%"
          inputMin={10}
          inputMax={100}
          onChange={(v) => saveSettings({ warnAt: v / 100 }, true)}
        />
        <AnimatePresence>
          {dirty && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-end lg:self-end">
              <Button variant="primary" onClick={saveAmounts}>
                {t("common.save")}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}

function AiCard() {
  const { t } = useI18n();
  const ai = useAi();
  const [show, setShow] = useState(false);
  const [test, setTest] = useState<{ state: "idle" | "testing" | "ok" | "fail"; msg?: string }>({ state: "idle" });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.location.hash === "#ai") ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  const runTest = async () => {
    const cfg = activeAi(ai);
    if (!cfg) return;
    setTest({ state: "testing" });
    try {
      await testConnection(cfg);
      setTest({ state: "ok" });
    } catch (err) {
      setTest({ state: "fail", msg: friendlyAiError(err) });
    }
  };

  const isAnthropic = ai.provider === "anthropic";
  const key = isAnthropic ? ai.anthropicKey : ai.geminiKey;

  return (
    <div ref={ref} id="ai">
      <Card>
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-gold" /> {t("prof.ai.title")}
            </span>
          }
          subtitle={t("prof.ai.subtitle")}
        />
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
          <div className="space-y-4">
            <Field label={t("prof.ai.provider")}>
              <Segmented
                value={ai.provider}
                onChange={(provider: AiProvider) => {
                  ai.set({ provider });
                  setTest({ state: "idle" });
                }}
                options={[
                  { value: "off" as AiProvider, label: t("prof.ai.off") },
                  { value: "anthropic" as AiProvider, label: t("prof.ai.anthropic") },
                  { value: "gemini" as AiProvider, label: t("prof.ai.gemini") },
                ]}
              />
            </Field>

            {ai.provider !== "off" && (
              <motion.div key={`hint-${ai.provider}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <p className="text-[13px] leading-relaxed text-ink-3">{isAnthropic ? t("prof.ai.anthropicHint") : t("prof.ai.geminiHint")}</p>
                {!isAnthropic && (
                  <p className="flex gap-2 rounded-xl border border-warn/25 bg-warn-soft px-3 py-2.5 text-[13px] text-warn">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {t("prof.ai.geminiWarning")}
                  </p>
                )}
              </motion.div>
            )}
          </div>
          <AnimatePresence mode="wait">
            {ai.provider !== "off" && (
              <motion.div key={ai.provider} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="space-y-4">
                <Field
                  label={t("prof.ai.key")}
                  hint={
                    <a
                      href={isAnthropic ? "https://console.anthropic.com/settings/keys" : "https://aistudio.google.com/apikey"}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-gold hover:underline"
                    >
                      {t("prof.ai.getKey")} <ExternalLink className="h-3 w-3" />
                    </a>
                  }
                >
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
                    <Input
                      type={show ? "text" : "password"}
                      value={key}
                      onChange={(e) => {
                        ai.set(isAnthropic ? { anthropicKey: e.target.value } : { geminiKey: e.target.value });
                        setTest({ state: "idle" });
                      }}
                      placeholder={isAnthropic ? "sk-ant-…" : "AIza…"}
                      autoComplete="off"
                      spellCheck={false}
                      className="pl-10 pr-10 font-mono text-base sm:text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink"
                      aria-label="toggle"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-3">{t("prof.ai.keyLocal")}</p>
                </Field>
                <Field label={t("prof.ai.model")}>
                  <Select
                    value={isAnthropic ? ai.anthropicModel : ai.geminiModel}
                    onChange={(e) => ai.set(isAnthropic ? { anthropicModel: e.target.value } : { geminiModel: e.target.value })}
                  >
                    {(isAnthropic ? ANTHROPIC_MODELS : GEMINI_MODELS).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label} — {m.price}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-center gap-3">
                  <Button onClick={runTest} disabled={!key.trim() || test.state === "testing"}>
                    {test.state === "testing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {test.state === "testing" ? t("prof.ai.testing") : t("prof.ai.test")}
                  </Button>
                  {test.state === "ok" && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-good">
                      <CheckCircle2 className="h-4 w-4" /> {t("prof.ai.testOk")}
                    </span>
                  )}
                  {test.state === "fail" && (
                    <span className="inline-flex items-center gap-1.5 text-sm text-bad">
                      <XCircle className="h-4 w-4 shrink-0" /> {t("prof.ai.testFail", { error: test.msg ?? "" })}
                    </span>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </div>
  );
}

function DataCard() {
  const ds = useDataset().data as Dataset;
  const { isFetching } = useDataset();
  const { mode } = useMode();
  const { t, f, locale } = useI18n();
  const mutate = useMutate();
  const refresh = useRefresh();
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const xlsxInput = useRef<HTMLInputElement>(null);
  const jsonInput = useRef<HTMLInputElement>(null);

  const readXlsx = async (file: File) => {
    setBusy(true);
    try {
      const { default: readExcelFile } = await import("read-excel-file/browser");
      const sheets = await readExcelFile(file);
      const result = importMoneySheet(sheets as never, locale);
      if (!result.stats.transactions && !result.stats.categories) throw new Error("no Money Sheet tabs found");
      setPending(result);
    } catch (err) {
      toast.error(t("prof.data.importFail", { error: (err as Error).message }));
    } finally {
      setBusy(false);
    }
  };

  const applyImport = (how: "replace" | "merge") => {
    if (!pending) return;
    const current: Omit<Dataset, "meta"> = { ...ds };
    const data =
      how === "replace"
        ? {
            ...pending.data,
            // The workbook has no accounts/goals — never wipe the ones set up in the app.
            accounts: ds.accounts,
            balances: ds.balances,
            goals: ds.goals,
            settings: { ...pending.data.settings, locale: ds.settings.locale, currency: ds.settings.currency, checkInDay: ds.settings.checkInDay, tourSeen: ds.settings.tourSeen },
          }
        : mergeImport(current, pending.data);
    const preview = pending;
    mutate.mutate({ op: "replaceAll", data }, { onFailure: () => setPending(preview) });
    setPending(null);
    toast.success(t("prof.data.importDone"));
  };

  const restore = async (file: File) => {
    try {
      const parsed = datasetSchema.parse(JSON.parse(await file.text()));
      if (!window.confirm(t("prof.data.restoreConfirm"))) return;
      mutate.mutate({ op: "replaceAll", data: parsed });
      toast.success(t("prof.data.importDone"));
    } catch (err) {
      toast.error(t("prof.data.importFail", { error: (err as Error).message.slice(0, 120) }));
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Database className="h-4 w-4 text-gold" /> {t("prof.data.title")}
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          {mode === "google" && ds.meta.spreadsheetUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-good/20 bg-good-soft/50 p-3">
              <FileSpreadsheet className="h-8 w-8 shrink-0 text-good" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{t("prof.data.sheet")}</p>
                <p className="text-xs text-ink-3">{t("prof.data.lastSync", { time: f.relative(ds.meta.syncedAt) })}</p>
              </div>
              <Button size="icon-sm" variant="ghost" onClick={() => refresh()} aria-label={t("prof.data.sync")}>
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin text-gold")} />
              </Button>
              <a href={ds.meta.spreadsheetUrl} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
                <ExternalLink className="h-4 w-4" /> {t("common.open")}
              </a>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const data: Omit<Dataset, "meta"> = {
                  transactions: ds.transactions,
                  categories: ds.categories,
                  budgets: ds.budgets,
                  incomes: ds.incomes,
                  subscriptions: ds.subscriptions,
                  accounts: ds.accounts,
                  balances: ds.balances,
                  goals: ds.goals,
                  settings: ds.settings,
                };
                downloadFile(`gelbien-backup-${stamp}.json`, JSON.stringify(data, null, 2), "application/json");
              }}
            >
              <Download className="h-4 w-4" /> {t("prof.data.exportJson")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => downloadFile(`gelbien-expenses-${stamp}.csv`, toCsv(ds.transactions), "text/csv;charset=utf-8")}
            >
              <Download className="h-4 w-4" /> {t("prof.data.exportCsv")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => jsonInput.current?.click()}>
              <RotateCcw className="h-4 w-4" /> {t("prof.data.restore")}
            </Button>
            <input
              ref={jsonInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void restore(file);
              }}
            />
          </div>
        </div>
        <div className="h-full rounded-xl border border-dashed border-line-strong p-4">
          <p className="text-sm font-medium text-ink">{t("prof.data.import")}</p>
          <p className="mt-0.5 text-xs text-ink-3">{t("prof.data.importHint")}</p>
          <AnimatePresence mode="wait">
            {pending ? (
              <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 space-y-3">
                <p className="rounded-lg bg-gold-soft px-3 py-2 text-[13px] text-gold-bright">
                  {t("prof.data.importFound", { tx: pending.stats.transactions, cats: pending.stats.categories, subs: pending.stats.subscriptions })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" onClick={() => applyImport("merge")}>
                    {t("prof.data.importMerge")}
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => applyImport("replace")}>
                    {t("prof.data.importReplace")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
                <Button size="sm" variant="outline" onClick={() => xlsxInput.current?.click()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} .xlsx
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
          <input
            ref={xlsxInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readXlsx(file);
            }}
          />
        </div>
      </div>
    </Card>
  );
}

function cachedBytes(): number {
  let total = 0;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("gelbien.")) total += (localStorage.getItem(k)?.length ?? 0) * 2;
    }
  } catch {
    /* ignore */
  }
  return total;
}

function CacheCard() {
  const { t, locale } = useI18n();
  const { mode } = useMode();
  const qc = useQueryClient();
  const refresh = useRefresh();
  const [bytes, setBytes] = useState(() => cachedBytes());
  const size = bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

  const clear = () => {
    clearCachedData();
    if (mode === "google") refresh();
    setBytes(cachedBytes());
    toast.success(t("prof.cache.cleared"));
  };

  const resetDemoData = () => {
    clearDemo();
    const fresh = resetDemo(locale);
    qc.setQueriesData({ queryKey: ["dataset", "demo"] }, () => fresh);
    setBytes(cachedBytes());
    toast.success(t("prof.demo.resetDone"));
  };

  return (
    <Card className="flex flex-col gap-4 xl:flex-row xl:items-center">
      <CardHeader
        className="mb-0 min-w-0 flex-1"
        title={
          <span className="inline-flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-gold" /> {t("prof.cache.title")}
          </span>
        }
        subtitle={t("prof.cache.subtitle")}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{t("prof.cache.size", { size })}</Badge>
        <Button size="sm" variant="secondary" onClick={clear}>
          <Trash2 className="h-4 w-4" /> {t("prof.cache.clear")}
        </Button>
        {mode === "demo" && (
          <Button size="sm" variant="outline" onClick={resetDemoData}>
            <RotateCcw className="h-4 w-4" /> {t("prof.demo.reset")}
          </Button>
        )}
      </div>
    </Card>
  );
}

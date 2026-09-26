"use client";

import { AlertTriangle, CheckCircle2, Info, RefreshCw, Sparkles, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { friendlyAiError, generateInsights, type AiInsight } from "@/lib/ai/client";
import { useActiveAi } from "@/lib/ai/config";
import { localInsights, type LocalInsight } from "@/lib/finance";
import { useI18n, type Formatters, type MessageKey, type TFn } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, CardHeader } from "../ui/card";
import { Skeleton } from "../ui/misc";

const MONEY_VARS = new Set(["spent", "budget", "amount", "avg", "goal", "monthly"]);
const PCT_VARS = new Set(["pct", "spentPct", "elapsedPct", "rate"]);

function formatInsight(i: LocalInsight, t: TFn, f: Formatters) {
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(i.vars)) {
    if (typeof v === "number" && MONEY_VARS.has(k)) vars[k] = f.money0(v);
    else if (typeof v === "number" && PCT_VARS.has(k)) vars[k] = f.pct(v);
    else if (k === "date" && typeof v === "string") vars[k] = f.dateShort(v);
    else vars[k] = v;
  }
  return {
    title: t(`ins.${i.key}.title` as MessageKey, vars),
    body: t(`ins.${i.key}.body` as MessageKey, vars),
  };
}

const TONE = {
  good: { icon: CheckCircle2, cls: "text-good bg-good-soft border-good/20" },
  warn: { icon: AlertTriangle, cls: "text-warn bg-warn-soft border-warn/20" },
  bad: { icon: XCircle, cls: "text-bad bg-bad-soft border-bad/20" },
  info: { icon: Info, cls: "text-gold bg-gold-soft border-gold/20" },
};

function InsightRow({ tone, title, body, index }: { tone: keyof typeof TONE; title: string; body: string; index: number }) {
  const { icon: Icon, cls } = TONE[tone];
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, type: "spring", stiffness: 300, damping: 28 }}
      className="flex gap-3"
    >
      <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border", cls)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{body}</p>
      </div>
    </motion.li>
  );
}

const cacheKey = (month: string, provider: string, ds: Dataset) =>
  `gelbien.insights.${provider}.${month}.${ds.transactions.length}.${ds.transactions.reduce((a, t) => a + t.amount, 0).toFixed(2)}`;

export function Insights({ ds, month }: { ds: Dataset; month: string }) {
  const { t, f, locale } = useI18n();
  const ai = useActiveAi();
  const local = localInsights(ds, month);
  const [fresh, setFresh] = useState<{ key: string; items: AiInsight[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ key: string; msg: string } | null>(null);
  const key = ai ? `${cacheKey(month, ai.provider, ds)}.${locale}` : null;
  const cached = useMemo(() => {
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as AiInsight[]) : null;
    } catch {
      return null;
    }
  }, [key]);
  const aiItems = key ? (fresh?.key === key ? fresh.items : cached) : null;
  const errorText = error?.key === key ? error.msg : null;

  const run = async () => {
    if (!ai || !key) return;
    setLoading(true);
    setError(null);
    try {
      const items = await generateInsights(ai, ds, month, locale);
      setFresh({ key, items });
      try {
        localStorage.setItem(key, JSON.stringify(items));
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError({ key, msg: friendlyAiError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> {aiItems ? t("dash.ins.ai") : t("dash.ins.title")}
          </span>
        }
        action={
          ai ? (
            <Button size="sm" variant={aiItems ? "ghost" : "outline"} onClick={run} disabled={loading}>
              {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {aiItems ? t("dash.ins.refresh") : t("dash.ins.generate")}
            </Button>
          ) : null
        }
      />
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <p className="text-xs text-gold">{t("dash.ins.thinking")}</p>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </motion.div>
        ) : (
          <motion.ul key={aiItems ? "ai" : "local"} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {aiItems
              ? aiItems.map((i, n) => <InsightRow key={n} index={n} tone={i.tone} title={i.title} body={i.body} />)
              : local.map((i, n) => <InsightRow key={i.id} index={n} tone={i.tone} {...formatInsight(i, t, f)} />)}
            {!aiItems && local.length === 0 && <p className="text-sm text-ink-3">{t("dash.ins.none")}</p>}
          </motion.ul>
        )}
      </AnimatePresence>
      {errorText && <p className="mt-4 rounded-xl border border-bad/25 bg-bad-soft px-3 py-2 text-xs text-bad">{t("chat.error", { error: errorText })}</p>}
      {!ai && (
        <Link href="/profile#ai" className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-gold/30 px-3 py-2.5 text-xs text-gold hover:bg-gold-soft">
          <Sparkles className="h-3.5 w-3.5 shrink-0" /> {t("dash.ins.connect")}
        </Link>
      )}
    </Card>
  );
}

"use client";

import { ArrowUp, MessageCirclePlus, Sparkles, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LogoMark } from "@/components/logo";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { friendlyAiError, streamChat, type ChatTurn } from "@/lib/ai/client";
import { ANTHROPIC_MODELS, GEMINI_MODELS, useActiveAi } from "@/lib/ai/config";
import { useDataset, useMode } from "@/lib/data/hooks";
import { useI18n } from "@/lib/i18n";
import type { Dataset } from "@/lib/types";
import { cn } from "@/lib/utils";

const MAX_TURNS = 30;

function useChatHistory(key: string) {
  const [turns, setTurns] = useState<ChatTurn[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "[]") as ChatTurn[];
    } catch {
      return [];
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(turns.slice(-MAX_TURNS)));
    } catch {
      /* ignore */
    }
  }, [key, turns]);
  return [turns, setTurns] as const;
}

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose-chat text-[14px] leading-relaxed text-ink-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: (p) => <p className="mb-3 last:mb-0" {...p} />,
          strong: (p) => <strong className="font-semibold text-ink" {...p} />,
          ul: (p) => <ul className="mb-3 list-disc space-y-1 pl-5 marker:text-gold/70" {...p} />,
          ol: (p) => <ol className="mb-3 list-decimal space-y-1 pl-5 marker:text-ink-3" {...p} />,
          h1: (p) => <h3 className="mb-2 mt-4 text-base font-semibold text-ink" {...p} />,
          h2: (p) => <h3 className="mb-2 mt-4 text-base font-semibold text-ink" {...p} />,
          h3: (p) => <h4 className="mb-2 mt-3 text-sm font-semibold text-ink" {...p} />,
          a: (p) => <a className="text-gold underline underline-offset-2" target="_blank" rel="noreferrer" {...p} />,
          code: (p) => <code className="rounded bg-white/5 px-1 py-0.5 text-[13px] text-gold-bright" {...p} />,
          table: (p) => (
            <div className="mb-3 overflow-x-auto rounded-xl border border-line">
              <table className="w-full text-left text-[13px]" {...p} />
            </div>
          ),
          th: (p) => <th className="border-b border-line bg-white/[0.03] px-3 py-2 font-medium text-ink" {...p} />,
          td: (p) => <td className="tabular border-b border-line/50 px-3 py-1.5" {...p} />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatPage() {
  const ds = useDataset().data as Dataset;
  const ai = useActiveAi();
  const { mode } = useMode();
  const { t, locale } = useI18n();
  const [turns, setTurns] = useChatHistory(`gelbien.chat.${mode}`);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  if (!ai) {
    return (
      <div>
        <PageHeader title={t("chat.title")} subtitle={t("chat.subtitle")} />
        <Card>
          <EmptyState
            icon={<Sparkles className="h-6 w-6" />}
            title={t("chat.connectTitle")}
            body={t("chat.connectBody")}
            action={
              <Link href="/profile#ai" className={buttonClasses("primary", "md")}>
                {t("chat.connectCta")}
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const modelLabel = [...ANTHROPIC_MODELS, ...GEMINI_MODELS].find((m) => m.id === ai.model)?.label ?? ai.model;

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    setError(null);
    setInput("");
    const history: ChatTurn[] = [...turns, { role: "user", content }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setStreaming(true);
    const controller = new AbortController();
    abort.current = controller;
    try {
      await streamChat(ai, ds, locale, history.slice(-MAX_TURNS), (delta) => {
        setTurns((cur) => {
          const next = [...cur];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + delta };
          return next;
        });
      }, controller.signal);
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(friendlyAiError(err));
        setTurns((cur) => (cur[cur.length - 1]?.content ? cur : cur.slice(0, -1)));
      }
    } finally {
      setStreaming(false);
      abort.current = null;
      inputRef.current?.focus();
    }
  };

  const suggestions = [t("chat.s1"), t("chat.s2"), t("chat.s3"), t("chat.s4")];

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
      <PageHeader
        title={t("chat.title")}
        subtitle={
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-gold" /> {modelLabel}
          </span>
        }
        action={
          turns.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => setTurns([])} disabled={streaming}>
              <MessageCirclePlus className="h-4 w-4" /> {t("chat.new")}
            </Button>
          )
        }
      />

      <div className="flex-1 space-y-5 pb-4">
        {turns.length === 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center pt-8 text-center">
            <LogoMark className="h-14 w-14" />
            <p className="mt-4 max-w-md text-sm text-ink-3">{t("chat.subtitle")}</p>
            <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {suggestions.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  whileHover={{ y: -2 }}
                  onClick={() => send(s)}
                  className="card p-4 text-left text-sm text-ink-2 transition-colors hover:border-gold/30 hover:text-ink"
                >
                  {s}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {turns.map((turn, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 32 }}
              className={cn("flex gap-3", turn.role === "user" && "justify-end")}
            >
              {turn.role === "assistant" && <LogoMark className="mt-0.5 h-7 w-7 shrink-0" />}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3",
                  turn.role === "user" ? "rounded-br-md border border-gold/25 bg-gold-soft text-[14px] text-ink" : "card rounded-tl-md",
                )}
              >
                {turn.role === "assistant" ? (
                  turn.content ? (
                    <Markdown text={turn.content} />
                  ) : (
                    <span className="flex gap-1 py-1.5">
                      {[0, 1, 2].map((d) => (
                        <motion.span
                          key={d}
                          className="h-1.5 w-1.5 rounded-full bg-gold"
                          animate={{ opacity: [0.2, 1, 0.2] }}
                          transition={{ repeat: Infinity, duration: 1.1, delay: d * 0.18 }}
                        />
                      ))}
                    </span>
                  )
                ) : (
                  <p className="whitespace-pre-wrap">{turn.content}</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {error && <p className="rounded-xl border border-bad/25 bg-bad-soft px-4 py-3 text-sm text-bad">{t("chat.error", { error })}</p>}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-24 z-10 lg:bottom-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
          className="card flex items-end gap-2 p-2 shadow-2xl shadow-black/50 focus-within:border-gold/40"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            rows={1}
            placeholder={t("chat.placeholder")}
            className="max-h-40 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-3 focus:outline-none"
          />
          {streaming ? (
            <Button type="button" size="icon" variant="secondary" onClick={() => abort.current?.abort()} aria-label={t("chat.stop")}>
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button type="submit" size="icon" variant="primary" disabled={!input.trim()} aria-label={t("chat.send")}>
              <ArrowUp className="h-5 w-5" />
            </Button>
          )}
        </form>
        <p className="mt-2 text-center text-[11px] text-ink-3">{t("chat.disclaimer")}</p>
      </div>
    </div>
  );
}

"use client";

import {
  ArrowUp,
  BookOpen,
  CircleHelp,
  LayoutDashboard,
  Lightbulb,
  ListOrdered,
  MessageCircle,
  PiggyBank,
  PlayCircle,
  Plus,
  Repeat,
  Sparkles,
  Tags,
  Target,
  UserRound,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { GuardedLink } from "@/components/shell/unsaved";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, PageHeader, Stagger } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { useDataset, useMode } from "@/lib/data/hooks";
import { useI18n, type MessageKey } from "@/lib/i18n";
import { GUIDE_SECTIONS, loadGuide, type GuideContent, type GuideSectionId } from "@/lib/i18n/guide";
import { useUi } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

// What each section links to: its page, and that page's name in the nav
const SECTION: Record<GuideSectionId, { icon: typeof Sparkles; href?: string; page?: MessageKey }> = {
  start: { icon: Sparkles },
  add: { icon: Plus },
  dashboard: { icon: LayoutDashboard, href: "/dashboard", page: "nav.dashboard" },
  expenses: { icon: ListOrdered, href: "/expenses", page: "nav.expenses" },
  budget: { icon: PiggyBank, href: "/budget", page: "nav.budget" },
  recurring: { icon: Repeat, href: "/budget", page: "nav.budget" },
  goals: { icon: Target, href: "/goals", page: "nav.goals" },
  chat: { icon: MessageCircle, href: "/chat", page: "nav.chat" },
  categories: { icon: Tags, href: "/config", page: "nav.config" },
  profile: { icon: UserRound, href: "/profile", page: "nav.profile" },
  concepts: { icon: BookOpen },
  faq: { icon: CircleHelp },
};

/** Text with **bold** labels, as written in the guide files */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-ink">
            {part}
          </strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

/** The section being read, for the contents: the last one whose top has scrolled up under the top bar */
function useActiveSection(ready: boolean) {
  const [active, setActive] = useState<GuideSectionId>("start");
  useEffect(() => {
    if (!ready) return;
    const update = () => {
      let current: GuideSectionId = GUIDE_SECTIONS[0];
      for (const id of GUIDE_SECTIONS) {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= 140) current = id;
      }
      // scrolled to the very end: the short last section can't reach the top, but it's the one on screen
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = GUIDE_SECTIONS[GUIDE_SECTIONS.length - 1];
      setActive(current);
    };
    // after this render, not during it
    const first = setTimeout(update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      clearTimeout(first);
      window.removeEventListener("scroll", update);
    };
  }, [ready]);
  return active;
}

export default function GuidePage() {
  const { t, locale } = useI18n();
  const { mode } = useMode();
  const { data } = useDataset();
  const openTour = useUi((s) => s.openTour);
  const [loaded, setLoaded] = useState<{ locale: string; guide: GuideContent } | null>(null);
  const guide = loaded?.locale === locale ? loaded.guide : null;
  const active = useActiveSection(!!guide);
  // Readable before signing in (linked from the login page): no data, no links into the app
  const signedIn = mode === "google" || mode === "demo";

  useEffect(() => {
    let live = true;
    void loadGuide(locale).then((g) => live && setLoaded({ locale, guide: g }));
    return () => {
      live = false;
    };
  }, [locale]);

  // Arriving at /guide#budget (the ? button): the sections only exist once the text has loaded
  useEffect(() => {
    if (!guide) return;
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id) document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [guide]);

  return (
    <div id="top">
      <PageHeader
        title={t("guide.title")}
        subtitle={t("guide.subtitle")}
        action={
          signedIn && data ? (
            <Button size="sm" variant="outline" onClick={openTour}>
              <PlayCircle className="h-4 w-4" /> {t("guide.replay")}
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <nav aria-label={t("guide.contents")} className="lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t("guide.contents")}</p>
          {/* chips on phones, a list beside the text on wide screens */}
          <ul className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
            {GUIDE_SECTIONS.map((id) => {
              const Icon = SECTION[id].icon;
              const on = active === id && !!guide;
              return (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className={cn(
                      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] transition-colors lg:rounded-xl lg:border-transparent lg:px-2.5 lg:py-2",
                      on ? "border-gold/40 bg-gold-soft text-gold-bright" : "border-line text-ink-2 hover:text-ink lg:hover:bg-white/[0.04]",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", on ? "text-gold" : "text-ink-3")} />
                    {guide ? guide[id].title : <Skeleton className="h-3.5 w-24" />}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-4">
          {!guide ? (
            Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-64" />)
          ) : (
            // the sections cascade in, like the cards on every other page
            <Stagger className="space-y-4">
              {GUIDE_SECTIONS.map((id) => {
                const s = guide[id];
                const { icon: Icon, href, page } = SECTION[id];
                return (
                  <Card key={id} id={id} className="scroll-mt-24 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-gold/25 bg-gold-soft text-gold">
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg font-semibold tracking-tight text-ink">{s.title}</h2>
                        <p className="text-sm text-ink-3">{s.summary}</p>
                      </div>
                    </div>

                    {s.intro.length > 0 && (
                      <div className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-2">
                        {s.intro.map((p, i) => (
                          <p key={i}>
                            <Rich text={p} />
                          </p>
                        ))}
                      </div>
                    )}

                    {s.steps && (
                      <>
                        <h3 className="mb-3 mt-6 text-[11px] font-medium uppercase tracking-wide text-ink-3">{t("guide.steps")}</h3>
                        <ol className="space-y-4">
                          {s.steps.map((st, i) => (
                            <li key={i} className="flex gap-3">
                              <span className="tabular grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-[13px] font-semibold text-gold-bright">{i + 1}</span>
                              <div className="min-w-0 pt-0.5">
                                <p className="font-medium text-ink">{st.title}</p>
                                <p className="mt-1 text-sm leading-relaxed text-ink-2">
                                  <Rich text={st.body} />
                                </p>
                              </div>
                            </li>
                          ))}
                        </ol>
                      </>
                    )}

                    {s.terms && (
                      <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                        {s.terms.map((term) => (
                          <div key={term.term}>
                            <dt className="font-medium text-ink">{term.term}</dt>
                            <dd className="mt-1 text-sm leading-relaxed text-ink-2">{term.body}</dd>
                          </div>
                        ))}
                      </dl>
                    )}

                    {s.faq && (
                      <div className="mt-4 divide-y divide-line/60">
                        {s.faq.map((item) => (
                          <details key={item.q} className="group py-3">
                            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-ink [&::-webkit-details-marker]:hidden">
                              {item.q}
                              <Plus className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-45" />
                            </summary>
                            <p className="mt-2 text-sm leading-relaxed text-ink-2">{item.a}</p>
                          </details>
                        ))}
                      </div>
                    )}

                    {s.tips && (
                      <div className="mt-6 rounded-xl border border-gold/20 bg-gold-soft/40 p-4">
                        <p className="mb-2 flex items-center gap-2 text-[13px] font-medium text-gold-bright">
                          <Lightbulb className="h-4 w-4" /> {t("guide.tips")}
                        </p>
                        <ul className="space-y-1.5 text-sm leading-relaxed text-ink-2">
                          {s.tips.map((tip, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold" aria-hidden />
                              <span>
                                <Rich text={tip} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      {signedIn && href && page && (
                        <GuardedLink href={href} className={buttonClasses("secondary", "sm")}>
                          <Icon className="h-4 w-4" /> {t("guide.open", { page: t(page) })}
                        </GuardedLink>
                      )}
                      <a href="#top" className="ml-auto inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink">
                        <ArrowUp className="h-3.5 w-3.5" /> {t("guide.top")}
                      </a>
                    </div>
                  </Card>
                );
              })}
            </Stagger>
          )}
        </div>
      </div>
    </div>
  );
}

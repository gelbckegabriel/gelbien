/**
 * The user guide (/guide): long-form text, one file per language. Kept out of the message files
 * (which every page loads) so only the guide page pays for it. pt/fr are typed against the same
 * shape, so a section can't go missing in one language.
 *
 * Inline **bold** marks a label as it appears in the app (a button, a field).
 */
import type { Locale } from "../../types";

export const GUIDE_SECTIONS = ["start", "add", "dashboard", "expenses", "budget", "recurring", "goals", "chat", "categories", "profile", "concepts", "faq"] as const;
export type GuideSectionId = (typeof GUIDE_SECTIONS)[number];

export interface GuideSection {
  title: string;
  /** One line, shown in the contents */
  summary: string;
  intro: string[];
  /** How-tos, in the order you'd do them */
  steps?: { title: string; body: string }[];
  tips?: string[];
  /** Glossary entries (Key ideas) */
  terms?: { term: string; body: string }[];
  faq?: { q: string; a: string }[];
}

export type GuideContent = Record<GuideSectionId, GuideSection>;

export async function loadGuide(locale: Locale): Promise<GuideContent> {
  const mod = locale === "pt" ? await import("./pt") : locale === "fr" ? await import("./fr") : await import("./en");
  return mod.default;
}

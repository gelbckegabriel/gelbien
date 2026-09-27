"use client";

/**
 * Browser-side AI calls (bring-your-own key). Requests go directly from the
 * user's browser to Anthropic or Google — the key never reaches our server.
 * SDKs are imported lazily so they only load when AI is actually used.
 */
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { summarizeMonth } from "../finance";
import type { Dataset, Locale } from "../types";
import { todayISO } from "../utils";
import type { AiSettings } from "./config";
import { buildFinanceContext, LANGUAGE_NAME } from "./context";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function assistantInstructions(locale: Locale) {
  return [
    "You are Gelbien, a warm, sharp personal-finance assistant inside a budgeting app.",
    "You only know what is in the financial snapshot provided; if something isn't in the data, say so instead of guessing.",
    "Ground every claim in the user's real numbers, and do the arithmetic carefully.",
    "Be concise and concrete: short paragraphs or bullet lists, amounts formatted with the currency, no filler.",
    "Suggest practical, specific actions when useful. You are not a licensed financial advisor — don't recommend specific investments or securities.",
    `Always reply in ${LANGUAGE_NAME[locale]}.`,
  ].join("\n");
}

async function anthropic(ai: AiSettings): Promise<Anthropic> {
  const { default: Client } = await import("@anthropic-ai/sdk");
  return new Client({ apiKey: ai.key, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

async function gemini(ai: AiSettings) {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({ apiKey: ai.key });
}

type Effort = "low" | "medium" | "high";

/** Per-model request extras: effort where supported, server-side refusal fallback on Opus 5. */
function claudeExtras(model: string, effort: Effort) {
  const supportsEffort = model !== "claude-haiku-4-5";
  const extras: { betas?: string[]; fallbacks?: "default" } = {};
  if (model === "claude-opus-5") {
    extras.betas = [FALLBACK_BETA];
    extras.fallbacks = "default";
  }
  return { extras, effort: supportsEffort ? effort : undefined };
}

export function friendlyAiError(err: unknown): string {
  const e = err as { status?: number; message?: string; name?: string };
  if (e?.name === "AbortError") return "cancelled";
  const status = e?.status;
  if (status === 401 || status === 403) return "invalid API key or no access to this model";
  if (status === 429) return "rate limit reached — wait a minute and try again";
  if (status === 529 || status === 503) return "the provider is overloaded — try again shortly";
  if (status === 400 && /credit|billing/i.test(e?.message ?? "")) return "your API account has no credit left";
  const msg = e?.message ?? String(err);
  return msg.length > 160 ? `${msg.slice(0, 160)}…` : msg;
}

export async function testConnection(ai: AiSettings): Promise<void> {
  if (ai.provider === "anthropic") {
    const client = await anthropic(ai);
    await client.models.retrieve(ai.model);
  } else {
    const client = await gemini(ai);
    await client.models.get({ model: ai.model });
  }
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

// Lenient on purpose: the SDK passes enums to the model as descriptions, so strict
// enums would make one near-miss value fail the whole response. Normalized below.
export const insightSchema = z.object({
  insights: z
    .array(
      z.object({
        tone: z.string().describe("One of: good | warn | bad | info"),
        title: z.string().describe("Headline, max ~60 characters"),
        body: z.string().describe("One or two sentences with concrete numbers and, when useful, an action"),
      }),
    )
    .describe("3 to 5 insights, most important first"),
});

const TONES = ["good", "warn", "bad", "info"] as const;
function normalizeInsights(raw: z.infer<typeof insightSchema>): AiInsight[] {
  return raw.insights.map((i) => {
    const tone = i.tone.toLowerCase().trim();
    return {
      tone: (TONES as readonly string[]).includes(tone) ? (tone as AiInsight["tone"]) : tone.startsWith("warn") ? "warn" : "info",
      title: i.title,
      body: i.body,
    };
  });
}
export interface AiInsight {
  tone: (typeof TONES)[number];
  title: string;
  body: string;
}

export async function generateInsights(ai: AiSettings, ds: Dataset, month: string, locale: Locale): Promise<AiInsight[]> {
  const context = buildFinanceContext(ds);
  const s = summarizeMonth(ds, month);
  const ask = [
    `Today is ${todayISO()}. Analyze ${month} (${s.isCurrent ? `in progress: day ${s.elapsed} of ${s.days}` : s.isPast ? "complete" : "not started"}).`,
    "Give 3-5 insights that a thoughtful friend who is great with money would point out: patterns, risks, wins, and one or two specific ways to save.",
    "Compare against previous months and the budget where relevant. Avoid restating totals the user can already see unless they matter.",
    `Write in ${LANGUAGE_NAME[locale]}.`,
  ].join("\n");

  if (ai.provider === "anthropic") {
    const client = await anthropic(ai);
    const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
    const { extras, effort } = claudeExtras(ai.model, "medium");
    const res = await client.beta.messages.parse({
      model: ai.model,
      max_tokens: 16000,
      system: [
        { type: "text", text: assistantInstructions(locale) },
        { type: "text", text: context, cache_control: { type: "ephemeral" } },
      ],
      messages: [{ role: "user", content: ask }],
      output_config: { format: betaZodOutputFormat(insightSchema), ...(effort ? { effort } : {}) },
      ...extras,
    });
    if (res.stop_reason === "refusal") throw new Error("the model declined this request");
    if (!res.parsed_output) throw new Error("the model returned an unexpected format");
    return normalizeInsights(res.parsed_output);
  }

  const client = await gemini(ai);
  const res = await client.models.generateContent({
    model: ai.model,
    contents: ask,
    config: {
      systemInstruction: `${assistantInstructions(locale)}\n\n${context}`,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(insightSchema),
    },
  });
  return normalizeInsights(insightSchema.parse(JSON.parse(res.text ?? "{}")));
}

// ---------------------------------------------------------------------------
// Category translation
// ---------------------------------------------------------------------------

export const categoryTranslationSchema = z.object({
  categories: z.array(
    z.object({
      name: z.string().describe("The category name exactly as given"),
      translation: z.string(),
      subcategories: z.array(
        z.object({
          name: z.string().describe("The subcategory name exactly as given"),
          translation: z.string(),
        }),
      ),
    }),
  ),
});

export interface NameGroup {
  name: string;
  subcategories: string[];
}

/**
 * Translate the user's own category/subcategory labels (built-in ones have fixed translations).
 * Returns original name → translation; names the model skipped are simply absent.
 */
export async function translateCategoryNames(
  ai: AiSettings,
  groups: NameGroup[],
  locale: Locale,
): Promise<Map<string, { name: string; subcategories: Map<string, string> }>> {
  const language = LANGUAGE_NAME[locale];
  const system = "You translate short labels for a personal-finance budgeting app.";
  const ask = [
    `Translate these spending categories and their subcategories into ${language}.`,
    "Keep each label short and natural — the way a native speaker would name it in a budgeting app, not a word-for-word translation.",
    "Keep brand names, proper names and acronyms (e.g. Netflix, Costco, TFSA) as they are.",
    `If a label is already in ${language}, return it unchanged.`,
    "Return every category and subcategory given, with its name exactly as given.",
    "",
    JSON.stringify(groups),
  ].join("\n");

  let raw: z.infer<typeof categoryTranslationSchema>;
  if (ai.provider === "anthropic") {
    const client = await anthropic(ai);
    const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
    const { extras, effort } = claudeExtras(ai.model, "low");
    const res = await client.beta.messages.parse({
      model: ai.model,
      max_tokens: 16000,
      system,
      messages: [{ role: "user", content: ask }],
      output_config: { format: betaZodOutputFormat(categoryTranslationSchema), ...(effort ? { effort } : {}) },
      ...extras,
    });
    if (res.stop_reason === "refusal") throw new Error("the model declined this request");
    if (!res.parsed_output) throw new Error("the model returned an unexpected format");
    raw = res.parsed_output;
  } else {
    const client = await gemini(ai);
    const res = await client.models.generateContent({
      model: ai.model,
      contents: ask,
      config: { systemInstruction: system, responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(categoryTranslationSchema) },
    });
    raw = categoryTranslationSchema.parse(JSON.parse(res.text ?? "{}"));
  }

  return new Map(
    raw.categories.map((c) => [
      c.name,
      { name: c.translation.trim(), subcategories: new Map(c.subcategories.map((s) => [s.name, s.translation.trim()])) },
    ]),
  );
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export async function streamChat(
  ai: AiSettings,
  ds: Dataset,
  locale: Locale,
  history: ChatTurn[],
  onText: (delta: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const context = buildFinanceContext(ds);
  const today = `Today is ${todayISO()}.`;

  if (ai.provider === "anthropic") {
    const client = await anthropic(ai);
    const { extras, effort } = claudeExtras(ai.model, "medium");
    const messages: Anthropic.Beta.BetaMessageParam[] = history.map((m, i) => ({
      role: m.role,
      // Put the (volatile) date on the latest user turn so the cached system prefix stays stable.
      content: i === history.length - 1 && m.role === "user" ? `${today}\n\n${m.content}` : m.content,
    }));
    const stream = client.beta.messages.stream(
      {
        model: ai.model,
        max_tokens: 64000,
        system: [
          { type: "text", text: assistantInstructions(locale) },
          { type: "text", text: context, cache_control: { type: "ephemeral" } },
        ],
        messages,
        ...(effort ? { output_config: { effort } } : {}),
        ...extras,
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") onText(event.delta.text);
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") onText("\n\n_(The model declined to answer this.)_");
    return;
  }

  const client = await gemini(ai);
  const stream = await client.models.generateContentStream({
    model: ai.model,
    contents: history.map((m, i) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: i === history.length - 1 && m.role === "user" ? `${today}\n\n${m.content}` : m.content }],
    })),
    config: { systemInstruction: `${assistantInstructions(locale)}\n\n${context}`, abortSignal: signal },
  });
  for await (const chunk of stream) {
    if (signal.aborted) break;
    const text = chunk.text;
    if (text) onText(text);
  }
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export const RECEIPT_FIELDS = ["amount", "date", "merchant", "description", "category", "subcategory", "payment", "priority"] as const;
export type ReceiptField = (typeof RECEIPT_FIELDS)[number];

export function receiptSchema(categories: string[], payments: string[]) {
  return z.object({
    amount: z.number().nullable().describe("Total actually paid, including taxes and tip. Positive number."),
    date: z.string().nullable().describe("Purchase date as YYYY-MM-DD"),
    merchant: z.string().nullable().describe("Store or business name as printed"),
    description: z.string().nullable().describe("Short description of what was bought, max 60 characters"),
    category: z.string().nullable().describe(`Exactly one of: ${categories.join(" | ")}`),
    subcategory: z.string().nullable().describe("Best matching subcategory from the list for the chosen category"),
    payment: z.string().nullable().describe(`Payment method if visible on the receipt, exactly one of: ${payments.join(" | ")}`),
    priority: z.string().nullable().describe("One of: essential | important | superfluous"),
    currency: z.string().nullable().describe("ISO currency code printed on the receipt, if any"),
    uncertain: z.array(z.string()).describe(`Fields you could not read confidently, from: ${RECEIPT_FIELDS.join(", ")}`),
  });
}
export type ReceiptResult = z.infer<ReturnType<typeof receiptSchema>>;

export interface ReceiptInput {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";
}

export async function parseReceipt(ai: AiSettings, input: ReceiptInput, ds: Dataset, locale: Locale): Promise<ReceiptResult> {
  const cats = ds.categories.filter((c) => !c.archived);
  const schema = receiptSchema(
    cats.map((c) => c.name),
    ds.settings.paymentMethods,
  );
  const catalog = cats.map((c) => `- ${c.name}: ${c.subcategories.join("; ")}`).join("\n");
  const instructions = [
    "Extract the purchase from this receipt or invoice for a personal expense tracker.",
    `Today is ${todayISO()}; the user's currency is ${ds.settings.currency}.`,
    "Pick the category and subcategory from this list (use the exact names):",
    catalog,
    `Payment methods available: ${ds.settings.paymentMethods.join(", ")}.`,
    "Priority: essential = needs (rent, groceries, medicine); important = useful but flexible; superfluous = treats and wants.",
    `Write the description in ${LANGUAGE_NAME[locale]}. Use null for anything you cannot find, and list every guessed field in "uncertain".`,
  ].join("\n");

  if (ai.provider === "anthropic") {
    const client = await anthropic(ai);
    const { betaZodOutputFormat } = await import("@anthropic-ai/sdk/helpers/beta/zod");
    const { extras, effort } = claudeExtras(ai.model, "low");
    const media: Anthropic.Beta.BetaContentBlockParam =
      input.mediaType === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.base64 } }
        : { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.base64 } };
    const res = await client.beta.messages.parse({
      model: ai.model,
      max_tokens: 16000,
      messages: [{ role: "user", content: [media, { type: "text", text: instructions }] }],
      output_config: { format: betaZodOutputFormat(schema), ...(effort ? { effort } : {}) },
      ...extras,
    });
    if (res.stop_reason === "refusal") throw new Error("the model declined to read this file");
    if (!res.parsed_output) throw new Error("the model returned an unexpected format");
    return res.parsed_output;
  }

  const client = await gemini(ai);
  const res = await client.models.generateContent({
    model: ai.model,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: input.mediaType, data: input.base64 } }, { text: instructions }] }],
    config: { responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(schema) },
  });
  return schema.parse(JSON.parse(res.text ?? "{}"));
}

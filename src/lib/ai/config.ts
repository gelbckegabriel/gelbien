"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AiProvider = "off" | "anthropic" | "gemini";

export const ANTHROPIC_MODELS = [
  { id: "claude-opus-5", label: "Claude Opus 5", price: "$5 / $25 per 1M tokens" },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", price: "$2 / $10 per 1M tokens" },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", price: "$1 / $5 per 1M tokens" },
] as const;

export const GEMINI_MODELS = [
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", price: "Free tier" },
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", price: "Free tier · higher limits" },
] as const;

interface AiState {
  provider: AiProvider;
  anthropicKey: string;
  geminiKey: string;
  anthropicModel: string;
  geminiModel: string;
  set: (patch: Partial<Omit<AiState, "set">>) => void;
}

/** Keys live only in this browser's localStorage; requests go straight to the provider. */
export const useAi = create<AiState>()(
  persist(
    (set) => ({
      provider: "off",
      anthropicKey: "",
      geminiKey: "",
      anthropicModel: "claude-opus-5",
      geminiModel: "gemini-3.8-flash",
      set: (patch) => set(patch),
    }),
    { name: "gelbien.ai" },
  ),
);

export interface AiSettings {
  provider: "anthropic" | "gemini";
  key: string;
  model: string;
}

export function activeAi(s: Pick<AiState, "provider" | "anthropicKey" | "geminiKey" | "anthropicModel" | "geminiModel">): AiSettings | null {
  if (s.provider === "anthropic" && s.anthropicKey.trim()) return { provider: "anthropic", key: s.anthropicKey.trim(), model: s.anthropicModel };
  if (s.provider === "gemini" && s.geminiKey.trim()) return { provider: "gemini", key: s.geminiKey.trim(), model: s.geminiModel };
  return null;
}

export function useActiveAi(): AiSettings | null {
  const provider = useAi((s) => s.provider);
  const anthropicKey = useAi((s) => s.anthropicKey);
  const geminiKey = useAi((s) => s.geminiKey);
  const anthropicModel = useAi((s) => s.anthropicModel);
  const geminiModel = useAi((s) => s.geminiModel);
  return activeAi({ provider, anthropicKey, geminiKey, anthropicModel, geminiModel });
}

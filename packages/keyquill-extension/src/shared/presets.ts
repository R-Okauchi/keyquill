/**
 * Built-in provider presets.
 *
 * Each preset encodes:
 * - `id`: stable identifier stored as `KeyRecord.provider`. `"anthropic"`
 *   routes through the Anthropic Messages API in `providerFetch.ts`; every
 *   other id falls through to the OpenAI-compatible passthrough (works for
 *   OpenAI itself, Google Gemini's OpenAI-compat endpoint, Groq, DeepSeek,
 *   Mistral, Together AI, xAI, OpenRouter, and arbitrary custom endpoints).
 * - `label`: UI string shown in the add-key dropdown and in KeyCards.
 * - `baseUrl`: provider HTTPS base. The extension appends `/chat/completions`
 *   or `/messages` depending on API shape.
 * - `defaultModel`: a safe starting model — user can override inline.
 *
 * Base URLs and default models verified against each vendor's public docs
 * as of April 2026.
 */

export interface Preset {
  id: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
}

export const PRESETS: Preset[] = [
  {
    id: "openai",
    label: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
  },
  {
    id: "anthropic",
    label: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    defaultModel: "claude-sonnet-4-6",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.5-flash",
  },
  {
    id: "groq",
    label: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
  },
  {
    id: "mistral",
    label: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    defaultModel: "mistral-small-latest",
  },
  {
    id: "together",
    label: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    baseUrl: "https://api.x.ai/v1",
    defaultModel: "grok-4-1-fast-non-reasoning",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    defaultModel: "openrouter/auto",
  },
  {
    id: "custom",
    label: "Custom (OpenAI-compatible)",
    baseUrl: "",
    defaultModel: "",
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

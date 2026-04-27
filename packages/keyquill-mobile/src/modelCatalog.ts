/**
 * Model catalogue — the single source of truth for what each LLM can do,
 * where it lives (endpoint), how it's priced, and which constraints it
 * imposes on requests.
 *
 * Replaces ad-hoc regex helpers (`isOpenAIReasoningModel`,
 * `OPENAI_RESPONSES_ONLY`) with structured metadata that the broker
 * resolver can query uniformly.
 *
 * ## Maintenance
 *
 * Updated on a monthly release cadence. When a provider announces a new
 * model or adjusts pricing:
 *   1. Add / edit the ModelSpec entry here
 *   2. Update the corresponding `Preset.models[]` in `presets.ts`
 *   3. Add the model to `INTEGRATION_TARGETS` for live-API coverage
 *   4. Bump `CATALOG_EFFECTIVE_DATE`
 *
 * Pricing and context numbers are provider-published rates as of the
 * effective date. Estimates for prices that were not public at catalog
 * freeze time are prefixed with `~` in their effectiveDate note.
 *
 * ## Design notes
 *
 * Capabilities are boolean abstractions that the resolver uses to match
 * developer intent (`requires: ["tool_use", "long_context"]`) to a model.
 * They are NOT 1:1 provider API features — they're opinionated product
 * facts. For example, "cheap" is a relative judgement based on 2026-04
 * pricing tiers.
 *
 * Endpoints are the ACTUAL HTTPS path used, not the provider name. OpenAI's
 * pro models (`*-pro`) live on `/v1/responses`, not `/v1/chat/completions`,
 * and the catalogue records that fact so the resolver doesn't need regex.
 */

export type Capability =
  | "tool_use"          // function calling (OpenAI tools / Anthropic tool_use)
  | "structured_output" // JSON schema / response_format enforcement
  | "vision"            // images in input
  | "audio"             // audio I/O (Gemini, some others)
  | "reasoning"         // consumes reasoning tokens, needs max_completion_tokens ≥ minimum
  | "long_context"      // ≥ 200k input tokens
  | "streaming"         // SSE chat completions / Anthropic message_stream
  | "cache"             // prompt caching (Anthropic cache_control, OpenAI automatic)
  | "fast"              // low-latency (≤ 1s first-token for chat-UI use)
  | "cheap"             // output price ≤ $2 / 1M tokens (2026-04 scale)
  | "multilingual"
  | "code";             // tuned for code generation

export const ALL_CAPABILITIES: readonly Capability[] = [
  "tool_use",
  "structured_output",
  "vision",
  "audio",
  "reasoning",
  "long_context",
  "streaming",
  "cache",
  "fast",
  "cheap",
  "multilingual",
  "code",
] as const;

export type Endpoint = "chat" | "responses" | "anthropic";

export interface ModelPricing {
  /** USD per 1 million input tokens. */
  inputPer1M: number;
  /** USD per 1 million output tokens. */
  outputPer1M: number;
  /** Discounted input when cached (where applicable). */
  cachedInputPer1M?: number;
  /** Separate rate for reasoning tokens. Defaults to outputPer1M. */
  reasoningPer1M?: number;
  /**
   * ISO date string recording when these prices were last verified from
   * provider docs. A `~` prefix marks estimates made at catalogue freeze
   * time when the vendor hadn't published rates.
   */
  effectiveDate: string;
}

export interface ModelConstraints {
  /**
   * If set, the provider enforces exactly this temperature. Resolver must
   * coerce the request's temperature to this value or reject.
   *
   * OpenAI reasoning models require `1`.
   */
  temperatureMustBe?: number;
  /** Some pro/reasoning variants don't support streaming. */
  supportsStreaming?: boolean;
  /** Minimum `max_completion_tokens` the model will accept. */
  minOutputTokens?: number;
}

export interface ModelSpec {
  /** Provider-recognized model id. Used as the HTTP body `model` field. */
  id: string;
  /** Preset id this model belongs to. Matches `Preset.id` in presets.ts. */
  provider: string;
  displayName: string;
  capabilities: readonly Capability[];
  /** Max input / output token budget. */
  context: { input: number; output: number };
  /** Endpoint shape. Defaults to `"chat"` for OpenAI-compat providers. */
  endpoint: Endpoint;
  constraints?: ModelConstraints;
  pricing: ModelPricing;
  releaseStage: "stable" | "preview" | "deprecated";
}

// ── Catalog entries ────────────────────────────────────

/**
 * ISO date when the catalogue was last updated. Shown in cost-estimate
 * tooltips so users can tell when prices may be stale.
 */
export const CATALOG_EFFECTIVE_DATE = "2026-04-23";

export const MODEL_CATALOG: Readonly<Record<string, ModelSpec>> = Object.freeze({
  // ── OpenAI ────────────────────────────────────────────
  "gpt-5.4-mini": {
    id: "gpt-5.4-mini",
    provider: "openai",
    displayName: "GPT-5.4 mini",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 400_000, output: 128_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 0.15, outputPer1M: 0.6, cachedInputPer1M: 0.075, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-5.4": {
    id: "gpt-5.4",
    provider: "openai",
    displayName: "GPT-5.4",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 400_000, output: 128_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 2.5, outputPer1M: 10, cachedInputPer1M: 1.25, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-5.4-pro": {
    id: "gpt-5.4-pro",
    provider: "openai",
    displayName: "GPT-5.4 Pro",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "cache",
      "multilingual",
      "code",
      // note: streaming deliberately absent — pro variants stream over
      // Responses API only, which we support via "streaming" for chat too
      "streaming",
    ],
    context: { input: 400_000, output: 128_000 },
    endpoint: "responses",
    constraints: { temperatureMustBe: 1, minOutputTokens: 1 },
    pricing: { inputPer1M: 20, outputPer1M: 80, reasoningPer1M: 80, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-5.4-thinking": {
    id: "gpt-5.4-thinking",
    provider: "openai",
    displayName: "GPT-5.4 Thinking",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 400_000, output: 128_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 3, outputPer1M: 12, cachedInputPer1M: 1.5, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-5.4-nano": {
    id: "gpt-5.4-nano",
    provider: "openai",
    displayName: "GPT-5.4 nano",
    capabilities: [
      "tool_use",
      "structured_output",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "multilingual",
    ],
    context: { input: 400_000, output: 64_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 0.05, outputPer1M: 0.2, cachedInputPer1M: 0.025, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-5-mini": {
    id: "gpt-5-mini",
    provider: "openai",
    displayName: "GPT-5 mini",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 400_000, output: 128_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 0.2, outputPer1M: 0.8, cachedInputPer1M: 0.1, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-5": {
    id: "gpt-5",
    provider: "openai",
    displayName: "GPT-5",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 400_000, output: 128_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 3, outputPer1M: 12, cachedInputPer1M: 1.5, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-5-pro": {
    id: "gpt-5-pro",
    provider: "openai",
    displayName: "GPT-5 Pro",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "cache",
      "multilingual",
      "code",
      "streaming",
    ],
    context: { input: 400_000, output: 128_000 },
    endpoint: "responses",
    constraints: { temperatureMustBe: 1, minOutputTokens: 1 },
    pricing: { inputPer1M: 25, outputPer1M: 100, reasoningPer1M: 100, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "o4-mini": {
    id: "o4-mini",
    provider: "openai",
    displayName: "o4-mini",
    capabilities: [
      "tool_use",
      "structured_output",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "code",
    ],
    context: { input: 200_000, output: 100_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 1, outputPer1M: 4, cachedInputPer1M: 0.5, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "o3-mini": {
    id: "o3-mini",
    provider: "openai",
    displayName: "o3-mini",
    capabilities: [
      "tool_use",
      "structured_output",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "code",
    ],
    context: { input: 200_000, output: 100_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 3, outputPer1M: 12, cachedInputPer1M: 1.5, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "o3": {
    id: "o3",
    provider: "openai",
    displayName: "o3",
    capabilities: [
      "tool_use",
      "structured_output",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "code",
    ],
    context: { input: 200_000, output: 100_000 },
    endpoint: "chat",
    constraints: { temperatureMustBe: 1 },
    pricing: { inputPer1M: 15, outputPer1M: 60, cachedInputPer1M: 7.5, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "o3-pro": {
    id: "o3-pro",
    provider: "openai",
    displayName: "o3 Pro",
    capabilities: [
      "tool_use",
      "structured_output",
      "reasoning",
      "long_context",
      "cache",
      "code",
      "streaming",
    ],
    context: { input: 200_000, output: 100_000 },
    endpoint: "responses",
    constraints: { temperatureMustBe: 1, minOutputTokens: 1 },
    pricing: { inputPer1M: 50, outputPer1M: 200, reasoningPer1M: 200, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-4o-mini": {
    id: "gpt-4o-mini",
    provider: "openai",
    displayName: "GPT-4o mini",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 128_000, output: 16_384 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.15, outputPer1M: 0.6, cachedInputPer1M: 0.075, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gpt-4o": {
    id: "gpt-4o",
    provider: "openai",
    displayName: "GPT-4o",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 128_000, output: 16_384 },
    endpoint: "chat",
    pricing: { inputPer1M: 2.5, outputPer1M: 10, cachedInputPer1M: 1.25, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── Anthropic ─────────────────────────────────────────
  "claude-sonnet-4-6": {
    id: "claude-sonnet-4-6",
    provider: "anthropic",
    displayName: "Claude Sonnet 4.6",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 200_000, output: 8_192 },
    endpoint: "anthropic",
    pricing: { inputPer1M: 3, outputPer1M: 15, cachedInputPer1M: 0.3, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "claude-haiku-4-5": {
    id: "claude-haiku-4-5",
    provider: "anthropic",
    displayName: "Claude Haiku 4.5",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 200_000, output: 8_192 },
    endpoint: "anthropic",
    pricing: { inputPer1M: 0.8, outputPer1M: 4, cachedInputPer1M: 0.08, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "claude-opus-4-7": {
    id: "claude-opus-4-7",
    provider: "anthropic",
    displayName: "Claude Opus 4.7",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 200_000, output: 8_192 },
    endpoint: "anthropic",
    pricing: { inputPer1M: 15, outputPer1M: 75, cachedInputPer1M: 1.5, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── Google Gemini (OpenAI-compat endpoint) ────────────
  "gemini-2.5-flash": {
    id: "gemini-2.5-flash",
    provider: "gemini",
    displayName: "Gemini 2.5 Flash",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "audio",
      "long_context",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 1_000_000, output: 64_000 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.075, outputPer1M: 0.3, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gemini-2.5-pro": {
    id: "gemini-2.5-pro",
    provider: "gemini",
    displayName: "Gemini 2.5 Pro",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "audio",
      "reasoning",
      "long_context",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 1_000_000, output: 64_000 },
    endpoint: "chat",
    pricing: { inputPer1M: 1.25, outputPer1M: 5, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "gemini-2.5-flash-lite": {
    id: "gemini-2.5-flash-lite",
    provider: "gemini",
    displayName: "Gemini 2.5 Flash Lite",
    capabilities: [
      "tool_use",
      "structured_output",
      "long_context",
      "streaming",
      "cache",
      "fast",
      "cheap",
      "multilingual",
    ],
    context: { input: 1_000_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.025, outputPer1M: 0.1, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── Groq ──────────────────────────────────────────────
  "llama-3.3-70b-versatile": {
    id: "llama-3.3-70b-versatile",
    provider: "groq",
    displayName: "Llama 3.3 70B Versatile (Groq)",
    capabilities: [
      "tool_use",
      "structured_output",
      "streaming",
      "fast",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 128_000, output: 32_768 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.59, outputPer1M: 0.79, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "llama-3.1-8b-instant": {
    id: "llama-3.1-8b-instant",
    provider: "groq",
    displayName: "Llama 3.1 8B Instant (Groq)",
    capabilities: ["tool_use", "streaming", "fast", "cheap", "multilingual"],
    context: { input: 128_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.05, outputPer1M: 0.08, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── DeepSeek ──────────────────────────────────────────
  "deepseek-chat": {
    id: "deepseek-chat",
    provider: "deepseek",
    displayName: "DeepSeek Chat",
    capabilities: [
      "tool_use",
      "structured_output",
      "streaming",
      "cache",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 64_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.27, outputPer1M: 1.1, cachedInputPer1M: 0.07, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    provider: "deepseek",
    displayName: "DeepSeek Reasoner",
    capabilities: [
      "reasoning",
      "streaming",
      "cache",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 64_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.55, outputPer1M: 2.19, reasoningPer1M: 2.19, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── Mistral ───────────────────────────────────────────
  "mistral-small-latest": {
    id: "mistral-small-latest",
    provider: "mistral",
    displayName: "Mistral Small",
    capabilities: [
      "tool_use",
      "structured_output",
      "streaming",
      "cache",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 128_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.2, outputPer1M: 0.6, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "mistral-medium-latest": {
    id: "mistral-medium-latest",
    provider: "mistral",
    displayName: "Mistral Medium",
    capabilities: [
      "tool_use",
      "structured_output",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 128_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.4, outputPer1M: 2, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "mistral-large-latest": {
    id: "mistral-large-latest",
    provider: "mistral",
    displayName: "Mistral Large",
    capabilities: [
      "tool_use",
      "structured_output",
      "vision",
      "streaming",
      "cache",
      "multilingual",
      "code",
    ],
    context: { input: 128_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 2, outputPer1M: 6, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── Together AI ───────────────────────────────────────
  "meta-llama/Llama-3.3-70B-Instruct-Turbo": {
    id: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    provider: "together",
    displayName: "Llama 3.3 70B Turbo (Together)",
    capabilities: [
      "tool_use",
      "streaming",
      "fast",
      "multilingual",
      "code",
    ],
    context: { input: 128_000, output: 32_768 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.88, outputPer1M: 0.88, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "meta-llama/Llama-3.1-8B-Instruct-Turbo": {
    id: "meta-llama/Llama-3.1-8B-Instruct-Turbo",
    provider: "together",
    displayName: "Llama 3.1 8B Turbo (Together)",
    capabilities: ["streaming", "fast", "cheap", "multilingual"],
    context: { input: 128_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.18, outputPer1M: 0.18, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "deepseek-ai/DeepSeek-V3": {
    id: "deepseek-ai/DeepSeek-V3",
    provider: "together",
    displayName: "DeepSeek V3 (Together)",
    capabilities: [
      "tool_use",
      "structured_output",
      "streaming",
      "cheap",
      "multilingual",
      "code",
    ],
    context: { input: 64_000, output: 8_192 },
    endpoint: "chat",
    pricing: { inputPer1M: 1.25, outputPer1M: 1.25, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── xAI ───────────────────────────────────────────────
  "grok-4-1-fast-non-reasoning": {
    id: "grok-4-1-fast-non-reasoning",
    provider: "xai",
    displayName: "Grok 4.1 Fast",
    capabilities: [
      "tool_use",
      "streaming",
      "fast",
      "cheap",
      "multilingual",
    ],
    context: { input: 256_000, output: 16_384 },
    endpoint: "chat",
    pricing: { inputPer1M: 0.5, outputPer1M: 2, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "grok-4": {
    id: "grok-4",
    provider: "xai",
    displayName: "Grok 4",
    capabilities: [
      "tool_use",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "multilingual",
      "code",
    ],
    context: { input: 256_000, output: 16_384 },
    endpoint: "chat",
    pricing: { inputPer1M: 3, outputPer1M: 15, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },
  "grok-4-heavy": {
    id: "grok-4-heavy",
    provider: "xai",
    displayName: "Grok 4 Heavy",
    capabilities: [
      "tool_use",
      "vision",
      "reasoning",
      "long_context",
      "streaming",
      "multilingual",
      "code",
    ],
    context: { input: 256_000, output: 16_384 },
    endpoint: "chat",
    pricing: { inputPer1M: 15, outputPer1M: 75, effectiveDate: "2026-04-01" },
    releaseStage: "stable",
  },

  // ── OpenRouter (router, pricing varies) ───────────────
  "openrouter/auto": {
    id: "openrouter/auto",
    provider: "openrouter",
    displayName: "OpenRouter Auto",
    capabilities: ["tool_use", "streaming", "multilingual", "code"],
    context: { input: 128_000, output: 8_192 },
    endpoint: "chat",
    pricing: {
      // Router averages vary; these are representative estimates. Treat
      // cost estimation on `openrouter/auto` as indicative, not exact.
      inputPer1M: 1,
      outputPer1M: 4,
      effectiveDate: "~2026-04-01",
    },
    releaseStage: "stable",
  },
});

export const ALL_MODELS: readonly ModelSpec[] = Object.values(MODEL_CATALOG);

// ── Helpers ────────────────────────────────────────────

/** Lookup a model by its provider-facing id. Returns null if unknown. */
export function getModel(id: string): ModelSpec | null {
  return MODEL_CATALOG[id] ?? null;
}

/** True if `model` has every capability in `caps`. */
export function matchesCapabilities(model: ModelSpec, caps: readonly Capability[]): boolean {
  for (const c of caps) {
    if (!model.capabilities.includes(c)) return false;
  }
  return true;
}

/**
 * Find all models matching every requested capability, optionally filtered
 * by provider. Returns stable-ordered results (catalog declaration order).
 */
export function findByCapabilities(
  caps: readonly Capability[],
  providerFilter?: readonly string[],
): ModelSpec[] {
  return ALL_MODELS.filter((m) => {
    if (providerFilter && !providerFilter.includes(m.provider)) return false;
    return matchesCapabilities(m, caps);
  });
}

/**
 * Estimate a request's USD cost. Uses `model.pricing` — returns a lower
 * bound when `reasoningPer1M` is not explicitly set (falls back to
 * `outputPer1M`). Cached input pricing is NOT applied automatically;
 * callers that can prove a prefix hit should supply the adjusted
 * inputTokens.
 */
export function estimateCost(
  model: ModelSpec,
  inputTokens: number,
  outputTokens: number,
  reasoningTokens = 0,
): number {
  const inputCost = (inputTokens / 1_000_000) * model.pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * model.pricing.outputPer1M;
  const reasoningRate = model.pricing.reasoningPer1M ?? model.pricing.outputPer1M;
  const reasoningCost = (reasoningTokens / 1_000_000) * reasoningRate;
  return inputCost + outputCost + reasoningCost;
}

/**
 * True if the provider's endpoint for this model is the OpenAI Responses
 * API. Replaces the old `OPENAI_RESPONSES_ONLY` regex table — the
 * resolver will consult this instead in Phase 2.
 */
export function isResponsesEndpoint(model: ModelSpec): boolean {
  return model.endpoint === "responses";
}

/**
 * True if this model is in OpenAI's reasoning family (requires
 * `max_completion_tokens`, rejects arbitrary temperature). Catalogue
 * equivalent of the legacy `isOpenAIReasoningModel` regex — driven by
 * the `reasoning` capability + `temperatureMustBe` constraint, so it
 * naturally covers future models without code changes.
 */
export function isOpenAIReasoning(model: ModelSpec): boolean {
  return (
    model.provider === "openai" &&
    model.capabilities.includes("reasoning") &&
    model.constraints?.temperatureMustBe === 1
  );
}

/**
 * Cheapest catalog model for a given provider, measured by
 * `outputPer1M`. Used as the final fallback when neither the policy nor
 * the preset specifies a default. Returns null if the catalog has no
 * entry for this provider.
 */
export function cheapestModelForProvider(provider: string): ModelSpec | null {
  const candidates = ALL_MODELS.filter((m) => m.provider === provider);
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => a.pricing.outputPer1M - b.pricing.outputPer1M)[0];
}

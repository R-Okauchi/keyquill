/**
 * Plain TypeScript types for the keyquill-mobile Capacitor plugin.
 *
 * Intentionally zero runtime dependencies (no Zod) so this package
 * can be published to npm with only `@capacitor/core` as a peer.
 */

// Re-exports of broker types so consumers can `import { Capability, ModelSpec, getModel } from "keyquill-mobile"`.
// Phase 18a-1 introduces these alongside the legacy types; Phases 18a-2
// and 18a-3 build a TS-side resolver on top.
//
// Note: `estimateCost` is *not* re-exported here because the legacy
// microunit-based `policy.estimateCost` is still the public surface
// through Phases 18a-c. The catalog's USD-based `estimateCost` is
// callable via `import { estimateCost } from "./modelCatalog.js"` from
// inside the package, and will become the public estimate in Phase
// 18f when the legacy policy module retires.
import type { Capability } from "./modelCatalog.js";

export type {
  Capability,
  Endpoint,
  ModelConstraints,
  ModelPricing,
  ModelSpec,
} from "./modelCatalog.js";
export {
  ALL_CAPABILITIES,
  ALL_MODELS,
  CATALOG_EFFECTIVE_DATE,
  MODEL_CATALOG,
  cheapestModelForProvider,
  findByCapabilities,
  getModel,
  isOpenAIReasoning,
  isResponsesEndpoint,
  matchesCapabilities,
} from "./modelCatalog.js";

/**
 * Behavioural abstraction over temperature. Resolvers map this to a
 * concrete value per model class (e.g., reasoning models pin
 * `temperatureMustBe = 1`, chat models use 0.0 / 0.7 / 1.0+ for
 * precise / balanced / creative). Lives here for now; once the
 * mobile-side resolver lands in Phase 18a-3 it may move.
 */
export type Tone = "precise" | "balanced" | "creative";

/** A registered LLM provider as surfaced by `listProviders()`. */
export interface RelayProviderInfo {
  provider: string;
  baseUrl: string;
  defaultModel: string;
  /** Non-sensitive hint (e.g. last 4 chars) — never the raw key. */
  keyHint: string | null;
  label: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Host pattern entry in the provider allowlist. */
export interface RelayProviderAllowlistEntry {
  hostPattern: string;
  httpsOnly: true;
}

/** Relay policy: provider allowlist, cost limits, biometric window. */
export interface RelayPolicy {
  schemaVersion: 1;
  providerAllowlist: RelayProviderAllowlistEntry[];
  maxTokensPerRequest: number;
  dailyCostLimitMicrounits: number;
  monthlyCostLimitMicrounits: number;
  monthlyWarningThresholdPct: number;
  highCostThresholdMicrounits: number;
  biometricAutoApproveSeconds: number;
  blockPrivateIps: true;
}

/** Stream events emitted by the native plugin during `chatStream()`. */
export type RelayStreamEvent =
  | { type: "delta"; streamId: string; text: string }
  | { type: "card"; streamId: string; card: Record<string, unknown> }
  | { type: "patch"; streamId: string; patch: Record<string, unknown> }
  | {
      type: "done";
      streamId: string;
      usage?: { promptTokens: number; completionTokens: number };
    }
  | { type: "error"; streamId: string; error: string };

// ── Broker KeyPolicy (Phase 18a-2) ─────────────────────
//
// Mirrors the extension's `KeyPolicy` shape so a TS-side resolver can
// be added in Phase 18a-3 with the same dispatch logic. The legacy
// `RelayPolicy` above stays in place — both coexist until Phase 18f
// drops `RelayPolicy` after native code migrates.

export type ReasoningEffort = "minimal" | "low" | "medium" | "high";

export interface ModelPolicy {
  /**
   * - `open`         — any model permitted
   * - `allowlist`    — only models in `allowedModels`
   * - `denylist`     — every model except those in `deniedModels`
   * - `capability-only` — developer can't supply `prefer.model`; user
   *   maps each capability to a preferred model via `preferredPerCapability`
   */
  mode: "open" | "allowlist" | "denylist" | "capability-only";
  allowedModels?: string[];
  deniedModels?: string[];
  /** "When the dev needs `reasoning`, use `claude-sonnet-4-6`." */
  preferredPerCapability?: Partial<Record<Capability, string>>;
  /** What the broker does when the developer's request violates the mode. */
  onViolation: "reject" | "confirm";
  /**
   * Explicit default model pin used when a request specifies neither
   * `prefer.model` nor `requires[]`. Falls back to the cheapest catalog
   * entry for the key's provider when undefined.
   */
  defaultModel?: string;
}

export interface BudgetPolicy {
  maxTokensPerRequest?: number;
  maxCostPerRequestUSD?: number;
  dailyBudgetUSD?: number;
  monthlyBudgetUSD?: number;
  /** Cap dev's reasoning_effort to at most this level (enum-ordered). */
  maxReasoningEffort?: ReasoningEffort;
  /** What the broker does when a request would exceed budget. */
  onBudgetHit: "block" | "confirm" | "warn";
}

export interface PrivacyPolicy {
  /** undefined = all providers permitted for this key. */
  allowedProviders?: string[];
  /** Reject requests whose provider URL is not HTTPS (except localhost for dev). */
  requireHttps: boolean;
  /** Whether to record every request to the audit ledger (Phase 18c). */
  logAuditEvents: boolean;
}

export interface SamplingPolicy {
  temperature?: number;
  topP?: number;
}

export interface BehaviorPolicy {
  /**
   * Allow heuristic fallbacks when a model's exact endpoint isn't in
   * the catalog (e.g., OpenAI's /chat → /responses retry). Turn off
   * for strict environments that prefer failing closed.
   */
  autoFallback: boolean;
  /** Retry budget for transient provider errors (429 / 5xx). */
  maxRetries: number;
  /** Hard timeout for a single provider request, in milliseconds. */
  timeoutMs: number;
}

/**
 * Per-key policy. Encodes user intent across model selection, budget,
 * privacy, sampling defaults, and runtime behavior. The mobile resolver
 * (Phase 18a-3) consults this before dispatching a request to native;
 * native code starts consuming it directly in Phases 18d/18e.
 */
export interface KeyPolicy {
  modelPolicy: ModelPolicy;
  budget: BudgetPolicy;
  privacy: PrivacyPolicy;
  /** Optional — when omitted, the resolver uses provider defaults. */
  sampling?: SamplingPolicy;
  behavior: BehaviorPolicy;
}

/**
 * Permissive default applied to newly-registered keys. Equivalent to
 * "no policy enforcement" — the broker passes requests through with
 * sensible runtime defaults. Consumer apps opt into stricter modes via
 * their own policy-editor UI.
 */
export const DEFAULT_KEY_POLICY: KeyPolicy = {
  modelPolicy: { mode: "open", onViolation: "confirm" },
  budget: { onBudgetHit: "warn" },
  privacy: { requireHttps: true, logAuditEvents: true },
  behavior: { autoFallback: true, maxRetries: 2, timeoutMs: 60_000 },
};

/**
 * KeyPolicy schema version stored alongside any persisted KeyPolicy.
 * Mobile starts at 1 and bumps independently of the extension's
 * `CURRENT_POLICY_VERSION` (which is 3 due to its own migration
 * history). Persisted KeyPolicy storage on mobile is added in Phase
 * 18d/18e when native code starts consuming it.
 */
export const CURRENT_POLICY_VERSION = 1;

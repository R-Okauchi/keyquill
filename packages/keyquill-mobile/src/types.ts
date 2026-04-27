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

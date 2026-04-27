import { registerPlugin } from "@capacitor/core";
import type { SecureRelayPlugin } from "./definitions.js";
import type { ResolveInput, ResolveResult } from "./resolver.js";
import { resolve } from "./resolver.js";
import type { KeyPolicy } from "./types.js";

const SecureRelay = registerPlugin<SecureRelayPlugin>("SecureRelay", {
  web: () => import("./web.js").then((m) => new m.SecureRelayWeb()),
});

export { SecureRelay };

/**
 * Capability-first wrapper around `SecureRelay.chatStream` (Phase 18a-3).
 *
 * Sits on top of the legacy native chatStream: queries the registered
 * keys via `listProviders()`, resolves the caller's intent
 * (`requires` / `tone` / `prefer`) into a concrete provider, then
 * dispatches to native. Native still uses each registered key's
 * `defaultModel`; the resolver picks among already-registered keys
 * rather than overriding model per request (that lands in 18d/18e
 * when the native bridge is extended).
 *
 * Returns the `streamId` from native plus the resolver's metadata
 * (`resolvedProvider`, `resolvedModel`, `reason`) so callers know
 * which key serviced the request.
 *
 * Throws when the resolver rejects (no providers registered, model
 * outside allowlist, etc). Use `resolve()` directly if you want a
 * non-throwing surface.
 */
export interface ResolveAndChatStreamInput extends ResolveInput {
  messages: Array<{ role: string; content: string }>;
  systemPrompt: string;
  maxTokens?: number;
  /** Per-key policy. Defaults to DEFAULT_KEY_POLICY when omitted. */
  policy?: KeyPolicy;
}

export interface ResolveAndChatStreamResult {
  streamId: string;
  resolvedProvider: string;
  resolvedModel: string;
  reason: Extract<ResolveResult, { kind: "ready" }>["reason"];
}

export async function resolveAndChatStream(
  input: ResolveAndChatStreamInput,
): Promise<ResolveAndChatStreamResult> {
  const { providers } = await SecureRelay.listProviders();
  const decision = resolve(
    {
      requires: input.requires,
      tone: input.tone,
      prefer: input.prefer,
    },
    providers,
    input.policy,
  );
  if (decision.kind === "reject") {
    throw new Error(`[${decision.reason}] ${decision.message}`);
  }
  const { streamId } = await SecureRelay.chatStream({
    provider: decision.provider,
    messages: input.messages,
    systemPrompt: input.systemPrompt,
    maxTokens: input.maxTokens,
  });
  return {
    streamId,
    resolvedProvider: decision.provider,
    resolvedModel: decision.model.id,
    reason: decision.reason,
  };
}

export { resolve } from "./resolver.js";
export type {
  ResolveInput,
  ResolveResult,
  ResolveReason,
} from "./resolver.js";

// Error codes + i18n (Phase 18b)
export {
  ERROR_CODES,
  ERRORS_EN,
  ERRORS_JA,
  getErrorMessage,
  isKnownErrorCode,
  renderError,
} from "./errors/index.js";
export type { ErrorCode, Locale } from "./errors/index.js";

// Audit ledger (Phase 18c) — persists to @capacitor/preferences by
// default; tests + custom-storage callers can supply their own via
// `setLedgerStore`.
export {
  appendEntry,
  clearAll,
  clearByProvider,
  exportCSV,
  getDailySpend,
  getMonthSpend,
  queryByProvider,
  setLedgerStore,
} from "./ledger.js";
export type { LedgerEntry, LedgerStore } from "./ledger.js";
export type { SecureRelayPlugin, SecureRelayEvents } from "./definitions.js";
export type {
  RelayProviderInfo,
  RelayProviderAllowlistEntry,
  RelayPolicy,
  RelayStreamEvent,
  // Broker types (Phase 18a-1)
  Capability,
  Endpoint,
  ModelConstraints,
  ModelPricing,
  ModelSpec,
  Tone,
  // Broker KeyPolicy (Phase 18a-2)
  KeyPolicy,
  ModelPolicy,
  BudgetPolicy,
  PrivacyPolicy,
  SamplingPolicy,
  BehaviorPolicy,
  ReasoningEffort,
} from "./types.js";
export { DEFAULT_KEY_POLICY, CURRENT_POLICY_VERSION } from "./types.js";
export {
  defaultPolicy,
  validateBaseUrl,
  estimateCost,
  checkDailyBudget,
  checkMonthlyBudget,
  requiresBiometric,
} from "./policy.js";
// Broker helpers (Phase 18a-1) — exposed alongside the legacy
// microunit-based policy module. Not yet wired into the chatStream
// surface; that lands in 18a-3.
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
} from "./types.js";

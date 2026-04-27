import { registerPlugin } from "@capacitor/core";
import type { SecureRelayPlugin } from "./definitions.js";

const SecureRelay = registerPlugin<SecureRelayPlugin>("SecureRelay", {
  web: () => import("./web.js").then((m) => new m.SecureRelayWeb()),
});

export { SecureRelay };
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

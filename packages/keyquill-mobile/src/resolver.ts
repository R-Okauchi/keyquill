/**
 * TS-side resolver for keyquill-mobile (Phase 18a-3).
 *
 * Picks the *provider* whose already-registered key best satisfies the
 * caller's intent, drawing from the list returned by `listProviders()`.
 * Each registered key carries its own `defaultModel`; the native side
 * always uses that defaultModel when servicing a `chatStream()` call.
 * The resolver therefore cannot pick an arbitrary model from the
 * catalog — it can only choose which registered key to route to.
 *
 * Three-tier resolution mirrors the extension's resolver semantics:
 *
 *   Tier 1 — zero-config:   use the first registered provider.
 *   Tier 2 — `requires[]`:  filter to providers whose key.defaultModel
 *                            satisfies every requested capability; pick
 *                            the cheapest by `outputPer1M`.
 *   Tier 3 — `prefer.*`:    `prefer.provider` selects that registered
 *                            key directly; `prefer.model` only succeeds
 *                            if some registered key has it AS its
 *                            defaultModel (no per-request model
 *                            override yet — that lands in 18d/18e when
 *                            the native bridge accepts a `model` arg).
 *
 * Tone is accepted in the input shape but ignored at this stage. Native
 * `chatStream()` doesn't accept temperature today; once 18d/18e land,
 * the resolver maps tone → temperature per the catalog's model class.
 *
 * Pure module: no Capacitor / native imports. Fully unit-testable.
 */

import type { Capability, ModelSpec } from "./modelCatalog.js";
import { getModel, matchesCapabilities } from "./modelCatalog.js";
import { DEFAULT_KEY_POLICY } from "./types.js";
import type { KeyPolicy, RelayProviderInfo, Tone } from "./types.js";

export interface ResolveInput {
  /** Capabilities the request needs. */
  requires?: readonly Capability[];
  /**
   * Behavioural abstraction over temperature. Accepted for API parity
   * with the extension; carried through but not yet applied by the
   * mobile resolver — native `chatStream()` doesn't accept temperature
   * until Phase 18d/18e extends the bridge.
   */
  tone?: Tone;
  /** Tier-3 explicit overrides. */
  prefer?: {
    /**
     * Pin a specific provider. Must match an already-registered key.
     * Resolver returns reject when the provider isn't registered.
     */
    provider?: string;
    /**
     * Pin a specific model. Only succeeds when some registered key has
     * this string as its `defaultModel`. Until 18d/18e, the native
     * bridge always uses the registered key's defaultModel; arbitrary
     * model overrides per-request aren't possible yet.
     */
    model?: string;
  };
}

export type ResolveReason =
  | "default" // Tier 1
  | "explicit" // Tier 3 (prefer.provider or prefer.model)
  | "capability-match"; // Tier 2

export type ResolveResult =
  | {
      kind: "ready";
      provider: string;
      /** The model spec the native side will execute against. */
      model: ModelSpec;
      reason: ResolveReason;
    }
  | {
      kind: "reject";
      reason:
        | "no-providers-registered"
        | "default-model-not-in-catalog"
        | "no-model-matches-capabilities"
        | "model-not-registered"
        | "provider-not-registered"
        | "model-outside-allowlist"
        | "model-in-denylist";
      message: string;
    };

/**
 * Resolve a request to a registered provider + that provider's
 * defaultModel. Pure function; takes the providers list from
 * `listProviders()` as a parameter so the caller controls IO.
 */
export function resolve(
  input: ResolveInput,
  providers: readonly RelayProviderInfo[],
  policy: KeyPolicy = DEFAULT_KEY_POLICY,
): ResolveResult {
  if (providers.length === 0) {
    return {
      kind: "reject",
      reason: "no-providers-registered",
      message:
        "No keys are registered. Call `registerKey()` for at least one provider before requesting a chat stream.",
    };
  }

  // Tier 3: explicit prefer.model
  if (input.prefer?.model) {
    const match = providers.find((p) => p.defaultModel === input.prefer!.model);
    if (!match) {
      return {
        kind: "reject",
        reason: "model-not-registered",
        message: `Model "${input.prefer.model}" is not the default model of any registered key. Until the mobile broker supports per-request model overrides (Phase 18d/18e), register a key whose defaultModel is "${input.prefer.model}" first.`,
      };
    }
    const spec = getModel(match.defaultModel);
    if (!spec) {
      return modelNotInCatalog(match.defaultModel);
    }
    const denial = enforcePolicy(spec, policy);
    if (denial) return denial;
    return { kind: "ready", provider: match.provider, model: spec, reason: "explicit" };
  }

  // Tier 3: explicit prefer.provider
  if (input.prefer?.provider) {
    const match = providers.find((p) => p.provider === input.prefer!.provider);
    if (!match) {
      return {
        kind: "reject",
        reason: "provider-not-registered",
        message: `Provider "${input.prefer.provider}" is not registered. Call \`registerKey({ provider: "${input.prefer.provider}", … })\` first.`,
      };
    }
    const spec = getModel(match.defaultModel);
    if (!spec) {
      return modelNotInCatalog(match.defaultModel);
    }
    const denial = enforcePolicy(spec, policy);
    if (denial) return denial;
    return { kind: "ready", provider: match.provider, model: spec, reason: "explicit" };
  }

  // Tier 2: capability-driven (requires[])
  const caps = input.requires ?? [];
  if (caps.length > 0) {
    const candidates: Array<{ info: RelayProviderInfo; spec: ModelSpec }> = [];
    for (const info of providers) {
      const spec = getModel(info.defaultModel);
      if (!spec) continue;
      if (!matchesCapabilities(spec, caps)) continue;
      if (enforcePolicy(spec, policy)) continue;
      candidates.push({ info, spec });
    }
    if (candidates.length === 0) {
      return {
        kind: "reject",
        reason: "no-model-matches-capabilities",
        message: `No registered key has a defaultModel satisfying capabilities: ${caps.join(", ")}. Register a key whose defaultModel covers them, or relax the requirements.`,
      };
    }
    // Cheapest by output rate.
    candidates.sort(
      (a, b) => a.spec.pricing.outputPer1M - b.spec.pricing.outputPer1M,
    );
    const winner = candidates[0];
    return {
      kind: "ready",
      provider: winner.info.provider,
      model: winner.spec,
      reason: "capability-match",
    };
  }

  // Tier 1: zero-config — first registered provider's defaultModel.
  const first = providers[0];
  const spec = getModel(first.defaultModel);
  if (!spec) {
    return modelNotInCatalog(first.defaultModel);
  }
  const denial = enforcePolicy(spec, policy);
  if (denial) return denial;
  return { kind: "ready", provider: first.provider, model: spec, reason: "default" };
}

function modelNotInCatalog(modelId: string): ResolveResult {
  return {
    kind: "reject",
    reason: "default-model-not-in-catalog",
    message: `Registered defaultModel "${modelId}" is not in the local catalog. Pricing and capability checks aren't possible — update keyquill-mobile or pick a known model.`,
  };
}

/**
 * Apply the model-list parts of `KeyPolicy.modelPolicy` to a candidate
 * `ModelSpec`. Returns a rejection result when the model is denied;
 * returns null when allowed. Used by every resolver tier.
 *
 * Mobile broker enforces only allowlist/denylist here; budget,
 * privacy, sampling, and behaviour policies stay with the legacy
 * native enforcer (RelayPolicy) until Phase 18d/18e.
 */
function enforcePolicy(
  model: ModelSpec,
  policy: KeyPolicy,
): ResolveResult | null {
  const mp = policy.modelPolicy;
  if (
    mp.mode === "allowlist" &&
    mp.allowedModels &&
    !mp.allowedModels.includes(model.id)
  ) {
    return {
      kind: "reject",
      reason: "model-outside-allowlist",
      message: `Model "${model.id}" is not in this key's allowlist. Add it via the policy editor, or pick a different key.`,
    };
  }
  if (mp.mode === "denylist" && mp.deniedModels?.includes(model.id)) {
    return {
      kind: "reject",
      reason: "model-in-denylist",
      message: `Model "${model.id}" is on this key's denylist. Remove it from the denylist, or pick a different key.`,
    };
  }
  return null;
}

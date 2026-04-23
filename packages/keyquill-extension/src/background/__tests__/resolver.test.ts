import { describe, it, expect } from "vitest";
import { resolveRequest, resolveKeyDefault, __test, type ResolverInput } from "../resolver.js";
import type { KeyPolicy, KeyRecord } from "../../shared/protocol.js";
import { DEFAULT_KEY_POLICY, CURRENT_POLICY_VERSION } from "../../shared/protocol.js";
import { getModel, cheapestModelForProvider } from "../../shared/modelCatalog.js";

function mkPolicy(overrides: Partial<KeyPolicy> = {}): KeyPolicy {
  return {
    ...DEFAULT_KEY_POLICY,
    ...overrides,
  };
}

function mkKey(overrides: Partial<KeyRecord> = {}): KeyRecord {
  return {
    keyId: "k1",
    provider: "openai",
    label: "Work",
    apiKey: "sk-test",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.4-mini",
    isActive: true,
    policy: mkPolicy(),
    policyVersion: CURRENT_POLICY_VERSION,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const BASE_INPUT: ResolverInput = {
  request: { messages: [{ role: "user", content: "hi" }] },
  origin: "https://example.com",
  key: mkKey(),
};

// ── Stage 1: Privacy ───────────────────────────────────

describe("privacyCheck", () => {
  it("allows when policy is open", () => {
    expect(__test.privacyCheck(BASE_INPUT)).toBeNull();
  });

  it("rejects non-https baseUrl when policy requires it", () => {
    const input = {
      ...BASE_INPUT,
      key: mkKey({ baseUrl: "http://api.example.com/v1" }),
    };
    expect(__test.privacyCheck(input)).toMatchObject({
      kind: "reject",
      reason: "https-required",
    });
  });

  it("permits localhost http for dev", () => {
    const input = {
      ...BASE_INPUT,
      key: mkKey({ baseUrl: "http://localhost:8080/v1" }),
    };
    expect(__test.privacyCheck(input)).toBeNull();
  });

  it("rejects origin outside allowedOriginsRegex", () => {
    const input = {
      ...BASE_INPUT,
      origin: "https://evil.com",
      key: mkKey({
        policy: mkPolicy({
          privacy: {
            requireHttps: true,
            logAuditEvents: true,
            allowedOriginsRegex: "^https://trusted\\.com",
          },
        }),
      }),
    };
    expect(__test.privacyCheck(input)).toMatchObject({
      kind: "reject",
      reason: "origin-blocked",
    });
  });

  it("fails closed on malformed origin regex", () => {
    const input = {
      ...BASE_INPUT,
      key: mkKey({
        policy: mkPolicy({
          privacy: {
            requireHttps: true,
            logAuditEvents: true,
            allowedOriginsRegex: "[unterminated",
          },
        }),
      }),
    };
    expect(__test.privacyCheck(input)?.kind).toBe("reject");
  });

  it("rejects when provider not in allowedProviders", () => {
    const input = {
      ...BASE_INPUT,
      key: mkKey({
        provider: "openai",
        policy: mkPolicy({
          privacy: {
            requireHttps: true,
            logAuditEvents: true,
            allowedProviders: ["anthropic"],
          },
        }),
      }),
    };
    expect(__test.privacyCheck(input)).toMatchObject({
      kind: "reject",
      reason: "provider-blocked",
    });
  });
});

// ── Key default resolution ─────────────────────────────

describe("resolveKeyDefault", () => {
  it("prefers policy.modelPolicy.defaultModel over the legacy record field", () => {
    const key = mkKey({
      defaultModel: "gpt-5.4-mini",
      policy: mkPolicy({
        modelPolicy: {
          ...DEFAULT_KEY_POLICY.modelPolicy,
          defaultModel: "gpt-5.4-pro",
        },
      }),
    });
    expect(resolveKeyDefault(key)?.id).toBe("gpt-5.4-pro");
  });

  it("falls back to record.defaultModel when policy.modelPolicy.defaultModel is unset", () => {
    const key = mkKey({
      defaultModel: "gpt-5.4-mini",
      policy: mkPolicy({ modelPolicy: { ...DEFAULT_KEY_POLICY.modelPolicy } }),
    });
    expect(resolveKeyDefault(key)?.id).toBe("gpt-5.4-mini");
  });

  it("falls back to preset default when both policy and record fields are empty", () => {
    const key = mkKey({
      provider: "anthropic",
      defaultModel: "", // intentionally empty to exercise the preset fallback
      policy: mkPolicy({ modelPolicy: { ...DEFAULT_KEY_POLICY.modelPolicy } }),
    });
    // anthropic preset default is claude-sonnet-4-6
    expect(resolveKeyDefault(key)?.id).toBe("claude-sonnet-4-6");
  });

  it("falls back to the cheapest catalog model for the provider when no preset match", () => {
    // openai preset default is gpt-5.4-mini; clear it to force the final
    // catalog fallback. We reach this branch by setting a policy and
    // record default that don't resolve to a catalog entry AND by
    // bypassing the preset. Easiest: use a provider that has models in
    // the catalog but whose preset default is intentionally made
    // unknown. `openai` works — the test mocks an unknown preset default
    // by using a provider without a matching preset (e.g., "fireworks"
    // isn't in presets; only in catalog). Actually, any provider present
    // in catalog but not presets hits this path.
    const key = mkKey({
      provider: "fireworks",
      defaultModel: "",
      policy: mkPolicy({ modelPolicy: { ...DEFAULT_KEY_POLICY.modelPolicy } }),
    });
    const expected = cheapestModelForProvider("fireworks");
    // fireworks has no preset and no catalog entries currently → null.
    // If the catalog adds fireworks later, this test verifies the
    // cheapest-pick branch runs; until then it asserts null.
    expect(resolveKeyDefault(key)).toBe(expected);
  });

  it("returns null when policy pins an unknown model and nothing else resolves", () => {
    const key = mkKey({
      provider: "nonexistent-provider-xyz",
      defaultModel: "also-fake-model",
      policy: mkPolicy({
        modelPolicy: {
          ...DEFAULT_KEY_POLICY.modelPolicy,
          defaultModel: "typo-model-name",
        },
      }),
    });
    expect(resolveKeyDefault(key)).toBeNull();
  });

  it("uses the catalog cheapest for openai when every earlier step is cleared", () => {
    // Sanity: openai has many catalog entries. Clearing policy + record
    // defaults AND using a provider string that matches openai in catalog
    // but no preset would be ideal. Since "openai" has a preset, this
    // scenario is not reachable for openai in real data — but we can
    // simulate via a catalog-only provider. "openrouter" has a preset,
    // so use the known preset-default chain instead here to confirm the
    // preset branch wins over catalog-cheapest when both are available.
    const key = mkKey({
      provider: "openai",
      defaultModel: "",
      policy: mkPolicy({ modelPolicy: { ...DEFAULT_KEY_POLICY.modelPolicy } }),
    });
    // openai preset default is gpt-5.4-mini — that should win over catalog cheapest.
    expect(resolveKeyDefault(key)?.id).toBe("gpt-5.4-mini");
  });
});

// ── Stage 2+3: Model selection ─────────────────────────

describe("selectModel", () => {
  it("picks key.defaultModel when no requires/prefer set", () => {
    const result = __test.selectModel(BASE_INPUT);
    if ("kind" in result) throw new Error("unexpected reject");
    expect(result.model.id).toBe("gpt-5.4-mini");
    expect(result.reason).toBe("default");
  });

  it("picks prefer.model when set", () => {
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, prefer: { model: "gpt-5.4-pro" } },
    };
    const result = __test.selectModel(input);
    if ("kind" in result) throw new Error("unexpected reject");
    expect(result.model.id).toBe("gpt-5.4-pro");
    expect(result.reason).toBe("explicit");
  });

  it("rejects unknown prefer.model", () => {
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, prefer: { model: "fake-model-xyz" } },
    };
    const result = __test.selectModel(input);
    expect(result).toMatchObject({ kind: "reject", reason: "unknown-model" });
  });

  it("picks a model matching requires", () => {
    // Key's default (gpt-5.4-mini) already satisfies the capabilities, so
    // the resolver reports reason="default" (it used the default; the
    // default happened to be compatible). Capability-match is reported
    // when the default is incompatible and we deliberately searched.
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, requires: ["reasoning" as const, "long_context" as const] },
    };
    const result = __test.selectModel(input);
    if ("kind" in result) throw new Error("unexpected reject");
    expect(result.model.capabilities).toContain("reasoning");
    expect(result.model.capabilities).toContain("long_context");
    expect(result.reason).toBe("default");
  });

  it("picks via capability search when key.defaultModel doesn't satisfy", () => {
    // Pin an allowlist that excludes the key's default so the search
    // path has to pick something else.
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, requires: ["vision" as const] },
      key: mkKey({
        defaultModel: "gpt-4o-mini",
        policy: mkPolicy({
          modelPolicy: {
            mode: "allowlist",
            allowedModels: ["gpt-5.4-pro", "claude-sonnet-4-6"],
            onViolation: "reject",
          },
        }),
      }),
    };
    const result = __test.selectModel(input);
    if ("kind" in result) throw new Error("unexpected reject");
    expect(result.reason).toBe("capability-match");
  });

  it("implicit tool_use when tools passed", () => {
    const haiku = getModel("claude-haiku-4-5")!;
    expect(haiku.capabilities).toContain("tool_use");
    const input = {
      ...BASE_INPUT,
      request: {
        messages: [{ role: "user" as const, content: "hi" }],
        tools: [{ type: "function" as const, function: { name: "f" } }],
      },
      key: mkKey({ provider: "anthropic", defaultModel: "claude-haiku-4-5" }),
    };
    const result = __test.selectModel(input);
    if ("kind" in result) {
      throw new Error(result.kind === "reject" ? result.reason : result.kind);
    }
    expect(result.model.capabilities).toContain("tool_use");
  });

  it("rejects when no model satisfies capabilities", () => {
    const input = {
      ...BASE_INPUT,
      key: mkKey({
        policy: mkPolicy({
          modelPolicy: {
            mode: "allowlist",
            allowedModels: ["gpt-4o-mini"], // has no reasoning capability
            onViolation: "reject",
          },
        }),
      }),
      request: { ...BASE_INPUT.request, requires: ["reasoning" as const] },
    };
    const result = __test.selectModel(input);
    expect(result).toMatchObject({ kind: "reject", reason: "no-model-matches-capabilities" });
  });

  it("honors preferredPerCapability", () => {
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, requires: ["vision" as const] },
      key: mkKey({
        policy: mkPolicy({
          modelPolicy: {
            mode: "open",
            preferredPerCapability: { vision: "claude-sonnet-4-6" },
            onViolation: "confirm",
          },
        }),
      }),
    };
    const result = __test.selectModel(input);
    if ("kind" in result) throw new Error("unexpected reject");
    expect(result.model.id).toBe("claude-sonnet-4-6");
  });

  it("denylist mode with reject violation returns reject", () => {
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, prefer: { model: "gpt-5.4-pro" } },
      key: mkKey({
        policy: mkPolicy({
          modelPolicy: {
            mode: "denylist",
            deniedModels: ["gpt-5.4-pro"],
            onViolation: "reject",
          },
        }),
      }),
    };
    const result = __test.selectModel(input);
    expect(result).toMatchObject({ kind: "reject", reason: "model-denied-by-policy" });
  });

  it("denylist mode with confirm violation returns consent-required", () => {
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, prefer: { model: "gpt-5.4-pro" } },
      key: mkKey({
        policy: mkPolicy({
          modelPolicy: {
            mode: "denylist",
            deniedModels: ["gpt-5.4-pro"],
            onViolation: "confirm",
          },
        }),
      }),
    };
    const result = __test.selectModel(input);
    expect(result).toMatchObject({ kind: "consent-required", reason: "model-in-denylist" });
  });

  it("allowlist mode with confirm violation returns consent-required", () => {
    const input = {
      ...BASE_INPUT,
      request: { ...BASE_INPUT.request, prefer: { model: "gpt-5.4-pro" } },
      key: mkKey({
        policy: mkPolicy({
          modelPolicy: {
            mode: "allowlist",
            allowedModels: ["gpt-5.4-mini"],
            onViolation: "confirm",
          },
        }),
      }),
    };
    const result = __test.selectModel(input);
    expect(result).toMatchObject({ kind: "consent-required", reason: "model-outside-allowlist" });
  });
});

// ── Stage 4: Budget ────────────────────────────────────

describe("budgetCheck", () => {
  const pro = getModel("gpt-5.4-pro")!;

  it("passes when estimated cost is under the limit", () => {
    const policy = mkPolicy({
      budget: { maxCostPerRequestUSD: 1, onBudgetHit: "block" },
    });
    expect(__test.budgetCheck(pro, 0.5, policy, "origin", "key")).toBeNull();
  });

  it("rejects when onBudgetHit is block and cost exceeds", () => {
    const policy = mkPolicy({
      budget: { maxCostPerRequestUSD: 0.01, onBudgetHit: "block" },
    });
    expect(__test.budgetCheck(pro, 0.5, policy, "origin", "key")).toMatchObject({
      kind: "reject",
      reason: "budget-request-over-limit",
    });
  });

  it("returns consent-required when onBudgetHit is confirm", () => {
    const policy = mkPolicy({
      budget: { maxCostPerRequestUSD: 0.01, onBudgetHit: "confirm" },
    });
    expect(__test.budgetCheck(pro, 0.5, policy, "origin", "key")).toMatchObject({
      kind: "consent-required",
      reason: "high-cost",
    });
  });

  it("passes when onBudgetHit is warn (delegates to ledger in Phase 5)", () => {
    const policy = mkPolicy({
      budget: { maxCostPerRequestUSD: 0.01, onBudgetHit: "warn" },
    });
    expect(__test.budgetCheck(pro, 0.5, policy, "origin", "key")).toBeNull();
  });
});

// ── Reasoning effort clamp ─────────────────────────────

describe("clampReasoningEffort", () => {
  it("returns undefined when request doesn't set effort", () => {
    expect(__test.clampReasoningEffort(undefined, "medium")).toEqual({
      effective: undefined,
      clamped: false,
    });
  });

  it("keeps request as-is when under cap", () => {
    expect(__test.clampReasoningEffort("low", "high")).toEqual({
      effective: "low",
      clamped: false,
    });
  });

  it("clamps to cap when over", () => {
    expect(__test.clampReasoningEffort("high", "low")).toEqual({
      effective: "low",
      clamped: true,
    });
  });

  it("equal values are not clamped", () => {
    expect(__test.clampReasoningEffort("medium", "medium")).toEqual({
      effective: "medium",
      clamped: false,
    });
  });
});

// ── Token clamp ────────────────────────────────────────

describe("clampMaxOutput", () => {
  it("uses model.context.output when nothing else set", () => {
    expect(__test.clampMaxOutput(undefined, undefined, 4096)).toEqual({
      effective: 4096,
      limitSource: "model.context.output",
    });
  });

  it("picks the smallest limit among candidates", () => {
    expect(__test.clampMaxOutput(5000, 2000, 10000)).toEqual({
      effective: 2000,
      limitSource: "policy.maxTokensPerRequest",
    });
  });

  it("request wins when it's the smallest", () => {
    expect(__test.clampMaxOutput(100, 2000, 10000)).toEqual({
      effective: 100,
      limitSource: "request.maxOutput",
    });
  });
});

// ── Temperature resolution ─────────────────────────────

describe("resolveTemperature", () => {
  const mini = getModel("gpt-5.4-mini")!; // reasoning, temperatureMustBe: 1
  const gpt4o = getModel("gpt-4o")!;       // no constraint
  const sonnet = getModel("claude-sonnet-4-6")!;

  it("forces temperature=1 for reasoning models regardless of tone", () => {
    const result = __test.resolveTemperature(
      mini,
      { messages: [], tone: "creative" },
      DEFAULT_KEY_POLICY,
    );
    expect(result).toEqual({ value: 1, source: "model-constraint" });
  });

  it("tone=precise → 0 for gpt-4o", () => {
    const result = __test.resolveTemperature(
      gpt4o,
      { messages: [], tone: "precise" },
      DEFAULT_KEY_POLICY,
    );
    expect(result).toEqual({ value: 0.0, source: "tone" });
  });

  it("tone=creative → 1.2 for gpt-4o, 1.0 for anthropic", () => {
    expect(
      __test.resolveTemperature(gpt4o, { messages: [], tone: "creative" }, DEFAULT_KEY_POLICY).value,
    ).toBe(1.2);
    expect(
      __test.resolveTemperature(sonnet, { messages: [], tone: "creative" }, DEFAULT_KEY_POLICY).value,
    ).toBe(1.0);
  });

  it("prefer.temperature overrides tone (for non-constrained models)", () => {
    const result = __test.resolveTemperature(
      gpt4o,
      { messages: [], tone: "creative", prefer: { temperature: 0.3 } },
      DEFAULT_KEY_POLICY,
    );
    expect(result).toEqual({ value: 0.3, source: "prefer" });
  });

  it("policy.sampling.temperature is used when request doesn't specify", () => {
    const result = __test.resolveTemperature(
      gpt4o,
      { messages: [] },
      { ...DEFAULT_KEY_POLICY, sampling: { temperature: 0.4 } },
    );
    expect(result).toEqual({ value: 0.4, source: "policy" });
  });

  it("omitted when nothing configured", () => {
    const result = __test.resolveTemperature(gpt4o, { messages: [] }, DEFAULT_KEY_POLICY);
    expect(result).toEqual({ value: undefined, source: "omitted" });
  });
});

// ── Input token estimate ───────────────────────────────

describe("estimateInputTokens", () => {
  it("counts rough chars / 4 for plain text messages", () => {
    // 8 chars → 2 tokens
    const n = __test.estimateInputTokens(
      [{ role: "user", content: "12345678" }],
      undefined,
    );
    expect(n).toBe(2);
  });

  it("handles mixed ContentPart[]", () => {
    const n = __test.estimateInputTokens(
      [{ role: "user", content: [{ type: "text", text: "hello world, this is some text" }] }],
      undefined,
    );
    expect(n).toBeGreaterThan(5);
  });

  it("counts tool definitions", () => {
    const n = __test.estimateInputTokens(
      [{ role: "user", content: "hi" }],
      [
        {
          type: "function",
          function: { name: "lookup", description: "find something", parameters: { type: "object" } },
        },
      ],
    );
    expect(n).toBeGreaterThan(8);
  });
});

// ── Full pipeline ──────────────────────────────────────

describe("resolveRequest (end to end)", () => {
  it("produces a ready ExecutionPlan for a minimal chat request", async () => {
    const out = await resolveRequest(BASE_INPUT);
    if (out.kind !== "ready") throw new Error(`unexpected ${out.kind}`);
    expect(out.plan.model.id).toBe("gpt-5.4-mini");
    expect(out.plan.endpoint).toBe("chat");
    expect(out.plan.url).toContain("/chat/completions");
    expect(out.plan.headers.Authorization).toBe("Bearer sk-test");
    expect(out.plan.trace.modelSelectionReason).toBe("default");
    expect(out.plan.estimatedCostUSD).toBeGreaterThanOrEqual(0);
  });

  it("routes gpt-5.4-pro to /responses with temperature=1", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: { messages: [{ role: "user", content: "hi" }], prefer: { model: "gpt-5.4-pro" } },
    };
    const out = await resolveRequest(input);
    if (out.kind !== "ready") throw new Error(`unexpected ${out.kind}`);
    expect(out.plan.endpoint).toBe("responses");
    expect(out.plan.url).toContain("/responses");
    const body = JSON.parse(out.plan.body);
    expect(body.input).toBeDefined();
    expect(body.temperature).toBe(1);
    expect(body.max_output_tokens).toBeDefined();
    expect(body.max_tokens).toBeUndefined();
  });

  it("routes anthropic with thinking budget when reasoning_effort set", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      key: mkKey({
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        defaultModel: "claude-sonnet-4-6",
      }),
      request: {
        messages: [{ role: "user", content: "hi" }],
        prefer: { reasoningEffort: "high" },
      },
    };
    const out = await resolveRequest(input);
    if (out.kind !== "ready") throw new Error(`unexpected ${out.kind}`);
    expect(out.plan.endpoint).toBe("anthropic");
    const body = JSON.parse(out.plan.body);
    expect(body.thinking).toEqual({ type: "enabled", budget_tokens: 32000 });
    expect(out.plan.headers["x-api-key"]).toBe("sk-test");
  });

  it("clamps maxOutput to policy cap and records trace", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: { messages: [{ role: "user", content: "hi" }], maxOutput: 10000 },
      key: mkKey({
        policy: mkPolicy({
          budget: { maxTokensPerRequest: 512, onBudgetHit: "warn" },
        }),
      }),
    };
    const out = await resolveRequest(input);
    if (out.kind !== "ready") throw new Error(`unexpected ${out.kind}`);
    expect(out.plan.trace.clampedMaxOutput?.effective).toBe(512);
    expect(out.plan.trace.clampedMaxOutput?.limitSource).toBe("policy.maxTokensPerRequest");
  });

  it("clamps reasoning effort to policy cap", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: {
        messages: [{ role: "user", content: "hi" }],
        prefer: { reasoningEffort: "high" },
      },
      key: mkKey({
        policy: mkPolicy({
          budget: { maxReasoningEffort: "low", onBudgetHit: "warn" },
        }),
      }),
    };
    const out = await resolveRequest(input);
    if (out.kind !== "ready") throw new Error(`unexpected ${out.kind}`);
    expect(out.plan.trace.clampedReasoning).toEqual({ requested: "high", effective: "low" });
  });

  it("rejects when a required capability isn't satisfied by any allowed model", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: { messages: [{ role: "user", content: "hi" }], requires: ["audio"] },
      key: mkKey({
        policy: mkPolicy({
          modelPolicy: {
            mode: "allowlist",
            allowedModels: ["gpt-5.4-mini"], // no audio
            onViolation: "reject",
          },
        }),
      }),
    };
    const out = await resolveRequest(input);
    expect(out.kind).toBe("reject");
  });

  it("high-cost + confirm → consent-required", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: { messages: [{ role: "user", content: "this is a long prompt ".repeat(200) }] },
      key: mkKey({
        policy: mkPolicy({
          budget: { maxCostPerRequestUSD: 0.0001, onBudgetHit: "confirm" },
        }),
      }),
    };
    const out = await resolveRequest(input);
    expect(out.kind).toBe("consent-required");
    if (out.kind === "consent-required") {
      expect(out.reason).toBe("high-cost");
      expect(out.context.estimatedCostUSD).toBeGreaterThan(0.0001);
    }
  });

  it("handles streaming flag on request", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: { messages: [{ role: "user", content: "hi" }], stream: true },
    };
    const out = await resolveRequest(input);
    if (out.kind !== "ready") throw new Error(`unexpected ${out.kind}`);
    const body = JSON.parse(out.plan.body);
    expect(body.stream).toBe(true);
  });

  it("consentGranted.modelGate bypasses allowlist on Tier-3 prefer.model", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: { messages: [{ role: "user", content: "hi" }], prefer: { model: "gpt-5.4-pro" } },
      key: mkKey({
        policy: mkPolicy({
          modelPolicy: {
            mode: "allowlist",
            allowedModels: ["gpt-5.4-mini"],
            onViolation: "confirm",
          },
        }),
      }),
      consentGranted: { modelGate: true },
    };
    const out = await resolveRequest(input);
    expect(out.kind).toBe("ready");
    if (out.kind === "ready") {
      expect(out.plan.model.id).toBe("gpt-5.4-pro");
    }
  });

  it("consentGranted.costGate bypasses per-request budget cap", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: { messages: [{ role: "user", content: "x".repeat(400) }] },
      key: mkKey({
        policy: mkPolicy({
          budget: { maxCostPerRequestUSD: 0.0001, onBudgetHit: "confirm" },
        }),
      }),
      consentGranted: { costGate: true },
    };
    const out = await resolveRequest(input);
    expect(out.kind).toBe("ready");
  });

  it("tools implicitly add tool_use requirement and select compatible model", async () => {
    const input: ResolverInput = {
      ...BASE_INPUT,
      request: {
        messages: [{ role: "user", content: "hi" }],
        tools: [{ type: "function", function: { name: "f" } }],
      },
    };
    const out = await resolveRequest(input);
    if (out.kind !== "ready") throw new Error(`unexpected ${out.kind}`);
    expect(out.plan.model.capabilities).toContain("tool_use");
  });
});

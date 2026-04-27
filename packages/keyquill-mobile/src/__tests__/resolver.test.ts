import { describe, it, expect } from "vitest";
import { resolve, type ResolveInput } from "../resolver.js";
import {
  DEFAULT_KEY_POLICY,
  type KeyPolicy,
  type RelayProviderInfo,
} from "../types.js";

function provider(
  overrides: Partial<RelayProviderInfo> = {},
): RelayProviderInfo {
  return {
    provider: "openai",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-5.4-mini",
    keyHint: "sk-t…st12",
    label: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const policyAllowlist: KeyPolicy = {
  ...DEFAULT_KEY_POLICY,
  modelPolicy: {
    ...DEFAULT_KEY_POLICY.modelPolicy,
    mode: "allowlist",
    allowedModels: ["gpt-5.4-pro"],
    onViolation: "reject",
  },
};

const policyDenylist: KeyPolicy = {
  ...DEFAULT_KEY_POLICY,
  modelPolicy: {
    ...DEFAULT_KEY_POLICY.modelPolicy,
    mode: "denylist",
    deniedModels: ["gpt-5.4-mini"],
    onViolation: "reject",
  },
};

describe("resolve — Tier 1 (zero-config)", () => {
  it("uses the first registered provider's defaultModel", () => {
    const result = resolve({}, [provider()]);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.provider).toBe("openai");
    expect(result.model.id).toBe("gpt-5.4-mini");
    expect(result.reason).toBe("default");
  });

  it("rejects when no providers are registered", () => {
    const result = resolve({}, []);
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reason).toBe("no-providers-registered");
  });

  it("rejects when first provider's defaultModel is not in the catalog", () => {
    const result = resolve(
      {},
      [provider({ defaultModel: "fictional-model-xyz" })],
    );
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reason).toBe("default-model-not-in-catalog");
  });
});

describe("resolve — Tier 2 (capability-driven)", () => {
  it("filters out providers whose defaultModel lacks a requested capability", () => {
    // gpt-4o-mini has tool_use + streaming but NOT reasoning; gpt-5.4-pro has reasoning.
    const providers = [
      provider({ provider: "openai-legacy", defaultModel: "gpt-4o-mini" }),
      provider({ provider: "openai-pro", defaultModel: "gpt-5.4-pro" }),
    ];
    const result = resolve({ requires: ["reasoning"] }, providers);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.provider).toBe("openai-pro");
    expect(result.model.id).toBe("gpt-5.4-pro");
    expect(result.reason).toBe("capability-match");
  });

  it("picks the cheapest by output rate when multiple providers qualify", () => {
    // claude-haiku-4-5 ($1/M output, has tool_use) vs
    // gpt-5.4-mini ($0.6/M output, has tool_use) → mini wins.
    const providers = [
      provider({ provider: "anthropic", defaultModel: "claude-haiku-4-5" }),
      provider({ provider: "openai", defaultModel: "gpt-5.4-mini" }),
    ];
    const result = resolve({ requires: ["tool_use"] }, providers);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.provider).toBe("openai");
    expect(result.model.id).toBe("gpt-5.4-mini");
  });

  it("rejects when no registered provider's defaultModel matches", () => {
    const providers = [provider({ defaultModel: "gpt-5.4-mini" })];
    // Audio capability isn't on gpt-5.4-mini.
    const result = resolve({ requires: ["audio"] }, providers);
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reason).toBe("no-model-matches-capabilities");
  });
});

describe("resolve — Tier 3 (prefer.provider)", () => {
  it("honours an explicit provider when registered", () => {
    const providers = [
      provider({ provider: "openai", defaultModel: "gpt-5.4-mini" }),
      provider({ provider: "anthropic", defaultModel: "claude-sonnet-4-6" }),
    ];
    const result = resolve(
      { prefer: { provider: "anthropic" } },
      providers,
    );
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.provider).toBe("anthropic");
    expect(result.model.id).toBe("claude-sonnet-4-6");
    expect(result.reason).toBe("explicit");
  });

  it("rejects when the requested provider isn't registered", () => {
    const result = resolve(
      { prefer: { provider: "groq" } },
      [provider({ provider: "openai" })],
    );
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reason).toBe("provider-not-registered");
  });
});

describe("resolve — Tier 3 (prefer.model)", () => {
  it("succeeds only when some registered key has the model as its defaultModel", () => {
    const providers = [
      provider({ provider: "openai", defaultModel: "gpt-5.4-mini" }),
    ];
    const result = resolve(
      { prefer: { model: "gpt-5.4-mini" } },
      providers,
    );
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.provider).toBe("openai");
    expect(result.model.id).toBe("gpt-5.4-mini");
    expect(result.reason).toBe("explicit");
  });

  it("rejects when the requested model is not the defaultModel of any registered key", () => {
    const providers = [
      provider({ provider: "openai", defaultModel: "gpt-5.4-mini" }),
    ];
    const result = resolve(
      { prefer: { model: "gpt-5.4-pro" } }, // not registered
      providers,
    );
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reason).toBe("model-not-registered");
  });
});

describe("resolve — KeyPolicy enforcement", () => {
  it("enforces allowlist mode and rejects models outside it", () => {
    const result = resolve({}, [provider()], policyAllowlist);
    // gpt-5.4-mini is the default, not on the ["gpt-5.4-pro"] allowlist
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reason).toBe("model-outside-allowlist");
  });

  it("allowlist mode permits models that ARE in the list", () => {
    const result = resolve(
      {},
      [provider({ defaultModel: "gpt-5.4-pro" })],
      policyAllowlist,
    );
    expect(result.kind).toBe("ready");
  });

  it("denylist mode rejects denied models", () => {
    const result = resolve({}, [provider()], policyDenylist);
    expect(result.kind).toBe("reject");
    if (result.kind !== "reject") return;
    expect(result.reason).toBe("model-in-denylist");
  });

  it("denylist mode permits non-denied models", () => {
    const result = resolve(
      {},
      [provider({ defaultModel: "gpt-5.4-pro" })],
      policyDenylist,
    );
    expect(result.kind).toBe("ready");
  });

  it("Tier 2 skips candidates that violate policy", () => {
    // mini violates the allowlist → resolver should look further.
    const providers = [
      provider({ provider: "openai-mini", defaultModel: "gpt-5.4-mini" }),
      provider({ provider: "openai-pro", defaultModel: "gpt-5.4-pro" }),
    ];
    const result = resolve(
      { requires: ["streaming"] },
      providers,
      policyAllowlist,
    );
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.provider).toBe("openai-pro");
  });
});

describe("resolve — `tone` is parsed but inert in 18a-3", () => {
  it("accepts tone without changing routing", () => {
    const input: ResolveInput = { tone: "precise" };
    const result = resolve(input, [provider()]);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.reason).toBe("default");
    // Tone has no observable side effect at this phase. Native bridge
    // doesn't accept temperature; that lands in 18d/18e.
  });
});

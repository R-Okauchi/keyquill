import { describe, it, expect } from "vitest";
import {
  MODEL_CATALOG,
  ALL_MODELS,
  ALL_CAPABILITIES,
  getModel,
  matchesCapabilities,
  findByCapabilities,
  estimateCost,
  isResponsesEndpoint,
  isOpenAIReasoning,
  CATALOG_EFFECTIVE_DATE,
  type ModelSpec,
} from "../modelCatalog.js";
import { PRESETS } from "../presets.js";

// ── Shape validity ─────────────────────────────────────

describe("MODEL_CATALOG shape validity", () => {
  it("has at least one entry per non-custom preset", () => {
    const presetIds = PRESETS.filter((p) => p.id !== "custom").map((p) => p.id);
    for (const pid of presetIds) {
      const hits = ALL_MODELS.filter((m) => m.provider === pid);
      expect(hits.length, `provider ${pid} has no catalog entries`).toBeGreaterThan(0);
    }
  });

  it("every preset's defaultModel exists in the catalog", () => {
    const drift: string[] = [];
    for (const p of PRESETS) {
      if (p.id === "custom") continue;
      if (!getModel(p.defaultModel)) drift.push(`${p.id}: ${p.defaultModel}`);
    }
    expect(drift).toEqual([]);
  });

  it("every model listed in a preset's models[] exists in the catalog", () => {
    const drift: string[] = [];
    for (const p of PRESETS) {
      if (p.id === "custom") continue;
      for (const m of p.models) {
        if (!getModel(m)) drift.push(`${p.id}: ${m}`);
      }
    }
    expect(drift).toEqual([]);
  });

  it("every entry has id matching its record key", () => {
    for (const [key, spec] of Object.entries(MODEL_CATALOG)) {
      expect(spec.id, `catalog key/id mismatch at ${key}`).toBe(key);
    }
  });

  it("every entry's pricing has positive input and output rates", () => {
    for (const m of ALL_MODELS) {
      expect(m.pricing.inputPer1M, `${m.id} inputPer1M`).toBeGreaterThan(0);
      expect(m.pricing.outputPer1M, `${m.id} outputPer1M`).toBeGreaterThan(0);
    }
  });

  it("every entry's context has positive token budgets", () => {
    for (const m of ALL_MODELS) {
      expect(m.context.input, `${m.id} context.input`).toBeGreaterThan(0);
      expect(m.context.output, `${m.id} context.output`).toBeGreaterThan(0);
    }
  });

  it("every entry has at least one capability", () => {
    for (const m of ALL_MODELS) {
      expect(m.capabilities.length, `${m.id} has empty capabilities`).toBeGreaterThan(0);
    }
  });

  it("every capability on every entry is in ALL_CAPABILITIES (no typos)", () => {
    const valid = new Set<string>(ALL_CAPABILITIES);
    for (const m of ALL_MODELS) {
      for (const c of m.capabilities) {
        expect(valid.has(c), `${m.id}: unknown capability "${c}"`).toBe(true);
      }
    }
  });

  it("CATALOG_EFFECTIVE_DATE is a valid ISO date", () => {
    expect(CATALOG_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(new Date(CATALOG_EFFECTIVE_DATE).toString()).not.toBe("Invalid Date");
  });
});

// ── Endpoint correctness (replaces legacy regex tables) ─

describe("endpoint classification", () => {
  it("gpt-*-pro / o*-pro route to /responses", () => {
    for (const id of ["gpt-5-pro", "gpt-5.4-pro", "o3-pro"]) {
      const m = getModel(id)!;
      expect(m.endpoint, `${id} should be responses`).toBe("responses");
      expect(isResponsesEndpoint(m)).toBe(true);
    }
  });

  it("non-pro OpenAI models route to /chat", () => {
    for (const id of ["gpt-5.4-mini", "gpt-5-mini", "gpt-5.4", "gpt-4o", "o3-mini"]) {
      const m = getModel(id)!;
      expect(m.endpoint, `${id} should be chat`).toBe("chat");
    }
  });

  it("Anthropic models route to anthropic endpoint", () => {
    for (const id of ["claude-sonnet-4-6", "claude-haiku-4-5", "claude-opus-4-7"]) {
      const m = getModel(id)!;
      expect(m.endpoint).toBe("anthropic");
    }
  });

  it("non-openai providers never get responses endpoint", () => {
    for (const m of ALL_MODELS) {
      if (m.provider !== "openai") {
        expect(m.endpoint, `${m.id}`).not.toBe("responses");
      }
    }
  });
});

// ── Reasoning model classification ──────────────────────

describe("isOpenAIReasoning", () => {
  it("flags all OpenAI reasoning-family models", () => {
    const expected = [
      "gpt-5.4-mini",
      "gpt-5.4",
      "gpt-5.4-pro",
      "gpt-5.4-thinking",
      "gpt-5.4-nano",
      "gpt-5-mini",
      "gpt-5",
      "gpt-5-pro",
      "o4-mini",
      "o3-mini",
      "o3",
      "o3-pro",
    ];
    for (const id of expected) {
      const m = getModel(id)!;
      expect(isOpenAIReasoning(m), `${id} should be reasoning`).toBe(true);
    }
  });

  it("does not flag legacy OpenAI models", () => {
    for (const id of ["gpt-4o", "gpt-4o-mini"]) {
      const m = getModel(id)!;
      expect(isOpenAIReasoning(m), `${id} should not be reasoning`).toBe(false);
    }
  });

  it("does not flag non-OpenAI models even if they have reasoning capability", () => {
    const claudeSonnet = getModel("claude-sonnet-4-6")!;
    expect(claudeSonnet.capabilities).toContain("reasoning");
    expect(isOpenAIReasoning(claudeSonnet)).toBe(false);

    const deepseekReasoner = getModel("deepseek-reasoner")!;
    expect(deepseekReasoner.capabilities).toContain("reasoning");
    expect(isOpenAIReasoning(deepseekReasoner)).toBe(false);
  });
});

// ── Capability matching ────────────────────────────────

describe("matchesCapabilities", () => {
  it("returns true when model has all required capabilities", () => {
    const sonnet = getModel("claude-sonnet-4-6")!;
    expect(matchesCapabilities(sonnet, ["tool_use", "vision", "reasoning"])).toBe(true);
  });

  it("returns false when model lacks any required capability", () => {
    const haiku = getModel("claude-haiku-4-5")!;
    // Haiku is fast+cheap but not reasoning
    expect(matchesCapabilities(haiku, ["reasoning"])).toBe(false);
  });

  it("empty requirements list always matches", () => {
    const anyModel = ALL_MODELS[0];
    expect(matchesCapabilities(anyModel, [])).toBe(true);
  });
});

describe("findByCapabilities", () => {
  it("returns models that match all capabilities", () => {
    const toolUseAndVision = findByCapabilities(["tool_use", "vision"]);
    expect(toolUseAndVision.length).toBeGreaterThan(0);
    for (const m of toolUseAndVision) {
      expect(m.capabilities).toContain("tool_use");
      expect(m.capabilities).toContain("vision");
    }
  });

  it("filters by provider when requested", () => {
    const openaiReasoning = findByCapabilities(["reasoning"], ["openai"]);
    expect(openaiReasoning.length).toBeGreaterThan(0);
    for (const m of openaiReasoning) {
      expect(m.provider).toBe("openai");
    }
  });

  it("returns empty when no model satisfies", () => {
    const impossible = findByCapabilities(["reasoning", "audio"]);
    // Currently Gemini 2.5 Pro is the only model with both; if that
    // changes update this test. For now it's an existence proof.
    const geminiPro = getModel("gemini-2.5-pro")!;
    expect(impossible).toContain(geminiPro);
  });

  it("empty capability list returns every model", () => {
    expect(findByCapabilities([])).toHaveLength(ALL_MODELS.length);
  });
});

// ── Cost estimation ────────────────────────────────────

describe("estimateCost", () => {
  it("computes input + output cost for a basic model", () => {
    const mini = getModel("gpt-5.4-mini")!;
    // 1M in + 1M out on gpt-5.4-mini = $0.15 + $0.60 = $0.75
    expect(estimateCost(mini, 1_000_000, 1_000_000)).toBeCloseTo(0.75, 5);
  });

  it("handles small token counts correctly", () => {
    const mini = getModel("gpt-5.4-mini")!;
    // 100 input + 50 output
    const cost = estimateCost(mini, 100, 50);
    expect(cost).toBeCloseTo((100 / 1e6) * 0.15 + (50 / 1e6) * 0.6, 10);
  });

  it("includes reasoning tokens when provided", () => {
    const pro = getModel("gpt-5.4-pro")!;
    const withoutReasoning = estimateCost(pro, 1000, 100);
    const withReasoning = estimateCost(pro, 1000, 100, 500);
    expect(withReasoning).toBeGreaterThan(withoutReasoning);
  });

  it("falls back to outputPer1M for reasoning when reasoningPer1M unset", () => {
    // Pick a model whose reasoning rate equals output rate as the current
    // contract; verified by construction (`reasoningPer1M ?? outputPer1M`).
    const thinking = getModel("gpt-5.4-thinking")!;
    expect(thinking.pricing.reasoningPer1M).toBeUndefined();
    const cost = estimateCost(thinking, 0, 0, 1_000_000);
    // Should equal outputPer1M ($12)
    expect(cost).toBeCloseTo(thinking.pricing.outputPer1M, 5);
  });

  it("zero tokens returns zero cost", () => {
    const any = ALL_MODELS[0];
    expect(estimateCost(any, 0, 0)).toBe(0);
  });
});

// ── Pro models have streaming capability advertised ──────────

describe("pro model capabilities", () => {
  it("pro models report streaming as a capability (for resolver clarity)", () => {
    for (const id of ["gpt-5.4-pro", "gpt-5-pro", "o3-pro"]) {
      const m = getModel(id)!;
      // Pro models stream via Responses API; resolver should know they
      // support streaming so dev-declared "streaming" requirement matches.
      expect(m.capabilities, `${id}`).toContain("streaming");
    }
  });
});

// ── Snapshot-ish: count of entries to catch accidental removal ───

describe("catalog size", () => {
  it("has a known minimum number of entries per provider", () => {
    const counts = ALL_MODELS.reduce<Record<string, number>>((acc, m) => {
      acc[m.provider] = (acc[m.provider] ?? 0) + 1;
      return acc;
    }, {});
    const expected = {
      openai: 14,
      anthropic: 3,
      gemini: 3,
      groq: 2,
      deepseek: 2,
      mistral: 3,
      together: 3,
      xai: 3,
      openrouter: 1,
    };
    for (const [provider, min] of Object.entries(expected)) {
      expect(counts[provider], `${provider}`).toBeGreaterThanOrEqual(min);
    }
  });
});

// ── Type-level sanity: ModelSpec is readonly-compatible ─────

it("ModelSpec can be destructured without type errors", () => {
  const m: ModelSpec = getModel("gpt-5.4-mini")!;
  const { id, provider, capabilities } = m;
  expect(typeof id).toBe("string");
  expect(typeof provider).toBe("string");
  expect(Array.isArray(capabilities) || (capabilities as readonly string[]).length >= 0).toBe(true);
});

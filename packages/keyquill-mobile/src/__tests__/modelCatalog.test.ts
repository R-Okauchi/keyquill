import { describe, it, expect } from "vitest";
import {
  ALL_CAPABILITIES,
  ALL_MODELS,
  CATALOG_EFFECTIVE_DATE,
  MODEL_CATALOG,
  cheapestModelForProvider,
  estimateCost,
  findByCapabilities,
  getModel,
  isOpenAIReasoning,
  isResponsesEndpoint,
  matchesCapabilities,
  type ModelSpec,
} from "../modelCatalog.js";

// Mobile's catalog is a verbatim copy of the extension's during Phase
// 18a-1; future @keyquill/core extraction dedupes. These tests mirror
// the extension's parity coverage (shape validity, helper correctness)
// minus the preset cross-checks that don't apply on mobile.

describe("MODEL_CATALOG shape validity", () => {
  it("has at least one entry", () => {
    expect(ALL_MODELS.length).toBeGreaterThan(0);
  });

  it("every entry's id matches its record key", () => {
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

  it("every capability used is in ALL_CAPABILITIES (no typos)", () => {
    const valid = new Set<string>(ALL_CAPABILITIES);
    for (const m of ALL_MODELS) {
      for (const c of m.capabilities) {
        expect(valid.has(c), `${m.id}: unknown capability "${c}"`).toBe(true);
      }
    }
  });

  it("CATALOG_EFFECTIVE_DATE is a valid ISO date prefix", () => {
    expect(CATALOG_EFFECTIVE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("getModel", () => {
  it("returns the spec for a known id", () => {
    const m = getModel("gpt-5.4-mini");
    expect(m?.id).toBe("gpt-5.4-mini");
    expect(m?.provider).toBe("openai");
  });

  it("returns null for an unknown id", () => {
    expect(getModel("definitely-not-a-real-model-id")).toBeNull();
  });
});

describe("matchesCapabilities", () => {
  // Pick a model that we know has reasoning + tool_use (gpt-5.4-pro
  // family is reasoning + tools per the catalog).
  const pro = getModel("gpt-5.4-pro");

  it("true when every requested cap is present", () => {
    if (!pro) throw new Error("gpt-5.4-pro missing — catalog drift");
    expect(matchesCapabilities(pro, ["reasoning"])).toBe(true);
  });

  it("false when one requested cap is missing", () => {
    if (!pro) throw new Error("gpt-5.4-pro missing — catalog drift");
    expect(matchesCapabilities(pro, ["audio"])).toBe(false);
  });

  it("true with empty cap list (no requirements)", () => {
    if (!pro) throw new Error("gpt-5.4-pro missing — catalog drift");
    expect(matchesCapabilities(pro, [])).toBe(true);
  });
});

describe("findByCapabilities", () => {
  it("returns all models that have a requested capability", () => {
    const reasoning = findByCapabilities(["reasoning"]);
    expect(reasoning.length).toBeGreaterThan(0);
    for (const m of reasoning) {
      expect(m.capabilities).toContain("reasoning");
    }
  });

  it("filters by provider when supplied", () => {
    const openaiReasoning = findByCapabilities(["reasoning"], ["openai"]);
    expect(openaiReasoning.length).toBeGreaterThan(0);
    for (const m of openaiReasoning) {
      expect(m.provider).toBe("openai");
      expect(m.capabilities).toContain("reasoning");
    }
  });

  it("returns empty when no model has all requested caps", () => {
    // contrived combo unlikely to be on a single model
    const result = findByCapabilities(["audio", "code", "long_context", "reasoning", "fast", "cheap"]);
    expect(result).toEqual([]);
  });
});

describe("estimateCost", () => {
  const dummy: ModelSpec = {
    id: "test-model",
    provider: "test",
    displayName: "Test Model",
    capabilities: ["streaming"],
    context: { input: 1000, output: 500 },
    endpoint: "chat",
    pricing: {
      inputPer1M: 1,
      outputPer1M: 4,
      effectiveDate: "2026-04-01",
    },
    releaseStage: "stable",
  };

  it("computes input + output cost in USD", () => {
    // 1M input tokens × $1/M = $1; 1M output × $4/M = $4 → $5
    expect(estimateCost(dummy, 1_000_000, 1_000_000)).toBeCloseTo(5);
  });

  it("scales linearly", () => {
    // 100k input × $1/M = $0.10; 50k output × $4/M = $0.20 → $0.30
    expect(estimateCost(dummy, 100_000, 50_000)).toBeCloseTo(0.3);
  });

  it("falls back to outputPer1M for reasoning tokens when reasoningPer1M is unset", () => {
    // no reasoningPer1M → use outputPer1M = $4/M
    // 100k reasoning × $4/M = $0.40
    expect(estimateCost(dummy, 0, 0, 100_000)).toBeCloseTo(0.4);
  });

  it("uses reasoningPer1M when explicit", () => {
    const withReasoning: ModelSpec = {
      ...dummy,
      pricing: { ...dummy.pricing, reasoningPer1M: 8 },
    };
    // 100k reasoning × $8/M = $0.80
    expect(estimateCost(withReasoning, 0, 0, 100_000)).toBeCloseTo(0.8);
  });
});

describe("cheapestModelForProvider", () => {
  it("returns the lowest outputPer1M model for the provider", () => {
    const m = cheapestModelForProvider("openai");
    expect(m).not.toBeNull();
    if (!m) return;
    expect(m.provider).toBe("openai");
    // Whatever it picks, no other openai model should have a strictly
    // lower outputPer1M than the one returned.
    const openaiAll = ALL_MODELS.filter((x) => x.provider === "openai");
    for (const x of openaiAll) {
      expect(x.pricing.outputPer1M).toBeGreaterThanOrEqual(m.pricing.outputPer1M);
    }
  });

  it("returns null for an unknown provider", () => {
    expect(cheapestModelForProvider("nonexistent-provider-xyz")).toBeNull();
  });
});

describe("isResponsesEndpoint / isOpenAIReasoning", () => {
  it("isResponsesEndpoint flips true for /responses-targeted models", () => {
    // There must be at least one model with endpoint=responses in the
    // catalog (openai pro line).
    const responsesModels = ALL_MODELS.filter((m) => m.endpoint === "responses");
    expect(responsesModels.length).toBeGreaterThan(0);
    for (const m of responsesModels) {
      expect(isResponsesEndpoint(m)).toBe(true);
    }
  });

  it("isOpenAIReasoning flips true only for openai + reasoning + temperature-pinned-1", () => {
    for (const m of ALL_MODELS) {
      const expected =
        m.provider === "openai" &&
        m.capabilities.includes("reasoning") &&
        m.constraints?.temperatureMustBe === 1;
      expect(isOpenAIReasoning(m)).toBe(expected);
    }
  });
});

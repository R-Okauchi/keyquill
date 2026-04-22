import { describe, it, expect } from "vitest";
import type { KeyRecord } from "../../shared/protocol.js";
import { buildProviderFetch, normalizeParams } from "../providerFetch.js";

function mkKey(overrides: Partial<KeyRecord> = {}): KeyRecord {
  return {
    keyId: "k1",
    provider: "openai",
    label: "Work",
    apiKey: "sk-test",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-4.1-mini",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("normalizeParams", () => {
  it("uses request values when provided", () => {
    const out = normalizeParams(
      {
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.3,
        top_p: 0.9,
        reasoning_effort: "high",
      },
      mkKey(),
    );
    expect(out.temperature).toBe(0.3);
    expect(out.top_p).toBe(0.9);
    expect(out.reasoning_effort).toBe("high");
  });

  it("falls back to key.defaults for each field when request omits it", () => {
    const out = normalizeParams(
      { messages: [{ role: "user", content: "hi" }] },
      mkKey({ defaults: { temperature: 0.2, topP: 0.8, reasoningEffort: "medium" } }),
    );
    expect(out.temperature).toBe(0.2);
    expect(out.top_p).toBe(0.8);
    expect(out.reasoning_effort).toBe("medium");
  });

  it("request value overrides each key.defaults field independently", () => {
    const out = normalizeParams(
      {
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.9, // overrides
      },
      mkKey({ defaults: { temperature: 0.2, topP: 0.8 } }),
    );
    expect(out.temperature).toBe(0.9); // from request
    expect(out.top_p).toBe(0.8); // from defaults
  });

  it("drops fields entirely when neither request nor defaults set them", () => {
    const out = normalizeParams(
      { messages: [{ role: "user", content: "hi" }] },
      mkKey(),
    );
    expect(out.temperature).toBeUndefined();
    expect(out.top_p).toBeUndefined();
    expect(out.reasoning_effort).toBeUndefined();
  });
});

describe("buildProviderFetch (OpenAI path)", () => {
  it("passes through reasoning_effort on OpenAI-compat providers", () => {
    const { body, url } = buildProviderFetch(
      mkKey({ provider: "openai" }),
      {
        messages: [{ role: "user", content: "hi" }],
        reasoning_effort: "high",
      },
      false,
    );
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    const parsed = JSON.parse(body);
    expect(parsed.reasoning_effort).toBe("high");
  });

  it("max_completion_tokens is forwarded when set", () => {
    const { body } = buildProviderFetch(
      mkKey({ provider: "openai" }),
      {
        messages: [{ role: "user", content: "hi" }],
        max_completion_tokens: 8000,
      },
      false,
    );
    const parsed = JSON.parse(body);
    expect(parsed.max_completion_tokens).toBe(8000);
  });

  it("applies key.defaults.temperature when request omits it", () => {
    const { body } = buildProviderFetch(
      mkKey({ defaults: { temperature: 0.1 } }),
      { messages: [{ role: "user", content: "hi" }] },
      false,
    );
    const parsed = JSON.parse(body);
    expect(parsed.temperature).toBeCloseTo(0.1);
  });

  it("treats arbitrary provider IDs (gemini, groq, etc.) as OpenAI-compat", () => {
    const { url } = buildProviderFetch(
      mkKey({
        provider: "gemini",
        baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
        defaultModel: "gemini-2.5-flash",
      }),
      { messages: [{ role: "user", content: "hi" }] },
      false,
    );
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    );
  });
});

describe("buildProviderFetch (Anthropic path)", () => {
  it("translates reasoning_effort to thinking.budget_tokens", () => {
    const cases: Array<["minimal" | "low" | "medium" | "high", number]> = [
      ["minimal", 1024],
      ["low", 4096],
      ["medium", 12000],
      ["high", 32000],
    ];
    for (const [effort, budget] of cases) {
      const { body } = buildProviderFetch(
        mkKey({
          provider: "anthropic",
          baseUrl: "https://api.anthropic.com/v1",
          defaultModel: "claude-sonnet-4-6",
        }),
        {
          messages: [{ role: "user", content: "hi" }],
          reasoning_effort: effort,
        },
        false,
      );
      const parsed = JSON.parse(body);
      expect(parsed.thinking).toEqual({ type: "enabled", budget_tokens: budget });
    }
  });

  it("request.temperature overrides key.defaults.temperature on Anthropic too", () => {
    const { body } = buildProviderFetch(
      mkKey({
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        defaults: { temperature: 0.2 },
      }),
      {
        messages: [{ role: "user", content: "hi" }],
        temperature: 0.9,
      },
      false,
    );
    const parsed = JSON.parse(body);
    expect(parsed.temperature).toBe(0.9);
  });

  it("uses x-api-key header (Anthropic) not Authorization Bearer", () => {
    const { headers } = buildProviderFetch(
      mkKey({
        provider: "anthropic",
        baseUrl: "https://api.anthropic.com/v1",
        apiKey: "ant-secret",
      }),
      { messages: [{ role: "user", content: "hi" }] },
      false,
    );
    expect(headers["x-api-key"]).toBe("ant-secret");
    expect(headers["Authorization"]).toBeUndefined();
  });
});

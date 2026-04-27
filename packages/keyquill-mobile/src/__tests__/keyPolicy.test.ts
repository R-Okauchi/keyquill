import { describe, it, expect } from "vitest";
import {
  CURRENT_POLICY_VERSION,
  DEFAULT_KEY_POLICY,
  type BehaviorPolicy,
  type BudgetPolicy,
  type KeyPolicy,
  type ModelPolicy,
  type PrivacyPolicy,
  type ReasoningEffort,
  type SamplingPolicy,
} from "../types.js";

describe("DEFAULT_KEY_POLICY", () => {
  it("is permissive: open mode, warn-only budget, http-strict, audit on", () => {
    expect(DEFAULT_KEY_POLICY.modelPolicy.mode).toBe("open");
    expect(DEFAULT_KEY_POLICY.modelPolicy.onViolation).toBe("confirm");
    expect(DEFAULT_KEY_POLICY.budget.onBudgetHit).toBe("warn");
    expect(DEFAULT_KEY_POLICY.privacy.requireHttps).toBe(true);
    expect(DEFAULT_KEY_POLICY.privacy.logAuditEvents).toBe(true);
    expect(DEFAULT_KEY_POLICY.behavior.autoFallback).toBe(true);
    expect(DEFAULT_KEY_POLICY.behavior.maxRetries).toBe(2);
    expect(DEFAULT_KEY_POLICY.behavior.timeoutMs).toBe(60_000);
    // Sampling is omitted in the default — provider defaults apply.
    expect(DEFAULT_KEY_POLICY.sampling).toBeUndefined();
  });

  it("has no allowed/denied model lists by default (mode=open)", () => {
    expect(DEFAULT_KEY_POLICY.modelPolicy.allowedModels).toBeUndefined();
    expect(DEFAULT_KEY_POLICY.modelPolicy.deniedModels).toBeUndefined();
    expect(DEFAULT_KEY_POLICY.modelPolicy.preferredPerCapability).toBeUndefined();
    expect(DEFAULT_KEY_POLICY.modelPolicy.defaultModel).toBeUndefined();
  });

  it("has no budget caps set (warn-only fallback)", () => {
    expect(DEFAULT_KEY_POLICY.budget.maxTokensPerRequest).toBeUndefined();
    expect(DEFAULT_KEY_POLICY.budget.maxCostPerRequestUSD).toBeUndefined();
    expect(DEFAULT_KEY_POLICY.budget.dailyBudgetUSD).toBeUndefined();
    expect(DEFAULT_KEY_POLICY.budget.monthlyBudgetUSD).toBeUndefined();
    expect(DEFAULT_KEY_POLICY.budget.maxReasoningEffort).toBeUndefined();
  });

  it("has no provider allowlist set (any provider URL the user registered is fine)", () => {
    expect(DEFAULT_KEY_POLICY.privacy.allowedProviders).toBeUndefined();
  });
});

describe("CURRENT_POLICY_VERSION", () => {
  it("starts at 1 on mobile (independent of extension's version line)", () => {
    expect(CURRENT_POLICY_VERSION).toBe(1);
  });
});

describe("KeyPolicy type composition", () => {
  // These are TypeScript shape checks — they pass at compile time. The
  // runtime asserts just sanity-check the values to keep the suite
  // visible in the test report.

  it("ReasoningEffort accepts the four documented levels", () => {
    const levels: ReasoningEffort[] = ["minimal", "low", "medium", "high"];
    expect(levels).toHaveLength(4);
  });

  it("ModelPolicy.mode covers every documented enum branch", () => {
    const m1: ModelPolicy = { mode: "open", onViolation: "confirm" };
    const m2: ModelPolicy = { mode: "allowlist", allowedModels: ["x"], onViolation: "reject" };
    const m3: ModelPolicy = { mode: "denylist", deniedModels: ["x"], onViolation: "confirm" };
    const m4: ModelPolicy = {
      mode: "capability-only",
      preferredPerCapability: { reasoning: "claude-sonnet-4-6" },
      onViolation: "reject",
    };
    expect([m1.mode, m2.mode, m3.mode, m4.mode]).toEqual([
      "open",
      "allowlist",
      "denylist",
      "capability-only",
    ]);
  });

  it("BudgetPolicy.onBudgetHit covers each documented branch", () => {
    const b1: BudgetPolicy = { onBudgetHit: "block" };
    const b2: BudgetPolicy = { onBudgetHit: "confirm" };
    const b3: BudgetPolicy = { onBudgetHit: "warn" };
    expect([b1.onBudgetHit, b2.onBudgetHit, b3.onBudgetHit]).toEqual([
      "block",
      "confirm",
      "warn",
    ]);
  });

  it("composes a fully-configured strict policy", () => {
    const strict: KeyPolicy = {
      modelPolicy: {
        mode: "allowlist",
        allowedModels: ["gpt-5.4-mini"],
        onViolation: "reject",
        defaultModel: "gpt-5.4-mini",
      },
      budget: {
        maxCostPerRequestUSD: 0.05,
        monthlyBudgetUSD: 5,
        maxReasoningEffort: "low",
        onBudgetHit: "block",
      },
      privacy: {
        allowedProviders: ["openai"],
        requireHttps: true,
        logAuditEvents: true,
      },
      sampling: { temperature: 0.3, topP: 0.9 },
      behavior: { autoFallback: false, maxRetries: 0, timeoutMs: 30_000 },
    };
    expect(strict.modelPolicy.allowedModels).toEqual(["gpt-5.4-mini"]);
    expect(strict.budget.monthlyBudgetUSD).toBe(5);
    expect(strict.behavior.autoFallback).toBe(false);

    // Sub-policies type-assignable individually
    const _sampling: SamplingPolicy = strict.sampling!;
    const _privacy: PrivacyPolicy = strict.privacy;
    const _behavior: BehaviorPolicy = strict.behavior;
    void _sampling;
    void _privacy;
    void _behavior;
  });
});

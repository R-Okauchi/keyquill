/**
 * Stable error codes emitted by the broker / router.
 *
 * Wire messages carry a `code: string` field. This module declares the
 * canonical set so locales (en.ts, ja.ts) can map them to user-facing
 * strings without drift. New codes added here MUST also be added to
 * every locale file — a unit test enforces coverage.
 */

export const ERROR_CODES = [
  // ── Infrastructure / transport ──
  "KEY_NOT_FOUND",
  "NOT_CONNECTED",
  "USER_DENIED",
  "INVALID_KEY",
  "INVALID_REQUEST",
  "BLOCKED",
  "UNKNOWN_ORIGIN",
  "PROVIDER_UNREACHABLE",
  "PROVIDER_ERROR",
  "EMPTY_BODY",
  "INTERNAL",

  // ── Policy violations (resolver → streamManager → wire) ──
  "POLICY_HTTPS_REQUIRED",
  "POLICY_ORIGIN_BLOCKED",
  "POLICY_PROVIDER_BLOCKED",
  "POLICY_NO_MODEL_MATCHES_CAPABILITIES",
  "POLICY_MODEL_DENIED_BY_POLICY",
  "POLICY_MODEL_OUTSIDE_ALLOWLIST",
  "POLICY_CAPABILITY_MISSING_FROM_MODEL",
  "POLICY_UNKNOWN_MODEL",
  "POLICY_BUDGET_REQUEST_OVER_LIMIT",
  "POLICY_CAPABILITY_ONLY_REQUIRES_DEVELOPER_CAPABILITIES",
  "POLICY_CAPABILITY_ONLY_NO_PREFERRED_MODEL",

  // ── Consent-required converted to reject (user clicked Reject) ──
  "POLICY_MODEL_OUTSIDE_ALLOWLIST_REJECTED",
  "POLICY_MODEL_IN_DENYLIST_REJECTED",
  "POLICY_HIGH_COST_REJECTED",
  "POLICY_CAPABILITY_MISSING_REJECTED",

  // ── Consent-required surfaced directly (legacy, shouldn't normally reach UI in Phase 8+) ──
  "POLICY_MODEL_OUTSIDE_ALLOWLIST_CONSENT_REQUIRED",
  "POLICY_MODEL_IN_DENYLIST_CONSENT_REQUIRED",
  "POLICY_HIGH_COST_CONSENT_REQUIRED",
  "POLICY_CAPABILITY_MISSING_CONSENT_REQUIRED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isKnownErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Stable error codes emitted by keyquill-mobile.
 *
 * Native bridge messages (the JS bridge `error: string` field on
 * `RelayStreamEvent`, plus rejected promises from `chatStream`,
 * `registerKey`, etc.) carry one of these codes when the cause is
 * known. Locales (`en.ts`, `ja.ts`) map each code to a user-facing
 * sentence; `getErrorMessage()` in `index.ts` does the lookup.
 *
 * Mirrors the extension's `errors/codes.ts` shape but trimmed to
 * mobile-relevant codes (no origin / consent-popup / extension-popup
 * paths) and extended with mobile-specific failure modes (biometric,
 * keychain, web fallback).
 *
 * New codes added here MUST also be added to every locale file —
 * the test in `__tests__/errors.test.ts` enforces coverage.
 */

export const ERROR_CODES = [
  // ── Infrastructure / transport ──
  "KEY_NOT_FOUND",
  "USER_DENIED",
  "INVALID_KEY",
  "INVALID_REQUEST",
  "PROVIDER_UNREACHABLE",
  "PROVIDER_ERROR",
  "EMPTY_BODY",
  "INTERNAL",
  "STREAM_NOT_FOUND",

  // ── Mobile-specific (native security / web fallback) ──
  "NOT_NATIVE",
  "BIOMETRIC_DENIED",
  "BIOMETRIC_UNAVAILABLE",
  "KEYCHAIN_ERROR",

  // ── Policy violations (resolver + native enforcer) ──
  "POLICY_HTTPS_REQUIRED",
  "POLICY_PROVIDER_BLOCKED",
  "POLICY_BUDGET_REQUEST_OVER_LIMIT",
  "POLICY_BUDGET_DAILY_EXCEEDED",
  "POLICY_BUDGET_MONTHLY_EXCEEDED",
  "POLICY_MODEL_DENIED_BY_POLICY",
  "POLICY_MODEL_OUTSIDE_ALLOWLIST",
  "POLICY_NO_MODEL_MATCHES_CAPABILITIES",
  "POLICY_UNKNOWN_MODEL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export function isKnownErrorCode(code: string): code is ErrorCode {
  return (ERROR_CODES as readonly string[]).includes(code);
}

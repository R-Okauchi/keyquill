import type { ErrorCode } from "./codes.js";

/**
 * English messages for every stable mobile error code. Phrased as
 * user-facing sentences — what to do next, not just what went wrong.
 */
export const ERRORS_EN: Record<ErrorCode, string> = {
  // ── Infrastructure / transport ──
  KEY_NOT_FOUND:
    "No registered key for this provider. Call registerKey() before chatStream().",
  USER_DENIED:
    "You declined the request. Reissue the chat or biometric prompt to try again.",
  INVALID_KEY:
    "The key couldn't be saved. Double-check the API key and the base URL.",
  INVALID_REQUEST:
    "The plugin received an unrecognized request shape from the JavaScript layer.",
  PROVIDER_UNREACHABLE:
    "The provider couldn't be reached. Check your network connection and the configured base URL.",
  PROVIDER_ERROR:
    "The provider returned an error. See the error detail for specifics.",
  EMPTY_BODY: "The provider returned an empty response.",
  INTERNAL: "An unexpected error occurred inside the Keyquill plugin.",
  STREAM_NOT_FOUND:
    "That stream id is not active. It may have already finished or been cancelled.",

  // ── Mobile-specific (native security / web fallback) ──
  NOT_NATIVE:
    "Keyquill is only available on native iOS and Android builds. Run this code through Capacitor on a device, simulator, or emulator.",
  BIOMETRIC_DENIED:
    "Biometric authentication was denied. Try again, or extend the auto-approve window in your policy.",
  BIOMETRIC_UNAVAILABLE:
    "This device doesn't have biometric authentication configured. Enrol Face ID / Touch ID / fingerprint and try again.",
  KEYCHAIN_ERROR:
    "Secure storage failed (iOS Keychain or Android Keystore). The key was not saved or read.",

  // ── Policy violations ──
  POLICY_HTTPS_REQUIRED:
    "The configured base URL is not HTTPS. Adjust the key, or relax the policy if you're testing against localhost.",
  POLICY_PROVIDER_BLOCKED:
    "This provider isn't on the policy's allowed list. Add it to the allowlist or pick a different key.",
  POLICY_BUDGET_REQUEST_OVER_LIMIT:
    "This single request would exceed the per-request cost ceiling. Lower maxOutput or relax the budget.",
  POLICY_BUDGET_DAILY_EXCEEDED:
    "Today's spend has reached the daily budget cap. Wait for the day to roll over or raise the limit.",
  POLICY_BUDGET_MONTHLY_EXCEEDED:
    "This month's spend has reached the monthly budget cap. Wait for the month to roll over or raise the limit.",
  POLICY_MODEL_DENIED_BY_POLICY:
    "The selected model is on this key's denylist. Remove it from the denylist or pick a different key.",
  POLICY_MODEL_OUTSIDE_ALLOWLIST:
    "The selected model isn't in this key's allowlist. Add it via the policy editor or pick a different key.",
  POLICY_NO_MODEL_MATCHES_CAPABILITIES:
    "No registered key has a default model that satisfies the requested capabilities. Register a key whose default covers them, or relax requires[].",
  POLICY_UNKNOWN_MODEL:
    "The requested model isn't in the local catalog. Update keyquill-mobile or pick a known model.",
};

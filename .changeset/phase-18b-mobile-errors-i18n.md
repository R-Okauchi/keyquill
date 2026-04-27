---
"keyquill": minor
"keyquill-mobile": minor
"keyquill-relay": minor
---

Mobile (`keyquill-mobile`) gains stable error codes and English /
Japanese message tables, mirroring the extension's `errors/` shape.

- `ERROR_CODES` — 21 mobile-relevant codes (KEY_NOT_FOUND,
  PROVIDER_UNREACHABLE, BIOMETRIC_DENIED, KEYCHAIN_ERROR,
  POLICY_BUDGET_DAILY_EXCEEDED, …). New codes are tested for parity
  across both locale tables.
- `getErrorMessage(code, locale?)` — looks up a localized sentence;
  detects locale from `navigator.language` (works in Capacitor's
  WebView) when no override is supplied.
- `renderError(code, rawMessage, locale?)` — resolves the localized
  message, falling back to the raw string the native side attached.
- `web.ts` — the "not on native" rejection now uses the localized
  `NOT_NATIVE` message and attaches `code: "NOT_NATIVE"` to the Error.

Native bridge contract is unchanged; native code starts emitting these
codes in Phases 18d/18e. `keyquill` and `keyquill-relay` bump in
lockstep; neither has behavior changes.

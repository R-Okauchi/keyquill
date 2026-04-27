---
"keyquill": minor
"keyquill-mobile": minor
"keyquill-relay": minor
---

Mobile (`keyquill-mobile`) gains an audit ledger that mirrors the
extension's `background/ledger.ts` API, persisting per-request history
to `@capacitor/preferences` (NSUserDefaults on iOS, SharedPreferences
on Android).

- `appendEntry`, `queryByProvider`, `getMonthSpend`, `getDailySpend`,
  `clearByProvider`, `clearAll`, `exportCSV` — the same CRUD surface
  as the extension, keyed by provider name (mobile's per-key
  identifier) instead of keyId.
- `setLedgerStore()` lets callers (and tests) substitute the storage
  adapter — handy for memory-backed unit tests, or to point the ledger
  at an alternative store.
- Same 90-day retention + ring-buffer trim semantics; concurrent
  writes serialised through `navigator.locks` with an in-memory queue
  fallback.

`@capacitor/preferences@^7.0.0` is a new dependency. Native bridge
contract is unchanged; Phase 18c is TS-only and callers append entries
explicitly when `chatStream` finishes. Auto-record from the `done`
event is a follow-up; native-side enforcement and writes land in
Phases 18d/18e.

`keyquill` and `keyquill-relay` bump in lockstep; neither has
behavior changes.

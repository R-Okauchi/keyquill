---
"keyquill": minor
"keyquill-mobile": minor
"keyquill-relay": minor
---

Mobile (`keyquill-mobile`) gains the broker `KeyPolicy` type surface
alongside the legacy `RelayPolicy`. Adds `KeyPolicy`, `ModelPolicy`,
`BudgetPolicy`, `PrivacyPolicy`, `SamplingPolicy`, `BehaviorPolicy`,
`ReasoningEffort`, plus `DEFAULT_KEY_POLICY` and
`CURRENT_POLICY_VERSION` (mobile starts at 1, independent of the
extension's own policy version line).

`RelayPolicy` keeps working unchanged through Phases 18a-c. Phase 18a-3
will introduce a TS-side resolver that consumes `KeyPolicy`; native
Swift / Kotlin start consuming it directly in 18d / 18e; legacy
`RelayPolicy` retires in 18f.

`keyquill` and `keyquill-relay` bump in lockstep with the fixed group;
neither has behavior changes in this release.

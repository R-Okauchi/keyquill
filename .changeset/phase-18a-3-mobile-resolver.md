---
"keyquill": minor
"keyquill-mobile": minor
"keyquill-relay": minor
---

Mobile (`keyquill-mobile`) gains a TS-side resolver and a
capability-first `resolveAndChatStream()` wrapper.

The resolver picks among **already-registered keys**, drawing from
`listProviders()`, and routes to the provider whose `defaultModel`
best satisfies the caller's intent:

- **Tier 1** (zero-config) — uses the first registered provider.
- **Tier 2** (`requires`) — filters to providers whose defaultModel
  satisfies every requested capability, picks the cheapest by
  `outputPer1M`.
- **Tier 3** (`prefer.provider` / `prefer.model`) — explicit pin; the
  model variant only succeeds when some registered key has the
  requested model AS its defaultModel. Per-request model overrides
  arrive in Phase 18d/18e when the native bridge is extended.

`KeyPolicy.modelPolicy` allowlist / denylist enforcement is applied at
every tier. Other policy fields (budget, privacy, sampling, behaviour)
remain owned by the legacy native enforcer (RelayPolicy) until Phases
18d/18e migrate the native side.

`tone` is accepted in the input shape for API parity with the
extension, but currently inert — native `chatStream()` doesn't accept
temperature; that lands in 18d/18e.

Native bridge contract is unchanged. Existing callers that use
`SecureRelay.chatStream()` directly keep working.

`keyquill` and `keyquill-relay` bump in lockstep with the fixed
group; neither has behavior changes in this release.

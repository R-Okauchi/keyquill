---
"keyquill": minor
"keyquill-mobile": minor
"keyquill-relay": minor
---

Mobile (`keyquill-mobile`) gains the broker type surface — `ModelCatalog`,
`Capability`, `Tone`, `ModelSpec`, and helpers (`getModel`,
`matchesCapabilities`, `findByCapabilities`, `cheapestModelForProvider`,
`isResponsesEndpoint`, `isOpenAIReasoning`) — copied verbatim from the
extension. No runtime behavior change; this is the foundation Phase
18a-2/3 build a TS-side resolver and capability-first `chatStream` on
top of.

`keyquill` and `keyquill-relay` bump in lockstep with the fixed group;
neither has behavior changes in this release.

---
"keyquill": patch
"keyquill-mobile": patch
"keyquill-relay": patch
---

Fix 400 errors when both `max_tokens` and `max_completion_tokens` are set
on non-reasoning OpenAI-compatible requests.

Gemini's OpenAI-compat endpoint rejects the combo outright
(`"max_tokens and max_completion_tokens cannot both be set"`) and OpenAI
tightened the same check for `gpt-4o-mini` in April 2026. The SDK's
`buildOpenAiPassthrough` was sending both when the caller supplied
both — now sends only `max_completion_tokens` when it is explicitly set,
else only `max_tokens`. Reasoning-model behaviour is unchanged
(`max_completion_tokens` only, per existing contract).

Also relaxes the live-API integration test's non-streaming content
assertion for OpenAI reasoning models. Under a 32-token budget, reasoning
models can consume the full budget on internal reasoning tokens and
return an empty content with `finish_reason=length`; that is a successful
end-to-end call and no longer fails the test. The stream branch was
already lenient and is unchanged.

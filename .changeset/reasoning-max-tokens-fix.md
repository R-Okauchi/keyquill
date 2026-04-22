---
"keyquill": patch
"keyquill-mobile": patch
"keyquill-relay": patch
---

Fix GPT-5 / o-series reasoning models rejecting `max_tokens`.

OpenAI reasoning-family models return a 400 error when `max_tokens` is
present (they require `max_completion_tokens` instead). Keyquill now
detects these models by name and swaps the parameter automatically:

- `isOpenAIReasoningModel(model)` regex: `/^(o\d+|gpt-5)/i`
  - Matches: o1, o1-mini, o3, o3-mini, o3-pro, o4-mini, and the entire
    GPT-5 family (gpt-5, gpt-5-mini, gpt-5.2, gpt-5.4, gpt-5.4-mini,
    gpt-5.4-nano, gpt-5.4-thinking, gpt-5.4-pro)
  - Excludes legacy gpt-4, gpt-4o, gpt-4.1, gpt-3.5-turbo

- `buildOpenAiPassthrough` promotes `max_tokens` value into
  `max_completion_tokens` for reasoning models; legacy models continue
  to receive `max_tokens` only.

- OpenAI preset default bumped `gpt-4.1-mini` → `gpt-5.4-mini` since the
  GPT-4 family is retired from ChatGPT and the cost-balanced active
  default is now in the GPT-5 family.

Tests: 53 cases total in keyStore + providerFetch (was 35) — 17
reasoning-detection matches against real model names, 4 reasoning-path
body-shape assertions, plus legacy fallthrough coverage.

No schema change, no protocol change. Additive.

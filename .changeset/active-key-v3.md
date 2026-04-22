---
"keyquill": minor
"keyquill-mobile": minor
"keyquill-relay": minor
---

v0.3.0 — active-key model, multi-provider presets, per-key defaults, reasoning support.

## BREAKING (protocol v2 → v3)

### Active-key model
- `KeyRecord.isDefault?: boolean` (per-provider) replaced by `KeyRecord.isActive: boolean` (wallet-wide, exactly one true). Mirrors MetaMask's account switching: the user has a current "active key", and every chatStream resolves to it unless a keyId or per-origin binding overrides.
- `KeySummary.isDefault` → `KeySummary.isActive` in the SDK listKeys response.
- Message `{ type: "setDefault", keyId }` → `{ type: "setActive", keyId }`.
- `addKey` accepts `isActive?: boolean` (was `isDefault?: boolean`).

### Resolution priority simplified 4 → 3
1. `request.keyId` — explicit SDK selection
2. Per-origin binding — persisted site choice
3. Active key — wallet's current selection (singleton)

`request.provider` is now advisory only — a site that needs a specific provider should pass `keyId` of a matching key; no per-provider default fallback exists anymore. Fixes v0.2.0's non-deterministic "first per-provider default" behavior.

### Protocol version bump 2 → 3
SDK throws `PROTOCOL_MISMATCH` when talking to an older extension.

## NEW features (additive)

### Multi-provider presets
Add-key form now includes 10 presets: OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Mistral, Together AI, xAI (Grok), OpenRouter, Custom (OpenAI-compatible). Selecting a preset auto-fills baseURL + default model with web-verified values. Fixes the bug where selecting Anthropic still showed OpenAI's URL.

### Per-key generation defaults
`KeyRecord.defaults?: { temperature?; topP?; reasoningEffort? }` lets users pin generation preferences per key:
- "Work" key with temperature 0.2 (analytical)
- "Personal" key with temperature 0.9 (creative)

Explicit request fields always override key defaults.

### Reasoning effort + max_completion_tokens
- `ChatParams.reasoning_effort: "minimal" | "low" | "medium" | "high"` forwarded verbatim to OpenAI-compatible providers (OpenAI o-series / GPT-5 reasoning, Gemini 2.5+ thinking, Groq reasoning, etc.).
- Translated to Anthropic's `thinking: { type: "enabled", budget_tokens }` (minimal=1024, low=4096, medium=12000, high=32000).
- `ChatParams.max_completion_tokens?: number` added for OpenAI reasoning-model budget (alias of max_tokens for non-reasoning providers).

### Popup UI refresh
- Active-key banner at the top of the popup with Switch button (one click to change active)
- Advanced toggle section in the add-key form: baseURL, model, temperature, topP, reasoning effort — hidden by default to keep primary form minimal
- "Set active" button replaces "Set default" on non-active key cards
- Key cards show ⭐ when active

### Consent picker
Unchanged structurally but pre-selects the active key (previously pre-selected per-provider default).

## Migration (automatic)
- v1 `keyquill_providers` → v3 `keyquill_keys`, first entry becomes active
- v2 `keyquill_keys` with `isDefault` → coerced on next read: the most-recently-updated per-provider default across the wallet wins the single active slot. Bindings preserved.

## Tests
- **keyStore** (12): addKey / setActive / getActiveKey / deleteKey cascade / v1 + v2 migration
- **providerFetch** (11): reasoning_effort passthrough, Anthropic thinking translation, key.defaults merge with request override, arbitrary provider IDs → OpenAI-compat
- **SDK client** (10): wire protocol v3, start stream event, keyId forwarding
- All 65 tests + build + typecheck + lint green across 4 workspaces

## Consumer migration (travel-os etc.)
- `vault.listProviders()` removed → use `vault.listKeys()` (returns `KeySummary[]` with `keyId`, `label`, `isActive`)
- `vault.testKey(provider)` → `vault.testKey(keyId)`
- `vault.registerKey()` / `vault.deleteKey(provider)` removed from SDK (popup-only now)
- `vault.chat()` returns `{ completion, keyId }` instead of just ChatCompletion
- `chatStream()` emits a new first event `{ type: "start", keyId, provider, label }` — existing consumers can ignore or surface it
- `ChatParams.keyId?` for explicit selection; `provider?` remains for back-compat but is advisory

Bump your `keyquill-relay` / `keyquill-mobile` to `^0.3.0` too if you use them — fixed group.

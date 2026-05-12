---
"keyquill-extension": patch
---

fix(resolver): scope capability-driven model selection to the key's
provider. Previously a Gemini or Anthropic key paired with a
capability-declared request (e.g. `requires: ["streaming"]`) could be
routed to an OpenAI catalog model — typically `gpt-5.4-mini` (first
match in declaration order) — and 404 at the provider. The resolver
now filters candidate models to `key.provider` by default, and only
honors `request.prefer.provider` when the caller explicitly overrides
it. Adds regression tests for gemini / anthropic keys and the
`prefer.provider` override path.

Also adds an automated store release workflow
(`.github/workflows/extension-release.yml`) that publishes to Chrome
Web Store and Firefox AMO on `keyquill-extension-v<X.Y.Z>` tag pushes,
plus a `chrome-webstore-upload-cli` devDependency and an
`upload:chrome` script.

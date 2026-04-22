# Keyquill Demo

A minimal single-page demo that exercises the [`keyquill`](https://www.npmjs.com/package/keyquill) SDK against the Keyquill browser extension.

## Live

<https://r-okauchi.github.io/keyquill/demo/>

## Run locally

The page is pure HTML + inline JS — no build step. Serve it from any static HTTP server:

```bash
# From the repo root
python3 -m http.server 8080 --directory docs
# then open http://localhost:8080/demo/
```

`file://` mostly works too, but Chrome is stricter about some extension APIs under `file://` — prefer HTTP for a realistic test.

## Flow

1. Load the Keyquill extension (unpacked from `packages/keyquill-extension/dist-chrome/` until the Chrome Web Store listing is live).
2. Open the extension popup and register an OpenAI-compatible API key.
3. Visit the demo page — it should say "Extension ready".
4. Click **Connect extension** → approve the consent popup.
5. Type a prompt → **Send** → the response streams into the output area.

## How it imports the SDK

```html
<script type="module">
  import { Keyquill } from "https://esm.sh/keyquill@0.1.1";
</script>
```

We import directly from [esm.sh](https://esm.sh) so there's no build tooling. Pin the version explicitly; bump it when a new release lands.

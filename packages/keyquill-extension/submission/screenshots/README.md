# Screenshots for store listings

Drop 1280×800 PNGs (or 640×400 if space is tight) in this directory. They get reused in both Chrome Web Store and Firefox AMO listings.

## Recommended set (3 shots)

1. **`01-popup.png`** — Extension popup with one or two registered keys. Key hints like `sk-t…st12` are fine; do NOT show a full key.
2. **`02-demo-ready.png`** — The [live demo](https://r-okauchi.github.io/keyquill/demo/) after the extension is loaded, at the "Extension ready. Click Connect to grant this page access." state.
3. **`03-demo-streaming.png`** — The demo in mid-stream: prompt visible, output area showing streamed tokens.

## Optional

- **`04-consent-popup.png`** — The consent popup for the demo's origin, mid-approval.

## Capture tips (macOS)

1. Build & load the extension:
   ```bash
   pnpm --filter keyquill-extension build
   ```
   Then: `chrome://extensions` → Developer mode → Load unpacked → `packages/keyquill-extension/dist-chrome/`.
2. Register a test key via the popup.
3. Visit <https://r-okauchi.github.io/keyquill/demo/>.
4. Make the Chrome window ~1280×800 (Cmd+Opt+I to open DevTools → device toolbar can help size).
5. `Cmd+Shift+5` → **Record selected portion** or **Capture Selected Portion** → drag to size → Capture.
6. Save as `01-popup.png` etc. here.

Avoid: real-world API keys in frame, personally identifying info, background windows with unrelated content.

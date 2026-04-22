---
layout: default
title: Keyquill
description: Bring Your Own Key to any web app or mobile app — without trusting their server.
---

# Keyquill

**Bring Your Own Key to any web app or mobile app — without trusting their server.**

Keyquill is a family of small libraries plus a browser extension that let a user keep their LLM API key on their own device, while still using it from any app. The app never sees the key. No server proxy. No middleman.

## Try the live demo

[**Open the demo** →](./demo/)

You'll need to install the Keyquill extension first (Chrome Web Store listing coming soon — for now [install it from source](https://github.com/R-Okauchi/keyquill#development)).

## What's in the box

| Package | Role | Install |
|---|---|---|
| [`keyquill`](https://www.npmjs.com/package/keyquill) | Framework-agnostic SDK for web apps — talks to the browser extension via content-script message passing. | `npm i keyquill` |
| `keyquill-extension` | Chrome / Firefox MV3 extension. Stores keys in `chrome.storage.session`, calls providers directly, CORS-free. Per-origin consent. | Chrome Web Store / Firefox AMO (coming soon) |
| [`keyquill-mobile`](https://www.npmjs.com/package/keyquill-mobile) | Capacitor plugin. iOS Keychain / Android Keystore, biometric-gated. | `npm i keyquill-mobile && npx cap sync` |
| [`keyquill-relay`](https://www.npmjs.com/package/keyquill-relay) | Phone Wallet Relay — zero-knowledge E2E WebSocket bridge between a desktop browser and a mobile wallet. Ships a browser client + Cloudflare Durable Object. | `npm i keyquill-relay` |

## How it's different

- **Keys live in user-controlled secure storage only**: extension session storage on web, Keychain/Keystore on mobile. Hosting apps and their servers have no access path.
- **Per-origin consent** (MetaMask-style): the first time any website asks to use Keyquill, the user explicitly approves that origin via a popup. Approvals are revocable.
- **Zero dependencies in the SDK**. Works with React / Preact / Vue / Svelte / vanilla JS.
- **Zero telemetry, zero analytics**. See the [privacy policy](./privacy-policy).

## Links

- Source: <https://github.com/R-Okauchi/keyquill>
- Architecture decisions: [docs/adr/](https://github.com/R-Okauchi/keyquill/tree/main/docs/adr)
- Privacy policy: [./privacy-policy](./privacy-policy)
- Issues / discussions: <https://github.com/R-Okauchi/keyquill/issues>

## Support this project

Keyquill is independent OSS. If it's useful to you, [sponsor it on GitHub](https://github.com/sponsors/R-Okauchi) to help keep it maintained. No ads, no telemetry, no metering — ever.

## License

MIT

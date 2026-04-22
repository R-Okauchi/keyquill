# Chrome Web Store data disclosure

For the "Privacy practices" section of the Chrome Web Store submission form, declare:

## What user data the extension collects

| Category | Collected? | Notes |
|---|---|---|
| Personally identifiable information | No | — |
| Health information | No | — |
| Financial and payment information | No | API keys are authentication credentials, not payment data |
| Authentication information | **Yes** (local only) | API keys the user registered. Stored in `chrome.storage.session`. Never transmitted to any server except the LLM provider the user chose. |
| Personal communications | Transient | Prompts and responses pass through the extension's service worker as part of forwarding requests to the LLM provider. They are not retained, logged, cached, or sent anywhere else. |
| Location | No | — |
| Web history | No | — |
| User activity | No | — |
| Website content | No | — |

## Privacy commitments

- [x] **I do not sell or share user data with third parties outside of approved use cases.**
- [x] **I do not use or transfer user data for purposes that are unrelated to the extension's single purpose.**
- [x] **I do not use or transfer user data to determine creditworthiness or for lending purposes.**
- [x] **I have read and agree to the developer program policies.**

## Privacy policy URL

https://r-okauchi.github.io/llmvault/privacy-policy

## Notes for reviewer

LLMVault does not operate any server. The user's API key exists only on the user's own device (browser extension session storage). The only network destinations are LLM provider endpoints (e.g., `api.openai.com`) that the user has themselves configured inside the extension. The extension does not phone home, does not run analytics, does not relay metadata, and has no first-party backend.

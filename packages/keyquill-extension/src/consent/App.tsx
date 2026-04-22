/**
 * Consent popup — asks the user to approve or deny a site connection
 * AND pick which stored key this site should use by default.
 *
 * Opened by the background service worker via chrome.windows.create().
 * Sends the decision back via chrome.runtime.sendMessage():
 *   { type: "_consentResponse", origin, approved, keyId? }
 */

import { render } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { KeySummary, OutgoingResponse } from "../shared/protocol.js";
import { ext } from "../shared/browser.js";

function ConsentApp() {
  const params = new URLSearchParams(location.search);
  const origin = params.get("origin") ?? "unknown";

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    hostname = origin;
  }

  const [keys, setKeys] = useState<KeySummary[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);

  useEffect(() => {
    ext.runtime.sendMessage({ type: "listKeys" }, (res: unknown) => {
      const r = res as OutgoingResponse;
      if (r.type === "keys") {
        setKeys(r.keys);
        // Pre-select the wallet's active key (or fallback to the first key)
        const def = r.keys.find((k) => k.isActive) ?? r.keys[0];
        if (def) setSelectedKeyId(def.keyId);
      }
    });
  }, []);

  function respond(approved: boolean) {
    const keyId = approved ? (selectedKeyId ?? undefined) : undefined;
    ext.runtime.sendMessage(
      { type: "_consentResponse", origin, approved, keyId },
      () => {
        setTimeout(() => window.close(), 300);
      },
    );
  }

  const hasKeys = keys.length > 0;

  return (
    <div class="consent">
      <img class="consent__icon" src="/icons/icon-128.png" alt="Keyquill" />
      <h1>Connection Request</h1>
      <div class="origin">{hostname}</div>
      <div class="origin-full">{origin}</div>
      <p class="description">
        This site wants to use a Keyquill key to call LLM providers on your behalf.
        Your API key will never be shared with the site.
      </p>

      {hasKeys ? (
        <>
          <label class="picker-label">Which key should this site use?</label>
          <div class="picker">
            {keys.map((k) => (
              <label key={k.keyId} class={`picker__option ${selectedKeyId === k.keyId ? "picker__option--selected" : ""}`}>
                <input
                  type="radio"
                  name="key"
                  value={k.keyId}
                  checked={selectedKeyId === k.keyId}
                  onChange={() => setSelectedKeyId(k.keyId)}
                />
                <div class="picker__label">
                  <span class="picker__name">
                    {k.label}
                    {k.isActive && <span class="picker__star" title="Active">⭐</span>}
                  </span>
                  <span class="picker__meta">{k.provider} · {k.keyHint}</span>
                </div>
              </label>
            ))}
          </div>
        </>
      ) : (
        <div class="empty-keys">
          No keys registered yet. Open the Keyquill popup (toolbar icon) and add one first.
        </div>
      )}

      <div class="actions">
        <button class="btn btn--secondary" onClick={() => respond(false)}>
          Deny
        </button>
        <button
          class="btn btn--primary"
          onClick={() => respond(true)}
          disabled={!hasKeys || !selectedKeyId}
        >
          Allow
        </button>
      </div>
      <p class="warning">
        You can change which key this site uses, or revoke access, from the Keyquill popup later.
      </p>
    </div>
  );
}

render(<ConsentApp />, document.getElementById("app")!);

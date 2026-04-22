/**
 * Consent popup lifecycle manager.
 *
 * When a request arrives from an unapproved origin, opens a small popup
 * window asking the user to approve/deny AND pick which stored key this
 * origin should use. Concurrent requests from the same origin share a
 * single popup (deduplication).
 *
 * Communication:
 *   consent page  ──chrome.runtime.sendMessage──▸  background
 *   Sends { type: "_consentResponse", origin, approved, keyId? }.
 *   Background calls handleConsentResponse(), which persists the binding
 *   (when approved) and resolves the pending promise.
 */

import { ext } from "../shared/browser.js";
import { setBinding } from "./bindingStore.js";

export interface ConsentResult {
  approved: boolean;
  keyId?: string;
}

interface PendingConsent {
  promise: Promise<ConsentResult>;
  resolve: (result: ConsentResult) => void;
  windowId?: number;
}

const pending = new Map<string, PendingConsent>();

/**
 * Request user consent for an origin.
 * Returns { approved, keyId? }. Approved=true means user clicked Allow
 * and picked a key (keyId is set). Approved=false means denied or closed.
 * Deduplicates: concurrent callers for the same origin share one popup.
 */
export function requestConsent(origin: string): Promise<ConsentResult> {
  const existing = pending.get(origin);
  if (existing) return existing.promise;

  let resolve!: (v: ConsentResult) => void;
  const promise = new Promise<ConsentResult>((r) => {
    resolve = r;
  });

  const entry: PendingConsent = { promise, resolve };
  pending.set(origin, entry);

  const url = ext.runtime.getURL(
    `src/consent/index.html?origin=${encodeURIComponent(origin)}`,
  );

  ext.windows.create(
    { url, type: "popup", width: 420, height: 460, focused: true },
    (win) => {
      if (win?.id !== undefined) {
        entry.windowId = win.id;
      }
    },
  );

  return promise;
}

/**
 * Handle the response sent by the consent popup page.
 */
export async function handleConsentResponse(
  origin: string,
  approved: boolean,
  keyId?: string,
): Promise<void> {
  if (approved && keyId) {
    await setBinding(origin, keyId);
  }

  const entry = pending.get(origin);
  if (entry) {
    entry.resolve({ approved, keyId });
    pending.delete(origin);
    if (entry.windowId !== undefined) {
      ext.windows.remove(entry.windowId).catch(() => {});
    }
  }
}

/**
 * Called from windows.onRemoved — treat closing the popup as denial.
 */
export function handleWindowClosed(windowId: number): void {
  for (const [origin, entry] of pending) {
    if (entry.windowId === windowId) {
      entry.resolve({ approved: false });
      pending.delete(origin);
      break;
    }
  }
}

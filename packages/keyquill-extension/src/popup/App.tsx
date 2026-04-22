import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import type {
  KeySummary,
  OriginBinding,
  IncomingRequest,
  OutgoingResponse,
} from "../shared/protocol.js";
import { ext } from "../shared/browser.js";

function sendMessage(msg: IncomingRequest): Promise<OutgoingResponse> {
  return new Promise((resolve) => {
    ext.runtime.sendMessage(msg, (res: unknown) => {
      resolve(res as OutgoingResponse);
    });
  });
}

function hostOf(origin: string): string {
  try {
    return new URL(origin).hostname;
  } catch {
    return origin;
  }
}

function App() {
  const [keys, setKeys] = useState<KeySummary[]>([]);
  const [bindings, setBindings] = useState<OriginBinding[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingBinding, setEditingBinding] = useState<string | null>(null);
  const [testResultKey, setTestResultKey] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadKeys() {
    const res = await sendMessage({ type: "listKeys" });
    if (res.type === "keys") setKeys(res.keys);
  }

  async function loadBindings() {
    const res = await sendMessage({ type: "getBindings" });
    if (res.type === "bindings") setBindings(res.bindings);
  }

  useEffect(() => {
    loadKeys();
    loadBindings();
  }, []);

  async function handleAdd(e: Event) {
    e.preventDefault();
    setFormError(null);
    const form = e.target as HTMLFormElement;
    const fd = new FormData(form);
    const label = (fd.get("label") as string).trim();
    if (!label) {
      setFormError("Label is required (e.g. Work, Personal).");
      return;
    }
    const res = await sendMessage({
      type: "addKey",
      provider: fd.get("provider") as string,
      label,
      apiKey: fd.get("apiKey") as string,
      baseUrl: fd.get("baseUrl") as string,
      defaultModel: fd.get("defaultModel") as string,
    });
    if (res.type === "error") {
      setFormError(res.message);
      return;
    }
    setShowForm(false);
    form.reset();
    await loadKeys();
  }

  async function handleDelete(keyId: string) {
    await sendMessage({ type: "deleteKey", keyId });
    await loadKeys();
    await loadBindings();
  }

  async function handleSetDefault(keyId: string) {
    await sendMessage({ type: "setDefault", keyId });
    await loadKeys();
  }

  async function handleTest(keyId: string) {
    setTestResultKey(keyId);
    setTestResult("Testing...");
    const res = await sendMessage({ type: "testKey", keyId });
    if (res.type === "testResult") {
      setTestResult(res.reachable ? "Connected ✓" : "Failed");
    } else {
      setTestResult("Error");
    }
    setTimeout(() => {
      setTestResult(null);
      setTestResultKey(null);
    }, 3000);
  }

  async function handleSetBinding(origin: string, keyId: string) {
    await sendMessage({ type: "setBinding", origin, keyId });
    setEditingBinding(null);
    await loadBindings();
  }

  async function handleRevokeBinding(origin: string) {
    await sendMessage({ type: "revokeBinding", origin });
    await loadBindings();
  }

  // Group keys by provider for visual organization
  const keysByProvider = new Map<string, KeySummary[]>();
  for (const k of keys) {
    const list = keysByProvider.get(k.provider) ?? [];
    list.push(k);
    keysByProvider.set(k.provider, list);
  }

  return (
    <div>
      <h1>
        <img class="icon" src="/icons/icon-48.png" alt="" /> Keyquill
      </h1>

      <section class="section">
        <h2 class="section__title">Your keys ({keys.length})</h2>

        {keys.length === 0 && !showForm && (
          <div class="empty">
            <p>No keys registered yet.</p>
            <p>Add one to get started.</p>
          </div>
        )}

        {Array.from(keysByProvider.entries()).map(([provider, list]) => (
          <div key={provider} class="provider-group">
            <div class="provider-group__header">
              {provider} ({list.length})
            </div>
            {list.map((k) => (
              <div key={k.keyId} class={`key-card ${k.isDefault ? "key-card--default" : ""}`}>
                <div class="key-card__header">
                  <span class="key-card__label">{k.label}</span>
                  {k.isDefault && <span class="key-card__badge" title="Default for this provider">⭐</span>}
                </div>
                <div class="key-card__meta">
                  <span class="key-card__hint">{k.keyHint}</span>
                  <span class="key-card__model">{k.defaultModel}</span>
                </div>
                <div class="key-card__actions">
                  {!k.isDefault && (
                    <button class="btn btn--ghost btn--sm" onClick={() => handleSetDefault(k.keyId)}>
                      Set default
                    </button>
                  )}
                  <button class="btn btn--secondary btn--sm" onClick={() => handleTest(k.keyId)}>
                    Test
                  </button>
                  <button class="btn btn--ghost btn--sm" onClick={() => handleDelete(k.keyId)}>
                    Delete
                  </button>
                </div>
                {testResultKey === k.keyId && testResult && (
                  <div class={`test-result test-result--${testResult.includes("✓") ? "ok" : "fail"}`}>
                    {testResult}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {!showForm ? (
          <button class="btn btn--primary" onClick={() => setShowForm(true)}>
            + Add key
          </button>
        ) : (
          <form class="form" onSubmit={handleAdd}>
            <label>
              Provider
              <select name="provider">
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="custom">Custom (OpenAI-compatible)</option>
              </select>
            </label>
            <label>
              Label *
              <input
                name="label"
                type="text"
                required
                placeholder="Work, Personal, University…"
                autoFocus
              />
            </label>
            <label>
              API key
              <input name="apiKey" type="password" required placeholder="sk-..." />
            </label>
            <label>
              Base URL
              <input name="baseUrl" type="url" value="https://api.openai.com/v1" required />
            </label>
            <label>
              Model
              <input name="defaultModel" type="text" value="gpt-4.1-mini" required />
            </label>
            {formError && <div class="form__error">{formError}</div>}
            <div class="form__actions">
              <button type="submit" class="btn btn--primary">
                Save
              </button>
              <button
                type="button"
                class="btn btn--secondary"
                onClick={() => {
                  setShowForm(false);
                  setFormError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </section>

      {bindings.length > 0 && (
        <section class="section">
          <h2 class="section__title">Connected sites ({bindings.length})</h2>
          {bindings.map((b) => {
            const host = hostOf(b.origin);
            const bound = keys.find((k) => k.keyId === b.keyId);
            const isEditing = editingBinding === b.origin;
            return (
              <div key={b.origin} class="binding-row">
                <div class="binding-row__info">
                  <span class="binding-row__host">{host}</span>
                  <span class="binding-row__key">
                    {bound
                      ? `→ ${bound.label} (${bound.provider})`
                      : b.keyId
                        ? "→ (key removed)"
                        : "→ (no key bound)"}
                  </span>
                </div>
                <div class="binding-row__actions">
                  {isEditing ? (
                    <select
                      class="binding-row__picker"
                      onChange={(e) => {
                        const v = (e.target as HTMLSelectElement).value;
                        if (v) handleSetBinding(b.origin, v);
                      }}
                    >
                      <option value="">Pick a key…</option>
                      {keys.map((k) => (
                        <option key={k.keyId} value={k.keyId}>
                          {k.label} ({k.provider})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      class="btn btn--ghost btn--sm"
                      onClick={() => setEditingBinding(b.origin)}
                    >
                      Change
                    </button>
                  )}
                  <button
                    class="btn btn--ghost btn--sm"
                    onClick={() => handleRevokeBinding(b.origin)}
                    aria-label={`Revoke access for ${host}`}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <p class="hint">
        Keys live in browser session memory only. They're cleared when you close the browser and
        never sent anywhere except the LLM provider you pick per key.
      </p>
    </div>
  );
}

render(<App />, document.getElementById("app")!);

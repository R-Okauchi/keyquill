/**
 * Manages streaming and non-streaming chat requests.
 * Fetches from LLM provider, parses SSE, and sends events over a Chrome Port.
 */

import type {
  ChatStreamRequest,
  ChatRequestMessage,
  ChatCompletion,
  OutgoingResponse,
  StreamEvent,
  ToolCallDelta,
  KeyRecord,
} from "../shared/protocol.js";
import { getKey, getActiveKey } from "./keyStore.js";
import { getBinding, touchBindingUsage } from "./bindingStore.js";
import { buildProviderFetch, parseAnthropicCompletion } from "./providerFetch.js";

// ── Key resolution ─────────────────────────────────────

/**
 * Resolve which stored KeyRecord should service this request.
 *
 * Priority (v3 active-key model):
 *   1. `request.keyId` — explicit SDK selection (strongest signal)
 *   2. Per-origin binding — persisted site choice from consent popup
 *   3. Active key — the wallet's current selection, singleton across
 *      the whole wallet
 *
 * `request.provider` is accepted for compatibility but no longer drives
 * resolution (a site that needs a specific provider should pass keyId of
 * a matching key). This eliminates the v2 ambiguity where the "global
 * default" was the first per-provider default in array order.
 */
export async function resolveKey(
  request: { keyId?: string; provider?: string },
  origin: string | null,
): Promise<KeyRecord | null> {
  if (request.keyId) {
    return (await getKey(request.keyId)) ?? null;
  }

  if (origin && origin !== "__internal__") {
    const binding = await getBinding(origin);
    if (binding?.keyId) {
      const keyRecord = await getKey(binding.keyId);
      if (keyRecord) {
        touchBindingUsage(origin).catch(() => {
          // non-critical
        });
        return keyRecord;
      }
      // Binding is stale (referenced key was deleted); fall through.
    }
  }

  return await getActiveKey();
}

// ── Streaming ──────────────────────────────────────────

export async function handleChatStream(
  port: chrome.runtime.Port,
  request: ChatStreamRequest,
  origin: string | null,
): Promise<void> {
  const keyRecord = await resolveKey(request, origin);

  if (!keyRecord) {
    sendEvent(port, {
      type: "error",
      code: "KEY_NOT_FOUND",
      message:
        "No Keyquill key available. Open the extension popup to add one or to bind this site to a key.",
    });
    return;
  }

  // Announce which key is servicing this stream (for audit / UI hint).
  sendEvent(port, {
    type: "start",
    keyId: keyRecord.keyId,
    provider: keyRecord.provider,
    label: keyRecord.label,
  });

  const fetchParams = buildProviderFetch(keyRecord, request, true);

  let response: Response;
  try {
    response = await fetch(fetchParams.url, {
      method: "POST",
      headers: fetchParams.headers,
      body: fetchParams.body,
    });
  } catch (err) {
    sendEvent(port, {
      type: "error",
      code: "PROVIDER_UNREACHABLE",
      message: `Could not reach provider: ${err instanceof Error ? err.message : "unknown"}`,
    });
    return;
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown error");
    sendEvent(port, {
      type: "error",
      code: "PROVIDER_ERROR",
      message: `Provider returned ${response.status}: ${sanitizeErrorText(text.slice(0, 500))}`,
    });
    return;
  }

  if (!response.body) {
    sendEvent(port, {
      type: "error",
      code: "PROVIDER_ERROR",
      message: "Empty response body from provider.",
    });
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const isAnthropic = keyRecord.provider === "anthropic";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (!trimmed.startsWith("data: ")) continue;

        try {
          const data = JSON.parse(trimmed.slice(6));

          if (isAnthropic) {
            parseAnthropicStreamEvent(port, data);
          } else {
            parseOpenAiStreamEvent(port, data);
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  sendEvent(port, { type: "done" });
}

// ── OpenAI SSE Parsing ─────────────────────────────────

function parseOpenAiStreamEvent(port: chrome.runtime.Port, data: Record<string, unknown>): void {
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  if (!choices?.[0]) return;

  const choice = choices[0];
  const delta = choice.delta as Record<string, unknown> | undefined;

  if (delta?.content) {
    sendEvent(port, { type: "delta", text: delta.content as string });
  }

  if (delta?.tool_calls) {
    sendEvent(port, {
      type: "tool_call_delta",
      tool_calls: delta.tool_calls as ToolCallDelta[],
    });
  }

  if (choice.finish_reason) {
    const usage = data.usage as Record<string, number> | undefined;
    sendEvent(port, {
      type: "done",
      finish_reason: choice.finish_reason as ChatCompletion["finish_reason"],
      usage: usage
        ? { promptTokens: usage.prompt_tokens ?? 0, completionTokens: usage.completion_tokens ?? 0 }
        : undefined,
    });
  }
}

// ── Anthropic SSE Parsing ──────────────────────────────

function parseAnthropicStreamEvent(port: chrome.runtime.Port, data: Record<string, unknown>): void {
  const eventType = data.type as string;

  if (eventType === "content_block_delta") {
    const delta = data.delta as Record<string, unknown>;
    if (delta?.type === "text_delta") {
      sendEvent(port, { type: "delta", text: delta.text as string });
    }
    if (delta?.type === "input_json_delta") {
      sendEvent(port, {
        type: "tool_call_delta",
        tool_calls: [
          {
            index: data.index as number,
            function: { arguments: delta.partial_json as string },
          },
        ],
      });
    }
  }

  if (eventType === "content_block_start") {
    const block = data.content_block as Record<string, unknown>;
    if (block?.type === "tool_use") {
      sendEvent(port, {
        type: "tool_call_delta",
        tool_calls: [
          {
            index: data.index as number,
            id: block.id as string,
            type: "function",
            function: { name: block.name as string, arguments: "" },
          },
        ],
      });
    }
  }

  if (eventType === "message_delta") {
    const delta = data.delta as Record<string, unknown> | undefined;
    const stopReason = delta?.stop_reason as string | undefined;
    const finishReason = stopReason === "tool_use" ? ("tool_calls" as const) : ("stop" as const);
    const usage = data.usage as Record<string, number> | undefined;
    sendEvent(port, {
      type: "done",
      finish_reason: finishReason,
      usage: usage
        ? { promptTokens: usage.input_tokens ?? 0, completionTokens: usage.output_tokens ?? 0 }
        : undefined,
    });
  }
}

// ── Non-Streaming Chat ─────────────────────────────────

export async function handleChat(
  request: ChatRequestMessage,
  origin: string | null,
): Promise<OutgoingResponse> {
  const keyRecord = await resolveKey(request, origin);

  if (!keyRecord) {
    return { type: "error", code: "KEY_NOT_FOUND", message: "No Keyquill key available." };
  }

  const fetchParams = buildProviderFetch(keyRecord, request, false);

  let response: Response;
  try {
    response = await fetch(fetchParams.url, {
      method: "POST",
      headers: fetchParams.headers,
      body: fetchParams.body,
    });
  } catch (err) {
    return {
      type: "error",
      code: "PROVIDER_UNREACHABLE",
      message: `Could not reach provider: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "unknown");
    return {
      type: "error",
      code: "PROVIDER_ERROR",
      message: `Provider returned ${response.status}: ${sanitizeErrorText(text.slice(0, 500))}`,
    };
  }

  const data = (await response.json()) as Record<string, unknown>;

  const completion =
    keyRecord.provider === "anthropic"
      ? parseAnthropicCompletion(data)
      : parseOpenAiCompletion(data);

  return { type: "chatCompletion", completion, keyId: keyRecord.keyId };
}

function parseOpenAiCompletion(data: Record<string, unknown>): ChatCompletion {
  const choices = data.choices as Array<Record<string, unknown>> | undefined;
  const message = choices?.[0]?.message as Record<string, unknown> | undefined;
  const usage = data.usage as Record<string, number> | undefined;

  const result: ChatCompletion = {
    content: (message?.content as string) ?? null,
    finish_reason: (choices?.[0]?.finish_reason as ChatCompletion["finish_reason"]) ?? "stop",
  };

  if (message?.tool_calls) {
    result.tool_calls = message.tool_calls as ChatCompletion["tool_calls"];
  }

  if (usage) {
    result.usage = {
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    };
  }

  return result;
}

// ── Helpers ────────────────────────────────────────────

function sanitizeErrorText(text: string): string {
  return text
    .replace(/Bearer\s+[\w\-_.]+/gi, "Bearer [REDACTED]")
    .replace(/\bsk-[A-Za-z0-9_-]{10,}/g, "[REDACTED]")
    .replace(/\bkey-[A-Za-z0-9_-]{10,}/g, "[REDACTED]");
}

function sendEvent(port: chrome.runtime.Port, event: StreamEvent): void {
  try {
    port.postMessage(event);
  } catch {
    // Port disconnected — ignore
  }
}

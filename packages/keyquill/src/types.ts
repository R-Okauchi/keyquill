/**
 * Message protocol between the Keyquill SDK and browser extension.
 * These types define the contract — both sides must agree on them.
 *
 * The wire protocol follows OpenAI Chat Completions format.
 * OpenAI-compatible providers receive requests as-is; Anthropic
 * requests are translated by the extension before forwarding.
 */

// ── OpenAI-Compatible Message Types ────────────────────

export interface TextContentPart {
  type: "text";
  text: string;
}

export interface ImageContentPart {
  type: "image_url";
  image_url: { url: string; detail?: "auto" | "low" | "high" };
}

export type ContentPart = TextContentPart | ImageContentPart;

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content?: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

// ── Tool & Response Format ─────────────────────────────

export type JsonSchema = Record<string, unknown>;

export interface FunctionTool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: JsonSchema;
    strict?: boolean;
  };
}

export type Tool = FunctionTool;

export type ToolChoice =
  | "none"
  | "auto"
  | "required"
  | { type: "function"; function: { name: string } };

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: { name: string; schema: JsonSchema; strict?: boolean } };

// ── Key Info ────────────────────────────────────────

/**
 * Safe projection of a stored key. Returned by `listKeys()`.
 * Never includes the raw `apiKey`.
 */
export interface KeySummary {
  keyId: string;
  provider: string;
  label: string;
  baseUrl: string;
  defaultModel: string;
  isDefault: boolean;
  keyHint: string | null;
  status: "active" | "error";
  createdAt: number;
  updatedAt: number;
}

// ── Request Parameters ─────────────────────────────────

export interface ChatParams {
  /**
   * Explicit key selection by stable id. Overrides all other resolution.
   * The extension returns `KEY_NOT_FOUND` if this key doesn't exist in the
   * user's wallet.
   */
  keyId?: string;

  /**
   * Provider hint (e.g. "openai", "anthropic"). If no `keyId`, used to pick
   * the user's default key for that provider. Omit or "auto" to pick the
   * user's global default.
   */
  provider?: string;

  model?: string;
  messages: ChatMessage[];

  // Generation parameters
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stop?: string | string[];

  // Tool calling
  tools?: Tool[];
  tool_choice?: ToolChoice;

  // Structured output
  response_format?: ResponseFormat;
}

export interface ChatStreamParams extends ChatParams {
  /**
   * @deprecated Use max_tokens instead.
   */
  maxTokens?: number;
}

// ── Wire Requests ─────────────────────────────────────

export interface ChatStreamRequest extends ChatParams {
  type: "chatStream";
  /** @deprecated */ maxTokens?: number;
}

export interface ChatRequest extends ChatParams {
  type: "chat";
  /** @deprecated */ maxTokens?: number;
}

export type VaultRequest =
  | { type: "ping" }
  | { type: "connect" }
  | { type: "disconnect" }
  | { type: "listKeys" }
  | { type: "testKey"; keyId: string }
  | ChatRequest;

// ── Response Messages ─────────────────────────────────

export interface ChatCompletion {
  content: string | null;
  tool_calls?: ToolCall[];
  finish_reason: "stop" | "tool_calls" | "length" | "content_filter";
  usage?: { promptTokens: number; completionTokens: number };
}

export type VaultResponse =
  | { type: "pong"; version: string; protocol: number; connected?: boolean }
  | { type: "connected"; origin: string }
  | { type: "keys"; keys: KeySummary[] }
  | { type: "ok" }
  | { type: "testResult"; reachable: boolean }
  | { type: "chatCompletion"; completion: ChatCompletion; keyId: string }
  | { type: "error"; code: string; message: string };

// ── Stream Events ─────────────────────────────────────

export interface ToolCallDelta {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

export type StreamEvent =
  /** First event in every stream. Tells the caller which key is servicing it. */
  | { type: "start"; keyId: string; provider: string; label: string }
  | { type: "delta"; text: string }
  | { type: "tool_call_delta"; tool_calls: ToolCallDelta[] }
  | {
      type: "done";
      finish_reason?: "stop" | "tool_calls" | "length" | "content_filter";
      usage?: { promptTokens: number; completionTokens: number };
    }
  | { type: "error"; code: string; message: string };

// ── Error Codes ──────────────────────────────────────

export const ErrorCode = {
  EXTENSION_NOT_FOUND: "EXTENSION_NOT_FOUND",
  PROTOCOL_MISMATCH: "PROTOCOL_MISMATCH",
  NOT_CONNECTED: "NOT_CONNECTED",
  USER_DENIED: "USER_DENIED",
  KEY_NOT_FOUND: "KEY_NOT_FOUND",
  PROVIDER_UNREACHABLE: "PROVIDER_UNREACHABLE",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",
  TIMEOUT: "TIMEOUT",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** SDK's expected protocol version. Bumped on every breaking schema change. */
export const SDK_PROTOCOL_VERSION = 2;

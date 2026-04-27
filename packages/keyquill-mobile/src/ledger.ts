/**
 * Mobile audit ledger — per-request history users can inspect.
 *
 * Mirrors the extension's `background/ledger.ts` API shape but keyed
 * by `provider` (mobile's only per-key identifier today; extension
 * uses keyId because the wallet is multi-key). Storage is
 * `@capacitor/preferences` (NSUserDefaults on iOS,
 * SharedPreferences on Android) which survives app restarts but is
 * scoped per-app, so apps don't share ledger history.
 *
 * Phase 18c is TS-only: callers append entries explicitly when
 * `chatStream` finishes. Native automation (PolicyEnforcer writes the
 * entry from inside the bridge) lands in Phases 18d/18e.
 *
 * ## Storage shape
 *
 *   { [provider: string]: LedgerEntry[] }
 *
 * Per-provider arrays append-only in the hot path; trim runs on every
 * read past a 90-day cutoff. Same retention as the extension.
 *
 * ## Concurrency
 *
 * The default Preferences-backed implementation serializes writes
 * through `navigator.locks` when available, with an in-memory queue
 * fallback otherwise. Tests can inject an alternative storage via
 * `setLedgerStore()`.
 */

import { renderError, type ErrorCode } from "./errors/index.js";

const STORAGE_KEY = "keyquill_mobile_ledger_v1";
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const LOCK_NAME = "keyquill_mobile_ledger_write";

// ── Types ──────────────────────────────────────────────

export interface LedgerEntry {
  timestamp: number;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  estimatedCostUSD: number;
  /**
   * Actual cost computed post-stream from real usage reported in the
   * `done` event. For cancellations or errors, callers typically pass
   * the estimate as the actual.
   */
  actualCostUSD: number;
  status: "success" | "error" | "cancelled";
  errorCode?: ErrorCode | string;
}

type LedgerStorage = Record<string, LedgerEntry[]>;

/**
 * Pluggable storage abstraction. Defaults to `@capacitor/preferences`
 * (lazy-loaded so callers that don't use the ledger don't pay the
 * import cost). Tests inject a memory store via `setLedgerStore()`.
 */
export interface LedgerStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

let configuredStore: LedgerStore | null = null;

export function setLedgerStore(store: LedgerStore | null): void {
  configuredStore = store;
}

function getStore(): LedgerStore {
  if (configuredStore) return configuredStore;
  configuredStore = {
    async read() {
      const { Preferences } = await import("@capacitor/preferences");
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      return value ?? null;
    },
    async write(value) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: STORAGE_KEY, value });
    },
  };
  return configuredStore;
}

// ── Mutex helper ───────────────────────────────────────

let inMemoryQueue: Promise<unknown> = Promise.resolve();

interface LockManager {
  request<T>(name: string, fn: () => Promise<T>): Promise<T>;
}

async function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const locks = (globalThis as { navigator?: { locks?: LockManager } }).navigator
    ?.locks;
  if (locks) {
    return (await locks.request(LOCK_NAME, async () => fn())) as T;
  }
  const next = inMemoryQueue.then(() => fn());
  inMemoryQueue = next.catch(() => {});
  return next;
}

// ── Raw storage I/O ────────────────────────────────────

async function readRaw(): Promise<LedgerStorage> {
  const raw = await getStore().read();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as LedgerStorage;
    }
  } catch {
    // Corrupted ledger — best-effort: treat as empty rather than crash.
  }
  return {};
}

async function writeRaw(storage: LedgerStorage): Promise<void> {
  await getStore().write(JSON.stringify(storage));
}

// ── Retention trim ─────────────────────────────────────

function trimByRetention(entries: LedgerEntry[], now = Date.now()): LedgerEntry[] {
  const cutoff = now - RETENTION_MS;
  return entries.filter((e) => e.timestamp >= cutoff);
}

// ── Public API ─────────────────────────────────────────

/**
 * Append an entry to the ledger under its provider name.
 * Concurrency-safe.
 */
export async function appendEntry(entry: LedgerEntry): Promise<void> {
  await withWriteLock(async () => {
    const storage = await readRaw();
    const list = storage[entry.provider] ?? [];
    list.push(entry);
    storage[entry.provider] = trimByRetention(list);
    await writeRaw(storage);
  });
}

/**
 * Read entries for a provider, optionally since a given timestamp (ms).
 * Returns newest-last (append order).
 */
export async function queryByProvider(
  provider: string,
  since?: number,
): Promise<LedgerEntry[]> {
  const storage = await readRaw();
  const list = storage[provider] ?? [];
  const trimmed = trimByRetention(list);
  if (since === undefined) return trimmed;
  return trimmed.filter((e) => e.timestamp >= since);
}

/**
 * Sum of `actualCostUSD` across successful entries in the given UTC
 * month. `month` is a `YYYY-MM` string; defaults to the current UTC
 * month.
 */
export async function getMonthSpend(
  provider: string,
  month?: string,
): Promise<number> {
  const target = month ?? isoMonth(new Date());
  const entries = await queryByProvider(provider);
  return entries
    .filter(
      (e) =>
        e.status === "success" && isoMonth(new Date(e.timestamp)) === target,
    )
    .reduce((sum, e) => sum + e.actualCostUSD, 0);
}

/**
 * Sum of `actualCostUSD` across successful entries on the given UTC
 * day. `day` is a `YYYY-MM-DD` string; defaults to today UTC.
 */
export async function getDailySpend(
  provider: string,
  day?: string,
): Promise<number> {
  const target = day ?? isoDay(new Date());
  const entries = await queryByProvider(provider);
  return entries
    .filter(
      (e) =>
        e.status === "success" && isoDay(new Date(e.timestamp)) === target,
    )
    .reduce((sum, e) => sum + e.actualCostUSD, 0);
}

/**
 * Delete all entries for a provider. Call alongside `deleteKey()` so
 * ledger history doesn't leak across key rotations.
 */
export async function clearByProvider(provider: string): Promise<void> {
  await withWriteLock(async () => {
    const storage = await readRaw();
    if (provider in storage) {
      delete storage[provider];
      await writeRaw(storage);
    }
  });
}

/**
 * Delete every ledger entry across every provider. Useful for
 * "factory reset" UX; rare in normal flow.
 */
export async function clearAll(): Promise<void> {
  await withWriteLock(async () => {
    await writeRaw({});
  });
}

// ── CSV export ─────────────────────────────────────────

const CSV_COLUMNS = [
  "timestamp",
  "provider",
  "model",
  "status",
  "inputTokens",
  "outputTokens",
  "reasoningTokens",
  "estimatedCostUSD",
  "actualCostUSD",
  "errorCode",
] as const;

/**
 * Export every entry for a provider as a CSV string. Suitable for
 * sharing via the iOS share sheet or Android Intent.ACTION_SEND.
 *
 * Localized error codes are stored as their stable identifier in the
 * CSV (not the translated message) — `renderError()` is a runtime
 * helper, not a CSV concern. If callers want a localized human-readable
 * version, post-process the CSV before sharing.
 */
export async function exportCSV(provider: string): Promise<string> {
  const entries = await queryByProvider(provider);
  const lines = [CSV_COLUMNS.join(",")];
  for (const e of entries) {
    const row: Array<string | number> = [
      new Date(e.timestamp).toISOString(),
      csvEscape(e.provider),
      csvEscape(e.model),
      e.status,
      e.inputTokens,
      e.outputTokens,
      e.reasoningTokens ?? "",
      e.estimatedCostUSD.toFixed(6),
      e.actualCostUSD.toFixed(6),
      csvEscape(e.errorCode ?? ""),
    ];
    lines.push(row.join(","));
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// ── Date helpers ───────────────────────────────────────

function isoMonth(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ── Exports for tests ──────────────────────────────────

// renderError isn't actually used by the ledger module today, but it's
// imported above so the module advertises the dependency for future
// auto-formatting of error rows in localized exports. Keep referenced
// to avoid unused-import lint trips.
void renderError;

export const __test = {
  trimByRetention,
  isoMonth,
  isoDay,
  STORAGE_KEY,
  RETENTION_MS,
};

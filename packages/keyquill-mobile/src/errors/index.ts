/**
 * Runtime error-message lookup for keyquill-mobile.
 *
 * Native code emits stable `code` strings (see codes.ts) when bridge
 * methods reject or stream-error events fire. Callers route the code
 * through `getErrorMessage()` to display a localized, actionable
 * sentence; `renderError()` adds a fallback to whatever raw message
 * native attached when the code isn't in the table.
 *
 * Locale resolution order:
 *   1. explicit `locale` argument (lets callers override the device language)
 *   2. globalThis.navigator.language — works in WKWebView (iOS) and
 *      Android WebView, where Capacitor runs the JS layer
 *   3. "en" as the final fallback
 *
 * Unknown codes return undefined; callers should fall back to the raw
 * message carried alongside the error.
 */

import { ERRORS_EN } from "./en.js";
import { ERRORS_JA } from "./ja.js";
import { type ErrorCode, isKnownErrorCode } from "./codes.js";

const TABLES: Record<string, Record<ErrorCode, string>> = {
  en: ERRORS_EN,
  ja: ERRORS_JA,
};

export type Locale = "en" | "ja";

function detectLocale(): Locale {
  const lang = (globalThis as { navigator?: { language?: string } }).navigator?.language ?? "en";
  const prefix = lang.split("-")[0].toLowerCase();
  return prefix === "ja" ? "ja" : "en";
}

/**
 * Return a localized message for a known error code, or undefined.
 * Supply `locale` to override device language detection (useful in
 * tests or when an app forces its own UI language).
 */
export function getErrorMessage(code: string, locale?: Locale): string | undefined {
  if (!isKnownErrorCode(code)) return undefined;
  const table = TABLES[locale ?? detectLocale()] ?? ERRORS_EN;
  return table[code];
}

/**
 * Pick the best rendering for a possibly-localized error. Prefers the
 * translated sentence; falls back to the raw `message` the native side
 * attached (e.g. dynamic `Provider returned 404: …`).
 */
export function renderError(code: string, rawMessage: string, locale?: Locale): string {
  return getErrorMessage(code, locale) ?? rawMessage;
}

export { ERRORS_EN, ERRORS_JA };
export type { ErrorCode } from "./codes.js";
export { ERROR_CODES, isKnownErrorCode } from "./codes.js";

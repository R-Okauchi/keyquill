/**
 * Runtime error-message lookup.
 *
 * The broker emits stable `code` strings in every OutgoingResponse.
 * UI layers (popup, consent page, SDK caller) route the code through
 * `getErrorMessage` to get a localized, actionable sentence.
 *
 * Locale resolution order:
 *   1. explicit `locale` argument (lets callers override the UI lang)
 *   2. chrome.i18n.getUILanguage() if available (extension contexts)
 *   3. "en" as the final fallback
 *
 * Unknown codes return undefined; callers should fall back to the raw
 * message carried in the error response.
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
  const chromeGlobal = (globalThis as { chrome?: { i18n?: { getUILanguage?: () => string } } }).chrome;
  const ui = chromeGlobal?.i18n?.getUILanguage?.() ?? "en";
  const prefix = ui.split("-")[0].toLowerCase();
  return prefix === "ja" ? "ja" : "en";
}

/**
 * Return a localized message for a known error code, or undefined.
 * Supply `locale` to override the extension's UI language.
 */
export function getErrorMessage(code: string, locale?: Locale): string | undefined {
  if (!isKnownErrorCode(code)) return undefined;
  const table = TABLES[locale ?? detectLocale()] ?? ERRORS_EN;
  return table[code];
}

/**
 * Pick the best rendering for a possibly-localized error. Prefers the
 * translated sentence; falls back to the raw `message` the background
 * attached (e.g. dynamic `Provider returned 404: …`).
 */
export function renderError(code: string, rawMessage: string, locale?: Locale): string {
  return getErrorMessage(code, locale) ?? rawMessage;
}

export { ERRORS_EN, ERRORS_JA };
export type { ErrorCode } from "./codes.js";
export { ERROR_CODES, isKnownErrorCode } from "./codes.js";

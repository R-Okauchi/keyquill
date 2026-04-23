import { describe, it, expect, afterEach } from "vitest";
import {
  ERROR_CODES,
  ERRORS_EN,
  ERRORS_JA,
  getErrorMessage,
  isKnownErrorCode,
  renderError,
} from "../errors/index.js";

describe("error i18n tables", () => {
  it("every ErrorCode has a non-empty English message", () => {
    for (const code of ERROR_CODES) {
      const msg = ERRORS_EN[code];
      expect(msg, `missing EN for ${code}`).toBeTruthy();
      expect(msg.length).toBeGreaterThan(10);
    }
  });

  it("every ErrorCode has a non-empty Japanese message", () => {
    for (const code of ERROR_CODES) {
      const msg = ERRORS_JA[code];
      expect(msg, `missing JA for ${code}`).toBeTruthy();
      expect(msg.length).toBeGreaterThan(5);
    }
  });

  it("EN and JA tables cover the same set of codes (no drift)", () => {
    const en = new Set(Object.keys(ERRORS_EN));
    const ja = new Set(Object.keys(ERRORS_JA));
    const onlyEn = [...en].filter((k) => !ja.has(k));
    const onlyJa = [...ja].filter((k) => !en.has(k));
    expect(onlyEn).toEqual([]);
    expect(onlyJa).toEqual([]);
  });

  it("isKnownErrorCode distinguishes catalogued from unknown codes", () => {
    expect(isKnownErrorCode("KEY_NOT_FOUND")).toBe(true);
    expect(isKnownErrorCode("POLICY_MODEL_OUTSIDE_ALLOWLIST")).toBe(true);
    expect(isKnownErrorCode("HTTP_404")).toBe(false);
    expect(isKnownErrorCode("NOPE")).toBe(false);
  });
});

describe("getErrorMessage", () => {
  const origChrome = (globalThis as { chrome?: unknown }).chrome;
  afterEach(() => {
    (globalThis as { chrome?: unknown }).chrome = origChrome;
  });

  it("returns English message with explicit en locale", () => {
    expect(getErrorMessage("KEY_NOT_FOUND", "en")).toBe(ERRORS_EN.KEY_NOT_FOUND);
  });

  it("returns Japanese message with explicit ja locale", () => {
    expect(getErrorMessage("KEY_NOT_FOUND", "ja")).toBe(ERRORS_JA.KEY_NOT_FOUND);
  });

  it("returns undefined for unknown codes", () => {
    expect(getErrorMessage("NOT_A_CODE")).toBeUndefined();
  });

  it("uses chrome.i18n.getUILanguage() when available", () => {
    (globalThis as { chrome: { i18n: { getUILanguage: () => string } } }).chrome = {
      i18n: { getUILanguage: () => "ja-JP" },
    };
    expect(getErrorMessage("KEY_NOT_FOUND")).toBe(ERRORS_JA.KEY_NOT_FOUND);
  });

  it("falls back to English when chrome.i18n reports a non-ja language", () => {
    (globalThis as { chrome: { i18n: { getUILanguage: () => string } } }).chrome = {
      i18n: { getUILanguage: () => "fr-FR" },
    };
    expect(getErrorMessage("KEY_NOT_FOUND")).toBe(ERRORS_EN.KEY_NOT_FOUND);
  });

  it("falls back to English when chrome is undefined entirely", () => {
    delete (globalThis as { chrome?: unknown }).chrome;
    expect(getErrorMessage("KEY_NOT_FOUND")).toBe(ERRORS_EN.KEY_NOT_FOUND);
  });
});

describe("renderError", () => {
  it("returns the localized message for known codes", () => {
    expect(renderError("POLICY_MODEL_OUTSIDE_ALLOWLIST", "fallback", "en")).toBe(
      ERRORS_EN.POLICY_MODEL_OUTSIDE_ALLOWLIST,
    );
  });

  it("returns the raw message for unknown codes", () => {
    expect(renderError("HTTP_404", "Provider returned 404: not found", "en")).toBe(
      "Provider returned 404: not found",
    );
  });
});

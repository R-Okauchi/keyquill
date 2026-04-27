import { describe, it, expect } from "vitest";
import {
  ERROR_CODES,
  ERRORS_EN,
  ERRORS_JA,
  getErrorMessage,
  isKnownErrorCode,
  renderError,
  type ErrorCode,
} from "../errors/index.js";

describe("ERROR_CODES catalog", () => {
  it("has at least one entry", () => {
    expect(ERROR_CODES.length).toBeGreaterThan(0);
  });

  it("has no duplicates", () => {
    const set = new Set<string>(ERROR_CODES);
    expect(set.size).toBe(ERROR_CODES.length);
  });
});

describe("locale coverage parity", () => {
  it("every code has an English message", () => {
    for (const code of ERROR_CODES) {
      const msg = ERRORS_EN[code];
      expect(msg, `EN missing ${code}`).toBeTruthy();
      expect(msg.trim().length).toBeGreaterThan(0);
    }
  });

  it("every code has a Japanese message", () => {
    for (const code of ERROR_CODES) {
      const msg = ERRORS_JA[code];
      expect(msg, `JA missing ${code}`).toBeTruthy();
      expect(msg.trim().length).toBeGreaterThan(0);
    }
  });

  it("EN and JA tables share the same key set", () => {
    const enKeys = new Set(Object.keys(ERRORS_EN));
    const jaKeys = new Set(Object.keys(ERRORS_JA));
    const onlyEn = [...enKeys].filter((k) => !jaKeys.has(k));
    const onlyJa = [...jaKeys].filter((k) => !enKeys.has(k));
    expect({ onlyEn, onlyJa }).toEqual({ onlyEn: [], onlyJa: [] });
  });
});

describe("isKnownErrorCode", () => {
  it("recognises every code in ERROR_CODES", () => {
    for (const code of ERROR_CODES) {
      expect(isKnownErrorCode(code)).toBe(true);
    }
  });

  it("rejects unknown strings", () => {
    expect(isKnownErrorCode("DEFINITELY_NOT_A_REAL_CODE")).toBe(false);
    expect(isKnownErrorCode("")).toBe(false);
  });
});

describe("getErrorMessage", () => {
  it("returns the English message for an explicit en locale", () => {
    expect(getErrorMessage("KEY_NOT_FOUND", "en")).toBe(
      ERRORS_EN.KEY_NOT_FOUND,
    );
  });

  it("returns the Japanese message for an explicit ja locale", () => {
    expect(getErrorMessage("KEY_NOT_FOUND", "ja")).toBe(
      ERRORS_JA.KEY_NOT_FOUND,
    );
  });

  it("returns undefined for an unknown code", () => {
    expect(getErrorMessage("DEFINITELY_NOT_A_REAL_CODE")).toBeUndefined();
  });

  it("returns the EN message under detectLocale fallback (vitest navigator default)", () => {
    // vitest's jsdom-less environment defaults navigator.language to 'en-US'
    // when navigator is present; otherwise the detector returns 'en'. Both
    // resolve to the EN table.
    expect(getErrorMessage("KEY_NOT_FOUND")).toBe(ERRORS_EN.KEY_NOT_FOUND);
  });
});

describe("renderError fallback chain", () => {
  it("uses the localized message when the code is known", () => {
    expect(renderError("KEY_NOT_FOUND", "raw fallback", "en")).toBe(
      ERRORS_EN.KEY_NOT_FOUND,
    );
  });

  it("falls back to raw message when the code is unknown", () => {
    expect(
      renderError("UNKNOWN_RUNTIME_CODE", "Provider returned 503", "en"),
    ).toBe("Provider returned 503");
  });
});

describe("type assignability", () => {
  it("ErrorCode is assignable from a known constant", () => {
    const code: ErrorCode = "POLICY_BUDGET_DAILY_EXCEEDED";
    expect(ERROR_CODES).toContain(code);
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  __test,
  appendEntry,
  clearAll,
  clearByProvider,
  exportCSV,
  getDailySpend,
  getMonthSpend,
  queryByProvider,
  setLedgerStore,
  type LedgerEntry,
  type LedgerStore,
} from "../ledger.js";

// In-memory store for tests; isolated per file via beforeEach reset.
function memoryStore(): LedgerStore {
  let value: string | null = null;
  return {
    async read() {
      return value;
    },
    async write(v) {
      value = v;
    },
  };
}

beforeEach(() => {
  setLedgerStore(memoryStore());
});

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    timestamp: Date.parse("2026-04-15T10:00:00Z"),
    provider: "openai",
    model: "gpt-5.4-mini",
    inputTokens: 100,
    outputTokens: 200,
    estimatedCostUSD: 0.001,
    actualCostUSD: 0.0009,
    status: "success",
    ...overrides,
  };
}

describe("appendEntry / queryByProvider", () => {
  it("stores and retrieves a single entry", async () => {
    await appendEntry(entry());
    const list = await queryByProvider("openai");
    expect(list).toHaveLength(1);
    expect(list[0].model).toBe("gpt-5.4-mini");
    expect(list[0].actualCostUSD).toBeCloseTo(0.0009);
  });

  it("isolates entries by provider", async () => {
    await appendEntry(entry({ provider: "openai" }));
    await appendEntry(entry({ provider: "anthropic", model: "claude-sonnet-4-6" }));
    const openai = await queryByProvider("openai");
    const anthropic = await queryByProvider("anthropic");
    expect(openai).toHaveLength(1);
    expect(anthropic).toHaveLength(1);
    expect(anthropic[0].model).toBe("claude-sonnet-4-6");
  });

  it("appends multiple entries in order", async () => {
    // Use recent timestamps so the retention trim doesn't drop them.
    const base = Date.now() - 5 * 24 * 60 * 60 * 1000; // 5 days ago
    await appendEntry(entry({ timestamp: base + 1 }));
    await appendEntry(entry({ timestamp: base + 2 }));
    await appendEntry(entry({ timestamp: base + 3 }));
    const list = await queryByProvider("openai");
    expect(list.map((e) => e.timestamp)).toEqual([base + 1, base + 2, base + 3]);
  });

  it("filters by `since` timestamp on read", async () => {
    const base = Date.now() - 5 * 24 * 60 * 60 * 1000;
    await appendEntry(entry({ timestamp: base + 1000 }));
    await appendEntry(entry({ timestamp: base + 2000 }));
    await appendEntry(entry({ timestamp: base + 3000 }));
    const list = await queryByProvider("openai", base + 2000);
    expect(list.map((e) => e.timestamp)).toEqual([base + 2000, base + 3000]);
  });

  it("returns empty array for an unknown provider", async () => {
    expect(await queryByProvider("nonexistent")).toEqual([]);
  });
});

describe("retention trim", () => {
  it("drops entries older than 90 days on read", async () => {
    const now = Date.now();
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    const hundredDaysAgo = now - 100 * 24 * 60 * 60 * 1000;
    await appendEntry(entry({ timestamp: hundredDaysAgo }));
    await appendEntry(entry({ timestamp: sixtyDaysAgo }));
    await appendEntry(entry({ timestamp: now }));
    const list = await queryByProvider("openai");
    expect(list).toHaveLength(2);
    for (const e of list) {
      expect(now - e.timestamp).toBeLessThanOrEqual(__test.RETENTION_MS);
    }
  });

  it("__test.trimByRetention is a pure helper", () => {
    const now = 100_000_000_000;
    const oldTs = now - __test.RETENTION_MS - 1;
    const recentTs = now - 1;
    const result = __test.trimByRetention(
      [entry({ timestamp: oldTs }), entry({ timestamp: recentTs })],
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(recentTs);
  });
});

describe("getMonthSpend", () => {
  it("sums actualCostUSD across successful entries in target month", async () => {
    const aprMid = Date.parse("2026-04-15T00:00:00Z");
    const aprEnd = Date.parse("2026-04-29T00:00:00Z");
    const mayStart = Date.parse("2026-05-01T00:00:00Z");
    await appendEntry(entry({ timestamp: aprMid, actualCostUSD: 0.1 }));
    await appendEntry(entry({ timestamp: aprEnd, actualCostUSD: 0.2 }));
    await appendEntry(entry({ timestamp: mayStart, actualCostUSD: 0.5 }));

    expect(await getMonthSpend("openai", "2026-04")).toBeCloseTo(0.3);
    expect(await getMonthSpend("openai", "2026-05")).toBeCloseTo(0.5);
    expect(await getMonthSpend("openai", "2026-12")).toBe(0);
  });

  it("excludes failed and cancelled entries from monthly spend", async () => {
    const ts = Date.parse("2026-04-15T00:00:00Z");
    await appendEntry(entry({ timestamp: ts, actualCostUSD: 0.1, status: "success" }));
    await appendEntry(entry({ timestamp: ts, actualCostUSD: 0.2, status: "error" }));
    await appendEntry(entry({ timestamp: ts, actualCostUSD: 0.3, status: "cancelled" }));
    expect(await getMonthSpend("openai", "2026-04")).toBeCloseTo(0.1);
  });
});

describe("getDailySpend", () => {
  it("sums by UTC day", async () => {
    const day1 = Date.parse("2026-04-15T05:00:00Z");
    const day1Late = Date.parse("2026-04-15T23:00:00Z");
    const day2 = Date.parse("2026-04-16T05:00:00Z");
    await appendEntry(entry({ timestamp: day1, actualCostUSD: 0.05 }));
    await appendEntry(entry({ timestamp: day1Late, actualCostUSD: 0.07 }));
    await appendEntry(entry({ timestamp: day2, actualCostUSD: 0.10 }));

    expect(await getDailySpend("openai", "2026-04-15")).toBeCloseTo(0.12);
    expect(await getDailySpend("openai", "2026-04-16")).toBeCloseTo(0.10);
  });
});

describe("clearByProvider / clearAll", () => {
  it("clearByProvider drops only that provider's entries", async () => {
    await appendEntry(entry({ provider: "openai" }));
    await appendEntry(entry({ provider: "anthropic" }));
    await clearByProvider("openai");
    expect(await queryByProvider("openai")).toEqual([]);
    expect(await queryByProvider("anthropic")).toHaveLength(1);
  });

  it("clearAll wipes the ledger across providers", async () => {
    await appendEntry(entry({ provider: "openai" }));
    await appendEntry(entry({ provider: "anthropic" }));
    await clearAll();
    expect(await queryByProvider("openai")).toEqual([]);
    expect(await queryByProvider("anthropic")).toEqual([]);
  });
});

describe("exportCSV", () => {
  it("emits header + one row per entry", async () => {
    await appendEntry(
      entry({
        timestamp: Date.parse("2026-04-15T10:00:00Z"),
        inputTokens: 50,
        outputTokens: 75,
        estimatedCostUSD: 0.0001,
        actualCostUSD: 0.00012,
      }),
    );
    const csv = await exportCSV("openai");
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      "timestamp,provider,model,status,inputTokens,outputTokens,reasoningTokens,estimatedCostUSD,actualCostUSD,errorCode",
    );
    expect(lines[1]).toContain("2026-04-15T10:00:00.000Z");
    expect(lines[1]).toContain("0.000100");
    expect(lines[1]).toContain("0.000120");
  });

  it("escapes commas, quotes, and newlines in string fields", async () => {
    await appendEntry(
      entry({
        provider: 'odd,"name"\nx',
        model: "gpt-5.4-mini",
      }),
    );
    const csv = await exportCSV('odd,"name"\nx');
    // The row literally contains a newline INSIDE the quoted field, so
    // splitting by "\n" would carve the row in two. Assert against the
    // raw CSV string instead.
    expect(csv).toContain('"odd,""name""\nx"');
  });

  it("returns just the header for an empty provider", async () => {
    const csv = await exportCSV("never-touched");
    expect(csv).toBe(
      "timestamp,provider,model,status,inputTokens,outputTokens,reasoningTokens,estimatedCostUSD,actualCostUSD,errorCode",
    );
  });
});

describe("storage corruption resilience", () => {
  it("treats malformed JSON as empty ledger", async () => {
    setLedgerStore({
      async read() {
        return "{not-valid-json";
      },
      async write() {
        // ignore
      },
    });
    expect(await queryByProvider("openai")).toEqual([]);
  });

  it("treats arrays as empty ledger (wrong shape)", async () => {
    setLedgerStore({
      async read() {
        return JSON.stringify(["not", "the", "expected", "shape"]);
      },
      async write() {
        // ignore
      },
    });
    expect(await queryByProvider("openai")).toEqual([]);
  });
});

describe("__test.isoMonth / __test.isoDay", () => {
  it("isoMonth formats UTC month consistently", () => {
    expect(__test.isoMonth(new Date("2026-04-15T10:00:00Z"))).toBe("2026-04");
    expect(__test.isoMonth(new Date("2026-12-31T23:59:59Z"))).toBe("2026-12");
  });

  it("isoDay formats UTC day consistently", () => {
    expect(__test.isoDay(new Date("2026-04-15T05:00:00Z"))).toBe("2026-04-15");
    expect(__test.isoDay(new Date("2026-04-15T23:59:59Z"))).toBe("2026-04-15");
  });
});

/**
 * Unit tests for services/views.js
 * Uses Node 18+ built-in test runner (no external deps needed)
 * Run: node --test tests/views.test.js
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { isBot, incrementView, getViewCount, getViewCounts } = require("../services/views");

// ── isBot ──────────────────────────────────────────────────────────────────

describe("isBot", () => {
  test("returns false for a normal browser UA", () => {
    assert.equal(
      isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"),
      false
    );
  });

  test("returns true for Googlebot", () => {
    assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"), true);
  });

  test("returns true for Bingbot", () => {
    assert.equal(isBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"), true);
  });

  test("returns true for crawlers (generic)", () => {
    assert.equal(isBot("SomeSEOcrawler/1.0"), true);
  });

  test("returns true for Twitterbot", () => {
    assert.equal(isBot("Twitterbot/1.0"), true);
  });

  test("returns true for facebookexternalhit", () => {
    assert.equal(isBot("facebookexternalhit/1.1"), true);
  });

  test("returns true for AhrefsBot", () => {
    assert.equal(isBot("Mozilla/5.0 (compatible; AhrefsBot/7.0)"), true);
  });

  test("returns false for empty string", () => {
    assert.equal(isBot(""), false);
  });

  test("returns false for undefined/null", () => {
    assert.equal(isBot(undefined), false);
    assert.equal(isBot(null), false);
  });
});

// ── Mock Redis client helpers ──────────────────────────────────────────────

function makeMockRedis({ getReturn = null, mGetReturn = [], incrError = null, getError = null } = {}) {
  return {
    _store: {},
    async incr(key) {
      if (incrError) throw incrError;
      this._store[key] = (this._store[key] || 0) + 1;
      return this._store[key];
    },
    async get(key) {
      if (getError) throw getError;
      return getReturn !== null ? getReturn : (this._store[key]?.toString() ?? null);
    },
    async mGet(keys) {
      if (getError) throw getError;
      if (mGetReturn.length) return mGetReturn;
      return keys.map((k) => (this._store[k]?.toString() ?? null));
    },
  };
}

// ── incrementView ──────────────────────────────────────────────────────────

describe("incrementView", () => {
  test("increments counter for a human UA", async () => {
    const redis = makeMockRedis();
    await incrementView(redis, "my-page", "Mozilla/5.0 Chrome/120");
    assert.equal(redis._store["shipfast:views:my-page"], 1);
  });

  test("does not increment for a bot UA", async () => {
    const redis = makeMockRedis();
    await incrementView(redis, "my-page", "Googlebot/2.1");
    assert.equal(redis._store["shipfast:views:my-page"], undefined);
  });

  test("does not throw when Redis errors", async () => {
    const redis = makeMockRedis({ incrError: new Error("Redis down") });
    // Should resolve without throwing
    await assert.doesNotReject(incrementView(redis, "my-page", "Chrome"));
  });
});

// ── getViewCount ───────────────────────────────────────────────────────────

describe("getViewCount", () => {
  test("returns 0 when key does not exist", async () => {
    const redis = makeMockRedis({ getReturn: null });
    assert.equal(await getViewCount(redis, "missing-page"), 0);
  });

  test("returns parsed integer for existing key", async () => {
    const redis = makeMockRedis({ getReturn: "42" });
    assert.equal(await getViewCount(redis, "some-page"), 42);
  });

  test("returns 0 on Redis error", async () => {
    const redis = makeMockRedis({ getError: new Error("timeout") });
    assert.equal(await getViewCount(redis, "some-page"), 0);
  });
});

// ── getViewCounts ──────────────────────────────────────────────────────────

describe("getViewCounts", () => {
  test("returns empty object for empty slug list", async () => {
    const redis = makeMockRedis();
    assert.deepEqual(await getViewCounts(redis, []), {});
  });

  test("returns map of slug → count for multiple slugs", async () => {
    const redis = makeMockRedis({ mGetReturn: ["10", "20", null] });
    const result = await getViewCounts(redis, ["a", "b", "c"]);
    assert.deepEqual(result, { a: 10, b: 20, c: 0 });
  });

  test("returns zeros on Redis error", async () => {
    const redis = makeMockRedis({ getError: new Error("conn failed") });
    const result = await getViewCounts(redis, ["x", "y"]);
    assert.deepEqual(result, { x: 0, y: 0 });
  });
});

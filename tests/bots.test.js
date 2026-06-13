/**
 * Unit tests for services/bots.js
 * Run: node --test tests/bots.test.js
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const {
  isBot,
  injectRobotsMeta,
  applyBotSeoHints,
  ROBOTS_DIRECTIVE,
  ROBOTS_META_TAG,
} = require("../services/bots");

// ── isBot ────────────────────────────────────────────────────────────────

describe("isBot", () => {
  test("false for a normal browser UA", () => {
    assert.equal(
      isBot("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"),
      false
    );
  });

  test("true for Googlebot, Bingbot, Twitterbot, facebookexternalhit", () => {
    assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
    assert.equal(isBot("Mozilla/5.0 (compatible; bingbot/2.0)"), true);
    assert.equal(isBot("Twitterbot/1.0"), true);
    assert.equal(isBot("facebookexternalhit/1.1"), true);
  });

  test("false for empty/undefined/null UA", () => {
    assert.equal(isBot(""), false);
    assert.equal(isBot(undefined), false);
    assert.equal(isBot(null), false);
  });
});

// ── injectRobotsMeta ─────────────────────────────────────────────────────

describe("injectRobotsMeta", () => {
  test("inserts meta tag right after <head>", () => {
    const html = "<!doctype html><html><head><title>x</title></head><body>hi</body></html>";
    const out = injectRobotsMeta(html);
    assert.ok(out.includes(ROBOTS_META_TAG));
    // Must appear before </head>
    assert.ok(out.indexOf(ROBOTS_META_TAG) < out.indexOf("</head>"));
  });

  test("handles <head> with attributes", () => {
    const html = '<html><head lang="en"><title>x</title></head><body></body></html>';
    const out = injectRobotsMeta(html);
    assert.ok(out.includes('<head lang="en">' + ROBOTS_META_TAG));
  });

  test("does not duplicate an existing robots meta", () => {
    const html =
      '<html><head><meta name="robots" content="index, follow"><title>x</title></head><body></body></html>';
    const out = injectRobotsMeta(html);
    // No injection — page author wins
    const matches = out.match(/name=["']?robots["']?/gi) || [];
    assert.equal(matches.length, 1);
  });

  test("prepends tag when there is no <head>", () => {
    const html = "<body>just a body</body>";
    const out = injectRobotsMeta(html);
    assert.ok(out.startsWith(ROBOTS_META_TAG));
  });

  test("returns input unchanged for falsy html", () => {
    assert.equal(injectRobotsMeta(""), "");
    assert.equal(injectRobotsMeta(null), null);
    assert.equal(injectRobotsMeta(undefined), undefined);
  });
});

// ── applyBotSeoHints ─────────────────────────────────────────────────────

function makeReqRes(ua) {
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
  };
  const req = { headers: { "user-agent": ua } };
  return { req, res };
}

describe("applyBotSeoHints", () => {
  test("no-op for human UA: no header, html unchanged", () => {
    const { req, res } = makeReqRes("Mozilla/5.0 Chrome/120");
    const html = "<html><head></head><body>hi</body></html>";
    const out = applyBotSeoHints(req, res, html);
    assert.equal(out, html);
    assert.equal(res.headers["X-Robots-Tag"], undefined);
  });

  test("for bot UA: sets X-Robots-Tag and injects meta", () => {
    const { req, res } = makeReqRes("Mozilla/5.0 (compatible; Googlebot/2.1)");
    const html = "<html><head><title>x</title></head><body>hi</body></html>";
    const out = applyBotSeoHints(req, res, html);
    assert.equal(res.headers["X-Robots-Tag"], ROBOTS_DIRECTIVE);
    assert.ok(out.includes(ROBOTS_META_TAG));
  });

  test("handles missing UA header", () => {
    const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; } };
    const req = { headers: {} };
    const html = "<html><head></head><body></body></html>";
    const out = applyBotSeoHints(req, res, html);
    assert.equal(out, html);
    assert.equal(res.headers["X-Robots-Tag"], undefined);
  });
});

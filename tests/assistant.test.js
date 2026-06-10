/**
 * Unit tests for the AI assistant feature
 * Uses Node 18+ built-in test runner (no external deps needed)
 * Run: node --test tests/assistant.test.js
 *
 * Note: requires the standard env (SESSION_SECRET etc.) like other modules
 * that import config. These tests cover pure logic (key generation, message
 * validation) and route-level auth behavior — no Postgres/S3 required.
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

// Minimal env so config.js validation passes in test runs
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.S3_BUCKET = process.env.S3_BUCKET || "test-bucket";

const chatStore = require("../services/chat-store");

// ── S3 key generation ───────────────────────────────────────────────────────

describe("chatStore.keyFor", () => {
  test("builds namespaced key from user, slug, chat id", () => {
    assert.equal(
      chatStore.keyFor("google-123", "my-page", "abc-def"),
      "chats/google-123/my-page/abc-def.json"
    );
  });

  test("sanitizes path traversal attempts", () => {
    const key = chatStore.keyFor("../../etc", "a/../b", "id");
    assert.ok(!key.includes(".."), `key should not contain '..': ${key}`);
    assert.ok(key.startsWith("chats/"), "key must stay under chats/");
  });

  test("strips unsafe characters", () => {
    const key = chatStore.keyFor("user name!", "slug?q=1", "id*");
    assert.match(key, /^chats\/[a-zA-Z0-9_\-./]+\.json$/);
  });
});

// ── Message validation ──────────────────────────────────────────────────────

describe("chatStore.validateMessages", () => {
  test("accepts a valid user/assistant pair", () => {
    assert.equal(
      chatStore.validateMessages([
        { role: "user", content: "hi", selection: "quoted text" },
        { role: "assistant", content: "hello" },
      ]),
      null
    );
  });

  test("rejects empty array", () => {
    assert.ok(chatStore.validateMessages([]));
  });

  test("rejects non-array", () => {
    assert.ok(chatStore.validateMessages("nope"));
  });

  test("rejects invalid role", () => {
    assert.ok(chatStore.validateMessages([{ role: "system", content: "x" }]));
  });

  test("rejects empty content", () => {
    assert.ok(chatStore.validateMessages([{ role: "user", content: "" }]));
  });

  test("rejects oversized batch", () => {
    const big = "x".repeat(chatStore.MAX_APPEND_BYTES + 1);
    assert.ok(chatStore.validateMessages([{ role: "user", content: big }]));
  });

  test("rejects too many messages", () => {
    const many = Array.from({ length: chatStore.MAX_MESSAGES_PER_APPEND + 1 }, () => ({
      role: "user",
      content: "x",
    }));
    assert.ok(chatStore.validateMessages(many));
  });
});

// ── Route-level auth (no DB/S3 needed — auth rejects first) ────────────────

describe("assistant routes auth", () => {
  const express = require("express");
  const assistantRoutes = require("../routes/assistant");

  function makeApp() {
    const app = express();
    app.use(express.json());
    // unauthenticated request context
    app.use((req, _res, next) => {
      req.isAuthenticated = () => false;
      next();
    });
    app.use("/", assistantRoutes);
    return app;
  }

  async function request(app, method, path, body) {
    const server = app.listen(0);
    const port = server.address().port;
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        redirect: "manual",
      });
      return res;
    } finally {
      server.close();
    }
  }

  test("GET /assistant.js is public and returns JS", async () => {
    const res = await request(makeApp(), "GET", "/assistant.js");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /javascript/);
    const text = await res.text();
    assert.ok(text.includes("sf-ai-context"), "loader should contain bridge protocol");
    assert.ok(!text.includes("sf_ai_key"), "loader must not touch the API key");
  });

  test("GET /assistant/panel redirects unauthenticated users to login", async () => {
    const res = await request(makeApp(), "GET", "/assistant/panel?slug=test");
    assert.equal(res.status, 302);
    assert.match(res.headers.get("location"), /^\/login/);
  });

  test("chat API returns 401/503 for unauthenticated users (never data)", async () => {
    const res = await request(makeApp(), "GET", "/api/assistant/chats?slug=test");
    // 503 when feature disabled (no DATABASE_URL), 401 when enabled but unauthenticated
    assert.ok([401, 503].includes(res.status), `unexpected status ${res.status}`);
  });

  test("POST chat API rejects unauthenticated users", async () => {
    const res = await request(makeApp(), "POST", "/api/assistant/chats", { slug: "test" });
    assert.ok([401, 503].includes(res.status), `unexpected status ${res.status}`);
  });
});

/**
 * Unit tests for services/versions.js
 * Uses Node 18+ built-in test runner. Run: node --test tests/versions.test.js
 *
 * We stub the S3 service module with an in-memory map so the logic is
 * exercised without any external dependency.
 */

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Minimal env so config.js validation passes when versions.js → s3.js → config.js
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.S3_BUCKET = process.env.S3_BUCKET || "test-bucket";

// ── Stub the s3 service before requiring versions ─────────────────────────
const s3Path = require.resolve(path.join(__dirname, "..", "services", "s3.js"));

const fakeS3 = (() => {
  const store = new Map();
  return {
    _store: store,
    reset() { store.clear(); },
    async getText(key) { return store.has(key) ? store.get(key) : null; },
    async putText(key, text) { store.set(key, text); },
    async deleteObject(key) { store.delete(key); },
    async list(prefix) {
      return [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((k) => ({ Key: k, LastModified: new Date(), Size: store.get(k).length }));
    },
  };
})();

require.cache[s3Path] = { id: s3Path, filename: s3Path, loaded: true, exports: fakeS3 };

const versions = require("../services/versions");

beforeEach(() => fakeS3.reset());

// ── cleanLabel ─────────────────────────────────────────────────────────────

describe("cleanLabel", () => {
  test("trims whitespace", () => {
    assert.equal(versions.cleanLabel("  hello  "), "hello");
  });
  test("returns empty string for non-string", () => {
    assert.equal(versions.cleanLabel(undefined), "");
    assert.equal(versions.cleanLabel(null), "");
    assert.equal(versions.cleanLabel(42), "");
  });
  test("caps overlong labels at MAX_LABEL_LEN", () => {
    const long = "x".repeat(versions.MAX_LABEL_LEN + 50);
    const cleaned = versions.cleanLabel(long);
    assert.equal(cleaned.length, versions.MAX_LABEL_LEN);
  });
});

// ── snapshotKey ────────────────────────────────────────────────────────────

describe("snapshotKey", () => {
  test("uses pages/versions/{slug}/v{n}.html layout", () => {
    assert.equal(
      versions.snapshotKey("my-page", 3),
      "pages/versions/my-page/v3.html"
    );
  });
});

// ── snapshotCurrent ────────────────────────────────────────────────────────

describe("snapshotCurrent", () => {
  test("creates first version with n=1 and writes content", async () => {
    const rec = await versions.snapshotCurrent("p", "<html>v1</html>", "html", "first");
    assert.equal(rec.n, 1);
    assert.equal(rec.label, "first");
    assert.equal(rec.type, "html");
    assert.equal(fakeS3._store.get("pages/versions/p/v1.html"), "<html>v1</html>");
    const idx = JSON.parse(fakeS3._store.get("versions.json"));
    assert.equal(idx.p.length, 1);
    assert.equal(idx.p[0].n, 1);
  });

  test("increments version numbers monotonically", async () => {
    await versions.snapshotCurrent("p", "v1", "html");
    await versions.snapshotCurrent("p", "v2", "html");
    const rec = await versions.snapshotCurrent("p", "v3", "html");
    assert.equal(rec.n, 3);
    const idx = JSON.parse(fakeS3._store.get("versions.json"));
    assert.deepEqual(idx.p.map((v) => v.n), [1, 2, 3]);
  });

  test("prunes oldest when exceeding MAX_VERSIONS", async () => {
    for (let i = 1; i <= versions.MAX_VERSIONS + 2; i++) {
      await versions.snapshotCurrent("p", "content-" + i, "html");
    }
    const idx = JSON.parse(fakeS3._store.get("versions.json"));
    assert.equal(idx.p.length, versions.MAX_VERSIONS);
    // First two snapshots should be gone, latest = MAX+2
    assert.equal(idx.p[0].n, 3);
    assert.equal(idx.p[idx.p.length - 1].n, versions.MAX_VERSIONS + 2);
    assert.equal(fakeS3._store.has("pages/versions/p/v1.html"), false);
    assert.equal(fakeS3._store.has("pages/versions/p/v2.html"), false);
    assert.equal(fakeS3._store.has(`pages/versions/p/v${versions.MAX_VERSIONS + 2}.html`), true);
  });

  test("returns null and writes nothing for empty content", async () => {
    const rec = await versions.snapshotCurrent("p", "", "html");
    assert.equal(rec, null);
    assert.equal(fakeS3._store.size, 0);
  });

  test("isolates version numbering per slug", async () => {
    await versions.snapshotCurrent("a", "x", "html");
    await versions.snapshotCurrent("b", "y", "html");
    await versions.snapshotCurrent("a", "x2", "html");
    const idx = JSON.parse(fakeS3._store.get("versions.json"));
    assert.deepEqual(idx.a.map((v) => v.n), [1, 2]);
    assert.deepEqual(idx.b.map((v) => v.n), [1]);
  });
});

// ── listVersions ───────────────────────────────────────────────────────────

describe("listVersions", () => {
  test("returns empty array for unknown slug", async () => {
    assert.deepEqual(await versions.listVersions("nope"), []);
  });

  test("returns newest first", async () => {
    await versions.snapshotCurrent("p", "a", "html");
    await versions.snapshotCurrent("p", "b", "html");
    await versions.snapshotCurrent("p", "c", "html");
    const list = await versions.listVersions("p");
    assert.deepEqual(list.map((v) => v.n), [3, 2, 1]);
  });
});

// ── getVersionContent ──────────────────────────────────────────────────────

describe("getVersionContent", () => {
  test("returns content for an existing snapshot", async () => {
    await versions.snapshotCurrent("p", "<html>v1</html>", "html");
    assert.equal(await versions.getVersionContent("p", 1), "<html>v1</html>");
  });
  test("returns null for missing snapshot", async () => {
    assert.equal(await versions.getVersionContent("p", 99), null);
  });
});

// ── deleteAllForSlug ───────────────────────────────────────────────────────

describe("deleteAllForSlug", () => {
  test("removes all snapshots and the index entry", async () => {
    await versions.snapshotCurrent("p", "a", "html");
    await versions.snapshotCurrent("p", "b", "html");
    await versions.snapshotCurrent("other", "x", "html");
    await versions.deleteAllForSlug("p");
    assert.equal(fakeS3._store.has("pages/versions/p/v1.html"), false);
    assert.equal(fakeS3._store.has("pages/versions/p/v2.html"), false);
    assert.equal(fakeS3._store.has("pages/versions/other/v1.html"), true);
    const idx = JSON.parse(fakeS3._store.get("versions.json"));
    assert.equal(idx.p, undefined);
    assert.ok(idx.other);
  });

  test("is a no-op for an unknown slug", async () => {
    await versions.deleteAllForSlug("nope");
    // versions.json should be initialised but empty
    const idx = JSON.parse(fakeS3._store.get("versions.json") || "{}");
    assert.deepEqual(idx, {});
  });
});

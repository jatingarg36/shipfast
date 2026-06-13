/**
 * Unit tests for services/versions.js
 *
 * Uses Node 18+ built-in test runner. Run: node --test tests/versions.test.js
 *
 * Strategy: stub both services/s3.js and services/pg.js via require.cache so
 * the versions service exercises real SQL/key-management logic against an
 * in-memory pool + an in-memory S3, with no external dependencies.
 */

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

// Minimal env so config.js validation passes
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-secret";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.S3_BUCKET = process.env.S3_BUCKET || "test-bucket";
// Enable versioning code path (pg.isEnabled() reads config.DATABASE_URL)
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://test/test";

// ── Fake S3 ────────────────────────────────────────────────────────────────
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
      return [...store.keys()].filter((k) => k.startsWith(prefix))
        .map((k) => ({ Key: k, LastModified: new Date(), Size: store.get(k).length }));
    },
  };
})();
require.cache[s3Path] = { id: s3Path, filename: s3Path, loaded: true, exports: fakeS3 };

// ── Fake pg ────────────────────────────────────────────────────────────────
// We hand-roll a minimal SQL dispatcher: each call inspects the SQL text and
// param array, then mutates an in-memory rows array. This is tight to the
// queries in services/versions.js — if those queries change, update here too.
const pgPath = require.resolve(path.join(__dirname, "..", "services", "pg.js"));
const fakePg = (() => {
  /** @type {{id:number,slug:string,version_n:number,s3_key:string,label:string,content_type:string,created_at:Date}[]} */
  let rows = [];
  let nextId = 1;
  let enabled = true;

  function query(sql, params = []) {
    const text = sql.replace(/\s+/g, " ").trim();

    if (/^CREATE TABLE/i.test(text)) return Promise.resolve({ rows: [] });

    // MAX(version_n) for next-version computation
    if (/SELECT COALESCE\(MAX\(version_n\), 0\) AS max_n FROM page_versions WHERE slug = \$1/i.test(text)) {
      const slug = params[0];
      const max = rows.filter((r) => r.slug === slug).reduce((m, r) => Math.max(m, r.version_n), 0);
      return Promise.resolve({ rows: [{ max_n: max }] });
    }

    // INSERT a new version row
    if (/^INSERT INTO page_versions/i.test(text)) {
      const [slug, version_n, s3_key, label, content_type] = params;
      if (rows.some((r) => r.slug === slug && r.version_n === version_n)) {
        const err = new Error("duplicate key");
        err.code = "23505";
        return Promise.reject(err);
      }
      const row = {
        id: nextId++,
        slug,
        version_n,
        s3_key,
        label,
        content_type,
        created_at: new Date(),
      };
      rows.push(row);
      return Promise.resolve({ rows: [row] });
    }

    // SELECT version_n, s3_key for prune (newest-first, skip MAX_VERSIONS, delete rest)
    if (/SELECT version_n, s3_key FROM page_versions WHERE slug = \$1 ORDER BY version_n DESC OFFSET \$2/i.test(text)) {
      const [slug, offset] = params;
      const sorted = rows.filter((r) => r.slug === slug).sort((a, b) => b.version_n - a.version_n);
      return Promise.resolve({ rows: sorted.slice(offset).map((r) => ({ version_n: r.version_n, s3_key: r.s3_key })) });
    }

    // DELETE rows from prune
    if (/^DELETE FROM page_versions WHERE slug = \$1 AND version_n = ANY/i.test(text)) {
      const [slug, ns] = params;
      const setNs = new Set(ns);
      rows = rows.filter((r) => !(r.slug === slug && setNs.has(r.version_n)));
      return Promise.resolve({ rows: [] });
    }

    // listVersions — newest first
    if (/SELECT version_n, s3_key, label, content_type, created_at FROM page_versions WHERE slug = \$1 ORDER BY version_n DESC/i.test(text)) {
      const [slug] = params;
      const sorted = rows.filter((r) => r.slug === slug).sort((a, b) => b.version_n - a.version_n);
      return Promise.resolve({ rows: sorted.map((r) => ({ ...r })) });
    }

    // getVersionContent — single row lookup
    if (/SELECT s3_key FROM page_versions WHERE slug = \$1 AND version_n = \$2/i.test(text)) {
      const [slug, n] = params;
      const r = rows.find((x) => x.slug === slug && x.version_n === n);
      return Promise.resolve({ rows: r ? [{ s3_key: r.s3_key }] : [] });
    }

    // deleteAllForSlug
    if (/^DELETE FROM page_versions WHERE slug = \$1 RETURNING s3_key/i.test(text)) {
      const [slug] = params;
      const kept = [];
      const deleted = [];
      for (const r of rows) (r.slug === slug ? deleted : kept).push(r);
      rows = kept;
      return Promise.resolve({ rows: deleted.map((d) => ({ s3_key: d.s3_key })) });
    }

    return Promise.reject(new Error("Unhandled SQL in fake pg: " + text));
  }

  return {
    _rows: () => rows,
    reset() {
      rows = [];
      nextId = 1;
      enabled = true;
    },
    setEnabled(v) { enabled = v; },
    isEnabled: () => enabled,
    getPool: () => ({ query }),
    _reset: () => {},
  };
})();
require.cache[pgPath] = { id: pgPath, filename: pgPath, loaded: true, exports: fakePg };

const versions = require("../services/versions");

beforeEach(() => {
  fakeS3.reset();
  fakePg.reset();
  // Reset the cached schemaReady promise so each test starts fresh.
  // Internal — but worth it to keep tests independent.
  // versions.ensureSchema is idempotent, so re-calling is safe.
});

// ── cleanLabel ─────────────────────────────────────────────────────────────

describe("cleanLabel", () => {
  test("trims whitespace", () => assert.equal(versions.cleanLabel("  hello  "), "hello"));
  test("non-string → empty", () => {
    assert.equal(versions.cleanLabel(undefined), "");
    assert.equal(versions.cleanLabel(null), "");
    assert.equal(versions.cleanLabel(42), "");
  });
  test("caps at MAX_LABEL_LEN", () => {
    const long = "x".repeat(versions.MAX_LABEL_LEN + 50);
    assert.equal(versions.cleanLabel(long).length, versions.MAX_LABEL_LEN);
  });
});

// ── snapshotKey ────────────────────────────────────────────────────────────

describe("snapshotKey", () => {
  test("layout: pages/versions/{slug}/v{n}.html", () => {
    assert.equal(versions.snapshotKey("my-page", 3), "pages/versions/my-page/v3.html");
  });
});

// ── snapshotCurrent ────────────────────────────────────────────────────────

describe("snapshotCurrent", () => {
  test("first version is n=1, writes S3 and Postgres row", async () => {
    const rec = await versions.snapshotCurrent("p", "<html>v1</html>", "html", "first");
    assert.equal(rec.n, 1);
    assert.equal(rec.label, "first");
    assert.equal(rec.type, "html");
    assert.equal(fakeS3._store.get("pages/versions/p/v1.html"), "<html>v1</html>");
    assert.equal(fakePg._rows().length, 1);
    assert.equal(fakePg._rows()[0].version_n, 1);
  });

  test("version numbers increment monotonically", async () => {
    await versions.snapshotCurrent("p", "v1", "html");
    await versions.snapshotCurrent("p", "v2", "html");
    const rec = await versions.snapshotCurrent("p", "v3", "html");
    assert.equal(rec.n, 3);
    assert.deepEqual(
      fakePg._rows().filter((r) => r.slug === "p").map((r) => r.version_n).sort((a, b) => a - b),
      [1, 2, 3]
    );
  });

  test("prunes oldest beyond MAX_VERSIONS (rows + S3)", async () => {
    for (let i = 1; i <= versions.MAX_VERSIONS + 2; i++) {
      await versions.snapshotCurrent("p", "content-" + i, "html");
    }
    const remaining = fakePg._rows().filter((r) => r.slug === "p").map((r) => r.version_n).sort((a, b) => a - b);
    assert.equal(remaining.length, versions.MAX_VERSIONS);
    assert.equal(remaining[0], 3);
    assert.equal(remaining[remaining.length - 1], versions.MAX_VERSIONS + 2);
    assert.equal(fakeS3._store.has("pages/versions/p/v1.html"), false);
    assert.equal(fakeS3._store.has("pages/versions/p/v2.html"), false);
    assert.equal(fakeS3._store.has(`pages/versions/p/v${versions.MAX_VERSIONS + 2}.html`), true);
  });

  test("empty/null content is a no-op", async () => {
    assert.equal(await versions.snapshotCurrent("p", "", "html"), null);
    assert.equal(await versions.snapshotCurrent("p", null, "html"), null);
    assert.equal(fakePg._rows().length, 0);
    assert.equal(fakeS3._store.size, 0);
  });

  test("version numbering is isolated per slug", async () => {
    await versions.snapshotCurrent("a", "x", "html");
    await versions.snapshotCurrent("b", "y", "html");
    await versions.snapshotCurrent("a", "x2", "html");
    const aNs = fakePg._rows().filter((r) => r.slug === "a").map((r) => r.version_n).sort();
    const bNs = fakePg._rows().filter((r) => r.slug === "b").map((r) => r.version_n).sort();
    assert.deepEqual(aNs, [1, 2]);
    assert.deepEqual(bNs, [1]);
  });
});

// ── listVersions ───────────────────────────────────────────────────────────

describe("listVersions", () => {
  test("returns [] for unknown slug", async () => {
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
  test("removes all rows + S3 objects for the slug, leaves others", async () => {
    await versions.snapshotCurrent("p", "a", "html");
    await versions.snapshotCurrent("p", "b", "html");
    await versions.snapshotCurrent("other", "x", "html");
    await versions.deleteAllForSlug("p");
    assert.equal(fakeS3._store.has("pages/versions/p/v1.html"), false);
    assert.equal(fakeS3._store.has("pages/versions/p/v2.html"), false);
    assert.equal(fakeS3._store.has("pages/versions/other/v1.html"), true);
    assert.equal(fakePg._rows().some((r) => r.slug === "p"), false);
    assert.equal(fakePg._rows().some((r) => r.slug === "other"), true);
  });

  test("no-op for an unknown slug", async () => {
    await versions.deleteAllForSlug("nope");
    assert.equal(fakePg._rows().length, 0);
  });
});

// ── disabled mode (no DATABASE_URL) ────────────────────────────────────────

describe("disabled mode", () => {
  test("snapshotCurrent / list / get / delete all no-op when pg is disabled", async () => {
    fakePg.setEnabled(false);
    try {
      assert.equal(await versions.snapshotCurrent("p", "x", "html"), null);
      assert.deepEqual(await versions.listVersions("p"), []);
      assert.equal(await versions.getVersionContent("p", 1), null);
      await versions.deleteAllForSlug("p"); // must not throw
      assert.equal(fakePg._rows().length, 0);
      assert.equal(fakeS3._store.size, 0);
    } finally {
      fakePg.setEnabled(true);
    }
  });
});

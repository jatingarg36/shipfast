/**
 * Unit tests for services/tags.js and the tag helpers in services/page.js
 * Uses Node 18+ built-in test runner (no external deps needed)
 * Run: node --test tests/tags.test.js
 */

const { test, describe } = require("node:test");
const assert = require("node:assert/strict");

const { validateTags, countTags, MAX_TAGS } = require("../services/tags");
const { filterPagesByTags, visiblePages } = require("../services/page");

// ── validateTags: happy paths ───────────────────────────────────────────────

describe("validateTags — valid input", () => {
  test("accepts an empty array (clears tags)", () => {
    assert.deepEqual(validateTags([]), { ok: true, tags: [] });
  });

  test("accepts a single PascalCase tag", () => {
    assert.deepEqual(validateTags(["Productivity"]), {
      ok: true,
      tags: ["Productivity"],
    });
  });

  test("accepts the maximum of 3 tags", () => {
    const tags = ["LeetCode", "Algorithms", "Interview"];
    assert.deepEqual(validateTags(tags), { ok: true, tags });
  });

  test("trims surrounding whitespace before validating", () => {
    assert.deepEqual(validateTags(["  MachineLearning  "]), {
      ok: true,
      tags: ["MachineLearning"],
    });
  });

  test("allows digits after the leading uppercase letter", () => {
    assert.deepEqual(validateTags(["Web3", "Es2024"]), {
      ok: true,
      tags: ["Web3", "Es2024"],
    });
  });

  test("treats case-different tags as distinct (case-sensitive storage)", () => {
    assert.deepEqual(validateTags(["Ml", "MachineLearning"]), {
      ok: true,
      tags: ["Ml", "MachineLearning"],
    });
  });
});

// ── validateTags: rejections ────────────────────────────────────────────────

describe("validateTags — rejections", () => {
  test("rejects a non-array input", () => {
    const r = validateTags("Productivity");
    assert.equal(r.ok, false);
    assert.equal(r.error.error, "INVALID_TAG");
  });

  test("rejects more than 3 tags", () => {
    const r = validateTags(["A", "B", "C", "D"]);
    assert.equal(r.ok, false);
    assert.match(r.error.reason, new RegExp(String(MAX_TAGS)));
  });

  test("rejects a hyphenated tag", () => {
    const r = validateTags(["machine-learning"]);
    assert.equal(r.ok, false);
    assert.equal(r.error.tag, "machine-learning");
    assert.match(r.error.reason, /PascalCase/);
  });

  test("rejects a tag with a space", () => {
    const r = validateTags(["Machine Learning"]);
    assert.equal(r.ok, false);
  });

  test("rejects a lowercase-leading tag", () => {
    const r = validateTags(["productivity"]);
    assert.equal(r.ok, false);
  });

  test("rejects a whitespace-only tag (empty after trim)", () => {
    const r = validateTags(["   "]);
    assert.equal(r.ok, false);
  });

  test("rejects a tag longer than 30 chars", () => {
    const r = validateTags(["A" + "b".repeat(30)]); // 31 chars
    assert.equal(r.ok, false);
  });

  test("rejects unicode letters (ASCII only)", () => {
    const r = validateTags(["Café"]);
    assert.equal(r.ok, false);
  });

  test("rejects a non-string entry", () => {
    const r = validateTags([123]);
    assert.equal(r.ok, false);
  });

  test("rejects case-sensitive duplicates", () => {
    const r = validateTags(["Productivity", "Productivity"]);
    assert.equal(r.ok, false);
    assert.match(r.error.reason, /[Dd]uplicate/);
  });

  test("rejects reserved tags case-insensitively", () => {
    // Must be PascalCase-valid to reach the reserved check (format runs first).
    for (const t of ["Admin", "System", "Internal", "INTERNAL"]) {
      const r = validateTags([t]);
      assert.equal(r.ok, false, `expected ${t} to be rejected`);
      assert.match(r.error.reason, /reserved/i);
    }
  });
});

// ── filterPagesByTags ───────────────────────────────────────────────────────

describe("filterPagesByTags", () => {
  const pages = [
    { slug: "a", tags: ["LeetCode", "Algorithms"] },
    { slug: "b", tags: ["LeetCode", "Interview"] },
    { slug: "c", tags: ["Cooking"] },
    { slug: "d" }, // no tags field
  ];

  test("returns all pages when no tags requested", () => {
    assert.equal(filterPagesByTags(pages, []).length, 4);
  });

  test("filters to pages containing the tag (case-insensitive)", () => {
    const r = filterPagesByTags(pages, ["leetcode"]);
    assert.deepEqual(r.map((p) => p.slug), ["a", "b"]);
  });

  test("AND-s multiple tags", () => {
    const r = filterPagesByTags(pages, ["LeetCode", "Interview"]);
    assert.deepEqual(r.map((p) => p.slug), ["b"]);
  });

  test("returns empty when no page matches", () => {
    assert.deepEqual(filterPagesByTags(pages, ["Nonexistent"]), []);
  });

  test("accepts a single string as well as an array", () => {
    const r = filterPagesByTags(pages, "Cooking");
    assert.deepEqual(r.map((p) => p.slug), ["c"]);
  });
});

// ── countTags (ordering fallback) ───────────────────────────────────────────

describe("countTags", () => {
  test("returns empty for no pages", () => {
    assert.deepEqual(countTags([]), []);
  });

  test("orders by document count desc, then name asc", () => {
    const pages = [
      { tags: ["LeetCode", "Algorithms"] },
      { tags: ["LeetCode"] },
      { tags: ["LeetCode", "Cooking"] },
      { tags: ["Algorithms"] },
    ];
    assert.deepEqual(countTags(pages), [
      { name: "LeetCode", count: 3 },
      { name: "Algorithms", count: 2 },
      { name: "Cooking", count: 1 },
    ]);
  });

  test("counts case-insensitively, keeps first-seen casing", () => {
    const pages = [{ tags: ["MachineLearning"] }, { tags: ["machinelearning"] }];
    assert.deepEqual(countTags(pages), [{ name: "MachineLearning", count: 2 }]);
  });

  test("ignores pages without a tags field", () => {
    assert.deepEqual(countTags([{}, { tags: ["X"] }]), [{ name: "X", count: 1 }]);
  });
});

// ── visiblePages + scoped tag counts (access separation) ────────────────────

describe("visiblePages / scoped tag counts", () => {
  const pages = [
    { slug: "pub-a", access: "public", owner: "alice", tags: ["Shared", "Open"] },
    { slug: "pub-b", access: "public", owner: "bob", tags: ["Shared"] },
    { slug: "alice-priv", access: "publisher", owner: "alice", tags: ["Shared", "Secret"] },
    { slug: "bob-priv", access: "publisher", owner: "bob", tags: ["Shared", "BobOnly"] },
  ];

  test("anonymous sees only public pages", () => {
    const v = visiblePages(pages, null);
    assert.deepEqual(v.map((p) => p.slug), ["pub-a", "pub-b"]);
  });

  test("anonymous tag counts exclude publisher-gated pages", () => {
    const counts = countTags(visiblePages(pages, null));
    // Shared appears on 2 public pages only (not the two private ones).
    assert.deepEqual(counts, [
      { name: "Shared", count: 2 },
      { name: "Open", count: 1 },
    ]);
    // Publisher-only tags never leak to the public view.
    assert.equal(counts.find((c) => c.name === "Secret"), undefined);
    assert.equal(counts.find((c) => c.name === "BobOnly"), undefined);
  });

  test("a publisher sees public + their own pages (not others' private)", () => {
    const v = visiblePages(pages, { id: "alice", role: "publisher" });
    assert.deepEqual(v.map((p) => p.slug).sort(), ["alice-priv", "pub-a", "pub-b"]);
  });

  test("publisher tag counts = public + own, deduped, excluding others' private", () => {
    const counts = countTags(visiblePages(pages, { id: "alice", role: "publisher" }));
    const get = (n) => (counts.find((c) => c.name === n) || {}).count;
    assert.equal(get("Shared"), 3); // 2 public + alice's private (bob's private excluded)
    assert.equal(get("Secret"), 1); // alice's own private
    assert.equal(get("Open"), 1);
    assert.equal(get("BobOnly"), undefined); // bob's private — not visible to alice
  });

  test("an admin sees every page", () => {
    const v = visiblePages(pages, { id: "root", role: "admin" });
    assert.equal(v.length, 4);
    assert.equal(countTags(v).find((c) => c.name === "Shared").count, 4);
  });
});

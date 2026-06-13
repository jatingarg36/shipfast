/**
 * TagsService - Validation and policy for page tags
 * Single Responsibility: Own the tag format rules so every write path shares them.
 *
 * Kept separate from page.js so a richer policy (e.g. per-tenant tag rules)
 * can be swapped in later without touching metadata storage.
 */

// PascalCase: starts with an uppercase letter, then letters/digits only.
// 1–30 chars total. No spaces, hyphens, or underscores. ASCII only.
const PASCAL_CASE_RE = /^[A-Z][A-Za-z0-9]{0,29}$/;

const MAX_TAGS = 3;

// Reserved tags collide with system labels — rejected case-insensitively.
const RESERVED_TAGS = ["admin", "system", "internal"];

const REASON_FORMAT =
  "Tags must be PascalCase: start with an uppercase letter and contain only letters and digits.";
const REASON_RESERVED = "Tag is reserved.";

/**
 * Build a structured validation error.
 * @param {string} tag - The offending tag (or empty string).
 * @param {string} reason - Human-readable rule that was broken.
 * @returns {{ ok: false, error: { error: string, tag: string, reason: string } }}
 */
function fail(tag, reason) {
  return { ok: false, error: { error: "INVALID_TAG", tag, reason } };
}

/**
 * Validate and normalize a list of tags.
 *
 * Rules:
 *  1. Input must be an array.
 *  2. At most 3 entries.
 *  3. Each entry must be a string matching PascalCase (after trimming).
 *  4. Reject reserved tags (case-insensitive).
 *  5. Reject case-sensitive duplicates (predictable behavior over silent dedup).
 *
 * @param {*} input - Candidate tag list.
 * @returns {{ ok: true, tags: string[] } | { ok: false, error: object }}
 */
function validateTags(input) {
  if (!Array.isArray(input)) {
    return fail("", "Tags must be provided as an array.");
  }
  if (input.length > MAX_TAGS) {
    return fail("", `A page can have at most ${MAX_TAGS} tags.`);
  }

  const seen = new Set();
  const tags = [];

  for (const raw of input) {
    if (typeof raw !== "string") {
      return fail(String(raw), REASON_FORMAT);
    }
    const tag = raw.trim();
    if (!PASCAL_CASE_RE.test(tag)) {
      return fail(raw, REASON_FORMAT);
    }
    if (RESERVED_TAGS.includes(tag.toLowerCase())) {
      return fail(tag, REASON_RESERVED);
    }
    if (seen.has(tag)) {
      return fail(tag, "Duplicate tag.");
    }
    seen.add(tag);
    tags.push(tag);
  }

  return { ok: true, tags };
}

/**
 * Derive tag counts from a list of pages, ordered by document count (desc),
 * then name (asc). Used as the fallback for ordering when the DB-backed tag
 * index is not configured. Matching is case-insensitive; the first-seen
 * display casing wins.
 *
 * @param {Array<{ tags?: string[] }>} pages
 * @returns {Array<{ name: string, count: number }>}
 */
function countTags(pages) {
  const byKey = new Map(); // lower(name) -> { name, count }
  for (const p of pages || []) {
    for (const raw of p.tags || []) {
      const key = String(raw).toLowerCase();
      const entry = byKey.get(key);
      if (entry) entry.count += 1;
      else byKey.set(key, { name: raw, count: 1 });
    }
  }
  return Array.from(byKey.values()).sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name)
  );
}

module.exports = {
  validateTags,
  countTags,
  PASCAL_CASE_RE,
  MAX_TAGS,
  RESERVED_TAGS,
};

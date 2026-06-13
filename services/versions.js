const s3Service = require("./s3");

/**
 * VersionsService - Handles per-page version history (snapshots + restore)
 * Single Responsibility: Snapshot prior content on re-publish, retain up to
 * MAX_VERSIONS history, and support rolling back to a snapshot.
 *
 * Storage layout (S3):
 *   versions.json                          ← { slug: [ {n, key, createdAt, label, type}, ... ] }
 *   pages/versions/{slug}/v{n}.html        ← historical snapshots
 *
 * `pages/{slug}.html` remains the single live key served by routes/pages.js,
 * so version history is additive — page serving is unchanged.
 */

const VERSIONS_META_KEY = "versions.json";
const MAX_VERSIONS = 5;
const MAX_LABEL_LEN = 80;

/** Build the S3 key for a snapshot at version n */
function snapshotKey(slug, n) {
  return `pages/versions/${slug}/v${n}.html`;
}

/** Read the global versions index from S3 */
async function readIndex() {
  const txt = await s3Service.getText(VERSIONS_META_KEY);
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

/** Write the global versions index to S3 */
async function writeIndex(idx) {
  await s3Service.putText(VERSIONS_META_KEY, JSON.stringify(idx, null, 2));
}

/** Sanitize a user-supplied version label */
function cleanLabel(label) {
  if (typeof label !== "string") return "";
  const trimmed = label.trim();
  return trimmed.length > MAX_LABEL_LEN
    ? trimmed.slice(0, MAX_LABEL_LEN)
    : trimmed;
}

/**
 * List versions for a slug (newest first)
 * @param {string} slug
 * @returns {Promise<Array<{n,key,createdAt,label,type}>>}
 */
async function listVersions(slug) {
  const idx = await readIndex();
  const arr = idx[slug] || [];
  return [...arr].sort((a, b) => b.n - a.n);
}

/**
 * Get content for a single version
 * @param {string} slug
 * @param {number} n - version number
 * @returns {Promise<string|null>}
 */
async function getVersionContent(slug, n) {
  return s3Service.getText(snapshotKey(slug, n));
}

/**
 * Snapshot the current live content for a slug as the next version, then
 * prune any versions beyond MAX_VERSIONS (oldest first). Returns the created
 * version record, or null if there was no live content to snapshot.
 *
 * @param {string} slug
 * @param {string} currentContent - the about-to-be-overwritten live HTML
 * @param {string} [type] - content type tag (html/jsx/md)
 * @param {string} [label] - optional user label
 * @returns {Promise<Object|null>}
 */
async function snapshotCurrent(slug, currentContent, type, label) {
  if (currentContent == null || currentContent === "") return null;

  const idx = await readIndex();
  const list = idx[slug] || [];
  const nextN = list.length === 0 ? 1 : Math.max(...list.map((v) => v.n)) + 1;
  const key = snapshotKey(slug, nextN);

  await s3Service.putText(key, currentContent);

  const record = {
    n: nextN,
    key,
    createdAt: new Date().toISOString(),
    label: cleanLabel(label),
    type: type || "html",
  };
  list.push(record);

  // Prune oldest if we exceeded the retention limit
  const sortedAsc = [...list].sort((a, b) => a.n - b.n);
  while (sortedAsc.length > MAX_VERSIONS) {
    const oldest = sortedAsc.shift();
    try {
      await s3Service.deleteObject(oldest.key);
    } catch (err) {
      console.error("versions.snapshotCurrent prune error:", err);
    }
  }

  idx[slug] = sortedAsc;
  await writeIndex(idx);
  return record;
}

/**
 * Delete all version history for a slug (snapshot files + index entry).
 * Called when the underlying page is deleted.
 * @param {string} slug
 */
async function deleteAllForSlug(slug) {
  const idx = await readIndex();
  const list = idx[slug] || [];
  for (const v of list) {
    try {
      await s3Service.deleteObject(v.key);
    } catch (err) {
      console.error("versions.deleteAllForSlug error:", err);
    }
  }
  delete idx[slug];
  await writeIndex(idx);
}

module.exports = {
  MAX_VERSIONS,
  MAX_LABEL_LEN,
  snapshotKey,
  readIndex,
  writeIndex,
  cleanLabel,
  listVersions,
  getVersionContent,
  snapshotCurrent,
  deleteAllForSlug,
};

const s3Service = require("./s3");
const userService = require("./user");
const tagsService = require("./tags");

/**
 * PageService - Handles page metadata operations
 * Single Responsibility: Manage page metadata and access control
 */

const META_KEY = "meta.json";

/**
 * Read all page metadata from S3
 * @returns {Promise<Object>} - Metadata object indexed by slug
 */
async function readMeta() {
  const txt = await s3Service.getText(META_KEY);
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

/**
 * Write page metadata to S3
 * @param {Object} obj - Metadata object to store
 */
async function writeMeta(obj) {
  const txt = JSON.stringify(obj, null, 2);
  await s3Service.putText(META_KEY, txt);
}

/**
 * Get metadata for a specific page
 * @param {string} slug - Page slug
 * @returns {Promise<Object>} - Page metadata with access and owner
 */
async function getPageMeta(slug) {
  const meta = await readMeta();
  const entry = meta[slug];
  if (!entry) return { access: "publisher", owner: "admin" };
  if (typeof entry === "string") return { access: entry, owner: "admin" };
  return entry;
}

/**
 * Update metadata for a specific page
 * @param {string} slug - Page slug
 * @param {Object} updates - Partial metadata to merge
 */
async function setPageMeta(slug, updates) {
  const meta = await readMeta();
  const existing = meta[slug];
  const prev = !existing
    ? { access: "publisher", owner: "admin" }
    : typeof existing === "string"
    ? { access: existing, owner: "admin" }
    : existing;
  meta[slug] = { ...prev, ...updates };
  await writeMeta(meta);
}

/**
 * Delete metadata for a specific page
 * @param {string} slug - Page slug
 */
async function deletePageMeta(slug) {
  const meta = await readMeta();
  delete meta[slug];
  await writeMeta(meta);
}

/**
 * Get access level for a page
 * @param {string} slug - Page slug
 * @returns {Promise<string>} - Access level ("public" or "publisher")
 */
async function getAccess(slug) {
  const pm = await getPageMeta(slug);
  return pm.access || "publisher";
}

/**
 * List all pages with metadata
 * @returns {Promise<Array>} - Array of pages sorted by most recent first
 */
async function listPages() {
  const meta = await readMeta();
  const users = await userService.readUsers();
  const pages = [];

  for (const [slug, pm] of Object.entries(meta)) {
    if (typeof pm === "string") continue; // Skip legacy unmigrated data
    const ownerName =
      pm.owner === "admin"
        ? "Admin"
        : (users[pm.owner] && users[pm.owner].displayName) || pm.owner || "admin";

    pages.push({
      slug,
      title: pm.title || slug,
      description: pm.description || "",
      type: pm.type || "html",
      access: pm.access || "publisher",
      owner: pm.owner || "admin",
      ownerName: ownerName,
      updated: pm.updated || pm.createdAt || new Date(0).toISOString(),
      tags: Array.isArray(pm.tags) ? pm.tags : [],
    });
  }
  return pages.sort((a, b) => new Date(b.updated) - new Date(a.updated));
}

/**
 * Replace the tag list for a page. Validates first, then merges into metadata.
 * @param {string} slug - Page slug
 * @param {*} tags - Candidate tag list (validated via tagsService)
 * @returns {Promise<{ ok: true, tags: string[] } | { ok: false, error: object }>}
 */
async function setPageTags(slug, tags) {
  const result = tagsService.validateTags(tags);
  if (!result.ok) return result;
  await setPageMeta(slug, { tags: result.tags });
  return { ok: true, tags: result.tags };
}

/**
 * Filter a page list to those a user may see, the single rule used for both the
 * page list and the tag rail so they never disagree:
 *   - Anonymous → public pages only
 *   - Admin     → every page
 *   - Publisher → public pages + their own pages
 *
 * @param {Array} pages
 * @param {{ role?: string, id?: string }|null} user
 * @returns {Array}
 */
function visiblePages(pages, user) {
  if (!user) return pages.filter((p) => p.access === "public");
  if (user.role === "admin") return pages;
  return pages.filter((p) => p.access === "public" || p.owner === user.id);
}

/**
 * Filter a list of pages to those containing ALL of the given tags.
 * Matching is case-insensitive; multiple tags are AND-ed.
 * @param {Array} pages - Pages (each with a `tags` array)
 * @param {string[]} tags - Tags to require
 * @returns {Array} - Filtered pages
 */
function filterPagesByTags(pages, tags) {
  const wanted = (Array.isArray(tags) ? tags : [tags])
    .filter(Boolean)
    .map((t) => String(t).toLowerCase());
  if (!wanted.length) return pages;
  return pages.filter((p) => {
    const have = (p.tags || []).map((t) => t.toLowerCase());
    return wanted.every((w) => have.includes(w));
  });
}

module.exports = {
  readMeta,
  writeMeta,
  getPageMeta,
  setPageMeta,
  deletePageMeta,
  getAccess,
  listPages,
  setPageTags,
  filterPagesByTags,
  visiblePages,
};

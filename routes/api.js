const express = require("express");
const s3Service = require("../services/s3");
const pageService = require("../services/page");
const contentService = require("../services/content");
const authMiddleware = require("../middleware/auth");
const viewsService = require("../services/views");
const versionsService = require("../services/versions");
const tagsService = require("../services/tags");
const tagsStore = require("../services/tags-store");

/**
 * API Routes
 * Single Responsibility: Handle all /api/pages endpoints for page management
 */

const router = express.Router();

/**
 * GET /api/pages
 * List pages filtered by access level for current user
 * - Admin: all pages
 * - Publisher: own + public pages
 * - Anon: public pages only
 * Response includes a `views` field per page (batch Redis MGET)
 * Optional `?tag=Foo` (repeatable) filters to pages with ALL given tags
 * (case-insensitive AND match).
 */
router.get("/pages", async (req, res) => {
  const pages = await pageService.listPages();
  const user = authMiddleware.getCurrentUser(req);
  let filtered = pageService.visiblePages(pages, user);

  // Optional tag filter — ?tag=Foo or ?tag=Foo&tag=Bar (AND-ed)
  if (req.query.tag) {
    const tagParams = Array.isArray(req.query.tag)
      ? req.query.tag
      : [req.query.tag];
    filtered = pageService.filterPagesByTags(filtered, tagParams);
  }

  // Attach view counts (single batch call)
  const redisClient = req.app.locals.redisClient;
  const slugs = filtered.map((p) => p.slug);
  const viewCounts = await viewsService.getViewCounts(redisClient, slugs);
  const result = filtered.map((p) => ({ ...p, views: viewCounts[p.slug] || 0 }));

  res.json(result);
});

/**
 * GET /api/tags
 * List tags ordered by document count (desc), name as tiebreak — for the
 * dashboard grouping rail. Counts mirror page visibility so the rail always
 * agrees with the page list:
 *   - Anonymous → public pages only (served from DB public_count).
 *   - Admin     → every page (served from DB total).
 *   - Publisher → public pages + their own — derived from the visible page
 *                 list, since per-owner counts aren't materialized in the DB.
 * Falls back to deriving from the visible page list when the DB is off.
 * Response: [{ name, count }]
 */
router.get("/tags", async (req, res) => {
  const user = authMiddleware.getCurrentUser(req);
  // Fast paths backed by DB counts, but only where the DB count is exactly the
  // viewer's scope: public-only for anon, the full total for admin. A regular
  // publisher's scope is public + own (needs ownership), so it derives below.
  if (tagsStore.isEnabled()) {
    try {
      if (!user) return res.json(await tagsStore.listTagsByCount("public"));
      if (user.role === "admin")
        return res.json(await tagsStore.listTagsByCount("all"));
    } catch (err) {
      console.error("tags-store.listTagsByCount failed, deriving:", err);
    }
  }
  const pages = await pageService.listPages();
  res.json(tagsService.countTags(pageService.visiblePages(pages, user)));
});

/**
 * GET /api/views/:slug
 * Return the view count for a single page
 */
router.get("/views/:slug(*)", async (req, res) => {
  const redisClient = req.app.locals.redisClient;
  const count = await viewsService.getViewCount(redisClient, req.params.slug);
  res.json({ slug: req.params.slug, views: count });
});

/**
 * POST /api/pages
 * Create or update a page
 * Requires authentication
 */
router.post("/pages", authMiddleware.requireAuth, async (req, res) => {
  let { slug, html, access, versionLabel, tags } = req.body;
  if (!slug || !html)
    return res.status(400).json({ error: "slug and html are required" });

  // Validate optional tags up front so a bad tag rejects before we write content.
  let validatedTags = null;
  if (tags !== undefined) {
    const tagResult = tagsService.validateTags(tags);
    if (!tagResult.ok) return res.status(400).json(tagResult.error);
    validatedTags = tagResult.tags;
  }

  // Sanitize slug
  slug = slug
    .toLowerCase()
    .split("/")
    .map((segment) =>
      segment
        .replace(/[^a-z0-9-_]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .filter(Boolean)
    .join("/");
  if (!slug) return res.status(400).json({ error: "Invalid slug" });

  const user = authMiddleware.getCurrentUser(req);
  const existingRaw = await s3Service.getText(`pages/${slug}.html`);
  const existing = existingRaw !== null;

  if (existing && !(await authMiddleware.canManagePage(req, slug))) {
    return res
      .status(403)
      .json({ error: "This slug is owned by another user" });
  }

  // Detect type and process content
  const type = contentService.detectType(html);
  let content = html;
  let title = slug;
  let description = "";

  if (type === "jsx") {
    const titleMatch = html.match(
      /(?:document\.title\s*=\s*['"]([^'"]+)['"]|<title>([^<]+)<\/title>)/
    );
    title = titleMatch ? titleMatch[1] || titleMatch[2] : slug;
    content = contentService.wrapJsx(html, title);
  } else if (type === "md") {
    const headingMatch = html.match(/^#\s+(.+)$/m);
    title = headingMatch ? headingMatch[1].trim() : slug;
    content = await contentService.wrapMarkdown(html, title);
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    title = titleMatch ? titleMatch[1].trim() : slug;
    const metaDesc = html.match(
      /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
    );
    if (metaDesc) description = metaDesc[1].trim();
    if (!description) {
      const pMatch = html.match(/<p[^>]*>([^<]{10,})<\/p>/i);
      if (pMatch) description = pMatch[1].trim();
    }
  }

  if (description.length > 150) description = description.slice(0, 147) + "...";

  // Snapshot the previous live content as a version — but only when the
  // body actually changed. Re-saves that don't touch the content (e.g. the
  // user re-opened the edit modal just to flip the access level and hit
  // Update) would otherwise create duplicate, byte-identical history rows.
  // Failures must never block the new publish from going live.
  const contentChanged = existing && existingRaw && existingRaw !== content;
  if (contentChanged) {
    try {
      const prevMeta = await pageService.getPageMeta(slug);
      await versionsService.snapshotCurrent(
        slug,
        existingRaw,
        prevMeta.type || "html",
        versionLabel
      );
    } catch (err) {
      console.error("versions.snapshot on republish failed:", err);
    }
  }

  // Save content to S3 (skip the round-trip if it's identical)
  if (!existing || existingRaw !== content) {
    await s3Service.putText(`pages/${slug}.html`, content);
  }

  // Update metadata
  const updates = {
    title,
    description,
    type,
    updated: new Date().toISOString(),
  };
  if (access === "publisher" || access === "public") updates.access = access;
  if (validatedTags !== null) updates.tags = validatedTags;
  if (!existing) {
    updates.owner = user.id;
    updates.createdAt = new Date().toISOString();
  }
  await pageService.setPageMeta(slug, updates);

  const pm = await pageService.getPageMeta(slug);

  // Keep the DB tag index in sync (best-effort; never blocks publishing).
  // Pass the page's effective access so the tag lands in the right count bucket.
  if (validatedTags !== null) {
    try {
      await tagsStore.setTagsForPage(slug, validatedTags, pm.access);
    } catch (err) {
      console.error("tags-store.setTagsForPage on publish failed:", err);
    }
  }
  res.json({
    ok: true,
    slug,
    url: `/p/${slug}`,
    type,
    access: pm.access,
    owner: pm.owner,
    tags: Array.isArray(pm.tags) ? pm.tags : [],
  });
});

/**
 * GET /api/pages/:slug/raw
 * Get raw content for editing (owner or admin only)
 */
router.get("/pages/:slug(*)/raw", authMiddleware.requireAuth, async (req, res) => {
  const raw = await s3Service.getText(`pages/${req.params.slug}.html`);
  if (raw === null) return res.status(404).json({ error: "Not found" });
  if (!(await authMiddleware.canManagePage(req, req.params.slug))) {
    return res.status(403).json({ error: "You can only edit your own pages" });
  }

  const isJsx = raw.includes("<!-- page-type:jsx -->");
  const isMd = raw.includes("<!-- page-type:md -->");
  let source = raw;
  let type = "html";

  if (isJsx) {
    type = "jsx";
    const m = raw.match(/<script type="text\/babel">\n?([\s\S]*?)\n?const root = ReactDOM/);
    if (m) source = m[1].replace(/^const \{ .* \} = React;\n/, "");
  } else if (isMd) {
    type = "md";
    const m = raw.match(/<!-- md-source:([A-Za-z0-9+/=]+) -->/);
    if (m) source = Buffer.from(m[1], "base64").toString("utf8");
  }

  const pm = await pageService.getPageMeta(req.params.slug);
  const access = pm.access || "publisher";
  const tags = Array.isArray(pm.tags) ? pm.tags : [];
  res.json({ slug: req.params.slug, type, source, access, tags });
});

/**
 * GET /api/pages/:slug/exists
 * Check if slug exists and if user can manage it
 */
router.get("/pages/:slug(*)/exists", async (req, res) => {
  const meta = await pageService.readMeta();
  const exists = !!meta[req.params.slug];
  const result = { exists };
  if (exists && authMiddleware.getCurrentUser(req)) {
    result.canManage = await authMiddleware.canManagePage(req, req.params.slug);
  }
  res.json(result);
});

/**
 * PATCH /api/pages/:slug/access
 * Update page access level (owner or admin only)
 */
router.patch(
  "/pages/:slug(*)/access",
  authMiddleware.requirePageOwner,
  async (req, res) => {
    const { access } = req.body;
    if (access !== "public" && access !== "publisher")
      return res
        .status(400)
        .json({ error: "access must be 'public' or 'publisher'" });

    const raw = await s3Service.getText(`pages/${req.params.slug}.html`);
    if (raw === null) return res.status(404).json({ error: "Not found" });

    const before = await pageService.getPageMeta(req.params.slug);
    await pageService.setPageMeta(req.params.slug, { access });

    // Access changed → re-sync the tag index so the page's tags move to the
    // correct count bucket (public ↔ publisher). Best-effort.
    const tags = Array.isArray(before.tags) ? before.tags : [];
    if (tags.length && before.access !== access) {
      try {
        await tagsStore.setTagsForPage(req.params.slug, tags, access);
      } catch (err) {
        console.error("tags-store re-sync on access change failed:", err);
      }
    }

    res.json({ ok: true, slug: req.params.slug, access });
  }
);

/**
 * PATCH /pages/:slug/tags
 * Replace the page's tag list (owner or admin only). Idempotent.
 * Returns 400 on invalid tags, 404 if the page does not exist.
 */
router.patch(
  "/pages/:slug(*)/tags",
  authMiddleware.requirePageOwner,
  async (req, res) => {
    const raw = await s3Service.getText(`pages/${req.params.slug}.html`);
    if (raw === null) return res.status(404).json({ error: "Not found" });

    const result = await pageService.setPageTags(req.params.slug, req.body.tags);
    if (!result.ok) return res.status(400).json(result.error);

    // Keep the DB tag index in sync (best-effort), in the page's access bucket.
    try {
      const pm = await pageService.getPageMeta(req.params.slug);
      await tagsStore.setTagsForPage(req.params.slug, result.tags, pm.access);
    } catch (err) {
      console.error("tags-store.setTagsForPage on patch failed:", err);
    }

    res.json({ slug: req.params.slug, tags: result.tags });
  }
);

/**
 * DELETE /api/pages/:slug
 * Delete a page (owner or admin only). Also removes all version history.
 */
router.delete("/pages/:slug(*)", authMiddleware.requirePageOwner, async (req, res) => {
  const raw = await s3Service.getText(`pages/${req.params.slug}.html`);
  if (raw === null) return res.status(404).json({ error: "Not found" });

  await s3Service.deleteObject(`pages/${req.params.slug}.html`);
  await pageService.deletePageMeta(req.params.slug);
  try {
    await versionsService.deleteAllForSlug(req.params.slug);
  } catch (err) {
    console.error("versions.deleteAllForSlug failed:", err);
  }
  try {
    await tagsStore.removeAllForSlug(req.params.slug);
  } catch (err) {
    console.error("tags-store.removeAllForSlug failed:", err);
  }
  res.json({ ok: true });
});

/**
 * Middleware: 503 when versioning isn't configured (no DATABASE_URL).
 */
function requireVersioning(req, res, next) {
  if (!versionsService.isEnabled()) {
    return res
      .status(503)
      .json({ error: "Version history is not configured on this server" });
  }
  next();
}

/**
 * GET /api/pages/:slug/versions
 * List historical versions (owner or admin only). Newest first.
 */
router.get(
  "/pages/:slug(*)/versions",
  requireVersioning,
  authMiddleware.requirePageOwner,
  async (req, res) => {
    const versions = await versionsService.listVersions(req.params.slug);
    // Strip the internal S3 key from the client payload
    const safe = versions.map(({ n, createdAt, label, type }) => ({
      n,
      createdAt,
      label: label || "",
      type: type || "html",
    }));
    res.json({ slug: req.params.slug, versions: safe });
  }
);

/**
 * GET /api/pages/:slug/versions/:n
 * Fetch the raw snapshot content for a specific version (for preview/diff).
 * Owner or admin only.
 */
router.get(
  "/pages/:slug(*)/versions/:n(\\d+)",
  requireVersioning,
  authMiddleware.requirePageOwner,
  async (req, res) => {
    const n = parseInt(req.params.n, 10);
    const content = await versionsService.getVersionContent(req.params.slug, n);
    if (content === null)
      return res.status(404).json({ error: "Version not found" });
    res.json({ slug: req.params.slug, n, content });
  }
);

/**
 * POST /api/pages/:slug/versions/:n/restore
 * Promote a version to be the live page. The current live content is first
 * snapshotted as a new version, so the restore itself is undoable.
 * Owner or admin only.
 */
router.post(
  "/pages/:slug(*)/versions/:n(\\d+)/restore",
  requireVersioning,
  authMiddleware.requirePageOwner,
  async (req, res) => {
    const slug = req.params.slug;
    const n = parseInt(req.params.n, 10);

    const target = await versionsService.getVersionContent(slug, n);
    if (target === null)
      return res.status(404).json({ error: "Version not found" });

    const currentRaw = await s3Service.getText(`pages/${slug}.html`);
    if (currentRaw === null)
      return res.status(404).json({ error: "Page not found" });

    // Snapshot current content first so restore is reversible
    try {
      const prevMeta = await pageService.getPageMeta(slug);
      const label =
        typeof req.body?.label === "string"
          ? req.body.label
          : `Before restore to v${n}`;
      await versionsService.snapshotCurrent(
        slug,
        currentRaw,
        prevMeta.type || "html",
        label
      );
    } catch (err) {
      console.error("versions.snapshot before restore failed:", err);
    }

    await s3Service.putText(`pages/${slug}.html`, target);
    await pageService.setPageMeta(slug, { updated: new Date().toISOString() });

    res.json({ ok: true, slug, restoredFromVersion: n });
  }
);

module.exports = router;

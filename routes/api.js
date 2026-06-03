const express = require("express");
const s3Service = require("../services/s3");
const pageService = require("../services/page");
const contentService = require("../services/content");
const authMiddleware = require("../middleware/auth");

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
 */
router.get("/pages", async (req, res) => {
  const pages = await pageService.listPages();
  const user = authMiddleware.getCurrentUser(req);
  if (!user) return res.json(pages.filter((p) => p.access === "public"));
  if (user.role === "admin") return res.json(pages);
  res.json(pages.filter((p) => p.access === "public" || p.owner === user.id));
});

/**
 * POST /api/pages
 * Create or update a page
 * Requires authentication
 */
router.post("/pages", authMiddleware.requireAuth, async (req, res) => {
  let { slug, html, access } = req.body;
  if (!slug || !html)
    return res.status(400).json({ error: "slug and html are required" });

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

  // Save content to S3
  await s3Service.putText(`pages/${slug}.html`, content);

  // Update metadata
  const updates = {
    title,
    description,
    type,
    updated: new Date().toISOString(),
  };
  if (access === "publisher" || access === "public") updates.access = access;
  if (!existing) {
    updates.owner = user.id;
    updates.createdAt = new Date().toISOString();
  }
  await pageService.setPageMeta(slug, updates);

  const pm = await pageService.getPageMeta(slug);
  res.json({
    ok: true,
    slug,
    url: `/p/${slug}`,
    type,
    access: pm.access,
    owner: pm.owner,
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

  const access = await pageService.getAccess(req.params.slug);
  res.json({ slug: req.params.slug, type, source, access });
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

    await pageService.setPageMeta(req.params.slug, { access });
    res.json({ ok: true, slug: req.params.slug, access });
  }
);

/**
 * DELETE /api/pages/:slug
 * Delete a page (owner or admin only)
 */
router.delete("/pages/:slug(*)", authMiddleware.requirePageOwner, async (req, res) => {
  const raw = await s3Service.getText(`pages/${req.params.slug}.html`);
  if (raw === null) return res.status(404).json({ error: "Not found" });

  await s3Service.deleteObject(`pages/${req.params.slug}.html`);
  await pageService.deletePageMeta(req.params.slug);
  res.json({ ok: true });
});

module.exports = router;

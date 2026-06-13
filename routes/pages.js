const express = require("express");
const config = require("../config");
const s3Service = require("../services/s3");
const pageService = require("../services/page");
const authMiddleware = require("../middleware/auth");
const viewsService = require("../services/views");
const botsService = require("../services/bots");
const { notFoundHtml } = require("../templates/pages");

/**
 * Pages Routes
 * Single Responsibility: Handle page serving and public-facing routes
 */

const router = express.Router();

/**
 * Format a view count for display: 1234567 → "1.2M", 12345 → "12.3K", etc.
 * @param {number} n
 * @returns {string}
 */
function formatViews(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

/**
 * Minimal HTML-attribute/text escaping for injected, server-rendered content.
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Build a small, crawlable row of tag chips for a rendered page.
 * Each chip is a plain <a> to /?tag=<value> so crawlers can follow it.
 * @param {string[]} tags
 * @returns {string} HTML (empty string when there are no tags)
 */
function tagChipsHtml(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return "";
  const chips = tags
    .map((t) => {
      const safe = escapeHtml(t);
      return `<a href="/?tag=${encodeURIComponent(t)}" style="
        font:600 11px Inter,system-ui,sans-serif;color:#fb923c;text-decoration:none;
        background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.2);
        border-radius:999px;padding:3px 10px;line-height:1.4;white-space:nowrap;
        transition:background .15s" rel="tag"
        onmouseover="this.style.background='rgba(249,115,22,.16)'"
        onmouseout="this.style.background='rgba(249,115,22,.08)'"
      >${safe}</a>`;
    })
    .join("");
  return `<div style="position:fixed;bottom:12px;left:12px;z-index:99999;
    display:flex;gap:6px;flex-wrap:wrap;align-items:center;max-width:60vw"
    aria-label="Tags">${chips}</div>`;
}

/**
 * GET /p/:slug
 * Serve a published page
 * Enforces access control (publisher pages require authentication)
 */
router.get("/p/:slug(*)", async (req, res) => {
  const html = await s3Service.getText(`pages/${req.params.slug}.html`);
  if (html === null) return res.status(404).send(notFoundHtml());

  const pageMeta = await pageService.getPageMeta(req.params.slug);
  const access = pageMeta.access || "publisher";
  if (access === "publisher") {
    // A publisher page is private to its owner (and admin) — the same scope the
    // dashboard listing enforces. Authentication alone is NOT enough; otherwise
    // any logged-in user could open another publisher's page by URL, which
    // contradicts what the listing shows them. Anonymous viewers are sent to
    // login (so an owner following their own share link can authenticate);
    // authenticated non-owners get a 404 so the page's existence isn't leaked.
    const user = authMiddleware.getCurrentUser(req);
    if (!user) {
      return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
    }
    const isOwnerOrAdmin = user.role === "admin" || pageMeta.owner === user.id;
    if (!isOwnerOrAdmin) {
      return res.status(404).send(notFoundHtml());
    }
  }

  // Fire-and-forget: increment view counter (non-blocking, bot-filtered)
  // Skip iframe loads (e.g. dashboard thumbnails) — only count direct navigation
  const redisClient = req.app.locals.redisClient;
  const userAgent = req.headers["user-agent"] || "";
  const fetchDest = req.headers["sec-fetch-dest"] || "";
  if (fetchDest !== "iframe") {
    viewsService.incrementView(redisClient, req.params.slug, userAgent);
  }

  // Read view count for inline SSR display
  let viewCount = 0;
  try {
    viewCount = await viewsService.getViewCount(redisClient, req.params.slug);
  } catch (_) {
    // Non-critical — show 0 on error
  }

  const viewsLabel = formatViews(viewCount);

  // Add Shipfast badge (with view count) to page
  const badge = `<a href="/" style="position:fixed;bottom:12px;right:12px;z-index:99999;
    background:rgba(12,10,9,.9);border:1px solid rgba(255,255,255,.08);
    backdrop-filter:blur(12px);border-radius:8px;padding:5px 10px;
    font:600 11px Inter,system-ui,sans-serif;color:#fb923c;text-decoration:none;
    display:flex;align-items:center;gap:5px;opacity:.7;transition:opacity .2s"
    onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.7'">
    <span style="width:16px;height:16px;border-radius:4px;
      background:linear-gradient(135deg,#f97316,#ef4444);
      display:inline-grid;place-items:center;font-size:8px">&#9889;</span>
    Shipfast
    <span style="opacity:.5;font-weight:400;margin-left:2px">&#x2022;</span>
    <span style="display:flex;align-items:center;gap:3px;color:rgba(251,146,60,.8);font-size:10px">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      ${viewsLabel}
    </span>
  </a>`;

  // AI assistant loader — authenticated users only, and only when the
  // feature is configured. The user's LLM key never reaches this server.
  let assistantTag = "";
  if (config.ASSISTANT_ENABLED && authMiddleware.getCurrentUser(req)) {
    const slugAttr = encodeURIComponent(req.params.slug).replace(/%2F/gi, "/");
    assistantTag = `<script src="/assistant.js" data-sf-assistant data-slug="${slugAttr}" defer></script>`;
  }

  // Hide scrollbars on published pages (and their iframe thumbnails on the dashboard)
  // — page is still scrollable, just no visible scrollbar gutter.
  const scrollbarHider = '<style>html,body{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0;display:none}</style>';

  const tagsBar = tagChipsHtml(pageMeta.tags);

  const inject = scrollbarHider + badge + tagsBar + assistantTag;
  const lastBodyIdx = html.lastIndexOf("</body>");
  const finalHtml =
    lastBodyIdx === -1
      ? html + inject
      : html.slice(0, lastBodyIdx) + inject + html.slice(lastBodyIdx);

  // For known bots/crawlers: send X-Robots-Tag: noindex and inject a
  // <meta name="robots"> tag. Keeps content serving fast while hinting
  // that user-pasted pages should stay out of search indexes.
  const responseHtml = botsService.applyBotSeoHints(req, res, finalHtml);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(responseHtml);
});

module.exports = router;

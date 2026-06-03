const express = require("express");
const s3Service = require("../services/s3");
const pageService = require("../services/page");
const authMiddleware = require("../middleware/auth");
const { notFoundHtml } = require("../templates/pages");

/**
 * Pages Routes
 * Single Responsibility: Handle page serving and public-facing routes
 */

const router = express.Router();

/**
 * GET /p/:slug
 * Serve a published page
 * Enforces access control (publisher pages require authentication)
 */
router.get("/p/:slug(*)", async (req, res) => {
  const html = await s3Service.getText(`pages/${req.params.slug}.html`);
  if (html === null) return res.status(404).send(notFoundHtml());

  const access = await pageService.getAccess(req.params.slug);
  if (access === "publisher" && !authMiddleware.getCurrentUser(req)) {
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
  }

  // Add Shipfast badge to page
  const badge = `<a href="/" style="position:fixed;bottom:12px;right:12px;z-index:99999;
    background:rgba(12,10,9,.9);border:1px solid rgba(255,255,255,.08);
    backdrop-filter:blur(12px);border-radius:8px;padding:5px 10px;
    font:600 11px Inter,system-ui,sans-serif;color:#fb923c;text-decoration:none;
    display:flex;align-items:center;gap:5px;opacity:.7;transition:opacity .2s"
    onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.7'">
    <span style="width:16px;height:16px;border-radius:4px;
      background:linear-gradient(135deg,#f97316,#ef4444);
      display:inline-grid;place-items:center;font-size:8px">&#9889;</span>
    Shipfast</a>`;

  const lastBodyIdx = html.lastIndexOf("</body>");
  const finalHtml =
    lastBodyIdx === -1
      ? html + badge
      : html.slice(0, lastBodyIdx) + badge + html.slice(lastBodyIdx);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(finalHtml);
});

module.exports = router;

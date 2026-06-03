const pageService = require("../services/page");

/**
 * Authentication Middleware
 * Single Responsibility: Handle authentication checks and authorization
 */

/**
 * Get current authenticated user from request
 * @param {Object} req - Express request object
 * @returns {Object|null} - User object or null if not authenticated
 */
function getCurrentUser(req) {
  return req.isAuthenticated && req.isAuthenticated() ? req.user : null;
}

/**
 * Check if user is admin
 * @param {Object} req - Express request object
 * @returns {boolean} - True if user is admin
 */
function isAdmin(req) {
  const user = getCurrentUser(req);
  return user && user.role === "admin";
}

/**
 * Check if user can manage a specific page
 * @param {Object} req - Express request object
 * @param {string} slug - Page slug
 * @returns {Promise<boolean>} - True if user owns the page or is admin
 */
async function canManagePage(req, slug) {
  const user = getCurrentUser(req);
  if (!user) return false;
  if (user.role === "admin") return true;
  const meta = await pageService.getPageMeta(slug);
  return meta.owner === user.id;
}

/**
 * Middleware: Require authentication
 * Redirects to login if not authenticated
 */
function requireAuth(req, res, next) {
  if (getCurrentUser(req)) return next();
  const isApi = req.path.startsWith("/api/");
  if (isApi) return res.status(401).json({ error: "Unauthorized" });
  res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
}

/**
 * Middleware: Require page ownership or admin role
 * Returns 403 if user doesn't own the page
 */
async function requirePageOwner(req, res, next) {
  if (!getCurrentUser(req)) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Unauthorized" });
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
  }
  if (!(await canManagePage(req, req.params.slug))) {
    return res.status(403).json({ error: "You can only manage your own pages" });
  }
  next();
}

module.exports = {
  getCurrentUser,
  isAdmin,
  canManagePage,
  requireAuth,
  requirePageOwner,
};

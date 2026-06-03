const express = require("express");
const passport = require("passport");
const config = require("../config");
const userService = require("../services/user");
const authMiddleware = require("../middleware/auth");
const { loginHtml } = require("../templates/auth");

/**
 * Auth Routes
 * Single Responsibility: Handle authentication endpoints (login, logout, OAuth)
 */

const router = express.Router();

/**
 * GET /login - Show login page
 */
router.get("/login", (req, res) => {
  if (authMiddleware.getCurrentUser(req))
    return res.redirect(req.query.next || "/");
  if (req.query.next) req.session.returnTo = req.query.next;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(loginHtml(req.query.next || "/", req.query.error));
});

/**
 * POST /api/login - Authenticate with password
 */
router.post("/api/login", (req, res) => {
  if (req.body.password !== config.PUBLISHER_PASSWORD) {
    const next = req.body.next || "/";
    return res.redirect("/login?error=1&next=" + encodeURIComponent(next));
  }
  const adminUser = { id: "admin", displayName: "Admin", role: "admin" };
  req.login(adminUser, (err) => {
    if (err) return res.redirect("/login?error=1");
    res.redirect(req.body.next || "/");
  });
});

/**
 * POST /api/logout - Sign out user
 */
router.post("/api/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.redirect("/"));
  });
});

/**
 * Google OAuth routes (only if enabled)
 */
if (config.GOOGLE_AUTH_ENABLED) {
  /**
   * GET /auth/google - Initiate Google OAuth flow
   */
  router.get("/auth/google", (req, res, next) => {
    if (req.query.next) req.session.returnTo = req.query.next;
    passport.authenticate("google", { scope: ["profile", "email"] })(
      req,
      res,
      next
    );
  });

  /**
   * GET /auth/google/callback - Google OAuth callback
   */
  router.get(
    "/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google" }),
    (req, res) => {
      const next = req.session.returnTo || "/";
      delete req.session.returnTo;
      res.redirect(next);
    }
  );
}

module.exports = router;

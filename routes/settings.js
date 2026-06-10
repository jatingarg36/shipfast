const express = require("express");
const authMiddleware = require("../middleware/auth");
const { settingsHtml } = require("../templates/settings");

/**
 * Settings Routes
 * Single Responsibility: serve the user settings page.
 * The AI assistant key is handled entirely client-side — this route only
 * renders the shell.
 */

const router = express.Router();

/**
 * GET /settings - User settings page (auth required)
 */
router.get("/settings", authMiddleware.requireAuth, (req, res) => {
  const user = authMiddleware.getCurrentUser(req);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(settingsHtml(user));
});

module.exports = router;

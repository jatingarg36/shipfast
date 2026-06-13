const express = require("express");
const authMiddleware = require("../middleware/auth");
const { changelogHtml } = require("../templates/changelog");

/**
 * Changelog Routes
 * Single Responsibility: render the public changelog page.
 * Public route — viewable signed-out so it can be linked from anywhere.
 */

const router = express.Router();

/**
 * GET /changelog - Public changelog page
 */
router.get("/changelog", (req, res) => {
  const user = authMiddleware.getCurrentUser
    ? authMiddleware.getCurrentUser(req)
    : null;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(changelogHtml(user));
});

module.exports = router;

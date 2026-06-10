const crypto = require("crypto");
const express = require("express");
const config = require("../config");
const authMiddleware = require("../middleware/auth");
const chatDb = require("../services/chat-db");
const chatStore = require("../services/chat-store");
const { assistantLoaderJs, assistantPanelHtml } = require("../templates/assistant");

/**
 * Assistant Routes
 * Single Responsibility: AI assistant widget delivery + chat persistence API.
 *
 * Security invariants:
 * - The user's LLM API key NEVER reaches these routes (browser → provider direct).
 * - All chat routes require auth; every DB query is scoped by user_id.
 * - S3 keys are server-generated; clients never supply paths/keys/URLs.
 */

const router = express.Router();

const SLUG_RE = /^[a-zA-Z0-9][a-zA-Z0-9_\-/]{0,200}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Middleware: 503 when the feature is not configured */
function requireAssistantEnabled(_req, res, next) {
  if (!config.ASSISTANT_ENABLED) {
    return res.status(503).json({ error: "AI assistant is not enabled on this server" });
  }
  next();
}

/** Validate slug query/body param */
function validSlug(slug) {
  return typeof slug === "string" && SLUG_RE.test(slug) && !slug.includes("..");
}

// ── Widget delivery ────────────────────────────────────────────────────────

/**
 * GET /assistant.js — loader script injected into published pages.
 * Public (contains no secrets); the panel and API enforce auth.
 */
router.get("/assistant.js", (_req, res) => {
  res.setHeader("Content-Type", "text/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(assistantLoaderJs());
});

/**
 * GET /assistant/panel?slug= — chat panel UI, rendered inside the iframe.
 */
router.get("/assistant/panel", authMiddleware.requireAuth, (req, res) => {
  const slug = req.query.slug;
  if (!validSlug(slug)) return res.status(400).send("Invalid slug");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(assistantPanelHtml(slug));
});

// ── Chat persistence API ───────────────────────────────────────────────────

const api = express.Router();
api.use(requireAssistantEnabled);
// Always answer JSON 401 (requireAuth would redirect: req.path inside a
// mounted sub-router doesn't start with /api/)
api.use((req, res, next) => {
  if (!authMiddleware.getCurrentUser(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

/**
 * GET /api/assistant/chats?slug= — list my chats for a page
 */
api.get("/chats", async (req, res) => {
  if (!validSlug(req.query.slug)) return res.status(400).json({ error: "Invalid slug" });
  try {
    const user = authMiddleware.getCurrentUser(req);
    const chats = await chatDb.listChats(user.id, req.query.slug);
    res.json({ chats });
  } catch (err) {
    console.error("assistant listChats error:", err);
    res.status(500).json({ error: "Failed to list chats" });
  }
});

/**
 * POST /api/assistant/chats — create a chat { slug }
 */
api.post("/chats", async (req, res) => {
  const { slug } = req.body || {};
  if (!validSlug(slug)) return res.status(400).json({ error: "Invalid slug" });
  try {
    const user = authMiddleware.getCurrentUser(req);
    // S3 key derived from authenticated identity — never client-supplied
    const id = crypto.randomUUID();
    const s3Key = chatStore.keyFor(user.id, slug, id);
    await chatDb.createChat(id, user.id, slug, s3Key);
    res.status(201).json({ chatId: id });
  } catch (err) {
    console.error("assistant createChat error:", err);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

/**
 * GET /api/assistant/chats/:id — full transcript (ownership-checked)
 */
api.get("/chats/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid chat id" });
  try {
    const user = authMiddleware.getCurrentUser(req);
    const chat = await chatDb.getChat(req.params.id, user.id);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    const snapshot = await chatStore.readSnapshot(chat.snapshot_s3_key);
    res.json({
      chatId: chat.id,
      title: chat.title,
      slug: chat.page_slug,
      messages: snapshot.messages,
    });
  } catch (err) {
    console.error("assistant getChat error:", err);
    res.status(500).json({ error: "Failed to load chat" });
  }
});

/**
 * POST /api/assistant/chats/:id/messages — append [{role, content, selection?}]
 */
api.post("/chats/:id/messages", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid chat id" });
  const { messages } = req.body || {};
  const validationError = chatStore.validateMessages(messages);
  if (validationError) return res.status(400).json({ error: validationError });
  try {
    const user = authMiddleware.getCurrentUser(req);
    const chat = await chatDb.getChat(req.params.id, user.id);
    if (!chat) return res.status(404).json({ error: "Chat not found" });
    const added = await chatStore.appendMessages(chat.snapshot_s3_key, chat.id, messages);
    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = firstUserMsg ? firstUserMsg.content.slice(0, 60) : null;
    await chatDb.touchChat(chat.id, user.id, added, title);
    res.json({ ok: true, appended: added });
  } catch (err) {
    console.error("assistant appendMessages error:", err);
    res.status(500).json({ error: "Failed to save messages" });
  }
});

/**
 * DELETE /api/assistant/chats/:id — delete chat + snapshot
 */
api.delete("/chats/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid chat id" });
  try {
    const user = authMiddleware.getCurrentUser(req);
    const deleted = await chatDb.deleteChat(req.params.id, user.id);
    if (!deleted) return res.status(404).json({ error: "Chat not found" });
    await chatStore.deleteSnapshot(deleted.snapshot_s3_key);
    res.json({ ok: true });
  } catch (err) {
    console.error("assistant deleteChat error:", err);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

router.use("/api/assistant", api);

module.exports = router;

const s3Service = require("./s3");

/**
 * ChatStoreService - AI assistant chat snapshots (S3)
 * Single Responsibility: read/append transcript snapshots in S3.
 *
 * Layout: chats/{userId}/{slug}/{chatId}.json
 * Keys are always server-generated from authenticated identity — never
 * accepted from the client. Snapshots hold the FULL conversation; any
 * context-window trimming happens client-side and only affects what is
 * sent to the LLM provider.
 *
 * NOTE: No API keys are ever written here. The user's LLM key never
 * reaches the server.
 */

const MAX_MESSAGES_PER_APPEND = 20;
const MAX_APPEND_BYTES = 64 * 1024; // 64KB per append batch
const MAX_SNAPSHOT_MESSAGES = 500;

/**
 * Sanitize a path segment for use in an S3 key.
 * @param {string} segment
 * @returns {string}
 */
function sanitizeSegment(segment) {
  return String(segment).replace(/[^a-zA-Z0-9_\-./]/g, "_").replace(/\.\./g, "_");
}

/**
 * Build the S3 key for a chat snapshot.
 * @param {string} userId
 * @param {string} slug
 * @param {string} chatId
 * @returns {string}
 */
function keyFor(userId, slug, chatId) {
  return `chats/${sanitizeSegment(userId)}/${sanitizeSegment(slug)}/${sanitizeSegment(chatId)}.json`;
}

/**
 * Validate an array of messages for appending.
 * @param {Array} messages
 * @returns {string|null} - Error message, or null if valid
 */
function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "messages must be a non-empty array";
  }
  if (messages.length > MAX_MESSAGES_PER_APPEND) {
    return `at most ${MAX_MESSAGES_PER_APPEND} messages per request`;
  }
  let bytes = 0;
  for (const m of messages) {
    if (!m || typeof m !== "object") return "each message must be an object";
    if (m.role !== "user" && m.role !== "assistant") {
      return "message role must be 'user' or 'assistant'";
    }
    if (typeof m.content !== "string" || m.content.length === 0) {
      return "message content must be a non-empty string";
    }
    if (m.selection !== undefined && typeof m.selection !== "string") {
      return "message selection must be a string";
    }
    bytes += Buffer.byteLength(m.content) + (m.selection ? Buffer.byteLength(m.selection) : 0);
  }
  if (bytes > MAX_APPEND_BYTES) return "message batch too large (64KB max)";
  return null;
}

/**
 * Read a chat snapshot.
 * @param {string} s3Key
 * @returns {Promise<{chatId: string|null, messages: Array}>}
 */
async function readSnapshot(s3Key) {
  const raw = await s3Service.getText(s3Key);
  if (!raw) return { chatId: null, messages: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      chatId: parsed.chatId || null,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  } catch (_) {
    return { chatId: null, messages: [] };
  }
}

/**
 * Append messages to a chat snapshot (read–merge–put; single writer per
 * chat per user, so last-write-wins is acceptable).
 * @param {string} s3Key
 * @param {string} chatId
 * @param {Array<{role, content, selection?}>} messages - pre-validated
 * @returns {Promise<number>} - number of messages appended
 */
async function appendMessages(s3Key, chatId, messages) {
  const snapshot = await readSnapshot(s3Key);
  const now = Date.now();
  const cleaned = messages.map((m) => ({
    role: m.role,
    content: m.content,
    ...(m.selection ? { selection: m.selection } : {}),
    ts: now,
  }));
  const merged = snapshot.messages.concat(cleaned).slice(-MAX_SNAPSHOT_MESSAGES);
  await s3Service.putText(s3Key, JSON.stringify({ chatId, messages: merged }));
  return cleaned.length;
}

/**
 * Delete a chat snapshot.
 * @param {string} s3Key
 * @returns {Promise<void>}
 */
async function deleteSnapshot(s3Key) {
  await s3Service.deleteObject(s3Key);
}

module.exports = {
  keyFor,
  sanitizeSegment,
  validateMessages,
  readSnapshot,
  appendMessages,
  deleteSnapshot,
  MAX_MESSAGES_PER_APPEND,
  MAX_APPEND_BYTES,
};

const s3Service = require("./s3");

/**
 * UserService - Handles user data operations
 * Single Responsibility: Manage user information stored in S3
 */

const USERS_KEY = "users.json";

/**
 * Read all users from S3
 * @returns {Promise<Object>} - User object indexed by user ID
 */
async function readUsers() {
  const txt = await s3Service.getText(USERS_KEY);
  if (!txt) return {};
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

/**
 * Write users to S3
 * @param {Object} obj - User object to store
 */
async function writeUsers(obj) {
  const txt = JSON.stringify(obj, null, 2);
  await s3Service.putText(USERS_KEY, txt);
}

/**
 * Insert or update a user
 * @param {Object} user - User object with id, displayName, email, avatar, role
 */
async function upsertUser(user) {
  const users = await readUsers();
  users[user.id] = {
    ...users[user.id],
    ...user,
    lastLogin: new Date().toISOString(),
  };
  if (!users[user.id].createdAt) {
    users[user.id].createdAt = new Date().toISOString();
  }
  await writeUsers(users);
}

/**
 * Get display name for a user
 * @param {string} userId - User ID
 * @returns {Promise<string>} - Display name or user ID as fallback
 */
async function getDisplayName(userId) {
  if (userId === "admin") return "Admin";
  const users = await readUsers();
  return (users[userId] && users[userId].displayName) || userId;
}

module.exports = {
  readUsers,
  writeUsers,
  upsertUser,
  getDisplayName,
};

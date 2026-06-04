/**
 * ViewsService - Handles page view counting
 * Single Responsibility: Manage view counters in Redis
 */

/** Redis key prefix for view counters */
const KEY_PREFIX = "shipfast:views:";

/**
 * Known bot/crawler User-Agent patterns to exclude from counts
 */
const BOT_PATTERNS = [
  /bot/i,
  /crawl/i,
  /spider/i,
  /slurp/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /applebot/i,
  /googlebot/i,
  /bingbot/i,
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /semrushbot/i,
  /ahrefsbot/i,
];

/**
 * Check if a User-Agent string belongs to a known bot/crawler
 * @param {string} userAgent - User-Agent header value
 * @returns {boolean}
 */
function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

/**
 * Build the Redis key for a page slug
 * @param {string} slug
 * @returns {string}
 */
function viewKey(slug) {
  return KEY_PREFIX + slug;
}

/**
 * Increment the view counter for a page (fire-and-forget, bot-filtered)
 * @param {import('redis').RedisClientType} redisClient
 * @param {string} slug - Page slug
 * @param {string} userAgent - Request User-Agent header
 */
async function incrementView(redisClient, slug, userAgent) {
  if (isBot(userAgent)) return;
  try {
    await redisClient.incr(viewKey(slug));
  } catch (err) {
    // Non-critical — never let a counter failure break page serving
    console.error("views.incrementView error:", err);
  }
}

/**
 * Get the view count for a single page
 * @param {import('redis').RedisClientType} redisClient
 * @param {string} slug
 * @returns {Promise<number>}
 */
async function getViewCount(redisClient, slug) {
  try {
    const val = await redisClient.get(viewKey(slug));
    return parseInt(val || "0", 10);
  } catch (err) {
    console.error("views.getViewCount error:", err);
    return 0;
  }
}

/**
 * Get view counts for multiple pages in a single Redis MGET call
 * @param {import('redis').RedisClientType} redisClient
 * @param {string[]} slugs
 * @returns {Promise<Object>} - Map of slug → count
 */
async function getViewCounts(redisClient, slugs) {
  if (!slugs || !slugs.length) return {};
  try {
    const keys = slugs.map(viewKey);
    const vals = await redisClient.mGet(keys);
    const result = {};
    slugs.forEach((slug, i) => {
      result[slug] = parseInt(vals[i] || "0", 10);
    });
    return result;
  } catch (err) {
    console.error("views.getViewCounts error:", err);
    const result = {};
    slugs.forEach((s) => (result[s] = 0));
    return result;
  }
}

module.exports = { incrementView, getViewCount, getViewCounts, isBot };

/**
 * BotsService - Known-crawler detection and SEO hint helpers
 * Single Responsibility: Decide whether a request is a bot and apply
 * non-indexing hints (X-Robots-Tag header + <meta robots> injection)
 * so user-pasted page content stays out of search engine indexes.
 *
 * Note on the header name: there is no standard `Cache-Control: noindex`
 * directive. The directive crawlers actually honor for non-indexing is
 * `X-Robots-Tag: noindex` (see https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag).
 * That's what we send. We also inject `<meta name="robots">` as a belt-and-suspenders
 * fallback for any bot that ignores response headers but parses HTML.
 */

/**
 * Known bot/crawler User-Agent patterns.
 * Keep ordered roughly by frequency we expect to see in the wild.
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
 * Check if a User-Agent string belongs to a known bot/crawler.
 * @param {string|undefined|null} userAgent
 * @returns {boolean}
 */
function isBot(userAgent) {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((p) => p.test(userAgent));
}

/**
 * The robots directive we send. `noindex, nofollow` keeps the page off
 * search results and tells crawlers not to follow links from it either,
 * which is the right default for arbitrary user-pasted HTML.
 */
const ROBOTS_DIRECTIVE = "noindex, nofollow";

/** HTML snippet injected into <head> for HTML-only bots. */
const ROBOTS_META_TAG = `<meta name="robots" content="${ROBOTS_DIRECTIVE}">`;

/**
 * Inject `<meta name="robots">` into the document <head>. Falls back to
 * prepending the tag if no <head> is present (still parseable by crawlers).
 * Does NOT touch the response — that's the caller's job.
 * @param {string} html
 * @returns {string}
 */
function injectRobotsMeta(html) {
  if (!html) return html;
  // Avoid duplicate injection if author already set a robots meta.
  if (/<meta[^>]+name=["']?robots["']?/i.test(html)) return html;

  const headOpenMatch = html.match(/<head[^>]*>/i);
  if (headOpenMatch) {
    const idx = headOpenMatch.index + headOpenMatch[0].length;
    return html.slice(0, idx) + ROBOTS_META_TAG + html.slice(idx);
  }
  // No <head> — prepend so the tag is still in the document.
  return ROBOTS_META_TAG + html;
}

/**
 * Apply SEO non-indexing hints if the request comes from a known bot:
 *   - Sets `X-Robots-Tag: noindex, nofollow` on the response.
 *   - Injects `<meta name="robots" content="noindex, nofollow">` into the HTML.
 *
 * Safe no-op for human visitors — they get the page unchanged.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} html
 * @returns {string} - html (modified if request was from a bot)
 */
function applyBotSeoHints(req, res, html) {
  const ua = (req.headers && req.headers["user-agent"]) || "";
  if (!isBot(ua)) return html;
  res.setHeader("X-Robots-Tag", ROBOTS_DIRECTIVE);
  return injectRobotsMeta(html);
}

module.exports = {
  isBot,
  injectRobotsMeta,
  applyBotSeoHints,
  ROBOTS_DIRECTIVE,
  ROBOTS_META_TAG,
};

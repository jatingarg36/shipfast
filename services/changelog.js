const fs = require("fs");
const path = require("path");

/**
 * Changelog Service
 * Single Responsibility: read and parse CHANGELOG.md into structured entries.
 *
 * Parses a custom-but-readable format:
 *
 *   ## vVERSION — DATE — TITLE
 *
 *   Tag: feature|improvement|fix|security
 *
 *   - bullet one
 *   - bullet two
 *
 * Em-dash (—) or a hyphen with spaces (` - `) both work as separators in the
 * heading. The result is cached and invalidated when the file's mtime changes,
 * so editing CHANGELOG.md takes effect on the next request without restart.
 */

const CHANGELOG_PATH = path.join(__dirname, "..", "CHANGELOG.md");

const VALID_TAGS = new Set(["feature", "improvement", "fix", "security"]);

let cache = null;
let cacheMtime = 0;

function parseHeading(line) {
  // Accept em-dash or ` - ` (hyphen with spaces) as separators.
  const parts = line.split(/\s+[—–-]\s+/);
  if (parts.length < 3) return null;
  const version = parts[0].trim();
  const date = parts[1].trim();
  const title = parts.slice(2).join(" — ").trim();
  if (!version || !date || !title) return null;
  return { version, date, title };
}

function parseChangelog(md) {
  const entries = [];
  // Split on lines that begin with "## " — each piece is one release section.
  // The portion before the first "## " (file H1 + preamble) is discarded.
  const sections = md.split(/^##\s+/m).slice(1);

  for (const section of sections) {
    const lines = section.split(/\r?\n/);
    const headingLine = lines.shift() || "";
    const head = parseHeading(headingLine);
    if (!head) continue;

    let tag = "feature";
    const items = [];

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;

      const tagMatch = line.match(/^Tag:\s*([A-Za-z]+)/i);
      if (tagMatch) {
        const t = tagMatch[1].toLowerCase();
        if (VALID_TAGS.has(t)) tag = t;
        continue;
      }

      const bulletMatch = line.match(/^[-*]\s+(.+)$/);
      if (bulletMatch) {
        items.push(bulletMatch[1].trim());
      }
    }

    entries.push({
      version: head.version,
      date: head.date,
      title: head.title,
      tag,
      items,
    });
  }

  return entries;
}

/**
 * Load and parse CHANGELOG.md. Cached; refreshes when the file's mtime
 * changes. Returns [] (and logs) if the file is missing or unreadable.
 *
 * @returns {Array<{version:string,date:string,title:string,tag:string,items:string[]}>}
 */
function loadChangelog() {
  try {
    const stat = fs.statSync(CHANGELOG_PATH);
    if (cache && stat.mtimeMs === cacheMtime) return cache;
    const md = fs.readFileSync(CHANGELOG_PATH, "utf8");
    cache = parseChangelog(md);
    cacheMtime = stat.mtimeMs;
    return cache;
  } catch (err) {
    console.error("Failed to load CHANGELOG.md:", err.message);
    return [];
  }
}

module.exports = { loadChangelog, parseChangelog, CHANGELOG_PATH };

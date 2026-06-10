/**
 * Panel HTML composer.
 *
 * Loads the panel document and stylesheet from real .html / .css files at
 * runtime, then substitutes two placeholders:
 *
 *   /*__STYLES__*\/   ← contents of panel/styles.css
 *   /*__SCRIPT__*\/   ← output of panel/script.js (slug + system prompt
 *                       interpolated by the script builder)
 *
 * Why files instead of JS template strings:
 *   - panel.html can be edited like any other HTML (syntax highlighting,
 *     formatters, linters) without escaping backticks/dollars.
 *   - styles.css gets first-class CSS tooling.
 *   - The JS layer (script.js + prompt.js) stays small and focused on
 *     behavior, not presentation.
 *
 * Caching: files are read once at module load. That matches the rest of the
 * codebase's template loading model and is plenty fast; restart the server
 * to pick up edits, the same way you would for any other source file. To
 * iterate live, swap the readFileSync calls for per-request reads.
 */

const fs = require("fs");
const path = require("path");
const { panelScript } = require("./script");
const { systemPromptJs } = require("./prompt");

const HTML_TEMPLATE = fs.readFileSync(path.join(__dirname, "panel.html"), "utf8");
const STYLES = fs.readFileSync(path.join(__dirname, "styles.css"), "utf8");

// String.replace's replacement string interprets $&, $1, etc., which would
// corrupt JS/CSS that contains `$`. Use the function form to insert literally.
function literal(s) { return function () { return s; }; }

/**
 * @param {string} slug - already validated by the route
 * @returns {string} HTML document served at /assistant/panel
 */
function assistantPanelHtml(slug) {
  const scriptBody = panelScript(slug, systemPromptJs());
  return HTML_TEMPLATE
    .replace("/*__STYLES__*/", literal(STYLES))
    .replace("/*__SCRIPT__*/", literal(scriptBody));
}

module.exports = { assistantPanelHtml };

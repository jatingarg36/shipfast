/**
 * Assistant Templates — public surface.
 *
 * Internals are split into decoupled modules so each concern can evolve
 * independently:
 *
 *   loader.js               injected loader script (pill + iframe + layout push)
 *   panel/index.js          composes the panel HTML document
 *   panel/styles.js         CSS only
 *   panel/markup.js         HTML structure only
 *   panel/script.js         in-iframe runtime (settings, view, markdown,
 *                           providers, persistence, composer)
 *
 * Consumers should keep importing from this index — the file layout below
 * is free to change without touching call sites.
 */

const { assistantLoaderJs } = require("./loader");
const { assistantPanelHtml } = require("./panel");

module.exports = {
  assistantLoaderJs,
  assistantPanelHtml,
};

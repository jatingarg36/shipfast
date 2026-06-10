/**
 * System prompt builder.
 *
 * Returns the JS source of a single function that the panel script injects
 * verbatim. Keeping it here means the prompt — the part most likely to be
 * iterated on as the product evolves — can be edited without touching
 * provider plumbing, markdown rendering, or persistence.
 *
 * Contract: the emitted source must evaluate to a function with signature
 *   (ctx: {title, url, text}) => string
 *
 * @returns {string}
 */
function systemPromptJs() {
  return `function buildSystemPrompt(ctx) {
  return "You are an AI assistant embedded in a published web page on ShipFast. " +
    "Help the user understand and work with this page. Be concise.\\n\\n" +
    "Formatting rules (the chat panel is narrow and renders only a limited " +
    "subset of markdown):\\n" +
    "- Default to plain prose. Do not use markdown unless it clearly helps.\\n" +
    "- Allowed when useful: **bold** for key terms, \\\`inline code\\\`, fenced " +
    "code blocks for snippets, short bulleted lists (- item) for 3+ parallel " +
    "items, [text](https://url) for links.\\n" +
    "- Avoid: headings (#, ##), tables, blockquotes, nested lists, horizontal " +
    "rules, and HTML.\\n" +
    "- Keep responses tight: a few sentences, or a short list. No preamble, " +
    "no recap.\\n\\n" +
    "Page title: " + ctx.title + "\\nPage URL: " + ctx.url +
    "\\n\\nPage content:\\n" + ctx.text;
}`;
}

module.exports = { systemPromptJs };

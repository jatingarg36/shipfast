let marked;

/**
 * ContentService - Handles content type detection and transformation
 * Single Responsibility: Process and wrap user-submitted content
 */

/**
 * Lazy-load the marked library for markdown processing
 */
async function ensureMarked() {
  if (marked) return marked;
  const mod = await import("marked");
  marked = mod.marked || mod.default || mod;
  return marked;
}

/**
 * Detect content type from code
 * Returns: "html", "jsx", or "md"
 * @param {string} code - User-provided code
 * @returns {string} - Detected type
 */
function detectType(code) {
  const trimmed = code.trim();

  // Check for HTML
  if (/^\s*<!doctype\s+html/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed))
    return "html";
  if (/^\s*<\!--/.test(trimmed) && /<html[\s>]/i.test(trimmed)) return "html";

  // Check for Markdown
  const mdSignals = [
    /^#{1,6}\s+\S/m,
    /^(?:[-*+])\s+\S/m,
    /^>\s+\S/m,
    /^```/m,
    /\[([^\]]+)\]\(([^)]+)\)/,
    /!\[([^\]]*)\]\(([^)]+)\)/,
    /^\d+\.\s+\S/m,
    /^---\s*$/m,
    /\*\*[^*]+\*\*/,
  ];
  const mdCount = mdSignals.filter((r) => r.test(trimmed)).length;
  if (mdCount >= 3) return "md";

  // Check for JSX/React
  const jsxSignals = [
    /import\s+.*\s+from\s+['"]react['"]/,
    /export\s+default\s+(?:function|class)\s/,
    /(?:function|const|class)\s+(?:App|Main|Page|Home|Dashboard)\b/,
    /React\.useState|useState\s*\(/,
    /React\.useEffect|useEffect\s*\(/,
    /ReactDOM/,
    /<\w+\s[^>]*className[=]/,
    /return\s*\(\s*</,
  ];
  const matchCount = jsxSignals.filter((r) => r.test(trimmed)).length;
  if (matchCount >= 2) return "jsx";
  if (/^\s*</.test(trimmed) && /<\/\w+>\s*$/.test(trimmed)) return "html";
  if (matchCount >= 1) return "jsx";
  if (mdCount >= 2) return "md";
  return "html";
}

/**
 * Wrap JSX code in an HTML template for execution
 * @param {string} jsxCode - JSX source code
 * @param {string} title - Page title
 * @returns {string} - Complete HTML document with embedded JSX
 */
function wrapJsx(jsxCode, title) {
  // Strip ES module imports for react/react-dom
  let code = jsxCode
    .replace(/^\s*import\s+.*?\s+from\s+['"]react['"];?\s*$/gm, "")
    .replace(/^\s*import\s+.*?\s+from\s+['"]react-dom(?:\/client)?['"];?\s*$/gm, "");

  // Destructure commonly used hooks from React global
  const hookNames = [
    "useState",
    "useEffect",
    "useRef",
    "useMemo",
    "useCallback",
    "useContext",
    "useReducer",
    "useLayoutEffect",
    "createContext",
    "Fragment",
    "memo",
    "forwardRef",
    "lazy",
    "Suspense",
  ];
  const usedHooks = hookNames.filter((h) => code.includes(h));
  const hookDestructure = usedHooks.length
    ? `const { ${usedHooks.join(", ")} } = React;\n`
    : "";

  // Detect the default-exported component name
  const exportMatch = code.match(
    /export\s+default\s+(?:function|class)\s+([A-Z]\w*)/
  );
  const constExportMatch = code.match(/export\s+default\s+([A-Z]\w*)\s*;?\s*$/m);
  let componentName =
    (exportMatch && exportMatch[1]) || (constExportMatch && constExportMatch[1]) || null;

  // Strip export default statements
  code = code
    .replace(/export\s+default\s+(?=function|class)/g, "")
    .replace(/^\s*export\s+default\s+([A-Z]\w*)\s*;?\s*$/gm, "");

  // Build the render call
  const candidates = [
    ...(componentName ? [componentName] : []),
    "App",
    "Main",
    "Page",
    "Home",
    "Dashboard",
  ];
  const renderChecks = candidates
    .map((n) => `if (typeof ${n} !== 'undefined') root.render(<${n} />);`)
    .join("\n  else ");

  return `<!DOCTYPE html>
<!-- page-type:jsx -->
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title || "JSX Page"}</title>
<script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>*{box-sizing:border-box;margin:0;padding:0}body{min-height:100vh}</style>
</head>
<body>
<div id="root"></div>
<script type="text/babel">
${hookDestructure}${code}

const root = ReactDOM.createRoot(document.getElementById('root'));
${renderChecks}
<\/script>
</body>
</html>`;
}

/**
 * Wrap Markdown content in an HTML template
 * @param {string} mdSource - Markdown source
 * @param {string} title - Page title
 * @returns {Promise<string>} - Complete HTML document with styled markdown
 */
async function wrapMarkdown(mdSource, title) {
  const markedLib = await ensureMarked();
  const htmlBody = markedLib.parse(mdSource);
  const encoded = Buffer.from(mdSource).toString("base64");

  return `<!DOCTYPE html>
<!-- page-type:md -->
<!-- md-source:${encoded} -->
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title || "Markdown Page"}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:#0c0a09;color:#faf5f0;
  font-family:'Inter',system-ui,sans-serif;
  line-height:1.7;-webkit-font-smoothing:antialiased;
}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;
  background:
    radial-gradient(ellipse 50% 40% at 75% 5%,rgba(249,115,22,.05),transparent 70%),
    radial-gradient(ellipse 40% 50% at 15% 85%,rgba(239,68,68,.03),transparent 70%);
}
article{
  position:relative;max-width:780px;margin:0 auto;
  padding:3rem 2rem 5rem;
}
h1{font-size:2.2rem;font-weight:800;letter-spacing:-.04em;line-height:1.15;margin:2rem 0 1rem;color:#faf5f0}
h2{font-size:1.5rem;font-weight:700;letter-spacing:-.03em;line-height:1.25;margin:2.5rem 0 .75rem;padding-bottom:.5rem;border-bottom:1px solid rgba(255,255,255,.06);color:#faf5f0}
h3{font-size:1.15rem;font-weight:700;letter-spacing:-.02em;margin:2rem 0 .5rem;color:#e7ddd4}
h4{font-size:1rem;font-weight:600;margin:1.5rem 0 .4rem;color:#e7ddd4}
h5,h6{font-size:.88rem;font-weight:600;margin:1.25rem 0 .35rem;color:#8c7e73;text-transform:uppercase;letter-spacing:.04em}
p{margin:.75rem 0;color:#d4cac0;font-size:.95rem}
a{color:#fb923c;text-decoration:none;border-bottom:1px solid rgba(251,146,60,.25);transition:border-color .2s}
a:hover{border-color:#fb923c}
strong{color:#faf5f0;font-weight:600}
em{color:#e7ddd4;font-style:italic}

ul,ol{margin:.75rem 0;padding-left:1.75rem;color:#d4cac0}
li{margin:.3rem 0;font-size:.95rem}
li::marker{color:#6b5e54}

blockquote{
  margin:1.25rem 0;padding:.85rem 1.25rem;
  border-left:3px solid #f97316;
  background:rgba(249,115,22,.04);border-radius:0 8px 8px 0;
  color:#d4cac0;font-size:.92rem;
}
blockquote p{margin:.25rem 0;color:inherit}

code{
  font-family:'JetBrains Mono',monospace;font-size:.85em;
  background:#1a1412;border:1px solid rgba(255,255,255,.06);
  border-radius:5px;padding:.15rem .4rem;color:#fb923c;
}
pre{
  margin:1.25rem 0;padding:1.25rem 1.5rem;
  background:#1a1412;border:1px solid rgba(255,255,255,.06);
  border-radius:10px;overflow-x:auto;
  line-height:1.55;
}
pre code{
  background:none;border:none;padding:0;
  color:#e7ddd4;font-size:.84rem;
}

table{
  width:100%;margin:1.25rem 0;border-collapse:collapse;
  font-size:.88rem;
}
thead{border-bottom:2px solid rgba(255,255,255,.08)}
th{text-align:left;padding:.6rem .85rem;font-weight:600;color:#faf5f0;font-size:.78rem;text-transform:uppercase;letter-spacing:.05em}
td{padding:.55rem .85rem;border-bottom:1px solid rgba(255,255,255,.04);color:#d4cac0}
tr:hover td{background:rgba(255,255,255,.02)}

img{max-width:100%;height:auto;border-radius:10px;margin:1.25rem 0;border:1px solid rgba(255,255,255,.06)}
hr{border:none;border-top:1px solid rgba(255,255,255,.06);margin:2rem 0}

input[type=checkbox]{margin-right:.5rem;accent-color:#f97316}

@media(max-width:640px){
  article{padding:2rem 1rem 3rem}
  h1{font-size:1.6rem}
  h2{font-size:1.25rem}
}
</style>
</head>
<body>
<article>
${htmlBody}
</article>
</body>
</html>`;
}

module.exports = {
  detectType,
  wrapJsx,
  wrapMarkdown,
};

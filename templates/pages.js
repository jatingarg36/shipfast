/**
 * Pages Templates
 * Single Responsibility: HTML templates for page-related views
 */

/**
 * Generate 404 not found page HTML
 * @returns {string} - Complete HTML document
 */
function notFoundHtml() {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>404 — Not Found</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0c0a09;color:#faf5f0;font-family:'Inter',system-ui,sans-serif;
  min-height:100vh;display:flex;align-items:center;justify-content:center;
  text-align:center;padding:2rem}
.wrap{max-width:400px}
.code{font-size:6rem;font-weight:900;letter-spacing:-.06em;line-height:1;
  background:linear-gradient(135deg,#f97316,#ef4444);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
h1{font-size:1.2rem;font-weight:700;margin:.75rem 0 .4rem;letter-spacing:-.02em}
p{color:#71717a;font-size:.88rem;line-height:1.5;margin-bottom:1.5rem}
a{display:inline-flex;align-items:center;gap:.4rem;padding:.55rem 1.2rem;border-radius:8px;
  background:#231c19;border:1px solid rgba(255,255,255,.06);color:#fb923c;
  text-decoration:none;font-weight:600;font-size:.82rem;transition:all .2s}
a:hover{border-color:rgba(249,115,22,.3);background:#2c2420}
</style></head>
<body><div class="wrap">
  <div class="code">404</div>
  <h1>Page not found</h1>
  <p>This page doesn't exist or may have been deleted.</p>
  <a href="/">
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5m0 0l7 7m-7-7l7-7"/></svg>
    Back to Shipfast
  </a>
</div></body></html>`;
}

module.exports = {
  notFoundHtml,
};

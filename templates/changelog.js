/**
 * Changelog Page Template
 * Single Responsibility: render the public changelog of Shipfast releases.
 *
 * Entry data lives in CHANGELOG.md at the repo root and is parsed by
 * services/changelog.js. Edit that file to publish a new release.
 */

const { loadChangelog } = require("../services/changelog");

const TAG_LABELS = {
  feature: "New",
  improvement: "Improved",
  fix: "Fixed",
  security: "Security",
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return escapeHtml(iso);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function renderEntry(entry) {
  const tag = entry.tag && TAG_LABELS[entry.tag] ? entry.tag : "feature";
  const tagLabel = TAG_LABELS[tag];
  const items = (entry.items || [])
    .map((i) => `<li>${escapeHtml(i)}</li>`)
    .join("");
  return `
    <article class="entry">
      <header class="entry-head">
        <span class="tag tag-${tag}">${tagLabel}</span>
        <h2 class="entry-title">${escapeHtml(entry.title)}</h2>
        <div class="entry-meta">
          ${entry.version ? `<span class="entry-version">${escapeHtml(entry.version)}</span>` : ""}
          <time datetime="${escapeHtml(entry.date)}">${formatDate(entry.date)}</time>
        </div>
      </header>
      <ul class="entry-list">${items}</ul>
    </article>`;
}

/**
 * @param {Object|null} user - current user (may be null if logged out)
 * @returns {string} - HTML
 */
function changelogHtml(user) {
  const entries = loadChangelog();
  const entriesHtml = entries.map(renderEntry).join("");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Changelog &mdash; Shipfast</title>
<style>
  :root {
    --bg:#0c0a09; --panel:#171412; --border:rgba(255,255,255,.09);
    --text:#e7e5e4; --muted:#a8a29e; --accent:#fb923c; --accent2:#ef4444;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:var(--bg); }
  body {
    color:var(--text);
    font:15px/1.6 Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
    min-height:100vh;
    -webkit-font-smoothing:antialiased;
  }

  nav {
    border-bottom:1px solid var(--border);
    background:rgba(12,10,9,.85);
    position:sticky; top:0; z-index:10;
    backdrop-filter:blur(8px);
    -webkit-backdrop-filter:blur(8px);
  }
  .nav-inner {
    max-width:760px; margin:0 auto;
    padding:.8rem 1.2rem;
    display:flex; align-items:center; gap:.6rem;
  }
  .logo {
    width:26px; height:26px; border-radius:7px;
    background:linear-gradient(135deg,#f97316,#ef4444);
    display:grid; place-items:center;
    font-size:12px; font-weight:800; color:#fff;
  }
  .brand { font-weight:800; }
  .brand span { color:var(--accent); }
  .nav-spacer { flex:1; }
  nav a {
    color:var(--muted); text-decoration:none;
    font-size:.8rem; font-weight:500;
  }
  nav a:hover { color:var(--accent); }

  .wrap { max-width:760px; margin:0 auto; padding:2.4rem 1.2rem 4rem; }

  .page-head { margin-bottom:2rem; }
  .page-head h1 {
    font-size:2rem; letter-spacing:-.02em; font-weight:800;
    margin-bottom:.4rem;
  }
  .page-head p {
    color:var(--muted); font-size:.95rem;
    max-width:55ch;
  }

  .entries { display:flex; flex-direction:column; gap:1rem; }

  .entry {
    background:var(--panel);
    border:1px solid var(--border);
    border-radius:14px;
    padding:1.3rem 1.4rem;
  }

  .entry-head {
    display:flex; align-items:center;
    gap:.7rem; flex-wrap:wrap;
    margin-bottom:.9rem;
  }
  .entry-title {
    font-size:1.05rem; font-weight:700;
    letter-spacing:-.005em;
    flex:1; min-width:0;
  }
  .entry-meta {
    display:flex; align-items:center;
    gap:.6rem;
    font-size:.75rem; color:var(--muted);
    margin-left:auto;
  }
  .entry-version {
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
    color:var(--accent);
    font-size:.72rem;
  }
  .entry-meta time { white-space:nowrap; }

  .tag {
    font-size:.62rem; font-weight:800;
    padding:.22rem .55rem;
    border-radius:999px;
    text-transform:uppercase;
    letter-spacing:.06em;
    flex-shrink:0;
  }
  .tag-feature     { background:rgba(251,146,60,.14); color:var(--accent); }
  .tag-improvement { background:rgba(96,165,250,.14); color:#93c5fd; }
  .tag-fix         { background:rgba(134,239,172,.14); color:#86efac; }
  .tag-security    { background:rgba(239,68,68,.14);   color:#fca5a5; }

  .entry-list { list-style:none; }
  .entry-list li {
    color:var(--text);
    font-size:.9rem; line-height:1.55;
    padding:.2rem 0 .2rem 1.1rem;
    position:relative;
  }
  .entry-list li::before {
    content:""; position:absolute;
    left:.25rem; top:.72rem;
    width:.28rem; height:.28rem;
    border-radius:50%;
    background:var(--muted);
  }

  .empty {
    color:var(--muted); font-size:.9rem;
    padding:3rem 0; text-align:center;
  }

  @media (max-width:540px) {
    .page-head h1 { font-size:1.65rem; }
    .entry { padding:1.1rem 1.15rem; }
    .entry-meta { margin-left:0; width:100%; }
  }
</style>
</head>
<body>
<nav><div class="nav-inner">
  <div class="logo">S</div>
  <div class="brand">Ship<span>fast</span></div>
  <span class="nav-spacer"></span>
  <a href="/">&larr; Back to dashboard</a>
</div></nav>

<main class="wrap">
  <div class="page-head">
    <h1>Changelog</h1>
    <p>What's new in Shipfast. Updates ship continuously &mdash; the most
      recent releases are at the top.</p>
  </div>

  ${entries.length
    ? `<div class="entries">${entriesHtml}</div>`
    : `<div class="empty">No releases yet. Check back soon.</div>`}
</main>
</body>
</html>`;
}

module.exports = { changelogHtml };

const express = require("express");
require("dotenv").config();
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const fs = require("fs");
const path = require("path");
let marked;
async function ensureMarked() {
  if (marked) return marked;
  const mod = await import("marked");
  marked = mod.marked || mod.default || mod;
  return marked;
}

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const PAGES_DIR = path.join(__dirname, "pages");
if (!fs.existsSync(PAGES_DIR)) fs.mkdirSync(PAGES_DIR, { recursive: true });

// ── Config ────────────────────────────────────────────────────────────────

const PUBLISHER_PASSWORD = process.env.PUBLISHER_PASSWORD || "shipfast";
const SESSION_SECRET = process.env.SESSION_SECRET;
const REDIS_URL = process.env.REDIS_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_AUTH_ENABLED = !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET &&
  GOOGLE_CLIENT_ID !== "your-google-client-id" &&
  GOOGLE_CLIENT_SECRET !== "your-google-client-secret");

if (!SESSION_SECRET) {
  throw new Error("SESSION_SECRET is required. Set it in .env or Vercel environment variables.");
}
if (!REDIS_URL) {
  throw new Error("REDIS_URL is required. Set it in .env or Vercel environment variables.");
}

const redisClient = createClient({ url: REDIS_URL });
redisClient.on("error", (err) => console.error("Redis Client Error", err));
redisClient.connect().catch((err) => console.error("Redis connection failed:", err));

// ── Session + Passport ───────────────────────────────────────────────────

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

if (GOOGLE_AUTH_ENABLED) {
  passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
  }, (_accessToken, _refreshToken, profile, done) => {
    const user = {
      id: "google-" + profile.id,
      displayName: profile.displayName,
      email: (profile.emails && profile.emails[0] && profile.emails[0].value) || "",
      avatar: (profile.photos && profile.photos[0] && profile.photos[0].value) || "",
      role: "publisher",
    };
    upsertUser(user);
    done(null, user);
  }));
} else {
  console.log("Google OAuth disabled — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable");
}

// ── Auth helpers ──────────────────────────────────────────────────────────

function getCurrentUser(req) {
  return (req.isAuthenticated && req.isAuthenticated()) ? req.user : null;
}

function isAdmin(req) {
  const u = getCurrentUser(req);
  return u && u.role === "admin";
}

function canManagePage(req, slug) {
  const u = getCurrentUser(req);
  if (!u) return false;
  if (u.role === "admin") return true;
  return getPageMeta(slug).owner === u.id;
}

function requireAuth(req, res, next) {
  if (getCurrentUser(req)) return next();
  const isApi = req.path.startsWith("/api/");
  if (isApi) return res.status(401).json({ error: "Unauthorized" });
  res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
}

function requirePageOwner(req, res, next) {
  if (!getCurrentUser(req)) {
    if (req.path.startsWith("/api/")) return res.status(401).json({ error: "Unauthorized" });
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
  }
  if (!canManagePage(req, req.params.slug)) {
    return res.status(403).json({ error: "You can only manage your own pages" });
  }
  next();
}

// ── User data (file-based) ───────────────────────────────────────────────

const USERS_FILE = path.join(PAGES_DIR, "users.json");

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")); } catch { return {}; }
}

function writeUsers(obj) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2), "utf8");
}

function upsertUser(user) {
  const users = readUsers();
  users[user.id] = { ...users[user.id], ...user, lastLogin: new Date().toISOString() };
  if (!users[user.id].createdAt) users[user.id].createdAt = new Date().toISOString();
  writeUsers(users);
}

function getUserDisplayName(userId) {
  if (userId === "admin") return "Admin";
  const users = readUsers();
  return (users[userId] && users[userId].displayName) || userId;
}

// ── Page metadata (access + ownership) ───────────────────────────────────

const META_FILE = path.join(PAGES_DIR, "meta.json");

function readMeta() {
  if (!fs.existsSync(META_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(META_FILE, "utf8")); } catch { return {}; }
}

function writeMeta(obj) {
  fs.writeFileSync(META_FILE, JSON.stringify(obj, null, 2), "utf8");
}

function getPageMeta(slug) {
  const entry = readMeta()[slug];
  if (!entry) return { access: "publisher", owner: "admin" };
  if (typeof entry === "string") return { access: entry, owner: "admin" };
  return entry;
}

function setPageMeta(slug, updates) {
  const meta = readMeta();
  const existing = meta[slug];
  const prev = !existing ? { access: "publisher", owner: "admin" }
    : typeof existing === "string" ? { access: existing, owner: "admin" }
    : existing;
  meta[slug] = { ...prev, ...updates };
  writeMeta(meta);
}

function deletePageMeta(slug) {
  const meta = readMeta();
  delete meta[slug];
  writeMeta(meta);
}

function getAccess(slug) {
  return getPageMeta(slug).access || "publisher";
}

function migrateMeta() {
  const meta = readMeta();
  let changed = false;
  for (const [slug, value] of Object.entries(meta)) {
    if (typeof value === "string") {
      meta[slug] = { access: value, owner: "admin", createdAt: new Date().toISOString() };
      changed = true;
    }
  }
  if (fs.existsSync(PAGES_DIR)) {
    for (const f of fs.readdirSync(PAGES_DIR).filter(f => f.endsWith(".html"))) {
      const slug = f.replace(".html", "");
      if (!meta[slug]) {
        meta[slug] = { access: "publisher", owner: "admin", createdAt: new Date().toISOString() };
        changed = true;
      }
    }
  }
  if (changed) writeMeta(meta);
}

migrateMeta();

// ── Helpers ────────────────────────────────────────────────────────────────

function listPages() {
  if (!fs.existsSync(PAGES_DIR)) return [];
  return fs
    .readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith(".html"))
    .map((f) => {
      const slug = f.replace(".html", "");
      const stat = fs.statSync(path.join(PAGES_DIR, f));
      const raw = fs.readFileSync(path.join(PAGES_DIR, f), "utf8");
      const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : slug;
      const metaDesc = raw.match(
        /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i
      );
      let description = metaDesc ? metaDesc[1].trim() : "";
      if (!description) {
        const pMatch = raw.match(/<p[^>]*>([^<]{10,})<\/p>/i);
        if (pMatch) description = pMatch[1].trim();
      }
      if (description.length > 150)
        description = description.slice(0, 147) + "...";
      const pageType = raw.includes("<!-- page-type:jsx -->") ? "jsx"
        : raw.includes("<!-- page-type:md -->") ? "md" : "html";
      const pm = getPageMeta(slug);
      return {
        slug, title, description, type: pageType,
        access: pm.access || "publisher",
        owner: pm.owner || "admin",
        ownerName: getUserDisplayName(pm.owner || "admin"),
        updated: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.updated) - new Date(a.updated));
}

function detectType(code) {
  const trimmed = code.trim();
  if (/^\s*<!doctype\s+html/i.test(trimmed) || /^\s*<html[\s>]/i.test(trimmed)) return "html";
  if (/^\s*<\!--/.test(trimmed) && /<html[\s>]/i.test(trimmed)) return "html";

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

function wrapJsx(jsxCode, title) {
  // Strip ES module imports for react/react-dom — they're loaded as UMD globals
  let code = jsxCode
    .replace(/^\s*import\s+.*?\s+from\s+['"]react['"];?\s*$/gm, "")
    .replace(/^\s*import\s+.*?\s+from\s+['"]react-dom(?:\/client)?['"];?\s*$/gm, "");

  // Destructure commonly used hooks from React global
  const hookNames = [
    "useState","useEffect","useRef","useMemo","useCallback",
    "useContext","useReducer","useLayoutEffect","createContext",
    "Fragment","memo","forwardRef","lazy","Suspense",
  ];
  const usedHooks = hookNames.filter((h) => code.includes(h));
  const hookDestructure = usedHooks.length
    ? `const { ${usedHooks.join(", ")} } = React;\n`
    : "";

  // Detect the default-exported component name
  const exportMatch = code.match(
    /export\s+default\s+(?:function|class)\s+([A-Z]\w*)/
  );
  const constExportMatch = code.match(
    /export\s+default\s+([A-Z]\w*)\s*;?\s*$/m
  );
  let componentName =
    (exportMatch && exportMatch[1]) ||
    (constExportMatch && constExportMatch[1]) ||
    null;

  // Strip export default statements — they're invalid in non-module scripts
  code = code
    .replace(/export\s+default\s+(?=function|class)/g, "")
    .replace(/^\s*export\s+default\s+([A-Z]\w*)\s*;?\s*$/gm, "");

  // Build the render call — try detected name, then common names
  const candidates = [
    ...(componentName ? [componentName] : []),
    "App","Main","Page","Home","Dashboard",
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

// ── Auth routes (public) ──────────────────────────────────────────────────

app.get("/login", (req, res) => {
  if (getCurrentUser(req)) return res.redirect(req.query.next || "/");
  if (req.query.next) req.session.returnTo = req.query.next;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(loginHtml(req.query.next || "/", req.query.error));
});

app.post("/api/login", (req, res) => {
  if (req.body.password !== PUBLISHER_PASSWORD) {
    const next = req.body.next || "/";
    return res.redirect("/login?error=1&next=" + encodeURIComponent(next));
  }
  const adminUser = { id: "admin", displayName: "Admin", role: "admin" };
  req.login(adminUser, (err) => {
    if (err) return res.redirect("/login?error=1");
    res.redirect(req.body.next || "/");
  });
});

app.post("/api/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.redirect("/"));
  });
});

// ── Google OAuth routes ──────────────────────────────────────────────────

if (GOOGLE_AUTH_ENABLED) {
  app.get("/auth/google", (req, res, next) => {
    if (req.query.next) req.session.returnTo = req.query.next;
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get("/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=google" }),
    (req, res) => {
      const next = req.session.returnTo || "/";
      delete req.session.returnTo;
      res.redirect(next);
    }
  );
}

// ── API ───────────────────────────────────────────────────────────────────

// List pages (admin=all, publisher=own+public, anon=public)
app.get("/api/pages", (req, res) => {
  const pages = listPages();
  const user = getCurrentUser(req);
  if (!user) return res.json(pages.filter((p) => p.access === "public"));
  if (user.role === "admin") return res.json(pages);
  res.json(pages.filter((p) => p.access === "public" || p.owner === user.id));
});

// Publish / update a page
app.post("/api/pages", requireAuth, async (req, res) => {
  let { slug, html, access } = req.body;
  if (!slug || !html)
    return res.status(400).json({ error: "slug and html are required" });

  slug = slug
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return res.status(400).json({ error: "Invalid slug" });

  const user = getCurrentUser(req);
  const existing = fs.existsSync(path.join(PAGES_DIR, `${slug}.html`));
  if (existing && !canManagePage(req, slug)) {
    return res.status(403).json({ error: "This slug is owned by another user" });
  }

  const type = detectType(html);
  let content = html;
  if (type === "jsx") {
    const titleMatch = html.match(
      /(?:document\.title\s*=\s*['"]([^'"]+)['"]|<title>([^<]+)<\/title>)/
    );
    content = wrapJsx(html, titleMatch ? titleMatch[1] || titleMatch[2] : slug);
  } else if (type === "md") {
    const headingMatch = html.match(/^#\s+(.+)$/m);
    content = await wrapMarkdown(html, headingMatch ? headingMatch[1].trim() : slug);
  }

  fs.writeFileSync(path.join(PAGES_DIR, `${slug}.html`), content, "utf8");
  const updates = {};
  if (access === "publisher" || access === "public") updates.access = access;
  if (!existing) {
    updates.owner = user.id;
    updates.createdAt = new Date().toISOString();
  }
  setPageMeta(slug, updates);
  const pm = getPageMeta(slug);
  res.json({ ok: true, slug, url: `/p/${slug}`, type, access: pm.access, owner: pm.owner });
});

// Get raw content (for editing — owner or admin only)
app.get("/api/pages/:slug/raw", requireAuth, (req, res) => {
  const file = path.join(PAGES_DIR, `${req.params.slug}.html`);
  if (!fs.existsSync(file))
    return res.status(404).json({ error: "Not found" });
  if (!canManagePage(req, req.params.slug))
    return res.status(403).json({ error: "You can only edit your own pages" });
  const raw = fs.readFileSync(file, "utf8");
  const isJsx = raw.includes("<!-- page-type:jsx -->");
  const isMd = raw.includes("<!-- page-type:md -->");
  let source = raw;
  let type = "html";
  if (isJsx) {
    type = "jsx";
    const m = raw.match(/<script type="text\/babel">\n?([\s\S]*?)\n?const root = ReactDOM/);
    if (m) source = m[1].replace(/^const \{ .* \} = React;\n/, "");
  } else if (isMd) {
    type = "md";
    const m = raw.match(/<!-- md-source:([A-Za-z0-9+/=]+) -->/);
    if (m) source = Buffer.from(m[1], "base64").toString("utf8");
  }
  res.json({ slug: req.params.slug, type, source, access: getAccess(req.params.slug) });
});

// Check if slug exists (+ ownership info for authenticated users)
app.get("/api/pages/:slug/exists", (req, res) => {
  const file = path.join(PAGES_DIR, `${req.params.slug}.html`);
  const exists = fs.existsSync(file);
  const result = { exists };
  if (exists && getCurrentUser(req)) {
    result.canManage = canManagePage(req, req.params.slug);
  }
  res.json(result);
});

// Update access level (owner or admin only)
app.patch("/api/pages/:slug/access", requirePageOwner, (req, res) => {
  const { access } = req.body;
  if (access !== "public" && access !== "publisher")
    return res.status(400).json({ error: "access must be 'public' or 'publisher'" });
  const file = path.join(PAGES_DIR, `${req.params.slug}.html`);
  if (!fs.existsSync(file))
    return res.status(404).json({ error: "Not found" });
  setPageMeta(req.params.slug, { access });
  res.json({ ok: true, slug: req.params.slug, access });
});

// Delete a page (owner or admin only)
app.delete("/api/pages/:slug", requirePageOwner, (req, res) => {
  const file = path.join(PAGES_DIR, `${req.params.slug}.html`);
  if (!fs.existsSync(file))
    return res.status(404).json({ error: "Not found" });
  fs.unlinkSync(file);
  deletePageMeta(req.params.slug);
  res.json({ ok: true });
});

// ── Serve published pages ──────────────────────────────────────────────────

app.get("/p/:slug", (req, res) => {
  const file = path.join(PAGES_DIR, `${req.params.slug}.html`);
  if (!fs.existsSync(file)) return res.status(404).send(notFoundHtml());
  if (getAccess(req.params.slug) === "publisher" && !getCurrentUser(req)) {
    return res.redirect("/login?next=" + encodeURIComponent(req.originalUrl));
  }
  let html = fs.readFileSync(file, "utf8");
  const badge = `<a href="/" style="position:fixed;bottom:12px;right:12px;z-index:99999;
    background:rgba(12,10,9,.9);border:1px solid rgba(255,255,255,.08);
    backdrop-filter:blur(12px);border-radius:8px;padding:5px 10px;
    font:600 11px Inter,system-ui,sans-serif;color:#fb923c;text-decoration:none;
    display:flex;align-items:center;gap:5px;opacity:.7;transition:opacity .2s"
    onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='.7'">
    <span style="width:16px;height:16px;border-radius:4px;
      background:linear-gradient(135deg,#f97316,#ef4444);
      display:inline-grid;place-items:center;font-size:8px">&#9889;</span>
    Shipfast</a>`;
  html = html.replace("</body>", badge + "</body>");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// ── Dashboard (root) ───────────────────────────────────────────────────────

app.get("/", (req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(dashboardHtml(getCurrentUser(req)));
});

// ── HTML templates ─────────────────────────────────────────────────────────

function loginHtml(next, error) {
  const googleError = error === "google";
  const pwError = error === "1";
  const googleBtn = GOOGLE_AUTH_ENABLED ? `
    <a href="/auth/google?next=${encodeURIComponent(next)}" class="google-btn">
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Sign in with Google
    </a>
    <div class="divider"><span>or</span></div>
    ${googleError ? '<div class="error" style="display:block;text-align:center;margin-bottom:.75rem">Google sign-in failed. Try again.</div>' : ''}
  ` : '';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Login — Shipfast</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0c0a09;color:#faf5f0;font-family:'Inter',system-ui,sans-serif;
  min-height:100vh;display:flex;align-items:center;justify-content:center;padding:2rem}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 50% 40% at 75% 5%,rgba(249,115,22,.06),transparent 70%),
    radial-gradient(ellipse 40% 50% at 15% 85%,rgba(239,68,68,.04),transparent 70%);
}
.wrap{position:relative;width:100%;max-width:360px;text-align:center}
.logo{width:48px;height:48px;border-radius:14px;margin:0 auto 1.25rem;
  background:linear-gradient(135deg,#f97316,#ef4444);
  display:grid;place-items:center;font-size:1.2rem;font-weight:900;color:#fff;
  box-shadow:0 0 30px rgba(249,115,22,.25)}
h1{font-size:1.3rem;font-weight:800;letter-spacing:-.03em;margin-bottom:.3rem}
.sub{color:#8c7e73;font-size:.82rem;margin-bottom:1.75rem}
.google-btn{
  display:flex;align-items:center;justify-content:center;gap:.6rem;
  width:100%;padding:.7rem;border-radius:8px;
  background:#fff;color:#3c4043;font-family:'Inter',system-ui,sans-serif;
  font-size:.88rem;font-weight:600;text-decoration:none;
  transition:box-shadow .2s,transform .15s;
  box-shadow:0 1px 3px rgba(0,0,0,.2)}
.google-btn:hover{box-shadow:0 2px 8px rgba(0,0,0,.3);transform:translateY(-1px)}
.google-btn:active{transform:translateY(0)}
.divider{display:flex;align-items:center;gap:.75rem;margin:1.25rem 0;color:#6b5e54;font-size:.72rem}
.divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.08)}
form{text-align:left}
label{display:block;font-size:.68rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#8c7e73;margin-bottom:.35rem}
input[type=password]{
  width:100%;background:#1a1412;border:1px solid rgba(255,255,255,.06);
  border-radius:8px;color:#faf5f0;font-family:'JetBrains Mono',monospace;
  font-size:.85rem;padding:.65rem .85rem;outline:none;
  transition:border-color .2s,box-shadow .2s}
input[type=password]:focus{border-color:rgba(249,115,22,.5);box-shadow:0 0 0 3px rgba(249,115,22,.1)}
.error{color:#ef4444;font-size:.78rem;margin-top:.5rem;display:${pwError ? "block" : "none"}}
button[type=submit]{
  width:100%;margin-top:1.25rem;padding:.7rem;border:none;border-radius:8px;
  background:linear-gradient(135deg,#f97316,#ef4444);color:#fff;
  font-family:'Inter',system-ui,sans-serif;font-size:.88rem;font-weight:700;
  cursor:pointer;transition:filter .2s,transform .15s;
  box-shadow:0 1px 2px rgba(0,0,0,.3),0 0 20px rgba(249,115,22,.15)}
button[type=submit]:hover{filter:brightness(1.1);transform:translateY(-1px)}
button[type=submit]:active{transform:translateY(0)}
.admin-label{font-size:.65rem;color:#6b5e54;margin-bottom:.5rem}
</style></head>
<body><div class="wrap">
  <div class="logo">S</div>
  <h1>Shipfast</h1>
  <p class="sub">Sign in to publish and manage pages</p>
  ${googleBtn}
  <form method="POST" action="/api/login">
    <input type="hidden" name="next" value="${next.replace(/"/g, "&quot;")}"/>
    <div class="admin-label">Admin access</div>
    <label>Password</label>
    <input type="password" name="password" placeholder="Enter admin password" ${GOOGLE_AUTH_ENABLED ? '' : 'autofocus'} required/>
    <div class="error">Wrong password. Try again.</div>
    <button type="submit">Sign in as Admin</button>
  </form>
</div></body></html>`;
}

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

function dashboardHtml(user) {
  const isLoggedIn = !!user;
  const userJson = JSON.stringify(user || null);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Shipfast</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='%23f97316'/><stop offset='1' stop-color='%23ef4444'/></linearGradient></defs><rect rx='22' width='100' height='100' fill='url(%23g)'/><text x='50' y='68' text-anchor='middle' font-size='52' fill='white' font-weight='900' font-family='system-ui'>S</text></svg>"/>
<meta name="description" content="Ship HTML and React pages instantly — paste code, get a URL"/>
<meta name="theme-color" content="#0c0a09"/>
<meta property="og:title" content="Shipfast"/>
<meta property="og:description" content="Ship pages instantly — paste code, get a URL"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#0c0a09;
  --surface:#1a1412;
  --surface2:#231c19;
  --surface3:#2c2420;
  --border:rgba(255,255,255,.06);
  --border-hover:rgba(255,255,255,.12);
  --accent:#f97316;
  --accent2:#fb923c;
  --accent-glow:rgba(249,115,22,.12);
  --warm:#ef4444;
  --text:#faf5f0;
  --text2:#e7ddd4;
  --muted:#8c7e73;
  --muted2:#6b5e54;
  --success:#22c55e;
  --danger:#ef4444;
  --mono:'JetBrains Mono',monospace;
  --sans:'Inter',system-ui,-apple-system,sans-serif;
  --radius:12px;
}

html{scroll-behavior:smooth}
body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse 50% 40% at 75% 5%,rgba(249,115,22,.06),transparent 70%),
    radial-gradient(ellipse 40% 50% at 15% 85%,rgba(239,68,68,.04),transparent 70%);
}


/* ── Navbar ── */
nav{
  position:sticky;top:0;z-index:50;
  background:rgba(12,10,9,.85);backdrop-filter:blur(20px) saturate(1.4);
  border-bottom:1px solid var(--border);
}
.nav-inner{
  max-width:1200px;margin:0 auto;padding:.75rem 2rem;
  display:flex;align-items:center;justify-content:space-between;
}
.nav-brand{display:flex;align-items:center;gap:.65rem;text-decoration:none;color:var(--text)}
.nav-logo{
  width:32px;height:32px;border-radius:8px;
  background:linear-gradient(135deg,var(--accent),var(--warm));
  display:grid;place-items:center;font-size:.85rem;flex-shrink:0;font-weight:900;color:#fff;
  box-shadow:0 0 20px rgba(249,115,22,.2);
}
.nav-title{font-size:1rem;font-weight:700;letter-spacing:-.02em}
.nav-title span{color:var(--accent2)}

/* ── Buttons ── */
.btn{
  display:inline-flex;align-items:center;gap:.4rem;
  padding:.5rem 1.1rem;border-radius:8px;
  font-family:var(--sans);font-weight:600;font-size:.8rem;
  cursor:pointer;border:none;transition:all .2s ease;
  letter-spacing:-.01em;
}
.btn-primary{
  background:linear-gradient(135deg,var(--accent),var(--warm));color:#fff;
  box-shadow:0 1px 2px rgba(0,0,0,.3),0 0 20px rgba(249,115,22,.15);
}
.btn-primary:hover{filter:brightness(1.1);transform:translateY(-1px);box-shadow:0 4px 20px rgba(249,115,22,.3)}
.btn-primary:active{transform:translateY(0)}
.btn-ghost{background:var(--surface2);color:var(--text2);border:1px solid var(--border)}
.btn-ghost:hover{background:var(--surface3);border-color:var(--border-hover)}
.btn-danger{
  background:transparent;color:var(--muted);padding:.3rem .6rem;font-size:.7rem;
  border:1px solid transparent;border-radius:6px;
}
.btn-danger:hover{color:var(--danger);background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.2)}

/* ── Main ── */
.wrap{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:0 2rem 6rem}

/* ── Hero ── */
.hero{padding:4.5rem 0 3rem;max-width:700px;margin:0 auto;text-align:center}
.hero h2{font-size:3rem;font-weight:900;letter-spacing:-.05em;line-height:1.1}
.hero .grad{
  background:linear-gradient(135deg,var(--accent),var(--warm),var(--accent2));
  background-size:200% 200%;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  animation:shimmer 4s ease infinite;
}
@keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.hero p{color:var(--muted);font-size:.95rem;margin-top:.75rem;line-height:1.6;max-width:420px;margin-left:auto;margin-right:auto}
.hero-cta{margin-top:1.75rem;display:flex;gap:.75rem;justify-content:center;align-items:center}
.hero-cta .btn{padding:.65rem 1.6rem;font-size:.88rem;border-radius:10px}
.hero-cta .shortcut-hint{font-size:.7rem;color:var(--muted2);font-family:var(--mono)}
.nav-stats{display:flex;align-items:center;gap:1rem;margin-right:.5rem}
.nav-stat{display:flex;align-items:baseline;gap:.3rem;font-size:.75rem;color:var(--muted)}
.nav-stat-num{font-weight:700;font-size:.8rem;color:var(--text);font-family:var(--mono)}

/* ── Section ── */
.section-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem}
.section-title{font-size:.75rem;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
.section-count{font-family:var(--mono);font-size:.7rem;color:var(--muted2)}

/* ── Card grid ── */
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1rem}

.card{
  background:var(--surface);
  border:1px solid var(--border);
  border-radius:var(--radius);
  padding:1.25rem 1.35rem;
  display:flex;flex-direction:column;
  transition:all .25s cubic-bezier(.4,0,.2,1);
  cursor:pointer;text-decoration:none;color:inherit;
  position:relative;overflow:hidden;
}
.card::after{
  content:'';position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(249,115,22,.3),transparent);
  opacity:0;transition:opacity .25s;
}
.card:hover{
  border-color:var(--border-hover);
  transform:translateY(-3px);
  box-shadow:0 12px 40px rgba(0,0,0,.4),0 0 1px rgba(249,115,22,.2);
  background:var(--surface2);
}
.card:hover::after{opacity:1}

.card-body{flex:1;display:flex;flex-direction:column}
.card-top{display:flex;align-items:flex-start;gap:.85rem;margin-bottom:.75rem}
.card-icon{
  width:36px;height:36px;border-radius:9px;flex-shrink:0;
  background:var(--surface3);
  display:grid;place-items:center;font-size:1rem;
}
.card-title-wrap{flex:1;min-width:0}
.card-title{font-size:.95rem;font-weight:700;letter-spacing:-.02em;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-slug-inline{font-family:var(--mono);font-size:.65rem;color:var(--muted2);margin-top:.2rem}
.card-desc{font-size:.8rem;color:var(--muted);line-height:1.6;flex:1;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:.85rem}

.card-footer{
  display:flex;align-items:center;gap:.5rem;
  padding-top:.65rem;border-top:1px solid var(--border);
}
.card-time{
  font-family:var(--mono);font-size:.65rem;color:var(--muted2);
  display:flex;align-items:center;gap:.3rem;flex:1;
}
.card-time svg{width:12px;height:12px;opacity:.5}
.card-actions{display:flex;gap:.3rem;flex-shrink:0}
.card-actions .btn{opacity:0;transition:opacity .2s}
.card:hover .card-actions .btn{opacity:1}

/* ── Empty state ── */
.empty-state{
  text-align:center;padding:4rem 2rem;
  border:1px solid var(--border);border-radius:20px;
  background:linear-gradient(180deg,var(--surface),var(--bg));
  position:relative;overflow:hidden;
}
.empty-state::before{
  content:'';position:absolute;top:-1px;left:20%;right:20%;height:1px;
  background:linear-gradient(90deg,transparent,var(--accent-glow),transparent);
}
.empty-icon{
  width:72px;height:72px;border-radius:18px;margin:0 auto 1.5rem;
  background:linear-gradient(135deg,var(--surface2),var(--surface3));
  border:1px solid var(--border);
  display:grid;place-items:center;font-size:1.8rem;
  box-shadow:0 8px 30px rgba(0,0,0,.3);
}
.empty-state h3{font-size:1.2rem;font-weight:800;margin-bottom:.5rem;letter-spacing:-.03em}
.empty-state p{color:var(--muted);font-size:.85rem;margin-bottom:1.75rem;max-width:300px;margin-left:auto;margin-right:auto;line-height:1.6}

/* ── Modal ── */
.modal-overlay{
  position:fixed;inset:0;z-index:100;
  background:rgba(0,0,0,.7);backdrop-filter:blur(8px);
  display:none;align-items:center;justify-content:center;
  padding:1.5rem;
}
.modal-overlay.open{display:flex}
.modal{
  background:var(--surface);border:1px solid var(--border);
  border-radius:16px;width:100%;max-width:560px;
  max-height:90vh;overflow-y:auto;
  padding:1.75rem;
  animation:modalIn .25s cubic-bezier(.4,0,.2,1);
  box-shadow:0 24px 80px rgba(0,0,0,.5);
}
@keyframes modalIn{from{opacity:0;transform:scale(.97) translateY(10px)}to{opacity:1;transform:none}}
.modal-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem}
.modal-header h2{font-size:1.05rem;font-weight:700;letter-spacing:-.02em}
.modal-close{
  width:30px;height:30px;border-radius:8px;border:1px solid var(--border);
  background:transparent;color:var(--muted);cursor:pointer;font-size:1rem;
  display:grid;place-items:center;transition:all .15s;
}
.modal-close:hover{background:var(--surface2);border-color:var(--border-hover);color:var(--text)}

.field{margin-bottom:1rem}
label{display:block;font-size:.7rem;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:.35rem}
.modal input[type=text],.modal textarea{
  width:100%;background:var(--bg);border:1px solid var(--border);
  border-radius:8px;color:var(--text);font-family:var(--mono);
  font-size:.82rem;padding:.6rem .85rem;
  transition:border-color .2s,box-shadow .2s;outline:none;resize:vertical;
}
.modal input[type=text]:focus,.modal textarea:focus{border-color:rgba(249,115,22,.5);box-shadow:0 0 0 3px rgba(249,115,22,.1)}
textarea{min-height:200px}
.slug-preview{font-family:var(--mono);font-size:.68rem;color:var(--muted2);margin-top:.3rem}

/* ── Detected type pill ── */
.detected-type{
  font-family:var(--mono);font-size:.68rem;font-weight:600;
  color:var(--muted);margin-top:.35rem;
  display:flex;align-items:center;gap:.4rem;
  transition:color .2s;min-height:1.2em;
}
.detected-type .pill{
  padding:.15rem .5rem;border-radius:5px;font-size:.65rem;
  letter-spacing:.04em;text-transform:uppercase;
}
.pill-html{background:rgba(34,197,94,.08);color:var(--success);border:1px solid rgba(34,197,94,.15)}
.pill-jsx{background:rgba(249,115,22,.1);color:var(--accent2);border:1px solid rgba(249,115,22,.2)}
.pill-md{background:rgba(96,165,250,.1);color:#93c5fd;border:1px solid rgba(96,165,250,.2)}

/* ── Search ── */
.search-wrap{position:relative}
.search-icon{position:absolute;left:.65rem;top:50%;transform:translateY(-50%);color:var(--muted2);pointer-events:none}
.search-input{
  background:var(--surface);border:1px solid var(--border);border-radius:8px;
  color:var(--text);font-family:var(--sans);font-size:.78rem;
  padding:.45rem .65rem .45rem 2rem;width:220px;outline:none;
  transition:border-color .2s,width .25s;
}
.search-input:focus{border-color:rgba(249,115,22,.4);width:280px}
.search-input::placeholder{color:var(--muted2)}

/* ── Drag & Drop ── */
.drop-zone{position:relative}
.drop-overlay{
  position:absolute;inset:0;border-radius:8px;
  background:rgba(139,92,246,.06);border:2px dashed rgba(139,92,246,.35);
  display:none;flex-direction:column;align-items:center;justify-content:center;
  gap:.5rem;font-size:.82rem;font-weight:600;color:var(--accent2);
  z-index:2;pointer-events:none;
}
.drop-zone.dragover .drop-overlay{display:flex}
.drop-zone.dragover textarea{opacity:.3}

/* ── Modal footer ── */
.modal-footer{display:flex;align-items:center;justify-content:space-between;margin-top:.25rem}
.modal-hint{display:flex;align-items:center;gap:.25rem;color:var(--muted2);font-size:.7rem}
kbd{
  background:var(--surface3);border:1px solid var(--border);border-radius:4px;
  padding:.1rem .35rem;font-family:var(--sans);font-size:.65rem;font-weight:600;
  color:var(--muted);line-height:1.4;
}

/* ── Publish button states ── */
.btn-primary.loading{opacity:.7;pointer-events:none}
.btn-primary.loading::after{
  content:'';display:inline-block;width:14px;height:14px;
  border:2px solid rgba(255,255,255,.3);border-top-color:#fff;
  border-radius:50%;animation:spin .5s linear infinite;margin-left:.4rem;
}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Success state ── */
.success-icon{
  width:48px;height:48px;border-radius:50%;margin:0 auto;
  background:rgba(34,197,94,.1);border:2px solid rgba(34,197,94,.25);
  display:grid;place-items:center;font-size:1.2rem;color:var(--success);
}
.success-url{
  display:inline-block;font-family:var(--mono);font-size:.85rem;
  color:var(--accent2);background:var(--bg);border:1px solid var(--border);
  padding:.5rem 1rem;border-radius:8px;text-decoration:none;
  transition:border-color .2s;
}
.success-url:hover{border-color:rgba(249,115,22,.4)}

/* ── Delete confirmation ── */
.btn-delete-confirm{
  background:var(--danger);color:#fff;border:none;
  padding:.5rem 1.2rem;border-radius:8px;font-weight:600;font-size:.8rem;
  cursor:pointer;font-family:var(--sans);transition:all .15s;
}
.btn-delete-confirm:hover{background:#dc2626;transform:translateY(-1px)}

/* ── Preview ── */
.preview-frame-wrap{
  border:1px solid var(--border);border-radius:8px;overflow:hidden;
  background:#fff;height:420px;
}
#previewFrame{width:100%;height:100%;border:none}

/* ── Copy button on cards ── */
.btn-copy{
  background:transparent;color:var(--muted);padding:.3rem .5rem;font-size:.7rem;
  border:1px solid transparent;border-radius:6px;cursor:pointer;
  font-family:var(--sans);font-weight:600;transition:all .15s;
  display:inline-flex;align-items:center;gap:.25rem;
}
.btn-copy:hover{color:var(--accent2);border-color:rgba(249,115,22,.2);background:rgba(249,115,22,.05)}
.btn-copy.copied{color:var(--success);border-color:rgba(34,197,94,.2)}

/* ── Card thumbnail ── */
.card-thumb{
  width:100%;height:140px;border-radius:8px;overflow:hidden;
  margin-bottom:.85rem;background:var(--surface3);border:1px solid var(--border);
  position:relative;transition:border-color .25s;
}
.card:hover .card-thumb{border-color:var(--border-hover)}
.card-thumb iframe{
  width:200%;height:200%;border:none;
  transform:scale(.5);transform-origin:top left;
  pointer-events:none;
}

/* ── Access toggle ── */
.access-toggle{display:flex;gap:0;border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-top:.35rem}
.access-toggle button{
  flex:1;padding:.4rem .8rem;border:none;background:transparent;
  color:var(--muted);font-family:var(--sans);font-size:.72rem;font-weight:600;
  cursor:pointer;transition:all .15s;display:flex;align-items:center;justify-content:center;gap:.35rem;
}
.access-toggle button.active{background:var(--surface3);color:var(--text)}
.access-toggle button:not(.active):hover{background:var(--surface2);color:var(--text2)}
.access-toggle button+button{border-left:1px solid var(--border)}

.lock-badge{
  display:inline-flex;align-items:center;gap:.25rem;
  font-family:var(--mono);font-size:.6rem;font-weight:600;
  color:#fb923c;background:rgba(249,115,22,.08);border:1px solid rgba(249,115,22,.15);
  border-radius:5px;padding:.1rem .4rem;margin-left:.4rem;
}

/* ── Sort ── */
.sort-wrap{display:flex;align-items:center;gap:.5rem}
.sort-select{
  background:var(--surface);border:1px solid var(--border);border-radius:6px;
  color:var(--muted);font-family:var(--sans);font-size:.72rem;font-weight:600;
  padding:.3rem .5rem;outline:none;cursor:pointer;
  -webkit-appearance:none;appearance:none;
}
.sort-select:hover{border-color:var(--border-hover);color:var(--text2)}

/* ── Overwrite warning ── */
.slug-warn{
  font-family:var(--mono);font-size:.68rem;color:#f59e0b;
  margin-top:.3rem;display:flex;align-items:center;gap:.3rem;
}

/* ── Undo toast ── */
.toast-undo{
  display:inline-block;margin-left:.75rem;padding:.15rem .5rem;
  border-radius:5px;font-weight:700;font-size:.75rem;
  background:rgba(255,255,255,.1);color:var(--text);cursor:pointer;
  border:1px solid rgba(255,255,255,.15);
}
.toast-undo:hover{background:rgba(255,255,255,.18)}

/* ── Edit button on cards ── */
.btn-edit{
  background:transparent;color:var(--muted);padding:.3rem .5rem;font-size:.7rem;
  border:1px solid transparent;border-radius:6px;cursor:pointer;
  font-family:var(--sans);font-weight:600;transition:all .15s;
  display:inline-flex;align-items:center;gap:.25rem;
}
.btn-edit:hover{color:var(--accent2);border-color:rgba(249,115,22,.2);background:rgba(249,115,22,.05)}

/* ── Features strip ── */
.features{margin-top:3rem;padding:2.5rem 0;border-top:1px solid var(--border);border-bottom:1px solid var(--border)}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2rem}
@media(max-width:768px){.features-grid{grid-template-columns:1fr;gap:1.5rem}}
.feature{text-align:center}
.feature-icon{
  width:44px;height:44px;border-radius:12px;margin:0 auto .85rem;
  background:var(--surface);border:1px solid var(--border);
  display:grid;place-items:center;
  transition:all .25s;
}
.feature:hover .feature-icon{border-color:var(--border-hover);box-shadow:0 0 20px var(--accent-glow)}
.feature-icon svg{width:20px;height:20px;color:var(--accent2)}
.feature h4{font-size:.85rem;font-weight:700;letter-spacing:-.01em;margin-bottom:.3rem}
.feature p{font-size:.78rem;color:var(--muted);line-height:1.55;max-width:220px;margin:0 auto}

/* ── Footer ── */
.footer{
  text-align:center;padding:2.5rem 0 1.5rem;color:var(--muted2);font-size:.7rem;
  letter-spacing:.02em;border-top:1px solid var(--border);margin-top:3rem;
}

/* ── Toast ── */
.toast{
  position:fixed;bottom:1.5rem;right:1.5rem;z-index:200;
  background:var(--surface2);border:1px solid var(--border);
  border-radius:10px;padding:.65rem 1.1rem;
  font-size:.8rem;font-family:var(--mono);font-weight:500;
  opacity:0;transform:translateY(8px);transition:all .3s;pointer-events:none;
  box-shadow:0 8px 30px rgba(0,0,0,.4);
}
.toast.show{opacity:1;transform:translateY(0)}
.toast.ok{border-color:rgba(34,197,94,.3);color:var(--success)}
.toast.err{border-color:rgba(239,68,68,.3);color:var(--danger)}

/* ── Responsive ── */
@media(max-width:640px){
  .nav-inner,.wrap{padding-left:1rem;padding-right:1rem}
  .hero{padding:3rem 0 2rem}
  .hero h2{font-size:2rem}
  .hero p{font-size:.85rem}
  .hero-cta .btn{padding:.55rem 1.2rem;font-size:.82rem}
  .card-grid{grid-template-columns:1fr}
  .nav-stats{display:none}
  .features-grid{gap:1.25rem}
}
</style>
</head>
<body>


<nav>
  <div class="nav-inner">
    <a href="/" class="nav-brand">
      <div class="nav-logo">S</div>
      <div class="nav-title">Ship<span>fast</span></div>
    </a>
    <div style="display:flex;gap:.5rem;align-items:center">
      <div class="nav-stats">
        <div class="nav-stat"><span class="nav-stat-num" id="totalPages">0</span> shipped</div>
        <div class="nav-stat"><span class="nav-stat-num" id="lastPublished">&mdash;</span> latest</div>
      </div>
      ${isLoggedIn ? `
      ${user.avatar ? `<img src="${user.avatar}" style="width:28px;height:28px;border-radius:50%;border:1px solid rgba(255,255,255,.1)" alt="" referrerpolicy="no-referrer"/>` : ''}
      <span style="font-size:.75rem;color:var(--muted);font-weight:500;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${user.displayName}${user.role === 'admin' ? ' <span style="color:var(--accent);font-size:.6rem;font-weight:700">ADMIN</span>' : ''}</span>
      <button class="btn btn-primary" onclick="openModal()">
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
        Ship
      </button>
      <form method="POST" action="/api/logout" style="margin:0">
        <button type="submit" class="btn btn-ghost" style="font-size:.72rem;padding:.4rem .8rem">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </form>` : `<a href="/login" class="btn btn-ghost" style="font-size:.72rem;padding:.4rem .8rem">
        <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Login
      </a>`}
    </div>
  </div>
</nav>

<div class="wrap">

  <div class="hero">
    <h2>Build it. <span class="grad">Ship it.</span><br/>Share it.</h2>
    <p>Drop any HTML or React code and get a live, shareable URL instantly. No deploy pipeline needed.</p>
    <div class="hero-cta">
      ${isLoggedIn ? `<button class="btn btn-primary" onclick="openModal()">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>
        Ship a page
      </button>
      <span class="shortcut-hint">or press N</span>` : `<a href="/login" class="btn btn-primary">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Login to publish
      </a>`}
    </div>
  </div>

  <div class="section-header" id="sectionHeader" style="display:none">
    <div class="section-title">All Pages <span class="section-count" id="count"></span></div>
    <div class="sort-wrap">
      <select class="sort-select" id="sortSelect">
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
        <option value="az">A &rarr; Z</option>
        <option value="za">Z &rarr; A</option>
      </select>
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="text" id="searchInput" class="search-input" placeholder="Search pages&hellip;" autocomplete="off" spellcheck="false"/>
      </div>
    </div>
  </div>
  <div id="pagesList"></div>

  <div class="features" id="howSection">
    <div class="features-grid">
      <div class="feature">
        <div class="feature-icon"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>
        <h4>Instant deploy</h4>
        <p>Paste code, pick a slug, click ship. Live in under a second.</p>
      </div>
      <div class="feature">
        <div class="feature-icon"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></svg></div>
        <h4>HTML, React &amp; Markdown</h4>
        <p>Auto-detects HTML, JSX, or Markdown. Each gets beautifully rendered automatically.</p>
      </div>
      <div class="feature">
        <div class="feature-icon"><svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg></div>
        <h4>Shareable URLs</h4>
        <p>Every page gets a clean <code style="font-family:var(--mono);font-size:.72rem;background:var(--bg);padding:.1rem .35rem;border-radius:4px;border:1px solid var(--border);color:var(--accent2)">/p/slug</code> link you can send anyone.</p>
      </div>
    </div>
  </div>

  <div class="footer">Shipfast &mdash; zero to deployed in seconds</div>
</div>

<!-- Publish Modal -->
<div class="modal-overlay" id="modalOverlay" onclick="if(event.target===this)closeModal()">
  <div class="modal" id="publishModal">
    <!-- Step 1: Input -->
    <div id="modalStep1">
      <div class="modal-header">
        <h2>Publish a Page</h2>
        <div style="display:flex;gap:.4rem;align-items:center">
          <button class="btn btn-ghost" onclick="togglePreview()" id="previewToggle" style="font-size:.72rem;padding:.3rem .65rem" disabled>Preview</button>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
      </div>
      <div class="field">
        <label>Slug</label>
        <input type="text" id="slug" placeholder="auto-generated from title, or type your own" autocomplete="off" spellcheck="false"/>
        <div class="slug-preview">your page will live at <span id="slugUrl">/p/...</span></div>
      </div>
      <div class="field">
        <label>Access</label>
        <div class="access-toggle" id="accessToggle">
          <button type="button" data-access="public" onclick="setAccessLevel('public')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
            Public
          </button>
          <button type="button" class="active" data-access="publisher" onclick="setAccessLevel('publisher')">
            <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            Publisher
          </button>
        </div>
      </div>
      <div class="field" style="position:relative">
        <label>Code</label>
        <div class="drop-zone" id="dropZone">
          <textarea id="html" placeholder="Paste HTML, JSX, or Markdown &mdash; auto-detected&hellip;"></textarea>
          <div class="drop-overlay" id="dropOverlay">
            <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4"/><path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/></svg>
            Drop file here
          </div>
        </div>
        <div class="detected-type" id="detectedType"></div>
      </div>
      <div class="modal-footer">
        <div class="modal-hint">
          <kbd>&#8984;</kbd><kbd>&#9166;</kbd> to publish
        </div>
        <button class="btn btn-primary" onclick="publish()" id="publishBtn" style="min-width:120px;justify-content:center">Publish</button>
      </div>
    </div>
    <!-- Step 2: Success -->
    <div id="modalStep2" style="display:none">
      <div style="text-align:center;padding:2rem 0">
        <div class="success-icon">&#10003;</div>
        <h3 style="font-size:1.1rem;font-weight:700;margin:.75rem 0 .35rem">Published!</h3>
        <p style="color:var(--muted);font-size:.82rem;margin-bottom:1.25rem">Your page is live at:</p>
        <a id="successUrl" href="#" target="_blank" class="success-url">/p/...</a>
        <div style="display:flex;gap:.5rem;justify-content:center;margin-top:1.5rem">
          <button class="btn btn-ghost" onclick="copyUrl()" id="copyUrlBtn">Copy URL</button>
          <button class="btn btn-primary" onclick="resetModal()">Publish Another</button>
        </div>
      </div>
    </div>
    <!-- Preview pane (overlays step1) -->
    <div id="previewPane" style="display:none">
      <div class="modal-header">
        <h2>Preview</h2>
        <div style="display:flex;gap:.4rem;align-items:center">
          <button class="btn btn-ghost" onclick="togglePreview()" style="font-size:.72rem;padding:.3rem .65rem">Back to edit</button>
          <button class="modal-close" onclick="closeModal()">&times;</button>
        </div>
      </div>
      <div class="preview-frame-wrap">
        <iframe id="previewFrame" sandbox="allow-scripts allow-same-origin"></iframe>
      </div>
    </div>
  </div>
</div>

<!-- Delete confirmation modal -->
<div class="modal-overlay" id="deleteOverlay" onclick="if(event.target===this)cancelDelete()">
  <div class="modal" style="max-width:380px;text-align:center;padding:2rem">
    <div style="font-size:1.5rem;margin-bottom:.75rem;opacity:.6">&#128465;</div>
    <h3 style="font-size:1rem;font-weight:700;margin-bottom:.35rem">Delete this page?</h3>
    <p style="color:var(--muted);font-size:.82rem;margin-bottom:1.25rem">
      <strong id="deleteSlugName"></strong> will be permanently removed.
    </p>
    <div style="display:flex;gap:.5rem;justify-content:center">
      <button class="btn btn-ghost" onclick="cancelDelete()">Cancel</button>
      <button class="btn btn-delete-confirm" onclick="confirmDelete()">Delete</button>
    </div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
const HOST = window.location.origin;
const USER = ${userJson};
const IS_LOGGED_IN = !!USER;
const IS_ADMIN = USER && USER.role === 'admin';
function canManage(page){ return IS_ADMIN || (USER && page.owner === USER.id); }
let allPages = [];
let pendingDeleteSlug = null;
let undoTimer = null;
let editingSlug = null;
let currentAccess = 'publisher';

function setAccessLevel(level) {
  currentAccess = level;
  document.querySelectorAll('#accessToggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.access === level);
  });
}

function slugify(s){ return s.toLowerCase().replace(/[^a-z0-9-_]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,''); }
function detectType(code){
  const t=code.trim();
  if(/^\\s*<!doctype\\s+html/i.test(t)||/^\\s*<html[\\s>]/i.test(t)) return 'html';
  const mdSigs=[/^#{1,6}\\s+\\S/m,/^(?:[-*+])\\s+\\S/m,/^>\\s+\\S/m,/^\\x60\\x60\\x60/m,
    /\\[[^\\]]+\\]\\([^)]+\\)/,/!\\[[^\\]]*\\]\\([^)]+\\)/,/^\\d+\\.\\s+\\S/m,/^---\\s*$/m,/\\*\\*[^*]+\\*\\*/];
  const mdM=mdSigs.filter(r=>r.test(t)).length;
  if(mdM>=3) return 'md';
  const sigs=[/import\\s+.*from\\s+['"]react['"]/,/export\\s+default\\s+(?:function|class)\\s/,
    /(?:function|const|class)\\s+(?:App|Main|Page|Home|Dashboard)\\b/,/useState\\s*\\(/,/useEffect\\s*\\(/,
    /<\\w+\\s[^>]*className[=]/,/return\\s*\\(\\s*</];
  const m=sigs.filter(r=>r.test(t)).length;
  if(m>=2) return 'jsx'; if(/^\\s*</.test(t)&&/<\\/\\w+>\\s*$/.test(t)) return 'html';
  if(m>=1) return 'jsx';
  if(mdM>=2) return 'md';
  return 'html';
}
function extractTitle(code){
  const html=code.match(/<title[^>]*>([^<]+)<\\/title>/i);
  if(html) return html[1].trim();
  const md=code.match(/^#\\s+(.+)$/m);
  if(md) return md[1].trim();
  return null;
}

// ── DOM refs ──
const slugInput=document.getElementById('slug'), slugUrl=document.getElementById('slugUrl');
const htmlInput=document.getElementById('html'), detectedEl=document.getElementById('detectedType');
const publishBtn=document.getElementById('publishBtn'), previewToggle=document.getElementById('previewToggle');
const searchInput=document.getElementById('searchInput'), sortSelect=document.getElementById('sortSelect');
const slugPreviewEl=slugInput.parentElement.querySelector('.slug-preview');

// ── Slug with overwrite warning ──
let slugManuallyEdited=false, slugWarnEl=null;
slugInput.addEventListener('input',()=>{
  slugManuallyEdited=true;
  const s=slugify(slugInput.value);
  slugUrl.textContent=s?HOST+'/p/'+s:'/p/...';
  checkSlugExists(s);
});
async function checkSlugExists(s){
  if(slugWarnEl){ slugWarnEl.remove(); slugWarnEl=null; }
  if(!s||s===editingSlug) return;
  const r=await fetch('/api/pages/'+s+'/exists').then(r=>r.json());
  if(r.exists){
    slugWarnEl=document.createElement('div');
    slugWarnEl.className='slug-warn';
    if(r.canManage===false){
      slugWarnEl.innerHTML='\\u26d4 This slug is owned by another user \\u2014 you cannot overwrite it';
      slugWarnEl.style.color='#ef4444';
    } else {
      slugWarnEl.innerHTML='\\u26a0 This slug exists \\u2014 publishing will overwrite it';
    }
    slugPreviewEl.after(slugWarnEl);
  }
}

// ── Code input: auto-detect + auto-slug ──
let detectTimer;
htmlInput.addEventListener('input',()=>{
  clearTimeout(detectTimer);
  detectTimer=setTimeout(()=>{
    const v=htmlInput.value.trim();
    if(!v){ detectedEl.innerHTML=''; previewToggle.disabled=true; return; }
    previewToggle.disabled=false;
    const t=detectType(v);
    const pills={jsx:'<span class="pill pill-jsx">JSX / React</span>',md:'<span class="pill pill-md">Markdown</span>',html:'<span class="pill pill-html">HTML</span>'};
    detectedEl.innerHTML='Detected: '+(pills[t]||pills.html);
    if(!slugManuallyEdited||!slugInput.value.trim()){
      const title=extractTitle(v);
      if(title){ const s=slugify(title); slugInput.value=s; slugUrl.textContent=HOST+'/p/'+s; slugManuallyEdited=false; checkSlugExists(s); }
    }
  },300);
});

// ── Drag & Drop ──
const dropZone=document.getElementById('dropZone');
['dragenter','dragover'].forEach(ev=>{dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add('dragover')})});
['dragleave','drop'].forEach(ev=>{dropZone.addEventListener(ev,()=>{dropZone.classList.remove('dragover')})});
dropZone.addEventListener('drop',e=>{
  e.preventDefault();const f=e.dataTransfer.files[0];if(!f)return;
  const r=new FileReader();r.onload=()=>{htmlInput.value=r.result;htmlInput.dispatchEvent(new Event('input'))};r.readAsText(f);
});

// ── Modal ──
function openModal(isEdit){
  if(!isEdit){ editingSlug=null; resetModalFields(); }
  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('modalStep1').style.display='block';
  document.getElementById('modalStep2').style.display='none';
  document.getElementById('previewPane').style.display='none';
  const h=document.querySelector('#modalStep1 .modal-header h2');
  h.textContent=editingSlug?'Edit Page':'Publish a Page';
  publishBtn.textContent=editingSlug?'Update':'Publish';
  setTimeout(()=>(editingSlug?htmlInput:htmlInput).focus(),100);
}
function closeModal(){ document.getElementById('modalOverlay').classList.remove('open'); editingSlug=null; }
function resetModalFields(){
  slugInput.value=''; htmlInput.value=''; slugUrl.textContent='/p/...';
  detectedEl.innerHTML=''; slugManuallyEdited=false; previewToggle.disabled=true;
  if(slugWarnEl){ slugWarnEl.remove(); slugWarnEl=null; }
  publishBtn.classList.remove('loading'); publishBtn.textContent='Publish';
  setAccessLevel('publisher');
}
function resetModal(){
  resetModalFields();
  document.getElementById('modalStep1').style.display='block';
  document.getElementById('modalStep2').style.display='none';
  document.getElementById('previewPane').style.display='none';
  editingSlug=null; htmlInput.focus();
}

// ── Edit page ──
async function editPage(e,slug){
  e.stopPropagation(); e.preventDefault();
  const r=await fetch('/api/pages/'+slug+'/raw').then(r=>r.json());
  editingSlug=slug;
  slugInput.value=slug; slugUrl.textContent=HOST+'/p/'+slug;
  slugManuallyEdited=true;
  htmlInput.value=r.source;
  setAccessLevel(r.access||'public');
  htmlInput.dispatchEvent(new Event('input'));
  openModal(true);
}

// ── Preview ──
function togglePreview(){
  const p=document.getElementById('previewPane'),s=document.getElementById('modalStep1');
  if(p.style.display==='none'){document.getElementById('previewFrame').srcdoc=htmlInput.value;p.style.display='block';s.style.display='none'}
  else{p.style.display='none';s.style.display='block'}
}

// ── Keyboard ──
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){closeModal();cancelDelete()}
  if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){
    const o=document.getElementById('modalOverlay');
    if(o.classList.contains('open')&&document.getElementById('modalStep1').style.display!=='none') publish();
  }
  // 'n' to open publish (only when logged in and not in input/textarea)
  if(e.key==='n'&&IS_LOGGED_IN&&!e.metaKey&&!e.ctrlKey&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){
    e.preventDefault(); openModal();
  }
});

// ── Publish ──
async function publish(){
  const slug=slugify(slugInput.value.trim()),html=htmlInput.value.trim();
  if(!slug) return showToast('Enter a slug','err');
  if(!html) return showToast('Paste some code','err');
  publishBtn.classList.add('loading');publishBtn.textContent=editingSlug?'Updating':'Publishing';
  try{
    const r=await fetch('/api/pages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug,html,access:currentAccess})});
    const d=await r.json();
    if(d.ok){
      document.getElementById('modalStep1').style.display='none';
      document.getElementById('modalStep2').style.display='block';
      const url=HOST+'/p/'+d.slug,link=document.getElementById('successUrl');
      link.href=url;link.textContent=url;
      document.querySelector('#modalStep2 h3').textContent=editingSlug?'Updated!':'Published!';
      editingSlug=null; loadPages();
    } else showToast(d.error||'Error','err');
  }catch(err){showToast('Network error','err')}
  finally{publishBtn.classList.remove('loading');publishBtn.textContent='Publish'}
}
function copyUrl(){
  navigator.clipboard.writeText(document.getElementById('successUrl').href).then(()=>{
    const b=document.getElementById('copyUrlBtn');b.textContent='Copied!';setTimeout(()=>{b.textContent='Copy URL'},2000);
  });
}
function copyPageUrl(e,slug){
  e.stopPropagation();e.preventDefault();
  navigator.clipboard.writeText(HOST+'/p/'+slug).then(()=>{
    const b=e.currentTarget;b.classList.add('copied');b.innerHTML='\\u2713 Copied';
    setTimeout(()=>{b.classList.remove('copied');b.innerHTML=copySvg+' Copy URL'},1500);
  });
}

// ── Delete with undo ──
function deletePage(e,slug){ e.stopPropagation();e.preventDefault(); pendingDeleteSlug=slug;
  document.getElementById('deleteSlugName').textContent='/p/'+slug;
  document.getElementById('deleteOverlay').classList.add('open');
}
function cancelDelete(){ pendingDeleteSlug=null;document.getElementById('deleteOverlay').classList.remove('open'); }
async function confirmDelete(){
  if(!pendingDeleteSlug) return;
  const slug=pendingDeleteSlug;
  // Fetch content before deleting (for undo)
  let backup=null;
  try{ backup=await fetch('/api/pages/'+slug+'/raw').then(r=>r.json()); }catch(e){}
  await fetch('/api/pages/'+slug,{method:'DELETE'});
  cancelDelete(); loadPages();
  // Show undo toast
  const t=document.getElementById('toast');
  t.innerHTML='Deleted /p/'+esc(slug)+' <span class="toast-undo" onclick="undoDelete()">Undo</span>';
  t.className='toast show ok'; t.style.pointerEvents='auto';
  clearTimeout(toastTimer); clearTimeout(undoTimer);
  window._undoBackup=backup;
  undoTimer=setTimeout(()=>{ window._undoBackup=null; },5000);
  toastTimer=setTimeout(()=>{ t.className='toast'; t.style.pointerEvents=''; },5000);
}
async function undoDelete(){
  const b=window._undoBackup; if(!b) return;
  window._undoBackup=null; clearTimeout(undoTimer);
  await fetch('/api/pages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:b.slug,html:b.source})});
  loadPages(); showToast('Restored /p/'+b.slug,'ok');
}

// ── Sort ──
sortSelect.addEventListener('change',()=>renderPages(searchInput.value.trim().toLowerCase()));
searchInput.addEventListener('input',()=>renderPages(searchInput.value.trim().toLowerCase()));

function sortPages(pages){
  const v=sortSelect.value,arr=[...pages];
  if(v==='oldest') return arr.reverse();
  if(v==='az') return arr.sort((a,b)=>a.title.localeCompare(b.title));
  if(v==='za') return arr.sort((a,b)=>b.title.localeCompare(a.title));
  return arr;
}

// ── Render ──
const clockSvg='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;opacity:.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const copySvg='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';
const editSvg='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

function renderPages(query){
  const el=document.getElementById('pagesList'),header=document.getElementById('sectionHeader');
  const count=document.getElementById('count'),totalEl=document.getElementById('totalPages');
  const lastEl=document.getElementById('lastPublished'),howSection=document.getElementById('howSection');

  totalEl.textContent=allPages.length;
  lastEl.textContent=allPages.length?timeAgo(new Date(allPages[0].updated)):'\\u2014';

  // Hide "how it works" if pages exist
  howSection.style.display=allPages.length?'none':'block';

  if(!allPages.length){
    header.style.display='none';
    el.innerHTML=\`<div class="empty-state">
      <div class="empty-icon">\\u{1F4C4}</div><h3>No pages yet</h3>
      <p>\${IS_LOGGED_IN?'Ship your first page and it will appear here.':'No public pages have been published yet.'}</p>
      \${IS_LOGGED_IN?'<button class="btn btn-primary" onclick="openModal()"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg> Publish your first page</button>':''}</div>\`;
    return;
  }

  let filtered=query?allPages.filter(p=>p.title.toLowerCase().includes(query)||p.slug.includes(query)||(p.description||'').toLowerCase().includes(query)):allPages;
  filtered=sortPages(filtered);
  header.style.display='flex';
  count.textContent=(query?filtered.length+' / ':'')+allPages.length+' page'+(allPages.length===1?'':'s');

  if(query&&!filtered.length){
    el.innerHTML='<div style="text-align:center;padding:3rem;color:var(--muted);font-size:.85rem">No pages match \\u201c'+esc(query)+'\\u201d</div>';return;
  }

  el.innerHTML='<div class="card-grid">'+filtered.map(p=>{
    const ago=timeAgo(new Date(p.updated)),desc=p.description||'A page shipped with Shipfast';
    const mine=canManage(p);
    return \`<a class="card" href="/p/\${p.slug}" target="_blank">
      <div class="card-body">
        <div class="card-thumb"><iframe src="/p/\${p.slug}" loading="lazy" tabindex="-1"></iframe></div>
        <div class="card-title-wrap">
          <div class="card-title">\${esc(p.title)}</div>
          <div class="card-slug-inline">/p/\${p.slug}\${p.access==='publisher'?'<span class="lock-badge"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Publisher</span>':''}</div>
        </div>
        <div class="card-desc">\${esc(desc)}</div>
        <div class="card-footer">
          <div class="card-time">\${clockSvg} \${ago} \${p.ownerName?'<span style="margin-left:.3rem;color:var(--muted2)">by '+esc(p.ownerName)+'</span>':''}</div>
          <div class="card-actions">
            \${mine?'<button class="btn-edit" onclick="editPage(event,\\''+p.slug+'\\')">'+editSvg+' Edit</button>':''}
            <button class="btn-copy" onclick="copyPageUrl(event,'\${p.slug}')">\${copySvg} Copy URL</button>
            \${mine?'<button class="btn btn-danger" onclick="deletePage(event,\\''+p.slug+'\\')">Delete</button>':''}
          </div>
        </div>
      </div></a>\`;
  }).join('')+'</div>';
}

async function loadPages(){
  allPages=await fetch('/api/pages').then(r=>r.json());
  renderPages(searchInput.value.trim().toLowerCase());
}

function timeAgo(d){
  const s=Math.floor((Date.now()-d)/1000);
  if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago';
  if(s<86400) return Math.floor(s/3600)+'h ago';
  const days=Math.floor(s/86400); return days<30?days+'d ago':Math.floor(days/30)+'mo ago';
}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}

let toastTimer;
function showToast(msg,type='ok'){
  const t=document.getElementById('toast');t.textContent=msg;
  t.className='toast show '+type;t.style.pointerEvents='';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.className='toast'},3000);
}

loadPages();
</script>
</body>
</html>`;
}

// ── Start ──────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Shipfast running on :${PORT}`));

module.exports = app;

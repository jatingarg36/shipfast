const config = require("../config");

/**
 * Auth Templates
 * Single Responsibility: HTML templates for authentication pages
 */

/**
 * Generate login page HTML
 * @param {string} next - URL to redirect to after login
 * @param {string} error - Error message (if any)
 * @returns {string} - Complete HTML document
 */
function loginHtml(next, error) {
  const googleError = error === "google";
  const pwError = error === "1";
  const googleBtn = config.GOOGLE_AUTH_ENABLED
    ? `
    <a href="/auth/google?next=${encodeURIComponent(next)}" class="google-btn">
      <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Sign in with Google
    </a>
    <div class="divider"><span>or</span></div>
    ${googleError ? '<div class="error" style="display:block;text-align:center;margin-bottom:.75rem">Google sign-in failed. Try again.</div>' : ""}
  `
    : "";

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
    <input type="password" name="password" placeholder="Enter admin password" ${config.GOOGLE_AUTH_ENABLED ? "" : "autofocus"} required/>
    <div class="error">Wrong password. Try again.</div>
    <button type="submit">Sign in as Admin</button>
  </form>
</div></body></html>`;
}

module.exports = {
  loginHtml,
};

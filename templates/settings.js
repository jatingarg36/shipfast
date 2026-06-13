/**
 * Settings Page Template
 * Single Responsibility: render the user settings page.
 *
 * The AI Assistant section is entirely client-side: provider/key/model are
 * stored in localStorage and NEVER sent to the server. Revoking clears the
 * key locally; saved chats are kept server-side.
 */

/**
 * @param {Object} user - current user
 * @returns {string} - HTML
 */
function settingsHtml(user) {
  const displayName = (user.displayName || "User").replace(/</g, "&lt;");
  const email = (user.email || "").replace(/</g, "&lt;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Settings &mdash; Shipfast</title>
<style>
  :root { --bg:#0c0a09; --panel:#171412; --border:rgba(255,255,255,.09);
    --text:#e7e5e4; --muted:#a8a29e; --accent:#fb923c; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--text);
    font:15px/1.55 Inter,system-ui,sans-serif; min-height:100vh; }
  nav { border-bottom:1px solid var(--border); background:rgba(12,10,9,.8); }
  .nav-inner { max-width:760px; margin:0 auto; padding:.8rem 1.2rem;
    display:flex; align-items:center; gap:.6rem; }
  .logo { width:26px;height:26px;border-radius:7px;
    background:linear-gradient(135deg,#f97316,#ef4444);
    display:grid;place-items:center;font-size:12px }
  .brand { font-weight:800; } .brand span { color:var(--accent); }
  nav a { color:var(--muted); text-decoration:none; font-size:.8rem; margin-left:auto; }
  nav a:hover { color:var(--accent); }
  .wrap { max-width:760px; margin:0 auto; padding:2rem 1.2rem; }
  h1 { font-size:1.4rem; margin-bottom:1.4rem; }
  .card { background:var(--panel); border:1px solid var(--border);
    border-radius:14px; padding:1.4rem; margin-bottom:1.4rem; }
  .card h2 { font-size:1rem; margin-bottom:.25rem; }
  .card .sub { color:var(--muted); font-size:.8rem; margin-bottom:1.1rem; }
  label { display:block; font-size:.72rem; font-weight:700; color:var(--muted);
    margin:.9rem 0 .3rem; text-transform:uppercase; letter-spacing:.04em; }
  input, select { width:100%; background:var(--bg); color:var(--text);
    border:1px solid var(--border); border-radius:8px; padding:.55rem .7rem;
    font:inherit; font-size:.85rem; }
  input:focus, select:focus { outline:none; border-color:rgba(251,146,60,.5); }
  .row { display:flex; gap:.6rem; align-items:center; }
  .btn { border:none; border-radius:8px; padding:.6rem 1.1rem; font-weight:700;
    cursor:pointer; font-size:.83rem; }
  .btn-primary { background:linear-gradient(135deg,#f97316,#ef4444); color:#fff; }
  .btn-ghost { background:none; border:1px solid var(--border); color:var(--muted); }
  .btn-ghost:hover { color:var(--text); }
  .btn-danger { background:rgba(239,68,68,.12); border:1px solid rgba(239,68,68,.4);
    color:#fca5a5; }
  .status { font-size:.78rem; margin-top:.8rem; min-height:1.2em; }
  .status.ok { color:#86efac; } .status.bad { color:#fca5a5; }
  .pill { display:inline-block; font-size:.68rem; font-weight:700; padding:.15rem .55rem;
    border-radius:999px; margin-left:.5rem; vertical-align:middle; }
  .pill.on { background:rgba(134,239,172,.12); color:#86efac; }
  .pill.off { background:rgba(168,162,158,.12); color:var(--muted); }
  .note { font-size:.74rem; color:var(--muted); margin-top:.9rem; line-height:1.5; }
  .profile-line { font-size:.85rem; color:var(--muted); }
  .profile-line b { color:var(--text); }
</style>
</head>
<body>
<nav><div class="nav-inner">
  <div class="logo">S</div><div class="brand">Ship<span>fast</span></div>
  <a href="/changelog" style="margin-left:auto;margin-right:1rem">Changelog</a>
  <a href="/" style="margin-left:0">&larr; Back to dashboard</a>
</div></nav>

<div class="wrap">
  <h1>Settings</h1>

  <div class="card">
    <h2>Profile</h2>
    <div class="sub">Signed in account</div>
    <div class="profile-line"><b>${displayName}</b>${email ? " &mdash; " + email : ""}</div>
  </div>

  <div class="card">
    <h2>AI Assistant <span class="pill off" id="statusPill">Disabled</span></h2>
    <div class="sub">Chat with an AI about any published page. Your API key is stored
      only in this browser and is sent directly to your LLM provider
      &mdash; it never reaches ShipFast servers.</div>

    <label>Provider</label>
    <select id="provider">
      <option value="anthropic">Anthropic (Claude)</option>
      <option value="openai">OpenAI</option>
      <option value="gemini">Google Gemini</option>
      <option value="litellm">LiteLLM proxy</option>
      <option value="custom">OpenAI-compatible (custom URL)</option>
    </select>

    <label>API key</label>
    <div class="row">
      <input id="apiKey" type="password" placeholder="sk-..." autocomplete="off"/>
      <button type="button" class="btn btn-ghost" id="toggleKey">Show</button>
    </div>

    <div id="baseWrap" style="display:none">
      <label>Base URL</label>
      <input id="baseUrl" type="text" placeholder="e.g. https://litellm.mycompany.com/v1"/>
      <div class="note" style="margin-top:.35rem">For LiteLLM: your proxy's OpenAI-compatible
        endpoint. The proxy must allow CORS from this site, and the model field should match
        a model/alias configured on the proxy.</div>
    </div>

    <label>Model <span style="font-weight:400;text-transform:none">(optional &mdash; provider default used if blank)</span></label>
    <input id="model" type="text" placeholder="e.g. claude-sonnet-4-6"/>

    <div class="row" style="margin-top:1.2rem">
      <button type="button" class="btn btn-primary" id="saveBtn">Save &amp; enable</button>
      <button type="button" class="btn btn-ghost" id="testBtn">Test key</button>
      <button type="button" class="btn btn-danger" id="revokeBtn" style="margin-left:auto">Revoke access</button>
    </div>
    <div class="status" id="status"></div>

    <div class="note">
      <b>Revoking</b> removes the key from this browser and disables the assistant;
      your saved chats are kept and reappear when you re-enable.
      The key lives in this browser's <i>local storage</i>: it works across tabs and
      survives restarts, and is removed only when you revoke it here.
    </div>
  </div>
</div>

<script>
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var needsBase = function (p) { return p === "custom" || p === "litellm"; };

  function refresh() {
    var on = localStorage.getItem("sf_ai_enabled") === "1" && localStorage.getItem("sf_ai_key");
    var pill = $("statusPill");
    pill.textContent = on ? "Enabled" : "Disabled";
    pill.className = "pill " + (on ? "on" : "off");
    $("provider").value = localStorage.getItem("sf_ai_provider") || "anthropic";
    $("apiKey").value = localStorage.getItem("sf_ai_key") || "";
    $("baseUrl").value = localStorage.getItem("sf_ai_base") || "";
    $("model").value = localStorage.getItem("sf_ai_model") || "";
    $("baseWrap").style.display = needsBase($("provider").value) ? "block" : "none";
  }

  function setStatus(text, ok) {
    var s = $("status");
    s.textContent = text;
    s.className = "status " + (ok ? "ok" : "bad");
  }

  $("provider").onchange = function () {
    $("baseWrap").style.display = needsBase(this.value) ? "block" : "none";
  };

  $("toggleKey").onclick = function () {
    var k = $("apiKey");
    k.type = k.type === "password" ? "text" : "password";
    this.textContent = k.type === "password" ? "Show" : "Hide";
  };

  $("saveBtn").onclick = function () {
    var key = $("apiKey").value.trim();
    if (!key) { setStatus("Enter an API key first.", false); return; }
    if (needsBase($("provider").value) && !$("baseUrl").value.trim()) {
      setStatus("Base URL is required for this provider.", false); return;
    }
    localStorage.setItem("sf_ai_enabled", "1");
    localStorage.setItem("sf_ai_provider", $("provider").value);
    localStorage.setItem("sf_ai_key", key);
    localStorage.setItem("sf_ai_base", $("baseUrl").value.trim());
    localStorage.setItem("sf_ai_model", $("model").value.trim());
    setStatus("Saved. The assistant is now available on your pages (this tab).", true);
    refresh();
  };

  $("revokeBtn").onclick = function () {
    localStorage.removeItem("sf_ai_enabled");
    localStorage.removeItem("sf_ai_key");
    localStorage.removeItem("sf_ai_provider");
    localStorage.removeItem("sf_ai_base");
    localStorage.removeItem("sf_ai_model");
    setStatus("Access revoked — key removed from this browser. Saved chats are kept.", true);
    refresh();
  };

  $("testBtn").onclick = function () {
    var provider = $("provider").value;
    var key = $("apiKey").value.trim();
    if (!key) { setStatus("Enter an API key first.", false); return; }
    setStatus("Testing key\\u2026", true);
    var req;
    if (provider === "anthropic") {
      req = fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({ model: $("model").value.trim() || "claude-sonnet-4-6",
          max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      });
    } else if (provider === "gemini") {
      var m = $("model").value.trim() || "gemini-flash-latest";
      req = fetch("https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(m) + ":generateContent", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "hi" }] }] }),
      });
    } else {
      // openai, litellm, custom — all OpenAI-compatible
      var base = needsBase(provider)
        ? $("baseUrl").value.trim().replace(/\\/+$/, "")
        : "https://api.openai.com/v1";
      if (!base) { setStatus("Base URL is required for this provider.", false); return; }
      req = fetch(base + "/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
        body: JSON.stringify({ model: $("model").value.trim() || "gpt-4o-mini",
          max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
      });
    }
    req.then(function (r) {
      if (r.ok) setStatus("Key works \\u2713", true);
      else if (r.status === 401 || r.status === 403) setStatus("Key rejected by provider (" + r.status + ").", false);
      else setStatus("Provider responded with " + r.status + " — key may still be valid.", false);
    }).catch(function () {
      setStatus("Could not reach provider (network/CORS).", false);
    });
  };

  refresh();
})();
</script>
</body>
</html>`;
}

module.exports = { settingsHtml };

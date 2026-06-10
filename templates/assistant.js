/**
 * Assistant Templates
 * Single Responsibility: generate the assistant loader script (injected into
 * published pages) and the chat panel HTML (rendered inside a sandboxed iframe).
 *
 * Security model:
 * - The LLM API key lives in browser localStorage only and is read inside
 *   the panel iframe. It is sent directly to the LLM provider — never to
 *   ShipFast.
 * - The panel runs in an iframe so page-authored scripts/styles can't touch
 *   the chat UI. (Same-origin storage exposure is a documented residual risk;
 *   long-term fix is a user-content subdomain.)
 */

/**
 * Loader script — injected into /p/:slug for authenticated users.
 * Creates the "AI" pill, the panel iframe, selection handling, and the
 * postMessage bridge that feeds page context to the panel.
 * @returns {string}
 */
function assistantLoaderJs() {
  return `(function () {
  "use strict";
  if (window.__sfAiLoaded) return;
  window.__sfAiLoaded = true;

  var script = document.currentScript || document.querySelector("script[data-sf-assistant]");
  var SLUG = (script && script.getAttribute("data-slug")) || "";
  if (!SLUG) return;
  var ORIGIN = location.origin;

  // ── Page context extraction (capped ~8K chars) ──────────────────────────
  function pageText() {
    var clone = document.body.cloneNode(true);
    var junk = clone.querySelectorAll("script,style,noscript,iframe,[data-sf-ai]");
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    var text = (clone.textContent || "").replace(/\\s+/g, " ").trim();
    if (text.length > 8000) text = text.slice(0, 8000) + " [page content truncated]";
    return text;
  }

  // ── Panel iframe ─────────────────────────────────────────────────────────
  var iframe = null;
  var panelOpen = false;

  function ensureIframe() {
    if (iframe) return iframe;
    iframe = document.createElement("iframe");
    iframe.src = "/assistant/panel?slug=" + encodeURIComponent(SLUG);
    iframe.setAttribute("data-sf-ai", "1");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation");
    iframe.style.cssText = "position:fixed;top:0;right:0;height:100vh;width:min(380px,100vw);" +
      "border:none;border-left:1px solid rgba(255,255,255,.1);z-index:2147483000;" +
      "box-shadow:-8px 0 32px rgba(0,0,0,.45);background:#0c0a09;" +
      "transform:translateX(100%);transition:transform .25s ease";
    document.body.appendChild(iframe);
    return iframe;
  }

  function openPanel() {
    ensureIframe();
    requestAnimationFrame(function () { iframe.style.transform = "translateX(0)"; });
    panelOpen = true;
    pill.style.display = "none";
  }

  function closePanel() {
    if (iframe) iframe.style.transform = "translateX(100%)";
    panelOpen = false;
    pill.style.display = "flex";
  }

  // ── AI pill (sits above the Shipfast badge) ──────────────────────────────
  var pill = document.createElement("button");
  pill.setAttribute("data-sf-ai", "1");
  pill.innerHTML = "&#10024; AI";
  pill.style.cssText = "position:fixed;bottom:52px;right:12px;z-index:2147482999;" +
    "background:rgba(12,10,9,.92);border:1px solid rgba(251,146,60,.35);cursor:pointer;" +
    "border-radius:8px;padding:6px 12px;font:600 11px Inter,system-ui,sans-serif;" +
    "color:#fb923c;display:flex;align-items:center;gap:4px;opacity:.85";
  pill.onmouseover = function () { pill.style.opacity = "1"; };
  pill.onmouseout = function () { pill.style.opacity = ".85"; };
  pill.onclick = function () { openPanel(); };
  document.body.appendChild(pill);

  // ── Text selection → "Ask AI" affordance ────────────────────────────────
  var askBtn = document.createElement("button");
  askBtn.setAttribute("data-sf-ai", "1");
  askBtn.textContent = "Ask AI about this";
  askBtn.style.cssText = "position:absolute;display:none;z-index:2147483001;cursor:pointer;" +
    "background:#fb923c;color:#0c0a09;border:none;border-radius:6px;padding:4px 10px;" +
    "font:600 11px Inter,system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.4)";
  document.body.appendChild(askBtn);
  var pendingSelection = "";

  document.addEventListener("mouseup", function (e) {
    if (e.target === askBtn || (iframe && e.target === iframe)) return;
    setTimeout(function () {
      var sel = window.getSelection();
      var text = sel ? sel.toString().trim() : "";
      if (text.length >= 4 && text.length <= 4000 && sel.rangeCount) {
        var rect = sel.getRangeAt(0).getBoundingClientRect();
        pendingSelection = text;
        askBtn.style.left = Math.max(8, rect.left + window.scrollX) + "px";
        askBtn.style.top = (rect.bottom + window.scrollY + 6) + "px";
        askBtn.style.display = "block";
      } else {
        askBtn.style.display = "none";
      }
    }, 0);
  });

  askBtn.onclick = function () {
    askBtn.style.display = "none";
    var text = pendingSelection;
    openPanel();
    // Panel may still be loading — retry briefly until it acks readiness
    var tries = 0;
    var send = function () {
      if (panelReady) {
        iframe.contentWindow.postMessage({ type: "sf-ai-selection", text: text }, ORIGIN);
      } else if (tries++ < 40) {
        setTimeout(send, 150);
      }
    };
    send();
  };

  // ── postMessage bridge ───────────────────────────────────────────────────
  var panelReady = false;
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || !iframe || e.source !== iframe.contentWindow) return;
    var msg = e.data || {};
    if (msg.type === "sf-ai-ready") {
      panelReady = true;
      iframe.contentWindow.postMessage({
        type: "sf-ai-context",
        slug: SLUG,
        title: document.title,
        url: location.href,
        text: pageText(),
      }, ORIGIN);
    } else if (msg.type === "sf-ai-close") {
      closePanel();
    }
  });
})();
`;
}

/**
 * Chat panel HTML — served at /assistant/panel?slug=… (auth required),
 * rendered inside the sandboxed iframe.
 * @param {string} slug - validated upstream
 * @returns {string}
 */
function assistantPanelHtml(slug) {
  const SLUG_JSON = JSON.stringify(slug);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>AI Assistant</title>
<style>
  :root { --bg:#0c0a09; --panel:#171412; --border:rgba(255,255,255,.09);
    --text:#e7e5e4; --muted:#a8a29e; --accent:#fb923c; --accent2:#ef4444; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--text); height:100vh; display:flex;
    flex-direction:column; font:14px/1.5 Inter,system-ui,sans-serif; }
  header { display:flex; align-items:center; gap:.5rem; padding:.6rem .75rem;
    border-bottom:1px solid var(--border); background:var(--panel); }
  header .logo { width:22px;height:22px;border-radius:6px;flex:none;
    background:linear-gradient(135deg,#f97316,#ef4444);display:grid;
    place-items:center;font-size:11px }
  select { background:var(--bg); color:var(--text); border:1px solid var(--border);
    border-radius:6px; padding:.3rem .4rem; font-size:.75rem; flex:1; min-width:0; }
  .iconbtn { background:none; border:1px solid var(--border); color:var(--muted);
    border-radius:6px; padding:.3rem .55rem; cursor:pointer; font-size:.75rem; flex:none; }
  .iconbtn:hover { color:var(--accent); border-color:rgba(251,146,60,.4); }
  .iconbtn:disabled, select:disabled { opacity:.45; cursor:default; }
  #msgs { flex:1; overflow-y:auto; padding: .9rem .75rem; display:flex;
    flex-direction:column; gap:.65rem; }
  .msg { max-width:92%; padding:.55rem .7rem; border-radius:10px; font-size:.83rem;
    word-wrap:break-word; overflow-wrap:anywhere; }
  .msg.user { align-self:flex-end; background:rgba(251,146,60,.14);
    border:1px solid rgba(251,146,60,.25); white-space:pre-wrap; }
  .msg.assistant { align-self:flex-start; background:var(--panel);
    border:1px solid var(--border); }
  /* Markdown rendered inside assistant bubbles — keep it tight in a narrow panel */
  .msg.assistant p { margin:0 0 .45rem; }
  .msg.assistant p:last-child { margin-bottom:0; }
  .msg.assistant ul, .msg.assistant ol { margin:.25rem 0 .45rem; padding-left:1.2rem; }
  .msg.assistant li { margin:.1rem 0; }
  .msg.assistant h1, .msg.assistant h2, .msg.assistant h3, .msg.assistant h4 {
    margin:.4rem 0 .25rem; font-size:.9rem; font-weight:700; color:var(--text); }
  .msg.assistant strong { color:#fed7aa; }
  .msg.assistant em { color:var(--text); }
  .msg.assistant a { color:var(--accent); text-decoration:underline; }
  .msg.assistant code { background:rgba(255,255,255,.07); border:1px solid var(--border);
    border-radius:4px; padding:0 .25rem; font:.78rem ui-monospace,SFMono-Regular,Menlo,monospace; }
  .msg.assistant pre { background:#0a0807; border:1px solid var(--border);
    border-radius:6px; padding:.5rem .6rem; margin:.35rem 0; overflow-x:auto; }
  .msg.assistant pre code { background:none; border:none; padding:0;
    font-size:.75rem; white-space:pre; color:#fde68a; }
  .msg .sel { display:block; border-left:3px solid var(--accent); padding:.15rem .5rem;
    margin-bottom:.4rem; color:var(--muted); font-size:.74rem; font-style:italic; }
  .msg.assistant.failed { border-color:rgba(239,68,68,.45); color:#fca5a5; }
  .retrybtn { display:block; margin-top:.5rem; background:rgba(251,146,60,.12);
    border:1px solid rgba(251,146,60,.4); color:var(--accent); border-radius:6px;
    padding:.3rem .7rem; font:600 .72rem Inter,system-ui,sans-serif; cursor:pointer; }
  .retrybtn:hover { background:rgba(251,146,60,.2); }
  .tdots i { display:inline-block; width:6px; height:6px; border-radius:50%;
    background:var(--muted); margin-right:4px; animation:sfBlink 1.2s infinite; }
  .tdots i:nth-child(2) { animation-delay:.2s; }
  .tdots i:nth-child(3) { animation-delay:.4s; }
  @keyframes sfBlink { 0%,80%,100% { opacity:.2 } 40% { opacity:1 } }
  .hint { color:var(--muted); font-size:.78rem; text-align:center; margin:auto;
    padding:1rem; }
  .err { color:#fca5a5; font-size:.75rem; padding:.4rem .75rem; }
  #selchip { display:none; margin:.25rem .75rem 0; padding:.35rem .6rem; font-size:.72rem;
    color:var(--muted); background:var(--panel); border:1px dashed rgba(251,146,60,.4);
    border-radius:8px; align-items:center; gap:.5rem; }
  #selchip button { margin-left:auto; background:none;border:none;color:var(--muted);
    cursor:pointer; }
  footer { padding:.6rem .75rem; border-top:1px solid var(--border);
    display:flex; gap:.5rem; background:var(--panel); }
  textarea { flex:1; resize:none; background:var(--bg); color:var(--text);
    border:1px solid var(--border); border-radius:8px; padding:.5rem .6rem;
    font:inherit; font-size:.83rem; height:60px; }
  textarea:focus { outline:none; border-color:rgba(251,146,60,.5); }
  .send { background:linear-gradient(135deg,#f97316,#ef4444); color:#fff; border:none;
    border-radius:8px; padding:0 .9rem; font-weight:700; cursor:pointer; }
  .send:disabled { opacity:.45; cursor:default; }
  /* setup view */
  #setup { flex:1; padding:1.2rem .9rem; display:none; flex-direction:column; gap:.7rem; }
  #setup label { font-size:.72rem; color:var(--muted); font-weight:600; }
  #setup input, #setup select { width:100%; background:var(--bg); color:var(--text);
    border:1px solid var(--border); border-radius:8px; padding:.5rem .6rem; font-size:.8rem; }
  #setup .save { background:linear-gradient(135deg,#f97316,#ef4444); color:#fff;
    border:none; border-radius:8px; padding:.6rem; font-weight:700; cursor:pointer; }
  #setup .note { font-size:.7rem; color:var(--muted); line-height:1.45; }
  #setup a { color:var(--accent); }
</style>
</head>
<body>
<header>
  <div class="logo">&#9889;</div>
  <select id="chatList" title="Chat history"><option value="">New chat</option></select>
  <button class="iconbtn" id="newChat" title="Start a fresh chat">+</button>
  <button class="iconbtn" id="closeBtn" title="Close">&times;</button>
</header>

<div id="setup">
  <div style="font-weight:700">Enable AI Assistant</div>
  <div class="note">Your API key is stored only in this browser
    and is sent directly to your LLM provider &mdash; it never reaches ShipFast servers.
    Manage or revoke it any time from <a href="/settings" target="_top">Settings</a>.</div>
  <label>Provider</label>
  <select id="suProvider">
    <option value="anthropic">Anthropic (Claude)</option>
    <option value="openai">OpenAI</option>
    <option value="gemini">Google Gemini</option>
    <option value="litellm">LiteLLM proxy</option>
    <option value="custom">OpenAI-compatible (custom URL)</option>
  </select>
  <label>API key</label>
  <input id="suKey" type="password" placeholder="sk-..." autocomplete="off"/>
  <div id="suBaseWrap" style="display:none">
    <label>Base URL</label>
    <input id="suBase" type="text" placeholder="https://my-llm.example.com/v1"/>
  </div>
  <label>Model <span style="font-weight:400">(optional, provider default used)</span></label>
  <input id="suModel" type="text" placeholder="leave blank for default"/>
  <button class="save" id="suSave">Enable assistant</button>
</div>

<div id="msgs" style="display:none"><div class="hint" id="hint">Ask anything about this page,
or select text on the page and click &ldquo;Ask AI about this&rdquo;.</div></div>
<div id="selchip"><span id="selchipText"></span><button id="selclear">&times;</button></div>
<div class="err" id="err" style="display:none"></div>
<footer style="display:none" id="composer">
  <textarea id="input" placeholder="Ask about this page&hellip;" maxlength="4000"></textarea>
  <button class="send" id="sendBtn">&#10148;</button>
</footer>

<script>
(function () {
  "use strict";
  var SLUG = ${SLUG_JSON};
  var ORIGIN = location.origin;
  var S = {
    enabled: function () { return localStorage.getItem("sf_ai_enabled") === "1"; },
    key: function () { return localStorage.getItem("sf_ai_key") || ""; },
    provider: function () { return localStorage.getItem("sf_ai_provider") || "anthropic"; },
    base: function () { return localStorage.getItem("sf_ai_base") || ""; },
    model: function () { return localStorage.getItem("sf_ai_model") || ""; },
  };

  var DEFAULT_MODELS = {
    anthropic: "claude-sonnet-4-6",
    openai: "gpt-4o-mini",
    gemini: "gemini-flash-latest",
    litellm: "",
    custom: "",
  };

  // ── Minimal, safe markdown renderer ─────────────────────────────────────
  // The chat panel renders only a restricted markdown subset: fenced + inline
  // code, bold, italic, http(s) links, ordered/unordered lists, and h1-h4.
  // All other input is treated as plain prose and HTML-escaped. Incomplete
  // tokens during streaming (e.g. an unclosed \`\`\`) just fall through as
  // escaped text — they fix themselves on the next chunk.
  function escapeHtml(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function renderMarkdown(text) {
    if (!text) return "";
    var blocks = [];
    // 1) Pull out fenced code blocks first so inline rules don't touch them.
    text = text.replace(/\`\`\`([^\\n\`]*)\\n?([\\s\\S]*?)\`\`\`/g,
      function (_, _lang, code) {
        blocks.push(code.replace(/\\n$/, ""));
        return "\\u0000CB" + (blocks.length - 1) + "\\u0000";
      });
    // 2) Escape everything else exactly once.
    text = escapeHtml(text);
    // 3) Inline rules. Order matters: code before emphasis; bold before italic.
    text = text.replace(/\`([^\`\\n]+)\`/g, "<code>$1</code>");
    text = text.replace(/\\*\\*([^\\n*]+)\\*\\*/g, "<strong>$1</strong>");
    text = text.replace(/__([^\\n_]+)__/g, "<strong>$1</strong>");
    text = text.replace(/(^|[\\s(])\\*([^\\s*][^\\n*]*?)\\*(?=[\\s).,!?:;]|$)/g, "$1<em>$2</em>");
    text = text.replace(/(^|[\\s(])_([^\\s_][^\\n_]*?)_(?=[\\s).,!?:;]|$)/g, "$1<em>$2</em>");
    // http(s) links only — anything else (javascript:, data:) stays as text.
    text = text.replace(/\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // 4) Block pass: headers, lists, paragraphs, code-block placeholders.
    var lines = text.split("\\n");
    var out = [];
    var inList = null;
    var para = [];
    function flushPara() {
      if (para.length) { out.push("<p>" + para.join("<br/>") + "</p>"); para = []; }
    }
    function flushList() {
      if (inList) { out.push("</" + inList + ">"); inList = null; }
    }
    for (var i = 0; i < lines.length; i++) {
      var t = lines[i].trim();
      var cb = t.match(/^\\u0000CB(\\d+)\\u0000$/);
      if (cb) {
        flushPara(); flushList();
        out.push("<pre><code>" + escapeHtml(blocks[+cb[1]]) + "</code></pre>");
        continue;
      }
      if (!t) { flushPara(); flushList(); continue; }
      var h = t.match(/^(#{1,4})\\s+(.+)$/);
      if (h) {
        flushPara(); flushList();
        var lvl = h[1].length;
        out.push("<h" + lvl + ">" + h[2] + "</h" + lvl + ">");
        continue;
      }
      var ul = t.match(/^[-*+]\\s+(.+)$/);
      if (ul) {
        flushPara();
        if (inList !== "ul") { flushList(); out.push("<ul>"); inList = "ul"; }
        out.push("<li>" + ul[1] + "</li>");
        continue;
      }
      var ol = t.match(/^\\d+\\.\\s+(.+)$/);
      if (ol) {
        flushPara();
        if (inList !== "ol") { flushList(); out.push("<ol>"); inList = "ol"; }
        out.push("<li>" + ol[1] + "</li>");
        continue;
      }
      flushList();
      para.push(t);
    }
    flushPara(); flushList();
    return out.join("");
  }

  var pageCtx = { title: "", url: "", text: "" };
  var chatId = null;          // server chat id (created lazily on first send)
  var history = [];           // [{role, content, selection?}] — full, for UI + persistence
  var pendingSelection = "";
  var busy = false;
  var controller = null;      // AbortController for the in-flight provider call
  var stoppedByUser = false;
  var REQUEST_TIMEOUT_MS = 90000;

  var el = function (id) { return document.getElementById(id); };
  var msgs = el("msgs"), input = el("input"), err = el("err");

  // ── View switching ───────────────────────────────────────────────────────
  function refreshView() {
    var ok = S.enabled() && S.key();
    el("setup").style.display = ok ? "none" : "flex";
    msgs.style.display = ok ? "flex" : "none";
    el("composer").style.display = ok ? "flex" : "none";
    if (ok) loadChatList();
  }

  function needsBase(p) { return p === "custom" || p === "litellm"; }

  el("suProvider").onchange = function () {
    el("suBaseWrap").style.display = needsBase(this.value) ? "block" : "none";
  };
  el("suSave").onclick = function () {
    var key = el("suKey").value.trim();
    if (!key) { showErr("Enter an API key"); return; }
    if (needsBase(el("suProvider").value) && !el("suBase").value.trim()) {
      showErr("Base URL is required for this provider"); return;
    }
    localStorage.setItem("sf_ai_enabled", "1");
    localStorage.setItem("sf_ai_provider", el("suProvider").value);
    localStorage.setItem("sf_ai_key", key);
    localStorage.setItem("sf_ai_base", el("suBase").value.trim());
    localStorage.setItem("sf_ai_model", el("suModel").value.trim());
    refreshView();
  };

  el("closeBtn").onclick = function () {
    parent.postMessage({ type: "sf-ai-close" }, ORIGIN);
  };

  function showErr(text) {
    err.textContent = text;
    err.style.display = "block";
    setTimeout(function () { err.style.display = "none"; }, 6000);
  }

  // ── Chat rendering ───────────────────────────────────────────────────────
  // Only auto-scroll when the user is already near the bottom — never yank
  // them away while they're reading earlier messages.
  function nearBottom() {
    return msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
  }

  function addBubble(role, content, selection) {
    var hint = el("hint");
    if (hint) hint.remove();
    var div = document.createElement("div");
    div.className = "msg " + role;
    if (selection) {
      var q = document.createElement("span");
      q.className = "sel";
      q.textContent = "\\u201C" + (selection.length > 200 ? selection.slice(0, 200) + "\\u2026" : selection) + "\\u201D";
      div.appendChild(q);
    }
    var body = document.createElement("span");
    if (role === "assistant" && content) {
      body.innerHTML = renderMarkdown(content);
    } else {
      body.textContent = content;
    }
    div.appendChild(body);
    msgs.appendChild(div);
    msgs.scrollTop = msgs.scrollHeight;
    return body;
  }

  function resetChat() {
    chatId = null;
    history = [];
    msgs.innerHTML = '<div class="hint" id="hint">Ask anything about this page, ' +
      'or select text on the page and click \\u201CAsk AI about this\\u201D.</div>';
    el("chatList").value = "";
  }

  // ── Chat persistence (ShipFast API — transcripts only, never the key) ───
  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    opts.credentials = "same-origin";
    return fetch(path, opts).then(function (r) {
      if (r.status === 401) {
        throw new Error("Your session expired — refresh the page and log in again.");
      }
      if (!r.ok) return r.json().catch(function(){return {};}).then(function (b) {
        throw new Error(b.error || ("Request failed: " + r.status));
      });
      return r.json();
    });
  }

  function loadChatList() {
    api("/api/assistant/chats?slug=" + encodeURIComponent(SLUG)).then(function (data) {
      var sel = el("chatList");
      var current = chatId || "";
      sel.innerHTML = '<option value="">New chat</option>';
      (data.chats || []).forEach(function (c) {
        var o = document.createElement("option");
        o.value = c.id;
        o.textContent = c.title;
        sel.appendChild(o);
      });
      sel.value = current;
    }).catch(function () { /* non-critical */ });
  }

  el("chatList").onchange = function () {
    if (busy) { this.value = chatId || ""; return; } // no switching mid-generation
    var id = this.value;
    if (!id) { resetChat(); return; }
    api("/api/assistant/chats/" + id).then(function (data) {
      chatId = data.chatId;
      history = data.messages || [];
      msgs.innerHTML = "";
      history.forEach(function (m) { addBubble(m.role, m.content, m.selection); });
    }).catch(function (e) { showErr(e.message); });
  };

  el("newChat").onclick = resetChat;

  function persist(pair) {
    var ensure = chatId
      ? Promise.resolve({ chatId: chatId })
      : api("/api/assistant/chats", { method: "POST", body: JSON.stringify({ slug: SLUG }) });
    return ensure.then(function (d) {
      chatId = d.chatId;
      return api("/api/assistant/chats/" + chatId + "/messages", {
        method: "POST",
        body: JSON.stringify({ messages: pair }),
      });
    }).then(loadChatList);
  }

  // ── Context assembly (sliding window) ────────────────────────────────────
  var HISTORY_BUDGET = 20000; // chars ≈ 5K tokens

  function systemPrompt() {
    return "You are an AI assistant embedded in a published web page on ShipFast. " +
      "Help the user understand and work with this page. Be concise.\\n\\n" +
      "Formatting rules (the chat panel is narrow and renders only a limited " +
      "subset of markdown):\\n" +
      "- Default to plain prose. Do not use markdown unless it clearly helps.\\n" +
      "- Allowed when useful: **bold** for key terms, \`inline code\`, fenced " +
      "code blocks for snippets, short bulleted lists (- item) for 3+ parallel " +
      "items, [text](https://url) for links.\\n" +
      "- Avoid: headings (#, ##), tables, blockquotes, nested lists, horizontal " +
      "rules, and HTML.\\n" +
      "- Keep responses tight: a few sentences, or a short list. No preamble, " +
      "no recap.\\n\\n" +
      "Page title: " + pageCtx.title + "\\nPage URL: " + pageCtx.url +
      "\\n\\nPage content:\\n" + pageCtx.text;
  }

  function windowedHistory() {
    var size = function (m) { return m.content.length + (m.selection ? m.selection.length : 0); };
    var total = history.reduce(function (a, m) { return a + size(m); }, 0);
    if (total <= HISTORY_BUDGET) return history.slice();
    // keep first user/assistant exchange + most recent turns that fit
    var head = history.slice(0, 2);
    var budget = HISTORY_BUDGET - head.reduce(function (a, m) { return a + size(m); }, 0);
    var tail = [];
    for (var i = history.length - 1; i >= 2 && budget > 0; i--) {
      budget -= size(history[i]);
      if (budget >= 0) tail.unshift(history[i]);
    }
    return head.concat([{ role: "assistant", content: "[earlier conversation omitted]" }], tail);
  }

  function providerMessages() {
    return windowedHistory().map(function (m) {
      var content = m.selection
        ? 'Regarding this excerpt from the page: "' + m.selection + '"\\n\\n' + m.content
        : m.content;
      return { role: m.role, content: content };
    });
  }

  // ── Provider errors → actionable messages ───────────────────────────────
  function providerError(status, bodyText) {
    var detail = "";
    try {
      var j = JSON.parse(bodyText);
      detail = (j.error && (j.error.message || j.error)) || j.message || "";
      if (typeof detail !== "string") detail = JSON.stringify(detail);
    } catch (_) { detail = String(bodyText || "").slice(0, 180); }
    var hint;
    if (status === 401 || status === 403) hint = "Your API key was rejected. Check it in Settings.";
    else if (status === 404) hint = "Model not found. Set a valid model name in Settings.";
    else if (status === 429) hint = "Rate limited by the provider. Wait a moment and try again.";
    else if (status >= 500) hint = "The provider is having issues. Try again shortly.";
    else hint = "Provider error " + status + ".";
    return new Error(hint + (detail ? " (" + detail.slice(0, 180) + ")" : ""));
  }

  function checkOk(r) {
    if (r.ok) return r;
    return r.text().then(function (t) { throw providerError(r.status, t); });
  }

  // ── Provider adapters (browser → provider; key never touches ShipFast) ──
  function readSse(response, onText) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buf = "";
    function pump() {
      return reader.read().then(function (r) {
        if (r.done) return;
        buf += decoder.decode(r.value, { stream: true });
        var lines = buf.split("\\n");
        buf = lines.pop();
        lines.forEach(function (line) {
          line = line.trim();
          if (!line.startsWith("data:")) return;
          var payload = line.slice(5).trim();
          if (payload === "[DONE]") return;
          try {
            var j = JSON.parse(payload);
            // anthropic stream
            if (j.type === "content_block_delta" && j.delta && j.delta.text) onText(j.delta.text);
            // openai stream
            if (j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content) {
              onText(j.choices[0].delta.content);
            }
          } catch (_) {}
        });
        return pump();
      });
    }
    return pump();
  }

  function callProvider(onText, signal) {
    var provider = S.provider();
    var model = S.model() || DEFAULT_MODELS[provider];
    var msgsOut = providerMessages();

    if (provider === "anthropic") {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: signal,
        headers: {
          "Content-Type": "application/json",
          "x-api-key": S.key(),
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: model, max_tokens: 1024, stream: true,
          system: systemPrompt(), messages: msgsOut,
        }),
      }).then(checkOk).then(function (r) { return readSse(r, onText); });
    }

    // LiteLLM exposes an OpenAI-compatible /chat/completions endpoint,
    // so it shares the OpenAI adapter (key sent as Bearer to the proxy)
    if (provider === "openai" || provider === "custom" || provider === "litellm") {
      var base = needsBase(provider)
        ? S.base().replace(/\\/+$/, "")
        : "https://api.openai.com/v1";
      if (!base) return Promise.reject(new Error("Base URL required for this provider"));
      return fetch(base + "/chat/completions", {
        method: "POST",
        signal: signal,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + S.key() },
        body: JSON.stringify({
          model: model || "gpt-4o-mini", stream: true,
          messages: [{ role: "system", content: systemPrompt() }].concat(msgsOut),
        }),
      }).then(checkOk).then(function (r) { return readSse(r, onText); });
    }

    if (provider === "gemini") {
      var contents = msgsOut.map(function (m) {
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
      });
      return fetch("https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent", {
        method: "POST",
        signal: signal,
        headers: { "Content-Type": "application/json", "X-goog-api-key": S.key() },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt() }] },
          contents: contents,
        }),
      }).then(checkOk).then(function (r) { return r.json(); }).then(function (j) {
        var t = j.candidates && j.candidates[0] && j.candidates[0].content &&
          j.candidates[0].content.parts.map(function (p) { return p.text || ""; }).join("");
        onText(t || "(no response)");
      });
    }

    return Promise.reject(new Error("Unknown provider: " + provider));
  }

  // ── Send flow ────────────────────────────────────────────────────────────
  function send() {
    var text = input.value.trim();
    if (!text || busy) return;
    input.value = "";
    var selection = pendingSelection;
    pendingSelection = "";
    el("selchip").style.display = "none";
    doSend(text, selection);
  }

  function setBusy(on) {
    busy = on;
    el("chatList").disabled = on;
    el("newChat").disabled = on;
    var btn = el("sendBtn");
    btn.innerHTML = on ? "&#9632;" : "&#10148;"; // stop / send
    btn.title = on ? "Stop generating" : "Send";
  }

  function doSend(text, selection) {
    if (busy) return;
    setBusy(true);
    stoppedByUser = false;
    controller = new AbortController();
    var timedOut = false;
    var timer = setTimeout(function () {
      timedOut = true;
      if (controller) controller.abort();
    }, REQUEST_TIMEOUT_MS);

    var userMsg = { role: "user", content: text };
    if (selection) userMsg.selection = selection;
    history.push(userMsg);
    addBubble("user", text, selection);

    var assistantBody = addBubble("assistant", "");
    // typing indicator until the first token arrives
    assistantBody.innerHTML = '<span class="tdots"><i></i><i></i><i></i></span>';
    var acc = "";

    function finalize(suffix) {
      assistantBody.innerHTML = renderMarkdown(acc + (suffix || ""));
      var assistantMsg = { role: "assistant", content: acc + (suffix || "") };
      history.push(assistantMsg);
      return persist([userMsg, assistantMsg]).catch(function (e) {
        showErr("Reply shown but not saved: " + e.message);
      });
    }

    callProvider(function (chunk) {
      var stick = nearBottom();
      acc += chunk;
      // Re-render the full accumulated text each chunk. The renderer tolerates
      // incomplete markdown (e.g. an unclosed code fence) by leaving the raw
      // characters in place until the closing token arrives.
      assistantBody.innerHTML = renderMarkdown(acc);
      if (stick) msgs.scrollTop = msgs.scrollHeight;
    }, controller.signal).then(function () {
      if (!acc) acc = "(empty response)";
      return finalize();
    }).catch(function (e) {
      var aborted = e && (e.name === "AbortError" || e.code === 20);
      // user stopped mid-stream with partial content → keep and save it
      if (aborted && stoppedByUser && acc) return finalize(" \\u2026[stopped]");

      history.pop(); // drop unanswered user msg from provider context
      var message;
      if (aborted && timedOut) message = "Timed out waiting for the provider (90s).";
      else if (aborted) message = "Generation stopped.";
      else if (e instanceof TypeError) message = "Could not reach the provider — network problem or the provider blocks browser (CORS) requests.";
      else message = e.message;

      var failedBubble = assistantBody.parentElement;
      failedBubble.classList.add("failed");
      assistantBody.textContent = "\\u26A0 " + message;
      // one-click retry of the same message
      var retry = document.createElement("button");
      retry.className = "retrybtn";
      retry.textContent = "\\u21BB Retry";
      retry.onclick = function () {
        if (busy) return;
        var userBubble = failedBubble.previousElementSibling;
        if (userBubble && userBubble.classList.contains("user")) userBubble.remove();
        failedBubble.remove();
        doSend(text, selection);
      };
      failedBubble.appendChild(retry);
    }).finally(function () {
      clearTimeout(timer);
      controller = null;
      setBusy(false);
      input.focus();
    });
  }

  el("sendBtn").onclick = function () {
    if (busy) {
      stoppedByUser = true;
      if (controller) controller.abort();
    } else {
      send();
    }
  };
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !busy) parent.postMessage({ type: "sf-ai-close" }, ORIGIN);
  });

  el("selclear").onclick = function () {
    pendingSelection = "";
    el("selchip").style.display = "none";
  };

  // ── Bridge with parent page ──────────────────────────────────────────────
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN) return;
    var msg = e.data || {};
    if (msg.type === "sf-ai-context") {
      pageCtx = { title: msg.title || "", url: msg.url || "", text: msg.text || "" };
    } else if (msg.type === "sf-ai-selection") {
      pendingSelection = String(msg.text || "").slice(0, 4000);
      var label = pendingSelection.length > 120 ? pendingSelection.slice(0, 120) + "\\u2026" : pendingSelection;
      el("selchipText").textContent = "Selected: \\u201C" + label + "\\u201D";
      el("selchip").style.display = "flex";
      input.focus();
    }
  });

  refreshView();
  parent.postMessage({ type: "sf-ai-ready" }, ORIGIN);
})();
</script>
</body>
</html>`;
}

module.exports = {
  assistantLoaderJs,
  assistantPanelHtml,
};

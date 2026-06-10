/**
 * Assistant Templates
 * Single Responsibility: generate the assistant loader script (injected into
 * published pages) and the chat panel HTML (rendered inside a sandboxed iframe).
 *
 * Security model:
 * - The LLM API key lives in browser sessionStorage only and is read inside
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
  #msgs { flex:1; overflow-y:auto; padding: .9rem .75rem; display:flex;
    flex-direction:column; gap:.65rem; }
  .msg { max-width:92%; padding:.55rem .7rem; border-radius:10px; font-size:.83rem;
    white-space:pre-wrap; word-wrap:break-word; }
  .msg.user { align-self:flex-end; background:rgba(251,146,60,.14);
    border:1px solid rgba(251,146,60,.25); }
  .msg.assistant { align-self:flex-start; background:var(--panel);
    border:1px solid var(--border); }
  .msg .sel { display:block; border-left:3px solid var(--accent); padding:.15rem .5rem;
    margin-bottom:.4rem; color:var(--muted); font-size:.74rem; font-style:italic; }
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
  <div class="note">Your API key is stored only in this browser tab's session storage
    and is sent directly to your LLM provider &mdash; it never reaches ShipFast servers.
    Manage it any time from <a href="/settings" target="_top">Settings</a>.</div>
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
  <textarea id="input" placeholder="Ask about this page&hellip;"></textarea>
  <button class="send" id="sendBtn">&#10148;</button>
</footer>

<script>
(function () {
  "use strict";
  var SLUG = ${SLUG_JSON};
  var ORIGIN = location.origin;
  var S = {
    enabled: function () { return sessionStorage.getItem("sf_ai_enabled") === "1"; },
    key: function () { return sessionStorage.getItem("sf_ai_key") || ""; },
    provider: function () { return sessionStorage.getItem("sf_ai_provider") || "anthropic"; },
    base: function () { return sessionStorage.getItem("sf_ai_base") || ""; },
    model: function () { return sessionStorage.getItem("sf_ai_model") || ""; },
  };

  var DEFAULT_MODELS = {
    anthropic: "claude-sonnet-4-6",
    openai: "gpt-4o-mini",
    gemini: "gemini-2.0-flash",
    litellm: "",
    custom: "",
  };

  var pageCtx = { title: "", url: "", text: "" };
  var chatId = null;          // server chat id (created lazily on first send)
  var history = [];           // [{role, content, selection?}] — full, for UI + persistence
  var pendingSelection = "";
  var busy = false;

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
    sessionStorage.setItem("sf_ai_enabled", "1");
    sessionStorage.setItem("sf_ai_provider", el("suProvider").value);
    sessionStorage.setItem("sf_ai_key", key);
    sessionStorage.setItem("sf_ai_base", el("suBase").value.trim());
    sessionStorage.setItem("sf_ai_model", el("suModel").value.trim());
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
    body.textContent = content;
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

  function callProvider(onText) {
    var provider = S.provider();
    var model = S.model() || DEFAULT_MODELS[provider];
    var msgsOut = providerMessages();

    if (provider === "anthropic") {
      return fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
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
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("Provider error " + r.status + ": " + t.slice(0, 200)); });
        return readSse(r, onText);
      });
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
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + S.key() },
        body: JSON.stringify({
          model: model || "gpt-4o-mini", stream: true,
          messages: [{ role: "system", content: systemPrompt() }].concat(msgsOut),
        }),
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("Provider error " + r.status + ": " + t.slice(0, 200)); });
        return readSse(r, onText);
      });
    }

    if (provider === "gemini") {
      var contents = msgsOut.map(function (m) {
        return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
      });
      return fetch("https://generativelanguage.googleapis.com/v1beta/models/" +
        encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(S.key()), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt() }] },
          contents: contents,
        }),
      }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("Provider error " + r.status + ": " + t.slice(0, 200)); });
        return r.json();
      }).then(function (j) {
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
    busy = true;
    el("sendBtn").disabled = true;
    input.value = "";

    var selection = pendingSelection;
    pendingSelection = "";
    el("selchip").style.display = "none";

    var userMsg = { role: "user", content: text };
    if (selection) userMsg.selection = selection;
    history.push(userMsg);
    addBubble("user", text, selection);

    var assistantBody = addBubble("assistant", "");
    var acc = "";
    callProvider(function (chunk) {
      acc += chunk;
      assistantBody.textContent = acc;
      msgs.scrollTop = msgs.scrollHeight;
    }).then(function () {
      if (!acc) acc = "(empty response)";
      assistantBody.textContent = acc;
      var assistantMsg = { role: "assistant", content: acc };
      history.push(assistantMsg);
      return persist([userMsg, assistantMsg]).catch(function (e) {
        showErr("Reply shown but not saved: " + e.message);
      });
    }).catch(function (e) {
      history.pop(); // drop unanswered user msg from provider context
      assistantBody.textContent = "\\u26A0 " + e.message;
    }).finally(function () {
      busy = false;
      el("sendBtn").disabled = false;
      input.focus();
    });
  }

  el("sendBtn").onclick = send;
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
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

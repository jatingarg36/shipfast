/**
 * Panel runtime script.
 *
 * Returned as a single IIFE body, but internally structured into small
 * named modules that are easy to extend or replace independently:
 *
 *   Settings    – localStorage state (provider, key, model)
 *   Bridge      – postMessage I/O with the parent page
 *   View        – DOM helpers (bubbles, view switching, error toast)
 *   Markdown    – constrained markdown → safe HTML
 *   History     – in-memory transcript + sliding context window
 *   Persistence – ShipFast chat API (transcripts only, never the key)
 *   Provider    – LLM adapters (Anthropic, OpenAI/LiteLLM/custom, Gemini)
 *   Composer    – textarea + send/stop flow
 *   App         – bootstrap + wiring
 *
 * Each block is preceded by a `// ── Name ─` divider so a future change
 * touching, e.g., provider routing can ignore everything else.
 *
 * @param {string} slug - already validated upstream
 * @param {string} systemPromptJs - JS source of buildSystemPrompt(ctx)
 *                                  function, injected verbatim. Lives in
 *                                  ./prompt.js so it can evolve in isolation.
 * @returns {string}
 */
function panelScript(slug, systemPromptJs) {
  const SLUG_JSON = JSON.stringify(slug);
  return `
(function () {
  "use strict";
  var SLUG = ${SLUG_JSON};
  var ORIGIN = location.origin;

  // ── System prompt (injected from ./prompt.js) ──────────────────────────
  ${systemPromptJs}

  // ── Settings ────────────────────────────────────────────────────────────
  var Settings = {
    enabled:  function () { return localStorage.getItem("sf_ai_enabled") === "1"; },
    key:      function () { return localStorage.getItem("sf_ai_key") || ""; },
    provider: function () { return localStorage.getItem("sf_ai_provider") || "anthropic"; },
    base:     function () { return localStorage.getItem("sf_ai_base") || ""; },
    model:    function () { return localStorage.getItem("sf_ai_model") || ""; },
    save: function (provider, key, base, model) {
      localStorage.setItem("sf_ai_enabled", "1");
      localStorage.setItem("sf_ai_provider", provider);
      localStorage.setItem("sf_ai_key", key);
      localStorage.setItem("sf_ai_base", base || "");
      localStorage.setItem("sf_ai_model", model || "");
    },
  };
  var DEFAULT_MODELS = {
    anthropic: "claude-sonnet-4-6",
    openai:    "gpt-4o-mini",
    gemini:    "gemini-flash-latest",
    litellm:   "",
    custom:    "",
  };
  function needsBase(p) { return p === "custom" || p === "litellm"; }

  // ── Bridge (parent ↔ panel) ────────────────────────────────────────────
  var Bridge = {
    notifyReady: function () {
      parent.postMessage({ type: "sf-ai-ready" }, ORIGIN);
    },
    close: function () {
      parent.postMessage({ type: "sf-ai-close" }, ORIGIN);
    },
    onMessage: function (handler) {
      window.addEventListener("message", function (e) {
        if (e.origin !== ORIGIN) return;
        handler(e.data || {});
      });
    },
  };

  // ── View (DOM helpers) ─────────────────────────────────────────────────
  var el = function (id) { return document.getElementById(id); };
  var msgs = el("msgs"), input = el("input"), err = el("err");

  var View = {
    refresh: function () {
      var ok = Settings.enabled() && Settings.key();
      el("setup").style.display    = ok ? "none" : "flex";
      msgs.style.display           = ok ? "flex" : "none";
      el("composer").style.display = ok ? "block" : "none";
    },
    showErr: function (text) {
      err.textContent = text;
      err.style.display = "block";
      setTimeout(function () { err.style.display = "none"; }, 6000);
    },
    nearBottom: function () {
      return msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
    },
    addBubble: function (role, content, selection) {
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
        body.innerHTML = Markdown.render(content);
      } else {
        body.textContent = content;
      }
      div.appendChild(body);
      msgs.appendChild(div);
      msgs.scrollTop = msgs.scrollHeight;
      return body;
    },
    resetMsgs: function () {
      msgs.innerHTML = '<div class="hint" id="hint">Ask anything about this page, ' +
        'or select text on the page and click \\u201CAsk AI about this\\u201D.</div>';
    },
    subtitle: function (text) {
      var s = el("sfSubtitle");
      if (s) s.textContent = text;
    },
  };

  // ── Markdown (constrained, safe) ───────────────────────────────────────
  // Renders only: fenced+inline code, bold, italic, http(s) links, ordered/
  // unordered lists, and h1-h4. Everything else is escaped. Tolerates
  // incomplete tokens mid-stream (e.g. an unclosed \`\`\` shows as literal
  // until the closing fence arrives).
  var Markdown = (function () {
    function escapeHtml(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    }
    function render(text) {
      if (!text) return "";
      var blocks = [];
      text = text.replace(/\`\`\`([^\\n\`]*)\\n?([\\s\\S]*?)\`\`\`/g,
        function (_, _lang, code) {
          blocks.push(code.replace(/\\n$/, ""));
          return "\\u0000CB" + (blocks.length - 1) + "\\u0000";
        });
      text = escapeHtml(text);
      text = text.replace(/\`([^\`\\n]+)\`/g, "<code>$1</code>");
      text = text.replace(/\\*\\*([^\\n*]+)\\*\\*/g, "<strong>$1</strong>");
      text = text.replace(/__([^\\n_]+)__/g, "<strong>$1</strong>");
      text = text.replace(/(^|[\\s(])\\*([^\\s*][^\\n*]*?)\\*(?=[\\s).,!?:;]|$)/g, "$1<em>$2</em>");
      text = text.replace(/(^|[\\s(])_([^\\s_][^\\n_]*?)_(?=[\\s).,!?:;]|$)/g, "$1<em>$2</em>");
      text = text.replace(/\\[([^\\]\\n]+)\\]\\((https?:\\/\\/[^\\s)]+)\\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

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
        if (cb) { flushPara(); flushList();
          out.push("<pre><code>" + escapeHtml(blocks[+cb[1]]) + "</code></pre>"); continue; }
        if (!t) { flushPara(); flushList(); continue; }
        var h = t.match(/^(#{1,4})\\s+(.+)$/);
        if (h) { flushPara(); flushList();
          var lvl = h[1].length;
          out.push("<h" + lvl + ">" + h[2] + "</h" + lvl + ">"); continue; }
        var ul = t.match(/^[-*+]\\s+(.+)$/);
        if (ul) { flushPara();
          if (inList !== "ul") { flushList(); out.push("<ul>"); inList = "ul"; }
          out.push("<li>" + ul[1] + "</li>"); continue; }
        var ol = t.match(/^\\d+\\.\\s+(.+)$/);
        if (ol) { flushPara();
          if (inList !== "ol") { flushList(); out.push("<ol>"); inList = "ol"; }
          out.push("<li>" + ol[1] + "</li>"); continue; }
        flushList();
        para.push(t);
      }
      flushPara(); flushList();
      return out.join("");
    }
    return { render: render, escapeHtml: escapeHtml };
  })();

  // ── History (transcript + sliding window) ──────────────────────────────
  var History = (function () {
    var BUDGET = 20000; // chars ≈ 5K tokens
    var history = [];
    function size(m) { return m.content.length + (m.selection ? m.selection.length : 0); }
    return {
      all:   function () { return history; },
      reset: function () { history = []; },
      push:  function (m) { history.push(m); },
      pop:   function () { return history.pop(); },
      replace: function (next) { history = next.slice(); },
      windowed: function () {
        var total = history.reduce(function (a, m) { return a + size(m); }, 0);
        if (total <= BUDGET) return history.slice();
        var head = history.slice(0, 2);
        var budget = BUDGET - head.reduce(function (a, m) { return a + size(m); }, 0);
        var tail = [];
        for (var i = history.length - 1; i >= 2 && budget > 0; i--) {
          budget -= size(history[i]);
          if (budget >= 0) tail.unshift(history[i]);
        }
        return head.concat(
          [{ role: "assistant", content: "[earlier conversation omitted]" }],
          tail
        );
      },
    };
  })();

  // ── Persistence (ShipFast API) ─────────────────────────────────────────
  var Persistence = (function () {
    var chatId = null;
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
    return {
      currentId: function () { return chatId; },
      setId: function (id) { chatId = id; },
      reset: function () { chatId = null; },
      listChats: function () {
        return api("/api/assistant/chats?slug=" + encodeURIComponent(SLUG));
      },
      loadChat: function (id) {
        return api("/api/assistant/chats/" + id);
      },
      append: function (pair) {
        var ensure = chatId
          ? Promise.resolve({ chatId: chatId })
          : api("/api/assistant/chats", {
              method: "POST", body: JSON.stringify({ slug: SLUG }),
            });
        return ensure.then(function (d) {
          chatId = d.chatId;
          return api("/api/assistant/chats/" + chatId + "/messages", {
            method: "POST", body: JSON.stringify({ messages: pair }),
          });
        });
      },
    };
  })();

  // ── Provider (LLM adapters) ────────────────────────────────────────────
  var Provider = (function () {
    // buildSystemPrompt is defined above from ./prompt.js — see module header.
    function providerMessages() {
      return History.windowed().map(function (m) {
        var content = m.selection
          ? 'Regarding this excerpt from the page: "' + m.selection + '"\\n\\n' + m.content
          : m.content;
        return { role: m.role, content: content };
      });
    }
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
              if (j.type === "content_block_delta" && j.delta && j.delta.text) onText(j.delta.text);
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
    function call(ctx, onText, signal) {
      var provider = Settings.provider();
      var model = Settings.model() || DEFAULT_MODELS[provider];
      var out = providerMessages();

      if (provider === "anthropic") {
        return fetch("https://api.anthropic.com/v1/messages", {
          method: "POST", signal: signal,
          headers: {
            "Content-Type": "application/json",
            "x-api-key": Settings.key(),
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
          },
          body: JSON.stringify({
            model: model, max_tokens: 1024, stream: true,
            system: buildSystemPrompt(ctx), messages: out,
          }),
        }).then(checkOk).then(function (r) { return readSse(r, onText); });
      }
      if (provider === "openai" || provider === "custom" || provider === "litellm") {
        var base = needsBase(provider)
          ? Settings.base().replace(/\\/+$/, "")
          : "https://api.openai.com/v1";
        if (!base) return Promise.reject(new Error("Base URL required for this provider"));
        return fetch(base + "/chat/completions", {
          method: "POST", signal: signal,
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + Settings.key() },
          body: JSON.stringify({
            model: model || "gpt-4o-mini", stream: true,
            messages: [{ role: "system", content: buildSystemPrompt(ctx) }].concat(out),
          }),
        }).then(checkOk).then(function (r) { return readSse(r, onText); });
      }
      if (provider === "gemini") {
        var contents = out.map(function (m) {
          return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] };
        });
        return fetch("https://generativelanguage.googleapis.com/v1beta/models/" +
          encodeURIComponent(model) + ":generateContent", {
          method: "POST", signal: signal,
          headers: { "Content-Type": "application/json", "X-goog-api-key": Settings.key() },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: buildSystemPrompt(ctx) }] },
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
    return { call: call };
  })();

  // ── Composer (send/stop flow + textarea autosize) ──────────────────────
  var Composer = (function () {
    var REQUEST_TIMEOUT_MS = 90000;
    var pageCtx = { title: "", url: "", text: "" };
    var pendingSelection = "";
    var busy = false;
    var controller = null;
    var stoppedByUser = false;

    function autosize() {
      input.style.height = "auto";
      var h = Math.min(180, Math.max(44, input.scrollHeight));
      input.style.height = h + "px";
    }

    function setBusy(on) {
      busy = on;
      el("chatList").disabled = on;
      el("newChat").disabled = on;
      el("sendIcon").innerHTML = on ? "&#9632;" : "&#10148;"; // stop / send
      el("sendLabel").textContent = on ? "Stop" : "Send";
      el("sendBtn").title = on ? "Stop generating" : "Send";
    }

    function clearSelection() {
      pendingSelection = "";
      el("selchip").style.display = "none";
    }

    function setSelection(text) {
      pendingSelection = String(text || "").slice(0, 4000);
      var label = pendingSelection.length > 120 ? pendingSelection.slice(0, 120) + "\\u2026" : pendingSelection;
      el("selchipText").textContent = "Selected: \\u201C" + label + "\\u201D";
      el("selchip").style.display = "flex";
      input.focus();
    }

    function send() {
      var text = input.value.trim();
      if (!text || busy) return;
      input.value = "";
      autosize();
      var sel = pendingSelection;
      clearSelection();
      doSend(text, sel);
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
      History.push(userMsg);
      View.addBubble("user", text, selection);

      var assistantBody = View.addBubble("assistant", "");
      assistantBody.innerHTML = '<span class="tdots"><i></i><i></i><i></i></span>';
      var acc = "";

      function finalize(suffix) {
        assistantBody.innerHTML = Markdown.render(acc + (suffix || ""));
        var assistantMsg = { role: "assistant", content: acc + (suffix || "") };
        History.push(assistantMsg);
        return Persistence.append([userMsg, assistantMsg])
          .then(loadChatList)
          .catch(function (e) { View.showErr("Reply shown but not saved: " + e.message); });
      }

      Provider.call(pageCtx, function (chunk) {
        var stick = View.nearBottom();
        acc += chunk;
        assistantBody.innerHTML = Markdown.render(acc);
        if (stick) msgs.scrollTop = msgs.scrollHeight;
      }, controller.signal).then(function () {
        if (!acc) acc = "(empty response)";
        return finalize();
      }).catch(function (e) {
        var aborted = e && (e.name === "AbortError" || e.code === 20);
        if (aborted && stoppedByUser && acc) return finalize(" \\u2026[stopped]");

        History.pop(); // drop unanswered user msg from provider context
        var message;
        if (aborted && timedOut) message = "Timed out waiting for the provider (90s).";
        else if (aborted) message = "Generation stopped.";
        else if (e instanceof TypeError) message = "Could not reach the provider — network problem or the provider blocks browser (CORS) requests.";
        else message = e.message;

        var failedBubble = assistantBody.parentElement;
        failedBubble.classList.add("failed");
        assistantBody.textContent = "\\u26A0 " + message;
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

    return {
      isBusy: function () { return busy; },
      setPageCtx: function (ctx) { pageCtx = ctx; },
      setSelection: setSelection,
      clearSelection: clearSelection,
      send: send,
      stop: function () {
        if (!busy) return;
        stoppedByUser = true;
        if (controller) controller.abort();
      },
      autosize: autosize,
    };
  })();

  // ── App (chat list loading + wiring) ───────────────────────────────────
  function loadChatList() {
    return Persistence.listChats().then(function (data) {
      var sel = el("chatList");
      var current = Persistence.currentId() || "";
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

  function newChat() {
    Persistence.reset();
    History.reset();
    Composer.clearSelection();
    View.resetMsgs();
    el("chatList").value = "";
  }

  // ── Wiring ──────────────────────────────────────────────────────────────
  el("suProvider").onchange = function () {
    el("suBaseWrap").style.display = needsBase(this.value) ? "block" : "none";
  };
  el("suSave").onclick = function () {
    var key = el("suKey").value.trim();
    if (!key) { View.showErr("Enter an API key"); return; }
    if (needsBase(el("suProvider").value) && !el("suBase").value.trim()) {
      View.showErr("Base URL is required for this provider"); return;
    }
    Settings.save(
      el("suProvider").value,
      key,
      el("suBase").value.trim(),
      el("suModel").value.trim()
    );
    View.refresh();
    loadChatList();
  };

  el("closeBtn").onclick = function () { Bridge.close(); };
  el("newChat").onclick = newChat;
  el("selclear").onclick = Composer.clearSelection;

  el("chatList").onchange = function () {
    if (Composer.isBusy()) { this.value = Persistence.currentId() || ""; return; }
    var id = this.value;
    if (!id) { newChat(); return; }
    Persistence.loadChat(id).then(function (data) {
      Persistence.setId(data.chatId);
      History.replace(data.messages || []);
      msgs.innerHTML = "";
      History.all().forEach(function (m) { View.addBubble(m.role, m.content, m.selection); });
    }).catch(function (e) { View.showErr(e.message); });
  };

  el("sendBtn").onclick = function () {
    if (Composer.isBusy()) Composer.stop();
    else Composer.send();
  };
  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      e.preventDefault(); Composer.send();
    }
  });
  input.addEventListener("input", Composer.autosize);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !Composer.isBusy()) Bridge.close();
  });

  Bridge.onMessage(function (msg) {
    if (msg.type === "sf-ai-context") {
      var ctx = { title: msg.title || "", url: msg.url || "", text: msg.text || "" };
      Composer.setPageCtx(ctx);
      if (ctx.title) View.subtitle(ctx.title.length > 48 ? ctx.title.slice(0, 48) + "\\u2026" : ctx.title);
    } else if (msg.type === "sf-ai-selection") {
      Composer.setSelection(msg.text);
    }
  });

  // ── Bootstrap ──────────────────────────────────────────────────────────
  View.refresh();
  if (Settings.enabled() && Settings.key()) loadChatList();
  Composer.autosize();
  Bridge.notifyReady();
})();
`;
}

module.exports = { panelScript };

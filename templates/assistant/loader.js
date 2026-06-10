/**
 * Assistant Loader
 * Single Responsibility: the script injected into /p/:slug that wires up the
 * AI pill, the panel iframe, text-selection affordance, page-context bridge,
 * and the side-by-side layout that pushes page content rather than overlaying.
 *
 * Layout model
 * ------------
 * On wide viewports (>= LAYOUT_PUSH_MIN_WIDTH) opening the panel shrinks the
 * page by applying padding-right to <body>. The iframe is position:fixed on
 * the right edge, so content reflows into the remaining space — no overlap.
 *
 * On narrow viewports we fall back to the original overlay behavior so the
 * panel doesn't crush mobile layouts.
 */

/** @returns {string} JS source served as `/assistant.js` */
function assistantLoaderJs() {
  return `(function () {
  "use strict";
  if (window.__sfAiLoaded) return;
  window.__sfAiLoaded = true;

  var script = document.currentScript || document.querySelector("script[data-sf-assistant]");
  var SLUG = (script && script.getAttribute("data-slug")) || "";
  if (!SLUG) return;
  var ORIGIN = location.origin;

  // ── Layout constants ─────────────────────────────────────────────────────
  var PANEL_WIDTH = 400;             // px — panel width on wide viewports
  var LAYOUT_PUSH_MIN_WIDTH = 900;   // below this, we overlay instead of push
  var TRANSITION_MS = 260;

  // ── Page context extraction (capped ~8K chars) ──────────────────────────
  function pageText() {
    var clone = document.body.cloneNode(true);
    var junk = clone.querySelectorAll("script,style,noscript,iframe,[data-sf-ai]");
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    var text = (clone.textContent || "").replace(/\\s+/g, " ").trim();
    if (text.length > 8000) text = text.slice(0, 8000) + " [page content truncated]";
    return text;
  }

  // ── Layout controller (push vs overlay) ──────────────────────────────────
  // Stashes the original body inline styles so we can restore them on close,
  // even if the host page set its own padding-right.
  var originalBodyStyles = null;
  function pushOpen() {
    if (originalBodyStyles === null) {
      originalBodyStyles = {
        paddingRight: document.body.style.paddingRight || "",
        transition: document.body.style.transition || "",
        boxSizing: document.body.style.boxSizing || "",
      };
    }
    if (window.innerWidth >= LAYOUT_PUSH_MIN_WIDTH) {
      document.body.style.boxSizing = "border-box";
      document.body.style.transition = "padding-right " + TRANSITION_MS + "ms ease";
      document.body.style.paddingRight = PANEL_WIDTH + "px";
    }
  }
  function pushClose() {
    if (originalBodyStyles) {
      document.body.style.paddingRight = originalBodyStyles.paddingRight;
      // keep transition during the closing animation, restore after
      setTimeout(function () {
        if (!panelOpen) {
          document.body.style.transition = originalBodyStyles.transition;
          document.body.style.boxSizing = originalBodyStyles.boxSizing;
        }
      }, TRANSITION_MS);
    }
  }

  // If the viewport crosses the threshold while the panel is open, switch modes.
  window.addEventListener("resize", function () {
    if (!panelOpen) return;
    if (window.innerWidth >= LAYOUT_PUSH_MIN_WIDTH) {
      document.body.style.paddingRight = PANEL_WIDTH + "px";
    } else {
      document.body.style.paddingRight = (originalBodyStyles && originalBodyStyles.paddingRight) || "";
    }
  });

  // ── Panel iframe ─────────────────────────────────────────────────────────
  var iframe = null;
  var panelOpen = false;

  function iframeWidth() {
    return Math.min(PANEL_WIDTH, window.innerWidth);
  }

  function ensureIframe() {
    if (iframe) return iframe;
    iframe = document.createElement("iframe");
    iframe.src = "/assistant/panel?slug=" + encodeURIComponent(SLUG);
    iframe.setAttribute("data-sf-ai", "1");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation");
    iframe.style.cssText = "position:fixed;top:0;right:0;height:100vh;" +
      "width:" + iframeWidth() + "px;max-width:100vw;" +
      "border:none;border-left:1px solid rgba(255,255,255,.1);z-index:2147483000;" +
      "box-shadow:-12px 0 36px rgba(0,0,0,.5);background:#0c0a09;" +
      "transform:translateX(100%);transition:transform " + TRANSITION_MS + "ms ease";
    document.body.appendChild(iframe);
    return iframe;
  }

  function openPanel() {
    ensureIframe();
    pushOpen();
    requestAnimationFrame(function () {
      iframe.style.width = iframeWidth() + "px";
      iframe.style.transform = "translateX(0)";
    });
    panelOpen = true;
    pill.style.display = "none";
  }

  function closePanel() {
    if (iframe) iframe.style.transform = "translateX(100%)";
    pushClose();
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

module.exports = { assistantLoaderJs };

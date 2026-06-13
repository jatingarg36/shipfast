/**
 * Assistant Loader
 * Single Responsibility: the script injected into /p/:slug that wires up the
 * AI pill, the panel iframe, text-selection affordance, page-context bridge,
 * and the responsive layout (push / overlay / mobile drawer) for the panel.
 *
 * Layout model
 * ------------
 * On wide viewports (>= LAYOUT_PUSH_MIN_WIDTH) opening the panel shrinks the
 * page by applying padding-right to <body>. The iframe is position:fixed on
 * the right edge, so content reflows into the remaining space — no overlap.
 *
 * On narrow viewports we fall back to the original overlay behavior so the
 * panel doesn't crush mobile layouts.
 *
 * On mobile viewports (<= MOBILE_MAX_WIDTH) the panel becomes a full-width
 * slide-in drawer — like a mobile nav drawer, but it holds the AI chat
 * instead of navigation. It overlays the page behind a dimmed backdrop,
 * locks background scrolling while open, and tapping the backdrop (or the
 * panel's own close button) closes it.
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
  var MOBILE_MAX_WIDTH = 640;        // px — at/below this, panel is a full-width drawer
  var TRANSITION_MS = 260;

  function isMobile() { return window.innerWidth <= MOBILE_MAX_WIDTH; }

  // ── Page context extraction (capped ~8K chars) ──────────────────────────
  function pageText() {
    var clone = document.body.cloneNode(true);
    var junk = clone.querySelectorAll("script,style,noscript,iframe,[data-sf-ai]");
    for (var i = 0; i < junk.length; i++) junk[i].remove();
    var text = (clone.textContent || "").replace(/\\s+/g, " ").trim();
    if (text.length > 8000) text = text.slice(0, 8000) + " [page content truncated]";
    return text;
  }

  // ── Body style snapshot (so we can restore exactly what was there) ───────
  var originalBodyStyles = null;
  function captureBodyStyles() {
    if (originalBodyStyles === null) {
      originalBodyStyles = {
        paddingRight: document.body.style.paddingRight || "",
        transition: document.body.style.transition || "",
        boxSizing: document.body.style.boxSizing || "",
        overflow: document.body.style.overflow || "",
      };
    }
  }

  // ── Layout controller (push vs overlay vs mobile drawer) ──────────────────
  function pushOpen() {
    captureBodyStyles();
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
  // Mobile drawer locks background scroll instead of pushing layout.
  function lockScroll() {
    captureBodyStyles();
    document.body.style.overflow = "hidden";
  }
  function unlockScroll() {
    if (originalBodyStyles) document.body.style.overflow = originalBodyStyles.overflow;
  }

  function setBackdrop(visible) {
    backdrop.style.opacity = visible ? "1" : "0";
    backdrop.style.pointerEvents = visible ? "auto" : "none";
  }

  // If the viewport crosses the mobile breakpoint while the panel is open
  // (e.g. orientation change), switch layout modes in place.
  window.addEventListener("resize", function () {
    if (!panelOpen) return;
    iframe.style.width = iframeWidth() + "px";
    if (isMobile()) {
      pushClose();
      lockScroll();
      setBackdrop(true);
    } else {
      unlockScroll();
      setBackdrop(false);
      pushOpen();
    }
  });

  // ── Mobile drawer backdrop ─────────────────────────────────────────────────
  var backdrop = document.createElement("div");
  backdrop.setAttribute("data-sf-ai", "1");
  backdrop.style.cssText = "position:fixed;top:0;right:0;bottom:0;left:0;" +
    "z-index:2147482998;background:rgba(0,0,0,.5);opacity:0;pointer-events:none;" +
    "transition:opacity " + TRANSITION_MS + "ms ease";
  backdrop.onclick = function () { closePanel(); };
  document.body.appendChild(backdrop);

  // ── Panel iframe ─────────────────────────────────────────────────────────
  var iframe = null;
  var panelOpen = false;

  function iframeWidth() {
    if (isMobile()) return window.innerWidth;
    return Math.min(PANEL_WIDTH, window.innerWidth);
  }

  function ensureIframe() {
    if (iframe) return iframe;
    iframe = document.createElement("iframe");
    iframe.src = "/assistant/panel?slug=" + encodeURIComponent(SLUG);
    iframe.setAttribute("data-sf-ai", "1");
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-top-navigation-by-user-activation");
    iframe.style.cssText = "position:fixed;top:0;right:0;height:100vh;height:100dvh;" +
      "width:" + iframeWidth() + "px;max-width:100vw;" +
      "border:none;border-left:1px solid rgba(255,255,255,.1);z-index:2147483000;" +
      "box-shadow:-12px 0 36px rgba(0,0,0,.5);background:#0c0a09;" +
      "transform:translateX(100%);transition:transform " + TRANSITION_MS + "ms ease";
    document.body.appendChild(iframe);
    return iframe;
  }

  function openPanel() {
    ensureIframe();
    iframe.style.width = iframeWidth() + "px";
    if (isMobile()) {
      lockScroll();
      setBackdrop(true);
    } else {
      pushOpen();
    }
    requestAnimationFrame(function () {
      iframe.style.transform = "translateX(0)";
    });
    panelOpen = true;
    pill.style.display = "none";
  }

  function closePanel() {
    if (iframe) iframe.style.transform = "translateX(100%)";
    setBackdrop(false);
    unlockScroll();
    pushClose();
    panelOpen = false;
    pill.style.display = "flex";
  }

  // ── AI pill (sits above the Shipfast badge) ──────────────────────────────
  var pill = document.createElement("button");
  pill.setAttribute("data-sf-ai", "1");
  pill.innerHTML = "&#10024; AI";
  pill.style.cssText = "position:fixed;bottom:calc(52px + env(safe-area-inset-bottom));right:12px;z-index:2147482999;" +
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

  // Shows/hides/positions the "Ask AI about this" button for the current
  // selection. Clamps horizontally so the button stays on-screen on narrow
  // viewports.
  function updateAskBtn() {
    var sel = window.getSelection();
    var text = sel ? sel.toString().trim() : "";
    if (text.length >= 4 && text.length <= 4000 && sel.rangeCount) {
      var rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { askBtn.style.display = "none"; return; }
      pendingSelection = text;
      var btnWidth = askBtn.offsetWidth || 140; // estimate before first paint
      var maxLeft = window.scrollX + window.innerWidth - btnWidth - 8;
      askBtn.style.left = Math.max(8, Math.min(rect.left + window.scrollX, maxLeft)) + "px";
      askBtn.style.top = (rect.bottom + window.scrollY + 6) + "px";
      askBtn.style.display = "block";
    } else {
      askBtn.style.display = "none";
    }
  }

  // Desktop: selection finishes on mouseup.
  document.addEventListener("mouseup", function (e) {
    if (e.target === askBtn || (iframe && e.target === iframe)) return;
    setTimeout(updateAskBtn, 0);
  });

  // Mobile: dragging the native selection handles doesn't fire mouseup, so
  // fall back to selectionchange (debounced — it fires continuously while
  // handles are dragged) and touchend (selection settles right after lift-off).
  var selectionTimer = null;
  function scheduleAskBtnUpdate() {
    if (selectionTimer) clearTimeout(selectionTimer);
    selectionTimer = setTimeout(updateAskBtn, 250);
  }
  document.addEventListener("selectionchange", scheduleAskBtnUpdate);
  document.addEventListener("touchend", function (e) {
    if (e.target === askBtn) return;
    scheduleAskBtnUpdate();
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

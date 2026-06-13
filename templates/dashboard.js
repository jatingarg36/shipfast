/**
 * Dashboard Template
 * Single Responsibility: Generate the main dashboard HTML with embedded frontend code
 * Note: This is a large file containing all CSS and JavaScript for the dashboard UI
 */

/**
 * Generate dashboard HTML
 * @param {Object} user - Current user object (null if not authenticated)
 * @returns {string} - Complete HTML document with dashboard
 */
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
<script>(function(){try{var s=localStorage.getItem('shipfast-theme');if(s==='light'||s==='dark')document.documentElement.setAttribute('data-theme',s);}catch(e){}})();</script>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{scrollbar-width:none;-ms-overflow-style:none}
html::-webkit-scrollbar,body::-webkit-scrollbar{width:0;height:0;display:none}

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
  --text-faint:var(--muted2);
  --border-strong:var(--border-hover);
}

:root[data-theme='light']{
  --bg:#f5f2ec;
  --surface:#ffffff;
  --surface2:#fbf8f2;
  --surface3:#ffffff;
  --border:rgba(20,15,10,.11);
  --border-hover:rgba(20,15,10,.20);
  --text:#1a1613;
  --text2:#3a342e;
  --muted:#6e665d;
  --muted2:#a39a8f;
  --text-faint:#a39a8f;
  --border-strong:rgba(20,15,10,.20);
}

html{scroll-behavior:smooth;transition:background .3s ease,color .3s ease}
body{background:var(--bg);color:var(--text);font-family:var(--sans);min-height:100vh;-webkit-font-smoothing:antialiased}
body::before{
  content:'';position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(ellipse 50% 40% at 75% 5%,rgba(249,115,22,.06),transparent 70%),
    radial-gradient(ellipse 40% 50% at 15% 85%,rgba(239,68,68,.04),transparent 70%);
}
:root[data-theme='light'] body::before{
  background:
    radial-gradient(ellipse 50% 40% at 75% 5%,rgba(249,115,22,.04),transparent 70%),
    radial-gradient(ellipse 40% 50% at 15% 85%,rgba(239,68,68,.025),transparent 70%);
}

/* ── Navbar ── */
nav{
  position:sticky;top:0;z-index:50;
  background:color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter:blur(20px) saturate(1.4);
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

/* ── Nav links + theme toggle ── */
.nav-left{display:flex;align-items:center;gap:1.85rem}
.nav-links{display:flex;align-items:center;gap:1.4rem}
.nav-link{
  font-size:.82rem;font-weight:500;color:var(--muted);text-decoration:none;
  position:relative;padding:.25rem 0;transition:color .15s;
}
.nav-link:hover,.nav-link.active{color:var(--text)}
.nav-link.active::after{
  content:'';position:absolute;left:0;right:0;bottom:-3px;height:2px;border-radius:2px;
  background:linear-gradient(135deg,var(--accent),var(--warm));
}
@media(max-width:780px){.nav-links{display:none}}
.icon-btn{
  width:34px;height:34px;border:1px solid var(--border);background:var(--surface2);
  border-radius:8px;color:var(--muted);display:grid;place-items:center;cursor:pointer;
  transition:all .18s ease;
}
.icon-btn:hover{color:var(--text);border-color:var(--border-hover);transform:translateY(-1px)}
.icon-btn svg{width:15px;height:15px}

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
.hero{padding:3.5rem 0 3rem;position:relative}
.hero::before{
  content:'';position:absolute;top:-40px;left:50%;transform:translateX(-50%);
  width:720px;height:480px;
  background:radial-gradient(ellipse at center, var(--accent-glow), transparent 68%);
  pointer-events:none;z-index:0;
}
.hero-grid{display:grid;grid-template-columns:1.05fr 1fr;gap:3.5rem;align-items:center;position:relative;z-index:1}
.eyebrow{
  display:inline-flex;align-items:center;gap:.55rem;
  font-size:.7rem;font-weight:500;letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted);background:var(--surface);border:1px solid var(--border);
  padding:.4rem .8rem;border-radius:999px;margin-bottom:1.5rem;
}
.eyebrow .dot{width:6px;height:6px;border-radius:50%;background:var(--success);box-shadow:0 0 0 3px rgba(34,197,94,.18)}
.hero h2{font-size:clamp(2.1rem,5.2vw,3.6rem);font-weight:800;letter-spacing:-.035em;line-height:1.05;margin:0 0 1.1rem;text-wrap:balance}
.hero .grad{
  background:linear-gradient(135deg,var(--accent),var(--warm),var(--accent2));
  background-size:200% 200%;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  animation:shimmer 4s ease infinite;
}
@keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.hero p{font-size:1rem;color:var(--muted);max-width:460px;margin:0 0 1.85rem;line-height:1.6;text-wrap:pretty}
.hero-cta{display:flex;gap:1.1rem;align-items:center;flex-wrap:wrap;margin:0}
.hero-cta .btn-primary{padding:.85rem 1.5rem;font-size:.92rem;border-radius:11px}
.btn-browse{
  display:inline-flex;align-items:center;gap:.5rem;
  color:var(--muted);text-decoration:none;font-size:.92rem;font-weight:500;
  padding:.85rem .25rem;transition:color .15s,gap .15s;
}
.btn-browse:hover{color:var(--accent2);gap:.7rem}
.btn-browse svg{width:14px;height:14px}

/* Inline demo editor — real publish */
.hero-demo{
  background:var(--surface);border:1px solid var(--border);border-radius:18px;
  box-shadow:0 24px 60px -20px rgba(0,0,0,.6);overflow:hidden;position:relative;
  display:flex;flex-direction:column;min-height:300px;
}
.hero-demo-bar{display:flex;align-items:center;gap:.5rem;padding:.85rem 1rem;border-bottom:1px solid var(--border);background:var(--surface2)}
.dots{display:flex;gap:.35rem}
.dots i{width:11px;height:11px;border-radius:50%;display:block}
.dots i:nth-child(1){background:#ff5f57}
.dots i:nth-child(2){background:#febc2e}
.dots i:nth-child(3){background:#28c840}
.hero-demo-file{
  font-family:var(--mono);font-size:.72rem;color:var(--muted);
  margin-left:.25rem;background:transparent;border:1px solid transparent;
  border-radius:5px;padding:.15rem .4rem;outline:none;
  width:auto;min-width:6.5rem;max-width:16rem;
  transition:border-color .15s,background .15s,color .15s;
}
.hero-demo-file:hover{border-color:var(--border);background:var(--surface3);cursor:text}
.hero-demo-file:focus{border-color:var(--accent);background:var(--surface3);color:var(--text);cursor:text}
.hero-demo-tag{margin-left:auto;font-family:var(--mono);font-size:.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:.05em}
.hero-demo-code{
  flex:1;width:100%;min-height:190px;
  font-family:var(--mono);font-size:.78rem;line-height:1.75;
  padding:1.1rem 1.2rem;background:#131110;color:#d8d2c8;
  border:none;outline:none;resize:none;
}
.hero-demo-code::placeholder{color:#4a423a}
:root[data-theme='light'] .hero-demo-code{background:#fbf8f2;color:#1a1613}
:root[data-theme='light'] .hero-demo-code::placeholder{color:#a39a8f}
.hero-demo-foot{display:flex;align-items:center;gap:.75rem;padding:.75rem 1rem;border-top:1px solid var(--border);background:var(--surface2)}
.hero-ship-btn{
  display:inline-flex;align-items:center;gap:.4rem;
  background:linear-gradient(135deg,var(--accent),var(--warm));color:#fff;border:none;
  border-radius:8px;padding:.55rem .9rem;
  font-family:var(--mono);font-size:.72rem;font-weight:600;cursor:pointer;
  transition:transform .15s,filter .15s;
}
.hero-ship-btn:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.05)}
.hero-ship-btn:disabled{opacity:.5;cursor:default}
.hero-ship-btn svg{width:13px;height:13px}
.hero-demo-status{font-family:var(--mono);font-size:.7rem;color:var(--text-faint);display:flex;align-items:center;gap:.4rem}
.hero-demo-spinner{width:11px;height:11px;border:2px solid var(--border-hover);border-top-color:var(--accent);border-radius:50%;animation:spin .5s linear infinite}
.hero-url-result{
  position:absolute;left:1rem;right:1rem;bottom:3.6rem;
  display:flex;align-items:center;gap:.6rem;
  background:var(--surface3);border:1px solid var(--accent);
  border-radius:10px;padding:.7rem .85rem;
  box-shadow:0 16px 36px -14px rgba(249,115,22,.45);
  opacity:0;transform:translateY(14px) scale(.98);pointer-events:none;
  transition:opacity .35s cubic-bezier(.2,.8,.2,1),transform .35s cubic-bezier(.2,.8,.2,1);
}
.hero-url-result.show{opacity:1;transform:none;pointer-events:auto}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--success);box-shadow:0 0 0 3px rgba(34,197,94,.16);flex:none}
.hero-url-text{font-family:var(--mono);font-size:.74rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.hero-url-text b{color:var(--accent2)}
.hero-url-copy{
  border:1px solid var(--border-hover);background:transparent;color:var(--muted);
  border-radius:6px;padding:.35rem .6rem;font-family:var(--mono);font-size:.65rem;cursor:pointer;
  display:inline-flex;align-items:center;gap:.35rem;transition:all .15s;flex:none;
}
.hero-url-copy:hover{color:var(--text);border-color:var(--accent)}
.hero-url-copy svg{width:11px;height:11px}
@media(max-width:940px){
  .hero-grid{grid-template-columns:1fr;gap:2.5rem}
  .hero-demo{max-width:560px;width:100%}
}
.nav-stats{display:flex;align-items:center;gap:.65rem;margin-right:.85rem;padding:.3rem .7rem;background:var(--surface2);border:1px solid var(--border);border-radius:999px}
.nav-stat{display:flex;align-items:baseline;gap:.3rem;font-size:.72rem;color:var(--muted);line-height:1}
.nav-stat+.nav-stat{padding-left:.65rem;border-left:1px solid var(--border)}
.nav-stat-num{font-weight:700;font-size:.78rem;color:var(--text);font-family:var(--mono)}

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
.card-desc--empty{visibility:hidden}

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

/* ── Section head (new) ── */
.section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:1.5rem;margin:1.5rem 0 1.25rem;flex-wrap:wrap}
.section-head-l{flex:1;min-width:280px}
.section-eyebrow{font-family:var(--mono);font-size:.7rem;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--accent2);margin-bottom:.65rem}
.section-h2{font-size:clamp(1.45rem,2.6vw,1.85rem);font-weight:700;letter-spacing:-.025em;line-height:1.1;color:var(--text);display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;margin:0}
.section-h2 .cnt{font-family:var(--mono);font-size:.75rem;font-weight:500;color:var(--text-faint);border:1px solid var(--border);border-radius:999px;padding:.15rem .65rem}
.section-sub{font-size:.85rem;color:var(--text-faint);margin-top:.55rem}
.section-head-r{display:flex;align-items:center;gap:.55rem}
.section-head .search-wrap{margin:0}
.section-head .search-input{padding-left:2rem;width:240px}
.section-head .sort-select{padding:.5rem .65rem}

/* ── Folder pill rail ── */
.folders{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin:0 0 1.5rem}
.folder{
  display:inline-flex;align-items:center;gap:.5rem;
  border:1px solid var(--border);background:var(--surface);
  border-radius:11px;padding:.45rem .8rem .45rem .65rem;
  font-family:var(--sans);font-size:.78rem;font-weight:500;color:var(--muted);
  cursor:pointer;transition:all .16s ease;
}
.folder:hover{color:var(--text);border-color:var(--border-hover);transform:translateY(-1px)}
.folder svg{width:14px;height:14px;flex:none;opacity:.85}
.folder .fc{font-family:var(--mono);font-size:.65rem;color:var(--text-faint);border:1px solid var(--border);border-radius:999px;padding:.05rem .4rem;transition:all .16s}
.folder[aria-pressed='true']{
  color:var(--text);border-color:transparent;
  background:color-mix(in srgb,var(--accent) 14%,var(--surface));
  box-shadow:inset 0 0 0 1px rgba(249,115,22,.5);
}
.folder[aria-pressed='true'] svg{color:var(--accent2);opacity:1}
.folder[aria-pressed='true'] .fc{color:var(--accent2);border-color:rgba(249,115,22,.4)}

/* ── Card grid (new) ── */
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:1.25rem}
.grid-empty{padding:3rem 0;text-align:center;font-family:var(--mono);font-size:.8rem;color:var(--text-faint)}

/* ── Card v2 (edge-to-edge thumb, footer outside body) ── */
.card-v2{
  background:var(--surface);border:1px solid var(--border);
  border-radius:14px;overflow:hidden;cursor:pointer;text-decoration:none;color:inherit;
  display:flex;flex-direction:column;
  transition:transform .22s cubic-bezier(.2,.8,.2,1),border-color .22s,box-shadow .22s,background .22s;
  padding:0;
}
.card-v2:hover{transform:translateY(-4px);border-color:var(--border-hover);box-shadow:0 18px 44px rgba(0,0,0,.42);background:var(--surface)}
.card-v2 .card-thumb-v2{
  height:210px;background:#0e0d0c;border:none;border-bottom:1px solid var(--border);
  margin:0;position:relative;overflow:hidden;transition:background .25s;
}
.card-v2 .card-thumb-v2 iframe{
  position:absolute;top:0;left:0;width:200%;height:200%;border:none;
  transform:scale(.5);transform-origin:top left;pointer-events:none;
  filter:saturate(.9);transition:filter .3s ease;
}
.card-v2:hover .card-thumb-v2 iframe{filter:none}
.card-v2 .card-thumb-v2::after{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:linear-gradient(to bottom, transparent 60%, color-mix(in srgb, var(--surface) 55%, transparent));
  transition:opacity .3s ease;z-index:1;
}
.card-v2:hover .card-thumb-v2::after{opacity:0}
:root[data-theme='light'] .card-v2 .card-thumb-v2{background:#fbf8f2}
.card-v2 .card-body-v2{padding:1.05rem 1.15rem .25rem;flex:1;display:flex;flex-direction:column;gap:.45rem}
.card-v2 .card-title-v2{font-size:1rem;font-weight:600;letter-spacing:-.01em;line-height:1.25;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-v2 .card-slug-v2{
  font-family:var(--mono);font-size:.72rem;color:var(--accent2);opacity:.92;
  display:flex;align-items:center;gap:.5rem;min-width:0;
}
.card-v2 .card-slug-v2 .slug-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-v2 .card-desc-v2{font-size:.8rem;color:var(--muted);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-v2 .card-foot-v2{
  display:flex;align-items:center;gap:1rem;padding:.85rem 1.15rem;
  margin-top:.85rem;border-top:1px solid var(--border);
  font-family:var(--mono);font-size:.66rem;color:var(--text-faint);
}
.card-v2 .card-foot-v2 .meta{display:inline-flex;align-items:center;gap:.3rem}
.card-v2 .card-foot-v2 .meta svg{width:11px;height:11px}
.card-v2 .card-foot-v2 .act{margin-left:auto;display:inline-flex;align-items:center;gap:.7rem;color:var(--muted);transition:color .15s}
.card-v2 .card-foot-v2 .act .btn-link{background:none;border:none;color:inherit;font-family:var(--mono);font-size:.66rem;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:.25rem;transition:color .15s}
.card-v2 .card-foot-v2 .act .btn-link svg{width:11px;height:11px}
.card-v2 .card-foot-v2 .act .btn-link:hover{color:var(--accent2)}
.card-v2 .card-foot-v2 .act .btn-link.danger:hover{color:var(--danger)}
.card-v2 .lock{
  flex:none;font-size:.55rem;border:1px solid rgba(249,115,22,.4);
  color:var(--accent2);border-radius:5px;padding:.05rem .4rem;
  letter-spacing:.04em;text-transform:uppercase;
  display:inline-flex;align-items:center;gap:.2rem;white-space:nowrap;
}

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

/* ── Upload artifact ── */
.field-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:.35rem;gap:.5rem}
.field-head label{margin-bottom:0}
.upload-btn{
  display:inline-flex;align-items:center;gap:.35rem;
  background:var(--surface2);border:1px solid var(--border);
  color:var(--muted);font-family:var(--sans);font-size:.7rem;font-weight:600;
  padding:.3rem .6rem;border-radius:6px;cursor:pointer;
  transition:all .15s;
}
.upload-btn:hover{color:var(--accent2);border-color:rgba(249,115,22,.3);background:rgba(249,115,22,.06)}
.upload-btn svg{width:12px;height:12px}
.upload-btn.uploaded{color:var(--success);border-color:rgba(34,197,94,.3);background:rgba(34,197,94,.06)}
.hero-upload-btn{
  display:inline-flex;align-items:center;gap:.3rem;
  background:transparent;border:1px solid var(--border);
  color:var(--muted);font-family:var(--mono);font-size:.7rem;font-weight:500;
  padding:.45rem .7rem;border-radius:7px;cursor:pointer;
  transition:all .15s;
}
.hero-upload-btn:hover{color:var(--accent2);border-color:rgba(249,115,22,.35);background:rgba(249,115,22,.05)}
.hero-upload-btn svg{width:12px;height:12px}

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
  width:100%;aspect-ratio:16/9;border-radius:8px;overflow:hidden;
  margin-bottom:.85rem;background:var(--surface3);border:1px solid var(--border);
  position:relative;transition:border-color .25s;
}
.card:hover .card-thumb{border-color:var(--border-hover)}
.card-thumb iframe{
  position:absolute;top:0;left:0;
  width:250%;height:250%;border:none;
  transform:scale(.4);transform-origin:top left;
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

/* ── Steps strip (How it works) ── */
.steps-eyebrow{font-family:var(--mono);font-size:.7rem;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--text-faint);margin:5rem 0 1.1rem}
.features{margin:0 0 1rem;padding:0;border:1px solid var(--border);border-radius:14px;overflow:hidden;background:var(--border)}
.features-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:transparent}
.feature{text-align:left;background:var(--surface);padding:1.5rem 1.55rem}
.feature .step-n{font-family:var(--mono);font-size:.7rem;color:var(--accent2);margin-bottom:.7rem;letter-spacing:.04em}
.feature h4{font-size:1rem;font-weight:600;letter-spacing:-.01em;margin:0 0 .35rem;display:flex;align-items:center;gap:.55rem}
.feature h4 svg{width:15px;height:15px;color:var(--muted);flex:none}
.feature p{font-size:.82rem;color:var(--muted);line-height:1.55;max-width:none}
.feature-icon{display:none}
@media(max-width:768px){.features-grid{grid-template-columns:1fr;gap:1px}}

/* ── Footer ── */
.footer{
  text-align:center;padding:2.5rem 0 1.5rem;color:var(--muted2);font-size:.7rem;
  letter-spacing:.02em;border-top:1px solid var(--border);margin-top:3rem;
}
.footer-v2{
  margin-top:5rem;padding:2rem 0 3rem;border-top:1px solid var(--border);
  display:flex;align-items:center;justify-content:space-between;gap:1.25rem;flex-wrap:wrap;
}
.footer-v2 .footer-l{display:flex;align-items:center;gap:.7rem;color:var(--text-faint);font-size:.82rem}
.footer-links{display:flex;gap:1.4rem;font-family:var(--mono);font-size:.75rem}
.footer-links a{color:var(--muted);text-decoration:none;transition:color .15s}
.footer-links a:hover{color:var(--accent2)}

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
  .hero{padding:2rem 0 1.5rem}
  .hero p{font-size:.9rem}
  .hero-cta .btn-primary{padding:.7rem 1.25rem;font-size:.85rem}
  .card-grid{grid-template-columns:1fr}
  .nav-stats{display:none}
  .features-grid{gap:1.25rem}
}

/* Segmented control for View Toggle */
.view-toggle {
  display: flex;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  padding: 2px;
}
.view-toggle button {
  background: transparent;
  border: none;
  color: var(--muted);
  padding: .35rem .75rem;
  font-family: var(--sans);
  font-size: .72rem;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all .15s ease;
  display: flex;
  align-items: center;
  gap: .35rem;
}
.view-toggle button.active {
  background: var(--surface3);
  color: var(--text);
}
.view-toggle button:not(.active):hover {
  color: var(--text2);
}

/* Breadcrumbs */
.breadcrumbs {
  display: flex;
  align-items: center;
  gap: .4rem;
  margin-bottom: 1.25rem;
  font-size: .8rem;
  color: var(--muted);
  font-weight: 500;
}
.breadcrumbs a {
  color: var(--muted);
  text-decoration: none;
  transition: color .15s;
  cursor: pointer;
}
.breadcrumbs a:hover {
  color: var(--accent2);
}
.breadcrumbs span.curr {
  color: var(--text2);
}
.breadcrumbs .sep {
  color: var(--muted2);
  font-family: var(--mono);
}

/* Folder Card Styles */
.folder-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: .85rem;
  transition: all .25s cubic-bezier(.4,0,.2,1);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  position: relative;
  overflow: hidden;
}
.folder-card::after {
  content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, rgba(249,115,22,.2), transparent);
  opacity: 0; transition: opacity .25s;
}
.folder-card:hover {
  border-color: var(--border-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,.3);
  background: var(--surface2);
}
.folder-card:hover::after { opacity: 1; }
.folder-icon {
  width: 38px; height: 38px; border-radius: 8px; flex-shrink: 0;
  background: rgba(249,115,22,.06); border: 1px solid rgba(249,115,22,.15);
  display: grid; place-items: center; color: var(--accent2);
}
.folder-info {
  flex: 1; min-width: 0;
}
.folder-name {
  font-size: .88rem; font-weight: 700; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.folder-count {
  font-size: .7rem; color: var(--muted); margin-top: .15rem;
}
/* ── Profile dropdown ── */
.profile-dd { position: relative; }
.profile-dd summary { list-style: none; cursor: pointer; display: flex; align-items: center; }
.profile-dd summary::-webkit-details-marker { display: none; }
.profile-avatar {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1px solid rgba(255,255,255,.15); object-fit: cover; display: block;
}
.profile-initial {
  width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center;
  background: linear-gradient(135deg,#f97316,#ef4444); color: #fff;
  font-size: .8rem; font-weight: 800;
}
.profile-menu {
  position: absolute; right: 0; top: calc(100% + 8px); min-width: 200px; z-index: 500;
  background: #171412; border: 1px solid rgba(255,255,255,.1); border-radius: 10px;
  box-shadow: 0 12px 32px rgba(0,0,0,.5); padding: .4rem;
}
.profile-menu .pm-user {
  padding: .5rem .65rem .6rem; border-bottom: 1px solid rgba(255,255,255,.07);
  margin-bottom: .3rem;
}
.profile-menu .pm-name {
  font-size: .8rem; font-weight: 700; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.profile-menu .pm-email {
  font-size: .68rem; color: var(--muted);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.profile-menu a, .profile-menu button {
  display: flex; align-items: center; gap: .5rem; width: 100%;
  background: none; border: none; cursor: pointer; text-decoration: none;
  color: var(--muted); font: 500 .78rem Inter,system-ui,sans-serif;
  padding: .45rem .65rem; border-radius: 7px; text-align: left;
}
.profile-menu a:hover, .profile-menu button:hover {
  background: rgba(251,146,60,.08); color: var(--accent);
}
.profile-menu form { margin: 0; }
</style>
</head>
<body>

<nav>
  <div class="nav-inner">
    <div class="nav-left">
      <a href="/" class="nav-brand">
        <div class="nav-logo">S</div>
        <div class="nav-title">Ship<span>fast</span></div>
      </a>
      <div class="nav-links">
        <a href="#pages" class="nav-link" data-nav="pages">Published pages</a>
        <a href="#how" class="nav-link" data-nav="how">How it works</a>
      </div>
    </div>
    <div style="display:flex;gap:.6rem;align-items:center">
      <div class="nav-stats">
        <div class="nav-stat"><span class="nav-stat-num" id="totalPages">0</span> shipped</div>
        <div class="nav-stat" title="Last published"><span class="nav-stat-num" id="lastPublished">&mdash;</span></div>
      </div>
      <button class="icon-btn" id="themeToggle" aria-label="Toggle theme" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>
      ${
        isLoggedIn
          ? '<button class="btn btn-primary" onclick="openModal()"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Ship</button>' +
            '<details class="profile-dd" id="profileDd">' +
              '<summary title="' + user.displayName + '">' +
                (user.avatar
                  ? '<img class="profile-avatar" src="' + user.avatar + '" alt="" referrerpolicy="no-referrer"/>'
                  : '<span class="profile-initial">' + (user.displayName || "U").charAt(0).toUpperCase() + '</span>') +
              '</summary>' +
              '<div class="profile-menu">' +
                '<div class="pm-user">' +
                  '<div class="pm-name">' + user.displayName + (user.role === "admin" ? ' <span style="color:var(--accent);font-size:.6rem;font-weight:700">ADMIN</span>' : '') + '</div>' +
                  (user.email ? '<div class="pm-email">' + user.email + '</div>' : '') +
                '</div>' +
                '<a href="/settings"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.09a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.09a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.09a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>Settings</a>' +
                '<a href="/changelog"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>Changelog</a>' +
                '<form method="POST" action="/api/logout"><button type="submit"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>Logout</button></form>' +
              '</div>' +
            '</details>'
          : '<a href="/login" class="btn btn-ghost" style="font-size:.72rem;padding:.4rem .8rem"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Login</a>'
      }
    </div>
  </div>
</nav>

<script>
  // Close the profile dropdown when clicking elsewhere
  document.addEventListener("click", function (e) {
    var dd = document.getElementById("profileDd");
    if (dd && dd.open && !dd.contains(e.target)) dd.open = false;
  });
</script>

<div class="wrap">

  <section class="hero">
    <div class="hero-grid">
      <div class="hero-copy">
        <div class="eyebrow"><span class="dot"></span>Internal · zero-config hosting</div>
        <h2>Your AI artifact,<br/><span class="grad">live in seconds.</span></h2>
        <p>Drop any HTML or React snippet and Shipfast hands you a shareable link &mdash; instantly. No build step, no deploy pipeline, no waiting around.</p>
        <div class="hero-cta">
          ${
            isLoggedIn
              ? '<button class="btn btn-primary" onclick="openModal()"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Ship a page</button>' +
                '<a href="#pages" class="btn-browse">Browse published pages <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>'
              : '<a href="/login" class="btn btn-primary"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Login to publish</a>'
          }
        </div>
      </div>
      ${
        isLoggedIn
          ? '<div class="hero-demo" id="heroDemo">' +
              '<div class="hero-demo-bar">' +
                '<span class="dots"><i></i><i></i><i></i></span>' +
                '<input class="hero-demo-file" id="heroDemoFile" type="text" value="untitled.html" spellcheck="false" autocomplete="off" aria-label="Filename / slug" />' +
                '<span class="hero-demo-tag" id="heroDemoTag">draft</span>' +
              '</div>' +
              '<textarea class="hero-demo-code" id="heroDemoCode" placeholder="Paste HTML, JSX, or Markdown — ⌘↵ to ship" spellcheck="false"></textarea>' +
              '<div class="hero-url-result" id="heroUrlResult">' +
                '<span class="live-dot"></span>' +
                '<span class="hero-url-text" id="heroUrlText">…</span>' +
                '<button class="hero-url-copy" id="heroUrlCopy" type="button"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>Copy</button>' +
              '</div>' +
              '<div class="hero-demo-foot">' +
                '<button class="hero-ship-btn" id="heroShipBtn" type="button" disabled><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Ship ⌘↵</button>' +
                '<button class="hero-upload-btn" id="heroUploadBtn" type="button" title="Upload an HTML, JSX, or Markdown file"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>Upload</button>' +
                '<input type="file" id="heroFileUpload" accept=".html,.htm,.jsx,.js,.md,.markdown,.txt,text/html,text/markdown,text/plain" style="display:none"/>' +
                '<span class="hero-demo-status" id="heroDemoStatus">ready</span>' +
              '</div>' +
            '</div>'
          : ''
      }
    </div>
  </section>

  <span id="pages" style="position:relative;top:-84px"></span>
  <div class="section-head" id="sectionHeader" style="display:none">
    <div class="section-head-l">
      <div class="section-eyebrow">Published pages</div>
      <h2 class="section-h2">Everything the team has shipped <span class="cnt mono" id="count">0 pages</span></h2>
      <p class="section-sub">Open any page, copy its link, or filter by collection.</p>
    </div>
    <div class="section-head-r">
      <div class="search-wrap">
        <svg class="search-icon" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="text" id="searchInput" class="search-input" placeholder="search pages&hellip;" autocomplete="off" spellcheck="false"/>
      </div>
      <select class="sort-select" id="sortSelect" title="Sort">
        <option value="newest">Newest</option>
        <option value="oldest">Oldest</option>
        <option value="az">A &rarr; Z</option>
        <option value="za">Z &rarr; A</option>
      </select>
    </div>
  </div>
  <div class="folders" id="folders" style="display:none"></div>
  <div id="breadcrumbs" style="display:none"></div>
  <div id="pagesList"></div>

  <div class="steps-eyebrow" id="how">How it works</div>
  <div class="features" id="howSection">
    <div class="features-grid">
      <div class="feature">
        <div class="step-n">01</div>
        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg>Paste</h4>
        <p>Drop raw HTML, a React component, or Markdown straight into the editor. No scaffolding required.</p>
      </div>
      <div class="feature">
        <div class="step-n">02</div>
        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>Ship</h4>
        <p>One keystroke renders it live on a clean <code style="font-family:var(--mono);font-size:.72rem;background:var(--bg);padding:.05rem .35rem;border-radius:4px;border:1px solid var(--border);color:var(--accent2)">/p/slug</code> URL &mdash; instantly previewable.</p>
      </div>
      <div class="feature">
        <div class="step-n">03</div>
        <h4><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>Share</h4>
        <p>Copy the link and drop it in a PR, a Slack thread, or a design review. Done.</p>
      </div>
    </div>
  </div>

  <footer class="footer-v2">
    <div class="footer-l">
      <div class="nav-logo" style="width:24px;height:24px;border-radius:6px;font-size:.7rem">S</div>
      <span>Shipfast &mdash; zero to deployed in seconds</span>
    </div>
    <div class="footer-links">
      <a href="#pages">Pages</a>
      <a href="#how">How it works</a>
      <a href="/settings">Settings</a>
      <a href="/changelog">Changelog</a>
    </div>
  </footer>
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
        <div class="field-head">
          <label>Code</label>
          <button type="button" class="upload-btn" id="uploadBtn" onclick="document.getElementById('fileUpload').click()" title="Upload an HTML, JSX, or Markdown file">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload file
          </button>
          <input type="file" id="fileUpload" accept=".html,.htm,.jsx,.js,.md,.markdown,.txt,text/html,text/markdown,text/plain" style="display:none"/>
        </div>
        <div class="drop-zone" id="dropZone">
          <textarea id="html" placeholder="Paste HTML, JSX, or Markdown &mdash; or click Upload file&hellip;"></textarea>
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
let currentViewMode = 'folder';
let currentFolder = '';

function getParentFolder(slug) {
  const lastSlash = slug.lastIndexOf('/');
  return lastSlash === -1 ? '' : slug.substring(0, lastSlash);
}

function getSubfolders(pages, folder) {
  const subfolders = new Map();
  pages.forEach(p => {
    const prefix = folder ? folder + '/' : '';
    if (p.slug.startsWith(prefix) && p.slug !== folder) {
      const remaining = p.slug.substring(prefix.length);
      const slashIdx = remaining.indexOf('/');
      if (slashIdx !== -1) {
        const folderName = remaining.substring(0, slashIdx);
        subfolders.set(folderName, (subfolders.get(folderName) || 0) + 1);
      }
    }
  });
  return Array.from(subfolders.entries()).map(([name, count]) => ({ name, count }));
}

function setViewMode(mode) {
  currentViewMode = mode;
  document.getElementById('viewFlatBtn').classList.toggle('active', mode === 'flat');
  document.getElementById('viewFolderBtn').classList.toggle('active', mode === 'folder');
  renderBreadcrumbs();
  renderPages(searchInput.value.trim().toLowerCase());
}

function navigateToFolder(path) {
  currentFolder = path;
  renderBreadcrumbs();
  renderPages(searchInput.value.trim().toLowerCase());
}

function renderBreadcrumbs() {
  const bc = document.getElementById('breadcrumbs');
  if (currentViewMode !== 'folder') {
    bc.style.display = 'none';
    return;
  }
  bc.style.display = 'flex';
  bc.className = 'breadcrumbs';

  let html = '<a onclick="navigateToFolder(&apos;&apos;)" style="cursor:pointer">All Pages</a>';
  if (currentFolder) {
    const parts = currentFolder.split('/');
    let path = '';
    parts.forEach((part, index) => {
      path += (path ? '/' : '') + part;
      html += ' <span class="sep">&rarr;</span> ';
      if (index === parts.length - 1) {
        html += '<span class="curr">' + esc(part) + '</span>';
      } else {
        html += '<a onclick="navigateToFolder(&apos;' + path + '&apos;)" style="cursor:pointer">' + esc(part) + '</a>';
      }
    });
  }
  bc.innerHTML = html;
}

function setAccessLevel(level) {
  currentAccess = level;
  document.querySelectorAll('#accessToggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.access === level);
  });
}

function slugify(s) {
  return s.toLowerCase()
    .split('/')
    .map(seg => seg.replace(/[^a-z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
    .filter(Boolean)
    .join('/');
}
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

// ── File ingestion shared helper ──
// Reads a File as text, drops it into the textarea, and (if the slug
// hasn't been hand-edited) seeds the slug from the filename stem.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB safety cap
function ingestFile(f){
  if(!f) return;
  if(f.size > MAX_UPLOAD_BYTES){
    showToast('File too large (max 5 MB)','err'); return;
  }
  const r=new FileReader();
  r.onload=()=>{
    htmlInput.value=r.result;
    if(!slugManuallyEdited || !slugInput.value.trim()){
      const stem=(f.name||'').replace(/\\.[^.]+$/,'');
      const s=slugify(stem);
      if(s){ slugInput.value=s; slugUrl.textContent=HOST+'/p/'+s; checkSlugExists(s); }
    }
    htmlInput.dispatchEvent(new Event('input'));
    const ub=document.getElementById('uploadBtn');
    if(ub){
      const orig=ub.innerHTML;
      ub.classList.add('uploaded');
      ub.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'+esc(f.name);
      setTimeout(()=>{ ub.classList.remove('uploaded'); ub.innerHTML=orig; },2200);
    }
  };
  r.onerror=()=>showToast('Could not read file','err');
  r.readAsText(f);
}

// ── Drag & Drop ──
const dropZone=document.getElementById('dropZone');
['dragenter','dragover'].forEach(ev=>{dropZone.addEventListener(ev,e=>{e.preventDefault();dropZone.classList.add('dragover')})});
['dragleave','drop'].forEach(ev=>{dropZone.addEventListener(ev,()=>{dropZone.classList.remove('dragover')})});
dropZone.addEventListener('drop',e=>{
  e.preventDefault();
  ingestFile(e.dataTransfer.files[0]);
});

// ── File picker (upload artifact) ──
const fileUpload=document.getElementById('fileUpload');
if(fileUpload){
  fileUpload.addEventListener('change',e=>{
    ingestFile(e.target.files[0]);
    e.target.value=''; // allow re-selecting the same file
  });
}

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
  setTimeout(()=>(editingSlug?slugInput:htmlInput).focus(),100);
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
  }catch(err){
    showToast('Network error','err');
  }
  finally{publishBtn.classList.remove('loading');publishBtn.textContent=editingSlug?'Update':'Publish'}
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
  await fetch('/api/pages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({slug:b.slug,html:b.source,access:b.access})});
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

const clockSvg = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const editSvg  = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
const copySvg  = '<svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>';

function fmtViews(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n/1e6).toFixed(1).replace(/\\.0$/,'') + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1).replace(/\\.0$/,'') + 'K';
  return n.toLocaleString();
}

const eyeSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

function renderPageCardHtml(p) {
  const ago = timeAgo(new Date(p.updated));
  const desc = (p.description || '').trim();
  const mine = canManage(p);
  const lock = p.access==='publisher'
    ? '<span class="lock"><svg width="8" height="8" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg> Publisher</span>'
    : '';
  return '<a class="card-v2" href="/p/' + p.slug + '" target="_blank">' +
    '<div class="card-thumb-v2"><iframe src="/p/' + p.slug + '" loading="lazy" tabindex="-1"></iframe></div>' +
    '<div class="card-body-v2">' +
      '<div class="card-title-v2">' + esc(p.title) + '</div>' +
      '<div class="card-slug-v2"><span class="slug-text">/p/' + esc(p.slug) + '</span>' + lock + '</div>' +
      (desc ? '<div class="card-desc-v2">' + esc(desc) + '</div>' : '') +
    '</div>' +
    '<div class="card-foot-v2">' +
      '<span class="meta">' + clockSvg + ' ' + ago + '</span>' +
      '<span class="meta">' + eyeSvg + ' ' + fmtViews(p.views || 0) + '</span>' +
      '<span class="act">' +
        (mine ? '<button type="button" class="btn-link" onclick="editPage(event,&apos;' + p.slug + '&apos;)">' + editSvg + ' Edit</button>' : '') +
        '<button type="button" class="btn-link" onclick="copyPageUrl(event,&apos;' + p.slug + '&apos;)">' + copySvg + ' Copy URL</button>' +
        (mine ? '<button type="button" class="btn-link danger" onclick="deletePage(event,&apos;' + p.slug + '&apos;)">Delete</button>' : '') +
      '</span>' +
    '</div>' +
  '</a>';
}

function getTopLevelFolders(pages){
  const counts = new Map();
  pages.forEach(p => {
    const idx = p.slug.indexOf('/');
    if (idx === -1) return;
    const folder = p.slug.substring(0, idx);
    counts.set(folder, (counts.get(folder) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name: name, count: count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function prettyFolder(name){
  return name.split('-').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ');
}

function renderFolderRail(){
  const el = document.getElementById('folders');
  const folders = getTopLevelFolders(allPages);
  const total = allPages.length;
  if (total === 0) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  const folderSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  const gridSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>';
  let html = '<button type="button" class="folder" data-folder="all" aria-pressed="' + (activeFolder==='all') + '">' + gridSvg + 'All pages <span class="fc">' + total + '</span></button>';
  folders.forEach(f => {
    html += '<button type="button" class="folder" data-folder="' + esc(f.name) + '" aria-pressed="' + (activeFolder===f.name) + '">' + folderSvg + esc(prettyFolder(f.name)) + ' <span class="fc">' + f.count + '</span></button>';
  });
  el.innerHTML = html;
  el.querySelectorAll('.folder').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFolder = btn.dataset.folder;
      renderFolderRail();
      renderPages(searchInput.value.trim().toLowerCase());
    });
  });
}

let activeFolder = 'all';

function renderPages(query){
  const el = document.getElementById('pagesList');
  const header = document.getElementById('sectionHeader');
  const count = document.getElementById('count');
  const totalEl = document.getElementById('totalPages');
  const lastEl = document.getElementById('lastPublished');

  totalEl.textContent = allPages.length;
  lastEl.textContent = allPages.length ? timeAgo(new Date(allPages[0].updated)) : '\\u2014';

  if (!allPages.length) {
    header.style.display = 'none';
    document.getElementById('folders').style.display = 'none';
    el.innerHTML = '<div class="empty-state">' +
      '<div class="empty-icon">&#128196;</div><h3>No pages yet</h3>' +
      '<p>' + (IS_LOGGED_IN ? 'Ship your first page and it will appear here.' : 'No public pages have been published yet.') + '</p>' +
      (IS_LOGGED_IN ? '<button class="btn btn-primary" onclick="openModal()"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg> Publish your first page</button>' : '') +
    '</div>';
    return;
  }

  header.style.display = 'flex';
  renderFolderRail();

  let filtered = allPages;
  if (activeFolder !== 'all') {
    filtered = filtered.filter(p => p.slug === activeFolder || p.slug.startsWith(activeFolder + '/'));
  }
  if (query) {
    filtered = filtered.filter(p =>
      p.title.toLowerCase().includes(query) ||
      p.slug.toLowerCase().includes(query) ||
      (p.description || '').toLowerCase().includes(query)
    );
  }
  filtered = sortPages(filtered);

  count.textContent = filtered.length + (filtered.length === 1 ? ' page' : ' pages');

  if (filtered.length === 0) {
    el.innerHTML = '<div class="grid-empty">// no pages in this collection yet</div>';
    return;
  }
  el.innerHTML = '<div class="grid">' + filtered.map(p => renderPageCardHtml(p)).join('') + '</div>';
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

/* ── Theme toggle ── */
(function(){
  const root=document.documentElement, KEY='shipfast-theme';
  const btn=document.getElementById('themeToggle');
  if(!btn) return;
  const moon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  const sun='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const saved=localStorage.getItem(KEY); if(saved) root.setAttribute('data-theme',saved);
  function sync(){ btn.innerHTML = root.getAttribute('data-theme')==='light' ? moon : sun; }
  sync();
  btn.addEventListener('click',()=>{
    const next = root.getAttribute('data-theme')==='light' ? 'dark' : 'light';
    root.setAttribute('data-theme',next); localStorage.setItem(KEY,next); sync();
  });
})();

/* ── Hero inline editor — real publish via /api/pages ── */
(function(){
  if(!IS_LOGGED_IN) return;
  const code=document.getElementById('heroDemoCode');
  const btn=document.getElementById('heroShipBtn');
  const status=document.getElementById('heroDemoStatus');
  const result=document.getElementById('heroUrlResult');
  const urlText=document.getElementById('heroUrlText');
  const tag=document.getElementById('heroDemoTag');
  const fileInput=document.getElementById('heroDemoFile');
  const copyBtn=document.getElementById('heroUrlCopy');
  if(!code||!btn) return;
  let pubSlug='';
  let resetTimer=null;
  let titleManuallyEdited=false;

  function truncate(s, n){ return s.length > n ? s.slice(0, n-1) + '\\u2026' : s; }
  function fitSize(){
    if(!fileInput) return;
    fileInput.size = Math.max(12, Math.min(fileInput.value.length || 12, 30));
  }
  function setFile(text){
    if(!fileInput) return;
    fileInput.value = text;
    fitSize();
  }
  function extOfType(t){ return t==='jsx' ? '.jsx' : (t==='md' ? '.md' : '.html'); }

  function update(){
    // Publish gate: textarea content is the only thing that matters.
    const has = code.value.trim().length > 0;
    btn.disabled = !has;
    if (!has) {
      tag.textContent = 'draft';
      if (!titleManuallyEdited) setFile('untitled.html');
      return;
    }
    const t = detectType(code.value);
    tag.textContent = t;
    if (!titleManuallyEdited && fileInput) {
      const title = extractTitle(code.value);
      const stem = title ? slugify(title) : 'untitled';
      setFile(truncate(stem || 'untitled', 28) + extOfType(t));
    }
  }
  code.addEventListener('input', update);

  if (fileInput) {
    fileInput.addEventListener('input', () => {
      titleManuallyEdited = true;
      fitSize();
    });
    fileInput.addEventListener('blur', () => {
      // If they wipe it back to empty, return to auto-derived preview.
      if (!fileInput.value.trim()) {
        titleManuallyEdited = false;
        update();
      }
    });
    fileInput.addEventListener('keydown', e => {
      // Enter from the filename field shouldn't submit anything;
      // shift focus to the code area so users can fill it in.
      if (e.key === 'Enter') { e.preventDefault(); code.focus(); }
    });
    fitSize();
  }

  function resetDraft(){
    code.value = '';
    pubSlug = '';
    titleManuallyEdited = false;
    setFile('untitled.html');
    result.classList.remove('show');
    status.textContent = 'ready';
    update();
    resetTimer = null;
  }

  function deriveSlug(html){
    // User's filename wins if they edited it; otherwise extract from code; else random.
    const userStem = fileInput
      ? fileInput.value.trim().replace(/\\.(html?|jsx?|tsx?|md)$/i, '')
      : '';
    if (titleManuallyEdited && userStem) return slugify(userStem);
    const title = extractTitle(html);
    if (title) return slugify(title);
    return 'untitled-' + Date.now().toString(36).slice(-5);
  }

  async function shipInline(){
    // Hard gate: textarea must have content. Title alone is not enough.
    if (btn.disabled || code.value.trim().length === 0) return;
    const html = code.value.trim();
    btn.disabled = true;
    if (resetTimer) { clearTimeout(resetTimer); resetTimer = null; }
    result.classList.remove('show');
    status.innerHTML = '<span class="hero-demo-spinner"></span>publishing&hellip;';
    const slug = deriveSlug(html);
    try {
      const r = await fetch('/api/pages', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ slug: slug, html: html, access: 'publisher' })
      });
      const d = await r.json();
      if (d.ok) {
        pubSlug = d.slug;
        const host = HOST.replace(/^https?:\\/\\//,'');
        urlText.innerHTML = host + '/p/<b>' + esc(d.slug) + '</b>';
        result.classList.add('show');
        status.innerHTML = '<span style="color:var(--success)">\\u25cf live</span> &middot; resets in 5s';
        loadPages();
        // Clear the textarea immediately so the draft slot is reusable;
        // keep URL chip visible briefly so user can copy/click, then fade.
        code.value = '';
        titleManuallyEdited = false;
        setFile('untitled.html');
        update();
        resetTimer = setTimeout(resetDraft, 7000);
      } else {
        status.textContent = d.error || 'error';
        btn.disabled = code.value.trim().length === 0;
      }
    } catch(e) {
      status.textContent = 'network error';
      btn.disabled = code.value.trim().length === 0;
    }
  }
  btn.addEventListener('click', shipInline);
  code.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); shipInline(); }
  });
  // If the user starts typing again before the auto-reset fires, kill it
  // and hide the URL chip — they've moved on.
  code.addEventListener('input', () => {
    if (resetTimer && code.value.length > 0) {
      clearTimeout(resetTimer); resetTimer = null;
      result.classList.remove('show');
      status.textContent = 'ready';
    }
  });

  copyBtn.addEventListener('click', () => {
    if (!pubSlug) return;
    navigator.clipboard.writeText(HOST + '/p/' + pubSlug);
    const orig = copyBtn.innerHTML;
    copyBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>Copied';
    setTimeout(()=>{ copyBtn.innerHTML = orig; }, 1500);
  });

  // Hero file upload — same flow as drag-drop, but via picker.
  const heroUploadBtn = document.getElementById('heroUploadBtn');
  const heroFileUpload = document.getElementById('heroFileUpload');
  if (heroUploadBtn && heroFileUpload) {
    heroUploadBtn.addEventListener('click', () => heroFileUpload.click());
    heroFileUpload.addEventListener('change', e => {
      const f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (f.size > 5 * 1024 * 1024) { status.textContent = 'file too large (5 MB max)'; return; }
      const r = new FileReader();
      r.onload = () => {
        code.value = r.result;
        // Seed the filename field from the upload (unless user already typed one)
        if (fileInput && (!titleManuallyEdited || !fileInput.value.trim())) {
          setFile(truncate(f.name, 28));
          titleManuallyEdited = true; // upload filename takes precedence over auto-derived title
        }
        update();
        code.focus();
      };
      r.onerror = () => { status.textContent = 'read error'; };
      r.readAsText(f);
    });
    // Drag-and-drop onto the hero textarea
    ['dragenter','dragover'].forEach(ev => code.addEventListener(ev, e => { e.preventDefault(); }));
    code.addEventListener('drop', e => {
      e.preventDefault();
      const f = e.dataTransfer.files[0]; if (!f) return;
      heroFileUpload.files = e.dataTransfer.files;
      heroFileUpload.dispatchEvent(new Event('change'));
    });
  }

  update();
})();

/* ── Nav scroll-spy ── */
(function(){
  const links={pages:document.querySelector('[data-nav="pages"]'),how:document.querySelector('[data-nav="how"]')};
  if(!links.pages && !links.how) return;
  function spy(){
    const mark=window.scrollY+140; let active=null;
    ['pages','how'].forEach(id=>{
      const el=document.getElementById(id);
      if(el && el.getBoundingClientRect().top+window.scrollY <= mark) active=id;
    });
    Object.keys(links).forEach(k=>{ if(links[k]) links[k].classList.toggle('active', k===active); });
  }
  window.addEventListener('scroll',spy,{passive:true}); spy();
})();

loadPages();
</script>
</body>
</html>`;
}

module.exports = {
  dashboardHtml,
};

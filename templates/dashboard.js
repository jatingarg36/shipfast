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
.hero{padding:2.5rem 0 2rem;max-width:700px;margin:0 auto;text-align:center}
.hero h2{font-size:3rem;font-weight:900;letter-spacing:-.05em;line-height:1.1}
.hero .grad{
  background:linear-gradient(135deg,var(--accent),var(--warm),var(--accent2));
  background-size:200% 200%;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;
  animation:shimmer 4s ease infinite;
}
@keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
.hero p{color:var(--muted);font-size:.95rem;margin-top:.75rem;line-height:1.6;max-width:420px;margin-left:auto;margin-right:auto}
.hero-cta{margin-top:1.25rem;display:flex;gap:.75rem;justify-content:center;align-items:center}
.hero-cta .btn{padding:.65rem 1.6rem;font-size:.88rem;border-radius:10px}
.hero-cta .shortcut-hint{font-size:.7rem;color:var(--muted2);font-family:var(--mono)}
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
  .hero{padding:1.75rem 0 1.5rem}
  .hero h2{font-size:2rem}
  .hero p{font-size:.85rem}
  .hero-cta .btn{padding:.55rem 1.2rem;font-size:.82rem}
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
    <a href="/" class="nav-brand">
      <div class="nav-logo">S</div>
      <div class="nav-title">Ship<span>fast</span></div>
    </a>
    <div style="display:flex;gap:.75rem;align-items:center">
      <div class="nav-stats">
        <div class="nav-stat"><span class="nav-stat-num" id="totalPages">0</span> shipped</div>
        <div class="nav-stat" title="Last published"><span class="nav-stat-num" id="lastPublished">&mdash;</span></div>
      </div>
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

  <div class="hero">
    <h2>Build it. <span class="grad">Ship it.</span><br/>Share it.</h2>
    <p>Drop any HTML or React code and get a live, shareable URL instantly. No deploy pipeline needed.</p>
    <div class="hero-cta">
      ${
        isLoggedIn
          ? '<button class="btn btn-primary" onclick="openModal()"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg>Ship a page</button><span class="shortcut-hint">or press N</span>'
          : '<a href="/login" class="btn btn-primary"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>Login to publish</a>'
      }
    </div>
  </div>

  <div class="section-header" id="sectionHeader" style="display:none">
    <div style="display:flex;align-items:center;gap:1rem">
      <div class="section-title">All Pages <span class="section-count" id="count"></span></div>
      <div class="view-toggle" id="viewToggle">
        <button type="button" class="active" id="viewFolderBtn" onclick="setViewMode('folder')">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h5l2 3h7a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>
          Folders
        </button>
        <button type="button" id="viewFlatBtn" onclick="setViewMode('flat')">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          Flat
        </button>
      </div>
    </div>
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
  <div id="breadcrumbs" style="display:none"></div>
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
  const viewsHtml = '<span style="display:inline-flex;align-items:center;gap:3px;color:var(--muted2);font-size:.7rem;margin-left:.5rem">' + eyeSvg + ' ' + fmtViews(p.views || 0) + '</span>';
  return '<a class="card" href="/p/' + p.slug + '" target="_blank">' +
    '<div class="card-body">' +
      '<div class="card-thumb"><iframe src="/p/' + p.slug + '" loading="lazy" tabindex="-1"></iframe></div>' +
      '<div class="card-title-wrap">' +
        '<div class="card-title">' + esc(p.title) + '</div>' +
        '<div class="card-slug-inline">/p/' + p.slug + (p.access==='publisher'?'<span class="lock-badge"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>Publisher</span>':'') + '</div>' +
      '</div>' +
      (desc ? '<div class="card-desc">' + esc(desc) + '</div>' : '<div class="card-desc card-desc--empty">&nbsp;</div>') +
      '<div class="card-footer">' +
        '<div class="card-time">' + clockSvg + ' ' + ago + (p.ownerName?'<span style="margin-left:.3rem;color:var(--muted2)">by ' + esc(p.ownerName) + '</span>':'') + viewsHtml + '</div>' +
        '<div class="card-actions">' +
          (mine?'<button class="btn-edit" onclick="editPage(event,&apos;' + p.slug + '&apos;)">' + editSvg + ' Edit</button>':'') +
          '<button class="btn-copy" onclick="copyPageUrl(event,&apos;' + p.slug + '&apos;)">' + copySvg + ' Copy URL</button>' +
          (mine?'<button class="btn btn-danger" onclick="deletePage(event,&apos;' + p.slug + '&apos;)">Delete</button>':'') +
        '</div>' +
      '</div>' +
    '</div></a>';
}

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
    document.getElementById('breadcrumbs').style.display='none';
    el.innerHTML='<div class="empty-state">' +
      '<div class="empty-icon">&#128196;</div><h3>No pages yet</h3>' +
      '<p>' + (IS_LOGGED_IN?'Ship your first page and it will appear here.':'No public pages have been published yet.') + '</p>' +
      (IS_LOGGED_IN?'<button class="btn btn-primary" onclick="openModal()"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14m-7-7h14"/></svg> Publish your first page</button>':'') + '</div>';
    return;
  }

  header.style.display='flex';
  renderBreadcrumbs();

  if (currentViewMode === 'folder' && !query) {
    const subfolders = getSubfolders(allPages, currentFolder);
    const directPages = allPages.filter(p => getParentFolder(p.slug) === currentFolder);
    const sortedFolders = subfolders.sort((a,b) => a.name.localeCompare(b.name));
    const sortedPages = sortPages(directPages);

    count.textContent = (currentFolder ? esc(currentFolder) + ' | ' : '') + allPages.length + ' page' + (allPages.length === 1 ? '' : 's');

    let html = '';

    if (sortedFolders.length > 0) {
      html += '<div style="margin-bottom:1.5rem">' +
        '<div style="font-size:.7rem;font-weight:600;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-bottom:.75rem">Folders</div>' +
        '<div class="card-grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">';
      html += sortedFolders.map(f => {
        const fullPath = currentFolder ? currentFolder + '/' + f.name : f.name;
        return '<div class="folder-card" onclick="navigateToFolder(&apos;' + fullPath + '&apos;)">' +
          '<div class="folder-icon">' +
            '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h5l2 3h7a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>' +
          '</div>' +
          '<div class="folder-info">' +
            '<div class="folder-name">' + esc(f.name) + '</div>' +
            '<div class="folder-count">' + f.count + ' page' + (f.count===1?'':'s') + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      html += '</div></div>';
    }

    if (sortedPages.length > 0) {
      if (sortedFolders.length > 0) {
        html += '<div style="font-size:.7rem;font-weight:600;text-transform:uppercase;color:var(--muted);letter-spacing:.05em;margin-top:1.5rem;margin-bottom:.75rem">Pages</div>';
      }
      html += '<div class="card-grid">';
      html += sortedPages.map(p => renderPageCardHtml(p)).join('');
      html += '</div>';
    }

    if (sortedFolders.length === 0 && sortedPages.length === 0) {
      html = '<div style="text-align:center;padding:4rem 2rem;color:var(--muted);font-size:.85rem">' +
        '<div style="font-size:2rem;margin-bottom:.5rem">&#128193;</div>' +
        'This folder is empty.' +
      '</div>';
    }
    el.innerHTML = html;
  } else {
    // Flat view or searching
    let filtered = allPages;
    if (currentFolder && currentViewMode === 'folder') {
      filtered = allPages.filter(p => p.slug === currentFolder || p.slug.startsWith(currentFolder + "/"));
    }
    if (query) {
      filtered = filtered.filter(p => p.title.toLowerCase().includes(query) || p.slug.includes(query) || (p.description||'').toLowerCase().includes(query));
    }
    filtered = sortPages(filtered);
    count.textContent = (query ? filtered.length + ' / ' : '') + allPages.length + ' page' + (allPages.length === 1 ? '' : 's');

    if (query && !filtered.length) {
      el.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);font-size:.85rem">No pages match \\u201c' + esc(query) + '\\u201d</div>';
      return;
    }
    el.innerHTML = '<div class="card-grid">' + filtered.map(p => renderPageCardHtml(p)).join('') + '</div>';
  }
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

module.exports = {
  dashboardHtml,
};

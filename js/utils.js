(function () {
  'use strict';
  const icons = {
    house:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    dumbbell:'<path d="M6 8v8M3 10v4M18 8v8M21 10v4M6 12h12"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    chart:'<path d="M4 19V5M4 19h17M7 15l4-4 3 2 6-7"/>',
    body:'<circle cx="12" cy="5" r="2.5"/><path d="M7 21v-5l2-4-2-3M17 21v-5l-2-4 2-3M9 12h6M8 21h8"/>',
    user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c.7-4 3.4-6 8-6s7.3 2 8 6"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    search:'<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trophy:'<path d="M8 21h8M12 17v4M7 4h10v6a5 5 0 0 1-10 0zM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4"/>',
    trend:'<path d="m3 17 6-6 4 4 8-9M15 6h6v6"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    edit:'<path d="m4 16-.8 4.8L8 20l11-11a2.8 2.8 0 0 0-4-4zM13.5 6.5l4 4"/>',
    trash:'<path d="M4 7h16M10 11v6M14 11v6M5 7l1 14h12l1-14M9 7V4h6v3"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 20h16"/>',
    upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 20h16"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
    heart:'<path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6.3a4.8 4.8 0 0 1 8.8 2.5z"/>',
    moon:'<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
    dumbbell2:'<path d="M4 9v6M2 10v4M8 7v10M8 12h8M16 7v10M22 10v4M20 9v6"/>',
    scale:'<rect x="3" y="4" width="18" height="17" rx="3"/><path d="M12 8v4l2-2"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    fire:'<path d="M12 22c4.5 0 7-3.1 7-7 0-3.2-2.2-5.4-4-7-.1 2-1.3 3.1-2.4 3.7C12.8 7.9 11 4.6 8 2c.4 4-1.1 6.5-2.7 8.6C3.8 12.7 5 22 12 22z"/>',
    dumbbellSmall:'<path d="M5 8v8M2.5 10v4M19 8v8M21.5 10v4M5 12h14"/>',
    calendarCheck:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18m-13 5 2 2 4-4"/>',
    clipboard:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 10h8M8 14h8M8 18h5"/>',
    repeat:'<path d="m17 2 4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4m14-1v2a3 3 0 0 1-3 3H3"/>',
    layers:'<path d="m12 3 9 5-9 5-9-5zM3 12l9 5 9-5M3 16l9 5 9-5"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.5 2.6-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-3l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.5-2.6 1.4-1.1a8 8 0 0 1 0-1.8l-1.4-1.1 1.5-2.6 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h3l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.5 2.6-1.4 1.1a8 8 0 0 1 0 1.7z" transform="translate(-1 -1)"/>',
    dumbbellCross:'<path d="M4 9v6M2 10v4M8 7v10M8 12h8M16 7v10M22 10v4M20 9v6"/>'
  };
  function icon(name, size=20) { return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">${icons[name] || icons.info}</svg>`; }
  function uid(prefix='id') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`; }
  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function localDate(date=new Date()) { const d = new Date(date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function dateAtNoon(value) { const [y,m,d] = String(value).split('-').map(Number); return new Date(y, (m||1)-1, d||1, 12); }
  function fmtDate(value, options={ day:'numeric', month:'short' }) { if (!value) return '—'; const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? dateAtNoon(value) : new Date(value); return Number.isNaN(+d) ? '—' : new Intl.DateTimeFormat('ru-RU', options).format(d); }
  function fmtDateTime(value) { return value ? new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value)) : '—'; }
  function fmtNum(value, max=1) { return new Intl.NumberFormat('ru-RU',{maximumFractionDigits:max}).format(Number(value)||0); }
  function fmtDuration(ms) { const total = Math.max(0,Math.floor((Number(ms)||0)/1000)); const h = Math.floor(total/3600), m = Math.floor(total%3600/60); return h ? `${h} ч ${String(m).padStart(2,'0')} мин` : `${m} мин`; }
  function mondayOf(value) { const d = dateAtNoon(value); const day = (d.getDay()+6)%7; d.setDate(d.getDate()-day); return localDate(d); }
  function addDays(value, count) { const d = dateAtNoon(value); d.setDate(d.getDate()+count); return localDate(d); }
  function weekDates(value) { const start = mondayOf(value); return Array.from({length:7},(_,i)=>addDays(start,i)); }
  function round(value, decimals=1) { const m = 10**decimals; return Math.round((Number(value)||0)*m)/m; }
  function n(value, fallback=0) { const v = Number(String(value ?? '').replace(',','.')); return Number.isFinite(v) ? v : fallback; }
  function monthLabel(value) { return new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric'}).format(dateAtNoon(value)); }
  function toast(message, type='') { const root = document.getElementById('toast-root'); if (!root) return; const el = document.createElement('div'); el.className = `toast ${type}`; el.textContent = message; root.appendChild(el); setTimeout(()=>{ el.style.opacity='0'; el.style.transform='translateY(8px)'; setTimeout(()=>el.remove(),220); },2400); }
  function setTheme(theme) { let actual = theme; if (theme === 'system') actual = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = actual; }
  function download(name, blob) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1500); }
  function fileToText(file) { return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result)); r.onerror=()=>reject(r.error); r.readAsText(file); }); }
  window.TrainingUtils = { icon, uid, esc, localDate, dateAtNoon, fmtDate, fmtDateTime, fmtNum, fmtDuration, mondayOf, addDays, weekDates, round, n, monthLabel, toast, setTheme, download, fileToText };
})();

/* Оболочка интерфейса «Halo»: боковая панель, поиск-команды, горячие клавиши, частицы.
   Данные тренировок не читает и не меняет: получает от app.js только сводку через HaloShell.sync(). */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const U = () => window.TrainingUtils;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* хранилище недоступно */ } }
  };
  let snapshot = { weekDone: 0, weekTarget: 3, live: false, exercises: [] };

  /* ---------- Боковая панель ---------- */
  function setCollapsed(on, save = true) {
    document.body.classList.toggle('side-collapsed', on);
    const btn = $('[data-shell="toggle-sidebar"]');
    if (btn) { btn.setAttribute('aria-label', on ? 'Развернуть панель' : 'Свернуть панель'); btn.title = on ? 'Развернуть панель ( [ )' : 'Свернуть панель ( [ )'; }
    if (save) store.set('halo-sidebar', on ? 'collapsed' : 'open');
  }
  function toggleSidebar() { setCollapsed(!document.body.classList.contains('side-collapsed')); }

  /* ---------- Подсказки свёрнутой панели ---------- */
  let tip;
  function showTip(el) {
    if (!document.body.classList.contains('side-collapsed') || !el.dataset.tip) return;
    if (!tip) { tip = document.createElement('div'); tip.className = 'sb-tip'; document.body.appendChild(tip); }
    const parts = el.dataset.tip.split(' · ');
    tip.textContent = parts[0];
    if (parts[1]) { const k = document.createElement('kbd'); k.textContent = parts[1]; tip.appendChild(k); }
    const r = el.getBoundingClientRect();
    tip.style.left = (r.right + 14) + 'px'; tip.style.top = (r.top + r.height / 2) + 'px'; tip.classList.add('show');
  }
  function hideTip() { tip?.classList.remove('show'); }
  document.addEventListener('mouseover', ev => { const el = ev.target.closest('.sidebar [data-tip]'); if (el) showTip(el); else hideTip(); });
  document.addEventListener('focusin', ev => { const el = ev.target.closest?.('.sidebar [data-tip]'); if (el) showTip(el); });
  document.addEventListener('focusout', hideTip);
  document.addEventListener('click', hideTip);

  /* ---------- Недельная шкала ---------- */
  function paintMeter() {
    const seg = $('#sb-seg'); if (!seg) return;
    const N = 20;
    if (seg.children.length !== N) seg.innerHTML = '<i></i>'.repeat(N);
    const target = Math.max(1, snapshot.weekTarget || 3);
    const ratio = Math.min(1, snapshot.weekDone / target);
    const filled = Math.round(ratio * N);
    [...seg.children].forEach((el, i) => { el.className = i < filled ? 'on' : ''; if (i === filled - 1) el.classList.add('edge'); });
    const label = $('#sb-week'); if (label) label.textContent = snapshot.weekDone + ' / ' + target;
  }

  function sync(data) {
    snapshot = Object.assign(snapshot, data || {});
    paintMeter();
    const item = $('#sb-workout'); if (item) item.classList.toggle('has-badge', !!snapshot.live);
  }

  /* ---------- Поиск и команды ---------- */
  const NAV = [
    ['house', 'Главная', { tab: 'home' }],
    ['dumbbell', 'Тренировка', { tab: 'workout' }],
    ['calendar', 'История', { tab: 'history' }],
    ['chart', 'Прогресс', { tab: 'progress' }],
    ['list', 'Упражнения', { tab: 'exercises' }],
    ['body', 'Параметры тела', { tab: 'body' }],
    ['settings', 'Профиль и настройки', { tab: 'profile' }]
  ];
  const ACTIONS = [
    ['dumbbell', 'Начать тренировку', { action: 'quick-start' }],
    ['scale', 'Записать замер', { action: 'quick-measure' }],
    ['plus', 'Добавить упражнение', { action: 'quick-exercise' }]
  ];
  let palItems = [], palSel = 0;

  function paletteEntries(q) {
    q = q.trim().toLowerCase();
    const match = t => !q || t.toLowerCase().includes(q);
    const groups = [];
    const nav = NAV.filter(x => match(x[1])), act = ACTIONS.filter(x => match(x[1]));
    if (act.length) groups.push(['Действия', act]);
    if (nav.length) groups.push(['Разделы', nav]);
    if (q) {
      const ex = (snapshot.exercises || []).filter(n => n && n.toLowerCase().includes(q)).slice(0, 8)
        .map(n => ['list', n, { tab: 'exercises' }]);
      if (ex.length) groups.push(['Упражнения', ex]);
    }
    return groups;
  }
  function paintPalette() {
    const list = $('#palette-list'), q = $('#palette-input').value;
    const groups = paletteEntries(q);
    palItems = [];
    if (!groups.length) { list.innerHTML = '<div class="palette-empty">Ничего не найдено</div>'; return; }
    list.innerHTML = groups.map(([title, items]) => '<div class="palette-group">' + title + '</div>' + items.map(it => {
      const idx = palItems.push(it) - 1;
      return '<button type="button" class="palette-item" data-pal="' + idx + '">' + U().icon(it[0], 18) + '<span></span></button>';
    }).join('')).join('');
    [...list.querySelectorAll('.palette-item')].forEach(btn => { btn.querySelector('span').textContent = palItems[btn.dataset.pal][1]; });
    palSel = Math.min(palSel, palItems.length - 1); markSel();
  }
  function markSel() {
    const els = [...document.querySelectorAll('.palette-item')];
    els.forEach((e, i) => e.classList.toggle('is-sel', i === palSel));
    els[palSel]?.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    const p = $('#palette'); if (!p) return;
    p.classList.add('open'); const input = $('#palette-input'); input.value = ''; palSel = 0; paintPalette(); setTimeout(() => input.focus(), 30);
  }
  function closePalette() { $('#palette')?.classList.remove('open'); }
  function runItem(it) {
    closePalette();
    const target = it[2], b = document.createElement('button');
    if (target.tab) b.dataset.tab = target.tab; if (target.action) b.dataset.action = target.action;
    b.hidden = true; document.body.appendChild(b); b.click(); b.remove();
  }

  /* ---------- Горячие клавиши ---------- */
  function typing(t) { return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  document.addEventListener('keydown', ev => {
    const open = $('#palette')?.classList.contains('open');
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); open ? closePalette() : openPalette(); return; }
    if (open) {
      if (ev.key === 'Escape') { closePalette(); }
      else if (ev.key === 'ArrowDown') { ev.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); markSel(); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); palSel = Math.max(0, palSel - 1); markSel(); }
      else if (ev.key === 'Enter' && palItems[palSel]) { ev.preventDefault(); runItem(palItems[palSel]); }
      return;
    }
    if (typing(ev.target) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if ($('#modal-root')?.firstElementChild) return;
    if (ev.key === '[') { toggleSidebar(); return; }
    if (ev.key.toLowerCase() === 'n') { runItem([null, null, { action: 'quick-add' }]); return; }
    const n = Number(ev.key);
    if (n >= 1 && n <= NAV.length) runItem(NAV[n - 1]);
  });

  document.addEventListener('click', ev => {
    const sh = ev.target.closest('[data-shell]');
    if (sh) {
      const kind = sh.dataset.shell;
      if (kind === 'toggle-sidebar') toggleSidebar();
      if (kind === 'palette') openPalette();
      return;
    }
    const pal = ev.target.closest('.palette-item');
    if (pal) { runItem(palItems[Number(pal.dataset.pal)]); return; }
    if (ev.target.id === 'palette') closePalette();
  });
  document.addEventListener('input', ev => { if (ev.target.id === 'palette-input') { palSel = 0; paintPalette(); } });

  /* ---------- Частицы на фоне (лёгкие, без зависимостей) ---------- */
  function startParticles() {
    const canvas = $('#halo-fx'); if (!canvas) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let w = 0, h = 0, dpr = 1, dots = [], raf = 0;
    const count = () => Math.round(Math.min(60, Math.max(22, (w * h) / 28000)));
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1); w = innerWidth; h = innerHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = Array.from({ length: count() }, () => ({
        x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.2 + .3,
        vx: (Math.random() - .5) * .08, vy: -(Math.random() * .12 + .02), p: Math.random() * 6.28, s: Math.random() * .8 + .3
      }));
    }
    function frame(t) {
      ctx.clearRect(0, 0, w, h);
      const light = document.documentElement.dataset.theme === 'light';
      const rgb = light ? '20,20,24' : '255,255,255';
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.y < -4) { d.y = h + 4; d.x = Math.random() * w; }
        if (d.x < -4) d.x = w + 4; if (d.x > w + 4) d.x = -4;
        const a = (.12 + .38 * (.5 + .5 * Math.sin(t / 1400 * d.s + d.p))) * (light ? .55 : 1);
        ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 6.2832); ctx.fillStyle = 'rgba(' + rgb + ',' + a.toFixed(3) + ')'; ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    resize(); raf = requestAnimationFrame(frame);
    let timer; addEventListener('resize', () => { clearTimeout(timer); timer = setTimeout(resize, 200); });
    document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) raf = requestAnimationFrame(frame); });
  }

  /* ---------- Старт ---------- */
  const saved = store.get('halo-sidebar');
  if (saved) setCollapsed(saved === 'collapsed', false);
  else if (window.innerWidth < 1180) setCollapsed(true, false);
  window.HaloShell = { sync, openPalette, closePalette, toggleSidebar };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { startParticles(); paintMeter(); });
  else { startParticles(); paintMeter(); }
})();

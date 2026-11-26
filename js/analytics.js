/*
 * Optional, privacy-friendly visitor analytics for the hosted PWA.
 * This file never reads workout data or browser storage.
 */
(() => {
  'use strict';

  const siteCode = String(window.PTD_GOATCOUNTER_SITE || '').trim().toLowerCase();
  if (!siteCode || !/^[a-z0-9-]+$/.test(siteCode)) return;

  // Do not track local previews or file:// standalone copies.
  if (location.protocol !== 'https:' || /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(location.hostname)) return;

  const sectionTitles = {
    home: 'Главная',
    workout: 'Тренировка',
    history: 'История',
    progress: 'Прогресс',
    exercises: 'Упражнения',
    body: 'Параметры тела',
    profile: 'Профиль',
    more: 'Ещё'
  };

  let trackerReady = false;
  const pendingViews = [];

  function sendView(view) {
    if (trackerReady && typeof window.goatcounter?.count === 'function') {
      window.goatcounter.count(view);
      return;
    }
    if (pendingViews.length < 50) pendingViews.push(view);
  }

  const tracker = document.createElement('script');
  tracker.async = true;
  tracker.src = 'https://gc.zgo.at/count.js';
  tracker.dataset.goatcounter = `https://${siteCode}.goatcounter.com/count`;
  tracker.dataset.goatcounterSettings = '{"no_onload":true}';

  tracker.addEventListener('load', () => {
    trackerReady = true;
    sendView({ path: '/app/home', title: sectionTitles.home });
    pendingViews.splice(0).forEach(sendView);
  }, { once: true });

  tracker.addEventListener('error', () => {
    pendingViews.length = 0;
  }, { once: true });

  document.head.appendChild(tracker);

  // The app is a single-page application: count navigation between its sections.
  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest('[data-tab]');
    if (!button) return;

    const nextSection = button.dataset.tab;
    if (!sectionTitles[nextSection]) return;

    const activeSection =
      document.querySelector('.sb-item[data-tab].is-active')?.dataset.tab ||
      document.querySelector('.tab-item.is-active')?.dataset.tab;

    if (activeSection === nextSection) return;

    sendView({
      path: `/app/${nextSection}`,
      title: sectionTitles[nextSection]
    });
  }, true);
})();

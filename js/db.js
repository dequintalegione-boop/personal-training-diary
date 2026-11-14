/* IndexedDB persistence layer. User data never leaves this device. */
(function () {
  'use strict';
  const DB_NAME = 'personal-training-diary';
  const DB_VERSION = 1;
  const STORE = 'documents';
  let dbPromise;

  function defaults() {
    return {
      schemaVersion: 1,
      workouts: [], exercises: [], blocks: [], programs: [], measurements: [],
      goals: { bodyWeight: null, lifts: [] }, records: [], achievements: [], xp: 0,
      activeWorkout: null,
      settings: {
        theme: 'system', defaultStep: 2.5, restSeconds: 90, warmups: true,
        extraFields: true, weekStart: 1, oneRm: 'epley', showRpe: true,
        showNotes: true, defaultTags: true, weeklyTarget: 3
      },
      schedule: {}, movedPlans: {}, lastBackup: null
    };
  }
  function mergeDefaults(value) {
    const base = defaults();
    if (!value || typeof value !== 'object') return base;
    const merged = { ...base, ...value };
    merged.settings = { ...base.settings, ...(value.settings || {}) };
    merged.goals = { ...base.goals, ...(value.goals || {}) };
    for (const key of ['workouts','exercises','blocks','programs','measurements','records','achievements']) {
      if (!Array.isArray(merged[key])) merged[key] = [];
    }
    return merged;
  }
  function openDB() {
    if (!('indexedDB' in window)) return Promise.reject(new Error('IndexedDB недоступна'));
    if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть хранилище'));
      request.onblocked = () => reject(new Error('Хранилище заблокировано другой вкладкой'));
    });
    return dbPromise;
  }
  async function load() {
    try {
      const db = await openDB();
      const value = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const req = tx.objectStore(STORE).get('app-state');
        req.onsuccess = () => resolve(req.result ? req.result.value : null);
        req.onerror = () => reject(req.error);
      });
      return mergeDefaults(value);
    } catch (error) {
      console.warn('IndexedDB недоступна, используется локальный резерв:', error);
      try { return mergeDefaults(JSON.parse(localStorage.getItem(DB_NAME) || 'null')); }
      catch (_) { return defaults(); }
    }
  }
  async function save(state) {
    const safe = mergeDefaults(state);
    safe.schemaVersion = 1;
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({ id: 'app-state', value: safe, updatedAt: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error || new Error('Не удалось сохранить данные'));
        tx.onabort = () => reject(tx.error || new Error('Сохранение отменено'));
      });
      return { persistent: true };
    } catch (error) {
      try {
        localStorage.setItem(DB_NAME, JSON.stringify(safe));
        return { persistent: false, error };
      } catch (fallbackError) {
        throw new Error('Не удалось сохранить данные. Освободите место в браузере и экспортируйте резервную копию.');
      }
    }
  }
  async function requestPersistence() {
    try {
      if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist();
    } catch (error) { console.warn('Запрос постоянного хранилища отклонён:', error); }
    return false;
  }
  async function estimate() {
    try { return navigator.storage && navigator.storage.estimate ? await navigator.storage.estimate() : null; }
    catch (_) { return null; }
  }
  async function clear() {
    try {
      const db = await openDB();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).clear(); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
      });
    } catch (_) {}
    try { localStorage.removeItem(DB_NAME); } catch (_) {}
  }
  window.TrainingDB = { defaults, load, save, requestPersistence, estimate, clear };
})();

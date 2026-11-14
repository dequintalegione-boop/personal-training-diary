/* Loads the same-origin compressed application bundle without third-party code. */
(async function () {
  try {
    if (!('DecompressionStream' in window)) throw new Error('Этот браузер не поддерживает распаковку локального пакета приложения.');
    const response = await fetch('./js/app.js.gz');
    if (!response.ok) throw new Error('Не удалось загрузить модуль приложения.');
    const compressed = await response.arrayBuffer();
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
    const source = await new Response(stream).text();
    const scriptUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const script = document.createElement('script');
    script.src = scriptUrl;
    script.onload = () => URL.revokeObjectURL(scriptUrl);
    script.onerror = () => { URL.revokeObjectURL(scriptUrl); throw new Error('Не удалось запустить приложение.'); };
    document.body.appendChild(script);
  } catch (error) {
    console.error(error);
    const screen = document.getElementById('screen');
    if (screen) screen.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><h3>Не удалось загрузить дневник</h3><p>' + String(error.message || 'Ошибка загрузки') + '</p><button class="btn primary" onclick="location.reload()">Повторить</button></div>';
  }
})();

/* Loads the same-origin compressed runtime split into text chunks for GitHub Pages. */
(async function () {
  try {
    if (!('DecompressionStream' in window)) throw new Error('Браузер не поддерживает распаковку локального пакета приложения.');
    const names = ['00','01','02','03','04','05'];
    const responses = await Promise.all(names.map(name => fetch('./js/app-boot-' + name + '.txt')));
    if (responses.some(r => !r.ok)) throw new Error('Не удалось загрузить все части приложения.');
    const encoded = (await Promise.all(responses.map(r => r.text()))).join('').trim();
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const source = await new Response(stream).text();
    const url = URL.createObjectURL(new Blob([source], {type:'text/javascript'}));
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => URL.revokeObjectURL(url);
    script.onerror = () => { URL.revokeObjectURL(url); throw new Error('Не удалось запустить приложение.'); };
    document.body.appendChild(script);
  } catch (error) {
    console.error(error);
    const screen = document.getElementById('screen');
    if (screen) screen.innerHTML = '<div class="empty-state"><div class="empty-icon">!</div><h3>Не удалось загрузить дневник</h3><p>' + String(error.message || 'Ошибка загрузки') + '</p><button class="btn primary" onclick="location.reload()">Повторить</button></div>';
  }
})();

(function () {
  'use strict';
  const U = window.TrainingUtils;
  function lineChart(points, options={}) {
    const width=640, height=220, pad={l:42,r:12,t:16,b:30};
    const data=(points||[]).filter(p=>Number.isFinite(Number(p.value)));
    if (!data.length) return `<div class="empty-state"><div class="empty-icon">${U.icon('chart')}</div><h3>Пока нет динамики</h3><p>Добавьте несколько записей — график появится автоматически.</p></div>`;
    const vals=data.map(p=>Number(p.value)); let min=Math.min(...vals), max=Math.max(...vals);
    if (min===max) { min=Math.max(0,min*.85); max=max*1.15||1; }
    const span=max-min, x=i=>pad.l+(data.length===1?(width-pad.l-pad.r)/2:i*(width-pad.l-pad.r)/(data.length-1)), y=v=>pad.t+(max-v)/span*(height-pad.t-pad.b);
    const path=data.map((p,i)=>`${i?'L':'M'} ${x(i).toFixed(1)} ${y(Number(p.value)).toFixed(1)}`).join(' ');
    const area=`${path} L ${x(data.length-1)} ${height-pad.b} L ${x(0)} ${height-pad.b} Z`;
    const ticks=[0,.5,1].map(t=>({v:min+span*t, y:pad.t+(1-t)*(height-pad.t-pad.b)}));
    const circles=data.map((p,i)=>`<circle class="chart-point" cx="${x(i)}" cy="${y(Number(p.value))}" r="4.5" tabindex="0" role="button" data-chart-point="${i}" aria-label="${U.esc(p.label||p.date||'')} — ${U.fmtNum(p.value)}"/>`).join('');
    const labels=data.filter((_,i)=>i===0||i===data.length-1||(data.length>5&&i===Math.floor(data.length/2))).map(p=>{const i=data.indexOf(p);return `<text class="chart-label" x="${x(i)}" y="${height-7}" text-anchor="${i===0?'start':i===data.length-1?'end':'middle'}">${U.esc(p.shortLabel||p.label||'')}</text>`}).join('');
    const grid=ticks.map(t=>`<line class="chart-gridline" x1="${pad.l}" x2="${width-pad.r}" y1="${t.y}" y2="${t.y}"/><text class="chart-label" x="${pad.l-8}" y="${t.y+3}" text-anchor="end">${U.fmtNum(t.v,0)}</text>`).join('');
    return `<div class="chart-wrap" data-chart="line" data-chart-data='${U.esc(JSON.stringify(data))}'><svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${U.esc(options.aria||'График динамики')}"><defs><linearGradient id="chart-gradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="var(--accent)"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${path}"/>${circles}${labels}</svg><div class="chart-tooltip hidden" aria-live="polite"></div><div class="row between small muted"><span>${U.esc(options.leftLabel||'Начало периода')}</span><span>${U.esc(options.rightLabel||'Последняя запись')}</span></div></div>`;
  }
  function bars(items, options={}) {
    const arr=(items||[]).slice(-12); if (!arr.length) return `<div class="empty-state"><div class="empty-icon">${U.icon('chart')}</div><h3>Нет данных для сравнения</h3><p>Здесь появятся столбцы с объёмом и количеством подходов.</p></div>`;
    const max=Math.max(1,...arr.map(x=>Number(x.value)||0));
    return `<div class="bar-chart">${arr.map(item=>`<div class="bar-col" title="${U.esc(item.label)}: ${U.fmtNum(item.value)}"><i style="height:${Math.max(3,(Number(item.value)||0)/max*100)}%"></i><small>${U.esc(item.shortLabel||item.label)}</small></div>`).join('')}</div>`;
  }
  function distribution(items) {
    const arr=(items||[]).filter(x=>x.value>0); const max=Math.max(1,...arr.map(x=>x.value));
    if(!arr.length) return `<div class="empty-state"><div class="empty-icon">${U.icon('target')}</div><h3>Распределение появится позже</h3><p>Записывайте рабочие подходы, чтобы увидеть нагрузку по группам мышц.</p></div>`;
    return `<div class="stack">${arr.map(x=>`<div><div class="row between"><span class="list-title">${U.esc(x.label)}</span><span class="small muted">${x.value} подх.</span></div><div class="progress-track" style="margin-top:6px"><div class="progress-fill" style="width:${x.value/max*100}%"></div></div></div>`).join('')}</div>`;
  }
  function heatmap(workouts, year=new Date().getFullYear()) {
    const counts={}; (workouts||[]).forEach(w=>{counts[w.date]=(counts[w.date]||0)+1;});
    const start=new Date(year,0,1,12); const end=new Date(year,11,31,12); const offset=(start.getDay()+6)%7; const days=[];
    for(let i=0;i<offset;i++) days.push(null);
    for(let d=new Date(start);d<=end;d.setDate(d.getDate()+1)) days.push(U.localDate(d));
    const cells=days.map(date=>{const c=date?counts[date]||0:0; const level=c>=3?'l4':c===2?'l3':c===1?'l2':''; return `<div class="heat-cell ${level}" title="${date?U.fmtDate(date,{day:'numeric',month:'short',year:'numeric'})+': '+c+' тренировок':''}"></div>`}).join('');
    return `<div class="heatmap" aria-label="Карта активности за ${year}">${cells}</div><div class="row between small muted" style="margin-top:9px"><span>Меньше</span><span>Больше&nbsp; · &nbsp;${year}</span></div>`;
  }
  window.TrainingCharts={lineChart,bars,distribution,heatmap};
})();

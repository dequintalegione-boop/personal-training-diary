(function () {
  'use strict';
  const U=window.TrainingUtils, DB=window.TrainingDB, Charts=window.TrainingCharts, Backup=window.TrainingBackup;
  let state, tab='home', exerciseMode='library', monthCursor=new Date(), historyDate='', historySearch='', exerciseSearch='', exerciseMuscle='all', exerciseEquipment='all';
  let progressPeriod='3m', progressExercise='all', bodyMetric='weight', bodyCompareFrom='', bodyCompareTo='', importState=null, installPrompt=null, renderToken=0, achievementsExpanded=false, expandedProgramDays=new Set(), restAudioContext=null;
  const screen=document.getElementById('screen'), modalRoot=document.getElementById('modal-root');
  const muscleNames=['Грудь','Спина','Плечи','Бицепс','Трицепс','Предплечья','Пресс','Квадрицепс','Бицепс бедра','Ягодицы','Икры','Трапеции','Поясница','Шея','Другое'];
  const equipmentNames=['Штанга','Гантели','Блок','Тренажёр','Собственный вес','Другое'];
  const measureNames={weight:'Вес тела',chest:'Грудь',waist:'Талия',hips:'Бёдра',shoulders:'Плечи',neck:'Шея',bicepsLeft:'Бицепс левый',bicepsRight:'Бицепс правый',forearmLeft:'Предплечье левое',forearmRight:'Предплечье правое',thighLeft:'Бедро левое',thighRight:'Бедро правое',calfLeft:'Икра левая',calfRight:'Икра правая'};
  const tagsAvailable=['До отказа','Дроп-сет','Суперсет','Помощь партнёра','Плохая техника','Пауза'];
  const dayNames=['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const shortDays=['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const totalSets=w=>(w.exercises||[]).reduce((s,e)=>s+(e.sets||[]).filter(x=>x.done&&x.type!=='warmup').length,0);
  const workoutVolume=w=>(w.exercises||[]).reduce((sum,e)=>sum+(e.sets||[]).filter(x=>x.done&&x.type!=='warmup').reduce((v,x)=>v+(Number(x.weight)||0)*(Number(x.reps)||0),0),0);
  const activeWorkouts=()=>state.workouts.filter(w=>w.endAt);
  const findExercise=id=>state.exercises.find(e=>e.id===id);
  const exerciseName=id=>findExercise(id)?.name||'Упражнение удалено';
  const sortWorkouts=arr=>[...arr].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.endAt||'').localeCompare(a.endAt||''));
  const localSetCount=w=>(w.exercises||[]).reduce((s,e)=>s+(e.sets||[]).length,0);
  const getExerciseFromWorkout=(w,id)=>w?.exercises?.find(e=>e.exerciseId===id);
  const allDoneSets=(exercise)=> (exercise?.sets||[]).filter(s=>s.done&&s.type!=='warmup');
  const getE1RM=(weight,reps)=>state.settings.oneRm==='brzycki'?(reps>0&&reps<37?weight*36/(37-reps):weight):weight*(1+Math.max(0,reps)/30);
  const currentMonthKey=()=>`${monthCursor.getFullYear()}-${String(monthCursor.getMonth()+1).padStart(2,'0')}`;
  const dateIsToday=d=>d===U.localDate();
  function save(quiet=false) { return DB.save(state).then(result=>{if(!quiet&&result.persistent===false)U.toast('Сохранено в резерв браузера');return result;}).catch(error=>{U.toast(error.message||'Ошибка сохранения','error');throw error;}); }
  function pageHeading(title,subtitle,action='') { return `<div class="page-heading"><div><h1>${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}</div>${action}</div>`; }
  function section(title,action='') { return `<div class="section-heading"><h2>${title}</h2>${action}</div>`; }
  function empty(icon,title,copy,button='') { return `<div class="empty-state"><div class="empty-icon">${U.icon(icon,25)}</div><h3>${title}</h3><p>${copy}</p>${button}</div>`; }
  function button(label,action,variant='primary',icon='') { return `<button type="button" class="btn ${variant}" data-action="${action}">${icon?U.icon(icon,17):''}${label}</button>`; }
  function progressRing(value,max,label) { const pct=max?Math.min(100,Math.max(0,value/max*100)):0; return `<div class="progress-ring"><svg viewBox="0 0 82 82"><circle class="track" cx="41" cy="41" r="35"/><circle class="value" cx="41" cy="41" r="35" style="stroke-dasharray:220;stroke-dashoffset:${220-220*pct/100}"/></svg><span class="ring-label">${Math.round(pct)}%</span></div>`; }
  function kpi(value,label,foot='',icon='') { return `<div class="card kpi"><div class="row between"><span class="kpi-label">${label}</span>${icon?`<span class="muted">${U.icon(icon,17)}</span>`:''}</div><div class="kpi-value">${value}</div>${foot?`<div class="kpi-foot">${foot}</div>`:''}</div>`; }
  function dateRange(period) {
    const end=U.localDate(); const d=U.dateAtNoon(end); let start;
    if(period==='month'){start=U.localDate(new Date(d.getFullYear(),d.getMonth(),1));}
    else if(period==='3m'){start=U.localDate(new Date(d.getFullYear(),d.getMonth()-2,1));}
    else if(period==='6m'){start=U.localDate(new Date(d.getFullYear(),d.getMonth()-5,1));}
    else if(period==='year'){start=U.localDate(new Date(d.getFullYear(),0,1));}
    else start='0000-01-01';
    return {start,end};
  }
  function inPeriod(w,period){const r=dateRange(period);return w.date>=r.start&&w.date<=r.end;}
  function lastForExercise(exerciseId, excludeWorkoutId=null) {
    const activeDate=state.activeWorkout?.workout?.date||U.localDate();const list=sortWorkouts(state.workouts.filter(w=>w.id!==excludeWorkoutId&&w.date<=activeDate&&getExerciseFromWorkout(w,exerciseId)));
    return list[0]?getExerciseFromWorkout(list[0],exerciseId):null;
  }
  function newSetFromHistory(exerciseId,index,defaultReps=8) {
    const previous=lastForExercise(exerciseId); const sets=allDoneSets(previous);
    const src=sets[index]||sets[sets.length-1];
    return {id:U.uid('set'),weight:src?Number(src.weight)||0:0,reps:src?Number(src.reps)||defaultReps:defaultReps,type:'work',done:false,tags:[],rpe:null,rir:null,note:'',restSeconds:null,createdAt:new Date().toISOString()};
  }
  function makeSessionExercise(id, count=1, reps=8) {
    const ex=findExercise(id); if(!ex) return null;
    return {exerciseId:id,name:ex.name,muscles:[...(ex.muscles||[])],equipment:ex.equipment||'',sets:Array.from({length:Math.max(1,Math.min(12,Number(count)||1))},(_,i)=>newSetFromHistory(id,i,reps))};
  }
  function findTodayPlan() {
    const weekday=U.dateAtNoon(U.localDate()).getDay();
    for(const p of state.programs) for(const d of (p.days||[])) if(d.weekday!==null&&d.weekday!==undefined&&Number(d.weekday)===weekday) return {program:p,day:d};
    return null;
  }
  function hasWorkoutOnDate(date){return activeWorkouts().some(w=>w.date===date)||(state.activeWorkout?.workout?.date===date);}
  function findMissedPlan(){const today=U.localDate(),yesterday=U.addDays(today,-1);if(hasWorkoutOnDate(today)||hasWorkoutOnDate(yesterday))return null;const weekday=U.dateAtNoon(yesterday).getDay();for(const p of state.programs)for(const d of p.days||[])if(d.weekday!==null&&d.weekday!==undefined&&Number(d.weekday)===weekday)return {program:p,day:d};return null;}
  function makeWorkout(plan=null, source=null) {
    if(state.activeWorkout?.workout){tab='workout';render();U.toast('У тебя уже есть незавершённая тренировка. Продолжи её.');return;}
    const now=new Date(); const w={id:U.uid('workout'),date:U.localDate(now),title:plan?.day?.name||source?.title||'Тренировка',startAt:now.toISOString(),endAt:null,duration:0,volume:0,sourceProgram:plan?.program?.id||source?.sourceProgram||'',sourceProgramDay:plan?.day?.id||source?.sourceProgramDay||'',exercises:[]};
    if(plan) (plan.day.items||[]).forEach(item=>{const e=makeSessionExercise(item.exerciseId,item.sets||1,item.repsMin||8);if(e){const previous=lastForExercise(item.exerciseId);const hasPreviousResults=allDoneSets(previous).length>0;const plannedStart=Number(item.startingWeightKg)||0;if(plannedStart>0&&!hasPreviousResults)e.sets.forEach(s=>{if(!s.weight)s.weight=plannedStart;});if(Number(item.warmupSets)>0&&state.settings.warmups){const warmupCount=Math.min(5,Number(item.warmupSets));const baseWeight=plannedStart>0&&!hasPreviousResults?plannedStart:(Number(e.sets[0]?.weight)||0);const warmups=Array.from({length:warmupCount},(_,i)=>({id:U.uid('set'),weight:baseWeight>0?U.round(baseWeight*(.5+.2*i),2):0,reps:Math.max(1,Math.min(12,Number(item.repsMin)||8)),type:'warmup',done:false,tags:[],rpe:null,rir:null,note:'',restSeconds:null,createdAt:new Date().toISOString()}));e.sets=[...warmups,...e.sets];}w.exercises.push(e);}});
    if(source) (source.exercises||[]).forEach(e=>{const s=makeSessionExercise(e.exerciseId,(e.sets||[]).length||1,8);if(s){s.sets.forEach((x,i)=>{const prev=e.sets?.[i];if(prev){x.weight=Number(prev.weight)||0;x.reps=Number(prev.reps)||0;}});w.exercises.push(s);}});
    state.activeWorkout={workout:w,rest:null,recordFlash:null}; save(true); tab='workout'; render();
  }
  function currentWorkout(){return state.activeWorkout?.workout||null;}
  function findSet(id){for(const e of currentWorkout()?.exercises||[]){const set=e.sets.find(s=>s.id===id);if(set)return {set,exercise:e};}return null;}
  function restSecondsFor(ex){return Number(findExercise(ex.exerciseId)?.rest)||Number(state.settings.restSeconds)||90;}
  function showModal(title,subtitle,content,buttons='') {
    modalRoot.innerHTML=`<div class="modal-backdrop" data-action="backdrop-close"><section class="modal-sheet" role="dialog" aria-modal="true" aria-label="${U.esc(title)}"><div class="sheet-handle"></div><div class="modal-head"><div><h2>${U.esc(title)}</h2>${subtitle?`<p>${U.esc(subtitle)}</p>`:''}</div><button class="modal-close" data-action="close-modal" aria-label="Закрыть">×</button></div>${content}${buttons?`<div class="modal-actions">${buttons}</div>`:''}</section></div>`;
    const sheet=$('.modal-sheet',modalRoot); let startY=0, startScroll=0, dragging=false;
    sheet.addEventListener('touchstart',e=>{startY=e.touches[0].clientY;startScroll=sheet.scrollTop;dragging=false;},{passive:true});
    sheet.addEventListener('touchmove',e=>{
      if(startScroll>0||sheet.scrollTop>0)return;
      const delta=e.touches[0].clientY-startY;
      if(delta>0){dragging=true;sheet.classList.add('is-dragging');sheet.style.transform=`translate3d(0,${Math.min(delta,260)}px,0)`;}
    },{passive:true});
    sheet.addEventListener('touchend',e=>{
      const delta=e.changedTouches[0].clientY-startY;
      sheet.classList.remove('is-dragging');
      if(dragging&&delta>125&&sheet.scrollTop===0)closeModal();
      else sheet.style.transform='';
      dragging=false;
    },{passive:true});
    sheet.addEventListener('touchcancel',()=>{sheet.classList.remove('is-dragging');sheet.style.transform='';dragging=false;},{passive:true});
    setTimeout(()=>$('.modal-close',modalRoot)?.focus(),40);
  }
  function closeModal(){
    const backdrop=$('.modal-backdrop',modalRoot);
    if(!backdrop){modalRoot.innerHTML='';return;}
    backdrop.classList.add('is-closing');
    $('.modal-sheet',backdrop)?.classList.add('is-closing');
    setTimeout(()=>{if(modalRoot.firstElementChild===backdrop)modalRoot.innerHTML='';},220);
  }
  function render(animate=false){
    if(!state)return; renderToken++;
    syncRestTimer();
    U.setTheme(state.settings.theme);
    const navTab=['exercises','body','profile'].includes(tab)?'more':tab;
    $$('.tab-item,.sb-item[data-tab]').forEach(b=>b.classList.toggle('is-active',b.dataset.tab===(b.classList.contains('sb-item')?tab:navTab)));
    $$('[data-icon]').forEach(node=>{ node.innerHTML=U.icon(node.dataset.icon,20); });
    const renderers={home:renderHome,workout:renderWorkout,history:renderHistory,exercises:renderExercises,progress:renderProgress,body:renderBody,profile:renderProfile,more:renderMore};
    screen.classList.remove('is-entering');
    screen.innerHTML=(renderers[tab]||renderHome)();
    if(animate){void screen.offsetWidth;screen.classList.add('is-entering');}
    screen.focus({preventScroll:true});
    updateLiveWorkoutIndicator();
    if(window.HaloShell){try{const wk=weekDatesConfigured(U.localDate());window.HaloShell.sync({weekDone:activeWorkouts().filter(w=>wk.includes(w.date)).length,weekTarget:Number(state.settings.weeklyTarget)||3,live:!!currentWorkout(),exercises:(state.exercises||[]).map(e=>e&&e.name).filter(Boolean)});}catch(e){console.warn(e);}}
  }
  function renderMore(){
    const rows=[
      ['list','Упражнения','Библиотека, блоки и программы','exercises'],
      ['body','Параметры тела','Замеры, цели и динамика','body'],
      ['user','Профиль и настройки','Темы, резервные копии и параметры','profile']
    ];
    return `${pageHeading('Ещё','Дополнительные разделы дневника')}
      <div class="ios-settings-group">
        ${rows.map(([icon,title,detail,sectionName])=>`<button type="button" class="ios-settings-row" data-action="open-section" data-section="${sectionName}">
          <span class="ios-settings-icon">${U.icon(icon,19)}</span>
          <span class="ios-settings-copy"><b>${title}</b><small>${detail}</small></span>
          <span class="ios-settings-chevron">${U.icon('chevron',17)}</span>
        </button>`).join('')}
      </div>
      <p class="ios-settings-footnote">Все разделы и данные остались на месте. Здесь собраны инструменты, которыми пользуются не каждый день.</p>`;
  }
  function startOfWeek(date){const d=U.dateAtNoon(date);const day=(d.getDay()-Number(state.settings.weekStart??1)+7)%7;d.setDate(d.getDate()-day);return U.localDate(d);}
  function weekDatesConfigured(date){const start=startOfWeek(date);return Array.from({length:7},(_,i)=>U.addDays(start,i));}
  function shortDaysConfigured(){const days=['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];const start=Number(state.settings.weekStart??1);return Array.from({length:7},(_,i)=>days[(start+i)%7]);}
  function renderHome(){
    const today=U.localDate(), week=weekDatesConfigured(today), doneThis=activeWorkouts().filter(w=>week.includes(w.date)), prevStart=U.addDays(week[0],-7), prevEnd=U.addDays(week[6],-7), prev=activeWorkouts().filter(w=>w.date>=prevStart&&w.date<=prevEnd);
    const volume=doneThis.reduce((s,w)=>s+workoutVolume(w),0), prevVolume=prev.reduce((s,w)=>s+workoutVolume(w),0), diff=prevVolume?Math.round((volume-prevVolume)/prevVolume*100):null;
    const plan=findTodayPlan(), todayActive=state.activeWorkout?.workout?.date===today?state.activeWorkout.workout:null, todayCompleted=sortWorkouts(activeWorkouts().filter(w=>w.date===today))[0]||null, todaySession=todayActive?{...todayActive,isActive:true}:todayCompleted?{...todayCompleted,isActive:false}:null, missed=!plan?findMissedPlan():null, last=sortWorkouts(activeWorkouts())[0], streak=calculateStreak(), target=Number(state.settings.weeklyTarget)||3;
    const weekdayLabels=shortDaysConfigured();
    const daily=week.map((day,i)=>({day,i,has:doneThis.some(w=>w.date===day),volume:doneThis.filter(w=>w.date===day).reduce((s,w)=>s+workoutVolume(w),0)}));
    const weeklyBars=`<div class="week-bars">${daily.map(x=>`<div class="week-day ${x.day===today?'today':''}"><div class="bar-track"><div class="bar-fill" style="height:${x.has?Math.max(12,Math.min(100,x.volume/Math.max(1,...daily.map(d=>d.volume))*100)):3}%"></div></div><span class="day-label">${weekdayLabels[x.i]}</span></div>`).join('')}</div>`;
    const planContent=todaySession?`<div class="row between"><div><span class="pill green">${todaySession.isActive?'Тренировка идёт':'Тренировка выполнена сегодня'}</span><h3 style="font-size:19px;letter-spacing:-.04em;margin:11px 0 4px">${U.esc(todaySession.title||'Тренировка')}</h3><div class="body-copy">${(todaySession.exercises||[]).length} упражнений в занятии · ${totalSets(todaySession)} рабочих подходов</div></div>${U.icon('calendarCheck',27)}</div><div class="divider"></div><div class="row between"><span class="small muted">Фактический объём</span><b>${U.fmtNum(workoutVolume(todaySession),0)} кг</b></div><div style="margin-top:14px">${todaySession.isActive?'<button class="btn primary" data-tab="workout">Продолжить тренировку</button>':`<button class="btn ghost" data-action="open-workout" data-id="${todaySession.id}">Открыть итоги</button>`}</div>`:plan?`<div class="row between"><div><span class="pill blue">План на сегодня</span><h3 style="font-size:19px;letter-spacing:-.04em;margin:11px 0 4px">${U.esc(plan.day.name||plan.program.name)}</h3><div class="body-copy">${plan.day.items.length} упражн. · ${U.esc(plan.program.name)}</div></div>${U.icon('calendarCheck',27)}</div><div class="divider"></div>${programExercisePreview(plan.day,4)}<div class="row wrap" style="margin-top:15px">${button('Начать тренировку','start-plan','primary','dumbbell')}<button class="btn secondary" data-action="move-plan" data-program="${plan.program.id}" data-day="${plan.day.id}" aria-label="Перенести план">${U.icon('repeat')}</button><button class="btn ghost small-btn" data-action="edit-program-day" data-program="${plan.program.id}" data-day="${plan.day.id}">Изменить план</button></div>`:missed?`<div class="row between"><div><span class="pill orange">План не выполнен</span><h3 style="font-size:18px;letter-spacing:-.04em;margin:11px 0 4px">${U.esc(missed.day.name)}</h3><p class="body-copy" style="margin:0">Вчера был запланирован этот день. Перенести его на сегодня?</p></div>${U.icon('calendar',28)}</div><div class="row" style="margin-top:15px"><button class="btn primary" data-action="move-missed-plan" data-program="${missed.program.id}" data-day="${missed.day.id}">Перенести на сегодня</button><button class="btn secondary" data-action="start-program" data-program="${missed.program.id}" data-day="${missed.day.id}">Начать</button></div>`:`<div class="row between"><div><span class="pill">План не назначен</span><h3 style="font-size:18px;letter-spacing:-.04em;margin:11px 0 4px">Сегодня свободный день</h3><p class="body-copy" style="margin:0">Создайте программу и назначьте её на день недели или начните тренировку с нуля.</p></div>${U.icon('calendar',28)}</div><div style="margin-top:15px">${button('Создать программу','add-program','ghost','plus')}</div>`;
    const bodyGoal=state.goals.bodyWeight; const weight=latestMeasurement('weight');
    const badgePreview=nextAchievement();
    return `${pageHeading('Привет!','Твоя работа — твой прогресс.',`<span class="pill green">${U.icon('bolt',13)} Только на устройстве</span>`)}
      ${state.activeWorkout?`<div class="inline-notice row between" style="margin-bottom:12px"><span>Есть незавершённая тренировка — черновик сохранён.</span><button class="btn primary small-btn" data-tab="workout">Продолжить</button></div>`:''}
      <div class="home-layout"><div class="home-primary">
      <div class="card">${planContent}</div>
      <div class="row" style="margin-top:10px">${button('Пустая тренировка','start-empty','secondary','plus')}<button class="btn secondary" data-action="repeat-last" style="flex:1">${U.icon('repeat')} Повторить прошлую</button></div>
      ${section('Последняя тренировка',`<button class="subtle-link" data-tab="history">Вся история ${U.icon('chevron',13)}</button>`)}
      ${last?`<div class="card"><div class="row between"><div><span class="eyebrow">${U.fmtDate(last.date,{day:'numeric',month:'long',year:'numeric'})}</span><h3 style="font-size:17px;margin:5px 0 3px;letter-spacing:-.03em">${U.esc(last.title||'Тренировка')}</h3><span class="small muted">${(last.exercises||[]).length} упражн. · ${totalSets(last)} рабочих подходов</span></div><span class="pill green">${U.icon('check',13)} Завершена</span></div><div class="grid-3" style="margin-top:16px"><div><b style="font-size:18px">${U.fmtDuration(last.duration||0)}</b><div class="small muted">Длительность</div></div><div><b style="font-size:18px">${U.fmtNum(workoutVolume(last),0)}</b><div class="small muted">Объём, кг</div></div><div><b style="font-size:18px">${totalSets(last)}</b><div class="small muted">Подходы</div></div></div><div style="margin-top:12px">${button('Открыть тренировку','open-workout','ghost','arrow').replace('data-action="open-workout"','data-action="open-workout" data-id="'+last.id+'')}</div></div>`:empty('dumbbell','Пока без тренировок','Первая запись появится здесь после завершения занятия.',button('Начать первую','start-empty','primary','plus'))}
      ${section('Недельный ритм')}
      <div class="card"><div class="row between"><div><div class="eyebrow">ТРЕНИРОВОК ЗА НЕДЕЛЮ</div><div class="kpi-value" style="margin-top:7px">${doneThis.length}<span class="muted" style="font-size:16px;font-weight:600"> / ${target}</span></div><div class="compare" style="margin-top:7px">${diff===null?'<span class="muted">Сравнение появится со следующей недели</span>':`<span class="${diff>=0?'positive':'negative'}">${diff>=0?'+':''}${diff}%</span><span class="muted">объём к прошлой неделе</span>`}</div></div><div>${progressRing(doneThis.length,target)}<div class="ring-caption">цель недели</div></div></div>${weeklyBars}<div class="divider"></div><div class="row between"><span class="small muted">Объём за неделю</span><b>${U.fmtNum(volume,0)} кг</b></div></div>
      </div><div class="home-secondary">
      <div class="grid-2">${kpi(streak.current,'Дней подряд',`${streak.best?`Лучшая серия: ${streak.best} дн.`:'Начни серию сегодня'}`,'fire')}${kpi(U.fmtNum(state.xp||0,0),'Опыт',`Уровень ${Math.floor((state.xp||0)/250)+1}`,'trophy')}</div>
      ${section('Цели и ориентиры')}
      <div class="card">${bodyGoal?renderBodyGoalCompact(bodyGoal,weight):`<div class="row between"><div><b>Вес тела</b><div class="small muted">Цель ещё не задана</div></div>${U.icon('scale',22)}</div>`}<div class="divider"></div>${(state.goals.lifts||[]).slice(0,2).map(g=>renderLiftGoalCompact(g)).join('')||`<div class="row between"><span class="small muted">Цели по рабочим весам</span><button class="subtle-link" data-action="add-goal">Добавить</button></div>`}</div>
      ${section('Ближайшее достижение')}
      <div class="card"><div class="row"><div class="achievement-icon locked">${U.icon('trophy',21)}</div><div class="list-main"><b class="list-title">${U.esc(badgePreview.title)}</b><div class="list-meta">${U.esc(badgePreview.description)}</div><div class="progress-track" style="margin-top:8px"><div class="progress-fill" style="width:${badgePreview.progress}%"></div></div></div><b class="small">${badgePreview.progress}%</b></div></div>
      ${section('Итог недели')}
      <div class="card soft"><div class="row between"><b class="list-title">${doneThis.length?`На этой неделе ${doneThis.length} ${plural(doneThis.length,'тренировка','тренировки','тренировок')}`:'Неделя только начинается'}</b><span class="pill ${diff!==null&&diff>=0?'green':'blue'}">${diff===null?'—':`${diff>=0?'+':''}${diff}%`}</span></div><p class="body-copy" style="margin:8px 0 0">${weeklyMuscleSummary(doneThis)}</p></div>
      </div></div>`;
  }
  function plural(n,a,b,c){const x=n%10,y=n%100;return y>=11&&y<=14?c:x===1?a:x>=2&&x<=4?b:c;}
  function latestMeasurement(type){return [...state.measurements].filter(m=>m.type===type).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;}
  function forecastMeasurementGoal(goal,current){const a=state.measurements.filter(m=>m.type==='weight').sort((x,y)=>x.date.localeCompare(y.date));if(a.length<2||!current)return '';const first=a[0],last=a[a.length-1],days=(U.dateAtNoon(last.date)-U.dateAtNoon(first.date))/86400000;if(days<7)return '';const rate=(Number(last.value)-Number(first.value))/days,diff=Number(goal.targetValue)-Number(current.value);if(!rate||diff/rate<=0)return '';const eta=Math.ceil(diff/rate);if(!Number.isFinite(eta)||eta>3650)return '';return `При текущем темпе — около ${U.fmtDate(U.addDays(U.localDate(),eta),{day:'numeric',month:'short',year:'numeric'})}`;}
  function renderBodyGoalCompact(goal,latest){const current=latest?.value??goal.startValue??0;const target=Number(goal.targetValue)||0;const start=Number(goal.startValue)||current;const pct=start===target?100:Math.max(0,Math.min(100,Math.abs((current-start)/(target-start||1))*100));return `<div class="row between"><div><b class="list-title">Цель по весу тела</b><div class="small muted">${latest?`${U.fmtNum(current)} кг сейчас`:'Добавьте первое взвешивание'}</div><div class="small" style="margin-top:5px;color:var(--accent)">Цель ${U.fmtNum(target)} кг · ${Math.abs(target-current).toFixed(1).replace('.',',')} кг осталось</div><div class="small muted" style="margin-top:5px">${forecastMeasurementGoal(goal,latest)}</div></div>${progressRing(pct,100)}</div>`;}
  function renderLiftGoalCompact(g){const ex=findExercise(g.exerciseId);const current=latestExerciseBest(g.exerciseId);const pct=current?.weight&&g.targetValue?Math.min(100,current.weight/g.targetValue*100):0;return `<div style="margin-top:10px"><div class="row between"><span class="list-title">${U.esc(ex?.name||g.exerciseName||'Упражнение')}</span><span class="small muted">${current?U.fmtNum(current.weight)+' / ':''}${U.fmtNum(g.targetValue)} кг</span></div><div class="progress-track" style="margin-top:7px"><div class="progress-fill" style="width:${pct}%"></div></div></div>`;}
  function latestExerciseBest(id){let best=null;activeWorkouts().forEach(w=>{const e=getExerciseFromWorkout(w,id);allDoneSets(e).forEach(s=>{if(!best||Number(s.weight)>best.weight)best={weight:Number(s.weight)||0,reps:Number(s.reps)||0,date:w.date};});});return best;}
  function calculateStreak(){const dates=[...new Set(activeWorkouts().map(w=>w.date))].sort();if(!dates.length)return {current:0,best:0};let best=1,run=1;for(let i=1;i<dates.length;i++){if(U.addDays(dates[i-1],1)===dates[i])run++;else run=1;best=Math.max(best,run);}let current=0,d=U.localDate(),set=new Set(dates);if(!set.has(d))d=U.addDays(d,-1);while(set.has(d)){current++;d=U.addDays(d,-1);}return {current,best};}
  function nextAchievement(){const completed=activeWorkouts().length;const next=completed<1?{title:'Первый шаг',description:'Заверши первую тренировку',goal:1}:completed<10?{title:'10 тренировок',description:'Собери первые 10 завершённых тренировок',goal:10}:completed<50?{title:'Стабильность',description:'Дойди до 50 тренировок',goal:50}:{title:'Мастер привычки',description:'100 завершённых тренировок',goal:100};const prev=next.goal===1?0:next.goal===10?1:next.goal===50?10:50;return {...next,progress:Math.min(100,Math.round(completed/next.goal*100))};}
  function weeklyMuscleSummary(workouts){const groups={};workouts.forEach(w=>(w.exercises||[]).forEach(e=>(e.muscles||findExercise(e.exerciseId)?.muscles||[]).forEach(m=>groups[m]=(groups[m]||0)+allDoneSets(e).length)));const top=Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,3);return top.length?`Больше всего рабочих подходов: ${top.map(x=>`${x[0]} (${x[1]})`).join(', ')}.`:'Когда появятся тренировки, здесь будет краткий разбор нагрузки по мышечным группам.';}
  function renderWorkout(){
    const w=currentWorkout();
    if(!w){
      const plans=state.programs.flatMap(p=>(p.days||[]).map(d=>({p,d})));
      return `${pageHeading('Тренировка','Быстрая запись подходов — без лишних действий.')}
        ${state.activeWorkout?'<div class="inline-notice">Найдена незавершённая тренировка. Продолжите её, чтобы не потерять записи.</div>':''}
        <div class="card accent-card" style="padding:22px"><div class="eyebrow">ГОТОВ К РАБОТЕ?</div><h2 style="font-size:25px;letter-spacing:-.05em;margin:9px 0 6px">Начни с первого подхода</h2><p class="muted" style="margin:0 0 17px;font-size:12px">Вес и повторы подставятся из прошлой тренировки, если упражнение уже встречалось.</p>${button('Начать пустую тренировку','start-empty','secondary','plus')}</div>
        ${section('Или выбери программу')}
        ${plans.length?plans.map(({p,d})=>`<div class="card" style="margin-bottom:10px"><div class="row between"><div><span class="pill blue">${U.esc(p.name)}</span><h3 style="font-size:17px;margin:9px 0 3px">${U.esc(d.name||'Тренировочный день')}</h3><span class="small muted">${(d.items||[]).length} упражнений · ${d.weekday===null||d.weekday===undefined?'Без дня':dayNames[Number(d.weekday)]}</span></div><button class="icon-button" data-action="start-program" data-program="${p.id}" data-day="${d.id}" aria-label="Начать">${U.icon('arrow')}</button></div><div class="divider"></div>${programExercisePreview(d,4)}<div class="row wrap" style="margin-top:8px"><button class="btn ghost small-btn" data-action="edit-program-day" data-program="${p.id}" data-day="${d.id}">Редактировать</button></div></div>`).join(''):empty('layers','Программы не созданы','Создайте программу в разделе «Упражнения» или начните пустую тренировку.',button('Создать программу','add-program','primary','plus'))}
        ${state.workouts.length?`<div style="margin-top:18px">${button('Повторить последнюю тренировку','repeat-last','secondary','repeat')}</div>`:''}`;
    }
    const elapsed=Math.max(0,Date.now()-new Date(w.startAt).getTime()), volume=workoutVolume(w), sets=totalSets(w), rest=state.activeWorkout.rest;
    const restHtml=rest?`<div class="rest-panel" data-rest-panel><svg class="rest-ring" viewBox="0 0 48 48"><circle class="track" cx="24" cy="24" r="19"/><circle class="progress" cx="24" cy="24" r="19" stroke-dasharray="119" stroke-dashoffset="${119*(1-Math.max(0,(rest.until-Date.now())/1000)/(rest.duration||1))}"/></svg><div class="rest-info"><div class="rest-time" data-rest-time>${formatSeconds(Math.max(0,Math.ceil((rest.until-Date.now())/1000)))}</div><div class="rest-caption">Отдых · можно продолжать раньше</div></div><div class="rest-actions"><button data-action="timer-add">+15</button><button data-action="timer-skip">Пропустить</button></div></div>`:'';
    const exercises=w.exercises.map((e,ei)=>renderSessionExercise(e,ei)).join('');
    return `${pageHeading(U.esc(w.title||'Тренировка'),`Начата ${U.fmtDateTime(w.startAt)} · <span data-workout-elapsed>${U.fmtDuration(elapsed)}</span>`,`<span class="pill green">${U.icon('bolt',12)} Идёт</span>`)}
      ${restHtml}
      <div class="workout-stats"><div class="workout-stat"><b data-workout-duration>${U.fmtDuration(elapsed)}</b><span>время</span></div><div class="workout-stat"><b data-workout-volume>${U.fmtNum(volume,0)} кг</b><span>рабочий объём</span></div><div class="workout-stat"><b data-workout-sets>${sets}</b><span>подходов</span></div></div>
      ${state.activeWorkout.recordFlash?`<div class="record-banner"><div class="row"><span style="color:var(--orange)">${U.icon('trophy',19)}</span><div><b style="font-size:12px">Новый личный рекорд!</b><div class="small muted">${U.esc(state.activeWorkout.recordFlash)}</div></div></div></div>`:''}
      ${exercises||empty('dumbbell','Добавьте первое упражнение','Подберите его из своей библиотеки. История результатов автоматически подставит вес и повторы.')}
      <div class="stack" style="margin-top:14px"><div class="grid-2"><button class="btn secondary block" data-action="show-add-exercise">${U.icon('plus')} Упражнение</button><button class="btn secondary block" data-action="show-add-block">${U.icon('layers')} Блок</button></div><button class="btn primary block" data-action="finish-workout">Завершить тренировку ${U.icon('arrow')}</button><button class="btn ghost block" data-action="edit-workout-date">Изменить дату тренировки</button><button class="btn danger block" data-action="cancel-active">Отменить тренировку</button></div>`;
  }
  function formatSeconds(s){const m=Math.floor(s/60),sec=s%60;return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;}
  function renderSessionExercise(e,index){
    const library=findExercise(e.exerciseId),step=Number(library?.step)||Number(state.settings.defaultStep)||2.5;
    const sets=e.sets.map((s,i)=>`<div class="set-card ${s.done?'done':''}" data-set-card="${s.id}"><div class="set-head"><span class="set-number">${s.type==='warmup'?'РАЗМИНКА':`ПОДХОД ${i+1}`}</span><div class="row" style="gap:5px"><span class="pill ${s.done?'green':s.type==='warmup'?'orange':'blue'}">${s.done?'Записан':s.type==='warmup'?'Разминочный':'Рабочий'}</span><button class="icon-button" style="width:34px;height:34px" data-action="remove-set" data-id="${s.id}" aria-label="Удалить подход">${U.icon('trash',15)}</button></div></div>
      <div class="set-controls"><div><div class="step-label">ВЕС · КГ</div><div class="stepper"><button data-action="adjust-set" data-id="${s.id}" data-field="weight" data-delta="-${step}" aria-label="Уменьшить вес">−</button><input aria-label="Вес в килограммах" type="number" inputmode="decimal" step="${step}" min="0" value="${U.esc(s.weight)}" data-set-id="${s.id}" data-set-field="weight"><button data-action="adjust-set" data-id="${s.id}" data-field="weight" data-delta="${step}" aria-label="Увеличить вес">+</button></div></div>
      <div><div class="step-label">ПОВТОРЫ</div><div class="stepper"><button data-action="adjust-set" data-id="${s.id}" data-field="reps" data-delta="-1" aria-label="Меньше повторов">−</button><input aria-label="Количество повторов" type="number" inputmode="numeric" step="1" min="0" value="${U.esc(s.reps)}" data-set-id="${s.id}" data-set-field="reps"><button data-action="adjust-set" data-id="${s.id}" data-field="reps" data-delta="1" aria-label="Больше повторов">+</button></div></div></div>
      ${state.settings.extraFields?`<details class="set-extra" style="margin-top:9px"><summary class="small muted" style="cursor:pointer;padding:5px 0">Дополнительно · пометки, RPE, заметка</summary><div class="form-grid" style="margin-top:10px"><div class="field"><label>RPE (1–10)</label><input class="input" type="number" min="1" max="10" step="0.5" placeholder="—" value="${s.rpe??''}" data-set-id="${s.id}" data-set-field="rpe"></div><div class="field"><label>RIR (запас повторов)</label><input class="input" type="number" min="0" max="20" placeholder="—" value="${s.rir??''}" data-set-id="${s.id}" data-set-field="rir"></div><div class="field full"><label>Заметка</label><input class="input" placeholder="Как прошёл подход" value="${U.esc(s.note||'')}" data-set-id="${s.id}" data-set-field="note"></div></div><div style="margin-top:10px">${tagsAvailable.map(tag=>`<label class="tag-option"><input type="checkbox" ${s.tags?.includes(tag)?'checked':''} data-set-id="${s.id}" data-set-tag="${U.esc(tag)}">${tag}</label>`).join('')}</div>${s.restSeconds?`<div class="small muted">Отдых до подхода: ${s.restSeconds} сек.</div>`:''}</details>`:''}
      <div class="set-actions"><button class="btn ${s.done?'secondary':'success'} block" data-action="record-set" data-id="${s.id}">${U.icon(s.done?'check':'check',17)} ${s.done?'Отменить запись':'Записать подход'}</button><button class="icon-button" data-action="toggle-warmup" data-id="${s.id}" title="Переключить тип подхода" aria-label="Переключить тип">${U.icon('bolt',17)}</button></div></div>`).join('');
    return `<section class="exercise-session" data-session-exercise="${e.exerciseId}"><div class="exercise-session-head"><div class="list-icon">${U.icon('dumbbell',19)}</div><div class="list-main"><div class="exercise-session-title">${U.esc(e.name||library?.name||'Упражнение')}</div><div class="exercise-meta">${U.esc((e.muscles||library?.muscles||[]).join(' · ')||library?.equipment||'')}</div></div><button class="icon-button" style="width:36px;height:36px" data-action="exercise-menu" data-index="${index}" aria-label="Действия с упражнением">${U.icon('more',17)}</button></div>
      ${sets}<div class="row" style="margin-top:10px"><button class="btn ghost small-btn" data-action="add-set" data-exercise="${e.exerciseId}">${U.icon('plus',14)} Добавить подход</button><span class="small muted">Шаг ${U.fmtNum(step)} кг</span></div></section>`;
  }
  function programExercisePreview(day,limit=5){
    const items=day.items||[],expanded=expandedProgramDays.has(day.id),visible=expanded?items:items.slice(0,limit);
    return `<div class="stack">${visible.map(i=>`<div class="row between" style="padding:4px 0"><span class="small">${U.esc(exerciseName(i.exerciseId))}</span><span class="small muted">${i.sets||1} × ${i.repsMin||8}${i.repsMax&&i.repsMax!==i.repsMin?'–'+i.repsMax:''}</span></div>`).join('')}${items.length>limit?`<button type="button" class="subtle-link" data-action="toggle-program-expand" data-id="${day.id}">${expanded?'Свернуть':`Развернуть все ${items.length} упражнений`}</button>`:''}</div>`;
  }
  function renderExercises(){
    const active=state.exercises.filter(e=>!e.archived);
    const filtered=active.filter(e=>(!exerciseSearch||e.name.toLowerCase().includes(exerciseSearch.toLowerCase()))&&(exerciseMuscle==='all'||(e.muscles||[]).includes(exerciseMuscle))&&(exerciseEquipment==='all'||e.equipment===exerciseEquipment));
    const tabs=`<div class="segmented" style="margin:0 0 16px"><button class="${exerciseMode==='library'?'active':''}" data-action="exercise-mode" data-mode="library">Упражнения (${active.length})</button><button class="${exerciseMode==='blocks'?'active':''}" data-action="exercise-mode" data-mode="blocks">Блоки (${state.blocks.length})</button><button class="${exerciseMode==='programs'?'active':''}" data-action="exercise-mode" data-mode="programs">Программы (${state.programs.length})</button></div>`;
    if(exerciseMode==='blocks') return `${pageHeading('Блоки','Сохраняйте часто используемые группы упражнений.',button('Создать блок','add-block','primary','plus'))}${tabs}${state.blocks.length?state.blocks.map(b=>`<div class="card" style="margin-bottom:10px"><div class="row between"><div><h3 style="margin:0;font-size:16px">${U.esc(b.name)}</h3><div class="small muted" style="margin-top:5px">${(b.items||[]).length} упражнений</div></div><button class="icon-button" data-action="block-menu" data-id="${b.id}">${U.icon('more',17)}</button></div><div class="divider"></div>${(b.items||[]).map((i,idx)=>`<div class="row between" style="padding:4px 0"><span class="small">${idx+1}. ${U.esc(exerciseName(i.exerciseId))}</span><span class="small muted">${i.sets||3} × ${i.repsMin||8}–${i.repsMax||12}</span></div>`).join('')}<button class="btn ghost block" style="margin-top:12px" data-action="start-block" data-id="${b.id}">Добавить блок в тренировку</button></div>`).join(''):empty('layers','Блоков пока нет','Соберите упражнения в именованные списки — например, «Спина» или «Грудь + трицепс».',button('Создать первый блок','add-block','primary','plus'))}`;
    if(exerciseMode==='programs') return `${pageHeading('Программы','Планируйте тренировочные дни и назначайте их на неделю.',button('Создать программу','add-program','primary','plus'))}${tabs}${state.programs.length?state.programs.map(p=>`<div class="card" style="margin-bottom:10px"><div class="row between"><div><h3 style="margin:0;font-size:16px">${U.esc(p.name)}</h3><div class="small muted" style="margin-top:5px">${(p.days||[]).length} тренировочных дня</div></div><button class="icon-button" data-action="program-menu" data-id="${p.id}">${U.icon('more',17)}</button></div>${(p.days||[]).map(d=>`<div class="divider"></div><div class="row between"><div><b class="list-title">${U.esc(d.name)}</b><div class="small muted">${d.weekday===null||d.weekday===undefined?'Без дня':dayNames[d.weekday]} · ${(d.items||[]).length} упражнений</div></div><div class="row"><button class="btn ghost small-btn" data-action="edit-program-day" data-program="${p.id}" data-day="${d.id}">Изменить</button><button class="btn primary small-btn" data-action="start-program" data-program="${p.id}" data-day="${d.id}">Начать</button></div></div>${programExercisePreview(d,5)}`).join('')}<button class="btn secondary small-btn" style="margin-top:12px" data-action="add-program-day" data-id="${p.id}">${U.icon('plus',14)} Добавить день</button></div>`).join(''):empty('calendar','Программ пока нет','Создайте программу, добавьте тренировочные дни и назначьте каждому день недели.',button('Создать программу','add-program','primary','plus'))}`;
    return `${pageHeading('Упражнения','Твоя библиотека движений и оборудования.',button('Новое упражнение','add-exercise','primary','plus'))}${tabs}
      <div class="searchbox">${U.icon('search')}<input placeholder="Найти упражнение" value="${U.esc(exerciseSearch)}" data-search="exercises"></div>
      <div class="form-grid" style="margin-top:10px"><div class="field"><select class="select" data-filter="muscle"><option value="all">Все группы мышц</option>${muscleNames.map(m=>`<option ${exerciseMuscle===m?'selected':''}>${m}</option>`).join('')}</select></div><div class="field"><select class="select" data-filter="equipment"><option value="all">Любое оборудование</option>${equipmentNames.map(m=>`<option ${exerciseEquipment===m?'selected':''}>${m}</option>`).join('')}</select></div></div>
      <div class="row between" style="margin:18px 2px 9px"><span class="small muted">${filtered.length} упражнений</span><button class="subtle-link" data-action="show-archived">Архив</button></div>
      ${filtered.length?`<div class="card" style="padding:0 16px">${filtered.map(e=>`<div class="list-item"><div class="list-icon">${U.icon('dumbbell',18)}</div><div class="list-main"><div class="list-title">${U.esc(e.name)}</div><div class="list-meta">${U.esc((e.muscles||[]).join(' · ')||'Без группы')} · ${U.esc(e.equipment||'Другое')} · шаг ${U.fmtNum(e.step||state.settings.defaultStep)} кг</div></div><button class="icon-button" style="width:36px;height:36px" data-action="edit-exercise" data-id="${e.id}" aria-label="Изменить упражнение">${U.icon('edit',15)}</button></div>`).join('')}</div>`:empty('dumbbell',active.length?'Ничего не найдено':'Библиотека пока пустая','Добавьте свои упражнения. Готовой базы нет — только то, что действительно используешь.',button('Добавить упражнение','add-exercise','primary','plus'))}`;
  }
  function exerciseForm(e=null){
    const selected=new Set(e?.muscles||[]);
    const content=`<form id="exercise-form"><input type="hidden" name="id" value="${e?.id||''}"><div class="form-grid"><div class="field full"><label>Название упражнения</label><input required name="name" class="input" maxlength="70" placeholder="Например, Жим лёжа" value="${U.esc(e?.name||'')}"></div><div class="field full"><label>Группы мышц · можно несколько</label><div>${muscleNames.map(m=>`<label class="tag-option"><input type="checkbox" name="muscles" value="${U.esc(m)}" ${selected.has(m)?'checked':''}>${m}</label>`).join('')}</div></div><div class="field"><label>Оборудование</label><select name="equipment" class="select">${equipmentNames.map(v=>`<option ${e?.equipment===v?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label>Шаг веса, кг</label><select name="step" class="select">${[1,1.25,2.5,5].map(v=>`<option value="${v}" ${(e?.step||state.settings.defaultStep)===v?'selected':''}>${U.fmtNum(v)}</option>`).join('')}</select></div><div class="field"><label>Отдых по умолчанию, сек.</label><input name="rest" class="input" type="number" min="0" max="900" value="${e?.rest??state.settings.restSeconds}"></div><div class="field"><label>Примечание</label><input name="note" class="input" maxlength="180" value="${U.esc(e?.note||'')}" placeholder="Необязательно"></div></div></form>`;
    showModal(e?'Изменить упражнение':'Новое упражнение','Добавьте только нужные поля — упражнение можно будет изменить позже.',content,`${e?`<button class="btn danger" data-action="archive-exercise" data-id="${e.id}">В архив</button>`:''}<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="submit-exercise">Сохранить</button>`);
  }
  function exercisePickerContent(selectedIds=[]) {
    const chosen=new Set(selectedIds);
    return `<div class="searchbox">${U.icon('search')}<input placeholder="Поиск по библиотеке" data-picker-search></div><div class="stack" style="margin-top:12px;max-height:45vh;overflow:auto">${state.exercises.filter(e=>!e.archived).map(e=>`<label class="row" style="padding:9px 2px;border-bottom:1px solid var(--line)"><input type="checkbox" name="pickedExercises" value="${e.id}" ${chosen.has(e.id)?'checked':''} style="width:19px;height:19px;accent-color:var(--accent)"><span class="list-main"><b class="list-title">${U.esc(e.name)}</b><span class="list-meta">${U.esc((e.muscles||[]).join(' · ')||e.equipment||'')}</span></span></label>`).join('')||`<div class="body-copy">Библиотека упражнений пока пуста. Сначала добавьте упражнение.</div>`}</div>`;
  }
  function addBlockForm(){
    if(!state.exercises.some(e=>!e.archived)){U.toast('Сначала добавьте упражнения');return;}
    showModal('Новый блок','Объедините упражнения в удобный список.',`<form id="block-form"><div class="field"><label>Название блока</label><input name="name" required class="input" placeholder="Например, Спина"></div><div class="divider"></div><div class="field"><label>Упражнения</label>${exercisePickerContent()}</div><div class="field" style="margin-top:12px"><label>Рабочих подходов по умолчанию</label><input name="sets" type="number" min="1" max="12" class="input" value="3"></div><div class="form-grid" style="margin-top:10px"><div class="field"><label>Повторы от</label><input name="repsMin" type="number" class="input" min="1" value="8"></div><div class="field"><label>Повторы до</label><input name="repsMax" type="number" class="input" min="1" value="12"></div></div></form>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="submit-block">Создать блок</button>`);
  }
  function addProgramForm(program=null,day=null){
    if(!state.exercises.some(e=>!e.archived)){U.toast('Сначала добавьте упражнения');return;}
    const selected=day?.items?.map(i=>i.exerciseId)||[],first=day?.items?.[0]||{};
    const defaults={sets:first.sets||3,repsMin:first.repsMin||8,repsMax:first.repsMax||12};
    showModal(day?'Редактировать день программы':program?'Новый день программы':'Новая программа','При редактировании настройки оставленных упражнений сохраняются.',`<form id="program-form"><input type="hidden" name="programId" value="${program?.id||''}"><input type="hidden" name="dayId" value="${day?.id||''}"><div class="field"><label>Название программы</label><input name="name" class="input" required value="${U.esc(program?.name||'')}" placeholder="Например, Верх / Низ"></div><div class="form-grid" style="margin-top:12px"><div class="field"><label>Название дня</label><input name="dayName" class="input" required value="${U.esc(day?.name||'День А')}"></div><div class="field"><label>День недели</label><select name="weekday" class="select">${['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'].map((v,i)=>`<option value="${i}" ${Number(day?.weekday??1)===i?'selected':''}>${v}</option>`).join('')}</select></div></div><div class="divider"></div><div class="field"><label>Упражнения</label>${exercisePickerContent(selected)}</div><div class="field" style="margin-top:12px"><label>Подходов по умолчанию для новых упражнений</label><input name="sets" class="input" type="number" min="1" max="12" value="${defaults.sets}"></div><div class="form-grid" style="margin-top:10px"><div class="field"><label>Повторы от</label><input name="repsMin" class="input" type="number" min="1" value="${defaults.repsMin}"></div><div class="field"><label>Повторы до</label><input name="repsMax" class="input" type="number" min="1" value="${defaults.repsMax}"></div></div></form>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="submit-program">${day?'Сохранить изменения':'Сохранить день'}</button>`);
  }
  function renderHistory(){
    const y=monthCursor.getFullYear(),m=monthCursor.getMonth(),first=new Date(y,m,1,12),days=new Date(y,m+1,0).getDate(),offset=(first.getDay()-Number(state.settings.weekStart??1)+7)%7;
    const month=`${y}-${String(m+1).padStart(2,'0')}`; const byDate={};activeWorkouts().forEach(w=>byDate[w.date]=(byDate[w.date]||[]).concat(w));
    let calendar='';for(let i=0;i<offset;i++)calendar+='<div></div>';for(let d=1;d<=days;d++){const date=`${month}-${String(d).padStart(2,'0')}`,n=(byDate[date]||[]).length;calendar+=`<button class="calendar-day ${n?'has-workout':''} ${n>1?'intensity-3':n===1?'intensity-2':''} ${date===U.localDate()?'today':''} ${date===historyDate?'selected':''}" data-action="select-history-date" data-date="${date}" aria-label="${d} число, ${n} тренировок">${d}${n?'<span style="position:absolute;bottom:4px;left:50%;transform:translateX(-50%);width:3px;height:3px;border-radius:50%;background:currentColor"></span>':''}</button>`;}
    let filtered=sortWorkouts(activeWorkouts()).filter(w=>(!historySearch||`${w.title} ${(w.exercises||[]).map(e=>e.name).join(' ')}`.toLowerCase().includes(historySearch.toLowerCase()))&&(!historyDate||w.date===historyDate));
    const byMonth={};filtered.forEach(w=>(byMonth[w.date.slice(0,7)]??=[]).push(w));
    const list=Object.entries(byMonth).map(([key,items])=>`<div style="margin-top:17px"><div class="eyebrow" style="margin:0 3px 8px;text-transform:capitalize">${U.monthLabel(key+'-01')}</div><div class="card" style="padding:0 15px">${items.map(w=>`<button class="list-item" data-action="open-workout" data-id="${w.id}" style="width:100%;background:none;border:0;text-align:left;cursor:pointer"><div class="list-icon">${U.icon('dumbbell',18)}</div><div class="list-main"><div class="list-title">${U.esc(w.title||'Тренировка')}</div><div class="list-meta">${U.fmtDate(w.date,{day:'numeric',month:'long'})} · ${(w.exercises||[]).length} упражн. · ${totalSets(w)} подходов</div></div><div class="list-value">${U.fmtNum(workoutVolume(w),0)}<div class="list-meta">кг</div></div></button>`).join('')}</div></div>`).join('');
    return `${pageHeading('История','Все тренировки и календарь активности.')}
      <div class="card"><div class="row between"><button class="month-nav" data-action="month-prev" aria-label="Предыдущий месяц">‹</button><div class="month-title" style="text-transform:capitalize">${U.monthLabel(month+'-01')}</div><button class="month-nav" data-action="month-next" aria-label="Следующий месяц">›</button></div><div class="calendar-grid" style="margin-top:12px">${shortDaysConfigured().map(d=>`<div class="calendar-head">${d}</div>`).join('')}${calendar}</div><div class="row between small muted" style="margin-top:11px"><span>${historyDate?`Выбрано: ${U.fmtDate(historyDate,{day:'numeric',month:'long'})}`:'Нажмите на день, чтобы открыть записи'}</span>${historyDate?`<button class="subtle-link" data-action="clear-history-date">Сбросить</button>`:''}</div></div>
      ${section('Тренировки',`<span class="small muted">${filtered.length} записей</span>`)}
      <div class="searchbox">${U.icon('search')}<input data-search="history" value="${U.esc(historySearch)}" placeholder="Поиск по упражнениям или названию"></div>
      ${list||empty('calendar',historyDate?'В этот день тренировок нет':'История пока пуста','Завершённые тренировки автоматически сохраняются здесь.',historyDate?`<button class="btn secondary" data-action="clear-history-date">Показать все</button>`:button('Начать тренировку','start-empty','primary','plus'))}`;
  }
  function renderWorkoutDetail(id){
    const w=state.workouts.find(x=>x.id===id);if(!w)return;
    const body=`<form id="history-edit-form"><input type="hidden" name="id" value="${w.id}"><div class="form-grid"><div class="field"><label>Дата тренировки</label><input type="date" class="input" name="date" value="${w.date}" required></div><div class="field"><label>Название</label><input class="input" name="title" value="${U.esc(w.title||'Тренировка')}"></div></div></form>
      <div class="workout-stats"><div class="workout-stat"><b>${U.fmtDuration(w.duration||0)}</b><span>длительность</span></div><div class="workout-stat"><b>${U.fmtNum(workoutVolume(w),0)}</b><span>объём, кг</span></div><div class="workout-stat"><b>${totalSets(w)}</b><span>подходов</span></div></div>
      ${(w.exercises||[]).map((e,ei)=>`<div class="exercise-session" style="margin-top:11px"><div class="exercise-session-head"><div class="list-icon">${U.icon('dumbbell')}</div><div class="list-main"><div class="exercise-session-title">${U.esc(e.name||exerciseName(e.exerciseId))}</div><div class="exercise-meta">${U.esc((e.muscles||[]).join(' · '))}</div></div></div><div style="margin-top:10px">${(e.sets||[]).map((s,si)=>`<div class="row between" style="padding:8px 1px;border-bottom:1px solid var(--line)"><span class="small muted">${s.type==='warmup'?'Разминка':`Подход ${si+1}`}</span><div class="row"><label class="small muted">кг <input class="input" style="width:62px;min-height:34px;padding:0 6px;text-align:center" type="number" min="0" step=".5" value="${s.weight}" data-history-set="${s.id}" data-history-field="weight"></label><label class="small muted">повт. <input class="input" style="width:55px;min-height:34px;padding:0 6px;text-align:center" type="number" min="0" value="${s.reps}" data-history-set="${s.id}" data-history-field="reps"></label></div></div>${s.tags?.length?`<div class="small muted" style="padding:5px 0">${U.esc(s.tags.join(' · '))}</div>`:''}${s.note?`<div class="small muted">${U.esc(s.note)}</div>`:''}`).join('')}</div></div>`).join('')}
      <div class="modal-actions" style="margin-top:18px"><button class="btn secondary" data-action="duplicate-workout" data-id="${w.id}">${U.icon('repeat')} Повторить</button><button class="btn danger" data-action="delete-workout" data-id="${w.id}">${U.icon('trash')} Удалить</button></div>`;
    showModal(w.title||'Тренировка',`${U.fmtDate(w.date,{day:'numeric',month:'long',year:'numeric'})} · можно редактировать записи`,body,`<button class="btn secondary" data-action="close-modal">Закрыть</button><button class="btn primary" data-action="save-history-edit" data-id="${w.id}">Сохранить изменения</button>`);
  }
  function previousRecords(exerciseId){
    const arr=[];state.workouts.forEach(w=>(w.exercises||[]).filter(e=>e.exerciseId===exerciseId).forEach(e=>allDoneSets(e).forEach(s=>arr.push({weight:Number(s.weight)||0,reps:Number(s.reps)||0,volume:(Number(s.weight)||0)*(Number(s.reps)||0),e1rm:getE1RM(Number(s.weight)||0,Number(s.reps)||0),date:w.date,workoutId:w.id}))));
    return arr;
  }
  function makeRecords(workout){
    const created=[];
    (workout.exercises||[]).forEach(e=>{
      const prior=previousRecords(e.exerciseId); const current=allDoneSets(e);
      if(!current.length)return;
      const metrics=[
        ['weight','Вес',s=>Number(s.weight)||0],['reps','Повторы',s=>Number(s.reps)||0],['volume','Объём подхода',s=>(Number(s.weight)||0)*(Number(s.reps)||0)],['e1rm','Расчётный 1ПМ',s=>getE1RM(Number(s.weight)||0,Number(s.reps)||0)]
      ];
      metrics.forEach(([type,label,fn])=>{const prev=Math.max(0,...prior.map(fn));const best=Math.max(0,...current.map(fn));if(best>prev&&best>0){const rec={id:U.uid('record'),exerciseId:e.exerciseId,exerciseName:e.name,type,label,value:U.round(best,1),date:workout.date,workoutId:workout.id};created.push(rec);}});
    });
    return created;
  }
  function achievementCatalog(){
    const workouts=activeWorkouts();
    const total=workouts.length;
    const volume=workouts.reduce((sum,w)=>sum+workoutVolume(w),0);
    const sets=workouts.reduce((sum,w)=>sum+totalSets(w),0);
    const prs=state.records.length;
    const measurements=state.measurements.length;
    const exercises=state.exercises.length;
    const streak=weeklyStreak();
    const monthKey=U.localDate().slice(0,7);
    const thisMonth=workouts.filter(w=>(w.date||'').startsWith(monthKey)).length;
    return [
      ['first','Первый шаг','Первая завершённая тренировка',()=>total>=1],
      ['workouts5','Вошёл в ритм','Пять завершённых тренировок',()=>total>=5],
      ['ten','Десятка','Десять тренировок в дневнике',()=>total>=10],
      ['workouts25','Постоянство','25 завершённых тренировок',()=>total>=25],
      ['fifty','Полсотни','50 завершённых тренировок',()=>total>=50],
      ['hundred','Сотня','100 завершённых тренировок',()=>total>=100],
      ['workouts200','Двухсотый рубеж','200 завершённых тренировок',()=>total>=200],
      ['volume1000','Первая тонна','1 000 кг суммарного рабочего объёма',()=>volume>=1000],
      ['volume10000','Десять тонн','10 000 кг суммарного рабочего объёма',()=>volume>=10000],
      ['volume50000','Сильный объём','50 000 кг суммарного рабочего объёма',()=>volume>=50000],
      ['volume100000','Сто тонн','100 000 кг суммарного рабочего объёма',()=>volume>=100000],
      ['volumeMillion','Миллион килограммов','1 000 000 кг суммарного рабочего объёма',()=>volume>=1000000],
      ['sets100','Сотня подходов','100 рабочих подходов',()=>sets>=100],
      ['sets500','Пятьсот подходов','500 рабочих подходов',()=>sets>=500],
      ['sets1000','Тысяча подходов','1 000 рабочих подходов',()=>sets>=1000],
      ['sets5000','Машина объёма','5 000 рабочих подходов',()=>sets>=5000],
      ['pr','Первый рекорд','Зафиксирован первый личный рекорд',()=>prs>=1],
      ['prs10','Коллекционер рекордов','10 личных рекордов',()=>prs>=10],
      ['prs25','Охотник за рекордами','25 личных рекордов',()=>prs>=25],
      ['prs50','Рекордная серия','50 личных рекордов',()=>prs>=50],
      ['weeks2','Две недели подряд','Тренировки в течение двух недель подряд',()=>streak>=2],
      ['weeks4','Четыре недели','Тренировки в течение четырёх недель подряд',()=>streak>=4],
      ['weeks8','Два месяца ритма','Тренировки в течение восьми недель подряд',()=>streak>=8],
      ['weeks12','Три месяца стабильности','Тренировки в течение 12 недель подряд',()=>streak>=12],
      ['weeks26','Полгода дисциплины','Тренировки в течение 26 недель подряд',()=>streak>=26],
      ['weeks52','Годовой ритм','Тренировки в течение 52 недель подряд',()=>streak>=52],
      ['measurement1','Первый замер','Записан первый замер тела',()=>measurements>=1],
      ['measurements10','Наблюдатель','10 записей замеров тела',()=>measurements>=10],
      ['measurements25','Личный исследователь','25 записей замеров тела',()=>measurements>=25],
      ['exercise5','Своя база','Добавлено пять упражнений в библиотеку',()=>exercises>=5],
      ['exercise15','Арсенал упражнений','Добавлено 15 упражнений в библиотеку',()=>exercises>=15],
      ['month10','Активный месяц','10 завершённых тренировок за текущий месяц',()=>thisMonth>=10]
    ].map(([id,title,description,test])=>({id,title,description,test}));
  }
  function calculateAchievements(){
    const tests=achievementCatalog();
    const newly=[];
    tests.forEach(t=>{if(t.test()&&!state.achievements.some(a=>a.id===t.id)){const a={id:t.id,title:t.title,description:t.description,unlockedAt:new Date().toISOString()};state.achievements.push(a);newly.push(a);}});
    return newly;
  }
  function weeklyStreak(){const weeks=new Set(activeWorkouts().map(w=>startOfWeek(w.date)));let d=startOfWeek(U.localDate()),count=0;if(!weeks.has(d))d=U.addDays(d,-7);while(weeks.has(d)){count++;d=U.addDays(d,-7);}return count;}
  function finishWorkout(){
    const w=currentWorkout();if(!w)return;const now=new Date();w.endAt=now.toISOString();w.duration=Math.max(0,now-new Date(w.startAt).getTime());w.volume=workoutVolume(w);w.exercises=w.exercises.map(e=>({...e,sets:e.sets.map(s=>({...s,weight:Math.max(0,Number(s.weight)||0),reps:Math.max(0,Number(s.reps)||0)}))})).filter(e=>e.sets.some(s=>s.done&&s.type!=='warmup'));
    const records=makeRecords(w);state.records.push(...records);state.workouts.push(w);const earned=50+totalSets(w)*10+records.length*25;state.xp=(state.xp||0)+earned;const newBadges=calculateAchievements();state.activeWorkout=null;save(true);
    const previous=sortWorkouts(state.workouts.filter(x=>x.id!==w.id&&x.sourceProgram===w.sourceProgram&&x.title===w.title))[0];const diff=previous?Math.round((w.volume-workoutVolume(previous))/Math.max(1,workoutVolume(previous))*100):null;
    const recordHtml=records.length?`<div class="record-banner"><b style="font-size:12px">${U.icon('trophy',15)} ${records.length} новых рекордов</b>${records.slice(0,5).map(r=>`<div class="small" style="margin-top:5px">${U.esc(r.exerciseName)} · ${U.esc(r.label)}: ${U.fmtNum(r.value)}</div>`).join('')}</div>`:'<div class="inline-notice">В этот раз без новых рекордов — тренировка сохранена.</div>';
    showModal('Тренировка завершена','Отличная работа. Результат сохранён в истории.',`<div class="card accent-card" style="text-align:center;padding:22px"><div class="eyebrow">ИТОГ ЗАНЯТИЯ</div><div class="timer-big" style="margin:11px 0 3px">${U.fmtDuration(w.duration)}</div><div class="muted small">${U.fmtDate(w.date,{day:'numeric',month:'long',year:'numeric'})}</div><div class="grid-3" style="margin-top:18px"><div><b style="font-size:20px">${U.fmtNum(w.volume,0)}</b><div class="small muted">объём, кг</div></div><div><b style="font-size:20px">${totalSets(w)}</b><div class="small muted">подходов</div></div><div><b style="font-size:20px">+${earned}</b><div class="small muted">опыта</div></div></div></div>${recordHtml}${diff!==null?`<div class="card soft" style="margin-top:10px"><div class="row between"><b class="list-title">Сравнение с прошлой</b><span class="pill ${diff>=0?'green':'orange'}">${diff>=0?'+':''}${diff}% объёма</span></div></div>`:''}${newBadges.map(b=>`<div class="achievement"><div class="achievement-icon">${U.icon('trophy')}</div><div class="achievement-copy"><b>Новое достижение: ${U.esc(b.title)}</b><span>${U.esc(b.description)}</span></div></div>`).join('')}`,`<button class="btn secondary" data-action="close-modal">Закрыть</button><button class="btn primary" data-action="go-history">К истории ${U.icon('arrow')}</button>`);
    tab='home';render();
  }
  function renderProgress(){
    const inRange=activeWorkouts().filter(w=>inPeriod(w,progressPeriod));
    const selected=progressExercise==='all'?null:findExercise(progressExercise);
    const points=[];inRange.slice().sort((a,b)=>a.date.localeCompare(b.date)).forEach(w=>{
      let sets=[];(w.exercises||[]).filter(e=>!selected||e.exerciseId===selected.id).forEach(e=>sets.push(...allDoneSets(e)));
      if(sets.length){const value=selected?Math.max(...sets.map(s=>Number(s.weight)||0)):workoutVolume(w);points.push({date:w.date,label:U.fmtDate(w.date,{day:'numeric',month:'short'}),shortLabel:U.fmtDate(w.date,{day:'numeric',month:'short'}),value:U.round(value,1)});}
    });
    const totalVolume=inRange.reduce((s,w)=>s+workoutVolume(w),0), avgDuration=inRange.length?inRange.reduce((s,w)=>s+(w.duration||0),0)/inRange.length:0;
    const equipment={},exerciseVolumes={};inRange.forEach(w=>(w.exercises||[]).forEach(e=>{const done=allDoneSets(e);if(!done.length)return;const info=findExercise(e.exerciseId);const eq=info?.equipment||e.equipment||'Другое';equipment[eq]=(equipment[eq]||0)+done.length;const name=e.name||exerciseName(e.exerciseId);exerciseVolumes[name]=(exerciseVolumes[name]||0)+done.reduce((sum,s)=>sum+(Number(s.weight)||0)*(Number(s.reps)||0),0);}));
    const exerciseVolumeData=Object.entries(exerciseVolumes).map(([label,value])=>({label,value:U.round(value,0)})).sort((a,b)=>b.value-a.value).slice(0,8);const equipmentData=Object.entries(equipment).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
    const periodRange=dateRange(progressPeriod),periodLength=progressPeriod==='all'?0:Math.max(1,Math.round((U.dateAtNoon(periodRange.end)-U.dateAtNoon(periodRange.start))/86400000)+1),prevPeriod=periodLength?activeWorkouts().filter(w=>w.date>=U.addDays(periodRange.start,-periodLength)&&w.date<U.addDays(periodRange.start,0)):[],prevVol=prevPeriod.reduce((s,w)=>s+workoutVolume(w),0);const volumeChange=prevVol?Math.round((totalVolume-prevVol)/prevVol*100):null;
    const workingSets=inRange.reduce((s,w)=>s+totalSets(w),0);
    const weekVolume={};inRange.forEach(w=>{const key=startOfWeek(w.date);weekVolume[key]=(weekVolume[key]||0)+workoutVolume(w);});
    const weekly=Object.entries(weekVolume).sort((a,b)=>a[0].localeCompare(b[0])).slice(-8).map(([date,value])=>({label:U.fmtDate(date,{day:'numeric',month:'short'}),shortLabel:U.fmtDate(date,{day:'numeric',month:'short'}),value}));
    const muscle={};inRange.forEach(w=>(w.exercises||[]).forEach(e=>{const doneCount=allDoneSets(e).length;if(!doneCount)return;(e.muscles||findExercise(e.exerciseId)?.muscles||[]).forEach(m=>muscle[m]=(muscle[m]||0)+doneCount);}));
    const muscleData=Object.entries(muscle).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);
    const periodOptions=[['month','Месяц'],['3m','3 мес.'],['6m','6 мес.'],['year','Год'],['all','Всё']];
    const personalBest=state.records.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
    return `${pageHeading('Прогресс','Динамика рабочих весов, объёма и регулярности.')}
      <div class="segmented" style="margin-bottom:14px">${periodOptions.map(([v,l])=>`<button class="${progressPeriod===v?'active':''}" data-action="progress-period" data-period="${v}">${l}</button>`).join('')}</div>
      <div class="grid-2">${kpi(inRange.length,'Тренировок',`${U.fmtDuration(avgDuration)} в среднем`,'calendar')}${kpi(`${U.fmtNum(totalVolume,0)} кг`,'Рабочий объём',`${workingSets} рабочих подходов`,'trend')}</div>
      <div class="card" style="margin-top:11px"><div class="row between"><div><div class="eyebrow">ДИНАМИКА</div><h2 style="font-size:17px;margin:5px 0 0">${selected?'Рабочий вес':'Объём тренировок'}</h2></div><select class="select" style="width:auto;max-width:48%;min-height:38px;font-size:11px" data-progress-exercise><option value="all">Все упражнения</option>${state.exercises.filter(e=>!e.archived).map(e=>`<option value="${e.id}" ${progressExercise===e.id?'selected':''}>${U.esc(e.name)}</option>`).join('')}</select></div>${Charts.lineChart(points,{aria:selected?'Рабочий вес по датам':'Объём по тренировкам',leftLabel:'Ранее',rightLabel:'Сейчас'})}<div class="small muted" style="margin-top:10px">${selected?'Максимальный вес рабочего подхода, кг.':'Сумма рабочего объёма (вес × повторы) в каждой тренировке, кг.'}</div>${selected?`<div class="divider"></div><h3 style="font-size:14px;margin:0">Расчётный 1ПМ · ${state.settings.oneRm==='brzycki'?'Бжицки':'Эпли'}</h3>${Charts.lineChart(inRange.slice().sort((a,b)=>a.date.localeCompare(b.date)).map(w=>{const e=getExerciseFromWorkout(w,selected.id);const ss=allDoneSets(e);return ss.length?{date:w.date,label:U.fmtDate(w.date,{day:'numeric',month:'short'}),shortLabel:U.fmtDate(w.date,{day:'numeric',month:'short'}),value:U.round(Math.max(...ss.map(s=>getE1RM(Number(s.weight)||0,Number(s.reps)||0))),1)}:null;}).filter(Boolean),{aria:'Расчётный одноповторный максимум'})}`:''}</div>
      <div class="card" style="margin-top:11px"><div class="row between"><h3 style="font-size:15px;margin:0">Объём по неделям</h3><span class="pill blue">кг</span></div>${Charts.bars(weekly)}</div>
      <div class="card" style="margin-top:11px"><h3 style="font-size:15px;margin:0 0 14px">Нагрузка по группам мышц</h3>${Charts.distribution(muscleData)}</div>
      <div class="card" style="margin-top:11px"><h3 style="font-size:15px;margin:0 0 14px">Объём по упражнениям</h3>${Charts.distribution(exerciseVolumeData.map(x=>({...x,value:Math.round(x.value)})))}</div>
      <div class="card" style="margin-top:11px"><h3 style="font-size:15px;margin:0 0 14px">Тип оборудования</h3>${Charts.distribution(equipmentData)}</div>
      <div class="card" style="margin-top:11px"><div class="row between"><h3 style="font-size:15px;margin:0">Личные рекорды</h3><span class="pill">${state.records.length}</span></div>${personalBest.length?personalBest.map(r=>`<div class="list-item"><div class="list-icon" style="color:var(--orange)">${U.icon('trophy',18)}</div><div class="list-main"><div class="list-title">${U.esc(r.exerciseName)}</div><div class="list-meta">${U.esc(r.label)} · ${U.fmtDate(r.date)}</div></div><b class="list-value">${U.fmtNum(r.value)} ${r.type==='reps'?'повт.':'кг'}</b></div>`).join(''):`<div class="body-copy" style="margin-top:12px">Рекорды начнут появляться после записи рабочих подходов и завершения тренировок.</div>`}</div>
      <div class="card" style="margin-top:11px"><h3 style="font-size:15px;margin:0 0 14px">Карта активности</h3>${Charts.heatmap(activeWorkouts())}</div>
      <div class="card" style="margin-top:11px"><h3 style="font-size:15px;margin:0 0 12px">Сводка за период</h3><div class="row between"><span class="small muted">Средняя длительность</span><b>${U.fmtDuration(avgDuration)}</b></div><div class="divider"></div><div class="row between"><span class="small muted">Всего времени в зале</span><b>${U.fmtDuration(inRange.reduce((s,w)=>s+(w.duration||0),0))}</b></div><div class="divider"></div><div class="row between"><span class="small muted">Среднее тренировок в неделю</span><b>${U.fmtNum(inRange.length/Math.max(1,periodWeeks(progressPeriod)),1)}</b></div><div class="divider"></div><div class="row between"><span class="small muted">Самое частое упражнение</span><b style="max-width:55%;text-align:right">${U.esc(mostFrequentExercise(inRange)||'—')}</b></div><div class="divider"></div><div class="row between"><span class="small muted">Сравнение объёма с предыдущим периодом</span><b>${volumeChange===null?'Нет данных':`${volumeChange>=0?'+':''}${volumeChange}%`}</b></div><div class="divider"></div><div class="row between"><span class="small muted">Средний отдых между подходами</span><b>${U.fmtNum(inRange.flatMap(w=>(w.exercises||[]).flatMap(e=>allDoneSets(e).map(s=>s.restSeconds).filter(Boolean))).reduce((s,x,i,a)=>s+x,0)/Math.max(1,inRange.flatMap(w=>(w.exercises||[]).flatMap(e=>allDoneSets(e).map(s=>s.restSeconds).filter(Boolean))).length),0)} сек.</b></div></div>`;
  }
  function periodWeeks(p){return p==='month'?4.3:p==='3m'?13:p==='6m'?26:p==='year'?52:Math.max(1,(Date.now()-new Date(Math.min(...activeWorkouts().map(w=>new Date(w.date).getTime()),Date.now())))/(7*86400000));}
  function mostFrequentExercise(workouts){const counts={};workouts.forEach(w=>(w.exercises||[]).forEach(e=>counts[e.name||exerciseName(e.exerciseId)]=(counts[e.name||exerciseName(e.exerciseId)]||0)+1));return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]||'';}
  function renderBody(){
    const current=latestMeasurement(bodyMetric);const sorted=state.measurements.filter(m=>m.type===bodyMetric).sort((a,b)=>a.date.localeCompare(b.date));
    const points=sorted.map(m=>({date:m.date,label:U.fmtDate(m.date,{day:'numeric',month:'short'}),shortLabel:U.fmtDate(m.date,{day:'numeric',month:'short'}),value:Number(m.value)}));
    const unit=bodyMetric==='weight'?'кг':'см';
    const goal=bodyMetric==='weight'?state.goals.bodyWeight:null;
    const delta=sorted.length>1?Number(sorted[sorted.length-1].value)-Number(sorted[0].value):0;
    const options=Object.entries(measureNames).map(([v,l])=>`<option value="${v}" ${bodyMetric===v?'selected':''}>${l}</option>`).join('');
    const rows=state.measurements.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,25);
    const comparisonRows=[...sorted].sort((a,b)=>a.date.localeCompare(b.date));if(comparisonRows.length){if(!bodyCompareFrom)bodyCompareFrom=comparisonRows[0].id;if(!bodyCompareTo)bodyCompareTo=comparisonRows[comparisonRows.length-1].id;}const fromRow=comparisonRows.find(x=>x.id===bodyCompareFrom)||comparisonRows[0],toRow=comparisonRows.find(x=>x.id===bodyCompareTo)||comparisonRows[comparisonRows.length-1];const comparisonDelta=fromRow&&toRow?Number(toRow.value)-Number(fromRow.value):0;
    const customTypes=[...new Set(state.measurements.filter(m=>!measureNames[m.type]).map(m=>m.type))];
    return `${pageHeading('Тело','Вес и замеры. Без фото, процента жира и лишних оценок.',button('Добавить замер','add-measurement','primary','plus'))}
      <div class="card"><div class="row between"><div><div class="eyebrow">ПОСЛЕДНЯЯ ЗАПИСЬ</div><div class="kpi-value" style="margin-top:7px">${current?`${U.fmtNum(current.value)} <span style="font-size:15px;color:var(--muted)">${unit}</span>`:'—'}</div><div class="small muted">${current?U.fmtDate(current.date,{day:'numeric',month:'long',year:'numeric'}):'Записей пока нет'}</div></div><div class="list-icon" style="width:52px;height:52px">${U.icon(bodyMetric==='weight'?'scale':'body',24)}</div></div>${sorted.length>1?`<div class="compare" style="margin-top:14px"><span class="${delta>=0?'positive':'negative'}">${delta>=0?'+':''}${U.fmtNum(delta)} ${unit}</span><span class="muted">изменение от первой записи</span></div>`:''}</div>
      <div class="card" style="margin-top:11px"><div class="row between"><h3 style="font-size:15px;margin:0">Динамика замера</h3><select class="select" data-body-metric style="width:auto;max-width:58%;min-height:38px;font-size:11px">${options}${customTypes.map(v=>`<option value="${U.esc(v)}" ${bodyMetric===v?'selected':''}>${U.esc(v)}</option>`).join('')}</select></div>${Charts.lineChart(points,{aria:`Динамика ${measureNames[bodyMetric]||bodyMetric}`})}</div>
      ${comparisonRows.length>1?`<div class="card" style="margin-top:11px"><div class="row between"><h3 style="font-size:15px;margin:0">Сравнить две даты</h3><span class="pill blue">${comparisonDelta>=0?'+':''}${U.fmtNum(comparisonDelta)} ${unit}</span></div><div class="form-grid" style="margin-top:12px"><div class="field"><label>Было</label><select class="select" data-body-compare="from">${comparisonRows.map(r=>`<option value="${r.id}" ${r.id===fromRow?.id?'selected':''}>${U.fmtDate(r.date)} · ${U.fmtNum(r.value)}</option>`).join('')}</select></div><div class="field"><label>Стало</label><select class="select" data-body-compare="to">${comparisonRows.map(r=>`<option value="${r.id}" ${r.id===toRow?.id?'selected':''}>${U.fmtDate(r.date)} · ${U.fmtNum(r.value)}</option>`).join('')}</select></div></div><div class="row between small muted" style="margin-top:11px"><span>Изменение за выбранный период</span><b>${comparisonDelta>=0?'+':''}${U.fmtNum(comparisonDelta)} ${unit}${fromRow?.value?` · ${(comparisonDelta/Number(fromRow.value)*100).toFixed(1).replace('.',',')}%`:''}</b></div></div>`:''}
      ${goal?`<div class="card" style="margin-top:11px">${renderBodyGoalCompact(goal,current)}<div class="row between small muted" style="margin-top:12px"><span>Срок: ${goal.deadline?U.fmtDate(goal.deadline):'не задан'}</span><button class="subtle-link" data-action="edit-body-goal">Изменить цель</button></div></div>`:''}
      ${section('Все замеры',`<span class="small muted">${state.measurements.length} записей</span>`)}
      ${rows.length?`<div class="card" style="padding:0 15px">${rows.map(m=>`<div class="list-item"><div class="list-icon">${U.icon(m.type==='weight'?'scale':'body',18)}</div><div class="list-main"><div class="list-title">${U.esc(measureNames[m.type]||m.type)}</div><div class="list-meta">${U.fmtDate(m.date,{day:'numeric',month:'long',year:'numeric'})}${m.note?' · '+U.esc(m.note):''}</div></div><b class="list-value">${U.fmtNum(m.value)} ${m.unit|| (m.type==='weight'?'кг':'см')}</b><button class="icon-button" style="width:34px;height:34px" data-action="measurement-menu" data-id="${m.id}">${U.icon('more',15)}</button></div>`).join('')}</div>`:empty('scale','Замеров пока нет','Запишите вес тела или любой замер в сантиметрах. Частоту выбираете вы.',button('Добавить первый замер','add-measurement','primary','plus'))}`;
  }
  function renderProfile(){
    const completed=activeWorkouts().length, sets=activeWorkouts().reduce((s,w)=>s+totalSets(w),0),xp=state.xp||0,level=Math.floor(xp/250)+1,levelPct=xp%250/250*100;
    const lastBackup=state.lastBackup?U.fmtDateTime(state.lastBackup):'Ещё не создавалась';
    const themeLabels={system:'Как в системе',light:'Светлая',dark:'Тёмная'};
    const badges=achievementCatalog();
    const unlockedBadges=badges.filter(b=>state.achievements.some(a=>a.id===b.id)).length, visibleBadges=achievementsExpanded?badges:badges.slice(0,4);
    return `${pageHeading('Профиль','Твои цели, достижения и параметры дневника.')}
      <div class="card accent-card"><div class="row between"><div><div class="eyebrow">ТВОЙ УРОВЕНЬ</div><div style="font-size:37px;font-weight:800;letter-spacing:-.07em;margin-top:4px">${level}<span style="font-size:15px;letter-spacing:0;font-weight:600"> уровень</span></div><div class="small muted">${U.fmtNum(xp)} XP всего</div></div><div class="achievement-icon" style="width:54px;height:54px;border-radius:18px">${U.icon('trophy',27)}</div></div><div class="progress-track" style="margin-top:17px;background:rgba(255,255,255,.25)"><div class="progress-fill" style="width:${levelPct}%;background:#fff"></div></div><div class="row between small muted" style="margin-top:7px"><span>${xp%250} / 250 XP</span><span>До уровня ${level+1}</span></div></div>
      <div class="grid-3" style="margin-top:11px">${kpi(completed,'Тренировок','','calendar')}${kpi(sets,'Подходов','','dumbbell')}${kpi(`${U.fmtNum(activeWorkouts().reduce((s,w)=>s+workoutVolume(w),0)/1000,1)} т`,'Объём','','trend')}</div>
      ${section('Достижения',`<span class="small muted">${unlockedBadges} / ${badges.length}</span>`)}
      <div class="card">${visibleBadges.map(b=>{const unlocked=state.achievements.some(a=>a.id===b.id);return `<div class="achievement"><div class="achievement-icon ${unlocked?'':'locked'}">${U.icon(unlocked?'trophy':'target',20)}</div><div class="achievement-copy"><b>${U.esc(b.title)}</b><span>${U.esc(b.description)}</span></div>${unlocked?`<span class="pill green">Получено</span>`:`<span class="small muted">Закрыто</span>`}</div>`}).join('')}${badges.length>4?`<button class="btn ghost block" style="margin-top:8px" data-action="toggle-achievements">${achievementsExpanded?'Свернуть достижения':`Показать все ${badges.length} достижений`}</button>`:''}</div>
      ${section('Настройки')}
      <div class="card"><div class="toggle-row"><div class="toggle-copy"><b>Оформление</b><span>Светлая, тёмная или системная тема</span></div><select class="select" style="width:auto;min-height:38px;font-size:11px" data-setting="theme">${Object.entries(themeLabels).map(([v,l])=>`<option value="${v}" ${state.settings.theme===v?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Шаг веса по умолчанию</b><span>Для новых упражнений</span></div><select class="select" style="width:90px;min-height:38px" data-setting="defaultStep">${[1,1.25,2.5,5].map(v=>`<option value="${v}" ${Number(state.settings.defaultStep)===v?'selected':''}>${U.fmtNum(v)} кг</option>`).join('')}</select></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Отдых между подходами</b><span>По умолчанию, секунд</span></div><select class="select" style="width:94px;min-height:38px" data-setting="restSeconds">${[30,45,60,75,90,120,150,180,240].map(v=>`<option value="${v}" ${Number(state.settings.restSeconds)===v?'selected':''}>${v} сек.</option>`).join('')}</select></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Разминочные подходы</b><span>Отдельный тип, без учёта в объёме и PR</span></div><button class="toggle" role="switch" aria-checked="${state.settings.warmups?'true':'false'}" data-action="toggle-setting" data-setting="warmups"></button></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Дополнительные поля подходов</b><span>RPE, RIR, пометки и заметки</span></div><button class="toggle" role="switch" aria-checked="${state.settings.extraFields?'true':'false'}" data-action="toggle-setting" data-setting="extraFields"></button></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Звуковой сигнал окончания отдыха</b><span>Короткий сигнал без вибрации. Можно отключить.</span></div><button class="toggle" role="switch" aria-checked="${state.settings.restSound?'true':'false'}" data-action="toggle-setting" data-setting="restSound"></button></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Формула расчётного 1ПМ</b><span>Для аналитики и рекордов</span></div><select class="select" style="width:105px;min-height:38px" data-setting="oneRm"><option value="epley" ${state.settings.oneRm==='epley'?'selected':''}>Эпли</option><option value="brzycki" ${state.settings.oneRm==='brzycki'?'selected':''}>Бжицки</option></select></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Начало недели</b><span>Для календаря и аналитики</span></div><select class="select" style="width:115px;min-height:38px" data-setting="weekStart"><option value="1" ${Number(state.settings.weekStart)===1?'selected':''}>Понедельник</option><option value="0" ${Number(state.settings.weekStart)===0?'selected':''}>Воскресенье</option></select></div>
      <div class="toggle-row"><div class="toggle-copy"><b>Цель тренировок в неделю</b><span>Для кольца на главной</span></div><select class="select" style="width:78px;min-height:38px" data-setting="weeklyTarget">${[2,3,4,5,6,7].map(v=>`<option value="${v}" ${(Number(state.settings.weeklyTarget)||3)===v?'selected':''}>${v}</option>`).join('')}</select></div>
      </div>
      ${section('Цели')}
      <div class="card"><div class="row between"><div><b class="list-title">Вес тела</b><div class="list-meta">${state.goals.bodyWeight?`Цель: ${U.fmtNum(state.goals.bodyWeight.targetValue)} кг`:'Цель не установлена'}</div></div><button class="btn ghost small-btn" data-action="edit-body-goal">${state.goals.bodyWeight?'Изменить':'Задать цель'}</button></div><div class="divider"></div><div class="row between"><div><b class="list-title">Рабочие веса</b><div class="list-meta">${state.goals.lifts.length} целей</div></div><button class="btn ghost small-btn" data-action="add-goal">Добавить</button></div>${state.goals.lifts.map(g=>`<div class="list-item"><div class="list-main"><b class="list-title">${U.esc(exerciseName(g.exerciseId))}</b><div class="list-meta">${U.fmtNum(g.targetValue)} кг × ${g.targetReps||1}</div></div><button class="icon-button" style="width:34px;height:34px" data-action="delete-goal" data-id="${g.id}">${U.icon('trash',15)}</button></div>`).join('')}</div>
      ${section('Данные и резервные копии')}
      <div class="card"><div class="row between"><div><b class="list-title">Резервная копия</b><div class="list-meta">Последняя копия: ${lastBackup}</div></div><span class="pill green">${U.icon('lock',13)} Локально</span></div><p class="body-copy">Все тренировки и замеры хранятся в браузере на этом устройстве. Создавайте резервную копию перед очисткой данных или сменой телефона.</p><div class="stack"><button class="btn secondary block" data-action="export-json">${U.icon('download')} Скачать JSON-копию</button><button class="btn secondary block" data-action="export-xlsx">${U.icon('download')} Экспортировать Excel (.xlsx)</button><button class="btn ghost block" data-action="import-backup">${U.icon('upload')} Импортировать копию или Excel</button><input id="backup-file" type="file" accept=".json,.xlsx,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" class="hidden"></div></div>
      ${section('Программа от ИИ-тренера')}
      <div class="card"><div class="row between"><div><b class="list-title">Загрузить готовый план</b><div class="list-meta">JSON-файл с упражнениями, блоками и расписанием</div></div><span class="pill blue">Только добавление</span></div><p class="body-copy">Нейросеть-тренер может подготовить файл по инструкции. Импорт добавит новые упражнения и программы, сопоставит уже известные упражнения и пропустит повторно загруженные версии. Существующие тренировки, замеры и настройки не заменяются.</p><div class="grid-2" style="margin-top:12px"><button class="btn secondary" data-action="show-coach-prompt">${U.icon('clipboard')} Промт для ИИ</button><button class="btn primary" data-action="import-coach-plan">${U.icon('upload')} Загрузить программу тренера</button></div><input id="coach-file" type="file" accept=".json,application/json" class="hidden"></div>
      ${section('О приложении')}
      <div class="card"><div class="row between"><div><b class="list-title">Тренировки</b><div class="list-meta">Версия 2.0.1 · автономный дневник</div></div><span class="pill blue">PWA</span></div><div class="divider"></div><div class="body-copy">Данные остаются на устройстве и не отправляются на сервер. Приложение не использует аналитику, трекеры, рекламу, внешние шрифты или сетевые API. Для установки PWA требуется открыть сайт по HTTPS и хотя бы один раз загрузить его онлайн.</div><div class="divider"></div><button class="btn danger block" data-action="clear-data">${U.icon('trash')} Очистить все данные</button></div>`;
  }
  function showAddExercise(){
    const items=state.exercises.filter(e=>!e.archived);if(!items.length){U.toast('Сначала добавьте упражнение в библиотеку');tab='exercises';render();return;}
    showModal('Добавить упражнение','Можно выбрать несколько — у каждого подставятся прошлые результаты.',`<form id="add-session-form">${exercisePickerContent()}<div class="form-grid" style="margin-top:12px"><div class="field"><label>Подходов по умолчанию</label><input class="input" type="number" name="sets" value="3" min="1" max="12"></div><div class="field"><label>Повторов</label><input class="input" type="number" name="reps" value="8" min="1" max="100"></div></div></form>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="submit-add-session">Добавить</button>`);
  }
  function showAddBlock(){
    if(!state.blocks.length){U.toast('Сначала создайте блок в разделе «Упражнения»');return;}
    showModal('Добавить блок','Все упражнения блока добавятся в текущую тренировку.',state.blocks.map(b=>`<button class="list-item" style="width:100%;text-align:left;background:transparent;border:0" data-action="insert-block" data-id="${b.id}"><div class="list-icon">${U.icon('layers')}</div><div class="list-main"><b class="list-title">${U.esc(b.name)}</b><div class="list-meta">${(b.items||[]).length} упражнений</div></div>${U.icon('chevron')}</button>`).join(''));
  }
  function showExerciseMenu(index){
    const e=currentWorkout()?.exercises?.[index];if(!e)return;
    showModal(e.name,'Действия с упражнением',`<div class="stack"><button class="btn secondary block" data-action="replace-session-exercise" data-index="${index}">${U.icon('repeat')} Заменить упражнение</button><div class="grid-2"><button class="btn secondary" data-action="move-session-exercise" data-index="${index}" data-dir="-1">↑ Переместить выше</button><button class="btn secondary" data-action="move-session-exercise" data-index="${index}" data-dir="1">↓ Переместить ниже</button></div><button class="btn danger block" data-action="remove-session-exercise" data-index="${index}">${U.icon('trash')} Удалить из тренировки</button></div>`);
  }
  function showReplaceExercise(index){
    const e=currentWorkout()?.exercises?.[index];if(!e)return;
    showModal('Заменить упражнение','Подходы текущего упражнения останутся в истории активной тренировки до замены.',`${exercisePickerContent([])}<div class="inline-notice" style="margin-top:12px">После замены новые подходы будут созданы с предыдущими значениями выбранного упражнения. Старые записи не удаляются из завершённых тренировок.</div>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="apply-replace-exercise" data-index="${index}">Заменить</button>`);
  }
  function showArchived(){
    const items=state.exercises.filter(e=>e.archived);
    showModal('Архив упражнений','Архивные упражнения не отображаются в подборе, но история сохраняется.',items.length?items.map(e=>`<div class="list-item"><div class="list-main"><b class="list-title">${U.esc(e.name)}</b><div class="list-meta">${U.esc((e.muscles||[]).join(' · '))}</div></div><button class="btn ghost small-btn" data-action="restore-exercise" data-id="${e.id}">Вернуть</button><button class="icon-button" data-action="delete-exercise-permanent" data-id="${e.id}" title="Удалить навсегда">${U.icon('trash',15)}</button></div>`).join(''):empty('archive','Архив пуст','Архивированные упражнения появятся здесь.'));
  }
  function measurementForm(m=null){
    if(!state)throw new Error('Данные дневника ещё не загружены');
    if(!Array.isArray(state.measurements))state.measurements=[];
    const types=[...Object.entries(measureNames),...new Set(state.measurements.filter(x=>!measureNames[x.type]).map(x=>x.type))].map(v=>Array.isArray(v)?v:[v,v]);
    const typeOpts=types.map(([v,l])=>`<option value="${U.esc(v)}" ${((m?.type)||(!m&&'weight'))===v?'selected':''}>${U.esc(l)}</option>`).join('');
    showModal(m?'Изменить замер':'Новый замер','Вес — в килограммах, остальные параметры — в сантиметрах.',`<form id="measurement-form" novalidate>
      <input type="hidden" name="id" value="${m?.id||''}">
      <div class="form-grid">
        <div class="field"><label for="measurement-type">Показатель</label><select id="measurement-type" name="type" class="select">${typeOpts}<option value="custom">Свой замер…</option></select></div>
        <div class="field"><label for="measurement-date">Дата</label><input id="measurement-date" type="date" name="date" required class="input" value="${m?.date||U.localDate()}"></div>
        <div class="field full ${m&&!measureNames[m.type]?'':'hidden'}" id="custom-measure-field"><label for="measurement-custom-name">Название своего замера</label><input id="measurement-custom-name" name="customName" class="input" value="${U.esc(m&&!measureNames[m.type]?m.type:'')}" placeholder="Например, Запястье"></div>
        <div class="field"><label for="measurement-value">Значение <span data-measure-unit>${m?.unit||((m?.type||'weight')==='weight'?'кг':'см')}</span></label><input id="measurement-value" type="number" min="0.1" step="0.1" required name="value" class="input" value="${m?.value??''}" placeholder="0"></div>
        <div class="field"><label for="measurement-note">Заметка</label><input id="measurement-note" name="note" class="input" maxlength="120" value="${U.esc(m?.note||'')}" placeholder="Необязательно"></div>
      </div>
      <div style="margin-top:14px"><button type="button" class="btn primary block" data-action="submit-measurement">Сохранить замер</button></div>
    </form>`,`<button type="button" class="btn secondary" data-action="close-modal">Отмена</button>`);
    const form=$('#measurement-form',modalRoot);
    form?.addEventListener('submit',ev=>{ev.preventDefault();saveMeasurementForm();});
  }
  function bodyGoalForm(){const g=state.goals.bodyWeight||{};const cur=latestMeasurement('weight');showModal('Цель по весу тела','Задайте ориентир и срок — приложение покажет разницу с последней записью.',`<form id="body-goal-form"><div class="form-grid"><div class="field"><label>Целевой вес, кг</label><input class="input" type="number" name="targetValue" min="1" step="0.1" required value="${g.targetValue??''}" placeholder="Например, 80"></div><div class="field"><label>Текущий вес, кг</label><input class="input" type="number" name="startValue" min="1" step="0.1" value="${g.startValue??cur?.value??''}" placeholder="Необязательно"></div><div class="field"><label>Срок достижения</label><input class="input" type="date" name="deadline" value="${g.deadline||''}"></div><div class="field"><label>Заметка</label><input class="input" name="note" maxlength="120" value="${U.esc(g.note||'')}"></div></div></form>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="submit-body-goal">Сохранить цель</button>`);}
  function liftGoalForm(){if(!state.exercises.length){U.toast('Сначала создайте упражнения');return;}showModal('Цель по рабочему весу','Прогресс рассчитывается по максимальному записанному рабочему подходу.',`<form id="lift-goal-form"><div class="field"><label>Упражнение</label><select name="exerciseId" class="select" required>${state.exercises.filter(e=>!e.archived).map(e=>`<option value="${e.id}">${U.esc(e.name)}</option>`).join('')}</select></div><div class="form-grid" style="margin-top:12px"><div class="field"><label>Целевой вес, кг</label><input name="targetValue" class="input" type="number" min="0.1" step="0.5" required></div><div class="field"><label>Повторы</label><input name="targetReps" class="input" type="number" min="1" max="100" value="1"></div><div class="field full"><label>Срок</label><input name="deadline" class="input" type="date"></div></div></form>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="submit-lift-goal">Сохранить цель</button>`);}
  function showImportPreview(file){
    Backup.readFile(file).then(incoming=>{Backup.validateState(incoming);importState=incoming;const c=Backup.counts(incoming);showModal('Предпросмотр импорта',`Файл: ${U.esc(file.name)} · данные ещё не изменены.`,`<div class="card soft"><div class="stack">${Object.entries(c).map(([k,v])=>`<div class="row between"><span class="small">${({workouts:'Тренировки',exercises:'Упражнения',blocks:'Блоки',programs:'Программы',measurements:'Замеры',records:'Рекорды',achievements:'Достижения'})[k]||k}</span><b>${v}</b></div>`).join('')}</div></div><div class="field" style="margin-top:14px"><label>Режим импорта</label><div class="stack"><label class="row"><input type="radio" name="import-mode" value="merge" checked style="accent-color:var(--accent)"><span class="small">Объединить с текущими данными (дубликаты по ID пропускаются)</span></label><label class="row"><input type="radio" name="import-mode" value="replace" style="accent-color:var(--accent)"><span class="small">Заменить все текущие данные данными из файла</span></label></div></div><div class="inline-notice" style="margin-top:12px">Перед заменой рекомендуется скачать текущую резервную копию.</div>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="confirm-import">Импортировать</button>`);}).catch(e=>U.toast(e.message||'Не удалось прочитать файл','error'));
  }
  function coachPromptText(){
    return [
      'Ты — опытный тренер по силовым тренировкам. Составь персональную программу тренировок, которую можно без ручного исправления импортировать в приложение «Тренировки».',
      '',
      'СНАЧАЛА УТОЧНИ ДАННЫЕ',
      'Используй сведения, которые я уже написал или приложил. Если важных данных не хватает, задай короткие уточняющие вопросы и дождись ответов, не придумывай профиль самостоятельно.',
      'Уточни только то, что действительно необходимо: возраст; тренировочный опыт; основная цель; сколько раз в неделю и сколько минут я могу тренироваться; доступное оборудование; ограничения, травмы или движения, вызывающие боль; предпочтения по упражнениям. Текущий вес тела, рост и рабочие веса учитывай только если я их сообщил.',
      'Если я приложил JSON-экспорт из дневника, изучи его разделы state.workouts, state.exercises, state.programs, state.measurements и state.goals. Учитывай только фактически завершённые тренировки с endAt. Не путай плановые значения с выполненными подходами. Используй историю для подбора реалистичных стартовых весов и нагрузки. Не требуй экспорт, если я хочу составить план без него.',
      '',
      'ПРИНЦИПЫ СОСТАВЛЕНИЯ ПЛАНА',
      'Составь понятную программу с расписанием по дням, упражнениями в логичном порядке, подходами, диапазонами повторов, отдыхом и разминкой. Учитывай восстановление, тренировочный стаж, доступное оборудование и время занятия. Не добавляй лишний объём ради количества упражнений.',
      'Не назначай стартовые веса наугад. Если надёжных данных нет, укажи startingWeightKg: null — приложение само подставит последние результаты из истории. Не выдумывай личные рекорды, выполненные тренировки, замеры или цели. При боли или медицинских ограничениях не ставь диагноз и не предлагай тренироваться через боль.',
      '',
      'СТРОГИЙ ФОРМАТ ФАЙЛА',
      'Результат должен быть отдельным JSON-документом в UTF-8, расширение .json. Не возвращай полную резервную копию дневника.',
      'Корневой объект обязан содержать:',
      '- format: "personal-training-diary-coach-plan" (строго это значение);',
      '- version: 1 (число);',
      '- generatedAt: текущая дата и время в ISO 8601 UTC;',
      '- coachNote: краткое объяснение логики программы;',
      '- exercises: непустой массив общего каталога упражнений;',
      '- blocks: массив блоков или пустой массив [];',
      '- programs: непустой массив программ;',
      '- liftGoals: массив целей или пустой массив [].',
      '',
      'Каждый объект exercises должен содержать:',
      '- id: уникальный стабильный ASCII ID в нижнем регистре, например barbell-bench-press; используй только латинские буквы, цифры, дефис или подчёркивание;',
      '- name: название упражнения на русском;',
      '- muscles: массив мышечных групп;',
      '- equipment: одно из значений Штанга, Гантели, Блок, Тренажёр, Собственный вес, Другое;',
      '- stepKg: положительное число — шаг изменения веса в килограммах;',
      '- restSeconds: неотрицательное целое число секунд;',
      '- note и description: необязательные строки с техникой и пояснением.',
      'Для muscles используй подходящие значения: Грудь, Спина, Плечи, Бицепс, Трицепс, Предплечья, Пресс, Квадрицепс, Бицепс бедра, Ягодицы, Икры, Трапеции, Поясница, Шея, Другое.',
      '',
      'Каждый объект programs должен содержать id, name, description и непустой массив days. ID программы должен быть уникальным. Для новой редакции существующей программы создавай новый ID версии.',
      'Каждый день days должен содержать id, name, weekday и непустой массив exercises. weekday — целое число: 0 воскресенье, 1 понедельник, 2 вторник, 3 среда, 4 четверг, 5 пятница, 6 суббота; null означает, что день не назначен.',
      'Каждый элемент day.exercises должен содержать:',
      '- exerciseId: точное значение id из корневого массива exercises;',
      '- sets: целое число от 1 до 20;',
      '- repsMin: целое число от 1 до 100;',
      '- repsMax: целое число не меньше repsMin и не больше 100;',
      '- startingWeightKg: число или null;',
      '- warmupSets: необязательное целое число от 0 до 5;',
      '- note: необязательная строка.',
      '',
      'Каждый блок blocks должен содержать уникальные id, name, необязательный note и непустой массив items. Элементы items используют те же поля, что и упражнения в тренировочном дне: exerciseId, sets, repsMin, repsMax, startingWeightKg, warmupSets, note.',
      'Каждая цель liftGoals, если она нужна и обоснована данными, должна ссылаться на существующий exerciseId и содержать targetWeightKg больше 0 и targetReps — целое число от 1. Допустимы необязательные id, deadline в формате ГГГГ-ММ-ДД и note. Не создавай цели без основания.',
      '',
      'КОНТРОЛЬ ПЕРЕД ОТВЕТОМ',
      'Проверь, что все ID упражнений уникальны, все exerciseId ссылаются на существующие упражнения, у каждой программы есть хотя бы один день, а у каждого дня — хотя бы одно упражнение. Проверь диапазоны sets, repsMin, repsMax, warmupSets и корректность weekday.',
      'Не добавляй в JSON поля тренировочной истории, завершённых тренировок, замеров или настроек приложения. Файл должен только добавлять упражнения, блоки, программы и обоснованные цели. Повторный импорт с тем же ID программы будет пропущен; для новой версии используй новый ID.',
      '',
      'ВЕРНИ РЕЗУЛЬТАТ',
      'Если платформа умеет создавать файлы, создай файл coach-plan.json для скачивания. Иначе выведи один полный валидный JSON-объект без Markdown, комментариев и пояснений до или после него, чтобы я мог сохранить его в файл coach-plan.json.',
      'Содержимое coach-plan.json должно быть только JSON, без пояснительного текста до или после объекта. Не утверждай, что импорт уже выполнен.'
    ].join('\n');
  }
  function showCoachPrompt(){
    const prompt=coachPromptText();
    const content='<div class="field"><label for="coach-prompt-text">Готовый промт</label><textarea id="coach-prompt-text" class="input" rows="17" readonly spellcheck="false" style="min-height:340px;resize:vertical;font-size:12px;line-height:1.55;white-space:pre-wrap">'+U.esc(prompt)+'</textarea></div><div class="inline-notice" style="margin-top:12px">Для персонального плана можешь дополнительно приложить JSON-экспорт из дневника. В нём есть история тренировок и замеры — передавай его ИИ только если готов поделиться этими данными.</div>';
    const buttons='<button type="button" class="btn secondary" data-action="close-modal">Закрыть</button><button type="button" class="btn primary" data-action="copy-coach-prompt">'+U.icon('clipboard',17)+' Скопировать промт</button>';
    showModal('Промт для ИИ-тренера','Скопируй инструкцию и отправь её нейросети для создания совместимого файла программы.',content,buttons);
  }
  async function copyCoachPrompt(){
    const field=$('#coach-prompt-text',modalRoot);
    if(!field)return;
    let copied=false;
    try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(field.value);copied=true;}}catch(_){}
    if(!copied){try{field.focus();field.select();copied=!!document.execCommand('copy');}catch(_){}}
    if(copied)U.toast('Промт скопирован','success');
    else{field.focus();field.select();U.toast('Текст выделен. Скопируй его вручную через Ctrl+C или меню браузера.','error');}
  }
  function showCoachImportPreview(file){
    Backup.readCoachPlan(file).then(incoming=>{
      importState=incoming;
      const c=Backup.counts(incoming);
      const plans=incoming.programs.length, exercises=incoming.exercises.length, blocks=incoming.blocks.length;
      showModal('Импорт программы тренера',`Файл: ${U.esc(file.name)} · содержимое проверено, ваши данные пока не менялись.`,
        `<div class="card soft"><div class="stack"><div class="row between"><span class="small">Программы</span><b>${plans}</b></div><div class="row between"><span class="small">Упражнения в библиотеку</span><b>${exercises}</b></div><div class="row between"><span class="small">Блоки упражнений</span><b>${blocks}</b></div><div class="row between"><span class="small">Запланированные тренировки</span><b>${incoming.programs.reduce((n,p)=>n+(p.days||[]).length,0)}</b></div></div></div>
        <div class="inline-notice" style="margin-top:12px"><b>Безопасный режим.</b> Будут добавлены только новые записи. Совпадающие упражнения будут привязаны к существующим. Повторно загруженный файл с тем же ID программы будет пропущен. История, замеры, цели и настройки не удаляются и не перезаписываются.</div>
        <p class="body-copy" style="margin:12px 2px 0">Этот файл создаёт план и шаблоны, а не фиктивную историю выполненных тренировок. Фактические результаты появятся после того, как ты запишешь подходы в зале.</p>`,
        `<button type="button" class="btn secondary" data-action="close-modal">Отмена</button><button type="button" class="btn primary" data-action="confirm-coach-import">Добавить программу</button>`);
    }).catch(e=>U.toast(e.message||'Не удалось прочитать файл тренера','error'));
  }
  function saveExerciseForm(){const form=$('#exercise-form');if(!form?.reportValidity())return;const fd=new FormData(form),id=fd.get('id'),existing=findExercise(id);const muscles=fd.getAll('muscles');const exercise={id:id||U.uid('exercise'),name:String(fd.get('name')).trim(),muscles,equipment:fd.get('equipment'),step:Number(fd.get('step'))||state.settings.defaultStep,rest:Number(fd.get('rest'))||state.settings.restSeconds,note:String(fd.get('note')||'').trim(),archived:false,createdAt:existing?.createdAt||new Date().toISOString()};if(!exercise.name){U.toast('Введите название упражнения');return;}if(existing)Object.assign(existing,exercise);else state.exercises.push(exercise);closeModal();save(true);render();U.toast(existing?'Упражнение обновлено':'Упражнение добавлено','success');}
  function saveBlockForm(){const f=$('#block-form');if(!f?.reportValidity())return;const fd=new FormData(f),ids=fd.getAll('pickedExercises');if(!ids.length){U.toast('Выберите хотя бы одно упражнение');return;}state.blocks.push({id:U.uid('block'),name:String(fd.get('name')).trim(),items:ids.map(id=>({exerciseId:id,sets:Number(fd.get('sets'))||3,repsMin:Number(fd.get('repsMin'))||8,repsMax:Number(fd.get('repsMax'))||12})),createdAt:new Date().toISOString()});closeModal();save(true);exerciseMode='blocks';tab='exercises';render();U.toast('Блок создан','success');}
  function saveProgramForm(){
    const f=$('#program-form');if(!f?.reportValidity())return;
    const fd=new FormData(f),ids=fd.getAll('pickedExercises');if(!ids.length){U.toast('Выберите хотя бы одно упражнение');return;}
    const pId=String(fd.get('programId')||''),dayId=String(fd.get('dayId')||'');
    let program=state.programs.find(p=>p.id===pId);
    if(!program){program={id:U.uid('program'),name:String(fd.get('name')).trim(),days:[],createdAt:new Date().toISOString()};state.programs.push(program);}
    else if(fd.get('name'))program.name=String(fd.get('name')).trim();
    const existing=dayId?program.days.find(d=>d.id===dayId):null;
    const defaults={sets:Number(fd.get('sets'))||3,repsMin:Number(fd.get('repsMin'))||8,repsMax:Number(fd.get('repsMax'))||12};
    const oldItems=new Map((existing?.items||[]).map(item=>[item.exerciseId,item]));
    const items=ids.map(id=>{const old=oldItems.get(id);return {...old,exerciseId:id,sets:Number(old?.sets)||defaults.sets,repsMin:Number(old?.repsMin)||defaults.repsMin,repsMax:Number(old?.repsMax)||defaults.repsMax};});
    const day={id:existing?.id||U.uid('day'),name:String(fd.get('dayName')).trim()||'Тренировочный день',weekday:Number(fd.get('weekday')),items};
    if(existing)Object.assign(existing,day);else program.days.push(day);
    closeModal();save(true);exerciseMode='programs';tab='exercises';render();U.toast(existing?'День программы обновлён':'День программы сохранён','success');
  }
function saveMeasurementForm(){
    const f=$('#measurement-form',modalRoot);
    if(!f){U.toast('Не удалось найти форму замера. Закройте окно и откройте его снова.','error');return;}
    const field=name=>f.elements.namedItem(name);
    const typeField=field('type'),dateField=field('date'),valueField=field('value'),customField=field('customName');
    let type=String(typeField?.value||'');
    if(type==='custom')type=String(customField?.value||'').trim();
    const date=String(dateField?.value||'');
    const value=Number(valueField?.value);
    if(!type){U.toast('Укажите показатель или название своего замера','error');customField?.focus();return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(value)||value<=0){
      U.toast('Введите корректную дату и значение больше нуля','error');
      if(!dateField?.value)dateField?.focus();else valueField?.focus();
      return;
    }
    if(!f.reportValidity())return;
    const existingId=String(field('id')?.value||'');
    const existing=existingId?state.measurements.find(m=>m.id===existingId):null;
    const before=existing?{...existing}:null;
    const item={id:existing?.id||U.uid('measurement'),date,type,value,unit:type==='weight'?'кг':'см',note:String(field('note')?.value||'').trim(),createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};
    if(existing)Object.assign(existing,item);else state.measurements.push(item);
    const previousMetric=bodyMetric;
    bodyMetric=type;
    calculateAchievements();
    const saveButton=$('[data-action="submit-measurement"]',modalRoot);
    if(saveButton){saveButton.disabled=true;saveButton.textContent='Сохраняем…';}
    save(true).then(()=>{
      closeModal();
      tab='body';
      render();
      U.toast(existing?'Замер обновлён':'Замер сохранён','success');
    }).catch(error=>{
      if(existing&&before)Object.assign(existing,before);
      else state.measurements=state.measurements.filter(m=>m.id!==item.id);
      bodyMetric=previousMetric;
      calculateAchievements();
      if(saveButton){saveButton.disabled=false;saveButton.textContent='Сохранить замер';}
      U.toast(error?.message||'Не удалось сохранить замер. Проверьте свободное место в браузере.','error');
    });
  }
  function saveBodyGoal(){const f=$('#body-goal-form');if(!f?.reportValidity())return;const fd=new FormData(f);state.goals.bodyWeight={targetValue:Number(fd.get('targetValue')),startValue:Number(fd.get('startValue'))||null,startDate:U.localDate(),deadline:fd.get('deadline')||'',note:String(fd.get('note')||'').trim()};closeModal();save(true);render();U.toast('Цель сохранена','success');}
  function saveLiftGoal(){const f=$('#lift-goal-form');if(!f?.reportValidity())return;const fd=new FormData(f),id=fd.get('exerciseId');state.goals.lifts.push({id:U.uid('goal'),exerciseId:id,exerciseName:exerciseName(id),targetValue:Number(fd.get('targetValue')),targetReps:Number(fd.get('targetReps'))||1,deadline:fd.get('deadline')||'',active:true});closeModal();save(true);render();U.toast('Цель добавлена','success');}
  function recalcRecords(){
    const sorted=sortWorkouts(state.workouts).reverse();const old=state.workouts;state.workouts=[];const rec=[];
    sorted.forEach(w=>{rec.push(...makeRecords(w));state.workouts.push(w);});state.workouts=old;state.records=rec;
  }
  function adjustCurrentSet(id,field,delta){const found=findSet(id);if(!found)return;const step=field==='weight'?(Number(findExercise(found.exercise.exerciseId)?.step)||Number(state.settings.defaultStep)||2.5):1;const value=Number(found.set[field])||0;found.set[field]=Math.max(0,U.round(value+Number(delta),field==='weight'?2:0));const input=$(`[data-set-id="${id}"][data-set-field="${field}"]`);if(input)input.value=found.set[field];save(true);updateWorkoutStats();}
  function updateWorkoutStats(){const w=currentWorkout();if(!w)return;const d=$('[data-workout-volume]');if(d)d.textContent=U.fmtNum(workoutVolume(w),0)+' кг';const s=$('[data-workout-sets]');if(s)s.textContent=totalSets(w);}
  function recordSet(id){const found=findSet(id);if(!found)return;unlockRestAudio();const {set,exercise}=found;
    if(set.done){set.done=false;set.restSeconds=null;state.activeWorkout.rest=null;save(true);render();U.toast('Запись подхода отменена');return;}
    set.weight=Math.max(0,Number(set.weight)||0);set.reps=Math.max(0,Number(set.reps)||0);if(!set.reps){U.toast('Укажите количество повторов');return;}
    const now=Date.now();const lastAt=state.activeWorkout.lastSetAt;set.restSeconds=lastAt?Math.max(0,Math.round((now-lastAt)/1000)):null;set.done=true;set.createdAt=new Date(now).toISOString();state.activeWorkout.lastSetAt=now;
    if(set.type!=='warmup'){
      const history=previousRecords(exercise.exerciseId);const maxWeight=Math.max(0,...history.map(x=>x.weight));const maxE1RM=Math.max(0,...history.map(x=>x.e1rm));
      const e1=getE1RM(set.weight,set.reps);if(set.weight>maxWeight&&set.weight>0)state.activeWorkout.recordFlash=`${exercise.name}: новый вес ${U.fmtNum(set.weight)} кг`;
      else if(e1>maxE1RM&&e1>0)state.activeWorkout.recordFlash=`${exercise.name}: расчётный 1ПМ ${U.fmtNum(e1)} кг`;
      else state.activeWorkout.recordFlash='';
    }
    const duration=restSecondsFor(exercise);if(duration>0)state.activeWorkout.rest={startedAt:now,until:now+duration*1000,duration};
    save(true);render();if(state.activeWorkout.recordFlash)U.toast('Новый личный рекорд!','success');else U.toast('Подход записан','success');
  }
  function changeActiveDate(){const w=currentWorkout();if(!w)return;showModal('Дата тренировки','Можно записать занятие задним числом.',`<div class="field"><label>Дата</label><input class="input" type="date" id="active-date" value="${w.date}" max="${U.localDate()}"></div>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-active-date">Сохранить</button>`);}
  function editHistorySave(id){const w=state.workouts.find(x=>x.id===id);if(!w)return;const form=$('#history-edit-form');if(!form?.reportValidity())return;const fd=new FormData(form);w.date=fd.get('date');w.title=String(fd.get('title')||'Тренировка').trim();w.volume=workoutVolume(w);w.exercises.forEach(e=>e.sets.forEach(s=>{s.weight=Math.max(0,Number(s.weight)||0);s.reps=Math.max(0,Number(s.reps)||0);}));recalcRecords();closeModal();save(true);render();U.toast('История обновлена','success');}
  function handleAction(ev,el){
    const action=el.dataset.action;
    const id=el.dataset.id;
    switch(action){
      case 'open-section':{const section=el.dataset.section;if(['exercises','body','profile'].includes(section)){tab=section;render(true);}break;}
      case 'close-modal':closeModal();break;
      case 'backdrop-close':if(el===ev.target)closeModal();break;
      case 'toggle-program-expand':{const dayId=el.dataset.id;if(expandedProgramDays.has(dayId))expandedProgramDays.delete(dayId);else expandedProgramDays.add(dayId);render();break;}
      case 'edit-program-day':{const p=state.programs.find(x=>x.id===el.dataset.program),d=p?.days.find(x=>x.id===el.dataset.day);if(p&&d)addProgramForm(p,d);break;}
      case 'go-to-workout':tab='workout';render();break;
      case 'toggle-achievements':achievementsExpanded=!achievementsExpanded;render();break;
      case 'quick-add':showModal('Быстрое действие','Выберите, что хотите добавить.',`<div class="stack"><button class="btn secondary block" data-action="quick-start">${U.icon('dumbbell')} Начать тренировку</button><button class="btn secondary block" data-action="quick-exercise">${U.icon('plus')} Добавить упражнение</button><button class="btn secondary block" data-action="quick-measure">${U.icon('scale')} Записать замер</button></div>`);break;
      case 'quick-start':closeModal();makeWorkout();break;
      case 'quick-exercise':closeModal();exerciseForm();break;
      case 'quick-measure':closeModal();measurementForm();break;
      case 'start-empty':makeWorkout();break;
      case 'start-plan':{const p=findTodayPlan();if(p)makeWorkout(p);else U.toast('На сегодня программа не назначена');break;}
      case 'start-program':{const p=state.programs.find(x=>x.id===el.dataset.program),d=p?.days.find(x=>x.id===el.dataset.day);if(p&&d)makeWorkout({program:p,day:d});break;}
      case 'repeat-last':{const last=sortWorkouts(activeWorkouts())[0];if(last)makeWorkout(null,last);else U.toast('Нет прошлых тренировок');break;}
      case 'record-set':recordSet(id);break;
      case 'adjust-set':adjustCurrentSet(id,el.dataset.field,el.dataset.delta);break;
      case 'add-set':{const w=currentWorkout(),e=w?.exercises.find(x=>x.exerciseId===el.dataset.exercise);if(!e)return;const s=newSetFromHistory(e.exerciseId,e.sets.length);e.sets.push(s);save(true);render();break;}
      case 'remove-set':{const found=findSet(id);if(found){found.exercise.sets=found.exercise.sets.filter(s=>s.id!==id);save(true);render();}break;}
      case 'toggle-warmup':{const found=findSet(id);if(!found)return;if(!state.settings.warmups){U.toast('Разминочные подходы отключены в настройках');return;}found.set.type=found.set.type==='warmup'?'work':'warmup';save(true);render();break;}
      case 'finish-workout':finishWorkout();break;
      case 'cancel-active':showModal('Отменить тренировку?','Черновик будет удалён. Завершённые тренировки не затрагиваются.',`<div class="inline-notice">Текущие несохранённые подходы будут потеряны.</div>`,`<button class="btn secondary" data-action="close-modal">Продолжить</button><button class="btn danger" data-action="confirm-cancel-active">Отменить</button>`);break;
      case 'confirm-cancel-active':state.activeWorkout=null;save(true);closeModal();render();U.toast('Черновик тренировки удалён');break;
      case 'edit-workout-date':changeActiveDate();break;
      case 'save-active-date':{const date=$('#active-date')?.value;if(date&&date<=U.localDate()){currentWorkout().date=date;save(true);closeModal();render();U.toast('Дата обновлена');}else U.toast('Выберите корректную дату');break;}
      case 'show-add-exercise':showAddExercise();break;
      case 'submit-add-session':{const f=$('#add-session-form');if(!f)return;const fd=new FormData(f),ids=fd.getAll('pickedExercises');if(!ids.length){U.toast('Выберите упражнения');return;}ids.forEach(exId=>{if(!currentWorkout().exercises.some(e=>e.exerciseId===exId)){const ex=makeSessionExercise(exId,Number(fd.get('sets'))||3,Number(fd.get('reps'))||8);if(ex)currentWorkout().exercises.push(ex);}});closeModal();save(true);render();break;}
      case 'show-add-block':showAddBlock();break;
      case 'insert-block':{const block=state.blocks.find(b=>b.id===id);if(!block)return;(block.items||[]).forEach(item=>{if(!currentWorkout().exercises.some(e=>e.exerciseId===item.exerciseId)){const ex=makeSessionExercise(item.exerciseId,item.sets,item.repsMin);if(ex)currentWorkout().exercises.push(ex);}});closeModal();save(true);render();U.toast('Блок добавлен');break;}
      case 'exercise-menu':showExerciseMenu(Number(el.dataset.index));break;
      case 'replace-session-exercise':showReplaceExercise(Number(el.dataset.index));break;
      case 'apply-replace-exercise':{const index=Number(el.dataset.index),f=$('.modal-sheet'),selected=$$('input[name="pickedExercises"]:checked',f);if(!selected.length){U.toast('Выберите новое упражнение');return;}const ex=makeSessionExercise(selected[0].value,currentWorkout().exercises[index].sets.length||1,8);if(ex)currentWorkout().exercises[index]=ex;closeModal();save(true);render();break;}
      case 'move-session-exercise':{const a=currentWorkout().exercises,index=Number(el.dataset.index),next=index+Number(el.dataset.dir);if(next>=0&&next<a.length){[a[index],a[next]]=[a[next],a[index]];save(true);closeModal();render();}break;}
      case 'remove-session-exercise':{currentWorkout().exercises.splice(Number(el.dataset.index),1);save(true);closeModal();render();break;}
      case 'add-exercise':exerciseForm();break;
      case 'edit-exercise':exerciseForm(findExercise(id));break;
      case 'submit-exercise':saveExerciseForm();break;
      case 'show-archived':showArchived();break;
      case 'restore-exercise':{const e=findExercise(id);if(e)e.archived=false;save(true);closeModal();render();U.toast('Упражнение возвращено');break;}
      case 'delete-exercise-permanent':{const e=findExercise(id);if(e){state.exercises=state.exercises.filter(x=>x.id!==id);state.workouts.forEach(w=>(w.exercises||[]).forEach(x=>{if(x.exerciseId===id&&!x.name)x.name=e.name;}));}save(true);showArchived();break;}
      case 'archive-exercise':{const e=findExercise(id);if(e)e.archived=true;save(true);closeModal();render();U.toast('Упражнение перемещено в архив');break;}
      case 'delete-exercise':{showModal('Удалить упражнение?','Исторические записи тренировок сохранят название упражнения.',`<div class="inline-notice">Элемент будет удалён из библиотеки. История тренировок останется без изменений.</div>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn danger" data-action="confirm-delete-exercise" data-id="${id}">Удалить</button>`);break;}
      case 'confirm-delete-exercise':state.exercises=state.exercises.filter(x=>x.id!==id);state.workouts.forEach(w=>(w.exercises||[]).forEach(e=>{if(e.exerciseId===id&&!e.name)e.name='Удалённое упражнение';}));save(true);closeModal();render();break;
      case 'exercise-mode':exerciseMode=el.dataset.mode;render();break;
      case 'add-block':addBlockForm();break;
      case 'submit-block':saveBlockForm();break;
      case 'block-menu':{const b=state.blocks.find(x=>x.id===id);if(!b)return;showModal(b.name,'Управление блоком',`<div class="stack"><button class="btn secondary block" data-action="rename-block" data-id="${id}">Переименовать</button><button class="btn danger block" data-action="delete-block" data-id="${id}">Удалить блок</button></div>`);break;}
      case 'rename-block':{const b=state.blocks.find(x=>x.id===id);showModal('Переименовать блок','',`<input class="input" id="rename-value" value="${U.esc(b?.name||'')}">`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-rename-block" data-id="${id}">Сохранить</button>`);break;}
      case 'save-rename-block':{const b=state.blocks.find(x=>x.id===id);if(b)b.name=$('#rename-value').value.trim()||b.name;save(true);closeModal();render();break;}
      case 'delete-block':state.blocks=state.blocks.filter(x=>x.id!==id);save(true);closeModal();render();break;
      case 'start-block':{const b=state.blocks.find(x=>x.id===id);if(!b)return;if(!currentWorkout())makeWorkout();(b.items||[]).forEach(item=>{const e=makeSessionExercise(item.exerciseId,item.sets,item.repsMin);if(e)currentWorkout().exercises.push(e);});tab='workout';save(true);render();break;}
      case 'add-program':addProgramForm();break;
      case 'submit-program':saveProgramForm();break;
      case 'add-program-day':addProgramForm(state.programs.find(x=>x.id===id));break;
      case 'program-menu':{const p=state.programs.find(x=>x.id===id);if(!p)return;showModal(p.name,'Управление программой',`<div class="stack"><button class="btn secondary block" data-action="add-program-day" data-id="${id}">${U.icon('plus')} Добавить тренировочный день</button><button class="btn danger block" data-action="delete-program" data-id="${id}">${U.icon('trash')} Удалить программу</button></div>`);break;}
      case 'delete-program':state.programs=state.programs.filter(x=>x.id!==id);save(true);closeModal();render();break;
      case 'move-missed-plan':{const p=state.programs.find(x=>x.id===el.dataset.program),d=p?.days.find(x=>x.id===el.dataset.day);if(d)d.weekday=U.dateAtNoon(U.localDate()).getDay();save(true);render();U.toast('План перенесён на сегодня');break;}
      case 'move-plan':{const p=state.programs.find(x=>x.id===el.dataset.program),d=p?.days.find(x=>x.id===el.dataset.day);if(!d)return;showModal('Перенести план','Изменится назначенный день недели программы.',`<div class="field"><label>Новый день</label><select id="move-day" class="select">${dayNames.map((v,i)=>`<option value="${i}" ${d.weekday===i?'selected':''}>${v}</option>`).join('')}</select></div>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn primary" data-action="save-move-plan" data-program="${p.id}" data-day="${d.id}">Перенести</button>`);break;}
      case 'save-move-plan':{const p=state.programs.find(x=>x.id===el.dataset.program),d=p?.days.find(x=>x.id===el.dataset.day);if(d)d.weekday=Number($('#move-day').value);save(true);closeModal();render();U.toast('План перенесён');break;}
      case 'open-workout':renderWorkoutDetail(id);break;
      case 'save-history-edit':editHistorySave(id);break;
      case 'duplicate-workout':{const w=state.workouts.find(x=>x.id===id);if(w){closeModal();makeWorkout(null,w);}break;}
      case 'delete-workout':showModal('Удалить тренировку?','Это действие нельзя отменить.',`<div class="inline-notice">Тренировка и её подходы будут удалены из истории.</div>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn danger" data-action="confirm-delete-workout" data-id="${id}">Удалить</button>`);break;
      case 'confirm-delete-workout':state.workouts=state.workouts.filter(w=>w.id!==id);state.records=state.records.filter(r=>r.workoutId!==id);recalcRecords();closeModal();save(true);render();U.toast('Тренировка удалена');break;
      case 'month-prev':monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()-1,1);render();break;
      case 'month-next':monthCursor=new Date(monthCursor.getFullYear(),monthCursor.getMonth()+1,1);render();break;
      case 'select-history-date':historyDate=el.dataset.date;render();break;
      case 'clear-history-date':historyDate='';render();break;
      case 'progress-period':progressPeriod=el.dataset.period;render();break;
      case 'add-measurement':{try{measurementForm();if(!$('#measurement-form',modalRoot))throw new Error('Форма замера не была создана');}catch(error){console.error('Ошибка открытия формы замера:',error);U.toast('Не удалось открыть форму замера: '+(error.message||'неизвестная ошибка'),'error');}break;}
      case 'submit-measurement':saveMeasurementForm();break;
      case 'measurement-menu':{const m=state.measurements.find(x=>x.id===id);if(!m)return;showModal(measureNames[m.type]||m.type,U.fmtDate(m.date),`<div class="stack"><button class="btn secondary block" data-action="edit-measurement" data-id="${id}">${U.icon('edit')} Изменить</button><button class="btn danger block" data-action="delete-measurement" data-id="${id}">${U.icon('trash')} Удалить</button></div>`);break;}
      case 'edit-measurement':measurementForm(state.measurements.find(x=>x.id===id));break;
      case 'delete-measurement':state.measurements=state.measurements.filter(x=>x.id!==id);closeModal();save(true);render();break;
      case 'edit-body-goal':bodyGoalForm();break;
      case 'submit-body-goal':saveBodyGoal();break;
      case 'add-goal':liftGoalForm();break;
      case 'submit-lift-goal':saveLiftGoal();break;
      case 'delete-goal':state.goals.lifts=state.goals.lifts.filter(g=>g.id!==id);save(true);render();break;
      case 'toggle-setting':{const key=el.dataset.setting;state.settings[key]=!state.settings[key];if(key==='restSound'&&state.settings[key])unlockRestAudio();save(true);render();break;}
      case 'export-json':exportJson();break;
      case 'export-xlsx':exportXlsx();break;
      case 'import-backup':$('#backup-file')?.click();break;
      case 'show-coach-prompt':showCoachPrompt();break;
      case 'copy-coach-prompt':copyCoachPrompt();break;
      case 'import-coach-plan':$('#coach-file')?.click();break;
      case 'confirm-coach-import':{if(!importState?.coachPlan)return;try{const result=Backup.mergeCoachPlan(state,importState);state=result.state;calculateAchievements();importState=null;save(true);closeModal();render();U.toast(`Добавлено: ${result.added.programs} программ, ${result.added.exercises} упражнений, ${result.added.blocks} блоков`,'success');}catch(e){U.toast(e.message||'Не удалось добавить программу','error');}break;}
      case 'confirm-import':{if(!importState)return;const mode=$('input[name="import-mode"]:checked',modalRoot)?.value||'merge';try{state=Backup.mergeState(state,importState,mode==='replace');importState=null;save(true);closeModal();render();U.toast('Импорт завершён','success');}catch(e){U.toast(e.message,'error');}break;}
      case 'clear-data':showModal('Очистить все данные?','Первое подтверждение. Резервная копия не создаётся автоматически.',`<div class="inline-notice">Тренировки, упражнения, программы, цели, замеры и настройки будут удалены с этого устройства.</div>`,`<button class="btn secondary" data-action="close-modal">Отмена</button><button class="btn danger" data-action="clear-data-second">Продолжить</button>`);break;
      case 'clear-data-second':showModal('Подтвердите удаление','Последнее подтверждение — восстановить данные можно только из резервной копии.',`<div class="timer-big" style="font-size:36px;color:var(--red)">${U.icon('trash',34)}</div><p class="body-copy" style="text-align:center">Вы уверены, что хотите удалить всё содержимое дневника?</p>`,`<button class="btn secondary" data-action="close-modal">Нет, оставить</button><button class="btn danger" data-action="confirm-clear-data">Да, удалить всё</button>`);break;
      case 'confirm-clear-data':DB.clear().then(()=>{state=DB.defaults();closeModal();render();U.toast('Все данные удалены');});break;
      
      case 'go-history':closeModal();tab='history';render();break;
      case 'timer-add':if(state.activeWorkout?.rest){state.activeWorkout.rest.until+=15000;state.activeWorkout.rest.duration+=15;save(true);render();}break;
      case 'timer-skip':if(state.activeWorkout){state.activeWorkout.rest=null;save(true);render();}break;
      
    }
  }
  function exportJson(){state.lastBackup=new Date().toISOString();U.download(`training-diary-${U.localDate()}.json`,Backup.exportJSON(state));save(true);if(tab==='profile')render();U.toast('JSON-копия сохранена','success');}
  async function exportXlsx(){try{state.lastBackup=new Date().toISOString();const blob=await window.TrainingXLSX.write(state);U.download(`training-diary-${U.localDate()}.xlsx`,blob);save(true);if(tab==='profile')render();U.toast('Excel-файл создан','success');}catch(e){U.toast(e.message||'Не удалось создать XLSX','error');}}
  function updateSetField(el){
    const id=el.dataset.setId,field=el.dataset.setField;const found=findSet(id);if(!found)return;
    let val=el.value;if(['weight','reps','rpe','rir'].includes(field))val=val===''?null:Number(val);
    if(field==='weight'||field==='reps')val=Math.max(0,Number(val)||0);
    if(field==='rpe'&&val!==null)val=Math.min(10,Math.max(1,val));if(field==='rir'&&val!==null)val=Math.min(20,Math.max(0,val));
    found.set[field]=val;save(true);updateWorkoutStats();
  }
  function updateHistorySet(el){const id=el.dataset.historySet,field=el.dataset.historyField;for(const w of state.workouts)for(const e of w.exercises||[])for(const s of e.sets||[])if(s.id===id){s[field]=Math.max(0,Number(el.value)||0);w.volume=workoutVolume(w);save(true);return;}}
  function handleChange(el){
    if(el.matches('[data-set-id][data-set-field]')){updateSetField(el);return;}
    if(el.matches('[data-set-id][data-set-tag]')){const found=findSet(el.dataset.setId);if(!found)return;const tags=found.set.tags||(found.set.tags=[]);if(el.checked&&!tags.includes(el.dataset.setTag))tags.push(el.dataset.setTag);else found.set.tags=tags.filter(t=>t!==el.dataset.setTag);save(true);return;}
    if(el.matches('[data-history-set]')){updateHistorySet(el);return;}
    if(el.matches('[data-setting]')){const key=el.dataset.setting;let value=el.value;if(['defaultStep','restSeconds','weekStart','weeklyTarget'].includes(key))value=Number(value);state.settings[key]=value;save(true);render();return;}
    if(el.matches('[data-filter="muscle"]')){exerciseMuscle=el.value;render();return;}
    if(el.matches('[data-filter="equipment"]')){exerciseEquipment=el.value;render();return;}
    if(el.matches('[data-progress-exercise]')){progressExercise=el.value;render();return;}
    if(el.matches('[data-body-metric]')){bodyMetric=el.value;bodyCompareFrom='';bodyCompareTo='';render();return;}
    if(el.matches('[data-body-compare]')){if(el.dataset.bodyCompare==='from')bodyCompareFrom=el.value;else bodyCompareTo=el.value;render();return;}
    if(el.matches('#measurement-form select[name="type"]')){const custom=$('#custom-measure-field');custom?.classList.toggle('hidden',el.value!=='custom');const u=$('[data-measure-unit]');if(u)u.textContent=el.value==='weight'?'кг':'см';return;}
    if(el.id==='backup-file'&&el.files?.[0]){showImportPreview(el.files[0]);el.value='';return;}
    if(el.id==='coach-file'&&el.files?.[0]){showCoachImportPreview(el.files[0]);el.value='';return;}
  }
  function handleInput(el){
    if(el.matches('[data-set-id][data-set-field]')){updateSetField(el);return;}
    if(el.matches('[data-search="exercises"]')){exerciseSearch=el.value;const pos=el.selectionStart;render();const input=$('[data-search="exercises"]');if(input){input.focus();input.setSelectionRange(pos,pos);}return;}
    if(el.matches('[data-search="history"]')){historySearch=el.value;const pos=el.selectionStart;render();const input=$('[data-search="history"]');if(input){input.focus();input.setSelectionRange(pos,pos);}return;}
    if(el.matches('[data-picker-search]')){const q=el.value.toLowerCase();$$('label.row',el.closest('.modal-sheet')).forEach(label=>{label.style.display=label.textContent.toLowerCase().includes(q)?'flex':'none';});return;}
  }
    function syncRestTimer(){
    const rest=state?.activeWorkout?.rest;
    if(!rest)return false;
    const remaining=Number(rest.until)-Date.now();
    if(Number.isFinite(remaining)&&remaining>0)return false;
    state.activeWorkout.rest=null;
    state.activeWorkout.restFinishedAt=Date.now();
    playRestEndSignal();
    save(true);
    $('.rest-panel')?.remove();
    U.toast('Время отдыха завершено','success');
    return true;
  }
  function activeExerciseForLive(w){
    const exercises=w.exercises||[];
    return exercises.find(e=>(e.sets||[]).some(s=>s.type!=='warmup'&&!s.done))||[...exercises].reverse().find(e=>(e.sets||[]).some(s=>s.done&&s.type!=='warmup'))||exercises[0]||null;
  }
  function updateLiveWorkoutIndicator(){
    const root=$('#live-workout-indicator');if(!root)return;
    const w=currentWorkout();if(!w){root.hidden=true;root.innerHTML='';return;}
    root.hidden=false;
    const elapsed=U.fmtDuration(Math.max(0,Date.now()-new Date(w.startAt).getTime()));
    const exercise=activeExerciseForLive(w),rest=state.activeWorkout.rest;
    const remaining=rest?Math.max(0,Math.ceil((rest.until-Date.now())/1000)):0;
    root.innerHTML=`<button type="button" class="live-workout-button" data-action="go-to-workout" aria-label="Перейти к активной тренировке"><span class="live-pulse"></span><span class="live-workout-copy"><b>${rest?'Отдых · '+formatSeconds(remaining):U.esc(exercise?.name||'Тренировка')}</b><small>${rest?'До конца отдыха':'Активная тренировка'} · ${elapsed}</small></span><span class="live-workout-time">${rest?formatSeconds(remaining):elapsed}</span></button>`;
  }
  function unlockRestAudio(){
    try{
      const AudioContextClass=window.AudioContext||window.webkitAudioContext;
      if(!AudioContextClass)return Promise.resolve(null);
      if(!restAudioContext)restAudioContext=new AudioContextClass();
      if(restAudioContext.state==='suspended')return restAudioContext.resume().catch(()=>restAudioContext);
      return Promise.resolve(restAudioContext);
    }catch(error){console.warn('Аудиосигнал отдыха недоступен:',error);return Promise.resolve(null);}
  }
  async function playRestEndSignal(){
    if(!state?.settings?.restSound)return;
    try{
      const ctx=restAudioContext||await unlockRestAudio();
      if(!ctx)return;
      if(ctx.state==='suspended')await ctx.resume().catch(()=>{});
      if(ctx.state!=='running')return;
      const start=ctx.currentTime+0.03;
      [880,1174].forEach((frequency,index)=>{
        const at=start+index*0.2,osc=ctx.createOscillator(),gain=ctx.createGain();
        osc.type='sine';osc.frequency.setValueAtTime(frequency,at);
        gain.gain.setValueAtTime(0.0001,at);gain.gain.exponentialRampToValueAtTime(0.16,at+0.025);gain.gain.exponentialRampToValueAtTime(0.0001,at+0.16);
        osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+0.18);
      });
    }catch(error){console.warn('Не удалось воспроизвести сигнал отдыха:',error);}
  }
function paintClocks(){
    syncRestTimer();
    const w=currentWorkout();if(!w){updateLiveWorkoutIndicator();return;}
    const elapsed=Math.max(0,Date.now()-new Date(w.startAt).getTime()),duration=U.fmtDuration(elapsed);
    $$('[data-workout-elapsed],[data-workout-duration]').forEach(x=>x.textContent=duration);
    if(state.activeWorkout.rest){
      const rest=state.activeWorkout.rest,remaining=Math.max(0,Math.ceil((rest.until-Date.now())/1000));
      const time=$('[data-rest-time]');if(time)time.textContent=formatSeconds(remaining);
      const ring=$('.rest-ring .progress');if(ring)ring.style.strokeDashoffset=119*(1-Math.min(1,remaining/(rest.duration||1)));
    }
    updateLiveWorkoutIndicator();
  }
  function handleChartPoint(ev){const point=ev.target.closest('[data-chart-point]');if(!point)return;const wrap=point.closest('[data-chart="line"]'),data=JSON.parse(wrap.dataset.chartData||'[]'),item=data[Number(point.dataset.chartPoint)];if(!item)return;const tip=$('.chart-tooltip',wrap);tip.textContent=`${item.label||item.date}: ${U.fmtNum(item.value)}${progressExercise==='all'?' кг':' кг'}`;tip.classList.remove('hidden');setTimeout(()=>tip.classList.add('hidden'),2400);}
  async function init(){
    state=await DB.load();if(!state.settings.weeklyTarget)state.settings.weeklyTarget=3;if(typeof state.settings.restSound!=='boolean')state.settings.restSound=true;
    U.setTheme(state.settings.theme);await DB.requestPersistence();
    if(state.activeWorkout?.workout&&!state.activeWorkout.workout.startAt)state.activeWorkout.workout.startAt=new Date().toISOString();
    if('serviceWorker' in navigator&&location.protocol!=='file:') navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(e=>console.warn('Service Worker не зарегистрирован:',e));
    render();setInterval(paintClocks,1000);
  }
  ['gesturestart','gesturechange','gestureend'].forEach(type=>document.addEventListener(type,ev=>ev.preventDefault(),{passive:false}));
  document.addEventListener('click',ev=>{
    const tabButton=ev.target.closest('[data-tab]');if(tabButton){const nextTab=tabButton.dataset.tab;if(nextTab!==tab){tab=nextTab;render(true);}return;}
    const el=ev.target.closest('[data-action]');if(el){handleAction(ev,el);return;}
    handleChartPoint(ev);
  });
  document.addEventListener('change',ev=>handleChange(ev.target));
  document.addEventListener('input',ev=>handleInput(ev.target));
  document.addEventListener('submit',ev=>{
    const id=ev.target.id;
    if(['exercise-form','block-form','program-form','add-session-form','measurement-form','body-goal-form','lift-goal-form','history-edit-form'].includes(id))ev.preventDefault();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncRestTimer();paintClocks();}});
  window.addEventListener('focus',()=>{syncRestTimer();paintClocks();});
  if(window.matchMedia){const media=window.matchMedia('(prefers-color-scheme: dark)');media.addEventListener?.('change',()=>{if(state?.settings?.theme==='system')U.setTheme('system');});}
  window.addEventListener('beforeinstallprompt',ev=>{ev.preventDefault();installPrompt=ev;});
  window.addEventListener('appinstalled',()=>{installPrompt=null;U.toast('Приложение установлено','success');});
  window.addEventListener('online',()=>{});window.addEventListener('offline',()=>{});
  init().catch(error=>{console.error(error);screen.innerHTML=`<div class="empty-state"><div class="empty-icon">${U.icon('info')}</div><h3>Не удалось открыть дневник</h3><p>${U.esc(error.message||'Ошибка локального хранилища')}</p><button class="btn primary" onclick="location.reload()">Перезагрузить</button></div>`;});
})();

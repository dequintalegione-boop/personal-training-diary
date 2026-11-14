(function () {
  'use strict';
  const U=window.TrainingUtils;
  const countKeys=['workouts','exercises','blocks','programs','measurements','records','achievements'];
  function exportJSON(state) {
    const payload={application:'personal-training-diary',formatVersion:1,createdAt:new Date().toISOString(),state};
    return new Blob([JSON.stringify(payload,null,2)],{type:'application/json;charset=utf-8'});
  }
  function parseJSON(text) {
    let payload; try{payload=JSON.parse(text);}catch(_){throw new Error('Файл не является корректным JSON.');}
    const state=payload?.state||payload;
    if(!state||typeof state!=='object'||(!Array.isArray(state.workouts)&&!Array.isArray(state.exercises))) throw new Error('В JSON не найдена резервная копия дневника.');
    return state;
  }
  function parseCell(value) {
    if(typeof value!=='string') return value;
    const s=value.trim();
    if((s.startsWith('{')&&s.endsWith('}'))||(s.startsWith('[')&&s.endsWith(']'))){try{return JSON.parse(s);}catch(_){return value;}}
    if(s==='true') return true; if(s==='false') return false; if(s!==''&&Number.isFinite(Number(s))) return Number(s); return value;
  }
  function rows(sheet) { return (sheet||[]).map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,parseCell(v)]))); }
  function fromSheets(sheets) {
    const get=(...names)=>{for(const n of names) if(sheets[n]) return rows(sheets[n]);return [];};
    const workouts=get('Тренировки','Workouts'); const sets=get('Подходы','Sets');
    const exercises=get('Упражнения','Exercises'); const blocks=get('Блоки','Blocks'); const programs=get('Программы','Programs');
    const measurements=get('Замеры','Measurements'); const goalsRows=get('Цели','Goals');
    workouts.forEach(w=>w.exercises=[]);
    const byId=new Map(workouts.map(w=>[String(w.id),w]));
    sets.forEach(s=>{const w=byId.get(String(s.workoutId));if(!w)return;let e=w.exercises.find(x=>String(x.exerciseId)===String(s.exerciseId));if(!e){e={exerciseId:s.exerciseId,name:s.exerciseName||'Упражнение',sets:[]};w.exercises.push(e);}e.sets.push({id:s.id,weight:Number(s.weight)||0,reps:Number(s.reps)||0,type:s.type||'work',done:s.done!==false&&s.done!=='false',tags:Array.isArray(s.tags)?s.tags:[],rpe:s.rpe===''?null:Number(s.rpe)||null,rir:s.rir===''?null:Number(s.rir)||null,note:s.note||'',restSeconds:Number(s.restSeconds)||null,createdAt:s.createdAt||''});});
    workouts.forEach(w=>w.exercises.forEach(e=>e.sets.sort((a,b)=>Number(a.setOrder||0)-Number(b.setOrder||0))));
    const goal={bodyWeight:null,lifts:[]};
    goalsRows.forEach(g=>{if(g.type==='bodyWeight')goal.bodyWeight={targetValue:Number(g.targetValue),startValue:Number(g.startValue)||null,startDate:g.startDate||'',deadline:g.deadline||'',note:g.note||''};else if(g.type==='lift')goal.lifts.push({...g,targetValue:Number(g.targetValue),targetReps:Number(g.targetReps)||1});});
    return {workouts,exercises,blocks,programs,measurements,goals:goal,settings:{}};
  }
  async function readFile(file) {
    const name=file.name.toLowerCase();
    if(name.endsWith('.json')) return parseJSON(await U.fileToText(file));
    if(name.endsWith('.xlsx')) return fromSheets(await window.TrainingXLSX.read(file));
    throw new Error('Поддерживаются резервные копии .json и таблицы .xlsx.');
  }
  function counts(state) { const out={}; countKeys.forEach(k=>out[k]=Array.isArray(state[k])?state[k].length:0); return out; }
  function validateState(state) {
    if(!state||typeof state!=='object') throw new Error('Пустой файл данных.');
    for(const k of ['workouts','exercises','blocks','programs','measurements']) if(state[k]!==undefined&&!Array.isArray(state[k])) throw new Error(`Некорректный раздел «${k}».`);
    (state.workouts||[]).forEach(w=>{if(!w.id||!/^\d{4}-\d{2}-\d{2}$/.test(w.date||'')) throw new Error('В одной из тренировок отсутствует ID или дата в формате ГГГГ-ММ-ДД.');});
    return true;
  }
  function mergeState(current,incoming,replace=false) {
    validateState(incoming);
    if(replace) return {...window.TrainingDB.defaults(),...incoming,settings:{...window.TrainingDB.defaults().settings,...(incoming.settings||{})},goals:{...window.TrainingDB.defaults().goals,...(incoming.goals||{})}};
    const next=JSON.parse(JSON.stringify(current));
    for(const key of countKeys){const existing=Array.isArray(next[key])?next[key]:[];const add=Array.isArray(incoming[key])?incoming[key]:[];const ids=new Set(existing.map(x=>String(x.id)));add.forEach(item=>{if(item.id&&!ids.has(String(item.id))){existing.push(item);ids.add(String(item.id));}});next[key]=existing;}
    next.settings={...next.settings,...(incoming.settings||{})};
    next.xp=Math.max(Number(next.xp)||0,Number(incoming.xp)||0);
    next.schedule={...(next.schedule||{}),...(incoming.schedule||{})};
    next.movedPlans={...(next.movedPlans||{}),...(incoming.movedPlans||{})};
    if(incoming.activeWorkout&&!next.activeWorkout)next.activeWorkout=incoming.activeWorkout;
    if(incoming.achievements)next.achievements=[...next.achievements,...incoming.achievements.filter(a=>!next.achievements.some(x=>x.id===a.id))];
    if(incoming.goals) next.goals={...next.goals,...incoming.goals,lifts:[...(next.goals.lifts||[]),...(incoming.goals.lifts||[])]};
    return next;
  }
  window.TrainingBackup={exportJSON,readFile,counts,validateState,mergeState};
})();

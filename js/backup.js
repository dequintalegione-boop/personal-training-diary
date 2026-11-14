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

  function coachSlug(value) {
    return String(value || '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72);
  }
  function normalizeExerciseName(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
  }
  function validateCoachDocument(doc) {
    if (!doc || doc.format !== 'personal-training-diary-coach-plan' || doc.version !== 1) {
      throw new Error('Неверный формат. Ожидается файл тренера personal-training-diary-coach-plan версии 1.');
    }
    if (!Array.isArray(doc.exercises) || !doc.exercises.length) throw new Error('В файле тренера нет библиотеки упражнений.');
    if (!Array.isArray(doc.programs) || !doc.programs.length) throw new Error('В файле тренера нет ни одной программы.');
    const exerciseIds = new Set();
    doc.exercises.forEach((ex, i) => {
      if (!ex || typeof ex.id !== 'string' || !coachSlug(ex.id) || !String(ex.name || '').trim()) throw new Error(`Проверь упражнение №${i + 1}: нужны уникальный id и название.`);
      if (exerciseIds.has(ex.id)) throw new Error(`Повторяется ID упражнения «${ex.id}».`);
      exerciseIds.add(ex.id);
      if (ex.muscles !== undefined && !Array.isArray(ex.muscles)) throw new Error(`Упражнение «${ex.name}»: muscles должен быть массивом.`);
      if (ex.stepKg !== undefined && (!Number.isFinite(Number(ex.stepKg)) || Number(ex.stepKg) <= 0)) throw new Error(`Упражнение «${ex.name}»: stepKg должен быть больше нуля.`);
      if (ex.restSeconds !== undefined && (!Number.isFinite(Number(ex.restSeconds)) || Number(ex.restSeconds) < 0)) throw new Error(`Упражнение «${ex.name}»: restSeconds должен быть неотрицательным числом.`);
    });
    const programIds = new Set();
    doc.programs.forEach((program, i) => {
      if (!program || typeof program.id !== 'string' || !coachSlug(program.id) || !String(program.name || '').trim()) throw new Error(`Проверь программу №${i + 1}: нужны id и name.`);
      if (programIds.has(program.id)) throw new Error(`Повторяется ID программы «${program.id}».`);
      programIds.add(program.id);
      if (!Array.isArray(program.days) || !program.days.length) throw new Error(`У программы «${program.name}» должен быть хотя бы один тренировочный день.`);
      program.days.forEach((day, di) => {
        if (!day || typeof day.id !== 'string' || !coachSlug(day.id) || !String(day.name || '').trim()) throw new Error(`Программа «${program.name}», день №${di + 1}: нужны id и name.`);
        if (day.weekday !== undefined && day.weekday !== null && (!Number.isInteger(Number(day.weekday)) || Number(day.weekday) < 0 || Number(day.weekday) > 6)) throw new Error(`День «${day.name}»: weekday должен быть числом от 0 до 6 или null.`);
        if (!Array.isArray(day.exercises) || !day.exercises.length) throw new Error(`День «${day.name}» не содержит упражнений.`);
        day.exercises.forEach(item => {
          if (!item || !exerciseIds.has(item.exerciseId)) throw new Error(`В дне «${day.name}» есть ссылка на неизвестное упражнение «${item?.exerciseId || ''}».`);
          const sets = Number(item.sets ?? 3), min = Number(item.repsMin ?? 8), max = Number(item.repsMax ?? min);
          if (!Number.isInteger(sets) || sets < 1 || sets > 20) throw new Error(`В «${day.name}» количество подходов должно быть от 1 до 20.`);
          if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 100) throw new Error(`В «${day.name}» некорректный диапазон повторов.`);
          if (item.startingWeightKg !== undefined && item.startingWeightKg !== null && (!Number.isFinite(Number(item.startingWeightKg)) || Number(item.startingWeightKg) < 0)) throw new Error(`В «${day.name}» некорректный startingWeightKg.`);
          if (item.warmupSets !== undefined && (!Number.isInteger(Number(item.warmupSets)) || Number(item.warmupSets) < 0 || Number(item.warmupSets) > 5)) throw new Error(`В «${day.name}» warmupSets должен быть от 0 до 5.`);
        });
      });
    });
    if (doc.blocks !== undefined && !Array.isArray(doc.blocks)) throw new Error('blocks должен быть массивом.');
    (doc.blocks || []).forEach((block, i) => {
      if (!block || typeof block.id !== 'string' || !coachSlug(block.id) || !String(block.name || '').trim() || !Array.isArray(block.items) || !block.items.length) throw new Error(`Проверь блок №${i + 1}: нужны id, name и items.`);
      block.items.forEach(item => {
        if (!exerciseIds.has(item.exerciseId)) throw new Error(`В блоке «${block.name}» неизвестное упражнение «${item.exerciseId}».`);
        const sets = Number(item.sets ?? 3), min = Number(item.repsMin ?? 8), max = Number(item.repsMax ?? min);
        if (!Number.isInteger(sets) || sets < 1 || sets > 20 || !Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 100) throw new Error(`В блоке «${block.name}» некорректны подходы или повторы.`);
      });
    });
    if (doc.liftGoals !== undefined && !Array.isArray(doc.liftGoals)) throw new Error('liftGoals должен быть массивом.');
    (doc.liftGoals || []).forEach(g => {
      if (!exerciseIds.has(g.exerciseId) || !Number.isFinite(Number(g.targetWeightKg)) || Number(g.targetWeightKg) <= 0 || !Number.isInteger(Number(g.targetReps || 1)) || Number(g.targetReps || 1) < 1) throw new Error('Одна из целей по рабочему весу заполнена некорректно.');
    });
    return true;
  }
  async function readCoachPlan(file) {
    let text;
    try { text = await U.fileToText(file); } catch (_) { throw new Error('Не удалось прочитать JSON-файл.'); }
    let doc;
    try { doc = JSON.parse(text); } catch (_) { throw new Error('Файл тренера содержит некорректный JSON.'); }
    validateCoachDocument(doc);
    const exercises = doc.exercises.map(ex => ({ ...ex }));
    const programs = doc.programs.map(program => ({ ...program }));
    const blocks = (doc.blocks || []).map(block => ({ ...block }));
    return { coachPlan: doc, workouts: [], exercises, blocks, programs, measurements: [], records: [], achievements: [], goals: { bodyWeight: null, lifts: [] }, settings: {} };
  }
  function mergeCoachPlan(current, incoming) {
    if (!incoming?.coachPlan) throw new Error('Не найдено содержимое программы тренера.');
    const doc = incoming.coachPlan;
    validateCoachDocument(doc);
    const next = JSON.parse(JSON.stringify(current));
    const now = new Date().toISOString();
    const added = { exercises: 0, programs: 0, blocks: 0, goals: 0 };
    const skipped = { programs: 0, blocks: 0, exercises: 0, goals: 0 };
    const exerciseMap = new Map();
    const existingByExternal = new Map((next.exercises || []).filter(x => x.externalId).map(x => [x.externalId, x]));
    const existingByName = new Map((next.exercises || []).map(x => [`${normalizeExerciseName(x.name)}|${String(x.equipment || '').toLowerCase()}`, x]));
    for (const source of doc.exercises) {
      const externalId = `coach:exercise:${source.id}`;
      const key = `${normalizeExerciseName(source.name)}|${String(source.equipment || '').toLowerCase()}`;
      const found = existingByExternal.get(externalId) || existingByName.get(key);
      if (found) {
        exerciseMap.set(source.id, found.id);
        skipped.exercises++;
        continue;
      }
      const exercise = {
        id: `coach-exercise-${coachSlug(source.id)}`,
        externalId,
        name: String(source.name).trim(),
        muscles: [...new Set((source.muscles || []).map(String).map(x => x.trim()).filter(Boolean))],
        equipment: String(source.equipment || 'Другое'),
        step: Number(source.stepKg) || Number(next.settings?.defaultStep) || 2.5,
        rest: Number(source.restSeconds) || Number(next.settings?.restSeconds) || 90,
        note: String(source.note || '').trim(), archived: false, createdAt: now,
        coachDescription: String(source.description || '').trim()
      };
      next.exercises.push(exercise);
      existingByExternal.set(externalId, exercise);
      existingByName.set(key, exercise);
      exerciseMap.set(source.id, exercise.id);
      added.exercises++;
    }
    for (const block of (doc.blocks || [])) {
      const externalId = `coach:block:${block.id}`;
      if ((next.blocks || []).some(x => x.externalId === externalId)) { skipped.blocks++; continue; }
      const items = block.items.map(item => ({ exerciseId: exerciseMap.get(item.exerciseId), sets: Number(item.sets) || 3, repsMin: Number(item.repsMin) || 8, repsMax: Number(item.repsMax) || Number(item.repsMin) || 8 }));
      next.blocks.push({ id: `coach-block-${coachSlug(block.id)}`, externalId, name: String(block.name).trim(), note: String(block.note || '').trim(), items, createdAt: now });
      added.blocks++;
    }
    for (const program of doc.programs) {
      const externalId = `coach:program:${program.id}`;
      if ((next.programs || []).some(x => x.externalId === externalId)) { skipped.programs++; continue; }
      const days = program.days.map(day => ({
        id: `coach-day-${coachSlug(program.id)}-${coachSlug(day.id)}`,
        name: String(day.name).trim(),
        weekday: day.weekday === undefined || day.weekday === null ? null : Number(day.weekday),
        items: day.exercises.map(item => ({
          exerciseId: exerciseMap.get(item.exerciseId),
          sets: Number(item.sets) || 3,
          repsMin: Number(item.repsMin) || 8,
          repsMax: Number(item.repsMax) || Number(item.repsMin) || 8,
          startingWeightKg: item.startingWeightKg === undefined ? null : Number(item.startingWeightKg),
          warmupSets: Number(item.warmupSets) || 0,
          note: String(item.note || '').trim()
        }))
      }));
      next.programs.push({ id: `coach-program-${coachSlug(program.id)}`, externalId, name: String(program.name).trim(), description: String(program.description || '').trim(), days, createdAt: now, source: 'ai-coach' });
      added.programs++;
    }
    if (!next.goals) next.goals = { bodyWeight: null, lifts: [] };
    if (!Array.isArray(next.goals.lifts)) next.goals.lifts = [];
    for (const goal of (doc.liftGoals || [])) {
      const externalId = `coach:goal:${goal.id || `${goal.exerciseId}-${goal.targetWeightKg}-${goal.targetReps || 1}`}`;
      if (next.goals.lifts.some(x => x.externalId === externalId)) { skipped.goals++; continue; }
      const exerciseId = exerciseMap.get(goal.exerciseId);
      const source = doc.exercises.find(x => x.id === goal.exerciseId);
      next.goals.lifts.push({ id: `coach-goal-${coachSlug(goal.id || externalId)}`, externalId, exerciseId, exerciseName: source?.name || 'Упражнение', targetValue: Number(goal.targetWeightKg), targetReps: Number(goal.targetReps) || 1, deadline: goal.deadline || '', active: true, note: String(goal.note || '') });
      added.goals++;
    }
    return { state: next, added, skipped };
  }

  window.TrainingBackup={exportJSON,readFile,readCoachPlan,counts,validateState,mergeState,mergeCoachPlan,validateCoachDocument};
})()

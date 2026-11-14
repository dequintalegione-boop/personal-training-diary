/* Minimal self-contained XLSX writer/reader: ZIP STORE writer + ZIP STORE/DEFLATE reader. */
(function () {
  'use strict';
  const enc = new TextEncoder(), dec = new TextDecoder();
  const TABLES = [
    ['Тренировки','workouts',['id','date','title','startAt','endAt','duration','volume','sourceProgram','notes']],
    ['Подходы','sets',['id','workoutId','exerciseId','exerciseName','exerciseOrder','setOrder','weight','reps','type','done','tags','rpe','rir','note','restSeconds','createdAt']],
    ['Упражнения','exercises',['id','name','muscles','equipment','step','rest','note','archived','createdAt']],
    ['Блоки','blocks',['id','name','items','note','createdAt']],
    ['Программы','programs',['id','name','days','note','createdAt']],
    ['Замеры','measurements',['id','date','type','value','unit','note','createdAt']],
    ['Цели','goals',['id','type','exerciseId','exerciseName','targetValue','targetReps','startValue','startDate','deadline','note','active']]
  ];
  const xmlEsc = v => String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
  function crc32(bytes) {
    let crc=-1;
    for (let i=0;i<bytes.length;i++) { crc^=bytes[i]; for(let j=0;j<8;j++) crc=(crc>>>1)^((crc&1)?0xEDB88320:0); }
    return (crc^-1)>>>0;
  }
  function u16(view, offset, value) { view.setUint16(offset,value,true); }
  function u32(view, offset, value) { view.setUint32(offset,value>>>0,true); }
  function zipStore(files) {
    const locals=[], centrals=[]; let offset=0;
    for (const file of files) {
      const name=enc.encode(file.name), data=typeof file.data==='string'?enc.encode(file.data):file.data, crc=crc32(data);
      const local=new Uint8Array(30+name.length+data.length), lv=new DataView(local.buffer);
      u32(lv,0,0x04034b50); u16(lv,4,20); u16(lv,6,0x0800); u16(lv,8,0); u16(lv,10,0); u16(lv,12,33);
      u32(lv,14,crc); u32(lv,18,data.length); u32(lv,22,data.length); u16(lv,26,name.length); u16(lv,28,0);
      local.set(name,30); local.set(data,30+name.length); locals.push(local);
      const central=new Uint8Array(46+name.length), cv=new DataView(central.buffer);
      u32(cv,0,0x02014b50); u16(cv,4,20); u16(cv,6,20); u16(cv,8,0x0800); u16(cv,10,0); u16(cv,12,0); u16(cv,14,33);
      u32(cv,16,crc); u32(cv,20,data.length); u32(cv,24,data.length); u16(cv,28,name.length); u16(cv,30,0); u16(cv,32,0); u16(cv,34,0); u16(cv,36,0); u32(cv,38,0); u32(cv,42,offset);
      central.set(name,46); centrals.push(central); offset+=local.length;
    }
    const centralSize=centrals.reduce((s,x)=>s+x.length,0), end=new Uint8Array(22), ev=new DataView(end.buffer);
    u32(ev,0,0x06054b50); u16(ev,4,0); u16(ev,6,0); u16(ev,8,files.length); u16(ev,10,files.length); u32(ev,12,centralSize); u32(ev,16,offset); u16(ev,20,0);
    return new Blob([...locals,...centrals,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function colName(n) { let s=''; for(n++;n;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; }
  function cellXml(value, ref) {
    if (value === null || value === undefined || value === '') return `<c r="${ref}"/>`;
    if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}"><v>${value}</v></c>`;
    if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value?1:0}</v></c>`;
    let text=typeof value==='string'?value:JSON.stringify(value);
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(text)}</t></is></c>`;
  }
  function sheetXml(headers, rows) {
    const all=[headers,...rows];
    const body=all.map((row,r)=>`<row r="${r+1}">${row.map((v,c)=>cellXml(v,`${colName(c)}${r+1}`)).join('')}</row>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><sheetData>${body}</sheetData><autoFilter ref="A1:${colName(headers.length-1)}${all.length}"/></worksheet>`;
  }
  function flattenState(state) {
    const rows={};
    rows.workouts=state.workouts.map(w=>({id:w.id,date:w.date,title:w.title||'',startAt:w.startAt||'',endAt:w.endAt||'',duration:w.duration||0,volume:w.volume||0,sourceProgram:w.sourceProgram||'',notes:w.notes||''}));
    rows.sets=[];
    state.workouts.forEach(w=>(w.exercises||[]).forEach((e,ei)=>(e.sets||[]).forEach((s,si)=>rows.sets.push({id:s.id||`${w.id}-${e.exerciseId}-${si}`,workoutId:w.id,exerciseId:e.exerciseId,exerciseName:e.name||e.exerciseName||'',exerciseOrder:ei+1,setOrder:si+1,weight:s.weight??0,reps:s.reps??0,type:s.type||'work',done:s.done!==false,tags:s.tags||[],rpe:s.rpe??'',rir:s.rir??'',note:s.note||'',restSeconds:s.restSeconds??'',createdAt:s.createdAt||''}))));
    rows.exercises=state.exercises.map(e=>({...e,muscles:e.muscles||[]}));
    rows.blocks=state.blocks.map(b=>({...b})); rows.programs=state.programs.map(p=>({...p}));
    rows.measurements=state.measurements.map(m=>({...m}));
    const goals=[];
    if(state.goals?.bodyWeight) goals.push({id:'goal-body-weight',type:'bodyWeight',targetValue:state.goals.bodyWeight.targetValue,startValue:state.goals.bodyWeight.startValue||'',startDate:state.goals.bodyWeight.startDate||'',deadline:state.goals.bodyWeight.deadline||'',active:true,note:state.goals.bodyWeight.note||''});
    (state.goals?.lifts||[]).forEach(g=>goals.push({...g,type:'lift',active:g.active!==false}));
    rows.goals=goals;
    return rows;
  }
  async function write(state) {
    const tableRows=flattenState(state); const files=[];
    const types=TABLES.map((t,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('');
    files.push({name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${types}</Types>`});
    files.push({name:'_rels/.rels',data:'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'});
    const sheets=TABLES.map((t,i)=>`<sheet name="${xmlEsc(t[0])}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('');
    files.push({name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`});
    files.push({name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${TABLES.map((t,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`});
    TABLES.forEach((t,i)=>{
      const headers=t[2], rows=(tableRows[t[1]]||[]).map(item=>headers.map(k=>item[k]??''));
      files.push({name:`xl/worksheets/sheet${i+1}.xml`,data:sheetXml(headers,rows)});
    });
    return zipStore(files);
  }
  async function unzip(arrayBuffer) {
    const bytes=new Uint8Array(arrayBuffer), view=new DataView(arrayBuffer); let eocd=-1;
    for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65558);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}
    if(eocd<0) throw new Error('Файл не похож на XLSX (не найден ZIP-каталог).');
    const total=view.getUint16(eocd+10,true), cdOffset=view.getUint32(eocd+16,true); let p=cdOffset; const entries={};
    for(let i=0;i<total;i++){
      if(view.getUint32(p,true)!==0x02014b50) throw new Error('Повреждён ZIP-каталог XLSX.');
      const method=view.getUint16(p+10,true), compSize=view.getUint32(p+20,true), nameLen=view.getUint16(p+28,true), extraLen=view.getUint16(p+30,true), commentLen=view.getUint16(p+32,true), localOffset=view.getUint32(p+42,true);
      const name=dec.decode(bytes.slice(p+46,p+46+nameLen)); const lp=localOffset;
      const localName=view.getUint16(lp+26,true), localExtra=view.getUint16(lp+28,true), dataStart=lp+30+localName+localExtra;
      let data=bytes.slice(dataStart,dataStart+compSize);
      if(method===8){
        if(!('DecompressionStream' in window)) throw new Error('Этот браузер не поддерживает распаковку сжатых XLSX. Попробуйте импортировать JSON-копию.');
        const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        data=new Uint8Array(await new Response(stream).arrayBuffer());
      } else if(method!==0) throw new Error(`Неизвестный алгоритм ZIP (${method}).`);
      entries[name]=dec.decode(data); p+=46+nameLen+extraLen+commentLen;
    }
    return entries;
  }
  function parseSheet(xml, sharedStrings=[]) {
    const doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('Не удалось разобрать лист XLSX.');
    const rows=[...doc.getElementsByTagName('row')].map(row=>{
      const vals=[]; [...row.getElementsByTagName('c')].forEach(cell=>{
        const ref=cell.getAttribute('r')||'A1', letters=ref.match(/[A-Z]+/)[0]; let col=0;
        for(const ch of letters) col=col*26+ch.charCodeAt(0)-64; col--;
        let val=''; const type=cell.getAttribute('t');
        if(type==='inlineStr') val=cell.getElementsByTagName('t')[0]?.textContent||'';
        else if(type==='s') { const idx=Number(cell.getElementsByTagName('v')[0]?.textContent||0); val=sharedStrings[idx]??''; }
        else { const raw=cell.getElementsByTagName('v')[0]?.textContent||''; val=type==='b'?raw==='1':(raw!==''&&Number.isFinite(Number(raw))?Number(raw):raw); }
        vals[col]=val;
      }); return vals;
    });
    if(!rows.length) return [];
    const headers=rows[0].map(String);
    return rows.slice(1).filter(r=>r.some(v=>v!==undefined&&v!=='')).map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]??''])));
  }
  async function read(file) {
    const entries=await unzip(await file.arrayBuffer());
    if(!entries['xl/workbook.xml']) throw new Error('В книге не найден workbook.xml.');
    const wb=new DOMParser().parseFromString(entries['xl/workbook.xml'],'application/xml');
    const rels=new DOMParser().parseFromString(entries['xl/_rels/workbook.xml.rels'],'application/xml');
    const targets={}; [...rels.getElementsByTagName('Relationship')].forEach(r=>targets[r.getAttribute('Id')]=r.getAttribute('Target'));
    const sharedStrings=[];if(entries['xl/sharedStrings.xml']){const ss=new DOMParser().parseFromString(entries['xl/sharedStrings.xml'],'application/xml');[...ss.getElementsByTagName('si')].forEach(si=>sharedStrings.push([...si.getElementsByTagName('t')].map(t=>t.textContent||'').join('')));}
    const result={}; [...wb.getElementsByTagName('sheet')].forEach(sheet=>{
      const name=sheet.getAttribute('name'), rid=sheet.getAttribute('r:id')||sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id');
      let target=targets[rid]||''; target=target.replace(/^\//,''); if(!target.startsWith('xl/')) target='xl/'+target;
      if(entries[target]) result[name]=parseSheet(entries[target],sharedStrings);
    });
    return result;
  }
  window.TrainingXLSX={write,read,TABLES};
})();

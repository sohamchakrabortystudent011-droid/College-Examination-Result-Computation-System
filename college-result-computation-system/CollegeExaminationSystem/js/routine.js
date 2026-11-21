/* =============================================================
   routine.js — Examination Routine Management (all roles)
   Admin  : create/upload/edit/preview/publish/delete routines
            (PDF or image upload stored as IndexedDB Blob, or a
            fully manual entry builder with dates/times/rooms).
   Teacher/Student : read-only views of published routines,
            filtered to their assigned/relevant semesters.
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  if(page!=='routine') return;
  const role=document.body.dataset.role;
  if(role==='admin') initAdminRoutines();
  else initRoutineViewer(role);
});

const ROUTINE_EXAM_TYPES=['End Semester','Mid Semester','Internal Assessment','Supplementary','Backlog'];
const semTypeOf = num => (num%2===1?'Odd':'Even');
const ACCEPTED_ROUTINE_TYPES=['application/pdf','image/png','image/jpeg','image/jpg','image/webp'];

/* small shared card renderer */
function routineCardHtml(r, actionsHtml){
  const upcoming=(r.entries||[]).filter(e=>e.date>=new Date().toISOString().slice(0,10)).sort((a,b)=>a.date.localeCompare(b.date))[0];
  return `<div class="routine-card">
    <div class="rc-top">
      <div class="flex items-center justify-between">
        <span class="sem-badge ${r.semesterType.toLowerCase()}">${r.semesterType} · ${esc(r.semesterName)}</span>
        ${UI.statusBadge(r.status)}
      </div>
      <h3>${esc(r.title)}</h3>
      <div class="rc-meta">
        <span>${icon('calendar',13)} ${esc(r.academicYear)}</span>
        <span>${icon('building',13)} ${esc(r.department)}</span>
        <span>${icon('clipboard',13)} ${esc(r.examType)}</span>
      </div>
    </div>
    <div class="rc-body">
      <p class="rc-mini"><b>${(r.entries||[]).length} exam slot(s)</b> · ${r.fileBlob?`<span class="file-flag">${icon('file',12)} ${esc(r.fileName||'Uploaded file')}</span>`:'Manual routine'}</p>
      ${upcoming?`<p class="rc-mini mt-6">Next exam: <b>${esc(upcoming.subjectCode)}</b> — ${fmtDate(upcoming.date)}, ${fmtTime(upcoming.startTime)}</p>
      `:'<p class="rc-mini mt-6 muted">No upcoming slots (dates elapsed or unscheduled).</p>'}
    </div>
    <div class="rc-foot">${actionsHtml}</div>
  </div>`;
}

/* ---------- preview modal (shared) ---------- */
async function openRoutinePreview(r, adminActions=true){
  const college=(await DB.get('settings','college'))||{name:'West Bengal State University'};
  const entries=(r.entries||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const ov=UI.modal(`
    ${UI.modalHead(esc(r.title))}
    <div class="modal-body">
      <div class="kv mb-14">
        <div><span>Academic Year</span><b>${esc(r.academicYear)}</b></div>
        <div><span>Session</span><b>${esc(r.session)}</b></div>
        <div><span>Department</span><b>${esc(r.department)}</b></div>
        <div><span>Course</span><b>${esc(r.course)}</b></div>
        <div><span>Semester</span><b>${esc(r.semesterName)} (${r.semesterType})</b></div>
        <div><span>Examination Type</span><b>${esc(r.examType)}</b></div>
      </div>
      ${entries.length?`<div class="table-wrap mb-14"><table class="data-table compact">
        <thead><tr><th>Subject Code</th><th>Subject Name</th><th>Examination Date</th><th>Time</th><th>Room</th></tr></thead>
        <tbody>${entries.map(e=>`<tr><td><b>${esc(e.subjectCode)}</b></td><td>${esc(e.subjectName)}</td><td>${fmtDate(e.date)}</td><td>${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}</td><td>${esc(e.room||'—')}</td></tr>`).join('')}</tbody></table></div>`:''}
      ${r.instructions?`<div class="alert info" style="white-space:pre-line">${icon('info')}<div><b>Instructions</b><br>${esc(r.instructions)}</div></div>`:''}
      <div id="filePreview" class="mt-14"></div>
    </div>
    <div class="modal-foot">
      ${r.fileBlob?`<button class="btn btn-outline" id="dlBtn">${icon('download')} Download File</button>`:''}
      <button class="btn btn-outline" id="printBtn">${icon('printer')} Print Routine</button>
      <span class="grow"></span>
      ${adminActions?`<button class="btn ${r.status==='published'?'btn-warning':'btn-success'}" id="pubBtn">${r.status==='published'?'Unpublish':'Publish'}</button>`:''}
    </div>`,'xl');

  /* file blob preview stored in IndexedDB */
  if(r.fileBlob){
    const url=URL.createObjectURL(r.fileBlob);
    const host=ov.querySelector('#filePreview');
    host.innerHTML= r.fileType==='application/pdf'
      ? `<iframe class="preview-frame" src="${url}" title="Routine PDF preview"></iframe>`
      : `<img class="preview-img" src="${url}" alt="Routine image">`;
    ov.querySelector('#dlBtn').addEventListener('click',()=>{
      const a=document.createElement('a'); a.href=url; a.download=r.fileName||'examination-routine'; a.click();
    });
  }
  ov.querySelector('#printBtn').addEventListener('click',()=>printRoutine(r,college));
  if(adminActions){
    ov.querySelector('#pubBtn').addEventListener('click',async()=>{
      await toggleRoutinePublication(r);
      UI.closeModal(ov); refreshRoutinePage();
    });
  }
}

/* self-contained print document (own window — reliable printing) */
function printRoutine(r,college){
  const entries=(r.entries||[]).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const w=window.open('','_blank','width=900,height=700');
  w.document.write(`<!DOCTYPE html><html><head><title>${esc(r.title)}</title><style>
    body{font-family:"Segoe UI",Arial,sans-serif;color:#15203a;padding:32px 40px}
    .hd{text-align:center;border-bottom:2.5px solid #0a1f44;padding-bottom:12px;margin-bottom:16px}
    .hd h2{margin:0;font-size:20px;text-transform:uppercase;color:#0a1f44}
    .hd h3{margin:6px 0 2px;font-size:15px}.hd p{margin:0;font-size:12px;color:#55628a}
    .meta{font-size:12.5px;margin-bottom:12px;color:#33405e}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border:1px solid #b9c2d4;padding:8px 10px;text-align:left}
    th{background:#eef2fa;color:#0a1f44;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
    .notes{margin-top:14px;font-size:12px;border:1px dashed #b9c2d4;border-radius:8px;padding:10px 12px;white-space:pre-line}
    .sign{display:flex;justify-content:space-between;margin-top:80px;font-size:12px;text-align:center}
    .sign span{border-top:1px solid #33405e;padding-top:6px;min-width:170px;display:inline-block}
    @page{size:A4;margin:14mm}
  </style></head><body>
    <div class="hd"><h2>${esc(college.name)}</h2><h3>${esc(r.title)}</h3>
      <p>${esc(college.address||'')}</p></div>
    <div class="meta"><b>Academic Year:</b> ${esc(r.academicYear)} &nbsp;·&nbsp; <b>Session:</b> ${esc(r.session)} &nbsp;·&nbsp; <b>Department:</b> ${esc(r.department)} &nbsp;·&nbsp; <b>Course:</b> ${esc(r.course)} &nbsp;·&nbsp; <b>Semester:</b> ${esc(r.semesterName)} (${r.semesterType}) &nbsp;·&nbsp; <b>Type:</b> ${esc(r.examType)}</div>
    <table><thead><tr><th>Subject Code</th><th>Subject Name</th><th>Examination Date</th><th>Time</th><th>Room</th></tr></thead>
    <tbody>${entries.map(e=>`<tr><td>${esc(e.subjectCode)}</td><td>${esc(e.subjectName)}</td><td>${fmtDate(e.date)}</td><td>${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}</td><td>${esc(e.room||'—')}</td></tr>`).join('')}</tbody></table>
    ${r.instructions?`<div class="notes"><b>Instructions:</b>\n${esc(r.instructions)}</div>`:''}
    <div class="sign"><span>Examination Superintendent</span><span>Controller of Examinations</span></div>
    <script>window.onload=()=>{window.print();}<\/script></body></html>`);
  w.document.close();
}

async function toggleRoutinePublication(r){
  r.status = r.status==='published' ? 'draft' : 'published';
  r.publishedAt = r.status==='published' ? new Date().toISOString() : r.publishedAt;
  r.updatedAt = new Date().toISOString();
  await DB.put('examinationRoutines',r);
  await DB.log('Admin', r.status==='published'?'Routine published':'Routine unpublished', r.title);
  if(r.status==='published'){
    await Notify.pushStudents({title:'Examination routine published',message:`${r.title} — check your exam dates and venues.`,
      type:'info',link:'examination-routine.html',departmentId:r.departmentId,semester:r.semester});
    await Notify.pushTeachers({title:'New examination routine',message:`${r.title} has been published.`,
      type:'info',link:'examination-routine.html',semesterId:r.semesterId,departmentId:r.departmentId});
    window.refreshBell && refreshBell();
  }
  UI.toast(r.status==='published'?'Routine published':'Routine unpublished', r.title, r.status==='published'?'success':'warning');
}
function refreshRoutinePage(){ window._repaintRoutines && window._repaintRoutines(); }

/* =============================================================
   ADMIN — full management view
   ============================================================= */
async function initAdminRoutines(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const state={tab:'all',year:'',sem:'',dept:'',q:''};

  const paint=async()=>{
    const [routines,depts]=await Promise.all([DB.getAll('examinationRoutines'),DB.getAll('departments')]);
    let list=routines;
    if(state.tab!=='all') list=list.filter(r=>r.semesterType===state.tab);
    if(state.year) list=list.filter(r=>r.academicYear===state.year);
    if(state.sem) list=list.filter(r=>r.semester===+state.sem);
    if(state.dept) list=list.filter(r=>r.departmentId===+state.dept);
    if(state.q){ const q=state.q.toLowerCase(); list=list.filter(r=>r.title.toLowerCase().includes(q)); }
    list.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));

    const years=[...new Set(routines.map(r=>r.academicYear))].sort().reverse();
    pg.querySelector('#filters').innerHTML=`
      <div class="pill-tabs">
        ${['all','Odd','Even'].map(t=>`<button class="${state.tab===t?'active':''}" data-tab="${t}">${t==='all'?'All Routines':t+' Semesters'}</button>`).join('')}
      </div>
      <span class="spacer"></span>
      <div class="search-box">${icon('search')}<input id="q" placeholder="Search routine title…" value="${esc(state.q)}"></div>
      <select id="fYear"><option value="">All Academic Years</option>${years.map(y=>`<option ${state.year===y?'selected':''}>${esc(y)}</option>`).join('')}</select>
      <select id="fDept"><option value="">All Departments</option>${depts.map(d=>`<option value="${d.id}" ${+state.dept===d.id?'selected':''}>${esc(d.code||d.name)}</option>`).join('')}</select>
      <select id="fSem"><option value="">All Semesters</option>${SEM_NAMES.map((n,i)=>`<option value="${i+1}" ${+state.sem===i+1?'selected':''}>${n}</option>`).join('')}</select>`;
    pg.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ state.tab=b.dataset.tab; paint(); }));
    pg.querySelector('#q').addEventListener('input',e=>{ state.q=e.target.value; paintList(); });
    pg.querySelector('#fYear').addEventListener('change',e=>{ state.year=e.target.value; paint(); });
    pg.querySelector('#fDept').addEventListener('change',e=>{ state.dept=e.target.value; paint(); });
    pg.querySelector('#fSem').addEventListener('change',e=>{ state.sem=e.target.value; paint(); });
    paintList();

    async function paintList(){
      let l=await DB.getAll('examinationRoutines');
      if(state.tab!=='all') l=l.filter(r=>r.semesterType===state.tab);
      if(state.year) l=l.filter(r=>r.academicYear===state.year);
      if(state.sem) l=l.filter(r=>r.semester===+state.sem);
      if(state.dept) l=l.filter(r=>r.departmentId===+state.dept);
      if(state.q){ const q=state.q.toLowerCase(); l=l.filter(r=>r.title.toLowerCase().includes(q)); }
      l.sort((a,b)=>(b.updatedAt||'').localeCompare(a.updatedAt||''));
      pg.querySelector('#list').innerHTML = l.length
        ? `<div class="routine-grid">${l.map(r=>routineCardHtml(r,`
            <button class="btn btn-sm btn-soft" data-preview="${r.id}">${icon('eye',14)} Preview</button>
            <button class="btn btn-sm btn-outline" data-edit="${r.id}">${icon('edit',14)} Edit</button>
            <button class="btn btn-sm ${r.status==='published'?'btn-warning':'btn-success'}" data-pub="${r.id}">${r.status==='published'?'Unpublish':'Publish'}</button>
            <button class="icon-btn danger" data-del="${r.id}" title="Delete">${icon('trash')}</button>`)).join('')}</div>`
        : UI.emptyState('No routines found','Use “New Routine” to upload a PDF/image or build one manually.','calendarDays');
      bindList();
    }
    function bindList(){
      pg.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',async()=>openRoutinePreview(await DB.get('examinationRoutines',+b.dataset.preview),true)));
      pg.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>routineFormModal(await DB.get('examinationRoutines',+b.dataset.edit),paint)));
      pg.querySelectorAll('[data-pub]').forEach(b=>b.addEventListener('click',async()=>{ await toggleRoutinePublication(await DB.get('examinationRoutines',+b.dataset.pub)); paint(); }));
      pg.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
        const r=await DB.get('examinationRoutines',+b.dataset.del);
        if(await UI.confirm('Delete routine',`Delete “${r.title}”? This cannot be undone.`)){
          await DB.del('examinationRoutines',r.id); await DB.log('Admin','Routine deleted',r.title);
          UI.toast('Routine deleted',r.title,'success'); paint();
        }
      }));
    }
    pg.dataset.refresh='1';
  };

  pg.innerHTML=`
    <div class="page-head"><div><h1>Examination Routine Management</h1><p>Upload or build routines per academic year and semester. Published routines are instantly visible to the relevant students and teachers.</p></div>
    <div class="page-actions"><button class="btn btn-royal" id="newBtn" data-refresh onclick="void(0)">${icon('plus')} New Routine</button></div></div>
    <div class="toolbar" id="filters"></div>
    <div id="list">${UI.spinner()}</div>`;
    pg.querySelector('#newBtn').addEventListener('click',()=>routineFormModal(null,paint));
  window._repaintRoutines=paint;
  paint();
}

/* ---------- create / edit routine modal ---------- */
async function routineFormModal(r,onDone){
  const [sessions,depts,courses,sems,subjects]=await Promise.all([
    DB.getAll('academicSessions'),DB.getAll('departments'),DB.getAll('courses'),DB.getAll('semesters'),DB.getAll('subjects')]);
  let fileBlob=r?.fileBlob||null, fileName=r?.fileName||null, fileType=r?.fileType||null;
  let mode=r&&r.fileBlob?'upload':'manual';
  let entries=(r?.entries||[]).map(e=>({...e}));

  const ov=UI.modal(`${UI.modalHead(r?'Edit Routine':'New Examination Routine')}
      <div class="modal-body">
      ${UI.dateLists()}
      <div class="form-error" id="rErr" style="display:none"><span></span></div>
      <div class="form-grid mb-14">
        <div class="field span-2"><label>Routine Title <span class="req">*</span></label><input id="rTitle" value="${esc(r?.title||'')}" placeholder="e.g. 2026–2027 Odd Semester Examination Routine"></div>
        <div class="field"><label>Academic Year <span class="req">*</span></label><input id="rYear" value="${esc(r?.academicYear||'')}" placeholder="e.g. 2026–2027" list="yearList"><datalist id="yearList">${sessions.map(s=>`<option value="${esc(s.name)}">`).join('')}</datalist></div>
        <div class="field"><label>Academic Session <span class="req">*</span></label><select id="rSession">${sessions.map(s=>`<option value="${s.id}" ${r&&r.sessionId===s.id?'selected':''}>${esc(s.name)} (${s.status})</option>`).join('')}</select></div>
        <div class="field"><label>Department <span class="req">*</span></label><select id="rDept"><option value="">Select</option>${optRows(depts,r?.departmentId)}</select></div>
        <div class="field"><label>Course <span class="req">*</span></label><select id="rCourse"><option value="">Select department first</option></select></div>
        <div class="field"><label>Semester <span class="req">*</span></label><select id="rSem">${sems.map(s=>`<option value="${s.id}" data-num="${s.number}" ${r&&r.semesterId===s.id?'selected':''}>${s.name}</option>`).join('')}</select></div>
        <div class="field"><label>Semester Type (auto)</label><input id="rType" disabled></div>
        <div class="field span-2"><label>Examination Type</label><select id="rExamType">${ROUTINE_EXAM_TYPES.map(t=>`<option ${r?.examType===t?'selected':''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="seg mb-14">
        <button type="button" id="segManual" class="${mode==='manual'?'active':''}">${icon('pen',15)} Build Manually</button>
        <button type="button" id="segUpload" class="${mode==='upload'?'active':''}">${icon('upload',15)} Upload PDF / Image</button>
      </div>
      <div id="manualPane" class="${mode==='manual'?'':'hidden'}">
        <div class="entry-row entry-head"><span>Subject Code</span><span>Subject Name</span><span>Exam Date — DD / Month / YYYY</span><span>Start</span><span>End</span><span>Room</span><span></span></div>
        <div id="entryRows"></div>
        <button class="btn btn-sm btn-soft mt-6" id="addEntry">${icon('plus',14)} Add Exam Slot</button>
        <div class="field mt-14"><label>Examination Instructions</label><textarea id="rNotes" placeholder="Guidelines shown to students on the routine…">${esc(r?.instructions||'')}</textarea></div>
      </div>
      <div id="uploadPane" class="${mode==='upload'?'':'hidden'}">
        <div class="drop-zone" id="dz">${icon('upload',34)}<b>Click or drop the routine file here</b><p>PDF, PNG, JPG or WebP · maximum 5 MB · stored as a Blob in IndexedDB</p>
          <input type="file" id="dzFile" accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"></div>
        <div id="fileHolder" class="mt-14"></div>
        <p class="help muted mt-10">You may also add the entry table manually above — both can be saved together (e.g. official scanned notice + searchable slots).</p>
      </div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Cancel</button>
      <button class="btn btn-outline" id="saveDraft">${icon('check')} ${r&&r.status==='published'?'Save Changes':'Save as Draft'}</button>
      <button class="btn btn-success" id="savePub">${icon('send')} ${r&&r.status==='published'?'Save & Keep Published':'Save & Publish'}</button>
    </div>`,'xl');

  /* dynamic selects */
  const deptSel=ov.querySelector('#rDept'), courseSel=ov.querySelector('#rCourse'), semSel=ov.querySelector('#rSem');
  const fillCourses=sel=>{ courseSel.innerHTML='<option value="">Select</option>'+courses.filter(c=>c.departmentId===+deptSel.value).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join(''); };
  deptSel.addEventListener('change',()=>{ fillCourses(); paintEntries(); });
  if(r?.departmentId){ fillCourses(r.courseId); }
  const syncType=()=>{ const num=+semSel.selectedOptions[0].dataset.num; ov.querySelector('#rType').value=semTypeOf(num); };
  semSel.addEventListener('change',()=>{ syncType(); paintEntries(); }); syncType();

  /* mode segments */
  const setMode=m=>{ mode=m;
    ov.querySelector('#segManual').classList.toggle('active',m==='manual');
    ov.querySelector('#segUpload').classList.toggle('active',m==='upload');
    ov.querySelector('#manualPane').classList.toggle('hidden',m!=='manual');
    ov.querySelector('#uploadPane').classList.toggle('hidden',m!=='upload'); };
  ov.querySelector('#segManual').addEventListener('click',()=>setMode('manual'));
  ov.querySelector('#segUpload').addEventListener('click',()=>setMode('upload'));

  /* entries editor */
  const rowsHost=ov.querySelector('#entryRows');
  const subjectChoices=()=>subjects.filter(s=>s.departmentId===+deptSel.value&&s.semesterId===+semSel.value);
  function paintEntries(){
    rowsHost.innerHTML='';
    entries.forEach((e,i)=>rowsHost.appendChild(entryRow(e,i)));
    if(!entries.length) rowsHost.innerHTML='<p class="muted small" id="noSlots">No slots yet — click “Add Exam Slot”.</p>';
  }
  function entryRow(e,i){
    const div=document.createElement('div'); div.className='entry-row';
    const subs=subjectChoices();
    const parts=(e.date||'').split('-');
    const dd=parts[2]?+parts[2]:'', yy=parts[0]||'', mm=parts[1]?(MONTH_NAMES[+parts[1]-1]||''):'';
    div.innerHTML=`
      <input list="subList" placeholder="Code" value="${esc(e.subjectCode||'')}" data-f="subjectCode">
      <input list="subList" placeholder="Subject name" value="${esc(e.subjectName||'')}" data-f="subjectName">
      <div class="entry-date" title="Examination date — type or choose the day, month and year">
        <input class="df-day" type="text" inputmode="numeric" maxlength="2" placeholder="DD" value="${dd}">
        <input class="df-month" type="text" list="cesMonthsDL" placeholder="Month" value="${esc(mm)}" autocomplete="off">
        <input class="df-year" type="text" inputmode="numeric" maxlength="4" list="cesYearsDL" placeholder="YYYY" value="${yy}" autocomplete="off">
      </div>
      <input type="time" value="${e.startTime||'10:00'}" data-f="startTime">
      <input type="time" value="${e.endTime||'13:00'}" data-f="endTime">
      <input placeholder="Room" value="${esc(e.room||'')}" data-f="room">
      <button class="icon-btn danger" title="Remove">${icon('trash')}</button>`;
    if(subs.length && !div.querySelector('datalist')){
      const dl=document.createElement('datalist'); dl.id='subList';
      dl.innerHTML=subs.map(s=>`<option value="${esc(s.code)} — ${esc(s.name)}">`).join('');
      div.appendChild(dl);
    }
    div.querySelectorAll('input').forEach(inp=>inp.addEventListener('input',()=>{
      if(!inp.dataset.f) return;            // manual date parts are parsed at save time
      e[inp.dataset.f]=inp.value;
      if(inp.dataset.f==='subjectName'&&inp.value.includes(' — ')){ const [c,...rest]=inp.value.split(' — '); e.subjectCode=c; e.subjectName=rest.join(' — ');
        div.querySelector('[data-f=subjectCode]').value=c; }
    }));
    div.querySelector('.icon-btn').addEventListener('click',()=>{ entries.splice(i,1); paintEntries(); });
    return div;
  }
  ov.querySelector('#addEntry').addEventListener('click',()=>{
    entries.push({subjectCode:'',subjectName:'',date:'',startTime:'10:00',endTime:'13:00',room:''});
    paintEntries();
  });
  paintEntries();

  /* upload drop zone */
  const dz=ov.querySelector('#dz'), dzFile=ov.querySelector('#dzFile');
  const paintFile=()=>{
    ov.querySelector('#fileHolder').innerHTML=fileBlob?`
      <div class="file-chip">${icon(fileType==='application/pdf'?'file':'image')}
        <div><b>${esc(fileName)}</b><span>${(fileBlob.size/1024).toFixed(1)} KB · ${esc(fileType)}</span></div>
        <button class="icon-btn danger" id="rmFile">${icon('trash')}</button></div>`:'';
    const rm=ov.querySelector('#rmFile');
    if(rm) rm.addEventListener('click',()=>{ fileBlob=fileName=fileType=null; dzFile.value=''; paintFile(); });
  };
  dz.addEventListener('click',()=>dzFile.click());
  dz.addEventListener('dragover',e=>{ e.preventDefault(); dz.classList.add('drag'); });
  dz.addEventListener('dragleave',()=>dz.classList.remove('drag'));
  dz.addEventListener('drop',e=>{ e.preventDefault(); dz.classList.remove('drag'); if(e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
  dzFile.addEventListener('change',()=>dzFile.files[0]&&handleFile(dzFile.files[0]));
  function handleFile(f){
    if(!ACCEPTED_ROUTINE_TYPES.includes(f.type)) return UI.toast('Unsupported file','Upload a PDF or image (PNG/JPG/WebP).','error');
    if(f.size>5*1024*1024) return UI.toast('File too large','Maximum allowed size is 5 MB.','error');
    fileBlob=f; fileName=f.name; fileType=f.type; paintFile();
    UI.toast('File attached',f.name,'success');
  }
  paintFile();

  /* save handler for both buttons */
  const save=async publish=>{
    const err=m=>{const e=ov.querySelector('#rErr');e.querySelector('span').textContent=m;e.style.display='flex';e.scrollIntoView({behavior:'smooth',block:'center'});};
    const g=id=>ov.querySelector('#'+id).value;
    const sess=sessions.find(s=>s.id===+g('rSession')), dept=depts.find(d=>d.id===+g('rDept')), course=courses.find(c=>c.id===+g('rCourse')), sem=sems.find(s=>s.id===+g('rSem'));
    if(!g('rTitle').trim()) return err('Routine title is required (e.g. “2026–2027 Odd Semester Examination Routine”).');
    if(!g('rYear').trim()) return err('Academic year is required.');
    if(!sess||!dept||!course||!sem) return err('Select session, department, course and semester.');
    /* read the manual Day / Month / Year boxes back into each entry */
    const rowEls=[...rowsHost.querySelectorAll('.entry-row')];
    entries.forEach((en,i)=>{
      const box=rowEls[i] && rowEls[i].querySelector('.entry-date');
      const iso=UI.parseManualDate(box);
      if(iso) en.date=iso;
      en._badDate=(iso===false);
    });
    if(entries.some(e=>e._badDate)) return err('One or more examination dates are invalid — check the highlighted day, month or year fields (e.g. 31 February).');
    const cleanEntries=entries.filter(e=>e.subjectCode.trim()&&e.subjectName.trim()&&e.date);
    if(entries.some(e=>!e.subjectCode.trim()||!e.subjectName.trim()||!e.date)) return err('Every exam slot needs a subject code, subject name and a complete exam date (day, month, year). Remove incomplete rows or complete them.');
    if(!cleanEntries.length && !fileBlob) return err('Add at least one exam slot manually, or upload a routine file.');
    const rec=r||{createdAt:new Date().toISOString(),status:'draft',publishedAt:null};
    Object.assign(rec,{title:g('rTitle').trim(),academicYear:g('rYear').trim(),sessionId:sess.id,session:sess.name,
      departmentId:dept.id,department:dept.name,courseId:course.id,course:course.name,
      semesterId:sem.id,semester:sem.number,semesterName:sem.name,semesterType:semTypeOf(sem.number),
      examType:g('rExamType'),instructions:ov.querySelector('#rNotes').value.trim(),
      entries:cleanEntries,fileBlob,fileName,fileType,updatedAt:new Date().toISOString()});
    if(rec.id) await DB.put('examinationRoutines',rec); else rec.id=await DB.add('examinationRoutines',rec);
    if(publish && rec.status!=='published'){ await toggleRoutinePublication(rec); }
    else { await DB.log('Admin','Routine saved',rec.title); UI.toast('Routine saved',rec.title,'success'); }
    UI.closeModal(ov); onDone();
  };
  ov.querySelector('#saveDraft').addEventListener('click',()=>save(false));
  ov.querySelector('#savePub').addEventListener('click',()=>save(true));
}

/* =============================================================
   TEACHER / STUDENT — read-only published routines
   ============================================================= */
async function initRoutineViewer(role){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const s=Auth.session();
  const state={tab:'all'};

  let base=[];
  if(role==='student'){
    const me=await DB.oneByIndex('students','regNo',s.uid);
    base=(await DB.getAll('examinationRoutines')).filter(r=>r.status==='published'&&r.departmentId===me.departmentId&&r.semester<=me.currentSemester);
  }else{
    const me=await DB.oneByIndex('teachers','teacherId',s.uid);
    base=(await DB.getAll('examinationRoutines')).filter(r=>r.status==='published'&&
      (me.assignedSemesters||[]).includes(r.semesterId)&&(me.assignedDepartments||[]).includes(r.departmentId));
  }

  const paint=()=>{
    const list=base.filter(r=>state.tab==='all'||r.semesterType===state.tab)
      .sort((a,b)=>b.academicYear.localeCompare(a.academicYear)||a.semester-b.semester);
    pg.querySelector('#list').innerHTML=list.length
      ? `<div class="routine-grid">${list.map(r=>routineCardHtml(r,`
          <button class="btn btn-sm btn-soft" data-preview="${r.id}">${icon('eye',14)} Preview</button>
          <button class="btn btn-sm btn-outline" data-print="${r.id}">${icon('printer',14)} Print</button>
          ${r.fileBlob?`<button class="btn btn-sm btn-outline" data-dl="${r.id}">${icon('download',14)} Download</button>`:''}`)).join('')}</div>`
      : UI.emptyState('No published routines','When the examination cell publishes a routine for your semester, it appears here automatically.','calendarDays');
    pg.querySelectorAll('[data-preview]').forEach(b=>b.addEventListener('click',async()=>openRoutinePreview(base.find(r=>r.id===+b.dataset.preview),false)));
    pg.querySelectorAll('[data-print]').forEach(b=>b.addEventListener('click',async()=>printRoutine(base.find(r=>r.id===+b.dataset.print),(await DB.get('settings','college'))||{})));
    pg.querySelectorAll('[data-dl]').forEach(b=>b.addEventListener('click',()=>{
      const r=base.find(x=>x.id===+b.dataset.dl); const url=URL.createObjectURL(r.fileBlob);
      const a=document.createElement('a'); a.href=url; a.download=r.fileName||'routine'; a.click();
    }));
  };

  pg.innerHTML=`
    <div class="page-head"><div><h1>Examination Routines</h1><p>${role==='student'?'Published routines for your department and semester(s).':'Published routines for your assigned subjects and semesters.'}</p></div>
    <div class="pill-tabs">${['all','Odd','Even'].map(t=>`<button class="${state.tab===t?'active':''}" data-tab="${t}">${t==='all'?'All':t+' Semesters'}</button>`).join('')}</div></div>
    <div id="list">${UI.spinner()}</div>`;
  pg.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>{ state.tab=b.dataset.tab;
    pg.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b)); paint(); }));
  paint();
}

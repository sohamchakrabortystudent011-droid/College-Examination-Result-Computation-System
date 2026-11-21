/* =============================================================
   examinations.js — Admin → Examination Management
   Create examinations per session / department / semester,
   manage lifecycle status (scheduled → ongoing → completed).
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  if(document.body.dataset.page==='examinations') initAdminExaminations();
});

const EXAM_TYPES=['End Semester','Mid Semester','Internal Assessment','Supplementary','Backlog'];

async function initAdminExaminations(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const state={type:'',sem:''};

  const paint=async()=>{
    let list=await DB.getAll('examinations');
    const [resultsCount,marksCount]=[await DB.count('results'),await DB.byIndex('marks','status','submitted')];
    if(state.type) list=list.filter(x=>x.semesterType?x.semesterType===state.type : (state.type==='Odd'?x.semester%2===1:x.semester%2===0));
    if(state.sem) list=list.filter(x=>x.semester===+state.sem);
    list.sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));

    pg.querySelector('#tbl').innerHTML=`
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Examination</th><th>Type</th><th>Session</th><th>Department</th><th>Semester</th><th>Schedule</th><th>Marks</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${list.map(x=>`<tr>
          <td class="td-main"><b>${esc(x.name)}</b><span>${esc(x.course||'')}</span></td>
          <td>${esc(x.type)}</td>
          <td>${esc(x.session)}</td>
          <td>${esc(x.department)}</td>
          <td><span class="sem-badge ${x.semester%2===1?'odd':'even'}">${x.semesterName||UI.semName(x.semester)} · ${x.semester%2===1?'Odd':'Even'}</span></td>
          <td class="small">${fmtDate(x.startDate)} → ${fmtDate(x.endDate)}${(()=>{const d=Math.round((new Date(x.endDate)-new Date(x.startDate))/86400000);return d>0?'<br><span class="muted">('+d+' days)</span>':'';})()}</td>
          <td class="small">Max ${x.maxMarks} · Pass ${x.passMarks}</td>
          <td>${UI.statusBadge(x.status)}</td>
          <td><div class="row-actions">
            ${x.status==='scheduled'?`<button class="btn btn-sm btn-warning" data-going="${x.id}">Set Ongoing</button>`:''}
            ${x.status==='ongoing'?`<button class="btn btn-sm btn-success" data-done="${x.id}">Complete</button>`:''}
            <button class="icon-btn" data-edit="${x.id}" title="Edit">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${x.id}" title="Delete">${icon('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table>
      ${list.length?`<div class="table-foot"><span>${list.length} examination(s)</span><span>${resultsCount} stored results · ${marksCount.length} marks awaiting review</span></div>`:UI.emptyState('No examinations','Create the first examination to begin scheduling.','clipboard')}
      </div>`;

    const setStatus=async(id,st,msg)=>{
      const x=await DB.get('examinations',id); x.status=st; await DB.put('examinations',x);
      await DB.log('Admin',`Examination ${msg}`,x.name); UI.toast('Status updated',x.name,'success'); paint();
    };
    pg.querySelectorAll('[data-going]').forEach(b=>b.addEventListener('click',()=>setStatus(+b.dataset.going,'ongoing','started')));
    pg.querySelectorAll('[data-done]').forEach(b=>b.addEventListener('click',()=>setStatus(+b.dataset.done,'completed','completed')));
    pg.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>examModal(await DB.get('examinations',+b.dataset.edit),paint)));
    pg.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      const x=await DB.get('examinations',+b.dataset.del);
      if(await UI.confirm('Delete examination',`Delete “${x.name}”? Linked marks and results are kept for audit but lose their exam context.`)){
        await DB.del('examinations',x.id); await DB.log('Admin','Examination deleted',x.name);
        UI.toast('Examination deleted',x.name,'success'); paint();
      }
    }));
  };

  pg.innerHTML=`
    <div class="page-head"><div><h1>Examination Management</h1><p>Create examinations and control their lifecycle status.</p></div>
    <div class="page-actions"><button class="btn btn-royal" id="addBtn">${icon('plus')} New Examination</button></div></div>
    <div class="toolbar">
      <select id="fType"><option value="">Odd + Even</option><option value="Odd">Odd Semesters</option><option value="Even">Even Semesters</option></select>
      <select id="fSem"><option value="">All Semesters</option>${SEM_NAMES.map((n,i)=>`<option value="${i+1}">${n}</option>`).join('')}</select>
    </div>
    <div id="tbl">${UI.spinner()}</div>`;
  pg.querySelector('#fType').addEventListener('change',e=>{ state.type=e.target.value; paint(); });
  pg.querySelector('#fSem').addEventListener('change',e=>{ state.sem=e.target.value; paint(); });
  pg.querySelector('#addBtn').addEventListener('click',()=>examModal(null,paint));
  paint();
}

async function examModal(x,onDone){
  const [sessions,depts,courses,sems]=await Promise.all([DB.getAll('academicSessions'),DB.getAll('departments'),DB.getAll('courses'),DB.getAll('semesters')]);
  const ov=UI.modal(`${UI.modalHead(x?'Edit Examination':'New Examination')}
    <div class="modal-body"><div class="form-error" id="eErr" style="display:none"><span></span></div>
      <div class="form-grid">
        <div class="field span-2"><label>Examination Name <span class="req">*</span></label><input id="xName" value="${esc(x?.name||'')}" placeholder="e.g. Odd Semester End Examination"></div>
        <div class="field"><label>Examination Type <span class="req">*</span></label><select id="xType">${EXAM_TYPES.map(t=>`<option ${x?.type===t?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="field"><label>Academic Session <span class="req">*</span></label><select id="xSession">${sessions.map(s=>`<option value="${s.id}" ${x&&x.sessionId===s.id?'selected':''}>${esc(s.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Department <span class="req">*</span></label><select id="xDept">${optRows(depts,x?.departmentId)}</select></div>
        <div class="field"><label>Course <span class="req">*</span></label><select id="xCourse"><option value="">Select</option></select></div>
        <div class="field"><label>Semester <span class="req">*</span></label><select id="xSem">${sems.map(s=>`<option value="${s.id}" data-num="${s.number}" ${x&&x.semesterId===s.id?'selected':''}>${s.name}</option>`).join('')}</select><span class="help" id="semTypeHelp"></span></div>
        <div class="field"><label>Semester Type (auto)</label><input id="xSemType" disabled value=""></div>
        ${UI.dateLists()}
        <div class="field"><label>Examination Start — Day · Month · Year <span class="req">*</span></label>
          ${UI.dateFieldHtml('xStart',x?.startDate||'')}
          <span class="help">Choose from the suggestions or type manually — e.g. 14 · July · 2026.</span></div>
        <div class="field"><label>Examination End — Day · Month · Year <span class="req">*</span></label>
          ${UI.dateFieldHtml('xEnd',x?.endDate||'')}
          <span class="help">Month may be chosen, typed as a name (“July”) or a number (“07”).</span></div>
        <div class="field"><label>Maximum Marks (per subject)</label><input id="xMax" type="number" min="1" value="${x?.maxMarks||100}"></div>
        <div class="field"><label>Pass Marks (per subject)</label><input id="xPass" type="number" min="0" value="${x?.passMarks||40}"></div>
      </div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="xSave">${icon('check')} ${x?'Save Changes':'Create Examination'}</button></div>`,'wide');

  const deptSel=ov.querySelector('#xDept'), courseSel=ov.querySelector('#xCourse'), semSel=ov.querySelector('#xSem');
  const fillCourses=sel=>{ courseSel.innerHTML='<option value="">Select</option>'+courses.filter(c=>c.departmentId===+deptSel.value).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join(''); };
  deptSel.addEventListener('change',()=>fillCourses());
  if(x) fillCourses(x.courseId); else fillCourses();
  const syncType=()=>{ const num=+semSel.selectedOptions[0].dataset.num; ov.querySelector('#xSemType').value=num%2===1?'Odd':'Even'; ov.querySelector('#semTypeHelp').textContent=`(${UI.semName(num)} is an ${num%2===1?'Odd':'Even'} semester)`; };
  semSel.addEventListener('change',syncType); syncType();

  ov.querySelector('#xSave').addEventListener('click',async()=>{
    const err=m=>{const e=ov.querySelector('#eErr');e.querySelector('span').textContent=m;e.style.display='flex';};
    const g=id=>ov.querySelector('#'+id).value;
    const sess=sessions.find(s=>s.id===+g('xSession')), dept=depts.find(d=>d.id===+g('xDept')), course=courses.find(c=>c.id===+g('xCourse'));
    const sem=sems.find(s=>s.id===+g('xSem'));
    if(!g('xName').trim()||!sess||!dept||!course||!sem) return err('Please complete every required field.');
    const stDate=UI.parseManualDate(ov.querySelector('[data-manual-date="xStart"]'));
    const enDate=UI.parseManualDate(ov.querySelector('[data-manual-date="xEnd"]'));
    if(stDate===null||enDate===null) return err('Enter the start and end dates — day, month and year are all required.');
    if(stDate===false||enDate===false) return err('Invalid calendar date — check the highlighted day, month or year fields.');
    if(enDate<stDate) return err('End date must be on or after the start date.');
    if(+g('xPass')>+g('xMax')) return err('Pass marks cannot exceed maximum marks.');
    const rec={name:g('xName').trim(),type:g('xType'),sessionId:sess.id,session:sess.name,
      departmentId:dept.id,department:dept.name,courseId:course.id,course:course.name,
      semesterId:sem.id,semester:sem.number,semesterName:sem.name,
      startDate:stDate,endDate:enDate,maxMarks:+g('xMax')||100,passMarks:+g('xPass')||40};
    if(x){ Object.assign(x,rec); await DB.put('examinations',x); await DB.cascadeExamination(x); await DB.log('Admin','Examination updated',rec.name); }
    else { rec.status='scheduled'; rec.createdAt=new Date().toISOString(); await DB.add('examinations',rec); await DB.log('Admin','Examination created',`${rec.name} · ${sess.name} · ${sem.name}`);
      /* connect the roles: students & teachers of this department/semester see it instantly */
      await Notify.pushStudents({title:'New examination scheduled',
        message:`${rec.name} — ${sem.name}, ${dept.name}, is scheduled for ${fmtDate(rec.startDate)} to ${fmtDate(rec.endDate)}. The examination routine will follow.`,
        type:'info',link:'examination-routine.html',departmentId:dept.id,semester:sem.number});
      await Notify.pushTeachers({title:'New examination scheduled',
        message:`${rec.name} — ${dept.name}, ${sem.name}, ${fmtDate(rec.startDate)} to ${fmtDate(rec.endDate)}. Prepare marks entry when the routine is published.`,
        type:'info',link:'examination-routine.html',semesterId:sem.id,departmentId:dept.id});
      window.refreshBell&&refreshBell(); }
    UI.closeModal(ov); UI.toast('Saved',rec.name,'success'); onDone();
  });
}

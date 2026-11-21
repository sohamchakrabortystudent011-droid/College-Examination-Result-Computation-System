/* =============================================================
   teachers.js — Admin → Teacher Management
   Create accounts with unique Teacher IDs, assign passwords,
   subjects, semesters and departments.
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  if(document.body.dataset.page==='teachers') initAdminTeachers();
});

/* generate the next free Teacher ID: TCH#### */
async function nextTeacherId(){
  const all=await DB.getAll('teachers');
  let max=1000;
  all.forEach(t=>{ const n=+String(t.teacherId).replace(/\D/g,''); if(n>=max) max=n+1; });
  return 'TCH'+max;
}

async function initAdminTeachers(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const state={q:''};

  const paint=async()=>{
    let list=await DB.getAll('teachers');
    const subjects=await DB.getAll('subjects');
    if(state.q){ const q=state.q.toLowerCase(); list=list.filter(t=>t.name.toLowerCase().includes(q)||t.teacherId.toLowerCase().includes(q)); }
    pg.querySelector('#tbl').innerHTML=`
      <div class="table-wrap scroll"><table class="data-table">
        <thead><tr><th>Teacher</th><th>Teacher ID</th><th>Department</th><th class="num">Assigned Subjects</th><th>Semesters</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${list.map(t=>`<tr>
          <td><div class="cell-user"><span class="avatar">${initials(t.name)}</span><div class="td-main"><b>${esc(t.name)}</b><span>${esc(t.designation||'')} · ${esc(t.email)}</span></div></div></td>
          <td><span class="badge navy">${esc(t.teacherId)}</span></td>
          <td>${esc(t.department)}</td>
          <td class="num">${subjects.filter(s=>s.teacherId===t.id).length}</td>
          <td>${(t.assignedSemesters||[]).map(id=>{const n=(+id)||0;return n;}).sort().map(n=>`<span class="badge royal">${n}</span>`).join(' ')||'—'}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-view="${t.id}" title="View profile">${icon('eye')}</button>
            <button class="icon-btn" data-edit="${t.id}" title="Edit / assignments">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${t.id}" title="Delete">${icon('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table>
        ${list.length?'':UI.emptyState('No teachers','Create faculty accounts here — teachers cannot self-register.','briefcase')}</div>`;

    pg.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',async()=>{
      const t=await DB.get('teachers',+b.dataset.view);
      const subs=subjects.filter(s=>s.teacherId===t.id);
      UI.modal(`${UI.modalHead('Teacher Profile')}
        <div class="modal-body">
          <div class="profile-card mb-20">${UI.avatarHtml(t,'lg')}<div class="pinfo"><b>${esc(t.name)}</b><span>${esc(t.teacherId)} · ${esc(t.designation||'')}</span></div></div>
          <div class="kv mb-20">
            <div><span>Department</span><b>${esc(t.department)}</b></div>
            <div><span>Email</span><b>${esc(t.email)}</b></div>
            <div><span>Mobile</span><b>${esc(t.mobile||'—')}</b></div>
            <div><span>Assigned Semesters</span><b>${(t.assignedSemesters||[]).map(n=>UI.semName(+n)).join(', ')||'—'}</b></div>
          </div>
          <h4 class="mb-10">Assigned Subjects (${subs.length})</h4>
          ${subs.length?`<div class="table-wrap"><table class="data-table compact"><thead><tr><th>Code</th><th>Subject</th><th>Semester</th><th>Max / Pass</th><th>Credits</th></tr></thead><tbody>
            ${subs.map(s=>`<tr><td><span class="badge royal">${esc(s.code)}</span></td><td>${esc(s.name)}</td><td>${UI.semName(s.semester)}</td><td>${s.maxMarks} / ${s.passMarks}</td><td>${s.credits}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted small">No subjects assigned yet.</p>'}
        </div>`,'wide');
    }));
    pg.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>teacherModal(await DB.get('teachers',+b.dataset.edit),paint)));
    pg.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      const t=await DB.get('teachers',+b.dataset.del);
      if(await UI.confirm('Delete teacher',`Delete ${t.name} (${t.teacherId})? Their subject assignments will be removed.`)){
        for(const s of subjects.filter(s=>s.teacherId===t.id)){ s.teacherId=null; await DB.put('subjects',s); }
        await DB.del('teachers',t.id); await DB.log('Admin','Teacher deleted',`${t.name} (${t.teacherId})`);
        UI.toast('Teacher deleted',t.teacherId,'success'); paint();
      }
    }));
  };

  pg.innerHTML=`
    <div class="page-head"><div><h1>Teacher Management</h1><p>Only administrators can create teacher accounts and assignments.</p></div>
    <div class="page-actions"><button class="btn btn-royal" id="addBtn">${icon('plus')} Add Teacher</button></div></div>
    <div class="toolbar"><div class="search-box">${icon('search')}<input id="q" placeholder="Search by name or Teacher ID…"></div></div>
    <div id="tbl">${UI.spinner()}</div>`;
  pg.querySelector('#q').addEventListener('input',e=>{ state.q=e.target.value; paint(); });
  pg.querySelector('#addBtn').addEventListener('click',()=>teacherModal(null,paint));
  paint();
}

async function teacherModal(t,onDone){
  const [depts,subjects,sems]=await Promise.all([DB.getAll('departments'),DB.getAll('subjects'),DB.getAll('semesters')]);
  const newId=t?t.teacherId:await nextTeacherId();
  const mySubjects=t?subjects.filter(s=>s.teacherId===t.id).map(s=>s.id):[];
  const mySems=(t?.assignedSemesters||[]).map(Number);

  const ov=UI.modal(`${UI.modalHead(t?'Edit Teacher & Assignments':'Add Teacher')}
    <div class="modal-body"><div class="form-error" id="tErr" style="display:none"><span></span></div>
      <div class="form-grid">
        <div class="field"><label>Teacher ID (unique)</label><input value="${newId}" disabled><span class="help">Auto-generated login ID</span></div>
        <div class="field"><label>Full Name <span class="req">*</span></label><input id="tName" value="${esc(t?.name||'')}"></div>
        <div class="field"><label>Department <span class="req">*</span></label><select id="tDept">${optRows(depts,t?.departmentId)}</select></div>
        <div class="field"><label>Designation</label><input id="tDesig" value="${esc(t?.designation||'')}" placeholder="e.g. Assistant Professor"></div>
        <div class="field"><label>Email <span class="req">*</span></label><input id="tEmail" type="email" value="${esc(t?.email||'')}"></div>
        <div class="field"><label>Mobile</label><input id="tMob" value="${esc(t?.mobile||'')}"></div>
        <div class="field span-2"><label>${t?'Reset Password (leave blank to keep current)':'Assign Password'} <span class="req">${t?'':'*'}</span></label>
          <input id="tPw" type="password" placeholder="Min 8 chars, letter + number"><span class="help">Share securely with the teacher. Teachers can change it from their profile after first sign-in.</span></div>
      </div>
      <h4 class="mt-20 mb-10">Assigned Semesters</h4>
      <div class="check-grid mb-14">${sems.map(s=>`<label class="check-row"><input type="checkbox" name="sem" value="${s.number}" ${mySems.includes(s.number)?'checked':''}> ${s.name} <span class="muted small">(${s.type})</span></label>`).join('')}</div>
      <h4 class="mb-10">Assigned Subjects</h4>
      <div class="check-grid" style="max-height:260px">${subjects.map(s=>`<label class="check-row"><input type="checkbox" name="sub" value="${s.id}" ${mySubjects.includes(s.id)?'checked':''}> <span><b>${esc(s.code)}</b> — ${esc(s.name)} <span class="muted small">(${UI.semName(s.semester)})</span></span></label>`).join('')}</div>
    </div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="tSave">${icon('check')} ${t?'Save Changes':'Create Teacher Account'}</button></div>`,'wide');

  ov.querySelector('#tSave').addEventListener('click',async()=>{
    const err=m=>{const e=ov.querySelector('#tErr');e.querySelector('span').textContent=m;e.style.display='flex';};
    const g=id=>ov.querySelector('#'+id).value.trim();
    const dept=depts.find(d=>d.id===+g('tDept'));
    const pw=ov.querySelector('#tPw').value;
    if(!g('tName')||!g('tEmail')||!dept) return err('Name, email and department are required.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(g('tEmail'))) return err('Enter a valid email address.');
    if(!t || pw){ const pErr=Security.validate(pw); if(pErr) return err(pErr); }  // min 8 chars, letter + number

    const selectedSemIds=[...ov.querySelectorAll('input[name=sem]:checked')].map(c=>sems.find(s=>s.number===+c.value)?.id).filter(Boolean);
    const subIds=[...ov.querySelectorAll('input[name=sub]:checked')].map(c=>+c.value);
    /* A subject assignment always grants access to its semester. This avoids
       an inconsistent teacher account where the subject is assigned but the
       marks-entry examination is hidden by the semester filter. */
    const subjectSemIds=subjects.filter(s=>subIds.includes(s.id)).map(s=>s.semesterId);
    const semIds=[...new Set(selectedSemIds.concat(subjectSemIds))];

    let rec=t;
    if(!t){
      rec={teacherId:newId,createdAt:new Date().toISOString()};
    }
    Object.assign(rec,{name:g('tName'),departmentId:dept.id,department:dept.name,designation:g('tDesig'),email:g('tEmail'),mobile:g('tMob'),
      assignedSemesters:semIds,assignedDepartments:[...new Set(subjects.filter(s=>subIds.includes(s.id)).map(s=>s.departmentId).concat(dept.id))],
      assignedCourses:[...new Set(subjects.filter(s=>subIds.includes(s.id)).map(s=>s.courseId).filter(Boolean))]});
    if(pw) rec.passwordHash=await Security.hash(pw);
    if(!t && !rec.passwordHash) rec.passwordHash=await Security.hash(pw);

    const id = t ? (await DB.put('teachers',rec), t.id) : await DB.add('teachers',rec);
    /* sync subject assignment both ways */
    for(const s of subjects){
      const should=subIds.includes(s.id);
      if(should && s.teacherId!==id){ s.teacherId=id; await DB.put('subjects',s); }
      if(!should && s.teacherId===id){ s.teacherId=null; await DB.put('subjects',s); }
    }
    rec.id=id; rec.assignedSubjects=subIds; await DB.put('teachers',rec);
    /* Rebuild assignment mirrors for every teacher, including a previous
       owner when a subject is reassigned. subject.teacherId is authoritative. */
    const freshSubjects=await DB.getAll('subjects');
    for(const teacher of await DB.getAll('teachers')){
      const assigned=freshSubjects.filter(s=>s.teacherId===teacher.id).map(s=>s.id);
      if(JSON.stringify(teacher.assignedSubjects||[])!==JSON.stringify(assigned)){
        teacher.assignedSubjects=assigned; await DB.put('teachers',teacher);
      }
    }
    await DB.log('Admin',t?'Teacher updated':'Teacher account created',`${rec.name} (${newId})`);
    if(!t) await Notify.push({role:'teacher',uid:newId,title:'Account created',message:'Your faculty account is active. Assigned subjects are visible on your dashboard.',type:'success'});
    else await Notify.push({role:'teacher',uid:newId,title:'Teaching assignments updated',
      message:`Your assigned subjects and semesters were updated by the administrator. You now have ${subIds.length} subject assignment(s).`,type:'info',link:'assigned-subjects.html'});
    UI.closeModal(ov); UI.toast(t?'Teacher updated':'Teacher created',`${rec.name} · ${newId}${!t?' · share the assigned password':''}`,'success'); onDone();
  });
}

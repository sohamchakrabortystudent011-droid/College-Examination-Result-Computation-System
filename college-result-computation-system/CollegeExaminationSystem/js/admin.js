/* =============================================================
   admin.js — Admin dashboard + departments, courses, semesters,
   academic sessions and system settings modules.
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  const map={dashboard:adminDashboard,departments:adminDepartments,courses:adminCourses,
             subjects:adminSubjects,semesters:adminSemesters,sessions:adminSessions,settings:adminSettings};
  const fn=map[document.body.dataset.page]; if(fn) fn();
});

const pageEl=()=>document.getElementById('page');
/* optRows is provided globally by navigation.js */

/* ---------------- DASHBOARD ---------------- */
async function adminDashboard(){
  pageEl().innerHTML=UI.spinner();
  const [students,teachers,depts,sems,exams,results,marks,act]=await Promise.all([
    DB.getAll('students'),DB.getAll('teachers'),DB.getAll('departments'),DB.getAll('semesters'),
    DB.getAll('examinations'),DB.getAll('results'),DB.getAll('marks'),DB.getAll('activityLog')]);

  const published=results.filter(r=>r.status==='published').length;
  const pendingGroups={};
  marks.filter(m=>m.status==='submitted').forEach(m=>{
    const k=m.examId+'|'+m.subjectId+'|'+m.teacherId;
    (pendingGroups[k] ||= {exam:m.examName,subject:m.subjectName,code:m.subjectCode,teacherId:m.teacherId,count:0,at:m.submittedAt}).count++;
  });
  const tName={}; teachers.forEach(t=>tName[t.id]=t.name);

  const stat=(icon_,cls,val,label)=>`
    <div class="stat-card"><div class="stat-ico ${cls}">${icon(icon_,23)}</div>
    <div><h3>${val}</h3><p>${label}</p></div></div>`;

  pageEl().innerHTML=`
    <div class="page-head">
      <div><h1>Administration Dashboard</h1><p>Examination cell overview, pending reviews and recent activity.</p></div>
      <div class="page-actions">
        <a class="btn btn-outline" href="routine-management.html">${icon('calendarDays')} Routines</a>
        <a class="btn btn-royal" href="results.html">${icon('award')} Publish Results</a>
      </div>
    </div>
    <div class="stat-grid">
      ${stat('users','navy',students.length,'Registered Students')}
      ${stat('briefcase','royal',teachers.length,'Teachers')}
      ${stat('building','sky',depts.length,'Departments')}
      ${stat('layers','royal',sems.filter(s=>s.status==='active').length+' / '+(sems.length||8),'Active Semesters')}
      ${stat('clipboard','orange',exams.length,'Examinations')}
      ${stat('award','green',published,'Published Results')}
      ${stat('clipboardCheck','red',Object.keys(pendingGroups).length,'Pending Marks Submissions')}
    </div>
    <div class="grid-main">
      <div class="panel">
        <div class="panel-head"><div><h3>Recent Activities</h3><p>Latest actions across the examination cell</p></div></div>
        <div class="panel-body" style="padding-top:8px">
          ${act.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,9).map(a=>`
            <div class="act-item"><span class="act-dot"></span>
              <div><b class="text-navy">${esc(a.actor)}</b> — ${esc(a.action)}<br><span class="muted small">${esc(a.detail||'')}</span>
              <time>${timeAgo(a.createdAt)}</time></div></div>`).join('') || UI.emptyState('No activity yet','Actions performed in the portal will appear here.','clock')}
        </div>
      </div>
      <div class="col gap-20">
        <div class="panel">
          <div class="panel-head"><div><h3>Pending Marks Review</h3><p>Submitted by teachers, awaiting approval</p></div></div>
          <div class="panel-body" style="padding-top:10px">
            ${Object.values(pendingGroups).map(g=>`
              <div class="act-item"><span class="act-dot" style="background:var(--warning)"></span>
                <div><b class="text-navy">${esc(g.code)} — ${esc(g.subject)}</b><br>
                <span class="muted small">${esc(g.exam)} · ${esc(tName[g.teacherId]||'Teacher')} · ${g.count} students</span>
                <time>${g.at?timeAgo(g.at):''}</time></div></div>`).join('') ||
              `<div class="alert success" style="margin:0">${icon('check')}<div>No pending submissions. All marks are reviewed.</div></div>`}
            ${Object.keys(pendingGroups).length?`<div class="mt-14"><a class="btn btn-sm btn-soft" href="marks-review.html">${icon('clipboardCheck')} Open Marks Review</a></div>`:''}
          </div>
        </div>
        <div class="panel">
          <div class="panel-head"><h3>Quick Actions</h3></div>
          <div class="panel-body grid-2" style="gap:10px">
            <a class="tile" href="students.html">${icon('users')}<div><b>Add Student</b><span>Register a new student</span></div></a>
            <a class="tile" href="teachers.html">${icon('briefcase')}<div><b>Add Teacher</b><span>Create faculty account</span></div></a>
            <a class="tile" href="examinations.html">${icon('clipboard')}<div><b>New Examination</b><span>Schedule an exam</span></div></a>
            <a class="tile" href="routine-management.html">${icon('upload')}<div><b>Upload Routine</b><span>Publish exam dates</span></div></a>
          </div>
        </div>
      </div>
    </div>`;
}

/* ---------------- DEPARTMENTS ---------------- */
async function adminDepartments(){
  pageEl().innerHTML=UI.spinner();
  const render=async()=>{
    const [depts,students,teachers]=await Promise.all([DB.getAll('departments'),DB.getAll('students'),DB.getAll('teachers')]);
    pageEl().innerHTML=`
      <div class="page-head"><div><h1>Department Management</h1><p>Add, edit and organise academic departments.</p></div>
      <div class="page-actions"><button class="btn btn-royal" id="addBtn">${icon('plus')} Add Department</button></div></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Code</th><th>Department</th><th>Head of Department</th><th class="num">Students</th><th class="num">Teachers</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${depts.map(d=>`<tr>
          <td><span class="badge royal">${esc(d.code)}</span></td>
          <td class="td-main"><b>${esc(d.name)}</b></td>
          <td>${esc(d.hod||'—')}</td>
          <td class="num">${students.filter(s=>s.departmentId===d.id).length}</td>
          <td class="num">${teachers.filter(t=>t.departmentId===d.id).length}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-view="${d.id}" title="View">${icon('eye')}</button>
            <button class="icon-btn" data-edit="${d.id}" title="Edit">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${d.id}" title="Delete">${icon('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table>
        ${depts.length?'':UI.emptyState('No departments','Add your first department to get started.','building')}</div>`;

    pageEl().querySelector('#addBtn').addEventListener('click',()=>deptModal(null,render));
    pageEl().querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>deptModal(await DB.get('departments',+b.dataset.edit),render)));
    pageEl().querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',async()=>{
      const d=await DB.get('departments',+b.dataset.view);
      const ds=students.filter(s=>s.departmentId===d.id), dt=teachers.filter(t=>t.departmentId===d.id);
      UI.modal(`${UI.modalHead('Department — '+esc(d.name))}
        <div class="modal-body">
          <div class="kv mb-20"><div><span>Code</span><b>${esc(d.code)}</b></div><div><span>HOD</span><b>${esc(d.hod||'—')}</b></div></div>
          <h4 class="mb-10">Students (${ds.length})</h4>
          ${ds.length?`<div class="table-wrap"><table class="data-table compact"><thead><tr><th>Reg. No</th><th>Name</th><th>Semester</th></tr></thead><tbody>
            ${ds.map(s=>`<tr><td>${esc(s.regNo)}</td><td>${esc(s.name)}</td><td>${UI.semName(s.currentSemester)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="muted small">No students in this department.</p>'}
          <h4 class="mt-20 mb-10">Teachers (${dt.length})</h4>
          ${dt.length?dt.map(t=>`<div class="act-item"><span class="act-dot"></span><div><b class="text-navy">${esc(t.name)}</b> <span class="muted small">· ${esc(t.teacherId)} · ${esc(t.designation||'')}</span></div></div>`).join(''):'<p class="muted small">No teachers assigned.</p>'}
        </div>`,'wide');
    }));
    pageEl().querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      const d=await DB.get('departments',+b.dataset.del);
      const used = students.some(s=>s.departmentId===d.id)||teachers.some(t=>t.departmentId===d.id);
      if(used){ UI.toast('Cannot delete','This department has linked students or teachers.','error'); return; }
      if(await UI.confirm('Delete department',`Delete “${d.name}” permanently?`)){
        await DB.del('departments',d.id); await DB.log('Admin','Department deleted',d.name);
        UI.toast('Department deleted',d.name,'success'); render();
      }
    }));
  };
  render();
}

function deptModal(d,onDone){
  const ov=UI.modal(`${UI.modalHead(d?'Edit Department':'Add Department')}
    <div class="modal-body"><div class="form-error" id="dErr" style="display:none"><span></span></div>
      <div class="form-grid">
        <div class="field span-2"><label>Department Name <span class="req">*</span></label><input id="dName" value="${esc(d?.name||'')}" placeholder="e.g. Computer Science & Engineering"></div>
        <div class="field"><label>Short Code <span class="req">*</span></label><input id="dCode" value="${esc(d?.code||'')}" placeholder="e.g. CSE" maxlength="8" style="text-transform:uppercase"></div>
        <div class="field"><label>Head of Department</label><input id="dHod" value="${esc(d?.hod||'')}" placeholder="Faculty name"></div>
      </div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="dSave">${icon('check')} Save</button></div>`);
  ov.querySelector('#dSave').addEventListener('click',async()=>{
    const name=ov.querySelector('#dName').value.trim(), code=ov.querySelector('#dCode').value.trim().toUpperCase(), hod=ov.querySelector('#dHod').value.trim();
    const err=m=>{const e=ov.querySelector('#dErr');e.querySelector('span').textContent=m;e.style.display='flex';};
    if(!name||!code) return err('Department name and code are required.');
    const clash=await DB.oneByIndex('departments','code',code);
    if(clash && clash.id!==d?.id) return err(`Code ${code} already exists.`);
    if(d){ Object.assign(d,{name,code,hod}); await DB.put('departments',d); await DB.cascadeDepartment(d); await DB.log('Admin','Department updated',name); }
    else { await DB.add('departments',{name,code,hod,createdAt:new Date().toISOString()}); await DB.log('Admin','Department added',name); }
    UI.closeModal(ov); UI.toast('Saved',name,'success'); onDone();
  });
}

/* ---------------- COURSES ---------------- */
async function adminCourses(){
  pageEl().innerHTML=UI.spinner();
  const render=async()=>{
    const [courses,depts,students]=await Promise.all([DB.getAll('courses'),DB.getAll('departments'),DB.getAll('students')]);
    pageEl().innerHTML=`
      <div class="page-head"><div><h1>Course Management</h1><p>Programmes offered under each department.</p></div>
      <div class="page-actions"><button class="btn btn-royal" id="addBtn">${icon('plus')} Add Course</button></div></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Code</th><th>Course</th><th>Department</th><th>Duration</th><th class="num">Intake</th><th class="num">Students</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${courses.map(c=>`<tr>
          <td><span class="badge royal">${esc(c.code)}</span></td>
          <td class="td-main"><b>${esc(c.name)}</b></td>
          <td>${esc(c.department||'—')}</td><td>${esc(c.duration||'—')}</td>
          <td class="num">${c.intake||'—'}</td><td class="num">${students.filter(s=>s.courseId===c.id).length}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-edit="${c.id}">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${c.id}">${icon('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table></div>`;
    pageEl().querySelector('#addBtn').addEventListener('click',()=>courseModal(null,depts,render));
    pageEl().querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>courseModal(await DB.get('courses',+b.dataset.edit),depts,render)));
    pageEl().querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      const c=await DB.get('courses',+b.dataset.del);
      if(students.some(s=>s.courseId===c.id)){ UI.toast('Cannot delete','Students are enrolled in this course.','error'); return; }
      if(await UI.confirm('Delete course',`Delete “${c.name}”?`)){ await DB.del('courses',c.id); UI.toast('Course deleted',c.name,'success'); render(); }
    }));
  };
  render();
}

function courseModal(c,depts,onDone){
  const ov=UI.modal(`${UI.modalHead(c?'Edit Course':'Add Course')}
    <div class="modal-body"><div class="form-error" id="cErr" style="display:none"><span></span></div>
      <div class="form-grid">
        <div class="field span-2"><label>Course Name <span class="req">*</span></label><input id="cName" value="${esc(c?.name||'')}" placeholder="e.g. B.Tech Computer Science & Engineering"></div>
        <div class="field"><label>Course Code <span class="req">*</span></label><input id="cCode" value="${esc(c?.code||'')}" placeholder="e.g. BTECH-CSE" style="text-transform:uppercase"></div>
        <div class="field"><label>Department <span class="req">*</span></label><select id="cDept"><option value="">Select</option>${optRows(depts,c?.departmentId)}</select></div>
        <div class="field"><label>Duration</label><select id="cDur">${['4 Years','3 Years','2 Years','1 Year'].map(d=>`<option ${c?.duration===d?'selected':''}>${d}</option>`).join('')}</select></div>
        <div class="field"><label>Annual Intake</label><input id="cIntake" type="number" min="0" value="${c?.intake||60}"></div>
      </div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="cSave">${icon('check')} Save</button></div>`);
  ov.querySelector('#cSave').addEventListener('click',async()=>{
    const err=m=>{const e=ov.querySelector('#cErr');e.querySelector('span').textContent=m;e.style.display='flex';};
    const name=ov.querySelector('#cName').value.trim(), code=ov.querySelector('#cCode').value.trim().toUpperCase();
    const dept=depts.find(d=>d.id===+ov.querySelector('#cDept').value);
    if(!name||!code||!dept) return err('Course name, code and department are required.');
    const clash=await DB.oneByIndex('courses','code',code);
    if(clash && clash.id!==c?.id) return err(`Code ${code} already exists.`);
    const rec={name,code,departmentId:dept.id,department:dept.name,duration:ov.querySelector('#cDur').value,intake:+ov.querySelector('#cIntake').value||0};
    if(c){ Object.assign(c,rec); await DB.put('courses',c); await DB.cascadeCourse(c); } else { rec.createdAt=new Date().toISOString(); await DB.add('courses',rec); }
    await DB.log('Admin',c?'Course updated':'Course added',name);
    UI.closeModal(ov); UI.toast('Saved',name,'success'); onDone();
  });
}

/* ---------------- SEMESTERS (eight, odd/even auto) ---------------- */
async function adminSemesters(){
  pageEl().innerHTML=UI.spinner();
  const [sems,subjects,students,routines]=await Promise.all([
    DB.getAll('semesters'),DB.getAll('subjects'),DB.getAll('students'),DB.getAll('examinationRoutines')]);
  pageEl().innerHTML=`
    <div class="page-head"><div><h1>Semester Management</h1><p>The college follows eight semesters. Type is automatic — 1st/3rd/5th/7th are Odd, 2nd/4th/6th/8th are Even.</p></div></div>
    <div class="grid-3">${sems.sort((a,b)=>a.number-b.number).map(s=>`
      <div class="panel"><div class="panel-body">
        <div class="flex items-center justify-between mb-10">
          <h3>${esc(s.name)}</h3><span class="sem-badge ${s.type.toLowerCase()}">${s.type}</span></div>
        <div class="kv mb-14">
          <div><span>Subjects</span><b>${subjects.filter(x=>x.semesterId===s.id).length}</b></div>
          <div><span>Students</span><b>${students.filter(x=>x.currentSemester===s.number).length}</b></div>
          <div><span>Routines</span><b>${routines.filter(r=>r.semesterId===s.id&&r.status==='published').length} published</b></div>
          <div><span>Status</span><b class="${s.status==='active'?'text-success':'text-danger'}">${s.status}</b></div>
        </div>
        <button class="btn btn-outline btn-sm" data-edit="${s.id}">${icon('edit',14)} Edit</button>
      </div></div>`).join('')}</div>`;
  pageEl().querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>{
    const s=await DB.get('semesters',+b.dataset.edit);
    const ov=UI.modal(`${UI.modalHead('Edit Semester')}
      <div class="modal-body"><div class="form-grid">
        <div class="field"><label>Semester Name</label><input id="sName" value="${esc(s.name)}"></div>
        <div class="field"><label>Status</label><select id="sStatus"><option value="active" ${s.status==='active'?'selected':''}>Active</option><option value="inactive" ${s.status!=='active'?'selected':''}>Inactive</option></select></div>
        <div class="field span-2"><label>Semester Type (automatic)</label><input value="${s.type}" disabled><span class="help">Odd semesters: 1st, 3rd, 5th · Even semesters: 2nd, 4th, 6th</span></div>
      </div></div>
      <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="sSave">${icon('check')} Save</button></div>`);
    ov.querySelector('#sSave').addEventListener('click',async()=>{
      s.name=ov.querySelector('#sName').value.trim()||s.name;
      s.status=ov.querySelector('#sStatus').value;
      await DB.put('semesters',s); await DB.cascadeSemester(s); UI.closeModal(ov); UI.toast('Semester updated',s.name,'success'); adminSemesters();
    });
  }));
}

/* ---------------- ACADEMIC SESSIONS ---------------- */
async function adminSessions(){
  pageEl().innerHTML=UI.spinner();
  const render=async()=>{
    const sessions=(await DB.getAll('academicSessions')).sort((a,b)=>b.name.localeCompare(a.name));
    pageEl().innerHTML=`
      <div class="page-head"><div><h1>Academic Session Management</h1><p>Create academic years and control which sessions are active.</p></div>
      <div class="page-actions"><button class="btn btn-royal" id="addBtn">${icon('plus')} New Session</button></div></div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Session</th><th>Start Date</th><th>End Date</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${sessions.map(s=>`<tr>
          <td class="td-main"><b>${esc(s.name)}</b></td>
          <td>${fmtDate(s.startDate)}</td><td>${fmtDate(s.endDate)}</td>
          <td>${UI.statusBadge(s.status)}</td>
          <td><div class="row-actions">
            <button class="btn btn-sm ${s.status==='active'?'btn-outline':'btn-success'}" data-toggle="${s.id}">${s.status==='active'?'Archive':'Activate'}</button>
            <button class="icon-btn" data-edit="${s.id}">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${s.id}">${icon('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table></div>`;
    pageEl().querySelector('#addBtn').addEventListener('click',()=>sessionModal(null,render));
    pageEl().querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>sessionModal(await DB.get('academicSessions',+b.dataset.edit),render)));
    pageEl().querySelectorAll('[data-toggle]').forEach(b=>b.addEventListener('click',async()=>{
      const s=await DB.get('academicSessions',+b.dataset.toggle);
      s.status=s.status==='active'?'archived':'active'; await DB.put('academicSessions',s);
      await DB.log('Admin','Session '+(s.status==='active'?'activated':'archived'),s.name); render();
    }));
    pageEl().querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      if(await UI.confirm('Delete session','Delete this academic session? Linked examinations keep their session label.')){
        await DB.del('academicSessions',+b.dataset.del); UI.toast('Session deleted','','success'); render();
      }
    }));
  };
  render();
}

function sessionModal(s,onDone){
  const ov=UI.modal(`${UI.modalHead(s?'Edit Session':'New Academic Session')}
    <div class="modal-body"><div class="form-error" id="seErr" style="display:none"><span></span></div>
      <div class="form-grid">
        <div class="field span-2"><label>Session Name <span class="req">*</span></label><input id="seName" value="${esc(s?.name||'')}" placeholder="e.g. 2026–2027"></div>
        ${UI.dateLists()}
        <div class="field"><label>Session Start — Day · Month · Year <span class="req">*</span></label>
          ${UI.dateFieldHtml('seStart',s?.startDate||'')}
          <span class="help">Type or choose — e.g. 07 · July · 2026.</span></div>
        <div class="field"><label>Session End — Day · Month · Year <span class="req">*</span></label>
          ${UI.dateFieldHtml('seEnd',s?.endDate||'')}
          <span class="help">Month can be a name or a number.</span></div>
        <div class="field span-2"><label>Status</label><select id="seStatus"><option value="active" ${!s||s.status==='active'?'selected':''}>Active</option><option value="archived" ${s&&s.status!=='active'?'selected':''}>Archived</option></select></div>
      </div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="seSave">${icon('check')} Save</button></div>`);
  ov.querySelector('#seSave').addEventListener('click',async()=>{
    const err=m=>{const e=ov.querySelector('#seErr');e.querySelector('span').textContent=m;e.style.display='flex';};
    const name=ov.querySelector('#seName').value.trim();
    const st=UI.parseManualDate(ov.querySelector('[data-manual-date="seStart"]'));
    const en=UI.parseManualDate(ov.querySelector('[data-manual-date="seEnd"]'));
    if(!name) return err('Session name is required.');
    if(st===null||en===null) return err('Enter the start and end dates — day, month and year are required.');
    if(st===false||en===false) return err('Invalid calendar date — check the highlighted day, month or year fields.');
    if(en<st) return err('End date must be after the start date.');
    const clash=await DB.oneByIndex('academicSessions','name',name);
    if(clash && clash.id!==s?.id) return err(`Session ${name} already exists.`);
    const rec={name,startDate:st,endDate:en,status:ov.querySelector('#seStatus').value};
    if(s){ const oldName=s.name; Object.assign(s,rec); await DB.put('academicSessions',s); await DB.cascadeSession(s,oldName); }
    else { rec.createdAt=new Date().toISOString(); await DB.add('academicSessions',rec); }
    await DB.log('Admin',s?'Session updated':'Session created',name);
    UI.closeModal(ov); UI.toast('Saved','Session '+name,'success'); onDone();
  });
}

/* ---------------- SETTINGS ---------------- */
async function adminSettings(){
  pageEl().innerHTML=UI.spinner();
  const college=(await DB.get('settings','college'))||{name:''};
  const rules=await Calc.rules();
  const scale=await Calc.grading();

  pageEl().innerHTML=`
    <div class="page-head"><div><h1>System Settings</h1><p>College profile, configurable grading rules and data tools.</p></div></div>
    <div class="grid-2" style="align-items:start">
      <div class="col gap-20">
        <div class="panel"><div class="panel-head"><h3>College Information</h3></div>
          <div class="panel-body form-grid">
            <div class="field span-2"><label>College Name</label><input id="coName" value="${esc(college.name||'')}"></div>
            <div class="field span-2"><label>Motto</label><input id="coMotto" value="${esc(college.motto||'')}"></div>
            <div class="field span-2"><label>Address</label><input id="coAddr" value="${esc(college.address||'')}"></div>
            <div class="field"><label>Examination Cell Email</label><input id="coEmail" value="${esc(college.email||'')}"></div>
            <div class="field"><label>Phone</label><input id="coPhone" value="${esc(college.phone||'')}"></div>
          </div>
          <div class="modal-foot"><button class="btn btn-royal" id="coSave">${icon('check')} Save College Info</button></div>
        </div>
        <div class="panel"><div class="panel-head"><h3>Result Computation Rules</h3></div>
          <div class="panel-body col gap-14">
            <label class="check-row"><input type="checkbox" id="ruleAll" ${rules.passAllSubjects?'checked':''}> A student must pass <b>&nbsp;every subject&nbsp;</b> to pass overall (uncheck for aggregate-based pass at 40%)</label>
            <div class="field"><label>Absent Student Policy</label>
              <select id="ruleAbsent">
                <option value="fail" ${rules.absentPolicy==='fail'?'selected':''}>Absent = Fail (never counted as zero marks; excluded from totals & rank)</option>
                <option value="exclude" ${rules.absentPolicy==='exclude'?'selected':''}>Exclude absent subjects from pass/fail decision (computed on attended subjects)</option>
              </select>
              <span class="help">Absent candidates are never silently awarded zero. This college-level rule controls how absence affects the overall result.</span>
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-royal" id="ruleSave">${icon('check')} Save Rules</button></div>
        </div>
        <div class="panel"><div class="panel-head"><div><h3>Account Security</h3><p>Change the administrator password</p></div></div>
          <div class="panel-body">
            <div class="form-grid" style="grid-template-columns:1fr">
              <div class="field"><label>Current Password</label><input type="password" id="apwCur"></div>
              <div class="field"><label>New Password (min 8 chars, letter + number)</label><input type="password" id="apwNew"></div>
              <div class="field"><label>Confirm New Password</label><input type="password" id="apwCnf"></div>
            </div>
          </div>
          <div class="modal-foot"><button class="btn btn-royal" id="apwSave">${icon('lock')} Update Password</button></div>
        </div>
        <div class="panel"><div class="panel-head"><h3>Data & Deployment</h3></div>
          <div class="panel-body">
            <div class="alert info">${icon('info')}<div><b>Frontend prototype.</b> All records live in IndexedDB inside <i>this browser and device only</i>. Real multi-user access across devices needs a secure backend (central database + server-side authentication) in a future version. Passwords are hashed with PBKDF2 (SHA-256) in the browser — far stronger than plain text, but a production system must still authenticate on a secure server.</div></div>
            <div class="flex gap-10 wrap">
              <button class="btn btn-outline" id="exportBtn">${icon('download')} Export Data (JSON)</button>
              <button class="btn btn-danger" id="resetBtn">${icon('refresh')} Erase & Rebuild Clean Database</button>
            </div>
          </div>
        </div>
      </div>
      <div class="panel"><div class="panel-head"><div><h3>Grading Scale</h3><p>Threshold bands — a percentage earns the grade of the highest band whose Min % it reaches (e.g. 79.6% ≥ 70 → A). Applied at the next result computation.</p></div></div>
        <div class="panel-body">
          <div class="table-wrap"><table class="data-table compact"><thead><tr><th>Min %</th><th>Max %</th><th>Grade</th><th>Points</th><th></th></tr></thead>
          <tbody id="gradeRows"></tbody></table></div>
          <button class="btn btn-sm btn-soft mt-14" id="gradeAdd">${icon('plus',14)} Add Band</button>
        </div>
        <div class="modal-foot"><button class="btn btn-royal" id="gradeSave">${icon('check')} Save Grading Scale</button></div>
      </div>
    </div>`;

  /* college info */
  pageEl().querySelector('#coSave').addEventListener('click',async()=>{
    await DB.put('settings',{key:'college',name:pageEl().querySelector('#coName').value.trim(),
      motto:pageEl().querySelector('#coMotto').value.trim(),address:pageEl().querySelector('#coAddr').value.trim(),
      email:pageEl().querySelector('#coEmail').value.trim(),phone:pageEl().querySelector('#coPhone').value.trim()});
    UI.toast('College info saved','Used on marksheets and routine printouts.','success');
  });

  /* rules */
  pageEl().querySelector('#ruleSave').addEventListener('click',async()=>{
    await DB.put('settings',{key:'rules',passAllSubjects:pageEl().querySelector('#ruleAll').checked,
      absentPolicy:pageEl().querySelector('#ruleAbsent').value});
    await DB.log('Admin','Result rules updated','');
    UI.toast('Rules saved','New rules apply to the next result computation.','success');
  });

  /* admin password change */
  pageEl().querySelector('#apwSave').addEventListener('click',async()=>{
    const cur=pageEl().querySelector('#apwCur').value, nw=pageEl().querySelector('#apwNew').value, cf=pageEl().querySelector('#apwCnf').value;
    const me=await DB.get('admins',Auth.session().id);
    if(!me) return UI.toast('Error','Admin account not found.','error');
    if(!(await Security.verify(cur, me.passwordHash))) return UI.toast('Incorrect password','Your current password does not match.','error');
    const pErr=Security.validate(nw); if(pErr) return UI.toast('Weak password',pErr,'error');
    if(nw!==cf) return UI.toast('Mismatch','New passwords do not match.','error');
    me.passwordHash=await Security.hash(nw); me.mustChangePassword=false; await DB.put('admins',me);
    /* clear the flag on the active session so the reminder stops immediately */
    const sess=Auth.session(); if(sess){ delete sess.mustChangePassword; Auth.save(sess); }
    await DB.log(me.name,'Administrator password changed','');
    pageEl().querySelector('#apwCur').value=pageEl().querySelector('#apwNew').value=pageEl().querySelector('#apwCnf').value='';
    UI.toast('Password updated','Use the new password at your next sign-in.','success');
  });

  /* grading scale editor */
  let rows=scale.map(r=>({...r}));
  const tbody=pageEl().querySelector('#gradeRows');
  const paint=()=>{ tbody.innerHTML=rows.map((r,i)=>`<tr>
      <td><input class="marks-input" data-i="${i}" data-f="min" type="number" min="0" max="100" value="${r.min}"></td>
      <td><input class="marks-input" data-i="${i}" data-f="max" type="number" min="0" max="100" value="${r.max}"></td>
      <td><input class="marks-input" data-i="${i}" data-f="grade" value="${esc(r.grade)}" maxlength="4" style="width:64px"></td>
      <td><input class="marks-input" data-i="${i}" data-f="points" type="number" min="0" max="10" value="${r.points}" style="width:64px"></td>
      <td><button class="icon-btn danger" data-rm="${i}">${icon('trash')}</button></td></tr>`).join('');
    tbody.querySelectorAll('input').forEach(inp=>inp.addEventListener('change',()=>{
      const r=rows[+inp.dataset.i]; r[inp.dataset.f]=inp.dataset.f==='grade'?inp.value.trim():+inp.value;
    }));
    tbody.querySelectorAll('[data-rm]').forEach(b=>b.addEventListener('click',()=>{ rows.splice(+b.dataset.rm,1); paint(); }));
  };
  paint();
  pageEl().querySelector('#gradeAdd').addEventListener('click',()=>{ rows.push({min:0,max:0,grade:'',points:0}); paint(); });
  pageEl().querySelector('#gradeSave').addEventListener('click',async()=>{
    if(!rows.length) return UI.toast('Invalid scale','Add at least one grade band.','error');
    for(const r of rows){
      if(!r.grade) return UI.toast('Invalid scale','Every band needs a grade label.','error');
      if(r.min<0||r.max>100||r.min>r.max) return UI.toast('Invalid scale','Percentages must be 0–100 with min ≤ max.','error');
    }
    if(new Set(rows.map(r=>r.grade)).size!==rows.length) return UI.toast('Invalid scale','Grade labels must be unique.','error');
    await DB.put('settings',{key:'grading',scale:rows});
    await DB.log('Admin','Grading scale updated',rows.length+' bands');
    UI.toast('Grading scale saved','It will be used when results are next computed.','success');
  });

  /* data tools */
  pageEl().querySelector('#exportBtn').addEventListener('click',async()=>{
    const data=await DB.exportAll();
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
    a.download='college-examination-system-backup.json'; a.click(); URL.revokeObjectURL(a.href);
    UI.toast('Export ready','JSON backup downloaded (blobs/photos omitted).','success');
  });
  pageEl().querySelector('#resetBtn').addEventListener('click',async()=>{
    if(await UI.confirm('Erase all data','This permanently erases EVERY record in this browser (students, teachers, subjects, marks, results) and rebuilds a clean database with only the bootstrap administrator account. This cannot be undone. Continue?','Erase Everything')){
      await DB.reset(); sessionStorage.clear(); location.href='../login.html';
    }
  });
}

/* ---------------- SUBJECTS ---------------- */
async function adminSubjects(){
  pageEl().innerHTML=UI.spinner();
  const state={dept:'',sem:'',q:''};

  const paint=async()=>{
    const [subjects,depts,teachers,marks]=await Promise.all([
      DB.getAll('subjects'),DB.getAll('departments'),DB.getAll('teachers'),DB.getAll('marks')]);
    const tName={}; teachers.forEach(t=>tName[t.id]=t.name);
    let list=subjects.slice().sort((a,b)=>a.departmentId-b.departmentId||a.semester-b.semester||a.code.localeCompare(b.code));
    if(state.dept) list=list.filter(s=>s.departmentId===+state.dept);
    if(state.sem) list=list.filter(s=>s.semester===+state.sem);
    if(state.q){ const q=state.q.toLowerCase(); list=list.filter(s=>s.code.toLowerCase().includes(q)||s.name.toLowerCase().includes(q)); }

    pageEl().querySelector('#tbl').innerHTML=`
      <div class="table-wrap scroll"><table class="data-table">
        <thead><tr><th>Code</th><th>Subject</th><th>Department</th><th>Semester</th><th class="num">Max / Pass</th><th class="num">Credits</th><th>Assigned Teacher</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${list.map(s=>`<tr>
          <td><span class="badge navy">${esc(s.code)}</span></td>
          <td class="td-main"><b>${esc(s.name)}</b><span>${esc(s.course||'')}</span></td>
          <td>${esc(s.department)}</td>
          <td><span class="sem-badge ${s.semester%2===1?'odd':'even'}">${UI.semName(s.semester)} · ${s.semester%2===1?'Odd':'Even'}</span></td>
          <td class="num">${s.maxMarks} / ${s.passMarks}</td>
          <td class="num">${s.credits}</td>
          <td>${s.teacherId?esc(tName[s.teacherId]||'—'):'<span class="badge warning">Unassigned</span>'}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-edit="${s.id}" title="Edit">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${s.id}" title="Delete">${icon('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table>
        ${list.length?`<div class="table-foot"><span>${list.length} subject(s)</span><span>Assign teachers here or via Teacher Management</span></div>`:UI.emptyState('No subjects found','Add subjects per department and semester.','book')}
      </div>`;

    pageEl().querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>{
      subjectModal(subjects.find(x=>x.id===+b.dataset.edit),{depts,teachers},paint);
    }));
    pageEl().querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      const s=subjects.find(x=>x.id===+b.dataset.del);
      if(marks.some(m=>m.subjectId===s.id)){ UI.toast('Cannot delete','Marks records exist for this subject.','error'); return; }
      if(await UI.confirm('Delete subject',`Delete ${s.code} — ${s.name}?`)){
        if(s.teacherId){ const t=teachers.find(x=>x.id===s.teacherId); if(t){ t.assignedSubjects=(t.assignedSubjects||[]).filter(id=>id!==s.id); await DB.put('teachers',t); } }
        await DB.del('subjects',s.id); await DB.log('Admin','Subject deleted',s.code+' — '+s.name);
        UI.toast('Subject deleted',s.code,'success'); paint();
      }
    }));
  };

  const depts=await DB.getAll('departments'), teachers=await DB.getAll('teachers');
  pageEl().innerHTML=`
    <div class="page-head"><div><h1>Subject Management</h1><p>Subjects with codes, credits, marks ceilings and teacher assignment.</p></div>
    <div class="page-actions"><button class="btn btn-royal" id="addBtn">${icon('plus')} Add Subject</button></div></div>
    <div class="toolbar">
      <div class="search-box">${icon('search')}<input id="q" placeholder="Search code or subject name…"></div>
      <select id="fDept"><option value="">All Departments</option>${optRows(depts)}</select>
      <select id="fSem"><option value="">All Semesters</option>${SEM_NAMES.map((n,i)=>`<option value="${i+1}">${n}</option>`).join('')}</select>
    </div>
    <div id="tbl">${UI.spinner()}</div>`;
  pageEl().querySelector('#q').addEventListener('input',e=>{ state.q=e.target.value; paint(); });
  pageEl().querySelector('#fDept').addEventListener('change',e=>{ state.dept=e.target.value; paint(); });
  pageEl().querySelector('#fSem').addEventListener('change',e=>{ state.sem=e.target.value; paint(); });
  pageEl().querySelector('#addBtn').addEventListener('click',()=>subjectModal(null,{depts,teachers},paint));
  paint();
}

function subjectModal(s,ctx,onDone){
  const {depts,teachers}=ctx;
  DB.getAll('courses').then(courses=>{
    const ov=UI.modal(`${UI.modalHead(s?'Edit Subject':'Add Subject')}
      <div class="modal-body"><div class="form-error" id="sbErr" style="display:none"><span></span></div>
        <div class="form-grid">
          <div class="field"><label>Subject Code <span class="req">*</span></label><input id="sbCode" value="${esc(s?.code||'')}" style="text-transform:uppercase" placeholder="e.g. CS301"></div>
          <div class="field"><label>Subject Name <span class="req">*</span></label><input id="sbName" value="${esc(s?.name||'')}" placeholder="e.g. Machine Learning"></div>
          <div class="field"><label>Department <span class="req">*</span></label><select id="sbDept">${optRows(depts,s?.departmentId)}</select></div>
          <div class="field"><label>Course <span class="req">*</span></label><select id="sbCourse"><option value="">Select</option></select></div>
          <div class="field"><label>Semester <span class="req">*</span></label><select id="sbSem">${SEM_NAMES.map((n,i)=>`<option value="${i+1}" ${s&&s.semester===i+1?'selected':''}>${n}</option>`).join('')}</select><span class="help">Odd/Even type is derived automatically</span></div>
          <div class="field"><label>Assigned Teacher</label><select id="sbTeacher"><option value="">— Unassigned —</option>${teachers.map(t=>`<option value="${t.id}" ${s&&s.teacherId===t.id?'selected':''}>${esc(t.name)} (${esc(t.teacherId)})</option>`).join('')}</select></div>
          <div class="field"><label>Maximum Marks <span class="req">*</span></label><input id="sbMax" type="number" min="1" value="${s?.maxMarks||100}"></div>
          <div class="field"><label>Pass Marks <span class="req">*</span></label><input id="sbPass" type="number" min="0" value="${s?.passMarks||40}"></div>
          <div class="field"><label>Credits</label><input id="sbCredits" type="number" min="0" max="10" value="${s?.credits||4}"></div>
        </div></div>
      <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="sbSave">${icon('check')} Save Subject</button></div>`,'wide');

    const deptSel=ov.querySelector('#sbDept'), courseSel=ov.querySelector('#sbCourse');
    const fillCourses=sel=>{ courseSel.innerHTML='<option value="">Select</option>'+courses.filter(c=>c.departmentId===+deptSel.value).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join(''); };
    deptSel.addEventListener('change',()=>fillCourses()); if(s) fillCourses(s.courseId); else fillCourses();

    ov.querySelector('#sbSave').addEventListener('click',async()=>{
      const err=m=>{const e=ov.querySelector('#sbErr');e.querySelector('span').textContent=m;e.style.display='flex';};
      const g=id=>ov.querySelector('#'+id).value.trim();
      const code=g('sbCode').toUpperCase(), name=g('sbName');
      const dept=depts.find(d=>d.id===+g('sbDept')), course=courses.find(c=>c.id===+g('sbCourse'));
      const maxM=+ov.querySelector('#sbMax').value, passM=+ov.querySelector('#sbPass').value;
      if(!code||!name||!dept||!course) return err('Code, name, department and course are required.');
      if(passM>maxM) return err('Pass marks cannot exceed maximum marks.');
      const clash=await DB.oneByIndex('subjects','code',code);
      if(clash && clash.id!==s?.id) return err(`Subject code ${code} already exists.`);
      const sems=await DB.getAll('semesters');
      const semNum=+g('sbSem');
      const teacherId=ov.querySelector('#sbTeacher').value?+ov.querySelector('#sbTeacher').value:null;
      const rec={code,name,departmentId:dept.id,department:dept.name,courseId:course.id,course:course.name,
        semester:semNum,semesterId:(sems.find(x=>x.number===semNum)||{}).id,teacherId,
        maxMarks:maxM,passMarks:passM,credits:+ov.querySelector('#sbCredits').value||0};
      let id;
      const previous=s?{code:s.code,name:s.name,maxMarks:s.maxMarks,passMarks:s.passMarks,teacherId:s.teacherId}:{};
      if(s){ Object.assign(s,rec); id=s.id; await DB.put('subjects',s); await DB.cascadeSubject(s,previous); } else { rec.createdAt=new Date().toISOString(); id=await DB.add('subjects',rec); }
      /* keep teacher assignment mirrors in sync */
      for(const t of teachers){
        const has=(t.assignedSubjects||[]).includes(id);
        if(t.id===teacherId){
          if(!has) t.assignedSubjects=[...(t.assignedSubjects||[]),id];
          t.assignedSemesters=[...new Set([...(t.assignedSemesters||[]),rec.semesterId])];
          t.assignedDepartments=[...new Set([...(t.assignedDepartments||[]),rec.departmentId])];
          t.assignedCourses=[...new Set([...(t.assignedCourses||[]),rec.courseId])];
          await DB.put('teachers',t);
        }
        if(t.id!==teacherId && has){ t.assignedSubjects=(t.assignedSubjects||[]).filter(x=>x!==id); await DB.put('teachers',t); }
      }
      if(teacherId && previous.teacherId!==teacherId){
        const teacher=teachers.find(t=>t.id===teacherId);
        if(teacher) await Notify.push({role:'teacher',uid:teacher.teacherId,title:'Subject assigned',
          message:`${code} — ${name} (${UI.semName(semNum)}) was assigned to you by the administrator.`,type:'info',link:'assigned-subjects.html'});
      }
      /* Changing a subject's marks scheme can change totals and pass/fail.
         Recompute every affected examination from approved/published marks. */
      if(s && (previous.maxMarks!==s.maxMarks||previous.passMarks!==s.passMarks)){
        const affected=[...new Set((await DB.byIndex('marks','subjectId',s.id))
          .filter(m=>m.status==='approved'||m.status==='published').map(m=>m.examId))];
        for(const examId of affected) await Calc.computeExam(examId,{});
      }
      await DB.log('Admin',s?'Subject updated':'Subject added',code+' — '+name);
      UI.closeModal(ov); UI.toast('Subject saved',code,'success'); onDone();
    });
  });
}

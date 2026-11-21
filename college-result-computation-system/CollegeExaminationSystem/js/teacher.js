/* =============================================================
   teacher.js — Teacher dashboard, assigned subjects, student
   lists for assigned classes, profile & password change.
   Teachers see ONLY their assigned subjects/semesters.
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  const map={dashboard:teacherDashboard,'assigned-subjects':teacherSubjects,students:teacherStudents,profile:teacherProfile};
  const fn=map[document.body.dataset.page]; if(fn) fn();
});

async function getMe(){
  const s=Auth.session();
  return DB.oneByIndex('teachers','teacherId',s.uid);
}

/* ---------------- DASHBOARD ---------------- */
async function teacherDashboard(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const me=await getMe();
  const [subjects,students,marks,routines,notes]=await Promise.all([
    DB.getAll('subjects'),DB.getAll('students'),DB.byIndex('marks','teacherId',me.id),
    DB.getAll('examinationRoutines'),Notify.forUser('teacher',me.teacherId,6)]);
  const mySubs=subjects.filter(s=>s.teacherId===me.id);
  const semRows=await DB.getAll('semesters');
  const semNoOf=id=>{const r=semRows.find(x=>x.id===id);return r?r.number:null;};
  const semNumsResolved=(me.assignedSemesters||[]).map(semNoOf).filter(Boolean);
  const taught=students.filter(st=>(me.assignedDepartments||[]).includes(st.departmentId)&&semNumsResolved.includes(st.currentSemester));
  const drafts=marks.filter(m=>m.status==='draft').length;
  const pending=marks.filter(m=>m.status==='submitted').length;

  const today=new Date().toISOString().slice(0,10);
  const upcoming=routines
    .filter(r=>r.status==='published'&&(me.assignedSemesters||[]).includes(r.semesterId)&&(me.assignedDepartments||[]).includes(r.departmentId))
    .flatMap(r=>(r.entries||[]).map(e=>({...e,routine:r})))
    .filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);

  const stat=(i,c,v,l)=>`<div class="stat-card"><div class="stat-ico ${c}">${icon(i,23)}</div><div><h3>${v}</h3><p>${l}</p></div></div>`;
  pg.innerHTML=`
    <div class="page-head"><div><h1>Faculty Dashboard</h1><p>Welcome back, ${esc(me.name)}. Your assigned teaching workload at a glance.</p></div>
    <div class="page-actions"><a class="btn btn-royal" href="marks-entry.html">${icon('pen')} Enter Marks</a></div></div>
    <div class="panel mb-20"><div class="panel-body profile-card">
      <span class="avatar xl">${initials(me.name)}</span>
      <div class="pinfo"><b>${esc(me.name)}</b><span>${esc(me.designation||'Faculty')} · ${esc(me.department)}</span><br>
      <span class="small muted">${esc(me.teacherId)} · ${esc(me.email)} · ${esc(me.mobile||'')}</span></div>
      <span class="grow"></span>
      <a class="btn btn-outline" href="profile.html">${icon('user')} My Profile</a>
    </div></div>
    <div class="stat-grid">
      ${stat('book','royal',mySubs.length,'Assigned Subjects')}
      ${stat('users','navy',taught.length,'Students in Assigned Classes')}
      ${stat('pen','orange',drafts,'Draft Marks (unsent)')}
      ${stat('send','sky',pending,'Awaiting Admin Review')}
      ${stat('calendarDays','green',upcoming.length,'Upcoming Exam Slots')}
    </div>
    <div class="grid-main">
      <div class="panel"><div class="panel-head"><div><h3>Upcoming Examinations</h3><p>Published routine slots in your assigned semesters</p></div><a class="btn btn-sm btn-soft" href="examination-routine.html">${icon('calendarDays',14)} All Routines</a></div>
        <div class="panel-body" style="padding-top:8px">
          ${upcoming.length?upcoming.map(e=>`<div class="act-item"><span class="act-dot" style="background:var(--royal)"></span>
            <div><b class="text-navy">${esc(e.subjectCode)} — ${esc(e.subjectName)}</b><br>
            <span class="muted small">${fmtDate(e.date)} · ${fmtTime(e.startTime)} – ${fmtTime(e.endTime)} · ${esc(e.room||'Venue TBA')}</span><br>
            <span class="small" style="color:var(--royal)">${esc(e.routine.semesterName)} · ${esc(e.routine.department)}</span></div></div>`).join('')
          :UI.emptyState('No upcoming slots','Published examination schedules will appear here.','calendarDays')}
        </div></div>
      <div class="panel"><div class="panel-head"><h3>Notifications</h3></div>
        <div class="panel-body" style="padding-top:8px">
          ${notes.length?notes.map(n=>`<div class="act-item"><span class="act-dot" style="background:${n.read?'#c4cede':'var(--warning)'}"></span>
            <div><b class="text-navy">${esc(n.title)}</b><br><span class="muted small">${esc(n.message)}</span><time>${timeAgo(n.createdAt)}</time></div></div>`).join('')
          :'<p class="muted small">No notifications.</p>'}
        </div></div>
    </div>`;
}

/* ---------------- ASSIGNED SUBJECTS ---------------- */
async function teacherSubjects(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const me=await getMe();
  const subjects=(await DB.getAll('subjects')).filter(s=>s.teacherId===me.id);
  pg.innerHTML=`
    <div class="page-head"><div><h1>Assigned Subjects</h1><p>Subjects the examination cell has assigned to your Teacher ID. You can enter marks only for these.</p></div></div>
    ${subjects.length?`<div class="grid-3">${subjects.map(s=>`
      <div class="panel"><div class="panel-body">
        <div class="flex items-center justify-between mb-10"><span class="badge navy">${esc(s.code)}</span><span class="sem-badge ${s.semester%2===1?'odd':'even'}">${UI.semName(s.semester)}</span></div>
        <h3 class="mb-6">${esc(s.name)}</h3>
        <p class="small muted mb-14">${esc(s.department)}<br>${esc(s.course||'')}</p>
        <div class="kv mb-14">
          <div><span>Max Marks</span><b>${s.maxMarks}</b></div>
          <div><span>Pass Marks</span><b>${s.passMarks}</b></div>
          <div><span>Credits</span><b>${s.credits}</b></div>
        </div>
        <a class="btn btn-sm btn-royal" href="marks-entry.html">${icon('pen',14)} Enter Marks</a>
      </div></div>`).join('')}</div>`:`<div class="panel"><div class="panel-body">${UI.emptyState('No subjects assigned','Ask the administrator to assign subjects from Teacher Management.','book')}</div></div>`}`;
}

/* ---------------- STUDENTS OF ASSIGNED CLASSES ---------------- */
async function teacherStudents(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const me=await getMe();
  const semRows=await DB.getAll('semesters');
  const semNoOf=id=>{const r=semRows.find(x=>x.id===id);return r?r.number:null;};
  const depts=(await DB.getAll('departments')).filter(d=>(me.assignedDepartments||[]).includes(d.id));
  const semNums=(me.assignedSemesters||[]).map(semNoOf).filter(Boolean);
  const state={q:'',dept:'',sem:''};
  const paint=async()=>{
    let list=(await DB.getAll('students')).filter(st=>(me.assignedDepartments||[]).includes(st.departmentId)&&semNums.includes(st.currentSemester));
    if(state.q){const q=state.q.toLowerCase();list=list.filter(s=>s.name.toLowerCase().includes(q)||s.regNo.toLowerCase().includes(q));}
    if(state.dept)list=list.filter(s=>s.departmentId===+state.dept);
    if(state.sem)list=list.filter(s=>s.currentSemester===+state.sem);
    list.sort((a,b)=>a.currentSemester-b.currentSemester||a.regNo.localeCompare(b.regNo));
    pg.querySelector('#tbl').innerHTML=`
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Student</th><th>Reg. No</th><th>Roll</th><th>Department</th><th>Semester</th><th>Contact</th></tr></thead>
        <tbody>${list.map(s=>`<tr>
          <td><div class="cell-user">${UI.avatarHtml(s)}<div class="td-main"><b>${esc(s.name)}</b><span>${esc(s.gender)}</span></div></div></td>
          <td><span class="badge royal">${esc(s.regNo)}</span></td><td>${esc(s.rollNo)}</td>
          <td>${esc(s.department)}</td><td>${UI.semName(s.currentSemester)}</td>
          <td class="small muted">${esc(s.email)}<br>${esc(s.mobile)}</td></tr>`).join('')}</tbody></table>
        ${list.length?`<div class="table-foot"><span>${list.length} student(s) in your assigned classes</span><span>View only — marks are managed in Marks Entry</span></div>`:UI.emptyState('No students found','No students match the current filters.','users')}</div>`;
  };
  pg.innerHTML=`
    <div class="page-head"><div><h1>Students — My Classes</h1><p>Students in the departments and semesters assigned to you.</p></div></div>
    <div class="toolbar">
      <div class="search-box">${icon('search')}<input id="q" placeholder="Search name or registration number…"></div>
      <select id="fDept"><option value="">All my departments</option>${depts.map(d=>`<option value="${d.id}">${esc(d.code||d.name)}</option>`).join('')}</select>
      <select id="fSem"><option value="">All my semesters</option>${semNums.map(n=>`<option value="${n}">${UI.semName(n)}</option>`).join('')}</select>
    </div>
    <div id="tbl">${UI.spinner()}</div>`;
  pg.querySelector('#q').addEventListener('input',e=>{state.q=e.target.value;paint();});
  pg.querySelector('#fDept').addEventListener('change',e=>{state.dept=e.target.value;paint();});
  pg.querySelector('#fSem').addEventListener('change',e=>{state.sem=e.target.value;paint();});
  paint();
}

/* ---------------- PROFILE + PASSWORD ---------------- */
async function teacherProfile(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const me=await getMe();
  const sems=await DB.getAll('semesters');
  const mySemNames=(me.assignedSemesters||[]).map(id=>{const r=sems.find(x=>x.id===id);return r?r.name:'';}).filter(Boolean);
  pg.innerHTML=`
    <div class="page-head"><div><h1>My Profile</h1><p>Faculty account details and security.</p></div></div>
    <div class="grid-2" style="align-items:start">
      <div class="panel"><div class="panel-head"><h3>Profile Details</h3></div>
        <div class="panel-body">
          <div class="profile-card mb-20"><span class="avatar xl">${initials(me.name)}</span>
            <div class="pinfo"><b>${esc(me.name)}</b><span>${esc(me.teacherId)} · ${esc(me.designation||'Faculty')}</span></div></div>
          <div class="kv">
            <div><span>Teacher ID</span><b>${esc(me.teacherId)}</b></div>
            <div><span>Department</span><b>${esc(me.department)}</b></div>
            <div><span>Email</span><b>${esc(me.email)}</b></div>
            <div><span>Mobile</span><b>${esc(me.mobile||'—')}</b></div>
            <div><span>Assigned Semesters</span><b>${mySemNames.join(', ')||'—'}</b></div>
            <div><span>Assigned Subjects</span><b>${(me.assignedSubjects||[]).length}</b></div>
          </div>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>Change Password</h3></div>
        <div class="panel-body">
          <div class="alert warning">${icon('alert')}<div><b>Demo environment.</b> In the production deployment, password changes run through the secure server with one-time e-mail verification. This form updates the local prototype hash only.</div></div>
          <div class="form-grid" style="grid-template-columns:1fr">
            <div class="field"><label>Current Password</label><input type="password" id="pwCur"></div>
            <div class="field"><label>New Password (min 8 chars, letter + number)</label><input type="password" id="pwNew"></div>
            <div class="field"><label>Confirm New Password</label><input type="password" id="pwCnf"></div>
          </div>
          <div class="form-actions"><button class="btn btn-royal" id="pwSave">${icon('lock')} Update Password</button></div>
        </div></div>
    </div>`;
  pg.querySelector('#pwSave').addEventListener('click',async()=>{
    const cur=pg.querySelector('#pwCur').value, nw=pg.querySelector('#pwNew').value, cf=pg.querySelector('#pwCnf').value;
    if(!(await Security.verify(cur, me.passwordHash))) return UI.toast('Incorrect password','Your current password does not match.','error');
    const pErr=Security.validate(nw); if(pErr) return UI.toast('Weak password',pErr,'error');
    if(nw!==cf) return UI.toast('Mismatch','New passwords do not match.','error');
    me.passwordHash=await Security.hash(nw); await DB.put('teachers',me);
    await DB.log(me.name,'Password updated','');
    pg.querySelector('#pwCur').value=pg.querySelector('#pwNew').value=pg.querySelector('#pwCnf').value='';
    UI.toast('Password updated','Use the new password on your next sign-in.','success');
  });
}

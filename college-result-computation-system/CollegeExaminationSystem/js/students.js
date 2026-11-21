/* =============================================================
   students.js — Admin → Student Management
   Add / edit / delete / search / filter / profile + semester
   history and published result overview per student.
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  if(document.body.dataset.page==='students') initAdminStudents();
});

function buildHistory(sem,admYear){
  const h=[]; for(let s=1;s<=sem;s++){ const y=admYear+Math.floor((s-1)/2); h.push({semester:s,academicYear:`${y}–${y+1}`,status:s===sem?'In Progress':'Completed'});} return h;
}

async function initAdminStudents(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const state={q:'',dept:'',sem:''};
  const [depts,courses,sessions]=await Promise.all([DB.getAll('departments'),DB.getAll('courses'),DB.getAll('academicSessions')]);

  const load=async()=>{
    let list=await DB.getAll('students');
    if(state.q){ const q=state.q.toLowerCase(); list=list.filter(s=>s.name.toLowerCase().includes(q)||s.regNo.toLowerCase().includes(q)); }
    if(state.dept) list=list.filter(s=>s.departmentId===+state.dept);
    if(state.sem) list=list.filter(s=>s.currentSemester===+state.sem);
    list.sort((a,b)=>a.regNo.localeCompare(b.regNo));
    return list;
  };

  const paint=async()=>{
    const list=await load();
    pg.querySelector('#tbl').innerHTML=`
      <div class="table-wrap scroll"><table class="data-table">
        <thead><tr><th>Student</th><th>Reg. No</th><th>Roll No</th><th>Department / Course</th><th>Semester</th><th>Session</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${list.map(s=>`<tr>
          <td><div class="cell-user">${UI.avatarHtml(s)}<div class="td-main"><b>${esc(s.name)}</b><span>${esc(s.email)}</span></div></div></td>
          <td><span class="badge royal">${esc(s.regNo)}</span></td>
          <td>${esc(s.rollNo)}</td>
          <td class="td-main"><b>${esc(s.department)}</b><span>${esc(s.course)}</span></td>
          <td>${UI.semName(s.currentSemester)}</td>
          <td>${esc(s.academicSession||'—')}</td>
          <td><div class="row-actions">
            <button class="icon-btn" data-view="${s.id}" title="View profile">${icon('eye')}</button>
            <button class="icon-btn" data-edit="${s.id}" title="Edit">${icon('edit')}</button>
            <button class="icon-btn danger" data-del="${s.id}" title="Delete">${icon('trash')}</button>
          </div></td></tr>`).join('')}</tbody></table>
        ${list.length?`<div class="table-foot"><span>${list.length} student(s) found</span><span>Sorted by registration number</span></div>`:UI.emptyState('No matching students','Adjust the search or filters, or register a new student.','users')}
      </div>`;

    pg.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>viewStudent(+b.dataset.view)));
    pg.querySelectorAll('[data-edit]').forEach(b=>b.addEventListener('click',async()=>studentModal(await DB.get('students',+b.dataset.edit),{depts,courses,sessions},paint)));
    pg.querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',async()=>{
      const s=await DB.get('students',+b.dataset.del);
      if(await UI.confirm('Delete student',`Permanently delete ${s.name} (${s.regNo})? Their marks records are kept for audit.`)){
        await DB.del('students',s.id); await DB.log('Admin','Student deleted',`${s.name} (${s.regNo})`);
        UI.toast('Student deleted',s.regNo,'success'); paint();
      }
    }));
  };

  pg.innerHTML=`
    <div class="page-head"><div><h1>Student Management</h1><p>Register students, maintain records and review semester history.</p></div>
    <div class="page-actions"><a class="btn btn-outline" href="../register.html" target="_blank">${icon('idCard')} Public Registration Form</a>
    <button class="btn btn-royal" id="addBtn">${icon('plus')} Add Student</button></div></div>
    <div class="toolbar">
      <div class="search-box">${icon('search')}<input id="q" placeholder="Search by name or registration number…"></div>
      <select id="fDept"><option value="">All Departments</option>${optRows(depts)}</select>
      <select id="fSem"><option value="">All Semesters</option>${SEM_NAMES.map((n,i)=>`<option value="${i+1}">${n}</option>`).join('')}</select>
    </div>
    <div id="tbl">${UI.spinner()}</div>`;

  pg.querySelector('#q').addEventListener('input',e=>{ state.q=e.target.value; paint(); });
  pg.querySelector('#fDept').addEventListener('change',e=>{ state.dept=e.target.value; paint(); });
  pg.querySelector('#fSem').addEventListener('change',e=>{ state.sem=e.target.value; paint(); });
  pg.querySelector('#addBtn').addEventListener('click',()=>studentModal(null,{depts,courses,sessions},paint));
  paint();
}

/* view: full profile + semester history + published results */
async function viewStudent(id){
  const s=await DB.get('students',id);
  const scale=await Calc.grading();   /* live-derive displayed grades from the current scale */
  const dispGradeOf=r=> r.overall==='PASS' ? Calc.gradeOf(r.percentage,scale) : 'F';
  const results=(await DB.byIndex('results','regNo',s.regNo)).filter(r=>r.status==='published');
  UI.modal(`${UI.modalHead('Student Profile')}
    <div class="modal-body">
      <div class="profile-card mb-20">${UI.avatarHtml(s,'xl')}
        <div class="pinfo"><b>${esc(s.name)}</b><span>${esc(s.regNo)} · ${esc(s.course)}</span><br>
        <span class="badge royal mt-6">${UI.semName(s.currentSemester)}</span></div></div>
      <div class="kv mb-20">
        <div><span>Roll Number</span><b>${esc(s.rollNo)}</b></div>
        <div><span>Date of Birth</span><b>${fmtDate(s.dob)}</b></div>
        <div><span>Gender</span><b>${esc(s.gender)}</b></div>
        <div><span>Mobile</span><b>${esc(s.mobile)}</b></div>
        <div><span>Department</span><b>${esc(s.department)}</b></div>
        <div><span>Admission Year</span><b>${s.admissionYear}</b></div>
        <div><span>Academic Session</span><b>${esc(s.academicSession||'—')}</b></div>
        <div><span>Status</span><b class="text-success">${esc(s.status||'active')}</b></div>
      </div>
      <h4 class="mb-10">Semester History</h4>
      <div class="table-wrap mb-20"><table class="data-table compact"><thead><tr><th>Semester</th><th>Academic Year</th><th>Status</th></tr></thead><tbody>
        ${(s.semesterHistory||[]).map(h=>`<tr><td>${UI.semName(h.semester)}</td><td>${esc(h.academicYear)}</td><td>${h.status==='Completed'?'<span class="badge success">Completed</span>':'<span class="badge info">In Progress</span>'}</td></tr>`).join('')}
      </tbody></table></div>
      <h4 class="mb-10">Published Results</h4>
      ${results.length?results.map(r=>`<div class="act-item"><span class="act-dot" style="background:${r.overall==='PASS'?'var(--success)':'var(--danger)'}"></span>
        <div><b class="text-navy">${esc(r.examName)}</b> <span class="muted small">· ${esc(r.session)} · ${r.semesterName}</span><br>
        <span class="small">${r.percentage}% · Grade ${dispGradeOf(r)} · ${r.overall}${r.rank?` · Rank ${r.rank}`:''}</span></div></div>`).join(''):'<p class="muted small">No published results yet.</p>'}
    </div>`,'wide');
}

/* add / edit modal */
function studentModal(s,ctx,onDone){
  const {depts,courses,sessions}=ctx;
  const cy=new Date().getFullYear();
  const ov=UI.modal(`${UI.modalHead(s?'Edit Student':'Register Student')}
    <div class="modal-body"><div class="form-error" id="stErr" style="display:none"><span></span></div>
      <div class="form-grid">
        <div class="field span-2"><label>Full Name <span class="req">*</span></label><input id="fName" value="${esc(s?.name||'')}"></div>
        <div class="field"><label>Registration Number <span class="req">*</span></label><input id="fReg" value="${esc(s?.regNo||'')}" ${s?'disabled':''} placeholder="e.g. REG2025CS003"><span class="help">Unique — used for student login</span></div>
        <div class="field"><label>Roll Number <span class="req">*</span></label><input id="fRoll" value="${esc(s?.rollNo||'')}"></div>
        <div class="field"><label>Date of Birth <span class="req">*</span></label><input id="fDob" type="date" value="${s?.dob||''}"></div>
        <div class="field"><label>Gender <span class="req">*</span></label><select id="fGender">${['Male','Female','Other'].map(g=>`<option ${s?.gender===g?'selected':''}>${g}</option>`).join('')}</select></div>
        <div class="field"><label>Email Address <span class="req">*</span></label><input id="fEmail" type="email" value="${esc(s?.email||'')}"></div>
        <div class="field"><label>Mobile Number <span class="req">*</span></label><input id="fMob" value="${esc(s?.mobile||'')}"></div>
        <div class="field"><label>Department <span class="req">*</span></label><select id="fDept"><option value="">Select</option>${optRows(depts,s?.departmentId)}</select></div>
        <div class="field"><label>Course <span class="req">*</span></label><select id="fCourse"><option value="">Select department first</option></select></div>
        <div class="field"><label>Current Semester <span class="req">*</span></label><select id="fSem">${SEM_NAMES.map((n,i)=>`<option value="${i+1}" ${s&&s.currentSemester===i+1?'selected':''}>${n}</option>`).join('')}</select></div>
        <div class="field"><label>Academic Session <span class="req">*</span></label><select id="fSession">${sessions.map(x=>`<option ${s&&s.academicSession===x.name?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>
        <div class="field"><label>Admission Year <span class="req">*</span></label><select id="fYear">${Array.from({length:8},(_,i)=>cy-i).map(y=>`<option ${s&&s.admissionYear===y?'selected':''}>${y}</option>`).join('')}</select></div>
        <div class="field"><label>${s?'Set New Password':'Login Password'} ${s?'<span class="muted" style="font-weight:400">(leave blank to keep current)</span>':'<span class="req">*</span>'}</label>
          <input id="fPw" type="password" placeholder="Min 8 chars, letter + number" autocomplete="new-password"><span class="help">Student signs in with registration number + this password.</span></div>
        <div class="field"><label>${s?'Confirm New Password':'Confirm Password'} ${s?'':'<span class="req">*</span>'}</label>
          <input id="fPw2" type="password" placeholder="Repeat password" autocomplete="new-password"></div>
      </div></div>
    <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-royal" id="fSave">${icon('check')} ${s?'Save Changes':'Register Student'}</button></div>`,'wide');

  const deptSel=ov.querySelector('#fDept'), courseSel=ov.querySelector('#fCourse');
  const fillCourses=sel=>{ courseSel.innerHTML='<option value="">Select</option>'+courses.filter(c=>c.departmentId===+deptSel.value).map(c=>`<option value="${c.id}" ${c.id===sel?'selected':''}>${esc(c.name)}</option>`).join(''); };
  deptSel.addEventListener('change',()=>fillCourses());
  if(s) fillCourses(s.courseId);

  ov.querySelector('#fSave').addEventListener('click',async()=>{
    const err=m=>{const e=ov.querySelector('#stErr');e.querySelector('span').textContent=m;e.style.display='flex';};
    const g=id=>ov.querySelector('#'+id).value.trim();
    const dept=depts.find(d=>d.id===+g('fDept')); const course=courses.find(c=>c.id===+g('fCourse'));
    if(!g('fName')||!g('fRoll')||!g('fEmail')||!g('fMob')||!g('fDob')) return err('Please fill all required fields.');
    if(!dept||!course) return err('Select department and course.');
    const sem=+g('fSem'), year=+g('fYear');
    const pw=ov.querySelector('#fPw').value, pw2=ov.querySelector('#fPw2').value;
    if(!s){
      if(pw!==pw2) return err('Passwords do not match.');
      const r=await Auth.registerStudent({name:g('fName'),regNo:g('fReg'),rollNo:g('fRoll'),dob:g('fDob'),gender:g('fGender'),email:g('fEmail'),mobile:g('fMob'),departmentId:dept.id,courseId:course.id,currentSemester:sem,academicSession:g('fSession'),admissionYear:year,photo:null,password:pw,confirmPassword:pw2});
      if(!r.ok) return err(r.msg);
      UI.toast('Student registered',`${g('fName')} can now sign in with ${g('fReg').toUpperCase()}.`,'success');
    }else{
      if(pw||pw2){
        if(pw!==pw2) return err('Passwords do not match.');
        const pErr=Security.validate(pw); if(pErr) return err(pErr);
        s.passwordHash=await Security.hash(pw);
      }
      Object.assign(s,{name:g('fName'),rollNo:g('fRoll'),dob:g('fDob'),gender:g('fGender'),email:g('fEmail'),mobile:g('fMob'),
        departmentId:dept.id,department:dept.name,courseId:course.id,course:course.name,
        currentSemester:sem,academicSession:g('fSession'),admissionYear:year,semesterHistory:buildHistory(sem,year)});
      await DB.put('students',s); await DB.cascadeStudent(s); await DB.log('Admin','Student updated',`${s.name} (${s.regNo})`);
      await Notify.push({role:'student',uid:s.regNo,title:'Student record updated',
        message:`The examination cell updated your profile or academic placement. Current semester: ${UI.semName(s.currentSemester)}.`,type:'info',link:'profile.html'});
      UI.toast('Student updated',s.regNo,'success');
    }
    UI.closeModal(ov); onDone();
  });
}

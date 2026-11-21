/* =============================================================
   marks.js — Teacher Marks Entry + Admin Marks Review
   Teachers: enter/edit marks (draft) → submit to admin.
   Admin   : review → approve (auto recompute) or return.
   Teachers can never publish final results.
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  if(page==='marks-entry') initMarksEntry();
  if(page==='marks-review') initMarksReview();
});

/* ---------------- TEACHER: marks entry ---------------- */
async function initMarksEntry(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const s=Auth.session();
  const teacher=await DB.oneByIndex('teachers','teacherId',s.uid);
  const subjects=(await DB.getAll('subjects')).filter(x=>x.teacherId===teacher.id);
  const exams=(await DB.getAll('examinations')).filter(e=>
    (teacher.assignedSemesters||[]).includes(e.semesterId) &&
    (teacher.assignedDepartments||[]).includes(e.departmentId) &&
    subjects.some(sub=>sub.departmentId===e.departmentId&&sub.semesterId===e.semesterId));

  pg.innerHTML=`
    <div class="page-head"><div><h1>Examination Marks Entry</h1><p>Enter marks for your assigned subjects only. Submitted marks go to the Controller of Examinations for review — teachers cannot publish results.</p></div></div>
    <div class="panel mb-20"><div class="panel-body form-grid" style="grid-template-columns:repeat(4,1fr)">
      <div class="field"><label>Academic Year</label><input id="ay" disabled></div>
      <div class="field"><label>Examination <span class="req">*</span></label><select id="exSel"><option value="">Select examination</option>${exams.map(e=>`<option value="${e.id}">${esc(e.name)} · ${esc(e.session)} · ${esc(e.semesterName)}</option>`).join('')}</select></div>
      <div class="field"><label>Subject <span class="req">*</span></label><select id="subSel" disabled><option value="">Select examination first</option></select></div>
      <div class="field"><label>Class</label><input id="cls" disabled></div>
    </div></div>
    <div id="gridArea"><div class="panel"><div class="panel-body">${UI.emptyState('Select an examination and subject','Your assigned subject list depends on the chosen examination.','pen')}</div></div></div>
    <div class="panel mt-20"><div class="panel-head"><div><h3>My Submissions</h3><p>Status of marks you have entered across examinations</p></div></div>
      <div class="panel-body" id="mySubs">${UI.spinner()}</div></div>`;

  if(!subjects.length){
    pg.querySelector('#gridArea').innerHTML=`<div class="panel"><div class="panel-body">${UI.emptyState('No assigned subjects','Ask the administrator to assign subjects to your Teacher ID.','book')}</div></div>`;
  }

  const exSel=pg.querySelector('#exSel'), subSel=pg.querySelector('#subSel');
  exSel.addEventListener('change',()=>{
    const ex=exams.find(e=>e.id===+exSel.value);
    if(!ex){ subSel.innerHTML='<option value="">Select examination first</option>'; subSel.disabled=true; return; }
    pg.querySelector('#ay').value=ex.session; pg.querySelector('#cls').value=`${ex.department} · ${ex.semesterName}`;
    const match=subjects.filter(sub=>sub.departmentId===ex.departmentId&&sub.semesterId===ex.semesterId);
    subSel.disabled=false;
    subSel.innerHTML='<option value="">Select subject</option>'+match.map(su=>`<option value="${su.id}">${esc(su.code)} — ${esc(su.name)}</option>`).join('');
  });
  subSel.addEventListener('change',()=>{
    const ex=exams.find(e=>e.id===+exSel.value), sub=subjects.find(x=>x.id===+subSel.value);
    if(ex&&sub) renderGrid(ex,sub,teacher,pg.querySelector('#gridArea'));
  });

  /* my submissions panel */
  const paintSubs=async()=>{
    const mine=await DB.byIndex('marks','teacherId',teacher.id);
    const groups={};
    mine.forEach(m=>{ const k=m.examId+'|'+m.subjectId; (groups[k] ||= {exam:m.examName,code:m.subjectCode,subject:m.subjectName,status:m.status,count:0,at:m.submittedAt||m.updatedAt}).count++; });
    const rows=Object.values(groups).sort((a,b)=>(b.at||'').localeCompare(a.at||''));
    pg.querySelector('#mySubs').innerHTML=rows.length?`
      <div class="table-wrap"><table class="data-table compact"><thead><tr><th>Examination</th><th>Subject</th><th class="num">Students</th><th>Last Updated</th><th>Status</th></tr></thead>
      <tbody>${rows.map(g=>`<tr><td>${esc(g.exam)}</td><td><b>${esc(g.code)}</b> — ${esc(g.subject)}</td><td class="num">${g.count}</td><td class="small muted">${timeAgo(g.at)}</td><td>${UI.statusBadge(g.status)}</td></tr>`).join('')}</tbody></table></div>`
      :'<p class="muted small">No marks entered yet.</p>';
  };
  paintSubs();
  window._repaintSubs=paintSubs;
}

/* the actual entry grid */
async function renderGrid(exam,subject,teacher,host){
  window.CESMarkClean && CESMarkClean();
  host.innerHTML=`<div class="panel"><div class="panel-body">${UI.spinner()}</div></div>`;
  const students=(await DB.filter('students',st=>st.departmentId===exam.departmentId&&st.currentSemester===exam.semester)).sort((a,b)=>a.regNo.localeCompare(b.regNo));
  const existing=(await DB.byIndex('marks','examId',exam.id)).filter(m=>m.subjectId===subject.id);
  const locked=existing.some(m=>m.status!=='draft');
  const status=existing.length?existing[0].status:'new';

  host.innerHTML=`<div class="panel">
    <div class="panel-head">
      <div><h3>${esc(subject.code)} — ${esc(subject.name)}</h3>
      <p>${esc(exam.name)} · ${esc(exam.session)} · ${esc(exam.semesterName)} · Max marks ${subject.maxMarks} · Pass ${subject.passMarks}</p></div>
      <div class="flex gap-10 items-center">
        ${UI.statusBadge(status==='new'?'draft':status)}
        ${locked?'<span class="badge info">Locked — submitted for review</span>':''}
      </div>
    </div>
    <div class="panel-body">
      ${locked?`<div class="alert info">${icon('info')}<div>These marks were submitted to the administrator${status==='approved'||status==='published'?' and approved':''}. Editing is locked. If a correction is needed, ask the Controller of Examinations to return the submission.</div></div>`:''}
      ${students.length?'':UI.emptyState('No students in this class','No active students match this department and semester.','users')}
      ${students.length?`<div class="table-wrap scroll"><table class="data-table compact" id="entryTable">
        <thead><tr><th>Reg. No</th><th>Student Name</th><th class="num">Max Marks</th><th class="center">Marks Obtained</th><th class="center">Absent</th><th>Row Status</th></tr></thead>
        <tbody>${students.map(st=>{
          const m=existing.find(x=>x.regNo===st.regNo);
          return `<tr data-reg="${esc(st.regNo)}">
            <td><span class="badge royal">${esc(st.regNo)}</span></td>
            <td class="td-main"><b>${esc(st.name)}</b><span>Roll ${esc(st.rollNo)}</span></td>
            <td class="num">${subject.maxMarks}</td>
            <td class="center"><input class="marks-input" type="number" min="0" max="${subject.maxMarks}" value="${m&&m.obtained!=null?m.obtained:''}" ${m&&m.absent?'disabled':''} ${locked?'disabled':''} placeholder="—"></td>
            <td class="center"><input type="checkbox" class="abs" ${m&&m.absent?'checked':''} ${locked?'disabled':''}></td>
            <td>${m?UI.statusBadge(m.status):'<span class="badge">Not entered</span>'}</td></tr>`;}).join('')}
        </tbody></table></div>`:''}
      ${students.length && !locked?`
      <div class="form-actions">
        <span class="muted small grow items-center flex">${icon('info',14)}&nbsp;Marks above ${subject.maxMarks} are rejected automatically. Absent students are marked absent — never silently zero.</span>
        <button class="btn btn-outline" id="saveDraft">${icon('check')} Save Draft</button>
        <button class="btn btn-royal" id="submitMarks">${icon('send')} Submit to Admin for Review</button>
      </div>`:''}
    </div></div>`;

  if(!students.length||locked) return;
  const table=host.querySelector('#entryTable');
  table.querySelectorAll('tr[data-reg]').forEach(tr=>{
    const input=tr.querySelector('.marks-input'), abs=tr.querySelector('.abs');
    abs.addEventListener('change',()=>{ window.CESMarkDirty&&CESMarkDirty(); input.disabled=abs.checked; if(abs.checked) input.value=''; input.classList.remove('invalid'); });
    input.addEventListener('input',()=>{
      window.CESMarkDirty&&CESMarkDirty();
      const v=+input.value;
      input.classList.toggle('invalid', input.value!==''&&(isNaN(v)||v<0||v>subject.maxMarks));
    });
  });

  const collect=()=>[...table.querySelectorAll('tr[data-reg]')].map(tr=>({
    regNo:tr.dataset.reg,
    name:tr.querySelector('b').textContent,
    absent:tr.querySelector('.abs').checked,
    raw:tr.querySelector('.marks-input').value
  }));

  const save=async submit=>{
    const rows=collect();
    for(const r of rows){
      if(r.absent) continue;
      if(r.raw==='') { if(submit) { UI.toast('Incomplete','Enter marks or tick Absent for every student before submitting.','error'); return; } }
      else { const v=+r.raw; if(isNaN(v)||v<0||v>subject.maxMarks){ UI.toast('Invalid marks',`Marks must be between 0 and ${subject.maxMarks}.`,'error'); return; } }
    }
    const stamp=new Date().toISOString();
    let saved=0;
    for(const r of rows){
      if(!r.absent && r.raw==='') continue;                 // untouched row
      const student=students.find(st=>st.regNo===r.regNo);
      const prev=existing.find(x=>x.regNo===r.regNo);       // prevents duplicates
      const rec=prev||{examId:exam.id,teacherId:teacher.id,studentId:student?student.id:null,createdAt:stamp};
      Object.assign(rec,{examName:exam.name,academicYear:exam.session,subjectId:subject.id,subjectCode:subject.code,subjectName:subject.name,
        semesterId:exam.semesterId,departmentId:exam.departmentId,courseId:exam.courseId,
        regNo:r.regNo,studentName:r.name,maxMarks:subject.maxMarks,
        obtained:r.absent?null:+r.raw,absent:r.absent,
        status:submit?'submitted':'draft',updatedAt:stamp,submittedAt:submit?stamp:(rec.submittedAt||null)});
      if(prev) await DB.put('marks',rec); else await DB.add('marks',rec);
      saved++;
    }
    if(!saved){ UI.toast('Nothing to save','Enter at least one mark or absence.','warning'); return; }
    await DB.log(teacher.name, submit?'Marks submitted':'Marks saved (draft)', `${subject.code} — ${subject.name}, ${exam.name} (${saved} rows)`);
    if(submit){
      const admins=await DB.getAll('admins');
      for(const a of admins) await Notify.push({role:'admin',uid:a.adminId,title:'Marks submitted for review',
        message:`${teacher.name} submitted ${subject.code} — ${subject.name} (${exam.name}) for ${saved} student(s).`,type:'warning',link:'marks-review.html'});
      window.refreshBell && refreshBell();
    }
    UI.toast(submit?'Submitted for review':'Draft saved',`${subject.code}: ${saved} record(s).`,'success');
    window.CESMarkClean&&CESMarkClean();
    renderGrid(exam,subject,teacher,host);
    window._repaintSubs && window._repaintSubs();
  };
  host.querySelector('#saveDraft').addEventListener('click',()=>save(false));
  host.querySelector('#submitMarks').addEventListener('click',()=>save(true));
}

/* ---------------- ADMIN: marks review ---------------- */
async function initMarksReview(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const state={exam:'',status:''};

  const paint=async()=>{
    const [marks,exams,teachers]=await Promise.all([DB.getAll('marks'),DB.getAll('examinations'),DB.getAll('teachers')]);
    const tName={}; teachers.forEach(t=>tName[t.id]=t.name);
    const groups={};
    marks.filter(m=>m.status!=='draft').forEach(m=>{
      const k=m.examId+'|'+m.subjectId+'|'+m.teacherId;
      const g=(groups[k] ||= {examId:m.examId,subjectId:m.subjectId,teacherId:m.teacherId,exam:m.examName,code:m.subjectCode,subject:m.subjectName,session:m.academicYear,rows:[],status:m.status,at:m.submittedAt||m.updatedAt});
      g.rows.push(m);
      if(m.status==='submitted') g.status='submitted';       // surfaced first
      else if(g.status!=='submitted'&&m.status==='approved') g.status='approved';
      else if(g.status!=='submitted'&&g.status!=='approved') g.status=m.status;
    });
    let list=Object.values(groups);
    if(state.exam) list=list.filter(g=>g.examId===+state.exam);
    if(state.status) list=list.filter(g=>g.status===state.status);
    list.sort((a,b)=>(a.status==='submitted'?-1:1)-(b.status==='submitted'?-1:1)||(b.at||'').localeCompare(a.at||''));

    pg.querySelector('#list').innerHTML=list.length?`
      <div class="table-wrap scroll"><table class="data-table">
        <thead><tr><th>Examination</th><th>Subject</th><th>Teacher</th><th class="num">Rows</th><th>Submitted</th><th>Status</th><th class="text-right">Actions</th></tr></thead>
        <tbody>${list.map(g=>`<tr>
          <td class="td-main"><b>${esc(g.exam)}</b><span>${esc(g.session)}</span></td>
          <td><b>${esc(g.code)}</b> — ${esc(g.subject)}</td>
          <td>${esc(tName[g.teacherId]||'—')}</td>
          <td class="num">${g.rows.length}</td>
          <td class="small muted">${g.at?timeAgo(g.at):'—'}</td>
          <td>${UI.statusBadge(g.status)}</td>
          <td><div class="row-actions">
            <button class="btn btn-sm btn-soft" data-view='${g.examId}|${g.subjectId}|${g.teacherId}'>${icon('eye',14)} View</button>
            ${g.status==='submitted'?`
              <button class="btn btn-sm btn-success" data-approve='${g.examId}|${g.subjectId}|${g.teacherId}'>${icon('check',14)} Approve</button>
              <button class="btn btn-sm btn-warning" data-return='${g.examId}|${g.subjectId}|${g.teacherId}'>${icon('refresh',14)} Return</button>`:''}
          </div></td></tr>`).join('')}</tbody></table></div>`
      :UI.emptyState('No submissions to review','Teacher submissions appear here as soon as marks are submitted.','clipboardCheck');

    const rowsOf=k=>{ const [e,su,t]=k.split('|').map(Number); return marks.filter(m=>m.examId===e&&m.subjectId===su&&m.teacherId===t); };
    pg.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{
      const rows=rowsOf(b.dataset.view);
      UI.modal(`${UI.modalHead(rows[0].subjectCode+' — '+esc(rows[0].subjectName))}
        <div class="modal-body"><p class="muted small mb-14">${esc(rows[0].examName)} · ${esc(rows[0].academicYear)} · ${rows.length} student(s)</p>
        <div class="table-wrap"><table class="data-table compact"><thead><tr><th>Reg. No</th><th>Student</th><th class="num">Marks</th><th>Status</th></tr></thead>
        <tbody>${rows.map(m=>`<tr><td><span class="badge royal">${esc(m.regNo)}</span></td><td>${esc(m.studentName)}</td>
          <td class="num">${m.absent?'<span class="badge danger">ABSENT</span>':`${m.obtained} / ${m.maxMarks}`}</td><td>${UI.statusBadge(m.status)}</td></tr>`).join('')}</tbody></table></div></div>`);
    }));
    pg.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',async()=>{
      const rows=rowsOf(b.dataset.approve);
      for(const m of rows){ m.status='approved'; m.approvedAt=new Date().toISOString(); await DB.put('marks',m); }
      /* Auto-recalculate results on every approval */
      const calc=await Calc.computeExam(rows[0].examId,{});
      const teacher=await DB.get('teachers',rows[0].teacherId);
      if(teacher) await Notify.push({role:'teacher',uid:teacher.teacherId,title:'Marks approved',
        message:`Your submission for ${rows[0].subjectCode} — ${rows[0].subjectName} (${rows[0].examName}) was approved.`,type:'success',link:'marks-entry.html'});
      await DB.log('Admin','Marks approved',`${rows[0].subjectCode} — ${rows[0].subjectName} · ${rows.length} rows · results recomputed (${calc.count})`);
      UI.toast('Approved & recomputed',`${rows[0].subjectCode}: results for ${calc.count} student(s) computed. Publish from the Results module.`,'success');
      paint();
    }));
    pg.querySelectorAll('[data-return]').forEach(b=>b.addEventListener('click',async()=>{
      const rows=rowsOf(b.dataset.return);
      if(!await UI.confirm('Return submission','Return these marks to the teacher as editable drafts?','Return to Teacher')) return;
      for(const m of rows){ m.status='draft'; m.submittedAt=null; await DB.put('marks',m); }
      const teacher=await DB.get('teachers',rows[0].teacherId);
      if(teacher) await Notify.push({role:'teacher',uid:teacher.teacherId,title:'Marks returned for correction',
        message:`${rows[0].subjectCode} — ${rows[0].subjectName} (${rows[0].examName}) was returned. Please revise and resubmit.`,type:'warning',link:'marks-entry.html'});
      await DB.log('Admin','Marks returned',rows[0].subjectCode+' — '+rows[0].subjectName);
      UI.toast('Returned to teacher','The submission is editable again.','warning'); paint();
    }));
  };

  pg.innerHTML=`
    <div class="page-head"><div><h1>Marks Review</h1><p>Approve teacher submissions. Approval automatically recalculates results — publication stays admin-only.</p></div></div>
    <div class="toolbar">
      <select id="fExam"><option value="">All Examinations</option>${(await DB.getAll('examinations')).map(e=>`<option value="${e.id}">${esc(e.name)} · ${esc(e.session)} · ${esc(e.semesterName)}</option>`).join('')}</select>
      <select id="fStatus"><option value="">All Statuses</option><option value="submitted">Submitted (pending)</option><option value="approved">Approved</option><option value="published">Published</option></select>
    </div>
    <div id="list">${UI.spinner()}</div>`;
  pg.querySelector('#fExam').addEventListener('change',e=>{ state.exam=e.target.value; paint(); });
  pg.querySelector('#fStatus').addEventListener('change',e=>{ state.status=e.target.value; paint(); });
  paint();
}

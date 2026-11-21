/* =============================================================
   results.js — Result computation & publication (admin),
   student result dashboard and marksheet generation.
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  const page=document.body.dataset.page;
  if(page==='results'&&document.body.dataset.role==='admin') initAdminResults();
  if(page==='results'&&document.body.dataset.role==='student') initStudentResults();
  if(page==='marksheet') initMarksheet();
});

const gradeClass=g=> 'g'+(g||'').replace('+','plus');

/* ---------------- ADMIN: results ---------------- */
async function initAdminResults(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const exams=(await DB.getAll('examinations')).sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));
  pg.innerHTML=`
    <div class="page-head"><div><h1>Result Computation & Publication</h1><p>Compute from approved marks, review, then publish. Only the admin can publish final results.</p></div></div>
    <div class="panel mb-20"><div class="panel-body form-grid" style="grid-template-columns:2fr 1fr 1fr 1fr">
      <div class="field"><label>Examination</label><select id="exSel">${exams.map(e=>`<option value="${e.id}">${esc(e.name)} · ${esc(e.session)} · ${esc(e.semesterName)} · ${esc(e.department)}</option>`).join('')}</select></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-outline btn-block" id="recompute">${icon('refresh')} Recompute</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-success btn-block" id="publish">${icon('send')} Publish</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-warning btn-block" id="unpublish">${icon('refresh')} Unpublish</button></div>
    </div></div>
    <div id="summary"></div><div id="list" class="mt-20">${UI.spinner()}</div>`;

  const sel=pg.querySelector('#exSel');
  sel.addEventListener('change',paint);
  pg.querySelector('#recompute').addEventListener('click',async()=>{
    const c=await Calc.computeExam(+sel.value,{});
    await DB.log('Admin','Results recomputed',`${exams.find(e=>e.id===+sel.value)?.name} — ${c.count} result(s)`);
    UI.toast('Results computed',`${c.count} student result(s) from approved marks.`,'success'); paint();
  });
  pg.querySelector('#publish').addEventListener('click',async()=>setPub(true));
  pg.querySelector('#unpublish').addEventListener('click',async()=>setPub(false));

  async function setPub(pub){
    const examId=+sel.value; const exam=exams.find(e=>e.id===examId);
    let n;
    try{ n=await Calc.setExamPublication(examId,pub); }
    catch(err){ UI.toast('Publication blocked',err.message,'error'); return; }
    if(!n){ UI.toast('Nothing to publish','Compute results first — approve marks in Marks Review.','warning'); return; }
    /* also flag the underlying approved marks as published/approved */
    const ms=(await DB.byIndex('marks','examId',examId)).filter(m=>m.status==='approved'||m.status==='published');
    for(const m of ms){ m.status=pub?'published':'approved'; await DB.put('marks',m); }
    if(pub){
      await Notify.pushStudents({title:'Result published',message:`${exam.name} (${exam.session}) — ${exam.semesterName} results are now available. Download your marksheet.`,
        type:'success',link:'results.html',departmentId:exam.departmentId,semester:exam.semester});
      await Notify.pushTeachers({title:'Results published',message:`${exam.name} (${exam.semesterName}) results were published by the examination cell.`,
        type:'info',link:'examination-routine.html',semesterId:exam.semesterId,departmentId:exam.departmentId});
    }
    await DB.log('Admin',pub?'Results published':'Results unpublished',`${exam.name} — ${n} result(s)`);
    UI.toast(pub?'Results published':'Results unpublished',`${n} result(s) ${pub?'are now visible to students':'are hidden from students'}.`,pub?'success':'warning');
    window.refreshBell&&refreshBell(); paint();
  }

  async function paint(){
    const examId=+sel.value;
    const scale=await Calc.grading();      /* display grades are always derived live from the current scale */
    const dispGrade=r=> r.overall==='PASS' ? Calc.gradeOf(r.percentage,scale) : r.overall==='INCOMPLETE'?'—':'F';
    const rows=(await DB.byIndex('results','examId',examId)).sort((a,b)=>(a.rank||999)-(b.rank||999)||b.percentage-a.percentage);
    if(!rows.length){
      pg.querySelector('#summary').innerHTML=`<div class="alert warning">${icon('alert')}<div>No computed results for this examination yet. Approve teacher marks in <b>Marks Review</b>, then click <b>Recompute</b>.</div></div>`;
      pg.querySelector('#list').innerHTML=''; return;
    }
    const pass=rows.filter(r=>r.overall==='PASS').length;
    const absent=rows.filter(r=>r.absentCount>0).length;
    const avg=Math.round(rows.reduce((a,r)=>a+r.percentage,0)/rows.length*100)/100;
    const published=rows.every(r=>r.status==='published');
    const dist=Calc.distribution(rows,scale);
    pg.querySelector('#summary').innerHTML=`
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-ico navy">${icon('users',23)}</div><div><h3>${rows.length}</h3><p>Candidates</p></div></div>
        <div class="stat-card"><div class="stat-ico green">${icon('check',23)}</div><div><h3>${pass} <span class="small muted">(${rows.length?Math.round(pass/rows.length*100):0}%)</span></h3><p>Passed</p></div></div>
        <div class="stat-card"><div class="stat-ico red">${icon('x',23)}</div><div><h3>${rows.length-pass}</h3><p>Failed / Incomplete</p></div></div>
        <div class="stat-card"><div class="stat-ico orange">${icon('alert',23)}</div><div><h3>${absent}</h3><p>With Absence</p></div></div>
        <div class="stat-card"><div class="stat-ico royal">${icon('award',23)}</div><div><h3>${avg}%</h3><p>Class Average</p></div></div>
        <div class="stat-card"><div class="stat-ico sky">${icon('clipboard',23)}</div><div><h3>${published?'Live':'Draft'}</h3><p>${published?'Published & visible':'Computed — not visible to students'}</p></div></div>
      </div>
      <div class="panel mb-14"><div class="panel-body flex gap-10 wrap items-center"><b class="text-navy small">Grade distribution:</b>
        ${Object.entries(dist).sort().map(([g,c])=>`<span class="grade-chip ${gradeClass(g)}">${g}</span><span class="muted small">× ${c}</span>`).join('')}
      </div></div>`;
    pg.querySelector('#list').innerHTML=`
      <div class="table-wrap scroll"><table class="data-table">
        <thead><tr><th class="num">Rank</th><th>Reg. No</th><th>Student</th><th class="num">Subjects Passed</th><th class="num">Total</th><th class="num">%</th><th>Grade</th><th>Result</th><th>Status</th><th class="text-right">View</th></tr></thead>
        <tbody>${rows.map(r=>`<tr>
          <td class="num">${r.rank?`<b>#${r.rank}</b>`:'<span class="muted">—</span>'}</td>
          <td><span class="badge royal">${esc(r.regNo)}</span></td>
          <td>${esc(r.studentName)}</td>
          <td class="num">${r.subjects.filter(s=>s.status==='PASS').length} / ${r.subjects.length}${r.absentCount?` <span class="badge danger">ABS ×${r.absentCount}</span>`:''}</td>
          <td class="num">${r.totalObtained} / ${r.totalMax}</td>
          <td class="num"><b>${r.percentage}%</b></td>
          <td><span class="grade-chip ${gradeClass(dispGrade(r))}" title="Grade band for ${r.percentage}%">${dispGrade(r)}</span></td>
          <td>${r.overall==='PASS'?'<span class="badge success">PASS</span>':r.overall==='INCOMPLETE'?'<span class="badge warning">INCOMPLETE</span>':'<span class="badge danger">FAIL</span>'}</td>
          <td>${UI.statusBadge(r.status)}</td>
          <td class="text-right"><button class="icon-btn" data-view="${r.id}">${icon('eye')}</button></td></tr>`).join('')}
        </tbody></table><div class="table-foot"><span>${rows.length} result(s)</span><span>Grades are threshold-based (≥ band minimum) · FAIL still applies if a subject is below pass marks</span></div></div>`;
    pg.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',async()=>{
      const r=await DB.get('results',+b.dataset.view);
      const dScale=await Calc.grading();
      const dGrade=r.overall==='PASS'?Calc.gradeOf(r.percentage,dScale):'F';
      UI.modal(`${UI.modalHead(esc(r.studentName)+' — '+esc(r.regNo))}
        <div class="modal-body"><p class="muted small mb-14">${esc(r.examName)} · ${esc(r.session)} · ${esc(r.semesterName)} · ${esc(r.department)}</p>
        <div class="table-wrap"><table class="data-table compact"><thead><tr><th>Code</th><th>Subject</th><th class="num">Max</th><th class="num">Obtained</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${r.subjects.map(su=>`<tr><td><b>${esc(su.code)}</b></td><td>${esc(su.name)}</td><td class="num">${su.max}</td>
          <td class="num">${su.status==='PENDING'?'—':su.obtained==null?'AB':su.obtained}</td><td><span class="grade-chip ${gradeClass(su.grade)}">${su.grade}</span></td>
          <td>${su.status==='PASS'?'<span class="badge success">PASS</span>':su.status==='FAIL'?'<span class="badge danger">FAIL</span>':su.status==='PENDING'?'<span class="badge">PENDING MARKS</span>':'<span class="badge warning">ABSENT</span>'}</td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="2"><b>Total</b></td><td class="num"><b>${r.totalMax}</b></td><td class="num"><b>${r.totalObtained}</b></td><td colspan="2"><b>${r.percentage}% · ${dGrade}</b></td></tr></tfoot></table></div></div>`);
    }));
  }
  paint();
}

/* ---------------- STUDENT: my results ---------------- */
async function initStudentResults(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const s=Auth.session();
  const me=await DB.oneByIndex('students','regNo',s.uid);
  const mine=(await DB.byIndex('results','regNo',me.regNo)).filter(r=>r.status==='published');

  pg.innerHTML=`
    <div class="page-head"><div><h1>My Results</h1><p>Published results for all semesters in your academic record, 1st to 8th — pick a semester to view it.</p></div>
    <div class="pill-tabs" id="semTabs">${Array.from({length:me.currentSemester},(_,i)=>`<button data-sem="${i+1}" class="${i+1===me.currentSemester?'active':''}">${SEM_NAMES[i].split(' ')[0]}</button>`).join('')}</div></div>
    <div id="list">${UI.spinner()}</div>`;

  const scale=await Calc.grading();   /* grades shown are derived live from the current scale */
  const paint=sem=>{
    const rows=mine.filter(r=>r.semester===sem).sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
    pg.querySelector('#list').innerHTML=rows.length?`<div class="col gap-14">${rows.map(r=>`
      <div class="panel"><div class="panel-body flex items-center gap-20 wrap">
        <div class="stat-ico ${r.overall==='PASS'?'green':'red'}">${icon(r.overall==='PASS'?'check':'x',23)}</div>
        <div class="grow">
          <b class="text-navy">${esc(r.examName)}</b> <span class="badge">${esc(r.examType)}</span>
          <p class="small muted mt-6">${esc(r.session)} · ${esc(r.semesterName)} · ${esc(r.department)} · Published ${fmtDate(r.publishedAt)}</p>
          <p class="small mt-6">Total <b>${r.totalObtained}/${r.totalMax}</b> · Percentage <b>${r.percentage}%</b> · Grade <b>${r.overall==='PASS'?Calc.gradeOf(r.percentage,scale):'F'}</b>${r.rank?` · Class Rank <b>#${r.rank}</b>`:''}</p>
        </div>
        <div class="flex gap-10 wrap">
          <span class="badge ${r.overall==='PASS'?'success':'danger'}" style="font-size:13px;padding:7px 14px">${r.overall}</span>
          <button class="btn btn-sm btn-soft" data-detail="${r.id}">${icon('eye',14)} Subject-wise</button>
          <a class="btn btn-sm btn-royal" href="marksheet.html?exam=${r.id}">${icon('file',14)} Marksheet</a>
        </div>
      </div></div>`).join('')}</div>`
      :UI.emptyState('No published result yet',`Your ${SEM_NAMES[sem-1]} results will appear here once the examination cell publishes them.`,'award');

    pg.querySelectorAll('[data-detail]').forEach(b=>b.addEventListener('click',async()=>{
      const r=await DB.get('results',+b.dataset.detail);
      UI.modal(`${UI.modalHead('Subject-wise Performance')}
        <div class="modal-body"><p class="muted small mb-14">${esc(r.examName)} · ${esc(r.session)}</p>
        <div class="table-wrap"><table class="data-table compact"><thead><tr><th>Code</th><th>Subject</th><th class="num">Max</th><th class="num">Marks</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${r.subjects.map(su=>`<tr><td><b>${esc(su.code)}</b></td><td>${esc(su.name)}</td><td class="num">${su.max}</td>
          <td class="num">${su.obtained==null?'AB':su.obtained}</td><td><span class="grade-chip ${gradeClass(su.grade)}">${su.grade}</span></td>
          <td>${su.status==='PASS'?'<span class="badge success">PASS</span>':su.status==='FAIL'?'<span class="badge danger">FAIL</span>':'<span class="badge warning">ABSENT</span>'}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2"><b>Total</b></td><td class="num"><b>${r.totalMax}</b></td><td class="num"><b>${r.totalObtained}</b></td><td colspan="2"><b>${r.percentage}% · Grade ${r.overall==='PASS'?Calc.gradeOf(r.percentage,scale):'F'}</b></td></tr></tfoot></table></div></div>`);
    }));
  };
  pg.querySelectorAll('#semTabs button').forEach(b=>b.addEventListener('click',()=>{
    pg.querySelectorAll('#semTabs button').forEach(x=>x.classList.toggle('active',x===b)); paint(+b.dataset.sem);
  }));
  paint(me.currentSemester);
}

/* ---------------- STUDENT: marksheet ---------------- */
async function initMarksheet(){
  const pg=document.getElementById('page');
  const s=Auth.session();
  const qs=new URLSearchParams(location.search);
  let result=null;
  const mine=(await DB.byIndex('results','regNo',s.uid)).filter(r=>r.status==='published');
  if(qs.get('exam')) result=mine.find(r=>r.id===+qs.get('exam'))||null;

  if(!result){
    pg.innerHTML=`
      <div class="page-head no-print"><div><h1>Marksheet</h1><p>Choose a published examination to open its official marksheet.</p></div></div>
      ${mine.length?`<div class="col gap-14 no-print">${mine.map(r=>`
        <a class="tile" href="marksheet.html?exam=${r.id}">${icon('file')}<div><b>${esc(r.examName)} — ${esc(r.semesterName)}</b><span>${esc(r.session)} · ${r.percentage}% · ${r.overall} · published ${fmtDate(r.publishedAt)}</span></div></a>`).join('')}</div>`
      :`<div class="panel no-print"><div class="panel-body">${UI.emptyState('No published results','Marksheets become available here after publication.','file')}</div></div>`}`;
    return;
  }

  const me=await DB.oneByIndex('students','regNo',s.uid);
  const college=(await DB.get('settings','college'))||{};
  const scale=await Calc.grading();   /* live-derive the headline grade from the current scale */
  const pass=r=>r.overall==='PASS';
  const serial='WBSU/MS/'+String(result.id).padStart(5,'0');

  pg.innerHTML=`
    <div class="marksheet-tools no-print">
      <a class="btn btn-outline" href="results.html">${icon('chevron',15)} Back to Results</a>
      <span class="grow"></span>
      <button class="btn btn-royal" onclick="window.print()">${icon('printer')} Print Marksheet</button>
      <button class="btn btn-primary" onclick="window.print()">${icon('download')} Save as PDF (via Print)</button>
    </div>
    <div class="marksheet">
      <div class="ms-head">
        <div class="ms-crest">${icon('grad',36)}</div>
        <div class="ms-college">
          <h2>${esc(college.name||'West Bengal State University')}</h2>
          <p>${esc(college.address||'')} · ${esc(college.email||'')} · ${esc(college.phone||'')}</p>
          <p>${esc(college.motto||'')}</p>
          <h3>Statement of Marks — ${esc(result.examName)}</h3>
        </div>
        <div class="ms-crest" style="background:transparent;border:1.5px dashed #c9d4ec">${me.photo?`<img src="${me.photo}" style="width:100%;height:100%;object-fit:cover;border-radius:14px">`:icon('user',30)}</div>
      </div>
      <div class="ms-serial"><span>Serial No: ${serial}</span><span>Date of Publication: ${fmtDate(result.publishedAt)}</span></div>
      <div class="ms-student">
        <div><b>Student Name</b><span>${esc(me.name)}</span></div>
        <div><b>Registration No.</b><span>${esc(me.regNo)}</span></div>
        <div><b>Roll Number</b><span>${esc(me.rollNo)}</span></div>
        <div><b>Department</b><span>${esc(me.department)}</span></div>
        <div><b>Course</b><span>${esc(me.course)}</span></div>
        <div><b>Semester</b><span>${esc(result.semesterName)} (${result.semester%2===1?'Odd':'Even'})</span></div>
        <div><b>Academic Session</b><span>${esc(result.session)}</span></div>
        <div><b>Examination</b><span>${esc(result.examName)} (${esc(result.examType)})</span></div>
      </div>
      <table class="ms-subjects">
        <thead><tr><th>Subject Code</th><th>Subject Name</th><th class="num">Max Marks</th><th class="num">Marks Obtained</th><th class="num">Grade</th><th class="num">Status</th></tr></thead>
        <tbody>${result.subjects.map(su=>`<tr>
          <td>${esc(su.code)}</td><td>${esc(su.name)}</td>
          <td class="num">${su.max}</td>
          <td class="num">${su.obtained==null?'ABSENT':su.obtained}</td>
          <td class="num">${su.grade}</td>
          <td class="num">${su.status}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="2">TOTAL</td><td class="num">${result.totalMax}</td><td class="num">${result.totalObtained}</td><td colspan="2" class="num">${result.percentage}%</td></tr></tfoot>
      </table>
      <div class="ms-summary">
        <div class="ms-sum-box"><span>Total Marks</span><b>${result.totalObtained}/${result.totalMax}</b></div>
        <div class="ms-sum-box"><span>Percentage</span><b>${result.percentage}%</b></div>
        <div class="ms-sum-box"><span>Grade</span><b>${pass(result)?Calc.gradeOf(result.percentage,scale):'F'}</b></div>
        <div class="ms-sum-box"><span>Credits Earned</span><b>${result.creditsEarned}</b></div>
        <div class="ms-sum-box"><span>Class Rank</span><b>${result.rank?'#'+result.rank:'—'}</b></div>
      </div>
      <div class="ms-result ${pass(result)?'pass':'fail'}">OVERALL RESULT : ${result.overall}${result.absentCount?` · ABSENT IN ${result.absentCount} SUBJECT(S)`:''}</div>
      <div class="ms-notes">
        Notes: 1. Grades follow the college's official grading scale configured by the Controller of Examinations.
        2. “ABSENT” is not computed as zero; absent subjects are excluded from totals per college policy.
        3. This is a computer-generated statement from the college examination portal and does not require a physical signature for provisional use.
        4. Data shown reflects records stored in this browser (IndexedDB prototype).
      </div>
      <div class="ms-sign"><span>Prepared by — Examination Cell</span><span>Controller of Examinations</span></div>
    </div>`;
}

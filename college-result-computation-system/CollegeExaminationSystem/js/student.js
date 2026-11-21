/* =============================================================
   student.js — Student dashboard, profile, notifications.
   Students only ever read their own records (regNo scoped).
   ============================================================= */

document.addEventListener('DOMContentLoaded',()=>{
  const map={dashboard:studentDashboard,profile:studentProfile,notifications:studentNotifications};
  const fn=map[document.body.dataset.page]; if(fn) fn();
});

async function myRecord(){
  const s=Auth.session();
  return DB.oneByIndex('students','regNo',s.uid);
}

/* ---------------- DASHBOARD ---------------- */
async function studentDashboard(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const s=Auth.session();
  const me=await myRecord();
  const [results,routines,notes]=await Promise.all([
    DB.byIndex('results','regNo',me.regNo),DB.getAll('examinationRoutines'),
    Notify.forUser('student',me.regNo,6)]);
  const published=results.filter(r=>r.status==='published').sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
  const latest=published[0];
  const scale=await Calc.grading();    /* live-derive headline grade from the current scale */
  const avg=published.length?Math.round(published.reduce((a,r)=>a+r.percentage,0)/published.length*100)/100:0;

  const today=new Date().toISOString().slice(0,10);
  const upcoming=routines
    .filter(r=>r.status==='published'&&r.departmentId===me.departmentId&&r.semester<=me.currentSemester)
    .flatMap(r=>(r.entries||[]).map(e=>({...e,title:r.title})))
    .filter(e=>e.date>=today).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,6);
  const daysTo=d=>Math.ceil((new Date(d)-new Date(today))/86400000);

  const stat=(i,c,v,l)=>`<div class="stat-card"><div class="stat-ico ${c}">${icon(i,23)}</div><div><h3>${v}</h3><p>${l}</p></div></div>`;
  pg.innerHTML=`
    <div class="page-head"><div><h1>Student Dashboard</h1><p>Welcome, ${esc(me.name.split(' ')[0])}. Examinations, routines, results and notices — all in one place.</p></div>
    <div class="page-actions"><a class="btn btn-outline" href="examination-routine.html">${icon('calendarDays')} Exam Routine</a>
    <a class="btn btn-royal" href="results.html">${icon('award')} My Results</a></div></div>

    <div class="panel mb-20"><div class="panel-body profile-card">
      ${UI.avatarHtml(me,'xl')}
      <div class="pinfo"><b>${esc(me.name)}</b><span>${esc(me.regNo)} · Roll ${esc(me.rollNo)}</span><br>
      <span class="small muted">${esc(me.course)} · ${esc(me.department)}</span></div>
      <span class="grow"></span>
      <div class="text-right">
        <span class="badge navy" style="font-size:13px;padding:7px 14px">${UI.semName(me.currentSemester)} (${me.currentSemester%2===1?'Odd':'Even'})</span>
        <p class="small muted mt-6">Session ${esc(me.academicSession||'—')}</p>
      </div>
    </div></div>

    <div class="stat-grid">
      ${stat('award','green',published.length,'Published Results')}
      ${stat('calendarDays','royal',upcoming.length,'Upcoming Exam Slots')}
      ${stat('layers','navy',me.currentSemester+' / '+(await DB.count('semesters')),'Current Semester')}
      ${stat('clipboard','orange',published.length?avg+'%':'—','Average Percentage')}
    </div>

    <div class="grid-main">
      <div class="col gap-20">
        <div class="panel"><div class="panel-head"><div><h3>Upcoming Examinations</h3><p>From published routines for your department and semesters</p></div></div>
          <div class="panel-body" style="padding-top:8px">
            ${upcoming.length?`<div class="table-wrap"><table class="data-table compact">
              <thead><tr><th>Subject</th><th>Date</th><th>Time</th><th>Room</th><th></th></tr></thead><tbody>
              ${upcoming.map(e=>`<tr><td class="td-main"><b>${esc(e.subjectCode)}</b><span>${esc(e.subjectName)}</span></td>
                <td>${fmtDate(e.date)}</td><td class="small">${fmtTime(e.startTime)} – ${fmtTime(e.endTime)}</td><td>${esc(e.room||'—')}</td>
                <td><span class="badge ${daysTo(e.date)<=3?'danger':daysTo(e.date)<=7?'warning':'info'}">in ${daysTo(e.date)} day${daysTo(e.date)===1?'':'s'}</span></td></tr>`).join('')}
              </tbody></table></div>`:UI.emptyState('No upcoming examinations','When a routine is published for your semester, exam slots appear here with countdowns.','calendarDays')}
          </div></div>
        ${latest?`<div class="panel"><div class="panel-head"><div><h3>Latest Published Result</h3><p>${esc(latest.examName)} · ${esc(latest.session)}</p></div>
          <a class="btn btn-sm btn-royal" href="marksheet.html?exam=${latest.id}">${icon('file',14)} Marksheet</a></div>
          <div class="panel-body flex items-center gap-20 wrap">
            <div class="stat-ico ${latest.overall==='PASS'?'green':'red'}">${icon(latest.overall==='PASS'?'check':'x',23)}</div>
            <div class="grow"><b class="text-navy big">${latest.semesterName}</b>
              <p class="small muted mt-6">Total ${latest.totalObtained}/${latest.totalMax} · ${latest.percentage}% · Grade ${latest.overall==='PASS'?Calc.gradeOf(latest.percentage,scale):'F'}${latest.rank?` · Rank #${latest.rank}`:''}</p></div>
            <span class="badge ${latest.overall==='PASS'?'success':'danger'}" style="font-size:14px;padding:8px 16px">${latest.overall}</span>
          </div></div>`:''}
      </div>
      <div class="col gap-20">
        <div class="panel"><div class="panel-head"><h3>Notifications</h3><a class="small" href="notifications.html">View all</a></div>
          <div class="panel-body" style="padding-top:8px">
            ${notes.length?notes.map(n=>`<div class="act-item"><span class="act-dot" style="background:${n.read?'#c4cede':'var(--royal)'}"></span>
              <div><b class="text-navy">${esc(n.title)}</b><br><span class="muted small">${esc(n.message)}</span><time>${timeAgo(n.createdAt)}</time></div></div>`).join('')
            :'<p class="muted small">No notifications yet.</p>'}
          </div></div>
        <div class="panel"><div class="panel-head"><h3>Quick Links</h3></div>
          <div class="panel-body col gap-10">
            <a class="tile" href="examination-routine.html">${icon('calendarDays')}<div><b>Examination Routine</b><span>Dates, times and venues</span></div></a>
            <a class="tile" href="results.html">${icon('award')}<div><b>Semester Results</b><span>Subject-wise marks & grades</span></div></a>
            <a class="tile" href="marksheet.html">${icon('printer')}<div><b>Marksheet</b><span>Print / save as PDF</span></div></a>
            <a class="tile" href="profile.html">${icon('user')}<div><b>My Profile</b><span>Registration details</span></div></a>
          </div></div>
      </div>
    </div>`;
}

/* ---------------- PROFILE ---------------- */
async function studentProfile(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const me=await myRecord();
  pg.innerHTML=`
    <div class="page-head"><div><h1>My Profile</h1><p>Your registration record. Contact the examination cell for corrections.</p></div></div>
    <div class="grid-2" style="align-items:start">
      <div class="panel"><div class="panel-head"><h3>Personal Details</h3></div>
        <div class="panel-body">
          <div class="profile-card mb-20">${UI.avatarHtml(me,'xl')}
            <div class="pinfo"><b>${esc(me.name)}</b><span>${esc(me.regNo)}</span></div></div>
          <div class="kv">
            <div><span>Registration Number</span><b>${esc(me.regNo)}</b></div>
            <div><span>Roll Number</span><b>${esc(me.rollNo)}</b></div>
            <div><span>Date of Birth</span><b>${fmtDate(me.dob)}</b></div>
            <div><span>Gender</span><b>${esc(me.gender)}</b></div>
            <div><span>Email</span><b>${esc(me.email)}</b></div>
            <div><span>Mobile</span><b>${esc(me.mobile)}</b></div>
            <div><span>Department</span><b>${esc(me.department)}</b></div>
            <div><span>Course</span><b>${esc(me.course)}</b></div>
            <div><span>Current Semester</span><b>${UI.semName(me.currentSemester)} (${me.currentSemester%2===1?'Odd':'Even'})</b></div>
            <div><span>Academic Session</span><b>${esc(me.academicSession||'—')}</b></div>
            <div><span>Admission Year</span><b>${me.admissionYear}</b></div>
            <div><span>Registered On</span><b>${fmtDate(me.createdAt)}</b></div>
          </div>
        </div></div>
      <div class="panel"><div class="panel-head"><h3>Semester-wise Academic Record</h3></div>
        <div class="panel-body">
          <div class="table-wrap"><table class="data-table compact"><thead><tr><th>Semester</th><th>Academic Year</th><th>Status</th></tr></thead><tbody>
          ${(me.semesterHistory||[]).map(h=>`<tr><td>${UI.semName(h.semester)}</td><td>${esc(h.academicYear)}</td>
            <td>${h.status==='Completed'?'<span class="badge success">Completed</span>':'<span class="badge info">In Progress</span>'}</td></tr>`).join('')}
          </tbody></table></div>
          <div class="alert info mt-14">${icon('info')}<div>Students cannot edit marks, routines or results. You have read-only access to your own academic record from the 1st to the 6th semester.</div></div>
        </div></div>
    </div>`;
}

/* ---------------- NOTIFICATIONS ---------------- */
async function studentNotifications(){
  const pg=document.getElementById('page'); pg.innerHTML=UI.spinner();
  const s=Auth.session();
  const paint=async()=>{
    const notes=await Notify.forUser('student',s.uid,200);
    pg.querySelector('#list').innerHTML=notes.length?`
      <div class="panel"><div class="panel-body" style="padding:8px 20px">
        ${notes.map(n=>`<div class="notif-item ${n.read?'':'unread'}" data-id="${n.id}" data-link="${n.link||''}" style="padding:14px 6px">
          <div class="notif-ico ${n.type}">${icon(n.type==='success'?'check':n.type==='warning'?'alert':n.type==='danger'?'x':'info')}</div>
          <div class="grow"><b>${esc(n.title)}</b><p>${esc(n.message)}</p><time>${timeAgo(n.createdAt)}</time></div>
          ${n.read?'':'<span class="badge royal">New</span>'}
        </div>`).join('')}
      </div></div>`:`<div class="panel"><div class="panel-body">${UI.emptyState('No notifications','Examination and result announcements will appear here.','bell')}</div></div>`;
    pg.querySelectorAll('.notif-item').forEach(el=>el.addEventListener('click',async()=>{
      await Notify.markRead(+el.dataset.id); window.refreshBell&&refreshBell();
      if(el.dataset.link){ location.href=el.dataset.link; } else paint();
    }));
  };
  pg.innerHTML=`
    <div class="page-head"><div><h1>Notifications</h1><p>Routine publications, result announcements and college notices.</p></div>
    <div class="page-actions"><button class="btn btn-outline" id="markAll">${icon('check')} Mark All Read</button></div></div>
    <div id="list">${UI.spinner()}</div>`;
  pg.querySelector('#markAll').addEventListener('click',async()=>{ await Notify.markAllRead('student',s.uid); window.refreshBell&&refreshBell(); paint(); });
  paint();
}

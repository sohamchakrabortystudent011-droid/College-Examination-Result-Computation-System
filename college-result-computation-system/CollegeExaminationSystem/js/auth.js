/* =============================================================
   auth.js — Three-role authentication (Student / Teacher / Admin)
   + student registration + session handling + route guards.

   NOTE: Browser-only demo authentication. A production college
   deployment requires a secure server, salted password hashing
   and central role-based access control.
   ============================================================= */

const Auth = {
  key:'ces_session',

  session(){ try{ return JSON.parse(sessionStorage.getItem(this.key)); }catch(e){ return null; } },
  save(s){ sessionStorage.setItem(this.key, JSON.stringify(s)); },
  clear(){ sessionStorage.removeItem(this.key); },

  /* are we inside a role sub-folder? */
  basePath(){ return /\/(admin|teacher|student)\//.test(location.pathname) ? '../' : ''; },

  roleHome(role){
    return {admin:'admin/dashboard.html',teacher:'teacher/dashboard.html',student:'student/dashboard.html'}[role] || 'login.html';
  },

  /* route guard used by every dashboard page */
  requireRole(role){
    const s = this.session();
    if(!s || s.role !== role){ location.replace(this.basePath()+'login.html'); return null; }
    return s;
  },

  logout(){ this.clear(); location.replace(this.basePath()+'login.html'); },

  /* ---------- brute-force lockout (client-side protection) ----------
     After 5 failed attempts an account/ID is locked for 15 minutes in
     this browser. Not a replacement for server-side throttling, but it
     stops casual password guessing in the prototype. */
  _lockKey(role,id){ return 'ces_lock_'+role+'_'+String(id).toUpperCase(); },
  _lockState(role,id){ try{ return JSON.parse(localStorage.getItem(this._lockKey(role,id)))||{fails:0,until:0}; }catch(e){ return {fails:0,until:0}; } },
  lockRemaining(role,id){ const st=this._lockState(role,id); return st.until>Date.now()?Math.ceil((st.until-Date.now())/60000):0; },
  _registerFail(role,id){ const st=this._lockState(role,id); st.fails=(st.fails||0)+1; if(st.fails>=5){ st.until=Date.now()+15*60000; st.fails=0; } localStorage.setItem(this._lockKey(role,id),JSON.stringify(st)); },
  _clearFails(role,id){ localStorage.removeItem(this._lockKey(role,id)); },

  /* ---------- STUDENT: registration number + password ---------- */
  async loginStudent(regNo, password){
    const reg=regNo.trim().toUpperCase();
    const wait=this.lockRemaining('student',reg);
    if(wait) return {ok:false, msg:`Too many failed attempts. Try again in about ${wait} minute(s).`};
    const stu = await DB.oneByIndex('students','regNo',reg);
    if(!stu || !(await Security.verify(password, stu.passwordHash))){
      this._registerFail('student',reg);
      return {ok:false, msg:'Invalid registration number or password.'};
    }
    if(stu.status && stu.status!=='active') return {ok:false, msg:'This student record is inactive. Please contact the examination cell.'};
    if(!stu.passwordHash) return {ok:false, msg:'No password is set for this account. Ask the examination cell to set one from Student Management.'};
    if(!String(stu.passwordHash).startsWith('pbkdf2$')){ stu.passwordHash=await Security.hash(password); await DB.put('students',stu); } // upgrade legacy hash
    this._clearFails('student',reg);
    this.save({role:'student', id:stu.id, uid:stu.regNo, name:stu.name, currentSemester:stu.currentSemester, departmentId:stu.departmentId, loginAt:Date.now()});
    return {ok:true};
  },

  /* ---------- TEACHER: teacher id + password ---------- */
  async loginTeacher(teacherId, password){
    const id=teacherId.trim().toUpperCase();
    const wait=this.lockRemaining('teacher',id);
    if(wait) return {ok:false, msg:`Too many failed attempts. Try again in about ${wait} minute(s).`};
    const t = await DB.oneByIndex('teachers','teacherId',id);
    if(!t || !(await Security.verify(password, t.passwordHash))){
      this._registerFail('teacher',id);
      return {ok:false, msg:'Invalid Teacher ID or password.'};
    }
    if(!String(t.passwordHash).startsWith('pbkdf2$')){ t.passwordHash=await Security.hash(password); await DB.put('teachers',t); } // upgrade legacy hash
    this._clearFails('teacher',id);
    this.save({role:'teacher', id:t.id, uid:t.teacherId, name:t.name, departmentId:t.departmentId, loginAt:Date.now()});
    return {ok:true};
  },

  /* ---------- ADMIN: admin id + password ---------- */
  async loginAdmin(adminId, password){
    const id=adminId.trim().toUpperCase();
    const wait=this.lockRemaining('admin',id);
    if(wait) return {ok:false, msg:`Too many failed attempts. Try again in about ${wait} minute(s).`};
    const a = await DB.oneByIndex('admins','adminId',id);
    if(!a || !(await Security.verify(password, a.passwordHash))){
      this._registerFail('admin',id);
      return {ok:false, msg:'Invalid Admin ID or password.'};
    }
    if(!String(a.passwordHash).startsWith('pbkdf2$')){ a.passwordHash=await Security.hash(password); await DB.put('admins',a); } // upgrade legacy hash
    this._clearFails('admin',id);
    this.save({role:'admin', id:a.id, uid:a.adminId, name:a.name, designation:a.designation, mustChangePassword:!!a.mustChangePassword, loginAt:Date.now()});
    return {ok:true};
  },

  /* ---------- student self-registration ---------- */
  async registerStudent(data){
    const errors = [];
    if(!/^[A-Za-z][A-Za-z .]{2,60}$/.test(data.name)) errors.push('Enter a valid full name.');
    if(!/^[A-Za-z0-9-]{6,20}$/.test(data.regNo)) errors.push('Registration number must be 6–20 letters/digits.');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) errors.push('Enter a valid email address.');
    if(!/^[0-9+ -]{10,15}$/.test(data.mobile)) errors.push('Enter a valid mobile number.');
    if(!data.dob) errors.push('Date of birth is required.');
    const existing = await DB.oneByIndex('students','regNo',data.regNo.trim());
    if(existing) errors.push(`Registration number ${data.regNo} is already registered.`);
    if(errors.length) return {ok:false, msg:errors[0], errors};

    const dept = await DB.get('departments',Number(data.departmentId));
    const course = await DB.get('courses',Number(data.courseId));
    const sem = Number(data.currentSemester);
    const pErr=Security.validate(data.password||'');
    if(pErr) errors.push(pErr);
    if(!pErr && data.password!==data.confirmPassword) errors.push('Passwords do not match.');
    if(errors.length) return {ok:false, msg:errors[0], errors};
    const hist=[]; for(let s=1;s<=sem;s++){ const y=Number(data.admissionYear)+Math.floor((s-1)/2); hist.push({semester:s,academicYear:`${y}–${y+1}`,status:s===sem?'In Progress':'Completed'}); }

    const id = await DB.add('students',{
      name:data.name.trim(), regNo:data.regNo.trim().toUpperCase(), rollNo:data.rollNo.trim(),
      dob:data.dob, gender:data.gender, email:data.email.trim(), mobile:data.mobile.trim(),
      departmentId:Number(data.departmentId), department:dept?dept.name:'—',
      courseId:Number(data.courseId), course:course?course.name:'—',
      currentSemester:sem, admissionYear:Number(data.admissionYear),
      academicSession:data.academicSession, photo:data.photo||null,
      passwordHash:await Security.hash(data.password),
      semesterHistory:hist, status:'active', createdAt:new Date().toISOString()
    });
    await DB.log(data.name,'Student registration',`${data.regNo} — ${dept?dept.code:''}, ${UI.semName(sem)}`);
    /* notify every administrator account (IDs are no longer hardcoded) */
    for(const a of await DB.getAll('admins'))
      await Notify.push({role:'admin',uid:a.adminId,title:'New student registered',
        message:`${data.name} (${data.regNo}) — ${dept?dept.name:''}, ${UI.semName(sem)}.`,type:'info',link:'students.html'});
    return {ok:true, id};
  }
};

/* =============================================================
   Login / Register / Landing page wiring (runs only where the
   matching <body data-auth="..."> marker exists).
   ============================================================= */
document.addEventListener('DOMContentLoaded', ()=>{
  const mode = document.body.dataset.auth;
  if(mode==='login')    initLoginPage();
  if(mode==='register') initRegisterPage();
  if(mode==='index')    initLandingPage();
});

const SEM_NAMES=['1st Semester','2nd Semester','3rd Semester','4th Semester','5th Semester','6th Semester','7th Semester','8th Semester'];

function initLandingPage(){
  const s = Auth.session();
  const box = document.getElementById('continueBox');
  if(s && box){
    box.classList.remove('hidden');
    box.querySelector('b').textContent = `${s.name} (${s.role})`;
    box.querySelector('a').href = Auth.roleHome(s.role);
  }
}

function initLoginPage(){
  let storageReady=false;
  const storageInit=DB.seedIfNeeded().then(()=>{
    storageReady=true;
    const spin=document.getElementById('initSpinner');
    if(spin){
      spin.className='alert success';
      spin.innerHTML=`${icon('check')}<div>Local database ready. You can sign in.</div>`;
      setTimeout(()=>spin.remove(),1800);
    }
    return true;
  }).catch(err=>{
    console.error('Login database startup failed',err);
    const spin=document.getElementById('initSpinner');
    if(spin){
      spin.className='alert danger';
      spin.innerHTML=`${icon('alert')}<div class="grow"><b>Local database needs attention</b><br><span>${esc(err.message||err.name||'The browser blocked IndexedDB.')}</span><br><span class="small">Use a normal Chrome, Edge or Firefox window. If this is an older demo database, click Repair.</span></div><button type="button" class="btn btn-sm btn-danger" id="repairLoginDb">Repair</button>`;
      spin.querySelector('#repairLoginDb').addEventListener('click',async e=>{
        const btn=e.currentTarget; btn.disabled=true; btn.textContent='Repairing…';
        try{ await DB.reset(); sessionStorage.clear(); location.reload(); }
        catch(repairErr){ btn.disabled=false; btn.textContent='Repair'; UI.toast('Repair blocked',repairErr.message,'error'); }
      });
    }
    UI.toast('Database startup failed','Use the Repair button for this browser\'s local demo data.','error');
    return false;
  });

  const params = new URLSearchParams(location.search);
  const cards  = [...document.querySelectorAll('.role-card')];
  const panels = {student:document.getElementById('formStudent'),
                  teacher:document.getElementById('formTeacher'),
                  admin:document.getElementById('formAdmin')};

  const selectRole = (role)=>{
    cards.forEach(c=>c.classList.toggle('active', c.dataset.role===role));
    Object.entries(panels).forEach(([k,p])=> p.classList.toggle('hidden', k!==role));
    document.getElementById('loginSub').textContent =
      {student:'Sign in with your registration number and password.',
       teacher:'Faculty sign-in with your Teacher ID and password.',
       admin:'Controller of Examinations sign-in.'}[role];
  };
  cards.forEach(c=> c.addEventListener('click',()=>selectRole(c.dataset.role)));
  selectRole(['student','teacher','admin'].includes(params.get('role')) ? params.get('role') : 'student');

  const regParam = params.get('reg');
  if(regParam) document.getElementById('stuReg').value = regParam;
  if(params.get('registered')) UI.toast('Registration successful','Sign in with your registration number and semester.','success');

  const busy = btn => { btn.disabled=true; btn.dataset.txt=btn.innerHTML; btn.innerHTML='Signing in…'; };
  const free = btn => { btn.disabled=false; btn.innerHTML=btn.dataset.txt; };
  const showErr = (el,msg)=>{ el.querySelector('span').textContent=msg; el.classList.add('show'); };
  const hideErr = el => el.classList.remove('show');

  /* student */
  panels.student.addEventListener('submit', async e=>{
    e.preventDefault(); const err=document.getElementById('errStudent'); hideErr(err);
    const btn=e.target.querySelector('button[type=submit]'); busy(btn);
    try{
      await storageInit;
      if(!storageReady){ showErr(err,'The local database is not ready. Use the Repair button above, then try again.'); free(btn); return; }
      const r = await Auth.loginStudent(document.getElementById('stuReg').value, document.getElementById('stuPw').value);
      if(!r.ok){ showErr(err,r.msg); } else { sessionStorage.setItem('ces-flash','welcome'); location.href='student/dashboard.html'; }
    }catch(ex){ showErr(err,'Unexpected error. Please try again.'); }
    free(btn);
  });
  /* teacher */
  panels.teacher.addEventListener('submit', async e=>{
    e.preventDefault(); const err=document.getElementById('errTeacher'); hideErr(err);
    const btn=e.target.querySelector('button[type=submit]'); busy(btn);
    try{
      await storageInit;
      if(!storageReady){ showErr(err,'The local database is not ready. Use the Repair button above, then try again.'); free(btn); return; }
      const r = await Auth.loginTeacher(document.getElementById('tId').value, document.getElementById('tPw').value);
      if(!r.ok){ showErr(err,r.msg); } else { sessionStorage.setItem('ces-flash','welcome'); location.href='teacher/dashboard.html'; }
    }catch(ex){ showErr(err,'Unexpected error. Please try again.'); }
    free(btn);
  });
  /* admin */
  panels.admin.addEventListener('submit', async e=>{
    e.preventDefault(); const err=document.getElementById('errAdmin'); hideErr(err);
    const btn=e.target.querySelector('button[type=submit]'); busy(btn);
    try{
      await storageInit;
      if(!storageReady){ showErr(err,'The local database is not ready. Use the Repair button above, then try again.'); free(btn); return; }
      const r = await Auth.loginAdmin(document.getElementById('aId').value, document.getElementById('aPw').value);
      if(!r.ok){ showErr(err,r.msg); } else { sessionStorage.setItem('ces-flash','welcome'); location.href='admin/dashboard.html'; }
    }catch(ex){ showErr(err,'Unexpected error. Please try again.'); }
    free(btn);
  });
}

async function initRegisterPage(){
  await DB.seedIfNeeded();
  const [depts,courses,sessions] = await Promise.all([
    DB.getAll('departments'),DB.getAll('courses'),DB.filter('academicSessions',s=>s.status==='active')]);

  const deptSel = document.getElementById('regDept');
  const courseSel = document.getElementById('regCourse');
  const semSel = document.getElementById('regSem');
  const sessSel = document.getElementById('regSession');
  const yearSel = document.getElementById('regYear');

  deptSel.innerHTML = '<option value="">Select department</option>'+depts.map(d=>`<option value="${d.id}">${d.name}</option>`).join('');
  semSel.innerHTML = '<option value="">Select current semester</option>'+SEM_NAMES.map((n,i)=>`<option value="${i+1}">${n}</option>`).join('');
  sessSel.innerHTML = '<option value="">Select academic session</option>'+sessions.map(s=>`<option value="${s.name}">${s.name}</option>`).join('');
  const cy = new Date().getFullYear();
  yearSel.innerHTML = '<option value="">Admission year</option>'+Array.from({length:8},(_,i)=>`<option>${cy-i}</option>`).join('');

  deptSel.addEventListener('change',()=>{
    const list = courses.filter(c=>c.departmentId===Number(deptSel.value));
    courseSel.innerHTML = '<option value="">Select course</option>'+list.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  });

  /* optional profile photo with type/size validation */
  let photoData=null;
  const fileInput=document.getElementById('regPhoto');
  const prev=document.getElementById('photoPreview');
  fileInput.addEventListener('change',()=>{
    const f=fileInput.files[0];
    if(!f){ photoData=null; prev.classList.add('hidden'); return; }
    if(!/^image\/(png|jpe?g|webp)$/.test(f.type)){ UI.toast('Invalid file','Profile photo must be PNG, JPG or WebP.','error'); fileInput.value=''; return; }
    if(f.size>1.5*1024*1024){ UI.toast('File too large','Profile photo must be below 1.5 MB.','error'); fileInput.value=''; return; }
    const rd=new FileReader();
    rd.onload=()=>{ photoData=rd.result; prev.src=rd.result; prev.classList.remove('hidden'); };
    rd.readAsDataURL(f);
  });

  document.getElementById('registerForm').addEventListener('submit', async e=>{
    e.preventDefault();
    const err=document.getElementById('regError'); err.classList.remove('show');
    const g=id=>document.getElementById(id).value;
    const btn=e.target.querySelector('button[type=submit]'); btn.disabled=true;
    const r = await Auth.registerStudent({
      name:g('regName'), regNo:g('regNo'), rollNo:g('regRoll'), dob:g('regDob'),
      gender:g('regGender'), email:g('regEmail'), mobile:g('regMobile'),
      departmentId:g('regDept'), courseId:g('regCourse'),
      currentSemester:g('regSem'), academicSession:g('regSession'),
      admissionYear:g('regYear'), photo:photoData,
      password:g('regPw'), confirmPassword:g('regPw2')
    }).catch(()=>({ok:false,msg:'Could not save the record. Please try again.'}));
    btn.disabled=false;
    if(!r.ok){ err.querySelector('span').textContent=r.msg; err.classList.add('show'); err.scrollIntoView({behavior:'smooth',block:'center'}); return; }
    location.href='login.html?role=student&registered=1&reg='+encodeURIComponent(g('regNo').trim().toUpperCase());
  });
}

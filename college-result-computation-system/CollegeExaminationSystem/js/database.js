/* =============================================================
   database.js — IndexedDB data layer
   Database : CollegeExaminationSystemDB
   Provides a small promise-based wrapper plus the initial demo
   seed. IndexedDB is browser/device local — see the production
   note in the documentation panel (Admin → Settings).
   ============================================================= */

/* Legacy hash kept only so any old stored credential can still be verified
   and transparently upgraded on next sign-in. Do not use for new hashes. */
function cesHash(str){
  let h = 5381;
  for(let i=0;i<str.length;i++){ h = ((h<<5)+h+str.charCodeAt(i))>>>0; }
  return 'h'+h.toString(36);
}

/* =============================================================
   Security — password hashing & verification
   Uses PBKDF2 (SHA-256, 150k iterations) with a per-password
   random salt via the Web Crypto API when available. Falls back
   to a salted, heavily-iterated hash where SubtleCrypto is
   blocked (e.g. some file:// contexts). Still a client-side
   prototype — a production college system must authenticate on a
   secure server — but far stronger than a plain hash.
   ============================================================= */
const Security = {
  ITER:150000,
  _ok(){ return !!(window.crypto && crypto.subtle && crypto.getRandomValues); },
  _b64(bytes){ let s=''; bytes.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); },
  _unb64(str){ return Uint8Array.from(atob(str),c=>c.charCodeAt(0)); },
  _fallback(str){ let h=5381; for(let r=0;r<6000;r++){ for(let i=0;i<str.length;i++){ h=((h<<5)+h+str.charCodeAt(i))>>>0; } } return h.toString(16); },

  async hash(password){
    if(this._ok()){
      try{
        const salt=crypto.getRandomValues(new Uint8Array(16));
        const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
        const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:this.ITER,hash:'SHA-256'},km,256);
        return `pbkdf2$${this.ITER}$${this._b64(salt)}$${this._b64(new Uint8Array(bits))}`;
      }catch(e){/* fall through to software fallback */}
    }
    const salt=Math.random().toString(36).slice(2,14);
    return `itr$${salt}$${this._fallback(password+salt)}`;
  },

  async verify(password, stored){
    if(!stored) return false;
    if(stored.startsWith('pbkdf2$')){
      if(!this._ok()) return false;
      const [,iter,saltB64,hashB64]=stored.split('$');
      try{
        const km=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
        const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:this._unb64(saltB64),iterations:+iter,hash:'SHA-256'},km,256);
        return this._b64(new Uint8Array(bits))===hashB64;
      }catch(e){ return false; }
    }
    if(stored.startsWith('itr$')){
      const [,salt,h]=stored.split('$');
      return this._fallback(password+salt)===h;
    }
    return cesHash(password)===stored;   // legacy credential
  },

  /* password policy: min 8 chars, at least one letter and one digit */
  validate(pw){
    if(!pw || pw.length<8) return 'Password must be at least 8 characters long.';
    if(!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return 'Password must contain at least one letter and one number.';
    return null;
  }
};

/* Cross-tab data bus. Every role uses the same IndexedDB database, while
   this lightweight channel tells other open portal tabs when a store has
   changed. BroadcastChannel is primary; the storage event is a fallback. */
const CESDataSync = (()=>{
  const source = 'tab-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);
  const listeners = new Set();
  const seen = new Set();
  let channel = null;

  const deliver = msg=>{
    if(!msg || msg.source===source || seen.has(msg.id)) return;
    seen.add(msg.id);
    if(seen.size>250) seen.delete(seen.values().next().value);
    listeners.forEach(fn=>{ try{ fn(msg); }catch(err){ console.error('Data sync listener failed',err); } });
  };

  try{
    channel = new BroadcastChannel('CollegeExaminationSystemDB:changes');
    channel.addEventListener('message',e=>deliver(e.data));
  }catch(err){ channel=null; }

  try{
    window.addEventListener('storage',e=>{
      if(e.key!=='CollegeExaminationSystemDB:change' || !e.newValue) return;
      try{ deliver(JSON.parse(e.newValue)); }catch(err){ /* ignore malformed events */ }
    });
  }catch(err){ /* localStorage may be unavailable in hardened contexts */ }

  return {
    publish(change){
      const msg={...change,source,at:Date.now(),id:source+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)};
      try{ if(channel) channel.postMessage(msg); }catch(err){ /* fallback below */ }
      try{ localStorage.setItem('CollegeExaminationSystemDB:change',JSON.stringify(msg)); }catch(err){ /* non-fatal */ }
    },
    subscribe(fn){ listeners.add(fn); return ()=>listeners.delete(fn); }
  };
})();

const DB = {
  name:'CollegeExaminationSystemDB',
  version:1,
  _db:null, _p:null, _silent:0,

  /* Open (cached) database connection; creates stores on 1st run */
  open(){
    if(this._p) return this._p;
    this._p = new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){
        const err=new Error('This browser does not provide IndexedDB storage.');
        err.name='IndexedDBUnavailableError'; reject(err); return;
      }
      const rq = indexedDB.open(this.name, this.version);
      rq.onupgradeneeded = e=>{
        const db = e.target.result;
        const mk = (name,opts,indexes)=>{
          if(db.objectStoreNames.contains(name)) return;
          const s = db.createObjectStore(name,opts);
          (indexes||[]).forEach(([n,k,o])=> s.createIndex(n,k,o||{}));
        };
        const ai = {keyPath:'id',autoIncrement:true};
        mk('students', ai, [['regNo','regNo',{unique:true}],['name','name'],['departmentId','departmentId'],['currentSemester','currentSemester']]);
        mk('teachers', ai, [['teacherId','teacherId',{unique:true}],['departmentId','departmentId']]);
        mk('admins',   ai, [['adminId','adminId',{unique:true}]]);
        mk('departments', ai, [['code','code',{unique:true}]]);
        mk('courses',  ai, [['code','code',{unique:true}],['departmentId','departmentId']]);
        mk('semesters', ai, [['number','number',{unique:true}]]);
        mk('subjects', ai, [['code','code',{unique:true}],['departmentId','departmentId'],['semesterId','semesterId'],['teacherId','teacherId']]);
        mk('academicSessions', ai, [['name','name',{unique:true}],['status','status']]);
        mk('examinations', ai, [['semesterId','semesterId'],['departmentId','departmentId'],['status','status']]);
        mk('examinationRoutines', ai, [['semesterId','semesterId'],['departmentId','departmentId'],['semesterType','semesterType'],['status','status'],['academicYear','academicYear']]);
        mk('marks', ai, [['examId','examId'],['subjectId','subjectId'],['regNo','regNo'],['teacherId','teacherId'],['status','status']]);
        mk('results', ai, [['examId','examId'],['regNo','regNo'],['semesterId','semesterId'],['status','status']]);
        mk('notifications', ai, [['role','role'],['uid','uid'],['read','read']]);
        mk('activityLog', ai, [['createdAt','createdAt']]);
        mk('settings', {keyPath:'key'});
      };
      rq.onsuccess = e=>{
        this._db = e.target.result;
        /* Allow upgrades/deletion from another portal tab without blocking. */
        this._db.onversionchange=()=>{ this._db.close(); this._db=null; this._p=null; };
        resolve(this._db);
      };
      rq.onerror   = ()=> reject(rq.error);
    });
    return this._p;
  },

  _store(name,mode){ return this._db.transaction(name,mode).objectStore(name); },
  _wrap(rq){ return new Promise((res,rej)=>{ rq.onsuccess=()=>res(rq.result); rq.onerror=()=>rej(rq.error); }); },

  _changed(store,action,key=null){
    if(!this._silent) CESDataSync.publish({store,action,key});
  },

  async add(store,obj){
    await this.open();
    const key=await this._wrap(this._store(store,'readwrite').add(obj));
    this._changed(store,'add',key); return key;
  },
  async put(store,obj){
    await this.open();
    const key=await this._wrap(this._store(store,'readwrite').put(obj));
    this._changed(store,'put',key); return key;
  },
  async get(store,id){ await this.open(); return this._wrap(this._store(store,'readonly').get(id)); },
  async del(store,id){
    await this.open();
    const out=await this._wrap(this._store(store,'readwrite').delete(id));
    this._changed(store,'delete',id); return out;
  },
  async getAll(store){ await this.open(); return this._wrap(this._store(store,'readonly').getAll()); },
  async count(store){ await this.open(); return this._wrap(this._store(store,'readonly').count()); },
  async clear(store){
    await this.open();
    const out=await this._wrap(this._store(store,'readwrite').clear());
    this._changed(store,'clear'); return out;
  },
  async byIndex(store,index,value){ await this.open(); return this._wrap(this._store(store,'readonly').index(index).getAll(value)); },
  async oneByIndex(store,index,value){ await this.open(); return this._wrap(this._store(store,'readonly').index(index).get(value)); },
  async filter(store,fn){ return (await this.getAll(store)).filter(fn); },

  /* Update denormalized display fields after a master record changes.
     IDs remain the source of truth; copied names exist only to make local
     reads and exports convenient, so they must be kept in sync. */
  async updateWhere(store,predicate,mutator){
    const rows=await this.getAll(store); let count=0;
    for(const row of rows){
      if(!predicate(row)) continue;
      mutator(row); await this.put(store,row); count++;
    }
    return count;
  },

  async cascadeDepartment(dept){
    const stores=['courses','students','teachers','subjects','examinations','examinationRoutines','results'];
    for(const store of stores)
      await this.updateWhere(store,r=>r.departmentId===dept.id,r=>{ r.department=dept.name; });
  },

  async cascadeCourse(course){
    const stores=['students','subjects','examinations','examinationRoutines','results'];
    for(const store of stores)
      await this.updateWhere(store,r=>r.courseId===course.id,r=>{ r.course=course.name; });
  },

  async cascadeSemester(semester){
    await this.updateWhere('examinations',r=>r.semesterId===semester.id,r=>{
      r.semester=semester.number; r.semesterName=semester.name;
    });
    await this.updateWhere('examinationRoutines',r=>r.semesterId===semester.id,r=>{
      r.semester=semester.number; r.semesterName=semester.name;
      r.semesterType=semester.number%2===1?'Odd':'Even';
    });
    await this.updateWhere('results',r=>r.semesterId===semester.id,r=>{
      r.semester=semester.number; r.semesterName=semester.name;
    });
  },

  async cascadeSession(session,oldName){
    await this.updateWhere('students',r=>r.academicSession===oldName,r=>{ r.academicSession=session.name; });
    await this.updateWhere('examinations',r=>r.sessionId===session.id,r=>{ r.session=session.name; });
    await this.updateWhere('examinationRoutines',r=>r.sessionId===session.id,r=>{ r.session=session.name; });
    const exams=await this.getAll('examinations');
    const examIds=new Set(exams.filter(e=>e.sessionId===session.id).map(e=>e.id));
    await this.updateWhere('results',r=>examIds.has(r.examId),r=>{ r.session=session.name; });
    await this.updateWhere('marks',r=>examIds.has(r.examId),r=>{ r.academicYear=session.name; });
  },

  async cascadeSubject(subject,previous={}){
    await this.updateWhere('marks',r=>r.subjectId===subject.id,r=>{
      r.subjectCode=subject.code; r.subjectName=subject.name; r.maxMarks=subject.maxMarks;
    });
    const oldCode=previous.code||subject.code;
    await this.updateWhere('examinationRoutines',r=>Array.isArray(r.entries)&&r.entries.some(e=>e.subjectCode===oldCode),r=>{
      r.entries.forEach(e=>{ if(e.subjectCode===oldCode){ e.subjectCode=subject.code; e.subjectName=subject.name; } });
      r.updatedAt=new Date().toISOString();
    });
    await this.updateWhere('results',r=>Array.isArray(r.subjects)&&r.subjects.some(s=>s.code===oldCode),r=>{
      r.subjects.forEach(s=>{ if(s.code===oldCode){ s.code=subject.code; s.name=subject.name; s.max=subject.maxMarks; } });
    });
  },

  async cascadeExamination(exam){
    await this.updateWhere('marks',r=>r.examId===exam.id,r=>{
      r.examName=exam.name; r.academicYear=exam.session; r.semesterId=exam.semesterId;
      r.departmentId=exam.departmentId; r.courseId=exam.courseId;
    });
    await this.updateWhere('results',r=>r.examId===exam.id,r=>{
      Object.assign(r,{examName:exam.name,examType:exam.type,session:exam.session,
        departmentId:exam.departmentId,department:exam.department,
        courseId:exam.courseId,course:exam.course,semesterId:exam.semesterId,
        semester:exam.semester,semesterName:exam.semesterName});
    });
  },

  async cascadeStudent(student){
    await this.updateWhere('marks',r=>r.studentId===student.id||r.regNo===student.regNo,r=>{
      r.studentId=student.id; r.regNo=student.regNo; r.studentName=student.name;
    });
    await this.updateWhere('results',r=>r.studentId===student.id||r.regNo===student.regNo,r=>{
      Object.assign(r,{studentId:student.id,regNo:student.regNo,studentName:student.name,
        rollNo:student.rollNo,departmentId:student.departmentId,department:student.department,
        courseId:student.courseId,course:student.course});
    });
  },

  /* recent activity feed */
  async log(actor,action,detail){
    try{ await this.add('activityLog',{actor,action,detail,createdAt:new Date().toISOString()}); }catch(e){/* non-fatal */}
  },

  /* wipe the whole database (used by Settings → Reset demo data) */
  async reset(){
    CESDataSync.publish({store:'*',action:'prepare-reset'});
    if(this._db){ this._db.close(); this._db=null; this._p=null; }
    await new Promise(res=>setTimeout(res,120));
    return new Promise((res,rej)=>{
      const rq = indexedDB.deleteDatabase(this.name);
      rq.onsuccess=()=>res();
      rq.onerror=()=>rej(rq.error);
      rq.onblocked=()=>rej(new Error('Database reset is blocked by another open portal tab. Close the other tabs and try again.'));
    });
  },

  /* export every store as downloadable JSON (Settings page) */
  async exportAll(){
    const names = ['students','teachers','admins','departments','courses','semesters','subjects','academicSessions','examinations','examinationRoutines','marks','results','notifications','activityLog'];
    const out = {};
    for(const n of names){
      const rows = await this.getAll(n);
      out[n] = rows.map(r=>{ const c={...r}; delete c.fileBlob; delete c.photo; return c; });
    }
    return out;
  },

  /* seed once, guarded by settings key 'meta.seedVersion' */
  async seedIfNeeded(){
    await this.open();
    const meta = await this.get('settings','meta');
    if(meta && meta.seedVersion === SEED_VERSION) return false;
    /* An older populated database must be migrated, never seeded again.
       Re-inserting demo rows would violate unique indexes (semester number,
       registration number, subject code) and previously looked like an
       IndexedDB availability error to the login page. */
    const hasExistingData = (await this.count('semesters'))>0 ||
      (await this.count('students'))>0 || (await this.count('admins'))>0;
    this._silent++;
    try{
      /* A previous run that crashed mid-seed leaves data but no 'meta'
         marker. Treat that as corrupt and rebuild cleanly rather than
         trying to migrate an incomplete database. */
      if(meta) await migrateDatabase(meta.seedVersion);
      else{
        if(hasExistingData) await wipeAllStores();
        try{ await seedDatabase(); }
        catch(seedErr){ await wipeAllStores(); throw seedErr; }  // roll back partial seed
      }
    }
    finally{ this._silent--; }
    this._changed('*',meta?'migrate':'seed');
    return true;
  }
};

/* clear every store (used to recover from an interrupted seed) */
async function wipeAllStores(){
  const names=['students','teachers','admins','departments','courses','semesters','subjects','academicSessions','examinations','examinationRoutines','marks','results','notifications','activityLog','settings'];
  for(const n of names){ try{ await DB.clear(n); }catch(e){/* ignore */} }
}

/* Cooperate with reset/repair requests initiated from another role tab. */
CESDataSync.subscribe(change=>{
  if(change.action==='prepare-reset' && DB._db){
    DB._db.close(); DB._db=null; DB._p=null;
  }
});

/* v7: eight semesters (up to 8th), student password login, Schedule label */
const SEED_VERSION = 7;

/* The single bootstrap administrator account created on a clean database.
   Change this password immediately after first sign-in (Settings). */
const BOOTSTRAP_ADMIN = { adminId:'WBSUADMIN', password:'Wbsu@Admin2026' };

/* date helper: ISO date N days from today (keeps demo "upcoming") */
function dPlus(n){ const d=new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10); }
/* deterministic pseudo-random marks so the demo data is stable */
function seedMark(str,min,max){ let h=0; for(const c of str) h=(h*31+c.charCodeAt(0))>>>0; return min+(h%(max-min+1)); }

/* Non-destructive application-data migration. Existing students, teachers,
   routines, marks and results are preserved. Only institutional branding and
   legacy e-mail domains are upgraded for seed version 5. */
async function migrateDatabase(fromVersion){
  /* v7 — add the 7th and 8th semesters to databases created with six */
  if(fromVersion<7){
    const semNames=['7th Semester','8th Semester'];
    const existing=await DB.getAll('semesters');
    for(let n=7;n<=8;n++){
      if(!existing.some(s=>s.number===n))
        await DB.add('semesters',{number:n,name:semNames[n-7],type:n%2===1?'Odd':'Even',status:'active',createdAt:new Date().toISOString()});
    }
    /* students created before password login have no passwordHash; the admin
       sets one from Student Management (the login screen explains this). */
  }
  if(fromVersion<5){
    await DB.put('settings',{key:'college',name:'West Bengal State University',
      motto:'विद्याधनं सर्वधनं प्रधानम् · Knowledge is the supreme wealth',
      address:'Barasat, North 24 Parganas, West Bengal — 700126',
      email:'exams@wbsu.ac.in',phone:'+91 33 2524 1977'});

    const migrateEmail=(value,student=false)=>{
      if(!value) return value;
      return value
        .replace(/@student\.northbridge\.edu$/i,'@student.wbsu.ac.in')
        .replace(/@northbridge\.edu$/i,student?'@student.wbsu.ac.in':'@wbsu.ac.in');
    };
    await DB.updateWhere('students',()=>true,r=>{ r.email=migrateEmail(r.email,true); });
    await DB.updateWhere('teachers',()=>true,r=>{ r.email=migrateEmail(r.email,false); });
    await DB.updateWhere('admins',()=>true,r=>{ r.email=migrateEmail(r.email,false); });
  }
  await DB.put('settings',{key:'meta',seedVersion:SEED_VERSION,migratedAt:new Date().toISOString()});
}

/* -------------------------------------------------------------
   SEED — realistic sample college data, created only once.
   ------------------------------------------------------------- */
async function seedDatabase(){
  const now = new Date().toISOString();

  /* ---- semesters: eight, Odd/Even auto typing (1/3/5/7 Odd · 2/4/6/8 Even) ---- */
  const semNames = ['1st Semester','2nd Semester','3rd Semester','4th Semester','5th Semester','6th Semester','7th Semester','8th Semester'];
  const semIds = [];
  for(let i=0;i<8;i++){
    semIds.push(await DB.add('semesters',{ number:i+1, name:semNames[i], type:(i+1)%2===1?'Odd':'Even', status:'active', createdAt:now }));
  }

  /* ---- bootstrap administrator ----
     A clean database ships with exactly ONE administrator account and
     no sample departments, courses, sessions, teachers, subjects,
     students, marks, routines or results. The administrator builds the
     institution from the dashboard after first sign-in. */
  await DB.add('admins',{
    name:'System Administrator', adminId:BOOTSTRAP_ADMIN.adminId,
    designation:'Controller of Examinations', email:'exams@wbsu.ac.in',
    mobile:'', passwordHash:await Security.hash(BOOTSTRAP_ADMIN.password),
    mustChangePassword:true, createdAt:now });

  await DB.log('System','Database initialised','Clean WBSU database created with the bootstrap administrator account.');

  await DB.add('notifications',{role:'admin',uid:BOOTSTRAP_ADMIN.adminId,
    title:'Secure your account',
    message:'Welcome. For security, change the default administrator password now from Settings → Account Security.',
    type:'warning',link:'settings.html',read:false,createdAt:now});

  /* ---- configurable settings ---- */
  await DB.put('settings',{key:'grading',scale:[
    {min:90,max:100,grade:'O',points:10},{min:80,max:89,grade:'A+',points:9},
    {min:70,max:79,grade:'A',points:8},{min:60,max:69,grade:'B+',points:7},
    {min:50,max:59,grade:'B',points:6},{min:40,max:49,grade:'C',points:5},
    {min:0,max:39,grade:'F',points:0}]});
  await DB.put('settings',{key:'rules',passAllSubjects:true,absentPolicy:'fail'});
  await DB.put('settings',{key:'college',name:'West Bengal State University',motto:'विद्याधनं सर्वधनं प्रधानम् · Knowledge is the supreme wealth',address:'Barasat, North 24 Parganas, West Bengal — 700126',email:'exams@wbsu.ac.in',phone:'+91 33 2524 1977'});
  await DB.put('settings',{key:'meta',seedVersion:SEED_VERSION});
}

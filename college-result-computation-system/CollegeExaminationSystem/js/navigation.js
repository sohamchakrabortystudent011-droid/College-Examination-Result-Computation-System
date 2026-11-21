/* =============================================================
   navigation.js — shared app shell: SVG icon set, sidebar,
   topbar, notification bell, profile menu + global UI helpers
   (toasts, modals, confirms, formatting). Loaded by every
   authenticated page. Also applies the role route guard.
   ============================================================= */

/* ---------------- inline SVG icon set (no emoji, no library) ---------------- */
const ICONS = {
  dashboard:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  briefcase:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  building:'<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M8 10h.01M16 10h.01M8 14h.01M16 14h.01M12 6h.01M12 10h.01M12 14h.01"/>',
  layers:'<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
  book:'<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  calendarDays:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  clipboard:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  clipboardCheck:'<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  award:'<circle cx="12" cy="8" r="6"/><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  edit:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  printer:'<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  file:'<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  chevron:'<path d="m6 9 6 6 6-6"/>',
  grad:'<path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 10v6"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  idCard:'<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5.5 16c.6-1.6 1.4-2 2.5-2s1.9.4 2.5 2"/><path d="M14 9h4M14 13h4"/>',
  image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.5-3.5a2 2 0 0 0-3 0L6 20"/>',
  refresh:'<path d="M3 12a9 9 0 1 0 2.6-6.3L3 8"/><path d="M3 3v5h5"/>',
  shield:'<path d="M12 22s8-3.6 8-10V5l-8-3-8 3v7c0 6.4 8 10 8 10z"/>',
  send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  filter:'<path d="M22 3H2l8 9.5V19l4 2v-8.5Z"/>'
};

function icon(name,size=18){
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]||''}</svg>`;
}

/* ---------------- global UI helpers ---------------- */
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
const fmtDate = iso => { if(!iso) return '—'; const d=new Date(iso.length===10?iso+'T00:00:00':iso); return isNaN(d)?iso:`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
const fmtTime = t => { if(!t) return ''; const [h,m]=t.split(':'); let hr=+h%12||12; return `${hr}:${m} ${+h>=12?'PM':'AM'}`; };
const timeAgo = iso => { const s=(Date.now()-new Date(iso))/1000; if(s<60)return 'just now'; if(s<3600)return Math.floor(s/60)+' min ago'; if(s<86400)return Math.floor(s/3600)+' hr ago'; return fmtDate(iso); };
const initials = name => (name||'?').split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
/* shared <option> builder used by every management module */
const optRows = (list,sel)=>list.map(o=>`<option value="${o.id}" ${o.id===sel?'selected':''}>${esc(o.name)}</option>`).join('');

const UI = {
  icon, esc, fmtDate, fmtTime, timeAgo,

  semName(n){ return SEM_NAMES[n-1] || (n+'th Semester'); },

  toast(title,msg='',type='info'){
    let stack=document.querySelector('.toast-stack');
    if(!stack){ stack=document.createElement('div'); stack.className='toast-stack'; document.body.appendChild(stack); }
    const t=document.createElement('div');
    t.className=`toast ${type}`;
    t.innerHTML=`${icon(type==='success'?'check':type==='error'?'x':type==='warning'?'alert':'info')}<div><b>${esc(title)}</b>${msg?`<span>${esc(msg)}</span>`:''}</div>`;
    stack.appendChild(t);
    setTimeout(()=>{ t.classList.add('out'); setTimeout(()=>t.remove(),320); },4200);
  },

  modal(inner,cls=''){
    const ov=document.createElement('div');
    ov.className='modal-overlay open';
    ov.innerHTML=`<div class="modal ${cls}">${inner}</div>`;
    ov.addEventListener('mousedown',e=>{ if(e.target===ov) UI.closeModal(ov); });
    ov.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>UI.closeModal(ov)));
    document.body.appendChild(ov);
    return ov;
  },

  modalHead(title){ return `<div class="modal-head"><h3>${esc(title)}</h3><button class="modal-close" data-close>${icon('x')}</button></div>`; },

  closeModal(ov){ (ov ? [ov] : document.querySelectorAll('.modal-overlay')).forEach(o=>o.remove()); },

  confirm(title,msg,okLabel='Delete'){
    return new Promise(res=>{
      const ov=this.modal(`
        ${this.modalHead(title)}
        <div class="modal-body"><div class="alert danger">${icon('alert')}<div>${esc(msg)}</div></div></div>
        <div class="modal-foot"><button class="btn btn-ghost" data-close>Cancel</button><button class="btn btn-danger" id="cfOk">${esc(okLabel)}</button></div>`);
      ov.querySelector('#cfOk').addEventListener('click',()=>{ this.closeModal(ov); res(true); });
      ov.addEventListener('mousedown',e=>{ if(e.target===ov) res(false); });
      ov.querySelector('[data-close]').addEventListener('click',()=>res(false));
    });
  },

  emptyState(title,msg,iconName='search'){
    return `<div class="empty-state">${icon(iconName,46)}<h3>${esc(title)}</h3><p>${esc(msg)}</p></div>`;
  },

  spinner(){ return '<div class="spinner"></div>'; },

  statusBadge(st){
    const map={published:['success','Published'],draft:['','Draft'],submitted:['warning','Submitted'],approved:['info','Approved'],scheduled:['info','Scheduled'],ongoing:['warning','Ongoing'],completed:['navy','Completed'],active:['success','Active'],archived:['','Archived'],computed:['info','Computed'],inactive:['','Inactive']};
    const [cls,label]=map[st]||['',st];
    return `<span class="badge ${cls}"><span class="dot"></span>${label}</span>`;
  },

  avatarHtml(person,cls=''){
    if(person && person.photo) return `<span class="avatar ${cls}"><img src="${person.photo}" alt=""></span>`;
    return `<span class="avatar ${cls}">${initials(person?person.name:'')}</span>`;
  },

  /* ------------- manual date entry (Day · Month · Year) -------------
     Month and year can be picked from suggestions OR typed manually.
     Stored value is the existing ISO format 'YYYY-MM-DD'.          */
  dateFieldHtml(key,iso=''){
    let dd='',mm='',yy='';
    if(iso){ const p=String(iso).split('-'); dd=p[2]?+p[2]:''; mm=p[1]?(MONTH_NAMES[+p[1]-1]||''):''; yy=p[0]||''; }
    return `<div class="manual-date" data-manual-date="${key}">
      <input class="df-day" type="text" inputmode="numeric" maxlength="2" placeholder="DD" value="${dd}" aria-label="Day">
      <input class="df-month" type="text" list="cesMonthsDL" placeholder="Month" value="${esc(mm)}" autocomplete="off" aria-label="Month">
      <input class="df-year" type="text" inputmode="numeric" maxlength="4" list="cesYearsDL" placeholder="YYYY" value="${yy}" autocomplete="off" aria-label="Year">
    </div>`;
  },

  /* suggestion lists shared by all manual date fields in the page/modal */
  dateLists(){
    const cy=new Date().getFullYear();
    return `<datalist id="cesMonthsDL">${MONTH_NAMES.map(m=>`<option value="${m}"></option>`).join('')}</datalist>
            <datalist id="cesYearsDL">${Array.from({length:17},(_,i)=>cy-5+i).map(y=>`<option value="${y}"></option>`).join('')}</datalist>`;
  },

  /* Returns: null (completely empty) · false (invalid) · ISO string.
     Accepts month as full name ("July"), prefix ("Jul") or number ("07"). */
  parseManualDate(box){
    if(!box) return null;
    const dayEl=box.querySelector('.df-day'), monEl=box.querySelector('.df-month'), yrEl=box.querySelector('.df-year');
    const day=(dayEl.value||'').trim(), mon=(monEl.value||'').trim(), yr=(yrEl.value||'').trim();
    [dayEl,monEl,yrEl].forEach(el=>el.classList.remove('invalid'));
    if(!day&&!mon&&!yr) return null;
    const d=+day, y=+yr; let m=0;
    if(/^[0-9]{1,2}$/.test(mon)) m=+mon;
    else if(mon.length>=3){ const i=MONTH_NAMES.findIndex(n=>n.toLowerCase().startsWith(mon.toLowerCase())); m=i>=0?i+1:0; }
    if(!/^[0-9]{1,2}$/.test(day)||d<1||d>31) dayEl.classList.add('invalid');
    if(m<1||m>12) monEl.classList.add('invalid');
    if(!/^[0-9]{4}$/.test(yr)||y<1900||y>2100) yrEl.classList.add('invalid');
    if(box.querySelector('.invalid')) return false;
    const dt=new Date(y,m-1,d);
    if(dt.getFullYear()!==y||dt.getMonth()!==m-1||dt.getDate()!==d){ dayEl.classList.add('invalid'); return false; }
    return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
};

/* ---------------- navigation configuration ----------------
   Each item: [pageKey, label, href, iconName]               */
const NAV = {
  admin:[
    {label:'Overview',items:[['dashboard','Dashboard','dashboard.html','dashboard']]},
    {label:'Management',items:[['students','Students','students.html','users'],['teachers','Teachers','teachers.html','briefcase'],['departments','Departments','departments.html','building'],['courses','Courses','courses.html','layers'],['subjects','Subjects','subjects.html','book'],['semesters','Semesters','semesters.html','calendar'],['sessions','Academic Sessions','academic-sessions.html','calendarDays']]},
    {label:'Examinations',items:[['examinations','Examinations','examinations.html','clipboard'],['routine','Routine Management','routine-management.html','calendarDays'],['marks-review','Marks Review','marks-review.html','clipboardCheck'],['results','Results','results.html','award']]},
    {label:'System',items:[['settings','Settings','settings.html','settings']]}
  ],
  teacher:[
    {label:'Overview',items:[['dashboard','Dashboard','dashboard.html','dashboard']]},
    {label:'Teaching',items:[['assigned-subjects','Assigned Subjects','assigned-subjects.html','book'],['students','Students','students.html','users'],['marks-entry','Marks Entry','marks-entry.html','pen'],['routine','Examination Routine','examination-routine.html','calendarDays']]},
    {label:'Account',items:[['profile','My Profile','profile.html','user']]}
  ],
  student:[
    {label:'Overview',items:[['dashboard','Dashboard','dashboard.html','dashboard']]},
    {label:'Academics',items:[['routine','Examination Routine','examination-routine.html','calendarDays'],['results','My Results','results.html','award'],['marksheet','Marksheet','marksheet.html','file']]},
    {label:'Account',items:[['profile','My Profile','profile.html','user'],['notifications','Notifications','notifications.html','bell']]}
  ]
};

const PROFILE_LINK = {admin:'settings.html',teacher:'profile.html',student:'profile.html'};
const ROLE_LABEL = {admin:'Administrator',teacher:'Faculty',student:'Student'};

/* inline favicon (navy graduation cap) */
const CES_FAVICON="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%230a1f44'/%3E%3Cpath d='M29 12 17 6 5 12l12 6z M8 14.5V20c0 2 4 3.6 9 3.6s9-1.6 9-3.6v-5.5 M29 12v7' fill='none' stroke='white' stroke-width='2.3' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E";

/* ---------------- shell builder ---------------- */
document.addEventListener('DOMContentLoaded', async ()=>{
  const role = document.body.dataset.role;
  if(!role) return;                       // public pages skip the shell
  const s = Auth.requireRole(role);       // route guard (redirects if wrong)
  if(!s) return;

  try{
    await DB.seedIfNeeded();              // seed fresh installs or migrate older data
  }catch(err){
    console.error('Portal database startup failed',err);
    document.body.innerHTML=`<main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#f3f6fb">
      <section class="panel" style="max-width:580px;width:100%"><div class="panel-body" style="padding:30px">
        <div class="alert danger">${icon('alert')}<div><b>Local database could not start</b><br>${esc(err.message||err.name||'Unknown storage error')}</div></div>
        <h2 style="margin-bottom:8px">WBSU Examination Portal</h2>
        <p class="muted">Your browser may be blocking local storage, or an earlier demo database may need repair. Normal Chrome, Edge and Firefox windows support IndexedDB. Avoid private/incognito mode.</p>
        <div class="flex gap-10 wrap mt-20"><button class="btn btn-danger" id="repairDb">${icon('refresh')} Repair local database</button><a class="btn btn-outline" href="../login.html">Back to sign in</a></div>
        <p class="small muted mt-14">Repair resets only this browser's local prototype data.</p>
      </div></section></main>`;
    document.getElementById('repairDb').addEventListener('click',async e=>{
      e.currentTarget.disabled=true; e.currentTarget.textContent='Repairing…';
      try{ await DB.reset(); sessionStorage.clear(); location.replace('../login.html'); }
      catch(repairErr){ UI.toast('Repair blocked',repairErr.message,'error'); e.currentTarget.disabled=false; e.currentTarget.textContent='Repair local database'; }
    });
    return;
  }

  /* favicon + mobile browser chrome color */
  if(!document.querySelector('link[rel=icon]')){ const fl=document.createElement('link'); fl.rel='icon'; fl.href=CES_FAVICON; document.head.appendChild(fl); }
  if(!document.querySelector('meta[name=theme-color]')){ const tm=document.createElement('meta'); tm.name='theme-color'; tm.content='#0a1f44'; document.head.appendChild(tm); }

  const college=(await DB.get('settings','college'))||{};

  /* sidebar */
  const sb=document.getElementById('sidebar');
  const active=document.body.dataset.page;
  sb.innerHTML=`
    <div class="side-brand">
      <div class="crest">${icon('grad',24)}</div>
      <div><b>${esc(college.name||'West Bengal State University')}</b><span>Examination Portal</span></div>
    </div>
    <div class="side-user">
      <span class="avatar">${initials(s.name)}</span>
      <div><b>${esc(s.name)}</b><span>${ROLE_LABEL[role]} · ${esc(s.uid)}</span></div>
    </div>
    <nav class="side-nav">
      ${NAV[role].map(g=>`<div class="nav-label">${g.label}</div>`+g.items.map(([p,label,href,ic])=>
        `<a class="nav-item ${p===active?'active':''}" href="${href}" title="${esc(label)}">${icon(ic)}<span>${label}</span></a>`).join('')).join('')}
    </nav>
    <div class="side-foot">
      <button class="btn btn-sm" id="logoutBtn">${icon('logout')}<span>Sign out</span></button>
      <p class="side-note">Frontend prototype — data is stored in this browser via IndexedDB.</p>
    </div>`;
  sb.querySelector('#logoutBtn').addEventListener('click',()=>Auth.logout());

  /* mobile overlay */
  const ov=document.createElement('div'); ov.className='sidebar-overlay'; document.body.appendChild(ov);
  const toggle=open=>{ sb.classList.toggle('open',open); ov.classList.toggle('show',open); };
  ov.addEventListener('click',()=>toggle(false));

  /* topbar */
  const tb=document.getElementById('topbar');
  tb.innerHTML=`
    <button class="icon-btn menu-btn" id="menuBtn" aria-label="Open navigation menu" title="Navigation menu">${icon('menu')}<span class="menu-label">Menu</span></button>
    <div class="top-title"><h2>${esc(document.body.dataset.title||'')}</h2><p>${esc(document.body.dataset.crumb||'College Examination & Result Computation System')}</p></div>
    <div class="top-actions">
      <div class="notif-wrap">
        <button class="icon-btn" id="bellBtn" style="position:relative">${icon('bell')}<span class="bell-count hidden" id="bellCount"></span></button>
        <div class="notif-drop" id="notifDrop"></div>
      </div>
      <div class="profile-wrap">
        <button class="profile-btn" id="profileBtn">
          <span class="avatar">${initials(s.name)}</span>
          <span class="pmeta"><b>${esc(s.name)}</b><span>${ROLE_LABEL[role]}</span></span>
          ${icon('chevron',14)}
        </button>
        <div class="profile-menu" id="profileMenu">
          <a href="${PROFILE_LINK[role]}">${icon('user')}<span>My Profile</span></a>
          <div class="divider" style="margin:6px 0"></div>
          <button class="pm-danger" id="pmLogout">${icon('logout')}<span>Sign out</span></button>
        </div>
      </div>
    </div>`;
  tb.querySelector('#menuBtn').addEventListener('click',()=>{
    if(window.matchMedia('(min-width:1025px)').matches){
      /* desktop / scaled laptops: toggle the compact sidebar rail */
      const on=document.documentElement.classList.toggle('nav-rail');
      const label=tb.querySelector('.menu-label'); if(label) label.textContent=on?'Show menu':'Hide menu';
      tb.querySelector('#menuBtn').setAttribute('aria-label',on?'Show navigation menu':'Hide navigation menu');
    }else toggle(true);                     /* tablets & mobiles: slide-in sidebar */
  });
  tb.querySelector('#pmLogout').addEventListener('click',()=>Auth.logout());

  /* dropdown behaviour */
  const bellBtn=tb.querySelector('#bellBtn'), drop=tb.querySelector('#notifDrop');
  const profBtn=tb.querySelector('#profileBtn'), menu=tb.querySelector('#profileMenu');
  document.addEventListener('click',e=>{
    if(!e.target.closest('.profile-wrap')) menu.classList.remove('open');
    if(!e.target.closest('.notif-wrap')) drop.classList.remove('open');
  });
  profBtn.addEventListener('click',()=>{ menu.classList.toggle('open'); drop.classList.remove('open'); });

  const refreshBell=async()=>{
    const n=await Notify.unread(s.role,s.uid);
    const c=document.getElementById('bellCount');
    c.textContent=n>9?'9+':n;
    c.classList.toggle('hidden',n===0);
  };
  window.refreshBell=refreshBell;
  refreshBell();

  /* one-time welcome flash after a successful sign-in (set by auth.js) */
  if(sessionStorage.getItem('ces-flash')==='welcome'){
    sessionStorage.removeItem('ces-flash');
    setTimeout(()=>UI.toast('Welcome back, '+s.name.split(' ')[0],
      'Signed in as '+ROLE_LABEL[s.role]+' · '+s.uid+'.', 'success'),350);
  }

  bellBtn.addEventListener('click', async ()=>{
    if(drop.classList.contains('open')){ drop.classList.remove('open'); return; }
    menu.classList.remove('open');
    const items=await Notify.forUser(s.role,s.uid,8);
    drop.innerHTML=`
      <div class="nd-head"><b>Notifications</b><button class="btn btn-sm btn-ghost" id="markAll">Mark all read</button></div>
      <div class="nd-body">${Notify.listHtml(items)}</div>`;
    drop.classList.add('open');
    drop.querySelector('#markAll').addEventListener('click',async()=>{ await Notify.markAllRead(s.role,s.uid); drop.classList.remove('open'); refreshBell(); });
    drop.querySelectorAll('.notif-item').forEach(el=>el.addEventListener('click',async()=>{
      await Notify.markRead(Number(el.dataset.id)); refreshBell();
      if(el.dataset.link) location.href=el.dataset.link; else { el.classList.remove('unread'); }
    }));
  });

  /* Live connection between Admin, Teacher and Student tabs. IndexedDB is
     shared already; CESDataSync (database.js) announces writes so this page
     can refresh without requiring a manual sign-out/sign-in cycle. */
  window.CESMarkDirty=()=>{ document.body.dataset.unsaved='true'; };
  window.CESMarkClean=()=>{ delete document.body.dataset.unsaved; };

  const syncDeps={
    'admin:dashboard':['*'],
    'admin:students':['students','results','departments','courses','academicSessions'],
    'admin:teachers':['teachers','subjects','departments','courses','semesters'],
    'admin:departments':['departments','students','teachers'],
    'admin:courses':['courses','students','subjects','departments'],
    'admin:subjects':['subjects','teachers','departments','courses','semesters','marks'],
    'admin:semesters':['semesters','students','subjects','examinationRoutines'],
    'admin:sessions':['academicSessions','examinations','examinationRoutines'],
    'admin:examinations':['examinations','marks','results'],
    'admin:routine':['examinationRoutines','departments','courses','subjects','academicSessions'],
    'admin:marks-review':['marks','teachers','examinations','subjects'],
    'admin:results':['results','marks','examinations','settings'],
    'admin:settings':['settings'],
    'teacher:dashboard':['teachers','subjects','students','marks','examinationRoutines','notifications','results'],
    'teacher:assigned-subjects':['teachers','subjects'],
    'teacher:students':['teachers','students','semesters','departments'],
    'teacher:marks-entry':['teachers','subjects','students','examinations','marks'],
    'teacher:routine':['teachers','subjects','examinationRoutines'],
    'teacher:profile':['teachers'],
    'student:dashboard':['students','results','examinationRoutines','notifications','settings'],
    'student:profile':['students','semesters'],
    'student:routine':['students','examinationRoutines'],
    'student:results':['students','results','settings'],
    'student:marksheet':['students','results','settings'],
    'student:notifications':['notifications']
  };
  const deps=syncDeps[role+':'+active]||['*'];
  const syncBar=document.createElement('div');
  syncBar.className='sync-bar';
  syncBar.innerHTML=`${icon('refresh')}<span>New portal data is available. Your unsaved work is protected.</span><button class="btn" type="button">Refresh now</button>`;
  document.body.appendChild(syncBar);
  syncBar.querySelector('button').addEventListener('click',()=>location.reload());

  let syncTimer=null;
  const showSyncBar=()=>syncBar.classList.add('show');
  const safelyRefresh=async()=>{
    const unsafe=document.body.dataset.unsaved==='true'||document.querySelector('.modal-overlay.open');
    if(unsafe){ showSyncBar(); return; }
    try{
      if(typeof window.CESPageRefresh==='function'){
        await window.CESPageRefresh();
        UI.toast('Portal updated','Changes from another role are now visible.','success');
      }else{
        location.reload();
      }
    }catch(err){ console.error('Live refresh failed',err); showSyncBar(); }
  };

  CESDataSync.subscribe(change=>{
    if(change.store==='notifications') refreshBell();
    if(change.store==='activityLog' && !(role==='admin'&&active==='dashboard')) return;
    if(change.store!=='*' && !deps.includes('*') && !deps.includes(change.store)) return;
    clearTimeout(syncTimer);
    syncTimer=setTimeout(safelyRefresh,450); // coalesce bulk marks/result writes
  });

  /* inactivity auto-logout (security): sign out after 20 minutes idle */
  let idleTimer=null;
  const IDLE_MS=20*60*1000;
  const resetIdle=()=>{ clearTimeout(idleTimer); idleTimer=setTimeout(()=>{
    UI.toast('Signed out','You were signed out after 20 minutes of inactivity.','warning');
    setTimeout(()=>Auth.logout(),900);
  }, IDLE_MS); };
  ['click','keydown','mousemove','scroll','touchstart'].forEach(ev=>document.addEventListener(ev,resetIdle,{passive:true}));
  resetIdle();

  /* bootstrap-admin reminder — shown AT MOST ONCE per session, and only
     while the "Secure your account" notification is still UNREAD.
     Marking notifications as read (or changing the password) stops the
     popup for good — it never repeats on every page. */
  if(role==='admin' && active!=='settings' && !sessionStorage.getItem('ces_nag_shown')){
    const adminRec=await DB.get('admins',s.id);
    if(adminRec && adminRec.mustChangePassword){
      const notes=await Notify.forUser('admin',adminRec.adminId,50);
      const secNote=notes.find(n=>n.type==='warning' && n.link==='settings.html' && !n.read);
      if(secNote){
        sessionStorage.setItem('ces_nag_shown','1');
        setTimeout(()=>UI.toast('Change your password','Open Settings → Account Security to replace the default administrator password.','warning'),1400);
      }
    }else if(s.mustChangePassword){
      /* keep the session in sync once it has been changed */
      const sess=Auth.session(); if(sess){ delete sess.mustChangePassword; Auth.save(sess); }
    }
  }

  /* floating back-to-top for long pages */
  const topBtn=document.createElement('button');
  topBtn.className='top-btn'; topBtn.title='Back to top'; topBtn.setAttribute('aria-label','Back to top');
  topBtn.innerHTML=`<span style="display:inline-flex;transform:rotate(180deg)">${icon('chevron',18)}</span>`;
  document.body.appendChild(topBtn);
  let topTick=false;
  window.addEventListener('scroll',()=>{ if(topTick) return; topTick=true;
    requestAnimationFrame(()=>{ topBtn.classList.toggle('show',window.scrollY>420); topTick=false; }); },{passive:true});
  topBtn.addEventListener('click',()=>window.scrollTo({top:0,behavior:'smooth'}));

  document.addEventListener('keydown',e=>{ if(e.key==='Escape') UI.closeModal(); });
});

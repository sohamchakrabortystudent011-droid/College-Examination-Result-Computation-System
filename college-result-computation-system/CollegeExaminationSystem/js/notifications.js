/* =============================================================
   notifications.js — role-based notification engine
   Stores per-user notifications and powers the topbar bell.
   ============================================================= */

const Notify = {

  /* create a notification for one user (uid) or a whole role */
  async push({role,uid,title,message,type='info',link=null}){
    return DB.add('notifications',{role,uid,title,message,type,link,read:false,createdAt:new Date().toISOString()});
  },

  /* broadcast to every student matching dept / semester */
  async pushStudents({title,message,type='info',link=null,departmentId=null,semester=null}){
    const students = await DB.filter('students',s=>
      (!departmentId || s.departmentId===departmentId) &&
      (!semester || s.currentSemester>=semester));
    for(const s of students)
      await this.push({role:'student',uid:s.regNo,title,message,type,link});
    return students.length;
  },

  /* broadcast to teachers assigned to a semester */
  async pushTeachers({title,message,type='info',link=null,semesterId=null,departmentId=null}){
    const teachers = await DB.filter('teachers',t=>
      (!semesterId || (t.assignedSemesters||[]).includes(semesterId)) &&
      (!departmentId || (t.assignedDepartments||[]).includes(departmentId)));
    for(const t of teachers)
      await this.push({role:'teacher',uid:t.teacherId,title,message,type,link});
    return teachers.length;
  },

  async forUser(role,uid,limit=50){
    const rows = await DB.byIndex('notifications','uid',uid);
    return rows.filter(n=>n.role===role).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,limit);
  },

  async unread(role,uid){
    return (await this.forUser(role,uid,100)).filter(n=>!n.read).length;
  },

  async markRead(id){
    const n = await DB.get('notifications',id);
    if(n){ n.read=true; await DB.put('notifications',n); }
  },

  async markAllRead(role,uid){
    const rows = await this.forUser(role,uid,200);
    for(const n of rows.filter(x=>!x.read)){ n.read=true; await DB.put('notifications',n); }
  },

  /* render the dropdown list used in the topbar */
  listHtml(items){
    if(!items.length)
      return `<div class="empty-state" style="padding:30px 16px">${icon('bell',40)}<h3>No notifications</h3><p>You are all caught up.</p></div>`;
    return items.map(n=>`
      <div class="notif-item ${n.read?'':'unread'}" data-id="${n.id}" data-link="${n.link||''}">
        <div class="notif-ico ${n.type}">${icon(n.type==='success'?'check':n.type==='warning'?'alert':n.type==='danger'?'x':'info')}</div>
        <div class="grow"><b>${esc(n.title)}</b><p>${esc(n.message)}</p><time>${timeAgo(n.createdAt)}</time></div>
      </div>`).join('');
  }
};

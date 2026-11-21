/* =============================================================
   calculations.js — Automatic result computation engine
   Percentage, grades, pass/fail, ranks against the admin-
   configurable grading scale and college rules.
   ============================================================= */

const Calc = {

  /* fallback scale (only used if settings row is missing) */
  DEFAULT_SCALE:[
    {min:90,max:100,grade:'O',points:10},{min:80,max:89,grade:'A+',points:9},
    {min:70,max:79,grade:'A',points:8},{min:60,max:69,grade:'B+',points:7},
    {min:50,max:59,grade:'B',points:6},{min:40,max:49,grade:'C',points:5},
    {min:0,max:39,grade:'F',points:0}],

  async grading(){
    const row = await DB.get('settings','grading');
    return (row && Array.isArray(row.scale) && row.scale.length) ? row.scale : this.DEFAULT_SCALE;
  },

  async rules(){
    const row = await DB.get('settings','rules');
    return Object.assign({passAllSubjects:true, absentPolicy:'fail'}, row||{});
  },

  /* Map a percentage to a grade using THRESHOLD semantics:
     the percentage earns the grade of the highest band whose
     "min" it reaches (bands are sorted by min descending).
     This is essential — fractional percentages such as 79.6%
     must not fall between the integer cut-offs of 70–79 / 80–89
     style bands. The "max" column remains informational only.
     Values are clamped into [0,100].                           */
  gradeOf(pct, scale){
    if(!Array.isArray(scale) || !scale.length) scale=this.DEFAULT_SCALE;
    const sorted=[...scale].sort((a,b)=>b.min-a.min);
    const p=Math.min(100,Math.max(0,+pct||0));
    for(const band of sorted) if(p>=band.min) return band.grade;
    return sorted[sorted.length-1].grade;
  },

  /* Build one student's result object from a set of marks.
     Absent students are NOT counted as zero: absent subjects are
     excluded from totals and flagged per college policy.        */
  computeStudent(exam, subjects, marksList, rules, scale){
    const rows = subjects.map(sub=>{
      const m = marksList.find(x=>x.subjectId===sub.id);
      if(!m){
        return {code:sub.code,name:sub.name,max:sub.maxMarks,obtained:null,grade:'—',status:'PENDING',credits:0};
      }
      if(m.absent){
        return {code:sub.code,name:sub.name,max:sub.maxMarks,obtained:null,grade:'—',status:'ABSENT',credits:0};
      }
      const pct = sub.maxMarks? (m.obtained/sub.maxMarks)*100 : 0;
      const pass = m.obtained >= sub.passMarks;
      return {code:sub.code,name:sub.name,max:sub.maxMarks,obtained:m.obtained,grade:this.gradeOf(pct,scale),status:pass?'PASS':'FAIL',credits:pass?sub.credits:0};
    });
    const attempted = rows.filter(r=>r.status!=='ABSENT'&&r.status!=='PENDING');
    const totalMax   = attempted.reduce((a,r)=>a+r.max,0);
    const totalObt   = attempted.reduce((a,r)=>a+r.obtained,0);
    const percentage = totalMax? Math.round((totalObt/totalMax)*10000)/100 : 0;
    const explicitAbsentCount = rows.filter(r=>r.status==='ABSENT').length;
    const missingCount = rows.filter(r=>r.status==='PENDING').length;
    const failedCount = rows.filter(r=>r.status==='FAIL').length;
    let overall;
    if(missingCount>0){
      overall = 'INCOMPLETE';
    }else if(rules.passAllSubjects === false){
      overall = percentage >= 40 ? 'PASS' : 'FAIL';            // aggregate-based rule
    }else if(rules.absentPolicy === 'exclude'){
      overall = failedCount===0 ? 'PASS' : 'FAIL';             // absent subjects ignored by college policy
    }else{
      overall = (failedCount===0 && explicitAbsentCount===0) ? 'PASS' : 'FAIL';
    }
    return {
      subjects:rows, totalMax, totalObtained:totalObt, percentage,
      grade:overall==='INCOMPLETE'?'—':this.gradeOf(percentage,scale), overall,
      absentCount:explicitAbsentCount, missingCount,
      creditsEarned:rows.reduce((a,r)=>a+r.credits,0)
    };
  },

  /* Recompute the whole examination from approved/published marks.
     opts.publish=true stores results directly as 'published'.    */
  async computeExam(examId, opts={}){
    const exam = await DB.get('examinations',examId);
    if(!exam) return {count:0};
    const subjects = (await DB.getAll('subjects'))
      .filter(s=>s.departmentId===exam.departmentId && s.semesterId===exam.semesterId)
      .sort((a,b)=>a.code.localeCompare(b.code));
    const marks = (await DB.byIndex('marks','examId',examId))
      .filter(m=>m.status==='approved'||m.status==='published');
    const [rules,scale] = await Promise.all([this.rules(),this.grading()]);

    // group marks per student (registration number)
    const byReg = {};
    marks.forEach(m=>{ (byReg[m.regNo] ||= []).push(m); });

    // previous publication state (recalculation keeps published state)
    const prev = await DB.byIndex('results','examId',examId);
    const wasPublished = prev.some(r=>r.status==='published');
    const newStatus = opts.publish ? 'published' : (wasPublished ? 'published' : 'computed');
    for(const r of prev) await DB.del('results',r.id);

    const results = [];
    for(const regNo of Object.keys(byReg)){
      const list = byReg[regNo];
      const student = await DB.oneByIndex('students','regNo',regNo);
      const r = this.computeStudent(exam,subjects,list,rules,scale);
      results.push(Object.assign(r,{
        examId:exam.id, examName:exam.name, examType:exam.type, session:exam.session,
        departmentId:exam.departmentId, department:exam.department,
        courseId:exam.courseId, course:exam.course,
        semesterId:exam.semesterId, semester:exam.semester, semesterName:exam.semesterName,
        regNo, studentId:student?student.id:null,
        studentName:student?student.name:list[0].studentName,
        rollNo:student?student.rollNo:'—',
        rank:null, status:newStatus, computedAt:new Date().toISOString(),
        publishedAt:opts.publish?(opts.publishedAt||new Date().toISOString()):(wasPublished?prev.find(p=>p.regNo===regNo)?.publishedAt:null)
      }));
    }
    // class rank: absent-policy students are excluded from ranking
    const ranked = results.filter(r=>r.overall==='PASS'&&r.absentCount===0&&r.missingCount===0).sort((a,b)=>b.percentage-a.percentage);
    let rank=0,lastPct=null,seen=0;
    for(const r of ranked){ seen++; if(r.percentage!==lastPct){ rank=seen; lastPct=r.percentage; } r.rank=rank; }
    for(const r of results) await DB.add('results',r);
    return {count:results.length,status:newStatus};
  },

  /* publish (or unpublish) every computed result of an exam */
  async setExamPublication(examId, publish){
    const rows = await DB.byIndex('results','examId',examId);
    if(publish && rows.some(r=>r.overall==='INCOMPLETE'||(r.missingCount||0)>0))
      throw new Error('Results are incomplete. Approve marks for every subject before publication.');
    const stamp = new Date().toISOString();
    for(const r of rows){ r.status = publish?'published':'computed'; if(publish && !r.publishedAt) r.publishedAt=stamp; await DB.put('results',r); }
    return rows.length;
  },

  /* grade distribution for an exam (used by admin results page).
     Grades are recomputed from the stored percentage against the
     CURRENT scale, so rows computed before a scale/band change
     are still bucketed correctly.                               */
  distribution(results, scale){
    const sc = (scale && scale.length) ? scale : this.DEFAULT_SCALE;
    const d = {};
    results.forEach(r=>{ const g = r.overall==='PASS' ? this.gradeOf(r.percentage, sc) : r.overall==='INCOMPLETE'?'Pending':'F'; d[g]=(d[g]||0)+1; });
    return d;
  }
};

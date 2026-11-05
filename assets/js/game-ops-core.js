(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.TaskRingOpsCore=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const games={ZZZ:'绝区零',NTE:'异环',WUWA:'鸣潮',HSR:'崩铁',ONMYOJI:'阴阳师',ENF:'终末地'};
  const DAY=86400000;
  function deadline(task){return task.claim_end_at||task.deadline_at||task.gameplay_end_at||null;}
  function jstDayMs(day,endOfDay){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day||''))return NaN;
    return Date.parse(day+(endOfDay?'T23:59:59.999+09:00':'T00:00:00+09:00'));
  }
  // All task-board dates are compared in the user's canonical JST calendar.
  // Precise source timestamps remain stored unchanged for auditing/claims.
  function jstDate(value){
    if(!value)return "";
    const instant=new Date(value);
    if(!Number.isFinite(instant.getTime()))return "";
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(instant);
    const part=type=>parts.find(p=>p.type===type)?.value;
    return part("year")+"-"+part("month")+"-"+part("day");
  }
  function taskStartDay(task){return task.open_date||jstDate(task.open_at);}
  function taskEndDay(task){return task.deadline_date||jstDate(deadline(task));}
  function calendarDayNumber(day){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(day||""))return NaN;
    const [y,m,d]=day.split("-").map(Number);
    return Math.round(Date.UTC(y,m-1,d)/DAY);
  }
  function daysUntilEnd(task,now=Date.now()){
    const end=calendarDayNumber(taskEndDay(task)),today=calendarDayNumber(jstDate(now));
    return Number.isFinite(end)&&Number.isFinite(today)?end-today:null;
  }
  function deadlineMs(task){
    const ms=jstDayMs(taskEndDay(task),true);
    return Number.isFinite(ms)?ms:Infinity;
  }
  function urgency(task,now=Date.now()){
    if(task.archived_at||task.lifecycle_status==="ARCHIVED")return "none";
    const days=daysUntilEnd(task,now);
    if(days===null)return "none";
    if(days<0)return task.verification==="CONFIRMED"?"red":"none";
    if(days<=3)return "red";
    if(days<=7)return "yellow";
    return "none";
  }
  function state(task,now=Date.now()){
    if(task.archived_at||task.lifecycle_status==="ARCHIVED")return "ARCHIVED";
    const today=calendarDayNumber(jstDate(now));
    const opening=calendarDayNumber(taskStartDay(task));
    if(Number.isFinite(opening)&&opening>today)return "UPCOMING";
    const days=daysUntilEnd(task,now);
    if(days!==null&&days<0)return task.verification==="CONFIRMED"?"EXPIRED":"ACTIVE";
    if(days!==null&&days<=1)return "ENDING_SOON";
    // Keep the original upstream state when no trustworthy start date exists.
    if(!Number.isFinite(opening)&&task.lifecycle_status==="UPCOMING")return "UPCOMING";
    return "ACTIVE";
  }
  function groups(tasks,now=Date.now()){
    const out={ENDING_SOON:[],ACTIVE:[],UPCOMING:[]};
    tasks.forEach(task=>{
      const status=state(task,now);
      if(status==="ARCHIVED")return;
      out[status==="EXPIRED"?"ENDING_SOON":status].push(task);
    });
    Object.values(out).forEach(list=>list.sort((a,b)=>
      deadlineMs(a)-deadlineMs(b)||
      (calendarDayNumber(taskStartDay(a))||Infinity)-(calendarDayNumber(taskStartDay(b))||Infinity)||
      String(a.task_key||"").localeCompare(String(b.task_key||""))
    ));
    return out;
  }
  function jstInput(value){if(!value)return null;const d=new Date(value+':00+09:00');if(!Number.isFinite(d.getTime()))throw new Error('时间格式无效');return d.toISOString();}
  function manual(form,userId,uuid){
    const open=jstInput(form.open_at),end=jstInput(form.deadline_at);
    if(open&&end&&Date.parse(open)>=Date.parse(end))throw new Error('截止时间须晚于开始时间');
    const name=String(form.task_name||'').trim();if(!name)throw new Error('请输入任务名');
    return {user_id:userId,task_key:'MANUAL|'+form.game+'|'+uuid,game:form.game,server:['ZZZ','WUWA','HSR'].includes(form.game)?'GLOBAL':'CN',task_name:name,task_type:form.task_type,period:form.period||null,open_at:open,deadline_at:end,notes:form.notes||null,source_level:'MANUAL',verification:'TO_VERIFY',lifecycle_status:open&&Date.parse(open)>Date.now()?'UPCOMING':'ACTIVE',priority:'NORMAL'};
  }
  return {games,deadline,deadlineMs,urgency,state,groups,jstInput,manual,taskStartDay,taskEndDay,daysUntilEnd};
});

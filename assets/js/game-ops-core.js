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
  function deadlineMs(task){
    const exact=deadline(task);
    if(exact){const ms=Date.parse(exact);return Number.isFinite(ms)?ms:Infinity;}
    const ms=jstDayMs(task.deadline_date,true);
    return Number.isFinite(ms)?ms:Infinity;
  }
  function dateOnlyDaysLeft(task,now){
    if(!task.deadline_date||deadline(task))return null;
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(now));
    const val=k=>parts.find(p=>p.type===k)?.value;
    const today=Date.UTC(+val('year'),+val('month')-1,+val('day'));
    const d=task.deadline_date.split('-').map(Number);
    return Math.round((Date.UTC(d[0],d[1]-1,d[2])-today)/DAY);
  }
  function urgency(task,now=Date.now()){
    if(task.archived_at||task.lifecycle_status==='ARCHIVED')return 'none';
    const ms=deadlineMs(task);
    if(!Number.isFinite(ms))return 'none';
    const left=ms-now;
    if(left<0&&task.verification!=='CONFIRMED')return 'none';
    const dateDays=dateOnlyDaysLeft(task,now);
    if(dateDays!==null){
      if(dateDays<0)return task.verification==='CONFIRMED'?'red':'none';
      if(dateDays<=3)return 'red';
      if(dateDays<=7)return 'yellow';
      return 'none';
    }
    if(left<=3*DAY)return 'red';
    if(left<=7*DAY)return 'yellow';
    return 'none';
  }
  function state(task,now=Date.now()){
    if(task.archived_at||task.lifecycle_status==='ARCHIVED')return 'ARCHIVED';
    if(task.open_at&&Date.parse(task.open_at)>now)return 'UPCOMING';
    const end=deadlineMs(task),remaining=Number.isFinite(end)?end-now:Infinity;
    if(remaining<=0){
      if(task.verification==='CONFIRMED')return 'EXPIRED';
      return task.lifecycle_status==='UPCOMING'?'UPCOMING':'ACTIVE';
    }
    if(remaining<=86400000||(task.claim_end_at&&remaining<=172800000))return 'ENDING_SOON';
    if(task.lifecycle_status==='UPCOMING'&&!task.open_at)return 'UPCOMING';
    return 'ACTIVE';
  }
  function groups(tasks,now=Date.now()){
    const out={ENDING_SOON:[],ACTIVE:[],UPCOMING:[]};
    tasks.forEach(t=>{const s=state(t,now);if(s==='ARCHIVED')return;out[s==='EXPIRED'?'ENDING_SOON':s].push(t);});
    Object.values(out).forEach(list=>list.sort((a,b)=>deadlineMs(a)-deadlineMs(b)||(Date.parse(a.open_at)||jstDayMs(a.open_date,false)||Infinity)-(Date.parse(b.open_at)||jstDayMs(b.open_date,false)||Infinity)||a.task_key.localeCompare(b.task_key)));
    return out;
  }
  function jstInput(value){if(!value)return null;const d=new Date(value+':00+09:00');if(!Number.isFinite(d.getTime()))throw new Error('时间格式无效');return d.toISOString();}
  function manual(form,userId,uuid){
    const open=jstInput(form.open_at),end=jstInput(form.deadline_at);
    if(open&&end&&Date.parse(open)>=Date.parse(end))throw new Error('截止时间须晚于开始时间');
    const name=String(form.task_name||'').trim();if(!name)throw new Error('请输入任务名');
    return {user_id:userId,task_key:'MANUAL|'+form.game+'|'+uuid,game:form.game,server:['ZZZ','WUWA','HSR'].includes(form.game)?'GLOBAL':'CN',task_name:name,task_type:form.task_type,period:form.period||null,open_at:open,deadline_at:end,notes:form.notes||null,source_level:'MANUAL',verification:'TO_VERIFY',lifecycle_status:open&&Date.parse(open)>Date.now()?'UPCOMING':'ACTIVE',priority:'NORMAL'};
  }
  return {games,deadline,deadlineMs,urgency,state,groups,jstInput,manual};
});

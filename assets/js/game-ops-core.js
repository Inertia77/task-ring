(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.TaskRingOpsCore=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const games={ZZZ:'绝区零',NTE:'异环',WUWA:'鸣潮',HSR:'崩铁',ONMYOJI:'阴阳师',ENF:'终末地'};
  function deadline(task){return task.claim_end_at||task.deadline_at||task.gameplay_end_at||null;}
  function state(task,now=Date.now()){
    if(task.archived_at||task.lifecycle_status==='ARCHIVED')return 'ARCHIVED';
    if(task.open_at&&Date.parse(task.open_at)>now)return 'UPCOMING';
    const end=deadline(task),remaining=end?Date.parse(end)-now:Infinity;
    if(remaining<=0)return 'EXPIRED';
    if(remaining<=86400000||(task.claim_end_at&&remaining<=172800000))return 'ENDING_SOON';
    if(task.lifecycle_status==='UPCOMING'&&!task.open_at)return 'UPCOMING';
    return 'ACTIVE';
  }
  function groups(tasks,now=Date.now()){
    const out={ENDING_SOON:[],ACTIVE:[],UPCOMING:[]};
    tasks.forEach(t=>{const s=state(t,now);if(s==='ARCHIVED')return;out[s==='EXPIRED'?'ENDING_SOON':s].push(t);});
    Object.values(out).forEach(list=>list.sort((a,b)=>(Date.parse(deadline(a))||Infinity)-(Date.parse(deadline(b))||Infinity)||(Date.parse(a.open_at)||Infinity)-(Date.parse(b.open_at)||Infinity)||a.task_key.localeCompare(b.task_key)));
    return out;
  }
  function jstInput(value){if(!value)return null;const d=new Date(value+':00+09:00');if(!Number.isFinite(d.getTime()))throw new Error('时间格式无效');return d.toISOString();}
  function manual(form,userId,uuid){
    const open=jstInput(form.open_at),end=jstInput(form.deadline_at);
    if(open&&end&&Date.parse(open)>=Date.parse(end))throw new Error('截止时间须晚于开始时间');
    const name=String(form.task_name||'').trim();if(!name)throw new Error('请输入任务名');
    return {user_id:userId,task_key:'MANUAL|'+form.game+'|'+uuid,game:form.game,server:['ZZZ','WUWA','HSR'].includes(form.game)?'GLOBAL':'CN',task_name:name,task_type:form.task_type,period:form.period||null,open_at:open,deadline_at:end,notes:form.notes||null,source_level:'MANUAL',verification:'TO_VERIFY',lifecycle_status:open&&Date.parse(open)>Date.now()?'UPCOMING':'ACTIVE',priority:'NORMAL'};
  }
  return {games,deadline,state,groups,jstInput,manual};
});

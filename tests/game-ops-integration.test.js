// DOM integration with a deterministic Supabase transport. Live RLS/write checks
// are separate transaction tests against TaskRingAI; this suite uses no secrets.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..');
const uid='test-owner';
const task=(id,extra={})=>({id,user_id:uid,task_key:id,game:'ZZZ',server:'GLOBAL',task_name:id,task_type:'RECURRING',lifecycle_status:'ACTIVE',verification:'TO_VERIFY',priority:'NORMAL',user_action:'NONE',archived_at:null,...extra});
const tick=()=>new Promise(r=>setTimeout(r,20));
async function boot(db,cache={},online=true,owner=uid){
  const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'http://127.0.0.1:8000/?preview=1',runScripts:'outside-only',pretendToBeVisual:true});
  const w=dom.window;w.scrollTo=()=>{};let connected=online;Object.defineProperty(w.navigator,'onLine',{get:()=>connected});
  Object.entries(cache).forEach(([k,v])=>w.localStorage.setItem(k,v));
  const calls=[],errors=[];w.addEventListener('error',e=>errors.push(e.error));w.fetch=async()=>({ok:true,json:async()=>({})});
  const client={fail:false,auth:{onAuthStateChange(){},getSession:async()=>({data:{session:owner?{user:{id:owner}}:null}}),signOut:async()=>({})},from(table){
    const q={table,filters:[],orders:[],mode:'read',data:null,start:0,end:Infinity,eq(k,v){this.filters.push(r=>r[k]===v);return this;},is(k,v){this.filters.push(r=>(r[k]??null)===v);return this;},not(k,_op,v){this.filters.push(r=>(r[k]??null)!==v);return this;},order(k,opts){this.orders.push([k,opts]);return this;},range(a,b){this.start=a;this.end=b;return this;},select(){return this;},update(data){this.mode='update';this.data=data;return this;},insert(data){this.mode='insert';this.data=data;return this;},single(){this.one=true;return this;},then(ok,fail){
      calls.push({table,mode:this.mode,range:[this.start,this.end]});
      let result;if(client.fail||!connected)result={data:null,error:{message:'test transport failure'}};
      else{
        let found=db.filter(r=>this.filters.every(f=>f(r)));
        if(this.mode==='insert'){const r=task('manual-'+db.length,this.data);db.push(r);found=[r];}
        if(this.mode==='update')found.forEach(r=>{Object.assign(r,this.data);if(r.lifecycle_status==='ARCHIVED')r.archived_at=new Date().toISOString();});
        found=found.slice();found.sort((a,b)=>{for(const [k,o] of this.orders){if(a[k]===b[k])continue;if(a[k]==null)return o.nullsFirst? -1:1;if(b[k]==null)return o.nullsFirst?1:-1;return String(a[k]).localeCompare(String(b[k]))*(o.ascending?1:-1);}return 0;});
        result={data:JSON.parse(JSON.stringify(this.one?found[0]:found.slice(this.start,this.end+1))),error:null};
      }
      return Promise.resolve(result).then(ok,fail);
    }};return q;
  }};
  w.supabase={createClient:()=>client};
  const scripts=[...w.document.querySelectorAll('script[src]')].map(s=>s.getAttribute('src').split('?')[0]).filter(s=>!s.includes('/vendor/')&&!s.endsWith('pwa.js'));
  for(const file of scripts)new vm.Script(fs.readFileSync(path.join(root,file),'utf8'),{filename:file}).runInContext(dom.getInternalVMContext());
  await tick();
  const click=async selector=>{const b=w.document.querySelector(selector);assert(b,'Missing '+selector);b.click();await tick();};
  await click('[data-gqv6-board="hub"]');
  return {w,dom,client,calls,errors,click,offline:async()=>{connected=false;w.dispatchEvent(new w.Event('offline'));await tick();},online:async()=>{connected=true;w.dispatchEvent(new w.Event('online'));await tick();},cache:()=>Object.fromEntries(Object.keys(w.localStorage).map(k=>[k,w.localStorage.getItem(k)]))};
}
test('cloud tasks, Done/Skip persist, archive filtering is paged, daily/weekly stay intact',async()=>{
  const db=[task('UPCOMING',{open_at:new Date(Date.now()+2*86400000).toISOString()}),task('URGENT',{deadline_at:new Date(Date.now()+3600000).toISOString()}),task('ACTIVE'),task('SKIP_ME')];
  const s=await boot(db);try{
    assert.deepEqual(s.errors,[]);assert.match(s.w.document.querySelector('#gameOpsCloud').textContent,/即将结束.*进行中.*即将开放/s);
    assert.equal(s.w.document.querySelectorAll('.opsCard.urgent').length,1);
    assert(!s.w.document.querySelector('#gameQuestPanel').textContent.includes('Sheet'));
    await s.click('[data-ops-action="DONE"][data-id="ACTIVE"]');assert.equal(db.find(r=>r.id==='ACTIVE').user_action,'DONE');assert(!s.w.document.querySelector('[data-ops-card="ACTIVE"]'));
    await s.click('[data-ops-action="SKIP"][data-id="SKIP_ME"]');assert.equal(db.find(r=>r.id==='SKIP_ME').user_action,'SKIP');
    await s.click('[data-ops-history]');assert.equal(s.w.document.querySelectorAll('.opsCard').length,2);
    assert(s.calls.some(c=>c.mode==='read'&&c.range[1]===25));
    const reason=s.w.document.querySelector('[data-ops-reason]');reason.value='DONE';reason.dispatchEvent(new s.w.Event('change',{bubbles:true}));await tick();assert.equal(s.w.document.querySelectorAll('.opsCard').length,1);
    await s.click('[data-gqv6-board="daily"]');await s.click('[data-gqv5-task]');assert.equal(s.w.document.querySelector('[data-gqv5-task]').getAttribute('aria-pressed'),'true');
    await s.click('[data-gqv6-board="weekly"]');await s.click('[data-gqv5-task]');assert.equal(s.w.document.querySelector('[data-gqv5-task]').getAttribute('aria-pressed'),'true');
    await s.click('[data-gqv6-board="daily"]');assert.equal(s.w.document.querySelector('[data-gqv5-task]').getAttribute('aria-pressed'),'true');
    await s.click('#controlGameQuestEditorBtn');
    const before=s.w.document.querySelectorAll('[data-gqv6-editor-task]').length;assert(before>0);
    const title=s.w.document.querySelector('.gqV6TitleInput');title.value='编辑保留测试';
    await s.click('#saveGameQuestBtn');
    await s.click('#controlGameQuestEditorBtn');assert.equal(s.w.document.querySelectorAll('[data-gqv6-editor-task]').length,before);assert.equal(s.w.document.querySelector('.gqV6TitleInput').value,'编辑保留测试');
    const refreshed=await boot(db,s.cache());try{assert(!refreshed.w.document.querySelector('[data-ops-card="ACTIVE"]'));await refreshed.click('[data-ops-history]');assert.equal(refreshed.w.document.querySelectorAll('.opsCard').length,2);}finally{refreshed.dom.window.close();}
  }finally{s.dom.window.close();}
});
test('failed mutation keeps row and error; offline cache recovers without false Done',async()=>{
  const db=[task('SAFE')],s=await boot(db);try{
    s.client.fail=true;await s.click('[data-ops-action="DONE"]');assert(s.w.document.querySelector('[data-ops-card="SAFE"]'));assert.match(s.w.document.querySelector('.opsError').textContent,/操作未确认/);assert.equal(db[0].user_action,'NONE');
    s.client.fail=false;await s.offline();assert.match(s.w.document.querySelector('.opsSync').textContent,/离线缓存/);assert(s.w.document.querySelector('[data-ops-action="DONE"]').disabled);
    const offline=await boot(db,s.cache(),false);try{assert(offline.w.document.querySelector('[data-ops-card="SAFE"]'));assert.match(offline.w.document.querySelector('.opsSync').textContent,/离线缓存/);}finally{offline.dom.window.close();}
    db.push(task('NEW'));await s.online();assert(s.w.document.querySelector('[data-ops-card="NEW"]'));
    const stranger=await boot(db,s.cache(),false,'other-owner');try{assert.equal(stranger.w.document.querySelectorAll('.opsCard').length,0);}finally{stranger.dom.window.close();}
  }finally{s.dom.window.close();}
});

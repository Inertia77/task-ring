const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../assets/js/game-ops-cloud.js'),'utf8');
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const clone=value=>JSON.parse(JSON.stringify(value));
const row=(overrides={})=>({game_key:'azur_promilia',board:'daily',task_key:'stable-id',title:'Cloud title',note:'note',url:'',enabled:true,lane:'optional',sort_order:0,unlock_hint:'',active_from:'2026-11-26',verification:'TO_VERIFY',...overrides});
function harness(initial){
  let data=clone(initial),authCallback,session={user:{id:'owner-a'}},calls=[];
  const storage=new Map();
  const q={select(){return this},eq(){return this},is(){return this},order(){return this},range(){return this},then(resolve){resolve({data:[],error:null})}};
  const client={
    auth:{onAuthStateChange(cb){authCallback=cb},async getSession(){return {data:{session}}}},
    from(){return q},
    async rpc(name,args){calls.push({name,args:args&&clone(args)});
      if(name==='get_game_routine_catalog')return {data:clone(data)};
      if(args.expected_revision!==data.revision)return {error:{message:'revision conflict'}};
      for(const c of args.changes){
        const idx=data.rows.findIndex(r=>r.game_key===c.game_key&&r.board===c.board&&r.task_key===c.task_key);
        if(c.op==='archive'){if(idx>=0)data.rows.splice(idx,1)}
        else {const {op,...patch}=c;if(idx>=0)data.rows[idx]={...data.rows[idx],...patch};else data.rows.push(patch);}
      }
      data.revision++;return {data:clone(data)};
    }
  };
  const window={TaskRingOpsCore:{games:{}},TaskRingOpsConfig:{},TaskRingGamePlayPolicy:{
    allGames:()=>[{key:'azur_promilia',code:'AZUR_PROMILIA',name:'蓝色星原：旅谣',tier:2,sortOrder:1}],forCode:()=>({tier:2}),setOwner(){},setRows(){},setOpsTasks(){}
  },supabase:{createClient:()=>client},TaskRingGameOpsV6:{refreshRoutines(){}},TaskRingCommand:{renderOverview(){}}};
  const ctx={window,document:{getElementById:()=>null,addEventListener(){},querySelector:()=>null},navigator:{onLine:true},
    localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
    addEventListener(){},setInterval(){},setTimeout(fn){fn()},console};
  vm.runInNewContext(source,ctx);
  return {api:window.TaskRingGameOpsCloud,calls,ctx,setCatalog(v){data=clone(v)},switchUser(next){session=next;authCallback('SIGNED_IN',session);}};
}
const legacy={version:6,games:[{id:'zzz',name:'Legacy'}],boards:{daily:{zzz:[{id:'old',title:'Old JSON'}]},weekly:{zzz:[]}}};
test('cloud catalog is authoritative, including a newly promoted game and date metadata',async()=>{
  const h=harness({revision:62,rows:[row()]});await flush();
  const projected=h.api.routineView(legacy);
  assert.equal(projected.routineRevision,62);
  assert.equal(projected.games.find(g=>g.id==='azur_promilia').name,'蓝色星原：旅谣');
  assert.equal(projected.boards.daily.zzz.length,0);
  assert.equal(projected.boards.daily.azur_promilia[0].id,'stable-id');
  assert.equal(projected.boards.daily.azur_promilia[0].active_from,'2026-11-26');
  assert.equal(legacy.boards.daily.zzz[0].title,'Old JSON');
  h.setCatalog({revision:63,rows:[]});await h.api.fetchRoutines();
  assert.equal(h.api.routineView(legacy).boards.daily.zzz.length,0);
});
test('editor sends only changed rows and preserves stable task IDs',async()=>{
  const h=harness({revision:62,rows:[row(),row({task_key:'second',sort_order:1,title:'Second'})]});await flush();
  const before=h.api.routineView(legacy),after=clone(before);
  after.boards.daily.azur_promilia[0].title='Renamed';
  assert.equal(h.api.routineChanges(before,before).length,0);
  await h.api.saveRoutines(before,after);
  const save=h.calls.find(c=>c.name==='save_game_routine_catalog');
  assert.equal(save.args.expected_revision,62);
  assert.equal(save.args.changes.length,1);
  assert.equal(save.args.changes[0].task_key,'stable-id');
  assert.equal(h.api.routineView(legacy).boards.daily.azur_promilia[0].title,'Renamed');
  await assert.rejects(h.api.saveRoutines(before,after),/云端游戏任务已更新/);
});
test('offline edit refuses cloud write and logout clears account projection',async()=>{
  const h=harness({revision:62,rows:[row()]});await flush();
  const before=h.api.routineView(legacy),after=clone(before);
  after.boards.daily.azur_promilia=[];
  h.ctx.navigator.onLine=false;
  await assert.rejects(h.api.saveRoutines(before,after),/联网/);
  assert.equal(h.calls.filter(c=>c.name==='save_game_routine_catalog').length,0);
  h.switchUser(null);await flush();
  assert.equal(h.api.routineState().active,false);
  assert.equal(h.api.routineView(legacy).boards.daily.zzz[0].title,'Old JSON');
});

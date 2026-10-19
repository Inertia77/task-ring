const {expect}=require('@playwright/test');
async function boot(page){
  await page.route('https://**/*',r=>r.abort());
  await page.goto('/?preview');
  await page.waitForFunction(()=>!!window.TaskRingProductUi);
  await page.evaluate(()=>{
    const cfg=buildDefaultConfig();
    cfg.tasks=[...Array(12)].map((_,i)=>({id:`test-task-${i}`,code:`t${String(i+100).padStart(3,'0')}`,title:i===0?'阅读与笔记：长标题用于验证手机和电脑换行与操作入口':'隔离测试任务 '+i,cat:'life',time_category:i%2?'language':'life',plan_mode:i<6?'daily':'weekly',days:[1,2,3,4,5,6,0],enabled:i!==11,weekly_minutes:60,estimated_minutes:15,note:'独立测试备注',steps:i===0?[{id:'stable-step-id',code:'s01',title:'阅读一章',enabled:true}]:[]}));
    cfg.tasks[6].steps=[{id:'weekly-stable-step',code:'s01',title:'周计划子任务',enabled:true}];
    cfg.tasks[7].ai_enabled=true;cfg.tasks[7].ai_period='weekly';cfg.tasks[7].ai_target=2;
    const ids=['zzz','nte','wuwa','hsr','onmyoji','endfield'];
    cfg.gameQuest={version:6,games:ids.map((id,i)=>({id,name:['绝区零','异环','鸣潮','崩铁','阴阳师','终末地'][i],short:id.toUpperCase(),enabled:true,priority:i+1,accent:'cyan',icon:'GQ'})),boards:{daily:{},weekly:{}}};
    ids.forEach(id=>{
      cfg.gameQuest.boards.daily[id]=[{id:'fixture-must',title:'每日资源领取与长任务名称测试',daily_lane:'must',enabled:true},{id:'fixture-optional',title:'有空处理的可选任务',daily_lane:'optional',enabled:true}];
      cfg.gameQuest.boards.weekly[id]=['sprint','steady','wait','optional'].map(lane=>({id:'fixture-'+lane,title:'周常任务 · '+lane,weekly_lane:lane,unlock_hint:lane==='wait'?'等待游戏内条件满足':'',enabled:true}));
    });
    cfg.refs=[{id:'test-ref-a',title:'学习资料',enabled:true,items:[{id:'ref-a',title:'语言学习笔记与长标题展示',url:'https://example.com/notes',enabled:true}]},{id:'test-ref-b',title:'工具收藏',enabled:true,items:[{id:'ref-b',title:'测试工具',url:'https://example.com/tool',enabled:true}]}];
    saveLocalTaskConfig(cfg,'隔离测试');applyTaskConfig(cfg,true);
  });
  await page.waitForFunction(()=>document.querySelector('#resetCurrentWeek')?.closest('.controlSafetyGrid'));
  await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('body')).not.toHaveClass(/locked/);
}
async function view(page,name){await page.locator(`#viewDock [data-view-target="${name}"]`).click();await expect(page.locator(`#viewDock [data-view-target="${name}"]`)).toHaveClass(/active/);}
module.exports={boot,view};

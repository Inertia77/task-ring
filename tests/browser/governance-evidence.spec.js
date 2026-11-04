const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');
const fs=require('node:fs');
const phase=process.env.AUDIT_PHASE||'after';
const dir=phase==='before'?'before-results':'test-results';
const modules=['tasks','weekly','fitness','game','time','library'];
for(const width of [390,1440])test(`governance comparable states ${width}`,async({page})=>{
 test.setTimeout(120000);
 await page.setViewportSize({width,height:900});await boot(page);
 // Make the expanded game-note state observable without touching remote data.
 await page.evaluate(()=>{const cfg=structuredClone(taskConfig);cfg.gameQuest.boards.daily.zzz[0].note='独立备注：保留展开状态，完成后继续当前游戏。';applyTaskConfig(cfg,true)});
 const metrics=[];
 const shot=async(module,state)=>{
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,build:document.documentElement.dataset.build,targets:[...document.querySelectorAll('.subtaskInline>summary,.fitnessItemMetaBtn,.gqV6LaneTab,.orbitDrawer>summary,.gameQuestTaskNote>summary')].filter(e=>e.getClientRects().length).map(e=>({class:e.className||e.parentElement.className,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})),collapse:!!document.querySelector('[data-gqv6-collapse]')}));
  metrics.push({module,state,...m});
  if(phase==='after')expect(m.scroll,`${module} ${state} overflow`).toBeLessThanOrEqual(m.width+1);
  await page.screenshot({path:`${dir}/governance/${test.info().project.name}/${phase}/${width}-${module}-${state}.png`,fullPage:true});
 };
 for(const module of modules){
  await page.setViewportSize({width,height:900});await view(page,module);
  if(module==='tasks')await page.locator('#showToday').click();
  await shot(module,'default');
  if(module==='tasks')await page.locator('.subtaskInline>summary').first().click();
  if(module==='weekly'){
   const g=page.locator('.weeklyMissionGroup[data-weekly-category="life"]');if(await g.getAttribute('open')===null)await g.locator('summary').first().click();
   await page.locator('.weeklySubtasks>summary').first().click();
  }
  if(module==='fitness')await page.locator('[data-fitness-toggle-note]').first().click();
  if(module==='game')await page.locator('.gameQuestTaskNote>summary').first().click();
  if(module==='time')await page.locator('[data-time-tab="tasks"]').click();
  if(module==='library'){
   const g=page.locator('[data-library-group]').first();if(await g.getAttribute('open')===null)await g.locator('summary').click();
  }
  await shot(module,'expanded');
  if(module==='tasks'||module==='weekly')await page.locator('.viewPanel.active [data-timer-start-task]').first().click();
  if(module==='fitness')await page.locator('[data-fitness-item]').first().click();
  if(module==='game')await page.locator('[data-gqv5-task]').filter({visible:true}).first().click();
  if(module==='time'){
   await page.locator('[data-manual-time-entry]').filter({visible:true}).first().click();
   await page.locator('[data-manual-time-form] input[name="minutes"]').fill('25');
  }
  if(module==='library')await page.locator('#librarySearchInput').fill('测试工具');
  await shot(module,'working');
  if(module==='time')await page.keyboard.press('Escape');
  if(module==='tasks'||module==='weekly')await page.evaluate(()=>abandonActiveTimer());
  await page.setViewportSize({width:width===390?320:1050,height:600});await shot(module,'narrow');
 }
 fs.mkdirSync(`${dir}/governance`,{recursive:true});fs.writeFileSync(`${dir}/governance/${test.info().project.name}-${phase}-${width}.json`,JSON.stringify(metrics,null,2));
});

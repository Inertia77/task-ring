const {test,expect}=require('@playwright/test');const {boot,view}=require('./helpers');
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r)))));
test('game direct rerender retains focus, open notes, reading position and unrelated DOM',async({page})=>{
 await page.setViewportSize({width:390,height:700});await boot(page);
 await page.evaluate(()=>{const cfg=structuredClone(taskConfig);cfg.gameQuest.boards.daily.zzz[0].note='这是展开的游戏任务说明。'.repeat(20);applyTaskConfig(cfg,true)});
 await view(page,'game');await page.locator('.gameQuestTaskNote summary').first().click();
 const task=page.locator('[data-gqv5-task][data-game="zzz"]').first();await task.focus();await page.evaluate(()=>{window.__refNode=document.querySelector('#refGrid').firstElementChild;window.scrollTo(0,200)});await settle(page);
 const before=await page.evaluate(()=>({y:scrollY,config:JSON.stringify(taskConfig),logs:JSON.stringify(readTimeLogs())}));
 await task.press('Space');await settle(page);
 await expect(task).toHaveAttribute('aria-pressed','true');await expect(task).toBeFocused();await expect(page.locator('.gameQuestTaskNote').first()).toHaveAttribute('open','');
 expect(await page.evaluate(()=>scrollY)).toBeCloseTo(before.y,0);
 expect(await page.evaluate(()=>window.__refNode===document.querySelector('#refGrid').firstElementChild)).toBe(true);
 expect(await page.evaluate(()=>({config:JSON.stringify(taskConfig),logs:JSON.stringify(readTimeLogs())}))).toEqual({config:before.config,logs:before.logs});
 await task.press('Space');await expect(task).toHaveAttribute('aria-pressed','false');
});
test('game sub-pages collapse independently and fresh module entry defaults expanded daily',async({page})=>{
 await boot(page);await view(page,'game');await page.locator('[data-gqv6-collapse="daily"]').click();await expect(page.locator('#gqv6-board-body')).toBeHidden();
 await page.locator('[data-gqv6-board="weekly"]').click();await expect(page.locator('#gqv6-board-body')).toBeVisible();await page.locator('[data-gqv6-collapse="weekly"]').click();
 await page.locator('[data-gqv6-board="daily"]').click();await expect(page.locator('#gqv6-board-body')).toBeHidden();
 await view(page,'library');await view(page,'game');await expect(page.locator('[data-gqv6-board="daily"]')).toHaveAttribute('aria-current','page');await expect(page.locator('#gqv6-board-body')).toBeVisible();
});
test('bulk game action only replaces game content and rapid tabs do not replay stale module scroll',async({page})=>{
 await page.setViewportSize({width:390,height:700});await boot(page);await view(page,'game');
 await page.evaluate(()=>window.__daily=document.querySelector('.dailyGroups').firstElementChild);
 await page.locator('[data-gqv5-card]').filter({visible:true}).first().click();
 expect(await page.evaluate(()=>window.__daily===document.querySelector('.dailyGroups').firstElementChild)).toBe(true);
 await page.evaluate(()=>{window.scrollTo(0,180);renderGameQuestPanel();setActiveAppView('weekly');setActiveAppView('library')});await settle(page);
 expect(await page.evaluate(()=>scrollY)).toBe(0);await expect(page.locator('#refGrid')).toBeVisible();
});
for(const count of [0,1,2,3,9])test(`mixed cards ${count}: titles, row bounds, expansion, data identity`,async({page})=>{
 await page.setViewportSize({width:1500,height:900});await boot(page);
 await page.evaluate(count=>{const cfg=structuredClone(taskConfig);const base=cfg.tasks[0];cfg.tasks=Array.from({length:count},(_,i)=>({...base,id:'mix-'+i,code:'m'+(800+i),time_category:i<4?'life':i%2?'language':'science',title:['长中文标题'.repeat(8),'日本語の長いタスク名'.repeat(8),'VeryLongEnglishTitleWithoutSpaces'.repeat(5)][i%3],ai_enabled:i%2===1,ai_chat_url:'https://example.com/chat',ai_archive_url:'https://example.com/archive',steps:i%2?[]:[{id:'stable-'+i,code:'s01',title:'展开后应完整显示的子任务'.repeat(12),enabled:true}]}));applyTaskConfig(cfg,true)},count);
 await page.locator('#showToday').click();await expect(page.locator('.dailyCard')).toHaveCount(count);
 const snap=await page.evaluate(()=>JSON.stringify(taskConfig));
 for(const e of await page.locator('.subtaskInline summary').all())await e.click();
 const rows=await page.locator('.dailyCard').evaluateAll(cards=>cards.map(c=>{const r=c.getBoundingClientRect();return {top:r.top,bottom:r.bottom,w:r.width,controls:[...c.querySelectorAll('.dailyActions>button,.dailyActions>a,.dailyActions>details>summary')].map(e=>e.getBoundingClientRect().height)}}));
 for(const a of rows){for(const b of rows)if(Math.abs(a.top-b.top)<2)expect(Math.abs(a.bottom-b.bottom)).toBeLessThanOrEqual(2);for(const h of a.controls){expect(h).toBeGreaterThanOrEqual(40);expect(h).toBeLessThanOrEqual(46)}}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(1500);
 expect(await page.evaluate(()=>JSON.stringify(taskConfig))).toBe(snap);
});
test('mobile high-frequency targets survive final CSS and text enlargement',async({page})=>{
 await page.setViewportSize({width:320,height:600});await boot(page);
 for(const mod of ['tasks','fitness','game']){
  await view(page,mod);
  const sizes=await page.locator('.viewPanel.active :is(.subtaskInline>summary,.orbitDrawer>summary,.fitnessItemMetaBtn,.fitnessItemLink,.gqV6LaneTab,.gqV6CompleteAll)').evaluateAll(els=>els.filter(e=>e.getClientRects().length).map(e=>({name:e.className||e.parentElement.className,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})));
  expect(sizes.length).toBeGreaterThan(0);for(const s of sizes){expect(s.w,s.name).toBeGreaterThanOrEqual(44);expect(s.h,s.name).toBeGreaterThanOrEqual(44)}
 }
 await page.addStyleTag({content:'html{font-size:200%}'});
 for(const mod of ['tasks','weekly','fitness','game','time','library']){await view(page,mod);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)}
});

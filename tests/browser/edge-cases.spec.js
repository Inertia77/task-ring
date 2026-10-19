const {test,expect}=require('@playwright/test');const {boot,view}=require('./helpers');
for(const width of [320,390,768,1440])test(`subpages, matrix, long text and text enlargement ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await boot(page);
 await page.locator('#showAll').click();await expect(page.locator('.weekMatrixScroll')).toBeVisible();await expect(page.locator('.weekMatrixScrollHint')).toContainText('横向');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`test-results/visual/${test.info().project.name}/after/${width}-matrix.png`,fullPage:true});
 await view(page,'game');if(width<=700)await page.locator('[data-gqv6-expand-all][data-lane="must"]').click();expect(await page.locator('[data-gqv5-task]').filter({visible:true}).count()).toBe(6);
 await page.locator('[data-gqv6-lane="optional"]').click();await expect(page.locator('.gqV6TaskBtn').filter({visible:true}).first()).toContainText('可选');
 await page.locator('[data-gqv6-board="weekly"]').click();
 for(const lane of ['sprint','steady','wait','optional']){await page.locator(`[data-gqv6-lane="${lane}"]`).click();await expect(page.locator('[data-gqv6-lane="'+lane+'"]').first()).toHaveAttribute('aria-selected','true')}
 await page.screenshot({path:`test-results/visual/${test.info().project.name}/after/${width}-game-weekly.png`,fullPage:true});
 await view(page,'time');for(const tab of ['tasks','logs','overview']){await page.locator(`[data-time-tab="${tab}"]`).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);await page.screenshot({path:`test-results/visual/${test.info().project.name}/after/${width}-time-${tab}.png`,fullPage:true})}
 await page.evaluate(()=>{const cfg=structuredClone(taskConfig);cfg.tasks[0].title='超长无空格标题'.repeat(20);cfg.refs[0].items[0].title='资料长标题'.repeat(20);applyTaskConfig(cfg,true)});
 await page.addStyleTag({content:'html {font-size:125%}'});
 for(const module of ['tasks','weekly','fitness','game','time','library']){await view(page,module);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)}
});
test('checkbox updates leave unrelated DOM and data unchanged',async({page})=>{
 await boot(page);await page.locator('#showToday').click();await page.evaluate(()=>window.__unrelated=document.getElementById('refGrid').firstElementChild);
 const before=await page.evaluate(()=>({config:JSON.stringify(taskConfig),logs:JSON.stringify(readTimeLogs()),game:JSON.stringify(gameQuestConfig)}));
 await page.locator('[data-task="test-task-2"]').first().locator('..').click();
 expect(await page.evaluate(()=>window.__unrelated===document.getElementById('refGrid').firstElementChild)).toBe(true);
 expect(await page.evaluate(()=>({config:JSON.stringify(taskConfig),logs:JSON.stringify(readTimeLogs()),game:JSON.stringify(gameQuestConfig)}))).toEqual(before);
});
test('floating timer, toast and modal actions do not collide with mobile navigation',async({page})=>{
 await page.setViewportSize({width:390,height:700});await boot(page);
 await page.locator('[data-timer-start-task="test-task-2"]').first().click();
 const dock=await page.locator('#timerFloatDock').boundingBox(),nav=await page.locator('#viewDock').boundingBox();expect(dock.y+dock.height).toBeLessThan(nav.y);
 await page.locator('#controlCenterBtn').click();await page.locator('#controlTaskEditorBtn').click();await expect(page.locator('#timerFloatDock')).toBeHidden();
 await page.locator('#taskEditorBottomSaveBtn').scrollIntoViewIfNeeded();const save=await page.locator('#taskEditorBottomSaveBtn').boundingBox();expect(save.y+save.height).toBeLessThanOrEqual(700);
});
test('sync UI distinguishes pending, failure and conflict without sending requests',async({page})=>{
 await boot(page);
 for(const [text,kind] of [['等待保存','sync'],['保存中','sync'],['保存失败','err'],['本地有冲突','warn'],['只读模式','off']]){await page.evaluate(([t,c])=>setGhStatus('GitHub：'+t,c),[text,kind]);await expect(page.locator('#githubStatus')).toContainText(text)}
});

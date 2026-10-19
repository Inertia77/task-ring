const {test}=require('@playwright/test');const {boot,view}=require('./helpers');
for(const width of [390,1440])test(`reviewable key surfaces ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await boot(page);const phase=process.env.AUDIT_PHASE||'after';
 const shot=name=>page.screenshot({path:`test-results/visual/${test.info().project.name}/${phase}/${width}-${name}.png`,fullPage:true});
 await page.locator('#showToday').click();await shot('daily-today');await page.locator('#showAll').click();await shot('daily-matrix');
 await view(page,'weekly');const group=page.locator('.weeklyMissionGroup').first();if(await group.getAttribute('open')===null)await group.locator('summary').first().click();await shot('weekly-open');
 await view(page,'library');await page.locator('[data-library-group]').first().locator('summary').click();await shot('library-open');await page.locator('#librarySearchInput').fill('测试工具');await shot('library-search');
 await view(page,'game');await page.locator('[data-gqv6-board="weekly"]').click();await shot('game-weekly');await page.locator('[data-gqv6-board="hub"]').click();await shot('cloud-login');
 await view(page,'time');for(const tab of ['tasks','logs']){await page.locator(`[data-time-tab="${tab}"]`).click();await shot('time-'+tab)}
 await page.locator('#controlCenterBtn').click();await shot('control-center');
 for(const [button,modal] of [['controlTaskEditorBtn','taskEditorModal'],['controlRefEditorBtn','refEditorModal'],['controlGameQuestEditorBtn','gameQuestEditorModal'],['controlFitnessEditorBtn','fitnessEditorModal']]){
  if(!await page.locator('#controlCenterMenu').isVisible())await page.locator('#controlCenterBtn').click();
  await page.locator('#'+button).click();const details=page.locator(`#${modal} details`).first();if(await details.count()&&await details.getAttribute('open')===null)await details.locator('summary').first().click();await shot(modal);await page.locator(`#${modal} .ghCloseBtn`).click();
 }
});

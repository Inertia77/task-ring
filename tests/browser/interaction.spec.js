const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');
test.beforeEach(async({page})=>{await page.setViewportSize({width:390,height:844});await boot(page)});
async function editor(page,id='controlTaskEditorBtn'){await page.locator('#controlCenterBtn').click();await page.locator('#'+id).click()}
test('editor keeps full draft across scopes, search, additions, copies and reload',async({page})=>{
 await editor(page);
 const row=page.locator('.cfgTask[data-id="test-task-0"]');await row.locator('summary').first().click();
 await row.locator('.cfgTitle').fill('草稿测试修改');await row.locator('.cfgAiSettings summary').click();await row.locator('.cfgNote').fill('Prompt 完整保留');
 await page.locator('[data-editor-scope="weekly"]').click();await expect(row).toBeHidden();
 await page.locator('[data-editor-scope="all"]').click();await expect(row.locator('.cfgTitle')).toHaveValue('草稿测试修改');
 await page.locator('#taskEditorSearchInput').fill('无匹配');await page.locator('#taskEditorSearchInput').fill('');
 await page.locator('#addTaskBtn').click();await page.locator('[data-editor-scope="disabled"]').click();await page.locator('[data-editor-scope="all"]').click();
 await expect(page.locator('.cfgTask')).toHaveCount(13);
 await row.locator('[data-op="copy"]').click();await expect(page.locator('.cfgTask')).toHaveCount(14);
 page.once('dialog',dialog=>dialog.accept());await page.locator('.cfgTask[data-id="test-task-10"] [data-op="remove"]').click();await expect(page.locator('.cfgTask')).toHaveCount(13);
 await page.locator('[data-editor-scope="weekly"]').click();await page.locator('[data-editor-scope="all"]').click();
 await page.locator('#saveConfigBtn').click();await expect(page.locator('#taskEditorLog')).toContainText('已保存到本机');
 await page.reload();await page.waitForFunction(()=>!!window.TaskRingProductUi);await editor(page);
 await page.locator('[data-editor-scope="all"]').click();await expect(page.locator('.cfgTask')).toHaveCount(13);
 await expect(page.locator('.cfgTask[data-id="test-task-0"] .cfgTitle')).toHaveValue('草稿测试修改');
 const config=await page.evaluate(()=>loadLocalTaskConfig());
 expect(config.tasks.find(t=>t.id==='test-task-0').steps[0].id).toBe('stable-step-id');expect(config.tasks.find(t=>t.id==='test-task-0').note).toBe('Prompt 完整保留');expect(config.tasks.find(t=>t.id==='test-task-11').enabled).toBe(false);
});
test('all four editors retain drafts on Escape and reopen without a confirmation',async({page})=>{
 for(const [button,modal,selector] of [['controlTaskEditorBtn','taskEditorModal','.cfgTitle'],['controlRefEditorBtn','refEditorModal','.refGroupTitle'],['controlGameQuestEditorBtn','gameQuestEditorModal','input:not([type="checkbox"]):not([type="hidden"])'],['controlFitnessEditorBtn','fitnessEditorModal','input:not([type="checkbox"]):not([type="hidden"])']]){
  await editor(page,button);
  const field=page.locator(`#${modal} ${selector}`).filter({visible:true}).first();
  if(!await field.count()){await page.locator(`#${modal} details summary`).first().click()}
  const editable=page.locator(`#${modal} ${selector}`).filter({visible:true}).first();await editable.fill('保留草稿');
  await editable.press('Escape');await expect(page.locator('#'+modal)).toBeHidden();await expect(page.locator('#controlCenterBtn')).toBeFocused();
  await editor(page,button);await expect(page.locator(`#${modal} ${selector}`).filter({visible:true}).first()).toHaveValue('保留草稿');
  await page.locator(`#${modal} .ghCloseBtn`).click();
 }
});
test('library search temporarily opens matches and restores disclosure preference',async({page})=>{
 await view(page,'library');const group=page.locator('[data-library-group="test-ref-b"]');
 if(await group.getAttribute('open')!==null)await group.locator('summary').click();
 await page.waitForTimeout(60);
 const before=await page.evaluate(()=>localStorage.getItem('taskring_ui_disclosure_v1'));
 await page.locator('#librarySearchInput').fill('测试工具');await expect(group).toHaveAttribute('open','');
 await page.waitForTimeout(60);await page.locator('#librarySearchInput').fill('');await expect(group).not.toHaveAttribute('open','');
 await page.waitForTimeout(60);expect(await page.evaluate(()=>localStorage.getItem('taskring_ui_disclosure_v1'))).toBe(before);
});
test('control center and weekly target close with Escape and contain keyboard focus',async({page})=>{
 await page.locator('#controlCenterBtn').click();const modal=page.locator('#controlCenterMenu');await expect(modal).toBeVisible();
 await page.keyboard.press('Shift+Tab');expect(await page.evaluate(()=>document.querySelector('#controlCenterMenu').contains(document.activeElement))).toBe(true);
 await page.keyboard.press('Escape');await expect(modal).toBeHidden();await expect(page.locator('#controlCenterBtn')).toBeFocused();
 await page.evaluate(()=>openWeeklyTargetEditor('test-task-0'));await expect(page.locator('#weeklyTargetModal')).toBeVisible();await page.keyboard.press('Escape');await expect(page.locator('#weeklyTargetModal')).toHaveCount(0);
});
test('daily, weekly subtask, game and life completion can be undone',async({page})=>{
 await page.locator('#showToday').click();const box=page.locator('input[data-task="test-task-2"]').first();await box.locator('..').click();await expect(box).toBeChecked();await box.locator('..').click();await expect(box).not.toBeChecked();
 await view(page,'fitness');const life=page.locator('[data-fitness-item]').first();await life.click();await expect(life).toHaveAttribute('aria-pressed','true');await life.click();await expect(life).toHaveAttribute('aria-pressed','false');
 await view(page,'game');const game=page.locator('[data-gqv5-task]').filter({visible:true}).first();await game.click();await expect(game).toHaveAttribute('aria-pressed','true');await game.click();await expect(game).toHaveAttribute('aria-pressed','false');
 await view(page,'weekly');const group=page.locator('details[data-weekly-category="life"]');if(await group.getAttribute('open')===null)await group.locator('summary').first().click();const sub=group.locator('.weeklySubtasks');await sub.locator('summary').click();const step=sub.locator('input[data-weekly-step]');await step.check();await expect(step).toBeChecked();await step.uncheck();await expect(step).not.toBeChecked();
});
test('timer live updates preserve input focus and full render preserves search',async({page})=>{
 await view(page,'time');await page.locator('[data-time-tab="tasks"]').click();await page.locator('#timeTaskSearchInput').fill('测试');
 await page.evaluate(()=>renderAll());await expect(page.locator('#timeTaskSearchInput')).toBeFocused();await expect(page.locator('#timeTaskSearchInput')).toHaveValue('测试');
 await page.waitForTimeout(1100);await expect(page.locator('#timeTaskSearchInput')).toBeFocused();
});
test('opening and collecting an unchanged editor preserves every task and subtask field',async({page})=>{
 await page.evaluate(()=>{const cfg=structuredClone(taskConfig);cfg.tasks[0].steps.push({id:'disabled-subtask',code:'s09',title:'保留停用子任务',enabled:false});applyTaskConfig(cfg,true)});
 const before=await page.evaluate(()=>taskConfig.tasks);await editor(page);
 const after=await page.evaluate(()=>collectEditorConfig().tasks);expect(after).toEqual(before);
});

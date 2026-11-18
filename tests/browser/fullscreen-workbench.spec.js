const {test,expect}=require('@playwright/test');
const {boot}=require('./helpers');

async function openStudio(page,domain='tasks'){
  await page.locator('#controlCenterBtn').click();
  await page.locator('#controlWorkbenchBtn').click();
  await expect(page.locator('#taskWorkbench')).toBeVisible();
  if(domain!=='tasks')await page.locator('#taskWorkbench [data-wb-domain="'+domain+'"]').click();
}

test('desktop studio edits a legacy task, preserves drafts across areas, and saves one guarded config',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await boot(page,'overview');
  const old=await page.evaluate(()=>loadLocalTaskConfig().tasks.find(t=>t.id==='test-task-0').title);
  await openStudio(page);
  for(const domain of ['tasks','weekly','game','learning','fitness','refs'])
    await expect(page.locator('#taskWorkbench [data-wb-domain="'+domain+'"]')).toBeVisible();
  await page.locator('#taskWorkbench .wb-list-entry').filter({hasText:old}).click();
  const title=page.locator('#taskWorkbench [name="title"]');
  await title.fill('全屏任务编辑回归验证');
  await page.locator('#taskWorkbench [data-wb-domain="learning"]').click();
  await expect(page.locator('#taskWorkbench')).toContainText('轨道设置');
  await page.locator('#taskWorkbench [data-wb-domain="game"]').click();
  await expect(page.locator('#taskWorkbench')).toContainText('游戏设置');
  await page.locator('#taskWorkbench [data-wb-domain="tasks"]').click();
  await page.locator('#taskWorkbench .wb-list-entry').filter({hasText:'全屏任务编辑回归验证'}).click();
  await expect(page.locator('#taskWorkbench [name="title"]')).toHaveValue('全屏任务编辑回归验证');
  expect(await page.evaluate(()=>loadLocalTaskConfig().tasks.find(t=>t.id==='test-task-0').title)).toBe(old);
  await page.locator('#taskWorkbench .wb-top [data-wb-save]').click();
  await expect(page.locator('#taskWorkbench .wb-feedback')).toContainText('已保存到本机');
  const config=await page.evaluate(()=>loadLocalTaskConfig());
  expect(config.tasks.find(t=>t.id==='test-task-0').title).toBe('全屏任务编辑回归验证');
  expect(config.tasks.find(t=>t.id==='test-task-0').code).toBe('t100');
  expect(config.tasks.find(t=>t.id==='test-task-0').steps[0].id).toBe('stable-step-id');
  await page.locator('#taskWorkbench [data-wb-close]').click();
  await expect(page.locator('#taskWorkbench')).toBeHidden();
  await page.reload();
  expect(await page.evaluate(()=>loadLocalTaskConfig().tasks.find(t=>t.id==='test-task-0').title))
    .toBe('全屏任务编辑回归验证');
});

test('studio supports game and learning record changes in one saved configuration',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,'overview');
  await openStudio(page,'game');
  await page.locator('#taskWorkbench .wb-list-entry').filter({hasText:'每日资源领取'}).first().click();
  await expect(page.locator('#taskWorkbench [name="daily_lane"]')).toBeVisible();
  await page.locator('#taskWorkbench [name="title"]').fill('新游戏每日配置测试');
  await page.locator('#taskWorkbench [data-wb-domain="learning"]').click();
  await page.locator('#taskWorkbench [data-wb-new]').click();
  await expect(page.locator('#taskWorkbench [name="title"]')).toBeVisible();
  await page.locator('#taskWorkbench [name="title"]').fill('语言学习队列示例');
  await page.locator('#taskWorkbench .wb-top [data-wb-save]').click();
  await expect(page.locator('#taskWorkbench .wb-feedback')).toContainText('已保存到本机');
  const state=await page.evaluate(()=>loadLocalTaskConfig());
  expect(state.gameQuest.boards.daily.zzz.some(t=>t.title==='新游戏每日配置测试')).toBe(true);
  expect(state.sequences.LANGUAGE.items.some(t=>t.title==='语言学习队列示例')).toBe(true);
});

test('mobile studio uses full-page list/detail navigation and retains existing JSON manager',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await boot(page,'overview');
  await openStudio(page,'fitness');
  await expect(page.locator('#taskWorkbench')).toHaveAttribute('data-screen','list');
  await page.locator('#taskWorkbench .wb-list-entry').first().click();
  await expect(page.locator('#taskWorkbench')).toHaveAttribute('data-screen','detail');
  await expect(page.locator('#taskWorkbench [data-wb-back]')).toBeVisible();
  await page.locator('#taskWorkbench [data-wb-back]').click();
  await expect(page.locator('#taskWorkbench')).toHaveAttribute('data-screen','list');
  await page.locator('#taskWorkbench [data-wb-json-export]').click();
  await expect(page.locator('#taskWorkbench')).toBeVisible();
  await expect(page.locator('#commandDialog')).toBeVisible();
  await expect(page.locator('#commandDialog')).toContainText('统一 JSON');
  await expect(page.getByRole('button',{name:'导出完整备份'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

test('unsaved draft warns on closing and never changes the persisted config',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,'overview');
  await openStudio(page);
  await page.locator('#taskWorkbench .wb-list-entry').first().click();
  await page.locator('#taskWorkbench [name="title"]').fill('不应意外保存');
  page.once('dialog',dialog=>dialog.dismiss());
  await page.locator('#taskWorkbench [data-wb-close]').click();
  await expect(page.locator('#taskWorkbench')).toBeVisible();
  page.once('dialog',dialog=>dialog.accept());
  await page.locator('#taskWorkbench [data-wb-close]').click();
  await expect(page.locator('#taskWorkbench')).toBeHidden();
  expect(await page.evaluate(()=>loadLocalTaskConfig().tasks.some(t=>t.title==='不应意外保存'))).toBe(false);
});

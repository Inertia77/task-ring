const {test,expect}=require('@playwright/test');
const {boot}=require('./helpers');

async function studio(page,domain='game'){
  await page.locator('#controlCenterBtn').click();
  await page.locator('#controlWorkbenchBtn').click();
  await expect(page.locator('#taskWorkbench')).toBeVisible();
  await page.locator('#taskWorkbench [data-wb-domain="'+domain+'"]').click();
}
const group=(page,id)=>page.locator('#taskWorkbench [data-wb-game="'+id+'"]');
const refGroup=(page,id)=>page.locator('#taskWorkbench [data-wb-ref-group="'+id+'"]');

test('game hierarchy exposes named games, daily and weekly lanes, and priority bands',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await boot(page,'overview');
  await studio(page);
  await expect(page.locator('#taskWorkbench [data-wb-game]')).toHaveCount(6);
  const zzz=group(page,'zzz');
  await expect(zzz.locator('[data-wb-tree-toggle="game:zzz"]')).toHaveAttribute('aria-expanded','true');
  await expect(zzz.locator('[data-wb-tree-toggle="game:zzz:daily"]')).toHaveAttribute('aria-expanded','true');
  await expect(zzz.locator('[data-wb-priority="daily:must"]')).toBeVisible();
  await zzz.locator('[data-wb-tree-toggle="game:zzz:weekly"]').click();
  await expect(zzz.locator('[data-wb-priority="weekly:wait"]')).toBeVisible();
  await zzz.locator('[data-wb-priority="weekly:wait"] .wb-list-entry').click();
  await expect(page.locator('#taskWorkbench .wb-context-card')).toContainText('绝区零 / 周常');
  await expect(page.locator('#taskWorkbench [name="weekly_lane"]')).toHaveValue('wait');
  await zzz.locator('[data-wb-tree-toggle="game:zzz"]').click();
  await expect(zzz.locator('[data-wb-priority="daily:must"]')).toBeHidden();
  await zzz.locator('[data-wb-tree-toggle="game:zzz"]').click();
  await expect(zzz.locator('[data-wb-priority="weekly:wait"]')).toBeVisible();
});

test('inline game lane creation respects exact game and board and preserves existing IDs',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await boot(page,'overview');
  const before=await page.evaluate(()=>loadLocalTaskConfig().gameQuest.boards.weekly.endfield.map(x=>x.id));
  await studio(page);
  const target=group(page,'endfield');
  await target.locator('[data-wb-tree-toggle="game:endfield"]').click();
  await target.locator('[data-wb-tree-toggle="game:endfield:weekly"]').click();
  await target.locator('[data-wb-add-game="endfield"][data-wb-board="weekly"]').click();
  await expect(page.locator('#taskWorkbench .wb-context-card')).toContainText('终末地 / 周常');
  await page.locator('#taskWorkbench [name="title"]').fill('终末地精准新增周常');
  await page.locator('#taskWorkbench [name="weekly_lane"]').selectOption('wait');
  await page.locator('#taskWorkbench .wb-top [data-wb-save]').click();
  await expect(page.locator('#taskWorkbench .wb-feedback')).toContainText('已保存');
  const config=await page.evaluate(()=>loadLocalTaskConfig());
  expect(config.gameQuest.boards.weekly.endfield.map(x=>x.id).slice(0,before.length)).toEqual(before);
  expect(config.gameQuest.boards.weekly.endfield.some(x=>x.title==='终末地精准新增周常'&&x.weekly_lane==='wait')).toBe(true);
  expect(config.gameQuest.boards.weekly.zzz.some(x=>x.title==='终末地精准新增周常')).toBe(false);
  expect(config.gameQuest.boards.daily.endfield.some(x=>x.title==='终末地精准新增周常')).toBe(false);
});

test('library groups are navigable trees with scoped inline add and link preview',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await boot(page,'overview');
  await studio(page,'refs');
  await expect(page.locator('#taskWorkbench [data-wb-ref-group]')).toHaveCount(2);
  const b=refGroup(page,'test-ref-b');
  await b.locator('[data-wb-tree-toggle="refs:test-ref-b"]').click();
  await expect(b.locator('.wb-list-entry')).toHaveCount(2);
  await b.locator('.wb-list-entry').filter({hasText:'测试工具'}).click();
  await expect(page.locator('#taskWorkbench .wb-context-card')).toContainText('所属分组：工具收藏');
  await expect(page.locator('#taskWorkbench .wb-context-link')).toHaveAttribute('href','https://example.com/tool');
  await b.locator('[data-wb-add-ref="test-ref-b"]').click();
  await page.locator('#taskWorkbench [name="title"]').fill('分组内新增资料');
  await page.locator('#taskWorkbench [name="url"]').fill('https://example.com/new');
  await page.locator('#taskWorkbench .wb-top [data-wb-save]').click();
  await expect(page.locator('#taskWorkbench .wb-feedback')).toContainText('已保存');
  const config=await page.evaluate(()=>loadLocalTaskConfig());
  expect(config.refs.find(g=>g.id==='test-ref-b').items.some(x=>x.title==='分组内新增资料')).toBe(true);
  expect(config.refs.find(g=>g.id==='test-ref-a').items.some(x=>x.title==='分组内新增资料')).toBe(false);
});

test('tree search automatically reveals matching tasks without erasing manual collapse preferences',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,'overview');
  await studio(page);
  const zzz=group(page,'zzz');
  await zzz.locator('[data-wb-tree-toggle="game:zzz"]').click();
  await expect(zzz.locator('[data-wb-tree-toggle="game:zzz"]')).toHaveAttribute('aria-expanded','false');
  await page.locator('#taskWorkbench [data-wb-search]').fill('每日资源领取');
  await expect(zzz.locator('[data-wb-tree-toggle="game:zzz"]')).toHaveAttribute('aria-expanded','true');
  await expect(zzz.locator('.wb-tree-item').filter({hasText:'每日资源领取'})).toBeVisible();
  await page.locator('#taskWorkbench [data-wb-search]').fill('');
  await expect(zzz.locator('[data-wb-tree-toggle="game:zzz"]')).toHaveAttribute('aria-expanded','false');
});

test('mobile library hierarchy stays compact and retains selected item after back navigation',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await boot(page,'overview');
  await studio(page,'refs');
  const b=refGroup(page,'test-ref-b');
  await b.locator('[data-wb-tree-toggle="refs:test-ref-b"]').click();
  await b.locator('.wb-list-entry').filter({hasText:'测试工具'}).click();
  await expect(page.locator('#taskWorkbench')).toHaveAttribute('data-screen','detail');
  await expect(page.locator('#taskWorkbench .wb-context-card')).toContainText('工具收藏');
  await page.locator('#taskWorkbench [data-wb-back]').click();
  await expect(page.locator('#taskWorkbench')).toHaveAttribute('data-screen','list');
  await expect(b.locator('[data-wb-tree-toggle="refs:test-ref-b"]')).toHaveAttribute('aria-expanded','true');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(321);
});

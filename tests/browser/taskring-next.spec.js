const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');


for(const width of [390,1440]){
  test('active workspace survives reload on '+width+'px including deep links',async({page})=>{
    await page.setViewportSize({width,height:844});
    await boot(page,'overview');
    await view(page,'game');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-app-view','game');
    await expect(page).toHaveURL(/(?:\?|&)view=game(?:&|$)/);
    await view(page,'learning');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-app-view','learning');
    await expect(page).toHaveURL(/(?:\?|&)view=learning(?:&|$)/);
    // Without a view query parameter, a saved workspace should still win.
    await page.goto('/?preview');
    await expect(page.locator('body')).toHaveAttribute('data-app-view','learning');
    // Opening an intentional deep link overrides the previous saved workspace.
    await page.goto('/?preview&view=weekly');
    await expect(page.locator('body')).toHaveAttribute('data-app-view','weekly');
    await view(page,'fitness');
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-app-view','fitness');
  });
}

test('mobile More subpages survive reload and retain More highlighting',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,'overview');
  for(const target of ['tasks','weekly','time','library','more']){
    await view(page,target);
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-app-view',target);
    await expect(page.locator('#viewDock [data-view-target="more"]')).toHaveAttribute('aria-current','page');
  }
});

test('first visit defaults to overview while date-preview navigation is preserved',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page,'overview');
  await page.evaluate(()=>localStorage.removeItem('taskring_github_v2_active_view_v1'));
  await page.goto('/?preview');
  await expect(page.locator('body')).toHaveAttribute('data-app-view','overview');
  await page.goto('/?preview&date=2026-11-18');
  await expect(page.locator('body')).toHaveAttribute('data-app-view','tasks');
  await view(page,'fitness');
  await expect(page).toHaveURL(/view=fitness/);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-app-view','fitness');
});

for(const width of [320,390,768]){
  test('mobile dock prioritizes daily workspaces and routes legacy pages via More at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:844});
    await boot(page,'overview');
    const dock=page.locator('#viewDock > .viewDockBtn:visible');
    await expect(dock).toHaveCount(5);
    expect(await dock.evaluateAll(buttons=>buttons.map(button=>button.dataset.viewTarget)))
      .toEqual(['overview','fitness','game','learning','more']);
    await view(page,'fitness');
    await expect(page.locator('#viewDock [data-view-target="fitness"]')).toHaveAttribute('aria-current','page');
    await expect(page.locator('#viewDock [data-view-target="more"]')).toHaveAttribute('aria-current','false');
    await view(page,'learning');
    await expect(page.locator('#viewDock [data-view-target="learning"]')).toHaveAttribute('aria-current','page');
    await view(page,'more');
    for(const name of ['tasks','weekly'])
      await expect(page.locator('#commandMore [data-view-target="'+name+'"]')).toBeVisible();
    await page.locator('#commandMore [data-view-target="tasks"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view','tasks');
    await expect(page.locator('#viewDock [data-view-target="more"]')).toHaveAttribute('aria-current','page');
    await page.locator('#viewDock [data-view-target="more"]').click();
    await page.locator('#commandMore [data-view-target="weekly"]').click();
    await expect(page.locator('body')).toHaveAttribute('data-app-view','weekly');
    await expect(page.locator('#viewDock [data-view-target="more"]')).toHaveAttribute('aria-current','page');
  });
}

test('desktop retains direct daily and weekly navigation',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await boot(page,'overview');
  await expect(page.locator('#viewDock [data-view-target="tasks"]')).toBeVisible();
  await expect(page.locator('#viewDock [data-view-target="weekly"]')).toBeVisible();
  await expect(page.locator('#viewDock [data-view-target="more"]')).toBeHidden();
  await view(page,'tasks');
  await expect(page.locator('#viewDock [data-view-target="tasks"]')).toHaveAttribute('aria-current','page');
  await view(page,'weekly');
  await expect(page.locator('#viewDock [data-view-target="weekly"]')).toHaveAttribute('aria-current','page');
});


for(const width of [320,360,390,768,1440]){
  test('overview, filters and navigation fit at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});
    await boot(page,'overview');
    await expect(page.getByRole('heading',{name:'任务总览'})).toBeVisible();
    await expect(page.locator('#commandCenter progress')).toHaveCount(2);
    await page.getByRole('button',{name:'有余力',exact:true}).click();
    await expect(page.locator('#commandCenter')).toContainText('有空处理的可选任务');
    await expect(page.locator('#commandCenter')).not.toContainText('每日资源领取');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({path:'test-results/visual/'+test.info().project.name+'/next/'+width+'-command.png'});
    await view(page,'learning');
    await expect(page.getByRole('heading',{name:'学习中心'})).toBeVisible();
    await expect(page.getByRole('button',{name:'添加学习项'})).toHaveCount(2);
  });
}

test('overview completion shares daily state and supports undo after refresh',async({page})=>{
  await boot(page,'overview');
  await page.goto('/?preview');
  await expect(page.getByRole('heading',{name:'任务总览'})).toBeVisible();
  const title='阅读与笔记：长标题用于验证手机和电脑换行与操作入口';
  await page.getByRole('button',{name:'完成：'+title,exact:true}).click();
  await expect(page.getByRole('button',{name:'撤销完成：'+title,exact:true})).toBeVisible();
  await view(page,'tasks');
  await expect.poll(()=>page.evaluate(()=>isDone('test-task-0',today))).toBe(true);
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-app-view','tasks');
  await view(page,'overview');
  const done=page.locator('#commandCenter .commandDone');
  await expect(done).toBeVisible();
  if(await done.getAttribute('open')===null)await done.locator(':scope > summary').click();
  await page.getByRole('button',{name:'撤销完成：'+title,exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>isDone('test-task-0',today))).toBe(false);
});

test('weekly date and completion share their cycle without changing the time ledger',async({page})=>{
  await boot(page);
  await view(page,'weekly');
  const item=page.locator('.weeklyMissionCard').filter({hasText:'隔离测试任务 6'});
  const parent=item.locator('xpath=ancestor::details[contains(@class,"weeklyMissionGroup")]');
  if(await parent.getAttribute('open')===null)await parent.locator('summary').first().click();
  await item.getByRole('button',{name:'安排到今天',exact:true}).click();
  await view(page,'overview');
  await page.getByRole('button',{name:'完成：隔离测试任务 6',exact:true}).click();
  await view(page,'weekly');
  await expect(item.getByRole('button',{name:'撤销本周执行',includeHidden:true})).toHaveCount(1);
  await expect.poll(()=>page.evaluate(()=>readTimeLogs().length)).toBe(0);
});

test('learning editor, daily completion and next-day progression stay independent',async({page})=>{
  await page.clock.install({time:new Date('2026-11-17T03:00:00Z')});
  await boot(page,'overview');
  await view(page,'learning');
  const track=name=>page.locator('.studyTrack').filter({has:page.getByRole('heading',{name,exact:true})});
  const language=track('语言'),knowledge=track('知识');
  for(const [host,title] of [[language,'语言 A'],[language,'语言 B'],[knowledge,'知识 1']]){
    const queue=host.locator('details').filter({hasText:'课程队列'});
    if(await queue.getAttribute('open')===null)await queue.locator('summary').click();
    await host.getByRole('button',{name:'添加学习项'}).click();
    await page.getByLabel('课程名称').fill(title);
    await page.getByRole('button',{name:'保存学习项'}).click();
    await expect(page.locator('#commandDialog')).not.toBeVisible();
  }
  await view(page,'overview');
  await page.getByRole('button',{name:'完成：语言 A',exact:true}).click();
  await view(page,'learning');
  await expect(language.getByRole('button',{name:'撤销完成：语言 A',exact:true})).toBeVisible();
  await page.clock.setSystemTime(new Date('2026-11-18T03:00:00Z'));
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-app-view','learning');
  await view(page,'overview');
  await expect(page.getByRole('button',{name:'完成：语言 B',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'完成：知识 1',exact:true})).toBeVisible();
});

test('unified editor saves a scheduled task and exports one configuration',async({page})=>{
  await boot(page,'overview');
  await page.getByRole('button',{name:'任务管理',exact:true}).click();
  await expect(page.locator('#taskWorkbench')).toBeVisible();
  await page.locator('#taskWorkbench [data-wb-new]').click();
  await page.locator('#taskWorkbench [name="title"]').fill('计划测试');
  await page.locator('#taskWorkbench [name="steps"]').fill('收集资料\n整理摘要');
  await page.locator('#taskWorkbench .wb-top [data-wb-save]').click();
  await expect(page.locator('#taskWorkbench .wb-feedback')).toContainText('已保存');
  await page.locator('#taskWorkbench [data-wb-close]').click();
  await expect(page.getByRole('button',{name:'完成：计划测试',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'任务管理',exact:true}).click();
  await page.locator('#taskWorkbench [data-wb-json-export]').click();
  const download=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出配置',exact:true}).click();
  expect((await download).suggestedFilename()).toMatch(/^taskring-config-.*\.json$/);
});

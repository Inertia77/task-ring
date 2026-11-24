const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');
test('A级 optional tasks stay interactive when S级 are incomplete',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  await view(page,'game');
  await page.evaluate(()=>{
    const P=window.TaskRingGamePlayPolicy,uid='play-policy-fixture';
    P.setOwner(uid);
    P.setRows([
      {game_key:'zzz',game_name:'绝区零',play_tier:1,story_focus:true,sort_order:1},
      {game_key:'nte',game_name:'异环',play_tier:1,story_focus:true,sort_order:2},
      {game_key:'wuwa',game_name:'鸣潮',play_tier:1,story_focus:true,sort_order:3},
      {game_key:'hsr',game_name:'崩铁',play_tier:1,story_focus:true,sort_order:4},
      {game_key:'onmyoji',game_name:'阴阳师',play_tier:1,story_focus:false,sort_order:5},
      {game_key:'endfield',game_name:'终末地',play_tier:2,story_focus:true,sort_order:6}
    ],uid);
  });
  await expect(page.locator('.gqV6GateNotice.advisory')).toBeVisible();
  await expect(page.locator('#gqv6-lane-panel-daily-must')).toBeVisible();
  await expect(page.locator('[data-gqv6-expand-all][data-lane="must"]')).toBeVisible();
  await expect(page.locator('[data-gqv5-task][data-game="zzz"]').first()).toBeEnabled();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]')).toHaveCount(0);
  await expect(page.locator('[data-gqv6-scope="reserve"]')).toBeVisible();
  await page.locator('[data-gqv6-scope="reserve"]').click();
  await expect(page.locator('[data-gqv6-scope="reserve"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-gqv5-task][data-game="zzz"]')).toHaveCount(0);
  await expect(page.locator('[data-gqv6-complete-daily]')).toHaveCount(0);
  const optional=page.locator('[data-gqv5-task][data-game="endfield"]').first();
  await expect(optional).toBeEnabled();
  await page.locator('[data-gqv6-expand-all][data-board="daily"][data-lane="must"]').click();
  await optional.click();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]').first()).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-gqv5-task][data-game="endfield"]').first().click();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]').first()).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('[data-gqv5-task][data-game="zzz"]')).toHaveCount(0);
  await expect(page.locator('.gqV6StoryFocus').first()).toBeVisible();
  await page.locator('[data-gqv6-board="weekly"]').click();
  await expect(page.locator('[data-gqv6-lane="sprint"]')).toBeVisible();
  await expect(page.locator('#gqv6-lane-panel-weekly-sprint')).toBeVisible();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]').first()).toBeEnabled();
  await page.locator('[data-gqv6-expand-all][data-board="weekly"][data-lane="sprint"]').click();
  const t3Weekly=page.locator('[data-gqv5-task][data-board="weekly"][data-game="endfield"]').first();
  await t3Weekly.click();
  await expect(t3Weekly).toHaveAttribute('aria-pressed','true');
  await t3Weekly.click();
  await expect(t3Weekly).toHaveAttribute('aria-pressed','false');
  // Returning to the core scope keeps its own daily board and does not mark A级.
  await page.locator('[data-gqv6-scope="core"]').click();
  await expect(page.locator('[data-gqv6-board="daily"]')).toHaveClass(/active/);
  await expect(page.locator('[data-gqv5-task][data-game="zzz"]').first()).toHaveAttribute('aria-pressed','false');
  await page.locator('[data-gqv6-complete-daily]').click();
  await expect(page.locator('[data-gqv6-scope="reserve"]')).toHaveClass(/ready/);
  await expect(page.locator('[data-gq-scope-hint]')).toContainText('今日主线必做已完成');
  await expect(page.locator('[data-gqv6-scope="core"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('[data-gqv6-scope="reserve"]').click();
  await expect(page.locator('[data-gqv6-board="weekly"]')).toHaveClass(/active/);
  await page.locator('[data-gqv6-board="daily"]').click();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]').first()).toHaveAttribute('aria-pressed','false');
  const dims=await page.evaluate(()=>({width:document.documentElement.scrollWidth,view:innerWidth,button:document.querySelector('[data-gqv6-scope="reserve"]').getBoundingClientRect().height}));
  expect(dims.width).toBeLessThanOrEqual(dims.view+1);
  expect(dims.button).toBeGreaterThanOrEqual(44);
  await view(page,'tasks');await view(page,'game');
  await expect(page.locator('[data-gqv6-scope="core"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-gqv6-board="daily"]')).toHaveClass(/active/);
});

test('desktop keeps both scope entries visible but renders only the selected scope',async({page})=>{
  await page.setViewportSize({width:1440,height:900});
  await boot(page);await view(page,'game');
  await page.evaluate(()=>{
    const P=window.TaskRingGamePlayPolicy,uid='desktop-reserve-fixture';
    P.setOwner(uid);
    P.setRows([{game_key:'zzz',play_tier:1,sort_order:1},{game_key:'endfield',play_tier:2,sort_order:6}],uid);
  });
  const reserve=page.locator('[data-gqv6-scope="reserve"]');
  await expect(reserve).toBeVisible();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]')).toHaveCount(0);
  await reserve.click();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]').first()).toBeVisible();
  await expect(page.locator('[data-gqv5-task][data-game="zzz"]')).toHaveCount(0);
  const dims=await page.evaluate(()=>({
    doc:document.documentElement.scrollWidth,view:innerWidth,
    scope:document.querySelector('.gqScopeNav').getBoundingClientRect().width,
    button:document.querySelector('[data-gqv6-scope="reserve"]').getBoundingClientRect().height
  }));
  expect(dims.doc).toBeLessThanOrEqual(dims.view+1);
  expect(dims.scope).toBeGreaterThan(300);
  expect(dims.button).toBeGreaterThanOrEqual(44);
  await page.screenshot({path:'test-results/visual/'+test.info().project.name+'/after/1440-game-reserve.png',fullPage:true});
});

test('B scope exposes only live operations',async({page})=>{await boot(page);await view(page,'game');await page.evaluate(()=>{const P=window.TaskRingGamePlayPolicy;P.setOwner('b-fixture');P.setRows([{game_key:'zzz',game_name:'绝区零',play_tier:1,sort_order:1},{game_key:'endfield',game_name:'终末地',play_tier:3,sort_order:2}], 'b-fixture')});await page.locator('[data-gqv6-scope="interest"]').click();await expect(page.locator('[data-gqv6-board="daily"]')).toHaveCount(0);await expect(page.locator('[data-gqv6-board="weekly"]')).toHaveCount(0);await expect(page.locator('[data-gqv6-board="hub"]')).toHaveClass(/active/);await expect(page.locator('[data-gqv5-task][data-game="endfield"]')).toHaveCount(0);});

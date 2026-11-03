const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');
test('T3 optional tasks stay interactive when T1/T2 are incomplete',async({page})=>{
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
      {game_key:'hsr',game_name:'崩铁',play_tier:2,story_focus:true,sort_order:4},
      {game_key:'onmyoji',game_name:'阴阳师',play_tier:2,story_focus:false,sort_order:5},
      {game_key:'endfield',game_name:'终末地',play_tier:3,story_focus:true,sort_order:6}
    ],uid);
  });
  await expect(page.locator('.gqV6GateNotice.advisory')).toBeVisible();
  await expect(page.locator('#gqv6-lane-panel-daily-must')).toBeVisible();
  await expect(page.locator('[data-gqv6-expand-all][data-lane="must"]')).toBeVisible();
  await expect(page.locator('[data-gqv5-task][data-game="zzz"]').first()).toBeEnabled();
  const optional=page.locator('[data-gqv5-task][data-game="endfield"]').first();
  await expect(optional).toBeEnabled();
  await page.locator('[data-gqv6-expand-all][data-board="daily"][data-lane="must"]').click();
  await optional.click();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]').first()).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-gqv5-task][data-game="zzz"]').first()).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.gqV6StoryFocus').first()).toBeVisible();
  await page.locator('[data-gqv6-board="weekly"]').click();
  await expect(page.locator('[data-gqv6-lane="sprint"]')).toBeVisible();
  await expect(page.locator('#gqv6-lane-panel-weekly-sprint')).toBeVisible();
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]').first()).toBeEnabled();
});
const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

test('weekly desktop cards remain equal-height with optional progress and undo actions',async({page})=>{
  await page.setViewportSize({width:1600,height:900});
  await boot(page);
  await page.evaluate(()=>{
    const config=structuredClone(taskConfig);
    const base=config.tasks.find(t=>t.plan_mode==='weekly')||config.tasks[0];
    config.tasks=[0,1,2].map(i=>({
      ...base,
      id:'height-fixture-'+i,
      code:'h'+(700+i),
      title:['无目标的新任务','有目标的本周维护任务','包含更多操作和较长说明的维护任务'][i],
      plan_mode:'weekly',
      time_category:'game',
      enabled:true,
      ai_enabled:true,
      ai_period:'weekly',
      ai_target:i===0?0:2,
      ai_chat_url:'https://example.com/conversation',
      ai_archive_url:'https://example.com/archive',
      steps:[]
    }));
    applyTaskConfig(config,true);
  });
  await view(page,'weekly');
  const group=page.locator('.weeklyMissionGroup[data-weekly-category="game"]');
  if(await group.getAttribute('open')===null)await group.locator('summary').first().click();
  const cards=group.locator('.weeklyMissionGrid > .weeklyMissionCard');
  await expect(cards).toHaveCount(3);
  await expect(cards.first()).toBeVisible();

  const heights=await cards.evaluateAll(items=>items.map(card=>card.getBoundingClientRect().height));
  expect(Math.max(...heights)-Math.min(...heights)).toBeLessThanOrEqual(1);

  const rows=await cards.evaluateAll(items=>items.map(card=>({
    actions:card.querySelector('.missionActions').getBoundingClientRect().top,
    badges:card.querySelector('.missionBadges').getBoundingClientRect().bottom,
    bottom:card.getBoundingClientRect().bottom,
    hasMeter:!!card.querySelector('.missionMeter')
  })));
  expect(rows.some(row=>!row.hasMeter)).toBe(true);
  expect(rows.some(row=>row.hasMeter)).toBe(true);
  expect(Math.max(...rows.map(row=>row.actions))-Math.min(...rows.map(row=>row.actions))).toBeLessThanOrEqual(2);
  expect(Math.max(...rows.map(row=>row.bottom))-Math.min(...rows.map(row=>row.bottom))).toBeLessThanOrEqual(1);
});

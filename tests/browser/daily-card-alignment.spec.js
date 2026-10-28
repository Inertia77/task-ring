const {test,expect}=require('@playwright/test');
const {boot}=require('./helpers');

for(const width of [1280,1600]) {
  test(`native and AI daily cards share height and action baseline at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await boot(page);
    await page.evaluate(()=>{
      const config=structuredClone(taskConfig);
      const base=config.tasks.find(t=>t.plan_mode==='daily')||config.tasks[0];
      config.tasks=[
        {...base,id:'daily-layout-standard',code:'h801',title:'查看今日 Notion 归档',cat:'life',time_category:'life',plan_mode:'daily',days:[0,1,2,3,4,5,6],enabled:true,ai_enabled:false,url:'https://example.com/native',steps:[],estimated_minutes:3},
        {...base,id:'daily-layout-ai',code:'h802',title:'30 分钟 AI 课程',cat:'life',time_category:'life',plan_mode:'daily',days:[0,1,2,3,4,5,6],enabled:true,ai_enabled:true,ai_chat_url:'https://example.com/chat',ai_archive_url:'https://example.com/archive',steps:[],estimated_minutes:30}
      ];
      applyTaskConfig(config,true);
    });
    await page.locator('#showToday').click();
    const group=page.locator('.dailyGroup').filter({has:page.locator('.dailyCard.aiEmbeddedCard')}).first();
    if(await group.getAttribute('open')===null)await group.locator(':scope > summary').click();
    const cards=group.locator('.dailyGroupBody > .dailyCard');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toBeVisible();
    await expect(cards.last()).toBeVisible();

    const measurements=await cards.evaluateAll(items=>items.map(card=>{
      const rect=card.getBoundingClientRect();
      const actions=card.querySelector('.dailyActions').getBoundingClientRect();
      const controls=[...card.querySelector('.dailyActions').children].map(el=>el.getBoundingClientRect());
      return {top:rect.top,bottom:rect.bottom,height:rect.height,
        actionsTop:actions.top,actionsBottom:actions.bottom,
        controls:controls.map(c=>({top:c.top,bottom:c.bottom,height:c.height}))};
    }));
    expect(Math.abs(measurements[0].top-measurements[1].top)).toBeLessThanOrEqual(1);
    expect(Math.abs(measurements[0].bottom-measurements[1].bottom)).toBeLessThanOrEqual(1);
    expect(Math.abs(measurements[0].actionsTop-measurements[1].actionsTop)).toBeLessThanOrEqual(2);
    for(const card of measurements){
      expect(card.controls.length).toBeGreaterThanOrEqual(2);
      for(const control of card.controls){
        expect(control.height).toBeGreaterThanOrEqual(41);
        expect(control.height).toBeLessThanOrEqual(43);
      }
    }
    const maxScroll=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    expect(maxScroll).toBeLessThanOrEqual(1);
  });
}

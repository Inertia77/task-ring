const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

for(const width of [320,390,768]){
  test(`touch layout keeps controls separate at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:844});
    await boot(page);
    const layout=await page.evaluate(()=>{
      const rect=selector=>{
        const r=document.querySelector(selector).getBoundingClientRect();
        return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
      };
      return {viewport:innerWidth,page:document.documentElement.scrollWidth,
        check:rect('.dailyComplete'),copy:rect('.dailyCopy'),
        more:rect('.dailyActions .uxActionMore'),timer:rect('.dailyActions .timerStartTiny'),
        dock:[...document.querySelectorAll('#viewDock > button')].map(el=>{
          const r=el.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height};
        })};
    });
    expect(layout.page).toBeLessThanOrEqual(layout.viewport+1);
    expect(layout.check.width).toBeGreaterThanOrEqual(44);
    expect(layout.check.right).toBeLessThanOrEqual(layout.copy.left);
    expect(Math.abs(layout.more.top-layout.timer.top)).toBeLessThan(3);
    expect(layout.dock).toHaveLength(6);
    for(const button of layout.dock){
      expect(button.left).toBeGreaterThanOrEqual(0);
      expect(button.right).toBeLessThanOrEqual(width);
      expect(button.height).toBeGreaterThanOrEqual(44);
    }
  });
}

test('module navigation restores each reading position without changing task config',async({page})=>{
  await page.setViewportSize({width:390,height:700});
  await boot(page);
  const config=await page.evaluate(()=>localStorage.getItem('taskring_local_config_v1'));
  await page.evaluate(()=>window.scrollTo({top:240,behavior:'instant'}));
  const previous=await page.evaluate(()=>window.scrollY);
  expect(previous).toBeGreaterThan(100);
  await view(page,'weekly');
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(0);
  await view(page,'tasks');
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(previous);
  expect(await page.evaluate(()=>localStorage.getItem('taskring_local_config_v1'))).toBe(config);
});

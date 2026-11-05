const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

test('game weekly lane scroll survives selection and completion retains keyboard focus',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await boot(page);
  await view(page,'game');
  await page.locator('[data-gqv6-board="weekly"]').click();
  const strip=page.locator('.gqV6LaneTabs');
  await strip.evaluate(el=>{el.scrollLeft=140});
  await page.waitForTimeout(150); // settle the existing mobile scroll-snap
  await page.evaluate(()=>{
    // Sample before the app's capture-phase click handler stops propagation.
    document.addEventListener('pointerdown',event=>{
      if(event.target.closest('[data-gqv6-lane]')){
        window.__beforeLaneClick={x:document.querySelector('.gqV6LaneTabs').scrollLeft,y:window.scrollY};
      }
    },{capture:true,once:true});
  });
  await page.locator('[data-gqv6-lane="steady"]').click();
  const after=await page.evaluate(()=>({
    before:window.__beforeLaneClick,
    x:document.querySelector('.gqV6LaneTabs').scrollLeft,
    y:window.scrollY
  }));
  expect(after.before.x).toBeGreaterThan(30);
  expect(Math.abs(after.x-after.before.x)).toBeLessThanOrEqual(4);
  expect(after.y).toBeGreaterThanOrEqual(0);
  await expect(page.locator('[data-gqv6-lane="steady"]')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('[data-gqv6-lane="steady"]')).toBeFocused();

  await page.locator('[data-gqv6-expand-all][data-board="weekly"][data-lane="steady"]').click();
  const task=page.locator('[data-gqv5-task][data-board="weekly"]').filter({visible:true}).first();
  const id=await task.getAttribute('data-task');
  const game=await task.getAttribute('data-game');
  await task.click();
  const updated=page.locator('[data-gqv5-task][data-board="weekly"][data-game="'+game+'"][data-task="'+id+'"]');
  await expect(updated).toHaveAttribute('aria-pressed','true');
  await expect(updated).toBeFocused();
  await updated.click();
  await expect(updated).toHaveAttribute('aria-pressed','false');
  await expect(updated).toBeFocused();
});

for(const [group,widths] of [
  ['phone',[320,360,390,430]],
  ['tablet',[700,768,820,900,901,1024,1049,1050]],
  ['desktop',[1099,1100,1280,1440,1500,1920]]
]){
  test('six-module viewport overflow audit — '+group,async({page})=>{
    test.setTimeout(120000);
    await page.setViewportSize({width:390,height:860});
    await boot(page);
    for(const width of widths){
      await page.setViewportSize({width,height:860});
      for(const module of ['tasks','weekly','fitness','game','time','library']){
        await view(page,module);
        const measured=await page.evaluate(()=>({
          scrollWidth:document.documentElement.scrollWidth,
          viewport:document.documentElement.clientWidth
        }));
        expect(measured.scrollWidth,group+' '+width+'px '+module+' overflows').toBeLessThanOrEqual(measured.viewport+1);
      }
    }
  });
}

test('game reentry starts on daily without disturbing internal board selection',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  await view(page,'game');
  await page.locator('[data-gqv6-board="weekly"]').click();
  await expect(page.locator('[data-gqv6-board="weekly"]')).toHaveClass(/active/);
  await page.locator('[data-gqv6-lane="optional"]').click();
  await expect(page.locator('[data-gqv6-lane="optional"]')).toHaveAttribute('aria-selected','true');
  // A local game rerender retains the user's selected board and lane.
  await page.evaluate(()=>renderAll(['game']));
  await expect(page.locator('[data-gqv6-board="weekly"]')).toHaveClass(/active/);
  await expect(page.locator('[data-gqv6-lane="optional"]')).toHaveAttribute('aria-selected','true');
  await view(page,'library');
  await view(page,'game');
  await expect(page.locator('[data-gqv6-board="daily"]')).toHaveClass(/active/);
  await expect(page.locator('[data-gqv6-lane="must"]')).toHaveAttribute('aria-selected','true');
});

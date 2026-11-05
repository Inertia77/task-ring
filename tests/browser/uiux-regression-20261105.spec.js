const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

test('game weekly lane scroll survives selection and completion retains keyboard focus',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await boot(page);
  await view(page,'game');
  await page.locator('[data-gqv6-board="weekly"]').click();
  // Normal 320px UI intentionally fits four compact tabs. Simulate wider translated
  // labels / enlarged controls so the navigation becomes genuinely scrollable.
  await page.addStyleTag({content:'.gameQuestV6 .gqV6LaneTabs{display:flex!important;width:260px!important;max-width:260px!important;overflow-x:auto!important;scroll-snap-type:none!important}.gameQuestV6 .gqV6LaneTab{flex:0 0 160px!important;min-width:160px!important}'});
  const strip=page.locator('.gqV6LaneTabs');
  const overflow=await strip.evaluate(el=>({scroll:el.scrollWidth,client:el.clientWidth,display:getComputedStyle(el).display}));
  expect(overflow.scroll,'Test fixture must overflow before testing scroll preservation').toBeGreaterThan(overflow.client+100);
  // Set the scroll position and dispatch the real delegated click in the same
  // animation turn. Async focus restoration otherwise introduces unrelated scrolling.
  const after=await page.evaluate(()=>{
    const strip=document.querySelector('.gqV6LaneTabs');
    strip.scrollLeft=140;
    const before={x:strip.scrollLeft,y:window.scrollY};
    document.querySelector('[data-gqv6-lane="wait"]').dispatchEvent(
      new MouseEvent('click',{bubbles:true,cancelable:true})
    );
    return {before,x:document.querySelector('.gqV6LaneTabs').scrollLeft,y:window.scrollY};
  });
  expect(after.before.x).toBeGreaterThan(30);
  expect(Math.abs(after.x-after.before.x)).toBeLessThanOrEqual(4);
  expect(after.y).toBeGreaterThanOrEqual(0);
  await expect(page.locator('[data-gqv6-lane="wait"]')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('[data-gqv6-lane="wait"]')).toBeFocused();

  await page.locator('[data-gqv6-expand-all][data-board="weekly"][data-lane="wait"]').click();
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

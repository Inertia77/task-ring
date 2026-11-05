const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

for(const width of [320,390,768]){
  test('mobile command dock has exactly one visual current page at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:844});
    await boot(page);
    let previous='tasks';
    for(const target of ['weekly','fitness','game','time','library','tasks']){
      await view(page,target);
      // Commit layout in the next frame before measuring color. Mobile HUD has
      // no navigation color transition, so the previous tab must already be neutral.
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));
      const state=await page.evaluate(()=>({
        active:[...document.querySelectorAll('#viewDock .viewDockBtn.active')].map(b=>b.dataset.viewTarget),
        current:[...document.querySelectorAll('#viewDock .viewDockBtn[aria-current="page"]')].map(b=>b.dataset.viewTarget),
        colors:[...document.querySelectorAll('#viewDock .viewDockBtn')].map(b=>({name:b.dataset.viewTarget,background:getComputedStyle(b).backgroundColor,transition:getComputedStyle(b).transitionDuration}))
      }));
      expect(state.active).toEqual([target]);
      expect(state.current).toEqual([target]);
      expect(state.colors.every(c=>c.transition.split(',').every(v=>parseFloat(v)===0)), 'Mobile dock colors must not animate from old active state').toBeTruthy();
      const here=state.colors.find(c=>c.name===target).background;
      const earlier=state.colors.find(c=>c.name===previous).background;
      if(previous!==target)expect(earlier,'previous module cannot look selected').not.toBe(here);
      previous=target;
    }
  });
}

test('mobile unlock is non-obstructive and failure feedback stays above bottom dock',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  await expect(page.locator('#toastBox.show')).toHaveCount(0);
  await page.evaluate(()=>showToast('同步失败：请检查连接','err',2500));
  const geometry=await page.evaluate(()=>{
    const dock=document.querySelector('#viewDock').getBoundingClientRect();
    const toast=document.querySelector('#toastBox').getBoundingClientRect();
    return {dockTop:dock.top,toastBottom:toast.bottom,toastHeight:toast.height,scrollWidth:document.documentElement.scrollWidth};
  });
  expect(geometry.toastBottom).toBeLessThanOrEqual(geometry.dockTop);
  expect(geometry.toastHeight).toBeLessThanOrEqual(60);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(391);
});

test('game policy remains accessible without filling the first phone screen',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  await view(page,'game');
  const advice=page.locator('.gqV6GateNotice');
  await expect(advice).toHaveCount(1);
  await expect(advice).not.toHaveAttribute('open','');
  const summary=advice.locator('summary');
  await expect(summary).toBeVisible();
  await summary.click();
  await expect(advice).toHaveAttribute('open','');
  await expect(advice).toContainText('T3');
  await page.evaluate(()=>renderAll(['game']));
  await expect(advice).toHaveAttribute('open','');
  await summary.click();
  await expect(advice).not.toHaveAttribute('open','');
  const firstTask=page.locator('.gqV6GameCard').first();
  await expect(firstTask).toBeVisible();
  const viewport=await page.evaluate(()=>({
    navTop:document.querySelector('#viewDock').getBoundingClientRect().top,
    firstTop:document.querySelector('.gqV6GameCard').getBoundingClientRect().top,
    advisory:document.querySelector('.gqV6GateNotice').getBoundingClientRect().height
  }));
  expect(viewport.advisory).toBeLessThanOrEqual(55);
  expect(viewport.firstTop,'first game should enter the phone viewport early').toBeLessThan(570);
  expect(viewport.firstTop).toBeLessThan(viewport.navTop);
  await expect(page.locator('[data-gqv6-expand-all]').filter({visible:true})).toHaveCount(1);
  // Task tier controls must remain operable; this is not a gating widget.
  const t3=page.locator('.gqV6GameCard [data-gqv5-task]').filter({visible:true}).first();
  await expect(t3).toBeEnabled();
});

test('daily heading and mode are separated without shrinking the tap target',async({page})=>{
  await page.setViewportSize({width:320,height:740});
  await boot(page);
  const layout=await page.evaluate(()=>{
    const head=document.querySelector('.taskRingControlHead');
    const eyebrow=head.querySelector('.taskAreaEyebrow');
    const title=head.querySelector('.taskAreaTitle').getBoundingClientRect();
    const mode=head.querySelector('.taskRingModeText').getBoundingClientRect();
    const btn=document.querySelector('.dailyCard .dailyActions button');
    return {
      eyebrow:getComputedStyle(eyebrow).display,
      title:title.toJSON(),mode:mode.toJSON(),
      actionHeight:btn?.getBoundingClientRect().height,
      overflow:document.documentElement.scrollWidth-innerWidth
    };
  });
  expect(layout.eyebrow).toBe('none');
  expect(layout.title.right).toBeLessThanOrEqual(layout.mode.left+1);
  expect(layout.actionHeight).toBeGreaterThanOrEqual(44);
  expect(layout.overflow).toBeLessThanOrEqual(1);
});

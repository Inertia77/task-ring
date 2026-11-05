const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

for(const width of [320,390,768,1440]){
  test('mission HUD retains legible navigation and functional content at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:844});
    await boot(page);
    const surface=await page.evaluate(()=>{
      const header=getComputedStyle(document.querySelector('.inertiaHeader'));
      const dock=getComputedStyle(document.querySelector('#viewDock'));
      const active=getComputedStyle(document.querySelector('#viewDock .viewDockBtn.active'));
      const daily=getComputedStyle(document.querySelector('.taskRingControlPanel'));
      return {
        header:header.backgroundImage,
        dockBg:dock.backgroundImage,
        dockColor:dock.backgroundColor,
        activeBg:active.backgroundImage,
        activeColor:active.backgroundColor,
        dailyBorder:daily.borderLeftWidth,
        viewport:document.documentElement.clientWidth,
        content:document.documentElement.scrollWidth
      };
    });
    expect(surface.header).toContain('linear-gradient');
    expect(surface.activeBg.includes('linear-gradient')||surface.activeColor!=='rgba(0, 0, 0, 0)').toBeTruthy();
    expect(Number.parseFloat(surface.dailyBorder)).toBeGreaterThanOrEqual(3);
    expect(surface.content).toBeLessThanOrEqual(surface.viewport+1);
    const check=page.locator('input[data-task="test-task-2"]').first();
    await page.locator('#showToday').click();
    await check.locator('..').click();
    await expect(check).toBeChecked();
    await check.locator('..').click();
    await expect(check).not.toBeChecked();
    await view(page,'game');
    await expect(page.locator('.gqV6Top.gameQuestTopBar')).toBeVisible();
    const heroBg=await page.locator('.gqV6Top.gameQuestTopBar').evaluate(el=>getComputedStyle(el).backgroundImage);
    expect(heroBg).toContain('linear-gradient');
    await page.locator('[data-gqv6-board="weekly"]').click();
    await expect(page.locator('[data-gqv6-board="weekly"]')).toHaveClass(/active/);
    await view(page,'library');
    await expect(page.locator('.refBoxHeader')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
  });
}

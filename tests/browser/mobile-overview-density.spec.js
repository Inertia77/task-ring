const {test,expect}=require('@playwright/test');
const {boot}=require('./helpers');

for(const width of [320,390,430]){
  test('mobile overview keeps tabs, selects and progress readable at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:844});
    await boot(page,'overview');

    const layout=await page.evaluate(()=>{
      const r=el=>el.getBoundingClientRect();
      const tabs=[...document.querySelectorAll('#commandCenter .commandTabs button')].map(r);
      const selects=[...document.querySelectorAll('#commandCenter .commandSelects select')].map(r);
      const metrics=[...document.querySelectorAll('#commandCenter .commandMetrics > .trMetric')].map(r);
      const nav=[...document.querySelectorAll('#viewDock .viewDockBtn')].filter(el=>getComputedStyle(el).display!=='none').map(r);
      return {
        horizontalOverflow:document.documentElement.scrollWidth-innerWidth,
        filterGrid:getComputedStyle(document.querySelector('#commandCenter .commandSelects')).gridTemplateColumns,
        tabs:tabs.map(x=>({top:x.top,left:x.left,right:x.right,height:x.height})),
        selects:selects.map(x=>({top:x.top,left:x.left,right:x.right,height:x.height})),
        metrics:metrics.map(x=>({top:x.top,left:x.left,right:x.right})),
        header:r(document.querySelector('.inertiaHeader')).toJSON(),
        nav:nav.map(x=>({height:x.height,top:x.top})),
        notesHeight:r(document.querySelector('#commandCenter .commandDetails > summary')).height
      };
    });

    expect(layout.horizontalOverflow,'page must not scroll horizontally').toBeLessThanOrEqual(1);
    expect(layout.header.right).toBeLessThanOrEqual(width+1);
    expect(layout.tabs).toHaveLength(4);
    expect(layout.selects).toHaveLength(3);
    expect(layout.metrics).toHaveLength(4);
    expect(Math.max(...layout.tabs.map(x=>x.top))-Math.min(...layout.tabs.map(x=>x.top))).toBeLessThan(2);
    expect(Math.max(...layout.selects.map(x=>x.top))-Math.min(...layout.selects.map(x=>x.top))).toBeLessThan(2);
    expect(layout.tabs[3].right).toBeLessThanOrEqual(width);
    expect(layout.selects[2].right).toBeLessThanOrEqual(width);
    expect(layout.metrics[1].top).toBeLessThanOrEqual(layout.metrics[0].top+1);
    expect(layout.metrics[2].top).toBeGreaterThan(layout.metrics[0].top);
    expect(layout.nav).toHaveLength(5);
    expect(layout.nav.every(x=>x.height>=44)).toBeTruthy();
    expect(layout.notesHeight).toBeLessThanOrEqual(34);

    await page.locator('#commandCenter [data-command-filter="required"]').click();
    await expect(page.locator('#commandCenter [data-command-filter="required"]')).toHaveAttribute('aria-pressed','true');
    await page.locator('#commandCenter [data-command-filter="all"]').click();
    await expect(page.locator('#commandCenter [data-command-filter="all"]')).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('#commandCenter [data-command-module]')).toBeVisible();
    await page.screenshot({path:'test-results/visual/'+test.info().project.name+'/mobile-overview/'+width+'.png'});
  });
}

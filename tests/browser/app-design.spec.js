const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

for(const width of [900,901,1099,1100,1600]){
  test(`application navigation does not overlap content at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await boot(page);
    for(const module of ['tasks','weekly','fitness','game','time','library']){
      await view(page,module);
      const layout=await page.evaluate(()=>{
        const nav=document.querySelector('#viewDock').getBoundingClientRect();
        const panel=[...document.querySelectorAll('[data-view-panel].active')].find(el=>el.getBoundingClientRect().width>0).getBoundingClientRect();
        return {nav:{right:nav.right,top:nav.top,bottom:nav.bottom},panel:{left:panel.left,top:panel.top},width:document.documentElement.scrollWidth};
      });
      expect(layout.width,`${module} horizontal overflow`).toBeLessThanOrEqual(width+1);
      if(width>=1100)expect(layout.nav.right,`${module} sidebar overlaps workspace`).toBeLessThan(layout.panel.left);
      else if(width>900)expect(layout.nav.bottom,`${module} top navigation overlaps content`).toBeLessThanOrEqual(layout.panel.top+1);
      else expect(layout.nav.bottom).toBeLessThanOrEqual(900);
    }
  });
}

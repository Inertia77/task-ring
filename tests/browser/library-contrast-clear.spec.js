const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

for(const width of [390,1440]){
  test('library B-clear visual contrast: text, hierarchy, and 44px links at '+width+'px',async({page})=>{
    await page.setViewportSize({width,height:900});
    await boot(page);
    await view(page,'library');
    const group=page.locator('.refGroup').first();
    if(await group.getAttribute('open')===null)await group.locator('summary').click();
    const colors=await page.evaluate(()=>{
      const first=selector=>document.querySelector(selector);
      const css=selector=>getComputedStyle(first(selector));
      const toRgb=color=>(color.match(/[0-9.]+/g)||[]).slice(0,3).map(Number);
      const luminance=color=>{
        const rgb=toRgb(color).map(v=>v/255).map(c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4));
        return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];
      };
      const contrast=(color,background)=>{
        const a=luminance(color),b=luminance(background);
        return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      };
      const item=first('.refGroup[open] .refItem');
      const link=first('.refGroup[open] .refItemAction.refItemOpen');
      return {
        title:contrast(css('.refGroup[open] .refItemCopy strong').color,'rgb(255,255,255)'),
        source:contrast(css('.refGroup[open] .refItemHost').color,'rgb(255,255,255)'),
        extra:contrast(css('.refGroup[open] .refItemMetaExtra').color,'rgb(255,255,255)'),
        group:contrast(css('.refGroup[open] .refGroupTitle').color,'rgb(234,242,247)'),
        count:contrast(css('.refGroup[open] .refGroupCount').color,'rgb(234,242,247)'),
        action:contrast(getComputedStyle(link).color,getComputedStyle(link).backgroundColor),
        projectSurface:css('.refGroup[open] > summary').backgroundImage,
        actionWidth:link.getBoundingClientRect().width,
        actionHeight:link.getBoundingClientRect().height,
        itemPresent:Boolean(item),
        scrollWidth:document.documentElement.scrollWidth,
        clientWidth:document.documentElement.clientWidth
      };
    });
    expect(colors.itemPresent).toBeTruthy();
    expect(colors.title).toBeGreaterThanOrEqual(7);
    for(const key of ['source','extra','group','count','action']){
      expect(colors[key],key+' readable contrast').toBeGreaterThanOrEqual(4.5);
    }
    expect(colors.projectSurface).toContain('linear-gradient');
    expect(colors.actionWidth).toBeGreaterThanOrEqual(44);
    expect(colors.actionHeight).toBeGreaterThanOrEqual(44);
    expect(colors.scrollWidth).toBeLessThanOrEqual(colors.clientWidth+1);
    await page.screenshot({path:'test-results/visual/'+test.info().project.name+'/after/'+width+'-library-clear.png',fullPage:true});
  });
}

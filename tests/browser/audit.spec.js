const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');
const fs=require('node:fs');
const phase=process.env.AUDIT_PHASE||'after';
for(const width of [320,360,390,430,700,768,820,1024,1280,1440,1920]){
 test(`six modules at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:900});await boot(page);
  const metrics=[];
  for(const module of ['tasks','weekly','fitness','game','time','library']){
   await view(page,module);
   await page.screenshot({path:`test-results/visual/${test.info().project.name}/${phase}/${width}-${module}.png`,fullPage:true});
   const m=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,firstAction:[...document.querySelectorAll('.viewPanel.active button,.viewPanel.active input')].find(e=>e.getBoundingClientRect().height>0)?.getBoundingClientRect().top}));
   metrics.push({module,...m});
   if(phase!=='before')expect(m.scroll,`${module} overflows at ${width}`).toBeLessThanOrEqual(width+1);
  }
  fs.mkdirSync('test-results/metrics',{recursive:true});fs.writeFileSync(`test-results/metrics/${phase}-${width}.json`,JSON.stringify(metrics,null,2));
 });
}

// Temporary instrumentation: remove before merging.
const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');
test.only('diagnose GameQuest visibility and policy rendering',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  page.on('pageerror',e=>console.log('GAME_DEBUG_PAGEERROR',e.stack||e.message));
  await boot(page);
  const snap=async label=>{
    const data=await page.evaluate(()=>{
      const p=document.querySelector('#gameQuestPanel');
      const lane=p?.querySelector('[data-daily-lane="must"]');
      const b=p?.querySelector('[data-gqv6-expand-all][data-lane="must"]');
      const g=p?.querySelector('[data-gqv5-task]');
      const info=e=>e&&({tag:e.tagName,cls:e.className,display:getComputedStyle(e).display,visibility:getComputedStyle(e).visibility,hidden:e.hidden,rect:{width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height},ancestorHidden:[...function*(n){while(n){if(n.hidden||getComputedStyle(n).display==='none')yield n.tagName+'#'+n.id+'.'+n.className;n=n.parentElement}}(e)].slice(0,10)});
      return {activeAppView:typeof activeAppView!=='undefined'?activeAppView:'UNDEFINED',bodyAppView:document.body.dataset.appView,navActive:document.querySelector('#viewDock [data-view-target="game"]')?.className,panel:info(p),lane:info(lane),expand:info(b),task:info(g),gameBoard:document.querySelector('[data-gqv6-board="daily"]')?.className,mustLane:document.querySelector('[data-gqv6-lane="must"]')?.getAttribute('aria-selected'),policy:window.TaskRingGamePlayPolicy?.get({id:'zzz'}),pending:window.TaskRingGameOpsV6?.pendingCore?.()};
    });
    console.log('GAME_DEBUG '+label+' '+JSON.stringify(data));
  };
  await snap('BEFORE');
  await view(page,'game');
  await snap('AFTER');
  await expect(page.locator('#gameQuestPanel')).toBeVisible();
  await expect(page.locator('[data-gqv6-expand-all][data-lane="must"]')).toBeVisible();
});

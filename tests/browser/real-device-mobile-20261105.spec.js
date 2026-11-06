const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

async function mockCloud(page){
  await page.route('**/assets/js/vendor/supabase-*.js', route=>route.fulfill({
    contentType:'text/javascript',body:`
      const now=Date.now();
      window.mockRows=['ZZZ','WW','NTE','HSR','ONMYOJI','ENDFIELD'].map((game,i)=>({
        id:'isolated-'+i,user_id:'isolated-owner',task_key:'fixture-'+i,game,server:'GLOBAL',
        task_name:'模拟限时活动 '+game,task_type:'RECURRING',lifecycle_status:'ACTIVE',
        verification:'CONFIRMED',priority:'NORMAL',archived_at:null,
        deadline_at:new Date(now+(i+1)*86400000).toISOString()
      }));
      window.supabase={createClient:()=>({
        auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'isolated-owner'}}}})},
        from(){const q={select(){return this},eq(){return this},is(){return this},
          not(){return this},order(){return this},range(){return this},
          then(ok,fail){return Promise.resolve({data:window.mockRows,error:null}).then(ok,fail)}
        };return q;}
      })};
    `
  }));
}

for(const width of [320,390,430]){
  test('real-device phone game hub actions and one-line filter '+width,async({page})=>{
    await page.setViewportSize({width,height:844});
    await mockCloud(page);
    await boot(page);
    await view(page,'game');
    await page.locator('[data-gqv6-board="hub"]').click();
    await expect(page.locator('.gameQuestV6.gameOpsHub')).toBeVisible();
    await expect(page.locator('.opsFilters')).toBeVisible();
    await expect(page.locator('.opsCard').first()).toBeVisible();

    const m=await page.evaluate(()=>{
      const q=s=>document.querySelector(s),r=e=>e.getBoundingClientRect();
      const hero=q('.gqV6Top'),buttons=[...q('.gameQuestHeroSide').querySelectorAll('button')];
      const filters=q('.opsFilters'),first=q('.opsCard');
      return {
        heroHeight:r(hero).height,
        meterDisplay:getComputedStyle(q('.gameQuestTopMeter')).display,
        buttons:buttons.map(b=>({h:r(b).height,w:r(b).width,
          label:getComputedStyle(b.querySelector('.gameCommandCopy b')).whiteSpace,
          text:b.querySelector('.gameCommandCopy b').textContent})),
        filterWrap:getComputedStyle(filters).flexWrap,
        filterScroll:filters.scrollWidth,filterClient:filters.clientWidth,
        chipHeight:r(filters.querySelector('button')).height,
        cardTop:r(first).top,
        screen:document.documentElement.scrollWidth
      };
    });
    expect(m.meterDisplay).toBe('grid');
    expect(m.heroHeight).toBeLessThan(195);
    expect(m.buttons).toHaveLength(3);
    for(const action of m.buttons){expect(action.h).toBeGreaterThanOrEqual(44);expect(action.w).toBeGreaterThan(70);expect(action.label).toBe('nowrap');}
    expect(m.filterWrap).toBe('nowrap');
    expect(m.filterScroll).toBeGreaterThan(m.filterClient+20);
    expect(m.chipHeight).toBeGreaterThanOrEqual(44);
    expect(m.cardTop).toBeLessThan(width<360?730:640);
    expect(m.screen).toBeLessThanOrEqual(width+1);
    await page.screenshot({path:`test-results/visual/${test.info().project.name}/after/${width}-real-device-hub.png`,fullPage:true});
  });
}

test('limited-event filter strip stays in place on click and local refresh',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await mockCloud(page);await boot(page);await view(page,'game');
  await page.locator('[data-gqv6-board="hub"]').click();
  await expect(page.locator('.opsFilters')).toBeVisible();
  await page.evaluate(()=>{
    const strip=document.querySelector('.opsFilters');strip.scrollLeft=120;
  });
  const first=await page.locator('.opsFilters').evaluate(e=>e.scrollLeft);
  expect(first).toBeGreaterThan(60);
  // Trigger the existing delegated click without Playwright pre-scrolling.
  await page.evaluate(()=>document.querySelector('[data-ops-filter="ZZZ"]')
    .dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  await expect(page.locator('[data-ops-filter="ZZZ"]')).toHaveAttribute('aria-pressed','true');
  await page.waitForTimeout(100);
  const after=await page.locator('.opsFilters').evaluate(e=>e.scrollLeft);
  expect(Math.abs(after-first)).toBeLessThanOrEqual(4);
  await page.evaluate(()=>renderAll(['game']));
  const restored=await page.locator('.opsFilters').evaluate(e=>e.scrollLeft);
  expect(Math.abs(restored-first)).toBeLessThanOrEqual(4);
});

for(const width of [320,390,430]){
  test('archive is a compact accessible list '+width,async({page})=>{
    await page.setViewportSize({width,height:844});
    await boot(page);
    await page.evaluate(()=>{
      const cfg=loadLocalTaskConfig();
      cfg.refs[0].items=[...Array(10)].map((_,i)=>({
        id:'compact-'+i,title:i===0?'较长的资料标题，需要正常换行并确保全文可读取':'测试资料 '+i,
        url:'https://example.com/r'+i,enabled:true
      }));
      saveLocalTaskConfig(cfg,'隔离测试');applyTaskConfig(cfg,true);
    });
    await view(page,'library');
    const group=page.locator('.refGroup').first();
    await group.evaluate(e=>e.open=true);
    const rows=group.locator('.refItem');
    await expect(rows).toHaveCount(10);
    const report=await rows.evaluateAll(els=>els.map(el=>({
      height:el.getBoundingClientRect().height,
      button:el.querySelector('a').getBoundingClientRect().height,
      target:el.querySelector('a').getAttribute('href')
    })));
    for(const row of report){
      expect(row.height).toBeLessThanOrEqual(75);
      expect(row.button).toBeGreaterThanOrEqual(44);
      expect(row.target).toMatch(/^https:\/\/example\.com/);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width+1);
    await page.screenshot({path:`test-results/visual/${test.info().project.name}/after/${width}-real-device-library.png`,fullPage:true});
  });
}

test('daily marking guide collapses to a compact disclosure, expands without losing contents',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  const legend=page.locator('#legendBox');
  await expect(legend).not.toHaveAttribute('open','');
  const metrics=await legend.evaluate(e=>{
    const a=e.getBoundingClientRect(),s=e.querySelector('summary').getBoundingClientRect();
    return {width:a.width,height:a.height,button:s.height};
  });
  expect(metrics.width).toBeLessThan(180);
  expect(metrics.height).toBeLessThanOrEqual(60);
  expect(metrics.button).toBeGreaterThanOrEqual(44);
  await legend.locator('summary').click();
  await expect(legend).toHaveAttribute('open','');
  await expect(legend.locator('.legendGrid')).toContainText('核心保底');
  await legend.locator('summary').click();
  await expect(legend).not.toHaveAttribute('open','');
});

const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

test('daily and weekly meters keep required and all denominators independent of T3',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await boot(page);
  await view(page,'game');
  await page.evaluate(()=>{
    const P=window.TaskRingGamePlayPolicy,uid='progress-meter-fixture';
    P.setOwner(uid);
    P.setRows([
      {game_key:'zzz',play_tier:1,sort_order:1},
      {game_key:'nte',play_tier:1,sort_order:2},
      {game_key:'wuwa',play_tier:1,sort_order:3},
      {game_key:'hsr',play_tier:2,sort_order:4},
      {game_key:'onmyoji',play_tier:2,sort_order:5},
      {game_key:'endfield',play_tier:3,sort_order:6}
    ],uid);
    renderAll(['game']);
  });
  const required=page.locator('.gqDualMeter .gqMeterItem.isRequired');
  const all=page.locator('.gqDualMeter .gqMeterItem.isAll');
  await expect(required).toContainText('必做完成度');
  await expect(required.locator('b')).toHaveText('0/5');
  await expect(all.locator('b')).toHaveText('0/10');
  await expect(page.locator('[data-gqv6-board="daily"]')).toContainText('全部 0/10');

  await page.locator('[data-gqv5-task][data-board="daily"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/5');
  await expect(all.locator('b')).toHaveText('1/10');

  await page.locator('[data-gqv6-lane="optional"][data-board="daily"]').click();
  await page.locator('[data-gqv5-task][data-board="daily"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/5');
  await expect(all.locator('b')).toHaveText('2/10');

  // T3 retains checkability, but does not alter either T1/T2 meter.
  await page.locator('[data-gqv6-expand-all][data-board="daily"][data-lane="optional"]').click();
  const t3=page.locator('[data-gqv5-task][data-board="daily"][data-game="endfield"]').first();
  await expect(t3).toBeEnabled();
  await t3.click();
  await expect(required.locator('b')).toHaveText('1/5');
  await expect(all.locator('b')).toHaveText('2/10');

  await page.locator('[data-gqv6-board="weekly"]').click();
  await expect(required.locator('b')).toHaveText('0/15'); // sprint + steady + wait
  await expect(all.locator('b')).toHaveText('0/20'); // plus optional
  await page.locator('[data-gqv5-task][data-board="weekly"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/15');
  await expect(all.locator('b')).toHaveText('1/20');
  await page.locator('[data-gqv6-lane="optional"][data-board="weekly"]').click();
  await page.locator('[data-gqv5-task][data-board="weekly"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/15');
  await expect(all.locator('b')).toHaveText('2/20');

  const geometry=await page.evaluate(()=>({
    width:document.documentElement.scrollWidth,
    view:window.innerWidth,
    meter:document.querySelector('.gqDualMeter').getBoundingClientRect().width
  }));
  expect(geometry.width).toBeLessThanOrEqual(geometry.view+1);
  expect(geometry.meter).toBeGreaterThan(200);
});

test('LIVE OPS meter follows JST task status and active game filter, not a completion percentage',async({page})=>{
  await page.setViewportSize({width:320,height:844});
  await page.route('**/assets/js/vendor/supabase-*.js',route=>route.fulfill({
    contentType:'text/javascript',body:`
      const day=(offset)=>{
        const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(Date.now()+offset*86400000);
        const part=(key)=>p.find(x=>x.type===key).value;
        return part('year')+'-'+part('month')+'-'+part('day');
      };
      window.mockRows=[
        {id:'a',game:'ZZZ',deadline_date:day(2),verification:'CONFIRMED'},
        {id:'b',game:'WUWA',deadline_date:day(20),verification:'CONFIRMED'},
        {id:'c',game:'NTE',open_date:day(3),deadline_date:day(12),verification:'CONFIRMED'},
        {id:'d',game:'HSR',deadline_date:day(-1),verification:'CONFIRMED'},
        {id:'e',game:'ENF',verification:'TO_VERIFY'}
      ].map(t=>({user_id:'meter-fixture',task_key:'test-'+t.id,task_name:'状态测试 '+t.id,
        task_type:'LIMITED_TIME',lifecycle_status:'ACTIVE',priority:'NORMAL',archived_at:null,
        ...t}));
      window.supabase={createClient:()=>({
        auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'meter-fixture'}}}})},
        from(name){return {select(){return this},eq(){return this},is(){return this},not(){return this},
          order(){return this},range(){return this},
          then(ok,fail){return Promise.resolve({data:name==='game_play_policies'?[]:window.mockRows,error:null}).then(ok,fail)}
        };}
      })};
    `
  }));
  await boot(page);
  await view(page,'game');
  await page.locator('[data-gqv6-board="hub"]').click();
  const meter=page.locator('#gameQuestTopMeter');
  await expect(meter.locator('.gqOpsMeterStat')).toHaveCount(4);
  await expect(meter.locator('.active b')).toHaveText('3');
  await expect(meter.locator('.urgent b')).toHaveText('1');
  await expect(meter.locator('.upcoming b')).toHaveText('1');
  await expect(meter.locator('.expired b')).toHaveText('1');
  await expect(meter).not.toContainText('%');

  await page.locator('[data-ops-filter="ZZZ"]').click();
  await expect(meter.locator('.active b')).toHaveText('1');
  await expect(meter.locator('.urgent b')).toHaveText('1');
  await expect(meter.locator('.upcoming b')).toHaveText('0');
  await expect(meter.locator('.expired b')).toHaveText('0');
  const dims=await page.evaluate(()=>({
    doc:document.documentElement.scrollWidth,
    view:innerWidth,
    style:getComputedStyle(document.getElementById('gameQuestTopMeter')).display
  }));
  expect(dims.doc).toBeLessThanOrEqual(dims.view+1);
  expect(dims.style).toBe('grid');
});

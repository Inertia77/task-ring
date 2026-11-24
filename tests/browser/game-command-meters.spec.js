const {test,expect}=require('@playwright/test');
const {boot,view}=require('./helpers');

test('daily and weekly required meters exclude A级 while all meters include it',async({page})=>{
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
      {game_key:'hsr',play_tier:1,sort_order:4},
      {game_key:'onmyoji',play_tier:1,sort_order:5},
      {game_key:'endfield',play_tier:2,sort_order:6}
    ],uid);
    renderAll(['game']);
  });
  const required=page.locator('.gqDualMeter .gqMeterItem.isRequired');
  const all=page.locator('.gqDualMeter .gqMeterItem.isAll');
  await expect(required).toContainText('必做完成度');
  await expect(required.locator('b')).toHaveText('0/5');
  await expect(all.locator('b')).toHaveText('0/12');
  await expect(page.locator('[data-gqv6-board="daily"]')).toContainText('全部 0/12');

  await page.locator('[data-gqv5-task][data-board="daily"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/5');
  await expect(all.locator('b')).toHaveText('1/12');

  await page.locator('[data-gqv6-lane="optional"][data-board="daily"]').click();
  await page.locator('#gqv6-lane-panel-daily-optional [data-gqv5-task][data-board="daily"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/5');
  await expect(all.locator('b')).toHaveText('2/12');

  // A级 remains checkable in its own scope and advances the global all-task meter only.
  await expect(page.locator('[data-gqv5-task][data-game="endfield"]')).toHaveCount(0);
  await page.locator('[data-gqv6-scope="reserve"]').click();
  await page.locator('[data-gqv6-lane="optional"][data-board="daily"]').click();
  const t3=page.locator('#gqv6-lane-panel-daily-optional [data-gqv5-task][data-board="daily"][data-game="endfield"]').first();
  await expect(t3).toBeEnabled();
  await t3.click();
  await expect(page.locator('.gqReserveMeter .gqMeterItem b')).toHaveText('1/2');
  await expect(required).toHaveCount(0);
  await page.locator('[data-gqv6-scope="core"]').click();
  await expect(page.locator('[data-gqv6-lane="optional"][data-board="daily"]')).toHaveAttribute('aria-selected','true');
  await expect(required.locator('b')).toHaveText('1/5');
  await expect(all.locator('b')).toHaveText('3/12');

  await page.locator('[data-gqv6-board="weekly"]').click();
  await expect(required.locator('b')).toHaveText('0/15'); // sprint + steady + wait
  await expect(all.locator('b')).toHaveText('0/24'); // plus S级 optional and all A级 weekly tasks
  await page.locator('[data-gqv5-task][data-board="weekly"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/15');
  await expect(all.locator('b')).toHaveText('1/24');
  await page.locator('[data-gqv6-lane="optional"][data-board="weekly"]').click();
  await page.locator('#gqv6-lane-panel-weekly-optional [data-gqv5-task][data-board="weekly"][data-game="zzz"]').first().click();
  await expect(required.locator('b')).toHaveText('1/15');
  await expect(all.locator('b')).toHaveText('2/24');

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
        {id:'e',game:'ENF',deadline_date:day(2),verification:'CONFIRMED'}
      ].map(t=>({user_id:'meter-fixture',task_key:'test-'+t.id,task_name:'状态测试 '+t.id,
        task_type:'LIMITED_TIME',lifecycle_status:'ACTIVE',priority:'NORMAL',archived_at:null,
        ...t}));
      window.supabase={createClient:()=>({
        auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'meter-fixture'}}}})},
        from(name){return {select(){return this},eq(){return this},is(){return this},not(){return this},
          order(){return this},range(){return this},
          then(ok,fail){return Promise.resolve({data:name==='game_play_policies'?[{game_key:'endfield',play_tier:2,sort_order:6}]:window.mockRows,error:null}).then(ok,fail)}
        };}
      })};
    `
  }));
  await boot(page);
  await view(page,'game');
  await page.locator('[data-gqv6-board="hub"]').click();
  const meter=page.locator('#gameQuestTopMeter');
  await expect(meter.locator('.gqOpsMeterStat')).toHaveCount(4);
  await expect(meter.locator('.active b')).toHaveText('2');
  await expect(page.locator('[data-ops-card="e"]')).toHaveCount(0);
  await expect(page.locator('[data-ops-filter="ENF"]')).toHaveCount(0);
  await expect(page.locator('[data-gq-scope-reserve]')).toContainText('1 项7天内截止');
  await expect(meter.locator('.urgent b')).toHaveText('1');
  await expect(meter.locator('.upcoming b, .gqOpsMeterStat.quiet:nth-child(3) b')).toHaveText('1');
  await expect(meter.locator('.expired b, .gqOpsMeterStat.quiet:nth-child(4) b')).toHaveText('1');
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
  await page.locator('[data-gqv6-scope="reserve"]').click();
  await page.locator('[data-gqv6-board="hub"]').click();
  await expect(page.locator('[data-ops-card="e"]')).toBeVisible();
  await expect(page.locator('[data-ops-card="a"]')).toHaveCount(0);
  await expect(page.locator('[data-ops-filter="ZZZ"]')).toHaveCount(0);
  await expect(meter.locator('.active b')).toHaveText('1');
  await expect(meter.locator('.urgent b')).toHaveText('1');
  await page.locator('[data-gqv6-scope="core"]').click();
  await expect(page.locator('[data-gqv6-board="hub"]')).toHaveClass(/active/);
  await expect(page.locator('[data-ops-filter="ZZZ"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-ops-card="e"]')).toHaveCount(0);
});

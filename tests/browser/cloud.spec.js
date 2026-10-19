const {test,expect}=require('@playwright/test');const {boot,view}=require('./helpers');
for(const width of [320,390,768,1440])test(`cloud deadline, claim window, offline and failure ${width}`,async({page,context})=>{
 await page.setViewportSize({width,height:900});
 await page.route('**/assets/js/vendor/supabase-*.js',route=>route.fulfill({contentType:'text/javascript',body:`
 const now=Date.now();const row=(id,extra)=>({id,user_id:'isolated-owner',task_key:id,game:'ZZZ',server:'GLOBAL',task_name:id,task_type:'RECURRING',lifecycle_status:'ACTIVE',verification:'CONFIRMED',priority:'NORMAL',archived_at:null,...extra});
 window.mockRows=[row('urgent',{deadline_at:new Date(now+3600000).toISOString()}),row('claim',{gameplay_end_at:new Date(now-3600000).toISOString(),claim_end_at:new Date(now+4*86400000).toISOString()}),row('unknown',{verification:'TO_VERIFY'})];
 window.mockFail=false;window.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:{user:{id:'isolated-owner'}}}})},from(){const q={select(){return this},eq(){return this},is(){return this},not(){return this},order(){return this},range(){return this},then(ok,fail){return Promise.resolve(window.mockFail?{error:{message:'隔离模拟失败'}}:{data:window.mockRows,error:null}).then(ok,fail)}};return q}})};
 `}));
 await boot(page);await view(page,'game');await page.locator('[data-gqv6-board="hub"]').click();
 await expect(page.locator('[data-ops-card="urgent"]')).toHaveClass(/urgency-red/);await expect(page.locator('[data-ops-card="claim"]')).toContainText('仍可领取');await expect(page.locator('[data-ops-card="unknown"]')).toContainText('期限待核验');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
 await page.screenshot({path:`test-results/visual/${test.info().project.name}/after/${width}-cloud.png`,fullPage:true});
 await page.evaluate(()=>window.mockFail=true);await page.locator('[data-ops-refresh]').click();await expect(page.locator('.opsError')).toContainText('保留最近缓存');
 await context.setOffline(true);await expect(page.locator('.opsSync')).toContainText('离线');await expect(page.locator('[data-ops-action]').first()).toBeDisabled();
});

const {test,expect}=require('@playwright/test');const fs=require('node:fs');const http=require('node:http');const path=require('node:path');
test('PWA upgrades assets without reloading an unsaved editor draft',async({browser})=>{
 const root=path.resolve(__dirname,'../..');let revision='baseline';
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  const file=path.join(root,name==='/'?'index.html':name);
  if(!file.startsWith(root)||!fs.existsSync(file)){res.writeHead(404).end();return}
  const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json'};
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
  let content=fs.readFileSync(file);if(name==='/service-worker.js')content=Buffer.from(content.toString().replace(/taskring-shell-[\w-]+/,`taskring-shell-test-${revision}`));
  res.end(content);
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 const context=await browser.newContext({serviceWorkers:'allow'});const page=await context.newPage();await page.route('https://**/*',r=>r.abort());
 try{
  await page.goto(base+'/?preview');await page.waitForFunction(()=>!!window.TaskRingProductUi);await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  await page.locator('#controlCenterBtn').click();await page.locator('#controlTaskEditorBtn').click();
  const row=page.locator('.cfgTask').first();await row.locator('summary').first().click();await row.locator('.cfgTitle').fill('PWA 未保存草稿');
  revision='next';await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update()});
  await page.waitForFunction(async()=>!!(await caches.keys()).find(k=>k==='taskring-shell-test-next'));
  await expect(row.locator('.cfgTitle')).toHaveValue('PWA 未保存草稿');
  await expect(page.locator('#toastBox')).toContainText('先保存草稿');
  const cached=await page.evaluate(async()=>{const cache=await caches.open('taskring-shell-test-next');return (await cache.match('./assets/css/main.css')).text()});expect(cached).toContain('game-weekly-flow.css');
 }finally{await context.close();await new Promise(r=>server.close(r))}
});

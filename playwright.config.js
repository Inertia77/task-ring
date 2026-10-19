const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests/browser', timeout:30000, fullyParallel:false, workers:1,
  reporter:[['list'],['html',{open:'never'}]],
  use:{baseURL:'http://127.0.0.1:4173',serviceWorkers:'block',timezoneId:'Asia/Tokyo',reducedMotion:'reduce'},
  webServer:{command:'python3 -m http.server 4173 --bind 127.0.0.1',url:'http://127.0.0.1:4173',reuseExistingServer:false,stderr:'ignore'},
  projects:[
    {name:'chromium',use:{browserName:'chromium',launchOptions:process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}}},
    {name:'webkit',use:{browserName:'webkit'}}
  ]
});

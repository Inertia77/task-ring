const fs=require('node:fs');
const path=require('node:path');
const pkg=require('../node_modules/@supabase/supabase-js/package.json');
if(pkg.version!=='2.117.2')throw new Error('Unexpected Supabase SDK version');
const target=path.resolve(__dirname,'../assets/js/vendor');
fs.mkdirSync(target,{recursive:true});
fs.copyFileSync(path.resolve(__dirname,'../node_modules/@supabase/supabase-js/dist/umd/supabase.js'),path.join(target,'supabase-2.117.2.js'));
fs.copyFileSync(path.resolve(__dirname,'../node_modules/@supabase/supabase-js/LICENSE'),path.join(target,'supabase-LICENSE'));
console.log('Vendored pinned Supabase SDK; static Pages needs no runtime build.');

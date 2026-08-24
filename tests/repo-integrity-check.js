const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");

const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const exists=file=>fs.existsSync(path.join(root,file));
const stripQuery=value=>value.split(/[?#]/,1)[0];

const html=read("index.html");
const sw=read("service-worker.js");
const gitignore=read(".gitignore");
const defaultData=read("assets/js/data/default-data.js");

const localScripts=[...html.matchAll(/<script\s+[^>]*src=["']([^"']+)["']/g)]
  .map(match=>stripQuery(match[1]))
  .filter(src=>!/^https?:\/\//i.test(src));
assert(localScripts.length>0,"index.html should load local JavaScript files");
for(const script of localScripts)assert(exists(script),`index.html references missing script: ${script}`);

const shell=new Set([...sw.matchAll(/["']\.\/([^"']+)["']/g)].map(match=>match[1]));
for(const script of localScripts){
  assert(shell.has(script),`service-worker APP_SHELL is missing runtime script: ${script}`);
}

for(const pattern of [
  "taskring-tasks-*.json",
  "taskring-game-quest-*.json",
  "taskring-fitness-*.json",
  "taskring-library-*.json"
])assert(gitignore.includes(pattern),`.gitignore is missing private export pattern: ${pattern}`);

assert(!/time_category\s*:\s*["']create["']/.test(defaultData),'default-data.js still contains invalid time_category "create"');
assert(!/time_category\s*:\s*["']it["']/.test(defaultData),'default-data.js still contains invalid time_category "it"');

for(const required of ["assets/js/data/integrity-core.js","assets/js/data-integrity.js"]){
  assert(localScripts.includes(required),`index.html must load ${required}`);
  assert(shell.has(required),`service worker must cache ${required}`);
}

console.log(`Repository integrity OK: ${localScripts.length} runtime scripts checked.`);

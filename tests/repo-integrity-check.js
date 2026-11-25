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
const assetManifest=JSON.parse(read("docs/ASSET_MANIFEST.json"));
const mainCss=read("assets/css/main.css");
const pwa=read("assets/js/pwa.js");
const uxJs=read("assets/js/ux-efficiency.js");
const uxCss=read("assets/css/ux-efficiency.css");
const visualCss=read("assets/css/visual-polish.css");
const appJs=read("assets/js/app.js");
const dataIntegrityJs=read("assets/js/data-integrity.js");
const gameOpsV6Js=read("assets/js/game-ops-v6.js");
const productUiJs=read("assets/js/views/product-ui.js");
const gameWeeklyFlowCss=read("assets/css/game-weekly-flow.css");

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

assert(exists("assets/js/ux-efficiency.js"),"UX efficiency runtime is missing");
assert(exists("assets/css/ux-efficiency.css"),"UX efficiency stylesheet is missing");
assert(pwa.includes("assets/js/ux-efficiency.js"),"pwa.js must load the post-render UX efficiency layer");
assert(mainCss.includes("ux-efficiency.css"),"main.css must import UX efficiency styles");
assert(shell.has("assets/js/ux-efficiency.js"),"service worker must cache the UX efficiency runtime");
assert(shell.has("assets/css/ux-efficiency.css"),"service worker must cache UX efficiency styles");
assert(uxJs.includes("aria-keyshortcuts"),"UX layer must expose keyboard shortcuts to assistive technology");
assert(uxJs.includes("mutationNeedsEnhance"),"UX layer must keep MutationObserver work targeted instead of rescanning on every DOM update");
assert(uxCss.includes(".uxShortcutHint"),"desktop shortcut discovery hint is missing");
assert(uxCss.includes(".uxIdleLog"),"idle editor-log compaction style is missing");

assert(exists("assets/css/visual-polish.css"),"visual polish stylesheet is missing");
assert(mainCss.includes("visual-polish.css"),"main.css must import visual polish styles");
assert(shell.has("assets/css/visual-polish.css"),"service worker must cache visual polish styles");
assert(visualCss.includes(".viewDockBtn[data-view-target=\"tasks\"]:not(.active)"),"visual polish must keep inactive navigation surfaces quiet");
assert(visualCss.includes("@media (prefers-contrast: more)"),"visual polish must retain a higher-contrast fallback");

const workspaceJs=read("assets/js/workspace-cloud.js");
assert(appJs.includes('ghPull({preferRemote:true,interactive:true})'),"manual cloud pull must explicitly request cloud-wins conflict resolution");
assert(appJs.includes('ghHydrateGistFile(gist,GITHUB_STATE_FILE,{alwaysRaw:true})'),"one-time migration must read full legacy state file");
assert(appJs.includes('async function ghPatchFiles(){throw new Error'),"legacy Gist writer must be physically disabled");
assert(!/api\.github\.com\/gists\/[^\n]+method:\s*["']PATCH["']/.test(appJs),"Gist network writes must not remain");
assert(workspaceJs.includes('initialize_taskring_workspace'),"migration must initialize the Supabase workspace");
assert(workspaceJs.includes('save_taskring_workspace_config_v2'),"configuration writes must use atomic Supabase RPC");
assert(workspaceJs.includes('import_taskring_workspace'),"full backup import must be atomic");
assert(workspaceJs.includes('save_taskring_workspace_state'),"completion and time history must use versioned Supabase writes");
assert(workspaceJs.includes('旧数据迁移')&&workspaceJs.includes('localStorage.removeItem(GH_TOKEN_KEY)'),"legacy credential is retired after verified migration");
assert(dataIntegrityJs.includes('workspaceBridge:'),"existing state merge and conflict helpers must be preserved");
assert(gameOpsV6Js.includes('data-gqv6-complete-daily="1"'),"GameQuest daily board must expose the one-tap complete-all action");
assert(gameOpsV6Js.includes("function completeDailyBoard"),"GameQuest daily complete-all handler is missing");
assert(gameOpsV6Js.includes('role="tablist"'),"GameQuest lanes must render separate accessible tabs");
assert(gameOpsV6Js.includes('data-gqv6-lane="'),"GameQuest lane tab selectors are missing");
assert(gameOpsV6Js.includes("LANE_STORAGE_PREFIX"),"GameQuest lane selections must persist per board");
assert(productUiJs.includes('const previousTabScroll=el.querySelector(".weeklyCategoryTabs")?.scrollLeft;'),"Weekly tab rerender must capture horizontal scroll");
assert(productUiJs.includes("if(tabs)tabs.scrollLeft=previousTabScroll;"),"Weekly tab rerender must restore horizontal scroll");
assert(gameOpsV6Js.includes("MOBILE_FOCUS_PREFIX"),"GameQuest mobile focus preferences should stay local");
assert(gameOpsV6Js.includes('function newTask(board){return {id:"",title:"新任务"'),"GameQuest add-task must create a nonempty editable draft");
assert(gameOpsV6Js.includes('input.select();'),"GameQuest add-task must select the new title for immediate editing");
assert(gameOpsV6Js.includes("gqV6MobileCollapsed"),"GameQuest mobile accordion card state is missing");
assert(gameOpsV6Js.includes('data-gqv6-expand-all="1"'),"GameQuest mobile expand-all control is missing");
assert(gameOpsV6Js.includes('data-gqv6-game-toggle="1"'),"GameQuest mobile per-game toggle is missing");
assert(gameWeeklyFlowCss.includes(".gqV6MobileCollapsed .gameQuestCardBody,") && gameWeeklyFlowCss.includes(".gqV6MobileCollapsed .gameQuestProgressRail{display:none}"),"GameQuest collapsed cards must hide body and rail only on mobile");
assert(gameWeeklyFlowCss.includes("@media (max-width:700px)"),"GameQuest compact mode must be mobile-scoped");
assert(mainCss.lastIndexOf("game-weekly-flow.css")>mainCss.indexOf("game-ops-v6.css"),"GameQuest compact override must load after v6 styles");

assert(!exists("assets/images/css"),"obsolete legacy theme asset directory assets/images/css must stay removed");
assert(!exists("docs/REFACTOR_REPORT.md"),"obsolete REFACTOR_REPORT.md should not return to the current docs tree");
assert(!exists("docs/CLEANUP_REPORT.md"),"obsolete CLEANUP_REPORT.md should not return to the current docs tree");
assert(Array.isArray(assetManifest.unusedRetained)&&assetManifest.unusedRetained.length===0,"asset manifest should not claim intentionally retained unused runtime assets");
assert(exists("assets/images/cutins"),"active cut-in asset directory is missing");

console.log(`Repository integrity OK: ${localScripts.length} index scripts + UX/visual layers checked.`);

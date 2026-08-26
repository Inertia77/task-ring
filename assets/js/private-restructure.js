(() => {
  "use strict";

  const PARAM = "taskRestructure";
  const LABELS_KEY = "taskring_private_weekly_labels_v1";
  const ALLOWED_SET_KEYS = new Set([
    "title","cat","days","core","optional","important",
    "time_category","estimated_minutes","weekly_minutes","plan_mode","steps"
  ]);

  function toast(message, type = "ok", duration = 5200){
    if(typeof window.showToast === "function") window.showToast(message, type, duration);
    else console.info(message);
  }

  function decodePayload(raw){
    const normalized = String(raw || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    if(!normalized) throw new Error("empty payload");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid payload");
    return parsed;
  }

  function list(value){
    if(value == null) return [];
    return (Array.isArray(value) ? value : [value]).map(v => String(v || "").trim()).filter(Boolean);
  }

  function matches(task, matcher = {}){
    if(!task || !matcher || typeof matcher !== "object") return false;
    const id = String(task.id || "").trim();
    const title = String(task.title || "").trim();
    const cat = String(task.cat || "").trim();
    const timeCategory = String(task.time_category || task.timeCategory || "").trim();
    const planMode = String(task.plan_mode || task.planMode || "").trim();

    const ids = [...list(matcher.id), ...list(matcher.ids)];
    if(ids.length && !ids.includes(id)) return false;

    const titles = [...list(matcher.title), ...list(matcher.titles)];
    if(titles.length && !titles.includes(title)) return false;

    const contains = [...list(matcher.title_contains), ...list(matcher.title_contains_any)];
    if(contains.length && !contains.some(part => title.toLowerCase().includes(part.toLowerCase()))) return false;

    const cats = [...list(matcher.cat), ...list(matcher.cats)];
    if(cats.length && !cats.includes(cat)) return false;

    const timeCategories = [...list(matcher.time_category), ...list(matcher.time_categories)];
    if(timeCategories.length && !timeCategories.includes(timeCategory)) return false;

    const planModes = [...list(matcher.plan_mode), ...list(matcher.plan_modes)];
    if(planModes.length && !planModes.includes(planMode)) return false;

    return ids.length || titles.length || contains.length || cats.length || timeCategories.length || planModes.length;
  }

  function normalizeSteps(value){
    if(!Array.isArray(value)) return value;
    return value.map((step, index) => {
      if(typeof step === "string") return {id:`private-step-${index+1}`, title:step.trim(), enabled:true};
      if(!step || typeof step !== "object") return null;
      return {...step, id:String(step.id || `private-step-${index+1}`), title:String(step.title || `子任务 ${index+1}`), enabled:step.enabled !== false};
    }).filter(step => step && step.title.trim());
  }

  function safeSet(raw = {}){
    const out = {};
    Object.entries(raw).forEach(([key, value]) => {
      if(ALLOWED_SET_KEYS.has(key)) out[key] = key === "steps" ? normalizeSteps(value) : value;
    });
    return out;
  }

  function mergeTaskSteps(tasks){
    const seen = new Set();
    const merged = [];
    tasks.forEach(task => {
      (Array.isArray(task.steps) ? task.steps : []).forEach(step => {
        if(!step || step.enabled === false) return;
        const title = String(step.title || "").trim();
        if(!title) return;
        const key = title.toLowerCase();
        if(seen.has(key)) return;
        seen.add(key);
        merged.push({...step, enabled:true});
      });
    });
    return merged;
  }

  function pickCollapseKeeper(tasks, operation = {}){
    const preferred = list(operation.prefer_title_contains_any).map(value => value.toLowerCase());
    const scored = tasks.map(task => {
      const title = String(task.title || "").toLowerCase();
      const preferredScore = preferred.some(part => title.includes(part)) ? 1 : 0;
      const weekly = Number(task.weekly_minutes || task.weeklyMinutes || 0) || 0;
      const estimated = Number(task.estimated_minutes || task.estimatedMinutes || 0) || 0;
      return {task, preferredScore, weekly, estimated};
    });
    scored.sort((a,b) => b.preferredScore-a.preferredScore || b.weekly-a.weekly || b.estimated-a.estimated);
    return scored[0]?.task || tasks[0];
  }

  function weeklyStats(config){
    const weekly = (config.tasks || []).filter(task => task.enabled !== false && String(task.plan_mode || task.planMode || "") === "weekly");
    const categoryCounts = {};
    weekly.forEach(task => {
      const category = String(task.time_category || task.timeCategory || "life");
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    return {weeklyCount:weekly.length, categoryCounts};
  }

  function assertOutcome(config, expect = {}){
    const stats = weeklyStats(config);
    if(expect.weekly_count != null && stats.weeklyCount !== Number(expect.weekly_count)){
      throw new Error(`weekly_count ${stats.weeklyCount} != ${expect.weekly_count}`);
    }
    if(expect.category_counts && typeof expect.category_counts === "object"){
      for(const [category, expected] of Object.entries(expect.category_counts)){
        const actual = stats.categoryCounts[category] || 0;
        if(actual !== Number(expected)) throw new Error(`category ${category} ${actual} != ${expected}`);
      }
    }
    const allowed = new Set(Object.keys(expect.category_counts || {}));
    if(expect.only_expected_categories){
      for(const [category, count] of Object.entries(stats.categoryCounts)){
        if(count && !allowed.has(category)) throw new Error(`unexpected category ${category}: ${count}`);
      }
    }
  }

  function applyLabels(labels){
    if(!labels || typeof labels !== "object" || typeof timeCategoryDefs !== "object") return;
    localStorage.setItem(LABELS_KEY, JSON.stringify(labels));
    Object.entries(labels).forEach(([category, patch]) => {
      const def = timeCategoryDefs[category];
      if(!def || !patch || typeof patch !== "object") return;
      ["name","short","icon"].forEach(key => {
        if(typeof patch[key] === "string" && patch[key].trim()) def[key] = patch[key].trim();
      });
    });
  }

  async function run(payload){
    if(Number(payload.version || 1) !== 1) throw new Error("unsupported version");
    const base = normalizeTaskConfig(loadLocalTaskConfig() || taskConfig || buildDefaultConfig());
    let tasks = (base.tasks || []).map(task => ({...task, steps:Array.isArray(task.steps) ? task.steps.map(step => ({...step})) : task.steps}));
    const retired = new Set(Array.isArray(base.retired_task_codes) ? base.retired_task_codes : []);

    // Removal is idempotent by default: a task that is already gone is considered done.
    // Set required:true only when absence must abort the restructure.
    for(const operation of (Array.isArray(payload.remove) ? payload.remove : [])){
      const matcher = operation?.match && typeof operation.match === "object" ? operation.match : operation;
      let matched = 0;
      tasks = tasks.filter(task => {
        if(!matches(task, matcher)) return true;
        matched++;
        if(task.code) retired.add(String(task.code));
        return false;
      });
      if(operation?.required === true && matched === 0) throw new Error(`required remove matcher found nothing: ${JSON.stringify(matcher)}`);
    }

    // Collapse a whole category/group without depending on private task titles.
    // The keeper preserves its stable id/code/url; all other matched tasks are retired.
    for(const operation of (Array.isArray(payload.collapse) ? payload.collapse : [])){
      if(!operation || typeof operation !== "object") continue;
      const matcher = operation.match || {};
      const matchedTasks = tasks.filter(task => matches(task, matcher));
      const min = operation.min_matches == null ? 1 : Number(operation.min_matches);
      if(matchedTasks.length < min){
        if(operation.required !== false) throw new Error(`collapse matched ${matchedTasks.length}, need >= ${min}: ${JSON.stringify(matcher)}`);
        continue;
      }
      if(matchedTasks.length === 1 && operation.allow_single !== true){
        // Already collapsed: apply the requested final metadata and continue.
      }
      const keeper = pickCollapseKeeper(matchedTasks, operation);
      const keeperId = String(keeper.id || "");
      const mergedSteps = operation.merge_steps === false ? keeper.steps : mergeTaskSteps(matchedTasks);
      const set = safeSet(operation.set || {});
      if(operation.merge_steps !== false && !Object.prototype.hasOwnProperty.call(set, "steps")) set.steps = mergedSteps;

      tasks = tasks.filter(task => {
        if(!matches(task, matcher)) return true;
        if(String(task.id || "") === keeperId) return true;
        if(task.code) retired.add(String(task.code));
        return false;
      });
      const keeperIndex = tasks.findIndex(task => String(task.id || "") === keeperId);
      if(keeperIndex < 0) throw new Error("collapse keeper disappeared");
      tasks[keeperIndex] = {...tasks[keeperIndex], ...set};
    }

    for(const operation of (Array.isArray(payload.update) ? payload.update : [])){
      if(!operation || typeof operation !== "object") continue;
      const matcher = operation.match || {};
      const set = safeSet(operation.set || {});
      const indexes = [];
      tasks.forEach((task, index) => { if(matches(task, matcher)) indexes.push(index); });
      if(!indexes.length){
        if(operation.required !== false) throw new Error(`update matcher found nothing: ${JSON.stringify(matcher)}`);
        continue;
      }
      const targetIndexes = operation.all === true ? indexes : [indexes[0]];
      targetIndexes.forEach(index => { tasks[index] = {...tasks[index], ...set}; });
    }

    const candidate = normalizeTaskConfig({...base, tasks, retired_task_codes:[...retired], updatedAt:new Date().toISOString()});
    assertOutcome(candidate, payload.expect || {});

    const saved = saveLocalTaskConfig(candidate, String(payload.backup_reason || "应用周计划重组前自动备份"));
    applyLabels(payload.labels);
    applyTaskConfig(saved, true);
    if(typeof window.renderWeeklyPlanPanel === "function") window.renderWeeklyPlanPanel();

    if(typeof ghToken === "function" && ghToken() && typeof ghPatchConfig === "function"){
      try{
        await ghPatchConfig(saved);
        if(typeof setGhStatus === "function") setGhStatus("GitHub：已同步", "on");
      }catch(error){
        console.warn("weekly restructure cloud sync failed", error);
        toast("本机已重组成功；云同步暂时失败，可在总控里点“上传本机状态”。", "warn", 6500);
        return;
      }
    }
    toast(String(payload.message || "周计划结构已重组完成。"), "ok", 6200);
  }

  function boot(){
    const rawHash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    if(!rawHash) return;
    const params = new URLSearchParams(rawHash);
    const raw = params.get(PARAM);
    if(!raw) return;

    params.delete(PARAM);
    const remaining = params.toString();
    history.replaceState(null, "", `${location.pathname}${location.search}${remaining ? `#${remaining}` : ""}`);

    let payload;
    try{ payload = decodePayload(raw); }
    catch(error){
      console.error("invalid weekly restructure payload", error);
      toast("周计划重组链接无效；没有修改配置。", "err", 5600);
      return;
    }

    const prompt = String(payload.confirm_message || "将重组周计划任务。修改前会自动备份，最终结构不符合校验时不会保存。确认继续？");
    if(!window.confirm(prompt)){
      toast("已取消周计划重组；没有修改配置。", "warn", 4200);
      return;
    }

    run(payload).catch(error => {
      console.error("weekly restructure failed", error);
      toast(`周计划重组未通过检查：${String(error.message || error)}`, "err", 7800);
    });
  }

  boot();
})();

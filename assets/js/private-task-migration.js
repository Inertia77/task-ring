(() => {
  "use strict";

  const PARAM = "taskPatchV3";
  const LABEL_KEY = "taskring_private_weekly_labels_v1";
  const ALLOWED_SET_FIELDS = new Set([
    "title","cat","days","core","optional","important",
    "time_category","estimated_minutes","weekly_minutes","plan_mode","steps"
  ]);

  function toast(message, type = "ok", duration = 5200){
    if(typeof window.showToast === "function") window.showToast(message, type, duration);
    else console.info(message);
  }

  function decodePayload(raw){
    const normalized = String(raw || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    if(!normalized) throw new Error("迁移参数为空");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text);
    if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("迁移参数格式无效");
    return parsed;
  }

  function normalizeText(value){
    return String(value || "").trim().toLocaleLowerCase("zh-Hans-CN");
  }

  function toStrings(value){
    if(value == null) return [];
    return (Array.isArray(value) ? value : [value]).map(v => String(v || "").trim()).filter(Boolean);
  }

  function taskTimeCategory(task){
    return String(task?.time_category || task?.timeCategory || "");
  }

  function taskPlanMode(task){
    return String(task?.plan_mode || task?.planMode || "");
  }

  function matches(task, matcher = {}){
    if(!task || !matcher || typeof matcher !== "object") return false;
    let hasRule = false;

    const ids = [...toStrings(matcher.id), ...toStrings(matcher.ids)];
    if(ids.length){ hasRule = true; if(!ids.includes(String(task.id || ""))) return false; }

    const titles = [...toStrings(matcher.title), ...toStrings(matcher.titles)];
    if(titles.length){ hasRule = true; if(!titles.includes(String(task.title || "").trim())) return false; }

    const title = normalizeText(task.title);
    const contains = [...toStrings(matcher.title_contains), ...toStrings(matcher.title_contains_any)].map(normalizeText);
    if(contains.length){ hasRule = true; if(!contains.some(fragment => title.includes(fragment))) return false; }

    const excludes = toStrings(matcher.title_not_contains).map(normalizeText);
    if(excludes.length){ hasRule = true; if(excludes.some(fragment => title.includes(fragment))) return false; }

    const cats = [...toStrings(matcher.cat), ...toStrings(matcher.cats)];
    if(cats.length){ hasRule = true; if(!cats.includes(String(task.cat || ""))) return false; }

    const timeCats = [...toStrings(matcher.time_category), ...toStrings(matcher.time_categories)];
    if(timeCats.length){ hasRule = true; if(!timeCats.includes(taskTimeCategory(task))) return false; }

    const modes = [...toStrings(matcher.plan_mode), ...toStrings(matcher.plan_modes)];
    if(modes.length){ hasRule = true; if(!modes.includes(taskPlanMode(task))) return false; }

    return hasRule;
  }

  function weeklyTasks(config){
    return (config.tasks || []).filter(task => task.enabled !== false && taskPlanMode(task) === "weekly");
  }

  function weeklyStats(config){
    const weekly = weeklyTasks(config);
    const categoryCounts = {};
    weekly.forEach(task => {
      const cat = taskTimeCategory(task) || "life";
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    return {weekly_count:weekly.length, category_counts:categoryCounts};
  }

  function statsText(stats){
    const cats = Object.entries(stats.category_counts || {}).map(([k,v]) => `${k}:${v}`).join(", ");
    return `总计 ${stats.weekly_count}；${cats || "无分类"}`;
  }

  function assertStats(config, expected, phase){
    if(!expected || typeof expected !== "object") return;
    const actual = weeklyStats(config);
    if(Number.isFinite(Number(expected.weekly_count)) && actual.weekly_count !== Number(expected.weekly_count)){
      throw new Error(`${phase}总数不符：当前 ${statsText(actual)}；要求 ${expected.weekly_count}`);
    }
    if(expected.category_counts && typeof expected.category_counts === "object"){
      for(const [cat, count] of Object.entries(expected.category_counts)){
        const actualCount = actual.category_counts[cat] || 0;
        if(actualCount !== Number(count)) throw new Error(`${phase}分类不符：${cat} 当前 ${actualCount}，要求 ${count}；${statsText(actual)}`);
      }
    }
  }

  function allowedSet(raw = {}){
    const out = {};
    if(!raw || typeof raw !== "object") return out;
    for(const [key,value] of Object.entries(raw)) if(ALLOWED_SET_FIELDS.has(key)) out[key] = value;
    if(Array.isArray(out.steps)){
      out.steps = out.steps.map((step,index) => {
        if(typeof step === "string") return {id:`migration-step-${index+1}`,title:step.trim(),enabled:true};
        if(!step || typeof step !== "object") return null;
        return {...step,id:String(step.id || `migration-step-${index+1}`),title:String(step.title || `子任务 ${index+1}`),enabled:step.enabled !== false};
      }).filter(step => step && step.title.trim());
    }
    return out;
  }

  function requireMatchCount(found, operation, label){
    if(operation.expect_count == null) return;
    if(found.length !== Number(operation.expect_count)){
      const titles = found.map(({task}) => task.title).join(" / ") || "无";
      throw new Error(`${label}匹配到 ${found.length} 项，要求 ${operation.expect_count} 项；实际：${titles}`);
    }
  }

  function applyRemove(tasks, retired, operations){
    let removed = 0;
    for(const [index,operation] of (operations || []).entries()){
      const found = tasks.map((task,i) => ({task,i})).filter(entry => matches(entry.task, operation.match || operation));
      requireMatchCount(found, operation, `删除规则 ${index+1}`);
      const indices = new Set(found.map(entry => entry.i));
      found.forEach(({task}) => { if(task.code) retired.add(String(task.code)); });
      tasks = tasks.filter((_,i) => !indices.has(i));
      removed += found.length;
    }
    return {tasks,removed};
  }

  function chooseConsolidationTarget(found, select){
    if(!found.length) return null;
    if(select === "max_weekly_minutes"){
      return found.slice().sort((a,b) => Number(b.task.weekly_minutes || 0) - Number(a.task.weekly_minutes || 0))[0];
    }
    if(select === "max_estimated_minutes"){
      return found.slice().sort((a,b) => Number(b.task.estimated_minutes || 0) - Number(a.task.estimated_minutes || 0))[0];
    }
    return found[0];
  }

  function applyConsolidate(tasks, retired, operations){
    let removed = 0, updated = 0;
    for(const [index,operation] of (operations || []).entries()){
      const found = tasks.map((task,i) => ({task,i})).filter(entry => matches(entry.task, operation.match || {}));
      requireMatchCount(found, operation, `合并规则 ${index+1}`);
      if(found.length < 1) throw new Error(`合并规则 ${index+1} 没有匹配任务`);
      const keep = chooseConsolidationTarget(found, operation.select);
      const removeIndices = new Set(found.filter(entry => entry.i !== keep.i).map(entry => entry.i));
      found.filter(entry => entry.i !== keep.i).forEach(({task}) => { if(task.code) retired.add(String(task.code)); });
      const set = allowedSet(operation.set);
      tasks = tasks.map((task,i) => i === keep.i ? {...task,...set} : task).filter((_,i) => !removeIndices.has(i));
      removed += removeIndices.size;
      updated++;
    }
    return {tasks,removed,updated};
  }

  function applyUpdate(tasks, operations){
    let updated = 0;
    for(const [index,operation] of (operations || []).entries()){
      const found = tasks.map((task,i) => ({task,i})).filter(entry => matches(entry.task, operation.match || {}));
      requireMatchCount(found, operation, `更新规则 ${index+1}`);
      if(!found.length){
        if(operation.required !== false) throw new Error(`更新规则 ${index+1} 没有匹配任务`);
        continue;
      }
      const set = allowedSet(operation.set);
      const targets = operation.apply_all === true ? found : [found[0]];
      const indices = new Set(targets.map(entry => entry.i));
      tasks = tasks.map((task,i) => indices.has(i) ? {...task,...set} : task);
      updated += targets.length;
    }
    return {tasks,updated};
  }

  function applyLabels(labels){
    if(!labels || typeof labels !== "object") return;
    localStorage.setItem(LABEL_KEY, JSON.stringify(labels));
    if(typeof timeCategoryDefs !== "object") return;
    for(const [cat,patch] of Object.entries(labels)){
      if(!timeCategoryDefs[cat] || !patch || typeof patch !== "object") continue;
      for(const key of ["name","short","icon"]){
        if(typeof patch[key] === "string" && patch[key].trim()) timeCategoryDefs[cat][key] = patch[key].trim();
      }
    }
  }

  function clearHashParam(params){
    params.delete(PARAM);
    const rest = params.toString();
    history.replaceState(null,"",`${location.pathname}${location.search}${rest ? `#${rest}` : ""}`);
  }

  async function run(){
    const rawHash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    if(!rawHash) return;
    const params = new URLSearchParams(rawHash);
    const encoded = params.get(PARAM);
    if(!encoded) return;

    let recipe;
    try{
      recipe = decodePayload(encoded);
      clearHashParam(params);
    }catch(error){
      console.error("private migration decode failed", error);
      toast(`迁移链接无效：${String(error.message || error)}`,"err",6500);
      return;
    }

    const confirmMessage = String(recipe.confirm_message || "将调整当前周计划结构。系统会先核对现状、自动备份，并在最终结构不符合要求时拒绝保存。确认继续？");
    if(!window.confirm(confirmMessage)){
      toast("已取消；没有修改任何任务。","warn",3600);
      return;
    }

    try{
      const base = normalizeTaskConfig(loadLocalTaskConfig() || taskConfig || buildDefaultConfig());
      assertStats(base, recipe.before, "调整前");
      let tasks = (base.tasks || []).map(task => ({...task,steps:Array.isArray(task.steps) ? task.steps.map(step => ({...step})) : task.steps}));
      const retired = new Set(Array.isArray(base.retired_task_codes) ? base.retired_task_codes : []);

      const removedResult = applyRemove(tasks, retired, recipe.remove);
      tasks = removedResult.tasks;
      const consolidateResult = applyConsolidate(tasks, retired, recipe.consolidate);
      tasks = consolidateResult.tasks;
      const updateResult = applyUpdate(tasks, recipe.update);
      tasks = updateResult.tasks;

      const candidate = normalizeTaskConfig({...base,tasks,retired_task_codes:[...retired],updatedAt:new Date().toISOString()});
      assertStats(candidate, recipe.after, "调整后");

      const saved = saveLocalTaskConfig(candidate, String(recipe.backup_reason || "私人周计划结构调整前自动备份"));
      applyLabels(recipe.labels);
      applyTaskConfig(saved, true);
      if(typeof renderAll === "function") renderAll();

      const summary = `已完成：删除 ${removedResult.removed + consolidateResult.removed} 项，更新 ${consolidateResult.updated + updateResult.updated} 项；${statsText(weeklyStats(saved))}`;
      toast(String(recipe.success_message || summary),"ok",7000);

      if(typeof ghToken === "function" && ghToken() && typeof ghPatchConfig === "function"){
        try{
          if(typeof setGhStatus === "function") setGhStatus("GitHub：保存配置中","sync");
          await ghPatchConfig(saved);
          if(typeof setGhStatus === "function") setGhStatus("GitHub：已同步","on");
          if(typeof ghLog === "function") ghLog("私人周计划结构调整已加密同步到 taskring-config.json");
          toast("新结构已同步到 Gist。","ok",3600);
        }catch(error){
          console.error("private migration cloud sync failed", error);
          if(typeof setGhStatus === "function") setGhStatus("GitHub：配置同步失败","err");
          toast("本机结构已更新，但 Gist 同步失败；可在总控里点“上传本机状态/保存配置”重试。","warn",6500);
        }
      }
    }catch(error){
      console.error("private weekly migration failed", error);
      const detail = String(error.message || error).replace(/\s+/g," ").slice(0,220);
      toast(`未修改：${detail}`,"err",9000);
    }
  }

  run();
})();

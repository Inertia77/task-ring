(() => {
  "use strict";

  // Private config installers accept payloads only from the URL hash, write them into
  // the user's own TaskRing config, then immediately clear the hash. Fragments are not
  // sent in HTTP requests, so personal task names and destinations stay out of this repo
  // and normal server logs.
  const AI_DAILY_PENDING_KEY = "taskring_ai_daily_pending_v1";
  const PRIVATE_TASK_PATCH_PENDING_KEY = "taskring_private_task_patch_pending_v1";
  const PRIVATE_TASK_PATCH_CONFIRM_KEY = "taskring_private_task_patch_confirm_v1";
  const PRIVATE_WEEKLY_LABELS_KEY = "taskring_private_weekly_labels_v1";
  const baseApplyTaskConfigForPrivateInstallers = typeof applyTaskConfig === "function" ? applyTaskConfig : null;
  let aiDailyInstalling = false;
  let privateTaskPatchApplying = false;

  function privateInstallerToast(message, type = "ok", duration = 4200){
    if(typeof window.showToast === "function") window.showToast(message, type, duration);
    else console.info(message);
  }

  function privateJsonRead(storage, key, fallback = null){
    try{
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(_){
      return fallback;
    }
  }

  function applyPrivateWeeklyLabels(labels = privateJsonRead(localStorage, PRIVATE_WEEKLY_LABELS_KEY, {}), rerender = true){
    if(!labels || typeof labels !== "object" || typeof timeCategoryDefs !== "object") return false;
    let changed = false;
    Object.entries(labels).forEach(([category, patch]) => {
      const def = timeCategoryDefs[category];
      if(!def || !patch || typeof patch !== "object") return;
      ["name","short","icon"].forEach(key => {
        if(typeof patch[key] !== "string" || !patch[key].trim()) return;
        const value = patch[key].trim();
        if(def[key] !== value){ def[key] = value; changed = true; }
      });
    });
    if(changed && rerender && typeof window.renderWeeklyPlanPanel === "function") window.renderWeeklyPlanPanel();
    return changed;
  }

  function installAiDailyTask(targetUrl, sourceConfig){
    if(aiDailyInstalling) return false;
    aiDailyInstalling = true;
    try{
      const base = normalizeTaskConfig(sourceConfig || loadLocalTaskConfig() || taskConfig || buildDefaultConfig());
      const canonicalId = "ai-daily-review";
      const canonicalTitle = "AI Daily｜检查今日归档";
      const existingIndex = base.tasks.findIndex(task => task.id === canonicalId || String(task.title || "").trim() === canonicalTitle);
      const existing = existingIndex >= 0 ? base.tasks[existingIndex] : null;
      const task = {
        ...(existing || {}),
        id: existing?.id || canonicalId,
        code: existing?.code || "",
        cat: "life",
        title: canonicalTitle,
        days: [1,2,3,4,5,6,0],
        url: targetUrl,
        core: true,
        optional: false,
        important: true,
        enabled: true,
        time_category: "life",
        estimated_minutes: 30,
        weekly_minutes: 210,
        plan_mode: "daily",
        steps: [
          {id:"ai-daily-life",code:"s01",title:"现实生活总控",enabled:true},
          {id:"ai-daily-create",code:"s02",title:"游戏创作与版本运营",enabled:true},
          {id:"ai-daily-game",code:"s03",title:"游戏实战研究与任务提示",enabled:true},
          {id:"ai-daily-language",code:"s04",title:"语言进阶",enabled:true},
          {id:"ai-daily-knowledge",code:"s05",title:"知识与人类进展",enabled:true}
        ]
      };

      const tasks = base.tasks.slice();
      if(existingIndex >= 0) tasks[existingIndex] = task;
      else tasks.unshift(task);
      const next = normalizeTaskConfig({...base, tasks, updatedAt:new Date().toISOString()});
      const saved = saveLocalTaskConfig(next, "安装 AI Daily 每日入口前自动备份");
      if(baseApplyTaskConfigForPrivateInstallers) baseApplyTaskConfigForPrivateInstallers(saved, true);
      else applyTaskConfig(saved, true);
      sessionStorage.removeItem(AI_DAILY_PENDING_KEY);
      privateInstallerToast("AI Daily 已加入今日执行环：以后点“打开 ↗”直接阅读。", "ok", 5200);
      return true;
    }catch(error){
      console.error("AI Daily private task install failed", error);
      privateInstallerToast("AI Daily 入口写入失败；原任务配置未被覆盖。", "err", 5200);
      return false;
    }finally{
      aiDailyInstalling = false;
    }
  }

  function tryInstallPendingAiDaily(configHint = null){
    if(aiDailyInstalling) return false;
    const targetUrl = sessionStorage.getItem(AI_DAILY_PENDING_KEY) || "";
    if(!targetUrl) return false;
    const localConfig = loadLocalTaskConfig();
    const hasCloudConfigSource = typeof ghToken === "function" && !!ghToken();
    // On a fresh device with cloud sync configured, do not persist the public demo as the
    // user's real config. Wait until ghPull applies the actual local/cloud config first.
    if(!localConfig && hasCloudConfigSource && !configHint) return false;
    return installAiDailyTask(targetUrl, localConfig || configHint || taskConfig || buildDefaultConfig());
  }

  function captureAiDailyTaskFromHash(){
    const rawHash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    if(!rawHash) return;
    const params = new URLSearchParams(rawHash);
    const rawTarget = params.get("aiDaily");
    if(!rawTarget) return;

    let targetUrl = "";
    try{
      const parsed = new URL(rawTarget);
      if(parsed.protocol !== "https:") throw new Error("https required");
      targetUrl = parsed.toString();
    }catch(_){
      privateInstallerToast("AI Daily 入口链接无效，未写入任务。", "err", 4200);
      return;
    }

    params.delete("aiDaily");
    const remainingHash = params.toString();
    history.replaceState(null, "", `${location.pathname}${location.search}${remainingHash ? `#${remainingHash}` : ""}`);
    sessionStorage.setItem(AI_DAILY_PENDING_KEY, targetUrl);
    tryInstallPendingAiDaily();
  }

  function decodeBase64UrlJson(raw){
    const normalized = String(raw || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    if(!normalized) throw new Error("empty payload");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
    const text = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(text);
    if(!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid patch");
    return parsed;
  }

  function stringList(value){
    if(value == null) return [];
    return (Array.isArray(value) ? value : [value]).map(v => String(v || "").trim()).filter(Boolean);
  }

  function privateTaskMatches(task, matcher = {}){
    if(!task || !matcher || typeof matcher !== "object") return false;
    const ids = [...stringList(matcher.id), ...stringList(matcher.ids)];
    const titles = [...stringList(matcher.title), ...stringList(matcher.titles)];
    const hasIdentity = ids.length || titles.length;
    if(hasIdentity){
      const id = String(task.id || "").trim();
      const title = String(task.title || "").trim();
      if(!ids.includes(id) && !titles.includes(title)) return false;
    }
    const categories = [...stringList(matcher.cat), ...stringList(matcher.cats)];
    if(categories.length && !categories.includes(String(task.cat || ""))) return false;
    const timeCategories = [...stringList(matcher.time_category), ...stringList(matcher.time_categories)];
    const taskTime = String(task.time_category || task.timeCategory || "");
    if(timeCategories.length && !timeCategories.includes(taskTime)) return false;
    const planModes = [...stringList(matcher.plan_mode), ...stringList(matcher.plan_modes)];
    const taskMode = String(task.plan_mode || task.planMode || "");
    if(planModes.length && !planModes.includes(taskMode)) return false;
    if(!hasIdentity && !categories.length && !timeCategories.length && !planModes.length) return false;
    return true;
  }

  function normalizePrivatePatchSteps(value){
    if(!Array.isArray(value)) return value;
    return value.map((step, index) => {
      if(typeof step === "string") return {id:`private-step-${index+1}`, title:step.trim(), enabled:true};
      if(!step || typeof step !== "object") return null;
      return {
        ...step,
        id:String(step.id || `private-step-${index+1}`),
        title:String(step.title || `子任务 ${index+1}`),
        enabled:step.enabled !== false
      };
    }).filter(step => step && step.title.trim());
  }

  function privatePatchWeeklyStats(config){
    const weekly = (config.tasks || []).filter(task => task.enabled !== false && String(task.plan_mode || task.planMode || "") === "weekly");
    const categoryCounts = {};
    weekly.forEach(task => {
      const category = String(task.time_category || task.timeCategory || "life");
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    return {weeklyCount:weekly.length, categoryCounts};
  }

  function assertPrivatePatchOutcome(config, assertion = {}){
    if(!assertion || typeof assertion !== "object") return;
    const stats = privatePatchWeeklyStats(config);
    if(Number.isFinite(Number(assertion.weekly_count)) && stats.weeklyCount !== Number(assertion.weekly_count)){
      throw new Error(`weekly_count ${stats.weeklyCount} != ${assertion.weekly_count}`);
    }
    if(assertion.category_counts && typeof assertion.category_counts === "object"){
      Object.entries(assertion.category_counts).forEach(([category, expected]) => {
        const actual = stats.categoryCounts[category] || 0;
        if(actual !== Number(expected)) throw new Error(`category ${category} ${actual} != ${expected}`);
      });
    }
  }

  function applyPrivateTaskPatch(patch, sourceConfig){
    if(privateTaskPatchApplying) return false;
    privateTaskPatchApplying = true;
    try{
      if(Number(patch.version || 1) !== 1) throw new Error("unsupported patch version");
      const base = normalizeTaskConfig(sourceConfig || loadLocalTaskConfig() || taskConfig || buildDefaultConfig());
      let tasks = (base.tasks || []).map(task => ({...task, steps:Array.isArray(task.steps) ? task.steps.map(step => ({...step})) : task.steps}));
      const retired = new Set(Array.isArray(base.retired_task_codes) ? base.retired_task_codes : []);
      let removedCount = 0;
      let updatedCount = 0;

      (Array.isArray(patch.remove) ? patch.remove : []).forEach(spec => {
        const matcher = spec?.match && typeof spec.match === "object" ? spec.match : spec;
        const next = [];
        tasks.forEach(task => {
          if(privateTaskMatches(task, matcher)){
            if(task.code) retired.add(String(task.code));
            removedCount++;
          }else next.push(task);
        });
        tasks = next;
      });

      (Array.isArray(patch.update) ? patch.update : []).forEach(operation => {
        if(!operation || typeof operation !== "object") return;
        const matcher = operation.match || {};
        const index = tasks.findIndex(task => privateTaskMatches(task, matcher));
        if(index < 0){
          if(operation.required !== false) throw new Error(`required task not found: ${JSON.stringify(matcher)}`);
          return;
        }
        const rawSet = operation.set && typeof operation.set === "object" ? operation.set : {};
        const set = {};
        // Private patches may reshape planning metadata, but never change stable IDs/codes,
        // private destinations, enabled state, or other unrelated config fields.
        ["title","cat","days","core","optional","important","time_category","estimated_minutes","weekly_minutes","plan_mode","steps"].forEach(key => {
          if(Object.prototype.hasOwnProperty.call(rawSet, key)) set[key] = rawSet[key];
        });
        if(Object.prototype.hasOwnProperty.call(set, "steps")) set.steps = normalizePrivatePatchSteps(set.steps);
        tasks[index] = {...tasks[index], ...set};
        updatedCount++;
      });

      if(patch.expect && typeof patch.expect === "object"){
        if(Number.isFinite(Number(patch.expect.removed_count)) && removedCount !== Number(patch.expect.removed_count)){
          throw new Error(`removed_count ${removedCount} != ${patch.expect.removed_count}`);
        }
        if(Number.isFinite(Number(patch.expect.updated_count)) && updatedCount !== Number(patch.expect.updated_count)){
          throw new Error(`updated_count ${updatedCount} != ${patch.expect.updated_count}`);
        }
      }

      const candidate = normalizeTaskConfig({
        ...base,
        tasks,
        retired_task_codes:[...retired],
        updatedAt:new Date().toISOString()
      });
      assertPrivatePatchOutcome(candidate, patch.expect || {});

      const saved = saveLocalTaskConfig(candidate, String(patch.backup_reason || "应用私人任务结构调整前自动备份"));
      if(patch.labels && typeof patch.labels === "object"){
        localStorage.setItem(PRIVATE_WEEKLY_LABELS_KEY, JSON.stringify(patch.labels));
        applyPrivateWeeklyLabels(patch.labels, false);
      }
      if(baseApplyTaskConfigForPrivateInstallers) baseApplyTaskConfigForPrivateInstallers(saved, true);
      else applyTaskConfig(saved, true);
      if(typeof window.renderWeeklyPlanPanel === "function") window.renderWeeklyPlanPanel();
      sessionStorage.removeItem(PRIVATE_TASK_PATCH_PENDING_KEY);
      sessionStorage.removeItem(PRIVATE_TASK_PATCH_CONFIRM_KEY);
      privateInstallerToast(String(patch.message || "周计划结构已更新。"), "ok", 5600);

      // Let the normal conflict-aware Gist pull reconcile and upload the new local config.
      // This avoids bypassing TaskRing's safety layer or overwriting a newer cloud edit.
      if(typeof ghToken === "function" && ghToken() && typeof ghPull === "function"){
        setTimeout(() => {
          try{ ghPull(); }
          catch(error){ console.warn("private task patch cloud reconciliation skipped", error); }
        }, 1600);
      }
      return true;
    }catch(error){
      console.error("TaskRing private task patch failed", error);
      privateInstallerToast("任务结构调整未通过安全检查；原配置已保留。", "err", 6200);
      return false;
    }finally{
      privateTaskPatchApplying = false;
    }
  }

  function tryApplyPendingPrivateTaskPatch(configHint = null){
    if(privateTaskPatchApplying) return false;
    const patch = privateJsonRead(sessionStorage, PRIVATE_TASK_PATCH_PENDING_KEY, null);
    if(!patch) return false;
    const localConfig = loadLocalTaskConfig();
    const hasCloudConfigSource = typeof ghToken === "function" && !!ghToken();
    if(!localConfig && hasCloudConfigSource && !configHint) return false;
    const patchId = String(patch.id || "private-task-patch");
    if(sessionStorage.getItem(PRIVATE_TASK_PATCH_CONFIRM_KEY) !== patchId){
      const prompt = String(patch.confirm_message || "将调整当前 TaskRing 的私人任务结构。系统会先做备份，并在结果不符合安全断言时拒绝保存。确认继续？");
      if(!window.confirm(prompt)){
        sessionStorage.removeItem(PRIVATE_TASK_PATCH_PENDING_KEY);
        privateInstallerToast("已取消任务结构调整；没有修改任何配置。", "warn", 4200);
        return false;
      }
      sessionStorage.setItem(PRIVATE_TASK_PATCH_CONFIRM_KEY, patchId);
    }
    return applyPrivateTaskPatch(patch, localConfig || configHint || taskConfig || buildDefaultConfig());
  }

  function capturePrivateTaskPatchFromHash(){
    const rawHash = location.hash.startsWith("#") ? location.hash.slice(1) : "";
    if(!rawHash) return;
    const params = new URLSearchParams(rawHash);
    const encoded = params.get("taskPatch");
    if(!encoded) return;
    try{
      const patch = decodeBase64UrlJson(encoded);
      sessionStorage.setItem(PRIVATE_TASK_PATCH_PENDING_KEY, JSON.stringify(patch));
      params.delete("taskPatch");
      const remainingHash = params.toString();
      history.replaceState(null, "", `${location.pathname}${location.search}${remainingHash ? `#${remainingHash}` : ""}`);
      tryApplyPendingPrivateTaskPatch();
    }catch(error){
      console.error("invalid private task patch payload", error);
      privateInstallerToast("任务结构调整链接无效，未修改任何配置。", "err", 5200);
    }
  }

  // ghPull may still be waiting on the network when this script runs. Hook future config
  // applications so a fresh device installs pending private changes only after real data arrives.
  if(baseApplyTaskConfigForPrivateInstallers){
    applyTaskConfig = function(config, shouldRender = false){
      const result = baseApplyTaskConfigForPrivateInstallers(config, shouldRender);
      if(!aiDailyInstalling) tryInstallPendingAiDaily(config);
      if(!privateTaskPatchApplying) tryApplyPendingPrivateTaskPatch(config);
      return result;
    };
  }

  applyPrivateWeeklyLabels(undefined, false);
  captureAiDailyTaskFromHash();
  capturePrivateTaskPatchFromHash();
  tryInstallPendingAiDaily();
  tryApplyPendingPrivateTaskPatch();
  if(typeof window.renderWeeklyPlanPanel === "function") window.renderWeeklyPlanPanel();

  // The game board is an execution surface: entering it should always start from the real
  // current day. Manual weekday browsing still works while the user stays in the board.
  function resetGameQuestToToday(rerender = false){
    if(typeof today === "undefined" || typeof gameQuestSelectedDay === "undefined") return false;
    const currentDay = Number(today);
    if(!Number.isFinite(currentDay)) return false;
    const changed = Number(gameQuestSelectedDay) !== currentDay;
    gameQuestSelectedDay = currentDay;
    try{
      if(typeof GH_PREFIX !== "undefined") localStorage.setItem(`${GH_PREFIX}gamequest_selected_day_v1`, String(currentDay));
    }catch(_){}
    if(rerender && typeof window.renderGameQuestPanel === "function") window.renderGameQuestPanel();
    return changed;
  }

  // product-ui restores the last manually viewed weekday before this script runs. Normalize
  // that initial state back to today, and repaint immediately if the app reopens on GAME.
  resetGameQuestToToday(document.body?.dataset?.appView === "game");
  document.addEventListener("click", event => {
    const target = event.target instanceof Element ? event.target.closest('[data-view-target="game"]') : null;
    if(!target) return;
    // Capture phase runs before app.js stops propagation on dock navigation.
    resetGameQuestToToday(true);
  }, true);

  // Keep the base UI modules stable and load optional UX refinements after the main renderer has booted.
  if(!document.querySelector('script[data-taskring-ux-efficiency]')){
    const uxScript = document.createElement("script");
    uxScript.src = "assets/js/ux-efficiency.js?v=20260825.2";
    uxScript.dataset.taskringUxEfficiency = "1";
    document.body.appendChild(uxScript);
  }

  const installButton = document.getElementById("controlInstallAppBtn");
  const installLabel = document.getElementById("pwaInstallLabel");
  const installHint = document.getElementById("pwaInstallHint");
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;

  let installPrompt = null;
  let updateRegistration = null;
  let reloadingForUpdate = false;

  function toast(message, type = "ok", duration = 2600){
    if(typeof window.showToast === "function"){
      window.showToast(message, type, duration);
      return;
    }
    console.info(message);
  }

  function setInstallAction(mode){
    if(!installButton) return;
    installButton.hidden = false;
    installButton.dataset.pwaMode = mode;

    if(mode === "update"){
      installLabel.textContent = "更新 TaskRing";
      installHint.textContent = "点此应用新版本";
      installButton.querySelector(".controlUtilityIcon").textContent = "↻";
      return;
    }

    installLabel.textContent = "安装 TaskRing";
    installHint.textContent = isIos ? "添加到 iPhone 主屏幕" : "添加到手机桌面";
    installButton.querySelector(".controlUtilityIcon").textContent = "＋";
  }

  function hideInstallAction(){
    if(installButton) installButton.hidden = true;
  }

  function offerUpdate(registration){
    updateRegistration = registration;
    setInstallAction("update");
    toast("TaskRing 有新版本，可在“总控”中更新。", "ok", 4200);
  }

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    if(!updateRegistration) setInstallAction("install");
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if(!updateRegistration) hideInstallAction();
    toast("TaskRing 已安装到这台设备。", "ok", 3600);
  });

  installButton?.addEventListener("click", async () => {
    if(updateRegistration?.waiting){
      updateRegistration.waiting.postMessage({type:"SKIP_WAITING"});
      return;
    }

    if(installPrompt){
      const prompt = installPrompt;
      installPrompt = null;
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if(choice.outcome !== "accepted" && !updateRegistration) hideInstallAction();
      return;
    }

    if(isIos){
      toast("在 Safari 中点“分享”，再选择“添加到主屏幕”。", "warn", 6500);
      return;
    }

    toast("请用 Chrome 或 Edge 打开页面，然后从浏览器菜单选择“安装应用”。", "warn", 6000);
  });

  window.addEventListener("offline", () => {
    toast("当前已离线，本机任务仍可继续使用。", "warn", 4200);
  });

  window.addEventListener("online", () => {
    toast("网络已恢复，可以继续同步。", "ok", 3000);
  });

  if(isIos && !isStandalone) setInstallAction("install");

  if(!("serviceWorker" in navigator) || location.protocol === "file:"){
    if(!isIos) hideInstallAction();
    return;
  }

  window.addEventListener("load", async () => {
    try{
      const registration = await navigator.serviceWorker.register("./service-worker.js");

      if(registration.waiting && navigator.serviceWorker.controller){
        offerUpdate(registration);
      }

      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if(worker.state === "installed" && navigator.serviceWorker.controller){
            offerUpdate(registration);
          }
        });
      });

      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if(reloadingForUpdate) return;
        reloadingForUpdate = true;
        location.reload();
      });
    }catch(error){
      console.warn("TaskRing PWA registration failed", error);
    }
  });
})();

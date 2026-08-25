(() => {
  "use strict";

  // One-time private task installer. The target URL is accepted only from the URL hash,
  // written into the user's own TaskRing config, then removed from the address bar.
  // This keeps personal destinations out of the public repository and server logs.
  function installAiDailyTaskFromHash(){
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
      if(typeof window.showToast === "function") window.showToast("AI Daily 入口链接无效，未写入任务。", "err", 4200);
      return;
    }

    // Remove the private payload before doing any other work. URL fragments are not sent
    // in HTTP requests, and replaceState also keeps it out of copy/paste history afterwards.
    params.delete("aiDaily");
    const remainingHash = params.toString();
    history.replaceState(null, "", `${location.pathname}${location.search}${remainingHash ? `#${remainingHash}` : ""}`);

    try{
      const base = normalizeTaskConfig(loadLocalTaskConfig() || taskConfig || buildDefaultConfig());
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
      applyTaskConfig(saved, true);

      if(typeof window.showToast === "function"){
        window.showToast("AI Daily 已加入今日执行环：以后点“打开 ↗”直接阅读。", "ok", 5200);
      }
    }catch(error){
      console.error("AI Daily private task install failed", error);
      if(typeof window.showToast === "function") window.showToast("AI Daily 入口写入失败；原任务配置未被覆盖。", "err", 5200);
    }
  }

  installAiDailyTaskFromHash();

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

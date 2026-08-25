(() => {
  "use strict";

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

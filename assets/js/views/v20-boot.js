// v20 boot: view overrides load after app.js, so rerender once.
(function(){
  window.TaskRingV20={version:"v20",boot(){
    // View override scripts load after app.js; repaint once so their renderers take effect.
    // Title/version text is owned by index.html — do not override it here.
    try{renderAll();}
    catch(err){console.warn("TaskRing v20 boot warning",err)}
  }};
  window.TaskRingV20.boot();
})();

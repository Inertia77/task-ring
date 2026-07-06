// v20 boot: view overrides load after app.js, so rerender once.
(function(){
  window.TaskRingV20={version:"v20",boot(){
    try{document.title="TASK RING｜INERTIA CLOUD QUEST v20";const badge=[...document.querySelectorAll(".inertiaVersionBadge")].find(x=>/GIT MODE/.test(x.textContent||""));if(badge)badge.textContent="GIT MODE · v20";renderAll();}
    catch(err){console.warn("TaskRing v20 boot warning",err)}
  }};
  window.TaskRingV20.boot();
})();

// Final UX polish that must run after the v21 weekly/game renderers.
(function(){
  const qs=(selector,root=document)=>root.querySelector(selector);
  const qsa=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const setText=(selector,text,root=document)=>{
    const el=qs(selector,root);
    if(el)el.textContent=text;
  };

  function polishStaticCopy(){
    document.title="TASK RING | CLOUD QUEST";
    setText(".inertiaOwnerBadge","CLOUD TASK SYSTEM");
    setText(".inertiaVersionBadge","CLOUD SYNC");
    setText(".inertiaTitleEn","CLOUD QUEST");
    setText(
      ".inertiaSubtitle",
      "本机优先，云端同步：今日执行、周计划、游戏作战、时间账本与资料库保持清晰分区。"
    );

    setText(".lockBadge","INERTIA CLOUD GATE");
    setText(".lockSub","本机已上锁。输入解锁码后继续进入任务环。");
    setText(
      ".lockFoot",
      "这是本地浏览器软锁，用来防止路人误入；不是服务器安全认证。"
    );

    setText(".dailyReminder .dailyTitle","外部日程");
    setText(
      ".dailyReminder .dailyText",
      "Calendar / To-Do 只用于外部日程与清单确认，不并入每日资料任务。"
    );

    const guide=qs(".guideGrid");
    if(guide&&!guide.dataset.motivationPolished){
      guide.dataset.motivationPolished="1";
      guide.innerHTML=[
        ["EN","Keep the ring moving. Small clean wins compound."],
        ["日本語","今日の一手を、静かに積み上げる。"],
        ["FR","Avance net, respire, puis reprends la main."],
        ["ES","Hazlo claro, hazlo hoy, sigue ligero."],
        ["IT","Un passo preciso vale più del rumore."],
        ["古汉语","慎始敬终，寸进亦功。"]
      ].map(([lang,quote])=>`<div class="card quoteCard"><h2>${lang}</h2><p>${quote}</p></div>`).join("");
    }

    const footer=qs(".footer");
    if(footer)footer.textContent="TASK RING | Local first. Cloud synced when you choose.";
  }

  function polishWeeklyPanel(){
    const panel=document.getElementById("weeklyPlanPanel");
    if(!panel)return;

    qsa(".weeklySubtasks",panel).forEach(details=>{
      details.open=false;
    });

    const hero=qs(".weeklyCommandHero",panel);
    const stats=hero?.querySelector(":scope > .weeklyHeroStats");
    if(hero&&stats&&!stats.closest(".weeklyStatsDrawer")){
      const drawer=document.createElement("details");
      drawer.className="weeklyStatsDrawer";
      drawer.innerHTML='<summary><span>本周统计</span><b>展开</b></summary>';
      stats.replaceWith(drawer);
      drawer.appendChild(stats);
    }

    const ribbon=qs(".weeklyShell > .allocationRibbon",panel);
    if(ribbon&&!ribbon.closest(".weeklyAllocationDrawer")){
      const drawer=document.createElement("details");
      drawer.className="weeklyAllocationDrawer";
      drawer.innerHTML='<summary><span>分类统计</span><b>展开</b></summary>';
      ribbon.replaceWith(drawer);
      drawer.appendChild(ribbon);
    }
  }

  function polishGameQuestPanel(){
    const panel=document.getElementById("gameQuestPanel");
    if(!panel)return;
    setText(
      ".gameQuestTopTitle em",
      "今日清单与本周作战池分区推进，计时统一进入时间账本。",
      panel
    );
    const stripText=qs(".gameQuestDailyPane .gameQuestMetaStrip span",panel);
    if(stripText)stripText.textContent="按星期清理：体力、签到、活动与阶段任务";
    const weekText=qs(".gameQuestWeeklyPane .gameQuestMetaStrip span",panel);
    if(weekText)weekText.textContent="周常 / 深渊危局 / 本周只需完成一次的游戏任务";
  }

  function polishTimeDetailModal(){
    const modal=document.getElementById("timeDetailModal");
    if(!modal)return;
    qsa(".timeDetailStats span",modal).forEach(el=>{
      const text=el.textContent.trim();
      if(text.includes("莉")||text.includes("今"))el.textContent="今日";
      if(text.includes("譛")||text.includes("本"))el.textContent="本周";
      if(text.includes("累")||text.includes("邏"))el.textContent="累计";
    });
    const progressLabel=qs(".timeDetailProgress span",modal);
    if(progressLabel)progressLabel.textContent="本周目标";
    qsa("[data-time-log-delete]",modal).forEach(btn=>{btn.textContent="删除";});
    qsa(".timeDetailLogs .empty span",modal).forEach(el=>{el.textContent="本周还没有计时记录";});
  }

  function runPolish(){
    polishStaticCopy();
    polishWeeklyPanel();
    polishGameQuestPanel();
    polishTimeDetailModal();
  }

  const originalWeeklyRenderer=window.renderWeeklyPlanPanel;
  if(typeof originalWeeklyRenderer==="function"){
    window.renderWeeklyPlanPanel=function(...args){
      const result=originalWeeklyRenderer.apply(this,args);
      polishWeeklyPanel();
      return result;
    };
  }

  const originalGameRenderer=window.renderGameQuestPanel;
  if(typeof originalGameRenderer==="function"){
    window.renderGameQuestPanel=function(...args){
      const result=originalGameRenderer.apply(this,args);
      polishGameQuestPanel();
      return result;
    };
  }

  const originalOpenTimeDetail=window.openTimeDetailModal;
  if(typeof originalOpenTimeDetail==="function"){
    window.openTimeDetailModal=function(...args){
      const result=originalOpenTimeDetail.apply(this,args);
      polishTimeDetailModal();
      return result;
    };
  }

  window.TaskRingUxPolish={
    polishStaticCopy,
    polishWeeklyPanel,
    polishGameQuestPanel,
    polishTimeDetailModal,
    runPolish
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(runPolish,0));
  }else{
    setTimeout(runPolish,0);
  }
})();

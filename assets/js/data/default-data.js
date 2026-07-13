// Privacy-safe public demo data.
// 这里只维护用于展示 TaskRing 功能的通用示例，不得放入真实个人任务、私人链接或账号资料。

const days=[
  {id:1,name:"月"},{id:2,name:"火"},{id:3,name:"水"},
  {id:4,name:"木"},{id:5,name:"金"},{id:6,name:"土"},{id:0,name:"日"}
];

const defaultBlocks=[
  {
    id:"demo-morning-start",
    cat:"life",
    title:"晨间启动（演示）",
    days:[1,2,3,4,5,6,0],
    url:"",
    core:1,
    plan_mode:"daily",
    time_category:"life",
    estimated_minutes:20,
    weekly_minutes:120
  },
  {
    id:"demo-home-reset",
    cat:"life",
    title:"居家整理（演示）",
    days:[1,3,5],
    url:"",
    optional:1,
    plan_mode:"daily",
    time_category:"life",
    estimated_minutes:25,
    weekly_minutes:60
  },
  {
    id:"demo-weekly-review",
    cat:"life",
    title:"每周复盘与下周计划（演示）",
    days:[0],
    url:"",
    important:1,
    plan_mode:"weekly",
    time_category:"life",
    estimated_minutes:45,
    weekly_minutes:45
  },
  {
    id:"demo-creator-session",
    cat:"gamecreate",
    title:"创作推进（演示）",
    days:[2,4,6],
    url:"https://example.com/",
    important:1,
    plan_mode:"daily",
    time_category:"create",
    estimated_minutes:60,
    weekly_minutes:180
  },
  {
    id:"demo-game-daily",
    cat:"gamecreate",
    title:"示例游戏日常（演示）",
    days:[1,2,3,4,5,6,0],
    url:"",
    core:1,
    plan_mode:"daily",
    time_category:"game",
    estimated_minutes:30,
    weekly_minutes:180
  },
  {
    id:"demo-game-weekly",
    cat:"gamecreate",
    title:"示例游戏周目标（演示）",
    days:[6],
    url:"",
    plan_mode:"weekly",
    time_category:"game",
    estimated_minutes:90,
    weekly_minutes:120
  },
  {
    id:"demo-language-practice",
    cat:"language",
    title:"语言练习（演示）",
    days:[1,2,3,4,5],
    url:"https://www.wikipedia.org/",
    important:1,
    plan_mode:"daily",
    time_category:"language",
    estimated_minutes:30,
    weekly_minutes:150
  },
  {
    id:"demo-reading-notes",
    cat:"language",
    title:"阅读与笔记（演示）",
    days:[3,0],
    url:"",
    plan_mode:"daily",
    time_category:"science",
    estimated_minutes:40,
    weekly_minutes:80
  },
  {
    id:"demo-tech-learning",
    cat:"language",
    title:"Web 技术学习（演示）",
    days:[6],
    url:"https://developer.mozilla.org/",
    optional:1,
    plan_mode:"weekly",
    time_category:"it",
    estimated_minutes:60,
    weekly_minutes:90
  }
];

const defaultStepTasks={
  "demo-morning-start":[
    {id:"demo-water",title:"补充水分"},
    {id:"demo-plan",title:"确认今日重点"},
    {id:"demo-desk",title:"整理工作区"}
  ],
  "demo-game-daily":[
    {id:"demo-signin",title:"每日签到"},
    {id:"demo-energy",title:"清理体力"},
    {id:"demo-mission",title:"完成每日任务"}
  ],
  "demo-creator-session":[
    {id:"demo-outline",title:"确认本次目标"},
    {id:"demo-create",title:"完成一个可交付成果"},
    {id:"demo-review",title:"记录下一步"}
  ]
};

const defaultRefGroups=[
  {
    id:"demo-getting-started",
    title:"开始使用",
    enabled:true,
    items:[
      {id:"demo-help",title:"TaskRing 功能演示说明",url:"",enabled:true},
      {id:"demo-example-link",title:"示例公开链接",url:"https://example.com/",enabled:true},
      {id:"demo-note",title:"无链接资料也可以作为普通备注",url:"",enabled:true}
    ]
  },
  {
    id:"demo-learning",
    title:"公开学习资料",
    enabled:true,
    items:[
      {id:"demo-mdn",title:"MDN Web Docs",url:"https://developer.mozilla.org/",enabled:true},
      {id:"demo-wikipedia",title:"Wikipedia",url:"https://www.wikipedia.org/",enabled:true}
    ]
  },
  {
    id:"demo-tools",
    title:"公开工具入口",
    enabled:true,
    items:[
      {id:"demo-calendar",title:"Google Calendar",url:"https://calendar.google.com/",enabled:true},
      {id:"demo-todo",title:"Microsoft To Do",url:"https://to-do.office.com/tasks/",enabled:true}
    ]
  },
  {
    id:"demo-archive",
    title:"归档示例",
    enabled:true,
    items:[
      {id:"demo-archive-note",title:"这里可以放不常用但需要保留的入口",url:"",enabled:true}
    ]
  }
];

const defaultGameQuestConfig={
  version:1,
  updatedAt:"",
  games:[
    {id:"demo-game-a",name:"示例游戏 A",short:"游戏 A",icon:"A",accent:"cyan",enabled:true},
    {id:"demo-game-b",name:"示例游戏 B",short:"游戏 B",icon:"B",accent:"amber",enabled:true},
    {id:"demo-game-c",name:"示例游戏 C",short:"游戏 C",icon:"C",accent:"violet",enabled:true}
  ],
  schedule:{
    "1":{
      "demo-game-a":["每日签到","体力清理"],
      "demo-game-b":["每日任务"],
      "demo-game-c":["资源收集"]
    },
    "2":{
      "demo-game-a":["每日签到"],
      "demo-game-b":["每日任务","活动检查"],
      "demo-game-c":["资源收集"]
    },
    "3":{
      "demo-game-a":["体力清理"],
      "demo-game-b":["每日任务"],
      "demo-game-c":["资源收集","周中检查"]
    },
    "4":{
      "demo-game-a":["每日签到"],
      "demo-game-b":["每日任务"],
      "demo-game-c":["资源收集"]
    },
    "5":{
      "demo-game-a":["体力清理"],
      "demo-game-b":["每日任务","活动检查"],
      "demo-game-c":["资源收集"]
    },
    "6":{
      "demo-game-a":["每日签到","周任务整理"],
      "demo-game-b":["每日任务"],
      "demo-game-c":["资源收集"]
    },
    "0":{
      "demo-game-a":["体力清理"],
      "demo-game-b":["每日任务","周任务整理"],
      "demo-game-c":["资源收集","下周准备"]
    }
  },
  weekly:{
    "demo-game-a":["完成一个周挑战","检查活动期限"],
    "demo-game-b":["完成周任务"],
    "demo-game-c":["整理本周资源"]
  }
};

// 训练饮食分区的公开演示配置。仅使用通用示例，不包含任何用户真实训练、身体或饮食数据。
const defaultFitnessConfig={
  version:1,
  updatedAt:"",
  days:{
    "1":{training:["示例：全身基础训练 30 分钟"],nutrition:["示例：准备均衡三餐","示例：完成饮水检查"]},
    "2":{training:["示例：轻有氧与活动度 30 分钟"],nutrition:["示例：每餐加入蔬菜"]},
    "3":{training:["示例：下肢基础训练 30 分钟"],nutrition:["示例：训练后安排常规正餐"]},
    "4":{training:["示例：恢复拉伸 20 分钟"],nutrition:["示例：按计划准备次日餐食"]},
    "5":{training:["示例：上肢基础训练 30 分钟"],nutrition:["示例：完成饮水检查"]},
    "6":{training:["示例：户外步行或轻有氧"],nutrition:["示例：保持正常用餐节奏"]},
    "0":{training:["示例：休息与恢复检查"],nutrition:["示例：规划下周通用餐食"]}
  }
};

// 完成演出使用的本地静态资源，不含用户配置或私人信息。
const RANDOM_CUTIN_CHARACTERS = [
  {key:"richie",name:"Richie",title:"RICHIE POP",sub:"行动节点已确认",img:"assets/images/cutins/cutin-richie.png",accent:"#ff8ec9"},
  {key:"nanally",name:"Nanally",title:"NANALLY SNAP",sub:"任务清单已推进",img:"assets/images/cutins/cutin-nanally.png",accent:"#cf4035"},
  {key:"chiz",name:"Chiz",title:"CHIZ CHECK",sub:"执行结果已入账",img:"assets/images/cutins/cutin-chiz.png",accent:"#d7ad16"},
  {key:"cyrene",name:"Cyrene",title:"CYRENE BLOOM",sub:"完成信号已同步",img:"assets/images/cutins/cutin-cyrene.png",accent:"#c65aa6"},
  {key:"castorice",name:"Castorice",title:"CASTORICE WING",sub:"阶段目标已完成",img:"assets/images/cutins/cutin-castorice.png",accent:"#7655a5"},
  {key:"cantarella",name:"Cantarella",title:"CANTARELLA DREAM",sub:"任务状态已更新",img:"assets/images/cutins/cutin-cantarella.png",accent:"#7c62a8"},
  {key:"changli",name:"Changli",title:"CHANGLI FLAME",sub:"策略节点已落子",img:"assets/images/cutins/cutin-changli.png",accent:"#c74b32"},
  {key:"phoebe",name:"Phoebe",title:"PHOEBE LUX",sub:"目标进度已确认",img:"assets/images/cutins/cutin-phoebe.png",accent:"#c49b25"},
  {key:"ellen",name:"Ellen Joe",title:"ELLEN SLASH",sub:"清理动作已完成",img:"assets/images/cutins/cutin-ellen.png",accent:"#36435e"},
  {key:"arlecchino",name:"Arlecchino",title:"FATHER DECREE",sub:"指令执行完毕",img:"assets/images/cutins/cutin-arlecchino.png",accent:"#a72732"},
  {key:"camellya",name:"Camellya",title:"CAMELLYA BLOOM",sub:"推进节点已完成",img:"assets/images/cutins/cutin-camellya.png",accent:"#b9324e"},
  {key:"burnice",name:"Burnice",title:"BURNICE NITRO",sub:"行动热量已结算",img:"assets/images/cutins/cutin-burnice.png",accent:"#d16b22"},
  {key:"roccia",name:"Roccia",title:"ROCCIA STAGE",sub:"本轮演出已收束",img:"assets/images/cutins/cutin-roccia.png",accent:"#3e3a51"},
  {key:"cartethyia",name:"Cartethyia",title:"CARTETHYIA GALE",sub:"作战目标已清除",img:"assets/images/cutins/cutin-cartethyia.png",accent:"#b3333c"},
  {key:"yixuan",name:"Yixuan",title:"YIXUAN INK",sub:"执行回路已闭合",img:"assets/images/cutins/cutin-yixuan.png",accent:"#263743"},
  {key:"astra",name:"Astra Yao",title:"ASTRA SPOTLIGHT",sub:"完成信号已点亮",img:"assets/images/cutins/cutin-astra.png",accent:"#9a5d98"}
];

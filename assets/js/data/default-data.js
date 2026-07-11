// Static default data extracted from the old single-file index.html.
// 任务、参考链接、随机完成演出角色，都从这里维护。

const days=[{id:1,name:"月"},{id:2,name:"火"},{id:3,name:"水"},{id:4,name:"木"},{id:5,name:"金"},{id:6,name:"土"},{id:0,name:"日"}];

const defaultBlocks=[
{id:"base-body",cat:"life",title:"*体食顔姿*",days:[1,2,3,4,5,6,0],url:"https://app.notion.com/p/3335adb3775e802eb9d3d0e08e888bfe",core:1},
{id:"life-chores",cat:"life",title:"*生活雑務*（可选）",days:[1,2,3],url:"https://www.notion.so/3335adb3775e80829167d154910e2ba5",optional:1},
{id:"plan-trip",cat:"life",title:"Plan 出かけ/旅（可选）",days:[4,5],url:"https://www.notion.so/3335adb3775e809e8a08d9ed44a712ce",optional:1},
{id:"econ-strategy",cat:"life",title:"経済の$戦略$管理$執行",days:[6,0],url:"https://docs.google.com/spreadsheets/d/1yKZ5a1cRNF8L4VvcX2Rlu18TTxh5GaM_0MhSzKyO9yw/edit?gid=654071664#gid=654071664",important:1},
{id:"creator-work",cat:"gamecreate",title:"クリエイターワーク",days:[1,2,3,4,5,6,0],url:"https://app.notion.com/p/3335adb3775e8043970fe14aa8fc2d77",important:1},
{id:"ww-weekly",cat:"gamecreate",title:"鸣潮 周常",days:[1]},
{id:"zzz-weekly",cat:"gamecreate",title:"绝区零 周常",days:[2]},
{id:"hsr-weekly",cat:"gamecreate",title:"崩铁 周常",days:[3]},
{id:"exilium-weekly",cat:"gamecreate",title:"异环 周常",days:[4]},
{id:"endfield-weekly",cat:"gamecreate",title:"终末地 周常",days:[5]},
{id:"zzz-endgame",cat:"gamecreate",title:"绝 式舆/危局 ➡️ 鏖战/临界",days:[6],url:"https://act.hoyolab.com/app/zzz-game-record/index.html?hyl_presentation_style=fullscreen&utm_campaign=battlechronicle&utm_id=8&utm_medium=tools&utm_source=hoyolab&lang=ja-jp&bbs_theme=light&bbs_theme_device=1#/zzz",important:1},
{id:"ww-endgame",cat:"gamecreate",title:"鸣 深塔/海墟 ➡️ 全息/矩阵",days:[0],important:1},
{id:"game-daily",cat:"gamecreate",title:"游戏日常",days:[1,2,3,4,5,6,0],core:1},
{id:"task-gu",cat:"gamecreate",title:"Task(G/U)（可选）",days:[1,2,3,4],url:"https://docs.google.com/spreadsheets/d/1n--FtlOewF6sqbYrXm3pxvVAiOljOWGM3vuDBL78s3c/edit?gid=568018786#gid=568018786",optional:1},
{id:"game-info",cat:"gamecreate",title:"游戏资讯整理",days:[5],url:"https://www.notion.so/Info-AI-3335adb3775e8099be17f0234cc01153"},
{id:"analyze-character",cat:"gamecreate",title:"Analyze_Character",days:[6,0],url:"https://docs.google.com/spreadsheets/d/1n--FtlOewF6sqbYrXm3pxvVAiOljOWGM3vuDBL78s3c/edit?gid=1803995989#gid=1803995989"},
{id:"french",cat:"language",title:"La Langue Française",days:[1,2,3,4,5,6,0],url:"https://docs.google.com/spreadsheets/d/1yealrF3KlyS_2OAzYdGAo_O6ifJIK5l0M1K2_BZ9e-8/edit?gid=1220912483#gid=1220912483",important:1},
{id:"english",cat:"language",title:"English",days:[1],url:"https://docs.google.com/spreadsheets/d/1yealrF3KlyS_2OAzYdGAo_O6ifJIK5l0M1K2_BZ9e-8/edit?gid=1220912483#gid=1220912483"},
{id:"japanese",cat:"language",title:"日本語",days:[2],url:"https://docs.google.com/spreadsheets/d/1yealrF3KlyS_2OAzYdGAo_O6ifJIK5l0M1K2_BZ9e-8/edit?gid=1220912483#gid=1220912483"},
{id:"it-tech",cat:"language",title:"IT&技术（可选）",days:[3],url:"https://docs.google.com/spreadsheets/d/1yealrF3KlyS_2OAzYdGAo_O6ifJIK5l0M1K2_BZ9e-8/edit?gid=1501399326#gid=1501399326",optional:1},
{id:"math-science",cat:"language",title:"数学&自然科学（可选）",days:[4],url:"https://docs.google.com/spreadsheets/d/1yealrF3KlyS_2OAzYdGAo_O6ifJIK5l0M1K2_BZ9e-8/edit?gid=1796228574#gid=1796228574",optional:1},
{id:"spanish",cat:"language",title:"El Español",days:[5,6,0],url:"https://docs.google.com/spreadsheets/d/1yealrF3KlyS_2OAzYdGAo_O6ifJIK5l0M1K2_BZ9e-8/edit?gid=1220912483#gid=1220912483"}
];

const defaultStepTasks={"base-body":[{id:"sport",title:"体育"},{id:"skincare",title:"护肤"},{id:"sleep",title:"睡眠"}],"game-daily":[{id:"app-signin",title:"APP签到"},{id:"ww",title:"鸣潮"},{id:"zzz",title:"绝区零"},{id:"hsr",title:"崩铁"},{id:"endfield",title:"终末地"},{id:"exilium",title:"异环"}]};

const defaultRefGroups=[
  {id:"irregular",title:"不定期执行",enabled:true,items:[
    {id:"onsen",title:"♨ 温泉",url:"",enabled:true},
    {id:"massage",title:"Massage",url:"",enabled:true},
    {id:"femme-sex",title:"Femme&Sex",url:"https://www.notion.so/FFEMMES-21a5adb3775e80968b12c8c5d49f099e",enabled:true},
    {id:"inertia-1",title:"INERTIA【1】整理",url:"https://docs.google.com/spreadsheets/d/18azCCIFNnTxG8WSAqt0_sWBCCRN0MOnl3BLry1Ksk2k/edit?gid=399063841#gid=399063841",enabled:true},
    {id:"analyze-party",title:"Analyze_Party",url:"https://docs.google.com/spreadsheets/d/1n--FtlOewF6sqbYrXm3pxvVAiOljOWGM3vuDBL78s3c/edit?gid=1620273436#gid=1620273436",enabled:true},
    {id:"life-plan-chatgpt",title:"人生规划谈话（ChatGPT）",url:"https://chatgpt.com/c/6a05f229-2a64-83a4-9284-64b95943595d",enabled:true}
  ]},
  {id:"monthly",title:"MOIS / 月度",enabled:true,items:[
    {id:"life-admin",title:"生活雑務管理",url:"https://www.notion.so/3335adb3775e80bf864dc08fe7ec4d90",enabled:true},
    {id:"econ-admin",title:"経済雑務管理",url:"https://www.notion.so/3335adb3775e80338306dc606f9f2d1f",enabled:true}
  ]},
  {id:"yearly",title:"AN / 年度",enabled:true,items:[
    {id:"yearly-placeholder",title:"年度任务入口：暂未设置链接",url:"",enabled:true}
  ]},
  {id:"aux",title:"辅助入口",enabled:true,items:[
    {id:"taskring-html",title:"任务环HTML（辅助用）",url:"https://drive.google.com/drive/folders/1JU4TttQNilzFJdL3WpCppTscHqqHP-Nx",enabled:true}
  ]}
];


const defaultGameQuestConfig={
  version:1,
  updatedAt:"",
  games:[
    {id:"ww",name:"鸣潮",short:"鸣潮",icon:"WW",accent:"cyan",enabled:true},
    {id:"zzz",name:"绝区零",short:"绝区零",icon:"ZZ",accent:"amber",enabled:true},
    {id:"hsr",name:"崩坏：星穹铁道",short:"崩铁",icon:"SR",accent:"violet",enabled:true},
    {id:"endfield",name:"终末地",short:"终末地",icon:"EF",accent:"blue",enabled:true},
    {id:"exilium",name:"异环",short:"异环",icon:"EX",accent:"rose",enabled:true}
  ],
  schedule:{
    "1":{ww:["日常体力","周常清理"],zzz:["日常 / 咖啡 / 刮刮乐"],hsr:["日常委托"],endfield:["资料关注"],exilium:["资讯关注"]},
    "2":{ww:["日常体力"],zzz:["日常","绝区零周常"],hsr:["日常委托"],endfield:["资料关注"],exilium:["资讯关注"]},
    "3":{ww:["日常体力"],zzz:["日常"],hsr:["日常委托","崩铁周常"],endfield:["资料关注"],exilium:["资讯关注"]},
    "4":{ww:["日常体力"],zzz:["日常"],hsr:["日常委托"],endfield:["资料关注"],exilium:["异环周常 / 资讯"]},
    "5":{ww:["日常体力"],zzz:["日常"],hsr:["日常委托"],endfield:["终末地周常 / 资讯"],exilium:["资讯关注"]},
    "6":{ww:["日常体力"],zzz:["日常","式舆/危局/鏖战"],hsr:["日常委托"],endfield:["资料关注"],exilium:["资讯关注"]},
    "0":{ww:["日常体力","深塔/海墟/全息"],zzz:["日常"],hsr:["日常委托","模拟宇宙/末日/虚构检查"],endfield:["资料关注"],exilium:["资讯关注"]}
  }
};

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

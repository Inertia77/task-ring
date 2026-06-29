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

const RANDOM_CUTIN_CHARACTERS = [{"key":"richie","title":"RICHIE POP","name":"Richie","sub":"粉发怪兽系乱入","tail":"urban chaos / cute bite","a1":"#ff8ec9","a2":"#6bdcff","particles":["✦","◆","✧","♡","✺","⚡"],"bg":"pink","img":"assets/images/cutins/cutin-richie.png"},{"key":"nanally","title":"NANALLY SNAP","name":"Nanally","sub":"红心玩偶突击","tail":"plush energy / go!","a1":"#ff4f6d","a2":"#ffd45e","particles":["♡","✦","★","✿","◆","♪"],"bg":"red","img":"assets/images/cutins/cutin-nanally.png"},{"key":"chiz","title":"CHIZ CHECK","name":"Chiz","sub":"软萌账本结算","tail":"coin trick / focus +1","a1":"#ffc857","a2":"#ff8ec9","particles":["¥","✦","◆","✧","%","★"],"bg":"gold","img":"assets/images/cutins/cutin-chiz.png"},{"key":"cyrene","title":"CYRENE BLOOM","name":"Cyrene","sub":"粉晶花海展开","tail":"memory blossom / +1","a1":"#ff8edb","a2":"#8cc8ff","particles":["✿","❀","✦","♡","✧","✺"],"bg":"pink","img":"assets/images/cutins/cutin-cyrene.png"},{"key":"castorice","title":"CASTORICE WING","name":"Castorice","sub":"冥蝶低空掠过","tail":"butterfly / rebirth","a1":"#9d7cff","a2":"#3d2a6e","particles":["🦋","✦","◇","✧","☽","◎"],"bg":"violet","img":"assets/images/cutins/cutin-castorice.png"},{"key":"cantarella","title":"CANTARELLA DREAM","name":"Cantarella","sub":"紫雾梦境开幕","tail":"illusion / poison lace","a1":"#b28cff","a2":"#6bdcff","particles":["✦","☽","◇","✧","❀","◎"],"bg":"violet","img":"assets/images/cutins/cutin-cantarella.png"},{"key":"changli","title":"CHANGLI FLAME","name":"Changli","sub":"赤伞烈焰落子","tail":"strategy / fusion fire","a1":"#ff4b3f","a2":"#ffb84f","particles":["🔥","✦","◆","✧","❀","⚡"],"bg":"red","img":"assets/images/cutins/cutin-changli.png"},{"key":"phoebe","title":"PHOEBE LUX","name":"Phoebe","sub":"圣光金羽加护","tail":"grace / luminous order","a1":"#ffe27a","a2":"#5ccfff","particles":["✦","◇","✧","☼","❖","★"],"bg":"gold","img":"assets/images/cutins/cutin-phoebe.png"},{"key":"ellen","title":"ELLEN SLASH","name":"Ellen Joe","sub":"鲨鱼女仆速切","tail":"ice slash / clean done","a1":"#26304c","a2":"#ff4668","particles":["✦","✧","◇","✕","◆","❄"],"bg":"dark","img":"assets/images/cutins/cutin-ellen.png"},{"key":"arlecchino","title":"FATHER DECREE","name":"Arlecchino","sub":"黑红处刑令下达","tail":"crimson contract","a1":"#d71932","a2":"#f2f2f2","particles":["✦","✧","◇","✕","♢","◆"],"bg":"red","img":"assets/images/cutins/cutin-arlecchino.png"},{"key":"camellya","title":"CAMELLYA BLOOM","name":"Camellya","sub":"赤花缠斗绽放","tail":"havoc bloom / thrill","a1":"#d81745","a2":"#7ed3c7","particles":["✿","❀","✦","✧","◆","♡"],"bg":"rose","img":"assets/images/cutins/cutin-camellya.png"},{"key":"burnice","title":"BURNICE NITRO","name":"Burnice","sub":"硝燃调酒点火","tail":"nitro fuel / fire up","a1":"#ff7a2f","a2":"#ffd95e","particles":["🔥","✦","★","⚡","◆","♡"],"bg":"orange","img":"assets/images/cutins/cutin-burnice.png"},{"key":"roccia","title":"ROCCIA STAGE","name":"Roccia","sub":"剧场箱庭登场","tail":"stage prop / encore","a1":"#1f1f2f","a2":"#ff4c66","particles":["✦","✧","🎭","◆","★","◎"],"bg":"dark","img":"assets/images/cutins/cutin-roccia.png"},{"key":"cartethyia","title":"CARTETHYIA GALE","name":"Cartethyia","sub":"白红剑影破潮","tail":"gale blade / oath","a1":"#f8f8ff","a2":"#d71932","particles":["✦","◇","✧","⚔","◆","❄"],"bg":"red","img":"assets/images/cutins/cutin-cartethyia.png"},{"key":"yixuan","title":"YIXUAN INK","name":"Yixuan","sub":"玄墨宗师出手","tail":"ink rupture / master","a1":"#151b25","a2":"#35d8ff","particles":["墨","✦","◇","✧","◎","◆"],"bg":"ink","img":"assets/images/cutins/cutin-yixuan.png"},{"key":"astra","title":"ASTRA SPOTLIGHT","name":"Astra Yao","sub":"舞台聚光应援","tail":"star singer / encore","a1":"#ff8ec9","a2":"#9b7cff","particles":["♪","✦","♡","★","✧","♫"],"bg":"pink","img":"assets/images/cutins/cutin-astra.png"}];

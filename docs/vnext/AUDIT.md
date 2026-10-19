# TaskRing vNext 双端 UI/UX 实施审计

基线：main `ecb411c94998dcb8bd434458b45f2cc6e8e90ab8`（PR #42）。本轮从最新 main 创建功能分支。正式构建标记 `20261019.6`。

## 审计边界与证据

正式站在独立浏览器中确认可达，停在本机软锁。未使用用户 Token、Gist 配置或 Supabase 会话，也未进入用户私人状态。可复现截图使用与正式站基线一致的源码、相同的隔离配置，在修改前后运行真实 Chromium。11 个宽度：320、360、390、430、700、768、820、1024、1280、1440、1920px；高度 900px，另有 390×700 浮动层验收。截图采用中文字体，不包含用户真实数据。

测试数据覆盖：12 个每日/周计划任务（含停用、子任务、AI），六游各自的必做/可选及四类周常，生活改善演示配置、两组资料。云端页面采用测试 transport：没有请求或修改生产 Supabase。

证据目录按 `before/宽度-界面.png`、`after/宽度-界面.png` 保存；主要页面、全周矩阵、周常、云端登录、账本子页、资料搜索、总控和四类编辑器有对照截图。额外截图覆盖已登录云端模拟、断网与领取窗口。图库明确区分本地隔离数据与正式站验证。

## 实际加载及覆盖关系

| 界面 | 最终渲染 | 主要 DOM / 生效样式 | 事件 / UI 状态来源 |
|---|---|---|---|
| 每日：待执行/今日/全周 | product-ui 的 renderMobileCards/renderMobileTabs；renderTable 清空旧表 | dailyCard、dailyGroup、weekMatrix；daily→responsive→daily-density→ui-icon→ai-tasks | app setDone/setStepDone；本机周期状态、disclosure、viewMode |
| 周计划 | product-ui renderWeeklyPlanPanel；AI 卡由 ai-tasks 提供 | weeklyMissionCard / weeklyMissionGroup；weekly→mobile-weekly→zone-identity→lane-density→ai-tasks | 分类、周目标、计时；product-ui disclosure；ux-efficiency 分类偏好 |
| 生活改善 | fitness-view renderFitnessPanel | fitnessHero / fitnessItem / fitnessLane；fitness→responsive→life-guide | fitness-view 委托；配置及既有周期完成键 |
| 游戏 | game-ops-v6 renderGameQuestPanel | gameQuestV6 / gqV6LaneTab / gqV6TaskBtn；game-ops-v6→game-weekly-flow | v6 委托；board/lane/mobile_focus 本机偏好；原状态键 |
| 限时・周期 | game-ops-cloud html/render | opsCard / opsDeadline；game-ops-cloud→game-weekly-flow | 云端原 transport；本轮只更改呈现与文案 |
| 时间账本 | time-ledger-view renderTimePanel | timeBudgetRow / timeTaskRow / timeSubTabs；time→responsive→后置视觉层 | app 时间函数；既有日志、计时器、搜索、历史周次 |
| 资料库 | product-ui renderReferenceLibrary/filterLibrary | refGroup / libraryToolbar；library→library-density→ui-icon | 搜索本机偏好；disclosure；最近分组 |
| 任务编辑器 | editor-ux renderTaskEditor | cfgTaskV20 / editorScopeTabs；editors→responsive→ai-tasks | 同一 DOM 全量草稿；筛选只更新可见性 |
| 游戏/生活/资料编辑器 | v6 / fitness-view / app | 各自 Modal 和编辑字段 | 本页草稿 session；显式保存；刷新离开保护 |
| 总控/弹窗 | app + product-ui 焦点协调 | controlCenterMenu、各 Modal；components/editors/responsive | Escape/Tab；wrap inert；触发点恢复 |
| 后置增强 | pwa 动态加载 ux-efficiency，再加载 private-restructure | 动作菜单/快捷键等 | MutationObserver；保留既有迁移路径 |

## 已实施问题清单

| 严重度 | 模块 / 原问题 | 根因与实际修复 | 修改位置 | 验证 / 状态 |
|---|---|---|---|---|
| 高 | 任务编辑器切范围丢改动 | 原范围按钮重建保存配置；改为所有任务持续存在于同一 DOM，筛选/搜索仅控制可见性 | editor-ux.js | 名称、Prompt、隐藏项、新增、复制、删除、再次筛选、保存重载：已修复 |
| 高 | 隐藏任务、停用项保存不完整风险 | 旧范围产生部分渲染；现全量草稿保存，保留退休 Code 与原配置元数据 | editor-ux.js、app collectEditorConfig | 全量保存、停用项和身份检查：已修复 |
| 高 | 子任务改名时身份被重建 | 收集器按标题生成 ID；现在保留原活动子项 ID/Code，并保留停用子项 | app editorRowToTask | stable-step-id 保存重载断言：已修复 |
| 高 | 四类编辑器关闭后重开覆盖草稿 | open 每次重新加载配置；新增仅在本页内存保留的编辑 session；无变更正常重开，有变更继续草稿，beforeunload 防刷新丢失 | app、editor-ux、fitness-view | 四编辑器逐一 Escape→重开：已修复 |
| 高 | PWA 安装/更新打断编辑 | controllerchange 无条件 reload；首次接管不刷新，更新发现未保存编辑时延后刷新 | pwa.js | 真实 Service Worker 两版本缓存升级、草稿仍在：已修复 |
| 中 | 总控及周目标 Escape 不一致 | 旧 Escape 分支遗漏；纳入统一可见弹窗识别 | product-ui.js | Escape、Tab/Shift+Tab、触发点恢复：已修复 |
| 中 | 弹窗焦点路径受打开/关闭方式影响 | 原依赖点击后定时器；新增可见弹窗协调，背景 inert，保留原表单标注 | product-ui.js | 总控与编辑器测试：已修复 |
| 中 | 资料搜索污染折叠偏好 | 自动 open 触发异步 toggle，写回长期偏好；快照搜索前状态并跟踪程序触发 toggle；忽略已脱离 DOM 的事件 | product-ui.js | 搜索→命中展开→清空→偏好不变：已修复 |
| 中 | 全站重绘影响焦点与无关模块 | 高频勾选无差别 renderAll；增加可选范围，仅更新关联模块；必要全绘按稳定属性恢复焦点与选择范围 | app、fitness-view、v6 | 资料 DOM 身份保持、搜索焦点和文本保持：已修复 |
| 中 | 手机完成游戏后跳到其他游戏 | 默认焦点每次重新寻找首个未完成游戏；首次操作固定当前 lane 的可见游戏偏好 | game-ops-v6.js | 完成/撤销仍落在原游戏：已修复 |
| 中 | 周计划首个可见分类不展开 | 用完整分类数组 index 判断，前部空分类影响 index；先筛出实际有任务的分类 | product-ui.js | 首个有效分类展开：已修复 |
| 中 | 桌面周计划样式治理误指旧 DOM | lane-density 使用旧 weeklyTaskCard；去掉该局部失效规则，针对 weeklyMissionGroup/Grid 做桌面分栏 | lane-density.css | 1050px 以上双列、单分组多列：已修复 |
| 中 | 手机头部占高、状态不易见 | 多行品牌/日期占高，状态被隐藏；合并为单行品牌、总控与真实同步状态 | responsive.css | 320–700px 截图与溢出检查：已修复 |
| 中 | 每日/周计划按钮、元信息小 | 多层 density 留下 10px 功能文字；既有文件内提升关键文字、保留 44px 高频触控区 | daily-density、mobile-weekly、game-weekly-flow | 窄屏、字体放大与截图：已修复 |
| 中 | 生活改善卡片偏高、小按钮难点 | 顶部描述重复，任务行最小高度和附加按钮尺寸失衡；压缩描述，保持主文可读，增加备注/链接触控区 | life-guide.css | 勾选/撤销、窄屏：已修复 |
| 中 | 全周矩阵窄屏滚动不明显 | 820px 以上矩阵无明确指引；加入滚动提示、保留可聚焦滚动区与固定任务列 | product-ui、daily-density | 矩阵各尺寸无页面级溢出：已修复 |
| 中 | 时间总览分类只有图标 | 标签仅用 category glyph；恢复文字标签并正确隔离图标固定宽度 | time-ledger-view、time.css | 截图及断点检查：已修复 |
| 中 | 平板任务账四列拥挤 | 桌面最小列宽延伸至中尺寸；701–1049px 使用名称/数值及独立操作行 | time.css | 768/820/1024px 与三个子页：已修复 |
| 中 | 资料库桌面单列、长标题截断 | 历史密度样式限制；1050px 双列分组、标题换行、44px 打开动作 | library-density-polish.css | 搜索、清空、长标题及双端：已修复 |
| 中 | 期限/领取窗口辨认成本高 | 截止与其他元信息接近；突出截止，显示基于现有期限的剩余时间，区分仍可领取和待核验 | game-ops-cloud.js/css | 模拟有/无期限、领取、失败、离线：已修复 |
| 中 | 浮动计时器可能挡最后任务 | 底栏与浮动层占用空间未完全预留；有计时器时增加尾部空间，编辑时隐藏背景计时器 | responsive.css | 390×700 保存按钮与底栏几何检查：已修复 |
| 低 | 动画/高对比度环境 | 补齐全局 reduced-motion 与 forced-colors 降级 | base.css | 测试使用 reduce；保留正常完成动画：已修复 |

## 设计与 CSS 决策

保留黄黑品牌、六模块配色、卡片边轨、图标、完成演出以及手机底栏。每个模块保留自己的结构；没有统一改造成同一种卡片。压缩重复统计、默认概览与多行头部；周计划总览默认收起但尊重已有折叠偏好。电脑利用两列分类、资料分组和时间分类对照，单分类任务仍可多列。

main.css 保持 32 个导入文件，没有新增末尾“更强 !important”样式层。新增规则进入对应已有文件；删除经过 DOM 核查的旧周计划 lane 规则，移除云端样式中覆盖全局游戏 Tab 的微型字号补丁。其余历史样式仍有兼容用途，未进行风险较高的整库删除。本轮没有声称消除了所有历史覆盖。

## 测试与人工检查

- Node 25 个既有测试通过，包含三方同步、tombstone、AI 完成和云端操作模拟。
- JavaScript 全量 `node --check`、仓库完整性、SDK 可重建检查、`git diff --check`。
- Playwright：11 个全宽度用例、4 个云端模拟宽度、4 个细分页/长文字用例、无关 DOM/数据保护、浮动层、同步状态模拟、6 个交互用例、PWA 升级、双端关键界面截图，加上无修改保存的完整字段不变断言，共每引擎 32 项。
- 本地 Chromium 与 WebKit 的完整测试结果及 CI 最终状态见工程交付记录。
- 人工逐图检查：390px 六模块首屏、1440px 多列、320px 极窄屏、全周矩阵、四类编辑器和云端期限卡。发现时间标签固定宽度导致竖排后，已将图标与文字容器拆开修正。
- 同步 UI 测试直接模拟已有状态函数，未真实向 Gist 发起上传；Supabase 测试替换 SDK transport，外部 HTTPS 全部拦截。

## 数据安全核查

未改动默认任务数据文件、任务重置与统计算法、integrity-core.js、data-integrity.js、加密常量、Gist endpoint/Token 存储或 Supabase schema/policy。没有 SQL、生产 API 写入、生产导入、生产状态勾选和生产时间记录。

增加的状态仅为本机 UI 偏好和当前页编辑 session；未新增私人 Prompt 明文持久化。保存沿用原备份/加密同步通道。身份修复与全量草稿防止 UI 保存意外改变隐藏项、Code 和子任务关联。

验证以源码 diff、原数据行为测试和隔离浏览器回读为证据。由于未读取用户私人 Gist/生产 Supabase，不能宣称完成生产数据逐行前后 checksum；本轮未访问它们的写入通道。

## 尚存边界

1. 真实 iPhone Safari、Android 系统键盘及系统文字放大未在硬件上验收；WebKit/Chromium 窄屏、短视口和文本放大为模拟。
2. 草稿跨弹窗关闭保留于当前页面；刷新/关闭页签会触发浏览器离开保护。浏览器崩溃或强制杀进程无法恢复这份内存草稿。避免另存私人明文是本轮的保守选择。
3. 大部分历史 CSS 仍保留，后续逐模块维护时再继续合并。没有为视觉重构迁移框架或数据模型。
4. 正式站只能在公共/隔离浏览器状态下验收；用户实际私人配置下的全部特殊长内容仍可能有未覆盖组合。

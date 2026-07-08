# TASK RING 结构说明（维护指南）

这个项目是**纯静态页面**：无需 Vite / React / npm，打开快、部署稳、GitHub Pages 直接能跑。
拆分的重点是把「页面骨架 / 样式 / 数据 / 逻辑 / 图片资源」分开，别再退回单文件 `index.html`。

## 顶层目录

```text
task-ring/
├─ index.html                 # 页面骨架：DOM、meta、图标、CSS/JS 引用（不写大段 style/script）
├─ assets/
│  ├─ css/                     # 分层样式，见下「CSS 分层」
│  ├─ js/
│  │  ├─ data/default-data.js  # 默认数据层
│  │  ├─ app.js                # 运行逻辑层（渲染 / 状态 / 同步 / 编辑器 / 动画）
│  │  └─ views/                # v20/v21 拆出的分区渲染 + 启动覆盖，见下
│  ├─ images/{css,cutins}/     # 真实图片资源（不要再塞 base64），清单见 docs/ASSET_MANIFEST.json
│  └─ icons/favicon.{svg,png}  # 站点图标
├─ docs/                       # 文档：本文件、CHANGELOG、各版本笔记、配置样例、资产清单
├─ .gitignore
└─ .nojekyll                   # 让 GitHub Pages 原样发布静态资源
```

## CSS 分层（`assets/css/main.css` 按顺序 @import）

后加载的层覆盖先加载的层。历史上每次大改都是「新加一层覆盖」而不是回头改旧层，
所以后面的层 `!important` 较多。改样式时**先确认目标选择器最终由哪一层决定**再动手。

| 顺序 | 文件 | 职责 |
| --- | --- | --- |
| 1 | `00-foundation.css` | 设计变量（:root）、全局 reset、基础布局 |
| 2 | `10-task-ui.css` | 任务表格 / 卡片 / 链接 / 步骤 chip / 完成提示 |
| 3 | `20-cutin-avatars.css` | 角色头像、完成 cut-in 演出 |
| 4 | `30-world-visuals.css` | 大背景、世界观视觉系统 |
| 5 | `90-overrides.css` | INERTIA 版综合覆盖层（体量最大） |
| 6 | `95-v20-polish.css` | v20 微调，并 @import `views/*.css` |
| 7 | `96-v21-clarity.css` | v21 收敛：高对比、白底卡片、周计划池分任务 |
| 8 | `97-royal-anime.css` | v22 皇家二次元最终皮肤 |
| 9 | `98-atelier-gate.css` | 收尾层：锁屏背景/门卫头像、`prefers-reduced-motion` |

> 想整体换皮肤或回退：优先动最后几层（97/98）和 `main.css` 末尾的 import，尽量别拆旧层。

## JS 分层

### `assets/js/data/default-data.js`（默认数据层）
先改这里：`days`、`defaultBlocks`、`defaultStepTasks`、`defaultRefGroups`、
`defaultGameQuestConfig`、`RANDOM_CUTIN_CHARACTERS`。

### `assets/js/app.js`（运行逻辑层）
渲染、任务状态、日期/周期、软锁、GitHub/Gist 同步、加密配置、时间账本、三个编辑器、完成动画。
配置 schema 由 `buildDefaultConfig()` / `normalizeTaskConfig()` 定义（当前 `version: 4`），
样例见 `docs/taskring-config.example.json`。

### `assets/js/views/`（分区覆盖，加载在 `app.js` 之后）
- `weekly-view.js` / `time-ledger-view.js` / `game-view.js` / `editor-ux.js`：分区渲染与交互。
- `v20-boot.js`：视图覆盖脚本加载完后重渲染一次。
- `v21-boot.js`：安装 v21 版 `renderWeeklyPlanPanel`（周计划池分任务），再重渲染。
- 这些 boot 脚本**不再覆盖页面标题/版本号**——标题由 `index.html` 统一管理。

## 数据与同步要点

- **软锁进门**：SHA-256 哈希软锁（`SOFT_LOCK_HASH`），只防路人误入，不是服务器级鉴权。改密码见根目录 README。
- **Gist 同步**：`taskring-state.json` 存勾选/时间日志；`taskring-config.json` 存加密后的任务/资料库/游戏配置。
  Token 只保存在本机 `localStorage`，没有 Token 也能本机离线使用。
- **游戏作战区**：状态复用 `taskring-state.json` 的 key 前缀；一周配置合并进 `taskring-config.json` 的 `gameQuest`。

## 推荐开发节奏

1. 先改数据，不动逻辑。
2. 再改样式，尽量在最后几层做小修，别回头拆旧层。
3. 逻辑继续膨胀时，再考虑把 `app.js` 拆成 `render.js` / `storage.js` / `sync-github.js` / `editor.js`。

传统静态页能解决的事，就先别召唤 npm 魔王。🛠️

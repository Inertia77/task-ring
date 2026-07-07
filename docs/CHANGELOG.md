# TASK RING 变更历史（CHANGELOG）

按版本从新到旧整理。每条只记「做了什么 / 为什么」，细节实现看对应文件。
早期还保留了单独的版本笔记（`V16_…` ~ `V22_…`），本文件是它们的汇总索引。

---

## 维护 · 2026-07-07（图标回退 + 收尾优化）

- **图标统一**：把浏览器标签图标 `favicon.svg` 回退为「盾牌 + 闪电 + 对勾」设计（commit `94d8ee5`）；
  页头品牌标志 `.inertiaHeroMark` 内联同款图标，替换掉旧主题遗留的发光闪电彗星图标。
- **修复标题版本号**：`v20-boot.js` / `v21-boot.js` 之前会在加载后把 `document.title` 覆盖成 “…v21”，
  导致标签页显示的版本号与 `index.html` 的 v22 不一致。现移除标题/徽章覆盖，标题由 `index.html` 统一管理。
- **安全**：`app.js` 里软锁哈希旁的注释曾直接写出明文解锁码，静态站点公开后等于泄露。已改为不含明文的提示。
- **图库归位**（不删除，重新安排用途，见 `ASSET_MANIFEST.json`）：
  - `background-collage.png` → 锁屏「星城之门」全屏背景。
  - `vivian-portrait.png` → 锁屏卡片顶部「门卫」圆形头像。
  - `favicon.png` → apple-touch-icon（iOS 主屏）与 og:image 分享缩略图。
- **可访问性**：新增最终覆盖层 `98-atelier-gate.css`，支持系统「减少动态效果」（`prefers-reduced-motion`）。
- **元信息**：`index.html` 补充 `description` 与 Open Graph / Twitter 分享标签。
- **文档**：修正 README 解锁码说明（`taskring2026`），`taskring-config.example.json` 升到 v4，
  刷新 `STRUCTURE.md` 与 `ASSET_MANIFEST.json`。

## v22 · Royal Anime Atelier（详见 `V22_ROYAL_ANIME_DESIGN.md`）

- 明亮二次元 + 皇家精致风：珍珠白底、星冠金、淡紫蓝、细金线、徽章式按钮，紧密排版。
- 新增最终覆盖层 `97-royal-anime.css`，`main.css` 末尾追加导入，方便整体回退。
- 覆盖全局背景 / header / 导航 dock / 各分区 / 弹窗 / 锁屏 / toast / 浮动计时器。
- （注：该版本曾把 favicon 改成珍珠底星冠图标，已于 2026-07-07 按需求回退为盾牌闪电图标。）

## v21 · Clarity Pass（详见 `V21_CLARITY_PASS.md`）

- 收敛视觉：深色主按钮、白底卡片 + 单一蓝色主色，减少彩虹渐变噪声。
- 周计划池恢复分任务显示，分任务状态按「周」保存（key 后缀 `_w`）。
- 修复 Italiano / Italian 被 `it` 关键字误判成 IT/AI 的问题。
- 逻辑落在 `assets/js/views/v21-boot.js`（覆盖 `renderWeeklyPlanPanel`）与 `96-v21-clarity.css`。

## v20 · UI/UX Refactor（详见 `V20_UI_UX_REFACTOR.md`）

- 把各分区渲染拆到独立文件：`views/weekly-view.js`、`time-ledger-view.js`、`game-view.js`、`editor-ux.js`，
  在 `app.js` 之后加载并覆盖对应渲染函数（`v20-boot.js` 收尾重渲染一次）。
- 周目标改为「按钮 + 确认弹窗」，避免内联输入框误触。
- 任务编辑器改折叠卡片 + 搜索 / 筛选 / 停用库。
- 新增 `assets/css/views/*.css` 与 `95-v20-polish.css`。

## v18 · 游戏作战区拆分（详见 `V18_GAMEQUEST_WEEKLY_POOL.md`）

- 游戏作战区内部拆成「今日清理」与「本周作战池」，但不混入普通周计划池。
- 编辑入口：总控 → 游戏任务编辑器。

## v16 · 今日执行环 + 周计划池（详见 `V16_WEEKLY_PLAN_POOL.md`）

- 任务分两层：今日执行环（daily / scheduled）与周计划池（weekly）。
- 任务新增 `plan_mode`、`estimated_minutes`、`weekly_minutes` 字段。

## v13 · Time Budget Ring

- 任务行支持开始计时，显示「本周已用 / 每周目标」；点周时长徽章看本周明细。
- 任务编辑器新增「每周目标分钟」，随 `taskring-config.json` 加密同步。
- 游戏作战区顶部整体计时按钮记为 `gamequest-board`。
- 历史计时进入 Gist 同步；正在运行的计时器仍仅存本机。

## v11.0 · Time Budget / Focus Timer

- 主任务卡支持开始计时 / 暂停 / 继续 / 完成并记录 / 放弃。
- 计时数据默认存本机：`taskring_time_active_v1`（当前计时）、`taskring_time_logs_v1`（历史时长）。
- 任务编辑器新增「时间分类」「预计分钟」。

## v10.9 · 游戏作战区

- 新增位于主任务环上方的游戏作战区，可按星期编辑一周游戏任务。
- 游戏任务配置合并进 `taskring-config.json`（加密同步），完成状态复用 `taskring-state.json`。

## v10.8 · 手机端任务卡与状态短码

- 手机端任务卡：第一行分类 / 状态 / 属性，第二行任务名。
- 状态短码：保 / 重 / 选 / 延 / 锁 / 补 / 旧 / 忽。

## 更早

- `caa2f76` 进入逻辑改为哈希软锁，废除用 Gist 当锁。
- `3fea796` 把原始单文件 `index.html` 拆成 HTML / CSS / JS / 图片资源的可维护结构。

# TaskRing

TaskRing 是一套本地优先的个人任务指挥中心，包含今日任务、周计划池、子任务、游戏作战区、时间账本、资料库、配置编辑器、本地软锁与可选的跨设备同步。项目使用纯静态 HTML、CSS 和 JavaScript，不依赖构建工具或大型前端框架。

> 公开仓库只保留隐私安全的演示数据。个人任务、私人链接、同步凭据和本机备份不得提交到公开仓库。

## 启动

可以直接双击根目录的 `index.html`。

建议通过本地 HTTP 服务运行，以获得更一致的浏览器行为：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8000/
```

指定日期调试：

```text
http://127.0.0.1:8000/?date=2026-07-08
```

页面会显示指定日期，并提供“返回今天”。

## 默认演示数据

`assets/js/data/default-data.js` 仅用于首次访问和没有本机配置时展示产品功能，内容应始终保持为通用 Demo：

- 不包含真实个人任务、习惯、计划或日程；
- 不包含私人 Notion、Google Drive、Google Sheets、聊天记录等链接；
- 不包含真实游戏进度、账号信息或个人资料库；
- 只使用通用名称、公开网站和无链接示例条目。

用户通过编辑器保存的个人配置仅存在于其本机浏览器或其自行配置的同步存储中，不应回写到公开默认数据文件。

## 页面与状态恢复

- 今日任务默认作为第一视觉重点；分类和子任务展开状态保存在本机。
- 周计划分类筛选和 Accordion 状态可在当前使用过程中恢复。
- 游戏日期、今日/本周模式、当前游戏和本周筛选会恢复。
- 资料库会保存搜索词与分组展开状态。
- 页面切换、横向筛选条和滚动位置会保存，重新渲染时尽量避免跳动。
- 计时器开始、暂停、继续、完成及时间日志均保存在本机；忘记开始时可按任务补记时长与完成时间。

## 手机与平板支持

项目针对 320px、360px、390px、768px、1024px 和桌面视口设计：

- 手机使用底部主导航，并为安全区和底栏预留正文空间。
- 主要点击区域约 44×44px。
- 编辑器和设置在手机端为全屏布局，标题、关闭和底部保存操作保持可见。
- 今日任务、周计划、游戏指标、资料卡和子任务均使用正常文档流，不依赖固定高度截断。
- 支持 `prefers-reduced-motion`、键盘焦点、Dialog 焦点循环和 Accordion `aria-expanded`。

## 目录

```text
task-ring/
├─ index.html
├─ README.md
├─ REFACTOR_REPORT.md
├─ CLEANUP_REPORT.md
├─ assets/
│  ├─ icons/                 # favicon
│  ├─ css/
│  │  ├─ main.css            # 唯一样式入口
│  │  ├─ tokens.css          # 设计 Token
│  │  ├─ base.css            # reset、锁屏与基础可访问性
│  │  ├─ layout.css          # Header、导航、页面布局
│  │  ├─ components.css      # 按钮、标签、状态、空态
│  │  ├─ daily.css           # 今日任务与子任务
│  │  ├─ weekly.css          # 周计划池
│  │  ├─ game.css            # 游戏作战区
│  │  ├─ time.css            # 时间账本与浮动计时器
│  │  ├─ library.css         # 资料库
│  │  ├─ editors.css         # 弹窗与编辑器
│  │  ├─ effects.css         # 分级完成演出与微交互
│  │  └─ responsive.css      # 手机、平板响应式
│  └─ js/
│     ├─ data/default-data.js # 隐私安全的公开 Demo 数据
│     ├─ app.js              # 核心数据、计时与编辑器业务
│     └─ views/
│        ├─ completion-effects.js
│        ├─ product-ui.js
│        ├─ time-ledger-view.js
│        └─ editor-ux.js
└─ docs/
   ├─ STRUCTURE.md
   ├─ ASSET_MANIFEST.json
   ├─ CHANGELOG.md
   └─ taskring-config.example.json
```

本机备份目录、导出的真实配置、调试日志和私人运维说明均不得进入公开部署产物。

## 部署前隐私检查

提交或部署前至少检查：

```powershell
git grep -n -i -E "notion|docs\.google|drive\.google|chatgpt\.com/c/|github_pat_|ghp_"
git status
```

同时确认：

- `default-data.js` 只有通用 Demo；
- 仓库中没有真实导出 JSON、截图、日志或备份；
- README 和文档没有口令、Token、同步存储 ID 或内部操作说明；
- 已经公开过的私人链接和凭据已撤销或更换。

## 部署

项目可直接部署到 GitHub Pages 或任意静态托管服务。部署入口为 `index.html`，无需构建命令。

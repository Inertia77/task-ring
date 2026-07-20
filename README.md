# TaskRing

TaskRing 是一个本地优先的个人任务指挥中心。它用纯静态 HTML、CSS 和 JavaScript 实现今日任务、周计划、游戏任务、训练饮食、时间账本和资料库，无需安装依赖或执行构建。

> 公开仓库只保留隐私安全的演示数据。个人任务、私人链接、同步凭据、导出配置和本机备份不得提交到仓库。

## 功能概览

- 今日任务：按每日或指定星期执行，支持子任务、优先级、链接和完成反馈。
- 周计划池：按分类管理长期任务、每周目标、计时进度和外部链接。
- 游戏作战区：分别管理每日、指定日和本周任务；每条任务都可添加独立链接。
- 训练饮食：按星期维护项目名称、备注和链接。
- 时间账本：任务计时、暂停、继续、补记、明细和 JSON 导出。
- 资料库：分组保存链接或纯文本备注，并支持搜索。
- 本地与同步：配置和状态默认保存在浏览器；配置 GitHub Token 后可通过加密 Gist 跨设备同步。
- 响应式与可访问性：支持手机全屏编辑器、键盘焦点、Dialog 焦点循环、`aria-expanded` 和 `prefers-reduced-motion`。

## 快速开始

可以直接打开根目录的 `index.html`。建议使用本地 HTTP 服务，以获得更一致的浏览器行为：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8000/`。

调试指定日期时使用查询参数：

```text
http://127.0.0.1:8000/?date=2026-07-20
```

页面会进入指定日期，并提供“返回今天”入口。

## 使用编辑器

右上角“总控”集中提供任务、游戏任务、训练饮食、资料库和同步设置入口。

各编辑器只修改自己的配置分区：

| 编辑器 | 主要内容 | 链接支持 |
| --- | --- | --- |
| 任务编辑器 | 今日任务、指定日任务、周计划任务、子任务 | 每个主任务一个可选 URL |
| 游戏任务编辑器 | 每日、指定日、本周游戏任务 | 每条游戏任务一个可选 URL |
| 训练饮食编辑器 | 每周训练与饮食项目 | 每个项目一个可选 URL |
| 资料库编辑器 | 资料分组与条目 | 每个条目一个可选 URL |

链接可以留空。执行页只把 HTTP/HTTPS 地址识别为有效链接并显示“打开”入口。游戏任务的旧版纯文本数组仍然兼容，重新保存后会规范化为带 `id`、`title`、`url` 和 `plan_mode` 的对象。

## 数据与状态

首次访问且本机没有配置时，应用加载 `assets/js/data/default-data.js` 中的通用演示数据。用户保存的真实配置不会回写到该文件。

主要数据边界如下：

- 任务、资料库、游戏任务和训练饮食共用一份版本化配置。
- 完成状态使用稳定的任务代码或条目 ID 保存，可选择同步。
- 时间日志与活动计时器保存在本机；同步启用后，已完成的时间日志可随状态同步。
- 页面、筛选、Accordion、横向滚动位置等界面偏好只用于恢复当前浏览体验。
- 游戏任务链接存储在 `gameQuest.schedule[day][gameId][].url` 或 `gameQuest.weekly[gameId][].url`。

完整的隐私安全配置示例见 [`docs/taskring-config.example.json`](docs/taskring-config.example.json)。

## 项目结构

```text
task-ring/
├─ index.html                     # 唯一页面入口
├─ README.md                      # 使用与维护入口
├─ assets/
│  ├─ icons/                      # favicon
│  ├─ images/                     # 本地装饰图和完成演出资源
│  ├─ css/
│  │  ├─ main.css                 # 唯一样式入口
│  │  ├─ tokens.css               # 设计 Token
│  │  ├─ base.css                 # reset、锁屏、基础可访问性
│  │  ├─ layout.css               # Header、导航、页面布局
│  │  ├─ components.css           # 通用组件
│  │  ├─ daily.css                # 今日任务
│  │  ├─ weekly.css               # 周计划池
│  │  ├─ fitness.css              # 训练饮食
│  │  ├─ game.css                 # 游戏作战区
│  │  ├─ time.css                 # 时间账本
│  │  ├─ library.css              # 资料库
│  │  ├─ editors.css              # Dialog 与编辑器
│  │  ├─ effects.css              # 完成演出
│  │  └─ responsive.css           # 响应式规则
│  └─ js/
│     ├─ data/default-data.js      # 隐私安全的公开 Demo
│     ├─ app.js                    # 配置、状态、计时和编辑器业务
│     └─ views/
│        ├─ completion-effects.js  # 完成反馈
│        ├─ editor-ux.js           # 任务编辑器交互
│        ├─ fitness-view.js        # 训练饮食视图与编辑器
│        ├─ product-ui.js          # 主要产品视图
│        └─ time-ledger-view.js    # 时间账本视图
└─ docs/
   ├─ STRUCTURE.md                 # 加载顺序、职责和状态边界
   ├─ CHANGELOG.md                 # 版本变更
   ├─ REFACTOR_REPORT.md           # UI 重构记录
   ├─ CLEANUP_REPORT.md            # 历史资源清理记录
   ├─ ASSET_MANIFEST.json          # 资源清单
   └─ taskring-config.example.json # 配置格式示例
```

## 开发与验证

项目没有构建步骤。修改后至少完成以下检查：

```powershell
# JavaScript 语法检查（使用本机或工作区 Node.js）
node --check assets/js/app.js
node --check assets/js/views/product-ui.js

# 确认工作区改动
git diff --check
git status --short
```

浏览器回归重点：

- 今日、周计划、游戏、训练饮食、时间和资料库页面可正常切换。
- 任务完成、计时和补记不会因重新渲染丢失。
- 各编辑器在桌面与 320px–390px 手机宽度下可保存、关闭且没有页面级横向滚动。
- 有效链接显示“打开”入口，无链接或无效链接不显示入口。
- 游戏任务的“打开”链接不会同时切换完成状态。

## 隐私检查

提交或部署前运行：

```powershell
git grep -n -i -E "notion|docs\.google|drive\.google|chatgpt\.com/c/|github_pat_|ghp_"
git status --short
```

同时确认：

- `default-data.js` 只有通用 Demo 和公开示例网址。
- 仓库中没有真实导出 JSON、截图、日志、Token 或本机备份。
- 文档不包含口令、同步存储 ID、私人链接或内部运维信息。
- 曾经公开的私人链接或凭据已经撤销或更换。

## 部署

项目可直接发布到 GitHub Pages 或任意静态托管服务。入口为 `index.html`，无需构建命令。根目录的 `.nojekyll` 用于保持 GitHub Pages 按静态文件原样发布。

## 延伸文档

- [结构与依赖](docs/STRUCTURE.md)
- [变更日志](docs/CHANGELOG.md)
- [重构报告](docs/REFACTOR_REPORT.md)
- [清理报告](docs/CLEANUP_REPORT.md)

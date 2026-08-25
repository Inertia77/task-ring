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
- 本地与同步：配置和状态默认保存在浏览器；配置 GitHub Token 后可通过 Gist 跨设备同步。同步会先安全合并并检测双边修改，不再把“云端读取”当作无条件覆盖本机。
- 响应式与可访问性：支持手机全屏编辑器、键盘焦点、Dialog 焦点循环、`aria-expanded` 和 `prefers-reduced-motion`。

## 快速开始

可以直接打开根目录的 `index.html`。建议使用本地 HTTP 服务，以获得更一致的浏览器行为：

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8000/`。

## 手机安装（PWA）

TaskRing 可以作为独立应用安装到手机桌面，任务数据仍保存在当前设备，并继续使用原有 GitHub Gist 同步。

- Android：用 Chrome 或 Edge 打开 HTTPS 页面，进入“总控”并点击“安装 TaskRing”。
- iPhone / iPad：用 Safari 打开页面，点击“分享”→“添加到主屏幕”。
- 安装后可独立全屏启动；已经打开过的页面资源可在离线时继续使用。
- 首次安装与离线缓存需要通过 HTTPS（GitHub Pages 已满足）或 localhost 访问；直接打开本地 `file://` 页面不能安装。

发布新版本时需要同步更新 `service-worker.js` 中的 `CACHE_NAME`。CI 会检查 `index.html` 引用的本地 JavaScript 是否都进入 Service Worker 的 `APP_SHELL`，减少“页面已更新但安装版漏资源”的问题。

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
- 配置同步保存“上次本机与云端一致时”的内容指纹。只有一侧变化时自动采用变化侧；两侧都变化时保留本机并记录云端冲突副本，不静默覆盖。
- 完成状态使用稳定的任务代码或条目 ID，并额外记录 `value / updatedAt / deviceId`；取消完成与周期重置使用 tombstone，因此旧设备不会把已经取消的勾重新复活。
- 第一次遇到旧版“只有已完成键”的状态文件时采用并集合并，再迁移到带时间戳的状态格式，避免迁移本身造成数据丢失。
- 时间日志与活动计时器保存在本机；同步启用后，已完成的时间日志可随状态同步。
- 页面、筛选、Accordion、横向滚动位置等界面偏好只用于恢复当前浏览体验。
- 游戏任务链接存储在 `gameQuest.schedule[day][gameId][].url` 或 `gameQuest.weekly[gameId][].url`。
- 历史 `time_category` 的 `create` / `it` 会自动兼容为 `creator` / `it_ai`。

完整的隐私安全配置示例见 [`docs/taskring-config.example.json`](docs/taskring-config.example.json)。

## 项目结构

```text
task-ring/
├─ index.html                     # 唯一页面入口
├─ service-worker.js              # PWA APP_SHELL 与离线缓存
├─ README.md                      # 使用与维护入口
├─ .github/workflows/ci.yml       # 自动语法 / 数据行为 / 资源一致性检查
├─ assets/
│  ├─ icons/                      # favicon 与 PWA 图标
│  ├─ images/cutins/              # 当前运行时完成演出资源
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
│     ├─ data/integrity-core.js    # 可测试的配置/状态合并纯函数
│     ├─ app.js                    # 配置、状态、计时和编辑器业务
│     ├─ data-integrity.js         # 冲突安全的 Gist 同步保护层
│     ├─ pwa.js                    # PWA 安装与更新
│     └─ views/
│        ├─ completion-effects.js  # 完成反馈
│        ├─ editor-ux.js           # 任务编辑器交互
│        ├─ fitness-view.js        # 训练饮食视图与编辑器
│        ├─ product-ui.js          # 主要产品视图
│        └─ time-ledger-view.js    # 时间账本视图
├─ tests/
│  ├─ integrity-core.test.js       # 同步冲突 / tombstone / 分类迁移测试
│  └─ repo-integrity-check.js      # 运行资源、PWA、gitignore 一致性检查
└─ docs/
   ├─ STRUCTURE.md                 # 加载顺序、职责和状态边界
   ├─ CHANGELOG.md                 # 版本变更
   ├─ ASSET_MANIFEST.json          # 当前运行资源清单
   └─ taskring-config.example.json # 完整隐私安全配置示例
```

历史重构/清理过程不再保留重复的当前树文档，必要时直接查看 Git 历史和 `CHANGELOG.md`。

## 开发与验证

项目没有构建步骤，也不依赖第三方 npm 包。修改后至少完成以下检查：

```powershell
# 核心与全部运行时 JavaScript 语法检查
node --check assets/js/app.js
node --check assets/js/data/integrity-core.js
node --check assets/js/data-integrity.js
node --check service-worker.js

# 数据行为测试
node --test tests/*.test.js

# 页面资源 / PWA / 导出规则一致性
node tests/repo-integrity-check.js

# 确认工作区改动
git diff --check
git status --short
```

上述检查也由 `.github/workflows/ci.yml` 在 `main`、`fix/**` 和 Pull Request 自动执行。

浏览器回归重点：

- 今日、周计划、游戏、训练饮食、时间和资料库页面可正常切换。
- 任务完成、取消完成、计时和补记不会因重新渲染或跨设备同步丢失。
- 本机配置比云端新时，自动 Pull 不得用旧云端覆盖；云端比本机新且本机没改时可正常更新。
- 两台设备都修改同一共同配置后，必须进入冲突保护而不是静默选择任意一边。
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
- [运行资源清单](docs/ASSET_MANIFEST.json)
- [配置格式示例](docs/taskring-config.example.json)

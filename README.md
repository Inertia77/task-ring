# task-ring

个人任务环静态网页。这个版本把原来的单个 `index.html` 拆成了 HTML / CSS / JS / 图片资源，便于后续继续开发、维护和 Push 到 GitHub Pages。⚡

## 目录结构

```text
task-ring/
├─ index.html                    # 页面骨架，只保留 DOM 结构和资源引用
├─ assets/
│  ├─ css/
│  │  ├─ main.css                # CSS 入口，按顺序 import 下列文件
│  │  ├─ 00-foundation.css       # 基础变量、布局、表格、移动端基础
│  │  ├─ 10-task-ui.css          # 任务名、链接、步骤、完成动效
│  │  ├─ 20-cutin-avatars.css    # 角色 cut-in / avatar 演出
│  │  ├─ 30-world-visuals.css    # 大型世界观视觉系统
│  │  └─ 90-overrides.css        # v9/v10 紧凑化与修正覆盖层
│  ├─ js/
│  │  ├─ data/default-data.js    # 默认任务、参考链接、随机演出角色数据
│  │  └─ app.js                  # 页面渲染、编辑器、同步、状态逻辑
│  ├─ images/
│  │  ├─ css/                    # 从 CSS 里抽出的背景/头像图
│  │  └─ cutins/                 # 从 JS 随机演出里抽出的角色图
│  └─ icons/favicon.svg          # 浏览器图标
├─ docs/
│  ├─ STRUCTURE.md               # 开发维护说明
│  ├─ taskring-config.example.json
│  └─ ASSET_MANIFEST.json
├─ .gitignore
└─ .nojekyll                     # 让 GitHub Pages 原样发布静态资源
```

## 本地启动

在仓库根目录执行：

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:8000/
```

Mac / Linux 或 Python 命令是 `python3` 的环境：

```bash
python3 -m http.server 8000
```

## 推送到 GitHub

把这个文件夹里的内容复制到你的 `task-ring` 本地仓库根目录后执行：

```bash
git status
git add .
git commit -m "Refactor task-ring into maintainable static structure"
git push origin main
```

## 维护规则

- 改任务、默认链接、游戏作战区默认一周配置、随机完成角色：优先改 `assets/js/data/default-data.js`。
- 改渲染逻辑、编辑器、同步逻辑：改 `assets/js/app.js`。
- 改样式：先看 `assets/css/main.css` 的 import 顺序，再去对应 CSS 文件改。
- 不建议再把 CSS / JS / base64 图片塞回 `index.html`。那是把厨房、卧室、发动机都装进一个行李箱，能跑，但不好修。


## v10.8 追加开发说明

- 手机端任务卡改为：第一行显示分类/状态/任务属性，第二行只显示任务名称，避免长标题挤掉标签。
- 状态标签短码化：保/重/选/延/锁/补/旧/忽。页面主任务区下方有低干扰说明。
- 本次主要改动文件：`index.html`、`assets/js/app.js`、`assets/css/90-overrides.css`。


## v10.9 追加开发说明

- 新增 `游戏作战区`：放在主任务环上方，并行独立管理游戏日常、周常、深渊/危局、资料整理等内容。
- 支持按星期编辑一周游戏任务：点击游戏作战区的「编辑一周」，每个游戏一格，一行就是一条任务。
- 游戏任务完成状态复用原有 GitHub Gist 状态同步；游戏任务配置合并进 `taskring-config.json` 加密同步。旧主任务环里的游戏项本版暂不强制删除，避免破坏现有云端配置。
- 本次同步更新 `.gitignore`，追加 `tmp_bk/`，并按你给的忽略规则整理。
- 本次主要改动文件：`index.html`、`.gitignore`、`assets/js/data/default-data.js`、`assets/js/app.js`、`assets/css/90-overrides.css`。

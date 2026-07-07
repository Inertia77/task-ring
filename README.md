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


## 本机软锁与 Gist 同步

本版已经把「进门解锁」和「GitHub Gist 同步」拆开：

- 本机软锁负责进入页面。第一次输入解锁码后，会在当前浏览器保存解锁状态；刷新页面不会再要求输入。
- GitHub Token 只负责 Gist 云同步。Token 没有设置、过期或读取失败时，页面仍然可以进入，只会切换为本机/内置数据模式，并提示你补充 Token。
- 总控菜单里有「立即上锁（下次需密码）」，会写入一个手动锁定标记。即使这台浏览器之前选择了“记住”，也必须重新输入解锁码才能进入。

初始解锁码：

```text
见密码本
```

注意：这是浏览器前端软锁，不是服务器级鉴权。它适合防止普通路人误入，不适合保护高敏感资料。真要做强安全，需要后端登录、服务端鉴权和访问控制。

### 手动上锁机制

点击页面右上角「总控 → 立即上锁（下次需密码）」后，页面会写入：

```text
localStorage: taskring_softlock_manual_v1 = 1
```

只要这个标记存在，页面启动时就不会使用之前保存的“记住本机”状态，必须重新输入软锁密码。密码校验成功后，这个手动锁定标记会自动清除。

### 修改软锁密码

软锁不会把明文密码写进页面逻辑，代码里保存的是 SHA-256 哈希。要改密码时：

1. 先生成新密码的 SHA-256。PowerShell 示例：

```powershell
$newPassword = "你的新密码"
$bytes = [System.Text.Encoding]::UTF8.GetBytes($newPassword)
$hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)
[BitConverter]::ToString($hash).Replace("-", "").ToLower()
```

也可以用 Node.js：

```bash
node -e "console.log(require('crypto').createHash('sha256').update('你的新密码').digest('hex'))"
```

2. 打开 `assets/js/app.js`，找到：

```js
const SOFT_LOCK_HASH="bead83688f2ba2f37b42341f55c53c97e50ae7c0d521f6b67cdd7da0befda9ed"; // sha256("见密码本")
```

3. 把引号里的哈希换成新密码生成出来的哈希；后面的注释也建议一起改掉，免得以后自己坑自己。

4. 已经解锁过的浏览器可能仍有旧的“记住本机”状态。测试新密码前，可以在页面「总控 → 立即上锁（下次需密码）」，或者在浏览器开发者工具里清除下面这些 key：

```text
localStorage: taskring_softlock_trusted_v1
localStorage: taskring_softlock_trusted_until_v1
sessionStorage: taskring_softlock_session_v1
localStorage: taskring_softlock_manual_v1
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
- 改渲染逻辑、编辑器、同步逻辑、软锁密码哈希：改 `assets/js/app.js`。
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


## v11.0 追加开发说明

- 新增 `Time Budget Ring / 时间配额环`：主任务卡片支持「开始计时」「暂停」「继续」「完成并记录」「放弃」。
- 计时数据默认保存在浏览器 `localStorage`：`taskring_time_active_v1` 保存当前计时，`taskring_time_logs_v1` 保存历史时长。暂不写入 GitHub Gist，避免先把私密时间流水同步到云端。
- 任务编辑器新增「时间分类」和「预计分钟」字段，用于本周预算统计和超时提醒。
- 完成并记录会自动把对应任务勾选完成；短时间测试也会按最少 1 分钟写入日志，方便确认功能是否正常。
- 本次主要改动文件：`index.html`、`assets/js/app.js`、`assets/css/90-overrides.css`。

## Time Budget Ring v13

- 任务行支持开始计时，并显示「本周已用 / 每周目标」。点击周时长徽章可查看该任务本周计时明细。
- 任务编辑器新增「每周目标分钟」，随 `taskring-config.json` 加密同步到 GitHub/Gist。
- 游戏作战区顶部新增整体计时按钮，记录为 `gamequest-board`，计入游戏分类与 `taskring-state.json` 的 `time_logs`。
- 历史计时记录进入 GitHub/Gist 同步；当前正在运行的计时器仍仅保存在本机，避免多设备互相覆盖。

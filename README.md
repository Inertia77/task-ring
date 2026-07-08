# TASK RING ⚡

个人任务环静态网页（v22 · Royal Atelier）。纯静态页面，无需构建工具，直接部署到 GitHub Pages。
本机软锁进门，GitHub Gist 跨设备同步，Token 只保存在本机——没有 Token 也能本机离线使用。

页面地址：<https://inertia77.github.io/task-ring/>

## 功能概览

顶部导航在五个分区间切换：

- **今日执行环 DAILY**：只放真正今天要出现的任务（每日保底、指定日、遗留）。
- **周计划池 WEEK**：不必每天打卡、按本周时间目标推进的主线（语言 / IT / 科学 / 创作等）。
- **游戏作战区 GAME**：游戏日常/周常独立管理，分「今日清理」与「本周作战池」。
- **时间账本 TIME**：开始计时、按分类看本周投入、复盘时间流向。
- **资料库 LIB**：固定入口 / 不定期 / 月度 / 年度项目，只做链接，不进任务环。

## 目录结构

```text
task-ring/
├─ index.html                    # 页面骨架：DOM、meta、图标、CSS/JS 引用
├─ assets/
│  ├─ css/
│  │  ├─ main.css                # CSS 入口，按顺序 @import 下列各层
│  │  ├─ 00-foundation.css       # 变量、reset、基础布局
│  │  ├─ 10-task-ui.css          # 任务表格 / 卡片 / 链接 / 步骤
│  │  ├─ 20-cutin-avatars.css    # 角色 cut-in / 完成演出
│  │  ├─ 30-world-visuals.css    # 世界观视觉系统
│  │  ├─ 90-overrides.css        # INERTIA 综合覆盖层
│  │  ├─ 95-v20-polish.css       # v20 微调（并 @import views/*.css）
│  │  ├─ 96-v21-clarity.css      # v21 收敛：高对比、白底卡片
│  │  ├─ 97-royal-anime.css      # v22 皇家二次元皮肤
│  │  ├─ 98-atelier-gate.css     # 收尾层：锁屏背景、减少动态效果支持
│  │  └─ views/                  # 分区样式（editor/game/time/weekly）
│  ├─ js/
│  │  ├─ data/default-data.js    # 默认任务、参考链接、游戏配置、随机演出角色
│  │  ├─ app.js                  # 渲染、状态、软锁、同步、编辑器、时间账本
│  │  └─ views/                  # v20/v21 分区渲染 + 启动覆盖脚本
│  ├─ images/{css,cutins}/       # 图片资源（清单见 docs/ASSET_MANIFEST.json）
│  └─ icons/favicon.{svg,png}    # 站点图标（盾牌+闪电+对勾）
├─ docs/                         # 文档，见下「文档」
├─ .gitignore
└─ .nojekyll                     # 让 GitHub Pages 原样发布静态资源
```

## 本地启动

在仓库根目录执行（Windows / PowerShell）：

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Mac / Linux 或 `python3` 环境：

```bash
python3 -m http.server 8000
```

然后打开 <http://127.0.0.1:8000/>。

> 需要 Web Crypto（软锁哈希、配置加密）时，务必用 `http://127.0.0.1` 或 GitHub Pages 打开，
> 直接双击 `file://` 打开会缺少 `crypto.subtle`。

## 本机软锁与 Gist 同步

「进门解锁」和「GitHub Gist 同步」是分开的：

- **本机软锁**负责进入页面。第一次输入解锁码后会在当前浏览器记住解锁状态，刷新不再要求输入。
- **GitHub Token** 只负责 Gist 云同步。Token 未设置 / 过期 / 读取失败时，页面仍可进入，
  只会切换成本机/内置数据模式并提示补充 Token。
- 总控菜单里的「立即上锁（下次需密码）」会写入手动锁定标记，即使之前选了「记住」也必须重新输入解锁码。

初始解锁码：

```text
taskring2026
```

> 注意：这是浏览器前端软锁，只适合防止普通路人误入，**不是服务器级鉴权**，不适合保护高敏感资料。
> 真要做强安全需要后端登录与服务端鉴权。

### 手动上锁机制

点「总控 → 立即上锁」后写入 `localStorage: taskring_softlock_manual_v1 = 1`。
只要这个标记存在，启动时就不会使用之前「记住本机」的状态，必须重新输入密码；校验成功后标记自动清除。

### 修改软锁密码

代码里保存的是密码的 **SHA-256 哈希**，不写明文。改密码步骤：

1. 生成新密码的 SHA-256。PowerShell：

   ```powershell
   $p = "你的新密码"
   $b = [System.Text.Encoding]::UTF8.GetBytes($p)
   $h = [System.Security.Cryptography.SHA256]::Create().ComputeHash($b)
   [BitConverter]::ToString($h).Replace("-", "").ToLower()
   ```

   或 Node.js：

   ```bash
   node -e "console.log(require('crypto').createHash('sha256').update('你的新密码').digest('hex'))"
   ```

2. 打开 `assets/js/app.js`，找到 `const SOFT_LOCK_HASH="…";`，把引号里的哈希换成新值。
   **不要在注释里写明文密码**——本站点公开发布，注释会一起泄露。

3. 已解锁过的浏览器可能仍有旧的「记住本机」状态。测试新密码前，先在「总控 → 立即上锁」，
   或在开发者工具里清除这些 key：

   ```text
   localStorage:  taskring_softlock_trusted_v1
   localStorage:  taskring_softlock_trusted_until_v1
   localStorage:  taskring_softlock_manual_v1
   sessionStorage: taskring_softlock_session_v1
   ```

## 图片资源库

图片清单与用途见 [`docs/ASSET_MANIFEST.json`](docs/ASSET_MANIFEST.json)。目前各图归位如下：

- `assets/icons/favicon.svg` — 浏览器标签图标（盾牌+闪电+对勾），页头品牌标志内联同款。
- `assets/icons/favicon.png` — 上图高清版：apple-touch-icon（iOS 主屏）+ og:image 分享缩略图。
- `assets/images/css/background-collage.png` — 锁屏「星城之门」全屏背景。
- `assets/images/css/vivian-portrait.png` — 锁屏卡片顶部圆形「门卫」头像。
- `assets/images/css/avatar-{life,gamecreate,language}.png` — 完成演出经典 cut-in 头像。
- `assets/images/cutins/cutin-*.png` — 随机完成演出角色（16 位）。

换图直接替换文件，不要再塞 base64；改动后同步更新 `ASSET_MANIFEST.json`。

## 部署到 GitHub Pages

把内容提交到 `task-ring` 仓库的发布分支：

```bash
git add .
git commit -m "Update task-ring"
git push origin main
```

`.nojekyll` 已保证静态资源原样发布。

## 维护规则

- 改任务 / 默认链接 / 游戏一周配置 / 随机完成角色：先改 `assets/js/data/default-data.js`。
- 改渲染 / 编辑器 / 同步 / 软锁哈希：改 `assets/js/app.js`（周计划池渲染在 `assets/js/views/v21-boot.js`）。
- 改样式：先看 `assets/css/main.css` 的 import 顺序，尽量在最后几层（97/98）做小修，别回头拆旧层。
- 别再把 CSS / JS / base64 图片塞回 `index.html`。

## 文档

- [`docs/STRUCTURE.md`](docs/STRUCTURE.md) — 架构与维护指南（CSS 分层、JS 分层、同步要点）。
- [`docs/CHANGELOG.md`](docs/CHANGELOG.md) — 版本变更历史汇总（v10.8 → v22 及后续维护）。
- [`docs/ASSET_MANIFEST.json`](docs/ASSET_MANIFEST.json) — 图片资产清单与用途。
- [`docs/taskring-config.example.json`](docs/taskring-config.example.json) — 任务配置 schema 样例（v4）。
- `docs/V16_…` ~ `docs/V22_…` — 各版本的详细设计笔记（保留原文）。

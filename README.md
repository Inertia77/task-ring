# TaskRing

TaskRing 是一套本地优先的个人任务指挥中心，包含今日任务、周计划池、子任务、游戏作战区、时间账本、资料库、三个配置编辑器、本地软锁与 GitHub Gist 同步。项目是纯静态 HTML/CSS/JavaScript，不依赖构建工具或大型框架。

## 启动

可以直接双击根目录的 `index.html`。软锁在 `file://` 下会自动使用内置 SHA-256 降级实现，不依赖 `crypto.subtle`。

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

## 初始解锁密码

```text
taskring2026
```

为避免锁屏本身泄露口令，页面不会显示这个默认密码。“记住这台浏览器”会在本机保存软锁信任状态；“立即锁定”会清除信任并要求重新输入密码。软锁只用于本机进门，不是服务器级认证。

## GitHub Gist 同步

1. 在 GitHub 创建 Personal Access Token。
2. Classic Token 只勾选 `gist` 权限；Fine-grained Token 按 GitHub 当前界面授予对应 Gist 权限。
3. 解锁后点击“GitHub 同步”。
4. 粘贴 Token，点击“保存 Token 并同步”。

Token 只保存在当前浏览器的 `localStorage` 中，不写入仓库。同步使用内置 Gist ID：

- `taskring-state.json`：完成状态、游戏状态与时间记录。
- `taskring-config.json`：加密后的任务、资料库和游戏配置。

没有 Token 时，任务、资料库和游戏编辑器仍可保存到本机；设置 Token 后才会跨设备同步。

## 修改软锁密码

1. 计算新密码的 SHA-256 十六进制值。
2. 打开 `assets/js/app.js`。
3. 替换 `SOFT_LOCK_HASH` 的值。
4. 更新本 README 中的初始密码说明。

Node.js 示例：

```powershell
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('你的新密码').digest('hex'))"
```

不要把新密码明文写进 JavaScript 注释。

## 页面与状态恢复

- 今日任务默认作为第一视觉重点；分类和子任务展开状态保存在本机。
- 周计划分类筛选、Accordion 状态和上次分类会恢复。
- 游戏日期、今日/本周模式、当前游戏和本周筛选会恢复。
- 资料库只展开上次查看的分组，并保存搜索词。
- 页面切换、横向筛选条和滚动位置会保存，重新渲染不会主动跳到第一个分类。
- 计时器开始、暂停、继续、完成及时间日志均保存在本机；完成后按已有同步规则进入 Gist。

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
│  │  ├─ base.css            # reset、软锁、基础可访问性
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
│     ├─ data/default-data.js
│     ├─ app.js              # 核心数据、软锁、同步、计时与编辑器业务
│     └─ views/
│        ├─ completion-effects.js # Cut-in、粒子、队列与 reduced-motion
│        ├─ product-ui.js    # 收纳、持久化与主要页面渲染
│        ├─ time-ledger-view.js
│        └─ editor-ux.js
└─ docs/
   ├─ STRUCTURE.md
   ├─ ASSET_MANIFEST.json
   ├─ CHANGELOG.md
   └─ taskring-config.example.json
```

`tmp_bk/` 是被 `.gitignore` 排除的本地真实数据备份，不是运行时依赖，也不会进入 Git。清理时不要把它当普通临时产物删除。

## 部署

项目可直接部署到 GitHub Pages 或任意静态托管服务。部署入口为 `index.html`，无需构建命令。

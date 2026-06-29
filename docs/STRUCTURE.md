# Task Ring 结构说明

## 拆分原则

这个项目目前不需要 Vite / React / npm。它更适合保持为纯静态页面：打开快、部署稳、GitHub Pages 直接能跑。拆分重点是把「页面骨架」「样式」「数据」「逻辑」「图片资源」分开。

## 每个部分放什么

### `index.html`

只放页面结构、标题、meta、CSS/JS 引用。以后不要把大段 `<style>` 或 `<script>` 写回这里。

### `assets/css/`

CSS 按层级拆开：

1. `00-foundation.css`：变量、全局样式、基础布局。
2. `10-task-ui.css`：任务框、链接、步骤 chip、完成提示。
3. `20-cutin-avatars.css`：角色头像、cut-in、avatar 相关演出。
4. `30-world-visuals.css`：大背景、大型视觉系统。
5. `90-overrides.css`：最终覆盖修正。这里优先级最高，适合放「临时但必要」的修补。

### `assets/js/data/default-data.js`

这里是默认数据层：

- `days`
- `defaultBlocks`
- `defaultStepTasks`
- `defaultRefGroups`
- `defaultGameQuestConfig`
- `RANDOM_CUTIN_CHARACTERS`

以后新增任务、修改默认周常、改参考链接，先改这里。

### `assets/js/app.js`

这里是运行逻辑层：渲染、任务状态、编辑器、GitHub/Gist 同步、完成动画等。

### `assets/images/`

原本塞在 CSS/JS 里的 base64 图片已经抽成真实文件。以后换图直接替换文件，不要再塞 base64。



### 游戏作战区

v10.9 起，游戏任务新增一个位于主任务环上方的独立模块。默认配置在 `assets/js/data/default-data.js` 的 `defaultGameQuestConfig`。本版先并行显示，不自动删除主任务环里的既有游戏项。

运行时状态：

- 勾选完成状态复用 `taskring-state.json`，key 前缀仍走原有 GitHub/Gist 同步机制。
- 一周游戏任务配置合并进 `taskring-config.json` 的 `gameQuest` 字段，和任务/资料库配置一起加密同步。
- 页面内编辑入口是「游戏作战区」右上角的「编辑一周」。

## 推荐开发节奏

1. 先改数据，不动逻辑。
2. 再改样式，用 `90-overrides.css` 做小修。
3. 逻辑变多以后，再把 `app.js` 继续拆成 `render.js`、`storage.js`、`sync-github.js`、`editor.js`。

下一步真要大改时，可以升级成：

```text
assets/js/
├─ data/default-data.js
├─ core/date-cycle.js
├─ core/storage.js
├─ features/editor.js
├─ features/github-sync.js
├─ ui/render-board.js
├─ ui/render-mobile.js
├─ ui/effects.js
└─ app.js
```

现在先别上构建工具。传统静态页能解决的事，就别召唤 npm 魔王。🛠️

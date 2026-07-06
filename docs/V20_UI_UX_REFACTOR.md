# v20 UI/UX Refactor Notes

## 目标

v20 不是继续堆功能，而是把任务环拆成更容易维护、也更不容易误操作的结构：

- 周计划池：单独文件 `assets/js/views/weekly-view.js`
- 时间账本：单独文件 `assets/js/views/time-ledger-view.js`
- 游戏作战区：单独文件 `assets/js/views/game-view.js`
- 编辑器体验：单独文件 `assets/js/views/editor-ux.js`
- v20 启动覆盖：`assets/js/views/v20-boot.js`

这些文件会在 `app.js` 之后加载，覆盖对应的渲染函数，然后重新渲染一次界面。这样不必每次都直接怼 `app.js` 这个大文件。

## 重点变化

### 1. 周目标编辑不再是内联输入框

以前任务卡和时间账本里直接出现数字输入框，太容易误触。v20 改成按钮：

- 点「周目标」按钮
- 打开确认弹窗
- 选预设或输入分钟
- 点「保存目标」才会写入配置

### 2. 任务编辑器减负

任务编辑器改为折叠卡片：默认只看任务名、模式、时间分类、周目标。需要改细节时再展开。

新增：

- 搜索框
- 启用 / 周计划 / 今日环 / 停用 / 全部 筛选
- 停用任务库：停用任务默认收纳，不删除、不丢配置

### 3. 视觉升级

新增 `assets/css/views/*.css`：

- `weekly-v20.css`
- `time-v20.css`
- `game-v20.css`
- `editor-v20.css`

界面从普通白卡改成更有层级的任务板/账本风格。

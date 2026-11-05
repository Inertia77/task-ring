# TaskRing UI/UX 审计与实施记录（2026-11-05 JST）

> 状态：PR 阶段，合并、生产部署与正式站点验证以最终 CI 为准；不把代码检查代替真实浏览器体验验收。

## 基线与边界

- 基线 main：`172acbc9c4bb816d0da07fd1c76e645cd8c5a305`（2026-11-04 全站双端设计升级）。
- 工作分支：`audit/uiux-20261104`，PR [#51](https://github.com/Inertia77/task-ring/pull/51)。
- 未调整任务 ID / Code、子任务身份、配置草稿、Gist 加密协议、Supabase 任务源、时间记录、完成率、T1/T2/T3 排序或自动化任务计划。
- 由 `tests/browser/helpers.js` 在 `?preview` 使用本机隔离假数据；浏览器测试不写生产 Gist / Supabase。

## 已证实缺陷与处置

| 优先 | 证据与触发 | 修复 | 验收 |
|---|---|---|---|
| P1 | `service-worker.js` 原激活流程删除所有不等于当前缓存名的 Cache Storage 项，可清除同源其他应用缓存 | 仅清理过期 `taskring-shell-*` 缓存 | `tests/service-worker-cache-scope.test.js` |
| P1 | `assets/js/game-ops-v6.js` 的 `renderGameQuestPanel` 用 `panel.innerHTML` 重建横向导航条，而原 UI 滚动保存选择器没有覆盖新版 `.gqV6LaneTabs` / `.gqV6BoardTabs` | 在本地局部渲染前后分别保存/恢复对应滚动状态，定位相同任务按钮焦点 | `tests/browser/uiux-regression-20261105.spec.js` |
| P1 | 新版游戏的当前 board 保存在本机，即使从其他一级模块重新进入仍保留上次周常/限时 board，与“进入游戏默认日常”不符 | 只在真正跨一级模块进入时将 board 设为 daily；同模块筛选与重渲染不重置 | 同上：模块重入与内部筛选保持 |
| P1 | `app-design.css` 的 warning/danger/success/info 状态文字 Token 与对应浅底色的对比分别约 3.50/4.22/4.16/3.74:1，低于普通正文 WCAG AA 的 4.5:1 目标 | 小范围调暗已有语义前景色；修改后的四组对比分别约 4.67/5.00/5.01/4.67:1 | `tests/ui-status-contrast.test.js`（Token 对比断言，不能替代整站逐元素检测） |
| P2 | 新增 JS 页面资源未提升查询版本，既有安装应用可能识别不到静态资源变化 | 提升 `index.html` 的 `data-build` 与 `app.js`、`game-ops-v6.js` 资源版本到 `20261105.1`，同步更新 TaskRing PWA shell 缓存名 | 仓库检查、浏览器 PWA 检查 |

## CSS 维护成本的实测基线（源码静态统计）

逐一读取 `main.css` 导入的 33 个样式文件，合计约 **342,426 个 UTF-8 源码字符**、**93 个 `!important`** 声明；其中 `game-note-density.css` 单文件约 4,100 字符、**52 个 `!important`**。这些是**可证实的维护成本与层叠风险（P2）**，并非已证实的视觉 Bug。

`app-design.css` 为最后加载层，约 40.7k 字符；`mobile-execution.css` 约 11k 字符。两文件中的同一属性应通过 Chromium/WebKit 计算样式逐断点确认，再做安全的去重。**本次没有擅自删掉可能仍被动态 DOM 使用的规则。**

## 风险及暂不修改项

- **待浏览器进一步验证**：`main.css` 最后加载 `app-design.css`，它在层叠优先级相同时可以覆盖 `mobile-execution.css`；仅凭导入顺序不能判定具体布局缺陷。本次没有为了缩短 CSS 文件而盲删规则。
- **待人工细节验收**：软键盘出现、窄高度 320px 页面、200% 文字缩放、WCAG 对比度逐点测量及各编辑器复杂输入状态。
- **未做非必要迁移**：没有改动同步、配置 schema、数据库或游戏核心任务统计；T3 继续可勾选/撤销，不锁定。

## 测试策略及证据

- `npm test`：Node 数据行为测试和仓库完整性检查。
- `npm run test:browser`：Chromium + WebKit；已有六模块、草稿、离线同步、PWA、游戏梯度、周计划子任务、时间账本的交互测试。
- 本轮新增全站无横向溢出检查覆盖宽度 **320、360、390、430、700、768、820、900、901、1024、1049、1050、1099、1100、1280、1440、1500、1920px**，分别遍历六模块。
- 已有 `tests/browser/audit.spec.js` 生成六模块桌面与手机全页截图，`tests/browser/visual-capture.spec.js` 生成弹窗与扩展状态截图。CI 在 `browser-evidence` Actions artifact 中保留截图与指标 14 日。
- 参考的修改前截图来自 main 通过的 [CI #41827439380](https://github.com/Inertia77/task-ring/actions/runs/41827439380)。
- 审计期间发现新写的 Tab 回归测试在点击不可见 Tab 时，由 Playwright `scrollIntoViewIfNeeded` 先移动滚动条；已改为点击处在真实可见区域的选项。这是测试设计修正，未改用户行为。

## 合并与部署验收门槛

1. PR 最新 SHA 的 Node + Chromium + WebKit CI 都必须通过。
2. 保留原始六模块截图及全宽度检查，确认相同状态的排版没有整体退化。
3. 检查 PR diff 只涉及本次范围；不可修改生产存储。
4. 合并到 main 后，核实 GitHub Pages 构建与正式部署运行记录，验证线上 `data-build` 和资产版本与 main 一致。
5. 未能客观验证的项保留为待办，不写成“已通过”。

以上记录只对实际提交的修复范围负责，不将未完成的六模块全面视觉重构表述为已交付。

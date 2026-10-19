# TaskRing 结构与依赖

## 运行入口

`index.html` 是唯一 HTML 入口，按以下顺序加载：

1. `assets/css/main.css`
2. `assets/js/data/default-data.js`
3. `assets/js/app.js`
4. `assets/js/data/integrity-core.js`
5. `assets/js/data-integrity.js`
6. `assets/js/views/completion-effects.js`
7. `assets/js/views/time-ledger-view.js`
8. `assets/js/views/editor-ux.js`
9. `assets/js/views/fitness-view.js`
10. `assets/js/views/product-ui.js`
11. `assets/js/ai-tasks.js`
12. `assets/js/game-disclosure.js`
13. `assets/js/vendor/supabase-2.117.2.js`
14. `assets/js/game-ops-config.js`
15. `assets/js/game-ops-core.js`
16. `assets/js/game-ops-cloud.js`
17. `assets/js/game-ops-v6.js`
18. `assets/js/pwa.js`

随后由 `pwa.js` 动态加载 `ux-efficiency.js`，后者再加载 `private-restructure.js`。

`integrity-core.js` 提供可在浏览器和 Node 测试中复用的纯数据合并逻辑；`data-integrity.js` 必须在 `product-ui.js` 之前执行，用于安装冲突安全的 Gist 同步层。`product-ui.js` 最后安装正式渲染器并调用 `TaskRingCoreBoot()`，因此首次自动同步也会经过完整的数据完整性保护。`pwa.js` 在 UI 启动后注册 Service Worker 与安装/更新交互，同时加载只处理操作层级和界面效率的 `ux-efficiency.js` 后置增强层。

## CSS 分层

`main.css` 只负责导入，不写业务规则：

| 顺序 | 文件 | 职责 |
| --- | --- | --- |
| 1 | `tokens.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 2 | `base.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 3 | `layout.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 4 | `components.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 5 | `daily.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 6 | `weekly.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 7 | `fitness.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 8 | `game.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 9 | `time.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 10 | `library.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 11 | `editors.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 12 | `effects.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 13 | `responsive.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 14 | `ux-efficiency.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 15 | `visual-polish.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 16 | `weekly-polish.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 17 | `mobile-weekly-polish.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 18 | `game-mode-contrast.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 19 | `zone-card-art.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 20 | `zone-identity-v2.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 21 | `userfriend-polish.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 22 | `library-density-polish.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 23 | `game-note-density.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 24 | `game-ops-v6.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 25 | `daily-density.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 26 | `lane-density.css` | 现行 weeklyMission 分类分栏及游戏宽屏任务列 |
| 27 | `game-ops-cloud.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 28 | `category-glyphs.css` | 对应模块基础/兼容或视觉增强规则，按此顺序覆盖 |
| 29 | `ui-icon-polish.css` | 图标优先的组件与导航 |
| 30 | `ai-tasks.css` | AI 日常与周计划卡片 |
| 31 | `life-guide.css` | 生活改善当前视图与编辑器 |
| 32 | `game-weekly-flow.css` | v6 分类 Tab、手机聚焦与周常流（最终游戏样式） |

后置 UX / Visual 样式层不新增 `!important`；历史组件层仍保留少量既有优先级声明，后续只在必要维护时逐步清理。

## JavaScript 职责

- `default-data.js`：内置任务、资料库、游戏和训练饮食演示配置。
- `app.js`：配置标准化、本地状态、软锁、Gist、时间日志、业务操作和编辑器数据收集。
- `integrity-core.js`：纯函数数据完整性层；负责配置指纹、三方配置判定、旧 `time_category` 别名以及带时间戳状态/tombstone 合并，可直接由 Node 测试加载。
- `data-integrity.js`：浏览器同步保护层；在核心业务启动前接管配置拉取/推送、状态写入和周期重置，避免旧云端静默覆盖新本机。
- `completion-effects.js`：分级完成演出、角色预加载、随机去重、队列节流与 DOM 清理。
- `product-ui.js`：正式每日、周计划与资料库渲染；历史游戏渲染随后由 v6 覆盖；展开状态、搜索快照和统一弹窗焦点协调。
- `time-ledger-view.js`：时间账本正式渲染。
- `editor-ux.js`：任务编辑器筛选、折叠任务配置和周目标编辑。
- `fitness-view.js`：训练饮食渲染、链接打开和编辑器交互。
- `pwa.js`：PWA 安装、Service Worker 更新提示、版本切换，并加载后置 UX 效率层。
- `ux-efficiency.js`：不改任务业务数据；负责移除重复导航、把危险/低频操作移出高频区、压缩卡片动作、记忆周计划分类、默认收起冗余概览、移动端操作可见性和桌面快捷键。

## 同步与数据完整性

配置同步使用本机保存的“上次双方一致配置指纹”做三方判定：

- 只有本机相对共同版本变化：保留本机并上传。
- 只有云端相对共同版本变化：采用云端。
- 双方都变化：进入冲突状态，保留本机，并把云端配置保存为本机冲突副本；不会静默覆盖任意一边。
- 首次没有共同基线时才使用 `updatedAt` 判断；时间相同但内容不同视为冲突。

完成状态继续保留原有 `taskring_github_v2_*` 真值键以兼容旧数据，同时新增 `taskring_sync_state_meta_v1`：每个状态记录 `value`、`updatedAt` 与 `deviceId`。取消完成和周期重置会写入 `value: "0"` tombstone，因此多设备合并时不会把已经取消的旧勾选重新复活。旧 Gist 只有真值状态时先采用并集迁移，迁移完成后进入按状态时间戳合并。

## 数据边界

- Token：`taskring_gist_token_v1`，仅本机。
- 完成/游戏状态：`taskring_github_v2_*`，可同步。
- 状态同步元数据：`taskring_sync_state_meta_v1`，仅本机持久化并随 Gist state 文件同步。
- 配置共同基线：`taskring_sync_config_base_fp_v1`，仅本机，用于冲突判定。
- 配置冲突快照：`taskring_sync_config_conflict_v1`，仅本机；发生双边编辑冲突时保留云端副本。
- 任务配置：`taskring_local_config_v1`，本机缓存；有 Token 时同步加密配置。
- 游戏任务链接：保存在每日/指定日 `schedule` 或本周 `weekly` 条目的 `url` 字段，仅允许 HTTP/HTTPS。
- 时间日志：`taskring_time_logs_v1`；活动计时器保持本机。
- 展开状态：`taskring_ui_disclosure_v1`，仅本机 UI 偏好。
- 周计划上次分类：`taskring_ui_weekly_category_v1`，仅本机 UI 偏好。
- 页面与滚动：`taskring_github_v2_active_view_v1`、`taskring_ui_scroll_state_v1`。

## 自动验证

GitHub Actions 工作流位于 `.github/workflows/ci.yml`，在 `main`、`fix/**` push 和所有 Pull Request 上执行：

- 所有 JavaScript 的 `node --check`。
- `tests/integrity-core.test.js` 的配置冲突、分类迁移、状态 tombstone 与旧格式迁移测试。
- `tests/repo-integrity-check.js` 的页面资源、Service Worker APP_SHELL、导出 `.gitignore`、默认数据、后置 UX 与 Visual 资源接线一致性检查。
- `git diff --check` 空白字符检查。

## 资源依赖图

```text
index.html
├─ assets/icons/favicon.svg
├─ assets/icons/favicon.png
├─ assets/css/main.css
│  └─ 15 个职责 CSS（含 ux-efficiency.css + visual-polish.css）
├─ assets/images/cutins/（16 张本地角色图）
└─ 10 个直接脚本 + 1 个后置 UX 脚本
   ├─ 公开默认数据
   ├─ 核心业务
   ├─ 数据完整性核心 + 浏览器同步保护
   ├─ 5 个视图模块
   ├─ PWA 注册模块
   └─ UX efficiency 后置增强
```

运行时只动态预加载 `assets/images/cutins/` 下由默认角色池声明的本地图片；不请求外部演出资源。Service Worker 的 `APP_SHELL` 必须覆盖 `index.html` 引用的全部本地 JavaScript、`pwa.js` 动态加载的 UX efficiency 资源以及最终视觉层 `visual-polish.css`；CI 会阻止漏缓存的新运行时模块进入主分支。

## vNext 验收与状态边界

详见 [vnext/AUDIT.md](vnext/AUDIT.md)。`renderAll(scopes)` 的范围参数仅用于已核验的高频 UI 操作；未指定时仍执行全量刷新。游戏完成只绘游戏；每日绘每日和周计划；生活改善绘自身与账本。全绘保留稳定控件焦点，计时每秒仅更新已有文本。

任务编辑器的每条任务始终存在于同一个 DOM 草稿；范围/搜索只改变 hidden，不替换保存配置。四编辑器 session 仅存于当前页面，关闭可恢复，浏览器刷新会触发未保存保护。没有新增私人配置明文存储。

`npm test` 运行既有 Node 及完整性测试；`npm run check:syntax` 做运行时 JS 语法检查；`npm run test:browser` 运行 Chromium/WebKit 隔离测试、截图与真实 Service Worker 升级验证。测试环境无生产 Token，外部 HTTPS 被拦截。CI 独立上传浏览器截图/报告；截图不写入产品运行目录。

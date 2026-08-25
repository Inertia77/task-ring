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
11. `assets/js/pwa.js`
12. `assets/js/ux-efficiency.js`（由 `pwa.js` 在主 UI 完成后动态加载）

`integrity-core.js` 提供可在浏览器和 Node 测试中复用的纯数据合并逻辑；`data-integrity.js` 必须在 `product-ui.js` 之前执行，用于安装冲突安全的 Gist 同步层。`product-ui.js` 最后安装正式渲染器并调用 `TaskRingCoreBoot()`，因此首次自动同步也会经过完整的数据完整性保护。`pwa.js` 在 UI 启动后注册 Service Worker 与安装/更新交互，同时加载只处理操作层级和界面效率的 `ux-efficiency.js` 后置增强层。

## CSS 分层

`main.css` 只负责导入，不写业务规则：

| 顺序 | 文件 | 职责 |
| --- | --- | --- |
| 1 | `tokens.css` | 颜色、间距、字号、圆角、阴影、动效 Token |
| 2 | `base.css` | reset、文档基线、软锁、辅助类 |
| 3 | `layout.css` | Header、主导航、页面容器 |
| 4 | `components.css` | 按钮、状态、标签、空态、控制菜单 |
| 5 | `daily.css` | 今日分类、任务卡、子任务正常流 |
| 6 | `weekly.css` | 周计划筛选、分组和任务卡 |
| 7 | `fitness.css` | 训练饮食视图、项目卡和编辑器 |
| 8 | `game.css` | 游戏模式、指标、游戏选择、任务详情和任务链接 |
| 9 | `time.css` | 时间账本、计时状态和浮动操作 |
| 10 | `library.css` | 资料分组、搜索和资料卡 |
| 11 | `editors.css` | Dialog、编辑器、固定保存操作 |
| 12 | `effects.css` | 完成反馈、Cut-in、粒子、队列视觉与 reduced-motion 降级 |
| 13 | `responsive.css` | 1024/700/359px 响应式策略 |
| 14 | `ux-efficiency.css` | 高频/低频操作层级、卡片动作收纳、移动端可发现性优化 |

正式样式层不使用 `!important`。

## JavaScript 职责

- `default-data.js`：内置任务、资料库、游戏和训练饮食演示配置。
- `app.js`：配置标准化、本地状态、软锁、Gist、时间日志、业务操作和编辑器数据收集。
- `integrity-core.js`：纯函数数据完整性层；负责配置指纹、三方配置判定、旧 `time_category` 别名以及带时间戳状态/tombstone 合并，可直接由 Node 测试加载。
- `data-integrity.js`：浏览器同步保护层；在核心业务启动前接管配置拉取/推送、状态写入和周期重置，避免旧云端静默覆盖新本机。
- `completion-effects.js`：分级完成演出、角色预加载、随机去重、队列节流与 DOM 清理。
- `product-ui.js`：今日、周计划、游戏、资料库渲染；展开状态；筛选恢复；Dialog 和表单可访问性。
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
- `tests/repo-integrity-check.js` 的页面资源、Service Worker APP_SHELL、导出 `.gitignore`、默认数据与后置 UX 资源接线一致性检查。
- `git diff --check` 空白字符检查。

## 资源依赖图

```text
index.html
├─ assets/icons/favicon.svg
├─ assets/icons/favicon.png
├─ assets/css/main.css
│  └─ 14 个职责 CSS（含 ux-efficiency.css）
├─ assets/images/cutins/（16 张本地角色图）
└─ 11 个直接脚本 + 1 个后置 UX 脚本
   ├─ 公开默认数据
   ├─ 核心业务
   ├─ 数据完整性核心 + 浏览器同步保护
   ├─ 5 个视图模块
   ├─ PWA 注册模块
   └─ UX efficiency 后置增强
```

运行时只动态预加载 `assets/images/cutins/` 下由默认角色池声明的本地图片；不请求外部演出资源。Service Worker 的 `APP_SHELL` 必须覆盖 `index.html` 引用的全部本地 JavaScript，以及 `pwa.js` 动态加载的 UX efficiency 资源；CI 会阻止漏缓存的新运行时模块进入主分支。
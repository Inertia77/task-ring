# TaskRing 结构与依赖

## 运行入口

`index.html` 是唯一 HTML 入口，按以下顺序加载：

1. `assets/css/main.css`
2. `assets/js/data/default-data.js`
3. `assets/js/app.js`
4. `assets/js/views/time-ledger-view.js`
5. `assets/js/views/editor-ux.js`
6. `assets/js/views/product-ui.js`

`product-ui.js` 最后安装正式渲染器并调用 `TaskRingCoreBoot()`。旧版 v20/v21 boot 链已移除。

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
| 7 | `game.css` | 游戏模式、指标、游戏选择和任务详情 |
| 8 | `time.css` | 时间账本、计时状态和浮动操作 |
| 9 | `library.css` | 资料分组、搜索和资料卡 |
| 10 | `editors.css` | Dialog、编辑器、固定保存操作 |
| 11 | `responsive.css` | 1024/700/359px 响应式策略 |

正式样式层不使用 `!important`。

## JavaScript 职责

- `default-data.js`：内置任务、资料库和游戏配置。
- `app.js`：配置标准化、本地状态、软锁、Gist、时间日志、业务操作和编辑器数据收集。
- `product-ui.js`：今日、周计划、游戏、资料库渲染；展开状态；筛选恢复；Dialog 和表单可访问性。
- `time-ledger-view.js`：时间账本正式渲染。
- `editor-ux.js`：任务编辑器筛选、折叠任务配置和周目标编辑。

## 数据边界

- Token：`taskring_gist_token_v1`，仅本机。
- 完成/游戏状态：`taskring_github_v2_*`，可同步。
- 任务配置：`taskring_local_config_v1`，本机缓存；有 Token 时同步加密配置。
- 时间日志：`taskring_time_logs_v1`；活动计时器保持本机。
- 展开状态：`taskring_ui_disclosure_v1`，仅本机 UI 偏好。
- 页面与滚动：`taskring_github_v2_active_view_v1`、`taskring_ui_scroll_state_v1`。

## 资源依赖图

```text
index.html
├─ assets/icons/favicon.svg
├─ assets/icons/favicon.png
├─ assets/css/main.css
│  └─ 11 个职责 CSS（无图片 url()）
└─ 5 个 JavaScript 文件
   ├─ 内置数据
   ├─ 核心业务
   └─ 3 个视图模块
```

当前运行时不动态加载本地图片、字体、JSON、CSS 或额外 JavaScript。

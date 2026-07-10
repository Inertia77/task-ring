# TaskRing 清理报告

## 清理原则

删除前检查了 HTML `script/link/img`、CSS `@import/url()`、JavaScript 字符串和动态资源、配置示例、README 启动流程及 Git 跟踪状态。`tmp_bk` 虽然名称像临时目录，但包含真实任务、资料和游戏备份且已被 `.gitignore` 排除，因此保留。

## 删除的 CSS

- `assets/css/00-foundation.css`
- `assets/css/10-task-ui.css`
- `assets/css/20-cutin-avatars.css`
- `assets/css/30-world-visuals.css`
- `assets/css/90-overrides.css`
- `assets/css/95-v20-polish.css`
- `assets/css/96-v21-clarity.css`
- `assets/css/97-royal-anime.css`
- `assets/css/98-atelier-gate.css`
- `assets/css/99-neon-rarity.css`
- `assets/css/100-game-quest-v3.css`
- `assets/css/101-urban-neon-hybrid.css`
- `assets/css/102-city-terminal.css`
- `assets/css/102-task-command.css`
- `assets/css/102-v24-feedback-fixes.css`
- `assets/css/103-gamequest-hud.css`
- `assets/css/103-regression-fixes.css`
- `assets/css/104-urban-command-theme.css`
- `assets/css/105-urban-hud-boost.css`
- `assets/css/106-hud-actual-fix.css`
- `assets/css/views/editor-v20.css`
- `assets/css/views/game-v20.css`
- `assets/css/views/time-v20.css`
- `assets/css/views/weekly-v20.css`

原因：均属于历史主题、回归覆盖或已被新职责 CSS 完全替代；新 `main.css` 不再引用。

## 删除的 JavaScript

- `assets/js/views/game-view.js`
- `assets/js/views/weekly-view.js`
- `assets/js/views/v20-boot.js`
- `assets/js/views/v21-boot.js`
- `assets/js/views/ux-polish.js`

原因：旧占位 renderer、重复周计划覆盖和重复启动重绘已由 `product-ui.js` 统一替代。

## 删除的旧文档

- `docs/V16_WEEKLY_PLAN_POOL.md`
- `docs/V18_GAMEQUEST_WEEKLY_POOL.md`
- `docs/V20_UI_UX_REFACTOR.md`
- `docs/V21_CLARITY_PASS.md`
- `docs/V22_ROYAL_ANIME_DESIGN.md`

原因：内容描述已经删除的实现文件；正式结构、变更和报告已覆盖。

## 合并与保留

- CSS：多层旧主题合并为 `tokens/base/layout/components/daily/weekly/game/time/library/editors/responsive`。
- JavaScript：周计划、游戏、资料库和收纳状态进入 `product-ui.js`；时间账本和任务编辑器各保留一个单职责视图模块。
- 保留 `default-data.js`、Gist、软锁、时间日志、三个编辑器、favicon 和配置示例。
- 保留 `tmp_bk/`：本地真实数据备份，不属于运行时或 Git。

## 未能删除的无引用二进制资源

`assets/images/` 已确认没有 HTML、CSS、JavaScript、配置或 README 运行时引用。删除命令在执行时被环境安全审查额度限制拒绝；根据工具要求没有使用替代命令绕过。因此该目录仍存在，建议在获得新的明确删除授权后移除。

## 数量与大小

- 清理前基线：156 个文件，18,038,990 字节（首次工作区扫描口径）。
- 清理后同口径：138 个文件，17,194,500 字节。
- 清理后项目载荷（排除 `.git`）：55 个文件，4,548,036 字节；其中仍包含安全审查未允许删除的无引用图片和被忽略的本地真实数据备份。

## ZIP/临时产物

- 仓库没有 ZIP、`.bak`、`.old`、`.DS_Store`、`__MACOSX` 或 QA 截图。
- 未生成新的截图、构建目录或依赖目录。

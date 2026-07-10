# Changelog

## 2026-07-10 — Product UI refactor

- 用 Token + 10 个功能样式层替换历史主题覆盖链。
- 新增今日分类 Accordion、持久化子任务展开和正常文档流卡片。
- 周计划改为分类筛选 + 分类 Accordion，“全部”不再铺开全部任务。
- 游戏作战区新增今日/本周指标、日期恢复、游戏选择恢复和手机单游戏详情。
- 资料库新增搜索、分组摘要、独立资料卡与上次分组恢复。
- 编辑器在手机端改为全屏，关闭按钮和底部保存操作保持可见；游戏编辑器按游戏收纳。
- 软锁 SHA-256 在 `crypto.subtle` 缺失或调用失败时自动降级。
- 任务和资料库编辑器支持无 Token 本机保存。
- 统一 Dialog、焦点恢复、焦点循环、表单标签和 Accordion `aria-expanded`。
- 删除旧主题、旧 boot/renderer 和旧版本设计文档。

历史版本的实现说明已由 `REFACTOR_REPORT.md`、`CLEANUP_REPORT.md` 与 Git 历史替代。

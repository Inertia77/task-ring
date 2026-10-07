# 限时・周期任务

TaskRingAI 是既有 Supabase 项目。`public.game_ops_tasks` 是限时与周期任务的唯一正式表。日常、周常、计时与配置继续用原有 local-first / Gist；Google Calendar 独立管理版本、维护、直播、卡池和视频排期。

## 数据与权限

完整字段与约束见 [game-ops-schema.sql](game-ops-schema.sql)，它是已应用的两条增量迁移的合并参考，不要在现有库再次直接运行。每行带 `user_id`，复用既有 `auth.users`。UUID 主键与全局唯一 `task_key`；game/server 配对约束；source_level 允许 P0/P1/MANUAL/null，禁止 P2。更新时间复用既有 `set_taskring_updated_at()`。

- 任务：task_name、task_type（LIMITED_TIME/RECURRING）、game、server、period。
- 时间：open_at、deadline_at、gameplay_end_at、claim_end_at，均 TIMESTAMPTZ。仅日期的旧数据使用 open_date/deadline_date；未知时刻保持 null，不伪造 00:00。last_verified_date 同理。
- 状态：UPCOMING / ACTIVE / ENDING_SOON / TO_VERIFY / ARCHIVED。
- 用户：NONE / DONE / SKIP。归档原因 DONE / SKIP / EXPIRED / REPLACED / INVALID。
- 证据：verification（CONFIRMED/TO_VERIFY/ESTIMATED）、source_level、source_url、notes、last_verified_at。
- 迁移：legacy_task_key、migration_source_id，保留旧键与来源身份。

RLS SELECT/INSERT/UPDATE 均限制 `auth.uid() = user_id`，UPDATE 同时带 USING 和 WITH CHECK。匿名角色没有表权限，前端没有 DELETE 权限。active/archive 是 `security_invoker=true` 的视图，继承行权限。前端只保存 URL + publishable key，使用本地打包的官方 Supabase SDK 2.117.2。密码不进仓库、不保存到任务缓存。邮箱密码登录复用原账号，SDK 持久会话并自动刷新；本机软锁保留，不能替代 RLS。

## Key 与生命周期

Key 包含游戏、区服、标准任务名、版本/赛季、阶段与有效窗口；同一期不要因为 Deadline 修正而换 Key。旧 Notion 管道字符的 Markdown 转义统一去除，原值保留在 legacy_task_key。手动键为 `MANUAL|GAME|UUID`。

完成或不做：一次 UPDATE 设置 user_action、archive_reason、lifecycle_status='ARCHIVED'。数据库触发器生成 archived_at，CHECK 防止矛盾状态。前端 `.select('*').single()` 回读成功后才移除卡片；错误时保留任务。Archive 为同表查询，非复制数据。

UI 动态计算 Upcoming→Active，截止 24 小时或领取窗口 48 小时提示即将结束；时刻未确认不计算硬截止。过期视觉提示不等于数据库自动归档。自动化只可根据已确认时刻归档 Expired。

## 前端与离线

- `game-ops-v6.js` 保留现有日常/周常，仅将 hub 接到 cloud 模块。
- `game-ops-core.js`：JST 输入、时间状态、分组与稳定排序。
- `game-ops-cloud.js`：Auth、fetch、写后回读、过滤与缓存。
- 当前任务按 `user_id` + archived_at IS NULL 查询，200 条一页拉取。历史按服务器过滤 game/reason，archived_at DESC / id DESC，每页 25 条，多取 1 条判断下一页。
- 页面打开、恢复前台、恢复联网、手动刷新与每 60 秒同步；此版使用轮询，不需要 Realtime publication。
- 缓存键按 user_id 隔离，历史再按筛选和页码隔离；退出清理当前账号缓存。同步失败保留旧缓存并显示失败，离线显示「离线缓存」。本版离线禁用写操作并提示联网重试，没有会丢失的假完成或隐藏队列。
- SDK、样式与新脚本加入 PWA APP_SHELL；修改发布时更新 CACHE_NAME。

## GAME OPS 自动化

连接 Supabase 后定位 TaskRingAI 项目，读取 schema 与唯一 profiles 用户，不从聊天猜 UUID。业务日期由数据库 `now() AT TIME ZONE 'Asia/Tokyo'` 锁定。查询当前任务及相关 Key 的历史，避免重新创建已 Done/Skip 的同一期。

UPSERT on conflict(task_key) 只更新业务字段（名称、窗口、period、证据、核验时间）；不得覆盖 user_id、user_action、archive_reason、archived_at。条件更新应要求 user_action='NONE' AND archived_at IS NULL，并回读，避免用户同时完成时被重新激活。新期次使用新 Key。纯版本/卡池/直播/视频安排只维护 Calendar，不写入任务表。

确认过期后 UPDATE lifecycle_status='ARCHIVED', archive_reason='EXPIRED'，用户已 Done/Skip 的记录保持原结果。触发器填写 archived_at。来源 P2 不进入正式表，未确认时刻保留 null 或明确标记 TO_VERIFY/ESTIMATED。

## 一次性迁移与验证

2026-10-07：Notion 两个 All 视图分页读取完整清单，40 当前 + 120 历史，160 唯一 Key，重复 0，异常 0；逐字段保留用户结果、来源、备注、核验及归档日期。原数据保留；运行时没有 Notion / Sheet 请求。

`npm test` 包括 DOM 传输模拟：分组、归档回读行为、刷新持久状态、失败保留、离线缓存、恢复联网、账号隔离、日常/周常回归。真实数据库事务测试验证 owner Read/Write、Done/Skip、两个视图、唯一约束、更新时间、跨用户访问拒绝、匿名读写拒绝，测试记录全部回滚。DOM 模拟与数据库测试不冒充登录后的线上浏览器端到端验证。

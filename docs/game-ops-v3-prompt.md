# 【每日】游戏排期与限时周期任务｜GAME OPS v3

每天按本 Task 已设置的调度独立执行一次。你必须实际读取、比较、写入并回读系统；只报告本轮真实执行结果。普通字段、来源和 schema 问题应自行调查修复，个别游戏缺证据不阻断其余游戏。

## 1. 系统职责与时间锁

Supabase 是游戏限时 / 周期任务唯一正式源，TaskRing 是用户查看与操作入口。Google Calendar 单独维护版本、维护、前瞻 / 直播、卡池和视频制作排期。Notion 与 Google Sheet 不参与本任务读取、写入或同步，也不恢复旧数据。不得修改 Task 调度。

第一步用已连接 Supabase 定位现有 TaskRingAI 项目（ref：tmktgfhynunrmftlgmnl），执行：

```sql
SELECT now() AS run_at,
       now() AT TIME ZONE 'Asia/Tokyo' AS now_jst,
       (now() AT TIME ZONE 'Asia/Tokyo')::date AS business_date;
```

锁定 BUSINESS_DATE 与 RUN_AT，后续今天、明天、未来七天均基于本轮 JST 日期。不得使用 UTC / 设备默认日期 / 上轮日期。数据库不可访问则明确报告时间锁未完成，不猜测正式执行日期。

## 2. 六游与区服

固定顺序：绝区零 > 异环 > 鸣潮 > 崩铁 > 阴阳师 > 终末地。

| 游戏 | game | server |
| --- | --- | --- |
| 绝区零 | ZZZ | GLOBAL |
| 异环 | NTE | CN |
| 鸣潮 | WUWA | GLOBAL |
| 崩坏：星穹铁道 | HSR | GLOBAL |
| 阴阳师 | ONMYOJI | CN |
| 明日方舟：终末地 | ENF | CN |

国际服优先核对适用亚洲服 / SEA 的公告与服务器时间。国服公告不能自动当成国际服时间依据。先明确公告原时区，再换算 JST；库内保存带时区的 TIMESTAMPTZ。只有日期时保存 open_date / deadline_date，精确时刻保持 null；维护后开放且小时未知时不得伪造开服时间。

## 3. 先读正式系统

检查当前 schema、字段、约束与 RLS，复用 public.game_ops_tasks，禁止创建第二套 Active / Archive 表。读取 profiles 并确认现有所有者 user_id，不从聊天猜 UUID；不得更改任务归属或暴露密钥。

读取该用户所有非归档任务；分页读取，不能依赖默认 API 条数。历史只读取候选 Task Key 或本轮相关游戏 / 期次 / 日期范围，不每轮全扫。读取 Google Calendar 中与六游相关的当前及未来排期，定位现有日历与事件身份。

先处理真实 user_action：DONE / SKIP 应已经归档。若发现兼容旧状态，按原动作归档并回读；冲突字段先核对，不猜用户选择。

## 4. 情报扫描与证据

实际联网核对六游当前及即将开放内容，优先官方站、游戏内公告、已验证官方账号。覆盖：限时活动、周期高难、特殊签到、双倍掉落、限时领奖 / 邮件 / 兑换 / 商店、赛季结算及有明确窗口的资源领取。

P0：适用区服官方 / 游戏内资料。P1：可靠社区、Wiki、公告转载，用于补充或暂存待核验。P2：传闻、未核实推测，不进入正式任务表，不作为 Calendar 的已确认排期。

verification：CONFIRMED / TO_VERIFY / ESTIMATED。仅实际核对了适用区服、期次和窗口才能 CONFIRMED；日期推算为 ESTIMATED，来源或适用区服未确定为 TO_VERIFY。last_verified_at 记录本轮真正核验时刻，未核验的旧任务不得刷新为今天已核验。

游玩截止与领奖截止不同，应分别写 gameplay_end_at / claim_end_at。deadline_at 表示最终可操作硬截止，不能把活动玩法结束误当最终领奖截止。来源 URL、等级及必要限制写结构化字段与简短 notes。

普通日常 / 周常、永久剧情、无截止的养成不加入此表。纯版本、维护、直播、卡池、视频排期进入 Calendar；只有独立限时奖励行动才同时建立任务。

## 5. Task Key 与幂等写入

Task Key 稳定表达 Game + Server + 标准任务 + Version / Season + Phase + Effective Window。例如 ZZZ|GLOBAL|危局强袭战|3.3|PHASE_01|2026-10-09。

先精确查 Key，再查同一期语义及 legacy_task_key，避免因为标题改名、补全版本号或截止修正产生重复。已存在同一期时沿用原 Key；新期次才创建新 Key。同一 Key 由数据库 UNIQUE 约束保护。

INSERT / UPSERT 新任务必填 user_id、task_key、game、server、task_name、task_type，默认 priority=NORMAL、user_action=NONE。task_type 只用 LIMITED_TIME / RECURRING。

发生冲突时仅更新实际核对后的业务字段：任务名、类型、Period、窗口、证据、Verification、核验时间与必要说明。使用 on conflict(task_key) 的明确更新列，不整行覆盖。不得重置 user_action / archive_reason / archived_at，不覆盖用户手动 Priority；不得将已 Done / Skip 的同一期复活。

更新非归档状态时带 user_id、user_action='NONE' AND archived_at IS NULL 条件。用户可能同时在 TaskRing 完成任务，写后必须回读；零行更新时重新检查用户结果，不强行重开。

MANUAL namespace 的手动补充任务可补官方证据；发现它与正式期次相同，先核对用户操作，合并或明确 REPLACED，避免两条并行待办。

## 6. 生命周期与 Archive

UPCOMING：已知未来开放；ACTIVE：窗口已开放；ENDING_SOON：确认截止 <=24h，重要领取窗口 <=48h；TO_VERIFY：关键信息待核验；ARCHIVED：已处理的历史。

保持 verification 独立于生命周期，不能因到达预计开始时间就把 Estimated 改 Confirmed。TaskRing 会辅助计算紧急视觉，不要求每天机械更新所有行。

用户完成：user_action=DONE、archive_reason=DONE、lifecycle_status=ARCHIVED。
用户不做：user_action=SKIP、archive_reason=SKIP、lifecycle_status=ARCHIVED。
确认过期：仅对 user_action=NONE、archived_at IS NULL 且已核实最终窗口结束的任务，设置 archive_reason=EXPIRED、lifecycle_status=ARCHIVED。

数据库触发器生成 archived_at 与 updated_at。不得按未经确认的估算 Deadline 自动 Expired；保留 TO_VERIFY 并注明待核验原因。REPLACED 用于正式替代旧条目，INVALID 用于确认无效 / 范围错误；不能用这些理由覆盖用户 Done / Skip。

Archive 与 Active 是同表，不复制、不删除历史。未来期次与已完成期次分别保留自己的 Key。

## 7. Calendar 维护

实际读取既有 Google Calendar，维护六游版本、维护、前瞻 / 直播、卡池、已规划的视频时间轴。先搜索现有事件，用游戏 / 区服 / 版本或期次 / 事件类型定位，同一实际事件只保留一条。

官方变更已确认时更新现有事件；新增已确认节点才创建。沿用现有日历、事件命名与配色，不新建重复日历，不改动无关现实日程。未经用户确认的新视频选题不自动编造成已承诺排期。

事件标题清楚，说明包含适用区服、原时区、JST 时刻、官方来源与核验信息。日期不确定不得填写虚构精确时间。必要的候选排期应明确待核验，不伪装已确认。

写后按 event_id 回读标题、起止时间、时区与来源；修正取消事件仅限当前游戏排期范围，保留必要核验记录。不得删除或破坏 Calendar 体系。

## 8. 写后回读与恢复

Supabase 每次批量写入后按 Task Key 回读，核对名称、Game / Server、窗口、Verification、用户结果与 Archive。检查重复 Key、Done / Skip 状态及 user_id。必须验证新增 / 更新 / 归档计数与实际行数。

Calendar 写入后回读事件。部分失败只重试对应操作，先查真实服务器结果，避免请求超时后重复创建。普通 schema / 字段错误通过 introspection 修复查询；不得关闭 RLS、暴露 service_role 或新增无关项目。

仅工具返回明确错误才报告该系统失败，并给出具体错误类型。未调用不等于失败，明确标记未执行。缺来源、缺连接、权限错误或日期锁失败时不得捏造完成；已完成的独立模块保留结果。

## 9. Chat 输出

简洁输出 BUSINESS_DATE、当前 JST 与执行结果：

- 快过期：游戏、任务、截止 JST、Verification。
- 新开放 / 即将开放：最重要节点。
- Supabase：新增 X、更新 X、归档 X（Done / Skip / Expired / 其他）、重复避免 X、待核验 X。
- Calendar：新增 X、更新 X、取消 / 修正 X。
- 写后回读：Supabase OK / ERROR / 未执行；Calendar OK / ERROR / 未执行。
- 真正异常：具体项目、错误与未完成范围。

正式任务查看与操作入口：https://inertia77.github.io/task-ring/

不要在 Chat 粘贴全表或大量日志，不生成 Notion 日报，不读取 / 回写旧 Sheet，不建立双轨同步。只报告本轮真实操作。

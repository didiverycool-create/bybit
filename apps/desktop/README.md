# 桌面控制端说明

`apps/desktop` 是 Bybit 量化交易控制端的桌面应用层，当前采用：

- `React + TypeScript + Vite` 负责渲染进程
- `Electron` 负责桌面壳、主进程与 preload

## 目录职责

- `src/App.tsx`
  - 中文控制端主界面
  - 总览、行情、策略、回测、AI 调度、新闻事件、提醒中心、交易记录、AI 复盘、系统日志/审计
  - 已包含控制总览卡组、行情脉冲区、账户链路状态区等更完整的控制台布局
- `src/api.ts`
  - 本地控制服务 API 调用层
  - 提供 fallback 数据，保证本地服务异常时界面仍可用
- `src/types.ts`
  - 前端使用的主要类型契约
- `src/main/main.ts`
  - Electron 主进程入口
- `src/preload.ts`
  - Electron preload 入口

## 开发命令

```bash
pnpm dev:desktop
pnpm dev:desktop:repair
pnpm build:desktop
pnpm lint:desktop
```

`pnpm dev:desktop` 会优先复用已健康运行的本地控制 API (`127.0.0.1:8787`) 和 Vite 开发服务器 (`localhost:5173`)，避免上一次开发残留进程导致桌面端再次启动失败；若端口已被占用但健康探针始终不通过，启动脚本会直接报出明确错误，而不会再继续二次拉起同端口服务。
当 `127.0.0.1:8787` 已被旧的、不健康的 `services/control-api/main.py` 进程占住时，可改用 `pnpm dev:desktop:repair`；这条命令只会在命令行匹配当前 control-api 且健康检查持续失败时，显式终止旧进程并拉起新的本地控制服务。

## 当前边界

- 桌面端是控制端，不是交易执行引擎
- 手动交易当前只开放 Paper 路径
- Bybit 私有账户数据必须通过 API Key 读取，不能复用网页登录态
- 已提供“真实交易链路探测”按钮，用于安全验证 Bybit 交易 POST 链路
- 设置页与“账户详情”窗口当前会直接展示 Bybit 公共/私有链路诊断；当出现“REST 正常但 WS/TLS 失败”时，会直接给出本机代理、VPN、防火墙、企业网关与 TLS 配置方向的恢复建议
- 设置页当前也支持直接保存本地控制设置，包括 `bybit_web_entry / api_base_url / default_mode / notification_channels / notification_quiet_hours_* / product_language / grafana_*`；普通桌面通知会遵守静默时段，`critical` 级提醒继续放行；OpenClaw `gateway_url / agent` 继续只读展示，因为真实运行态仍由本机外部配置驱动
- 同内容的普通桌面通知当前会自动做 2 分钟短时去重，避免同类提醒短时间重复刷屏；测试通知与 `critical` 级提醒继续直通，不受这条去重影响
- 设置页当前也会直接展示 Bybit 私有只读配置文件路径、仓库内示例文件路径，以及 OpenClaw 本机配置路径与 `openclaw` 命令可用性；在 Electron 桌面端里还可直接打开配置目录或示例文件，方便在本机快速定位配置入口
- 工作台状态当前也会继续持久化回测页聚焦回测、`仅当前策略/全策略` 回测筛选、复盘跟踪范围，以及提醒/成交/审计筛选器与搜索词；桌面端重开后会直接恢复上次的排障上下文
- Electron 主窗口当前也会持久化大小、位置和最大化状态；如果上次记录的坐标已经不在当前显示器可见区域，启动时会自动回退到安全默认窗口
- 回测页与策略页“最新回测”摘要当前会直接标记 `reference_only / low_sample / history_truncated` 这类样本质量与样本窗口提示；若样本窗口被截断，还会直接显示结构化“补样本建议”，方便快速判断下一步应是“保持区间改粗周期”还是“先缩短区间再回测”
- 回测页当前已改用 `最近 30/90/180 天` 这类相对中文区间 preset；当“按建议重跑”返回 `1d` 或自定义区间时，表单也会直接保留并展示这组推荐参数，不会因为不在 preset 里而丢失
- 回测页详情与策略页“最新回测”摘要当前也会直接显示 `BacktestRun.source_change_request_id / source_* / trigger_reason` 形成的“来源链路”，用于追溯这轮回测是手动发起、由哪条变更触发、按门禁建议重跑，还是由某条 AI 提案触发
- 策略页“待落实 ChangeRequest”列表当前也会直接显示 `trigger_reason`，并支持一键回到来源提案；若提案接受后转成新的待落实变更，前端会自动定位到这条 ChangeRequest
- 若这条变更本身是 `backtest.launch`，同一列表当前也会直接显示并支持打开它刚生成的 `linked_backtest_*`，不需要再切去回测列表手动反查
- 对这类 `backtest.launch` 变更，如果关联回测当前没有 `decision_recommended_*`，但已经给出了 `full_window_recommended_*` 或 `history_source_recommended_*`，同一张卡片也会继续显示“样本窗口”提示并支持就地“按建议重跑”，不需要先点进回测详情再决定下一步
- 这类卡片当前还会继续复用 `requested_* / retrieved_* / used_*` 覆盖窗口字段；即使回测列表里暂时没有那条 `linked_backtest_id`，也能直接展示“请求 / 取样 / 回测”的窗口事实与覆盖率
- 对这类 `backtest.launch` 变更，同一列表当前也会把主跟踪任务直接指到 `generate_backtest_review`；你在卡片里看到的“打开任务 / 重试跟踪 / 查看结果”默认都围绕这轮回测复盘，而不是旁路的 `reconcile_change_request`
- 同一张变更卡当前也会直接显示这轮关联回测的“结论门禁”，并在存在 `decision_recommended_*` 时就地提供“按建议重跑”，不必先点进回测详情页
- 同一列表当前也会继续显示 `follow_up_job_* / follow_up_result_summary / linked_review_*`，允许从待落实变更就地打开后续跟踪任务或查看已经生成的跟踪复盘结果，不必再绕回 `AI 调度` 或 `AI 复盘` 反查
- 若这条 `backtest.launch` 变更后续又生成了回测复盘结果，这组 `linked_review_*` 当前也会直接挂回到同一张变更卡，允许从“待落实 ChangeRequest”一路点到结果
- 若这条后续跟踪任务当前处于 `failed / cancelled`，策略页现在还支持直接“重试跟踪”；重试成功后会自动聚焦新任务，旧失败摘要也会一起清空，避免把上一次失败状态误当成当前结果
- 对来自回测复盘的变更，这个列表当前也会直接显示并支持打开 `来源回测 / 来源复盘 / 来源提案`，不用再先跳到 `AI 复盘` 页做二次定位
- `AI 调度` 任务队列、实时 AI 事件流和策略活动二级窗当前也支持直接根据 `change_request_id` 打开对应变更，不必再从审计或提案列表反查
- 回测页“关联 AI 上下文”当前也支持直接打开这轮 AI 复盘、打开来源任务，并对这轮复盘带出的待处理提案就地执行“接受 / 拒绝 / 查看生成回测 / 查看生成复盘”
- 若接受的是 `backtest_request`，前端当前也会自动切到新生成的回测结果并聚焦详情，不必再回列表手动定位
- `AI 复盘` 页、复盘结果详情和策略活动二级窗当前也会直接显示 `ReviewDocument.source_change_request_id / source_* / trigger_reason` 形成的“来源链路”，并支持一键打开来源变更、来源回测、来源复盘或来源提案；若跳到策略提案列表，前端会直接高亮对应提案
- 对带 `decision_readiness* / decision_recommended_*` 的回测复盘，复盘结果详情和策略活动二级窗当前也会直接显示“结论门禁”，并支持就地“按建议重跑”
- 复盘结果详情小窗当前也会直接承接提案动作，支持就地“接受 / 拒绝 / 查看生成回测 / 查看生成复盘”，不用再强制切回 `AI 复盘` 主页面
- 策略页顶部“最近 AI 复盘”轻摘要当前也会直接显示回测复盘的结论门禁，并支持就地打开复盘、跳回来源链路或按建议重跑
- 系统日志/审计页当前也会直接消费 `generate_backtest_review` 完成事件里的 `backtest_id / source_* / trigger_reason / decision_*`，可从完成日志就地打开结果、回测和来源链路
- `AI 调度` 页任务队列、实时 AI 事件流，以及策略活动二级窗里的任务列表，当前也会直接消费 `backtest_id / source_change_request_id / source_*`，可从任务或完成事件就地打开回测、来源变更、来源回测、来源复盘和来源提案
- 对 `scheduler.command.cancel_all` 这类批量调度命令，系统日志/审计页与 `AI 调度` 页实时流当前也会直接显示结构化影响面摘要，例如本次终止了哪些任务类型、影响了哪些回测、来源变更与来源链路；若集合里只剩单条策略/回测，现有近场跳转也会继续可用
- 总览页“AI 实时日志”当前也会直接复用当前任务与审计事件里的 `job_id / backtest_id / source_* / cancelled_*`，允许从首页近场打开任务、回测、来源链路和单策略活动
- 策略活动二级窗里的最近审计事件当前也会直接复用 `job_id / linked_review_id / backtest_id / source_* / cancelled_*`，允许从单策略排障窗口就地打开任务、复盘结果、回测与来源链路
- `POST /api/ai/scheduler/commands` 当前回执也会直接带 `summary / cancelled_* / source_change_request_id / source_* / decision_*`，桌面端命令成功提示会优先展示这条结构化影响面
- 状态窗口与 `AI 调度` 页顶部当前也会直接展示最近一次 `scheduler.command` 的结构化摘要、影响面与近场跳转，并支持直接打开来源变更，不必再先翻实时流或审计列表
- 上述“最近调度动作”当前优先消费 `/api/control/snapshot`、`/api/ai/scheduler`、`/api/ai/live`、`/api/ops/live` 返回的 `latest_scheduler_command`，只有缺失时才回退到前端从审计流临时派生
- 若这轮回测对应的 `generate_backtest_review` 尚未写回结果，回测页详情当前也会直接显示复盘任务的 `排队中 / 执行中 / 失败 / 已完成待写回` 状态，并支持一键打开 AI 调度或重试失败任务
- 登录、账户设置、API Key 创建的网页入口统一使用 `https://www.bybit-global.com/`

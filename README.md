# Bybit 量化交易控制端

这是一个中文桌面端优先的 Bybit 量化交易控制端项目。

当前阶段的目标不是做“人工交易工作台”，而是做一个让你统一看行情、控策略、看回测、管 AI 调度、查审计和历史记录的桌面控制中枢。首页已经开始按“量化交易正在进行时最关注的点”来组织，控制动作和布局偏好则单独收进设置页。自动交易最终仍由量化层负责，OpenClaw 只做本地编排、复盘、调参与状态回写。

当前项目不再为 Web 端排期，后续优先把桌面端背后的真实量化内核、真实执行风控和编排闭环做实。

## 文档入口

- [架构总览](./docs/架构总览.md)
- [接口契约](./docs/接口契约.md)
- [开发约定](./docs/开发约定.md)
- [实施路线与接手清单](./docs/实施路线与接手清单.md)

## 当前目录

```text
.
├── AGENTS.md
├── README.md
├── apps
│   └── desktop
│       ├── src
│       └── dist-electron
├── docs
│   ├── 开发约定.md
│   ├── 实施路线与接手清单.md
│   ├── 接口契约.md
│   └── 架构总览.md
├── package.json
├── pnpm-workspace.yaml
└── services
    └── control-api
```

## 当前已实现

- `apps/desktop` 已有中文桌面控制端界面
- 已有总览、行情、策略、回测、AI 调度、新闻事件、提醒中心、交易记录、AI 复盘、系统日志/审计页面
- 已把首页重排为“运行看板”，主结构改为图表主舞台、左侧自选观察、右侧运行轨和底部终端式日志/持仓/回测面板
- 行情页已支持“自选管理”二级窗口，可新增或移除关注品种，并自动刷新当前自选列表
- 自选管理窗口当前已支持为单个品种开启/关闭波动提醒，并调整提醒阈值百分比
- 已把模式切换、调度控制、首页模块开关和布局同步收进单独的“设置”页
- 设置页与“账户详情”窗口当前也会直接展示 Bybit 公共/私有链路诊断；当出现“REST 正常但 WS/TLS 失败”时，会直接给出本机代理、VPN、防火墙、企业网关与 TLS 配置方向的恢复建议
- 左侧导航中的大模块保持整页切换；弹窗能力后续优先用于模块内部的次级操作和详情窗口
- 左侧导航已按“交易观察 / 策略研究 / 运行控制 / 记录审计”重新分组，减少平铺式菜单堆叠
- 已有 `ChangeRequest`、`Backtest`、`SchedulerCommand`、`AgentJob`、`ManualOrder` 等控制链路
- 已打通 `AI 提案 -> 接受/拒绝 -> ChangeRequest 或回测 -> 审计回写` 的基础联动
- 策略页已支持直接编辑参数和风险预算，并通过 ChangeRequest 写回控制链路
- 已新增 `/api/strategies/live`，会基于最新行情生成最小策略运行态，并为 `paper` / `paper_only` 策略补纸面成交记录
- 已新增 `/api/strategies/stream` 本地 SSE 流，策略页与总览页可优先订阅同一份实时策略运行态快照
- 策略页当前已接入轻量运行态摘要，可直接看到当前信号、置信度、参考价与下一步动作
- `/api/strategies/live` 当前也会附带 `execution_preview`，用于展示当前策略信号若继续按 `paper` 执行，对仓位和可用余额的大致影响
- 当工作台当前模式切到 `live/demo` 且策略模式匹配时，`/api/strategies/live` 现在也会直接附带对应的真实顾问式执行预检，策略页和总览无需总是额外单独请求
- 当 `live/demo` 策略的真实顾问式预检因为余额不足、现货可卖数量不足或交易所约束不满足而被拦住时，`/api/strategies/live` 当前也会把该策略运行态标成 `guard_state=auto_dispatch_blocked`，并把预检里的 `blocked_reason / recommended_action` 一并带回
- 即使当前工作台还停在别的模式，只要最近一次真实自动执行已经被拦住，`/api/strategies/live` 现在也会优先把最近一次阻断明细回填到 `guard_detail / note / next_action`，不再只显示泛化的“自动执行被系统拦截”
- 活动中的 `strategy-auto-dispatch:*` 提醒和控制总览里的 `execution_health.top_issue_recommended_action` 现在也会尽量按阻断明细给出具体动作，比如补 `UNIFIED / CONTRACT` 等实际账户桶位余额、撤挂单或先恢复实时链路
- 后台自动执行若直接命中真实预检阻断，原始 `recommended_action` 现在也会一路保留到活动提醒、审计事件、策略运行态和控制总览，不再在中间丢成泛化模板
- 若后台 `strategy runtime` 线程当前异常或停滞，`/api/strategies/live` 与 `GET /api/strategies/{strategy_id}/execution-preview` 现在都会直接返回阻断态预检；策略运行态现有的 `guard_state / guard_detail` 也会同步标成“执行受阻”，避免一边显示线程异常、一边还提示可真实执行
- 若后台 `strategy runtime` 线程已停止但此前曾成功刷新过，当前也会和异常/停滞一样进入真实执行门禁；策略级预检、运行态内联预检与手动执行都会要求先恢复运行线程
- 对 `live / demo` 真实执行而言，当前也会把 Bybit 公共 WS 的连通、目标品种实时行情是否已到达、以及最近是否仍在刷新一起作为真实执行门禁；若目标品种公共实时链路未连通、未收到首帧或已失活，策略级预检、运行态内联预检、手动策略执行与后台自动执行都会统一阻断
- 公共实时链路门禁当前也会正式升成 `system` 来源提醒；目标品种公共 WS 失活或未收到首帧时，会自动生成策略级提醒，恢复后自动收起并写恢复审计
- 后台自动执行当前在遇到公共/私有执行链路异常时，也会先自动撤销遗留真实策略委托，再保持阻断状态，避免链路失活期间旧单继续挂在交易所侧
- 若真实模式下因为外部干预或异常遗留了多笔同策略挂单，后台当前也会优先自动清掉多余旧单，只保留最新目标委托
- 对 `live / demo` 真实执行而言，当前不仅检查 Bybit 私有 WS 是否连通、是否已鉴权，也会检查它最近是否仍在刷新；若私有实时链路已失活，策略级预检、运行态内联预检、手动策略执行与后台自动执行都会统一阻断
- 同样这条门禁也已经收进 `POST /api/strategies/{strategy_id}/execute`，所以真实模式下“预检 / 运行态 / 真正执行”三条路径当前使用同一套运行线程健康边界
- 当桌面端手动点击策略执行、但被运行线程异常或其他真实门禁拦住时，当前会写入 `strategy.execution.blocked` 审计事件，方便后续在策略最近执行摘要、审计流和 AI 复盘里回看
- 同时这类手动执行阻断现在也会升成 `system` 来源提醒，提醒中心会直接出现“手动策略执行被拦截”，不再只留一条审计事件
- 若 `POST /api/strategies/{strategy_id}/execute` 是因为真实预检阻断而返回 `409`，当前也会把原始建议直接拼进错误详情，桌面端现有错误反馈无需额外改协议就能直接展示“建议 …”
- 当后续同一策略的手动执行恢复成功后，这类“手动策略执行被拦截”提醒当前会自动收起，并补写 `strategy.execution.blocked_resolved` 审计事件
- `execution_preview` 当前已按“目标仓位差额”计算，信号从 `long -> short` 或 `long -> flat` 时，会自动按当前真实持仓补足反手/平仓所需数量，而不是只按固定手数成交
- 已新增 `GET /api/strategies/{strategy_id}/execution-preview`，会按当前模式返回策略级执行预检；`paper` 模式走本地目标仓位差额，`demo/live` 模式走 Bybit 私有账户顾问式预检
- 对 `demo/live` 策略执行而言，当前会先按 `Bybit 私有账户可用余额 × 策略 risk_budget` 收敛可新增仓位，再叠加可复用的现有仓位/旧单释放占用，并按 `instruments-info` 的 `qtyStep / tickSize` 收敛到交易所精度；若这套余额联动后的目标仍低于最小下单门槛，会直接返回显式阻断而不是继续按旧的固定手数预检
- 当这类 `risk_budget` 联动 sizing 被最小下单门槛拦住时，`execution_preview` 当前还会额外返回结构化的 `sizing_risk_budget / sizing_budget_notional / sizing_minimum_required_notional / sizing_available_balance_gap`，方便桌面端和后续 AI 直接展示资金门槛缺口
- 若同一策略在同品种上已经有未成交、且后续会被当前信号复用、改单或撤销的可释放占用委托，当前这部分余额或保证金占用也会一并释放回策略 sizing 与真实预检，避免被自己的旧单误判成“余额不足”
- 对 `perp` 真实顾问式预检而言，当前保证金判断也已按“净新增敞口”计算；减仓与等额反手不会再被整笔名义价值误判成新增保证金占用
- 已新增统一的 `POST /api/strategies/{strategy_id}/execute`，当前会按工作台模式自动分发：`paper` 模式写入纸面成交，`demo/live` 模式向 Bybit 提交真实限价委托
- 对 `perp` 真实委托而言，若当前订单只会减仓或平仓、不会扩大或反手，系统当前会自动补上 `reduceOnly`；即使旧委托数量和价格已经对齐，但缺少该标记，后续执行也会自动改单补齐
- 后台 `strategy runtime` 循环当前已开始负责真实策略自动执行：`running + demo/live` 的策略在信号切换后会自动提交或复用真实策略委托；仅打开策略页或总览页不会触发自动下单
- 当同一条真实策略委托的方向、数量、价格已经与最新信号一致时，系统当前会直接复用旧委托，不再发起无意义改单
- 当真实策略切到 `shadow / paused / watch` 等非执行状态时，后台循环当前会自动撤销该策略遗留的旧真实委托
- 当 `live/demo` 策略配置了 `stop_loss_pct` 且当前真实仓位触发阈值时，系统会自动撤掉遗留策略委托、升成 `P0` 系统提醒，并把策略执行预检改成显式阻断
- 真实委托记录当前已区分 `手动单` 与 `策略单`：`OrderRecord.origin` 会写成 `manual` 或 `strategy`，策略真实委托还会附带 `strategy_id`
- 真实成交记录当前也会尽量继承 `手动单 / 策略单` 来源；当 `orderLinkId` 使用新的 `strategy-{mode}-{strategy_id}-...` 格式时，交易记录可直接还原真实 `strategy_id`
- `live / demo / shadow` 策略当前在信号切换时，会自动生成或替换一条 `system` 来源提醒，方便在提醒中心直接盯住真实模式下的最新策略动作
- 当策略运行信号需要执行但被 Paper 风控拦截时，当前会自动生成 `system` 来源提醒，并在提醒中心与审计流中可见
- 带 `stop_loss_pct` 的 `paper` 策略当前会在本地触发自动止损平仓，并写入 `strategy.paper_stop_loss.executed` 审计事件与 `system` 来源提醒
- 带 `cooldown_minutes` 的 `paper` 策略在止损后会进入冷却期，冷却结束前不会再次给出可执行 `execution_preview`
- `GET /api/control/snapshot` 的策略摘要卡现在也会直接带出“止损保护 N 条 / 冷却中 N 条”的 delta，首页不需要再自己翻日志判断真实模式门禁
- 当后台自动执行因为调度暂停、人工接管或执行异常被拦住时，`GET /api/control/snapshot` 的策略摘要也会直接带出“执行受阻 N 条”，`/metrics` 同步暴露 `bybit_control_strategy_auto_dispatch_blocked`
- 即使当前还没有活动中的 `strategy-auto-dispatch:*` 提醒，只要某条真实策略的顾问式执行预检已经明确被余额、库存或交易所约束挡住，`GET /api/control/snapshot` 和 `/metrics` 当前也会把它计入“执行受阻”
- `GET /api/strategies/live` 返回的每条运行态现在也带 `guard_state / guard_detail`，用于明确区分 `none`、`live_stop_loss`、`cooldown`、`auto_dispatch_blocked`
- `GET /api/strategies/live` 还会附带 `active_order_count / active_order`，用于直接看到当前策略关联的纸面或真实委托，无需再切去交易记录页反查
- 同一份运行态还会附带 `last_execution_event_type / last_execution_at / last_execution_severity / last_execution_detail`，用于追踪最近一次策略执行结果
- 当真实策略信号未变化、但策略委托被外部撤掉或丢失时，后台运行循环现在会自动识别并补单，不需要等信号再次切换
- 运行态里的最近一次执行结果现在也会参考真实委托历史，所以真实单在交易所侧成交/撤销后，策略页能直接看到结果摘要
- 真实策略委托在交易所侧成交 / 撤销 / 拒绝后，当前也会自动补写对应审计事件，后续提醒中心、日志与 AI 复盘可直接复用
- 真实策略委托如果被交易所 `Rejected`，当前还会自动升成 `system` 来源提醒，方便你直接在提醒中心处理
- 当后续真实策略委托重新恢复正常提交 / 成交后，这类拒单提醒当前也会自动收起，不需要一直手动清理
- 若最近一段时间内同一条真实策略连续出现多次 `Rejected`，后台当前还会自动进入“连续拒单冷却”，在冷却结束前暂停自动执行并让策略预检直接返回阻断原因
- `GET /api/control/snapshot` 与 `/metrics` 当前也会同步这层状态，策略摘要首卡会优先提示“连续拒单 N 条”，并额外暴露 `bybit_control_strategy_exchange_rejection_guard` / `bybit_control_strategy_exchange_rejection_cooldown_minutes`
- 若真实策略委托长时间挂单未动，后台当前会自动识别“停滞挂单”，升成 `system` 来源提醒，并在自动执行路径中先撤掉旧单再按当前信号补单
- `/metrics` 当前也已补上 `bybit_control_strategy_stale_order_guard`，总览摘要首卡会在连续拒单之后优先提示“挂单停滞 N 条”
- `GET /api/control/snapshot` 当前还会返回结构化 `execution_health`，把止损保护、冷却中、执行受阻、连续拒单、挂单停滞、仓位偏离聚合成统一摘要，桌面端和后续 AI 可直接消费
- `execution_health` 当前也会显式带出 `public_execution_channel_issue / public_execution_stale / public_execution_stale_seconds`，用于区分“公有行情链路异常”和“私有执行链路异常”
- Bybit 公共 WS 当前也已把短暂空闲的 `recv(timeout=1.0)` 视为正常空转，不再因为 1 秒没消息就把 `linear / spot` 通道误判成断线；真实执行门禁会继续依赖目标品种最近实时行情是否 stale 来决定是否放行
- `execution_health` 当前除 `top_issue` 外，还会附带 `top_issue_strategy_id / top_issue_strategy_name / top_issue_symbol / top_issue_detail / top_issue_recommended_action`，用于直接定位是哪条策略、哪个品种在出问题
- AI 复盘写入 `ReviewDocument.risks` 时，当前也会把 `execution_health.top_issue_detail / top_issue_recommended_action` 一并带上，避免风险列表只剩一句泛化标题
- 当策略运行线程异常或停止时，当前已提供 `POST /api/runtime/strategy-worker/restart`，设置页可直接恢复后台 `strategy runtime` 循环
- 当前也已提供 `GET /api/runtime/strategy-worker/status`，可单独读取后台运行线程的 `running / started_once / stale / stopped / top_issue / recommended_action`
- 桌面端设置页与策略页当前已优先读取 `GET /api/runtime/strategy-worker/status`，恢复按钮与状态文案不再只靠 `execution_health` 间接推断
- `execution_health` 当前也会把 `runtime_worker_running / runtime_worker_issue / runtime_last_error` 一并带出，便于总览、设置页和后续 AI 直接判断后台运行线程是否健康
- 若后台 `strategy runtime` 线程已经停止、但此前曾成功刷新过，当前也会在 `execution_health` 中标记“运行线程未运行”，并升成 `system` 来源提醒
- 设置页当前也会直接显示一条紧凑的运行线程状态说明，区分“正常 / 未启动 / 未运行 / 停滞 / 异常”，无需只靠按钮显隐判断
- 若手动点击“恢复运行线程”但后台线程未能及时停止，当前会直接升成 `P1` 的 `system` 来源提醒“恢复运行线程失败”，并在后续成功恢复后自动收起
- 若后台 `strategy runtime` 线程虽然仍在运行、但长时间没有刷新成功，当前也会在 `execution_health` 中标记 `runtime_worker_stale / runtime_stale_seconds`，并把总览摘要首要问题提升为“运行线程停滞”
- 线程异常或停滞当前也会直接生成 `system` 来源提醒，进入提醒中心和审计流；恢复运行线程后会自动收起并写入恢复事件
- `GET /api/control/snapshot` 的策略摘要首卡与 `GET /api/ops/live` 的 `execution_issue_total` 当前也会把运行线程异常/停滞计入统一执行问题，而不是只统计策略侧门禁
- `GET /api/ops/live` 的 `summary` 当前也会同步带出 `execution_top_issue_symbol / execution_top_issue_detail`，便于提醒中心、日志流与后续 Grafana 看板直接复用
- `GET /api/strategies/live` 现在还会直接返回 `target_position_side / target_position_size / position_alignment / position_alignment_detail`，用于判断当前仓位是否已经与策略目标对齐
- `GET /api/strategies/live` 现在也会直接返回 `current_position_side / current_position_size / current_position_avg_price`，用于明确当前实际仓位，而不是只看说明文案
- `/metrics` 和 `GET /api/control/snapshot` 也会同步这层状态：当前已暴露 `bybit_control_strategy_position_alignment_state`，总览摘要会直接提示“偏离 N”
- 当真实策略仓位处于 `drifted` 且仍在 `running` 时，系统当前会自动生成 `strategy-position-drift:*` 的 `system` 来源提醒；重新对齐后会自动收起并写入恢复审计事件
- 回测页已改成研究工作台，支持按策略筛选、选择周期和区间发起回测，并查看参数快照、AI 提案和当前策略对比
- `POST /api/backtests` 当前已不再写固定 mock 结果，而是会基于 Bybit 历史 K 线走本地最小回测引擎生成结果
- `POST /api/backtests` 当前会自动排队 `generate_backtest_review`，回测完成后由 OpenClaw 继续生成“回测 AI 复盘”
- 已有工作台布局、默认页面、默认模式、卡片顺序的本地持久化和服务端同步
- 工作台状态当前也会保存主盯盘品种的 K 线周期，重开桌面端后会恢复你上次看的 `15m / 1h / 4h / 1d`
- `services/control-api` 已有 FastAPI 本地控制服务
- 行情接口已接入 Bybit 公共 REST + 公共 WebSocket，REST 继续承担首帧与回退职责
- 已新增 `/api/market/live` 聚合快照接口，总览页和行情页会在本地高频拉取，用于近实时联动自选与主图
- 行情页当前已支持 `15m / 1h / 4h / 1d` 多周期切换；其中 `1h` 会优先使用 Bybit 公共 WebSocket 合并最新 K 线，其余周期当前走 REST 历史行情
- 已新增 `/api/ai/live` 聚合快照接口，总览页和 AI 调度页会用它同步调度状态、任务队列和 AI 实时操作
- 已新增 `/api/ops/live` 聚合事件快照接口，把提醒、成交和审计事件统一成一套实时来源
- 已新增 `/api/account/live` 聚合账户快照接口，把账户总览、持仓、未成交委托和历史订单统一成一套实时来源
- 已新增 `/api/account/order-history`，用于读取 Bybit 私有侧最近历史订单，和当前未成交委托分开
- 新闻事件页当前会优先拉取真实 Bybit 公告，并与本地宏观 / 市场 / AI 摘要新闻合并展示
- 高影响 Bybit 公告当前会自动生成 `news` 来源提醒，并与提醒中心、审计和新闻页双向关联
- 新闻事件页当前可直接打开公告原文链接；网页端入口与账户操作仍统一使用 [bybit-global.com](https://www.bybit-global.com/)，程序侧公告读取走 API 数据源
- 已新增 `/api/market/stream`、`/api/ai/stream` 与 `/api/ops/stream` 本地 SSE 流，总览/行情/AI 调度/提醒/记录页优先走流式更新
- 已新增 `/api/account/stream` 本地 SSE 流，交易记录页优先用它同步账户总览、持仓和委托
- 桌面端当前会基于 `ops` / `ai` 实时流触发原生系统通知，用于提示新的 `P0 / P1` 未处理提醒、AI 任务失败/取消和调度降级
- `paper_order.filled`、`paper_order.cancelled_all` 与 `manual_trade.positions_closed_all` 当前也会复用同一套桌面通知桥接，直接提示本地 `paper` 委托和批量平仓结果
- Electron 桌面壳当前已支持托盘常驻，可通过托盘菜单快速显示/隐藏窗口或退出应用
- 行情详情当前已补入 Bybit 公共最近成交流，桌面端会把盘口和最近成交放在同一块盯盘区
- 行情详情当前已优先使用 Bybit 公共 WebSocket 的实时盘口快照；REST 盘口继续作为首帧和回退
- 已有 Bybit 私有 API 的只读账户视图接入与本地配置入口
- 已可通过真实 Bybit 私有 API 返回账户总览、空持仓、空委托等真实账户状态
- 已开始接入 Bybit 私有 WebSocket 只读实时链路，账户总览、持仓、委托和最近成交会优先吃本地私有实时缓存，REST 继续承担首帧和回退；状态接口当前会额外给出 `realtime_stale / realtime_stale_seconds`
- 对真实账户的 `spot` 持仓而言，当前若 Bybit `position/list` 未返回现货仓位，也会自动用钱包 `coin[]` 补出 `ETHUSDT / SOLUSDT` 这类现货持仓视图；已有显式现货持仓记录时会自动去重
- 交易记录页当前已可优先读取 Bybit 私有最近成交历史，并与本地 Paper / 策略成交记录合并展示
- 当前在未配置 Bybit 私有 Key 且模式为 `paper` 时，账户总览、持仓和可用余额不再回退固定 mock，而是根据本地 Paper 成交动态派生
- `POST /api/trades/manual` 与策略运行态补出的纸面成交，当前都会即时回写到 `GET /api/account/overview`、`GET /api/account/positions`、`GET /api/account/order-history` 与 `GET /api/account/live`
- 当前在未配置 Bybit 私有 Key 且模式为 `paper` 时，`GET /api/account/order-history` 也会返回本地派生的 Paper 历史订单
- `POST /api/trades/manual` 当前已接入基础 Paper 风控，会拦截“可用余额不足的买入”和“现货裸卖空”这类明显不合理的纸面单
- 已新增 `POST /api/trades/preview` 统一执行预检接口，手动交易窗口会先显示名义价值、可用余额变化、持仓变化和阻断原因，再决定是否真正写入 `paper`
- `ExecutionPreview` 当前在可推断时也会返回 `recommended_action`，把“阻断原因”进一步补成“下一步建议操作”
- `POST /api/trades/preview` 当前也支持 `demo / live` 顾问式预检，会基于当前 Bybit 私有账户余额和持仓返回动作、仓位影响与阻断原因
- `POST /api/trades/preview` 在 `demo / live` 模式下，当前还会优先读取 Bybit `instruments-info` 做本地下单校验，先检查最小下单量、数量步长、价格步长和最小名义价值，再决定是否允许真实提交
- 当 `demo / live` 顾问式预检因为 Bybit 可用余额 / 保证金不足被拦住时，当前也会在 `blocked_reason` 里直接给出“当前可用余额”和“本次委托约需名义价值”
- 已新增 `POST /api/orders/exchange`，在私有 API 已配置且模式匹配时，可直接向 Bybit 提交真实限价委托
- 已新增 `POST /api/orders/exchange/{order_id}/replace`，可直接修改当前模式下的真实未成交委托价格与数量
- 已新增 `POST /api/orders/exchange/{order_id}/cancel`，可直接撤销当前模式下的真实未成交委托
- 已新增 `POST /api/orders/exchange/cancel-all`，可按当前模式批量撤销全部真实未成交委托
- 已新增 `POST /api/account/exchange/positions/{symbol}/close` 与 `POST /api/account/exchange/positions/close-all`，可直接为真实持仓提交平仓限价委托
- 已新增 `POST /api/account/paper/orders`、`POST /api/account/paper/orders/cancel-all`、`POST /api/account/paper/orders/{order_id}/replace` 与 `POST /api/account/paper/orders/{order_id}/cancel`，当前可在 `paper` 模式把限价单挂入本地委托簿、批量全撤、改价改量或撤单
- 当前本地 `paper` 未成交委托会真实占用可用余额与现货可卖数量，账户总览、持仓和执行预检都会把这部分冻结量一并算进去
- 当前本地 `paper` 限价单会在参考价穿过委托价时自动成交，并同步写入最近成交、历史订单、账户权益与审计事件
- 当前账户页已经按模式隔离：`paper` 模式优先显示本地派生的 Paper 账户；只有切到 `demo/live` 时才优先读取程序侧 Bybit 私有账户
- `GET /api/account/overview`、`/api/account/live`、`/api/account/positions`、`/api/account/orders`、`/api/account/order-history` 当前也支持可选 `mode=paper|demo|live` 查询参数，便于在不改工作台当前模式的前提下直接诊断另一套账户视图
- 当前本地 Paper 账本会继续派生已实现盈亏、胜率、最佳策略和单笔平仓 `pnl`，并同步写回控制总览与最近成交
- `/metrics` 当前已额外暴露 `bybit_control_paper_realized_pnl`、`bybit_control_paper_win_rate`、`bybit_control_paper_open_orders`、`bybit_control_paper_positions`、`bybit_control_paper_available_balance`，以及策略级的 `bybit_control_strategy_live_stop_loss_guard` / `bybit_control_strategy_live_stop_loss_cooldown_minutes`，方便后续接 Grafana 看板
- 交易记录页当前已支持对 `paper` 持仓直接执行一键平仓，系统会按当前参考价写入整笔纸面平仓，并同步刷新账户、持仓与成交
- 已新增 `POST /api/account/paper/positions/close-all`，当前可在 `paper` 模式对全部本地持仓执行批量平仓
- `/api/integrations/bybit-private` 当前会额外返回私有实时链路的启用状态、连接状态、鉴权状态和最近消息时间
- `/api/integrations/bybit-private` 当前也会额外返回 `usdt_balance_diagnostics[]`，把 `UNIFIED / FUND / CONTRACT` 的 USDT 余额拆开，便于直接判断资金到底是“没有”还是“放在别的账户桶里”
- `/api/integrations/bybit-private` 当前还会返回 `realtime_recommended_action`；若私有 REST 正常但私有 WS 出现 `SSL EOF / TLS / 代理` 类错误，建议会直接收敛成“优先检查本机代理、VPN、防火墙、企业网关和 TLS 设置”
- `/api/integrations/bybit-private` 顶层 `last_error` 当前只保留主链路错误，不再被可选 `spot` 类别探测或余额分仓探针失败误污染；这类可选错误会保留在对应诊断项里
- `/api/integrations/bybit-public` 当前会额外返回公共实时链路的 `connected_spot / connected_linear / *_stale / last_error / rest_reachable / rest_last_error / rest_tested_at / recommended_action`，并按当前 watchlist 给出 `watched_symbol_diagnostics[]`
- `watched_symbol_diagnostics[]` 当前也会带 `recommended_action`；当公共 WS 报 `SSL EOF / TLS / 代理` 类错误、但 Bybit REST 仍可达时，建议会直接收敛成“REST 正常、优先检查本机网络/TLS/代理”
- 当公有执行链路异常来自底层传输错误时，当前 `execution_health.top_issue_detail` 与策略级阻断文案也会一并带出最近一条公共 WS `last_error`
- 已有真实交易链路安全探测接口，用于验证 POST 签名链路与交易权限，不会直接放开真实下单
- 已有 OpenClaw 本机配置读取与健康状态探测
- 已接通本机 OpenClaw `AgentJob` 实执行 worker，当前已覆盖日度复盘和回测复盘自动生成
- `cancel_job` / `cancel_all` / `enter_manual_override` 当前会真实终止本地 OpenClaw 任务，不再只是 UI 状态切换
- `/api/integrations/openclaw` 当前会额外返回 `resolved_agent`、worker 运行态、当前任务和最近任务结果
- `AgentJob.idempotency_key` 当前已启用幂等去重，避免同一任务被重复点击后堆满队列
- 高影响策略变更当前在落地后会自动排一条 `review_strategy_change` 任务，不再只停在 `reconcile_change_request` 的一句话摘要
- `review_strategy_change` 完成或失败后，当前会额外写入 `strategy.change.review.completed / failed` 审计事件，便于策略活动时间线直接查看 AI 跟踪结论
- 当真实执行问题被升成 `system` 提醒时，当前还会自动排一条 `review_strategy_issue` 任务，补齐“异常 -> 跟踪 -> AI 写回”的闭环
- `review_strategy_issue` 完成或失败后，当前也会额外写入 `strategy.issue.review.completed / failed` 审计事件，便于策略活动时间线与日志页直接复用
- 上述两类“跟踪完成”审计事件当前也会带 `linked_review_id / linked_review_title / linked_review_period`，后续日志页、策略活动和 AI 复盘可直接复用，不必再从任务上下文反查
- 桌面端策略页当前也支持手动发起 `review_strategy_issue / review_strategy_change`，通过 `POST /api/strategies/{strategy_id}/review` 直接把单策略问题或变更跟踪排进现有 AI 任务流，并同步写入 `strategy.review.requested` 审计事件
- `review_strategy_change / review_strategy_issue` 当前在完成时还会写入一条单策略跟踪复盘，直接进入 `AI 复盘` 与策略活动二级窗
- `AI 复盘` 页当前已按“日报 / 回测复盘”和“策略跟踪”分开展示；`strategy_issue / strategy_change` 不再和主复盘列表混排
- `AI 复盘` 页当前也会补出最近的 `review_strategy_issue / review_strategy_change` 跟踪任务，便于同时看到跟踪过程与最终复盘结果
- `AI 复盘` 页中的单策略跟踪与跟踪任务当前可直接一键打开对应策略活动窗口，方便从复盘跳回策略排障
- `AI 复盘` 页里的“策略跟踪”当前支持按当前策略过滤，便于在单策略排障时快速收拢上下文
- 策略活动二级窗当前也可直接跳回 `AI 复盘` 页，方便在同一条策略上来回查看“最近复盘 / 跟踪任务 / 执行状态”
- 策略活动二级窗与 `AI 复盘` 页中的跟踪任务当前也支持直接重试失败或已取消任务，延续现有 AI 调度页的重试链路
- 跟踪任务在完成后，当前也会带上关联的单策略复盘元数据，策略活动与 `AI 复盘` 页都能直接看出“这条任务产出了哪条复盘”
- 策略活动二级窗与 `AI 复盘` 页中的跟踪任务当前也支持直接打开关联复盘结果；若任务已带 `linked_review_id`，前端会优先聚焦这条结果，而不是只切到复盘页
- 系统日志/审计页当前也会复用这组 `linked_review_*` 元数据，跟踪完成事件可直接一键打开对应复盘结果
- 对通用 `openclaw.job.completed` 事件，日志页当前也会兼容读取 `review_id / review_title / review_period`，避免只有策略跟踪任务能直达复盘结果
- `AI 调度` 页中的任务队列当前也会直接复用 `linked_review_* / retry_* / strategy_id` 这些顶层字段，便于近场重试和结果直达，不必再从 `context` 猜测
- `AI 调度` 页的任务队列当前也支持从任务直接 `打开策略`，方便从结果或任务就近回到单策略排障
- 总览页与 `AI 调度` 页里的实时 AI 事件流当前也支持直接打开关联复盘结果；若事件没有结果但带 `strategy_id`，则可直接跳到对应策略活动
- 复盘结果详情小窗当前也会直接显示 `source_job_*` 元数据，并支持从结果反向打开对应 AI 任务，便于顺着“结果 -> 任务 -> 策略”活动链排查
- 策略活动二级窗与 `AI 复盘` 页里的跟踪复盘列表当前也支持直接 `打开任务`，不需要先点进结果详情再反查
- AI 调度页当前已支持对 `failed` / `cancelled` 的任务直接发起重试，并保留源任务关联与重试次数
- AI 复盘当前已支持结构化 JSON 输出解析；OpenClaw 若返回 `summary / highlights / risks / proposals`，系统会直接落库并与本地启发式提案合并
- `GET /api/ai/reviews` 当前已支持按 `strategy_id / period` 过滤，后续复盘页若切到服务端过滤可直接复用
- 策略页、回测页与 `AI 复盘` 页当前都已开始优先复用 `GET /api/ai/reviews?strategy_id=...` 这类服务端过滤，而不是只在前端全量筛选
- AI 复盘当前还会自动把 `execution_health.top_issue` 与运行线程问题并入风险列表，避免复盘只看到收益结果而漏掉真实执行门禁
- 当前发给 OpenClaw 的日度复盘 / 回测复盘提示词，也会显式附带执行健康摘要与运行线程状态，避免模型只基于收益数字做总结
- 同时写入任务队列的 `generate_daily_review / generate_backtest_review` 上下文当前也会带 `execution_health / execution_top_issue / execution_top_issue_symbol / execution_top_issue_detail / runtime_worker_top_issue`，方便后续审计和重试定位
- 这两类复盘上下文当前还会附带 `execution_top_issue_strategy_activity / review_strategy_activity`，把问题策略或当前复盘策略最近的运行态、提醒、委托、成交与审计事件压成紧凑摘要，便于 OpenClaw 直接引用
- 这份紧凑策略活动摘要当前也会显式带 `runtime.next_action` 和结构化 `execution_preview` 关键信息，包括 `recommended_action` 与 `sizing_*` 资金门槛字段，便于后续复盘与排障直接读取当前阻断建议和余额缺口
- 当前已提供 `GET /api/strategies/{strategy_id}/activity`，可按单条策略聚合最近运行态、真实/纸面委托、成交、提醒和审计事件，后续策略页二级小窗与 AI 复盘可直接复用
- 当工作台当前 `selected_mode` 与该策略自身模式不一致时，这条活动接口当前也会优先补齐“按策略自身模式生成的 `execution_preview`”，避免查看单策略排障时还要手动切工作台模式
- 这条策略活动接口当前也会附带最近的 `review_strategy_change / generate_backtest_review` 等 AI 跟踪任务摘要，便于策略页直接查看最近 AI 动作
- 这条策略活动接口当前也会附带最近的 `review_strategy_issue` 摘要，便于直接回看单策略最近一次异常跟踪
- 同时这条接口当前也会带最近的单策略 AI 复盘摘要，便于在同一个二级窗里同时查看“最近复盘 + 最近任务 + 最近执行”
- 这条策略活动接口当前还会额外带 `latest_primary_review / latest_tracking_review / latest_tracking_job`，前端无需再手动切整份列表就能做轻摘要
- 前端当前会根据 `freeze_publish` / `manual_override` 直接禁用发布建议的“接受”动作，并给出明确提示
- 策略类 `ChangeRequest` 当前在落地后会自动排一个 `reconcile_change_request`，用于补齐 AI 执行记录
- 已有 Grafana-ready 监控接入：本地服务暴露 `/metrics` Prometheus 指标端点，并提供 Grafana 集成状态接口
- 前端当前在“设置”页展示 Grafana 接入配置，并在“AI 调度”页提供监控预览小窗
- 提醒中心、交易记录、系统日志/审计三页已开始共用统一 ops 实时事件流，并支持筛选当前品种 / 状态 / 来源
- `alert.rule.update` 当前会直接落地到自选品种，并在实际涨跌超过阈值时自动生成去重后的市场提醒
- 市场提醒当前会同步维护独立 `AlertRule`，记录阈值、冷却时间、最近一次触发时间与触发幅度
- `GET /api/alert-rules` 当前可返回全部自选提醒规则；同一规则在冷却时间内即使已确认，也不会被重复刷屏
- 已有 `control-api` 集成测试，覆盖健康检查、工作台同步、私有 API mock 回退、调度开关、ChangeRequest / Backtest / AgentJob / 手动交易边界

## 边界约定

- 桌面端是量化交易控制端，不是交易执行引擎
- 最终交易执行必须由量化层完成，不能绕过风控直接打到 Bybit
- OpenClaw 只接受结构化任务，不直接执行交易
- 浏览器网页登录、账户设置、API Key 创建统一使用 `https://www.bybit-global.com/`
- 程序侧行情、交易、公告接口继续使用 `api.bybit.com` 或其他 API 域名
- 网页入口和 API 入口用途不同，文档和代码里必须主动区分

## 快速启动

### 1. 安装前端依赖

```bash
pnpm install
```

### 2. 安装本地控制服务依赖

```bash
python3 -m pip install -r services/control-api/requirements.txt
```

### 3. 启动本地控制服务

```bash
python3 services/control-api/main.py
```

默认监听 `http://127.0.0.1:8787`。

### 4. 启动桌面控制端开发环境

```bash
pnpm dev:desktop
```

这条命令会同时启动本地控制服务、Vite 渲染进程和 Electron 桌面壳。

### 5. 执行验证命令

```bash
pnpm build:desktop
pnpm lint:desktop
pnpm test:control-api
pnpm verify:backend
```

## 测试与交付原则

- 后续开发默认采用“先实现、再测试、测试通过后再交付”
- 每次交付前，至少执行与改动范围对应的验证，例如前端构建、后端启动、接口联调、关键交互回归
- 如果环境限制导致某些测试无法执行，交付时必须明确说明缺失项和剩余风险

## 当前验证结果

- `pnpm --dir apps/desktop build` 已通过
- `pnpm --dir apps/desktop lint` 已通过
- `python3 -m py_compile services/control-api/*.py` 已通过
- `python3 -m unittest discover -s services/control-api/tests -p 'test_*.py' -v` 已通过
- `python3 services/control-api/main.py` 已可在 Python 3.9 环境启动
- `GET /api/market/watchlist`、`GET /api/market/{symbol}` 已验证能返回 Bybit 公共行情
- 已验证 Bybit 公共 WebSocket 可连接，并可把 ticker / kline 更新写回总览页和行情页
- `GET /api/market/live` 已验证可同时返回当前自选列表与主图品种详情
- `GET /api/market/live?symbol=BTCUSDT&timeframe=15m|1h|4h|1d` 已验证会返回对应周期；`1h` 当前可返回 `source=bybit_ws`，其余周期当前返回 `source=bybit_rest`
- `GET /api/ai/live` 已验证可同时返回 AI 调度状态、任务队列和活动流
- `GET /api/ops/live` 已验证可同时返回提醒、成交和审计事件快照
- `GET /api/account/live` 已验证可同时返回账户总览、持仓、未成交委托和历史订单快照
- `GET /api/account/order-history` 已验证可返回真实私有历史订单，便于后续做二级小窗或更细筛选
- `GET /api/strategies/live` 已验证可返回实时策略运行信号，并且同一信号不会重复生成纸面成交
- `GET /api/strategies/stream` 已验证可返回 SSE 策略运行态快照
- `POST /api/runtime/strategy-worker/restart` 已验证可清除线程错误态并重新拉起后台 `strategy runtime` 循环
- `GET /api/control/snapshot`、`GET /api/ops/live` 与 `/metrics` 已验证会同步暴露“运行线程停滞”状态
- `GET /api/strategies/{strategy_id}/execution-preview?mode=live` 已验证会返回真实模式下的策略执行预检
- `POST /api/strategies/{strategy_id}/execute` 已验证会按当前模式自动分发：`paper` 模式同步目标仓位，`live` 模式会向 Bybit 提交真实委托
- 后台 `strategy runtime` 循环已验证可在 `running + live` 策略信号切换后自动提交真实策略委托；`GET /api/strategies/live` 只刷新运行态，不会顺手自动下单
- 后台 `strategy runtime` 循环已验证会在策略切入 `shadow` 时自动撤销遗留真实策略委托
- 当策略执行因 Paper 余额不足等原因被拦下时，已验证会同时写入 `risk.blocked_order` 审计事件与 `system` 来源提醒
- `paper` 策略触发本地止损后，已验证会自动平仓并进入冷却期；冷却结束前不会重新生成可执行预估
- `GET /api/integrations/bybit-private` 已验证会返回私有实时链路状态，并区分 REST 配置状态与 WS 连接状态
- `GET /api/integrations/bybit-public` 已验证可返回公共实时链路状态、watchlist 级符号诊断和最近错误
- `GET /api/news` 已验证会合并真实 Bybit 公告与本地新闻事件
- `GET /api/market/stream`、`GET /api/ai/stream`、`GET /api/ops/stream` 已验证可返回 SSE 快照事件
- `GET /api/account/stream` 已验证可返回 SSE 快照事件
- `GET /api/market/live` 当前已验证会把 `recent_public_trades` 一并返回，用于最近成交面板
- 桌面端通知桥接当前已完成 Electron 主进程与 preload 接线；高优先级提醒和 AI 失败任务会复用现有实时流触发原生通知
- `POST /api/market/watchlist`、`DELETE /api/market/watchlist/{symbol}` 已验证可新增/移除自选，并联动更新当前聚焦品种
- `POST /api/change-requests` 携带 `alert.rule.update` 已验证可更新自选品种提醒阈值，并在 `/api/market/live` 联动时生成去重后的市场提醒
- `GET /api/alert-rules` 已验证会返回自选规则阈值、冷却时间与最近一次触发记录
- `GET /api/account/overview`、`GET /api/account/positions`、`GET /api/account/orders` 已验证在未配置私有 Key 且当前模式为 `paper` 时，会返回本地派生的 Paper 账户与持仓；非 Paper 模式仍保持 mock 回退
- `GET /api/account/overview`、`GET /api/account/positions`、`GET /api/account/orders` 已验证可返回真实 Bybit 空账户状态，不再错误回退 mock
- `GET /api/trades` 已验证在已配置私有 Key 时可返回真实最近成交历史，并保留本地 Paper 成交记录
- 当前环境内已验证 Bybit 私有 WebSocket 可连接并完成鉴权；真实空账户场景下会返回 `connected=true`、`authenticated=true`
- `POST /api/integrations/bybit-private/probe-trade` 已验证命中真实 Bybit 交易 POST 链路，并返回参数校验拒绝结果
- `GET /api/integrations/grafana`、`GET /metrics` 已验证可用
- `GET /api/workspace/preferences`、`POST /api/workspace/preferences` 已验证可用
- `POST /api/change-requests`、`POST /api/ai/scheduler/commands`、`POST /api/trades/manual` 已验证可用
- `POST /api/trades/preview` 已验证会返回统一执行预检结果，并与 `POST /api/trades/manual` 共享同一套 Paper 风控结论
- `POST /api/trades/preview` 已验证在 `live` 模式下可返回真实账户顾问式预检，并会在私有 API 模式不匹配时明确阻断
- `POST /api/orders/exchange` 已验证可返回真实 Bybit 委托记录，并同步刷新当前未成交委托列表
- `POST /api/orders/exchange/{order_id}/replace` 已验证可修改真实未成交委托，并同步刷新当前订单列表与审计事件
- `POST /api/orders/exchange/{order_id}/cancel` 已验证可撤销真实未成交委托，并同步从当前订单列表移除
- `POST /api/orders/exchange/cancel-all` 已验证可批量撤销真实未成交委托，并同步清空当前订单列表
- `POST /api/account/exchange/positions/{symbol}/close` 已验证可按当前持仓方向自动生成真实平仓限价委托
- `POST /api/account/exchange/positions/close-all` 已验证可批量为当前真实持仓提交平仓委托
- `POST /api/account/paper/orders` 已验证可把 `paper` 限价单挂入本地委托簿，并即时反映到 `GET /api/account/orders` 与 `GET /api/account/overview`
- `POST /api/account/paper/orders/cancel-all` 已验证可批量取消当前全部本地 `paper` 委托，并同步写回历史订单与冻结量
- `POST /api/account/paper/orders/{order_id}/replace` 已验证可修改本地 `paper` 限价委托，并在重算冻结量后继续更新到账户总览和未成交委托列表
- `POST /api/account/paper/orders/{order_id}/cancel` 已验证会把 `paper` 未成交委托移入历史订单，并释放冻结的可用余额 / 可卖数量
- `POST /api/account/paper/positions/close-all` 已验证可批量平掉全部本地 `paper` 持仓，并同步刷新权益、持仓和最近成交
- `POST /api/ai/proposals/{proposal_id}/action` 已验证可接受 AI 提案，并自动生成 ChangeRequest 或回测结果
- 常见策略类 `ChangeRequest` 已验证会被本地 mock 编排器自动落实到策略状态、参数和风险预算
- `POST /api/ai/jobs` 已在当前环境内验证会被 OpenClaw worker 自动认领、执行并写回复盘
- `POST /api/ai/jobs/{job_id}/retry` 已由桌面端接入，可对失败或已取消任务重新排队
- 结构化 JSON 形式的 AI 复盘已验证能被解析，并与本地回测启发式提案合并入库
- `POST /api/ai/scheduler/commands` 已在当前环境内验证可真实终止正在运行的 OpenClaw 任务
- `POST /api/backtests` 已在当前环境内验证会自动排队 `generate_backtest_review`，并生成带提案的“回测 AI 复盘”

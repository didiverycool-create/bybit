# Bybit 量化交易控制端

这是一个中文桌面端优先的 Bybit 量化交易控制端项目。

当前阶段的目标不是做“人工交易工作台”，而是做一个让你统一看行情、控策略、看回测、管 AI 调度、查审计和历史记录的桌面控制中枢。首页已经开始按“量化交易正在进行时最关注的点”来组织，控制动作和布局偏好则单独收进设置页。自动交易最终仍由量化层负责，OpenClaw 只做本地编排、复盘、调参与状态回写。

当前项目不再为 Web 端排期，后续优先把桌面端背后的真实量化内核、真实执行风控和编排闭环做实。

## 文档入口

- [架构总览](./docs/架构总览.md)
- [接口契约](./docs/接口契约.md)
- [开发约定](./docs/开发约定.md)
- [实施路线与接手清单](./docs/实施路线与接手清单.md)

## 关键回归命令

README 这里只保留常用入口，详细验证口径、产物和当前状态统一维护在 [docs/实施路线与接手清单](./docs/实施路线与接手清单.md#4-已验证命令)。

- 行情主图：`pnpm verify:market-switch`、`pnpm smoke:market-switch`、`pnpm report:market-switch`、`pnpm report:market-switch:json`、`pnpm report:verify-market-switch`、`pnpm report:verify-market-switch:json`
- 策略活动：`pnpm verify:strategy-activity`、`pnpm smoke:strategy-activity`、`pnpm report:strategy-activity`、`pnpm report:strategy-activity:json`、`pnpm report:verify-strategy-activity`、`pnpm report:verify-strategy-activity:json`
- 相关验证产物、历史基线与当前状态统一以实施路线文档为准，README 不再重复展开。

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
- 设置页当前也支持直接编辑并保存 `bybit_web_entry / api_base_url / default_mode / notification_channels / notification_quiet_hours_* / product_language / grafana_*`，保存后会立即刷新公共链路、Grafana 接入状态与审计视图
- 同内容的普通桌面通知当前会自动做 2 分钟短时去重，避免同类提醒短时间重复刷屏；测试通知与 `critical` 级提醒继续直通，不受这条去重影响
- 设置页与“账户详情”窗口当前也会直接展示 Bybit 公共/私有链路诊断；当出现“REST 正常但 WS/TLS 失败”时，会直接给出本机代理、VPN、防火墙、企业网关与 TLS 配置方向的恢复建议
- 设置页当前也会直接展示 Bybit 私有只读配置文件路径、仓库示例文件路径，以及 OpenClaw 本机配置路径与命令可用性；在 Electron 桌面端里还可直接打开配置目录或示例文件，避免排查时只知道“未配置”却不知道该去哪里补
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
- 回测页“关联 AI 上下文”当前也支持直接打开这轮回测对应的 AI 复盘结果、来源任务，并可在同一处就地接受/拒绝这轮复盘带出的提案，减少在策略页、AI 复盘页和回测页之间来回切换
- 若在任意页面接受的是 `backtest_request`，桌面端当前也会自动聚焦到新生成的回测结果，不再只提示“已创建回测”后让用户手动再找一次
- `POST /api/backtests` 当前已不再写固定 mock 结果，而是会基于 Bybit 历史 K 线走本地最小回测引擎生成结果
- `POST /api/backtests` 与接受 `backtest_request` 提案时，回测周期当前都会统一校验为 `15m / 1h / 4h / 1d`，避免无效周期把脏参数带进回测链路
- `POST /api/backtests` 的 `data_range` 当前既支持 ISO 区间，也支持 `最近 45/90/180 天` 这类相对中文区间，并会真实驱动 K 线取数窗口，而不是一律回退默认 90 天
- 桌面端回测页当前也已改用 `最近 30/90/180 天` 相对区间 preset；若“按建议重跑”给出 `1d` 或自定义区间，表单会直接保留并显示这组推荐参数
- `BacktestRun` 当前还会显式返回 `requested_range_start / requested_range_end`，把 `最近 180 天` 这类相对区间在回测创建时固化成绝对请求窗口，便于后续 AI 复盘、桌面端和人工排查复用同一时间基准
- `BacktestRun` 当前还会显式返回 `retrieved_window_completion_pct / used_window_completion_pct`，分别表示“实际取样窗口”与“最终回测窗口”相对目标请求窗口的覆盖率，便于桌面端和 AI 直接判断这次样本覆盖到了多少
- `BacktestRun` 当前还会显式返回 `history_source=exchange_history|market_detail_fallback`，用于区分本次结果是否来自交易所历史 K 线，还是因为历史拉取失败/样本不足而回退到工作台行情快照样本
- `BacktestRun` 当前还会显式返回 `history_source_reason=none|exchange_fetch_failed|insufficient_exchange_samples` 与 `history_source_detail`，用于说明这次为何回退到工作台行情快照样本，便于桌面端、AI 复盘和人工排障直接看到“是历史接口报错，还是交易所历史样本本身不足”
- `BacktestRun` 当前还会显式返回 `history_source_recommended_data_range / history_source_recommended_timeframe / history_source_recommended_action`，把这类“快照回退”下一步该怎么补样本或恢复后重跑也结构化出来，不再只藏在备注文案里
- `BacktestRun` 当前还会显式返回 `decision_readiness=ready|sample_incomplete|research_only`、`decision_readiness_detail`、`decision_recommended_data_range / decision_recommended_timeframe` 与 `decision_readiness_action`，把“这次结果能不能直接用于调参/上线判断”以及“该按什么参数重跑”都收成统一门禁，便于桌面端、AI 和人工排查直接复用
- `BacktestRun` 当前还会显式返回 `source_change_request_id / source_backtest_id / source_review_id / source_proposal_id / trigger_reason`，把这轮回测的来源链路结构化保留下来，明确区分“手动创建 / 由哪条变更触发 / 门禁重跑 / 复盘建议重跑 / 接受提案”
- 本地回测入口当前会优先按目标窗口分页拉取 Bybit 历史 K 线；`requested_candle_limit` 表示当前回测样本上限，而不是单页接口上限
- 若目标区间在当前周期下理论需要的 K 线数量超过当前回测样本上限，`BacktestRun` 当前会显式返回 `requested_candle_estimate / requested_candle_limit / retrieved_candle_count / used_candle_count / history_truncated`，提醒本次回测样本窗口已被截断
- `BacktestRun.history_gap_reason` 当前会显式区分 `sample_cap` 和 `insufficient_history`：前者表示被当前回测样本上限截断，后者表示交易所当前可用历史本身不足
- `BacktestRun` 当前还会显式返回 `retrieved_range_start / retrieved_range_end / used_range_start / used_range_end`，用于说明本次实际取到的历史样本覆盖到了哪段时间，以及最终参与本地回测的窗口起止
- 若样本窗口已被截断，`BacktestRun` 当前还会显式返回 `full_window_recommended_data_range / full_window_recommended_timeframe / full_window_recommended_action`，让桌面端和人工排查直接知道当前应是“保持区间改粗周期”还是“先缩短区间再回测”
- 桌面端回测页和策略页“最新回测”摘要当前也会直接展示这类“样本截断”提示，不必再从备注文案里手动辨认
- 本地回测引擎当前也会按持仓逐 bar 盯市生成权益曲线，`max_drawdown` 不再只按平仓后的已实现权益计算
- 本地回测引擎当前会按逐 bar 权益收益率年化 `Sharpe`，不再按成交笔数近似
- 当回测区间内没有真实触发入场信号时，本地回测引擎当前也会按基础价格路径生成连续 fallback 权益曲线，而不是只在最后一根 K 线跳变
- 这类 fallback 参考路径当前不会再被记成 1 笔真实交易，`trades / win_rate` 会保持为 `0`，并在回测备注里明确标注“仅供研究参考”
- 当回测结果属于 `reference_only` 时，回测 AI 启发式提案当前不会再给激进调参建议，而是会默认回退成“扩大样本验证”的保守回测请求
- `BacktestRun` 当前也会显式返回 `reference_only`，桌面端回测列表和详情可直接区分“真实成交样本”与“仅参考路径”
- `BacktestRun` 当前也会显式返回 `sample_quality=reference_only|low_sample|sufficient`，供桌面端和后续 AI 直接复用统一样本质量口径
- 当 `history_truncated=true` 时，回测 AI 复盘与默认提案当前也会把它视为“样本窗口未完整覆盖”的保守门禁：若仍有更粗周期可完整覆盖，就优先保持同一 `data_range` 并切周期；若连最粗周期也无法完整覆盖，则会明确改成“缩短到当前回测样本上限内可完整覆盖的区间”，而不是继续给误导性的调参或上线倾向结论
- `generate_backtest_review` 当前也会显式带上 `reference_only` 上下文；当样本仅为参考路径时，AI 复盘提示词和默认风险项都会明确要求“不要把收益率 / 胜率 / Sharpe 直接视为可上线结论”
- 即使不是 `reference_only`，当真实成交样本少于 `5` 笔时，回测 AI 启发式提案当前也不会直接给风控/上线倾向建议，而是会默认回退成“扩大样本验证”的保守回测请求；复盘提示词和默认风险项会明确标注“低样本真实成交”
- 若 `reference_only / low_sample` 回测复盘的模型输出仍夹带 `risk_update / param_update / publish_recommendation` 等激进 JSON 提案，后端当前也会直接过滤；若模型同时给出了确实推进样本收集的 `backtest_request`，则会保留这条安全请求
- 若 `history_source=market_detail_fallback`，回测 AI 复盘当前也会自动进入同一套保守门禁：优先提示“恢复交易所历史后重跑”，不直接放行激进调参或上线倾向提案；若同时带有 `history_source_reason / history_source_detail`，prompt、fallback review 与桌面端会继续显示具体回退原因
- 若 `history_source=market_detail_fallback`，默认保守 `backtest_request` 当前也会按 `history_source_reason` 自动细分：历史拉取报错时保持原区间/周期等待恢复后重跑；交易所样本不足时优先给出补样本用的区间/周期建议
- 桌面端和 `generate_backtest_review` prompt 当前也会直接展示这条 `decision_readiness` 门禁，不必再手动综合 `reference_only / low_sample / history_truncated / history_source` 四组字段
- 当这类保守补样本请求发现当前区间已经是 `最近 180 天` 时，后端当前会自动切到更高频周期继续补样本，避免重复提交完全相同的回测请求
- `POST /api/backtests` 当前会自动排队 `generate_backtest_review`，回测完成后由 OpenClaw 继续生成“回测 AI 复盘”
- 已有工作台布局、默认页面、默认模式、卡片顺序的本地持久化和服务端同步
- 工作台状态当前也会保存主盯盘品种的 K 线周期，重开桌面端后会恢复你上次看的 `15m / 1h / 4h / 1d`
- 工作台状态当前也会继续保存回测页聚焦回测、当前聚焦的 replay review、当前聚焦的 AI 调度任务、当前打开的复盘结果详情小窗、策略页当前打开的活动/跟踪二级面板与跟踪草稿、当前定位的提案与 `ChangeRequest`、`仅当前策略/全策略` 回测筛选、复盘跟踪范围，以及提醒/成交/审计筛选器与审计搜索词，便于重开桌面端或新线程接手后直接恢复上次的排障上下文
- 若策略页编辑器当前已经改过参数或风险预算但还没提交，这组未保存草稿当前也会继续写进工作台状态；同一策略页里切去看活动/跟踪再回来时，草稿不会丢；如果上次关闭时编辑器本身就是打开的，控制端恢复时也会优先按这组草稿所属策略切回编辑器上下文。但如果已经离开策略页或切到了别的策略，控制端会自动清掉这组草稿，避免串策略恢复
- Electron 桌面壳当前也会保存主窗口大小、位置和最大化状态；若上次窗口落在已经不存在的显示器区域，启动时会自动回退到安全默认尺寸
- `services/control-api` 已有 FastAPI 本地控制服务
- 行情接口已接入 Bybit 公共 REST + 公共 WebSocket，REST 继续承担首帧与回退职责
- 已新增 `/api/market/live` 聚合快照接口，总览页和行情页当前会优先用它做近实时联动，不再额外轮询一份慢版 watchlist
- 行情页当前已支持 `15m / 1h / 4h / 1d` 多周期切换；四个周期都会优先复用 Bybit 公共 WebSocket 的最新 K 线快照，只在本地缓存缺失时才回退到 REST 历史行情
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
- 对 `scheduler.command.cancel_all` 这类批量调度命令，桌面端系统通知当前也会附带结构化影响面摘要，不再只弹一条泛化“命令已执行”
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
- 对 `generate_backtest_review` 完成事件，系统日志/审计页当前也会直接复用 `backtest_id / source_* / trigger_reason / decision_*` 顶层字段，允许从完成日志就地打开这轮回测、来源链路与复盘结果
- 对 `generate_backtest_review` 的 `started / failed / cancelled` 生命周期事件，系统日志/审计页当前也会继续复用同一组 `backtest_id / source_* / trigger_reason / decision_*` 顶层字段，便于在任务尚未完成时就近排障和追溯来源
- 当上述回测复盘任务被人工或系统请求重试时，`openclaw.job.retry_requested` 当前也会补齐同一组 `backtest_id / source_* / trigger_reason / decision_*` 顶层字段，方便从“请求重试”这一步开始就近追溯来源链路
- 对 `generate_backtest_review` 的 `openclaw.job.queued` 入队事件，当前也会补齐同一组 `backtest_id / source_* / trigger_reason / decision_*` 顶层字段；同一 `idempotency_key` 的重复创建不会重复写入新的 `queued` 事件
- `scheduler.command` 针对单任务的取消/人工接管命令当前也会补齐同一组 `backtest_id / source_change_request_id / source_* / trigger_reason / decision_*` 顶层字段，并附带 `cancelled_job_ids / cancelled_job_count / scheduler_status / freeze_publish`，方便日志页直接近场排障
- `scheduler.command` 的 `cancel_all` 当前还会额外补齐 `cancelled_job_types / cancelled_strategy_ids / cancelled_backtest_ids / cancelled_source_change_request_ids / cancelled_source_* / cancelled_trigger_reasons / cancelled_decision_readiness_values`，并把摘要收成“本次终止了哪些任务类型、影响了哪些回测链路”
- `POST /api/ai/scheduler/commands` 当前返回的回执也会直接带 `summary / cancelled_* / source_change_request_id / source_* / decision_*`，桌面端发送命令后会优先展示这条结构化影响面，而不是只回显原始 reason
- `AI 调度` 页里的任务队列、实时 AI 事件流，以及策略活动二级窗中的任务列表，当前也会直接复用 `backtest_id / source_*` 元数据，允许从任务或完成事件就地打开这轮回测、来源回测、来源复盘和来源提案
- 总览页“AI 实时日志”当前也会直接复用当前任务与审计事件里的 `job_id / backtest_id / source_* / cancelled_*`，允许从首页近场打开任务、回测、来源链路和单策略活动
- 状态窗口与 `AI 调度` 页顶部当前也会直接展示最近一次 `scheduler.command` 的结构化摘要、影响面与近场跳转，不必再先翻实时流或审计列表
- `GET /api/control/snapshot`、`GET /api/ai/scheduler`、`GET /api/ai/live`、`GET /api/ops/live` 当前也会统一返回 `latest_scheduler_command`；桌面端状态窗口与 `AI 调度` 页顶部优先消费这条后端快照字段，并支持直接跳到来源变更，不再只靠前端从审计流临时派生
- 复盘结果详情小窗当前也会直接显示 `source_job_*` 元数据，并支持从结果反向打开对应 AI 任务，便于顺着“结果 -> 任务 -> 策略”活动链排查
- 策略活动二级窗与 `AI 复盘` 页里的跟踪复盘列表当前也支持直接 `打开任务`，不需要先点进结果详情再反查
- 策略活动二级窗里的最近审计事件当前也会直接复用 `job_id / linked_review_id / backtest_id / source_* / cancelled_*`，允许从单策略排障窗口就地打开任务、复盘结果、回测与来源链路
- AI 调度页当前已支持对 `failed` / `cancelled` 的任务直接发起重试，并保留源任务关联与重试次数
- AI 复盘当前已支持结构化 JSON 输出解析；OpenClaw 若返回 `summary / highlights / risks / proposals`，系统会直接落库并与本地启发式提案合并
- `GET /api/ai/reviews` 当前已支持按 `strategy_id / backtest_id / period` 过滤，后续复盘页与回测页都可直接复用服务端过滤，不必退回前端全量筛
- 策略页、回测页与 `AI 复盘` 页当前都已开始优先复用 `GET /api/ai/reviews?strategy_id=...` 这类服务端过滤，而不是只在前端全量筛选
- 回测页“关联 AI 上下文”当前已按 `backtest_id` 对齐到当前选中的回测结果，不再复用策略级最新复盘去误显示上一轮回测或日报
- 策略页“最新回测”和回测详情当前也会直接展示这轮 `BacktestRun` 的“来源链路”，便于追溯它到底是手动发起、由哪条 `ChangeRequest` 触发、按门禁建议重跑，还是由某条 `backtest_request` 提案触发
- 回测 `ReviewDocument` 当前也会显式保留 `source_change_request_id / source_backtest_id / source_review_id / source_proposal_id / trigger_reason`，`AI 复盘` 页、复盘结果详情和策略活动二级窗都能直接显示并跳转这条“来源链路”；若来源是某条变更或提案，前端也能直接跳回对应入口
- 对带 `decision_readiness* / decision_recommended_*` 的回测复盘，复盘结果详情与策略活动二级窗当前也会直接显示“结论门禁”并支持就地“按建议重跑”，不必强制绕回回测页再继续推进
- 复盘结果详情小窗当前也会像主复盘页一样直接展示这轮结果附带的提案，并支持就地“接受 / 拒绝 / 查看生成回测 / 查看生成复盘”，不需要再先切回 `AI 复盘` 页
- 若这轮回测对应的 `generate_backtest_review` 任务还没写回复盘结果，桌面端当前也会直接显示对应 AI 任务状态，并支持一键打开 AI 调度或重试失败任务
- AI 复盘当前还会自动把 `execution_health.top_issue` 与运行线程问题并入风险列表，避免复盘只看到收益结果而漏掉真实执行门禁
- 当前发给 OpenClaw 的日度复盘 / 回测复盘提示词，也会显式附带执行健康摘要与运行线程状态，避免模型只基于收益数字做总结
- 同时写入任务队列的 `generate_daily_review / generate_backtest_review` 上下文当前也会带 `execution_health / execution_top_issue / execution_top_issue_symbol / execution_top_issue_detail / runtime_worker_top_issue`，方便后续审计和重试定位
- 这两类复盘上下文当前还会附带 `execution_top_issue_strategy_activity / review_strategy_activity`，把问题策略或当前复盘策略最近的运行态、提醒、委托、成交与审计事件压成紧凑摘要，便于 OpenClaw 直接引用
- 回测复盘任务当前会在入队时就固化 `review_strategy_activity`；生成 `generate_backtest_review` 提示词和写回 `ReviewDocument` 时会优先复用这份上下文，不再因稀疏上下文临时拉取 Bybit 实时链路。仅 `generate_daily_review` 仍保留最新执行健康兜底
- 这份紧凑策略活动摘要当前也会显式带 `runtime.next_action` 和结构化 `execution_preview` 关键信息，包括 `recommended_action` 与 `sizing_*` 资金门槛字段，便于后续复盘与排障直接读取当前阻断建议和余额缺口
- 当前已提供 `GET /api/strategies/{strategy_id}/activity`，可按单条策略聚合最近运行态、真实/纸面委托、成交、提醒和审计事件，后续策略页二级小窗与 AI 复盘可直接复用
- 当工作台当前 `selected_mode` 与该策略自身模式不一致时，这条活动接口当前也会优先补齐“按策略自身模式生成的 `execution_preview`”，避免查看单策略排障时还要手动切工作台模式
- 这条策略活动接口当前也会附带最近的 `review_strategy_change / generate_backtest_review` 等 AI 跟踪任务摘要，便于策略页直接查看最近 AI 动作
- 这条策略活动接口当前也会附带最近的 `review_strategy_issue` 摘要，便于直接回看单策略最近一次异常跟踪
- 这条策略活动接口当前也会附带最近的单策略提案 `recent_proposals`；策略活动二级窗可直接显示最近提案、接受前的人工跟进提示、已生成的变更/回测/复盘，以及一键 `打开提案 / 生成变更 / 生成回测 / 生成复盘 / 接受 / 拒绝`
- 同时这条接口当前也会带最近的单策略 AI 复盘摘要，便于在同一个二级窗里同时查看“最近复盘 + 最近任务 + 最近执行”
- 这条策略活动接口当前还会额外带 `latest_primary_review / latest_tracking_review / latest_tracking_job`，前端无需再手动切整份列表就能做轻摘要
- 前端当前会根据 `freeze_publish` / `manual_override` 直接禁用发布建议的“接受”动作，并给出明确提示
- `publish_recommendation` 当前在后端接受时也要求 payload 带有效 `recommendation`；若缺失结构化建议，后端会直接拒绝，不会把提案状态提前打成 `accepted`
- `script_patch_proposal` 当前接受后会明确转成 `queued` 状态的 `ChangeRequest`，并补写 `change_request.manual_followup_required` 审计事件，表示这类脚本补丁仍需后续人工或编排链落实，不会再被误认为“已自动应用”
- 这类 `script_patch_proposal -> ChangeRequest` 当前也会直接写回 `manual_followup_required / manual_followup_detail`；策略页“待落实 ChangeRequest”列表与“当前定位变更”详情会直接显示 `需人工跟进`，不必再只靠审计事件猜状态
- `ChangeRequest` 当前也会显式保留 `source_review_id / source_proposal_id / trigger_reason`；策略页“待落实 ChangeRequest”列表在接受提案后会直接定位到新建变更，并支持一键跳回来源提案
- `ChangeRequest` 当前也会继续保留 `source_backtest_id`；如果这条变更来自某轮回测复盘，策略页“待落实 ChangeRequest”列表可直接打开来源回测、来源复盘和来源提案
- 对 `ChangeRequest(type=backtest.launch)` 而言，后端当前也会继续写回 `linked_backtest_id / linked_backtest_timeframe / linked_backtest_data_range`；策略页“待落实 ChangeRequest”列表可直接打开这轮刚生成的回测，不必再去回测列表反查
- 对这类 `backtest.launch` 变更，当前卡片的主跟踪任务也会直接指向 `generate_backtest_review`，而不是泛化的 `reconcile_change_request`；后续重试、执行中、失败与完成状态都会围绕这轮回测复盘更新
- 这类变更当前也会继续写回关联回测的 `sample_quality / decision_readiness / decision_recommended_* / decision_readiness_action`；策略页“待落实 ChangeRequest”卡片可直接看到这轮回测当前是“样本达标 / 待补样本 / 研究参考”，并支持就地“按建议重跑”
- 若这轮关联回测当前没有 `decision_recommended_*`，但已经给出了 `full_window_recommended_*` 或 `history_source_recommended_*`，策略页“待落实 ChangeRequest”卡片当前也会继续复用这组结构化样本建议，直接显示“样本窗口”提示并支持就地“按建议重跑”
- 同一张 `ChangeRequest(backtest.launch)` 卡片当前也会继续镜像关联回测的 `requested_* / retrieved_* / used_*` 样本窗口覆盖字段；即使本地暂时拿不到那轮 `BacktestRun` 详情，也能继续显示“请求 / 取样 / 回测”窗口事实，而不只剩一条泛化建议
- 策略页“待落实 ChangeRequest”卡片当前也会直接把这组样本窗口覆盖明细渲染出来，便于不离开当前列表就能判断这轮回测到底覆盖到了哪一段、缺口在哪
- `AI 复盘` 详情、回测详情和提案流里的提案卡当前也会直接显示“已生成变更”；若它是 `script_patch_proposal` 这类待后续落实的变更，还会继续前移显示 `需人工跟进` 并支持一键打开对应 `ChangeRequest`
- 同一张卡片当前也会前移展示关联回测的 `sample_quality`，但只对 `参考路径 / 低样本` 这类需要注意的状态打标签，不会把“样本达标”刷满整列
- 若这轮关联回测当前只是 `history_source_reason=exchange_fetch_failed` 的来源故障，卡片会继续展示恢复历史拉取的建议，但不会再误给立即“按建议重跑”按钮，避免原地重复同一次失败
- 通过日志、调度页、回测页等入口触发 `openChangeRequest()` 时，策略页当前也会直接拉起“当前定位变更”详情面板，而不只是把列表里某一行高亮；来源链路、跟踪任务、样本质量、样本窗口和下一步动作都会集中展示
- 若当前定位的那条 `ChangeRequest` 已经不在最近 6 条里，策略页列表当前也会临时把它补进当前视图，避免从日志或调度页跳过来后“只高亮不到目标”
- 工作台状态当前也会继续保存这条“当前定位变更”；跨重启或跨入口恢复后，如果当前策略上下文已经偏离，前端会自动切回这条 `ChangeRequest` 所属策略，再展开对应详情
- 当前聚焦的 AI 调度任务也会继续写入工作台状态；若这条任务带明确 `strategy_id` 或任务上下文能推导出策略，桌面端恢复 `AI 调度` 页时会自动切回对应策略和主品种
- 当前打开的复盘结果详情小窗也会继续写入工作台状态；若这条 review 在恢复时仍然有效，桌面端会自动重开小窗，并尽量恢复打开时的策略语境；从日志、调度、回测等近场入口再次打开时，也会同步把策略和主品种切回同一语境
- 控制端在读取 `WorkspacePreferences` 时，也会自动清理已经不存在的 `selected_symbol / selected_strategy_id / selected_backtest_id / selected_scheduler_job_id / selected_review_id / selected_proposal_id / selected_change_request_id`，避免旧状态在服务端和桌面端之间反复“复活”
- 控制端在读取 `WorkspacePreferences` 时，也会自动清理已经不存在的 `selected_review_inspector_id`，避免已经失效的复盘详情小窗在恢复时再次弹出
- 若当前恢复的是策略页上下文，控制端也会优先按 `selected_change_request_id` 对齐 `selected_strategy_id`，若没有定位变更则继续按 `selected_proposal_id` 对齐；若恢复的是 `AI 调度` 页上下文，则会优先按 `selected_scheduler_job_id` 对齐策略与主品种；若恢复的是回放页上下文，则会优先按 `selected_review_id` 对齐策略与主品种；若恢复的是回测页上下文，则会优先按 `selected_backtest_id` 对齐，避免跨模块恢复时策略焦点错位
- 同时，策略页和回测页的恢复当前也会把 `selected_symbol` 一并对齐到对应策略/回测的主品种，避免界面已经切回正确对象，但盯盘仍停在旧 symbol
- `ChangeRequest` 当前也会继续写回 `follow_up_job_id / follow_up_job_type / follow_up_job_status / follow_up_result_summary / linked_review_*`，让策略页和后续审计直接看到这条变更后续排了哪条跟踪任务、当前跑到哪一步、是否已经生成跟踪复盘
- 若这条 `backtest.launch` 变更后续又产出了 `generate_backtest_review` 结果，后端当前也会把这条回测复盘继续挂回同一条 `ChangeRequest.linked_review_*`，让策略页可直接从“待落实变更”一路点到结果
- `GET /api/strategies/{strategy_id}/activity` 当前也会直接带 `recent_change_requests`；策略活动二级窗可原生显示最近待落实变更，并前移展示 `需人工跟进`、结论门禁、样本窗口与跟踪任务状态，还能直接就地打开 `回测 / 结果 / 任务 / 来源回测 / 来源复盘 / 来源提案`，并在任务失败/取消时直接重试；若当前定位的是一条更早的变更，面板也会临时把它补进当前视图
- 同一条策略活动接口当前也会附带 `latest_backtest / latest_backtest_review / latest_backtest_job / recent_backtests`，让策略页和 AI 上下文都能直接知道最近一轮回测是谁、有没有已经生成复盘或仍停在回测复盘任务里，不必再从变更或复盘侧面反推
- 策略活动二级窗当前也会原生显示最近回测，并对当前聚焦的旧回测做保底可见；同一块支持直接打开回测、查看结果、打开任务、来源链路以及在回测复盘任务失败/取消时直接重试跟踪，同时会跟随当前焦点标记 `当前回测 / 当前变更 / 当前复盘 / 当前任务`
- 同一个策略活动二级窗当前也会对“当前聚焦的旧提案”做保底可见：若它不在最近活动返回范围内，面板会临时把它补进 `最近提案`，并标记 `当前聚焦`
- 同一块“最近提案”当前也会继续跟随这条提案生成出来的当前变更、当前回测与当前复盘；即使当前焦点已经落到生成结果上，面板仍会把源提案标成 `当前变更 / 当前回测 / 当前复盘`，不需要再手动反推这条链
- 提案卡正文当前也会直接写出它已经生成的 `ChangeRequest / BacktestRun / ReviewDocument` 落点，不再只能靠旁边的按钮名猜它后续落到了哪一层
- 若这条提案生成出来的 `ChangeRequest` 后续已经排了跟踪任务，提案卡正文当前也会继续前移显示 `follow_up_job_type / status / result`，并支持就地 `打开任务 / 查看结果 / 重试跟踪`
- 若当前焦点已经落到这条提案后续排出来的任务上，提案卡当前也会直接标记 `当前任务`；即使这条任务不是挂在 `ChangeRequest.follow_up_job_*` 上，而是落在后续 review/backtest 结果链里，前端也会沿来源链补回对应任务
- 同一个策略活动二级窗当前也会对“当前聚焦的旧 review”做保底可见：若这条跟踪结果或复盘结果不在最近活动返回范围内，面板会临时把它补进 `AI 跟踪 / 复盘记录`，并标记 `当前聚焦`
- 同一个策略活动二级窗当前也会对“当前聚焦的旧调度任务”做保底可见：若这条任务不在最近活动返回范围内，面板会临时把它补进 `跟踪任务`，并标记 `当前聚焦`
- 同一个策略活动二级窗顶部当前也会直接显示 `latest_audit_event / latest_alert / latest_order / latest_trade` 的近场摘要；接口如果已经返回这组 `latest_*`，前端会直接复用，否则才回退到最近列表的第一条，避免再靠“翻列表第一行”猜当前刚发生了什么
- 同一个策略活动二级窗顶部当前也会优先复用活动接口直接返回的 `latest_audit_event_record` 作为“最新审计”按钮数据源；因此顶部摘要和 `最新审计任务 / 最新审计结果 / 最新审计变更 / 最新审计回测 / 最新来源回测 / 最新来源复盘 / 最新来源提案` 这组动作会锁在同一条关键审计上，不会再出现“摘要和按钮各自挑了一条审计”的分叉
- 同一个策略活动二级窗顶部当前也会优先复用活动接口直接返回的 `latest_alert_record / latest_order_record / latest_trade_record` 作为按钮数据源；因此顶部摘要和 `最新提醒 / 提醒行情 / 最新委托 / 最新成交 / 确认提醒 / 最新改单 / 最新撤单 / 成交行情` 这组动作会锁在同一条真实记录上，不会再出现“摘要和按钮各取列表第一条”的隐形分叉
- 同一个策略活动二级窗顶部的 `最新审计 / 最新提醒 / 最新委托 / 最新成交` 摘要 helper 当前也会优先复用对应的结构化 `latest_*_record`，不再只在按钮层复用，避免后续接口裁剪时重新出现“摘要和按钮来源不同”的分叉
- 同一个策略活动二级窗里的 `提醒 / 审计 / 历史委托 / 成交` 列表当前也会和顶部共用同一套结构化 `latest_*_record` 派生值；如果某条最新记录不在 `recent_*` 返回范围内，面板会临时把它补进当前视图，避免出现“顶部已经切到新记录，列表里却还没有它”的漂移
- 同一个策略活动二级窗里的 `提醒 / 审计 / 历史委托 / 成交` 列表当前也会在这类补位发生时直接显示提示文案，明确告诉用户“这是为了继续沿顶部最新对象排障而临时补进当前视图”，不再只靠 `当前最新` 标签让人自己猜
- 同一个策略活动二级窗里的“提醒”列表当前也可直接 `提醒页 / 提醒行情 / 自选规则 / 确认提醒`；同时 `提醒 / 审计 / 历史委托 / 成交` 这几组列表会直接给当前对应的顶部记录打 `当前最新` 标签，便于一眼看出顶部摘要和下方哪一行是同一条
- 同一个策略活动二级窗里的“审计”列表当前也可直接 `审计页`；“活跃委托”列表若命中顶部正在显示的最新委托，也会直接打 `当前最新` 标签，便于从活动面板里对齐“顶部摘要”和“当前活跃单”
- 同一个策略活动二级窗里的“活跃委托”列表当前也会做一层保守补位：如果顶部最新委托看起来仍是未完成单，但暂时不在 `active_orders` 返回范围内，面板会临时把它补进“活跃委托”视图，便于继续近场改单或撤单
- 同一个策略活动二级窗里的“活跃委托”列表当前也会优先跟随接口直接返回的 `latest_active_order*`：如果当前活跃委托不在 `active_orders` 返回范围内，面板会把它临时补进列表，并用 `当前活跃` 标签明确标出；若它同时也是整体最新委托，则会继续并列显示 `当前最新`
- 同一个策略活动二级窗里的“历史委托”列表当前会优先跟随接口直接返回的 `latest_historical_order*`：如果真正的最新历史委托不在 `recent_orders` 返回范围内，面板会把它临时补进列表，并用 `当前最新历史` 标签明确标出；如果整体最新委托其实还是活动单，这条补位也不会再误把活跃单塞进历史列表
- 同一个策略活动二级窗顶部当前也会把“当前最新历史委托”单独收出来：如果整体最新委托其实还是活动单，但最近一张历史委托仍需继续追单，顶部会继续显示 `当前最新历史委托` 提示，并提供 `最新历史委托 / 历史行情` 直达按钮
- 同一个策略活动二级窗顶部当前也会把“当前待处理提醒”单独收出来：如果整体最新提醒已经是已确认记录，但仍有一条更早的待处理提醒需要继续处理，顶部会继续显示 `当前待处理提醒` 提示，并提供 `当前待处理提醒 / 当前确认提醒 / 待处理行情` 直达按钮
- 同一个策略活动二级窗顶部当前也会把“当前可处理提案”单独收出来：如果整体最新提案已经处理完，但当前可见提案里还有一条 `pending/testing` 可继续处理，顶部的接受/拒绝动作会优先跟随这条 `当前可处理提案`
- 同一个策略活动二级窗顶部当前也会把“当前可处理变更 / 当前可重试任务”单独收出来：如果整体最新变更或最近任务已经不再可处理，但当前可见列表里还有一条更早的失败跟踪或可按建议重跑的变更，顶部的 `重试最近变更 / 最近变更按建议重跑 / 重试最近任务` 会优先跟随这条仍可继续处理的对象；对应列表行也会直接打 `当前可处理 / 当前可重试`
- 同一个策略活动二级窗顶部当前也会把“当前可处理回测”单独收出来：如果整体最新回测已经不再需要操作，但当前可见回测里还有一条更早的可按建议重跑回测，或它对应的 AI 复盘任务仍可重试，顶部的 `回测按建议重跑 / 重试回测任务` 会优先跟随这条仍可继续处理的回测；对应回测行也会直接打 `当前可处理`，而且活动接口当前也会正式补齐 `latest_actionable_backtest_review / latest_actionable_backtest_job`，让顶部和列表都能锁定同一条“当前可处理回测”的结果/任务
- 同一个策略活动二级窗顶部当前也会把“当前可处理复盘”单独收出来：如果整体最新复盘已经没有重跑建议，但当前可见复盘里还有一条更早的回测复盘仍带 `decision_recommended_*`，顶部的 `复盘按建议重跑` 会优先跟随这条仍可继续处理的复盘；对应复盘行也会直接打 `当前可处理`
- 同一个策略活动二级窗里的“活跃委托”列表当前也不再只是只读摘要；每条活跃单都可直接 `委托页 / 委托行情 / 改单 / 撤单`，不必先切到账户与委托页再处理
- 同一个策略活动二级窗里的“历史委托 / 成交”列表当前也不再只是只读摘要；历史委托可直接 `委托页 / 委托行情`，最近成交可直接 `成交页 / 成交行情`，便于从策略活动近场继续追单或切回行情
- 同一个策略活动二级窗顶部当前也会继续前移更直接的安全动作：对未确认的最新提醒可直接 `确认提醒`，规则类提醒可直接 `自选规则`；对可编辑的最新委托可直接 `最新改单`；最新成交也可直接 `成交行情`
- 同一个策略活动二级窗顶部当前也会把“当前活跃委托”单独收出来：如果整体最新委托已经落进历史，但仍有一张活跃单可操作，顶部会继续显示 `当前活跃委托` 提示，并把改单/撤单优先作用到这张仍可操作的委托，而不是刚结束的那张最新历史单
- 同一个策略活动二级窗顶部当前也会继续前移更直接的处理动作：若最近回测已经给出结构化建议，可直接 `回测按建议重跑`；若最近回测对应的 AI 复盘任务失败/取消，可直接 `重试回测任务`；对可撤的最新委托也可直接 `最新撤单`
- 同一个策略活动二级窗顶部当前也会基于 `latest_audit_event` 提供 `最新审计任务 / 最新审计结果 / 最新审计变更 / 最新审计回测 / 最新来源回测 / 最新来源复盘 / 最新来源提案` 的直达按钮，不必再先往下翻到审计列表
- 同一个策略活动二级窗顶部当前也会直接显示 `latest_proposal / latest_change_request` 摘要；接口如果已经返回这两条最新落点，前端会直接复用，否则才回退到最近提案/变更列表的第一条，避免再从列表本地猜“最近提案/最近变更”是谁
- 同一个策略活动二级窗顶部当前也会直接提供 `最近提案 / 最近变更 / 最近回测 / 最近复盘 / 最近跟踪 / 最近任务` 的直达按钮，不必再先往下翻到对应列表
- 同一个策略活动二级窗顶部当前也会和下方列表共用同一套“保底可见”派生值；如果当前焦点是一条不在最近返回范围内的旧复盘、旧跟踪结果或旧任务，顶部的 `最近复盘 / 最近跟踪 / 最近任务` 摘要、直达按钮和重试动作也会跟着补位，不再和下方列表打架
- 同一个策略活动二级窗顶部当前也会让 `最近复盘 / 最近跟踪 / 最近任务` 优先跟随当前可见列表里的第一条，而不再先钉在接口原始 `latest_primary_review / latest_tracking_review / latest_tracking_job` 上；这样旧焦点被补进列表后，顶部摘要和动作也会立刻切到同一条对象
- 同一个策略活动二级窗顶部当前也会让“最近回测 / 回测结果 / 回测任务”优先跟随当前可见的第一条回测；如果当前焦点是一条补位进来的旧回测，顶部这一组摘要和结果链按钮也会一起切过去，不再只钉在接口返回的 `latest_backtest*`
- 同一个策略活动二级窗里的“最近回测”列表当前也会和顶部共用同一套回测结果/任务兜底；如果某条补位进来的旧回测正好成了当前可见第一条，列表里的 `结果 / 任务` 也会跟顶部一起切到同一条 `activityLatestBacktestReview / activityLatestBacktestJob`
- 同一个策略活动二级窗顶部当前也会让“最近提案 / 最近变更”优先跟随当前可见的第一条提案或变更；如果当前焦点是一条补位进来的旧提案或旧变更，顶部摘要、直达按钮，以及“接受最近提案 / 拒绝最近提案 / 重试最近变更 / 最近变更按建议重跑”这组动作也会一起跟过去，不再只钉在接口返回的 `latest_proposal / latest_change_request`
- 同一个策略活动二级窗里的 `最近提案 / 待落实变更 / 最近回测 / AI 跟踪 / 复盘记录 / 跟踪任务` 当前也会对接口直接返回、但不在 `recent_*` 范围里的 `latest_*` 对象做保底可见，并直接打 `当前最新` 标签；这样顶部摘要和下方列表会继续锁在同一条最新对象上，不会再出现“顶部已经切过去、列表却还停在旧范围”的分叉
- 同一个策略活动二级窗顶部当前也会继续提供“提案落点 / 变更落点”的近场按钮；若最近提案已经生成了变更、回测、复盘或跟踪任务，或最近变更已经落出回测、结果、任务与来源链，顶部可直接点 `提案变更 / 提案回测 / 提案复盘 / 提案任务 / 变更回测 / 变更结果 / 变更任务 / 变更来源回测 / 变更来源复盘 / 变更来源提案`
- 同一个策略活动二级窗顶部当前也会继续前移“回测链 / 复盘链 / 跟踪链”按钮；最近回测可直接点 `回测结果 / 回测任务 / 回测来源变更 / 回测来源回测 / 回测来源复盘 / 回测来源提案`，最近复盘可直接点 `复盘任务 / 复盘来源变更 / 复盘来源回测 / 复盘来源复盘 / 复盘来源提案 / 复盘按建议重跑`，最近跟踪也可直接点 `跟踪来源任务 / 跟踪来源变更 / 跟踪来源回测 / 跟踪来源复盘 / 跟踪来源提案`
- 同一个策略活动二级窗顶部当前也会继续前移“最近任务”自己的结果链；若最近任务已经写回结果、变更、回测或来源链，顶部可直接点 `任务结果 / 任务变更 / 任务回测 / 任务来源变更 / 任务来源回测 / 任务来源复盘 / 任务来源提案`

- 自动排队的 `review_strategy_change` / `generate_backtest_review` 任务当前也会在 `review_strategy_activity` 上下文里固化最近提案与最近变更摘要；最近提案摘要会继续带上已生成的变更/回测/复盘落点，以及 `需人工跟进` 这类高价值状态。若任务由“接受提案”触发，入队时也会先按 `accepted` 口径覆盖对应提案状态，避免任务快照仍看到旧的 `testing`
- 这份 `review_strategy_activity` 上下文当前也会继续固化 `latest_primary_review / latest_tracking_review / latest_tracking_job / recent_reviews / recent_agent_jobs`；对手动发起的 `review_strategy_issue / review_strategy_change` 和自动排队的 `generate_backtest_review`，任务创建后还会立即回填一次上下文，确保 queued 任务能在自己的快照里直接看到当前这条任务与最近 review/job 链
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_backtest / latest_backtest_review / latest_backtest_job / recent_backtests`，让 `review_strategy_issue / review_strategy_change / generate_backtest_review` 这三类任务在入队快照里就能直接看到最近回测链，以及最近回测已经落到结果还是仍停在任务里
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_backtest_record / latest_actionable_backtest_record`，让后端和桌面端直接拿到完整 `BacktestRun` 结构，不必再靠全量回测列表反查当前最新回测或当前可处理回测的详细门禁、窗口和来源链
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_backtest_review_record / latest_backtest_job_record / latest_actionable_backtest_review_record / latest_actionable_backtest_job_record / latest_primary_review_record / latest_actionable_primary_review_record / latest_tracking_review_record / latest_tracking_job_record / latest_retryable_tracking_job_record`，让后端 AI 与桌面端在最近复盘、跟踪结果和任务不在全局列表时，仍能直接拿到完整 `ReviewDocument / AgentJob` 结构继续沿结果链、来源链和重试动作往下走
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_audit_event / recent_audit_events` 的高价值摘要；不再只保留 `event_type · source`，而会优先带 `summary / result_summary / impact / manual_followup`，让 OpenClaw 和后端排障上下文能直接看到最近关键审计事件的实际含义
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_alert / latest_order / latest_trade`，并补齐 `latest_pending_alert* / latest_historical_order*`；其中 `latest_order*` 会优先在“最新活动委托”和“最新历史委托”之间选取创建时间更新的一条，`latest_active_order*` 会始终锁定活动态里最新的一张，`latest_historical_order*` 会始终锁定历史委托里最新的一张，`latest_alert*` 会按真实时间挑最新，而 `latest_pending_alert*` 会始终锁定未确认提醒里最新的一条，让 OpenClaw 和后端排障上下文在列表外同时看到整体最新提醒、当前待处理提醒、整体最新委托、当前活跃委托和当前最新历史委托
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_proposal / latest_change_request`，让 OpenClaw 和后端排障上下文除了最近列表外，也能直接拿到最近提案与最近变更的近场摘要
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_proposal_change_request / latest_proposal_backtest / latest_proposal_review / latest_proposal_job`，以及对应的 `latest_actionable_proposal_*`；这样最近提案和当前可处理提案已经落到哪一层，会由后端正式指出，不再只靠桌面端本地映射
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_proposal_backtest_record / latest_proposal_review_record / latest_proposal_job_record`，以及对应的 `latest_actionable_proposal_*_record`；这样最近提案和当前可处理提案若已经落到完整 `BacktestRun / ReviewDocument / AgentJob`，桌面端和 OpenClaw 会优先直接复用正式对象，而不是再长期依赖本地 proposal 映射反查
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_actionable_proposal / latest_actionable_change_request / latest_actionable_backtest / latest_actionable_backtest_review / latest_actionable_backtest_job / latest_actionable_primary_review / latest_retryable_tracking_job`，显式指出“当前仍可处理的提案”“当前仍可重试或重跑的变更”“当前仍可继续处理的回测/复盘”以及“当前仍可重试的跟踪任务”，不再只靠桌面端从最近列表本地推断
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_change_request_backtest_record / latest_change_request_review_record / latest_change_request_job_record`，以及对应的 `latest_actionable_change_request_*_record`；这样最近变更和当前可处理变更若已经落到完整 `BacktestRun / ReviewDocument / AgentJob`，桌面端和 OpenClaw 会优先直接复用正式对象，而不是再长期依赖 `linked_*_id` 去全局列表反查
- 同一份 `review_strategy_activity` 上下文当前也会继续固化 `latest_change_request_source_backtest_record / latest_change_request_source_review_record / latest_change_request_source_proposal_record`，以及对应的 `latest_actionable_change_request_source_*_record`；这样最近变更和当前可处理变更的来源回测、来源复盘、来源提案即使暂时不在全局列表里，桌面端和 OpenClaw 也能直接沿正式对象继续打开来源链
- 若这条跟踪任务失败或被取消，策略页当前也支持直接在 `ChangeRequest` 卡片上重试；后端会把 `follow_up_job_*` 切到新的重试任务，并清空旧的失败摘要与旧结果引用，避免误读
- 上述来源链当前也会继续带进后续 `reconcile_change_request / review_strategy_change` 任务上下文，以及 `strategy.change.review.completed / failed` 审计事件，避免从提案到变更跟踪中间断档
- 策略类 `ChangeRequest` 当前在落地后会自动排一个 `reconcile_change_request`，用于补齐 AI 执行记录
- 已有 Grafana-ready 监控接入：本地服务暴露 `/metrics` Prometheus 指标端点，并提供 Grafana 集成状态接口
- 前端当前在“设置”页展示 Grafana 接入配置，并在“AI 调度”页提供监控预览小窗
- `POST /api/settings` 当前会把本地设置持久化到控制端状态，并写入 `settings.updated` 审计事件；其中通知静默时段会直接作用于桌面端普通系统通知，`critical` 级提醒继续放行；OpenClaw `gateway_url / agent` 仍由本机外部配置驱动，设置页继续只读展示，避免出现“UI 已改但运行态未切换”
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
pnpm dev:desktop:repair
```

`pnpm dev:desktop` 会同时启动本地控制服务、Vite 渲染进程和 Electron 桌面壳；若 `127.0.0.1:8787` 已被不健康的旧 control-api 进程占住，可改用 `pnpm dev:desktop:repair`，它会在命令行匹配 `services/control-api/main.py` 且健康检查持续失败时，显式替换旧进程后再继续启动。两条命令当前也会在拉起新桌面壳前，自动清理这个仓库自己留下的旧 Electron 窗口，避免开发过程中把新旧实例混看。

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
- `GET /api/market/watchlist`、`GET /api/market/{symbol}` 已验证能返回 Bybit 公共行情；其中 `GET /api/market/watchlist` 默认走本地快照快路径，如需显式全量刷新可带 `?refresh=true`
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

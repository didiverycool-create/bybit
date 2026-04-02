# control-api

本地控制服务负责给桌面端提供统一的量化控制接口，包括：

- 控制总览 `ControlSnapshot`
- 工作台状态 `WorkspacePreferences`
- 行情、自选、K 线与订单簿数据
- 策略、回测、变更请求、AI 调度、新闻、提醒、交易记录、AI 复盘、审计事件
- OpenClaw 本机配置与健康状态读取

## 启动

```bash
python3 -m pip install -r services/control-api/requirements.txt
python3 services/control-api/main.py
```

默认监听 `http://127.0.0.1:8787`。

## 说明

- 当前版本使用本地 JSON 持久化 mock 状态，文件位于 `services/control-api/.runtime/state.json`。
- 桌面控制端的布局、默认页面、默认模式等工作台状态也通过本地服务持久化，方便后续会话恢复。
- 行情接口当前优先走 Bybit 公共 WebSocket + REST；WebSocket 负责近实时更新，REST 继续承担首帧与回退。
- 私有账户接口支持从环境变量或 `~/.bybit-control/private-api.json` 读取 Bybit API 配置。
- 仓库内提供了示例文件 [private-api.example.json](/Users/leo/Desktop/Work/bybit/services/control-api/private-api.example.json)，请在本机自行复制到 `~/.bybit-control/private-api.json` 后再填写新的只读 Key，不要把真实密钥提交到仓库或发送到对话里。
- 当前 `GET /api/account/*` 在未配置只读 Key 且模式为 `paper` 时，会根据本地 Paper 成交动态派生账户总览、持仓与可用余额；非 Paper 模式仍会稳定回退到 mock 数据。
- 当前 `GET /api/account/order-history` 在未配置只读 Key 且模式为 `paper` 时，也会根据本地 Paper 成交派生历史订单记录。
- 当前已提供 `POST /api/account/paper/orders`、`POST /api/account/paper/orders/cancel-all`、`POST /api/account/paper/orders/{order_id}/replace` 与 `POST /api/account/paper/orders/{order_id}/cancel`，可在 `paper` 模式把限价单挂入本地委托簿、批量全撤、改价改量或撤单。
- 当前本地 `paper` 未成交委托会占用可用余额与现货可卖数量；`GET /api/account/overview`、`GET /api/account/orders` 与 `POST /api/trades/preview` 都会把冻结量一并考虑进去。
- 当前本地 `paper` 限价单在参考价穿过委托价后会自动成交，并同步写入 `GET /api/trades`、`GET /api/account/order-history` 与审计事件。
- 当前账户链路按模式隔离：`paper` 模式始终优先展示本地派生账户；只有切到 `demo/live` 时才优先读取 Bybit 私有账户。
- 当前本地 `paper` 账本还会继续派生已实现盈亏、胜率、最佳策略和单笔平仓 `pnl`，用于控制总览和交易记录页。
- 当前已提供 `POST /api/account/paper/positions/{symbol}/close`，可直接对已有 `paper` 持仓生成整笔纸面平仓。
- 当前已提供 `POST /api/account/paper/positions/close-all`，可在 `paper` 模式一键平掉全部本地持仓。
- 当前已提供 `POST /api/trades/preview` 统一执行预检接口，会返回名义价值、可用余额变化、持仓变化、预估已实现盈亏和阻断原因；`POST /api/trades/manual` 与策略纸面成交当前都会复用这套 `paper` 风控判断。
- 当前 `POST /api/trades/preview` 也支持 `demo / live` 顾问式预检，会基于当前 Bybit 私有账户余额和持仓返回动作、仓位影响与阻断原因；最终精度和最小下单单位仍以 Bybit 返回为准。
- 当前 `POST /api/trades/preview` 在 `demo / live` 的 `spot sell` 场景下，会优先按钱包返回的该币种可用数量做门禁；若缺少该字段，再回退到“总持仓 - 同品种未成交卖单占用”。若是改单，`exclude_order_id` 仍会排除当前委托自身占用。
- 当前 `ExecutionPreview` 在可推断时也会带 `recommended_action`，便于桌面端把“阻断原因”继续补成“下一步建议操作”。
- 对 `demo / live` 顾问式预检与真实委托提交而言，当前还会优先读取 Bybit `instruments-info` 做本地下单校验，先检查最小下单量、数量步长、价格步长和最小名义价值，再决定是否允许真实提交。
- 若 `demo / live` 顾问式预检因为 Bybit 可用余额 / 保证金不足被拦住，当前也会在 `blocked_reason` 中直接带出“当前可用余额”和“本次委托约需名义价值”，便于快速判断是否只是账户资金不足。
- 当前已提供 `POST /api/orders/exchange`，在私有 API 已配置且模式匹配时，可直接向 Bybit 提交真实限价委托。
- 当前已提供 `POST /api/orders/exchange/{order_id}/replace`，可在当前模式下直接修改真实未成交委托的价格与数量。
- 当前已提供 `POST /api/orders/exchange/{order_id}/cancel`，可直接撤销当前模式下的真实未成交委托。
- 当前已提供 `POST /api/orders/exchange/cancel-all`，可按当前模式批量撤销全部真实未成交委托。
- 当前已提供 `POST /api/account/exchange/positions/{symbol}/close` 与 `POST /api/account/exchange/positions/close-all`，可根据当前真实持仓自动提交单笔或批量平仓限价委托；其中 `spot` 平仓会校验该币种当前可用数量是否足以覆盖整笔平仓，不足时会先阻断。若同一 `symbol` 同时存在 `spot/perp` 多市场持仓，单笔平仓也会先阻断，避免误平错误市场。批量全平当前也会先做整批预检，避免出现部分仓位已经提交、后续某一笔才失败的半成功状态。
- 当前 `GET /api/account/*` 在已配置真实私有 Key 且账户为空时，会返回真实空账户结果，不再错误回退 mock 持仓或委托。
- 当前 `GET /api/account/overview`、`/api/account/live`、`/api/account/positions`、`/api/account/orders`、`/api/account/order-history` 也支持可选 `mode=paper|demo|live` 查询参数，便于不切换工作台当前模式就直接查看另一套账户视图。
- 当前 `GET /api/account/*`、`GET /api/trades` 已开始优先使用 Bybit 私有 WebSocket 只读缓存，私有 REST 继续承担首帧、历史和回退。
- 当前 `GET /api/account/positions` 在真实模式下会把钱包 `coin[]` 里的现货资产补成 `spot` 持仓视图；若交易所显式返回了同一现货持仓，则会自动去重，避免账户页出现重复仓位。
- 当前 `GET /api/integrations/bybit-private` 也会额外给出 `usdt_balance_diagnostics[]`，按 `UNIFIED / FUND / CONTRACT` 列出 USDT 的 `wallet_balance / transfer_balance / available_balance`，方便快速定位真实资金在哪个账户桶里。
- 当前 `GET /api/integrations/bybit-private` 还会额外给出 `realtime_recommended_action`；若私有 REST 可达但私有 WS 仍报 `SSL EOF / TLS / 代理` 类错误，返回会直接提示优先检查本机网络、代理、防火墙和 TLS 设置。
- 当前 `GET /api/integrations/bybit-private.last_error` 只保留主链路错误，不再被可选 `spot` 类别或账户桶位探针失败误污染；可选探针错误会留在对应返回项中。
- 当前 `GET /api/integrations/bybit-public` 也会返回公共实时链路的 `connected_spot / connected_linear / *_stale / last_error / rest_reachable / rest_last_error / rest_tested_at / recommended_action`，并按当前 watchlist 给出 `watched_symbol_diagnostics[]`。
- `watched_symbol_diagnostics[]` 当前也会带 `recommended_action`；当公共 WS 失败但 Bybit REST 仍可达时，诊断会直接收敛成“REST 正常、优先检查本机代理 / VPN / TLS / 防火墙”。
- 当公有执行链路异常来自底层传输错误时，当前 `execution_health.top_issue_detail` 与策略级阻断文案也会直接附带最近一条公共 WS `last_error`。
- 当前已提供 `GET /api/account/order-history`，把历史订单与未成交委托拆开，方便桌面端做二级历史窗口。
- 当前已提供 `GET /api/account/live`，把账户总览、持仓、未成交委托和历史订单统一成一套实时快照，供桌面端实时联动。
- 当前已提供 `GET /api/strategies/live`，会基于最新行情生成最小策略运行态，并为 `paper` / `paper_only` 策略补纸面成交记录。
- 当前也已提供 `GET /api/strategies/stream`，用于以 SSE 形式持续推送同一份策略运行态快照。
- 当前 `GET /api/strategies/live` 也会附带 `execution_preview`，把当前信号若继续按 `paper` 执行时的名义价值、仓位变化、余额变化和阻断原因一并返回给桌面端。
- 若后台 `strategy runtime` 线程当前异常或停滞，`GET /api/strategies/live` 与 `GET /api/strategies/{strategy_id}/execution-preview` 当前都会直接返回阻断态预检；运行态现有的 `guard_state / guard_detail` 也会同步标成“执行受阻”。
- 若后台 `strategy runtime` 线程已停止但此前曾成功刷新过，当前也会进入同一条真实执行门禁，要求先恢复运行线程。
- 对 `live / demo` 策略执行而言，当前也会把 Bybit 公共 WS 的连通、目标品种实时行情是否已到达、以及最近是否仍在刷新一起作为真实执行门禁；若目标品种公共实时链路未连通、未收到首帧或已失活，策略真实预检、手动策略执行与后台自动执行都会统一阻断。
- 这层公共实时链路门禁当前也会自动升成 `system` 来源提醒；公共 WS 恢复后会自动收起对应提醒，并补写恢复审计事件。
- 后台自动执行在检测到公共/私有执行链路异常时，当前也会优先撤销遗留真实策略委托，再保持阻断状态，降低链路失活期间旧单继续留在交易所侧的风险。
- 若真实模式下因外部干预或异常遗留多笔同策略挂单，后台当前也会优先清掉多余旧单，只保留最新目标委托。
- 同一条运行线程健康门禁当前也会用于 `POST /api/strategies/{strategy_id}/execute`，避免真实模式下出现“预检被挡住、真正执行却还能下发”的分叉。
- 当桌面端手动触发策略执行但被真实门禁拦住时，当前会额外写入 `strategy.execution.blocked` 审计事件，供最近执行摘要、审计流与 AI 复盘复用。
- 这类手动执行阻断当前也会升成 `system` 来源提醒，提醒中心能直接看到“手动策略执行被拦截”。
- 当后续同一策略的手动执行恢复成功后，这类“手动策略执行被拦截”提醒当前会自动收起，并补写 `strategy.execution.blocked_resolved` 审计事件。
- `execution_preview` 当前按“目标仓位差额”计算，因此当信号从 `long -> short` 或 `long -> flat` 时，会按真实持仓差额补足反手或平仓数量。
- 当前 `GET /api/strategies/live` 也会返回 `target_position_side / target_position_size / position_alignment / position_alignment_detail`；当真实策略处于 `drifted` 且仍在 `running` 时，会自动生成 `system` 来源偏离提醒，并在重新对齐后自动收起。
- 当前 `GET /api/strategies/live` 还会附带 `current_position_side / current_position_size / current_position_avg_price`，便于桌面端直接显示当前实际仓位与均价。
- 当前已提供 `GET /api/strategies/{strategy_id}/execution-preview`，可按当前模式返回策略级执行预检；`paper` 走本地目标仓位差额，`demo/live` 走 Bybit 私有账户顾问式预检。
- 对 `demo/live` 策略执行而言，当前会先按 `Bybit 私有账户可用余额 × 策略 risk_budget` 收敛可新增仓位，再叠加可复用的现有仓位/旧单释放占用，并按 `instruments-info` 的 `qtyStep / tickSize` 收敛到交易所精度，统一生成 `execution preview`、自动执行委托和 `target_position_size`；若余额联动后的目标仍低于最小下单门槛，会直接返回显式阻断而不是继续按旧的固定手数预检。
- 若这类 `risk_budget` 联动 sizing 被最小下单门槛拦住，`execution preview` 当前还会额外返回结构化的 `sizing_risk_budget / sizing_budget_notional / sizing_minimum_required_notional / sizing_available_balance_gap`，方便桌面端直接展示“当前预算 / 最低门槛 / 余额缺口”。
- 若当前同一策略在同品种上已有未成交、且后续会被复用、改单或撤销的可释放占用委托，这部分余额或保证金占用当前也会同步释放回策略级 sizing 与真实预检，避免被自己的旧单误判成余额不足。
- 对 `perp` 真实顾问式预检而言，当前保证金校验也已改成只检查净新增敞口；减仓与等额反手不会再被整笔名义价值误判成新增保证金占用。
- 当前已提供统一的 `POST /api/strategies/{strategy_id}/execute`，会按工作台模式自动分发：`paper` 写入纸面成交，`demo/live` 向 Bybit 提交真实限价委托。
- 对 `perp` 真实委托而言，若当前订单只会减仓或平仓、不会扩大或反手，系统当前会自动补上 `reduceOnly`；旧委托若缺少该标记，后续执行也会自动改单对齐。
- 当真实策略委托的方向、数量、价格已经与当前信号一致时，`POST /api/strategies/{strategy_id}/execute` 与后台自动执行当前都会直接复用旧委托，不再额外发起改单。
- 真实策略委托在交易所侧成交 / 撤销 / 拒绝后，后台会自动补写对应审计事件，供策略运行态、提醒和 AI 复盘统一复用。
- 真实策略委托若被交易所 `Rejected`，后台还会自动生成 `system` 来源提醒，方便桌面端直接提示异常委托。
- 当后续真实策略委托重新恢复正常提交 / 成交后，这类拒单提醒也会自动收起，避免长期堆积。
- 若同一条真实策略在短时间内连续多次 `Rejected`，后台还会自动进入“连续拒单冷却”，暂停自动执行并让策略级 `execution_preview` 明确返回阻断原因。
- 若真实策略委托长时间挂单未动，后台还会自动识别“停滞挂单”，生成 `system` 来源提醒，并在自动执行路径中先撤掉旧单再按当前信号补单。
- `GET /api/control/snapshot` 当前还会返回结构化 `execution_health`，把止损保护、冷却中、执行受阻、连续拒单、挂单停滞、仓位偏离统一聚合，便于桌面端、Grafana 和 AI 复盘直接复用。
- `execution_health` 当前还会单独暴露 `public_execution_channel_issue / public_execution_stale / public_execution_stale_seconds`，用于明确区分“公有行情链路异常”和“私有执行链路异常”。
- `execution_health` 当前也会带 `runtime_worker_running / runtime_worker_issue / runtime_last_error`，用于直接判断后台 `strategy runtime` 循环是否健康。
- `execution_health` 当前除 `top_issue` 外，也会附带 `top_issue_strategy_id / top_issue_strategy_name / top_issue_symbol / top_issue_detail / top_issue_recommended_action`，用于直接定位具体问题策略与建议动作。
- 若后台 `strategy runtime` 线程已经停止、但此前曾成功刷新过，`execution_health` 当前也会把这类状态提升为“运行线程未运行”，并自动生成 `system` 来源提醒。
- 若后台 `strategy runtime` 线程长时间没有刷新成功，`execution_health` 当前也会带 `runtime_worker_stale / runtime_stale_seconds`，并把这类问题提升为“运行线程停滞”。
- 当前已提供 `POST /api/runtime/strategy-worker/restart`，当后台 `strategy runtime` 线程异常或停止时，可由桌面端直接发起恢复。
- 当前已提供 `GET /api/runtime/strategy-worker/status`，用于单独查询后台运行线程的健康状态与恢复建议。
- 桌面端设置页与策略页当前优先消费这条独立接口，恢复按钮和状态说明不再只依赖 `execution_health` 间接判断。
- 若手动恢复运行线程失败，当前会额外生成 `P1` 的 `system` 来源提醒“恢复运行线程失败”；后续成功恢复后会自动收起并写入恢复审计事件。
- 线程异常或停滞当前还会自动升成 `system` 来源提醒，恢复后会自动收起并写入恢复审计事件。
- 当前控制总览的策略摘要首卡和 `GET /api/ops/live` 的 `execution_issue_total` 也会把运行线程异常/停滞计入统一执行问题。
- `GET /api/ops/live` 的 `summary` 当前也会同步带 `execution_top_issue_symbol / execution_top_issue_detail`，便于提醒中心、日志页和后续监控直接复用。
- Bybit 公共 WS 当前已把短暂空闲的 `recv(timeout=1.0)` 视为正常空转，不再因为 1 秒未收到消息就把 `linear / spot` 通道误判成断线；执行门禁仍会按目标品种最近一条实时行情是否 stale 决定是否放行。
- 若 `live/demo` 策略配置了 `stop_loss_pct` 且当前真实仓位触发阈值，后台循环会自动撤掉遗留策略委托、生成 `P0` 系统提醒，并让策略级执行预检转为显式阻断。
- 当策略纸面执行被风控拦截时，当前会同时写入 `risk.blocked_order` 审计事件和 `system` 来源提醒。
- 当 `paper` 策略带有 `stop_loss_pct` 参数时，当前会在本地触发自动止损平仓，并写入 `strategy.paper_stop_loss.executed` 审计事件。
- 当 `paper` 策略带有 `cooldown_minutes` 参数时，止损后会进入冷却期；冷却结束前不会再次生成可执行的 `execution_preview`。
- 当前 `POST /api/trades/manual` 仍只负责 `paper` 模式的直接成交写入；`demo` / `live` 手动委托当前走 `POST /api/orders/exchange`，真实未成交委托的改单 / 撤单 / 全撤分别走 `POST /api/orders/exchange/{order_id}/replace`、`POST /api/orders/exchange/{order_id}/cancel`、`POST /api/orders/exchange/cancel-all`。
- 当前真实持仓的一键平仓 / 全平不直接做市价强平，而是按当前参考价提交真实限价委托；永续持仓会带 `reduceOnly`，现货持仓会按可卖数量提交卖单。
- 当前 `POST /api/trades/manual` 已接入基础 Paper 风控，会拒绝余额不足的买入以及现货裸卖空。
- 当前 `/metrics` 还会额外输出 `bybit_control_paper_realized_pnl`、`bybit_control_paper_win_rate`、`bybit_control_paper_open_orders`、`bybit_control_paper_positions`、`bybit_control_paper_available_balance`，以及策略级的 `bybit_control_strategy_live_stop_loss_guard` / `bybit_control_strategy_live_stop_loss_cooldown_minutes` / `bybit_control_strategy_exchange_rejection_guard` / `bybit_control_strategy_exchange_rejection_cooldown_minutes` / `bybit_control_strategy_stale_order_guard`，便于后续 Grafana / Prometheus 看板接入。
- 对 `live / demo` 策略执行而言，当前还会把 Bybit 私有 WS 的连通、鉴权与“最近是否仍在刷新”都当成真实执行门禁；若私有实时链路未连通、未鉴权或已失活，策略真实预检、手动策略执行与后台自动执行都会统一阻断。
- `/metrics` 当前也会单独输出 `bybit_control_public_ws_stale{channel=...}` 与 `bybit_control_public_ws_stale_seconds{channel=...}`，便于后续 Grafana / Prometheus 直接监控公共实时行情链路。
- 当前 `POST /api/integrations/bybit-private/probe-trade` 会向 Bybit 交易接口发送故意无效的下单参数，用来验证签名、认证和交易 POST 链路，不会直接发出可成交订单。
- OpenClaw 集成当前已接通本机 worker，可自动执行日度复盘、回测复盘与变更落实补记；仍不修改 OpenClaw 源码，也不直接驱动 Bybit 交易。
- 当前高影响策略变更在落地后会自动排一条 `review_strategy_change` 任务，补齐“变更 -> 落地 -> AI 跟踪摘要”的闭环；提醒规则等轻量变更仍沿用 `reconcile_change_request`。
- 这类 `review_strategy_change` 任务在完成或失败后，当前也会额外写入 `strategy.change.review.completed / failed` 审计事件，方便策略活动与日志页直接复用。
- 当真实执行问题被升成 `system` 提醒时，当前还会自动排一条 `review_strategy_issue` 任务，补齐“异常 -> 跟踪 -> AI 写回”的闭环。
- 这类 `review_strategy_issue` 任务在完成或失败后，当前也会额外写入 `strategy.issue.review.completed / failed` 审计事件，方便策略活动与日志页直接复用。
- 当前还支持 `POST /api/strategies/{strategy_id}/review` 手动发起单策略问题/变更跟踪；桌面端策略页会复用这条接口，把人工关注点直接接入现有 AI 跟踪流，并补写 `strategy.review.requested` 审计事件。
- 上述两类任务在完成时，当前还会补写单策略跟踪复盘，直接进入 `GET /api/ai/reviews` 与 `GET /api/strategies/{strategy_id}/activity`。
- `GET /api/ai/reviews` 当前已支持按 `strategy_id / period` 过滤，便于桌面端后续只拉取单策略或单类复盘。
- 桌面端 `AI 复盘` 页当前会把 `strategy_issue / strategy_change` 这类单策略跟踪复盘单独归到“策略跟踪”，避免与日报 / 回测复盘混排。
- 当前写入 `ReviewDocument` 时，还会自动把 `execution_health.top_issue` 与运行线程问题并入风险列表，避免复盘遗漏真实执行门禁。
- 当前发给 OpenClaw 的日度复盘 / 回测复盘提示词，也会显式附带执行健康摘要与运行线程状态，减少模型只围绕收益数字总结的情况。
- 同时写入任务队列的 `generate_daily_review / generate_backtest_review` 上下文当前也会带 `execution_health / execution_top_issue / execution_top_issue_symbol / execution_top_issue_detail / runtime_worker_top_issue`，便于后续审计与任务重试定位。
- 上述复盘上下文当前还会带 `execution_top_issue_strategy_activity / review_strategy_activity`，把问题策略或当前复盘策略最近的运行态、提醒、委托、成交和审计事件压成紧凑摘要，便于 OpenClaw 直接引用。
- 这份紧凑策略活动摘要当前也会显式带 `runtime.next_action` 和结构化 `execution_preview` 关键信息，包括 `recommended_action` 与 `sizing_*` 资金门槛字段，后续复盘与排障无需再从提示文案里二次拆数。
- 当前已提供 `GET /api/strategies/{strategy_id}/activity`，可按单条策略聚合最近运行态、委托、成交、提醒和审计事件，便于桌面端二级小窗或 AI 复盘直接复用。
- 即使工作台当前 `selected_mode` 与策略自身模式不一致，这条活动接口当前也会优先补齐按该策略自身模式生成的 `execution_preview`，便于直接查看真实阻断或当前建议。
- 这条接口当前也会附带最近的策略相关 AI 任务摘要，便于直接查看 `review_strategy_change / generate_backtest_review` 等跟踪动作。
- 这条接口当前也会附带最近的 `review_strategy_issue` 摘要，便于在同一处直接回看单策略最近一次异常跟踪。
- 同时这条接口当前也会附带最近的单策略 AI 复盘摘要，便于把“复盘 / 任务 / 执行”放进一个轻量活动面板里查看。
- 这条接口当前还会带 `strategy_id / retry_count / retried_from_job_id`，便于桌面端在策略活动与 AI 复盘里直接复用任务重试能力。
- 当跟踪任务已生成单策略复盘时，这条接口里的任务摘要当前也会带 `linked_review_id / linked_review_title / linked_review_period`，便于前端直接展示结果归属。
- 当任务或跟踪摘要当前带 `linked_review_id` 时，桌面端也会直接用这条元数据聚焦对应复盘结果，而不是仅切到 `AI 复盘` 页。
- `strategy.change.review.completed` 与 `strategy.issue.review.completed` 审计事件当前也会补带同一组 `linked_review_*` 元数据，便于日志页和活动流直接引用。
- 桌面端当前会在系统日志/审计页直接消费这组 `linked_review_*` 元数据，允许从跟踪完成事件一键打开对应复盘结果。
- 对通用 `openclaw.job.completed` 事件，桌面端当前也会兼容读取 `review_id / review_title / review_period`，便于普通复盘完成事件直接打开结果。
- 当前返回给桌面端的 `AgentJob` 也会显式带 `strategy_id / linked_review_* / retried_from_job_id / retry_count`，便于 `AI 调度` 页直接复用。
- 桌面端当前也会在总览页与 `AI 调度` 页复用审计事件里的 `linked_review_id / review_id / strategy_id`，允许从实时 AI 事件流直接跳转到结果或策略活动。
- 写回到 `ReviewDocument` 的复盘结果当前也会带 `source_job_id / source_job_type / source_job_status`，便于桌面端从结果详情反向跳回对应 AI 任务。
- 同时这条接口当前还会直接给出 `latest_primary_review / latest_tracking_review / latest_tracking_job`，便于桌面端做轻量摘要，不必总是自己切分完整列表。
- 当前已经有真实下单、改单、撤单、全撤、平仓、策略自动下发等基础执行链路；后续需要继续把它们收敛成统一的生产级量化执行、风控与回测内核。

## 测试

```bash
python3 -m py_compile services/control-api/*.py services/control-api/tests/test_control_api.py
python3 -m unittest discover -s services/control-api/tests -p 'test_*.py' -v
```

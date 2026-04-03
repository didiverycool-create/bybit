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
- `WorkspacePreferences` 当前也会继续保存回测页聚焦回测、`仅当前策略/全策略` 回测筛选、复盘跟踪范围，以及提醒/成交/审计筛选器与审计搜索词，便于重启桌面端或切换会话后继续沿用原来的排障上下文。
- 行情接口当前优先走 Bybit 公共 WebSocket + REST；WebSocket 负责近实时更新，REST 继续承担首帧与回退。
- 私有账户接口支持从环境变量或 `~/.bybit-control/private-api.json` 读取 Bybit API 配置。
- 仓库内提供了示例文件 [private-api.example.json](/Users/leo/Desktop/Work/bybit/services/control-api/private-api.example.json)，请在本机自行复制到 `~/.bybit-control/private-api.json` 后再填写新的只读 Key，不要把真实密钥提交到仓库或发送到对话里。
- `GET /api/integrations/bybit-private` 当前也会显式返回本机配置文件路径、文件是否存在，以及仓库内示例文件路径；设置页可直接复用这组字段提示本地配置入口。
- `GET /api/integrations/openclaw` 当前也会显式返回 OpenClaw 本机配置路径、文件是否存在以及 `openclaw` 命令是否可用，便于快速区分“没配配置文件”和“本机没装 openclaw 命令”。
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
- `publish_recommendation` 当前除调度门禁外，也要求 payload 带有效 `recommendation`；若缺失结构化建议，后端会直接拒绝接受，不会提前改动提案状态。
- `script_patch_proposal` 当前接受后会明确转成 `queued` 状态的 `ChangeRequest`，并补写 `change_request.manual_followup_required` 审计事件，表示这类脚本补丁仍需后续人工或编排链落实，不会直接走自动应用。
- `ChangeRequest` 当前也会显式返回 `source_backtest_id / source_review_id / source_proposal_id / trigger_reason`，把这次变更是“手动创建”还是“接受某条提案”，以及它是否来自某轮回测复盘，结构化保留下来，便于前端和后续审计直接追溯来源链路。
- `ChangeRequest` 当前还会继续写回 `linked_backtest_id / linked_backtest_timeframe / linked_backtest_data_range`；对 `type=backtest.launch` 的变更，这组字段会直接指向它刚生成的那轮回测。
- 对 `type=backtest.launch` 的变更，`follow_up_job_*` 当前也会优先指向 `generate_backtest_review`，让桌面端直接围绕这轮回测复盘展示排队中 / 执行中 / 失败 / 完成，而不是退回到泛化的 `reconcile_change_request`。
- 同一条 `ChangeRequest` 当前还会继续镜像这轮关联回测的 `sample_quality / decision_readiness / decision_recommended_* / decision_readiness_action`，让前端不必再额外反查回测列表，就能直接在变更卡片上展示“样本门禁”和“按建议重跑”动作。
- 同一条 `ChangeRequest` 当前也会继续镜像这轮关联回测的 `history_source* / history_truncated / history_gap_reason / full_window_recommended_*`；即使桌面端暂时拿不到那轮回测详情，也能直接在变更卡片上展示“快照回退 / 样本截断”提示并复用结构化补样本建议。
- 同一条 `ChangeRequest` 当前还会继续镜像这轮关联回测的 `requested_* / retrieved_* / used_*` 样本窗口覆盖字段，便于前端在没有 `BacktestRun` 详情的情况下也能保留“请求 / 取样 / 回测”窗口事实与覆盖率展示。
- `ChangeRequest` 当前还会继续写回 `follow_up_job_id / follow_up_job_type / follow_up_job_status / follow_up_result_summary / linked_review_*`，让策略页和后续审计可直接看到这条变更后续排了哪条任务、当前跑到哪一步、有没有已经生成跟踪复盘；若这条变更后续又产出了 `generate_backtest_review`，这条回测复盘也会继续挂回同一条 `ChangeRequest.linked_review_*`。
- 若跟踪任务后续失败或被取消，再次重试时这组 `follow_up_job_*` 会自动切到新任务，并清空旧的失败摘要与旧结果引用，避免前端把“上一轮失败”误展示成当前状态。
- 这组来源字段当前也会继续带进后续 `reconcile_change_request / review_strategy_change` 任务上下文，以及 `strategy.change.review.completed / failed` 审计事件，便于从提案、变更到跟踪结果保持同一条来源链。
- 这类 `review_strategy_change` 任务在完成或失败后，当前也会额外写入 `strategy.change.review.completed / failed` 审计事件，方便策略活动与日志页直接复用。
- 当真实执行问题被升成 `system` 提醒时，当前还会自动排一条 `review_strategy_issue` 任务，补齐“异常 -> 跟踪 -> AI 写回”的闭环。
- 这类 `review_strategy_issue` 任务在完成或失败后，当前也会额外写入 `strategy.issue.review.completed / failed` 审计事件，方便策略活动与日志页直接复用。
- 当前还支持 `POST /api/strategies/{strategy_id}/review` 手动发起单策略问题/变更跟踪；桌面端策略页会复用这条接口，把人工关注点直接接入现有 AI 跟踪流，并补写 `strategy.review.requested` 审计事件。
- 上述两类任务在完成时，当前还会补写单策略跟踪复盘，直接进入 `GET /api/ai/reviews` 与 `GET /api/strategies/{strategy_id}/activity`。
- `GET /api/ai/reviews` 当前已支持按 `strategy_id / backtest_id / period` 过滤，便于桌面端按单策略、单轮回测或单类复盘精确拉取。
- 桌面端 `AI 复盘` 页当前会把 `strategy_issue / strategy_change` 这类单策略跟踪复盘单独归到“策略跟踪”，避免与日报 / 回测复盘混排。
- 当前写入 `ReviewDocument` 时，还会自动把 `execution_health.top_issue` 与运行线程问题并入风险列表，避免复盘遗漏真实执行门禁。
- 回测复盘写回 `ReviewDocument` 时，当前还会保留 `backtest_id` 与 `decision_readiness*`，便于桌面端把单轮回测结果和对应复盘、门禁建议、按建议重跑动作精确绑定。
- 通过 `POST /api/backtests`、接受 `backtest_request`，或由 `ChangeRequest(type=backtest.launch)` 自动落地的新回测，当前还会把 `source_change_request_id / source_* / trigger_reason` 一并写进 `BacktestRun` 和 `generate_backtest_review` 队列上下文，便于后续复盘与审计继续追溯来源链路。
- 当前发给 OpenClaw 的日度复盘 / 回测复盘提示词，也会显式附带执行健康摘要与运行线程状态，减少模型只围绕收益数字总结的情况。
- `POST /api/backtests` 与接受 `backtest_request` 提案时，回测周期当前都会统一校验为 `15m / 1h / 4h / 1d`，避免无效周期把脏参数带进回测链路。
- 同时写入任务队列的 `generate_daily_review / generate_backtest_review` 上下文当前也会带 `execution_health / execution_top_issue / execution_top_issue_symbol / execution_top_issue_detail / runtime_worker_top_issue`，便于后续审计与任务重试定位。
- 上述复盘上下文当前还会带 `execution_top_issue_strategy_activity / review_strategy_activity`，把问题策略或当前复盘策略最近的运行态、提醒、委托、成交和审计事件压成紧凑摘要，便于 OpenClaw 直接引用。
- 回测复盘任务当前会在入队时就固化 `review_strategy_activity`；后续生成 `generate_backtest_review` 提示词和写回 `ReviewDocument` 时会优先复用这份上下文，不再因稀疏上下文临时拉取 Bybit 实时链路。仅 `generate_daily_review` 仍保留最新执行健康兜底。
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
- 对 `generate_backtest_review` 而言，写回到 `ReviewDocument` 的结果当前也会同步保留 `source_change_request_id / source_backtest_id / source_review_id / source_proposal_id / trigger_reason`，便于 `AI 复盘`、策略活动和人工排查直接追溯这条复盘的来源链路；桌面端也可直接沿这组字段跳回来源变更、来源回测或来源复盘。
- 同一类 `generate_backtest_review` 任务的 `openclaw.job.started / failed / cancelled / completed` 审计事件，当前也都会在 payload 顶层补齐 `backtest_id / source_* / trigger_reason / decision_*`，方便日志页和 AI 实时流在任务未完成时直接近场排障。
- 对应的 `openclaw.job.retry_requested` 审计事件当前也会补齐同一组顶层字段，因此从“请求重试”开始，日志页和 AI 实时流就能直接复用来源链路与门禁建议。
- 同一类任务的 `openclaw.job.queued` 入队事件当前也会补齐同一组顶层字段；若命中相同 `idempotency_key` 幂等复用，后端会直接返回已有任务，不会重复追加新的入队审计。
- `scheduler.command` 在 `cancel_job / enter_manual_override` 这类会直接影响单任务的命令上，当前也会补齐同一组顶层字段，包括 `source_change_request_id`，并额外带 `cancelled_job_ids / cancelled_job_count / scheduler_status / freeze_publish`，方便日志页和 AI 实时流直接就地排障。
- 对 `cancel_all` 而言，`scheduler.command` 当前还会补齐受影响任务集合的结构化摘要，包括 `cancelled_job_types / cancelled_strategy_ids / cancelled_backtest_ids / cancelled_source_change_request_ids / cancelled_source_* / cancelled_trigger_reasons / cancelled_decision_readiness_values`，便于后续日志页和诊断视图直接消费。
- 同时这条接口当前还会直接给出 `latest_primary_review / latest_tracking_review / latest_tracking_job`，便于桌面端做轻量摘要，不必总是自己切分完整列表。
- 本地回测引擎当前也会按持仓逐 bar 盯市生成权益曲线，`max_drawdown` 不再只按平仓后的已实现权益计算。
- 本地回测引擎当前会按逐 bar 权益收益率年化 `Sharpe`，不再按成交笔数近似。
- `POST /api/backtests` 的 `data_range` 当前既支持 ISO 区间，也支持 `最近 45/90/180 天` 这类相对中文区间，并会真实驱动 K 线取数窗口，而不是一律回退默认 90 天。
- `BacktestRun` 当前还会显式返回 `requested_range_start / requested_range_end`，把 `最近 180 天` 这类相对区间在回测创建时固化成绝对请求窗口，便于 AI 复盘、桌面端和人工排查统一对照。
- `BacktestRun` 当前还会显式返回 `retrieved_window_completion_pct / used_window_completion_pct`，分别表示“实际取样窗口”与“最终回测窗口”相对目标请求窗口的覆盖率。
- `BacktestRun` 当前还会显式返回 `history_source=exchange_history|market_detail_fallback`，用于区分本次结果是否来自交易所历史 K 线，还是已经回退到工作台行情快照样本。
- `BacktestRun` 当前还会显式返回 `history_source_reason=none|exchange_fetch_failed|insufficient_exchange_samples` 与 `history_source_detail`，便于接口、桌面端和 AI 复盘直接说明这次为何发生快照回退。
- `BacktestRun` 当前还会显式返回 `history_source_recommended_data_range / history_source_recommended_timeframe / history_source_recommended_action`，用于结构化描述快照回退后的下一步补样本或恢复后重跑建议。
- `BacktestRun` 当前还会显式返回 `decision_readiness=ready|sample_incomplete|research_only`、`decision_readiness_detail`、`decision_recommended_data_range / decision_recommended_timeframe` 与 `decision_readiness_action`，用于统一表达“这次结果能否直接用于调参/上线判断”以及“下一次应按什么参数重跑”。
- `BacktestRun` 当前还会显式返回 `source_change_request_id / source_backtest_id / source_review_id / source_proposal_id / trigger_reason`，用于结构化保留这轮回测是“手动创建 / 由哪条变更触发 / 门禁重跑 / 复盘建议重跑 / 接受提案”中的哪一种来源链路。
- 本地回测入口当前会优先按目标窗口分页拉取 Bybit 历史 K 线；`requested_candle_limit` 表示当前回测样本上限，而不是单页接口上限。
- 若目标区间在当前周期下理论需要的 K 线数量超过当前回测样本上限，`BacktestRun` 当前会显式返回 `requested_candle_estimate / requested_candle_limit / retrieved_candle_count / used_candle_count / history_truncated`，提醒本次样本窗口已被截断。
- `BacktestRun.history_gap_reason` 当前会显式区分 `sample_cap` 和 `insufficient_history`：前者表示被当前回测样本上限截断，后者表示交易所当前可用历史本身不足。
- `BacktestRun` 当前还会显式返回 `retrieved_range_start / retrieved_range_end / used_range_start / used_range_end`，用于说明本次实际取到的历史样本覆盖到了哪段时间，以及最终参与本地回测的窗口起止。
- 若样本窗口已被截断，`BacktestRun` 当前还会显式返回 `full_window_recommended_data_range / full_window_recommended_timeframe / full_window_recommended_action`，让桌面端和人工排查直接知道当前应是“保持区间改粗周期”还是“先缩短区间再回测”。
- 当回测区间内没有真实触发入场信号时，本地回测引擎当前也会按基础价格路径生成连续 fallback 权益曲线，而不是只在最后一根 K 线跳变。
- 这类 fallback 参考路径当前不会再被记成 1 笔真实交易，`trades / win_rate` 会保持为 `0`，并在回测备注里明确标注“仅供研究参考”。
- 当回测结果属于 `reference_only` 时，回测 AI 启发式提案当前不会再给激进调参建议，而是会默认回退成“扩大样本验证”的保守回测请求。
- `BacktestRun` 当前也会显式返回 `reference_only`，方便桌面端和后续 AI 直接区分“真实成交样本”与“仅参考路径”。
- `BacktestRun` 当前也会显式返回 `sample_quality=reference_only|low_sample|sufficient`，供桌面端和后续 AI 直接复用统一样本质量口径。
- 当 `history_truncated=true` 时，回测 AI 复盘与默认提案当前也会把它视为“样本窗口未完整覆盖”的保守门禁：若仍有更粗周期可完整覆盖，就优先保持同一 `data_range` 并切周期；若连最粗周期也无法完整覆盖，则会明确改成“缩短到当前回测样本上限内可完整覆盖的区间”，而不是继续给误导性的调参或上线倾向结论。
- `generate_backtest_review` 当前也会显式带上 `reference_only` 上下文；当样本仅为参考路径时，AI 复盘提示词和默认风险项都会明确要求“不要把收益率 / 胜率 / Sharpe 直接视为可上线结论”。
- 即使不是 `reference_only`，当真实成交样本少于 `5` 笔时，回测 AI 启发式提案当前也不会直接给风控/上线倾向建议，而是会默认回退成“扩大样本验证”的保守回测请求；复盘提示词和默认风险项会明确标注“低样本真实成交”。
- 若 `reference_only / low_sample` 回测复盘的模型输出仍夹带 `risk_update / param_update / publish_recommendation` 等激进 JSON 提案，后端当前也会直接过滤；若模型同时给出了确实推进样本收集的 `backtest_request`，则会保留这条安全请求。
- 若 `history_source=market_detail_fallback`，回测 AI 复盘当前也会进入同一套保守门禁：优先提示“恢复交易所历史后重跑”，不直接放行激进调参或上线倾向提案；若接口已提供 `history_source_reason / history_source_detail`，复盘 prompt 和本地 fallback review 也会继续带出具体回退原因。
- 默认保守 `backtest_request` 当前也会按 `history_source_reason` 自动细分：历史拉取报错时保持原区间/周期等待恢复；交易所样本不足时优先给出补样本用的区间/周期建议。
- `generate_backtest_review` prompt、本地 fallback review 与桌面端当前也会直接复用 `decision_readiness*`，不再要求下游自己组合 `reference_only / low_sample / history_truncated / history_source`。
- 当这类保守补样本请求发现当前区间已经是 `最近 180 天` 时，后端当前会自动切到更高频周期继续补样本，避免重复提交完全相同的回测请求。
- 当前已经有真实下单、改单、撤单、全撤、平仓、策略自动下发等基础执行链路；后续需要继续把它们收敛成统一的生产级量化执行、风控与回测内核。

## 测试

```bash
python3 -m py_compile services/control-api/*.py services/control-api/tests/test_control_api.py
python3 -m unittest discover -s services/control-api/tests -p 'test_*.py' -v
```

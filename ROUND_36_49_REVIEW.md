# Round 36 - Round 49 改动汇总（供 Codex 审查）

本文档涵盖本次重构会话从 Round 36 开始到 Round 49 收尾期间产生的全部提交。
目的：让 Codex 在不重新阅读会话记录的前提下，能逐项对照代码做独立审查。

## 分支与提交

- 分支：`codex/bybit`
- 基线：`e0c2f94`（`refactor desktop workspace and verification flows`）
- 最新：`8b08026`（Round 49）
- 总提交数（基线到当前）：42 次

```
8b08026 Round 49: close backend gaps for new strategy fields
4687eb4 Round 48: wire frontend UI to new strategy fields
6bdea8a Round 47: Add momentum, Bollinger squeeze, and RSI reversal kernels
f0f773c Round 46: Calibrate signal confidence by regime, drift, and TF alignment
41c8305 Round 45: Add volatility regime classification and ATR-based sizing
d507dc6 Round 44: Add trailing stop, break-even, and partial take-profit exits
b3fd394 Round 42: Extract private execution preview into a dedicated module
cc44c68 Round 41: Extract alert/guard sync into a dedicated module
76c21ee Round 40: Extract build_prometheus_metrics into a dedicated module
728e23a Round 43: Extract paper-order risk guard into a stateless module
610e0bd Round 37: Cover three hard constraints with integration tests
6484cdb Round 38: Extract execution_health helpers into a dedicated module
edba094 Round 36: Code-split workspace containers and overlay panels via React.lazy
cc84381 Round 39: Debounce window move/resize persistence
```

（Round 36 提交早于 Round 37-43 的部分模块化，归档顺序按功能而非时间。）

---

## 一、整体目标

- **后端结构化**：把 `main.py` 从 10,870 行压到 9,749 行，抽出 5 个聚焦模块；
  `repository.py` 同步保持单入口 RLock 模式，所有新逻辑走公共 API。
- **策略能力加强**：在 StrategySummary 上以「纯新增、默认 None」的方式加入
  退出工具（R44）、波动分档仓位（R45）、置信度校准（R46）、三种新 kernel（R47）。
  所有新特性为 opt-in，既有回测 / 实盘路径保持 bit-exact。
- **桌面前端对接**：TypeScript 类型镜像、编辑面板加可选高级配置、回测面板
  展示新 trade 维度（R48），最后回头补齐后端 parameter_patch 与 BacktestRun
  对新字段的响应（R49）。

## 二、核心文件行数对照

| 文件 | 最新行数 | 说明 |
|------|---------|------|
| `services/control-api/main.py` | 9,749 | 原 10,870 行，抽出 5 模块 |
| `services/control-api/models.py` | 1,708 | 新增 BacktestTradeModel、4 组 R44-47 子模型 |
| `services/control-api/repository.py` | 5,938 | 新增 `_apply_strategy_top_level_field` 等 |
| `services/control-api/backtest_engine.py` | 2,749 | 新增 3 种 kernel runner、exit tools、波动分档 |
| `services/control-api/strategy_runtime.py` | 1,273 | 新增 3 种 kernel evaluate + 校准链路 |
| `services/control-api/execution_health.py` | 413 | R38 新建 |
| `services/control-api/prometheus_metrics.py` | 491 | R40 新建 |
| `services/control-api/alert_and_guard_sync.py` | 329 | R41 新建 |
| `services/control-api/execution_preview_builders.py` | 342 | R42 新建 |
| `services/control-api/risk_guards.py` | 86 | R43 新建 |
| `services/control-api/tests/test_control_api.py` | 20,765 | 从 377 个用例扩到 435 个 |

---

## 三、逐轮清单

### Round 36 — 桌面工作台代码分包（`edba094`）

- 组件：`AppWorkspaceSectionOutlet.tsx`、`AppOverlayPanelsHost.tsx`、
  `AppOverlayPanelsContainer.types.ts`、`StrategyActivityFloatingPanelContainer.tsx`
  改用 `React.lazy` + `Suspense` 懒加载各工作区。
- 产物：`dist/assets/index-*.js` 从 737 kB 下降到 458 kB。
- 风险点：懒加载组件的初次进入延迟，已用 `Suspense` fallback 覆盖。

### Round 37 — 三条硬约束集成测试（`610e0bd`）

新增 `HardConstraintIntegrationTests`（3 用例）：

- `test_openclaw_job_completion_creates_review_record_but_no_orders` — 校验
  OpenClaw 任务完成只产出复盘文档，不会直接下单。
- `test_preview_trade_endpoint_surfaces_risk_guard_blocked_reason` —
  `/api/execution/preview` 在被风险闸拦截时暴露原因。
- `test_manual_paper_order_rejects_with_409_when_risk_guard_blocks` —
  Paper 仓位金额超过 `PAPER_STARTING_CASH`（10 BTC @ 65k = 650k > 250k）返回 409。

### Round 38 — execution_health 模块抽出（`6484cdb`）

新建 `services/control-api/execution_health.py`（413 行），抽取 5 个工具函数：

- `public_channel_for_market`
- `build_public_execution_channel_health`
- `get_public_execution_channel_issue`
- `build_execution_health_top_issue_context`
- `merge_execution_health_review_risks`

所有抽取函数都在 `main.py` 里以同名 thin wrapper 保留，防止破坏调用点。
同步新增 `ExecutionHealthModuleUnitTests`（11 用例）。

### Round 39 — 窗口状态防抖（`cc84381`）

文件：`apps/desktop/src/main/window-factory.ts`

- `move` / `resize` 事件 500ms 去抖，再落盘窗口状态。
- `maximize` / `unmaximize` / `close` 立即 flush。
- 避免拖拽期间高频写 IPC 存储。

### Round 40 — prometheus_metrics 模块抽出（`76c21ee`）

新建 `services/control-api/prometheus_metrics.py`（491 行）。
核心函数 `build_prometheus_metrics` 接收约 20 个 keyword-only 协作者，
不再直接访问任何 `main.py` 全局。`main.py` 保留同名 wrapper。

### Round 41 — 告警/闸同步模块抽出（`cc44c68`）

新建 `services/control-api/alert_and_guard_sync.py`（329 行）。
包含：

- `sync_strategy_runtime_worker_issue_alerts`
- `sync_public_execution_channel_alerts`
- `sync_private_execution_channel_alerts`

共 8 个 Callable 通过参数注入，仓库层保持为唯一真值源。

### Round 42 — 私有执行预览模块抽出（`b3fd394`）

新建 `services/control-api/execution_preview_builders.py`（342 行）。
主函数 `build_private_execution_preview` 附带 4 个配套 helper，
共注入 17+1 个协作者（Callable / 常量）。

### Round 43 — paper-order 风险闸抽出（`728e23a`）

新建 `services/control-api/risk_guards.py`（86 行），把
`Repository._evaluate_paper_order_risk_locked` 的业务逻辑改写成纯模块级函数
`evaluate_paper_order_risk`。`Repository._evaluate_paper_order_risk_locked`
退化为 thin wrapper，仅负责把 `self._format_usdt` / `self._format_quantity`
作为 Callable 传入。

### Round 44 — 退出工具（`d507dc6`）

`StrategySummary` 新增（全部 opt-in，默认 `None`）：

- `trailing_stop_pct: Optional[float]`
- `break_even_trigger_pct: Optional[float]`
- `partial_take_profits: Optional[List[PartialTakeProfit]]`

其中 `PartialTakeProfit { trigger_pct: float, exit_ratio: float }`。

`backtest_engine.py` 新增：

- `_ExitToolRung` dataclass（L982）
- `_ExitToolState` dataclass（L1003）
- `_build_exit_tool_state`（L1119）
- `_apply_exit_tools_on_bar`（L1161）

3 个 runner（trend、mean-revert、breakout）在原生止损前插入退出工具评估。
测试：`StrategyExitToolsUnitTests`（7 用例）。

### Round 45 — 波动分档仓位（`41c8305`）

`StrategySummary` 新增：

- `volatility_sizing_enabled: bool = False`
- `volatility_lookback: Optional[int] = 14`
- `volatility_target_pct: Optional[float]`
- `volatility_regime_thresholds: Optional[VolatilityRegimeThresholds]`
- `regime_exposure_multipliers: Optional[RegimeExposureMultipliers]`（默认 low=1.2 / normal=1.0 / high=0.6）

`backtest_engine.py` 新增：

- `_compute_bar_atr`（L1261）
- `_classify_volatility_regime`（L1305）
- `_resolve_dynamic_risk_per_trade`（L1336）
- `_VolatilitySizingConfig`（L1373）
- `_build_volatility_sizing_config`（L1390）
- `_resolve_entry_regime_and_risk`（L1422）

`BacktestTrade` 额外新增 `volatility_regime: Optional[str]` 与
`applied_risk_per_trade: Optional[float]` 两个 trade 级字段。
测试：`VolatilityRegimeSizingUnitTests`（12 用例）。

### Round 46 — 置信度校准（`f0f773c`）

`StrategySummary` 新增：

- `confidence_calibration_enabled: bool = False`
- `confidence_regime_adjustments: Optional[ConfidenceRegimeAdjustments]`
- `confidence_parameter_drift_penalty: Optional[float] = 0.0`
- `confidence_multi_timeframe_alignment: Optional[bool] = False`

`strategy_runtime.py` 新增：

- `apply_confidence_calibration`（signature: `base_confidence, *, strategy, regime, parameter_drift_score, multi_timeframe_aligned`）
- `_parameter_drift_score`
- `_infer_volatility_regime`

公式：`final = clamp(base × regime_multiplier × (1 - drift×penalty) + multi_tf_bonus, 0, 99)`。
`evaluate_strategy_runtime` 额外接受 `multi_timeframe_hint: Optional[bool]`。
测试：`SignalConfidenceCalibrationUnitTests`（17 用例）。

### Round 47 — 三种新 kernel（`6bdea8a`）

`StrategySummary.kernel` 扩展为：

```python
Literal["trend","mean_revert","breakout","momentum","bollinger_squeeze","rsi_reversal"]
```

9 个新参数字段全部 `Optional[int|float] = None`：
`roc_window`、`ema_trend_window`、`momentum_threshold_pct`、
`bollinger_window`、`bollinger_std`、`squeeze_bandwidth_pct`、
`rsi_window`、`rsi_overbought`、`rsi_oversold`。

`strategy_runtime.py`：`_evaluate_momentum`（L493）、
`_evaluate_bollinger_squeeze`（L554）、`_evaluate_rsi_reversal`（L626）；
辅助：`_ema_series`（L481）、`_rsi_value`（L501）、
`_bollinger_bandwidth_pct`（L537）。

`backtest_engine.py`：`_run_momentum`（L2053）、
`_run_bollinger_squeeze`（L2226，long-only）、`_run_rsi_reversal`（L2421）；
辅助：`_ema_series_closes`（L1991）、`_wilder_rsi_series`（L2012）。

路由：`strategy.kernel` 优先，未设置时回退到 `strategy.id` / `strategy.name` 启发式
（`run_local_backtest` L2636-2664）。
测试：`NewStrategyKernelsUnitTests`（9 用例）。

### Round 48 — 前端 UI 接入（`4687eb4`）

- `apps/desktop/src/types.ts`：新增 `PartialTakeProfit`、
  `VolatilityRegimeThresholds`、`RegimeExposureMultipliers`、
  `ConfidenceRegimeAdjustments`、`StrategyKernel`、`BacktestTrade`；
  `StrategySummary` 扩展 R44-47 全部字段，`BacktestRun` 新增 `trades?: BacktestTrade[]`。
- `StrategyEditorPanel.tsx`：kernel `<select>`（6 档 + 空值沿用默认路由）
  + 可折叠「高级配置」区（exit tools、volatility sizing、confidence calibration、
  各 kernel 参数条件显示）。
- `buildStrategyWorkspaceParameterDraftState.ts`：高级配置的任意 key 自动
  coerce（数字串 → number、`true/false` → bool、其余保留字串如 kernel 枚举），
  走原有 `parameter_patch` 通道上传。
- `BacktestExperimentPanel.tsx`：当 `selectedBacktest.trades` 存在时渲染
  「波动分箱 count breakdown」+「实际 risk_per_trade min/max/avg」两行 chip。
- 验证：`pnpm lint` + `pnpm build` 全绿（2803 模块）。

### Round 49 — 后端闭环（`8b08026`）

**Gap A — 暴露 trades 到 BacktestRun**

- `models.py`：新增 `BacktestTradeModel`（Pydantic 镜像）+
  `BACKTEST_RUN_TRADE_SERIALIZATION_CAP = 500` 常量；
  `BacktestRun.trades: Optional[List[BacktestTradeModel]] = None`。
- `backtest_engine.py`：`BacktestComputation` 新增
  `trades: List[BacktestTrade] = field(default_factory=list)`，
  `run_local_backtest` 里 `trades=list(final_trades)`。
- `main.py`：`_run_backtest` 返回的 dict 新增 `"trades"` 键，用
  `dataclasses.asdict(trade)` 序列化，封顶 500 条。
- `repository.py`：`_create_backtest_locked` 把 `computed.get("trades")`
  塞进 `BacktestRun(trades=...)`。

**Gap B — _apply_parameter_patch 识别顶层字段**

- 新增 `_STRATEGY_TOP_LEVEL_SCALAR_FIELDS`（frozenset，18 个标量：R44 2 个、
  R45 4 个、R46 3 个、R47 9 个）与 `_STRATEGY_KERNEL_VALUES`（6 值）。
- 新增 `_apply_strategy_top_level_field(strategy, key, value) -> bool`
  helper：kernel 校验 Literal 集合（非法抛 ValueError）；
  嵌套对象（VolatilityRegimeThresholds、RegimeExposureMultipliers、
  ConfidenceRegimeAdjustments、PartialTakeProfit 列表）走
  `model_validate`；标量 `setattr`。
- `_apply_parameter_patch` 改为先试顶层字段，未命中才落入原有
  `StrategyParameter` 行兜底。

**测试覆盖（Round 49 新增 10 个）**

- `test_kernel_override_applied_to_top_level_field`
- `test_scalar_exit_tool_fields_applied`
- `test_nested_volatility_regime_thresholds_validated`
- `test_partial_take_profits_list_validated`
- `test_regime_exposure_multipliers_validated`
- `test_confidence_regime_adjustments_validated`
- `test_invalid_kernel_raises`
- `test_unknown_key_falls_through_to_parameter_row`
- `test_backtest_run_trades_round_trip`
- `test_backtest_run_legacy_no_trades_round_trip`

---

## 四、测试与验证状态（当前 HEAD=`8b08026`）

- 后端 `pytest tests/test_control_api.py`：**435 / 435 pass**（Round 37/38/44/45/46/47/49
  各新增一批单测，Round 49 把总数从 425 推到 435）。
- 桌面 `pnpm --filter @bybit/desktop lint`：pass（0 warning）。
- 桌面 `pnpm --filter @bybit/desktop build`：pass（2803 modules transformed，
  `StrategyEditorPanel-*.js` 从 ~2 kB 涨到 11.79 kB，源自 R48 新增高级配置区）。
- `verify:market-switch` 等回归脚本在 Round 36/37/38 期间全部 clean
  （详见 Claude 接手清单 2026-04-19）。

## 五、向后兼容与风险说明

1. 全部 R44-47 新字段都默认 `None` / `False`，既有策略负载不改变行为。
   backtest 结果在未 opt-in 时 bit-exact 与 R43 基线一致（已通过回归基线）。
2. `BacktestRun.trades` 为 `Optional`，读取历史持久化记录（没有 `trades` 键）
   时直接返回 `None`，无异常。Round 49 新增
   `test_backtest_run_legacy_no_trades_round_trip` 覆盖。
3. `_apply_parameter_patch` 的旧行为（对未识别 key 追加 `StrategyParameter` 行）
   保持不变；仅在识别到 R44-47 顶层字段时直接赋值。
4. Round 44 退出工具顺序：先 partial take-profit 分层，再 break-even 上移止损，
   最后 trailing stop；任一命中即关仓并补记 `BacktestTrade`。
5. Round 47 的 kernel 路由保留旧启发式回退（`strategy.id.startswith(...)` /
   名字匹配），只有显式设置 `strategy.kernel` 才切换到新 runner。

## 六、需要 Codex 重点检查的地方

1. **Round 40 的 Prometheus 指标**：`prometheus_metrics.py` 里 ~20 个协作者的
   注入是否漏掉某个原 `main.py` 的局部变量（主要风险是 label 转义）。
2. **Round 42 的 ExecutionPreview**：`execution_preview_builders.py` 与
   `main.py` 里原 `build_private_execution_preview` 调用点的参数 diff，
   是否存在命名偏差。
3. **Round 43 的 risk_guards**：抽出后 `_format_usdt` / `_format_quantity`
   通过 Callable 注入；需要检查 `Repository` 层所有 paper-order 路径是否都
   走到新的 `evaluate_paper_order_risk`，旧方法是否真的全部被替换。
4. **Round 44 退出工具顺序**：当 trailing + break-even + partial TP 都启用且
   同一根 K 线命中多条时，当前实现按「分层 → break-even → trailing」顺序
   结算。请确认顺序是否符合预期。
5. **Round 45 `volatility_sizing_enabled=False` 的 bit-exact**：当关闭时，
   应该走旧 `risk_per_trade` 常量路径，注意
   `_resolve_entry_regime_and_risk` 的早返回。
6. **Round 46 置信度 clamp**：`apply_confidence_calibration` 的最终 `clamp(0, 99)`
   是有意避开 100 的（历史约定），请确认。
7. **Round 47 kernel 参数兜底**：当用户选了 `bollinger_squeeze` 但未给出
   `bollinger_window` 等参数时，runner 使用内置默认值（在
   `_run_bollinger_squeeze` 里 fallback）。需要检查这个默认是否合理。
8. **Round 48 高级配置字段上报**：前端走 `parameter_patch` 上传的字段是否
   会被 R49 的 `_apply_strategy_top_level_field` 完全识别？漏掉的会落入
   `StrategyParameter` 行，虽然不崩但语义错误。请对照两个表交叉验证：
   - 前端 `buildStrategyWorkspaceParameterDraftState.ts` 里 coerce 了哪些 key
   - 后端 `_STRATEGY_TOP_LEVEL_SCALAR_FIELDS` ∪ 4 个嵌套字段 ∪ `kernel`
9. **Round 48 `partial_take_profits` 只读展示**：当前桌面端不能编辑分层，
   只展示。后续需要提案流程下发时才修改。

## 七、已知未完成（给 Codex / 后续接手人）

- 桌面端 `BacktestTrade` 列表没有分页；如果后端返回 500 条，渲染成本可能偏高。
  当前只在 `BacktestExperimentPanel` 渲染聚合 chip（count breakdown、min/max/avg），
  未做分页表。
- Round 44 `partial_take_profits` 的交互编辑器（嵌套 list）桌面端暂未实现，
  以 readonly summary 呈现，引用提案流程下发。
- `seed.py` 提供的种子策略仍未 opt-in R44-47 新字段，所以在 demo 数据里
  这些新能力默认不生效。需要的话单独加 demo 策略。

---

## 八、文件落点速查

**后端新增模块**

- `services/control-api/execution_health.py`（R38）
- `services/control-api/prometheus_metrics.py`（R40）
- `services/control-api/alert_and_guard_sync.py`（R41）
- `services/control-api/execution_preview_builders.py`（R42）
- `services/control-api/risk_guards.py`（R43）

**后端修改**

- `services/control-api/models.py`（R44/R45/R46/R47/R49）
- `services/control-api/strategy_runtime.py`（R46/R47）
- `services/control-api/backtest_engine.py`（R44/R45/R47/R49）
- `services/control-api/repository.py`（R43/R49）
- `services/control-api/main.py`（R38/R40/R41/R42/R43/R49，行数 10,870 → 9,749）

**前端修改**

- `apps/desktop/src/main/window-factory.ts`（R39）
- `apps/desktop/src/components/AppWorkspaceSectionOutlet.tsx`（R36）
- `apps/desktop/src/components/AppOverlayPanelsHost.tsx`（R36）
- `apps/desktop/src/components/AppOverlayPanelsContainer.types.ts`（R36）
- `apps/desktop/src/components/StrategyActivityFloatingPanelContainer.tsx`（R36）
- `apps/desktop/src/types.ts`（R48）
- `apps/desktop/src/components/StrategyEditorPanel.tsx`（R48）
- `apps/desktop/src/components/buildStrategyWorkspaceParameterDraftState.ts`（R48）
- `apps/desktop/src/components/backtest-workspace/BacktestExperimentPanel.tsx`（R48）

**测试**

- `services/control-api/tests/test_control_api.py`：377 → 435 用例（+58）
  - `HardConstraintIntegrationTests`（R37，3）
  - `ExecutionHealthModuleUnitTests`（R38，11）
  - `StrategyExitToolsUnitTests`（R44，7）
  - `VolatilityRegimeSizingUnitTests`（R45，12）
  - `SignalConfidenceCalibrationUnitTests`（R46，17）
  - `NewStrategyKernelsUnitTests`（R47，9）  ⚠ 原记录提到 9，实际可能为 9
  - `StrategyParameterPatchRound49UnitTests`（R49，10）

---

## 九、Codex 审查建议顺序

1. 先拉 diff：`git log --oneline e0c2f94..HEAD` 对照本文档第一节的提交列表。
2. 按 Round 顺序跑：先 R36-43（结构），再 R44-47（策略能力），最后 R48-49
   （UI + 后端闭环）。
3. 每轮 diff 后重点看：
   - 是否有 `TODO` / 被遗忘的分支；
   - 所有 thin wrapper 是否真正等价；
   - 新增 Pydantic 字段的默认值是否全是 None/False。
4. 跑一遍测试：
   ```
   cd services/control-api && python3 -m pytest tests/test_control_api.py -q
   pnpm --filter @bybit/desktop lint
   pnpm --filter @bybit/desktop build
   ```
5. 如果想抽样验证 bit-exact，可以拿一个旧 backtest run 从持久化文件直接
   `BacktestRun.model_validate(...)` 看是否还能无异常反序列化。

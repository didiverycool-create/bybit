# Round 36 - Round 49 独立核查结果（Codex）

核查对象：`ROUND_36_49_REVIEW.md`  
核查时间：`2026-04-20`  
核查范围：Round 36 - Round 49 涉及的前端、后端、回测与测试链路  
核查方式：对照提交清单逐项审阅代码，并补跑关键验证命令

## 结论摘要

本轮改动整体并非“不可用”，结构化抽取部分也没有发现同级别严重问题；但在 R48-R49 的前后端字段闭环、以及 R44 的 partial take-profit 交易记录上，存在 5 个明确缺陷。

其中 3 个为 `P1`：

- 前端高级配置里的 3 组嵌套字段没有按后端契约组装，提交后不会落到真实顶层字段。
- `strategy_runtime.py` 仍只读取 `strategy.parameters`，忽略了 R49 新增的顶层字段。
- `backtest_engine.py` 同样只读取 `strategy.parameters`，导致回测 runner 和 `parameter_snapshot` 都吃不到新顶层参数。

另外 2 个为 `P2`：

- partial take-profit 的 `BacktestTrade` 记录把 `entry_bar_index` 写成了退出 bar。
- 前端编辑器当前无法把 `kernel` 清回“沿用默认路由”。

## 发现列表

### 1. [P1] 扁平 draft key 没有组装成后端要求的嵌套对象

位置：

- `apps/desktop/src/components/buildStrategyWorkspaceParameterDraftState.ts:50-56`
- `services/control-api/repository.py:3709-3733`

问题：

- 前端把 `volatility_regime_low_pct`、`volatility_regime_high_pct`
  `regime_exposure_low`、`regime_exposure_normal`、`regime_exposure_high`
  `confidence_regime_low`、`confidence_regime_normal`、`confidence_regime_high`
  这类扁平 key 直接塞进 `parameter_patch`。
- 后端仓库层只识别：
  - `volatility_regime_thresholds`
  - `regime_exposure_multipliers`
  - `confidence_regime_adjustments`
- 因此前端当前高级配置里的 3 组嵌套字段不会写入真实顶层模型。

实际影响：

- 用户在策略编辑器里修改这些高级配置，看起来能提交，但不会进入真实配置。
- 这些 key 会掉进旧 `StrategyParameter` 兜底分支，污染 `strategy.parameters`。
- 下次打开编辑器时，可能会把错误的“伪参数”继续当普通参数展示。

复现结论：

- 直接调用 `repo._apply_parameter_patch("trend-btc-01", {"volatility_regime_low_pct": 0.7})`
  后，新增的是 `StrategyParameter(key="volatility_regime_low_pct")`，
  `strategy.volatility_regime_thresholds` 仍然是 `None`。

### 2. [P1] 运行态仍然只读 `strategy.parameters`，忽略新顶层参数

位置：

- `services/control-api/strategy_runtime.py:166-173`

问题：

- `_param_value()` 当前只从 `strategy.parameters` 中取值。
- Round 49 已经把 `roc_window`、`bollinger_window`、`rsi_window`
  `ema_trend_window`、`momentum_threshold_pct` 等字段持久化到
  `StrategySummary` 顶层。
- 结果是“写入路径”与“消费路径”不一致。

实际影响：

- 新 kernel 的顶层调参不会影响实时信号。
- 用户或 API 即便成功写入顶层字段，运行态仍会继续吃默认值。

复现结论：

- 构造 `StrategySummary(kernel="momentum", roc_window=2, ema_trend_window=2, momentum_threshold_pct=50.0)`，
  运行 `evaluate_strategy_runtime()` 后，输出文案仍然显示 `ROC(10)` 与默认阈值 `2.00%`，
  说明运行态没有读取顶层字段。

### 3. [P1] 回测 runner 同样忽略新顶层参数并丢失快照

位置：

- `services/control-api/backtest_engine.py:317-318`
- `services/control-api/backtest_engine.py:2598-2748`

问题：

- `_parameter_map()` 只把 `strategy.parameters` 转成 dict。
- Round 47 / Round 49 的新增顶层字段没有进入 backtest runner 输入。
- `BacktestComputation.parameter_snapshot` 也只保存旧 `parameters`，不会记录这些顶层字段。

实际影响：

- 前端把 kernel 相关新字段写进去后，回测仍按默认值运行。
- 回测详情、复盘、审计链路看到的 `parameter_snapshot` 不完整。
- 用户会看到“编辑器里参数改了，但回测行为没变”的假成功。

复现结论：

- 构造带顶层 `kernel='momentum', roc_window=2, momentum_threshold_pct=50.0` 的策略跑 `run_local_backtest()`，
  `parameter_snapshot` 只有旧参数，不包含这些新字段。
- 同一次复现里回测没有触发对应调参后的行为，说明 runner 也没有消费这些字段。

### 4. [P2] Partial TP trade 记录把 `entry_bar_index` 写成了退出 bar

位置：

- `services/control-api/backtest_engine.py:1223-1230`

问题：

- partial take-profit 命中时，追加的 `BacktestTrade` 使用了当前 `bar_index`
  作为 `entry_bar_index`。
- 这笔 trade 实际代表“从原始仓位中切出的一部分”，它的 entry 应该继承原始入场 bar。
- 同时这条 partial trade 没有补上：
  - `volatility_regime`
  - `applied_risk_per_trade`

实际影响：

- `avg_holding_bars` 会被低估。
- `active_bar_ratio_pct` 也会偏低。
- R48 新增的波动 regime / risk_per_trade 聚合展示，在启用 partial TP 时会漏数。

复现结论：

- 使用 `partial_take_profits=[{trigger_pct: 0.5, exit_ratio: 0.5}]` 的趋势策略回测后，
  第一笔 partial trade 被记录为 `entry_bar_index == exit_bar_index == 4`，
  但真实持仓是更早开的。

### 5. [P2] 编辑器无法把 `kernel` 恢复为默认路由

位置：

- `apps/desktop/src/components/StrategyEditorPanel.tsx:133-145`
- `apps/desktop/src/components/buildStrategyWorkspaceParameterDraftState.ts:51-55`

问题：

- UI 提供了“沿用策略默认路由”的空值选项。
- 但 draft 组装时把空字符串直接过滤掉了，而不是显式发 `null`。
- 对已经设置过 `kernel` 的策略，这意味着用户无法通过编辑器把它清回 `None`。

实际影响：

- 一旦策略设置过 `kernel`，前端无法恢复到旧的启发式默认路由。
- 其他需要“显式清空”的可选顶层字段，也存在同类风险。

## 对 Round 36 - Round 43 的补充结论

针对文档里特别提到的几个高风险点，我额外做了针对性核查：

- `prometheus_metrics.py`
  - `main.py` 的 wrapper 注入参数与抽出模块的签名能对上。
  - 当前没有发现明显漏传协作者或 metrics label 逃逸问题。
- `execution_preview_builders.py`
  - wrapper 到调用点的参数顺序与命名整体一致。
  - 当前没有发现调用错位或明显命名偏差导致的行为变化。
- `risk_guards.py`
  - `Repository` 层 paper-order 相关主要路径仍统一走 `_evaluate_paper_order_risk_locked()`。
  - 当前没有发现旧逻辑残留分叉。
- `window-factory.ts`
  - `move/resize` 防抖、`maximize/unmaximize/close` 立即 flush 的实现逻辑合理。
  - 当前没有发现明显状态丢失问题。

结论：

- 结构化抽取部分整体风险低于字段闭环问题。
- 本次更值得优先修复的是 R48-R49 新字段链路，以及 R44 partial TP 的 trade 记录。

## 已执行验证

### 1. 后端测试

命令：

```bash
cd services/control-api
python3 -m pytest tests/test_control_api.py -q
```

结果：

- `435 passed`
- 有 2 条 `websockets` 弃用 warning
- 当前没有失败用例

### 2. 桌面端 lint

命令：

```bash
pnpm --filter @bybit/desktop lint
```

结果：

- 通过

### 3. 桌面端 build

命令：

```bash
pnpm --filter @bybit/desktop build
```

结果：

- 通过
- renderer 构建产物显示懒加载分包已生效

## 为什么现有验证没有拦住这些问题

主要是测试覆盖空洞，不是问题不存在：

- 现有测试覆盖了 `repository._apply_parameter_patch()` 对“正确嵌套对象”的校验，
  但没有覆盖“前端实际发出的 payload 形状”。
- 现有测试覆盖了新顶层字段的模型 round-trip，
  但没有覆盖“运行态 / 回测是否真的读取这些顶层字段”。
- 现有回测统计测试没有覆盖“启用 partial take-profit 后 trade 元数据是否仍然正确”。

因此会出现：

- `pytest` 全绿
- `lint/build` 全绿
- 但真实功能链路仍然有行为偏差

## 修复优先级建议

建议按下面顺序处理：

1. 先修前端 draft -> 后端嵌套对象组装。
2. 再修 `strategy_runtime.py` 的顶层参数读取。
3. 再修 `backtest_engine.py` 的顶层参数读取与 `parameter_snapshot`。
4. 补 partial TP 的 `BacktestTrade` entry/risk/regime 元数据。
5. 最后补“清空 kernel / 清空可选顶层字段”的前端语义。

## 建议补充测试

建议最少补下面几类：

- 前端 `buildStrategyWorkspaceParameterDraftState`：
  - 扁平高级字段是否正确组装成 3 个嵌套对象
  - `kernel=''` 是否正确转成 `null`
- 后端 `strategy_runtime.py`：
  - 顶层 `roc_window / bollinger_window / rsi_window` 是否覆盖默认值
- 后端 `backtest_engine.py`：
  - 顶层新字段是否进入 runner
  - `parameter_snapshot` 是否包含新顶层字段
- partial take-profit：
  - partial trade 是否继承原始 `entry_bar_index`
  - partial trade 是否带 `volatility_regime / applied_risk_per_trade`

## 最终结论

这轮代码不是“整体失败”，但目前不能认为 R48-R49 的新字段链路已经真正闭环。

如果只看现有测试与构建状态，会得到“全部通过”的结论；  
如果看真实数据流，会发现：

- 前端高级配置有一部分不会正确落库
- 实时运行态不会消费这些新顶层字段
- 回测 runner 也不会消费这些新顶层字段
- partial TP 的 trade 元数据还会影响统计结果

因此当前更准确的状态应该是：

`结构重构基本稳定，但新策略字段能力尚未真正打通到端到端。`

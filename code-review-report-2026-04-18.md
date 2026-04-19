# 代码复审报告（增量）

**分支**: `codex/bybit`
**复审日期**: 2026-04-18
**基线**: `code-review-report.md`（2026-04-07 版，25 条）
**复审范围**: 验证原报告 P0/P1 修复状态 + 发现新问题
**目标读者**: 后续 Codex / AI 会话

---

## 摘要

- **已验证修复**：原报告 #1（Prometheus 注入）、#4（`snapshot()` 读写分离）、#5（缓存线程安全）、#2（App.tsx God Component）均已在当前代码中落地。
- **新增 P0 Bug**：`main.py:1286-1297` 存在一段 `return` 之后无法到达的死代码，引用了未定义变量 `value`，是粘贴事故。
- **新增架构问题**：后端 `main.py` (10,531 行) / `repository.py` (5,556 行) 仍巨大，但同目录出现 60+ 个超细粒度 helper；前端 `components/` 下出现 14 个 `strategyActivitySnapshotNormalization*` 文件 + 40+ 个 `build*Args` / `build*Input` 双胞胎文件。属于"拆出一堆微文件但核心文件没瘦身"的反模式。
- **api.ts 1,193 行** 混杂 HTTP 客户端、fallback mock 数据、业务规范化、SSE 等多重关注点。
- 原报告其余 Medium / Low 条目大多仍未闭环。

---

## 一、已验证修复（原报告）

| 编号 | 原问题 | 当前代码位置 | 状态 |
|---|---|---|---|
| #1 | Prometheus 指标注入 | `services/control-api/main.py:2609-2613` 新增 `prometheus_label_value()`，转义 `\\ \n "` | ✅ 已修复 |
| #2 | App.tsx God Component | `apps/desktop/src/App.tsx` 现 33 行，只剩顶层编排 | ✅ 已修复 |
| #4 | `snapshot()` 读写副作用 + 返回可变引用 | `services/control-api/repository.py:156-161` 已改为 `state.model_copy(deep=True)`，且不再在读路径触发 `_persist()` | ✅ 已修复 |
| #5 | 缓存字典线程安全 | `services/control-api/bybit_public_client.py:83` 新增 `_cache_lock = RLock()`，读写统一走 `_get_cached_entry` / `_set_cached_entry` | ✅ 已修复 |
| #9 | 缓存无容量上限 | `bybit_public_client.py:116-122` 各缓存桶均有 `max_entries` | ✅ 已修复（原报告已确认） |
| #10 | K 线缓存 TTL 过长 | `bybit_public_client.py:98-114` 已按周期分层并收紧 | ✅ 已修复（原报告已确认） |

---

## 二、新发现问题

### P0-NEW-1：死代码 + 未定义变量引用

**文件**: `services/control-api/main.py:1277-1297`

```python
def load_private_positions_snapshot() -> tuple[BybitPrivateStatus, List[Dict[str, Any]], str]:
    status = private_data.get_status()
    ensure_private_realtime_started()
    positions = private_realtime.get_positions_snapshot() if hasattr(private_realtime, "get_positions_snapshot") else []
    if not positions:
        positions = private_data.fetch_positions()
        private_realtime.seed_positions_snapshot(positions)
    updated_at = get_private_runtime_updated_at(status)
    return status, positions, updated_at        # ← line 1285，到此结束
    # ↓↓↓ 以下 12 行永远无法执行
    normalized = (
        str(value)                              # ← `value` 未定义
        .replace("USDT", "")
        .replace("%", "")
        .replace(",", "")
        .replace("+", "")
        .strip()
    )
    try:
        return float(normalized)
    except ValueError:
        return 0.0
```

**影响**：
- Python 不报 unreachable code，也不报 `value` 未定义（静态检查才会）。
- 这段代码看起来像从某个 `coerce_float` / `parse_usdt_number` 函数误粘贴进来的。
- 如果未来有人删掉前面的 `return`，程序会立刻在 `NameError: name 'value' is not defined` 上崩溃。

**修复建议**：
- 确认该段逻辑是否属于某个 `coerce_float` 辅助函数；属于则迁回原位，不属于则直接删除。
- 考虑在 CI 中加入 `ruff` / `pyflakes` 的 `unreachable code` 和 `undefined name` 规则。

---

### P1-NEW-2：微 helper 爆炸但核心文件未瘦身（后端）

**现象**：
- `services/control-api/main.py` 仍为 **10,531 行**
- `services/control-api/repository.py` 仍为 **5,556 行**
- 同目录下有 **60+ 个** `strategy_activity_*_helpers.py` 文件（多数在 20-200 行）

**问题**：
原报告 #2、#16 建议"拆分"后，实际上只是把"长对象 / 纯 builder"搬到了新文件，但核心编排逻辑（HTTP 路由、SSE 流、聚合、持久化）仍整块留在 `main.py` / `repository.py`。结果：
- 核心文件依旧巨大，维护成本未真正下降
- 新增了 60+ 个"只被一个地方 import"的微文件，目录列表被污染
- 代码跳转时"需要同时打开 10+ 个文件"的情况变多，阅读成本反而上升

**具体观察**：
- `main.py:5726-10508` 约 4,700 行 HTTP 路由（69 个端点）堆在同一文件
- `main.py` 顶部大量诊断辅助函数（`_build_*_recommended_action` 等）没有随 `strategy_activity_*_helpers.py` 一起外移
- `repository.py` 内大量方法内部还有 200+ 行的嵌套 builder 逻辑（如 `_build_review_strategy_activity_context_locked`）

**修复建议**：
- **先合并后重拆**：把 60+ 个微 helper 合并回 5-8 个按职责划分的模块（如 `strategy_activity/lineage.py`、`strategy_activity/snapshot.py`、`strategy_activity/payload.py`）
- **再拆核心**：把 `main.py` 的 HTTP 路由按领域拆到 `routes/market.py`、`routes/strategy.py`、`routes/private.py` 等，每个文件只装一个关注点
- **设定红线**：单文件 > 800 行即必须拆；但同时禁止出现 < 30 行的"空壳" helper 文件

---

### P1-NEW-3：前端 builder / normalization 双胞胎反模式

**文件**: `apps/desktop/src/components/` + `apps/desktop/src/`

**现象 A — 14 个顶层 normalization 文件**：

```
strategyActivitySnapshotNormalization.ts
strategyActivitySnapshotNormalizationBacktestReviewFlatFields.ts
strategyActivitySnapshotNormalizationChangeRequestFlatFields.ts
strategyActivitySnapshotNormalizationCollections.ts
strategyActivitySnapshotNormalizationDecision.ts
strategyActivitySnapshotNormalizationDecisionReviewRecordFields.ts
strategyActivitySnapshotNormalizationFlatFields.ts
strategyActivitySnapshotNormalizationFlatFields.types.ts
strategyActivitySnapshotNormalizationFlatFieldsResolvers.ts
strategyActivitySnapshotNormalizationFlatFieldsShared.ts
strategyActivitySnapshotNormalizationLatestOpsFlatFields.ts
strategyActivitySnapshotNormalizationProposalFlatFields.ts
strategyActivitySnapshotNormalizationReview.ts
```

这些文件不是独立功能模块，而是同一条规范化管道"按数据类型的横向切片"。新增一个数据类型就要新增一个文件。

**现象 B — builder 双胞胎**：

`components/` 下出现成对的 `build*Args.ts` + `build*Input.ts`，例如：
- `buildAppCompositionStrategyWorkspaceCurrentPanelStateArgs.ts`
- `buildAppCompositionStrategyWorkspaceCurrentPanelStateInput.ts`

两者只是命名不同（Args / Input），做同一件事。`components/` 下 **512 个文件**，其中 40+ 个是此类 `build*.ts`，内聚度极低。

**修复建议**：
- 把 14 个 normalization 文件合并回 **3 个**：`normalizeFlatFields.ts`、`normalizeCollections.ts`、`normalizeDecision.ts`
- 对每个 `build*Args` + `build*Input` 对：确认是否能合并成一个函数；不能合并的，至少合并到同一文件
- 在代码规范里写死："新建 < 40 行的 helper 文件必须先证明它会被 ≥ 2 处 import；否则写到调用点所在文件"

---

### P2-NEW-4：`api.ts` 职责混杂（1,193 行）

**文件**: `apps/desktop/src/api.ts`

**结构剖析**：
- **L111-200**：纯 HTTP 包装（`fetchJson`, `fetchJsonStrict`, `postJson`, `deleteJson`） — ✅ 正确关注点
- **L202-249**：业务过滤（`filterFallbackReviews`） — ❌ 混杂业务逻辑
- **L251-870**：20+ 个 `fallback*` mock 数据对象（`fallbackSnapshot`, `fallbackStrategies`, `fallbackAccountOverview` 等），合计约 600 行 — ❌ mock 数据不应驻留 HTTP 客户端
- **L875+**：`normalizeExecutionPreview`, `normalizeReviewDocument` 等响应规范化 — ❌ 应属于 selector 层
- **L882-1193**：70+ 个端点包装，中间穿插了 fallback 选择、错误恢复（`getStrategyExecutionPreview` 同时做 fetch + fallback 组装）

**修复建议**：
- 拆为三层：
  - `api/http.ts`：只放 `fetchJson` / `postJson` / SSE 建立
  - `api/endpoints/*.ts`：按领域组织端点包装，每个文件 100-300 行
  - `fallbacks/*.ts`：独立文件承载 mock 数据
  - `selectors/normalize*.ts`：响应规范化
- 这样 `api.ts` 从 1,193 行压到 < 200 行

---

### P3-NEW-5：测试覆盖不足

**文件**: `services/control-api/tests/`

仅 4 个测试文件（`test_control_api.py`、`test_bybit_private_realtime.py`、`test_bybit_public_realtime.py`、`test_backtest_engine.py`），对应 `control-api` 目录 ~26,000 行 Python 代码。

**明显缺失覆盖**：
- ❌ `repository.py` RLock 并发修改的线程安全测试
- ❌ `bybit_public_client.py` 缓存并发写入测试（原报告 #5 修复后无回归测试）
- ❌ Prometheus 指标转义（`prometheus_label_value`）的单元测试 —— 应覆盖 `"`、`\n`、`\\`、`}` 注入样本
- ❌ `build_strategy_activity_payload` 的多轮聚合正确性（原报告 #16）
- ❌ `load_private_positions_snapshot` 死代码在测试中没被触发过（否则会早点发现）

**修复建议**：
- 为 P0/P1 安全类修复补上回归测试（Prometheus 转义、缓存并发）
- 为 `snapshot()` 的深拷贝语义加一个断言测试（修改返回对象不应影响 repo 内部状态）

---

## 三、原报告中仍然有效、尚未闭环的条目

按原报告编号列出，代码未改或仅部分改动：

| 编号 | 问题 | 当前状态 |
|---|---|---|
| #3 | Electron 注入 ~700 行字符串脚本 | 未改 |
| #6 | `StrategyActivitySnapshot` 模型字段爆炸 | 仅部分收敛 |
| #7 | watchlist / market strict 模式无 UI 错误提示 | 未改 |
| #8 | SSE 断连无轮询兜底 | 未改 |
| #11 | 前后端重复逻辑（`auditImpactMeta` 等 4 对） | 仅部分收敛 |
| #12 | ECharts lazy 加载退化为同步 import | 未改 |
| #13 | 冗余三元 `liveMarketEnabled ? 12000 : 12000` | 需确认是否仍存在 |
| #14 | `RLock` 掩盖重入调用链 | 未改 |
| #15 | `LazyECharts` `lazyUpdate={false}` | 未改 |
| #16 | `build_strategy_activity_payload` 多轮遍历 | 部分缓解 |
| #17 | `pageUnloading` 不可逆 | 未改 |
| #18 | smoke 脚本硬编码 `http://127.0.0.1:8787` | 未改 |
| #19 | README 中英混杂 | 待确认 |
| #20 | `package.json` 的 `workspaces` 字段在 pnpm 下无效 | 待确认 |
| #21 | `parse_created_at` 重复定义且默认值不同 | 待确认 |
| #22 | `build_runtime_market_fallback_detail` 的 `source="mock"` 误导 | 未改 |
| #25 | `enrich_market_detail` `allow_rest_refresh=False` 分支数据不完整 | 未改 |

---

## 四、优先级建议（本次新增 + 仍有效项）

| 优先级 | 事项 | 工作量 | 文件/位置 |
|---|---|---|---|
| **P0** | 删除 `load_private_positions_snapshot` 中的死代码 | 极小 | `main.py:1286-1297` |
| **P0** | 补 Prometheus 转义的回归测试 | 小 | `tests/` 新增 |
| **P1** | 合并 14 个 `strategyActivitySnapshotNormalization*.ts` 回 3 个 | 中 | `apps/desktop/src/` |
| **P1** | 合并 40+ 个 `build*Args`/`build*Input` 双胞胎 | 中 | `apps/desktop/src/components/` |
| **P1** | 拆分 `api.ts` 为 `http / endpoints / fallbacks / selectors` 四层 | 中 | `apps/desktop/src/api.ts` |
| **P1** | 合并 60+ 个后端 `strategy_activity_*_helpers.py` 到 5-8 个模块 | 中 | `services/control-api/` |
| **P2** | 原报告 #7、#8 的 UI 错误态与 SSE 断连兜底 | 小 | `App.tsx` / `api.ts` |
| **P2** | 原报告 #12 ECharts 恢复 lazy | 小 | `App.tsx` |
| **P2** | 为 `repository.py` 并发与 `bybit_public_client.py` 缓存补并发测试 | 中 | `tests/` |
| **P3** | 原报告剩余 Low 条目（#17-#25） | 小 | 分散 |

---

## 五、总结

- 安全类 P0（Prometheus 注入、缓存竞态、读写副作用）已完成，结构性修复落地正确。
- 但"拆"的动作在**前后端同时**出现了共同的反模式：**核心大文件没瘦身，却多出几十个超细粒度微文件**。如果不做一次反方向的"合并清理"，后续任何增量都会继续扩张这些微文件。
- 存在 1 个 **P0 死代码 bug**（`main.py:1286-1297`），建议立刻清理。
- 建议把"文件粒度红线"写进 `docs/开发约定.md`：单文件 > 800 行必须拆；新建 < 40 行 helper 必须证明 ≥ 2 处 import。

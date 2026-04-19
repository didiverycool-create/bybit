# 代码审查报告

**分支**: `codex/bybit`
**审查日期**: 2026-04-07
**变更范围**: 23 个文件，+13,216 / -719 行

---

## Critical（严重）

### 1. Prometheus 指标注入漏洞

**文件**: `services/control-api/main.py` — `build_prometheus_metrics()`

用户可控的 `workspace_symbol`、`diagnostics.requested_symbol`、`diagnostics.effective_symbol`、`diagnostics.detail_source` 等字段通过 f-string 直接拼入 Prometheus label，未做任何转义。包含 `"`、`\n`、`}` 的 symbol 值可以注入任意指标行，污染监控数据。

```python
f'bybit_control_market_live_generation_ms{{requested_symbol="{diagnostics.requested_symbol}",...}}'
```

同样问题出现在 `watchlist_source_breakdown` 中对 `source` 值的直接插入。

**修复建议**: 对所有 label 值做 sanitize（移除 `"`、`\n`、`\`、`}` 等字符），或使用 `prometheus_client` 库生成指标。

---

### 2. App.tsx 主文件仍偏重，但已明显收敛（已部分覆盖）

**文件**: `apps/desktop/src/App.tsx`

最初审计时，`App.tsx` 还是一个超大体量的 God Component；但沿着当前主线持续拆分后，桌面端主文件已经明显压薄，最新主线约为 **782 行**，并且新增了 `AppWorkspaceShell`、`buildAppPresentationModels`、`useAppCompositionModel`、`useAppInteractionModels`、`useAppLifecycleEffects` 等分层，说明“所有逻辑都堆在单文件里”的情况已经不再成立。

当前剩余问题主要变成：

- `App.tsx` 虽然已经不再直接承载大块 JSX，但仍然是桌面端的顶层编排入口
- 组合层参数面仍然较宽，后续继续拆时仍可能出现“主文件变薄，但 builder / model 继续膨胀”的风险
- 主线已收敛到“容器 + hook + 展示组件 + 纯 builder”模式，但还没完全拆到最终稳态

具体影响：

- 顶层编排改动仍然容易触发较大范围的联动修改
- 如果继续只做“把长对象搬去别的文件”，复杂度可能只是转移位置，没有真正下降
- 新接手者仍需同时理解 bootstrap、query、interaction、composition、presentation 这几层关系

**后续建议**: 继续把 `App.tsx` 保持为编排入口，优先收窄剩余顶层组合层的参数面，避免再回到“新的 mega-builder / mega-hook”；展示层拆分已明显推进，这条问题当前应视为“已明显缓解，但未彻底完成”。

---

### 3. Electron `executeJavaScript` 注入 ~700 行字符串脚本

**文件**: `apps/desktop/src/main/main.ts`

Smoke test 通过 `win.webContents.executeJavaScript(...)` 注入了约 700 行通过字符串拼接构建的 JS 脚本到渲染进程。虽然限制在 `isDev` 模式下（受 `shouldRunMarketSwitchSmoke` / `shouldRunStrategyActivitySmoke` 环境变量守护），但：

- 这些字符串拼接的脚本无类型检查、难以调试
- 如果 `isDev` 判断被绕过（例如打包配置错误），会暴露安全风险
- 注入脚本直接操作 `localStorage`、`sessionStorage`、DOM 查询

**修复建议**: 将 smoke 脚本移到独立的 `.js` 文件中通过 preload 脚本加载，或使用 Playwright / Puppeteer 测试框架运行，而非嵌入主进程。

---

## High（高）

### 4. `snapshot()` 返回可变内部状态的直接引用且读操作带写副作用

**文件**: `services/control-api/repository.py:91-95`

```python
def snapshot(self) -> AppState:
    with self._lock:
        if self._sanitize_workspace_preferences_locked():
            self._persist()  # 读操作触发文件 I/O
        return self.state   # 返回同一个可变对象引用
```

两个问题：

1. **读操作带写副作用**: 每次 GET 请求获取状态快照时，如果 sanitize 发现过期引用，就会触发 `_persist()`（写 JSON 文件）。在高频轮询场景下，读操作可能意外变成写操作，导致不必要的磁盘 I/O。
2. **返回可变引用**: 释放锁后调用方仍可直接读写同一对象。`main.py` 中大量 `state = repo.snapshot()` 后续操作都在无锁状态下访问可变状态，其他线程可随时修改 `self.state` 的内部字段，导致竞态条件。

**修复建议**: 返回 deep copy 或不可变快照；将 sanitize 逻辑移到写入路径（`update_workspace_preferences`）。

---

### 5. 缓存字典线程安全问题

**文件**: `services/control-api/bybit_public_client.py`

新增的 `_ticker_cache`、`_orderbook_cache` 等字典在 `get_ticker_cached`、`get_orderbook_cached` 等方法中被多线程并发读写（主线程 + `ThreadPoolExecutor` history primer 线程 + SSE `asyncio.to_thread`），但没有任何锁保护。CPython 的 GIL 使 dict 单个操作大致原子，但组合操作（检查 + 写入）仍存在 TOCTOU 竞态。`_prime_watchlist_history_cache` 使用 `ThreadPoolExecutor` 并行写入 `_candle_cache`，更易触发。

**修复建议**: 对缓存操作加 `threading.Lock`，或使用线程安全的缓存结构。

---

### 6. `StrategyActivitySnapshot` 模型字段爆炸（已部分覆盖）

**文件**: `services/control-api/models.py`

新增约 **60+ 个 Optional 字段**（`latest_backtest`、`latest_actionable_backtest`、`latest_backtest_record`... 每种实体都有 `latest_*` 和 `latest_actionable_*` 变体加上 `_record` 后缀）。导致：

- API 响应体巨大，大量字段为 null
- 前后端数据契约脆弱，每次新增实体都要添加 6-8 个字段
- 序列化/反序列化开销显著，对 SSE 流带宽和前端解析性能都有压力

当前仓库已引入 `activity_sections`、`latest_ops`、`latest_runtime`、`decision_context` 等分层结构，前端也已通过 selector / hook 分层优先消费嵌套字段，再 fallback 到旧的 flat 字段。本轮又进一步把 proposal / change request / backtest / review / tracking / ops 的 sources 与 `recent_*` collections 收口到 `strategyActivitySelectors.ts` 的统一快照视图模型，并让 `Decision / Progress / Ops` 三个活动模型复用同一入口，说明这条问题已明显收敛；但为了兼容 fallback 数据和历史脏数据，前端仍保留了大量旧字段兜底，后端 schema 也依然偏宽，尚未彻底完成模型瘦身。

**后续建议**: 继续以前述嵌套结构作为主消费通道，逐步减少新的 flat 字段扩张；中长期再评估是否收敛旧 flat 字段，或拆成按需加载的子资源 API。

---

### 7. watchlist / market 接口切换为 strict 模式无错误提示

**文件**: `apps/desktop/src/api.ts`、`apps/desktop/src/App.tsx`

`getWatchlist`、`getMarketDetail`、`getMarketLiveSnapshot` 从 `fetchJson`（带 fallback）改为 `fetchJsonStrict`（直接抛异常）。但前端 `watchlistQuery` 未显式处理 `isError` 状态 —— 查询失败时 `watchlistQuery.data` 为 `undefined`，`watchlist` 变量降级为空数组 `[]`，导致整个自选列表区域静默为空白，用户无任何错误提示。

**修复建议**: 在 UI 层处理 `isError` 状态，展示错误信息和重试按钮。

---

### 8. SSE 断连无轮询兜底

**文件**: `apps/desktop/src/App.tsx`

`marketLiveQuery` 的 `refetchInterval` 从 `4000` 改为 `false`，完全依赖 SSE 流推送。若 SSE 断连（网络抖动、服务端重启），缺少周期性轮询兜底，市场数据将停留在最后一次推送的快照，不再自动恢复。

**修复建议**: 保留一个低频（如 30s）的 fallback 轮询，或实现 SSE 断连后自动切换到轮询模式。

---

## Medium（中等）

### 9. 缓存无容量上限（已修复）

**文件**: `services/control-api/bybit_public_client.py`

当前实现已经为 `_ticker_cache`、`_candle_cache`、`_orderbook_cache`、`_recent_trade_cache`、`_announcement_cache`、`_instrument_cache`、`_candle_history_cache` 增加 `max_entries` 上限，并在写入时主动 prune 旧条目，原审计结论已不再成立。

**当前状态**: 已通过容量上限与写入时裁剪完成修复，后续只需按业务规模继续校准各缓存桶的上限参数。

---

### 10. K 线缓存 TTL 从 20s 大幅增加到 180s（已修复）

**文件**: `services/control-api/bybit_public_client.py`

当前实现已经改为按周期分层的 TTL，而不是统一 180 秒；并且后续又进一步收紧为：

- 实时 K 线缓存：`15m/1h/4h/1d = 4/5/8/12s`
- 历史 K 线缓存：`15m/1h/4h/1d = 5/6/10/14s`

这说明原审计里“统一放大到 180 秒”的结论已经过时，风险明显低于最初判断。

**当前状态**: 已通过按周期细化并再次收紧 TTL 完成修复；当前最长实时 K 线缓存窗口已收紧到 `12s`，历史分页缓存最长也已收紧到 `14s`，不再保留跨多轮桌面刷新仍滞留的明显偏长窗口。

---

### 11. 前后端逻辑重复（已部分覆盖）

**文件**: `apps/desktop/src/App.tsx` 与 `services/control-api/repository.py` / `main.py`

以下函数在前后端几乎完全相同的实现：

| 前端消费层 | 后端快照/装饰层 |
|---|---|
| `auditImpactMeta()` | `_build_audit_event_impact_detail()` |
| `auditEventPriority()` | `_execution_event_priority()` |
| `pickLatestKeyAuditEvent()` | `_pick_latest_key_execution_event()` |
| `summarizeAuditEvent()` | `_build_audit_event_summary()` |

后端已经在 `repository.py` 的执行事件装饰链路里补充 `summary / impact_detail / priority / is_key_event`，前端 `app-helpers.ts` 也已经收敛为“优先读后端字段，缺失时再兜底”的统一消费层，因此这条问题不再是完全裸露的双重实现。

当前剩余问题主要是 fallback 数据和历史脏数据路径仍要求前端保留兜底逻辑，因此前后端之间仍有一部分重复维护成本。

**修复建议**: 后续如要继续收敛，优先补齐 fallback / 本地快照数据结构，再评估是否进一步减少前端兜底逻辑；本轮不建议为该条目额外引入前后端联动改造。

---

### 12. ECharts lazy 加载退化

**文件**: `apps/desktop/src/App.tsx`

移除了 `lazy(() => import('./components/LazyECharts'))` 和 `Suspense`，改为同步 `import ReactECharts from './components/LazyECharts'`。ECharts 是大型库（~800KB gzipped），这会增加初始 bundle 体积和首屏加载时间。

**修复建议**: 恢复 lazy 加载，或使用 `React.lazy` + `Suspense` 包装。

---

### 13. 冗余三元表达式

**文件**: `apps/desktop/src/App.tsx`

```typescript
refetchInterval: liveMarketEnabled ? 12000 : 12000
```

两个分支值相同，属无意义代码，疑似编辑遗留。

**修复建议**: 简化为 `refetchInterval: 12000` 或确认是否某个分支应为 `false`。

---

### 14. `RLock` 掩盖设计问题

**文件**: `services/control-api/repository.py`

从 `Lock` 切换到 `RLock` 通常意味着有嵌套锁调用。虽然 `RLock` 可以避免自死锁，但它也掩盖了调用路径不清晰的问题（同一线程多次获取锁）。

**修复建议**: 审查哪些路径导致了重入，考虑是否可以重构为单次锁获取。

---

### 15. `LazyECharts.tsx` 中 `lazyUpdate={false}` 可能导致频繁重绘

**文件**: `apps/desktop/src/components/LazyECharts.tsx`

`echarts-for-react` 的 `lazyUpdate` 设为 `false` 意味着每次 props 变更都立即重绘图表。在 4 秒级 SSE 推送 + 多币种场景下可能造成明显的性能开销。

---

### 16. `build_strategy_activity_payload` 仍存在多轮线性遍历（已部分缓解）

**文件**: `services/control-api/main.py`

该函数仍会对 `state.backtests`、`state.reviews`、`state.change_requests`、`state.agent_jobs`、`state.audit_events` 做多轮过滤、排序和筛选；不过当前已通过 `StrategyActivityLineageMaps` 预建 `proposal_*_map`、`*_summary_by_id` 等索引字典，把原先最明显的重复关联查找从线性扫描收敛到了字典命中，因此问题不再是完全裸露的 O(n*m) 形态。

最新几轮已继续收敛顶部聚合阶段：`build_strategy_activity_payload` 现在不再重复调用 `repo.snapshot()` 取 `trades`，并把 `reviews / proposals` 的两轮收集合并成了一次遍历；对已排序列表的“最新项”提取也改成了直接取首项，`tracking jobs / proposals / change requests` 的“最新项 + 可行动项”筛选也开始复用单次顺序扫描，减少了几轮无必要的再次遍历。本轮又进一步把 `agent_jobs -> tracking jobs` 的额外过滤收进 summary 构建过程，并把 `recent_backtest_records -> recent_actionable_backtest_records` 的中间列表改成直接顺序扫描首个可行动回测，继续削掉了两段额外的全量遍历。

当前剩余风险主要在于顶部聚合阶段仍有多轮全量遍历；如果后续数据规模继续增长，仍可能出现构建快照时延缓慢上升的问题。

**修复建议**: 保留现有索引层，后续如出现真实性能压力，再基于 profile 评估是否将前置索引继续上移、或把部分子资源改为按需构建。

---

## Low（低）

### 17. `pageUnloading` 标志不可逆

**文件**: `apps/desktop/src/api.ts`

模块级 `let pageUnloading = false` 在 `beforeunload` / `pagehide` 事件触发时设为 `true`。在 Electron 中 `beforeunload` 可被取消（用户选择"留在页面"），此时 `pageUnloading` 不会被重置，导致后续所有网络错误被永久抑制。

**修复建议**: 在 `beforeunload` 的 cancel 场景中重置标志，或改用更精确的检测方式。

---

### 18. smoke 脚本硬编码 API 地址

**文件**: `apps/desktop/src/main/main.ts`

注入脚本中 `apiBase` 硬编码为 `http://127.0.0.1:8787`，与 `api.ts` 中通过 `VITE_CONTROL_API_BASE` 环境变量配置的方式不一致。

**修复建议**: 通过环境变量统一 API 地址配置。

---

### 19. README 中英混杂

**文件**: `README.md`

出现 "盯盘 still 停在旧 symbol"，应改为 "盯盘仍停在旧 symbol"。属编辑遗漏。

---

### 20. `workspaces` 字段与 pnpm 不一致

**文件**: `package.json`

`"workspaces"` 字段是 npm/yarn 语法，但所有 scripts 已从 `npm --workspace` 迁移到 `pnpm --dir`。pnpm 使用 `pnpm-workspace.yaml` 声明工作区，当前 `workspaces` 字段对 pnpm 无实际作用，容易误导。

**修复建议**: 确认 `pnpm-workspace.yaml` 是否存在；如存在则移除 `package.json` 中的 `workspaces` 字段。

---

### 21. 重复的 `parse_created_at` 定义

**文件**: `services/control-api/main.py` 与 `services/control-api/repository.py`

同一个日期解析辅助函数分别定义了两次，且默认值不同（一个用 `datetime.fromtimestamp(0, ...)`，另一个用 `datetime.min.replace(...)`）。

**修复建议**: 提取为共用工具函数并统一默认行为。

---

### 22. `build_runtime_market_fallback_detail` 中 `source` 字段误导

**文件**: `services/control-api/main.py`

当 `real_base` 为 None 时，`source` 被设为 `"mock"`，但实际上这是一个 fallback 而非 mock。可能误导监控。

**修复建议**: 使用 `"fallback"` 或 `"unavailable"` 作为 source 值。

---

### 23. `did-finish-load` 回调中 early return 阻断后续扩展（已修复）

**文件**: `apps/desktop/src/main/main.ts`

```typescript
win.webContents.on("did-finish-load", async () => {
  if (!shouldRunMarketSwitchSmoke && !shouldRunStrategyActivitySmoke) {
    return; // 正常开发模式下直接 return
  }
  // ...smoke 逻辑
});
```

当前实现已改成“仅在需要时执行 smoke 分支”，不再通过 normal path 上的 early return 直接退出整个 `did-finish-load` 回调；后续若继续在同一回调里追加正常初始化逻辑，不会再被 smoke guard 提前截断。

---

### 24. docs/ 与 README 内容重复（已修复）

**文件**: `README.md` 与 `docs/实施路线与接手清单.md`

工作台状态恢复逻辑（`selected_change_request_id` 对齐策略、自动清理旧定位等）在两处都有描述，措辞略有不同，后续维护容易分叉。

当前 README 已收敛为“仓库入口 + 高层概览 + 常用命令”，详细功能清单、实施进度与验证口径统一回收到 `docs/实施路线与接手清单.md`，避免两处继续并行维护同一批细节描述。

---

### 25. `enrich_market_detail` 中 `allow_rest_refresh=False` 分支数据不完整

**文件**: `services/control-api/bybit_public_client.py`

当走本地快照分支时，stats 只包含 orderbook 和振幅信息，缺少 `fundingRate`、`openInterestValue` 等字段，导致 watchlist 详情页面数据不完整。

---

## 优先修复建议

| 优先级 | 问题 | 工作量 | 编号 |
|--------|------|--------|------|
| **P0** | Prometheus 指标注入 | 小 | #1 |
| **P0** | `snapshot()` 读写分离 + 返回不可变快照 | 中 | #4 |
| **P0** | 缓存线程安全 | 小 | #5 |
| **P1** | App.tsx 拆分 | 大 | #2 |
| **P1** | StrategyActivitySnapshot 模型继续收敛（已明显收敛，但仍未完成） | 中 | #6 |
| **P1** | watchlist strict 模式错误处理 | 小 | #7 |
| **P1** | SSE 断连兜底 | 小 | #8 |
| **P2** | 前后端逻辑继续收敛（已部分覆盖） | 中 | #11 |
| **P2** | ECharts lazy 加载恢复 | 小 | #12 |
| **P2** | 策略活动查询性能持续收敛（已部分缓解） | 中 | #16 |
| **P3** | 其余 Low 级别问题 | 小 | #17-#25 |

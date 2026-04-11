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

### 2. App.tsx 单文件 16,763 行 — 不可维护的 God Component

**文件**: `apps/desktop/src/App.tsx`

所有业务逻辑（~60+ `useState`、~20 `useEffect`、~15 `useQuery`）集中在一个函数组件内。任何一个状态变更都会触发整棵 16,000+ 行 JSX 树的重新渲染。`useDeferredValue` 已被移除（改为直接使用 `selectedSymbol`），进一步降低了切换时的响应性优化。

具体影响：

- 每次修改都面临巨大的合并冲突风险
- React 热更新变慢
- 无法有效地做 code splitting 和 tree shaking
- 新开发者无法快速理解代码结构

**修复建议**: 将 ~40 个纯函数（`summarizeAuditEvent`、`auditImpactMeta`、`proposalStatusLabel` 等）抽出为独立模块；将各 section 面板（策略活动、行情、回测等）拆分为独立组件。

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

### 6. `StrategyActivitySnapshot` 模型字段爆炸

**文件**: `services/control-api/models.py`

新增约 **60+ 个 Optional 字段**（`latest_backtest`、`latest_actionable_backtest`、`latest_backtest_record`... 每种实体都有 `latest_*` 和 `latest_actionable_*` 变体加上 `_record` 后缀）。导致：

- API 响应体巨大，大量字段为 null
- 前后端数据契约脆弱，每次新增实体都要添加 6-8 个字段
- 序列化/反序列化开销显著，对 SSE 流带宽和前端解析性能都有压力

**修复建议**: 使用嵌套结构（如 `latest: { backtest: {...}, proposal: {...} }` 和 `latest_actionable: {...}`），或改为按需加载子资源的 API 设计。

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

### 9. 缓存无容量上限

**文件**: `services/control-api/bybit_public_client.py`

所有缓存字典（`_ticker_cache`、`_candle_cache`、`_orderbook_cache` 等）只有 TTL 过期策略，没有容量限制。如果 watchlist 持续变化，缓存会无限增长。

**修复建议**: 添加 `maxsize` 限制或使用 `functools.lru_cache` / 定期清理过期条目。

---

### 10. K 线缓存 TTL 从 20s 大幅增加到 180s

**文件**: `services/control-api/bybit_public_client.py`

`_candle_cache_ttl` 和 `_candle_history_cache_ttl` 均从 20 秒改为 180 秒（3 分钟）。对于交易系统，3 分钟的陈旧 K 线数据可能导致决策延迟。

**修复建议**: 确认是否为预期行为；如果是为了减少 API 调用频率，考虑结合 WebSocket 实时推送来保持数据新鲜度。

---

### 11. 前后端逻辑重复

**文件**: `apps/desktop/src/App.tsx` 与 `services/control-api/repository.py` / `main.py`

以下函数在前后端几乎完全相同的实现：

| 前端 (App.tsx) | 后端 (repository.py / main.py) |
|---|---|
| `auditImpactMeta()` | `_build_audit_event_impact_detail()` |
| `auditEventPriority()` | `_execution_event_priority()` |
| `pickLatestKeyAuditEvent()` | `_pick_latest_key_execution_event()` |
| `summarizeAuditEvent()` | `_build_audit_event_summary()` |

双重维护容易导致逻辑分叉。

**修复建议**: 让后端返回计算好的 `impact_detail`、`priority`、`summary`，前端直接使用。

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

### 16. `build_strategy_activity_payload` 线性遍历的 O(n*m) 复杂度

**文件**: `services/control-api/main.py`

该函数对 `state.backtests`、`state.reviews`、`state.change_requests`、`state.agent_jobs`、`state.audit_events` 做全量遍历和排序，然后又在内嵌的 `get_linked_*_for_proposal` 等函数中对 `recent_backtests`、`recent_reviews`、`recent_agent_jobs` 做重复 `next(... for ... in ...)` 线性查找。策略和数据量增长后，性能会显著退化。

**修复建议**: 预先构建 `{id: record}` 的索引字典，O(1) 查找替代线性扫描。

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

### 23. `did-finish-load` 回调中 early return 阻断后续扩展

**文件**: `apps/desktop/src/main/main.ts`

```typescript
win.webContents.on("did-finish-load", async () => {
  if (!shouldRunMarketSwitchSmoke && !shouldRunStrategyActivitySmoke) {
    return; // 正常开发模式下直接 return
  }
  // ...smoke 逻辑
});
```

如果后续需要在 `did-finish-load` 添加正常功能逻辑（如窗口 ready 后的初始化），此 early return 会阻断它们。

---

### 24. docs/ 与 README 内容重复

**文件**: `README.md` 与 `docs/实施路线与接手清单.md`

工作台状态恢复逻辑（`selected_change_request_id` 对齐策略、自动清理旧定位等）在两处都有描述，措辞略有不同，后续维护容易分叉。

**修复建议**: 以 `docs/` 为唯一信源，README 只做引用链接。

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
| **P1** | StrategyActivitySnapshot 模型重构 | 中 | #6 |
| **P1** | watchlist strict 模式错误处理 | 小 | #7 |
| **P1** | SSE 断连兜底 | 小 | #8 |
| **P2** | 前后端逻辑去重 | 中 | #11 |
| **P2** | ECharts lazy 加载恢复 | 小 | #12 |
| **P2** | 缓存容量上限 | 小 | #9 |
| **P2** | 策略活动查询性能优化 | 中 | #16 |
| **P3** | 其余 Low 级别问题 | 小 | #17-#25 |

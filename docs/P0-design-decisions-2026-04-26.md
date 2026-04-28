# P0 设计开放问题 — 决策记录

**生成日期**: 2026-04-26
**适用范围**: P0-4.2 统一执行引擎 + P0-5.1 持久化层
**前置阅读**: `docs/P0-4.2-execution-engine-design.md` §J 开放问题、`docs/P0-5.1-persistence-design.md` §G 开放问题
**作者**: Claude Opus 4.7（在用户授权 "你看着办" 下做架构决策）

本文件记录 wave-2/wave-3 实施前必须回答的所有开放问题，以及对应的拍板。每条决策都给出**理由**与**何时复议**。

---

## P0-4.2 执行引擎 — 决策

### J.1 ExecutionIntent 落盘时机

**问题**：intent + intent_seq 落盘点放在 `compute_decision` 之前还是 `execute` 之前？

**决策**：**`PROPOSED → PREVIEWED` 转移上落盘**。即 `compute_decision()` 调用前先 `INSERT INTO execution_events (state_to='PROPOSED')`，然后才进入风控判定。

**理由**：
1. Risk-blocked 的 intent 也要可审计（用户 "为什么这单被拒了" 的排障需求）。
2. SQLite 单条 INSERT 在 WAL 模式 < 1ms，不构成瓶颈。
3. 客户端重试时直接通过 `(strategy_id, intent_seq)` 在 SQLite 中查到已有 intent，避免重新计算 risk。

**何时复议**：如果 wave-2 实测发现 SQLite 写入压力 > 100 events/s 且影响策略循环 50ms 周期，再考虑批量落盘或 in-memory 缓存。

---

### J.2 Bybit `orderLinkId` 重提交行为

**问题**：Bybit 对同一 `orderLinkId` 是否允许第二次 `create_order`？

**决策**：**先按 "Bybit 接受复用" 假设设计；wave-3 启动前必须在 Demo 环境实测确认**。

**理由**：
1. Bybit 官方文档说返回 `10001 duplicated linkId` 错误，但错误码不等同于 "复用失败"——可能是 idempotent return 而非 reject。
2. 如果实测发现 Bybit 真的拒绝复用，幂等键退化为 `(strategy_id, intent_seq)` + 服务端去重表，方案 P0-4.2 §D.3 已经预留了这个分支。
3. 不阻塞 wave-2/3 设计推进。

**何时复议**：wave-3 启动第一周内必须做一次 Demo 环境实测：
- 用同一 `orderLinkId` 连续提交两次 `create_order`，记录返回。
- 如果第二次返回原 order 的 `orderId`（idempotent return）→ 设计成立，无需修改。
- 如果第二次返回 `10001` 且不带 `orderId` → 实施服务端去重，记录在新版 design doc。

---

### J.3 手动交易的伪 strategy_id

**问题**：`manual:{operator_id}` 如何在桌面端 UI 表达？是否单独分组？

**决策**：**不单独分组**。手动 intent 在策略活动页按 `manual:{operator_id}` 字符串显示在策略 dropdown 里，与真实策略并列。

**理由**：
1. UI 复杂度低于价值——单独分组需要新增 tab、新增 filter，但用户使用频率不高。
2. 手动交易在桌面端有专门的 `/api/trades/manual` 入口和独立面板，不依赖 "策略活动" 页查看。
3. `StrategyActivitySnapshot` 过滤规则保持不变；伪 strategy_id 只在审计层用。

**何时复议**：如果用户日均手动交易 > 10 笔，再考虑单独分组。

---

### J.4 `ExecutionIntentSource` 的 `recovery` 扩展

**问题**：`Literal["manual","auto"]` → `Literal["manual","auto","recovery"]` 的影响范围？

**决策**：**实施时全仓 grep `intent.source` 与 `ExecutionIntentSource`，逐个更新**。

**理由**：实施细节，没有架构决策需要做。Wave-3 实施 agent 必须 grep 后再改。

**何时复议**：N/A（实施层）。

---

### J.5 External modification 的 ack 权限

**问题**：哪类用户能 ack `EXTERNALLY_MODIFIED` 状态？

**决策**：**只允许人工 (desktop_operator)，禁止 OpenClaw / 自动化 ack**。

**理由**：
1. 外部干预保护机制本质是 "用户在 Bybit Web UI 改了单，系统暂停自动循环避免对抗用户"。如果 OpenClaw 能自动 ack，这个保护就形同虚设。
2. 桌面端在 `/api/strategies/{id}/acknowledge-drift` 暴露独立按钮，operator 必须显式确认。
3. Audit 事件 `strategy.position_drift.acknowledged` 的 `requested_by` 字段必须是 `desktop_operator` 或 `manual:{user}`，不允许 `openclaw_worker` / `system`。

**何时复议**：如果实际运行中外部干预频率极低（< 1 次/月），不复议——保护机制保留即可。如果高频（> 1 次/周），考虑加白名单功能（特定 strategy_id 允许 auto-ack）。

---

### J.6 Demo vs Live instruments-info 差异

**问题**：Demo 与 Live 的 instrument 元数据 (qtyStep / tickSize) 是否相同？

**决策**：**灰度切 Live 的步骤里强制重拉 instruments-info**。即 wave-3 step F.4（Live 切引擎）的 checklist 第一条是 `BybitInstrumentsCache.invalidate_all()` + 重新加载。

**理由**：
1. Bybit Demo 偶发与 Live 元数据不同步（已知现象，社区报告过）。
2. Cache miss 一次的代价是几个 RPC，远小于 "用 Demo 元数据下 Live 单导致 reject" 的代价。

**何时复议**：N/A（操作层）。

---

## P0-5.1 持久化层 — 决策

### G.1 `state.json` 真实大小峰值

**问题**：生产 6 个月后 `audit_events` 是否会膨胀到性能瓶颈？

**决策**：**Wave-2 实施第一周做一次回放压测**：
- 用 1M 行 `audit_events` 模拟数据填充 SQLite。
- 跑桌面端审计页常用查询（按 strategy_id 倒序拉 50 条 / 按 severity 过滤）。
- 验收标准：P95 查询延迟 < 100ms。

如果不达标，引入 G.5 的归档策略（提前到 wave-2 而非 wave-4）。

**理由**：早测便宜——压测 fixture 几小时搞定，比生产出问题再补便宜 100 倍。

---

### G.2 `result_blob` 是否拆 `backtest_run_trades` 子表

**问题**：BacktestRun 的 trades 明细是单 TEXT blob 还是子表？

**决策**：**初期单 blob；wave-2 P0-4.4 回测引擎收口时再决定**。

**理由**：
1. 当前 UI 没有按 trade 维度过滤/排序的需求，单 blob 满足读写。
2. P0-4.4 实施时如果需要逐 trade 查询（例如 "找出所有成交价偏离 reference > 0.5% 的 trade"），届时拆表，迁移逻辑简单（一次 INSERT INTO ... SELECT 就行）。

**何时复议**：P0-4.4 实施时由实施者评估。

---

### G.3 `feature_flags` 配置位置

**问题**：P0-4.2 引擎用 feature flag 灰度，flag 存哪？

**决策**：**存 `config_snapshots(snapshot_kind='feature_flags')`，提供 `dao_feature_flags.get_current()` helper**。

**理由**：
1. Feature flag 是配置不是事件，归 `config_snapshots` 表语义正确。
2. `get_current()` helper 用 `SELECT payload_json FROM config_snapshots WHERE snapshot_kind='feature_flags' ORDER BY created_at DESC LIMIT 1`，性能足够。
3. Settings page 改 flag 时新增一行（不更新已有行）→ 自然有审计 trail。

**何时复议**：N/A。

---

### G.4 多设备同步

**问题**：跨多台机器（家 + 公司）的同步？

**决策**：**P0/P1 不处理。所有 PK 已用 ULID/UUID，schema 已经为未来同步层预留**。

**理由**：
1. 当前用户场景是单机部署。
2. 同步层（Litestream / iCloud Drive）是独立的运维工程，不属于核心交易系统。
3. Schema 不依赖自增 INTEGER 已经预防了未来同步冲突（除了 `parameter_versions.id` 和 `change_request_history.history_id` 用了 AUTOINCREMENT，未来同步时需要改成 ULID 或加 device_id 维度）。

**何时复议**：用户购买第二台 Mac 或要求 "公司机器看到家里的数据" 时再设计。

---

### G.5 审计事件归档

**问题**：`audit_events` > 90 天后归档到哪？

**决策**：**主库保留近 90 天 + 归档到 `audit_events_archive_{year}.sqlite3` 独立文件**。

**理由**：
1. 90 天对应桌面端审计页常用回看窗口（用户 "上周这单为什么被拒了"）。
2. 归档独立文件后，主库 vacuum 友好；用户备份只需备主库 14 天 / 月初。
3. 历史归档查询不在常用路径，桌面端审计页可以提供 "查看更早" 按钮，按需加载归档库。
4. 归档过程不删 `audit_events` 表的 `BEFORE DELETE` trigger 限制——用 `INSERT INTO archive ... SELECT ... ; DELETE FROM audit_events WHERE id IN (...)` 触发 trigger。所以归档要独立 trigger 或临时关闭外键，详细方案在归档实施时定。

**何时复议**：G.1 压测如果 P95 不达标，提前到 wave-2 实施。否则 wave-4 落地。

---

### G.6 `AppState.market_details` 是否进 SQLite

**问题**：watchlist 的 `MarketDetail`（K 线 + 盘口）是事实源还是缓存？

**决策**：**不进 SQLite，保留 in-memory dict 兜底**。

**理由**：
1. 这是缓存层，事实源在 Bybit。落 SQLite 只是延长 cold start 体感，不增加可用性。
2. Cold start 后桌面端短暂（< 5s）等待 K 线刷新是可接受的 UX。
3. 减少 SQLite 写入压力（K 线 5 秒一次更新，60s 写入次数 ≈ 12 次 × N watchlist symbol，是噪音）。

**何时复议**：用户抱怨 cold start 体验时再考虑。

---

### G.7 双写期跨存储 transaction

**问题**：`state.json` 写成功 + SQLite 写失败 / 反之，状态不一致怎么办？

**决策**：**SQLite 永远是真理。`state.json` 写失败仅 warning 级日志，不阻塞 API**。同时设计期内：
1. Step 2 双写期：SQLite 失败 → API 返回 500（标记 SQLite 不健康），`state.json` 写不写都无意义因为 SQLite 才是 wave-3 之后的 source of truth。
2. Step 3 切读后：`state.json` 完全降级为 "迁移期审计文件"，写失败一律 warning 不报错。

**理由**：
1. 真正的双写一致性需要分布式事务（XA 协议），代价远超收益。
2. SQLite 自身 ACID 保证强；state.json 是过渡产物，把它当 "尽量写一份" 即可。
3. Wave-3 step F.4 完成后 state.json 完全废弃，这个张力自然消失。

**何时复议**：N/A（设计已经接受张力）。

---

## TBD 需要在 wave-2/3 实测的事项

汇总所有 "TBD: needs prototyping"，每条标注实施 wave 与负责人：

| TBD | Wave | 责任人 |
|---|---|---|
| Bybit `orderLinkId` 重复提交行为 | wave-3 启动第一周 | 引擎实施 agent + 我 review |
| Bybit `GET /v5/order/history` vs `realtime` 延迟 | wave-3 实施期 | 同上 |
| `audit_events` 1M 行查询延迟 | wave-2 实施第一周 | 持久化实施 agent |
| `down.sql` 是否提供 | wave-2 schema 落地时 | 同上 |
| ExecutionIntent SQLite 写入压力 | wave-3 实施期 | 引擎实施 agent |

---

## Wave 启动门禁清单

实施前 checklist：

### Wave-2 启动前必须完成
- [x] P0-4.2 设计稿 done (25f0075)
- [x] P0-5.1 设计稿 done (25f0075)
- [x] 本决策文档 done
- [ ] Wave-1 所有 commit 在 codex/bybit 上完整集成（A1 + A2 + A3 + A4 + A5）
- [ ] R74 pre-existing failure 已查清（要么修复，要么 xfail 原因明确）
- [ ] 全测试 ≥ 753/754 passing

### Wave-3 启动前必须额外完成
- [ ] Wave-2 P0-4.3 + P0-4.4 已合并并稳定 7 天
- [ ] Bybit Demo `orderLinkId` 实测完成（J.2）
- [ ] SQLite 1M 行压测完成（G.1）
- [ ] User review + 同意启动 wave-3（涉及真钱执行路径）

---

（决策记录结束。本文件是 wave-2/3 实施的契约。任何与本文件冲突的实施都需要先更新本文件并解释原因。）

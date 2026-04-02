from __future__ import annotations

from datetime import datetime, timedelta, timezone
from random import Random

from models import (
    AccountMode,
    AgentJob,
    AlertRecord,
    AlertRule,
    AppState,
    BacktestMetrics,
    BacktestRun,
    CandlePoint,
    ChangeRequest,
    ChangeRequestStatus,
    ControlSnapshot,
    EventSeverity,
    ExecutionHealthSummary,
    ExecutionEvent,
    JobStatus,
    MarketDetail,
    MarketRecentTrade,
    MetricCard,
    NewsEvent,
    OrderBookLevel,
    PriorityLevel,
    ReviewDocument,
    SchedulerState,
    SettingsPayload,
    StrategyParameter,
    StrategyProposal,
    StrategySummary,
    TaskSummary,
    TradeRecord,
    WatchlistInstrument,
    WorkspacePreferences,
)


TZ = timezone(timedelta(hours=8))
BASE_NOW = datetime.now(TZ).replace(minute=0, second=0, microsecond=0)
RNG = Random(7)


def iso(dt: datetime) -> str:
    return dt.isoformat()


def generate_candles(symbol: str, base_price: float) -> list[CandlePoint]:
    candles: list[CandlePoint] = []
    price = base_price
    for step in range(48):
        dt = BASE_NOW - timedelta(hours=47 - step)
        change = RNG.uniform(-0.018, 0.022) * base_price * 0.14
        open_price = price
        close_price = max(1, open_price + change)
        high = max(open_price, close_price) + RNG.uniform(0.002, 0.011) * base_price
        low = min(open_price, close_price) - RNG.uniform(0.002, 0.011) * base_price
        volume = abs(change) * 28 + RNG.uniform(800, 4200)
        candles.append(
            CandlePoint(
                time=iso(dt),
                open=round(open_price, 2),
                high=round(high, 2),
                low=round(low, 2),
                close=round(close_price, 2),
                volume=round(volume, 2),
            )
        )
        price = close_price
    return candles


def generate_orderbook(base_price: float, side: str) -> list[OrderBookLevel]:
    entries: list[OrderBookLevel] = []
    cumulative = 0.0
    for index in range(8):
        distance = 0.2 * (index + 1)
        price = base_price - distance if side == "bid" else base_price + distance
        size = round(RNG.uniform(5, 45), 2)
        cumulative += size
        entries.append(OrderBookLevel(price=round(price, 2), size=size, total=round(cumulative, 2)))
    return entries


def generate_recent_public_trades(base_price: float) -> list[MarketRecentTrade]:
    entries: list[MarketRecentTrade] = []
    for index in range(10):
        dt = BASE_NOW - timedelta(minutes=index * 2)
        side = "buy" if index % 3 != 1 else "sell"
        drift = RNG.uniform(0.0008, 0.0042) * base_price
        price = base_price + drift if side == "buy" else base_price - drift
        size = round(RNG.uniform(0.2, 6.8), 4)
        entries.append(
            MarketRecentTrade(
                side=side,
                price=round(price, 2),
                size=size,
                value=round(price * size, 2),
                occurred_at=iso(dt),
                is_block_trade=size >= 5,
            )
        )
    return entries


def build_market_detail_for_watchlist(item: WatchlistInstrument) -> MarketDetail:
    return MarketDetail(
        symbol=item.symbol,
        market=item.market,
        timeframe="1h",
        candles=generate_candles(item.symbol, item.last_price),
        bids=generate_orderbook(item.last_price, "bid"),
        asks=generate_orderbook(item.last_price, "ask"),
        recent_public_trades=generate_recent_public_trades(item.last_price),
        headline=f"{item.symbol} 当前处于 {'策略跟踪' if item.signal != 'neutral' else '观察'} 状态",
        stats={
            "24h振幅": f"{abs(item.change_24h) * 1.82:.2f}%",
            "资金费率": f"{RNG.uniform(0.002, 0.029):.3f}%",
            "持仓偏向": "多头占优" if item.position_side != "flat" else "中性",
            "风险热度": {"low": "低", "medium": "中", "high": "高"}[item.risk_level],
        },
        source="mock",
        updated_at=iso(BASE_NOW - timedelta(minutes=5)),
    )


def build_state() -> AppState:
    watchlist = [
        WatchlistInstrument(
            symbol="BTCUSDT",
            market="perp",
            last_price=86125.4,
            change_24h=3.82,
            volume_24h=1389000000,
            signal="active",
            position_side="long",
            risk_level="medium",
            alert_enabled=True,
            alert_threshold_pct=2.8,
        ),
        WatchlistInstrument(
            symbol="ETHUSDT",
            market="perp",
            last_price=4832.6,
            change_24h=2.17,
            volume_24h=912000000,
            signal="watch",
            position_side="flat",
            risk_level="medium",
            alert_enabled=True,
            alert_threshold_pct=2.0,
        ),
        WatchlistInstrument(
            symbol="SOLUSDT",
            market="spot",
            last_price=239.4,
            change_24h=5.73,
            volume_24h=286000000,
            signal="watch",
            position_side="long",
            risk_level="high",
            alert_enabled=True,
            alert_threshold_pct=4.5,
        ),
        WatchlistInstrument(
            symbol="BNBUSDT",
            market="spot",
            last_price=922.8,
            change_24h=-1.15,
            volume_24h=188000000,
            signal="neutral",
            position_side="flat",
            risk_level="low",
            alert_enabled=False,
            alert_threshold_pct=3.5,
        ),
    ]

    market_details = {item.symbol: build_market_detail_for_watchlist(item) for item in watchlist}

    strategies = [
        StrategySummary(
            id="trend-btc-01",
            name="BTC 趋势跟随",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode=AccountMode.LIVE,
            version="v1.8.4",
            pnl_7d="+12.6%",
            max_drawdown="-3.4%",
            risk_budget="18%",
            description="使用 4h 趋势过滤 + 1h 进场确认，主要负责主账户 BTC 合约敞口。",
            parameters=[
                StrategyParameter(key="fast_ma", label="快线周期", value=21),
                StrategyParameter(key="slow_ma", label="慢线周期", value=55),
                StrategyParameter(key="risk_per_trade", label="单笔风险", value=1.2, unit="%"),
                StrategyParameter(key="take_profit_rr", label="止盈盈亏比", value=2.6),
            ],
        ),
        StrategySummary(
            id="eth-revert-02",
            name="ETH 均值回归",
            category="template",
            status="paper_only",
            symbols=["ETHUSDT"],
            mode=AccountMode.PAPER,
            version="v0.9.3",
            pnl_7d="+4.1%",
            max_drawdown="-1.8%",
            risk_budget="10%",
            description="用于震荡行情的短持仓策略，目前只在模拟盘运行。",
            parameters=[
                StrategyParameter(key="zscore_entry", label="入场 Z 值", value=2.1),
                StrategyParameter(key="zscore_exit", label="离场 Z 值", value=0.4),
                StrategyParameter(key="stop_loss_pct", label="止损", value=1.2, unit="%"),
                StrategyParameter(key="cooldown_minutes", label="冷却", value=35, unit="分钟"),
            ],
        ),
        StrategySummary(
            id="sol-breakout-03",
            name="SOL 突破增强",
            category="python",
            status="shadow",
            symbols=["SOLUSDT"],
            mode=AccountMode.DEMO,
            version="v2.0.1",
            pnl_7d="+7.8%",
            max_drawdown="-4.9%",
            risk_budget="8%",
            description="Python 策略，带成交量确认与盘口过滤，目前在 Demo 影子模式。",
            parameters=[
                StrategyParameter(key="breakout_window", label="突破窗口", value=18),
                StrategyParameter(key="volume_ratio", label="量能阈值", value=1.45),
                StrategyParameter(key="slippage_cap", label="滑点上限", value=0.35, unit="%"),
                StrategyParameter(key="max_hold_hours", label="最长持有", value=6, unit="小时"),
            ],
        ),
    ]

    scheduler = SchedulerState(
        status="running",
        freeze_publish=False,
        current_job_id="job-oc-001",
        queue_depth=3,
        last_heartbeat_at=iso(BASE_NOW - timedelta(minutes=6)),
        openclaw_connected=True,
        current_mode=AccountMode.PAPER,
    )

    control_snapshot = ControlSnapshot(
        account_metrics=[
            MetricCard(label="总权益", value="1,286,400 USDT", delta="+2.38%", tone="positive"),
            MetricCard(label="可用保证金", value="482,000 USDT", delta="-3.2%", tone="warning"),
            MetricCard(label="当前敞口", value="39.6%", delta="+4.1%", tone="neutral"),
        ],
        risk_metrics=[
            MetricCard(label="今日回撤", value="-1.24%", tone="warning"),
            MetricCard(label="最大杠杆占用", value="3.4x", tone="neutral"),
            MetricCard(label="风控拦截", value="2 次", delta="近 24h", tone="critical"),
        ],
        strategy_metrics=[
            MetricCard(label="运行中策略", value="2", tone="positive"),
            MetricCard(label="模拟盘策略", value="1", tone="neutral"),
            MetricCard(label="待发布提案", value="3", tone="warning"),
        ],
        scheduler=scheduler,
        alerts_summary={"P0": 1, "P1": 3, "P2": 6},
        pending_tasks=[
            TaskSummary(
                id="task-1",
                title="ETH 均值回归参数回放",
                type="backtest",
                status=JobStatus.RUNNING,
                owner="openclaw/codex",
                updated_at=iso(BASE_NOW - timedelta(minutes=3)),
            ),
            TaskSummary(
                id="task-2",
                title="SOL 突破策略进入人工接管",
                type="scheduler",
                status=JobStatus.WAITING,
                owner="desktop_operator",
                updated_at=iso(BASE_NOW - timedelta(minutes=18)),
            ),
            TaskSummary(
                id="task-3",
                title="Bybit 公告事件归因补录",
                type="news-review",
                status=JobStatus.QUEUED,
                owner="openclaw/codex",
                updated_at=iso(BASE_NOW - timedelta(minutes=27)),
            ),
        ],
        today_performance={
            "realized_pnl": "+28,460 USDT",
            "unrealized_pnl": "+6,380 USDT",
            "win_rate": "63.8%",
            "best_strategy": "BTC 趋势跟随",
        },
        execution_health=ExecutionHealthSummary(),
    )

    change_requests = [
        ChangeRequest(
            id="cr-001",
            type="strategy.parameter.update",
            payload={"strategy_id": "eth-revert-02", "stop_loss_pct": 1.2},
            requested_by="desktop_operator",
            target_mode=AccountMode.PAPER,
            priority=PriorityLevel.HIGH,
            status=ChangeRequestStatus.RUNNING,
            correlation_id="corr-eth-stoploss",
            created_at=iso(BASE_NOW - timedelta(minutes=35)),
            updated_at=iso(BASE_NOW - timedelta(minutes=5)),
            summary="调整 ETH 均值回归止损到 1.2%",
        ),
        ChangeRequest(
            id="cr-002",
            type="scheduler.manual_override",
            payload={"strategy_id": "sol-breakout-03"},
            requested_by="desktop_operator",
            target_mode=AccountMode.DEMO,
            priority=PriorityLevel.CRITICAL,
            status=ChangeRequestStatus.APPLIED,
            correlation_id="corr-manual-override",
            created_at=iso(BASE_NOW - timedelta(hours=2)),
            updated_at=iso(BASE_NOW - timedelta(hours=2, minutes=2)),
            summary="SOL 策略进入人工接管",
        ),
        ChangeRequest(
            id="cr-003",
            type="backtest.launch",
            payload={"strategy_id": "trend-btc-01", "range": "90d"},
            requested_by="desktop_operator",
            target_mode=AccountMode.PAPER,
            priority=PriorityLevel.NORMAL,
            status=ChangeRequestStatus.QUEUED,
            correlation_id="corr-bt-90d",
            created_at=iso(BASE_NOW - timedelta(minutes=12)),
            updated_at=iso(BASE_NOW - timedelta(minutes=12)),
            summary="发起 BTC 趋势跟随 90 天回测",
        ),
    ]

    agent_jobs = [
        AgentJob(
            id="job-oc-001",
            job_type="generate_daily_review",
            context={"focus_symbols": ["BTCUSDT", "ETHUSDT"], "mode": "paper"},
            allowed_actions=["review", "summarize", "backtest_request"],
            timeout=180,
            idempotency_key="job-oc-daily-review-20260330",
            writeback_target="ai_review",
            status=JobStatus.RUNNING,
            created_at=iso(BASE_NOW - timedelta(minutes=15)),
            updated_at=iso(BASE_NOW - timedelta(minutes=1)),
            result_summary=None,
        ),
        AgentJob(
            id="job-oc-002",
            job_type="reconcile_change_request",
            context={"change_request_id": "cr-001"},
            allowed_actions=["parameter_update", "audit_log"],
            timeout=120,
            idempotency_key="job-oc-cr-001",
            writeback_target="change_request",
            status=JobStatus.WAITING,
            created_at=iso(BASE_NOW - timedelta(minutes=11)),
            updated_at=iso(BASE_NOW - timedelta(minutes=11)),
            result_summary=None,
        ),
    ]

    backtests = [
        BacktestRun(
            id="bt-001",
            strategy_id="trend-btc-01",
            strategy_name="BTC 趋势跟随",
            status="completed",
            started_at=iso(BASE_NOW - timedelta(hours=7)),
            finished_at=iso(BASE_NOW - timedelta(hours=6, minutes=44)),
            symbol_scope=["BTCUSDT"],
            timeframe="1h",
            data_range="2025-12-01 ~ 2026-03-29",
            data_granularity="kline+trade",
            fee_model="bybit-uta-live-fee",
            slippage_model="volatility-aware-v2",
            parameter_snapshot={"fast_ma": 21, "slow_ma": 55, "risk_per_trade": 1.2},
            metrics=BacktestMetrics(
                annual_return="+48.2%",
                max_drawdown="-8.4%",
                sharpe="1.92",
                win_rate="58.6%",
                pnl="+152,000 USDT",
                trades=134,
            ),
            notes="趋势过滤稳定，震荡期存在信号抖动。",
        ),
        BacktestRun(
            id="bt-002",
            strategy_id="eth-revert-02",
            strategy_name="ETH 均值回归",
            status="running",
            started_at=iso(BASE_NOW - timedelta(minutes=38)),
            finished_at=None,
            symbol_scope=["ETHUSDT"],
            timeframe="15m",
            data_range="2026-01-01 ~ 2026-03-29",
            data_granularity="kline",
            fee_model="paper-fee",
            slippage_model="fixed-0.12%",
            parameter_snapshot={"zscore_entry": 2.1, "stop_loss_pct": 1.2},
            metrics=BacktestMetrics(
                annual_return="+18.4%",
                max_drawdown="-4.6%",
                sharpe="1.44",
                win_rate="61.2%",
                pnl="+38,220 USDT",
                trades=89,
            ),
            notes="OpenClaw 正在评估新的止损阈值。",
        ),
    ]

    reviews = [
        ReviewDocument(
            id="review-20260330-daily",
            period="daily",
            title="2026-03-30 日度 AI 复盘",
            summary="BTC 趋势策略延续高胜率，ETH 回归策略需压缩止损，SOL 策略建议保留人工接管。",
            highlights=[
                "BTC 趋势跟随贡献了今日 57% 的已实现收益。",
                "ETH 触发 2 次风控拦截，主要来自假突破后的反向滑点。",
                "Bybit 公告与宏观事件未形成持续冲击，当前市场更受资金流驱动。",
            ],
            risks=[
                "SOL 影子策略在高波动区间存在过度加仓倾向。",
                "OpenClaw 调度队列积压达到 3 项，建议优先处理回测任务。",
            ],
            proposals=[
                StrategyProposal(
                    id="prop-001",
                    proposal_type="param_update",
                    strategy_id="eth-revert-02",
                    title="压缩 ETH 止损阈值",
                    description="将 stop_loss_pct 从 1.5% 降到 1.2%，并增加 35 分钟冷却时间。",
                    created_at=iso(BASE_NOW - timedelta(minutes=20)),
                    status="testing",
                    expected_impact="降低反复试单产生的回撤。",
                    payload={
                        "target_mode": "paper",
                        "parameter_patch": {
                            "stop_loss_pct": 1.2,
                            "cooldown_minutes": 35,
                        },
                    },
                ),
                StrategyProposal(
                    id="prop-002",
                    proposal_type="publish_recommendation",
                    strategy_id="trend-btc-01",
                    title="允许 BTC 策略继续保持 Live 发布",
                    description="风险曲线仍在预算内，不建议冻结自动发布。",
                    created_at=iso(BASE_NOW - timedelta(minutes=18)),
                    status="pending",
                    expected_impact="保持稳定收益输出。",
                    payload={
                        "target_mode": "live",
                        "recommendation": "keep_live_publish",
                    },
                ),
                StrategyProposal(
                    id="prop-003",
                    proposal_type="backtest_request",
                    strategy_id="sol-breakout-03",
                    title="SOL 突破策略追加 30 天回放",
                    description="针对最近高波动区间补跑 30 天 15m 回测，确认人工接管前后的滑点变化。",
                    created_at=iso(BASE_NOW - timedelta(minutes=12)),
                    status="pending",
                    expected_impact="确认突破窗口与滑点上限是否仍然适配当前市场。",
                    payload={
                        "data_range": "2026-03-01 ~ 2026-03-29",
                        "timeframe": "15m",
                    },
                ),
            ],
            created_at=iso(BASE_NOW - timedelta(minutes=16)),
        )
    ]

    alerts = [
        AlertRecord(
            id="alert-001",
            severity="P0",
            symbol="SOLUSDT",
            title="SOL 策略进入人工接管",
            description="OpenClaw 请求暂停自动发布，等待人工确认当前风控边界。",
            triggered_at=iso(BASE_NOW - timedelta(minutes=42)),
            suggested_action="在 AI 调度页选择“进入人工接管”并冻结自动发布。",
            rule_key="manual-override:SOLUSDT",
        ),
        AlertRecord(
            id="alert-002",
            severity="P1",
            symbol="BTCUSDT",
            title="BTC 资金费率上升",
            description="资金费率短时抬升，建议观察隔夜持仓成本。",
            triggered_at=iso(BASE_NOW - timedelta(minutes=24)),
            related_news_id="news-002",
            suggested_action="复查 BTC 趋势策略夜盘持仓时间限制。",
            rule_key="funding-rate:BTCUSDT",
        ),
        AlertRecord(
            id="alert-003",
            severity="P1",
            symbol="ETHUSDT",
            title="ETH 回测结果更新",
            description="新的止损参数组合已完成 72% 历史区间验证。",
            triggered_at=iso(BASE_NOW - timedelta(minutes=9)),
            suggested_action="查看回测页的参数对比结果。",
            rule_key="backtest-review:ETHUSDT",
        ),
    ]

    alert_rules = [
        AlertRule(
            id="rule-btc-vol-001",
            symbol="BTCUSDT",
            market="perp",
            threshold_pct=5.0,
            enabled=True,
            cooldown_minutes=30,
            created_at=iso(BASE_NOW - timedelta(hours=18)),
            updated_at=iso(BASE_NOW - timedelta(hours=2)),
        ),
        AlertRule(
            id="rule-sol-vol-001",
            symbol="SOLUSDT",
            market="spot",
            threshold_pct=8.0,
            enabled=True,
            cooldown_minutes=45,
            created_at=iso(BASE_NOW - timedelta(hours=10)),
            updated_at=iso(BASE_NOW - timedelta(hours=1)),
        ),
    ]

    news_events = [
        NewsEvent(
            id="news-001",
            source="Bybit Announcement",
            title="Bybit 公告：新一轮维护窗口预告",
            summary="公告提醒 API 与网页入口在周末维护窗口可能出现短时波动，需关注调度回补逻辑。",
            url="https://www.bybit-global.com/",
            symbols=["BTCUSDT", "ETHUSDT"],
            impact_score=68,
            published_at=iso(BASE_NOW - timedelta(hours=5)),
            category="announcement",
            related_alert_ids=["alert-003"],
        ),
        NewsEvent(
            id="news-002",
            source="Trading Economics",
            title="美国核心通胀预期回升",
            summary="宏观日历显示通胀预期高于市场一致值，风险资产短线波动上升。",
            url=None,
            symbols=["BTCUSDT", "ETHUSDT", "SOLUSDT"],
            impact_score=82,
            published_at=iso(BASE_NOW - timedelta(minutes=31)),
            category="macro",
            related_alert_ids=["alert-002"],
        ),
        NewsEvent(
            id="news-003",
            source="GDELT",
            title="全球科技股风险偏好回暖",
            summary="风险偏好回暖带动加密市场 beta 品种走强，SOL 与 AI 板块关注度上升。",
            url=None,
            symbols=["SOLUSDT"],
            impact_score=59,
            published_at=iso(BASE_NOW - timedelta(minutes=51)),
            category="market",
            related_alert_ids=["alert-001"],
        ),
    ]

    trades = [
        TradeRecord(
            id="trade-001",
            symbol="BTCUSDT",
            market="perp",
            mode=AccountMode.LIVE,
            origin="strategy",
            side="buy",
            quantity=1.6,
            price=85420.5,
            pnl="+8,420 USDT",
            strategy_id="trend-btc-01",
            created_at=iso(BASE_NOW - timedelta(hours=1, minutes=14)),
            status="filled",
        ),
        TradeRecord(
            id="trade-002",
            symbol="SOLUSDT",
            market="spot",
            mode=AccountMode.DEMO,
            origin="manual",
            side="sell",
            quantity=340,
            price=242.1,
            pnl="-1,120 USDT",
            strategy_id=None,
            created_at=iso(BASE_NOW - timedelta(minutes=49)),
            status="filled",
        ),
        TradeRecord(
            id="trade-003",
            symbol="ETHUSDT",
            market="perp",
            mode=AccountMode.PAPER,
            origin="strategy",
            side="buy",
            quantity=22,
            price=4798.2,
            pnl="+2,080 USDT",
            strategy_id="eth-revert-02",
            created_at=iso(BASE_NOW - timedelta(minutes=17)),
            status="partially_filled",
        ),
    ]

    audit_events = [
        ExecutionEvent(
            id="evt-001",
            event_type="scheduler.command",
            severity=EventSeverity.WARNING,
            source="desktop",
            symbol="SOLUSDT",
            strategy_id="sol-breakout-03",
            payload={"command": "enter_manual_override", "reason": "高波动窗口人工接管"},
            trace_id="trace-scheduler-001",
            occurred_at=iso(BASE_NOW - timedelta(minutes=43)),
        ),
        ExecutionEvent(
            id="evt-002",
            event_type="change_request.applied",
            severity=EventSeverity.INFO,
            source="openclaw",
            symbol="ETHUSDT",
            strategy_id="eth-revert-02",
            payload={"change_request_id": "cr-001", "summary": "止损参数写入策略配置并触发回测"},
            trace_id="trace-cr-001",
            occurred_at=iso(BASE_NOW - timedelta(minutes=5)),
        ),
        ExecutionEvent(
            id="evt-003",
            event_type="risk.blocked_order",
            severity=EventSeverity.ERROR,
            source="quant-core",
            symbol="ETHUSDT",
            strategy_id="eth-revert-02",
            payload={"reason": "超过单日亏损预算", "mode": "paper"},
            trace_id="trace-risk-002",
            occurred_at=iso(BASE_NOW - timedelta(hours=1, minutes=27)),
        ),
    ]

    settings = SettingsPayload(
        bybit_web_entry="https://www.bybit-global.com/",
        api_base_url="https://api.bybit.com",
        openclaw_gateway_url="ws://127.0.0.1:18789",
        openclaw_agent="codex",
        default_mode=AccountMode.PAPER,
        notification_channels=["desktop", "telegram", "email"],
        grafana_base_url=None,
        grafana_dashboard_uid=None,
        grafana_org_id=1,
        grafana_theme="dark",
    )

    workspace_preferences = WorkspacePreferences(
        active_section="overview",
        layout_preset="balanced",
        selected_mode=AccountMode.PAPER,
        selected_symbol="BTCUSDT",
        selected_market_timeframe="1h",
        selected_strategy_id="trend-btc-01",
        overview_card_order=[
            "ai_center",
            "strategy_watch",
            "account_center",
        ],
        overview_visible_cards=[
            "ai_center",
            "strategy_watch",
            "account_center",
        ],
        overview_collapsed_cards=[],
        updated_at=iso(BASE_NOW - timedelta(minutes=22)),
    )

    return AppState(
        control_snapshot=control_snapshot,
        watchlist=watchlist,
        market_details=market_details,
        strategies=strategies,
        backtests=backtests,
        change_requests=change_requests,
        agent_jobs=agent_jobs,
        reviews=reviews,
        alerts=alerts,
        alert_rules=alert_rules,
        news_events=news_events,
        trades=trades,
        audit_events=audit_events,
        settings=settings,
        workspace_preferences=workspace_preferences,
    )

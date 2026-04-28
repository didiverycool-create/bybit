"""FastAPI route handlers extracted from ``main.py``.

Round 109 — every ``@app.<method>(...)`` handler that previously lived inline
in ``services/control-api/main.py`` is now registered on a dedicated
:class:`~fastapi.APIRouter` defined here and wired back into the existing
``app`` instance via ``app.include_router(router)`` from ``main.py``.

Module-level state, locks, threading primitives and helper functions remain
in ``main.py``.  Each handler simply delegates to a ``main.<helper>()`` call
or a directly-imported model class so call sites stay observable behaviour
identical to the pre-extraction shape (matching the pattern established by
``alert_and_guard_sync.py`` / ``audit_aggregators.py`` / ``execution_health.py``).
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, StreamingResponse

import main
from main import AgentJobRetryPayload, BacktestCreate, ExecutionImpactSummarizeRequest
from models import (
    AccountLiveSnapshot,
    AccountMode,
    AccountOverview,
    AgentJobCreate,
    AiLiveSnapshot,
    AlertAcknowledgePayload,
    BybitPrivateStatus,
    BybitPublicStatus,
    BybitTradeProbeResult,
    ChangeRequestCreate,
    ClosePaperPositionPayload,
    EventSeverity,
    ExchangePositionBulkCloseResult,
    ExecutionImpactRecord,
    ExecutionPreview,
    ExecutionPreviewRequest,
    GrafanaIntegrationStatus,
    ManualOrderRequest,
    MarketLiveSnapshot,
    OpenClawStatus,
    OpsLiveSnapshot,
    OrderRecord,
    PaperOrderBulkCancelResult,
    PaperOrderCancelPayload,
    PaperOrderReplacePayload,
    PaperPositionBulkCloseResult,
    PositionRecord,
    RiskDecision,
    RuntimeWorkerActionPayload,
    RuntimeWorkerActionResult,
    RuntimeWorkerStatus,
    SchedulerCommand,
    SchedulerSnapshot,
    SettingsPayload,
    SettingsUpdatePayload,
    StrategyActivitySnapshot,
    StrategyExecutionRequest,
    StrategyExecutionResult,
    StrategyLiveSnapshot,
    StrategyProposalActionPayload,
    StrategyProposalActionResult,
    StrategyRuntimeSnapshot,
    StrategyTrackingReviewRequest,
    WatchlistCreatePayload,
    WatchlistInstrument,
    WatchlistRemoveResult,
    WorkspacePreferences,
    WorkspacePreferencesUpdate,
    normalize_backtest_timeframe,
)


router = APIRouter()


@router.get("/health")
def health() -> dict:
    return main.build_health_payload()


@router.head("/health")
def health_head() -> dict:
    return main.build_health_payload()


@router.get("/api/control/snapshot")
def get_control_snapshot():
    main._sync_strategy_runtime_worker_issue_alerts()
    main._sync_public_execution_channel_alerts()
    main._sync_private_execution_channel_alerts()
    return main._build_control_snapshot_response()


@router.get("/metrics", response_class=PlainTextResponse)
def get_prometheus_metrics():
    return PlainTextResponse(main.build_prometheus_metrics())


@router.get("/api/market/watchlist")
def get_watchlist(refresh: bool = False):
    watchlist = (
        main.market_data.enrich_watchlist(main.repo.snapshot().watchlist)
        if refresh
        else main.market_data.enrich_watchlist_fast(main.repo.snapshot().watchlist)
    )
    main.repo.sync_market_watchlist(watchlist)
    return watchlist


@router.post("/api/market/watchlist", response_model=WatchlistInstrument)
def add_watchlist_item(payload: WatchlistCreatePayload):
    try:
        item, detail = main.build_watchlist_item(payload.symbol, payload.market)
        saved = main.repo.add_watchlist_item(item, payload.requested_by, detail_override=detail)
        if hasattr(main.market_data, "update_realtime_watchlist"):
            main.market_data.update_realtime_watchlist(main.repo.snapshot().watchlist)
        return saved
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/api/market/watchlist/{symbol}", response_model=WatchlistRemoveResult)
def remove_watchlist_item(symbol: str, requested_by: str = "desktop_operator"):
    try:
        removed = main.repo.remove_watchlist_item(symbol, requested_by=requested_by)
        if hasattr(main.market_data, "update_realtime_watchlist"):
            main.market_data.update_realtime_watchlist(main.repo.snapshot().watchlist)
        return removed
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"自选品种不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/api/market/live", response_model=MarketLiveSnapshot)
def get_market_live_snapshot(symbol: str, timeframe: str = "1h"):
    return main.build_market_live_snapshot_payload(symbol, timeframe=timeframe)


@router.get("/api/market/stream")
async def stream_market_live(symbol: str, timeframe: str = "1h", once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000
    try:
        normalized_timeframe = main.market_data.normalize_timeframe(timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(
                main.build_market_live_snapshot_payload,
                symbol,
                normalized_timeframe,
            )
            yield main.format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/market/{symbol}")
def get_market_detail(symbol: str, timeframe: str = "1h"):
    state = main.repo.snapshot()
    uppercase_symbol = symbol.upper()
    try:
        normalized_timeframe = main.market_data.normalize_timeframe(timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    watch_item = next((item for item in state.watchlist if item.symbol == uppercase_symbol), None)
    detail = state.market_details.get(uppercase_symbol)
    market = watch_item.market if watch_item is not None else detail.market if detail is not None else None
    if market is None:
        raise HTTPException(status_code=404, detail="找不到该品种")
    fallback_detail = main.build_runtime_market_fallback_detail(
        symbol=uppercase_symbol,
        market=market,
        timeframe=normalized_timeframe,
        watch_item=watch_item,
        base_detail=detail,
    )
    try:
        return main.market_data.enrich_market_detail(
            symbol=uppercase_symbol,
            market=market,
            fallback_detail=fallback_detail,
            watch_item=watch_item,
            timeframe=normalized_timeframe,
        )
    except RuntimeError as exc:
        return main.build_runtime_market_fallback_detail(
            symbol=uppercase_symbol,
            market=market,
            timeframe=normalized_timeframe,
            watch_item=watch_item,
            base_detail=detail,
            failure_reason=str(exc),
        )


@router.get("/api/strategies")
def get_strategies():
    return main.repo.snapshot().strategies


@router.get("/api/strategies/live", response_model=List[StrategyRuntimeSnapshot])
def get_strategy_runtime():
    return main.build_strategy_runtime_response()


@router.get(
    "/api/strategies/{strategy_id}/activity",
    response_model=StrategyActivitySnapshot,
    response_model_exclude_none=True,
)
def get_strategy_activity(strategy_id: str):
    try:
        return main.build_strategy_activity_payload(strategy_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc


@router.post("/api/strategies/{strategy_id}/review")
def create_strategy_tracking_review(strategy_id: str, payload: StrategyTrackingReviewRequest):
    try:
        job_payload = main.build_manual_strategy_review_job(strategy_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    job = main.repo.create_agent_job(job_payload)
    main.repo.add_event(
        event_type="strategy.review.requested",
        source="desktop",
        severity=EventSeverity.INFO,
        payload={
            "job_id": job.id,
            "job_type": job.job_type,
            "review_kind": payload.review_kind,
            "summary": payload.summary.strip(),
            "detail": (payload.detail or "").strip() or None,
            "requested_by": payload.requested_by,
        },
        symbol=str(job.context.get("symbol") or None),
        strategy_id=str(job.context.get("strategy_id") or None),
    )
    return job


@router.get("/api/strategies/stream", response_model=StrategyLiveSnapshot)
async def stream_strategy_runtime(once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(main.build_strategy_live_snapshot_payload)
            yield main.format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/strategies/{strategy_id}/execution-preview", response_model=ExecutionPreview)
def get_strategy_execution_preview(strategy_id: str, mode: Optional[AccountMode] = None):
    try:
        return main.build_strategy_execution_preview(strategy_id, mode)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/strategies/{strategy_id}/execute", response_model=StrategyExecutionResult)
def execute_strategy_signal(strategy_id: str, payload: StrategyExecutionRequest):
    try:
        return main.dispatch_strategy_signal(strategy_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=main._format_runtime_error_detail(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/api/account/overview", response_model=AccountOverview)
def get_account_overview(mode: Optional[AccountMode] = None):
    return main.parse_account_overview(mode=mode)


@router.get("/api/account/live", response_model=AccountLiveSnapshot)
def get_account_live_snapshot(mode: Optional[AccountMode] = None):
    return main.build_account_live_snapshot_payload(mode=mode)


@router.get("/api/account/positions", response_model=List[PositionRecord])
def get_account_positions(mode: Optional[AccountMode] = None):
    return main.parse_positions(mode=mode)


@router.get("/api/account/orders", response_model=List[OrderRecord])
def get_account_orders(mode: Optional[AccountMode] = None):
    return main.parse_open_orders(mode=mode)


@router.get("/api/account/order-history", response_model=List[OrderRecord])
def get_account_order_history(mode: Optional[AccountMode] = None):
    return main.parse_order_history(mode=mode)


@router.get("/api/account/stream")
async def stream_account_live(once: bool = False, interval_ms: int = 4000, mode: Optional[AccountMode] = None):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(main.build_account_live_snapshot_payload, mode)
            yield main.format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/backtests")
def get_backtests():
    return main.repo.snapshot().backtests


@router.post("/api/backtests")
def create_backtest(payload: BacktestCreate):
    try:
        normalized_timeframe = normalize_backtest_timeframe(payload.timeframe)
        return main.repo.create_backtest(
            payload.strategy_id,
            payload.data_range,
            normalized_timeframe,
            source_change_request_id=payload.source_change_request_id,
            source_backtest_id=payload.source_backtest_id,
            source_review_id=payload.source_review_id,
            source_proposal_id=payload.source_proposal_id,
            trigger_reason=payload.trigger_reason,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc


@router.get("/api/change-requests")
def get_change_requests():
    return main.repo.snapshot().change_requests


@router.post("/api/change-requests")
def create_change_request(payload: ChangeRequestCreate):
    return main.repo.create_change_request(payload)


@router.get("/api/ai/scheduler", response_model=SchedulerSnapshot)
def get_scheduler():
    return main.build_scheduler_snapshot_payload()


@router.get("/api/ai/live", response_model=AiLiveSnapshot)
def get_ai_live_snapshot():
    return main.build_ai_live_snapshot_payload()


@router.get("/api/ai/stream")
async def stream_ai_live(once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(main.build_ai_live_snapshot_payload)
            yield main.format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/api/ops/live", response_model=OpsLiveSnapshot)
def get_ops_live_snapshot():
    return main.build_ops_live_snapshot_payload()


@router.get("/api/ops/stream")
async def stream_ops_live(once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(main.build_ops_live_snapshot_payload)
            yield main.format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/api/ai/scheduler/commands")
def apply_scheduler_command(payload: SchedulerCommand):
    return main.repo.apply_scheduler_command(payload)


@router.post("/api/runtime/strategy-worker/restart", response_model=RuntimeWorkerActionResult)
def post_restart_strategy_runtime_worker(payload: RuntimeWorkerActionPayload):
    try:
        return main.restart_strategy_runtime_worker(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/api/runtime/strategy-worker/status", response_model=RuntimeWorkerStatus)
def get_runtime_worker_status():
    main._sync_strategy_runtime_worker_issue_alerts()
    main._sync_private_execution_channel_alerts()
    return main.build_runtime_worker_status()


@router.get("/api/ai/jobs")
def get_agent_jobs():
    return main.repo.snapshot().agent_jobs


@router.post("/api/ai/jobs")
def create_agent_job(payload: AgentJobCreate):
    if payload.job_type in {"generate_daily_review", "generate_backtest_review"}:
        payload = payload.model_copy(update={"context": main.enrich_review_job_context(dict(payload.context))})
    return main.repo.create_agent_job(payload)


@router.post("/api/ai/jobs/{job_id}/retry")
def retry_agent_job(job_id: str, payload: AgentJobRetryPayload):
    try:
        return main.repo.retry_agent_job(job_id, requested_by=payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"任务不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/execution-impact/summarize")
def summarize_execution_impact(payload: ExecutionImpactSummarizeRequest):
    job_id = main.repo.queue_summarize_execution_impact(
        strategy_id=payload.strategy_id,
        strategy_name=payload.strategy_name,
        window_start=payload.window_start,
        window_end=payload.window_end,
        order_count=payload.order_count,
        fill_count=payload.fill_count,
        total_notional=payload.total_notional,
        slippage_bps=payload.slippage_bps,
        expected_pnl=payload.expected_pnl,
        realized_pnl=payload.realized_pnl,
        anomalies=payload.anomalies,
        requested_by=payload.requested_by,
    )
    return {"job_id": job_id}


@router.get("/api/execution-impact/records", response_model=List[ExecutionImpactRecord])
def get_execution_impact_records():
    return main.repo.snapshot().execution_impact_records


@router.get("/api/ai/reviews")
def get_reviews(
    strategy_id: Optional[str] = None,
    period: Optional[str] = None,
    backtest_id: Optional[str] = None,
):
    reviews = main.repo.snapshot().reviews

    if strategy_id:
        needle = strategy_id.strip()
        reviews = [
            review
            for review in reviews
            if review.strategy_id == needle
            or any(proposal.strategy_id == needle for proposal in review.proposals)
        ]
    if backtest_id:
        needle = backtest_id.strip()
        reviews = [review for review in reviews if review.backtest_id == needle]

    if period:
        allowed_periods = {item.strip() for item in period.split(",") if item.strip()}
        if allowed_periods:
            reviews = [review for review in reviews if review.period in allowed_periods]

    return reviews


@router.post("/api/ai/proposals/{proposal_id}/action", response_model=StrategyProposalActionResult)
def apply_strategy_proposal_action(proposal_id: str, payload: StrategyProposalActionPayload):
    try:
        return main.repo.apply_strategy_proposal(proposal_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"提案不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/api/news")
def get_news():
    feed = main.build_news_feed()
    main.repo.sync_news_events(feed)
    return main.repo.snapshot().news_events


@router.get("/api/alerts")
def get_alerts():
    return main.repo.snapshot().alerts


@router.get("/api/alert-rules")
def get_alert_rules():
    return main.repo.snapshot().alert_rules


@router.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, payload: AlertAcknowledgePayload):
    try:
        return main.repo.acknowledge_alert(alert_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"提醒不存在: {exc}") from exc


@router.get("/api/trades")
def get_trades():
    return main.parse_trades()


@router.post("/api/trades/manual")
def create_manual_trade(payload: ManualOrderRequest):
    if payload.mode != AccountMode.PAPER:
        raise HTTPException(
            status_code=409,
            detail="当前版本只开放 Paper 模式的手动交易录入；Demo / Live 待真实执行引擎接通后再开放。",
        )
    try:
        return main.repo.create_manual_trade(payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/orders/exchange", response_model=OrderRecord)
def create_exchange_order(payload: ManualOrderRequest):
    if payload.mode == AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="Paper 模式请继续使用本地手动交易或 Paper 委托接口。")
    try:
        return main.submit_exchange_order(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/orders/exchange/{order_id}/cancel", response_model=OrderRecord)
def post_cancel_exchange_order(order_id: str, payload: PaperOrderCancelPayload):
    try:
        return main.cancel_exchange_order(order_id, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待取消的真实委托: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/orders/exchange/{order_id}/replace", response_model=OrderRecord)
def post_replace_exchange_order(order_id: str, payload: PaperOrderReplacePayload):
    try:
        return main.replace_exchange_order(order_id, payload.quantity, payload.price, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待修改的真实委托: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/orders/exchange/cancel-all", response_model=PaperOrderBulkCancelResult)
def post_cancel_all_exchange_orders(payload: PaperOrderCancelPayload):
    try:
        return main.cancel_all_exchange_orders(payload.requested_by)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/account/paper/orders", response_model=OrderRecord)
def create_paper_order(payload: ManualOrderRequest):
    if payload.mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下创建本地限价委托。")
    if main.repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前工作台不在 Paper 模式，无法创建本地限价委托。")
    try:
        return main.repo.create_paper_order(payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/trades/preview", response_model=ExecutionPreview)
def preview_trade(payload: ExecutionPreviewRequest):
    return main._build_preview_for_request(payload)


@router.post("/api/trades/preview/decision", response_model=RiskDecision)
def preview_trade_decision(payload: ExecutionPreviewRequest) -> RiskDecision:
    """Return the Round 58 :class:`RiskDecision` for ``payload``.

    Wraps the same preview the ``/api/trades/preview`` endpoint returns so
    callers can branch on the typed ``verdict`` / ``reason_code`` while still
    reading the embedded preview's numeric fields (notional, projected
    position, sizing budgets, …).
    """

    preview = main._build_preview_for_request(payload)
    return main.evaluate_risk_decision(preview)


@router.post("/api/account/paper/orders/{order_id}/cancel", response_model=OrderRecord)
def cancel_paper_order(order_id: str, payload: PaperOrderCancelPayload):
    if main.repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下取消本地限价委托。")
    try:
        return main.repo.cancel_paper_order(order_id, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待取消的 Paper 委托: {exc}") from exc


@router.post("/api/account/paper/orders/cancel-all", response_model=PaperOrderBulkCancelResult)
def cancel_all_paper_orders(payload: PaperOrderCancelPayload):
    if main.repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下批量取消本地限价委托。")
    return main.repo.cancel_all_paper_orders(payload.requested_by)


@router.post("/api/account/paper/orders/{order_id}/replace", response_model=OrderRecord)
def replace_paper_order(order_id: str, payload: PaperOrderReplacePayload):
    if main.repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下修改本地限价委托。")
    try:
        return main.repo.replace_paper_order(order_id, payload.quantity, payload.price, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待修改的 Paper 委托: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/account/paper/positions/{symbol}/close")
def close_paper_position(symbol: str, payload: ClosePaperPositionPayload):
    if main.repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下一键平仓。")
    try:
        return main.repo.close_paper_position(symbol, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 当前没有可平的 Paper 持仓。") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/account/paper/positions/close-all", response_model=PaperPositionBulkCloseResult)
def close_all_paper_positions(payload: ClosePaperPositionPayload):
    if main.repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下批量平仓。")
    return main.repo.close_all_paper_positions(payload.requested_by)


@router.post("/api/account/exchange/positions/{symbol}/close", response_model=OrderRecord)
def post_close_exchange_position(symbol: str, payload: ClosePaperPositionPayload):
    try:
        return main.close_exchange_position(symbol, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 当前没有可平的真实持仓。") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.post("/api/account/exchange/positions/close-all", response_model=ExchangePositionBulkCloseResult)
def post_close_all_exchange_positions(payload: ClosePaperPositionPayload):
    try:
        return main.close_all_exchange_positions(payload.requested_by)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@router.get("/api/audit/events")
def get_audit_events():
    return main.repo.snapshot().audit_events


@router.get("/api/settings", response_model=SettingsPayload)
def get_settings():
    # Round 131 — merge the runtime feature-flag store onto the persisted
    # settings before returning so the desktop "Settings" panel sees the
    # current execution-engine.shadow flag (default ``True``).  The
    # underlying state.settings.feature_flags stays empty / persisted as-is
    # — this is purely a read-time mirror.  Future work (wave-3-B) replaces
    # the runtime store with a SQLite-backed read.
    settings = main.repo.snapshot().settings
    runtime_flags = dict(main._FEATURE_FLAGS_RUNTIME)
    if runtime_flags:
        merged_flags = dict(settings.feature_flags or {})
        merged_flags.update(runtime_flags)
        return settings.model_copy(update={"feature_flags": merged_flags})
    return settings


@router.get("/api/internal/persistence/feature-flags")
def get_internal_feature_flags() -> Dict[str, Any]:
    """Round 137 — wave-3-B §F.2 commit 6 read-only feature-flag endpoint.

    Surfaces the current in-process feature-flag store so the desktop
    "Settings → 数据" panel can render the wave-3 engine flag state
    (``execution_engine.shadow`` / ``execution_engine.paper`` / future
    siblings) without having to consume the larger ``/api/settings``
    payload.

    The endpoint is **read-only** — writes still go through the
    persistence DAO (``ConfigDao.set_feature_flag``).  No authentication
    is required because the entire control-api binds to localhost
    (127.0.0.1) by design and the desktop client is the only consumer.

    Response shape::

        {
            "flags": {"execution_engine.shadow": true, ...},
            "defaults": {"execution_engine.shadow": true, ...},
            "source": "runtime",
        }

    ``flags`` carries the live values; ``defaults`` documents what the
    flag would resolve to if the in-process store were cleared (this
    matches the design contract that "no row → safe default").
    ``source`` is currently always ``"runtime"`` (in-process); wave-3-C
    will add ``"sqlite"`` once the persistence DAO is wired into
    ``main.py`` at module load time.
    """

    runtime_flags = dict(main._FEATURE_FLAGS_RUNTIME)
    defaults: Dict[str, bool] = {
        main._EXECUTION_ENGINE_SHADOW_FLAG_NAME:
            main._EXECUTION_ENGINE_SHADOW_DEFAULT,
        main._EXECUTION_ENGINE_PAPER_FLAG_NAME:
            main._EXECUTION_ENGINE_PAPER_DEFAULT,
    }
    return {
        "flags": runtime_flags,
        "defaults": defaults,
        "source": "runtime",
    }


@router.post("/api/settings", response_model=SettingsPayload)
def update_settings(payload: SettingsUpdatePayload):
    try:
        settings = main.repo.update_settings(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    main.market_data.base_url = settings.api_base_url.rstrip("/")
    if hasattr(main.market_data, "_candle_cache"):
        main.market_data._candle_cache.clear()  # type: ignore[attr-defined]
    if hasattr(main.market_data, "_recent_trade_cache"):
        main.market_data._recent_trade_cache.clear()  # type: ignore[attr-defined]
    if hasattr(main.market_data, "_announcement_cache"):
        main.market_data._announcement_cache.clear()  # type: ignore[attr-defined]
    if hasattr(main.market_data, "_instrument_cache"):
        main.market_data._instrument_cache.clear()  # type: ignore[attr-defined]
    if hasattr(main.market_data, "_connectivity_probe_cache"):
        main.market_data._connectivity_probe_cache = None  # type: ignore[attr-defined]
    if hasattr(main.market_data, "_candle_history_cache"):
        main.market_data._candle_history_cache.clear()  # type: ignore[attr-defined]
    return settings


@router.get("/api/workspace/preferences", response_model=WorkspacePreferences)
def get_workspace_preferences():
    return main.repo.snapshot().workspace_preferences


@router.post("/api/workspace/preferences", response_model=WorkspacePreferences)
def update_workspace_preferences(payload: WorkspacePreferencesUpdate):
    return main.repo.update_workspace_preferences(payload)


@router.get("/api/integrations/openclaw", response_model=OpenClawStatus)
def get_openclaw_status():
    status = main.openclaw.get_status(worker_state=main.agent_worker_state)
    main.repo.set_openclaw_connection(status.reachable)
    return status


@router.get("/api/integrations/bybit-private", response_model=BybitPrivateStatus)
def get_bybit_private_status():
    status = main.private_data.get_status()
    realtime_status = main._build_private_realtime_health()
    balance_diagnostics = main._build_private_usdt_balance_diagnostics(status)
    private_rest_reachable: Optional[bool]
    if balance_diagnostics:
        private_rest_reachable = any(item.error is None for item in balance_diagnostics)
    else:
        private_rest_reachable = None
    # Round 99 — read both the ``issue`` string and the typed ``issue_kind``
    # from the new health helper so the recommender receives the typed kind
    # from source rather than having the callsite re-classify.
    private_health = main._build_private_execution_channel_health(status.mode)
    realtime_issue = private_health.get("issue")
    return status.model_copy(
        update={
            "realtime_enabled": bool(realtime_status.get("enabled")),
            "realtime_connected": bool(realtime_status.get("connected")),
            "realtime_authenticated": bool(realtime_status.get("authenticated")),
            "realtime_last_message_at": realtime_status.get("last_message_at"),
            "realtime_stale": bool(realtime_status.get("stale")),
            "realtime_stale_seconds": int(realtime_status.get("stale_seconds") or 0),
            "realtime_last_error": realtime_status.get("last_error"),
            "realtime_recommended_action": (
                main._build_private_execution_channel_recommended_action(
                    realtime_issue,
                    last_error=realtime_status.get("last_error"),
                    rest_reachable=private_rest_reachable,
                    issue_kind=private_health.get("issue_kind"),
                )
                if realtime_issue
                else None
            ),
            "usdt_balance_diagnostics": balance_diagnostics,
        }
    )


@router.get("/api/integrations/bybit-public", response_model=BybitPublicStatus)
def get_bybit_public_status():
    return main.build_bybit_public_status()


@router.get("/api/integrations/grafana", response_model=GrafanaIntegrationStatus)
def get_grafana_status():
    return main.build_grafana_status()


@router.post("/api/integrations/bybit-private/probe-trade", response_model=BybitTradeProbeResult)
def post_bybit_trade_probe():
    return main.probe_private_trade_route()


@router.get("/api/strategies/{strategy_id}/risk-hints")
def get_strategy_runtime_risk_hints(strategy_id: str):
    """Expose structured stop/target/band reference prices for a strategy.

    Additive read-only helper: derives hints from the same market detail the
    runtime evaluator already sees, so the UI (or risk-gate middleware) can
    surface concrete "距离止损/止盈" numbers without re-implementing the math.
    """

    from strategy_runtime import compute_strategy_runtime_risk_hints

    state = main.repo.snapshot()
    strategy = next((item for item in state.strategies if item.id == strategy_id), None)
    if strategy is None:
        raise HTTPException(status_code=404, detail=f"策略不存在: {strategy_id}")
    if not strategy.symbols:
        raise HTTPException(status_code=400, detail="策略未绑定任何交易对，无法生成风控提示。")

    symbol = strategy.symbols[0]
    watch_item = next((item for item in state.watchlist if item.symbol == symbol), None)
    if watch_item is None:
        raise HTTPException(status_code=404, detail=f"观察列表未包含 {symbol}，无法生成风控提示。")

    fallback_detail = state.market_details.get(symbol) or main.build_market_detail_for_watchlist(watch_item)
    try:
        detail = main.market_data.enrich_market_detail(
            symbol=symbol,
            market=watch_item.market,
            fallback_detail=fallback_detail.model_copy(update={"timeframe": "1h"}),
            watch_item=watch_item,
            timeframe="1h",
        )
    except RuntimeError:
        detail = fallback_detail.model_copy(update={"timeframe": "1h"})

    return compute_strategy_runtime_risk_hints(
        strategy=strategy,
        detail=detail,
        watch_item=watch_item,
    )

from __future__ import annotations

import asyncio
import dataclasses
import json
import threading
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation, ROUND_DOWN, ROUND_UP
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
from uuid import uuid4

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, StreamingResponse
from pydantic import BaseModel, ValidationError

from bybit_private_client import BybitPrivateClient
from bybit_public_client import BybitPublicMarketClient
from datetime_utils import parse_optional_iso_datetime
try:
    from bybit_private_realtime import BybitPrivateRealtimeClient
except ModuleNotFoundError:
    class BybitPrivateRealtimeClient:  # type: ignore[no-redef]
        def __init__(self, client: BybitPrivateClient) -> None:
            self.client = client

        def start(self) -> bool:
            return False

        def ensure_started(self) -> bool:
            return False

        def stop(self) -> None:
            return None

        def get_status(self) -> Dict[str, Any]:
            return {
                "enabled": False,
                "connected": False,
                "authenticated": False,
                "last_message_at": None,
                "last_error": "bybit_private_realtime 模块缺失，已回退 REST。",
                "has_wallet": False,
                "positions_count": 0,
                "open_orders_count": 0,
                "executions_count": 0,
            }

        def get_wallet_snapshot(self) -> Optional[Dict[str, Any]]:
            return None

        def get_positions_snapshot(self) -> List[Dict[str, Any]]:
            return []

        def get_open_orders_snapshot(self) -> List[Dict[str, Any]]:
            return []

        def get_execution_snapshot(self, limit: int = 50) -> List[Dict[str, Any]]:
            return []

        def seed_wallet_snapshot(self, wallet: Dict[str, Any]) -> None:
            return None

        def seed_positions_snapshot(self, positions: List[Dict[str, Any]]) -> None:
            return None

        def seed_open_orders_snapshot(self, orders: List[Dict[str, Any]]) -> None:
            return None

        def seed_execution_snapshot(self, executions: List[Dict[str, Any]]) -> None:
            return None

try:
    from backtest_engine import (
        BACKTEST_ENGINE_MAX_CANDLES,
        candle_limit_for_range,
        estimate_candle_count_for_range,
        resolve_data_range_bounds,
        run_local_backtest,
    )
except ModuleNotFoundError:
    BACKTEST_ENGINE_MAX_CANDLES = 48

    def estimate_candle_count_for_range(data_range: str, timeframe: str) -> int:
        return 48

    def candle_limit_for_range(data_range: str, timeframe: str) -> int:
        return 48

    def resolve_data_range_bounds(
        data_range: str,
        now: Optional[datetime] = None,
    ) -> tuple[Optional[str], Optional[str]]:
        return None, None

    run_local_backtest = None
try:
    from strategy_runtime import evaluate_strategy_runtime
except ModuleNotFoundError:
    def evaluate_strategy_runtime(*args: Any, **kwargs: Any) -> Any:
        raise RuntimeError("strategy_runtime 模块缺失，无法计算策略运行态。")
from models import (
    AccountMode,
    AccountAsset,
    AccountLiveSnapshot,
    AccountOverview,
    AlertAcknowledgePayload,
    AgentJobCreate,
    AiLiveSnapshot,
    AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE,
    AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE,
    AUTO_DISPATCH_GATE_REASON_SCHEDULER_FREEZE_PUBLISH,
    AUTO_DISPATCH_GATE_REASON_SCHEDULER_MANUAL_OVERRIDE,
    AUTO_DISPATCH_GATE_REASON_SCHEDULER_PAUSED,
    AutoDispatchGate,
    AutoDispatchGateReasonContext,
    AutoDispatchOutcome,
    BybitBalanceDiagnostic,
    BybitPublicStatus,
    BybitPublicSymbolDiagnostic,
    BybitPrivateStatus,
    BybitTradeProbeResult,
    BACKTEST_RUN_TRADE_SERIALIZATION_CAP,
    BacktestRun,
    CandlePoint,
    ChangeRequestCreate,
    ClosePaperPositionPayload,
    Direction,
    ExecutionImpactRecord,
    ExchangeConstraintViolation,
    ExecutionIntent,
    ExecutionPreview,
    ExecutionPreviewRequest,
    RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL,
    RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL,
    RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD,
    RISK_REASON_STOP_LOSS_GUARD,
    LiveOrderReconciliation,
    ExchangePositionBulkCloseResult,
    ExecutionEvent,
    EventSeverity,
    ExecutionHealthSummary,
    GrafanaIntegrationStatus,
    LatestSchedulerCommand,
    ManualOrderRequest,
    MarketDetail,
    MarketLiveDiagnostics,
    MarketLiveSnapshot,
    NewsEvent,
    OpsLiveSnapshot,
    OpsLiveSummary,
    OpenClawStatus,
    OrderRecord,
    PositionRecord,
    PaperOrderCancelPayload,
    PaperOrderBulkCancelResult,
    PaperOrderReplacePayload,
    PaperPositionBulkCloseResult,
    ReconcileChangeRequestOutcome,
    ReviewDocument,
    RISK_REASON_EXCHANGE_CONSTRAINT,
    RISK_REASON_INSUFFICIENT_BALANCE,
    RISK_REASON_INSUFFICIENT_INVENTORY,
    RISK_REASON_RUNTIME_UNAVAILABLE,
    RiskDecision,
    RuntimeWorkerActionPayload,
    RuntimeWorkerActionResult,
    RuntimeWorkerStatus,
    SchedulerCommand,
    SchedulerCommandType,
    SchedulerSnapshot,
    SettingsPayload,
    SettingsUpdatePayload,
    StrategyActivityBacktestSummary,
    StrategyActivityLatestOpsSnapshot,
    StrategyActivityLatestRuntimeSnapshot,
    StrategyActivityReviewSummary,
    StrategyExecutionRequest,
    StrategyExecutionResult,
    StrategyActivityJobSummary,
    StrategyActivitySnapshot,
    StrategyTrackingReviewRequest,
    StrategyLiveSnapshot,
    StrategyRuntimeSnapshot,
    StrategyProposal,
    StrategyProposalActionPayload,
    StrategyProposalActionResult,
    StrategySummary,
    TradeRecord,
    WatchlistCreatePayload,
    WatchlistInstrument,
    WatchlistRemoveResult,
    WorkspacePreferences,
    WorkspacePreferencesUpdate,
    normalize_backtest_timeframe,
)
from strategy_activity_review import (
    build_strategy_activity_review_context_indexes,
    summarize_strategy_activity_alert as summarize_alert,
    summarize_strategy_activity_backtest as summarize_backtest,
    summarize_strategy_activity_change_request as summarize_change_request,
    summarize_strategy_activity_event as summarize_event,
    summarize_strategy_activity_job as summarize_agent_job,
    summarize_strategy_activity_order as summarize_order,
    summarize_strategy_activity_proposal,
    summarize_strategy_activity_review as summarize_review,
    summarize_strategy_activity_trade as summarize_trade,
)
from strategy_activity_snapshot import (
    build_strategy_activity_latest_runtime_snapshot as _build_strategy_activity_latest_runtime_snapshot,
    build_strategy_activity_snapshot_from_sections as _build_strategy_activity_snapshot_model,
)
from strategy_activity_latest_ops import (
    build_strategy_activity_latest_ops_snapshot as _build_strategy_activity_latest_ops_snapshot,
)
from strategy_activity_payload import (
    build_strategy_activity_recent_data as _build_strategy_activity_recent_data_model,
    StrategyActivityRecentData,
)
from strategy_activity_lineage import (
    StrategyActivityBacktestLinkage,
    StrategyActivityChangeRequestLinkage,
    StrategyActivityLineageContext,
    StrategyActivityLineageMaps,
    StrategyActivityProposalLinkage,
    StrategyActivityReviewLinkage,
    StrategyActivityReviewTailLinkage,
)
from strategy_activity_payload import (
    build_strategy_activity_payload_assemblies as _build_strategy_activity_payload_assemblies,
)
from strategy_activity_summary import (
    build_strategy_activity_summary_collections as _build_strategy_activity_summary_collections,
    has_strategy_activity_backtest_rerun_recommendation as _has_strategy_activity_backtest_rerun_recommendation,
    has_strategy_activity_change_request_rerun_recommendation as _has_strategy_activity_change_request_rerun_recommendation,
)
from openclaw_client import OpenClawGatewayClient
import parameter_resolver
from repository import AppRepository
from seed import build_market_detail_for_watchlist
from execution_health import (
    # Round 98 — typed ``channel_issue_kind`` discriminators now live next to
    # ``build_public_execution_channel_health`` (the primary emission site) so
    # the helper can set ``issue_kind`` from the typed branch variables at
    # source.  ``main.py`` re-exports the same names so existing callers and
    # tests that reference ``control_main.CHANNEL_ISSUE_KIND_*`` keep working.
    CHANNEL_ISSUE_KIND_AUTH,
    CHANNEL_ISSUE_KIND_DISABLED,
    CHANNEL_ISSUE_KIND_DISCONNECTED,
    CHANNEL_ISSUE_KIND_NO_FEED,
    CHANNEL_ISSUE_KIND_STALE,
    build_execution_health_top_issue_context as _build_execution_health_top_issue_context_impl,
    build_public_execution_channel_health as _build_public_execution_channel_health_impl,
    get_public_execution_channel_issue as _get_public_execution_channel_issue_impl,
    merge_execution_health_review_risks as _merge_execution_health_review_risks_impl,
    public_channel_for_market as _public_channel_for_market_impl,
)
from prometheus_metrics import (
    build_prometheus_metrics as _build_prometheus_metrics_impl,
)
from alert_and_guard_sync import (
    sync_private_execution_channel_alerts as _sync_private_execution_channel_alerts_impl,
    sync_public_execution_channel_alerts as _sync_public_execution_channel_alerts_impl,
    sync_strategy_runtime_worker_issue_alerts as _sync_strategy_runtime_worker_issue_alerts_impl,
)
from execution_preview_builders import (
    build_private_execution_preview as _build_private_execution_preview_impl,
    execution_preview_requires_reduce_only as _execution_preview_requires_reduce_only_impl,
    load_private_open_order_records_for_preview as _load_private_open_order_records_for_preview_impl,
    private_released_order_reservation as _private_released_order_reservation_impl,
    private_reserved_spot_sell_quantity as _private_reserved_spot_sell_quantity_impl,
)
from risk_decision import derive_block_reason_code, evaluate_risk_decision


app = FastAPI(title="Bybit 控制端本地服务", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class StrategyExecutionBlockedError(RuntimeError):
    def __init__(self, detail: str, recommended_action: Optional[str] = None) -> None:
        super().__init__(detail)
        self.detail = detail
        self.recommended_action = recommended_action


# Round 74 — typed ``RuntimeError`` subclass raised by
# ``_build_strategy_execution_preview_from_state`` when the upstream
# public/private realtime channel is unavailable.  The ``build_strategy_execution_preview``
# wrapper catches this subclass specifically (replacing the historical
# ``if "私有 WS" not in detail and "公共 WS" not in detail: raise`` substring
# branch) and maps it onto a blocked :class:`ExecutionPreview` carrying
# :data:`RISK_REASON_RUNTIME_UNAVAILABLE`.  Other ``RuntimeError`` instances
# (paused runtime, missing Paper preview, runtime worker outage, mode
# mismatch, cooldowns, …) continue to propagate to the caller unchanged.
#
# Round 80 — the caller now passes the ``channel`` kwarg
# (``"public"`` / ``"private"``) so the instance carries a typed
# ``sub_block_code`` (``RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL`` /
# ``RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL``) alongside the umbrella
# ``block_code``.  The R77 recommendation dispatch reads ``sub_block_code``
# first and only falls back to the ``"私有 WS"`` / ``"公共 WS"`` substring
# probe when the typed sub-code is missing.
_CHANNEL_SUB_BLOCK_CODE: Dict[str, str] = {
    "public": RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL,
    "private": RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL,
}


# Round 95 — typed ``channel_issue_kind`` discriminators.  Prior to R95 the
# ``_build_{public,private}_execution_channel_recommended_action`` helpers
# keyed their "has no feed" / "stale feed" / "private auth" recovery copy off
# substring probes (``"尚未收到"`` / ``"超过约"`` / ``"持续刷新"`` / ``"鉴权"``)
# of the free-form ``detail`` Chinese string.  The typed kinds let the raise
# sites pass the already-known issue classification explicitly, with the
# substring probes kept as a last-resort fallback for legacy callers.
#
# Round 98 — the constants now live in :mod:`execution_health` next to
# ``build_public_execution_channel_health`` (the primary typed-at-source
# emission site) and are re-imported above.  The classifier below remains
# here as the fallback path for legacy detail-only callers (alert records
# whose only typed source is the Chinese description, exception strings that
# predate typed ``issue_kind`` kwargs, …).


def _classify_channel_issue_kind(detail: Optional[str]) -> Optional[str]:
    """Best-effort map a free-form channel-issue ``detail`` onto a typed kind.

    Round 95 — centralises the substring-to-typed-kind mapping so the raise
    sites at :func:`_build_strategy_execution_preview_from_state` can auto-
    classify the existing ``get_public_execution_channel_issue`` /
    ``get_private_execution_channel_issue`` strings without each call-site
    re-probing.  Returns ``None`` when no hint matches, so downstream helpers
    can fall through to their legacy substring dispatch.
    """

    if not detail:
        return None
    if "尚未启用" in detail or "未启用" in detail:
        return CHANNEL_ISSUE_KIND_DISABLED
    if "尚未完成鉴权" in detail or "鉴权" in detail:
        return CHANNEL_ISSUE_KIND_AUTH
    if "尚未收到" in detail:
        return CHANNEL_ISSUE_KIND_NO_FEED
    if "超过约" in detail or "持续刷新" in detail:
        return CHANNEL_ISSUE_KIND_STALE
    if "未连通" in detail:
        return CHANNEL_ISSUE_KIND_DISCONNECTED
    return None


class StrategyExecutionChannelOutageError(RuntimeError):
    block_code: str = RISK_REASON_RUNTIME_UNAVAILABLE

    def __init__(
        self,
        detail: str,
        *,
        channel: Optional[str] = None,
        issue_kind: Optional[str] = None,
    ) -> None:
        super().__init__(detail)
        self.detail = detail
        self.channel = channel
        self.sub_block_code = _CHANNEL_SUB_BLOCK_CODE.get(channel) if channel else None
        # Round 95 — typed issue-kind discriminator so downstream dispatch can
        # pick the "no_feed" / "stale" / "auth" recovery copy without probing
        # ``detail`` for Chinese substrings.  Auto-classify from ``detail`` when
        # the caller does not pass an explicit kind.
        self.issue_kind = issue_kind if issue_kind is not None else _classify_channel_issue_kind(detail)


# Round 81 — typed ``RuntimeError`` subclass raised by
# ``_build_strategy_execution_preview_from_state`` when the current real
# position already matches the strategy's target so no new order needs to be
# submitted.  ``_classify_auto_dispatch_outcome`` previously routed this to
# the ``auto.dispatch.noop`` verdict via an
# ``if "无需再次提交委托" in detail:`` substring probe; the subclass lets the
# classifier branch on ``isinstance(exc, StrategyExecutionNoopError)``.
# This is a "nothing to do" signal rather than a real error, so the dispatch
# loop clears auto-dispatch alerts and emits a noop audit event.  Plain
# ``RuntimeError`` instances carrying the same Chinese string still classify
# via the substring probe for callers that have not been migrated yet.
class StrategyExecutionNoopError(RuntimeError):
    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


repo = AppRepository()
openclaw = OpenClawGatewayClient()
market_data = BybitPublicMarketClient(repo.snapshot().settings.api_base_url)
private_data = BybitPrivateClient()
private_realtime = BybitPrivateRealtimeClient(private_data)
agent_worker_stop_event = threading.Event()
agent_worker_thread: Optional[threading.Thread] = None
strategy_runtime_stop_event = threading.Event()
strategy_runtime_thread: Optional[threading.Thread] = None
agent_worker_state: Dict[str, Any] = {
    "running": False,
    "active_job_id": None,
    "last_worker_event_at": None,
    "last_job_id": None,
    "last_job_status": None,
    "last_job_summary": None,
}
private_trade_cache: Dict[str, Any] = {
    "status_key": None,
    "updated_at": 0.0,
    "items": [],
}
private_order_history_cache: Dict[str, Any] = {
    "status_key": None,
    "updated_at": 0.0,
    "items": [],
}
private_order_metadata: Dict[str, Dict[str, Any]] = {}
strategy_runtime_state: Dict[str, Any] = {
    "running": False,
    "last_refresh_at": None,
    "last_error": None,
    "started_once": False,
}
STRATEGY_RUNTIME_STALE_THRESHOLD_SECONDS = 30
PUBLIC_REALTIME_STALE_THRESHOLD_SECONDS = 90
PRIVATE_REALTIME_STALE_THRESHOLD_SECONDS = 90


class BacktestCreate(BaseModel):
    strategy_id: str
    data_range: str = "2026-01-01 ~ 2026-03-29"
    timeframe: str = "1h"
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = None


class AgentJobRetryPayload(BaseModel):
    requested_by: str = "desktop_operator"


def format_usdt(value: float) -> str:
    return f"{value:,.2f} USDT"


def normalize_number(value: Any, digits: int = 4) -> str:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return "--"
    if abs(number) >= 1000:
        return f"{number:,.2f}"
    return f"{number:,.{digits}f}".rstrip("0").rstrip(".")


def serialize_decimal(value: float, digits: int = 6) -> str:
    text = f"{float(value):.{digits}f}".rstrip("0").rstrip(".")
    return text or "0"


def normalize_symbol_input(value: str) -> str:
    return value.upper().replace("/", "").replace("-", "").strip()


def coerce_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value) if value not in (None, "") else default
    except (TypeError, ValueError):
        return default


def _to_decimal(value: Any) -> Decimal:
    try:
        return Decimal(str(value if value not in (None, "") else "0"))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _is_decimal_multiple(value: Decimal, step: Decimal) -> bool:
    if step <= 0:
        return True
    try:
        return value % step == 0
    except InvalidOperation:
        return False


def _round_decimal_down_to_step(value: Decimal, step: Decimal) -> Decimal:
    if step <= 0:
        return value
    try:
        return (value / step).to_integral_value(rounding=ROUND_DOWN) * step
    except InvalidOperation:
        return value


def _round_decimal_up_to_step(value: Decimal, step: Decimal) -> Decimal:
    if step <= 0:
        return value
    try:
        return (value / step).to_integral_value(rounding=ROUND_UP) * step
    except InvalidOperation:
        return value


def _get_exchange_order_constraints(symbol: str, market: str) -> Dict[str, Decimal]:
    if not hasattr(market_data, "get_instrument_constraints"):
        return {}
    try:
        constraints = market_data.get_instrument_constraints(symbol.upper(), market)
    except RuntimeError:
        return {}
    if not isinstance(constraints, dict):
        return {}
    return {
        "qty_step": _to_decimal(constraints.get("qty_step")),
        "tick_size": _to_decimal(constraints.get("tick_size")),
        "min_order_qty": _to_decimal(constraints.get("min_order_qty")),
        "min_notional_value": _to_decimal(constraints.get("min_notional_value")),
    }


def _align_strategy_target_signed_qty_to_exchange_constraints(
    symbol: str,
    market: str,
    target_signed_qty: float,
) -> tuple[float, Optional[str]]:
    if abs(target_signed_qty) <= 1e-9:
        return target_signed_qty, None
    constraints = _get_exchange_order_constraints(symbol, market)
    qty_step = constraints.get("qty_step", Decimal("0"))
    if qty_step <= 0:
        return target_signed_qty, None

    raw_abs_decimal = _to_decimal(serialize_decimal(abs(target_signed_qty), 12))
    aligned_abs_decimal = _round_decimal_down_to_step(raw_abs_decimal, qty_step)
    aligned_abs = float(aligned_abs_decimal)
    aligned_signed_qty = 0.0 if aligned_abs <= 1e-9 else (aligned_abs if target_signed_qty > 0 else -aligned_abs)
    if abs(aligned_signed_qty - target_signed_qty) <= 1e-9:
        return target_signed_qty, None
    return (
        aligned_signed_qty,
        (
            f"当前策略目标仓位已按 Bybit 数量步长 {normalize_number(float(qty_step), 8)} "
            f"从 {normalize_number(abs(target_signed_qty), 6)} 收敛到 {normalize_number(aligned_abs, 6)}。"
        ),
    )


def _align_strategy_limit_price_to_exchange_constraints(
    symbol: str,
    market: str,
    side: Direction,
    price: float,
) -> tuple[float, Optional[str]]:
    if price <= 0:
        return price, None
    constraints = _get_exchange_order_constraints(symbol, market)
    tick_size = constraints.get("tick_size", Decimal("0"))
    if tick_size <= 0:
        return price, None

    raw_price_decimal = _to_decimal(serialize_decimal(price, 12))
    if side == Direction.BUY:
        aligned_price_decimal = _round_decimal_down_to_step(raw_price_decimal, tick_size)
        align_direction = "向下"
    else:
        aligned_price_decimal = _round_decimal_up_to_step(raw_price_decimal, tick_size)
        align_direction = "向上"
    aligned_price = float(aligned_price_decimal)
    if abs(aligned_price - price) <= 1e-9:
        return price, None
    return (
        aligned_price,
        (
            f"当前策略委托价格已按 Bybit 价格步长 {normalize_number(float(tick_size), 8)} {align_direction}收敛，"
            f"从 {normalize_number(price, 6)} 调整到 {normalize_number(aligned_price, 6)}。"
        ),
    )


def _build_balance_linked_strategy_target_warning(
    *,
    account_type: str,
    available_balance: float,
    risk_budget_label: str,
    raw_target_signed_qty: float,
    balance_linked_target_signed_qty: float,
) -> Optional[str]:
    if abs(balance_linked_target_signed_qty - raw_target_signed_qty) <= 1e-9:
        return None
    normalized_account_type = str(account_type or "UNIFIED").upper()
    return (
        f"当前策略目标仓位已按 {normalized_account_type} 账户可用余额 {format_usdt(available_balance)} "
        f"与策略 risk_budget {risk_budget_label} "
        f"从 {normalize_number(abs(raw_target_signed_qty), 6)} "
        f"收敛到 {normalize_number(abs(balance_linked_target_signed_qty), 6)}。"
    )


def _build_balance_linked_strategy_target_too_small_reason(
    *,
    available_balance: float,
    risk_budget_label: str,
    balance_budget_notional: float,
    balance_linked_target_signed_qty: float,
    minimum_order_qty: Decimal,
) -> str:
    normalized_minimum_qty = normalize_number(float(minimum_order_qty), 8)
    return (
        f"当前 Bybit 可用余额 {format_usdt(available_balance)} "
        f"在策略 risk_budget {risk_budget_label} 下仅支持约 {format_usdt(balance_budget_notional)} 的新增名义仓位，"
        f"对应策略目标仓位约 {normalize_number(abs(balance_linked_target_signed_qty), 6)}，"
        f"仍低于 Bybit 最小下单数量 {normalized_minimum_qty}，当前不会提交真实策略委托。"
    )


def _build_balance_linked_strategy_target_too_small_recommended_action(
    *,
    account_type: str,
    available_balance: float,
    risk_budget_label: str,
    risk_budget_ratio: float,
    balance_budget_notional: float,
    minimum_required_notional: float,
) -> str:
    normalized_account_type = str(account_type or "UNIFIED").upper()
    budget_shortfall = max(minimum_required_notional - balance_budget_notional, 0.0)
    required_available_balance = (
        minimum_required_notional / risk_budget_ratio if risk_budget_ratio > 1e-9 else float("inf")
    )
    available_balance_shortfall = max(required_available_balance - available_balance, 0.0)
    if budget_shortfall > 1e-9:
        if available_balance_shortfall > 1e-9:
            return (
                f"按当前策略 risk_budget {risk_budget_label}，账户可用余额还差约 {format_usdt(available_balance_shortfall)} "
                "才能达到 Bybit 最小下单门槛，"
                f"请补足 {normalized_account_type} 账户可用余额，或在确认风险后提高策略 risk_budget 后再重试。"
            )
        return (
            f"当前账户余额已足够覆盖最小下单门槛，但按策略 risk_budget {risk_budget_label} 仍差约 {format_usdt(budget_shortfall)} 的新增名义仓位，"
            "请在确认风险后提高策略 risk_budget 或目标仓位后再重试。"
        )
    return (
        f"请提高策略 risk_budget 或目标仓位，"
        f"让真实下单数量符合 {normalized_account_type} 账户当前可用余额与 Bybit 最小下单约束后再重试。"
    )


def _build_balance_linked_strategy_no_capacity_reason(
    *,
    available_balance: float,
    risk_budget_label: str,
    current_signed_qty: float,
) -> str:
    if abs(current_signed_qty) <= 1e-9:
        return (
            f"当前 Bybit 可用余额不足，当前可用 {format_usdt(available_balance)}，"
            f"按策略 risk_budget {risk_budget_label} 计算后当前策略已无可新增的真实仓位。"
        )
    return (
        f"当前 Bybit 可用余额不足，当前可用 {format_usdt(available_balance)}，"
        f"按策略 risk_budget {risk_budget_label} 计算后当前策略暂时无法继续扩大同方向真实仓位。"
    )


def _parse_percent_ratio(value: Any, default: float = 1.0) -> float:
    text = str(value if value is not None else "").strip()
    if not text:
        return max(min(default, 1.0), 0.001)
    normalized = text.replace("%", "").replace(",", "").strip()
    try:
        numeric = float(normalized)
    except (TypeError, ValueError):
        return max(min(default, 1.0), 0.001)
    if "%" in text or numeric > 1.0:
        numeric = numeric / 100.0
    return max(min(numeric, 1.0), 0.001)


def _format_percent_label(value: Any, default_ratio: float = 1.0) -> str:
    text = str(value if value is not None else "").strip()
    if text:
        return text
    return f"{normalize_number(default_ratio * 100.0, 2)}%"


def _resolve_balance_linked_strategy_reusable_abs(
    *,
    market: str,
    raw_target_signed_qty: float,
    current_signed_qty: float,
) -> float:
    if market == "perp":
        return abs(current_signed_qty)
    return abs(current_signed_qty) if current_signed_qty * raw_target_signed_qty > 0 else 0.0


def _calculate_private_perp_balance_delta_notional(
    *,
    current_qty: float,
    next_qty: float,
    price: float,
) -> float:
    if price <= 0:
        return 0.0
    return (abs(next_qty) - abs(current_qty)) * price


def _resolve_balance_linked_strategy_target_signed_qty(
    *,
    symbol: str,
    market: str,
    mode: AccountMode,
    price: float,
    raw_target_signed_qty: float,
    current_signed_qty: float,
    risk_budget: Any = None,
    released_buy_reservation: float = 0.0,
    reusable_open_order_abs: float = 0.0,
) -> Dict[str, Any]:
    resolution: Dict[str, Any] = {
        "target_signed_qty": raw_target_signed_qty,
        "preview_target_signed_qty": raw_target_signed_qty,
        "display_target_signed_qty": raw_target_signed_qty,
        "warnings": [],
        "blocked_reason": None,
        # Round 70 — resolved block reasons in this helper all map to
        # ``risk.insufficient_balance`` (either no-capacity or target-too-small
        # after balance linkage); track the typed code alongside the free-form
        # Chinese string so the preview builder can surface it verbatim.
        "block_code": None,
        "recommended_action": None,
        "sizing_risk_budget": None,
        "sizing_budget_notional": None,
        "sizing_minimum_required_notional": None,
        "sizing_available_balance_gap": None,
    }
    if mode == AccountMode.PAPER or price <= 0 or abs(raw_target_signed_qty) <= 1e-9:
        return resolution

    try:
        status, wallet_snapshot, _wallet_updated_at = load_private_wallet_snapshot()
    except RuntimeError:
        return resolution

    available_balance = float(wallet_snapshot.get("totalAvailableBalance") or 0) + max(released_buy_reservation, 0.0)
    risk_budget_ratio = _parse_percent_ratio(risk_budget, default=1.0)
    risk_budget_label = _format_percent_label(risk_budget, default_ratio=risk_budget_ratio)
    current_reusable_abs = _resolve_balance_linked_strategy_reusable_abs(
        market=market,
        raw_target_signed_qty=raw_target_signed_qty,
        current_signed_qty=current_signed_qty,
    )
    balance_budget_notional = max(available_balance, 0.0) * risk_budget_ratio
    constraints = _get_exchange_order_constraints(symbol, market)
    minimum_order_qty = max(
        constraints.get("min_order_qty", Decimal("0")),
        constraints.get("qty_step", Decimal("0")),
    )
    if minimum_order_qty <= 0:
        minimum_order_qty = Decimal("0.00000001")
    minimum_required_notional = float(minimum_order_qty) * price
    required_available_balance = (
        minimum_required_notional / risk_budget_ratio if risk_budget_ratio > 1e-9 else float("inf")
    )
    resolution["sizing_risk_budget"] = risk_budget_label
    resolution["sizing_budget_notional"] = format_usdt(balance_budget_notional)
    resolution["sizing_minimum_required_notional"] = format_usdt(minimum_required_notional)
    resolution["sizing_available_balance_gap"] = format_usdt(max(required_available_balance - available_balance, 0.0))
    balance_linked_abs = min(
        abs(raw_target_signed_qty),
        current_reusable_abs + max(reusable_open_order_abs, 0.0) + max(balance_budget_notional / price, 0.0),
    )
    balance_linked_target_signed_qty = 0.0
    if balance_linked_abs > 1e-9:
        balance_linked_target_signed_qty = balance_linked_abs if raw_target_signed_qty > 0 else -balance_linked_abs

    warning = _build_balance_linked_strategy_target_warning(
        account_type=status.account_type,
        available_balance=available_balance,
        risk_budget_label=risk_budget_label,
        raw_target_signed_qty=raw_target_signed_qty,
        balance_linked_target_signed_qty=balance_linked_target_signed_qty,
    )
    if warning is not None:
        resolution["warnings"].append(warning)

    if (
        abs(balance_linked_target_signed_qty - current_signed_qty) <= 1e-9
        and abs(raw_target_signed_qty - current_signed_qty) > 1e-9
    ):
        resolution["target_signed_qty"] = balance_linked_target_signed_qty
        resolution["preview_target_signed_qty"] = balance_linked_target_signed_qty
        resolution["display_target_signed_qty"] = balance_linked_target_signed_qty
        resolution["blocked_reason"] = _build_balance_linked_strategy_no_capacity_reason(
            available_balance=available_balance,
            risk_budget_label=risk_budget_label,
            current_signed_qty=current_signed_qty,
        )
        resolution["block_code"] = RISK_REASON_INSUFFICIENT_BALANCE
        resolution["recommended_action"] = _build_balance_linked_strategy_target_too_small_recommended_action(
            account_type=status.account_type,
            available_balance=available_balance,
            risk_budget_label=risk_budget_label,
            risk_budget_ratio=risk_budget_ratio,
            balance_budget_notional=balance_budget_notional,
            minimum_required_notional=minimum_required_notional,
        )
        return resolution

    aligned_target_signed_qty, target_adjustment_warning = _align_strategy_target_signed_qty_to_exchange_constraints(
        symbol,
        market,
        balance_linked_target_signed_qty,
    )
    if target_adjustment_warning is not None:
        resolution["warnings"].append(target_adjustment_warning)

    resolution["target_signed_qty"] = aligned_target_signed_qty
    resolution["preview_target_signed_qty"] = aligned_target_signed_qty
    resolution["display_target_signed_qty"] = aligned_target_signed_qty

    if (
        abs(aligned_target_signed_qty - current_signed_qty) <= 1e-9
        and abs(balance_linked_target_signed_qty - current_signed_qty) > 1e-9
    ):
        resolution["preview_target_signed_qty"] = balance_linked_target_signed_qty
        resolution["display_target_signed_qty"] = balance_linked_target_signed_qty
        resolution["blocked_reason"] = _build_balance_linked_strategy_target_too_small_reason(
            available_balance=available_balance,
            risk_budget_label=risk_budget_label,
            balance_budget_notional=balance_budget_notional,
            balance_linked_target_signed_qty=balance_linked_target_signed_qty,
            minimum_order_qty=minimum_order_qty,
        )
        resolution["block_code"] = RISK_REASON_INSUFFICIENT_BALANCE
        resolution["recommended_action"] = _build_balance_linked_strategy_target_too_small_recommended_action(
            account_type=status.account_type,
            available_balance=available_balance,
            risk_budget_label=risk_budget_label,
            risk_budget_ratio=risk_budget_ratio,
            balance_budget_notional=balance_budget_notional,
            minimum_required_notional=minimum_required_notional,
        )

    return resolution


def _build_private_insufficient_balance_reason(
    *,
    available_balance: float,
    required_notional: float,
    buy_order: bool,
) -> str:
    if buy_order:
        return (
            "当前 Bybit 可用余额不足，"
            f"当前可用 {format_usdt(available_balance)}，"
            f"按该价格提交本次买入约需 {format_usdt(required_notional)}。"
        )
    return (
        "当前可用保证金不足，"
        f"当前可用 {format_usdt(available_balance)}，"
        f"按该价格提交本次委托约需 {format_usdt(required_notional)}。"
    )


def _build_private_insufficient_balance_recommended_action(
    *,
    account_type: str,
    available_balance: float,
    required_notional: float,
    buy_order: bool,
) -> str:
    normalized_account_type = str(account_type or "UNIFIED").upper()
    shortfall = max(required_notional - available_balance, 0.0)
    if available_balance <= 1e-9:
        if buy_order:
            return (
                f"请先补充 {normalized_account_type} 账户可用余额，"
                f"或先把资金划转到 {normalized_account_type} 后再重试。"
            )
        return (
            f"请先补充 {normalized_account_type} 账户可用保证金，"
            "或降低委托数量后再重试。"
        )
    if buy_order:
        return (
            f"当前还差 {format_usdt(shortfall)}，"
            f"请补足 {normalized_account_type} 账户可用余额，或降低下单数量后再重试。"
        )
    return (
        f"当前还差约 {format_usdt(shortfall)} 保证金，"
        f"请补足 {normalized_account_type} 账户可用保证金，或降低委托数量后再重试。"
    )


def _build_private_spot_inventory_recommended_action(symbol: str) -> str:
    return f"请先撤销 {symbol.upper()} 相关未成交卖单，或降低卖出数量后再重试。"


def _build_exchange_constraint_recommended_action(
    violation: Optional[ExchangeConstraintViolation],
) -> Optional[str]:
    # Round 78 — the historical implementation took the free-form Chinese
    # ``blocked_reason`` string and probed it for four substrings.  The probe
    # silently missed the ``min_notional`` branch (whose copy says
    # "最小下单金额" while the probe searched for "最小名义价值") and was
    # redundant at every caller because the caller already knew it was in an
    # exchange-constraint context.  The helper now takes the typed
    # :class:`ExchangeConstraintViolation` and returns the canned copy
    # whenever a violation is present.  Keeping a single return string rather
    # than per-kind copy preserves today's wire format; a future round may
    # subdivide if UX calls for it.
    if violation is None:
        return None
    return "请按 Bybit 的最小下单量、数量步长、价格步长和最小名义价值调整参数后再重试。"


def _resolve_private_account_type_label(default: str = "Bybit") -> str:
    try:
        status = private_data.get_status()
    except Exception:
        return default
    account_type = str(getattr(status, "account_type", "") or "").upper()
    return account_type or default


def _extract_recent_transport_error(detail: Optional[str]) -> Optional[str]:
    text = str(detail or "").strip()
    if "最近错误：" not in text:
        return None
    return text.split("最近错误：", 1)[1].strip() or None


def _is_tls_or_proxy_transport_error(detail: Optional[str]) -> bool:
    text = str(detail or "").strip().lower()
    if not text:
        return False
    keywords = (
        "ssl",
        "tls",
        "_ssl.c:",
        "certificate",
        "handshake",
        "unexpected eof",
        "eof occurred in violation of protocol",
        "proxy",
        "bad gateway",
    )
    return any(keyword in text for keyword in keywords)


def _is_network_transport_error(detail: Optional[str]) -> bool:
    text = str(detail or "").strip().lower()
    if not text:
        return False
    keywords = (
        "timed out",
        "timeout",
        "network is unreachable",
        "no route to host",
        "name or service not known",
        "temporary failure in name resolution",
        "nodename nor servname",
        "connection refused",
        "connection reset",
    )
    return any(keyword in text for keyword in keywords)


def _probe_public_rest_connectivity() -> Dict[str, Optional[object]]:
    if not hasattr(market_data, "probe_rest_connectivity"):
        return {
            "reachable": None,
            "last_error": None,
            "tested_at": None,
        }
    try:
        raw_probe = market_data.probe_rest_connectivity()
    except Exception as exc:
        return {
            "reachable": False,
            "last_error": str(exc),
            "tested_at": datetime.now(timezone.utc).astimezone().isoformat(),
        }
    return {
        "reachable": raw_probe.get("reachable"),
        "last_error": raw_probe.get("last_error"),
        "tested_at": raw_probe.get("tested_at"),
    }


def _build_public_execution_channel_recommended_action(
    detail: Optional[str],
    *,
    last_error: Optional[str] = None,
    rest_reachable: Optional[bool] = None,
    issue_kind: Optional[str] = None,
) -> str:
    normalized_error = str(last_error or _extract_recent_transport_error(detail) or "").strip() or None
    if rest_reachable is True and _is_tls_or_proxy_transport_error(normalized_error):
        return (
            "Bybit REST 已可达但公共 WS 握手失败；请优先检查本机代理、VPN、防火墙或企业网关是否拦截 "
            "`wss://stream.bybit.com/v5/public/...`，并确认系统根证书或 TLS 中间盒设置。"
        )
    if rest_reachable is False:
        return "Bybit REST 与公共 WS 当前都不可达；请先检查本机出网、DNS、防火墙或代理配置。"
    if _is_tls_or_proxy_transport_error(normalized_error):
        return "请优先检查本机代理、VPN、防火墙或企业网关是否拦截 Bybit 公共 WS，并确认系统根证书或 TLS 设置。"
    if _is_network_transport_error(normalized_error):
        return "请先检查本机到 Bybit 的网络连通、DNS 与代理配置，再确认公共实时链路已恢复。"
    # Round 97 — collapse the R95 dual-path (typed-first + substring fallback)
    # into single-path typed dispatch: auto-classify from ``detail`` when no
    # explicit ``issue_kind`` is passed.  The classifier now owns all
    # detail-substring knowledge; the helper's branches consume only typed
    # kinds.  All in-tree callers either pass the typed kind explicitly (R96
    # end-to-end threading, R97 production callsites) or rely on the detail
    # strings emitted by ``execution_health`` / ``get_public_execution_channel_issue``
    # which always contain the canonical tokens the classifier recognises.
    resolved_kind = issue_kind if issue_kind is not None else _classify_channel_issue_kind(detail)
    if resolved_kind == CHANNEL_ISSUE_KIND_NO_FEED:
        return "请确认目标品种已加入 watchlist，并等待公共实时行情首帧到达后再恢复真实策略执行。"
    if resolved_kind == CHANNEL_ISSUE_KIND_STALE:
        return "请先确认目标品种公共实时行情已经重新持续刷新，再恢复真实策略执行。"
    return "先恢复 Bybit 公共实时链路并确认目标品种已经持续收到最新行情，再恢复真实策略执行。"


def _build_private_execution_channel_recommended_action(
    detail: Optional[str],
    *,
    last_error: Optional[str] = None,
    rest_reachable: Optional[bool] = None,
    issue_kind: Optional[str] = None,
) -> str:
    normalized_error = str(last_error or _extract_recent_transport_error(detail) or "").strip() or None
    if rest_reachable is True and _is_tls_or_proxy_transport_error(normalized_error):
        return (
            "Bybit 私有 REST 已可达但私有 WS 握手失败；请优先检查本机代理、VPN、防火墙或企业网关是否拦截 "
            "`wss://stream.bybit.com/v5/private`，并确认系统根证书、TLS 中间盒以及当前 Demo / Live 配置。"
        )
    if rest_reachable is False:
        return "Bybit 私有 REST 与私有 WS 当前都不可用；请先检查本机网络、代理、防火墙和 API 配置。"
    if _is_tls_or_proxy_transport_error(normalized_error):
        return "请优先检查本机代理、VPN、防火墙或企业网关是否拦截 Bybit 私有 WS，并确认系统根证书、TLS 设置和当前 Demo / Live 配置。"
    if _is_network_transport_error(normalized_error):
        return "请先检查本机到 Bybit 的网络连通、DNS 与代理配置，并确认私有实时链路已恢复。"
    # Round 97 — see the public helper above for the single-path typed-dispatch
    # rationale.  ``CHANNEL_ISSUE_KIND_AUTH`` maps to the private-WS rekey
    # copy; every other kind (STALE / DISCONNECTED / DISABLED / None) falls
    # through to the generic recovery copy (same as the historical behaviour
    # for non-auth private outages).
    resolved_kind = issue_kind if issue_kind is not None else _classify_channel_issue_kind(detail)
    if resolved_kind == CHANNEL_ISSUE_KIND_AUTH:
        return "请检查私有 API Key 权限、程序侧 Demo / Live 模式与账户配置是否一致，再恢复私有实时链路。"
    return "请先恢复 Bybit 私有实时链路，并确认程序侧 Demo / Live 模式与 API 配置一致。"


def _build_execution_preview_recommended_action(
    detail: Optional[str],
    *,
    block_code: Optional[str] = None,
    sub_block_code: Optional[str] = None,
    market: Optional[str] = None,
    issue_kind: Optional[str] = None,
) -> Optional[str]:
    """Derive a user-facing recommendation for a blocked ``ExecutionPreview``.

    Round 77 — top-level dispatch now keys off the typed ``block_code``
    (``RISK_REASON_*``) rather than substring-probing ``detail``.  When
    callers have a typed code on hand (``ExecutionPreview.block_code``,
    ``RiskDecision.reason_code``) they pass it in explicitly; otherwise the
    free-form ``detail`` is classified via
    :func:`risk_decision.derive_block_reason_code` so the probe lives in one
    place.

    Round 79 — ``market`` is now threaded through so the spot vs perp
    sub-distinction inside ``RISK_REASON_INSUFFICIENT_BALANCE`` keys off the
    already-typed ``ExecutionPreview.market`` field rather than a detail
    substring probe (previously ``"可用保证金不足"`` vs fallback).

    Round 80 — ``sub_block_code`` carries the finer-grained discriminator for
    the ``RISK_REASON_RUNTIME_UNAVAILABLE`` umbrella so the private-WS /
    public-WS / runtime-worker-thread recovery is picked off a typed code
    rather than a ``"私有 WS"`` / ``"公共 WS"`` / ``"运行线程"`` detail probe.
    Substring fallbacks remain for callers that have not been wired yet
    (audit-record paths, legacy exception strings).

    Stop-loss-guard and residual inventory-hint fallbacks that do not yet
    have a typed code remain as trailing substring probes — they fire only
    when the typed dispatch declines to produce a recommendation.
    """

    if not detail:
        return None
    # Round 80 — a typed ``sub_block_code`` is a strict discriminator and must
    # dispatch even when the caller did not pass the umbrella ``block_code``
    # (auto/manual dispatch helpers pass only ``sub_block_code`` on their way
    # through).  The three RUNTIME_UNAVAILABLE sub-codes map deterministically
    # to their recovery copy; return early before the umbrella cascade.
    if sub_block_code == RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL:
        # Round 95 — auto-classify the typed ``issue_kind`` from ``detail`` and
        # forward to the recommender so "auth" vs "disconnected" / "stale"
        # private-WS outages pick the typed AUTH copy via the typed-first
        # branch rather than the legacy ``"鉴权"`` substring fallback.
        # Round 96 — prefer the explicitly-passed ``issue_kind`` (threaded from
        # ``StrategyExecutionChannelOutageError.issue_kind`` end-to-end); fall
        # back to auto-classification for callers that only have ``detail``.
        resolved_kind = issue_kind if issue_kind is not None else _classify_channel_issue_kind(detail)
        return _build_private_execution_channel_recommended_action(
            detail,
            issue_kind=resolved_kind,
        )
    if sub_block_code == RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL:
        # Round 95 — see the private branch above; the public recommender uses
        # the typed ``NO_FEED`` / ``STALE`` kinds to pick the watchlist /
        # refresh-feed copy before the legacy ``"尚未收到"`` / ``"超过约"`` /
        # ``"持续刷新"`` substring fallback.
        # Round 96 — same end-to-end-threading note as the private branch above.
        resolved_kind = issue_kind if issue_kind is not None else _classify_channel_issue_kind(detail)
        return _build_public_execution_channel_recommended_action(
            detail,
            issue_kind=resolved_kind,
        )
    if sub_block_code == RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD:
        return "打开设置页点击“恢复运行线程”，并确认最近审计日志与最新信号。"
    resolved_code = block_code or derive_block_reason_code(detail)
    if resolved_code == RISK_REASON_INSUFFICIENT_BALANCE:
        account_type = _resolve_private_account_type_label()
        # Round 87 — the ``"可用保证金不足"`` / ``"保证金不足"`` substring
        # fallback (R79) has been removed: every in-tree emitter of an
        # INSUFFICIENT_BALANCE preview / alert threads ``market`` through
        # end-to-end (``_build_blocked_strategy_execution_preview`` /
        # ``_decorate_strategy_runtime_item`` /
        # ``_resolve_auto_dispatch_top_issue_recommended_action`` /
        # ``_record_strategy_{auto_dispatch,manual_execution}_issue``), and
        # the record-helper callers that don't forward ``market`` pre-compute
        # the recommendation via ``preview.recommended_action`` (so the
        # fallback branch never runs).  ``market=None`` now deterministically
        # resolves to the spot available-balance copy rather than probing the
        # Chinese detail for a perp hint.
        if market == "perp":
            return f"请先补充 {account_type} 账户可用保证金，或降低委托数量后再重试。"
        return f"请先补充 {account_type} 账户可用余额，或先把资金划转到 {account_type} 后再重试。"
    if resolved_code == RISK_REASON_INSUFFICIENT_INVENTORY:
        return "请先撤销相关未成交卖单，或降低卖出数量后再重试。"
    if resolved_code == RISK_REASON_EXCHANGE_CONSTRAINT:
        # Round 78 — the typed EXCHANGE_CONSTRAINT branch no longer needs to
        # round-trip through ``_build_exchange_constraint_recommended_action``
        # because the only reason that helper exists is to attach the canned
        # copy at preview-builder source when a typed violation is in scope.
        # Here at the R77 post-hoc path we only have the detail string, so
        # emit the canned copy directly — matching the helper's behaviour
        # without re-parsing the detail.
        return "请按 Bybit 的最小下单量、数量步长、价格步长和最小名义价值调整参数后再重试。"
    if resolved_code == RISK_REASON_RUNTIME_UNAVAILABLE:
        # Round 88 — the ``"私有 WS"`` / ``"公共 WS"`` / ``"运行线程"``
        # substring fallback (R80) has been removed.  The typed sub-dispatch
        # at the top of the function already picks off the three recovery
        # copies via :data:`RISK_REASON_RUNTIME_UNAVAILABLE_*` sub-codes, and
        # every in-tree caller now threads ``sub_block_code`` through:
        # preview-builder raise sites (``StrategyExecutionChannelOutageError``
        # with ``channel=`` R74/R80), blocked-preview builders
        # (``_build_blocked_strategy_execution_preview`` / the runtime-worker
        # paths at main.py:3356 / 9225 / 9270), and the record helpers
        # (R84 + R88 ``_derive_sub_block_code_from_detail`` auto-classifier).
        # Callers that land in this branch without ``sub_block_code`` are
        # either externally-built audit strings or intentional umbrella
        # blocks with no sub-classification available; returning ``None`` lets
        # the caller's ``or item.next_action`` / ``or fallback_action``
        # short-circuit cover them without a fresh substring probe here.
        return None
    # Round 82 — typed stop-loss-guard dispatch.  ``_build_strategy_execution_preview_from_state``
    # tags the stop-loss-guard block with ``RISK_REASON_STOP_LOSS_GUARD`` at
    # source and ``derive_block_reason_code`` classifies legacy ``"止损保护"``
    # detail strings (e.g. from older audit payloads) onto the same code.
    if resolved_code == RISK_REASON_STOP_LOSS_GUARD:
        return "请先人工复核真实仓位与策略参数，确认无误后再恢复策略执行。"
    # Round 83 — the residual ``未成交卖单 + 可卖`` defensive probe was
    # removed.  All in-tree producers of spot-sell-inventory blocks emit the
    # canonical ``"现货可卖数量不足"`` token AND set
    # :data:`RISK_REASON_INSUFFICIENT_INVENTORY` at source, so the typed
    # branch above always fires before any free-form string probe could.
    # ``derive_block_reason_code`` still classifies legacy / externally-built
    # previews carrying only the canonical token, so unconverted callers
    # remain covered without a second probe here.
    return None


def _build_auto_dispatch_recommended_action(
    detail: Optional[str],
    fallback_action: Optional[str] = None,
    *,
    market: Optional[str] = None,
    sub_block_code: Optional[str] = None,
) -> str:
    # Round 79 — ``market`` threads the typed discriminator through to the
    # INSUFFICIENT_BALANCE sub-dispatch so spot vs perp copy comes from the
    # preview's typed field rather than a detail substring probe.
    # Round 80 — ``sub_block_code`` threads the typed RUNTIME_UNAVAILABLE
    # sub-discriminator (public/private channel, worker thread) through
    # so channel-outage copy comes from the typed field rather than the
    # ``"私有 WS"`` / ``"公共 WS"`` / ``"运行线程"`` detail probe.
    inferred_action = _build_execution_preview_recommended_action(
        detail, sub_block_code=sub_block_code, market=market
    )
    if inferred_action is not None:
        return inferred_action
    return fallback_action or "切到策略页查看执行预检与当前委托，必要时进入人工接管。"


def _build_manual_execution_recommended_action(
    detail: Optional[str],
    fallback_action: Optional[str] = None,
    *,
    market: Optional[str] = None,
    sub_block_code: Optional[str] = None,
) -> str:
    # Round 79 — ``market`` threads the typed discriminator through to the
    # INSUFFICIENT_BALANCE sub-dispatch so spot vs perp copy comes from the
    # preview's typed field rather than a detail substring probe.
    # Round 80 — ``sub_block_code`` threads the typed RUNTIME_UNAVAILABLE
    # sub-discriminator (public/private channel, worker thread) through
    # so channel-outage copy comes from the typed field rather than the
    # ``"私有 WS"`` / ``"公共 WS"`` / ``"运行线程"`` detail probe.
    inferred_action = _build_execution_preview_recommended_action(
        detail, sub_block_code=sub_block_code, market=market
    )
    if inferred_action is not None:
        return inferred_action
    return fallback_action or "先查看策略页执行预检、当前仓位与委托状态；必要时恢复运行线程或调整模式后再重试。"


def _format_runtime_error_detail(exc: RuntimeError) -> str:
    detail = str(exc)
    recommended_action = exc.recommended_action if isinstance(exc, StrategyExecutionBlockedError) else None
    if recommended_action and f"建议 {recommended_action}" not in detail:
        return f"{detail} 建议 {recommended_action}"
    return detail


def infer_signal(change_24h: float) -> str:
    magnitude = abs(change_24h)
    if magnitude >= 3.0:
        return "active"
    if magnitude >= 1.2:
        return "watch"
    return "neutral"


def infer_risk_level(market: str, change_24h: float) -> str:
    magnitude = abs(change_24h)
    if market == "perp" and magnitude >= 3.0:
        return "high"
    if magnitude >= 1.5:
        return "medium"
    return "low"


def parse_percent_value(value: Any) -> Optional[float]:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace("%", "").replace(",", "").replace("+", "").strip())
    except (TypeError, ValueError):
        return None


def timestamp_ms_to_iso(value: Any) -> str:
    try:
        return datetime.fromtimestamp(int(str(value)) / 1000, tz=timezone.utc).astimezone().isoformat()
    except (TypeError, ValueError):
        return private_data.get_status().updated_at


def parse_metric_number(value: Any) -> float:
    if value in (None, ""):
        return 0.0
    normalized = (
        str(value)
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


def prometheus_label_value(value: object) -> str:
    return (
        str(value if value is not None else "")
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace('"', '\\"')
    )


def prometheus_labels(**labels: object) -> str:
    return ",".join(
        f'{key}="{prometheus_label_value(raw_value)}"' for key, raw_value in labels.items()
    )


def resolve_private_mode_access(mode: AccountMode) -> tuple[BybitPrivateStatus, Optional[str]]:
    status = private_data.get_status()
    if mode == AccountMode.PAPER:
        return status, None
    if not status.can_query_private:
        return status, "当前未检测到 Bybit 私有 API 配置，无法提交真实委托。"
    if status.mode != mode:
        return (
            status,
            f"当前私有 API 指向 {status.mode.value.upper()} 模式，和当前 {mode.value.upper()} 不一致，请切换程序侧 API 域名后再试。",
        )
    return status, None


def _public_channel_for_market(market: str) -> str:
    return _public_channel_for_market_impl(market)


def _resolve_strategy_primary_market(state: Any, strategy: Any) -> str:
    symbol = strategy.symbols[0] if getattr(strategy, "symbols", None) else None
    runtime_snapshot = next(
        (item for item in state.strategy_runtime_snapshots if item.strategy_id == strategy.id),
        None,
    )
    if runtime_snapshot is not None:
        return runtime_snapshot.market
    watch_item = next((item for item in state.watchlist if item.symbol == symbol), None)
    if watch_item is not None:
        return watch_item.market
    detail = state.market_details.get(symbol) if symbol else None
    if detail is not None:
        return detail.market
    return "perp"


def _build_public_realtime_health() -> Dict[str, Any]:
    realtime = getattr(market_data, "realtime", None)
    if realtime is None or not hasattr(realtime, "get_status"):
        return {
            "enabled": False,
            "connected_spot": False,
            "connected_linear": False,
            "spot_stale": False,
            "spot_stale_seconds": 0,
            "linear_stale": False,
            "linear_stale_seconds": 0,
            "last_message_at_spot": None,
            "last_message_at_linear": None,
            "last_message_at": None,
            "last_error": None,
        }

    realtime_status = realtime.get_status()
    next_status: Dict[str, Any] = {**realtime_status}
    for channel in ("spot", "linear"):
        raw_last_message_at = realtime_status.get(f"last_message_at_{channel}") or realtime_status.get("last_message_at")
        stale_seconds = 0
        stale = False
        if raw_last_message_at:
            try:
                last_message_at = datetime.fromisoformat(str(raw_last_message_at))
                stale_seconds = max(
                    int((datetime.now(timezone.utc).astimezone() - last_message_at).total_seconds()),
                    0,
                )
                stale = bool(realtime_status.get(f"connected_{channel}")) and (
                    stale_seconds >= PUBLIC_REALTIME_STALE_THRESHOLD_SECONDS
                )
            except ValueError:
                stale_seconds = 0
                stale = False
        elif bool(realtime_status.get(f"connected_{channel}")):
            stale = True
            stale_seconds = PUBLIC_REALTIME_STALE_THRESHOLD_SECONDS
        next_status[f"{channel}_stale"] = stale
        next_status[f"{channel}_stale_seconds"] = stale_seconds
    return next_status


def _build_public_execution_channel_health(
    market: str,
    symbol: str,
    *,
    rest_probe: Optional[Dict[str, Optional[object]]] = None,
) -> Dict[str, Any]:
    return _build_public_execution_channel_health_impl(
        market,
        symbol,
        realtime=getattr(market_data, "realtime", None),
        realtime_status_builder=_build_public_realtime_health,
        rest_probe_fn=_probe_public_rest_connectivity,
        recommended_action_builder=_build_public_execution_channel_recommended_action,
        stale_threshold_seconds=PUBLIC_REALTIME_STALE_THRESHOLD_SECONDS,
        rest_probe=rest_probe,
    )


def get_public_execution_channel_issue(market: str, symbol: str) -> Optional[str]:
    return _get_public_execution_channel_issue_impl(
        market,
        symbol,
        build_channel_health=_build_public_execution_channel_health,
    )


def build_bybit_public_status() -> BybitPublicStatus:
    state = repo.snapshot()
    realtime_status = _build_public_realtime_health()
    rest_probe = _probe_public_rest_connectivity()
    watched_symbol_diagnostics: List[BybitPublicSymbolDiagnostic] = []
    seen: set[tuple[str, str]] = set()
    for item in state.watchlist:
        key = (item.symbol.upper(), item.market)
        if key in seen:
            continue
        seen.add(key)
        health = _build_public_execution_channel_health(item.market, item.symbol, rest_probe=rest_probe)
        watched_symbol_diagnostics.append(
            BybitPublicSymbolDiagnostic(
                symbol=item.symbol.upper(),
                market=item.market,
                channel=health["channel"],
                connected=bool(health["connected"]),
                has_symbol_feed=bool(health["has_symbol_feed"]),
                stale=bool(health["stale"]),
                stale_seconds=int(health.get("stale_seconds") or 0),
                last_message_at=health.get("last_message_at"),
                issue=health.get("issue"),
                recommended_action=health.get("recommended_action"),
            )
        )
    recommended_action = next(
        (
            item.recommended_action
            for item in watched_symbol_diagnostics
            if item.issue and item.recommended_action
        ),
        None,
    )
    return BybitPublicStatus(
        enabled=bool(realtime_status.get("enabled", True)),
        connected_spot=bool(realtime_status.get("connected_spot")),
        connected_linear=bool(realtime_status.get("connected_linear")),
        spot_stale=bool(realtime_status.get("spot_stale")),
        spot_stale_seconds=int(realtime_status.get("spot_stale_seconds") or 0),
        linear_stale=bool(realtime_status.get("linear_stale")),
        linear_stale_seconds=int(realtime_status.get("linear_stale_seconds") or 0),
        last_message_at_spot=realtime_status.get("last_message_at_spot"),
        last_message_at_linear=realtime_status.get("last_message_at_linear"),
        last_message_at=realtime_status.get("last_message_at"),
        last_error=str(realtime_status.get("last_error") or "").strip() or None,
        rest_reachable=rest_probe.get("reachable"),
        rest_last_error=str(rest_probe.get("last_error") or "").strip() or None,
        rest_tested_at=rest_probe.get("tested_at"),
        recommended_action=recommended_action,
        watched_symbol_diagnostics=watched_symbol_diagnostics,
        updated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def _build_private_realtime_health() -> Dict[str, Any]:
    ensure_private_realtime_started()
    realtime_status = private_realtime.get_status() if hasattr(private_realtime, "get_status") else {}
    raw_last_message_at = realtime_status.get("last_message_at")
    stale_seconds = 0
    stale = False
    if raw_last_message_at:
        try:
            last_message_at = datetime.fromisoformat(str(raw_last_message_at))
            stale_seconds = max(
                int((datetime.now(timezone.utc).astimezone() - last_message_at).total_seconds()),
                0,
            )
            stale = bool(realtime_status.get("connected")) and bool(realtime_status.get("authenticated")) and (
                stale_seconds >= PRIVATE_REALTIME_STALE_THRESHOLD_SECONDS
            )
        except ValueError:
            stale_seconds = 0
            stale = False
    elif bool(realtime_status.get("connected")) and bool(realtime_status.get("authenticated")):
        stale = True
        stale_seconds = PRIVATE_REALTIME_STALE_THRESHOLD_SECONDS

    return {
        **realtime_status,
        "stale": stale,
        "stale_seconds": stale_seconds,
    }


def get_private_execution_channel_issue(mode: AccountMode) -> Optional[str]:
    status, access_error = resolve_private_mode_access(mode)
    if access_error is not None:
        return access_error
    if mode == AccountMode.PAPER:
        return None
    realtime_status = _build_private_realtime_health()
    last_error = str(realtime_status.get("last_error") or "").strip() or None
    if not bool(realtime_status.get("connected")):
        issue = "当前 Bybit 私有 WS 未连通，无法安全执行真实策略委托，请先恢复私有实时链路。"
        return f"{issue} 最近错误：{last_error}" if last_error else issue
    if not bool(realtime_status.get("authenticated")):
        issue = "当前 Bybit 私有 WS 尚未完成鉴权，无法安全执行真实策略委托，请先恢复私有实时链路。"
        return f"{issue} 最近错误：{last_error}" if last_error else issue
    if bool(realtime_status.get("stale")):
        stale_seconds = int(realtime_status.get("stale_seconds") or 0)
        issue = (
            f"当前 Bybit 私有 WS 已超过约 {stale_seconds} 秒未收到更新，"
            "无法安全执行真实策略委托，请先恢复私有实时链路。"
        )
        return f"{issue} 最近错误：{last_error}" if last_error else issue
    return None


def load_private_wallet_snapshot() -> tuple[BybitPrivateStatus, Dict[str, Any], str]:
    status = private_data.get_status()
    ensure_private_realtime_started()
    wallet = private_realtime.get_wallet_snapshot() if hasattr(private_realtime, "get_wallet_snapshot") else None
    if wallet is None:
        result = private_data.fetch_wallet_balance()
        wallets = result.get("list", [])
        if not wallets:
            raise RuntimeError("Bybit 账户余额结果为空")
        wallet = _select_private_wallet_account(wallets, status.account_type)
        private_realtime.seed_wallet_snapshot(wallet)
    updated_at = get_private_runtime_updated_at(status)
    return status, wallet, updated_at


def load_private_positions_snapshot() -> tuple[BybitPrivateStatus, List[Dict[str, Any]], str]:
    status = private_data.get_status()
    ensure_private_realtime_started()
    positions = private_realtime.get_positions_snapshot() if hasattr(private_realtime, "get_positions_snapshot") else []
    if not positions:
        positions = private_data.fetch_positions()
        private_realtime.seed_positions_snapshot(positions)
    updated_at = get_private_runtime_updated_at(status)
    return status, positions, updated_at


def ensure_private_realtime_started() -> None:
    global private_realtime
    if getattr(private_realtime, "client", None) is not private_data:
        try:
            private_realtime.stop()
        except Exception:
            pass
        private_realtime = BybitPrivateRealtimeClient(private_data)
    try:
        private_realtime.ensure_started()
    except Exception:
        return None


def _build_wallet_usdt_balance_diagnostic(wallet: Dict[str, Any], account_type: str) -> BybitBalanceDiagnostic:
    coins = wallet.get("coin") if isinstance(wallet.get("coin"), list) else []
    usdt_entry = next((item for item in coins if str(item.get("coin") or "").upper() == "USDT"), None)
    if isinstance(usdt_entry, dict):
        wallet_balance = str(usdt_entry.get("walletBalance") or wallet.get("totalWalletBalance") or "0")
        transfer_balance = str(
            usdt_entry.get("transferBalance")
            or usdt_entry.get("availableToWithdraw")
            or wallet.get("totalAvailableBalance")
            or wallet_balance
        )
        available_balance = str(_wallet_coin_available_balance_value(usdt_entry) or transfer_balance or wallet_balance)
    else:
        wallet_balance = str(wallet.get("totalWalletBalance") or "0")
        transfer_balance = str(wallet.get("totalAvailableBalance") or wallet_balance)
        available_balance = transfer_balance
    return BybitBalanceDiagnostic(
        account_type=str(wallet.get("accountType") or account_type or "UNIFIED"),
        coin="USDT",
        wallet_balance=wallet_balance,
        transfer_balance=transfer_balance,
        available_balance=available_balance,
        source="wallet-balance",
        error=None,
    )


def _build_private_usdt_balance_diagnostics(status: BybitPrivateStatus) -> List[BybitBalanceDiagnostic]:
    if not status.can_query_private:
        return []
    if hasattr(private_data, "fetch_usdt_balance_diagnostics"):
        try:
            raw_diagnostics = private_data.fetch_usdt_balance_diagnostics()
        except RuntimeError as exc:
            diagnostics = [
                BybitBalanceDiagnostic(
                    account_type=status.account_type,
                    coin="USDT",
                    wallet_balance="0",
                    transfer_balance="0",
                    available_balance="0",
                    source="error",
                    error=str(exc),
                )
            ]
        else:
            diagnostics = [
                item if isinstance(item, BybitBalanceDiagnostic) else BybitBalanceDiagnostic.model_validate(item)
                for item in (raw_diagnostics or [])
            ]
        if diagnostics:
            return diagnostics
    if not hasattr(private_data, "fetch_wallet_balance"):
        return []
    try:
        _, wallet, _ = load_private_wallet_snapshot()
    except RuntimeError as exc:
        return [
            BybitBalanceDiagnostic(
                account_type=status.account_type,
                coin="USDT",
                wallet_balance="0",
                transfer_balance="0",
                available_balance="0",
                source="error",
                error=str(exc),
            )
        ]
    return [_build_wallet_usdt_balance_diagnostic(wallet, status.account_type)]


def get_private_runtime_updated_at(status: BybitPrivateStatus) -> str:
    realtime_status = private_realtime.get_status() if hasattr(private_realtime, "get_status") else {}
    return str(realtime_status.get("last_message_at") or status.updated_at)


def _select_private_wallet_account(wallets: List[Dict[str, Any]], account_type: str) -> Dict[str, Any]:
    preferred_account_type = str(account_type or "").upper()
    for wallet in wallets:
        if str(wallet.get("accountType") or "").upper() == preferred_account_type:
            return wallet
    return wallets[0]


def _wallet_coin_available_balance_value(
    coin: Dict[str, Any],
    *,
    fallback_wallet_balance: bool = True,
) -> Any:
    available_balance = coin.get("transferBalance")
    if available_balance in {None, "", "--"}:
        available_balance = coin.get("availableToWithdraw")
    if fallback_wallet_balance and available_balance in {None, "", "--"}:
        available_balance = coin.get("walletBalance")
    return available_balance


def build_account_overview_from_wallet_snapshot(
    wallet: Dict[str, Any],
    status: BybitPrivateStatus,
    *,
    positions_count: int,
    open_orders_count: int,
    updated_at: Optional[str] = None,
) -> AccountOverview:
    coins = wallet.get("coin", []) if isinstance(wallet.get("coin"), list) else []
    top_holdings: List[AccountAsset] = []
    sorted_coins = sorted(
        coins,
        key=lambda item: float(item.get("usdValue") or 0),
        reverse=True,
    )
    for coin in sorted_coins[:5]:
        wallet_balance = coin.get("walletBalance") or "0"
        usd_value = float(coin.get("usdValue") or 0)
        available_balance = _wallet_coin_available_balance_value(coin)
        if usd_value <= 0 and float(wallet_balance or 0) == 0:
            continue
        top_holdings.append(
            AccountAsset(
                coin=str(coin.get("coin") or "--"),
                wallet_balance=normalize_number(wallet_balance, 6),
                usd_value=format_usdt(usd_value),
                available_balance=normalize_number(available_balance, 6),
            )
        )

    return AccountOverview(
        source="bybit_private",
        mode=status.mode,
        account_type=str(wallet.get("accountType") or status.account_type),
        total_equity=format_usdt(float(wallet.get("totalEquity") or 0)),
        total_wallet_balance=format_usdt(float(wallet.get("totalWalletBalance") or 0)),
        total_available_balance=format_usdt(float(wallet.get("totalAvailableBalance") or 0)),
        unrealised_pnl=format_usdt(float(wallet.get("totalPerpUPL") or 0)),
        positions_count=positions_count,
        open_orders_count=open_orders_count,
        top_holdings=top_holdings,
        updated_at=updated_at or status.updated_at,
    )


def build_position_records(items: List[Dict[str, Any]], status: BybitPrivateStatus, updated_at: str) -> List[PositionRecord]:
    records: List[PositionRecord] = []
    for item in items:
        size = float(item.get("size") or 0)
        side_raw = str(item.get("side") or "").lower()
        if size == 0 or side_raw not in {"buy", "sell"}:
            continue
        category = str(item.get("category") or "linear").lower()
        records.append(
            PositionRecord(
                source="bybit_private",
                symbol=str(item.get("symbol") or "--"),
                market="perp" if category in {"linear", "inverse"} else "spot",
                side="long" if side_raw == "buy" else "short",
                size=normalize_number(item.get("size"), 6),
                avg_price=normalize_number(item.get("avgPrice"), 4),
                mark_price=normalize_number(item.get("markPrice"), 4),
                value=format_usdt(float(item.get("positionValue") or 0)),
                leverage=str(item.get("leverage") or "--"),
                unrealised_pnl=format_usdt(float(item.get("unrealisedPnl") or 0)),
                updated_at=updated_at,
            )
        )
    return records


def _wallet_coin_to_spot_symbol(coin: str) -> Optional[str]:
    normalized = str(coin or "").upper().strip()
    if not normalized or normalized == "USDT":
        return None
    return f"{normalized}USDT"


def build_spot_position_records_from_wallet_snapshot(
    wallet: Dict[str, Any],
    status: BybitPrivateStatus,
    updated_at: str,
    *,
    existing_keys: Optional[set[tuple[str, str]]] = None,
) -> List[PositionRecord]:
    records: List[PositionRecord] = []
    seen_keys = set(existing_keys or set())
    coins = wallet.get("coin") if isinstance(wallet.get("coin"), list) else []
    for coin in coins:
        symbol = _wallet_coin_to_spot_symbol(str(coin.get("coin") or ""))
        if symbol is None:
            continue
        key = (symbol, "spot")
        if key in seen_keys:
            continue
        wallet_balance = coerce_float(coin.get("walletBalance"), 0.0)
        if wallet_balance <= 1e-9:
            continue
        usd_value = coerce_float(coin.get("usdValue"), 0.0)
        mark_price = usd_value / wallet_balance if usd_value > 0 and wallet_balance > 0 else 0.0
        records.append(
            PositionRecord(
                source="bybit_private",
                symbol=symbol,
                market="spot",
                side="long",
                size=normalize_number(wallet_balance, 6),
                avg_price="--",
                mark_price=normalize_number(mark_price, 4) if mark_price > 0 else "--",
                value=format_usdt(usd_value),
                leverage="1",
                unrealised_pnl="--",
                updated_at=updated_at,
            )
        )
        seen_keys.add(key)
    return records


def build_order_records(items: List[Dict[str, Any]]) -> List[OrderRecord]:
    def resolve_order_metadata(order_id: str, order_link_id: str) -> Dict[str, Any]:
        metadata = dict(private_order_metadata.get(order_id, {}))
        if metadata:
            return metadata
        if order_link_id.startswith("strategy-"):
            metadata = {"origin": "strategy"}
            segments = order_link_id.split("-")
            if len(segments) >= 5:
                inferred_strategy_id = "-".join(segments[2:-1]).strip()
                if inferred_strategy_id:
                    metadata["strategy_id"] = inferred_strategy_id
        return metadata

    records: List[OrderRecord] = []
    for item in items:
        category = str(item.get("category") or "linear").lower()
        order_id = str(item.get("orderId") or "--")
        order_link_id = str(item.get("orderLinkId") or "")
        metadata = resolve_order_metadata(order_id, order_link_id)
        records.append(
            OrderRecord(
                source="bybit_private",
                origin=str(metadata.get("origin") or "manual"),
                strategy_id=metadata.get("strategy_id"),
                order_id=order_id,
                symbol=str(item.get("symbol") or "--"),
                market="spot" if category == "spot" else "perp",
                side=BybitPrivateClient.safe_direction(item.get("side")),
                order_type=str(item.get("orderType") or "--"),
                qty=normalize_number(item.get("qty"), 6),
                price=normalize_number(item.get("price"), 4),
                status=str(item.get("orderStatus") or "--"),
                created_at=timestamp_ms_to_iso(item.get("createdTime")),
            )
        )
    return records


def _load_private_open_order_records_for_preview() -> List[OrderRecord]:
    return _load_private_open_order_records_for_preview_impl(
        parse_open_orders=parse_open_orders,
    )


def _private_order_reserves_private_balance(item: OrderRecord) -> bool:
    if item.market == "perp":
        return True
    return item.market == "spot" and item.side == Direction.BUY


def _execution_preview_requires_reduce_only(preview: ExecutionPreview) -> bool:
    return _execution_preview_requires_reduce_only_impl(preview)


def _raw_private_order_reduce_only_enabled(raw_order: Optional[Dict[str, Any]]) -> bool:
    if not isinstance(raw_order, dict):
        return False
    value = raw_order.get("reduceOnly")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes", "y"}
    if isinstance(value, (int, float)):
        return bool(value)
    return False


def _find_private_raw_open_order(order_id: str) -> Optional[Dict[str, Any]]:
    ensure_private_realtime_started()
    raw_orders = private_realtime.get_open_orders_snapshot() if hasattr(private_realtime, "get_open_orders_snapshot") else []
    if not raw_orders:
        try:
            raw_orders = private_data.fetch_open_orders()
        except Exception:
            return None
    for item in raw_orders:
        if str(item.get("orderId") or "") == order_id:
            return item
    return None


def _private_released_order_reservation(
    open_orders: List[OrderRecord],
    *,
    symbol: str,
    market: str,
    exclude_order_id: Optional[str],
    release_order_ids: Optional[List[str]] = None,
) -> float:
    return _private_released_order_reservation_impl(
        open_orders,
        symbol=symbol,
        market=market,
        exclude_order_id=exclude_order_id,
        release_order_ids=release_order_ids,
        parse_metric_number=parse_metric_number,
        private_order_reserves_private_balance=_private_order_reserves_private_balance,
    )


def _list_strategy_private_open_orders(
    strategy_id: str,
    symbol: str,
    market: str,
) -> List[OrderRecord]:
    upper_symbol = symbol.upper()
    return [
        item
        for item in _load_private_open_order_records_for_preview()
        if item.source == "bybit_private"
        and item.origin == "strategy"
        and item.symbol == upper_symbol
        and item.market == market
        and item.strategy_id in {strategy_id, None}
    ]


def _strategy_order_release_context(open_orders: List[OrderRecord]) -> tuple[List[str], float]:
    release_order_ids: List[str] = []
    released_notional = 0.0
    for item in open_orders:
        if not _private_order_reserves_private_balance(item):
            continue
        release_order_ids.append(item.order_id)
        released_notional += parse_metric_number(item.qty) * parse_metric_number(item.price)
    return release_order_ids, released_notional


def _strategy_reusable_open_order_abs(
    open_orders: List[OrderRecord],
    *,
    raw_target_signed_qty: float,
) -> float:
    if abs(raw_target_signed_qty) <= 1e-9:
        return 0.0
    target_side = Direction.BUY if raw_target_signed_qty > 0 else Direction.SELL
    reusable_abs = 0.0
    for item in open_orders:
        if item.side != target_side:
            continue
        reusable_abs += parse_metric_number(item.qty)
    return reusable_abs


def _private_reserved_spot_sell_quantity(
    open_orders: List[OrderRecord],
    *,
    symbol: str,
    exclude_order_id: Optional[str] = None,
) -> float:
    return _private_reserved_spot_sell_quantity_impl(
        open_orders,
        symbol=symbol,
        exclude_order_id=exclude_order_id,
        parse_metric_number=parse_metric_number,
    )


def _private_released_spot_sell_reservation(
    open_orders: List[OrderRecord],
    *,
    symbol: str,
    exclude_order_id: Optional[str],
) -> float:
    if not exclude_order_id:
        return 0.0
    upper_symbol = symbol.upper()
    for item in open_orders:
        if item.order_id != exclude_order_id:
            continue
        if item.market != "spot" or item.side != Direction.SELL or item.symbol != upper_symbol:
            continue
        return parse_metric_number(item.qty)
    return 0.0


def _private_wallet_available_spot_quantity(
    wallet_snapshot: Dict[str, Any],
    *,
    symbol: str,
) -> Optional[float]:
    coins = wallet_snapshot.get("coin")
    if not isinstance(coins, list):
        return None
    base_coin = symbol.upper()
    if base_coin.endswith("USDT"):
        base_coin = base_coin[:-4]
    for item in coins:
        if str(item.get("coin") or "").upper() != base_coin:
            continue
        available = _wallet_coin_available_balance_value(item, fallback_wallet_balance=False)
        if available in {None, "", "--"}:
            return None
        return max(coerce_float(available, 0.0), 0.0)
    return None


def _validate_exchange_order_constraints(
    *,
    symbol: str,
    market: str,
    quantity: float,
    price: float,
) -> Optional[ExchangeConstraintViolation]:
    if quantity <= 0 or price <= 0:
        return None
    constraints = _get_exchange_order_constraints(symbol, market)
    if not constraints:
        return None

    qty_decimal = _to_decimal(quantity)
    price_decimal = _to_decimal(price)
    qty_step = constraints.get("qty_step", Decimal("0"))
    tick_size = constraints.get("tick_size", Decimal("0"))
    min_order_qty = constraints.get("min_order_qty", Decimal("0"))
    min_notional_value = constraints.get("min_notional_value", Decimal("0"))

    if min_order_qty > 0 and qty_decimal < min_order_qty:
        return ExchangeConstraintViolation(
            kind="min_order_qty",
            message=(
                f"当前委托数量低于 Bybit 最小下单量 {normalize_number(float(min_order_qty), 8)}，"
                "请调整数量后再提交。"
            ),
            limit_value=float(min_order_qty),
        )
    if qty_step > 0 and not _is_decimal_multiple(qty_decimal, qty_step):
        return ExchangeConstraintViolation(
            kind="qty_step",
            message=(
                f"当前委托数量不符合 Bybit 数量步长 {normalize_number(float(qty_step), 8)}，"
                "请按交易所步长调整后再提交。"
            ),
            limit_value=float(qty_step),
        )
    if tick_size > 0 and not _is_decimal_multiple(price_decimal, tick_size):
        return ExchangeConstraintViolation(
            kind="tick_size",
            message=(
                f"当前委托价格不符合 Bybit 价格步长 {normalize_number(float(tick_size), 8)}，"
                "请按交易所报价精度调整后再提交。"
            ),
            limit_value=float(tick_size),
        )
    if min_notional_value > 0 and qty_decimal * price_decimal < min_notional_value:
        return ExchangeConstraintViolation(
            kind="min_notional",
            message=(
                f"当前委托名义价值低于 Bybit 最小下单金额 {normalize_number(float(min_notional_value), 8)}，"
                "请提高价格或数量后再提交。"
            ),
            limit_value=float(min_notional_value),
        )
    return None


def build_private_status_key(status: BybitPrivateStatus) -> str:
    return f"{id(private_data)}|{status.api_base_url}|{status.key_hint}|{status.mode.value}"


def upsert_private_order_history_cache(status: BybitPrivateStatus, items: List[Dict[str, Any]]) -> None:
    status_key = build_private_status_key(status)
    ordered_items: List[Dict[str, Any]] = []
    seen_order_ids: set[str] = set()
    for item in items:
        order_id = str(item.get("orderId") or "")
        if not order_id:
            continue
        ordered_items.append(dict(item))
        seen_order_ids.add(order_id)

    if private_order_history_cache["status_key"] == status_key:
        for item in private_order_history_cache["items"]:
            order_id = str(item.get("orderId") or "")
            if not order_id or order_id in seen_order_ids:
                continue
            ordered_items.append(dict(item))

    private_order_history_cache["status_key"] = status_key
    private_order_history_cache["updated_at"] = time.time()
    private_order_history_cache["items"] = ordered_items[:120]


def remember_private_order_metadata(
    order_id: str,
    *,
    origin: str = "manual",
    strategy_id: Optional[str] = None,
    requested_by: Optional[str] = None,
    note: Optional[str] = None,
) -> None:
    private_order_metadata[order_id] = {
        "origin": origin,
        "strategy_id": strategy_id,
        "requested_by": requested_by,
        "note": note,
        "updated_at": datetime.now(timezone.utc).astimezone().isoformat(),
    }


def build_trade_records(items: List[Dict[str, Any]], status: BybitPrivateStatus) -> List[TradeRecord]:
    def resolve_trade_metadata(order_id: str, order_link_id: str) -> Dict[str, Any]:
        metadata = dict(private_order_metadata.get(order_id, {}))
        if metadata:
            return metadata
        if order_link_id.startswith("strategy-"):
            metadata = {"origin": "strategy"}
            segments = order_link_id.split("-")
            if len(segments) >= 5:
                inferred_strategy_id = "-".join(segments[2:-1]).strip()
                if inferred_strategy_id:
                    metadata["strategy_id"] = inferred_strategy_id
        return metadata

    records: List[TradeRecord] = []
    for item in items:
        exec_qty = coerce_float(item.get("execQty"), 0.0)
        exec_price = coerce_float(item.get("execPrice"), 0.0)
        if exec_qty <= 0 or exec_price <= 0:
            continue
        category = str(item.get("category") or "linear").lower()
        order_id = str(item.get("orderId") or "")
        order_link_id = str(item.get("orderLinkId") or "")
        metadata = resolve_trade_metadata(order_id, order_link_id)
        records.append(
            TradeRecord(
                id=str(item.get("execId") or item.get("orderId") or f"exec-{uuid4().hex[:8]}"),
                symbol=str(item.get("symbol") or "--"),
                market="spot" if category == "spot" else "perp",
                mode=status.mode,
                origin=str(metadata.get("origin") or "exchange"),
                side=BybitPrivateClient.safe_direction(item.get("side")),
                quantity=exec_qty,
                price=exec_price,
                pnl=format_usdt(coerce_float(item.get("closedPnl"), 0.0)),
                strategy_id=metadata.get("strategy_id"),
                created_at=timestamp_ms_to_iso(item.get("execTime")),
                status="filled",
            )
        )
    return records


def build_grafana_status() -> GrafanaIntegrationStatus:
    settings = repo.snapshot().settings
    configured = bool(settings.grafana_base_url and settings.grafana_dashboard_uid)
    dashboard_url = None
    if configured:
        dashboard_url = (
            f"{settings.grafana_base_url.rstrip('/')}/d/{settings.grafana_dashboard_uid}"
            f"?orgId={settings.grafana_org_id}&theme={settings.grafana_theme}&kiosk=tv"
        )

    return GrafanaIntegrationStatus(
        configured=configured,
        base_url=settings.grafana_base_url,
        dashboard_uid=settings.grafana_dashboard_uid,
        org_id=settings.grafana_org_id,
        theme=settings.grafana_theme,
        metrics_path="/metrics",
        dashboard_url=dashboard_url,
        note="Grafana 更适合服务状态、AI 调度、风控和回测吞吐监控；主 K 线继续保留本地图表。",
    )


def _build_strategy_runtime_worker_health() -> Dict[str, Any]:
    runtime_worker_running = bool(strategy_runtime_thread and strategy_runtime_thread.is_alive() and strategy_runtime_state.get("running"))
    runtime_last_refresh_at = strategy_runtime_state.get("last_refresh_at")
    runtime_last_error = strategy_runtime_state.get("last_error")
    runtime_worker_started_once = bool(strategy_runtime_state.get("started_once"))
    runtime_stale_seconds = 0
    runtime_worker_stale = False
    runtime_worker_stopped = False
    if runtime_worker_running and runtime_last_refresh_at:
        try:
            runtime_last_refresh_dt = datetime.fromisoformat(str(runtime_last_refresh_at))
            runtime_stale_seconds = max(
                int((datetime.now(timezone.utc).astimezone() - runtime_last_refresh_dt).total_seconds()),
                0,
            )
            runtime_worker_stale = runtime_stale_seconds >= STRATEGY_RUNTIME_STALE_THRESHOLD_SECONDS
        except ValueError:
            runtime_stale_seconds = 0
            runtime_worker_stale = False
    if runtime_worker_started_once and not runtime_worker_running and runtime_last_refresh_at and not runtime_last_error:
        runtime_worker_stopped = True
    runtime_worker_issue = bool(runtime_last_error or runtime_worker_stale or runtime_worker_stopped)
    return {
        "runtime_worker_running": runtime_worker_running,
        "runtime_worker_started_once": runtime_worker_started_once,
        "runtime_worker_issue": runtime_worker_issue,
        "runtime_worker_stale": runtime_worker_stale,
        "runtime_worker_stopped": runtime_worker_stopped,
        "runtime_stale_seconds": runtime_stale_seconds,
        "runtime_last_refresh_at": runtime_last_refresh_at,
        "runtime_last_error": runtime_last_error,
    }


def _find_latest_active_system_alert_by_prefix(state: Any, prefix: str) -> Optional[AlertRecord]:
    candidates = [
        alert
        for alert in state.alerts
        if alert.source_type == "system"
        and not alert.acknowledged
        and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
    ]
    if not candidates:
        return None
    candidates.sort(key=lambda item: item.triggered_at, reverse=True)
    return candidates[0]


def _build_execution_issue_strategy_context(
    state: Any,
    strategy_id: str,
    *,
    symbol: Optional[str] = None,
    detail: Optional[str] = None,
    recommended_action: Optional[str] = None,
    alert_prefix: Optional[str] = None,
) -> Dict[str, Optional[str]]:
    strategy = next((item for item in state.strategies if item.id == strategy_id), None)
    alert = _find_latest_active_system_alert_by_prefix(state, alert_prefix) if alert_prefix else None
    resolved_symbol = symbol or (alert.symbol if alert else None) or ((strategy.symbols[0]) if strategy and strategy.symbols else None)
    resolved_detail = detail or (alert.description if alert else None)
    resolved_action = recommended_action or (alert.suggested_action if alert else None)
    return {
        "top_issue_strategy_id": strategy_id,
        "top_issue_strategy_name": strategy.name if strategy else strategy_id,
        "top_issue_symbol": resolved_symbol,
        "top_issue_detail": resolved_detail,
        "top_issue_recommended_action": resolved_action,
    }


def _resolve_auto_dispatch_top_issue_recommended_action(
    state: Any,
    strategy: Any,
    alert: Optional[AlertRecord],
) -> Optional[str]:
    symbol = strategy.symbols[0] if getattr(strategy, "symbols", None) else None
    resolved_market: Optional[str] = None
    if symbol:
        resolved_market = _resolve_strategy_primary_market(state, strategy)
        (
            last_event_type,
            _last_event_at,
            _last_event_severity,
            _last_event_detail,
            last_event_recommended_action,
        ) = _build_strategy_last_execution_summary(
            strategy.id,
            symbol,
            resolved_market,
            strategy.mode,
        )
        if last_event_type == "strategy.exchange_order.auto_blocked" and last_event_recommended_action:
            return last_event_recommended_action
    if alert and alert.suggested_action:
        return alert.suggested_action
    # Round 85 — map ``alert.reason_code`` onto the typed
    # :data:`RISK_REASON_RUNTIME_UNAVAILABLE_*` sub-code so the
    # auto-dispatch fallback recommender picks the channel-outage copy off
    # the typed discriminator rather than the ``"私有 WS"`` / ``"公共 WS"``
    # detail probe inside ``_build_execution_preview_recommended_action``.
    return _build_auto_dispatch_recommended_action(
        alert.description if alert else None,
        market=resolved_market,
        sub_block_code=_resolve_alert_sub_block_code(alert),
    )


def _build_execution_health_top_issue_context(
    state: Any,
    runtime_health: Dict[str, Any],
    dynamic_auto_dispatch_blocked_contexts: Optional[List[Dict[str, Optional[str]]]] = None,
) -> Dict[str, Optional[str]]:
    return _build_execution_health_top_issue_context_impl(
        state,
        runtime_health,
        dynamic_auto_dispatch_blocked_contexts,
        account_mode_cls=AccountMode,
        has_active_strategy_live_stop_loss_alert=_has_active_strategy_live_stop_loss_alert,
        strategy_live_stop_loss_cooldown_remaining_minutes=_strategy_live_stop_loss_cooldown_remaining_minutes,
        strategy_exchange_rejection_guard_remaining_minutes=_strategy_exchange_rejection_guard_remaining_minutes,
        has_active_strategy_stale_order_alert=_has_active_strategy_stale_order_alert,
        has_active_strategy_auto_dispatch_alert=_has_active_strategy_auto_dispatch_alert,
        find_latest_active_system_alert_by_prefix=_find_latest_active_system_alert_by_prefix,
        resolve_auto_dispatch_top_issue_recommended_action=_resolve_auto_dispatch_top_issue_recommended_action,
        build_execution_issue_strategy_context=_build_execution_issue_strategy_context,
        resolve_strategy_primary_market=_resolve_strategy_primary_market,
        build_public_channel_health=_build_public_execution_channel_health,
        collect_dynamic_auto_dispatch_blocked_contexts=_collect_dynamic_auto_dispatch_blocked_contexts,
        build_strategy_active_order_summary=_build_strategy_active_order_summary,
        build_strategy_position_alignment_summary=_build_strategy_position_alignment_summary,
        get_private_execution_channel_issue=get_private_execution_channel_issue,
        build_private_execution_channel_recommended_action=_build_private_execution_channel_recommended_action,
        private_realtime=private_realtime,
    )


def _collect_dynamic_auto_dispatch_blocked_contexts(state: Any) -> List[Dict[str, Optional[str]]]:
    contexts: List[Dict[str, Optional[str]]] = []
    for strategy in state.strategies:
        if strategy.status != "running" or strategy.mode not in {AccountMode.DEMO, AccountMode.LIVE}:
            continue
        if (
            _has_active_strategy_live_stop_loss_alert(strategy.id)
            or _strategy_live_stop_loss_cooldown_remaining_minutes(strategy) is not None
            or _strategy_exchange_rejection_guard_remaining_minutes(strategy) is not None
            or _has_active_strategy_stale_order_alert(strategy.id)
            or _has_active_strategy_auto_dispatch_alert(strategy.id)
        ):
            continue
        try:
            preview = _build_strategy_execution_preview_from_state(strategy.id, strategy.mode)
        except (RuntimeError, ValueError, KeyError):
            continue
        # Round 65 — route the ``is blocked?`` decision through the typed
        # ``RiskDecision`` wrapper instead of re-reading ``preview.allowed`` /
        # ``preview.blocked_reason`` directly.  The ``not preview.blocked_reason``
        # short-circuit is preserved so defensive ``allowed=False`` + empty-reason
        # previews still get filtered out rather than surfaced with the
        # decision's default fallback detail.
        decision = evaluate_risk_decision(preview)
        if decision.verdict != "block" or not preview.blocked_reason:
            continue
        contexts.append(
            _build_execution_issue_strategy_context(
                state,
                strategy.id,
                symbol=strategy.symbols[0] if strategy.symbols else None,
                detail=decision.reason_detail,
                recommended_action=preview.recommended_action,
            )
        )
    return contexts


def _clear_strategy_runtime_worker_alerts(
    rule_key: str,
    *,
    resolved_event_type: str,
    resolution_detail: str,
) -> bool:
    changed = False
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            if str(getattr(alert, "rule_key", None) or "") != rule_key:
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type=resolved_event_type,
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={"detail": resolution_detail},
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def _sync_strategy_runtime_worker_issue_alerts() -> None:
    _sync_strategy_runtime_worker_issue_alerts_impl(
        repo=repo,
        build_strategy_runtime_worker_health=_build_strategy_runtime_worker_health,
        clear_strategy_runtime_worker_alerts=_clear_strategy_runtime_worker_alerts,
    )


def _clear_private_execution_channel_alert(
    mode: AccountMode,
    *,
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    rule_key = f"private-execution-channel:{mode.value}"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            if str(getattr(alert, "rule_key", None) or "") != rule_key:
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="private.execution.channel.resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "mode": mode.value,
                    "detail": resolution_detail or "Bybit 私有执行链路异常已解除。",
                },
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def _clear_public_execution_channel_alert(
    strategy_id: str,
    mode: AccountMode,
    *,
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    rule_key = f"public-execution-channel:{strategy_id}:{mode.value}"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            if str(getattr(alert, "rule_key", None) or "") != rule_key:
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="public.execution.channel.resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "mode": mode.value,
                    "detail": resolution_detail or "Bybit 公有执行链路异常已解除。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed


def _sync_public_execution_channel_alerts() -> None:
    _sync_public_execution_channel_alerts_impl(
        repo=repo,
        resolve_strategy_primary_market=_resolve_strategy_primary_market,
        build_public_execution_channel_health=_build_public_execution_channel_health,
        clear_public_execution_channel_alert=_clear_public_execution_channel_alert,
        queue_strategy_issue_review_locked=_queue_strategy_issue_review_locked,
    )


def _sync_private_execution_channel_alerts() -> None:
    _sync_private_execution_channel_alerts_impl(
        repo=repo,
        get_private_execution_channel_issue=get_private_execution_channel_issue,
        clear_private_execution_channel_alert=_clear_private_execution_channel_alert,
    )


def build_prometheus_metrics() -> str:
    return _build_prometheus_metrics_impl(
        repo=repo,
        agent_worker_state=agent_worker_state,
        strategy_runtime_thread=strategy_runtime_thread,
        strategy_runtime_state=strategy_runtime_state,
        http_exception_cls=HTTPException,
        sync_strategy_runtime_worker_issue_alerts=_sync_strategy_runtime_worker_issue_alerts,
        sync_public_execution_channel_alerts=_sync_public_execution_channel_alerts,
        sync_private_execution_channel_alerts=_sync_private_execution_channel_alerts,
        build_strategy_runtime_worker_health=_build_strategy_runtime_worker_health,
        parse_account_overview=parse_account_overview,
        build_public_realtime_health=_build_public_realtime_health,
        build_private_realtime_health=_build_private_realtime_health,
        build_market_live_snapshot_payload=build_market_live_snapshot_payload,
        prometheus_labels=prometheus_labels,
        parse_metric_number=parse_metric_number,
        build_control_snapshot_response=_build_control_snapshot_response,
        collect_dynamic_auto_dispatch_blocked_contexts=_collect_dynamic_auto_dispatch_blocked_contexts,
        build_strategy_active_order_summary=_build_strategy_active_order_summary,
        build_strategy_position_alignment_summary=_build_strategy_position_alignment_summary,
        has_active_strategy_live_stop_loss_alert=_has_active_strategy_live_stop_loss_alert,
        strategy_live_stop_loss_cooldown_remaining_minutes=_strategy_live_stop_loss_cooldown_remaining_minutes,
        has_active_strategy_auto_dispatch_alert=_has_active_strategy_auto_dispatch_alert,
        strategy_exchange_rejection_guard_remaining_minutes=_strategy_exchange_rejection_guard_remaining_minutes,
        has_active_strategy_stale_order_alert=_has_active_strategy_stale_order_alert,
    )


def _non_empty_string(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        normalized = value.strip()
        return normalized or None
    normalized = str(value).strip()
    return normalized or None


def _non_empty_string_list(value: Any) -> List[str]:
    if not isinstance(value, list):
        return []
    items: List[str] = []
    for item in value:
        normalized = _non_empty_string(item)
        if normalized and normalized not in items:
            items.append(normalized)
    return items


def _single_or_none(items: List[str]) -> Optional[str]:
    return items[0] if len(items) == 1 else None


def _build_scheduler_command_impact_detail(payload: Dict[str, Any]) -> Optional[str]:
    return AppRepository._build_audit_event_impact_detail(payload)


def _build_latest_scheduler_command(audit_events: List[ExecutionEvent]) -> Optional[LatestSchedulerCommand]:
    event = next((item for item in audit_events if item.event_type == "scheduler.command"), None)
    if event is None:
        return None
    payload = event.payload if isinstance(event.payload, dict) else {}
    command_text = _non_empty_string(payload.get("command"))
    command = None
    if command_text:
        try:
            command = SchedulerCommandType(command_text)
        except ValueError:
            command = None
    return LatestSchedulerCommand(
        command=command,
        summary=_non_empty_string(payload.get("summary")) or f"已执行调度命令：{command_text or 'unknown'}",
        impact_detail=_build_scheduler_command_impact_detail(payload),
        job_id=_non_empty_string(payload.get("retry_job_id")) or _non_empty_string(payload.get("job_id")),
        strategy_id=_non_empty_string(payload.get("strategy_id"))
        or _single_or_none(_non_empty_string_list(payload.get("cancelled_strategy_ids"))),
        linked_review_id=_non_empty_string(payload.get("linked_review_id")) or _non_empty_string(payload.get("review_id")),
        backtest_id=_non_empty_string(payload.get("backtest_id"))
        or _single_or_none(_non_empty_string_list(payload.get("cancelled_backtest_ids"))),
        source_change_request_id=_non_empty_string(payload.get("source_change_request_id"))
        or _single_or_none(_non_empty_string_list(payload.get("cancelled_source_change_request_ids"))),
        source_backtest_id=_non_empty_string(payload.get("source_backtest_id"))
        or _single_or_none(_non_empty_string_list(payload.get("cancelled_source_backtest_ids"))),
        source_review_id=_non_empty_string(payload.get("source_review_id"))
        or _single_or_none(_non_empty_string_list(payload.get("cancelled_source_review_ids"))),
        source_proposal_id=_non_empty_string(payload.get("source_proposal_id"))
        or _single_or_none(_non_empty_string_list(payload.get("cancelled_source_proposal_ids"))),
        occurred_at=event.occurred_at,
        severity=event.severity,
    )


def _build_control_snapshot_response() -> ControlSnapshot:
    state = repo.snapshot()
    snapshot = state.control_snapshot
    runtime_health = _build_strategy_runtime_worker_health()
    dynamic_auto_dispatch_blocked_contexts = _collect_dynamic_auto_dispatch_blocked_contexts(state)
    dynamic_auto_dispatch_blocked_strategy_ids = {
        str(item.get("top_issue_strategy_id") or "") for item in dynamic_auto_dispatch_blocked_contexts if item.get("top_issue_strategy_id")
    }
    selected_mode = state.workspace_preferences.selected_mode
    strategies_by_id = {item.id: item for item in state.strategies}
    real_execution_modes: set[AccountMode] = set()
    if selected_mode in {AccountMode.DEMO, AccountMode.LIVE}:
        real_execution_modes.add(selected_mode)
    for strategy in state.strategies:
        if strategy.mode in {AccountMode.DEMO, AccountMode.LIVE} and strategy.status == "running":
            real_execution_modes.add(strategy.mode)
    public_execution_issue_detail = None
    public_execution_stale = False
    public_execution_stale_seconds = 0
    for strategy in state.strategies:
        if strategy.status != "running" or strategy.mode not in {AccountMode.DEMO, AccountMode.LIVE}:
            continue
        symbol = strategy.symbols[0] if strategy.symbols else None
        if not symbol:
            continue
        market = _resolve_strategy_primary_market(state, strategy)
        public_health = _build_public_execution_channel_health(market, symbol)
        issue = public_health.get("issue")
        if issue is None:
            continue
        public_execution_issue_detail = str(issue)
        public_execution_stale = bool(public_health.get("stale"))
        public_execution_stale_seconds = int(public_health.get("stale_seconds") or 0)
        break
    public_execution_channel_issue = public_execution_issue_detail is not None
    private_execution_issue_detail = None
    for mode in real_execution_modes:
        private_execution_issue_detail = get_private_execution_channel_issue(mode)
        if private_execution_issue_detail is not None:
            break
    private_execution_channel_issue = private_execution_issue_detail is not None
    private_realtime_health = _build_private_realtime_health() if real_execution_modes else {"stale": False, "stale_seconds": 0}
    private_execution_stale = bool(private_realtime_health.get("stale")) if private_execution_channel_issue else False
    private_execution_stale_seconds = (
        int(private_realtime_health.get("stale_seconds") or 0) if private_execution_stale else 0
    )
    runtime_worker_running = bool(runtime_health["runtime_worker_running"])
    runtime_last_refresh_at = runtime_health["runtime_last_refresh_at"]
    runtime_last_error = runtime_health["runtime_last_error"]
    runtime_stale_seconds = int(runtime_health["runtime_stale_seconds"])
    runtime_worker_stale = bool(runtime_health["runtime_worker_stale"])
    runtime_worker_stopped = bool(runtime_health["runtime_worker_stopped"])
    runtime_worker_issue = bool(runtime_health["runtime_worker_issue"])
    active_guard_count = sum(1 for strategy in state.strategies if _has_active_strategy_live_stop_loss_alert(strategy.id))
    cooldown_count = sum(
        1 for strategy in state.strategies if _strategy_live_stop_loss_cooldown_remaining_minutes(strategy) is not None
    )
    auto_dispatch_blocked_strategy_ids = {
        strategy.id for strategy in state.strategies if _has_active_strategy_auto_dispatch_alert(strategy.id)
    } | dynamic_auto_dispatch_blocked_strategy_ids
    auto_dispatch_blocked_count = len(auto_dispatch_blocked_strategy_ids)
    rejection_guard_count = sum(
        1 for strategy in state.strategies if _strategy_exchange_rejection_guard_remaining_minutes(strategy) is not None
    )
    stale_order_count = sum(1 for strategy in state.strategies if _has_active_strategy_stale_order_alert(strategy.id))
    drift_count = 0
    for runtime_snapshot in state.strategy_runtime_snapshots:
        active_order_count, _active_order = _build_strategy_active_order_summary(
            runtime_snapshot.strategy_id,
            runtime_snapshot.mode,
            runtime_snapshot.symbol,
            runtime_snapshot.market,
        )
        (
            _target_position_side,
            _target_position_size,
            position_alignment,
            _position_alignment_detail,
        ) = _build_strategy_position_alignment_summary(
            runtime_snapshot.strategy_id,
            runtime_snapshot.mode,
            runtime_snapshot.symbol,
            runtime_snapshot.market,
            active_order_count,
        )
        if position_alignment == "drifted":
            drift_count += 1
    strategy_metrics = list(snapshot.strategy_metrics)
    if len(strategy_metrics) >= 1:
        primary_delta = None
        if runtime_last_error:
            primary_delta = "运行线程异常"
        elif runtime_worker_stale:
            primary_delta = "运行线程停滞"
        elif runtime_worker_stopped:
            primary_delta = "运行线程未运行"
        elif public_execution_channel_issue:
            primary_delta = "公有链路失活" if public_execution_stale else "公有链路异常"
        elif private_execution_channel_issue:
            primary_delta = "私有链路失活" if private_execution_stale else "私有链路异常"
        elif active_guard_count:
            primary_delta = f"止损保护 {active_guard_count}"
        elif rejection_guard_count:
            primary_delta = f"连续拒单 {rejection_guard_count}"
        elif stale_order_count:
            primary_delta = f"挂单停滞 {stale_order_count}"
        elif auto_dispatch_blocked_count:
            primary_delta = f"执行受阻 {auto_dispatch_blocked_count}"
        elif drift_count:
            primary_delta = f"偏离 {drift_count}"
        elif cooldown_count:
            primary_delta = f"冷却中 {cooldown_count}"
        strategy_metrics[0] = strategy_metrics[0].model_copy(
            update={
                "delta": primary_delta,
                "tone": (
                    "critical"
                    if runtime_last_error
                    or runtime_worker_stale
                    or public_execution_channel_issue
                    or private_execution_channel_issue
                    or active_guard_count
                    or rejection_guard_count
                    or (
                        runtime_worker_stopped
                        and not stale_order_count
                        and not auto_dispatch_blocked_count
                        and not drift_count
                        and not cooldown_count
                    )
                    else ("warning" if stale_order_count or auto_dispatch_blocked_count else "positive")
                ),
            }
        )
    if len(strategy_metrics) >= 3:
        strategy_metrics[2] = strategy_metrics[2].model_copy(
            update={
                "delta": f"冷却中 {cooldown_count}" if cooldown_count else None,
                "tone": "critical" if cooldown_count else "warning",
            }
        )
    if len(strategy_metrics) >= 2:
        strategy_metrics[1] = strategy_metrics[1].model_copy(
            update={
                "delta": f"偏离 {drift_count}" if drift_count else None,
                "tone": "warning" if drift_count else strategy_metrics[1].tone,
            }
        )
    top_issue = None
    if runtime_last_error:
        top_issue = "运行线程异常"
    elif runtime_worker_stale:
        top_issue = "运行线程停滞"
    elif runtime_worker_stopped:
        top_issue = "运行线程未运行"
    elif public_execution_channel_issue:
        top_issue = "公有链路失活" if public_execution_stale else "公有链路异常"
    elif private_execution_channel_issue:
        top_issue = "私有链路失活" if private_execution_stale else "私有链路异常"
    elif active_guard_count:
        top_issue = f"止损保护 {active_guard_count}"
    elif rejection_guard_count:
        top_issue = f"连续拒单 {rejection_guard_count}"
    elif stale_order_count:
        top_issue = f"挂单停滞 {stale_order_count}"
    elif auto_dispatch_blocked_count:
        top_issue = f"执行受阻 {auto_dispatch_blocked_count}"
    elif drift_count:
        top_issue = f"仓位偏离 {drift_count}"
    elif cooldown_count:
        top_issue = f"冷却中 {cooldown_count}"
    top_issue_context = _build_execution_health_top_issue_context(
        state,
        runtime_health,
        dynamic_auto_dispatch_blocked_contexts,
    )
    execution_health = ExecutionHealthSummary(
        runtime_worker_running=runtime_worker_running,
        runtime_worker_issue=runtime_worker_issue,
        runtime_worker_stale=runtime_worker_stale,
        runtime_worker_stopped=runtime_worker_stopped,
        runtime_stale_seconds=runtime_stale_seconds,
        runtime_last_refresh_at=runtime_last_refresh_at,
        runtime_last_error=runtime_last_error,
        public_execution_channel_issue=public_execution_channel_issue,
        public_execution_stale=public_execution_stale,
        public_execution_stale_seconds=public_execution_stale_seconds,
        private_execution_channel_issue=private_execution_channel_issue,
        private_execution_stale=private_execution_stale,
        private_execution_stale_seconds=private_execution_stale_seconds,
        active_stop_loss_guards=active_guard_count,
        cooldowns=cooldown_count,
        auto_dispatch_blocked=auto_dispatch_blocked_count,
        rejection_guards=rejection_guard_count,
        stale_order_guards=stale_order_count,
        drifts=drift_count,
        top_issue=top_issue,
        top_issue_strategy_id=top_issue_context.get("top_issue_strategy_id"),
        top_issue_strategy_name=top_issue_context.get("top_issue_strategy_name"),
        top_issue_symbol=top_issue_context.get("top_issue_symbol"),
        top_issue_detail=top_issue_context.get("top_issue_detail"),
        top_issue_recommended_action=top_issue_context.get("top_issue_recommended_action"),
    )
    return snapshot.model_copy(
        update={
            "strategy_metrics": strategy_metrics,
            "execution_health": execution_health,
            "latest_scheduler_command": _build_latest_scheduler_command(state.audit_events),
        }
    )


def build_runtime_worker_status() -> RuntimeWorkerStatus:
    runtime_health = _build_strategy_runtime_worker_health()
    top_issue = None
    recommended_action = None
    if runtime_health["runtime_last_error"]:
        top_issue = "运行线程异常"
        recommended_action = "打开设置页点击“恢复运行线程”，并检查最近审计日志。"
    elif runtime_health["runtime_worker_stale"]:
        top_issue = "运行线程停滞"
        recommended_action = "打开设置页点击“恢复运行线程”，并确认行情链路与最新信号。"
    elif runtime_health.get("runtime_worker_stopped"):
        top_issue = "运行线程未运行"
        recommended_action = "打开设置页点击“恢复运行线程”，让后台自动执行链恢复。"
    elif not runtime_health["runtime_worker_running"]:
        top_issue = "运行线程未启动"
        recommended_action = "如需后台自动执行，请先恢复运行线程。"
    return RuntimeWorkerStatus(
        running=bool(runtime_health["runtime_worker_running"]),
        started_once=bool(runtime_health.get("runtime_worker_started_once")),
        issue=bool(runtime_health["runtime_worker_issue"]),
        stale=bool(runtime_health["runtime_worker_stale"]),
        stopped=bool(runtime_health.get("runtime_worker_stopped")),
        stale_seconds=int(runtime_health["runtime_stale_seconds"]),
        last_refresh_at=runtime_health["runtime_last_refresh_at"],
        last_error=runtime_health["runtime_last_error"],
        top_issue=top_issue,
        recommended_action=recommended_action,
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def _resolve_account_query_mode(mode: Optional[AccountMode]) -> AccountMode:
    return mode or repo.snapshot().workspace_preferences.selected_mode


def parse_account_overview(mode: Optional[AccountMode] = None) -> AccountOverview:
    status = private_data.get_status()
    selected_mode = _resolve_account_query_mode(mode)
    if selected_mode == AccountMode.PAPER:
        return repo.get_paper_account_overview()
    if not status.can_query_private:
        return repo.get_paper_account_overview() if selected_mode == AccountMode.PAPER else repo.get_mock_account_overview()

    ensure_private_realtime_started()
    try:
        account = private_realtime.get_wallet_snapshot() if hasattr(private_realtime, "get_wallet_snapshot") else None
        if account is None:
            result = private_data.fetch_wallet_balance()
            wallets = result.get("list", [])
            if not wallets:
                raise RuntimeError("Bybit 账户余额结果为空")
            account = _select_private_wallet_account(wallets, status.account_type)
            private_realtime.seed_wallet_snapshot(account)
        orders = parse_open_orders(use_private_only=True)
        positions = parse_positions(use_private_only=True)
        return build_account_overview_from_wallet_snapshot(
            account,
            status,
            positions_count=len(positions),
            open_orders_count=len(orders),
            updated_at=get_private_runtime_updated_at(status),
        )
    except RuntimeError:
        return repo.get_paper_account_overview() if selected_mode == AccountMode.PAPER else repo.get_mock_account_overview()


def build_watchlist_item(symbol: str, market: str) -> tuple[WatchlistInstrument, MarketDetail]:
    normalized_symbol = normalize_symbol_input(symbol)
    if not normalized_symbol.endswith("USDT"):
        raise RuntimeError("当前自选管理仅支持 Bybit 上以 USDT 计价的现货或永续品种。")

    try:
        ticker = market_data.get_ticker(normalized_symbol, market)
    except RuntimeError as exc:
        raise RuntimeError(f"无法获取 {normalized_symbol} 的公共行情，请确认品种和市场类型。") from exc

    last_price = coerce_float(ticker.get("lastPrice"), 0.0)
    change_24h = round(coerce_float(ticker.get("price24hPcnt"), 0.0) * 100, 2)
    volume_24h = coerce_float(ticker.get("turnover24h") or ticker.get("volume24h"), 0.0)

    item = WatchlistInstrument(
        symbol=normalized_symbol,
        market="spot" if market == "spot" else "perp",
        last_price=last_price,
        change_24h=change_24h,
        volume_24h=volume_24h,
        signal=infer_signal(change_24h),
        position_side="flat",
        risk_level=infer_risk_level(market, change_24h),
        alert_enabled=True,
        alert_threshold_pct=2.5,
    )
    fallback_detail = build_market_detail_for_watchlist(item)
    detail = market_data.enrich_market_detail(
        symbol=normalized_symbol,
        market=item.market,
        fallback_detail=fallback_detail,
        watch_item=item,
        timeframe=fallback_detail.timeframe,
    )
    return item, detail


def _market_fallback_timeframe_delta(timeframe: str) -> timedelta:
    normalized_timeframe = market_data.normalize_timeframe(timeframe)
    return {
        "15m": timedelta(minutes=15),
        "1h": timedelta(hours=1),
        "4h": timedelta(hours=4),
        "1d": timedelta(days=1),
    }[normalized_timeframe]


def _align_market_fallback_anchor(timeframe: str, anchor: datetime) -> datetime:
    normalized_timeframe = market_data.normalize_timeframe(timeframe)
    localized_anchor = anchor.astimezone()
    if normalized_timeframe == "15m":
        return localized_anchor.replace(minute=(localized_anchor.minute // 15) * 15, second=0, microsecond=0)
    if normalized_timeframe == "1h":
        return localized_anchor.replace(minute=0, second=0, microsecond=0)
    if normalized_timeframe == "4h":
        return localized_anchor.replace(hour=(localized_anchor.hour // 4) * 4, minute=0, second=0, microsecond=0)
    return localized_anchor.replace(hour=0, minute=0, second=0, microsecond=0)


def _retime_market_fallback_candles(
    candles: List[CandlePoint],
    timeframe: str,
    *,
    anchor_time: Optional[str] = None,
    target_last_close: Optional[float] = None,
) -> List[CandlePoint]:
    if not candles:
        return []
    aligned_anchor = _align_market_fallback_anchor(
        timeframe,
        parse_optional_iso_datetime(anchor_time) or datetime.now(timezone.utc).astimezone(),
    )
    timeframe_delta = _market_fallback_timeframe_delta(timeframe)
    range_start = aligned_anchor - timeframe_delta * (len(candles) - 1)
    retimed: List[CandlePoint] = []
    for index, candle in enumerate(candles):
        retimed.append(
            candle.model_copy(
                update={
                    "time": (range_start + timeframe_delta * index).isoformat(),
                }
            )
        )
    if target_last_close is not None and retimed:
        last_candle = retimed[-1]
        rounded_close = round(float(target_last_close), 2)
        rounded_high = round(max(last_candle.high, last_candle.open, rounded_close), 2)
        rounded_low = round(min(last_candle.low, last_candle.open, rounded_close), 2)
        retimed[-1] = last_candle.model_copy(
            update={
                "close": rounded_close,
                "high": rounded_high,
                "low": rounded_low,
            }
        )
    return retimed


def build_runtime_market_fallback_detail(
    symbol: str,
    market: str,
    timeframe: str,
    watch_item: Optional[WatchlistInstrument],
    base_detail: Optional[MarketDetail] = None,
    failure_reason: Optional[str] = None,
) -> MarketDetail:
    normalized_timeframe = market_data.normalize_timeframe(timeframe)
    real_base = base_detail if base_detail and base_detail.source in {"bybit_rest", "bybit_ws"} else None
    same_timeframe_base = (
        real_base is not None and market_data.normalize_timeframe(real_base.timeframe) == normalized_timeframe
    )
    seed_detail = build_market_detail_for_watchlist(watch_item) if watch_item is not None else None
    fallback_candles: List[CandlePoint] = []
    if real_base is not None and real_base.candles:
        fallback_candles = (
            list(real_base.candles)
            if same_timeframe_base
            else _retime_market_fallback_candles(
                list(real_base.candles),
                normalized_timeframe,
                anchor_time=real_base.updated_at or real_base.candles[-1].time,
                target_last_close=watch_item.last_price if watch_item is not None else None,
            )
        )
    elif seed_detail is not None and seed_detail.candles:
        fallback_candles = _retime_market_fallback_candles(
            list(seed_detail.candles),
            normalized_timeframe,
            anchor_time=seed_detail.updated_at or seed_detail.candles[-1].time,
            target_last_close=watch_item.last_price if watch_item is not None else None,
        )
    stats: Dict[str, str] = {}
    if real_base is not None:
        stats.update(real_base.stats)
        stats["数据源"] = "Bybit 本地缓存" if same_timeframe_base else "Fallback K 线 + Bybit 本地缓存盘口"
    elif seed_detail is not None:
        stats.update(seed_detail.stats)
        stats["数据源"] = "Fallback K 线"
    elif watch_item is not None:
        stats.update(
            {
                "数据源": "Fallback K 线",
                "24h涨跌": f"{watch_item.change_24h:+.2f}%",
                "24h成交额": f"{watch_item.volume_24h:,.0f}",
            }
        )
    else:
        stats["数据源"] = "Fallback K 线"
    if failure_reason:
        stats["拉取状态"] = "等待下一次重试"

    if fallback_candles:
        if real_base is not None and same_timeframe_base:
            headline = f"{symbol} 当前未拿到最新 K 线，已保留最近一次成功快照。"
        else:
            headline = f"{symbol} 当前未拿到 Bybit 最新 {normalized_timeframe} K 线，已回退到本地基线继续展示。"
    else:
        headline = f"{symbol} 当前未拿到 Bybit 最新 K 线，请稍后自动重试。"

    return MarketDetail(
        symbol=symbol,
        market="spot" if market == "spot" else "perp",
        timeframe=normalized_timeframe,
        candles=fallback_candles,
        bids=list(real_base.bids) if real_base is not None else [],
        asks=list(real_base.asks) if real_base is not None else [],
        recent_public_trades=(
            list(real_base.recent_public_trades)
            if real_base is not None
            else list(seed_detail.recent_public_trades)
            if seed_detail is not None
            else []
        ),
        headline=headline,
        stats=stats,
        source=real_base.source if real_base is not None and same_timeframe_base else "fallback",
        updated_at=real_base.updated_at if real_base is not None else seed_detail.updated_at if seed_detail is not None else None,
    )


def build_backtest_payload(strategy: Any, data_range: str, timeframe: str) -> Optional[Dict[str, Any]]:
    if run_local_backtest is None:
        return None
    symbol = strategy.symbols[0] if getattr(strategy, "symbols", None) else None
    if not symbol:
        return None
    state = repo.snapshot()
    market = _resolve_strategy_primary_market(state, strategy)
    requested_range_start, requested_range_end = resolve_data_range_bounds(data_range)
    requested_candle_estimate = estimate_candle_count_for_range(data_range, timeframe)
    limit = candle_limit_for_range(data_range, timeframe)
    candles = []
    history_source = "exchange_history"
    history_source_reason = "none"
    history_source_detail: Optional[str] = None
    history_source_recommended_data_range: Optional[str] = None
    history_source_recommended_timeframe: Optional[str] = None
    history_source_recommended_action: Optional[str] = None
    try:
        if hasattr(market_data, "get_candles_history"):
            candles = market_data.get_candles_history(symbol, market, timeframe=timeframe, limit=limit)
        elif hasattr(market_data, "get_candles_cached"):
            candles = market_data.get_candles_cached(symbol, market, timeframe=timeframe, limit=limit)
        else:
            interval = {
                "15m": "15",
                "1h": "60",
                "4h": "240",
                "1d": "D",
            }.get(str(timeframe).lower(), "60")
            candles = market_data.get_candles(symbol, market, interval=interval, limit=limit)
    except RuntimeError as exc:
        fallback_detail = state.market_details.get(symbol)
        candles = list(fallback_detail.candles if fallback_detail else [])
        if candles:
            history_source = "market_detail_fallback"
            history_source_reason = "exchange_fetch_failed"
            history_source_detail = str(exc)
    if len(candles) < 30:
        exchange_sample_count = len(candles)
        fallback_detail = state.market_details.get(symbol)
        if fallback_detail:
            candles = list(fallback_detail.candles)
            if candles:
                history_source = "market_detail_fallback"
                if history_source_reason == "none":
                    history_source_reason = "insufficient_exchange_samples"
                    history_source_detail = (
                        f"交易所历史仅返回 {exchange_sample_count} 根样本，低于最小回测门槛 30 根。"
                    )
    if len(candles) < 30:
        return None
    computation = run_local_backtest(strategy, candles, timeframe, data_range)
    if history_source == "market_detail_fallback":
        history_source_plan = _resolve_history_source_recommendation(
            {
                "data_range": data_range,
                "timeframe": timeframe,
                "history_source": history_source,
                "history_source_reason": history_source_reason,
            }
        )
        history_source_recommended_data_range = history_source_plan["data_range"]
        history_source_recommended_timeframe = history_source_plan["timeframe"]
        history_source_recommended_action = history_source_plan["recommended_action"]
    history_target = min(requested_candle_estimate, limit)
    history_gap_reason = "none"
    if computation.history_truncated or requested_candle_estimate > limit:
        history_gap_reason = "sample_cap"
    elif history_target > 0 and computation.retrieved_candle_count < history_target:
        history_gap_reason = "insufficient_history"
    history_truncated = bool(
        computation.history_truncated
        or requested_candle_estimate > limit
        or (history_target > 0 and computation.retrieved_candle_count < history_target)
    )
    retrieved_window_completion_pct = 0.0
    used_window_completion_pct = 0.0
    if requested_candle_estimate > 0:
        retrieved_window_completion_pct = round(
            min(max(computation.retrieved_candle_count / requested_candle_estimate * 100.0, 0.0), 100.0),
            2,
        )
        used_window_completion_pct = round(
            min(max(computation.used_candle_count / requested_candle_estimate * 100.0, 0.0), 100.0),
            2,
        )
    full_window_recommended_data_range: Optional[str] = None
    full_window_recommended_timeframe: Optional[str] = None
    full_window_recommended_action: Optional[str] = None
    if history_truncated:
        if history_gap_reason == "insufficient_history":
            full_window_recommended_data_range = _build_available_history_data_range_from_bounds(
                computation.retrieved_range_start,
                computation.retrieved_range_end,
                timeframe,
            )
            full_window_recommended_timeframe = timeframe
            if full_window_recommended_data_range:
                full_window_recommended_action = (
                    f"当前交易所可用历史仅覆盖 {full_window_recommended_data_range}，"
                    f"建议先缩短到该可用区间并保持 {timeframe} 重新回测。"
                )
        else:
            full_window_plan = _build_full_window_backtest_plan(data_range, timeframe)
            recommended_payload = full_window_plan["payload"]
            full_window_recommended_data_range = str(recommended_payload.get("data_range") or data_range)
            full_window_recommended_timeframe = str(recommended_payload.get("timeframe") or timeframe)
            if full_window_plan["can_cover_full_window"]:
                full_window_recommended_action = (
                    f"保持当前区间，切换到 {full_window_recommended_timeframe} 补足完整样本窗口。"
                )
            else:
                full_window_recommended_action = (
                    f"当前区间即使切到最粗周期也无法完整覆盖，建议先缩短到 {full_window_recommended_data_range}，"
                    f"并使用 {full_window_recommended_timeframe} 重新回测。"
                )
    notes = computation.notes
    if history_gap_reason == "sample_cap" and requested_candle_estimate > limit:
        notes += (
            f" 按当前回测样本上限，本次目标区间理论需要约 {requested_candle_estimate} 根 K 线，"
            f"当前最多仅能覆盖最近 {limit} 根样本。"
        )
    elif history_gap_reason == "insufficient_history":
        notes += (
            f" 本次目标区间理论需要约 {requested_candle_estimate} 根 K 线，"
            f"当前计划覆盖 {history_target} 根，但交易所实际仅返回 {computation.retrieved_candle_count} 根样本。"
        )
    else:
        notes = computation.notes
    if history_source == "market_detail_fallback":
        notes += " 当前交易所历史 K 线不可直接用于本次回测，已回退到工作台行情快照样本，仅供研究参考。"
        if history_source_detail:
            notes += f" 回退原因：{history_source_detail}"
        if history_source_recommended_action:
            notes += f" 建议动作：{history_source_recommended_action}"
    decision_context = {
        "data_range": data_range,
        "timeframe": timeframe,
        "metrics": computation.metrics.model_dump(mode="json"),
        "reference_only": computation.reference_only,
        "sample_quality": computation.sample_quality,
        "history_source": history_source,
        "history_source_reason": history_source_reason,
        "history_source_detail": history_source_detail,
        "history_source_recommended_data_range": history_source_recommended_data_range,
        "history_source_recommended_timeframe": history_source_recommended_timeframe,
        "history_source_recommended_action": history_source_recommended_action,
        "history_truncated": history_truncated,
        "history_gap_reason": history_gap_reason,
        "full_window_recommended_data_range": full_window_recommended_data_range,
        "full_window_recommended_timeframe": full_window_recommended_timeframe,
        "full_window_recommended_action": full_window_recommended_action,
        "requested_candle_estimate": requested_candle_estimate,
        "requested_candle_limit": limit,
    }
    decision_readiness = _resolve_backtest_decision_readiness(decision_context)
    return {
        "metrics": computation.metrics,
        "reference_only": computation.reference_only,
        "sample_quality": computation.sample_quality,
        "history_source": history_source,
        "history_source_reason": history_source_reason,
        "history_source_detail": history_source_detail,
        "history_source_recommended_data_range": history_source_recommended_data_range,
        "history_source_recommended_timeframe": history_source_recommended_timeframe,
        "history_source_recommended_action": history_source_recommended_action,
        "decision_readiness": decision_readiness["decision_readiness"],
        "decision_readiness_detail": decision_readiness["decision_readiness_detail"],
        "decision_recommended_data_range": decision_readiness["decision_recommended_data_range"],
        "decision_recommended_timeframe": decision_readiness["decision_recommended_timeframe"],
        "decision_readiness_action": decision_readiness["decision_readiness_action"],
        "requested_candle_estimate": requested_candle_estimate,
        "requested_candle_limit": limit,
        "requested_range_start": requested_range_start,
        "requested_range_end": requested_range_end,
        "retrieved_window_completion_pct": retrieved_window_completion_pct,
        "used_window_completion_pct": used_window_completion_pct,
        "retrieved_candle_count": computation.retrieved_candle_count,
        "used_candle_count": computation.used_candle_count,
        "retrieved_range_start": computation.retrieved_range_start,
        "retrieved_range_end": computation.retrieved_range_end,
        "used_range_start": computation.used_range_start,
        "used_range_end": computation.used_range_end,
        "history_truncated": history_truncated,
        "history_gap_reason": history_gap_reason,
        "full_window_recommended_data_range": full_window_recommended_data_range,
        "full_window_recommended_timeframe": full_window_recommended_timeframe,
        "full_window_recommended_action": full_window_recommended_action,
        "notes": notes,
        "parameter_snapshot": computation.parameter_snapshot,
        "symbol_scope": computation.symbol_scope,
        "data_granularity": computation.data_granularity,
        "volatility_stats": (
            dataclasses.asdict(computation.volatility_stats)
            if computation.volatility_stats is not None
            else None
        ),
        "risk_ratios": (
            dataclasses.asdict(computation.risk_ratios)
            if computation.risk_ratios is not None
            else None
        ),
        "trade_rhythm_stats": (
            dataclasses.asdict(computation.trade_rhythm_stats)
            if computation.trade_rhythm_stats is not None
            else None
        ),
        "benchmark_stats": (
            dataclasses.asdict(computation.benchmark_stats)
            if computation.benchmark_stats is not None
            else None
        ),
        "exposure_stats": (
            dataclasses.asdict(computation.exposure_stats)
            if computation.exposure_stats is not None
            else None
        ),
        "tail_risk_stats": (
            dataclasses.asdict(computation.tail_risk_stats)
            if computation.tail_risk_stats is not None
            else None
        ),
        "order_flow_stats": (
            dataclasses.asdict(computation.order_flow_stats)
            if computation.order_flow_stats is not None
            else None
        ),
        "trades": [
            dataclasses.asdict(trade)
            for trade in computation.trades[:BACKTEST_RUN_TRADE_SERIALIZATION_CAP]
        ],
    }


def parse_positions(use_private_only: bool = False, mode: Optional[AccountMode] = None) -> List[PositionRecord]:
    status = private_data.get_status()
    selected_mode = _resolve_account_query_mode(mode)
    if selected_mode == AccountMode.PAPER and not use_private_only:
        return [] if use_private_only else repo.get_paper_positions()
    if not status.can_query_private:
        if use_private_only:
            return []
        return repo.get_paper_positions() if selected_mode == AccountMode.PAPER else repo.get_mock_positions()

    ensure_private_realtime_started()
    try:
        positions = private_realtime.get_positions_snapshot() if hasattr(private_realtime, "get_positions_snapshot") else []
        if not positions:
            positions = private_data.fetch_positions()
            private_realtime.seed_positions_snapshot(positions)
        updated_at = get_private_runtime_updated_at(status)
        records = build_position_records(positions, status, updated_at)
        wallet_snapshot = private_realtime.get_wallet_snapshot() if hasattr(private_realtime, "get_wallet_snapshot") else None
        if wallet_snapshot is None:
            try:
                _wallet_status, wallet_snapshot, _wallet_updated_at = load_private_wallet_snapshot()
            except RuntimeError:
                wallet_snapshot = None
        if isinstance(wallet_snapshot, dict):
            records.extend(
                build_spot_position_records_from_wallet_snapshot(
                    wallet_snapshot,
                    status,
                    updated_at,
                    existing_keys={(item.symbol, item.market) for item in records},
                )
            )
        return records
    except RuntimeError:
        if use_private_only:
            return []
        return repo.get_paper_positions() if selected_mode == AccountMode.PAPER else repo.get_mock_positions()


def parse_open_orders(use_private_only: bool = False, mode: Optional[AccountMode] = None) -> List[OrderRecord]:
    status = private_data.get_status()
    selected_mode = _resolve_account_query_mode(mode)
    if selected_mode == AccountMode.PAPER and not use_private_only:
        return [] if use_private_only else repo.get_paper_orders()
    if not status.can_query_private:
        if use_private_only:
            return []
        return repo.get_paper_orders() if selected_mode == AccountMode.PAPER else repo.get_mock_orders()

    ensure_private_realtime_started()
    try:
        orders = private_realtime.get_open_orders_snapshot() if hasattr(private_realtime, "get_open_orders_snapshot") else []
        if not orders:
            orders = private_data.fetch_open_orders()
            private_realtime.seed_open_orders_snapshot(orders)
        return build_order_records(orders)
    except RuntimeError:
        if use_private_only:
            return []
        return repo.get_paper_orders() if selected_mode == AccountMode.PAPER else repo.get_mock_orders()


def parse_trades(use_private_only: bool = False) -> List[TradeRecord]:
    local_trades = repo.snapshot().trades
    status = private_data.get_status()
    if not status.can_query_private:
        return [] if use_private_only else local_trades

    ensure_private_realtime_started()
    try:
        status_key = f"{id(private_data)}|{status.api_base_url}|{status.key_hint}|{status.mode.value}"
        now_ts = time.time()
        if private_trade_cache["status_key"] == status_key and now_ts - float(private_trade_cache["updated_at"] or 0) < 5:
            records = list(private_trade_cache["items"])
        else:
            executions = private_data.fetch_execution_history()
            if executions or not private_realtime.get_execution_snapshot(limit=1):
                private_realtime.seed_execution_snapshot(executions)
            records = build_trade_records(executions, status)
            private_trade_cache["status_key"] = status_key
            private_trade_cache["updated_at"] = now_ts
            private_trade_cache["items"] = list(records)
        realtime_records = build_trade_records(
            private_realtime.get_execution_snapshot(limit=50) if hasattr(private_realtime, "get_execution_snapshot") else [],
            status,
        )
        merged = {trade.id: trade for trade in local_trades}
        for trade in records:
            merged[trade.id] = trade
        for trade in realtime_records:
            merged[trade.id] = trade
        ordered = sorted(merged.values(), key=lambda item: item.created_at, reverse=True)
        return ordered[:80]
    except RuntimeError:
        return [] if use_private_only else local_trades


def parse_order_history(
    use_private_only: bool = False,
    force_refresh: bool = False,
    mode: Optional[AccountMode] = None,
) -> List[OrderRecord]:
    status = private_data.get_status()
    selected_mode = _resolve_account_query_mode(mode)
    if selected_mode == AccountMode.PAPER and not use_private_only:
        return [] if use_private_only else repo.get_paper_order_history()
    if not status.can_query_private:
        if use_private_only:
            return []
        return repo.get_paper_order_history() if selected_mode == AccountMode.PAPER else []

    ensure_private_realtime_started()
    try:
        status_key = build_private_status_key(status)
        now_ts = time.time()
        if (
            not force_refresh
            and
            private_order_history_cache["status_key"] == status_key
            and now_ts - float(private_order_history_cache["updated_at"] or 0) < 5
        ):
            items = list(private_order_history_cache["items"])
        else:
            items = private_data.fetch_order_history()
            upsert_private_order_history_cache(status, list(items))
            items = list(private_order_history_cache["items"])
        return build_order_records(items)
    except RuntimeError:
        if use_private_only:
            return []
        return repo.get_paper_order_history() if selected_mode == AccountMode.PAPER else []


def _strategy_matches_order(order: OrderRecord, strategy_id: str, symbol: str, market: str) -> bool:
    if order.origin != "strategy":
        return False
    if order.symbol != symbol or order.market != market:
        return False
    return order.strategy_id in {strategy_id, None}


def _strategy_matches_trade(trade: TradeRecord, strategy_id: str, symbol: str, market: str) -> bool:
    if trade.origin != "strategy":
        return False
    if trade.symbol != symbol or trade.market != market:
        return False
    return trade.strategy_id in {strategy_id, None}


def _strategy_matches_alert(alert: AlertRecord, strategy_id: str, symbol: str) -> bool:
    if alert.source_type != "system":
        return False
    rule_key = str(getattr(alert, "rule_key", None) or "")
    strategy_prefixes = (
        f"strategy-auto-dispatch:{strategy_id}:",
        f"strategy-blocked-execution:{strategy_id}:",
        f"strategy-manual-execution:{strategy_id}:",
        f"strategy-position-drift:{strategy_id}:",
        f"strategy-live-stop-loss:{strategy_id}:",
        f"strategy-exchange-rejected:{strategy_id}:",
        f"strategy-exchange-rejection-guard:{strategy_id}:",
        f"strategy-stale-order:{strategy_id}:",
    )
    return rule_key.startswith(strategy_prefixes) or alert.symbol == symbol


def _strategy_matches_audit_event(event: ExecutionEvent, strategy_id: str, symbol: str) -> bool:
    if event.strategy_id == strategy_id:
        return True
    if event.symbol != symbol:
        return False
    return event.event_type.startswith("strategy.") or event.event_type.startswith("exchange_order.")


def _build_lightweight_strategy_activity_runtime_snapshot(
    state: Any,
    strategy: Any,
) -> Optional[StrategyRuntimeSnapshot]:
    cached_snapshot = next((item for item in state.strategy_runtime_snapshots if item.strategy_id == strategy.id), None)
    if not strategy.symbols:
        return cached_snapshot
    symbol = strategy.symbols[0]
    watch_item = next((item for item in state.watchlist if item.symbol == symbol), None)
    if watch_item is None:
        return cached_snapshot
    fallback_detail = state.market_details.get(symbol) or build_market_detail_for_watchlist(watch_item)
    evaluated_at = datetime.now(timezone.utc).astimezone().isoformat()
    detail = fallback_detail.model_copy(update={"timeframe": "1h"})
    try:
        detail = market_data.enrich_market_detail(
            symbol=symbol,
            market=watch_item.market,
            fallback_detail=detail,
            watch_item=watch_item,
            timeframe="1h",
        )
    except RuntimeError:
        pass
    try:
        return evaluate_strategy_runtime(
            strategy=strategy,
            detail=detail,
            watch_item=watch_item,
            evaluated_at=evaluated_at,
        )
    except Exception:
        return cached_snapshot

def _build_strategy_activity_runtime_snapshot(
    *,
    strategy_id: str,
    strategy: Any,
    runtime: Optional[StrategyRuntimeSnapshot],
) -> Optional[StrategyRuntimeSnapshot]:
    if runtime is None:
        return None
    runtime = _decorate_strategy_runtime_item(runtime)
    if runtime.runtime_status == "paused":
        return runtime
    strategy_mode_preview: Optional[ExecutionPreview] = None
    if strategy.mode != AccountMode.PAPER:
        runtime_block_reason = _runtime_worker_execution_block_reason(_build_strategy_runtime_worker_health())
        if runtime_block_reason is not None:
            # Round 80 — tag the runtime worker-thread outage with the typed
            # sub-code so the recommender picks the "打开设置页…恢复运行线程"
            # copy off ``sub_block_code`` rather than the ``"运行线程"`` probe.
            strategy_mode_preview = _build_blocked_strategy_execution_preview(
                runtime,
                strategy.mode,
                runtime_block_reason,
                block_code=RISK_REASON_RUNTIME_UNAVAILABLE,
                sub_block_code=RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD,
            )
        else:
            try:
                strategy_mode_preview = _build_strategy_execution_preview_from_state(
                    strategy_id,
                    strategy.mode,
                    runtime_snapshot_override=runtime,
                )
            except RuntimeError as exc:
                # Round 90 — thread typed ``block_code`` / ``sub_block_code``
                # attrs (carried by :class:`StrategyExecutionChannelOutageError`
                # / other typed subclasses) through to the blocked preview so
                # the recommender's typed sub-dispatch fires instead of
                # needing a fresh classifier probe downstream.  Plain
                # ``RuntimeError`` instances carry neither attr so
                # ``getattr(..., None)`` falls back cleanly.
                # Round 96 — also forward ``issue_kind`` (populated on
                # :class:`StrategyExecutionChannelOutageError` by R95) so the
                # channel recommender picks NO_FEED / STALE / AUTH copy off
                # the typed kind end-to-end.
                strategy_mode_preview = _build_blocked_strategy_execution_preview(
                    runtime,
                    strategy.mode,
                    str(exc),
                    block_code=getattr(exc, "block_code", None),
                    sub_block_code=getattr(exc, "sub_block_code", None),
                    issue_kind=getattr(exc, "issue_kind", None),
                )
            except ValueError as exc:
                strategy_mode_preview = _build_blocked_strategy_execution_preview(runtime, strategy.mode, str(exc))
    else:
        try:
            strategy_mode_preview = _build_strategy_execution_preview_from_state(
                strategy_id,
                strategy.mode,
                runtime_snapshot_override=runtime,
            )
        except RuntimeError:
            strategy_mode_preview = None
    if strategy_mode_preview is not None:
        runtime = _apply_runtime_blocked_preview_context(runtime, strategy_mode_preview).model_copy(
            update={"execution_preview": strategy_mode_preview}
        )
    return runtime


def _build_strategy_activity_recent_data(
    *,
    state: Any,
    strategy_id: str,
    strategy: Any,
    symbol: str,
    market: str,
) -> StrategyActivityRecentData:
    orders_source = repo.get_paper_orders() if strategy.mode == AccountMode.PAPER else parse_open_orders(use_private_only=True)
    history_source = (
        repo.get_paper_order_history() if strategy.mode == AccountMode.PAPER else parse_order_history(use_private_only=True)
    )
    trades_source = state.trades if strategy.mode == AccountMode.PAPER else parse_trades(use_private_only=True)
    active_orders = [item for item in orders_source if _strategy_matches_order(item, strategy_id, symbol, market)]
    recent_orders = [item for item in history_source if _strategy_matches_order(item, strategy_id, symbol, market)]
    recent_trades = [item for item in trades_source if _strategy_matches_trade(item, strategy_id, symbol, market)]
    recent_alerts = [item for item in state.alerts if _strategy_matches_alert(item, strategy_id, symbol)]
    recent_audit_events = [
        AppRepository._decorate_execution_event(item)
        for item in state.audit_events
        if _strategy_matches_audit_event(item, strategy_id, symbol)
    ]
    return _build_strategy_activity_recent_data_model(
        strategy_id=strategy_id,
        active_orders=active_orders,
        recent_orders=recent_orders,
        recent_trades=recent_trades,
        recent_alerts=recent_alerts,
        recent_audit_events=recent_audit_events,
        reviews=state.reviews,
        change_requests=state.change_requests,
        backtests=state.backtests,
        agent_jobs=state.agent_jobs,
    )


def build_strategy_activity_payload(strategy_id: str) -> StrategyActivitySnapshot:
    state = repo.snapshot()
    strategy = next((item for item in state.strategies if item.id == strategy_id), None)
    if strategy is None:
        raise KeyError(strategy_id)
    symbol = strategy.symbols[0] if strategy.symbols else "--"
    market = next((item.market for item in state.watchlist if item.symbol == symbol), "perp")
    runtime = _build_lightweight_strategy_activity_runtime_snapshot(state, strategy)
    runtime = _build_strategy_activity_runtime_snapshot(strategy_id=strategy_id, strategy=strategy, runtime=runtime)
    recent_data = _build_strategy_activity_recent_data(
        state=state,
        strategy_id=strategy_id,
        strategy=strategy,
        symbol=symbol,
        market=market,
    )
    summary_collections = _build_strategy_activity_summary_collections(
        recent_review_records=recent_data.recent_review_records,
        strategy_proposal_count_by_review_id=recent_data.strategy_proposal_count_by_review_id,
        recent_backtest_records=recent_data.recent_backtest_records,
        recent_agent_job_records=recent_data.recent_agent_job_records,
    )
    payload_assemblies = _build_strategy_activity_payload_assemblies(
        recent_data=recent_data,
        summary_collections=summary_collections,
        has_backtest_rerun_recommendation=_has_strategy_activity_backtest_rerun_recommendation,
        has_change_request_rerun_recommendation=_has_strategy_activity_change_request_rerun_recommendation,
    )
    return _build_strategy_activity_snapshot_model(
        strategy=strategy,
        symbol=symbol,
        market=market,
        runtime=runtime,
        recent_data=recent_data,
        latest_ops=payload_assemblies.latest_ops,
        decision_sections=payload_assemblies.decision_sections,
        lineage_context=payload_assemblies.lineage_context,
        latest_tracking_job=summary_collections.latest_tracking_job,
        recent_backtests=summary_collections.recent_backtests,
        recent_reviews=summary_collections.recent_reviews,
        recent_agent_jobs=summary_collections.recent_agent_jobs,
        recent_proposals=payload_assemblies.recent_proposals,
        recent_change_requests=payload_assemblies.recent_change_requests,
    )


def _build_strategy_activity_review_context_decision_context(compact: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    decision_context = _prune_compact_review_value(
        {
            group_name: _pop_strategy_activity_context_fields(compact, field_names)
            for group_name, field_names in _STRATEGY_ACTIVITY_REVIEW_CONTEXT_GROUP_FIELD_MAPS.items()
        }
    )
    return decision_context if isinstance(decision_context, dict) and decision_context else None


def _compact_strategy_activity_review_context(context: Dict[str, Any]) -> Dict[str, Any]:
    compact = dict(context)
    decision_context = _build_strategy_activity_review_context_decision_context(compact)
    if decision_context:
        compact["decision_context"] = decision_context
    return compact


def build_review_health_context() -> Dict[str, Any]:
    execution_health = _build_control_snapshot_response().execution_health
    runtime_status = build_runtime_worker_status()
    top_issue_strategy_activity = _build_strategy_activity_review_context(
        str(execution_health.top_issue_strategy_id or "")
    )
    return {
        "execution_top_issue": execution_health.top_issue,
        "execution_top_issue_strategy_id": execution_health.top_issue_strategy_id,
        "execution_top_issue_strategy_name": execution_health.top_issue_strategy_name,
        "execution_top_issue_symbol": execution_health.top_issue_symbol,
        "execution_top_issue_detail": execution_health.top_issue_detail,
        "execution_top_issue_recommended_action": execution_health.top_issue_recommended_action,
        "execution_top_issue_strategy_activity": top_issue_strategy_activity,
        "execution_issue_total": (
            (1 if execution_health.runtime_worker_issue else 0)
            + execution_health.active_stop_loss_guards
            + execution_health.cooldowns
            + execution_health.auto_dispatch_blocked
            + execution_health.rejection_guards
            + execution_health.stale_order_guards
            + execution_health.drifts
        ),
        "runtime_worker_top_issue": runtime_status.top_issue,
        "runtime_worker_detail": runtime_status.last_error,
        "runtime_worker_recommended_action": runtime_status.recommended_action,
    }


def _derive_review_health_context_from_context(
    context: Dict[str, Any],
    include_strategy_activity: bool = True,
) -> Dict[str, Any]:
    execution_health = context.get("execution_health") if isinstance(context.get("execution_health"), dict) else {}
    execution_top_issue_strategy_id = (
        context.get("execution_top_issue_strategy_id")
        or execution_health.get("top_issue_strategy_id")
        or context.get("strategy_id")
        or ""
    )
    top_issue_strategy_activity = context.get("execution_top_issue_strategy_activity")
    if include_strategy_activity and top_issue_strategy_activity is None and execution_top_issue_strategy_id:
        top_issue_strategy_activity = _build_strategy_activity_review_context(str(execution_top_issue_strategy_id))
    return {
        "execution_top_issue": context.get("execution_top_issue", execution_health.get("top_issue")),
        "execution_top_issue_strategy_id": execution_top_issue_strategy_id or None,
        "execution_top_issue_strategy_name": context.get(
            "execution_top_issue_strategy_name",
            execution_health.get("top_issue_strategy_name"),
        ),
        "execution_top_issue_symbol": context.get(
            "execution_top_issue_symbol",
            execution_health.get("top_issue_symbol"),
        ),
        "execution_top_issue_detail": context.get(
            "execution_top_issue_detail",
            execution_health.get("top_issue_detail"),
        ),
        "execution_top_issue_recommended_action": context.get(
            "execution_top_issue_recommended_action",
            execution_health.get("top_issue_recommended_action"),
        ),
        "execution_top_issue_strategy_activity": top_issue_strategy_activity,
        "execution_issue_total": context.get("execution_issue_total", execution_health.get("issue_total", 0)),
        "runtime_worker_top_issue": context.get("runtime_worker_top_issue"),
        "runtime_worker_detail": context.get("runtime_worker_detail"),
        "runtime_worker_recommended_action": context.get("runtime_worker_recommended_action"),
    }


def _has_meaningful_review_health_context(context: Dict[str, Any]) -> bool:
    execution_health = context.get("execution_health") if isinstance(context.get("execution_health"), dict) else {}
    meaningful_keys = (
        "top_issue",
        "top_issue_detail",
        "top_issue_recommended_action",
        "top_issue_strategy_id",
        "top_issue_symbol",
        "runtime_worker_top_issue",
        "runtime_worker_recommended_action",
        "execution_top_issue",
        "execution_top_issue_detail",
        "execution_top_issue_recommended_action",
    )
    for key in meaningful_keys:
        value = context.get(key)
        if value is None:
            value = execution_health.get(key)
        if isinstance(value, str) and value.strip():
            return True
        if isinstance(value, (int, float)) and value:
            return True
    return False


def enrich_review_job_context(
    context: Dict[str, Any],
    prefer_live_health: bool = False,
    allow_strategy_activity_autofill: bool = True,
) -> Dict[str, Any]:
    health_context = (
        _derive_review_health_context_from_context(
            context,
            include_strategy_activity=prefer_live_health or allow_strategy_activity_autofill,
        )
        if context.get("execution_health") is not None
        or context.get("execution_top_issue") is not None
        or context.get("runtime_worker_top_issue") is not None
        else build_review_health_context()
        if prefer_live_health
        else {
            "execution_top_issue": None,
            "execution_top_issue_strategy_id": None,
            "execution_top_issue_strategy_name": None,
            "execution_top_issue_symbol": None,
            "execution_top_issue_detail": None,
            "execution_top_issue_recommended_action": None,
            "execution_top_issue_strategy_activity": None,
            "execution_issue_total": 0,
            "runtime_worker_top_issue": None,
            "runtime_worker_recommended_action": None,
        }
    )
    top_issue_strategy_activity = context.get(
        "execution_top_issue_strategy_activity",
        health_context.get("execution_top_issue_strategy_activity"),
    )
    review_strategy_activity = context.get("review_strategy_activity")
    if review_strategy_activity is None and allow_strategy_activity_autofill:
        review_strategy_id = str(
            context.get("strategy_id")
            or health_context.get("execution_top_issue_strategy_id")
            or ""
        )
        review_strategy_activity = _build_strategy_activity_review_context(review_strategy_id)
    return {
        **context,
        "execution_health": context.get("execution_health", health_context),
        "execution_top_issue": context.get("execution_top_issue", health_context.get("execution_top_issue")),
        "execution_top_issue_strategy_activity": top_issue_strategy_activity,
        "runtime_worker_top_issue": context.get(
            "runtime_worker_top_issue",
            health_context.get("runtime_worker_top_issue"),
        ),
        "runtime_worker_recommended_action": context.get(
            "runtime_worker_recommended_action",
            health_context.get("runtime_worker_recommended_action"),
        ),
        "review_strategy_activity": review_strategy_activity,
    }


def build_agent_job_prompt(job_type: str, context: Dict[str, Any]) -> str:
    review_context = enrich_review_job_context(
        dict(context),
        prefer_live_health=job_type == "generate_daily_review",
        allow_strategy_activity_autofill=job_type != "generate_backtest_review",
    )
    if job_type == "generate_daily_review":
        focus_symbols = ", ".join(review_context.get("focus_symbols", [])) or "BTCUSDT, ETHUSDT"
        mode = review_context.get("mode", "paper")
        health_context = json.dumps(review_context.get("execution_health"), ensure_ascii=False)
        top_issue_strategy_activity = json.dumps(
            review_context.get("execution_top_issue_strategy_activity"),
            ensure_ascii=False,
        )
        return (
            "请生成一份中文量化交易复盘，不要使用 markdown。\n"
            "优先直接输出一个 JSON 对象，不要加代码块，字段为：\n"
            'summary: string\n'
            'highlights: string[]\n'
            'risks: string[]\n'
            'proposals: object[]\n'
            "其中 proposals 可为空数组；如果输出 proposals，每项可包含 proposal_type、title、description、expected_impact、payload。\n"
            "如果你无法稳定输出 JSON，则退回下面的纯文本格式：\n"
            "S: 一句总总结\n"
            "H: 亮点 1\n"
            "H: 亮点 2\n"
            "R: 风险 1\n"
            "R: 风险 2\n"
            f"关注品种：{focus_symbols}\n"
            f"当前模式：{mode}\n"
            f"执行健康：{health_context}\n"
            f"问题策略最近活动：{top_issue_strategy_activity}\n"
            "要求：聚焦量化交易、风险、策略表现和下一步动作。"
        )
    if job_type == "generate_backtest_review":
        metrics = json.dumps(review_context.get("metrics", {}), ensure_ascii=False)
        parameters = json.dumps(review_context.get("parameter_snapshot", {}), ensure_ascii=False)
        health_context = json.dumps(review_context.get("execution_health"), ensure_ascii=False)
        review_strategy_activity = json.dumps(
            review_context.get("review_strategy_activity"),
            ensure_ascii=False,
        )
        source_change_request_id = str(review_context.get("source_change_request_id") or "").strip()
        source_backtest_id = str(review_context.get("source_backtest_id") or "").strip()
        source_review_id = str(review_context.get("source_review_id") or "").strip()
        source_proposal_id = str(review_context.get("source_proposal_id") or "").strip()
        trigger_reason = str(review_context.get("trigger_reason") or "").strip()
        source_parts = []
        if trigger_reason:
            source_parts.append(f"触发原因={trigger_reason}")
        if source_change_request_id:
            source_parts.append(f"来源变更={source_change_request_id}")
        if source_backtest_id:
            source_parts.append(f"来源回测={source_backtest_id}")
        if source_review_id:
            source_parts.append(f"来源复盘={source_review_id}")
        if source_proposal_id:
            source_parts.append(f"来源提案={source_proposal_id}")
        source_lineage = "；".join(source_parts) if source_parts else "手动创建"
        reference_only = _is_reference_only_backtest_context(review_context)
        low_sample = _is_low_sample_backtest_context(review_context)
        trade_count = _get_backtest_trade_count(review_context)
        history_source = str(review_context.get("history_source") or "exchange_history").strip().lower()
        history_source_reason = _get_backtest_history_source_reason(review_context)
        history_source_detail = str(review_context.get("history_source_detail") or "").strip()
        history_source_plan = _resolve_history_source_recommendation(review_context)
        decision_readiness = _resolve_backtest_decision_readiness(review_context)
        requested_candle_estimate = int(review_context.get("requested_candle_estimate") or 0)
        requested_candle_limit = int(review_context.get("requested_candle_limit") or 0)
        requested_range_start = str(review_context.get("requested_range_start") or "").strip()
        requested_range_end = str(review_context.get("requested_range_end") or "").strip()
        retrieved_window_completion_pct = float(review_context.get("retrieved_window_completion_pct") or 0.0)
        used_window_completion_pct = float(review_context.get("used_window_completion_pct") or 0.0)
        retrieved_candle_count = int(review_context.get("retrieved_candle_count") or 0)
        used_candle_count = int(review_context.get("used_candle_count") or 0)
        retrieved_range_start = str(review_context.get("retrieved_range_start") or "").strip()
        retrieved_range_end = str(review_context.get("retrieved_range_end") or "").strip()
        used_range_start = str(review_context.get("used_range_start") or "").strip()
        used_range_end = str(review_context.get("used_range_end") or "").strip()
        history_truncated = bool(review_context.get("history_truncated"))
        history_gap_reason = str(review_context.get("history_gap_reason") or "none").strip().lower()
        truncated_plan = _resolve_full_window_recommendation(review_context)
        sample_label = "包含真实成交样本"
        sample_requirement = ""
        truncation_requirement = ""
        source_label = "交易所历史 K 线"
        source_requirement = ""
        if history_source == "market_detail_fallback":
            source_label = "行情快照回退"
            source_requirement = (
                "若本次回测样本来自工作台行情快照回退，而不是交易所完整历史 K 线，请明确说明当前结果仅适合研究排障，"
                "不要把收益率、回撤或 Sharpe 直接视为正式历史回测结论；若输出 proposals，请优先建议恢复交易所历史后重跑。"
            )
            if history_source_reason == "exchange_fetch_failed":
                source_label = "行情快照回退（历史拉取报错）"
            elif history_source_reason == "insufficient_exchange_samples":
                source_label = "行情快照回退（交易所样本不足）"
        if reference_only:
            sample_label = "仅参考路径（未命中真实入场信号）"
            sample_requirement = (
                "若样本性质为仅参考路径，请明确说明当前没有真实成交样本，不要把收益率、胜率或 Sharpe 直接解读为可上线结论，"
                "优先建议补样本、延长区间或切换周期继续验证。若输出 proposals，请优先只给 backtest_request，"
                "不要给 risk_update、param_update、pause_resume、publish_recommendation 或 script_patch_proposal。"
                "若当前区间已是最近 180 天，请优先改成更高频周期继续补样本，例如 1d->4h、4h->1h、1h->15m。"
            )
        elif low_sample:
            sample_label = f"低样本真实成交（仅 {trade_count} 笔）"
            sample_requirement = (
                "若真实成交样本少于 5 笔，请明确说明样本量偏小，不要直接给出上线结论，"
                "优先建议扩展区间、补充更多周期或继续观察。若输出 proposals，请优先只给 backtest_request，"
                "不要给 risk_update、param_update、pause_resume、publish_recommendation 或 script_patch_proposal。"
                "若当前区间已是最近 180 天，请优先改成更高频周期继续补样本，例如 1d->4h、4h->1h、1h->15m。"
            )
        if history_truncated:
            if history_gap_reason == "insufficient_history":
                truncation_requirement = (
                    "若样本窗口不足是因为交易所当前可用历史不够，请明确说明当前请求区间尚未被真实历史完整覆盖，"
                    "不要直接给调参、风控放宽或上线倾向结论。若输出 proposals，请优先只给 backtest_request，"
                    f"并优先缩短 data_range 到当前已取到的历史范围。建议动作：{truncated_plan['recommended_action']}"
                )
            elif truncated_plan["can_cover_full_window"]:
                truncation_requirement = (
                    "若样本窗口已截断，请明确说明当前请求区间尚未被完整覆盖，不要直接给调参、风控放宽或上线倾向结论。"
                    f"若输出 proposals，请优先只给 backtest_request，并优先保持当前 data_range，切换到能覆盖完整区间的更粗周期。建议动作：{truncated_plan['recommended_action']}"
                )
            else:
                recommended_payload = truncated_plan["payload"]
                truncation_requirement = (
                    "若样本窗口已截断，且当前请求区间即使切到最粗周期也无法完整覆盖，请明确说明当前回测样本上限仍不足，"
                    "不要直接给调参、风控放宽或上线倾向结论。若输出 proposals，请优先只给 backtest_request，"
                    f"并优先缩短 data_range 到可完整覆盖的窗口，例如 {recommended_payload.get('data_range')} @ {recommended_payload.get('timeframe')}。建议动作：{truncated_plan['recommended_action']}"
                )
        decision_readiness_label = {
            "research_only": "仅供研究参考",
            "sample_incomplete": "样本待补",
            "ready": "可继续判断",
        }.get(str(decision_readiness["decision_readiness"]), "可继续判断")
        return (
            "请生成一份中文回测复盘，不要使用 markdown。\n"
            "优先直接输出一个 JSON 对象，不要加代码块，字段为：\n"
            'summary: string\n'
            'highlights: string[]\n'
            'risks: string[]\n'
            'proposals: object[]\n'
            "proposal_type 仅允许：param_update、pause_resume、risk_update、backtest_request、script_patch_proposal、publish_recommendation。\n"
            "如果输出 proposals，请尽量补全 title、description、expected_impact、payload。\n"
            "如果你无法稳定输出 JSON，则退回下面的纯文本格式：\n"
            "S: 一句总总结\n"
            "H: 亮点 1\n"
            "H: 亮点 2\n"
            "R: 风险 1\n"
            "R: 风险 2\n"
            f"策略：{review_context.get('strategy_name', '未知策略')}\n"
            f"策略ID：{review_context.get('strategy_id', '未知')}\n"
            f"关注品种：{', '.join(review_context.get('focus_symbols', [])) or '主观察列表'}\n"
            f"回测区间：{review_context.get('data_range', '未提供')}\n"
            f"时间粒度：{review_context.get('timeframe', '1h')}\n"
            f"来源链路：{source_lineage}\n"
            f"样本性质：{sample_label}\n"
            f"样本来源：{source_label}\n"
            f"来源细节：{history_source_detail or '--'}\n"
            f"来源建议：{history_source_plan['recommended_action'] or '--'}\n"
            f"结论门禁：{decision_readiness_label}\n"
            f"门禁详情：{decision_readiness['decision_readiness_detail'] or '--'}\n"
            f"门禁重跑：{decision_readiness['decision_recommended_data_range'] or '--'} @ {decision_readiness['decision_recommended_timeframe'] or '--'}\n"
            f"门禁建议：{decision_readiness['decision_readiness_action'] or '--'}\n"
            f"请求窗口：{requested_range_start or '--'} -> {requested_range_end or '--'}\n"
            f"窗口覆盖：取样 {retrieved_window_completion_pct:.2f}% · 回测 {used_window_completion_pct:.2f}%\n"
            f"取样窗口：理论需要 {requested_candle_estimate or '--'} 根，当前上限 {requested_candle_limit or '--'} 根，取到 {retrieved_candle_count or '--'} 根，实际使用 {used_candle_count or '--'} 根，截断状态 {'是' if history_truncated else '否'}\n"
            f"样本覆盖：取到 {retrieved_range_start or '--'} -> {retrieved_range_end or '--'}；实际回测 {used_range_start or '--'} -> {used_range_end or '--'}\n"
            f"关键指标：{metrics}\n"
            f"参数快照：{parameters}\n"
            f"波动统计：{json.dumps(review_context.get('volatility_stats'), ensure_ascii=False)}\n"
            f"风险比率：{json.dumps(review_context.get('risk_ratios'), ensure_ascii=False)}\n"
            f"节奏统计：{json.dumps(review_context.get('trade_rhythm_stats'), ensure_ascii=False)}\n"
            f"对比基准：{json.dumps(review_context.get('benchmark_stats'), ensure_ascii=False)}\n"
            f"敞口统计：{json.dumps(review_context.get('exposure_stats'), ensure_ascii=False)}\n"
            f"尾部风险：{json.dumps(review_context.get('tail_risk_stats'), ensure_ascii=False)}\n"
            f"订单流：{json.dumps(review_context.get('order_flow_stats'), ensure_ascii=False)}\n"
            f"执行健康：{health_context}\n"
            f"策略最近活动：{review_strategy_activity}\n"
            "要求：聚焦收益质量、回撤、风险边界，并给出下一步验证建议。"
            f"{sample_requirement}{truncation_requirement}{source_requirement}"
        )
    if job_type == "review_strategy_change":
        execution_health = json.dumps(review_context.get("execution_health"), ensure_ascii=False)
        strategy_activity = json.dumps(review_context.get("review_strategy_activity"), ensure_ascii=False)
        return (
            "请用中文输出一段紧凑的策略变更跟踪总结，不要使用 markdown。\n"
            "优先直接输出一个 JSON 对象，不要加代码块，字段为：\n"
            'summary: string  // 120 字以内，说明变更是否真正落地\n'
            'status: "on_track" | "needs_attention" | "escalate"  // 跟进状态\n'
            'findings: string[]  // 关键观察（最多 4 条），结合执行健康与最近活动\n'
            'next_actions: string[]  // 建议的下一步动作（最多 4 条，无建议则返回空数组）\n'
            'highlights: string[]  // 可选：用于沿用旧版复盘摘要展示\n'
            'risks: string[]  // 可选：需要重点关注的风险项\n'
            "如果你无法稳定输出 JSON，则退回为一段 120 字以内的中文总结。\n"
            f"变更类型：{review_context.get('change_type', '未知变更')}\n"
            f"变更摘要：{review_context.get('summary', '未提供')}\n"
            f"策略ID：{review_context.get('strategy_id', '未知策略')}\n"
            f"目标模式：{review_context.get('target_mode', 'paper')}\n"
            f"执行健康：{execution_health}\n"
            f"策略最近活动：{strategy_activity}\n"
            "要求：指出这次变更当前是否真正落地、是否影响执行健康、下一步是否需要人工复核。"
        )
    if job_type == "review_strategy_issue":
        execution_health = json.dumps(review_context.get("execution_health"), ensure_ascii=False)
        strategy_activity = json.dumps(review_context.get("review_strategy_activity"), ensure_ascii=False)
        return (
            "请用中文输出一段紧凑的策略问题跟踪总结，不要使用 markdown。\n"
            "优先直接输出一个 JSON 对象，不要加代码块，字段为：\n"
            'summary: string  // 120 字以内，说明问题当前状态\n'
            'status: "on_track" | "needs_attention" | "escalate"  // 跟进状态\n'
            'findings: string[]  // 关键观察（最多 4 条），结合执行健康与最近活动\n'
            'next_actions: string[]  // 建议的下一步动作（最多 4 条，无建议则返回空数组）\n'
            'highlights: string[]  // 可选：用于沿用旧版复盘摘要展示\n'
            'risks: string[]  // 可选：需要重点关注的风险项\n'
            "如果你无法稳定输出 JSON，则退回为一段 120 字以内的中文总结。\n"
            f"问题类型：{review_context.get('issue_type', '未知问题')}\n"
            f"问题摘要：{review_context.get('summary', '未提供')}\n"
            f"问题详情：{review_context.get('detail', '未提供')}\n"
            f"策略ID：{review_context.get('strategy_id', '未知策略')}\n"
            f"目标模式：{review_context.get('mode', 'paper')}\n"
            f"执行健康：{execution_health}\n"
            f"策略最近活动：{strategy_activity}\n"
            "要求：指出当前问题是否仍在持续、最可能的影响面、以及下一步建议动作。"
        )
    if job_type == "reconcile_change_request":
        return (
            "请用中文跟进这个变更请求的落实情况，优先直接输出一个 JSON 对象，不要加代码块，字段为：\n"
            'summary: string  // 60 字以内，说明变更当前是否真正落地\n'
            'landed: boolean  // 变更是否已按预期生效\n'
            'needs_manual_review: boolean  // 是否仍需人工复核\n'
            'needs_manual_review_detail: string  // 若需要人工复核，指出主要风险点；否则可为空字符串\n'
            'next_actions: string[]  // 建议的下一步动作（最多 4 条，无建议则返回空数组）\n'
            "如果你无法稳定输出 JSON，请退回为一段 120 字以内的中文总结。\n"
            f"上下文：{json.dumps(review_context, ensure_ascii=False)}"
        )
    if job_type == "summarize_execution_impact":
        anomalies_text = json.dumps(
            review_context.get("anomalies") or [],
            ensure_ascii=False,
        )
        return (
            "你是一个量化执行评估专家。请基于以下执行回放数据，生成一份结构化的执行影响摘要。\n"
            f"- 策略：{review_context.get('strategy_name', '未提供')}（{review_context.get('strategy_id', '未提供')}）\n"
            f"- 时间窗口：{review_context.get('window_start', '未提供')} -> {review_context.get('window_end', '未提供')}\n"
            f"- 订单总数：{review_context.get('order_count', '未提供')}\n"
            f"- 成交笔数：{review_context.get('fill_count', '未提供')}\n"
            f"- 总成交金额：{review_context.get('total_notional', '未提供')}\n"
            f"- 滑点（bps）：{review_context.get('slippage_bps', '未提供')}\n"
            f"- 预期 vs 实际 PnL：{review_context.get('expected_pnl', '未提供')} / {review_context.get('realized_pnl', '未提供')}\n"
            f"- 异常事件：{anomalies_text}\n"
            "请按如下 JSON 结构输出（与 parse_execution_impact_response 对齐）：\n"
            "{\n"
            '  "summary": "200 字以内的执行质量综述",\n'
            '  "impact_level": "negligible|moderate|significant",\n'
            '  "direction": "improved|neutral|worsened",\n'
            '  "affected_orders": ["受影响的订单 ID 或描述"],\n'
            '  "affected_positions": ["受影响的仓位 ID 或描述"],\n'
            '  "metrics_deltas": ["关键指标差异，例如 滑点+3bps、成交率-12%"],\n'
            '  "follow_up_checks": ["需要人工复核或后续跟踪的动作"]\n'
            "}\n"
            "如果你无法稳定输出 JSON，请退回为一段 120 字以内的中文总结。"
        )
    return (
        "请用中文简短总结当前任务执行结果，并给出一句下一步建议。"
        f"上下文：{json.dumps(review_context, ensure_ascii=False)}"
    )


def apply_reconcile_change_request_outcome_from_text(
    job_context: Dict[str, Any],
    text: str,
    source: str = "openclaw",
) -> Dict[str, Any]:
    """Parse a ``reconcile_change_request`` agent response and write it back.

    This is the glue between the ``OpenClawGatewayClient`` JSON parser and
    ``AppRepository.apply_reconcile_change_request_outcome``; it keeps the
    worker loop readable and makes the behavior unit-testable without needing
    a running OpenClaw gateway.
    """

    change_request_id = str(job_context.get("change_request_id") or "").strip()
    parsed = OpenClawGatewayClient.parse_reconcile_change_request_response(text)
    if not change_request_id:
        return parsed
    try:
        outcome_model = ReconcileChangeRequestOutcome(
            change_request_id=change_request_id,
            summary=parsed["summary"],
            landed=parsed.get("landed"),
            needs_manual_review=parsed.get("needs_manual_review"),
            needs_manual_review_detail=parsed.get("needs_manual_review_detail"),
            next_actions=parsed.get("next_actions") or [],
        )
    except ValidationError:
        return parsed
    repo.apply_reconcile_change_request_outcome(change_request_id, outcome_model, source=source)
    return parsed


def extract_first_json_object(text: str) -> Optional[Dict[str, Any]]:
    stripped = text.strip()
    candidates: List[str] = [stripped]
    if "```" in stripped:
        parts = stripped.split("```")
        for part in parts:
            candidate = part.strip()
            if candidate.lower().startswith("json"):
                candidate = candidate[4:].strip()
            if candidate.startswith("{") and candidate.endswith("}"):
                candidates.append(candidate)

    for candidate in candidates:
        if not candidate.startswith("{"):
            start = candidate.find("{")
            end = candidate.rfind("}")
            if start == -1 or end == -1 or end <= start:
                continue
            candidate = candidate[start : end + 1]
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


repo.backtest_runner = build_backtest_payload


def parse_review_text(text: str) -> Dict[str, Any]:
    parsed_json = extract_first_json_object(text)
    if parsed_json is not None:
        summary = str(parsed_json.get("summary") or "").strip()
        highlights = [str(item).strip() for item in parsed_json.get("highlights", []) if str(item).strip()]
        risks = [str(item).strip() for item in parsed_json.get("risks", []) if str(item).strip()]
        proposals = parsed_json.get("proposals", [])
        return {
            "summary": summary or "OpenClaw 已完成最新一轮量化复盘。",
            "highlights": highlights[:4] or ["已完成最新一轮复盘生成。"],
            "risks": risks[:4] or ["暂未识别到新的高优先级风险。"],
            "proposals": proposals if isinstance(proposals, list) else [],
        }

    summary = ""
    highlights: List[str] = []
    risks: List[str] = []

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.startswith("S:"):
            summary = line[2:].strip()
        elif line.startswith("H:"):
            highlights.append(line[2:].strip())
        elif line.startswith("R:"):
            risks.append(line[2:].strip())

    if not summary:
        compact_lines = [line.strip() for line in text.splitlines() if line.strip()]
        summary = compact_lines[0] if compact_lines else "OpenClaw 已完成最新一轮量化复盘。"
        highlights = highlights or compact_lines[1:3]
        risks = risks or compact_lines[3:5]

    return {
        "summary": summary,
        "highlights": highlights[:4] or ["已完成最新一轮复盘生成。"],
        "risks": risks[:4] or ["暂未识别到新的高优先级风险。"],
        "proposals": [],
    }


def build_parsed_review_proposals(parsed: Dict[str, Any], context: Dict[str, Any], now_iso: str) -> List[StrategyProposal]:
    raw_items = parsed.get("proposals", [])
    if not isinstance(raw_items, list):
        return []

    strategy_id = str(context.get("strategy_id") or "")
    target_mode = str(context.get("mode") or "paper")
    allowed_types = {
        "param_update",
        "pause_resume",
        "risk_update",
        "backtest_request",
        "script_patch_proposal",
        "publish_recommendation",
    }
    proposals: List[StrategyProposal] = []

    for raw_item in raw_items[:4]:
        if not isinstance(raw_item, dict):
            continue
        proposal_type = str(raw_item.get("proposal_type") or "").strip()
        title = str(raw_item.get("title") or "").strip()
        description = str(raw_item.get("description") or "").strip()
        expected_impact = str(raw_item.get("expected_impact") or "").strip()
        if proposal_type not in allowed_types or not title:
            continue
        payload = raw_item.get("payload", {})
        if not isinstance(payload, dict):
            payload = {}
        normalized_payload = dict(payload)
        if proposal_type in {"risk_update", "param_update", "pause_resume", "publish_recommendation", "script_patch_proposal"}:
            normalized_payload.setdefault("target_mode", target_mode)

        proposals.append(
            StrategyProposal(
                id=f"prop-{uuid4().hex[:6]}",
                proposal_type=proposal_type,  # type: ignore[arg-type]
                strategy_id=str(raw_item.get("strategy_id") or strategy_id),
                title=title,
                description=description or f"OpenClaw 建议执行：{title}",
                created_at=now_iso,
                status="pending",
                expected_impact=expected_impact or "建议先进入人工确认，再决定是否落实。",
                payload=normalized_payload,
            )
        )

    return proposals


def build_review_proposals(job_type: str, context: Dict[str, Any]) -> List[StrategyProposal]:
    if job_type != "generate_backtest_review":
        return []

    strategy_id = str(context.get("strategy_id") or "")
    if not strategy_id:
        return []

    metrics = context.get("metrics", {}) if isinstance(context.get("metrics"), dict) else {}
    max_drawdown = parse_percent_value(metrics.get("max_drawdown"))
    annual_return = parse_percent_value(metrics.get("annual_return"))
    win_rate = parse_percent_value(metrics.get("win_rate"))
    try:
        trade_count = max(int(metrics.get("trades", 0)), 0)
    except (TypeError, ValueError):
        trade_count = 0
    timeframe = str(context.get("timeframe") or "1h")
    raw_data_range = context.get("data_range")
    data_range = str(raw_data_range or "最近 180 天")
    strategy_name = str(context.get("strategy_name") or strategy_id)
    proposals: List[StrategyProposal] = []
    now = datetime.now(timezone.utc).astimezone().isoformat()
    sample_validation_payload = _build_sample_validation_backtest_payload(
        data_range,
        timeframe,
        prefer_finer_timeframe=raw_data_range is not None,
    )
    full_window_plan = _resolve_full_window_recommendation(context)

    if _is_reference_only_backtest_context(context):
        proposals.append(
            StrategyProposal(
                id=f"prop-{uuid4().hex[:6]}",
                proposal_type="backtest_request",
                strategy_id=strategy_id,
                title=f"{strategy_name} 扩大样本验证",
                description="本次回测区间未命中真实入场信号，建议先扩大回测区间或补充更高频周期，优先补足真实样本。",
                created_at=now,
                status="pending",
                expected_impact="优先拿到真实成交样本，再判断收益质量、回撤与信号稳定性。",
                payload=sample_validation_payload,
            )
        )
        return proposals[:1]

    if 0 < trade_count < 5:
        proposals.append(
            StrategyProposal(
                id=f"prop-{uuid4().hex[:6]}",
                proposal_type="backtest_request",
                strategy_id=strategy_id,
                title=f"{strategy_name} 扩大样本验证",
                description=f"本次回测仅产生 {trade_count} 笔真实成交，样本量偏小，建议先扩大回测区间继续补样本。",
                created_at=now,
                status="pending",
                expected_impact="先提升样本量，再判断当前收益、胜率与 Sharpe 是否稳定。",
                payload=sample_validation_payload,
            )
        )
        return proposals[:1]

    if _is_market_detail_fallback_backtest_context(context):
        history_source_plan = _resolve_history_source_recommendation(context)
        history_source_reason = _get_backtest_history_source_reason(context)
        fallback_title = f"{strategy_name} 恢复交易所历史后重跑"
        fallback_description = "本次回测样本来自工作台行情快照回退，建议先恢复交易所历史 K 线拉取后，再用同一区间重跑确认结果。"
        if history_source_reason == "insufficient_exchange_samples":
            fallback_title = f"{strategy_name} 补足交易所历史样本"
            fallback_description = history_source_plan["recommended_action"]
        proposals.append(
            StrategyProposal(
                id=f"prop-{uuid4().hex[:6]}",
                proposal_type="backtest_request",
                strategy_id=strategy_id,
                title=fallback_title,
                description=fallback_description,
                created_at=now,
                status="pending",
                expected_impact="先拿到正式历史样本，再判断当前收益、回撤与 Sharpe 是否足以支持调参或上线结论。",
                payload={
                    "data_range": history_source_plan["data_range"],
                    "timeframe": history_source_plan["timeframe"],
                },
            )
        )
        return proposals[:1]

    if _is_truncated_backtest_context(context):
        if full_window_plan["can_cover_full_window"]:
            title = f"{strategy_name} 补足完整样本窗口"
            description = "当前回测请求区间未被完整覆盖，建议先切换到可覆盖完整区间的更粗周期，再判断收益质量、回撤与 Sharpe。"
            expected_impact = "先补足完整时间窗口，再判断当前回测结果是否足以支持调参或上线结论。"
        else:
            title = f"{strategy_name} 缩短区间以补足样本窗口"
            description = (
                "当前回测请求区间即使切到最粗周期也无法完整覆盖，建议先缩短到当前回测样本上限内可完整覆盖的窗口，"
                "再判断收益质量、回撤与 Sharpe。"
            )
            expected_impact = "先拿到完整时间窗口样本，再判断当前回测结果是否足以支持调参或上线结论。"
        proposals.append(
            StrategyProposal(
                id=f"prop-{uuid4().hex[:6]}",
                proposal_type="backtest_request",
                strategy_id=strategy_id,
                title=title,
                description=description,
                created_at=now,
                status="pending",
                expected_impact=expected_impact,
                payload=dict(full_window_plan["payload"]),
            )
        )
        return proposals[:1]

    if max_drawdown is not None and abs(max_drawdown) >= 5:
        proposals.append(
            StrategyProposal(
                id=f"prop-{uuid4().hex[:6]}",
                proposal_type="risk_update",
                strategy_id=strategy_id,
                title=f"压缩 {strategy_name} 风险预算",
                description=f"最近回测最大回撤达到 {metrics.get('max_drawdown')}，建议先收紧风险预算并降低止损容忍区间。",
                created_at=now,
                status="pending",
                expected_impact="优先压缩回撤尖峰，降低高波动区间的资金回吐。",
                payload={
                    "risk_budget": "10%",
                    "target_mode": context.get("mode", "paper"),
                },
            )
        )

    if annual_return is not None and annual_return >= 20 and (win_rate is None or win_rate >= 58):
        proposals.append(
            StrategyProposal(
                id=f"prop-{uuid4().hex[:6]}",
                proposal_type="backtest_request",
                strategy_id=strategy_id,
                title=f"{strategy_name} 追加更短周期验证",
                description="当前回测收益质量较强，建议补跑更短周期样本验证信号稳定性与滑点表现。",
                created_at=now,
                status="pending",
                expected_impact="确认策略强势不是单一窗口偶然结果，增强后续发布信心。",
                payload={
                    "data_range": "最近 45 天",
                    "timeframe": "15m" if timeframe != "15m" else timeframe,
                },
            )
        )

    return proposals[:2]


def _build_sample_validation_backtest_payload(
    data_range: str,
    timeframe: str,
    prefer_finer_timeframe: bool = True,
) -> Dict[str, str]:
    normalized_range = str(data_range or "最近 180 天")
    normalized_timeframe = str(timeframe or "1h").strip().lower() or "1h"
    next_range = "最近 180 天" if normalized_range != "最近 180 天" else normalized_range
    next_timeframe = normalized_timeframe
    if prefer_finer_timeframe and next_range == normalized_range == "最近 180 天":
        next_timeframe = {
            "1d": "4h",
            "4h": "1h",
            "1h": "15m",
        }.get(normalized_timeframe, normalized_timeframe)
    return {
        "data_range": next_range,
        "timeframe": next_timeframe,
    }


def _resolve_history_source_recommendation(context: Dict[str, Any]) -> Dict[str, str]:
    current_range = str(context.get("data_range") or "最近 180 天").strip() or "最近 180 天"
    current_timeframe = str(context.get("timeframe") or "1h").strip().lower() or "1h"
    reason = _get_backtest_history_source_reason(context)
    recommended_range = str(context.get("history_source_recommended_data_range") or "").strip()
    raw_recommended_timeframe = str(context.get("history_source_recommended_timeframe") or "").strip().lower()
    recommended_action = str(context.get("history_source_recommended_action") or "").strip()
    if recommended_range and raw_recommended_timeframe in {"15m", "1h", "4h", "1d"}:
        if not recommended_action:
            if reason == "insufficient_exchange_samples":
                if recommended_range == current_range and raw_recommended_timeframe == current_timeframe:
                    recommended_action = (
                        f"当前交易所历史样本不足，建议先等待更多交易所历史积累后，再按当前区间 {current_range} "
                        f"和周期 {current_timeframe} 重跑。"
                    )
                elif recommended_range == current_range:
                    recommended_action = (
                        f"当前交易所历史样本不足，建议先保持 {current_range}，切到 {raw_recommended_timeframe} "
                        "补样本后再重跑。"
                    )
                elif raw_recommended_timeframe == current_timeframe:
                    recommended_action = (
                        f"当前交易所历史样本不足，建议先改用 {recommended_range}，并保持 "
                        f"{current_timeframe} 补样本后再重跑。"
                    )
                else:
                    recommended_action = (
                        f"当前交易所历史样本不足，建议先改用 {recommended_range} @ {raw_recommended_timeframe} "
                        "补样本后再重跑。"
                    )
            else:
                recommended_action = (
                    f"请先恢复交易所历史 K 线拉取，再按当前区间 {current_range} 和周期 "
                    f"{current_timeframe} 重跑。"
                )
        return {
            "data_range": recommended_range,
            "timeframe": raw_recommended_timeframe,
            "recommended_action": recommended_action,
        }
    if reason == "insufficient_exchange_samples":
        payload = _build_sample_validation_backtest_payload(
            current_range,
            current_timeframe,
            prefer_finer_timeframe=True,
        )
        recommended_range = payload["data_range"]
        raw_recommended_timeframe = payload["timeframe"]
        if recommended_range == current_range and raw_recommended_timeframe == current_timeframe:
            recommended_action = (
                f"当前交易所历史样本不足，建议先等待更多交易所历史积累后，再按当前区间 {current_range} "
                f"和周期 {current_timeframe} 重跑。"
            )
        elif recommended_range == current_range:
            recommended_action = (
                f"当前交易所历史样本不足，建议先保持 {current_range}，切到 {raw_recommended_timeframe} "
                "补样本后再重跑。"
            )
        elif raw_recommended_timeframe == current_timeframe:
            recommended_action = (
                f"当前交易所历史样本不足，建议先改用 {recommended_range}，并保持 "
                f"{current_timeframe} 补样本后再重跑。"
            )
        else:
            recommended_action = (
                f"当前交易所历史样本不足，建议先改用 {recommended_range} @ {raw_recommended_timeframe} "
                "补样本后再重跑。"
            )
        return {
            "data_range": recommended_range,
            "timeframe": raw_recommended_timeframe,
            "recommended_action": recommended_action,
        }
    return {
        "data_range": current_range,
        "timeframe": current_timeframe,
        "recommended_action": (
            f"请先恢复交易所历史 K 线拉取，再按当前区间 {current_range} 和周期 {current_timeframe} 重跑。"
        ),
    }


def _max_coverable_days_for_timeframe(timeframe: str) -> int:
    hours_per_bar = {
        "15m": 0.25,
        "1h": 1.0,
        "4h": 4.0,
        "1d": 24.0,
    }.get(str(timeframe or "1h").strip().lower(), 1.0)
    return max(int(((BACKTEST_ENGINE_MAX_CANDLES - 5) * hours_per_bar) // 24), 1)


def _build_coverable_backtest_range(data_range: str, timeframe: str) -> str:
    normalized_range = str(data_range or "最近 180 天").strip() or "最近 180 天"
    max_days = _max_coverable_days_for_timeframe(timeframe)
    if " ~ " in normalized_range or "~" in normalized_range:
        try:
            start_text, end_text = [part.strip() for part in normalized_range.split("~", 1)]
            start_dt = datetime.fromisoformat(start_text)
            end_dt = datetime.fromisoformat(end_text)
            shortened_start = max(start_dt, end_dt - timedelta(days=max_days))
            include_time = any("T" in part for part in (start_text, end_text))
            if include_time:
                start_rendered = shortened_start.isoformat(timespec="seconds")
                end_rendered = end_dt.isoformat(timespec="seconds")
            else:
                start_rendered = shortened_start.date().isoformat()
                end_rendered = end_dt.date().isoformat()
            return f"{start_rendered} ~ {end_rendered}"
        except Exception:
            pass

    compact_relative = normalized_range.replace(" ", "")
    if compact_relative.startswith("最近") and compact_relative.endswith("天"):
        return f"最近 {max_days} 天"

    return f"最近 {max_days} 天"


def _build_available_history_data_range_from_bounds(
    start_iso: Optional[str],
    end_iso: Optional[str],
    timeframe: str,
) -> Optional[str]:
    if not start_iso or not end_iso:
        return None
    try:
        start_dt = datetime.fromisoformat(start_iso)
        end_dt = datetime.fromisoformat(end_iso)
    except Exception:
        return None
    normalized_timeframe = str(timeframe or "1h").strip().lower()
    if normalized_timeframe == "1d":
        return f"{start_dt.date().isoformat()} ~ {end_dt.date().isoformat()}"
    return f"{start_dt.isoformat(timespec='seconds')} ~ {end_dt.isoformat(timespec='seconds')}"


def _build_full_window_backtest_plan(
    data_range: str,
    timeframe: str,
) -> Dict[str, Any]:
    normalized_range = str(data_range or "最近 180 天")
    normalized_timeframe = str(timeframe or "1h").strip().lower() or "1h"
    ordered_timeframes = ["15m", "1h", "4h", "1d"]
    try:
        start_index = ordered_timeframes.index(normalized_timeframe)
    except ValueError:
        start_index = 1
        normalized_timeframe = "1h"
    candidates = ordered_timeframes[start_index + 1 :] or [normalized_timeframe]
    for candidate in candidates:
        candidate_estimate = estimate_candle_count_for_range(normalized_range, candidate)
        if candidate_estimate <= candle_limit_for_range(normalized_range, candidate):
            return {
                "payload": {
                    "data_range": normalized_range,
                    "timeframe": candidate,
                },
                "can_cover_full_window": True,
                "target_timeframe": candidate,
            }
    fallback_timeframe = candidates[-1]
    return {
        "payload": {
            "data_range": _build_coverable_backtest_range(normalized_range, fallback_timeframe),
            "timeframe": fallback_timeframe,
        },
        "can_cover_full_window": False,
        "target_timeframe": fallback_timeframe,
    }


def _resolve_full_window_recommendation(context: Dict[str, Any]) -> Dict[str, Any]:
    resolved_current_range = str(context.get("data_range") or "最近 180 天").strip() or "最近 180 天"
    resolved_current_timeframe = str(context.get("timeframe") or "1h").strip().lower() or "1h"
    recommended_range = str(context.get("full_window_recommended_data_range") or "").strip()
    raw_recommended_timeframe = str(context.get("full_window_recommended_timeframe") or "").strip().lower()
    recommended_action = str(context.get("full_window_recommended_action") or "").strip()
    history_gap_reason = str(context.get("history_gap_reason") or "none").strip().lower()
    if recommended_range and raw_recommended_timeframe in {"15m", "1h", "4h", "1d"}:
        can_cover_full_window = recommended_range == resolved_current_range and history_gap_reason != "insufficient_history"
        if not recommended_action:
            if can_cover_full_window:
                recommended_action = f"保持当前区间，切换到 {raw_recommended_timeframe} 补足完整样本窗口。"
            elif history_gap_reason == "insufficient_history":
                recommended_action = (
                    f"当前交易所可用历史仅覆盖 {recommended_range}，建议先缩短到该可用区间，"
                    f"并使用 {raw_recommended_timeframe} 重新回测。"
                )
            else:
                recommended_action = (
                    f"当前区间即使切到最粗周期也无法完整覆盖，建议先缩短到 {recommended_range}，"
                    f"并使用 {raw_recommended_timeframe} 重新回测。"
                )
        return {
            "payload": {
                "data_range": recommended_range,
                "timeframe": raw_recommended_timeframe,
            },
            "can_cover_full_window": can_cover_full_window,
            "target_timeframe": raw_recommended_timeframe,
            "recommended_action": recommended_action,
        }
    resolved_plan = _build_full_window_backtest_plan(resolved_current_range, resolved_current_timeframe)
    recommended_payload = resolved_plan["payload"]
    if resolved_plan["can_cover_full_window"]:
        resolved_plan["recommended_action"] = (
            f"保持当前区间，切换到 {recommended_payload.get('timeframe')} 补足完整样本窗口。"
        )
    else:
        resolved_plan["recommended_action"] = (
            f"当前区间即使切到最粗周期也无法完整覆盖，建议先缩短到 {recommended_payload.get('data_range')}，"
            f"并使用 {recommended_payload.get('timeframe')} 重新回测。"
        )
    return resolved_plan


def _render_sample_validation_action(
    current_range: str,
    current_timeframe: str,
    payload: Dict[str, str],
) -> str:
    next_range = str(payload.get("data_range") or current_range).strip() or current_range
    next_timeframe = str(payload.get("timeframe") or current_timeframe).strip().lower() or current_timeframe
    if next_range == current_range and next_timeframe == current_timeframe:
        return f"建议先继续积累更多真实样本后，再按当前区间 {current_range} @ {current_timeframe} 重跑。"
    return f"建议先改用 {next_range} @ {next_timeframe} 补真实样本后，再继续判断收益、回撤与 Sharpe。"


def _resolve_backtest_decision_readiness(context: Dict[str, Any]) -> Dict[str, Optional[str]]:
    current_range = str(context.get("data_range") or "最近 180 天").strip() or "最近 180 天"
    current_timeframe = str(context.get("timeframe") or "1h").strip().lower() or "1h"
    if _is_market_detail_fallback_backtest_context(context):
        history_source_reason = _get_backtest_history_source_reason(context)
        history_source_plan = _resolve_history_source_recommendation(context)
        if history_source_reason == "insufficient_exchange_samples":
            detail = "当前交易所历史样本不足，结果仍依赖工作台行情快照回退，暂不建议直接用于调参或上线判断。"
        else:
            detail = "当前交易所历史拉取仍未恢复，结果仍依赖工作台行情快照回退，仅适合研究排障。"
        return {
            "decision_readiness": "research_only",
            "decision_readiness_detail": detail,
            "decision_recommended_data_range": history_source_plan["data_range"],
            "decision_recommended_timeframe": history_source_plan["timeframe"],
            "decision_readiness_action": history_source_plan["recommended_action"],
        }
    if _is_reference_only_backtest_context(context):
        payload = _build_sample_validation_backtest_payload(
            current_range,
            current_timeframe,
            prefer_finer_timeframe=True,
        )
        return {
            "decision_readiness": "research_only",
            "decision_readiness_detail": "当前区间未命中真实入场信号，收益、回撤与 Sharpe 仅基于参考路径，暂不建议直接用于调参或上线判断。",
            "decision_recommended_data_range": payload["data_range"],
            "decision_recommended_timeframe": payload["timeframe"],
            "decision_readiness_action": _render_sample_validation_action(
                current_range,
                current_timeframe,
                payload,
            ),
        }
    if _is_truncated_backtest_context(context):
        truncated_plan = _resolve_full_window_recommendation(context)
        return {
            "decision_readiness": "sample_incomplete",
            "decision_readiness_detail": "当前请求窗口尚未被完整覆盖，样本窗口仍不完整，建议先补足完整样本后再继续做调参与结论判断。",
            "decision_recommended_data_range": str(truncated_plan["payload"].get("data_range") or current_range),
            "decision_recommended_timeframe": str(truncated_plan["payload"].get("timeframe") or current_timeframe),
            "decision_readiness_action": truncated_plan["recommended_action"],
        }
    if _is_low_sample_backtest_context(context):
        payload = _build_sample_validation_backtest_payload(
            current_range,
            current_timeframe,
            prefer_finer_timeframe=True,
        )
        trade_count = _get_backtest_trade_count(context)
        return {
            "decision_readiness": "sample_incomplete",
            "decision_readiness_detail": f"当前仅产生 {trade_count} 笔真实成交，样本量偏小，暂不建议直接用于调参或上线判断。",
            "decision_recommended_data_range": payload["data_range"],
            "decision_recommended_timeframe": payload["timeframe"],
            "decision_readiness_action": _render_sample_validation_action(
                current_range,
                current_timeframe,
                payload,
            ),
        }
    return {
        "decision_readiness": "ready",
        "decision_readiness_detail": "当前样本来源、样本量与窗口覆盖已达到最小门槛，可继续结合策略上下文做调参与人工复核。",
        "decision_recommended_data_range": None,
        "decision_recommended_timeframe": None,
        "decision_readiness_action": None,
    }


def _filter_sample_quality_guarded_parsed_proposals(
    proposals: List[StrategyProposal],
    context: Dict[str, Any],
) -> List[StrategyProposal]:
    for proposal in proposals:
        if proposal.proposal_type != "backtest_request":
            continue
        normalized_payload = _extract_safe_sample_validation_payload(proposal.payload, context)
        if normalized_payload is None:
            continue
        return [
            proposal.model_copy(
                update={
                    "payload": normalized_payload,
                }
            )
        ]
    return []


def _extract_safe_sample_validation_payload(
    payload: Dict[str, Any],
    context: Dict[str, Any],
) -> Optional[Dict[str, str]]:
    if not isinstance(payload, dict):
        return None
    truncated_context = _is_truncated_backtest_context(context)
    history_gap_reason = str(context.get("history_gap_reason") or "none").strip().lower()
    current_range = str(context.get("data_range") or "").strip()
    current_timeframe = str(context.get("timeframe") or "1h").strip().lower() or "1h"
    resolved_current_range = current_range or "最近 180 天"
    truncated_plan = _resolve_full_window_recommendation(
        {
            **context,
            "data_range": resolved_current_range,
            "timeframe": current_timeframe,
        }
    )
    current_estimate = int(context.get("requested_candle_estimate") or 0) or estimate_candle_count_for_range(
        resolved_current_range,
        current_timeframe,
    )
    raw_next_range = str(payload.get("data_range") or "").strip()
    raw_next_timeframe = str(payload.get("timeframe") or "").strip().lower()
    next_timeframe = raw_next_timeframe if raw_next_timeframe in {"15m", "1h", "4h", "1d"} else ""
    next_range = raw_next_range or resolved_current_range
    next_resolved_timeframe = next_timeframe or current_timeframe
    next_estimate = estimate_candle_count_for_range(next_range, next_resolved_timeframe)

    if raw_next_range and raw_next_range != resolved_current_range:
        if truncated_context and truncated_plan["can_cover_full_window"]:
            return None
        if history_gap_reason == "insufficient_history" and next_timeframe and next_timeframe != current_timeframe:
            return None
        if truncated_context and next_estimate > candle_limit_for_range(next_range, next_resolved_timeframe):
            return None
        if next_estimate >= current_estimate:
            return None
        return {
            "data_range": raw_next_range,
            "timeframe": next_timeframe or current_timeframe,
        }

    if next_timeframe and next_timeframe != current_timeframe:
        if history_gap_reason == "insufficient_history":
            return None
        if truncated_context and truncated_plan["can_cover_full_window"] and next_estimate >= current_estimate:
            return None
        if (
            truncated_context
            and not truncated_plan["can_cover_full_window"]
            and next_estimate > candle_limit_for_range(resolved_current_range, next_timeframe)
        ):
            return None
        return {
            "data_range": resolved_current_range,
            "timeframe": next_timeframe,
        }

    return None


def _merge_execution_health_review_risks(risks: List[str], context: Optional[Dict[str, Any]] = None) -> List[str]:
    return _merge_execution_health_review_risks_impl(
        risks,
        context,
        derive_review_health_context_from_context=_derive_review_health_context_from_context,
        build_review_health_context=build_review_health_context,
    )


def _is_reference_only_backtest_context(context: Dict[str, Any]) -> bool:
    sample_quality = str(context.get("sample_quality") or "").strip().lower()
    if sample_quality == "reference_only":
        return True
    if sample_quality in {"low_sample", "sufficient"}:
        return False
    value = context.get("reference_only")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return False


def _get_backtest_trade_count(context: Dict[str, Any]) -> int:
    metrics = context.get("metrics", {}) if isinstance(context.get("metrics"), dict) else {}
    try:
        return max(int(metrics.get("trades", 0)), 0)
    except (TypeError, ValueError):
        return 0


def _is_low_sample_backtest_context(context: Dict[str, Any]) -> bool:
    sample_quality = str(context.get("sample_quality") or "").strip().lower()
    if sample_quality == "low_sample":
        return True
    if sample_quality in {"reference_only", "sufficient"}:
        return False
    return not _is_reference_only_backtest_context(context) and 0 < _get_backtest_trade_count(context) < 5


def _is_truncated_backtest_context(context: Dict[str, Any]) -> bool:
    value = context.get("history_truncated")
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    requested_candle_estimate = int(context.get("requested_candle_estimate") or 0)
    requested_candle_limit = int(context.get("requested_candle_limit") or 0)
    if requested_candle_estimate > 0 and requested_candle_limit > 0:
        return requested_candle_estimate > requested_candle_limit
    return False


def _is_market_detail_fallback_backtest_context(context: Dict[str, Any]) -> bool:
    return str(context.get("history_source") or "exchange_history").strip().lower() == "market_detail_fallback"


def _get_backtest_history_source_reason(context: Dict[str, Any]) -> str:
    reason = str(context.get("history_source_reason") or "none").strip().lower()
    if reason in {"exchange_fetch_failed", "insufficient_exchange_samples"}:
        return reason
    return "none"


def _merge_backtest_review_risks(risks: List[str], context: Dict[str, Any]) -> List[str]:
    merged = [str(item).strip() for item in risks if str(item).strip()]
    if _is_reference_only_backtest_context(context):
        reference_risk = "样本质量提示：本次回测区间未命中真实入场信号，当前收益、回撤与 Sharpe 仅基于参考路径，不应直接视为可上线结论。"
        if not any("未命中真实入场信号" in item or "样本质量提示" in item for item in merged):
            merged.append(reference_risk)
    elif _is_low_sample_backtest_context(context):
        trade_count = _get_backtest_trade_count(context)
        low_sample_risk = f"样本质量提示：本次回测仅产生 {trade_count} 笔真实成交，样本量偏小，当前收益、胜率与 Sharpe 仍不足以直接支持上线判断。"
        if not any("样本量偏小" in item or "仅产生" in item for item in merged):
            merged.append(low_sample_risk)
    if _is_market_detail_fallback_backtest_context(context):
        history_source_detail = str(context.get("history_source_detail") or "").strip()
        fallback_risk = "样本来源提示：本次回测样本来自工作台行情快照回退，而不是交易所完整历史 K 线，当前收益、回撤与 Sharpe 仅适合研究排障，不应直接视为正式历史回测结论。"
        if history_source_detail:
            fallback_risk = f"{fallback_risk} 原因：{history_source_detail}"
        if not any("行情快照回退" in item or "样本来源提示" in item for item in merged):
            merged.append(fallback_risk)
    if _is_truncated_backtest_context(context):
        requested_candle_estimate = int(context.get("requested_candle_estimate") or 0)
        used_candle_count = int(context.get("used_candle_count") or 0)
        history_gap_reason = str(context.get("history_gap_reason") or "none").strip().lower()
        retrieved_range_start = str(context.get("retrieved_range_start") or "").strip()
        retrieved_range_end = str(context.get("retrieved_range_end") or "").strip()
        truncated_plan = _resolve_full_window_recommendation(context)
        if history_gap_reason == "insufficient_history":
            available_range = (
                _build_available_history_data_range_from_bounds(
                    retrieved_range_start,
                    retrieved_range_end,
                    str(context.get("timeframe") or "1h"),
                )
                or "当前可用历史区间"
            )
            truncated_risk = (
                f"样本窗口提示：本次请求区间理论需要约 {requested_candle_estimate} 根 K 线，"
                f"当前交易所仅提供 {used_candle_count} 根样本，实际可用历史覆盖 {available_range}，"
                f"建议先缩短到该可用区间后再判断收益质量与调参方向。"
            )
        elif truncated_plan["can_cover_full_window"]:
            truncated_risk = (
                f"样本窗口提示：本次请求区间理论需要约 {requested_candle_estimate} 根 K 线，"
                f"当前回测仅使用最近 {used_candle_count} 根样本，请先补足完整样本窗口，再判断收益质量与调参方向。"
            )
        else:
            recommended_payload = truncated_plan["payload"]
            truncated_risk = (
                f"样本窗口提示：本次请求区间理论需要约 {requested_candle_estimate} 根 K 线，"
                f"当前回测仅使用最近 {used_candle_count} 根样本；即使切到最粗周期，当前区间仍无法在当前回测样本上限内完整覆盖，"
                f"建议先缩短到 {recommended_payload.get('data_range')} 再判断收益质量与调参方向。"
            )
        if truncated_plan.get("recommended_action"):
            truncated_risk = f"{truncated_risk} 建议动作：{truncated_plan['recommended_action']}"
        if not any("样本窗口提示" in item or "补足完整样本窗口" in item for item in merged):
            merged.append(truncated_risk)
    return _merge_execution_health_review_risks(merged, context)


def _merge_review_structured_parse(
    text: str, job_type: str, fallback: Dict[str, Any]
) -> Dict[str, Any]:
    if job_type == "generate_daily_review":
        structured = OpenClawGatewayClient.parse_daily_review_response(text)
        highlights = [str(item) for item in structured.get("key_wins") or []]
        risks = [str(item) for item in structured.get("key_losses") or []]
        risks.extend(str(item) for item in structured.get("market_observations") or [])
        risks.extend(str(item) for item in structured.get("next_day_priorities") or [])
        sentiment = structured.get("sentiment") or ""
        summary_prefix = f"[{sentiment}] " if sentiment and sentiment != "neutral" else ""
    elif job_type == "generate_backtest_review":
        structured = OpenClawGatewayClient.parse_backtest_review_response(text)
        highlights = [str(item) for item in structured.get("strengths") or []]
        risks = [str(item) for item in structured.get("weaknesses") or []]
        risks.extend(str(item) for item in structured.get("risk_flags") or [])
        risks.extend(str(item) for item in structured.get("recommended_actions") or [])
        rating = structured.get("overall_rating") or ""
        summary_prefix = f"[{rating}] " if rating and rating != "acceptable" else ""
    else:
        return fallback

    if not highlights and not risks:
        return fallback
    summary = str(structured.get("summary") or "").strip()
    if not summary:
        summary = str(fallback.get("summary") or "")
    return {
        "summary": f"{summary_prefix}{summary}".strip(),
        "highlights": highlights or [str(item) for item in fallback.get("highlights") or []],
        "risks": risks or [str(item) for item in fallback.get("risks") or []],
        "proposals": fallback.get("proposals") or [],
    }


def build_review_document_from_text(text: str, context: Dict[str, Any], source: str, job_type: str) -> ReviewDocument:
    fallback = parse_review_text(text)
    parsed = _merge_review_structured_parse(text, job_type, fallback)
    now = datetime.now(timezone.utc).astimezone()
    now_iso = now.isoformat()
    sample_quality_guarded = (
        job_type == "generate_backtest_review"
        and (
            _is_reference_only_backtest_context(context)
            or _is_low_sample_backtest_context(context)
            or _is_truncated_backtest_context(context)
            or _is_market_detail_fallback_backtest_context(context)
        )
    )
    parsed_proposals = build_parsed_review_proposals(parsed, context, now_iso)
    if sample_quality_guarded:
        parsed_proposals = _filter_sample_quality_guarded_parsed_proposals(parsed_proposals, context)
    heuristic_proposals = [] if sample_quality_guarded and parsed_proposals else build_review_proposals(job_type, context)
    proposals: List[StrategyProposal] = []
    seen_keys = set()
    for proposal in [*parsed_proposals, *heuristic_proposals]:
        key = (proposal.proposal_type, proposal.strategy_id, proposal.title)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        proposals.append(proposal)
    title = (
        f"{now.strftime('%Y-%m-%d')} 回测 AI 复盘"
        if job_type == "generate_backtest_review"
        else f"{now.strftime('%Y-%m-%d')} 日度 AI 复盘"
    )
    decision_readiness: Optional[Dict[str, Optional[str]]] = None
    source_change_request_id: Optional[str] = None
    source_backtest_id: Optional[str] = None
    source_review_id: Optional[str] = None
    source_proposal_id: Optional[str] = None
    trigger_reason: Optional[str] = None
    if job_type == "generate_backtest_review":
        decision_readiness = _resolve_backtest_decision_readiness(context)
        source_change_request_id = str(context.get("source_change_request_id") or "").strip() or None
        source_backtest_id = str(context.get("source_backtest_id") or "").strip() or None
        source_review_id = str(context.get("source_review_id") or "").strip() or None
        source_proposal_id = str(context.get("source_proposal_id") or "").strip() or None
        trigger_reason = str(context.get("trigger_reason") or "").strip() or None
    return ReviewDocument(
        id=f"review-{uuid4().hex[:10]}",
        period="backtest" if job_type == "generate_backtest_review" else "daily",
        strategy_id=str(context.get("strategy_id") or "") or None,
        backtest_id=str(context.get("backtest_id") or "") or None if job_type == "generate_backtest_review" else None,
        source_change_request_id=source_change_request_id,
        source_backtest_id=source_backtest_id,
        source_review_id=source_review_id,
        source_proposal_id=source_proposal_id,
        trigger_reason=trigger_reason,
        decision_readiness=decision_readiness["decision_readiness"] if decision_readiness else None,
        decision_readiness_detail=decision_readiness["decision_readiness_detail"] if decision_readiness else None,
        decision_recommended_data_range=decision_readiness["decision_recommended_data_range"] if decision_readiness else None,
        decision_recommended_timeframe=decision_readiness["decision_recommended_timeframe"] if decision_readiness else None,
        decision_readiness_action=decision_readiness["decision_readiness_action"] if decision_readiness else None,
        title=title,
        summary=str(parsed["summary"]),
        highlights=[str(item) for item in parsed["highlights"]],
        risks=(
            _merge_backtest_review_risks([str(item) for item in parsed["risks"]], context)
            if job_type == "generate_backtest_review"
            else _merge_execution_health_review_risks(
                [str(item) for item in parsed["risks"]],
                context if _has_meaningful_review_health_context(context) else None,
            )
        ),
        proposals=proposals,
        created_at=now_iso,
    )


def _merge_strategy_tracking_structured_parse(
    text: str, job_type: str, fallback: Dict[str, Any]
) -> Dict[str, Any]:
    if job_type == "review_strategy_issue":
        structured = OpenClawGatewayClient.parse_strategy_issue_review_response(text)
        summary_prefix = f"[{structured['severity']}] " if structured.get("severity") else ""
        highlights = [str(item) for item in structured.get("root_causes") or []]
        risks = [str(item) for item in structured.get("mitigations") or []]
        risks.extend(str(item) for item in structured.get("follow_ups") or [])
    elif job_type == "review_strategy_change":
        structured = OpenClawGatewayClient.parse_strategy_change_review_response(text)
        verdict = structured.get("verdict") or ""
        confidence = structured.get("confidence") or ""
        summary_prefix = f"[{verdict}/{confidence}] " if verdict or confidence else ""
        highlights = [str(item) for item in structured.get("highlights") or []]
        risks = [str(item) for item in structured.get("risks") or []]
        risks.extend(str(item) for item in structured.get("required_adjustments") or [])
    else:
        return fallback

    if not highlights and not risks:
        return fallback
    summary = str(structured.get("summary") or "").strip()
    if not summary:
        summary = str(fallback.get("summary") or "")
    return {
        "summary": f"{summary_prefix}{summary}".strip(),
        "highlights": highlights or [str(item) for item in fallback.get("highlights") or []],
        "risks": risks or [str(item) for item in fallback.get("risks") or []],
        "proposals": fallback.get("proposals") or [],
    }


def build_strategy_tracking_review_document(text: str, context: Dict[str, Any], job_type: str) -> ReviewDocument:
    fallback = parse_review_text(text)
    parsed = _merge_strategy_tracking_structured_parse(text, job_type, fallback)
    now = datetime.now(timezone.utc).astimezone()
    period = "strategy_issue" if job_type == "review_strategy_issue" else "strategy_change"
    title = (
        f"{now.strftime('%Y-%m-%d')} 策略问题跟踪"
        if job_type == "review_strategy_issue"
        else f"{now.strftime('%Y-%m-%d')} 策略变更跟踪"
    )
    return ReviewDocument(
        id=f"review-{uuid4().hex[:10]}",
        period=period,
        strategy_id=str(context.get("strategy_id") or "") or None,
        title=title,
        summary=str(parsed["summary"]),
        highlights=[str(item) for item in parsed["highlights"]],
        risks=_merge_execution_health_review_risks(
            [str(item) for item in parsed["risks"]],
            context if _has_meaningful_review_health_context(context) else None,
        ),
        proposals=[],
        created_at=now.isoformat(),
    )


def build_execution_impact_record_from_text(
    text: str,
    context: Dict[str, Any],
    source: str,
    job_id: str,
) -> ExecutionImpactRecord:
    parsed = OpenClawGatewayClient.parse_execution_impact_response(text)
    strategy_id = str(context.get("strategy_id") or "").strip()
    strategy_name = str(context.get("strategy_name") or "").strip() or strategy_id
    window_start = str(context.get("window_start") or "").strip()
    window_end = str(context.get("window_end") or "").strip()
    return repo.persist_execution_impact_record(
        strategy_id=strategy_id,
        strategy_name=strategy_name,
        window_start=window_start,
        window_end=window_end,
        summary=str(parsed.get("summary") or ""),
        impact_level=str(parsed.get("impact_level") or "moderate"),
        direction=str(parsed.get("direction") or "neutral"),
        affected_orders=[str(item) for item in parsed.get("affected_orders") or []],
        affected_positions=[str(item) for item in parsed.get("affected_positions") or []],
        metrics_deltas=[str(item) for item in parsed.get("metrics_deltas") or []],
        follow_up_checks=[str(item) for item in parsed.get("follow_up_checks") or []],
        raw_text=str(parsed.get("raw_text") or text or ""),
        agent_job_id=job_id,
        source=source,
    )


def build_fallback_review_document(job_context: Dict[str, Any], job_type: str = "generate_daily_review") -> ReviewDocument:
    state = repo.snapshot()
    now = datetime.now(timezone.utc).astimezone()
    strongest = max(state.watchlist, key=lambda item: item.change_24h)
    risks = [alert.title for alert in state.alerts if not alert.acknowledged][:2] or ["当前没有新的未处理风险提醒。"]
    if job_type == "generate_backtest_review":
        strategy_name = str(job_context.get("strategy_name") or "策略")
        metrics = job_context.get("metrics", {}) if isinstance(job_context.get("metrics"), dict) else {}
        reference_only = _is_reference_only_backtest_context(job_context)
        low_sample = _is_low_sample_backtest_context(job_context)
        trade_count = _get_backtest_trade_count(job_context)
        history_source = str(job_context.get("history_source") or "exchange_history").strip().lower()
        history_source_reason = _get_backtest_history_source_reason(job_context)
        history_source_detail = str(job_context.get("history_source_detail") or "").strip()
        history_source_plan = _resolve_history_source_recommendation(job_context)
        decision_readiness = _resolve_backtest_decision_readiness(job_context)
        requested_candle_estimate = int(job_context.get("requested_candle_estimate") or 0)
        requested_candle_limit = int(job_context.get("requested_candle_limit") or 0)
        requested_range_start = str(job_context.get("requested_range_start") or "").strip()
        requested_range_end = str(job_context.get("requested_range_end") or "").strip()
        retrieved_window_completion_pct = float(job_context.get("retrieved_window_completion_pct") or 0.0)
        used_window_completion_pct = float(job_context.get("used_window_completion_pct") or 0.0)
        retrieved_candle_count = int(job_context.get("retrieved_candle_count") or 0)
        used_candle_count = int(job_context.get("used_candle_count") or 0)
        history_truncated = bool(job_context.get("history_truncated"))
        source_change_request_id = str(job_context.get("source_change_request_id") or "").strip()
        source_backtest_id = str(job_context.get("source_backtest_id") or "").strip()
        source_review_id = str(job_context.get("source_review_id") or "").strip()
        source_proposal_id = str(job_context.get("source_proposal_id") or "").strip()
        trigger_reason = str(job_context.get("trigger_reason") or "").strip()
        highlights = [
            f"回测区间 {job_context.get('data_range', '未提供')}，时间粒度 {job_context.get('timeframe', '1h')}。",
            f"年化收益 {metrics.get('annual_return', '--')}，胜率 {metrics.get('win_rate', '--')}。",
        ]
        lineage_parts = []
        if trigger_reason:
            lineage_parts.append(f"触发原因 {trigger_reason}")
        if source_change_request_id:
            lineage_parts.append(f"来源变更 {source_change_request_id}")
        if source_backtest_id:
            lineage_parts.append(f"来源回测 {source_backtest_id}")
        if source_review_id:
            lineage_parts.append(f"来源复盘 {source_review_id}")
        if source_proposal_id:
            lineage_parts.append(f"来源提案 {source_proposal_id}")
        if lineage_parts:
            highlights.insert(1, f"来源链路：{'；'.join(lineage_parts)}。")
        if requested_range_start and requested_range_end:
            highlights.insert(2 if lineage_parts else 1, f"请求窗口 {requested_range_start} -> {requested_range_end}。")
        if history_source == "market_detail_fallback":
            fallback_highlight = "本次历史样本来自工作台行情快照回退，仍需在交易所历史恢复后重跑确认。"
            if history_source_reason == "exchange_fetch_failed":
                fallback_highlight = "本次交易所历史拉取报错，已回退到工作台行情快照样本，仍需在交易所历史恢复后重跑确认。"
            elif history_source_reason == "insufficient_exchange_samples":
                fallback_highlight = "本次交易所历史样本不足，已回退到工作台行情快照样本，仍需在补足样本后重跑确认。"
            if history_source_detail:
                fallback_highlight = f"{fallback_highlight} 原因：{history_source_detail}"
            highlights.append(fallback_highlight)
            if history_source_plan["recommended_action"]:
                highlights.append(f"来源建议：{history_source_plan['recommended_action']}")
        if retrieved_window_completion_pct > 0 or used_window_completion_pct > 0:
            highlights.append(
                f"窗口覆盖率：取样 {retrieved_window_completion_pct:.2f}% ，实际回测 {used_window_completion_pct:.2f}%。"
            )
        if reference_only:
            highlights[-1] = f"当前区间未命中真实入场信号，参考路径年化 {metrics.get('annual_return', '--')}。"
        elif low_sample:
            highlights[-1] = f"当前仅产生 {trade_count} 笔真实成交，样本量偏小，年化 {metrics.get('annual_return', '--')} 仍需继续验证。"
        if history_truncated and used_candle_count > 0:
            highlights.append(
                f"本次目标区间理论需要约 {requested_candle_estimate or requested_candle_limit or retrieved_candle_count} 根 K 线，"
                f"当前回测样本上限为 {requested_candle_limit or retrieved_candle_count} 根，最终使用最近 {used_candle_count} 根样本。"
            )
        if decision_readiness["decision_readiness_detail"]:
            highlights.append(f"结论门禁：{decision_readiness['decision_readiness_detail']}")
        if decision_readiness["decision_recommended_data_range"] and decision_readiness["decision_recommended_timeframe"]:
            highlights.append(
                f"门禁重跑：{decision_readiness['decision_recommended_data_range']} @ {decision_readiness['decision_recommended_timeframe']}。"
            )
        if decision_readiness["decision_readiness_action"]:
            highlights.append(f"门禁建议：{decision_readiness['decision_readiness_action']}")
        return ReviewDocument(
            id=f"review-{uuid4().hex[:10]}",
            period="backtest",
            strategy_id=str(job_context.get("strategy_id") or "") or None,
            backtest_id=str(job_context.get("backtest_id") or "") or None,
            source_change_request_id=source_change_request_id or None,
            source_backtest_id=source_backtest_id or None,
            source_review_id=source_review_id or None,
            source_proposal_id=source_proposal_id or None,
            trigger_reason=trigger_reason or None,
            decision_readiness=decision_readiness["decision_readiness"],
            decision_readiness_detail=decision_readiness["decision_readiness_detail"],
            decision_recommended_data_range=decision_readiness["decision_recommended_data_range"],
            decision_recommended_timeframe=decision_readiness["decision_recommended_timeframe"],
            decision_readiness_action=decision_readiness["decision_readiness_action"],
            title=f"{now.strftime('%Y-%m-%d')} 回测 AI 复盘",
            summary=f"{strategy_name} 的回测已完成，本地回退逻辑已生成风险与后续验证建议。",
            highlights=highlights,
            risks=_merge_backtest_review_risks([
                f"最大回撤 {metrics.get('max_drawdown', '--')}，需要结合真实滑点继续验证。",
                "当前复盘来自本地回退逻辑，建议后续再由 OpenClaw 补全策略建议。",
            ], job_context),
            proposals=build_review_proposals(job_type, job_context),
            created_at=now.isoformat(),
        )
    return ReviewDocument(
        id=f"review-{uuid4().hex[:10]}",
        period="daily",
        strategy_id=str(job_context.get("strategy_id") or "") or None,
        title=f"{now.strftime('%Y-%m-%d')} 日度 AI 复盘",
        summary=f"{strongest.symbol} 仍是当前波动主轴，系统已按本地回退逻辑完成复盘生成。",
        highlights=[
            f"{strongest.symbol} 24h 变化 {strongest.change_24h:+.2f}%，继续作为重点观察品种。",
            f"当前 AI 调度队列 {state.control_snapshot.scheduler.queue_depth} 个任务。",
        ],
        risks=_merge_execution_health_review_risks(risks),
        proposals=build_review_proposals(job_type, job_context),
        created_at=now.isoformat(),
    )


def build_fallback_agent_result(job_context: Dict[str, Any], job_type: str) -> str:
    if job_type == "review_strategy_change":
        strategy_name = str(job_context.get("strategy_name") or job_context.get("strategy_id") or "策略")
        change_summary = str(job_context.get("summary") or "已落实一项策略变更。")
        activity = job_context.get("review_strategy_activity") or {}
        if not isinstance(activity, dict):
            activity = {}
        runtime = activity.get("runtime") or {}
        if not isinstance(runtime, dict):
            runtime = {}
        guard_state = str(runtime.get("guard_state") or "none")
        active_order_count = int(activity.get("active_order_count") or 0)
        return (
            f"{strategy_name} 变更已写回控制端，当前摘要：{change_summary}"
            f"；运行门禁 {guard_state}，活跃委托 {active_order_count} 笔，建议继续观察最近活动与执行健康。"
        )[:160]
    if job_type == "review_strategy_issue":
        strategy_name = str(job_context.get("strategy_name") or job_context.get("strategy_id") or "策略")
        issue_summary = str(job_context.get("summary") or "检测到一项策略执行问题。")
        detail = str(job_context.get("detail") or "建议继续观察最近活动与执行健康。")
        activity = job_context.get("review_strategy_activity") or {}
        if not isinstance(activity, dict):
            activity = {}
        runtime = activity.get("runtime") or {}
        if not isinstance(runtime, dict):
            runtime = {}
        guard_state = str(runtime.get("guard_state") or "none")
        return (
            f"{strategy_name} 问题跟踪：{issue_summary}"
            f"；当前门禁 {guard_state}，详情 {detail}"
        )[:160]
    return str(job_context.get("summary") or "OpenClaw 不可用，已使用本地回退完成任务摘要。")


def update_agent_worker_state(**updates: Any) -> None:
    agent_worker_state.update(updates)
    agent_worker_state["last_worker_event_at"] = datetime.now(timezone.utc).astimezone().isoformat()


def run_agent_worker_loop() -> None:
    last_status_probe = 0.0
    update_agent_worker_state(running=True)
    while not agent_worker_stop_event.is_set():
        try:
            if time.monotonic() - last_status_probe >= 20:
                status = openclaw.get_status(worker_state=agent_worker_state)
                repo.set_openclaw_connection(status.reachable)
                update_agent_worker_state(running=True)
                last_status_probe = time.monotonic()

            job = repo.claim_next_agent_job()
            if job is None:
                time.sleep(1.5)
                continue

            update_agent_worker_state(
                running=True,
                active_job_id=job.id,
                last_job_id=job.id,
                last_job_status="running",
                last_job_summary=f"{job.job_type} 执行中",
            )
            prompt = build_agent_job_prompt(job.job_type, job.context)
            result = openclaw.run_agent_turn_cancelable(
                message=prompt,
                timeout=job.timeout,
                should_cancel=lambda: repo.should_cancel_agent_job(job.id),
            )
            if result.get("ok"):
                repo.set_openclaw_connection(True)
                text = str(result.get("text") or "OpenClaw 已完成任务。")
                if job.job_type in {"generate_daily_review", "generate_backtest_review"}:
                    review = build_review_document_from_text(text, job.context, source="openclaw", job_type=job.job_type)
                    repo.complete_agent_job(job.id, result_summary=text[:160], review=review, source="openclaw")
                elif job.job_type in {"review_strategy_change", "review_strategy_issue"}:
                    review = build_strategy_tracking_review_document(text, job.context, job.job_type)
                    repo.complete_agent_job(job.id, result_summary=text[:160], review=review, source="openclaw")
                elif job.job_type == "reconcile_change_request":
                    outcome = apply_reconcile_change_request_outcome_from_text(
                        job.context,
                        text,
                        source="openclaw",
                    )
                    repo.complete_agent_job(
                        job.id,
                        result_summary=outcome.get("summary", text[:160])[:160],
                        review=None,
                        source="openclaw",
                    )
                elif job.job_type == "summarize_execution_impact":
                    record = build_execution_impact_record_from_text(
                        text,
                        job.context,
                        source="openclaw",
                        job_id=job.id,
                    )
                    repo.complete_agent_job(
                        job.id,
                        result_summary=(record.summary or text[:160])[:160],
                        review=None,
                        source="openclaw",
                        execution_impact_record=record,
                    )
                else:
                    repo.complete_agent_job(job.id, result_summary=text[:160], review=None, source="openclaw")
                update_agent_worker_state(
                    active_job_id=None,
                    last_job_id=job.id,
                    last_job_status="completed",
                    last_job_summary=text[:160],
                )
            elif result.get("cancelled"):
                update_agent_worker_state(
                    active_job_id=None,
                    last_job_id=job.id,
                    last_job_status="cancelled",
                    last_job_summary="任务已由控制端终止。",
                )
            elif job.job_type in {"generate_daily_review", "generate_backtest_review"}:
                repo.set_openclaw_connection(False)
                review = build_fallback_review_document(job.context, job_type=job.job_type)
                repo.complete_agent_job(
                    job.id,
                    result_summary=str(result.get("error") or "OpenClaw 不可用，已使用本地回退生成复盘。"),
                    review=review,
                    source="local_fallback",
                )
                update_agent_worker_state(
                    active_job_id=None,
                    last_job_id=job.id,
                    last_job_status="completed",
                    last_job_summary=str(result.get("error") or "已使用本地回退生成复盘。"),
                )
            elif job.job_type in {"review_strategy_change", "review_strategy_issue"}:
                repo.set_openclaw_connection(False)
                summary = build_fallback_agent_result(job.context, job.job_type)
                review = build_strategy_tracking_review_document(summary, job.context, job.job_type)
                repo.complete_agent_job(
                    job.id,
                    result_summary=summary,
                    review=review,
                    source="local_fallback",
                )
                update_agent_worker_state(
                    active_job_id=None,
                    last_job_id=job.id,
                    last_job_status="completed",
                    last_job_summary=summary,
                )
            else:
                repo.set_openclaw_connection(False)
                repo.fail_agent_job(job.id, str(result.get("error") or "OpenClaw 任务执行失败。"))
                update_agent_worker_state(
                    active_job_id=None,
                    last_job_id=job.id,
                    last_job_status="failed",
                    last_job_summary=str(result.get("error") or "OpenClaw 任务执行失败。"),
                )
        except Exception as exc:  # pragma: no cover - background loop safety
            try:
                repo.add_event(
                    event_type="openclaw.worker.error",
                    source="local_fallback",
                    severity=EventSeverity.WARNING,
                    payload={"error": str(exc)},
                )
                repo._persist()  # type: ignore[attr-defined]
                update_agent_worker_state(
                    active_job_id=None,
                    last_job_status="failed",
                    last_job_summary=str(exc),
                )
            except Exception:
                pass
            time.sleep(2.0)


def probe_private_trade_route() -> BybitTradeProbeResult:
    status = private_data.get_status()
    if not status.can_query_private:
        return BybitTradeProbeResult(
            configured=False,
            authenticated=False,
            trade_permission=None,
            outcome="not_configured",
            detail="未检测到 Bybit 私有 API 配置，无法探测真实下单链路。",
            tested_at=status.updated_at,
        )

    try:
        result = private_data.probe_trade_route()
    except RuntimeError as exc:
        return BybitTradeProbeResult(
            configured=True,
            authenticated=False,
            trade_permission=None,
            outcome="network_error",
            detail=str(exc),
            tested_at=status.updated_at,
        )

    return BybitTradeProbeResult(
        configured=True,
        authenticated=result["outcome"] != "permission_denied",
        trade_permission=result.get("trade_permission"),
        outcome=result["outcome"],
        detail=result["ret_msg"] or "Bybit 交易链路探测已完成。",
        ret_code=result.get("ret_code"),
        order_link_id=result.get("order_link_id"),
        tested_at=result["tested_at"],
    )



def build_health_payload() -> dict:
    state = repo.snapshot()
    return {
        "ok": True,
        "service": "control-api",
        "watchlist_count": len(state.watchlist),
        "strategy_count": len(state.strategies),
        "openclaw_connected": state.control_snapshot.scheduler.openclaw_connected,
    }


def format_sse(data: Dict[str, Any], event: str = "snapshot") -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@app.get("/health")
def health() -> dict:
    return build_health_payload()


@app.head("/health")
def health_head() -> dict:
    return build_health_payload()


@app.get("/api/control/snapshot")
def get_control_snapshot():
    _sync_strategy_runtime_worker_issue_alerts()
    _sync_public_execution_channel_alerts()
    _sync_private_execution_channel_alerts()
    return _build_control_snapshot_response()


@app.get("/metrics", response_class=PlainTextResponse)
def get_prometheus_metrics():
    return PlainTextResponse(build_prometheus_metrics())


@app.get("/api/market/watchlist")
def get_watchlist(refresh: bool = False):
    watchlist = (
        market_data.enrich_watchlist(repo.snapshot().watchlist)
        if refresh
        else market_data.enrich_watchlist_fast(repo.snapshot().watchlist)
    )
    repo.sync_market_watchlist(watchlist)
    return watchlist


@app.post("/api/market/watchlist", response_model=WatchlistInstrument)
def add_watchlist_item(payload: WatchlistCreatePayload):
    try:
        item, detail = build_watchlist_item(payload.symbol, payload.market)
        saved = repo.add_watchlist_item(item, payload.requested_by, detail_override=detail)
        if hasattr(market_data, "update_realtime_watchlist"):
            market_data.update_realtime_watchlist(repo.snapshot().watchlist)
        return saved
    except RuntimeError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.delete("/api/market/watchlist/{symbol}", response_model=WatchlistRemoveResult)
def remove_watchlist_item(symbol: str, requested_by: str = "desktop_operator"):
    try:
        removed = repo.remove_watchlist_item(symbol, requested_by=requested_by)
        if hasattr(market_data, "update_realtime_watchlist"):
            market_data.update_realtime_watchlist(repo.snapshot().watchlist)
        return removed
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"自选品种不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/market/live", response_model=MarketLiveSnapshot)
def get_market_live_snapshot(symbol: str, timeframe: str = "1h"):
    return build_market_live_snapshot_payload(symbol, timeframe=timeframe)


@app.get("/api/market/stream")
async def stream_market_live(symbol: str, timeframe: str = "1h", once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000
    try:
        normalized_timeframe = market_data.normalize_timeframe(timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(
                build_market_live_snapshot_payload,
                symbol,
                normalized_timeframe,
            )
            yield format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/market/{symbol}")
def get_market_detail(symbol: str, timeframe: str = "1h"):
    state = repo.snapshot()
    uppercase_symbol = symbol.upper()
    try:
        normalized_timeframe = market_data.normalize_timeframe(timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    watch_item = next((item for item in state.watchlist if item.symbol == uppercase_symbol), None)
    detail = state.market_details.get(uppercase_symbol)
    market = watch_item.market if watch_item is not None else detail.market if detail is not None else None
    if market is None:
        raise HTTPException(status_code=404, detail="找不到该品种")
    fallback_detail = build_runtime_market_fallback_detail(
        symbol=uppercase_symbol,
        market=market,
        timeframe=normalized_timeframe,
        watch_item=watch_item,
        base_detail=detail,
    )
    try:
        return market_data.enrich_market_detail(
            symbol=uppercase_symbol,
            market=market,
            fallback_detail=fallback_detail,
            watch_item=watch_item,
            timeframe=normalized_timeframe,
        )
    except RuntimeError as exc:
        return build_runtime_market_fallback_detail(
            symbol=uppercase_symbol,
            market=market,
            timeframe=normalized_timeframe,
            watch_item=watch_item,
            base_detail=detail,
            failure_reason=str(exc),
        )


def build_manual_strategy_review_job(strategy_id: str, payload: StrategyTrackingReviewRequest) -> AgentJobCreate:
    state = repo.snapshot()
    strategy = next((item for item in state.strategies if item.id == strategy_id), None)
    if strategy is None:
        raise KeyError(strategy_id)

    summary = payload.summary.strip()
    if not summary:
        raise ValueError("跟踪摘要不能为空。")

    detail = (payload.detail or "").strip() or None
    symbol = strategy.symbols[0] if strategy.symbols else "--"
    request_key = (payload.request_key or "").strip() or uuid4().hex[:12]
    base_context = enrich_review_job_context({
        "strategy_id": strategy.id,
        "strategy_name": strategy.name,
        "symbol": symbol,
        "mode": strategy.mode.value,
        "summary": summary,
        "detail": detail,
        "requested_by": payload.requested_by,
        "requested_at": datetime.now(timezone.utc).astimezone().isoformat(),
        "review_strategy_activity": _build_strategy_activity_review_context(strategy.id),
    })
    if payload.review_kind == "issue":
        return AgentJobCreate(
            job_type="review_strategy_issue",
            context={
                **base_context,
                "issue_type": "manual_issue_review",
            },
            allowed_actions=["review_strategy_issue", "summarize_execution_impact"],
            timeout=75,
            idempotency_key=f"strategy-manual-review:{strategy.id}:issue:{request_key}",
            writeback_target="strategy_activity",
        )

    return AgentJobCreate(
        job_type="review_strategy_change",
        context={
            **base_context,
            "change_type": "manual_change_review",
        },
        allowed_actions=["review_strategy_change", "summarize_execution_impact"],
        timeout=75,
        idempotency_key=f"strategy-manual-review:{strategy.id}:change:{request_key}",
        writeback_target="strategy_activity",
    )

def build_private_execution_preview(payload: ExecutionPreviewRequest) -> ExecutionPreview:
    return _build_private_execution_preview_impl(
        payload,
        repo=repo,
        format_usdt=format_usdt,
        resolve_private_mode_access=resolve_private_mode_access,
        load_private_wallet_snapshot=load_private_wallet_snapshot,
        load_private_positions_snapshot=load_private_positions_snapshot,
        build_position_records=build_position_records,
        parse_metric_number=parse_metric_number,
        parse_open_orders=parse_open_orders,
        calculate_private_perp_balance_delta_notional=_calculate_private_perp_balance_delta_notional,
        private_wallet_available_spot_quantity=_private_wallet_available_spot_quantity,
        private_released_spot_sell_reservation=_private_released_spot_sell_reservation,
        validate_exchange_order_constraints=_validate_exchange_order_constraints,
        build_private_insufficient_balance_reason=_build_private_insufficient_balance_reason,
        build_private_insufficient_balance_recommended_action=_build_private_insufficient_balance_recommended_action,
        build_private_spot_inventory_recommended_action=_build_private_spot_inventory_recommended_action,
        build_exchange_constraint_recommended_action=_build_exchange_constraint_recommended_action,
        build_execution_preview_recommended_action=_build_execution_preview_recommended_action,
        private_order_reserves_private_balance=_private_order_reserves_private_balance,
    )

def _resolve_strategy_parameter_snapshot(strategy_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if not strategy_id:
        return None
    strategy = next(
        (item for item in repo.snapshot().strategies if item.id == strategy_id),
        None,
    )
    if strategy is None:
        return None
    return parameter_resolver.snapshot_parameters(strategy)

def submit_exchange_order(
    payload: ManualOrderRequest,
    *,
    origin: str = "manual",
    strategy_id: Optional[str] = None,
    requested_by: str = "desktop_operator",
) -> OrderRecord:
    status, access_error = resolve_private_mode_access(payload.mode)
    if access_error is not None:
        raise RuntimeError(access_error)

    preview = build_private_execution_preview(
        ExecutionPreviewRequest(
            symbol=payload.symbol,
            market=payload.market,
            mode=payload.mode,
            side=payload.side,
            quantity=payload.quantity,
            price=payload.price,
            origin="manual",
            note=payload.note,
        )
    )
    # Round 67 — route the submit-side preview check through ``RiskDecision``
    # so the raised message reuses the same Chinese fallback as every other
    # block surface.
    submit_decision = evaluate_risk_decision(preview)
    if submit_decision.verdict == "block":
        raise RuntimeError(submit_decision.reason_detail)

    reduce_only = _execution_preview_requires_reduce_only(preview)
    if origin == "strategy" and strategy_id:
        order_link_id = f"strategy-{payload.mode.value}-{strategy_id}-{uuid4().hex[:8]}"
    else:
        order_link_id = f"{origin}-{payload.mode.value}-{uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).astimezone().isoformat()
    created_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    body = {
        "category": "spot" if payload.market == "spot" else "linear",
        "symbol": payload.symbol.upper(),
        "side": "Buy" if payload.side == Direction.BUY else "Sell",
        "orderType": "Limit",
        "qty": serialize_decimal(payload.quantity),
        "price": serialize_decimal(payload.price),
        "timeInForce": "GTC",
        "orderLinkId": order_link_id,
    }
    if payload.market == "perp":
        body["reduceOnly"] = reduce_only
    result = private_data.create_order(body)
    order_id = str(result.get("orderId") or order_link_id)
    order_status = str(result.get("orderStatus") or "New")

    if hasattr(private_realtime, "get_open_orders_snapshot") and hasattr(private_realtime, "seed_open_orders_snapshot"):
        current_orders = private_realtime.get_open_orders_snapshot() or []
        next_orders = [
            item
            for item in current_orders
            if str(item.get("orderId") or "") != order_id
        ]
        next_orders.insert(
            0,
            {
                "orderId": order_id,
                "orderLinkId": order_link_id,
                "symbol": payload.symbol.upper(),
                "category": body["category"],
                "side": body["side"],
                "orderType": body["orderType"],
                "qty": body["qty"],
                "price": body["price"],
                "orderStatus": order_status,
                "createdTime": str(created_time_ms),
                "reduceOnly": body.get("reduceOnly"),
            },
        )
        private_realtime.seed_open_orders_snapshot(next_orders)

    upsert_private_order_history_cache(
        status,
        [
            {
                "orderId": order_id,
                "orderLinkId": order_link_id,
                "symbol": payload.symbol.upper(),
                "category": body["category"],
                "side": body["side"],
                "orderType": body["orderType"],
                "qty": body["qty"],
                "price": body["price"],
                "orderStatus": order_status,
                "createdTime": str(created_time_ms),
            }
        ],
    )
    remember_private_order_metadata(
        order_id,
        origin=origin,
        strategy_id=strategy_id,
        requested_by=requested_by,
        note=payload.note,
    )

    repo.add_event(
        event_type="exchange_order.created",
        source="quant-core",
        severity=EventSeverity.INFO,
        payload={
            "origin": origin,
            "strategy_id": strategy_id,
            "mode": payload.mode.value,
            "symbol": payload.symbol.upper(),
            "market": payload.market,
            "side": payload.side.value,
            "quantity": payload.quantity,
            "price": payload.price,
            "order_id": order_id,
            "order_link_id": order_link_id,
            "account_mode": status.mode.value,
            "note": payload.note,
        },
        symbol=payload.symbol.upper(),
        strategy_id=strategy_id,
        parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
    )
    repo._persist()  # type: ignore[attr-defined]

    return OrderRecord(
        source="bybit_private",
        origin=origin,
        strategy_id=strategy_id,
        order_id=order_id,
        symbol=payload.symbol.upper(),
        market=payload.market,
        side=payload.side,
        order_type="Limit",
        qty=serialize_decimal(payload.quantity),
        price=serialize_decimal(payload.price),
        status=order_status,
        created_at=created_at,
    )

def cancel_exchange_order(order_id: str, requested_by: str, mode: Optional[AccountMode] = None) -> OrderRecord:
    selected_mode = mode or repo.snapshot().workspace_preferences.selected_mode
    status, access_error = resolve_private_mode_access(selected_mode)
    if selected_mode == AccountMode.PAPER:
        raise RuntimeError("当前工作台处于 Paper 模式，请使用本地 Paper 撤单接口。")
    if access_error is not None:
        raise RuntimeError(access_error)

    orders = parse_open_orders(use_private_only=True)
    target = next((item for item in orders if item.order_id == order_id), None)
    if target is None:
        raise KeyError(order_id)

    body = {
        "category": "spot" if target.market == "spot" else "linear",
        "symbol": target.symbol,
        "orderId": target.order_id,
    }
    result = private_data.cancel_order(body)
    cancelled_order_id = str(result.get("orderId") or target.order_id)
    remember_private_order_metadata(
        cancelled_order_id,
        origin=target.origin,
        strategy_id=target.strategy_id,
        requested_by=requested_by,
    )

    if hasattr(private_realtime, "get_open_orders_snapshot") and hasattr(private_realtime, "seed_open_orders_snapshot"):
        next_orders = [
            item
            for item in (private_realtime.get_open_orders_snapshot() or [])
            if str(item.get("orderId") or "") != cancelled_order_id
        ]
        private_realtime.seed_open_orders_snapshot(next_orders)

    upsert_private_order_history_cache(
        status,
        [
            {
                "orderId": cancelled_order_id,
                "symbol": target.symbol,
                "category": "spot" if target.market == "spot" else "linear",
                "side": "Buy" if target.side == Direction.BUY else "Sell",
                "orderType": target.order_type,
                "qty": target.qty.replace(",", ""),
                "price": target.price.replace(",", ""),
                "orderStatus": "Cancelled",
                "createdTime": str(
                    int(datetime.fromisoformat(target.created_at).astimezone(timezone.utc).timestamp() * 1000)
                ),
            }
        ],
    )

    repo.add_event(
        event_type="exchange_order.cancelled",
        source="desktop",
        severity=EventSeverity.WARNING,
        payload={
            "mode": status.mode.value,
            "order_id": cancelled_order_id,
            "symbol": target.symbol,
            "market": target.market,
            "origin": target.origin,
            "strategy_id": target.strategy_id,
            "requested_by": requested_by,
        },
        symbol=target.symbol,
        strategy_id=target.strategy_id,
        parameter_snapshot=_resolve_strategy_parameter_snapshot(target.strategy_id),
    )
    repo._persist()  # type: ignore[attr-defined]

    return target.model_copy(update={"status": "Cancelled"})

def cancel_all_exchange_orders(requested_by: str) -> PaperOrderBulkCancelResult:
    selected_mode = repo.snapshot().workspace_preferences.selected_mode
    status, access_error = resolve_private_mode_access(selected_mode)
    if selected_mode == AccountMode.PAPER:
        raise RuntimeError("当前工作台处于 Paper 模式，请使用本地 Paper 全撤接口。")
    if access_error is not None:
        raise RuntimeError(access_error)

    orders = parse_open_orders(use_private_only=True)
    if not orders:
        return PaperOrderBulkCancelResult(
            cancelled_count=0,
            cancelled_order_ids=[],
            requested_by=requested_by,
            updated_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )

    grouped_requests: Dict[tuple[str, str], Dict[str, str]] = {}
    for order in orders:
        key = (order.market, order.symbol)
        grouped_requests[key] = {
            "category": "spot" if order.market == "spot" else "linear",
            "symbol": order.symbol,
        }

    for body in grouped_requests.values():
        private_data.cancel_all_orders(body)

    for order in orders:
        remember_private_order_metadata(
            order.order_id,
            origin=order.origin,
            strategy_id=order.strategy_id,
            requested_by=requested_by,
        )

    cancelled_order_ids = [order.order_id for order in orders]
    if hasattr(private_realtime, "seed_open_orders_snapshot"):
        private_realtime.seed_open_orders_snapshot([])

    upsert_private_order_history_cache(
        status,
        [
            {
                "orderId": order.order_id,
                "symbol": order.symbol,
                "category": "spot" if order.market == "spot" else "linear",
                "side": "Buy" if order.side == Direction.BUY else "Sell",
                "orderType": order.order_type,
                "qty": order.qty.replace(",", ""),
                "price": order.price.replace(",", ""),
                "orderStatus": "Cancelled",
                "createdTime": str(
                    int(datetime.fromisoformat(order.created_at).astimezone(timezone.utc).timestamp() * 1000)
                ),
            }
            for order in orders
        ],
    )

    repo.add_event(
        event_type="exchange_order.cancelled_all",
        source="desktop",
        severity=EventSeverity.WARNING,
        payload={
            "mode": status.mode.value,
            "requested_by": requested_by,
            "cancelled_count": len(cancelled_order_ids),
            "cancelled_order_ids": cancelled_order_ids,
            "origins": [order.origin for order in orders],
            "strategy_ids": [order.strategy_id for order in orders if order.strategy_id],
        },
    )
    repo._persist()  # type: ignore[attr-defined]
    return PaperOrderBulkCancelResult(
        cancelled_count=len(cancelled_order_ids),
        cancelled_order_ids=cancelled_order_ids,
        requested_by=requested_by,
        updated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )

def _market_reference_price(symbol: str, market: str) -> float:
    ticker = market_data.get_ticker(symbol.upper(), market)
    price = coerce_float(ticker.get("lastPrice"), 0.0)
    if price <= 0:
        raise RuntimeError(f"{symbol.upper()} 当前缺少可用行情，无法生成平仓委托。")
    return price

def _resolve_spot_close_quantity(symbol: str, position_qty: float) -> float:
    upper_symbol = symbol.upper()
    available_qty: Optional[float] = None
    wallet_snapshot: Optional[Dict[str, Any]] = None
    try:
        _wallet_status, wallet_snapshot, _wallet_updated_at = load_private_wallet_snapshot()
    except RuntimeError:
        wallet_snapshot = None

    if wallet_snapshot is not None:
        available_qty = _private_wallet_available_spot_quantity(wallet_snapshot, symbol=upper_symbol)

    if available_qty is None:
        open_orders = _load_private_open_order_records_for_preview()
        reserved_qty = _private_reserved_spot_sell_quantity(open_orders, symbol=upper_symbol)
        available_qty = max(position_qty - reserved_qty, 0.0)

    if available_qty <= 1e-9:
        raise RuntimeError(
            f"{upper_symbol} 当前现货可用数量为 0，可能已被未成交卖单占用或其他冻结量占用，请先撤销相关挂单后再平仓。"
        )
    if available_qty + 1e-9 < position_qty:
        raise RuntimeError(
            f"{upper_symbol} 当前现货仅有 {repo._format_quantity(available_qty, 6)} 可用于平仓，"
            f"低于持仓数量 {repo._format_quantity(position_qty, 6)}；请先撤销相关挂单后再平仓。"
        )
    return position_qty

def _prepare_exchange_close_order(target: PositionRecord) -> Dict[str, Any]:
    quantity = coerce_float(str(target.size).replace(",", ""), 0.0)
    if quantity <= 0:
        raise RuntimeError(f"{target.symbol.upper()} 当前没有可平的真实持仓。")
    if target.market == "spot":
        quantity = _resolve_spot_close_quantity(target.symbol, quantity)
    price = _market_reference_price(target.symbol, target.market)
    side = Direction.SELL if target.side == "long" else Direction.BUY
    return {
        "quantity": quantity,
        "price": price,
        "side": side,
    }

def _submit_exchange_close_order(
    *,
    target: PositionRecord,
    quantity: float,
    price: float,
    side: Direction,
    status: BybitPrivateStatus,
    requested_by: str,
) -> OrderRecord:
    selected_mode = repo.snapshot().workspace_preferences.selected_mode
    order_link_id = f"close-{selected_mode.value}-{uuid4().hex[:12]}"
    created_at = datetime.now(timezone.utc).astimezone().isoformat()
    created_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
    body = {
        "category": "spot" if target.market == "spot" else "linear",
        "symbol": target.symbol,
        "side": "Buy" if side == Direction.BUY else "Sell",
        "orderType": "Limit",
        "qty": serialize_decimal(quantity),
        "price": serialize_decimal(price),
        "timeInForce": "GTC",
        "orderLinkId": order_link_id,
    }
    if target.market == "perp":
        body["reduceOnly"] = True

    result = private_data.create_order(body)
    order_id = str(result.get("orderId") or order_link_id)
    order_status = str(result.get("orderStatus") or "New")
    remember_private_order_metadata(
        order_id,
        origin="manual",
        requested_by=requested_by,
    )

    if hasattr(private_realtime, "get_open_orders_snapshot") and hasattr(private_realtime, "seed_open_orders_snapshot"):
        current_orders = private_realtime.get_open_orders_snapshot() or []
        next_orders = [item for item in current_orders if str(item.get("orderId") or "") != order_id]
        next_orders.insert(
            0,
            {
                "orderId": order_id,
                "orderLinkId": order_link_id,
                "symbol": target.symbol,
                "category": body["category"],
                "side": body["side"],
                "orderType": body["orderType"],
                "qty": body["qty"],
                "price": body["price"],
                "orderStatus": order_status,
                "createdTime": str(created_time_ms),
            },
        )
        private_realtime.seed_open_orders_snapshot(next_orders)

    upsert_private_order_history_cache(
        status,
        [
            {
                "orderId": order_id,
                "orderLinkId": order_link_id,
                "symbol": target.symbol,
                "category": body["category"],
                "side": body["side"],
                "orderType": body["orderType"],
                "qty": body["qty"],
                "price": body["price"],
                "orderStatus": order_status,
                "createdTime": str(created_time_ms),
            }
        ],
    )

    repo.add_event(
        event_type="exchange_position.close_submitted",
        source="desktop",
        severity=EventSeverity.INFO,
        payload={
            "mode": status.mode.value,
            "requested_by": requested_by,
            "symbol": target.symbol,
            "market": target.market,
            "position_side": target.side,
            "origin": "manual",
            "quantity": quantity,
            "price": price,
            "order_id": order_id,
            "order_link_id": order_link_id,
        },
        symbol=target.symbol,
    )
    repo._persist()  # type: ignore[attr-defined]
    return OrderRecord(
        source="bybit_private",
        origin="manual",
        order_id=order_id,
        symbol=target.symbol,
        market=target.market,
        side=side,
        order_type="Limit",
        qty=serialize_decimal(quantity),
        price=serialize_decimal(price),
        status=order_status,
        created_at=created_at,
    )

def close_exchange_position(symbol: str, requested_by: str) -> OrderRecord:
    selected_mode = repo.snapshot().workspace_preferences.selected_mode
    status, access_error = resolve_private_mode_access(selected_mode)
    if selected_mode == AccountMode.PAPER:
        raise RuntimeError("当前工作台处于 Paper 模式，请使用本地 Paper 平仓接口。")
    if access_error is not None:
        raise RuntimeError(access_error)

    positions = parse_positions(use_private_only=True)
    matched_positions = [item for item in positions if item.symbol == symbol.upper()]
    if not matched_positions:
        raise KeyError(symbol.upper())
    if len(matched_positions) > 1:
        markets = " / ".join(sorted({item.market for item in matched_positions}))
        raise RuntimeError(
            f"{symbol.upper()} 当前同时存在多个市场持仓（{markets}），单笔平仓接口无法安全判定目标市场，请改用批量全平或先收敛到单一市场持仓后再操作。"
        )
    target = matched_positions[0]

    prepared = _prepare_exchange_close_order(target)
    return _submit_exchange_close_order(
        target=target,
        quantity=float(prepared["quantity"]),
        price=float(prepared["price"]),
        side=prepared["side"],
        status=status,
        requested_by=requested_by,
    )

def close_all_exchange_positions(requested_by: str) -> ExchangePositionBulkCloseResult:
    selected_mode = repo.snapshot().workspace_preferences.selected_mode
    status, access_error = resolve_private_mode_access(selected_mode)
    if selected_mode == AccountMode.PAPER:
        raise RuntimeError("当前工作台处于 Paper 模式，请使用本地 Paper 全平接口。")
    if access_error is not None:
        raise RuntimeError(access_error)

    positions = parse_positions(use_private_only=True)
    if not positions:
        return ExchangePositionBulkCloseResult(
            submitted_count=0,
            order_ids=[],
            requested_by=requested_by,
            updated_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )

    prepared_positions = [
        (
            position,
            _prepare_exchange_close_order(position),
        )
        for position in positions
    ]

    submitted_orders: List[OrderRecord] = []
    for position, prepared in prepared_positions:
        submitted_orders.append(
            _submit_exchange_close_order(
                target=position,
                quantity=float(prepared["quantity"]),
                price=float(prepared["price"]),
                side=prepared["side"],
                status=status,
                requested_by=requested_by,
            )
        )

    repo.add_event(
        event_type="exchange_position.close_all_submitted",
        source="desktop",
        severity=EventSeverity.INFO,
        payload={
            "mode": status.mode.value,
            "requested_by": requested_by,
            "submitted_count": len(submitted_orders),
            "order_ids": [item.order_id for item in submitted_orders],
            "symbols": [item.symbol for item in submitted_orders],
        },
    )
    repo._persist()  # type: ignore[attr-defined]
    return ExchangePositionBulkCloseResult(
        submitted_count=len(submitted_orders),
        order_ids=[item.order_id for item in submitted_orders],
        requested_by=requested_by,
        updated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )

def replace_exchange_order(
    order_id: str,
    quantity: float,
    price: float,
    requested_by: str,
    mode: Optional[AccountMode] = None,
) -> OrderRecord:
    selected_mode = mode or repo.snapshot().workspace_preferences.selected_mode
    status, access_error = resolve_private_mode_access(selected_mode)
    if selected_mode == AccountMode.PAPER:
        raise RuntimeError("当前工作台处于 Paper 模式，请使用本地 Paper 改单接口。")
    if access_error is not None:
        raise RuntimeError(access_error)

    ensure_private_realtime_started()
    raw_orders = private_realtime.get_open_orders_snapshot() if hasattr(private_realtime, "get_open_orders_snapshot") else []
    if not raw_orders:
        raw_orders = private_data.fetch_open_orders()
        if hasattr(private_realtime, "seed_open_orders_snapshot"):
            private_realtime.seed_open_orders_snapshot(raw_orders)

    raw_target = next(
        (
            item
            for item in raw_orders
            if str(item.get("orderId") or "") == order_id
        ),
        None,
    )
    if raw_target is None:
        raise KeyError(order_id)

    target = build_order_records([raw_target])[0]
    preview = build_private_execution_preview(
        ExecutionPreviewRequest(
            symbol=target.symbol,
            market=target.market,
            mode=selected_mode,
            side=target.side,
            quantity=quantity,
            price=price,
            origin="manual",
            exclude_order_id=order_id,
        )
    )
    # Round 67 — route replace-side preview check through ``RiskDecision`` so
    # it matches the submit-side pattern.
    replace_decision = evaluate_risk_decision(preview)
    if replace_decision.verdict == "block":
        raise RuntimeError(replace_decision.reason_detail)
    desired_reduce_only = _execution_preview_requires_reduce_only(preview)
    if _exchange_order_matches_requested_target(
        target,
        quantity,
        price,
        require_reduce_only=desired_reduce_only,
    ):
        repo.add_event(
            event_type="exchange_order.replace_noop",
            source="desktop",
            severity=EventSeverity.INFO,
            payload={
                "mode": status.mode.value,
                "requested_by": requested_by,
                "order_id": order_id,
                "symbol": target.symbol,
                "market": target.market,
                "origin": target.origin,
                "strategy_id": target.strategy_id,
                "side": target.side.value,
                "quantity": quantity,
                "price": price,
            },
            symbol=target.symbol,
            strategy_id=target.strategy_id,
            parameter_snapshot=_resolve_strategy_parameter_snapshot(target.strategy_id),
        )
        repo._persist()  # type: ignore[attr-defined]
        return target

    body = {
        "category": "spot" if target.market == "spot" else "linear",
        "symbol": target.symbol,
        "orderId": order_id,
        "qty": serialize_decimal(quantity),
        "price": serialize_decimal(price),
    }
    if target.market == "perp":
        body["reduceOnly"] = desired_reduce_only
    result = private_data.amend_order(body)
    amended_order_id = str(result.get("orderId") or order_id)
    order_status = str(result.get("orderStatus") or raw_target.get("orderStatus") or target.status or "New")
    remember_private_order_metadata(
        amended_order_id,
        origin=target.origin,
        strategy_id=target.strategy_id,
        requested_by=requested_by,
    )
    next_order = {
        **raw_target,
        "orderId": amended_order_id,
        "qty": body["qty"],
        "price": body["price"],
        "orderStatus": order_status,
        "reduceOnly": body.get("reduceOnly"),
    }

    if hasattr(private_realtime, "seed_open_orders_snapshot"):
        next_orders = []
        for item in raw_orders:
            if str(item.get("orderId") or "") == order_id:
                next_orders.append(next_order)
            else:
                next_orders.append(item)
        private_realtime.seed_open_orders_snapshot(next_orders)

    upsert_private_order_history_cache(
        status,
        [
            {
                "orderId": amended_order_id,
                "symbol": target.symbol,
                "category": "spot" if target.market == "spot" else "linear",
                "side": "Buy" if target.side == Direction.BUY else "Sell",
                "orderType": target.order_type,
                "qty": body["qty"],
                "price": body["price"],
                "orderStatus": order_status,
                "createdTime": str(
                    int(datetime.fromisoformat(target.created_at).astimezone(timezone.utc).timestamp() * 1000)
                ),
            }
        ],
    )

    repo.add_event(
        event_type="exchange_order.replaced",
        source="desktop",
        severity=EventSeverity.INFO,
        payload={
            "mode": status.mode.value,
            "requested_by": requested_by,
            "order_id": amended_order_id,
            "symbol": target.symbol,
            "market": target.market,
            "origin": target.origin,
            "strategy_id": target.strategy_id,
            "side": target.side.value,
            "previous_quantity": target.qty,
            "previous_price": target.price,
            "quantity": quantity,
            "price": price,
        },
        symbol=target.symbol,
        strategy_id=target.strategy_id,
        parameter_snapshot=_resolve_strategy_parameter_snapshot(target.strategy_id),
    )
    repo._persist()  # type: ignore[attr-defined]
    return target.model_copy(
        update={
            "qty": serialize_decimal(quantity),
            "price": serialize_decimal(price),
            "status": order_status,
        }
    )

def _announcement_symbols(title: str, summary: str) -> List[str]:
    content = f"{title} {summary}".upper()
    matched: List[str] = []
    for item in repo.snapshot().watchlist:
        base_symbol = item.symbol.replace("USDT", "")
        if base_symbol and base_symbol in content and item.symbol not in matched:
            matched.append(item.symbol)
    return matched

def _announcement_impact_score(title: str, tags: List[str]) -> int:
    normalized_title = title.lower()
    normalized_tags = {str(tag).strip().lower() for tag in tags}
    if any(keyword in normalized_title for keyword in ("delist", "suspend", "maintenance", "incident", "下架", "暂停", "维护", "异常")):
        return 88
    if {"listing", "launchpad", "pre-market"} & normalized_tags:
        return 82
    if {"earn", "campaign", "product"} & normalized_tags:
        return 68
    return 58

def build_news_feed(limit: int = 10) -> List[NewsEvent]:
    seeded_news = list(repo.snapshot().news_events)
    announcement_events: List[NewsEvent] = []
    try:
        announcements = market_data.get_announcements(locale="zh-TW", limit=limit)
        for item in announcements:
            title = str(item.get("title") or "Bybit 公告")
            summary = str(item.get("description") or item.get("subtitle") or "请前往 Bybit 公告页查看详情。").strip()
            tags = item.get("tags") or item.get("tag") or []
            if isinstance(tags, str):
                tag_list = [tags]
            else:
                tag_list = [str(tag) for tag in tags if str(tag).strip()]
            announcement_events.append(
                NewsEvent(
                    id=str(item.get("id") or f"bybit-ann-{uuid4().hex[:10]}"),
                    source="Bybit 公告",
                    title=title,
                    summary=summary,
                    url=str(item.get("url") or "").strip() or None,
                    symbols=_announcement_symbols(title, summary),
                    impact_score=_announcement_impact_score(title, tag_list),
                    published_at=timestamp_ms_to_iso(item.get("publishTime") or item.get("dateTimestamp")),
                    category="announcement",
                    related_alert_ids=[],
                )
            )
    except RuntimeError:
        announcement_events = []

    merged = announcement_events + seeded_news
    deduped: Dict[str, NewsEvent] = {}
    for item in merged:
        dedupe_key = f"{item.source}|{item.title}"
        if dedupe_key not in deduped:
            deduped[dedupe_key] = item
    return sorted(deduped.values(), key=lambda item: item.published_at, reverse=True)[: max(limit, 10)]

def build_market_live_snapshot_payload(symbol: str, timeframe: str = "1h") -> MarketLiveSnapshot:
    started_at = time.perf_counter()
    state = repo.snapshot()
    uppercase_symbol = symbol.upper()
    try:
        normalized_timeframe = market_data.normalize_timeframe(timeframe)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    watchlist = market_data.enrich_watchlist_fast(state.watchlist)
    if not watchlist:
        raise HTTPException(status_code=404, detail="当前还没有可用自选品种。")
    watch_item = next((item for item in watchlist if item.symbol == uppercase_symbol), None)
    effective_symbol = uppercase_symbol
    selection_corrected = False
    if watch_item is None:
        watch_item = watchlist[0]
        effective_symbol = watch_item.symbol
        selection_corrected = True

    watchlist_details: List[MarketDetail] = []
    detail_map: Dict[str, MarketDetail] = {}
    live_detail: Optional[MarketDetail] = None

    for item in watchlist:
        seed_detail = state.market_details.get(item.symbol)
        fallback_detail = build_runtime_market_fallback_detail(
            symbol=item.symbol,
            market=item.market,
            timeframe=normalized_timeframe,
            watch_item=item,
            base_detail=seed_detail,
        )
        try:
            detail = market_data.enrich_market_detail(
                symbol=item.symbol,
                market=item.market,
                fallback_detail=fallback_detail,
                watch_item=item,
                timeframe=normalized_timeframe,
                allow_rest_refresh=False,
            )
            if item.symbol == effective_symbol and len(detail.candles) == 0:
                detail = market_data.enrich_market_detail(
                    symbol=item.symbol,
                    market=item.market,
                    fallback_detail=fallback_detail,
                    watch_item=item,
                    timeframe=normalized_timeframe,
                    allow_rest_refresh=True,
                )
        except RuntimeError as exc:
            detail = build_runtime_market_fallback_detail(
                symbol=item.symbol,
                market=item.market,
                timeframe=normalized_timeframe,
                watch_item=item,
                base_detail=seed_detail,
                failure_reason=str(exc),
            )
        detail_map[item.symbol] = detail
        watchlist_details.append(detail)
        if item.symbol == effective_symbol:
            live_detail = detail

    if live_detail is None:
        raise HTTPException(status_code=404, detail="当前自选中找不到该品种")

    repo.sync_market_watchlist(watchlist, detail_map)

    source_breakdown: Dict[str, int] = {}
    for item in watchlist_details:
        source_breakdown[item.source] = source_breakdown.get(item.source, 0) + 1
    watchlist_real_detail_count = sum(1 for item in watchlist_details if item.source in {"bybit_ws", "bybit_rest"})
    generated_in_ms = int((time.perf_counter() - started_at) * 1000)

    return MarketLiveSnapshot(
        selected_symbol=effective_symbol,
        watchlist=watchlist,
        detail=live_detail,
        watchlist_details=watchlist_details,
        diagnostics=MarketLiveDiagnostics(
            requested_symbol=uppercase_symbol,
            effective_symbol=effective_symbol,
            timeframe=normalized_timeframe,
            selection_corrected=selection_corrected,
            detail_source=live_detail.source,
            detail_candle_count=len(live_detail.candles),
            watchlist_symbol_count=len(watchlist_details),
            watchlist_real_detail_count=watchlist_real_detail_count,
            watchlist_fallback_detail_count=max(len(watchlist_details) - watchlist_real_detail_count, 0),
            watchlist_source_breakdown=source_breakdown,
            generated_in_ms=generated_in_ms,
        ),
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )

def _clear_strategy_auto_dispatch_alerts(strategy_id: str) -> bool:
    changed = False
    prefix = f"strategy-auto-dispatch:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed

def _has_active_strategy_auto_dispatch_alert(strategy_id: str) -> bool:
    prefix = f"strategy-auto-dispatch:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )

def _clear_strategy_live_stop_loss_alerts(strategy_id: str) -> bool:
    changed = False
    prefix = f"strategy-live-stop-loss:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed

def _has_active_strategy_live_stop_loss_alert(strategy_id: str) -> bool:
    prefix = f"strategy-live-stop-loss:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )

def _clear_strategy_position_drift_alerts(
    strategy_id: str,
    *,
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-position-drift:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.position_drift.resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "当前实际仓位已重新与策略目标对齐，偏离提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed

def _has_active_strategy_position_drift_alert(strategy_id: str) -> bool:
    prefix = f"strategy-position-drift:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )

def _clear_strategy_exchange_rejected_alerts(
    strategy_id: str,
    *,
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-exchange-rejected:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.exchange_order.rejection_resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "真实策略委托已恢复正常，拒单提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed

def _clear_strategy_exchange_rejection_guard_alerts(
    strategy_id: str,
    *,
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-exchange-rejection-guard:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.exchange_order.rejection_guard.resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "连续拒单熔断已解除，真实策略自动执行可继续人工复核后恢复。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed

def _has_active_strategy_exchange_rejection_guard_alert(strategy_id: str) -> bool:
    prefix = f"strategy-exchange-rejection-guard:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )

def _clear_strategy_stale_order_alerts(
    strategy_id: str,
    *,
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    prefix = f"strategy-stale-order:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix):
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.exchange_order.stale_resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "detail": resolution_detail or "停滞挂单异常已解除，旧提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed

def _has_active_strategy_stale_order_alert(strategy_id: str) -> bool:
    prefix = f"strategy-stale-order:{strategy_id}:"
    with repo._lock:  # type: ignore[attr-defined]
        return any(
            alert.source_type == "system"
            and not alert.acknowledged
            and str(getattr(alert, "rule_key", None) or "").startswith(prefix)
            for alert in repo.state.alerts  # type: ignore[attr-defined]
        )

def _queue_strategy_issue_review_locked(
    *,
    strategy_id: str,
    strategy_name: str,
    symbol: str,
    mode: AccountMode,
    issue_type: str,
    summary: str,
    detail: str,
    rule_key: str,
    severity: str = "P1",
) -> None:
    timestamp = datetime.now(timezone.utc).astimezone().isoformat()
    repo._create_agent_job_locked(  # type: ignore[attr-defined]
        AgentJobCreate(
            job_type="review_strategy_issue",
            context={
                "issue_type": issue_type,
                "summary": summary,
                "detail": detail,
                "severity": severity,
                "strategy_id": strategy_id,
                "strategy_name": strategy_name,
                "symbol": symbol,
                "mode": mode.value,
                "rule_key": rule_key,
                "triggered_at": timestamp,
            },
            allowed_actions=["review_strategy_issue", "summarize_execution_impact"],
            timeout=60,
            idempotency_key=f"strategy-issue-review:{rule_key}:{timestamp}",
            writeback_target="strategy_activity",
        ),
        source="mock-orchestrator",
    )

def _classify_strategy_auto_dispatch_alert_kind(detail: Optional[str]) -> Optional[str]:
    """Classify ``detail`` into the typed channel-outage reason code.

    Round 76 — returns the typed ``AUTO_DISPATCH_GATE_REASON_*`` constant for
    the two realtime-channel outage families that the runtime-snapshot
    decoration (``_apply_strategy_auto_dispatch_alert_guard``) currently
    distinguishes via substring matching on ``AlertRecord.description``.  The
    helper centralises the probe so it only lives at the alert-emission
    boundary; the consumer can then read ``alert.reason_code`` directly.

    Returns ``None`` when no channel-outage hint is present, so the caller
    leaves ``reason_code`` unset on the alert (callers that already know the
    typed code — e.g. the gate path — pass it in explicitly and skip this
    fallback).
    """

    if not detail:
        return None
    if "私有 WS" in detail or "私有实时链路" in detail:
        return AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE
    if "公共 WS" in detail or "公共实时链路" in detail:
        return AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE
    return None


# Round 85 — map the auto-dispatch gate's typed channel-outage codes onto the
# R80 ``RISK_REASON_RUNTIME_UNAVAILABLE_*`` sub-codes so ``AlertRecord``-based
# fallback recommenders (``_resolve_auto_dispatch_top_issue_recommended_action``)
# can dispatch on the typed sub-discriminator without re-parsing the Chinese
# alert description.  The two taxonomies are orthogonal by design (one keys
# the auto-dispatch gate, the other keys the risk-decision preview), so the
# mapping only covers the channel-outage overlap.  Scheduler-manual-override /
# paused / freeze-publish gate reasons do not have a preview-side counterpart
# and are intentionally not mapped.
_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE: Dict[str, str] = {
    AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE: RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL,
    AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE: RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL,
}

# Round 92 — reverse of :data:`_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE` used by
# the outcome-record callsite inside ``_auto_dispatch_strategy_signal_changes``
# (main.py:8078).  The dispatch call's raised ``StrategyExecutionChannelOutageError``
# carries a typed ``sub_block_code`` (one of the ``RISK_REASON_RUNTIME_UNAVAILABLE_*``
# sub-codes); this dict maps it back onto the ``AlertRecord.reason_code``
# taxonomy so the record helper receives both typed discriminators directly
# and skips the ``_classify_strategy_auto_dispatch_alert_kind`` /
# ``_derive_sub_block_code_from_detail`` substring fallbacks.  Declared
# explicitly rather than inverting the forward dict at import time so adding
# a many-to-one entry to the forward map will not silently drop entries here.
_RISK_SUB_BLOCK_TO_AUTO_DISPATCH_GATE_REASON: Dict[str, str] = {
    RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL: AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE,
    RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL: AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE,
}


def _resolve_alert_sub_block_code(alert: Optional[AlertRecord]) -> Optional[str]:
    """Return the :data:`RISK_REASON_RUNTIME_UNAVAILABLE_*` sub-code that
    matches ``alert.reason_code``, or ``None`` if the alert carries a
    non-channel reason code (scheduler gate, unclassified, or no alert).

    Callers use this to thread a typed ``sub_block_code`` into the
    recommendation helpers so the canonical channel-outage recovery copy
    comes from the typed taxonomy rather than a ``"私有 WS"`` / ``"公共 WS"``
    detail substring probe.
    """

    if alert is None or alert.reason_code is None:
        return None
    return _AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE.get(alert.reason_code)


def _derive_sub_block_code_from_detail(detail: Optional[str]) -> Optional[str]:
    """Classify ``detail`` onto a :data:`RISK_REASON_RUNTIME_UNAVAILABLE_*`
    sub-code via ``_classify_strategy_auto_dispatch_alert_kind`` +
    :data:`_AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE`.

    Round 88 — used by the two ``_record_strategy_{auto_dispatch,manual_execution}_issue``
    helpers to forward a typed ``sub_block_code`` into
    ``_build_execution_preview_recommended_action`` even when the caller did
    not supply one.  Together with the explicit ``sub_block_code=`` threading
    on the in-tree preview-emission paths (R80/R84) this closes the last
    channel-outage blind spot before the umbrella substring fallback inside
    ``_build_execution_preview_recommended_action`` is deleted.

    Worker-thread blocks are always raised from in-tree callers that pass
    ``sub_block_code=RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD`` directly
    (R84), so this helper does not classify ``"运行线程"`` tokens — it
    returns ``None`` and the caller's ``sub_block_code`` stays unset.  The
    recommender then returns ``None`` for the umbrella branch, and the
    downstream ``or item.next_action`` fallback covers externally-built
    audit strings without a typed sub-code.
    """

    alert_kind = _classify_strategy_auto_dispatch_alert_kind(detail)
    if alert_kind is None:
        return None
    return _AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE.get(alert_kind)


def _record_strategy_auto_dispatch_issue(
    strategy_id: str,
    strategy_name: str,
    symbol: str,
    signal: str,
    mode: AccountMode,
    detail: str,
    recommended_action: Optional[str] = None,
    *,
    strategy: Optional[StrategySummary] = None,
    reason_code: Optional[str] = None,
    market: Optional[str] = None,
    sub_block_code: Optional[str] = None,
) -> None:
    # Round 84 — ``market`` / ``sub_block_code`` thread the typed
    # discriminators through to the recommendation helper so the runtime-worker
    # / spot-vs-perp / channel-outage sub-copy picks off the typed field
    # rather than the ``"可用保证金不足"`` / ``"私有 WS"`` / ``"公共 WS"`` /
    # ``"运行线程"`` detail probes.
    # Round 88 — when the caller does not pass ``sub_block_code`` explicitly
    # (the gate-rejected channel-outage path at main.py:7845 predates R84),
    # derive it from the detail so the umbrella RUNTIME_UNAVAILABLE substring
    # probe inside ``_build_execution_preview_recommended_action`` can be
    # deleted without regressing that call site.
    rule_key = f"strategy-auto-dispatch:{strategy_id}:{signal}:{mode.value}"
    resolved_sub_block_code = sub_block_code or _derive_sub_block_code_from_detail(detail)
    suggested_action = recommended_action or _build_auto_dispatch_recommended_action(
        detail, market=market, sub_block_code=resolved_sub_block_code
    )
    parameter_snapshot = (
        parameter_resolver.snapshot_parameters(strategy) if strategy is not None else None
    )
    # Round 76 — explicit ``reason_code`` from a caller that already has the
    # typed discriminator (e.g. ``AutoDispatchGate.sub_reason_code``) takes
    # precedence over the detail-based classifier fallback.
    resolved_reason_code = reason_code or _classify_strategy_auto_dispatch_alert_kind(detail)
    with repo._lock:  # type: ignore[attr-defined]
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=rule_key,
            severity="P1",
            symbol=symbol,
            title=f"{symbol} 自动执行被拦截",
            description=f"{strategy_name} 在 {mode.value.upper()} 自动执行时被阻断。{detail}",
            suggested_action=suggested_action,
            strategy_id=strategy_id,
            reason_code=resolved_reason_code,
        )
        if changed:
            _queue_strategy_issue_review_locked(
                strategy_id=strategy_id,
                strategy_name=strategy_name,
                symbol=symbol,
                mode=mode,
                issue_type="auto_dispatch_blocked",
                summary=f"{symbol} 自动执行被拦截",
                detail=detail,
                rule_key=rule_key,
            )
            repo.add_event(
                event_type="strategy.exchange_order.auto_blocked",
                source="quant-core",
                severity=EventSeverity.WARNING,
                payload={
                    "strategy_id": strategy_id,
                    "strategy_name": strategy_name,
                    "symbol": symbol,
                    "signal": signal,
                    "mode": mode.value,
                    "detail": detail,
                    "recommended_action": suggested_action,
                },
                symbol=symbol,
                strategy_id=strategy_id,
                parameter_snapshot=parameter_snapshot,
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]

def _record_strategy_manual_execution_issue(
    strategy_id: str,
    strategy_name: str,
    symbol: str,
    mode: AccountMode,
    detail: str,
    recommended_action: Optional[str] = None,
    *,
    strategy: Optional[StrategySummary] = None,
    reason_code: Optional[str] = None,
    market: Optional[str] = None,
    sub_block_code: Optional[str] = None,
) -> None:
    # Round 84 — ``market`` / ``sub_block_code`` thread the typed
    # discriminators through to the recommendation helper so the runtime-worker
    # / spot-vs-perp / channel-outage sub-copy picks off the typed field
    # rather than the ``"可用保证金不足"`` / ``"私有 WS"`` / ``"公共 WS"`` /
    # ``"运行线程"`` detail probes.
    # Round 88 — when the caller does not pass ``sub_block_code`` explicitly,
    # derive it from the detail's channel-outage tokens so the umbrella
    # RUNTIME_UNAVAILABLE substring probe inside
    # ``_build_execution_preview_recommended_action`` can be deleted without
    # regressing audit-record call sites (e.g. the ``except RuntimeError``
    # branch at ``dispatch_strategy_signal`` for plain ``RuntimeError``
    # instances that happen to carry the ``"私有 WS"`` / ``"公共 WS"`` token
    # without being ``StrategyExecutionChannelOutageError`` instances).
    rule_key = f"strategy-blocked-execution:{strategy_id}:{mode.value}"
    resolved_sub_block_code = sub_block_code or _derive_sub_block_code_from_detail(detail)
    suggested_action = recommended_action or _build_manual_execution_recommended_action(
        detail, market=market, sub_block_code=resolved_sub_block_code
    )
    parameter_snapshot = (
        parameter_resolver.snapshot_parameters(strategy) if strategy is not None else None
    )
    # Round 69 — attach the typed ``reason_code`` to the strategy-execution
    # blocked audit payloads (mirrors the R66 ``risk.blocked_order`` coverage)
    # so auditors can correlate preview-derived blocks with runtime-worker or
    # exception-path blocks without parsing Chinese substrings.  Callers that
    # already have a ``RiskDecision.reason_code`` pass it in; callers that
    # only carry a free-form reason string fall back to
    # ``derive_block_reason_code`` at emit time.
    resolved_reason_code = reason_code or derive_block_reason_code(detail)
    with repo._lock:  # type: ignore[attr-defined]
        # Round 76 — propagate the typed reason code onto the emitted
        # ``AlertRecord`` so downstream consumers can branch on
        # ``alert.reason_code`` without re-deriving it from the description.
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=rule_key,
            severity="P1",
            symbol=symbol,
            title=f"{symbol} 手动策略执行被拦截",
            description=f"{strategy_name} 在 {mode.value.upper()} 手动执行时被阻断。{detail}",
            suggested_action=suggested_action,
            strategy_id=strategy_id,
            reason_code=resolved_reason_code,
        )
        repo.add_event(
            event_type="strategy.execution.blocked",
            source="desktop-control",
            severity=EventSeverity.WARNING,
            payload={
                "strategy_id": strategy_id,
                "strategy_name": strategy_name,
                "symbol": symbol,
                "mode": mode.value,
                "detail": detail,
                "reason_code": resolved_reason_code,
                "recommended_action": suggested_action,
            },
            symbol=symbol,
            strategy_id=strategy_id,
            parameter_snapshot=parameter_snapshot,
        )
        if changed:
            _queue_strategy_issue_review_locked(
                strategy_id=strategy_id,
                strategy_name=strategy_name,
                symbol=symbol,
                mode=mode,
                issue_type="manual_execution_blocked",
                summary=f"{symbol} 手动策略执行被拦截",
                detail=detail,
                rule_key=rule_key,
            )
            repo.add_event(
                event_type="strategy.execution.blocked_alerted",
                source="quant-core",
                severity=EventSeverity.WARNING,
                payload={
                    "strategy_id": strategy_id,
                    "strategy_name": strategy_name,
                    "symbol": symbol,
                    "mode": mode.value,
                    "detail": detail,
                    "reason_code": resolved_reason_code,
                    "recommended_action": suggested_action,
                },
                symbol=symbol,
                strategy_id=strategy_id,
                parameter_snapshot=parameter_snapshot,
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]

def _clear_strategy_manual_execution_alerts(
    strategy_id: str,
    mode: AccountMode,
    *,
    resolution_detail: Optional[str] = None,
) -> bool:
    changed = False
    rule_keys = {
        f"strategy-blocked-execution:{strategy_id}:{mode.value}",
        f"strategy-manual-execution:{strategy_id}:{mode.value}",
    }
    with repo._lock:  # type: ignore[attr-defined]
        for alert in repo.state.alerts:  # type: ignore[attr-defined]
            if alert.source_type != "system" or alert.acknowledged:
                continue
            if str(getattr(alert, "rule_key", None) or "") not in rule_keys:
                continue
            alert.acknowledged = True
            changed = True
        if changed:
            repo.add_event(
                event_type="strategy.execution.blocked_resolved",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": strategy_id,
                    "mode": mode.value,
                    "detail": resolution_detail or "后续手动策略执行已恢复成功，旧的拦截提醒已收起。",
                },
                strategy_id=strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
            )
            repo._refresh_derived_state()  # type: ignore[attr-defined]
            repo._persist()  # type: ignore[attr-defined]
    return changed

def _sync_strategy_position_drift_issue(
    snapshot: StrategyRuntimeSnapshot,
    *,
    active_order_count: int,
) -> None:
    if snapshot.mode == AccountMode.PAPER or snapshot.runtime_status != "running":
        _clear_strategy_position_drift_alerts(snapshot.strategy_id)
        return
    if snapshot.position_alignment != "drifted":
        detail = snapshot.position_alignment_detail or "当前仓位已经回到策略目标附近，偏离提醒已收起。"
        _clear_strategy_position_drift_alerts(snapshot.strategy_id, resolution_detail=detail)
        return

    detail = snapshot.position_alignment_detail or "当前实际仓位与策略目标仍有偏差，尚未完全对齐。"
    with repo._lock:  # type: ignore[attr-defined]
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=f"strategy-position-drift:{snapshot.strategy_id}:{snapshot.mode.value}",
            severity="P1",
            symbol=snapshot.symbol,
            title=f"{snapshot.symbol} 策略仓位偏离目标",
            description=(
                f"{snapshot.strategy_name} 当前目标仓位 {snapshot.target_position_side} "
                f"{snapshot.target_position_size or '--'}，但实际仓位仍未对齐。{detail}"
            ),
            suggested_action="切到策略页和账户页核对持仓、关联委托和执行预检，必要时人工补单或接管。",
            strategy_id=snapshot.strategy_id,
        )
        if changed:
            _queue_strategy_issue_review_locked(
                strategy_id=snapshot.strategy_id,
                strategy_name=snapshot.strategy_name,
                symbol=snapshot.symbol,
                mode=snapshot.mode,
                issue_type="position_drift",
                summary=f"{snapshot.symbol} 策略仓位偏离目标",
                detail=detail,
                rule_key=f"strategy-position-drift:{snapshot.strategy_id}:{snapshot.mode.value}",
            )
            repo.add_event(
                event_type="strategy.position_drift.alerted",
                source="quant-core",
                severity=EventSeverity.WARNING,
                payload={
                    "strategy_id": snapshot.strategy_id,
                    "strategy_name": snapshot.strategy_name,
                    "symbol": snapshot.symbol,
                    "mode": snapshot.mode.value,
                    "target_position_side": snapshot.target_position_side,
                    "target_position_size": snapshot.target_position_size,
                    "detail": detail,
                    "active_order_count": active_order_count,
                },
                symbol=snapshot.symbol,
                strategy_id=snapshot.strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(snapshot.strategy_id),
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]

def _strategy_auto_dispatch_gate_reason(
    strategy: Optional[StrategySummary] = None,
) -> Optional[AutoDispatchGateReasonContext]:
    """Return the typed gate reason blocking autonomous dispatch, if any.

    Round 75 — return shape promoted from ``Optional[str]`` to the new
    :class:`AutoDispatchGateReasonContext` so the downstream
    ``_evaluate_strategy_auto_dispatch_gate`` can decide ``cancel_existing``
    directly from a typed field instead of substring-probing the free-form
    detail for ``"公共 WS"`` / ``"私有 WS"``.
    """

    scheduler = repo.snapshot().control_snapshot.scheduler
    if scheduler.status == "manual_override":
        return AutoDispatchGateReasonContext(
            reason_code=AUTO_DISPATCH_GATE_REASON_SCHEDULER_MANUAL_OVERRIDE,
            detail="当前 AI 调度处于人工接管，后台自动执行已暂停。",
            cancel_existing=True,
        )
    if scheduler.status == "paused":
        return AutoDispatchGateReasonContext(
            reason_code=AUTO_DISPATCH_GATE_REASON_SCHEDULER_PAUSED,
            detail="当前 AI 调度已暂停，后台自动执行已暂停。",
            cancel_existing=True,
        )
    if scheduler.freeze_publish:
        return AutoDispatchGateReasonContext(
            reason_code=AUTO_DISPATCH_GATE_REASON_SCHEDULER_FREEZE_PUBLISH,
            detail="当前已冻结自动发布，后台自动执行暂不继续提交新委托。",
            cancel_existing=False,
        )
    if strategy is not None and strategy.mode in {AccountMode.DEMO, AccountMode.LIVE}:
        state = repo.snapshot()
        market = _resolve_strategy_primary_market(state, strategy)
        symbol = strategy.symbols[0] if strategy.symbols else ""
        if symbol:
            public_channel_issue = get_public_execution_channel_issue(market, symbol)
            if public_channel_issue is not None:
                return AutoDispatchGateReasonContext(
                    reason_code=AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE,
                    detail=public_channel_issue,
                    cancel_existing=True,
                )
        private_channel_issue = get_private_execution_channel_issue(strategy.mode)
        if private_channel_issue is not None:
            return AutoDispatchGateReasonContext(
                reason_code=AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE,
                detail=private_channel_issue,
                cancel_existing=True,
            )
    return None

def _strategy_parameter_float(strategy: StrategySummary, key: str) -> Optional[float]:
    for parameter in strategy.parameters:
        if parameter.key != key:
            continue
        try:
            return float(parameter.value)
        except (TypeError, ValueError):
            return None
    return None

def _strategy_parameter_int(strategy: StrategySummary, key: str) -> Optional[int]:
    value = _strategy_parameter_float(strategy, key)
    if value is None:
        return None
    return int(round(value))

def _strategy_live_stop_loss_cooldown_remaining_minutes(strategy: StrategySummary) -> Optional[int]:
    cooldown_minutes = _strategy_parameter_float(strategy, "cooldown_minutes") or 0.0
    if cooldown_minutes <= 0:
        return None
    latest_guard_event = next(
        (
            event
            for event in repo.snapshot().audit_events
            if event.event_type == "strategy.exchange_stop_loss.alerted"
            and event.strategy_id == strategy.id
        ),
        None,
    )
    if latest_guard_event is None:
        return None
    try:
        occurred_at = datetime.fromisoformat(latest_guard_event.occurred_at)
    except ValueError:
        return None
    elapsed_minutes = (datetime.now(timezone.utc).astimezone() - occurred_at).total_seconds() / 60
    remaining = int(round(cooldown_minutes - elapsed_minutes))
    return remaining if remaining > 0 else None

def _strategy_exchange_rejection_guard_threshold(strategy: StrategySummary) -> int:
    return max(_strategy_parameter_int(strategy, "rejection_guard_count") or 2, 1)

def _strategy_exchange_rejection_guard_window_minutes(strategy: StrategySummary) -> int:
    return max(_strategy_parameter_int(strategy, "rejection_guard_window_minutes") or 15, 1)

def _strategy_exchange_rejection_guard_cooldown_minutes(strategy: StrategySummary) -> int:
    return max(_strategy_parameter_int(strategy, "rejection_cooldown_minutes") or 20, 1)

def _strategy_exchange_rejection_event_time(event: ExecutionEvent) -> datetime:
    raw_value = event.payload.get("order_created_at") or event.occurred_at
    try:
        return datetime.fromisoformat(str(raw_value))
    except (TypeError, ValueError):
        return datetime.fromtimestamp(0, tz=timezone.utc)

def _strategy_exchange_rejection_recent_count(strategy: StrategySummary) -> int:
    threshold_window = _strategy_exchange_rejection_guard_window_minutes(strategy)
    cutoff = datetime.now(timezone.utc).astimezone() - timedelta(minutes=threshold_window)
    return sum(
        1
        for event in repo.snapshot().audit_events
        if event.strategy_id == strategy.id
        and event.event_type == "exchange_order.rejected"
        and _strategy_exchange_rejection_event_time(event) >= cutoff
    )

def _strategy_exchange_rejection_guard_remaining_minutes(strategy: StrategySummary) -> Optional[int]:
    if strategy.mode == AccountMode.PAPER or strategy.status in {"paper_only", "paused", "shadow"}:
        return None
    threshold = _strategy_exchange_rejection_guard_threshold(strategy)
    cooldown_minutes = _strategy_exchange_rejection_guard_cooldown_minutes(strategy)
    threshold_window = _strategy_exchange_rejection_guard_window_minutes(strategy)
    if threshold <= 0 or cooldown_minutes <= 0 or threshold_window <= 0:
        return None

    cutoff = datetime.now(timezone.utc).astimezone() - timedelta(minutes=threshold_window)
    recent_events = [
        event
        for event in repo.snapshot().audit_events
        if event.strategy_id == strategy.id
        and event.event_type == "exchange_order.rejected"
        and _strategy_exchange_rejection_event_time(event) >= cutoff
    ]
    if len(recent_events) < threshold:
        return None
    latest_event = max(recent_events, key=_strategy_exchange_rejection_event_time)
    latest_at = _strategy_exchange_rejection_event_time(latest_event)
    elapsed_minutes = (datetime.now(timezone.utc).astimezone() - latest_at).total_seconds() / 60
    remaining = int(round(cooldown_minutes - elapsed_minutes))
    return remaining if remaining > 0 else None

def _strategy_exchange_order_stale_minutes(strategy: StrategySummary) -> int:
    return max(_strategy_parameter_int(strategy, "stale_order_minutes") or 20, 1)

def _parse_order_created_at(value: Optional[str]) -> datetime:
    if not value:
        return datetime.fromtimestamp(0, tz=timezone.utc)
    try:
        return datetime.fromisoformat(str(value))
    except (TypeError, ValueError):
        return datetime.fromtimestamp(0, tz=timezone.utc)

def _strategy_active_order_stale_age_minutes(order: OrderRecord) -> int:
    created_at = _parse_order_created_at(order.created_at)
    elapsed_minutes = (datetime.now(timezone.utc).astimezone() - created_at).total_seconds() / 60
    return max(int(round(elapsed_minutes)), 0)

def _is_strategy_active_order_stale(strategy: StrategySummary, order: Optional[OrderRecord]) -> bool:
    if order is None or strategy.mode == AccountMode.PAPER:
        return False
    return _strategy_active_order_stale_age_minutes(order) >= _strategy_exchange_order_stale_minutes(strategy)

def _record_strategy_live_stop_loss_issue(
    strategy: StrategySummary,
    snapshot: StrategyRuntimeSnapshot,
    position: PositionRecord,
    *,
    stop_loss_pct: float,
    cancelled_count: int,
) -> None:
    detail = (
        f"{snapshot.symbol} 当前参考价 {snapshot.last_price:.4f} 已触发 {stop_loss_pct:.2f}% 真实模式止损保护；"
        "后台自动执行已暂停，请先人工复核真实仓位。"
    )
    with repo._lock:  # type: ignore[attr-defined]
        changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
            rule_key=f"strategy-live-stop-loss:{strategy.id}:{strategy.mode.value}",
            severity="P0",
            symbol=snapshot.symbol,
            title=f"{strategy.name} 触发真实模式止损保护",
            description=detail,
            suggested_action="打开策略页和账户页复核真实持仓、止损参数与当前委托，确认后再决定是否恢复自动执行。",
            strategy_id=strategy.id,
        )
        if changed:
            repo.add_event(
                event_type="strategy.exchange_stop_loss.alerted",
                source="quant-core",
                severity=EventSeverity.CRITICAL,
                payload={
                    "strategy_id": strategy.id,
                    "strategy_name": strategy.name,
                    "symbol": snapshot.symbol,
                    "market": snapshot.market,
                    "mode": strategy.mode.value,
                    "stop_loss_pct": stop_loss_pct,
                    "last_price": snapshot.last_price,
                    "position_size": position.size,
                    "avg_price": position.avg_price,
                    "cancelled_orders": cancelled_count,
                },
                symbol=snapshot.symbol,
                strategy_id=strategy.id,
                parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
            )
        repo._refresh_derived_state()  # type: ignore[attr-defined]
        repo._persist()  # type: ignore[attr-defined]

def _cancel_strategy_exchange_orders(
    strategy_id: str,
    symbol: str,
    market: str,
    mode: AccountMode,
    requested_by: str,
    reason: str,
) -> int:
    existing_orders = [
        item
        for item in parse_open_orders(use_private_only=True)
        if item.source == "bybit_private"
        and item.origin == "strategy"
        and (item.strategy_id == strategy_id or item.strategy_id is None)
        and item.symbol == symbol
        and item.market == market
    ]
    cancelled_count = 0
    for order in existing_orders:
        cancel_exchange_order(order.order_id, requested_by, mode)
        cancelled_count += 1
        repo.add_event(
            event_type="strategy.exchange_order.cancelled_inactive",
            source="quant-core",
            severity=EventSeverity.INFO,
            payload={
                "strategy_id": strategy_id,
                "symbol": symbol,
                "market": market,
                "mode": mode.value,
                "order_id": order.order_id,
                "reason": reason,
                "requested_by": requested_by,
            },
            symbol=symbol,
            strategy_id=strategy_id,
            parameter_snapshot=_resolve_strategy_parameter_snapshot(strategy_id),
        )
    if cancelled_count:
        repo._persist()  # type: ignore[attr-defined]
    return cancelled_count

def _exchange_order_matches_requested_target(
    order: OrderRecord,
    quantity: float,
    price: float,
    *,
    require_reduce_only: bool = False,
) -> bool:
    matches = (
        abs(parse_metric_number(order.qty) - float(quantity)) <= 1e-9
        and abs(parse_metric_number(order.price) - float(price)) <= 1e-9
    )
    if not matches:
        return False
    if not require_reduce_only:
        return True
    return _raw_private_order_reduce_only_enabled(_find_private_raw_open_order(order.order_id))

def _apply_live_strategy_stop_loss_guards(current_items: List[StrategyRuntimeSnapshot]) -> None:
    state = repo.snapshot()
    strategies_by_id = {item.id: item for item in state.strategies}
    positions = parse_positions(use_private_only=True)
    positions_by_key = {(item.symbol, item.market): item for item in positions}

    for snapshot in current_items:
        strategy = strategies_by_id.get(snapshot.strategy_id)
        if strategy is None:
            continue
        if strategy.mode not in {AccountMode.LIVE, AccountMode.DEMO}:
            _clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue
        if strategy.status in {"paper_only", "paused", "shadow"} or snapshot.runtime_status != "running":
            _clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        stop_loss_pct = _strategy_parameter_float(strategy, "stop_loss_pct")
        cooldown_remaining = _strategy_live_stop_loss_cooldown_remaining_minutes(strategy)
        if stop_loss_pct is None or stop_loss_pct <= 0:
            if cooldown_remaining is not None:
                continue
            _clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        position = positions_by_key.get((snapshot.symbol, snapshot.market))
        if position is None:
            if cooldown_remaining is not None:
                continue
            _clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        current_qty = parse_metric_number(position.size) * (1 if position.side == "long" else -1)
        current_avg = parse_metric_number(position.avg_price)
        if abs(current_qty) <= 1e-9 or current_avg <= 0:
            if cooldown_remaining is not None:
                continue
            _clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        stop_triggered = False
        if current_qty > 0 and snapshot.last_price <= current_avg * (1 - stop_loss_pct / 100):
            stop_triggered = True
        elif current_qty < 0 and snapshot.last_price >= current_avg * (1 + stop_loss_pct / 100):
            stop_triggered = True

        if not stop_triggered:
            if _has_active_strategy_live_stop_loss_alert(snapshot.strategy_id) or cooldown_remaining is not None:
                continue
            _clear_strategy_live_stop_loss_alerts(snapshot.strategy_id)
            continue

        cancelled_count = _cancel_strategy_exchange_orders(
            snapshot.strategy_id,
            snapshot.symbol,
            snapshot.market,
            strategy.mode,
            "strategy_runtime_worker",
            "当前参考价已触发真实模式止损保护，自动撤销旧策略委托并暂停后台自动执行。",
        )
        _record_strategy_live_stop_loss_issue(
            strategy,
            snapshot,
            position,
            stop_loss_pct=stop_loss_pct,
            cancelled_count=cancelled_count,
        )

# Round 57 — the five helpers below + ``_dispatch_strategy_signal_from_state``
# realise a strategy signal via a canonical ``ExecutionIntent`` (models.py).
# Both entry points (manual REST ``execute_strategy_signal`` endpoint and the
# autonomous ``_auto_dispatch_strategy_signal_changes`` worker) funnel through
# ``_dispatch_strategy_signal_from_state`` which:
#   (a) builds the preview + R58 ``RiskDecision`` + parameter snapshot,
#   (b) freezes everything into an ``ExecutionIntent``, and
#   (c) delegates to ``_dispatch_execution_intent`` which routes to the
#       paper or live branch on ``intent.mode``.
# Before R57 each entry point re-derived preview/decision/snapshot and the
# paper + live branches were inlined directly into the dispatcher, so the
# "what shape does the dispatcher take?" contract drifted between manual and
# autonomous calls.  The intent is the single hand-off contract now.
def _classify_execution_intent_source(payload: StrategyExecutionRequest) -> ExecutionIntentSource:
    """Discriminator for the strategy-signal dispatcher — returns ``"auto"``
    when the autonomous runtime worker submitted the request (its
    ``requested_by`` is the sentinel ``"strategy_runtime_worker"``) and
    ``"manual"`` for the REST 'Execute' button / operator-attributed call.
    The value is frozen onto ``ExecutionIntent.source`` so downstream audit
    emissions and the repo persistence helper can tell the two apart without
    re-parsing ``requested_by``.
    """
    if (payload.requested_by or "").strip() == "strategy_runtime_worker":
        return "auto"
    return "manual"


def _build_execution_intent_from_state(
    *,
    strategy_id: str,
    payload: StrategyExecutionRequest,
    strategy: StrategySummary,
    snapshot: StrategyRuntimeSnapshot,
    resolved_mode: AccountMode,
    preview: ExecutionPreview,
    decision: RiskDecision,
) -> ExecutionIntent:
    """Freeze the full dispatch context into an ``ExecutionIntent`` so the
    paper + live branches share a single immutable contract.  Numeric fields
    are copied from ``preview`` (side / quantity / price) rather than the
    live ``snapshot`` to ensure the intent matches the R58 decision that the
    guard already evaluated.  ``parameter_snapshot`` is resolved through
    :mod:`parameter_resolver` so the frozen view matches every other R51+
    audit surface.
    """
    return ExecutionIntent(
        strategy_id=strategy_id,
        strategy_name=strategy.name,
        source=_classify_execution_intent_source(payload),
        mode=resolved_mode,
        symbol=snapshot.symbol,
        market=snapshot.market,
        side=preview.side,
        quantity=preview.quantity,
        price=preview.price,
        signal=snapshot.signal,
        preview=preview,
        decision=decision,
        parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
        requested_by=payload.requested_by,
        note=payload.note,
        created_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def _dispatch_paper_intent(intent: ExecutionIntent) -> StrategyExecutionResult:
    """Realise a Paper strategy intent: delegate trade creation + parameter
    freezing to ``repo.execute_strategy_signal`` (itself rebuilt on top of
    ``_execute_strategy_signal_from_intent_locked`` in R57) and clear any
    lingering manual-execution alerts so the operator sees recovery.
    """
    trade = repo.execute_strategy_signal(
        intent.strategy_id,
        intent.requested_by,
        intent.note,
    )
    _clear_strategy_manual_execution_alerts(
        intent.strategy_id,
        intent.mode,
        resolution_detail="后续 Paper 手动策略执行已恢复成功，旧的拦截提醒已收起。",
    )
    return StrategyExecutionResult(
        kind="paper_trade",
        strategy_id=intent.strategy_id,
        mode=intent.mode,
        preview=intent.preview,
        trade=trade,
        message=f"{intent.strategy_name} 已按当前策略信号写入 Paper 成交。",
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def _classify_live_order_reconciliation(
    intent: ExecutionIntent,
    existing_orders: Sequence[OrderRecord],
    *,
    requires_reduce_only: bool,
) -> LiveOrderReconciliation:
    """Classify how a live ``ExecutionIntent`` should reconcile against any
    pre-existing strategy orders on the exchange, without performing any side
    effects.  The returned :class:`LiveOrderReconciliation` decision carries:

    * ``action`` — ``"reuse"`` (existing order already matches target),
      ``"amend"`` (existing order differs on quantity/price/reduce_only), or
      ``"submit"`` (no matching order on the requested side).
    * ``reason_code`` — machine-readable classification:
      ``"order.matches_target"`` / ``"order.differs_numeric"`` /
      ``"order.requires_reduce_only"`` / ``"order.no_existing_match"``.
    * ``matching_order`` — the order on the same ``side`` as the intent, if
      any (used by reuse / amend branches).
    * ``stale_orders`` — every other order on the same strategy / symbol /
      market that must be cancelled before the chosen action runs.

    Pure function so it can be unit-tested without the full runtime stack
    (``test_control_api.py :: LiveOrderReconciliationRound59UnitTests``).
    """
    matching_order = next((item for item in existing_orders if item.side == intent.side), None)
    stale_orders = [
        item
        for item in existing_orders
        if matching_order is None or item.order_id != matching_order.order_id
    ]

    if matching_order is None:
        return LiveOrderReconciliation(
            action="submit",
            reason_code="order.no_existing_match",
            matching_order=None,
            stale_orders=list(stale_orders),
        )

    if _exchange_order_matches_requested_target(
        matching_order,
        intent.quantity,
        intent.price,
        require_reduce_only=requires_reduce_only,
    ):
        return LiveOrderReconciliation(
            action="reuse",
            reason_code="order.matches_target",
            matching_order=matching_order,
            stale_orders=list(stale_orders),
        )

    # Target differs.  Distinguish numeric-diff (qty/price) from a pure
    # reduce_only toggle so the audit trail captures why we had to amend.
    qty_matches = abs(parse_metric_number(matching_order.qty) - float(intent.quantity)) <= 1e-9
    price_matches = abs(parse_metric_number(matching_order.price) - float(intent.price)) <= 1e-9
    if qty_matches and price_matches and requires_reduce_only:
        reason_code = "order.requires_reduce_only"
    else:
        reason_code = "order.differs_numeric"
    return LiveOrderReconciliation(
        action="amend",
        reason_code=reason_code,
        matching_order=matching_order,
        stale_orders=list(stale_orders),
    )


def _dispatch_live_intent(intent: ExecutionIntent) -> StrategyExecutionResult:
    """Realise a Live strategy intent against Bybit: reconcile any pre-existing
    strategy order for the same symbol/market (reuse, amend, or cancel +
    submit), emit audit events with the intent's frozen parameter snapshot,
    and clear recovery alerts.

    Round 59 — the reuse / amend / submit decision is delegated to
    :func:`_classify_live_order_reconciliation` which returns a typed
    :class:`LiveOrderReconciliation`; this dispatcher only acts on the
    classification.
    """
    strategy_id = intent.strategy_id
    strategy_name = intent.strategy_name
    resolved_mode = intent.mode
    preview = intent.preview
    side = intent.side
    quantity = intent.quantity
    price = intent.price
    snapshot_symbol = intent.symbol
    snapshot_market = intent.market
    parameter_snapshot = intent.parameter_snapshot
    requested_by = intent.requested_by
    note = intent.note

    existing_strategy_orders = [
        item
        for item in parse_open_orders(use_private_only=True)
        if item.source == "bybit_private"
        and item.origin == "strategy"
        and item.strategy_id == strategy_id
        and item.symbol == snapshot_symbol
        and item.market == snapshot_market
    ]
    reconciliation = _classify_live_order_reconciliation(
        intent,
        existing_strategy_orders,
        requires_reduce_only=_execution_preview_requires_reduce_only(preview),
    )

    for stale_order in reconciliation.stale_orders:
        cancel_exchange_order(stale_order.order_id, requested_by, resolved_mode)
        repo.add_event(
            event_type="strategy.exchange_order.cancelled_stale",
            source="quant-core",
            severity=EventSeverity.WARNING,
            payload={
                "strategy_id": strategy_id,
                "strategy_name": strategy_name,
                "symbol": stale_order.symbol,
                "order_id": stale_order.order_id,
                "mode": resolved_mode.value,
                "requested_by": requested_by,
            },
            symbol=stale_order.symbol,
            strategy_id=strategy_id,
            parameter_snapshot=parameter_snapshot,
        )

    if reconciliation.action == "reuse":
        matching_order = reconciliation.matching_order
        assert matching_order is not None  # invariant: classifier sets it on reuse
        _clear_strategy_manual_execution_alerts(
            strategy_id,
            resolved_mode,
            resolution_detail="后续真实手动策略执行已恢复成功，旧的拦截提醒已收起。",
        )
        _clear_strategy_exchange_rejected_alerts(
            strategy_id,
            resolution_detail="当前真实策略委托已重新进入有效状态，拒单提醒已收起。",
        )
        _clear_strategy_exchange_rejection_guard_alerts(
            strategy_id,
            resolution_detail="当前真实策略委托已重新进入有效状态，连续拒单熔断已收起。",
        )
        _clear_strategy_stale_order_alerts(
            strategy_id,
            resolution_detail="当前真实策略委托已重新进入有效状态，停滞挂单提醒已收起。",
        )
        repo.add_event(
            event_type="strategy.exchange_order.reused_existing",
            source="quant-core",
            severity=EventSeverity.INFO,
            payload={
                "strategy_id": strategy_id,
                "strategy_name": strategy_name,
                "symbol": snapshot_symbol,
                "mode": resolved_mode.value,
                "order_id": matching_order.order_id,
                "quantity": quantity,
                "price": price,
                "requested_by": requested_by,
            },
            symbol=snapshot_symbol,
            strategy_id=strategy_id,
            parameter_snapshot=parameter_snapshot,
        )
        repo._persist()  # type: ignore[attr-defined]
        return StrategyExecutionResult(
            kind="exchange_order",
            strategy_id=strategy_id,
            mode=resolved_mode,
            preview=preview,
            order=matching_order,
            message=f"{strategy_name} 当前真实策略委托已经与最新信号一致，无需改单。",
            generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )

    if reconciliation.action == "amend":
        matching_order = reconciliation.matching_order
        assert matching_order is not None  # invariant: classifier sets it on amend
        order = replace_exchange_order(
            matching_order.order_id,
            quantity,
            price,
            requested_by,
            resolved_mode,
        )
        _clear_strategy_manual_execution_alerts(
            strategy_id,
            resolved_mode,
            resolution_detail="后续真实手动策略执行已恢复成功，旧的拦截提醒已收起。",
        )
        _clear_strategy_exchange_rejected_alerts(
            strategy_id,
            resolution_detail="最新真实策略委托已成功改单，拒单提醒已收起。",
        )
        _clear_strategy_exchange_rejection_guard_alerts(
            strategy_id,
            resolution_detail="最新真实策略委托已成功改单，连续拒单熔断已收起。",
        )
        _clear_strategy_stale_order_alerts(
            strategy_id,
            resolution_detail="最新真实策略委托已成功改单，停滞挂单提醒已收起。",
        )
        repo.add_event(
            event_type="strategy.exchange_order.replaced_existing",
            source="quant-core",
            severity=EventSeverity.INFO,
            payload={
                "strategy_id": strategy_id,
                "strategy_name": strategy_name,
                "symbol": snapshot_symbol,
                "mode": resolved_mode.value,
                "order_id": order.order_id,
                "quantity": quantity,
                "price": price,
                "requested_by": requested_by,
            },
            symbol=snapshot_symbol,
            strategy_id=strategy_id,
            parameter_snapshot=parameter_snapshot,
        )
        repo._persist()  # type: ignore[attr-defined]
        return StrategyExecutionResult(
            kind="exchange_order",
            strategy_id=strategy_id,
            mode=resolved_mode,
            preview=preview,
            order=order,
            message=f"{strategy_name} 已复用当前策略委托并更新为最新信号参数。",
            generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )

    # reconciliation.action == "submit"
    order = submit_exchange_order(
        ManualOrderRequest(
            symbol=snapshot_symbol,
            market=snapshot_market,
            mode=resolved_mode,
            side=side,
            quantity=quantity,
            price=price,
            note=note or f"{strategy_name} 按当前策略信号提交真实委托。",
        ),
        origin="strategy",
        strategy_id=strategy_id,
        requested_by=requested_by,
    )
    _clear_strategy_manual_execution_alerts(
        strategy_id,
        resolved_mode,
        resolution_detail="后续真实手动策略执行已恢复成功，旧的拦截提醒已收起。",
    )
    _clear_strategy_exchange_rejected_alerts(
        strategy_id,
        resolution_detail="最新真实策略委托已成功提交，拒单提醒已收起。",
    )
    _clear_strategy_exchange_rejection_guard_alerts(
        strategy_id,
        resolution_detail="最新真实策略委托已成功提交，连续拒单熔断已收起。",
    )
    _clear_strategy_stale_order_alerts(
        strategy_id,
        resolution_detail="最新真实策略委托已成功提交，停滞挂单提醒已收起。",
    )
    repo.add_event(
        event_type="strategy.exchange_order.submitted",
        source="quant-core",
        severity=EventSeverity.INFO,
        payload={
            "strategy_id": strategy_id,
            "strategy_name": strategy_name,
            "symbol": snapshot_symbol,
            "market": snapshot_market,
            "mode": resolved_mode.value,
            "signal": intent.signal,
            "side": side.value,
            "quantity": quantity,
            "price": price,
            "order_id": order.order_id,
            "requested_by": requested_by,
        },
        symbol=snapshot_symbol,
        strategy_id=strategy_id,
        parameter_snapshot=parameter_snapshot,
    )
    repo._persist()  # type: ignore[attr-defined]
    return StrategyExecutionResult(
        kind="exchange_order",
        strategy_id=strategy_id,
        mode=resolved_mode,
        preview=preview,
        order=order,
        message=f"{strategy_name} 已按当前策略信号向 Bybit 提交真实委托。",
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def _dispatch_execution_intent(intent: ExecutionIntent) -> StrategyExecutionResult:
    """Route a frozen ``ExecutionIntent`` to the paper or live branch based on
    ``intent.mode``.  The decision verdict is assumed to already be
    ``"allow"``: blocked decisions must be surfaced before intent
    construction by ``_dispatch_strategy_signal_from_state``.
    """
    if intent.mode == AccountMode.PAPER:
        return _dispatch_paper_intent(intent)
    return _dispatch_live_intent(intent)


def _dispatch_strategy_signal_from_state(strategy_id: str, payload: StrategyExecutionRequest) -> StrategyExecutionResult:
    preview = _build_strategy_execution_preview_from_state(strategy_id, payload.mode)
    # Round 58 — wrap the preview in a structured ``RiskDecision`` so every
    # downstream branch inspects a typed ``verdict`` + machine-readable
    # ``reason_code`` instead of ad-hoc ``preview.allowed`` / substring checks
    # on ``preview.blocked_reason``.  The embedded ``decision.preview`` keeps
    # numeric fields readable for the ``StrategyExecutionResult`` payload.
    decision = evaluate_risk_decision(preview)
    state = repo.snapshot()
    resolved_mode = payload.mode or state.workspace_preferences.selected_mode
    strategy = next((item for item in state.strategies if item.id == strategy_id), None)
    if strategy is None:
        raise KeyError(strategy_id)
    snapshot = next((item for item in state.strategy_runtime_snapshots if item.strategy_id == strategy_id), None)
    if snapshot is None:
        raise RuntimeError("当前策略运行态尚未准备好，请先刷新策略页后再试。")

    if decision.verdict != "allow":
        # Round 69 — the ``RiskDecision`` wrapper already computes a
        # Chinese ``reason_detail`` (preview.blocked_reason with a generic
        # Chinese fallback); reuse it directly instead of re-deriving the
        # same OR chain here.  The mode-specific fallback only applies when
        # the decision carries an empty detail, which cannot happen for
        # ``verdict != "allow"`` today but is kept as defence-in-depth.
        default_detail = (
            "当前策略 Paper 执行预检未通过。"
            if resolved_mode == AccountMode.PAPER
            else "当前策略真实模式执行预检未通过。"
        )
        detail = decision.reason_detail or default_detail
        # Round 94 — thread the typed ``market`` / ``sub_block_code``
        # discriminators into the record helper so that if
        # ``preview.recommended_action`` is ``None`` (e.g. an unclassified
        # block branch), the helper's internal
        # ``_build_manual_execution_recommended_action`` fallback picks off
        # the typed fields rather than re-deriving ``sub_block_code`` from
        # the detail via the R88 auto-classifier.  Pre-computed
        # ``recommended_action=preview.recommended_action`` still wins when
        # the preview-side recommender already emitted a canned copy — the
        # typed kwargs only matter on the fallback path.
        _record_strategy_manual_execution_issue(
            strategy_id,
            strategy.name,
            snapshot.symbol,
            resolved_mode,
            detail,
            recommended_action=preview.recommended_action,
            strategy=strategy,
            reason_code=decision.reason_code,
            market=snapshot.market,
            sub_block_code=preview.sub_block_code,
        )
        raise StrategyExecutionBlockedError(detail, preview.recommended_action)

    intent = _build_execution_intent_from_state(
        strategy_id=strategy_id,
        payload=payload,
        strategy=strategy,
        snapshot=snapshot,
        resolved_mode=resolved_mode,
        preview=preview,
        decision=decision,
    )
    return _dispatch_execution_intent(intent)


# Round 60 — ``_evaluate_strategy_auto_dispatch_gate`` classifies the autonomous
# strategy-runtime worker's pre-flight guard chain into a typed
# :class:`AutoDispatchGate` decision.  Before R60, six ``continue``-style
# guards interleaved "should we dispatch?" with "what side effects do we run
# on block?" (cancel orders / clear auto-dispatch alerts / record an issue).
# Reason codes: ``auto.paper_or_paused_strategy`` /
# ``auto.live_stop_loss_cooldown`` / ``auto.live_stop_loss_active`` /
# ``auto.rejection_guard_active`` / ``auto.scheduler_or_channel_gate`` /
# ``auto.runtime_not_running`` / ``auto.ready``.
def _evaluate_strategy_auto_dispatch_gate(
    strategy: StrategySummary,
    snapshot: StrategyRuntimeSnapshot,
) -> AutoDispatchGate:
    if strategy.mode == AccountMode.PAPER or strategy.status in {"paper_only", "paused", "shadow"}:
        return AutoDispatchGate(
            verdict="block",
            reason_code="auto.paper_or_paused_strategy",
            reason_detail="策略已暂停或切入影子/仅模拟模式，自动撤销旧策略委托。",
            cancel_existing_orders=True,
            clear_alerts=True,
            record_issue=False,
        )
    cooldown_remaining = _strategy_live_stop_loss_cooldown_remaining_minutes(strategy)
    if cooldown_remaining is not None:
        return AutoDispatchGate(
            verdict="block",
            reason_code="auto.live_stop_loss_cooldown",
            reason_detail=(
                f"当前处于真实模式止损后冷却期，剩余约 {cooldown_remaining} 分钟，"
                "后台自动执行继续保持暂停。"
            ),
            cancel_existing_orders=True,
            clear_alerts=False,
            record_issue=False,
        )
    if _has_active_strategy_live_stop_loss_alert(snapshot.strategy_id):
        return AutoDispatchGate(
            verdict="block",
            reason_code="auto.live_stop_loss_active",
            reason_detail="当前参考价已触发真实模式止损保护，后台自动执行继续保持暂停。",
            cancel_existing_orders=True,
            clear_alerts=False,
            record_issue=False,
        )
    rejection_guard_remaining = _strategy_exchange_rejection_guard_remaining_minutes(strategy)
    if rejection_guard_remaining is not None:
        return AutoDispatchGate(
            verdict="block",
            reason_code="auto.rejection_guard_active",
            reason_detail=(
                f"最近真实策略委托连续拒绝，冷却剩余约 {rejection_guard_remaining} 分钟，"
                "后台自动执行继续保持暂停。"
            ),
            cancel_existing_orders=True,
            clear_alerts=False,
            record_issue=False,
        )
    gate_reason_context = _strategy_auto_dispatch_gate_reason(strategy)
    if gate_reason_context is not None:
        # Round 75 — ``cancel_existing`` now reads directly off the typed
        # context (``AutoDispatchGateReasonContext.cancel_existing``) instead
        # of substring-probing ``gate_reason`` for ``"公共 WS"`` / ``"私有 WS"``
        # and cross-referencing the scheduler status.  The outer
        # ``reason_code`` remains ``auto.scheduler_or_channel_gate`` so the
        # ``AutoDispatchGate`` API surface is unchanged; finer-grained
        # sub-classification is carried on ``gate_reason_context.reason_code``.
        # Round 76 — surface the typed sub-reason on the gate so the alert
        # emitter can tag ``AlertRecord.reason_code`` without re-classifying
        # the free-form detail.
        return AutoDispatchGate(
            verdict="block",
            reason_code="auto.scheduler_or_channel_gate",
            reason_detail=gate_reason_context.detail,
            cancel_existing_orders=gate_reason_context.cancel_existing,
            clear_alerts=False,
            record_issue=True,
            sub_reason_code=gate_reason_context.reason_code,
        )
    if snapshot.runtime_status != "running":
        return AutoDispatchGate(
            verdict="block",
            reason_code="auto.runtime_not_running",
            reason_detail="策略运行态不再处于 running，自动撤销旧策略委托。",
            cancel_existing_orders=True,
            clear_alerts=True,
            record_issue=False,
        )
    return AutoDispatchGate(
        verdict="allow",
        reason_code="auto.ready",
        reason_detail="",
        cancel_existing_orders=False,
        clear_alerts=False,
        record_issue=False,
    )


def _auto_dispatch_strategy_signal_changes(
    previous_by_id: Dict[str, StrategyRuntimeSnapshot],
    current_items: List[StrategyRuntimeSnapshot],
) -> None:
    state = repo.snapshot()
    strategies_by_id = {item.id: item for item in state.strategies}
    for snapshot in current_items:
        previous = previous_by_id.get(snapshot.strategy_id)
        strategy = strategies_by_id.get(snapshot.strategy_id)
        if strategy is None:
            continue
        pending_reconcile = _has_active_strategy_auto_dispatch_alert(snapshot.strategy_id)
        gate = _evaluate_strategy_auto_dispatch_gate(strategy, snapshot)
        if gate.verdict == "block":
            if gate.cancel_existing_orders:
                _cancel_strategy_exchange_orders(
                    snapshot.strategy_id,
                    snapshot.symbol,
                    snapshot.market,
                    strategy.mode,
                    "strategy_runtime_worker",
                    gate.reason_detail,
                )
            if gate.clear_alerts:
                _clear_strategy_auto_dispatch_alerts(snapshot.strategy_id)
            if gate.record_issue:
                # Round 76 — the typed ``sub_reason_code`` (one of the
                # ``AUTO_DISPATCH_GATE_REASON_*`` constants) flows through to
                # the emitted ``AlertRecord.reason_code`` so the
                # runtime-snapshot decoration can branch on it directly.
                # Round 91 — thread the matching
                # :data:`RISK_REASON_RUNTIME_UNAVAILABLE_*` sub-code via the
                # R85 cross-taxonomy mapping so the record helper does not
                # need to re-classify the detail string through the R88
                # ``_derive_sub_block_code_from_detail`` fallback.  Scheduler
                # gate codes have no preview-side counterpart and map to
                # ``None`` (the helper's ``or …`` short-circuits covers
                # the rest).
                _record_strategy_auto_dispatch_issue(
                    snapshot.strategy_id,
                    snapshot.strategy_name,
                    snapshot.symbol,
                    snapshot.signal,
                    strategy.mode,
                    gate.reason_detail,
                    strategy=strategy,
                    reason_code=gate.sub_reason_code,
                    sub_block_code=(
                        _AUTO_DISPATCH_TO_RISK_SUB_BLOCK_CODE.get(gate.sub_reason_code)
                        if gate.sub_reason_code is not None
                        else None
                    ),
                )
            continue
        active_order_count, active_order = _build_strategy_active_order_summary(
            snapshot.strategy_id,
            strategy.mode,
            snapshot.symbol,
            snapshot.market,
        )
        if strategy.mode != AccountMode.PAPER and active_order_count > 1:
            active_orders = _list_strategy_active_orders(
                snapshot.strategy_id,
                strategy.mode,
                snapshot.symbol,
                snapshot.market,
            )
            for stale_order in active_orders[1:]:
                cancel_exchange_order(stale_order.order_id, "strategy_runtime_worker", strategy.mode)
                repo.add_event(
                    event_type="strategy.exchange_order.cancelled_surplus",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={
                        "strategy_id": snapshot.strategy_id,
                        "strategy_name": snapshot.strategy_name,
                        "symbol": snapshot.symbol,
                        "mode": strategy.mode.value,
                        "kept_order_id": active_orders[0].order_id if active_orders else None,
                        "cancelled_order_id": stale_order.order_id,
                    },
                    symbol=snapshot.symbol,
                    strategy_id=snapshot.strategy_id,
                    parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
                )
            repo._persist()  # type: ignore[attr-defined]
            active_order_count, active_order = _build_strategy_active_order_summary(
                snapshot.strategy_id,
                strategy.mode,
                snapshot.symbol,
                snapshot.market,
            )
        if active_order is not None and _is_strategy_active_order_stale(strategy, active_order):
            stale_age_minutes = _strategy_active_order_stale_age_minutes(active_order)
            cancel_exchange_order(active_order.order_id, "strategy_runtime_worker", strategy.mode)
            repo.add_event(
                event_type="strategy.exchange_order.cancelled_stale_timeout",
                source="quant-core",
                severity=EventSeverity.WARNING,
                payload={
                    "strategy_id": snapshot.strategy_id,
                    "strategy_name": snapshot.strategy_name,
                    "symbol": snapshot.symbol,
                    "order_id": active_order.order_id,
                    "mode": strategy.mode.value,
                    "stale_age_minutes": stale_age_minutes,
                    "threshold_minutes": _strategy_exchange_order_stale_minutes(strategy),
                },
                symbol=snapshot.symbol,
                strategy_id=snapshot.strategy_id,
                parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
            )
            repo._persist()  # type: ignore[attr-defined]
            active_order_count = 0
            active_order = None
        if previous is None:
            continue
        if (
            previous.signal == snapshot.signal
            and previous.runtime_status == snapshot.runtime_status
            and not pending_reconcile
        ):
            if (
                strategy.mode != AccountMode.PAPER
                and snapshot.runtime_status == "running"
                and snapshot.signal != "watch"
                and active_order_count == 0
            ):
                try:
                    reconcile_preview = _build_strategy_execution_preview_from_state(snapshot.strategy_id, strategy.mode)
                except RuntimeError:
                    continue
                if reconcile_preview.allowed and reconcile_preview.quantity > 0:
                    repo.add_event(
                        event_type="strategy.exchange_order.reconcile_missing_order",
                        source="quant-core",
                        severity=EventSeverity.WARNING,
                        payload={
                            "strategy_id": snapshot.strategy_id,
                            "strategy_name": snapshot.strategy_name,
                            "symbol": snapshot.symbol,
                            "signal": snapshot.signal,
                            "mode": strategy.mode.value,
                            "quantity": reconcile_preview.quantity,
                            "price": reconcile_preview.price,
                        },
                        symbol=snapshot.symbol,
                        strategy_id=snapshot.strategy_id,
                        parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
                    )
                    repo._persist()  # type: ignore[attr-defined]
                else:
                    continue
            else:
                continue
        if snapshot.signal == "watch":
            _cancel_strategy_exchange_orders(
                snapshot.strategy_id,
                snapshot.symbol,
                snapshot.market,
                strategy.mode,
                "strategy_runtime_worker",
                "策略信号回到 watch，自动撤销旧策略委托。",
            )
            _clear_strategy_auto_dispatch_alerts(snapshot.strategy_id)
            continue
        caught: Optional[BaseException] = None
        try:
            _dispatch_strategy_signal_from_state(
                snapshot.strategy_id,
                StrategyExecutionRequest(
                    requested_by="strategy_runtime_worker",
                    note=f"{snapshot.strategy_name} 自动执行最新策略信号。",
                    mode=strategy.mode,
                ),
            )
        except Exception as exc:  # pragma: no cover - defensive guard for background worker
            caught = exc
        outcome = _classify_auto_dispatch_outcome(caught)
        if outcome.clear_alerts:
            _clear_strategy_auto_dispatch_alerts(snapshot.strategy_id)
        if outcome.emit_noop_event:
            repo.add_event(
                event_type="strategy.exchange_order.auto_noop",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "strategy_id": snapshot.strategy_id,
                    "strategy_name": snapshot.strategy_name,
                    "symbol": snapshot.symbol,
                    "signal": snapshot.signal,
                    "mode": strategy.mode.value,
                    "detail": outcome.reason_detail,
                },
                symbol=snapshot.symbol,
                strategy_id=snapshot.strategy_id,
                parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
            )
            repo._persist()  # type: ignore[attr-defined]
        if outcome.record_issue:
            # Round 92 — thread typed ``sub_block_code`` / ``reason_code`` from
            # the caught exception so ``StrategyExecutionChannelOutageError``
            # instances (carrying ``sub_block_code=RISK_REASON_RUNTIME_UNAVAILABLE_{PUBLIC,PRIVATE}_CHANNEL``
            # from R80) drive the typed discriminators directly rather than
            # letting ``_record_strategy_auto_dispatch_issue``'s internal
            # ``_classify_strategy_auto_dispatch_alert_kind`` /
            # ``_derive_sub_block_code_from_detail`` substring fallbacks parse
            # the detail.  Plain ``RuntimeError`` / ``StrategyExecutionBlockedError``
            # instances do not carry ``sub_block_code``, so ``getattr(..., None)``
            # falls back cleanly and the helper's fallback classifier still fires
            # for them (preserves behaviour for the non-channel-outage branches).
            exc_sub_block_code = getattr(caught, "sub_block_code", None)
            _record_strategy_auto_dispatch_issue(
                snapshot.strategy_id,
                snapshot.strategy_name,
                snapshot.symbol,
                snapshot.signal,
                strategy.mode,
                outcome.reason_detail,
                recommended_action=outcome.recommended_action,
                strategy=strategy,
                reason_code=_RISK_SUB_BLOCK_TO_AUTO_DISPATCH_GATE_REASON.get(exc_sub_block_code)
                if exc_sub_block_code is not None
                else None,
                sub_block_code=exc_sub_block_code,
            )


# Round 61 — ``_classify_auto_dispatch_outcome`` classifies the terminal
# result of an autonomous dispatch call into a typed
# :class:`AutoDispatchOutcome`.  Four verdicts + reason codes:
#
# * ``dispatched`` / ``auto.dispatch.success`` — dispatcher returned without
#   raising; clear any lingering auto-dispatch alerts.
# * ``noop`` / ``auto.dispatch.noop`` — a typed
#   :class:`StrategyExecutionNoopError` (R81) raised at the single source
#   that detects ``target ≈ current``; emit an audit noop event + clear
#   alerts.  Round 89 deleted the legacy ``"无需再次提交委托"`` substring
#   fallback — plain ``RuntimeError`` instances carrying that token are now
#   classified as ``failed`` (the typed subclass is the sole opt-in).
# * ``blocked`` / ``auto.dispatch.blocked`` — a
#   :class:`StrategyExecutionBlockedError`; record the issue carrying the
#   attached ``recommended_action`` so the operator console can render it.
# * ``failed`` / ``auto.dispatch.failed`` — any other ``RuntimeError`` (and,
#   defensively, any other ``Exception``); record the issue without a
#   ``recommended_action``.
def _classify_auto_dispatch_outcome(exc: Optional[BaseException]) -> AutoDispatchOutcome:
    if exc is None:
        return AutoDispatchOutcome(
            verdict="dispatched",
            reason_code="auto.dispatch.success",
            reason_detail="",
            recommended_action=None,
            clear_alerts=True,
            emit_noop_event=False,
            record_issue=False,
        )
    if isinstance(exc, RuntimeError):
        detail = str(exc)
        # Round 89 — the legacy ``"无需再次提交委托"`` substring probe has been
        # removed.  The only in-tree producer of that copy is the typed-raise
        # site at ``_build_strategy_execution_preview_from_state``'s delta
        # short-circuit (main.py:9035), which emits
        # :class:`StrategyExecutionNoopError` (R81).  Plain ``RuntimeError``
        # instances carrying the token no longer auto-classify as ``noop`` —
        # callers must raise the typed subclass to opt into the noop verdict.
        if isinstance(exc, StrategyExecutionNoopError):
            return AutoDispatchOutcome(
                verdict="noop",
                reason_code="auto.dispatch.noop",
                reason_detail=detail,
                recommended_action=None,
                clear_alerts=True,
                emit_noop_event=True,
                record_issue=False,
            )
        if isinstance(exc, StrategyExecutionBlockedError):
            return AutoDispatchOutcome(
                verdict="blocked",
                reason_code="auto.dispatch.blocked",
                reason_detail=detail,
                recommended_action=exc.recommended_action,
                clear_alerts=False,
                emit_noop_event=False,
                record_issue=True,
            )
        return AutoDispatchOutcome(
            verdict="failed",
            reason_code="auto.dispatch.failed",
            reason_detail=detail,
            recommended_action=None,
            clear_alerts=False,
            emit_noop_event=False,
            record_issue=True,
        )
    return AutoDispatchOutcome(
        verdict="failed",
        reason_code="auto.dispatch.failed",
        reason_detail=f"后台自动执行异常：{exc}",
        recommended_action=None,
        clear_alerts=False,
        emit_noop_event=False,
        record_issue=True,
    )


def refresh_strategy_runtime_once(auto_dispatch: bool = False) -> List[StrategyRuntimeSnapshot]:
    state = repo.snapshot()
    previous_by_id = {item.strategy_id: item for item in state.strategy_runtime_snapshots}
    evaluated_at = datetime.now(timezone.utc).astimezone().isoformat()
    try:
        watchlist = market_data.enrich_watchlist(state.watchlist)
    except RuntimeError:
        watchlist = list(state.watchlist)

    watchlist_by_symbol = {item.symbol: item for item in watchlist}
    detail_overrides: Dict[str, MarketDetail] = {}
    snapshots: List[StrategyRuntimeSnapshot] = []

    for strategy in state.strategies:
        if not strategy.symbols:
            continue
        symbol = strategy.symbols[0]
        watch_item = watchlist_by_symbol.get(symbol)
        if watch_item is None:
            continue
        fallback_detail = state.market_details.get(symbol) or build_market_detail_for_watchlist(watch_item)
        try:
            detail = market_data.enrich_market_detail(
                symbol=symbol,
                market=watch_item.market,
                fallback_detail=fallback_detail.model_copy(update={"timeframe": "1h"}),
                watch_item=watch_item,
                timeframe="1h",
            )
        except RuntimeError:
            detail = fallback_detail.model_copy(update={"timeframe": "1h"})
        detail_overrides[symbol] = detail
        snapshots.append(
            evaluate_strategy_runtime(
                strategy=strategy,
                detail=detail,
                watch_item=watch_item,
                evaluated_at=evaluated_at,
            )
        )

    repo.sync_market_watchlist(watchlist, detail_overrides if detail_overrides else None)
    strategy_runtime_state["last_refresh_at"] = evaluated_at
    strategy_runtime_state["last_error"] = None
    updated = repo.update_strategy_runtime_snapshots(snapshots)
    _apply_live_strategy_stop_loss_guards(updated)
    if auto_dispatch:
        _auto_dispatch_strategy_signal_changes(previous_by_id, updated)
    private_order_history = parse_order_history(use_private_only=True, force_refresh=True)
    _sync_strategy_exchange_order_history_events(private_order_history)
    _sync_strategy_exchange_order_history_alerts(private_order_history)
    _sync_strategy_stale_order_issues(updated)
    _sync_strategy_exchange_rejection_guards(updated)
    _sync_strategy_position_drift_issues(updated)
    return updated

def _build_blocked_strategy_execution_preview(
    snapshot: StrategyRuntimeSnapshot,
    mode: AccountMode,
    detail: str,
    block_code: Optional[str] = None,
    *,
    sub_block_code: Optional[str] = None,
    issue_kind: Optional[str] = None,
) -> ExecutionPreview:
    """Round 71 — ``block_code`` lets callers tag the typed risk code at the
    source (worker-health / WS outage / runtime error) so ``evaluate_risk_decision``
    does not need to re-derive it via substring probe.  When ``None`` the
    probe remains the fallback path.

    Round 80 — ``sub_block_code`` carries the finer-grained discriminator for
    umbrella codes that have multiple recovery paths.  The only umbrella
    covered today is ``RISK_REASON_RUNTIME_UNAVAILABLE``: channel-outage
    callers pass the typed private / public channel sub-code via
    ``StrategyExecutionChannelOutageError.sub_block_code``, and runtime
    worker-thread callers pass ``RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD``.

    Round 96 — ``issue_kind`` carries the ``CHANNEL_ISSUE_KIND_*`` typed
    discriminator populated on :class:`StrategyExecutionChannelOutageError`
    (R95).  The umbrella recommender threads it into
    ``_build_{public,private}_execution_channel_recommended_action`` so the
    typed-first NO_FEED / STALE / AUTH branch fires without re-parsing
    ``detail``.  ``None`` lets the umbrella auto-classify (R95 behaviour).
    """

    fallback_side = Direction.BUY if snapshot.signal != "short" else Direction.SELL
    return ExecutionPreview(
        symbol=snapshot.symbol,
        market=snapshot.market,
        mode=mode,
        side=fallback_side,
        origin="strategy",
        strategy_id=snapshot.strategy_id,
        quantity=0.0,
        price=round(snapshot.reference_price or snapshot.last_price, 6),
        notional="--",
        action=snapshot.next_action,
        allowed=False,
        blocked_reason=detail,
        block_code=block_code,
        sub_block_code=sub_block_code,
        # Round 77 — pass the typed ``block_code`` through so the recommender
        # dispatches on the typed family rather than re-classifying ``detail``.
        # Round 79 — also thread ``market`` so the INSUFFICIENT_BALANCE branch
        # keys spot vs perp off the typed field rather than a substring probe.
        # Round 80 — thread the typed ``sub_block_code`` so the RUNTIME_UNAVAILABLE
        # branch picks the channel / worker-thread recovery copy off the typed
        # discriminator rather than a ``"私有 WS"`` / ``"公共 WS"`` / ``"运行线程"`` probe.
        # Round 96 — thread the typed ``issue_kind`` so the channel recommender
        # picks NO_FEED / STALE / AUTH copy off the typed kind rather than
        # auto-classifying ``detail`` again at the umbrella boundary.
        recommended_action=_build_execution_preview_recommended_action(
            detail,
            block_code=block_code,
            sub_block_code=sub_block_code,
            market=snapshot.market,
            issue_kind=issue_kind,
        ),
        warnings=[detail],
        current_position_side="flat",
        current_position_size="--",
        current_avg_price="--",
        projected_position_side="flat",
        projected_position_size="--",
        projected_avg_price="--",
        available_balance_before="--",
        available_balance_after="--",
        estimated_realized_pnl="--",
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )

def _decorate_strategy_runtime_item(item: StrategyRuntimeSnapshot) -> StrategyRuntimeSnapshot:
    if _has_active_strategy_live_stop_loss_alert(item.strategy_id):
        detail = "当前已触发真实模式止损保护，后台自动执行已暂停。"
        return item.model_copy(
            update={
                "note": detail,
                "next_action": "请先复核真实仓位、止损参数和遗留委托，再决定是否恢复自动执行。",
                "guard_state": "live_stop_loss",
                "guard_detail": detail,
            }
        )
    state = repo.snapshot()
    strategy = next((entry for entry in state.strategies if entry.id == item.strategy_id), None)
    if strategy is not None:
        # Round 98 — call the health helper once and read the typed
        # ``issue_kind`` from the dict rather than going through
        # ``get_public_execution_channel_issue`` (string-only) plus a second
        # ``_classify_channel_issue_kind`` re-derivation.  The typed kind is
        # now emitted at source inside
        # ``build_public_execution_channel_health`` from the
        # ``enabled`` / ``connected`` / ``has_symbol_feed`` / ``stale`` branch
        # variables, so the R95 typed-first branch inside the recommender
        # fires off the same typed source that picked the ``issue`` copy.
        public_health = (
            _build_public_execution_channel_health(item.market, item.symbol)
            if strategy.mode in {AccountMode.DEMO, AccountMode.LIVE} and strategy.status == "running"
            else None
        )
        public_channel_issue = public_health.get("issue") if public_health else None
        if public_channel_issue is not None:
            return item.model_copy(
                update={
                    "note": public_channel_issue,
                    "next_action": _build_public_execution_channel_recommended_action(
                        public_channel_issue,
                        issue_kind=public_health.get("issue_kind"),
                    ),
                    "guard_state": "auto_dispatch_blocked",
                    "guard_detail": public_channel_issue,
                }
            )
        private_channel_issue = (
            get_private_execution_channel_issue(strategy.mode)
            if strategy.mode in {AccountMode.DEMO, AccountMode.LIVE} and strategy.status == "running"
            else None
        )
        if private_channel_issue is not None:
            # Round 97 — see the public branch above for the typed-first note.
            return item.model_copy(
                update={
                    "note": private_channel_issue,
                    "next_action": _build_private_execution_channel_recommended_action(
                        private_channel_issue,
                        last_error=str(private_realtime.get_status().get("last_error") or "").strip() or None,
                        issue_kind=_classify_channel_issue_kind(private_channel_issue),
                    ),
                    "guard_state": "auto_dispatch_blocked",
                    "guard_detail": private_channel_issue,
                }
            )
        cooldown_remaining = _strategy_live_stop_loss_cooldown_remaining_minutes(strategy)
        if cooldown_remaining is not None:
            detail = f"当前处于真实模式止损后冷却期，剩余约 {cooldown_remaining} 分钟。"
            return item.model_copy(
                update={
                    "note": detail,
                    "next_action": "冷却结束前不再恢复自动执行；请先人工复核真实仓位和策略参数。",
                    "guard_state": "cooldown",
                    "guard_detail": detail,
                }
            )
        if _has_active_strategy_stale_order_alert(item.strategy_id):
            detail = "当前存在长时间未处理的真实策略挂单，请先复核并决定是否人工处理或等待后台重发。"
            return item.model_copy(
                update={
                    "note": detail,
                    "next_action": "优先检查当前挂单价格与市场偏离，再决定是否人工改单、撤单或切入人工接管。",
                    "guard_state": "auto_dispatch_blocked",
                    "guard_detail": detail,
                }
            )
        rejection_guard_remaining = _strategy_exchange_rejection_guard_remaining_minutes(strategy)
        if rejection_guard_remaining is not None:
            detail = f"最近真实策略委托连续拒绝，自动执行冷却剩余约 {rejection_guard_remaining} 分钟。"
            return item.model_copy(
                update={
                    "note": detail,
                    "next_action": "请先核对真实仓位、最小下单限制和委托参数，确认无误后再恢复自动执行。",
                    "guard_state": "auto_dispatch_blocked",
                    "guard_detail": detail,
                }
            )
    if _has_active_strategy_auto_dispatch_alert(item.strategy_id):
        state = repo.snapshot()
        alert = _find_latest_active_system_alert_by_prefix(state, f"strategy-auto-dispatch:{item.strategy_id}:")
        detail = "当前自动执行被系统拦截，请先查看执行预检和当前委托。"
        next_action = "必要时进入人工接管，确认处理完成后再恢复自动执行。"
        # Round 76 — branch on the typed ``AlertRecord.reason_code``
        # (populated by ``_record_strategy_auto_dispatch_issue`` via the gate
        # path's ``sub_reason_code`` or the detail-based classifier fallback)
        # instead of substring-probing ``alert.description`` for ``"私有 WS"``
        # / ``"公共 WS"`` / ``"公共实时链路"``.
        if alert is not None and alert.reason_code == AUTO_DISPATCH_GATE_REASON_PRIVATE_CHANNEL_OUTAGE:
            detail = alert.description
            # Round 97 — thread the typed ``issue_kind`` (auto-classified from
            # the alert description) so the R95 typed-first branch inside the
            # recommender fires without the substring fallback.
            next_action = alert.suggested_action or _build_private_execution_channel_recommended_action(
                alert.description,
                issue_kind=_classify_channel_issue_kind(alert.description),
            )
        elif alert is not None and alert.reason_code == AUTO_DISPATCH_GATE_REASON_PUBLIC_CHANNEL_OUTAGE:
            detail = alert.description
            # Round 97 — see the private branch above for the typed-first note.
            next_action = alert.suggested_action or _build_public_execution_channel_recommended_action(
                alert.description,
                issue_kind=_classify_channel_issue_kind(alert.description),
            )
        return item.model_copy(
            update={
                "note": detail,
                "next_action": next_action,
                "guard_state": "auto_dispatch_blocked",
                "guard_detail": detail,
            }
        )
    return item.model_copy(update={"guard_state": "none", "guard_detail": None})

def _list_strategy_active_orders(
    strategy_id: str,
    mode: AccountMode,
    symbol: str,
    market: str,
) -> List[OrderRecord]:
    if mode == AccountMode.PAPER:
        orders = repo.get_paper_orders()
    else:
        orders = parse_open_orders(use_private_only=True)
    matching = [
        item
        for item in orders
        if item.origin == "strategy"
        and item.symbol == symbol
        and item.market == market
        and (item.strategy_id == strategy_id or (item.strategy_id is None and mode != AccountMode.PAPER))
    ]
    matching.sort(key=lambda item: item.created_at, reverse=True)
    return matching

def _build_strategy_active_order_summary(
    strategy_id: str,
    mode: AccountMode,
    symbol: str,
    market: str,
) -> tuple[int, Optional[OrderRecord]]:
    matching = _list_strategy_active_orders(strategy_id, mode, symbol, market)
    return len(matching), matching[0] if matching else None

def _build_strategy_position_alignment_summary(
    strategy_id: str,
    mode: AccountMode,
    symbol: str,
    market: str,
    active_order_count: int,
) -> tuple[str, Optional[str], str, Optional[str]]:
    if mode == AccountMode.PAPER:
        positions = repo.get_paper_positions()
    else:
        positions = parse_positions(use_private_only=True)
    position = next((item for item in positions if item.symbol == symbol and item.market == market), None)
    current_signed_qty = 0.0
    if position is not None:
        current_signed_qty = parse_metric_number(position.size) * (1 if position.side == "long" else -1)

    try:
        hint = repo.get_strategy_signal_order_hint(strategy_id)
        target_signed_qty = float(hint["target_signed_qty"])
        if mode != AccountMode.PAPER:
            existing_strategy_orders = _list_strategy_private_open_orders(strategy_id, symbol, market)
            _release_order_ids, released_buy_reservation = _strategy_order_release_context(existing_strategy_orders)
            reusable_open_order_abs = _strategy_reusable_open_order_abs(
                existing_strategy_orders,
                raw_target_signed_qty=target_signed_qty,
            )
            target_resolution = _resolve_balance_linked_strategy_target_signed_qty(
                symbol=symbol,
                market=market,
                mode=mode,
                price=float(hint["price"]),
                raw_target_signed_qty=target_signed_qty,
                current_signed_qty=current_signed_qty,
                risk_budget=hint.get("risk_budget"),
                released_buy_reservation=released_buy_reservation,
                reusable_open_order_abs=reusable_open_order_abs,
            )
            target_signed_qty = float(target_resolution["display_target_signed_qty"])
            if target_resolution["blocked_reason"]:
                return (
                    repo._classify_position_side(target_signed_qty),  # type: ignore[attr-defined]
                    normalize_number(abs(target_signed_qty), 6),
                    "unknown",
                    str(target_resolution["blocked_reason"]),
                )
    except Exception:
        return "flat", None, "unknown", "当前策略信号仍在观察或目标仓位暂不可用。"

    delta_signed_qty = round(target_signed_qty - current_signed_qty, 12)
    target_position_side = repo._classify_position_side(target_signed_qty)  # type: ignore[attr-defined]
    target_position_size = normalize_number(abs(target_signed_qty), 6)

    if abs(delta_signed_qty) <= 1e-9:
        return (
            target_position_side,
            target_position_size,
            "aligned",
            "当前实际仓位已与策略目标仓位对齐。",
        )
    if active_order_count > 0:
        return (
            target_position_side,
            target_position_size,
            "reconciling",
            "当前存在策略关联委托，正在向目标仓位对齐。",
        )
    return (
        target_position_side,
        target_position_size,
        "drifted",
        "当前实际仓位与策略目标仍有偏差，尚未完全对齐。",
    )

def _build_strategy_current_position_summary(
    mode: AccountMode,
    symbol: str,
    market: str,
) -> tuple[str, Optional[str], Optional[str]]:
    if mode == AccountMode.PAPER:
        positions = repo.get_paper_positions()
    else:
        positions = parse_positions(use_private_only=True)
    position = next((item for item in positions if item.symbol == symbol and item.market == market), None)
    if position is None:
        return "flat", None, None
    avg_price = position.avg_price if position.avg_price not in {"", "--"} else None
    return position.side, position.size, avg_price

def _sync_strategy_exchange_order_history_events(history_items: List[OrderRecord]) -> None:
    def _event_payload_matches(item: ExecutionEvent, event_type: str, order_id: str) -> bool:
        return item.event_type == event_type and str(item.payload.get("order_id") or "") == order_id

    changed = False
    with repo._lock:  # type: ignore[attr-defined]
        for order in history_items:
            if order.origin != "strategy" or not order.strategy_id:
                continue
            status_normalized = order.status.lower()
            if "fill" in status_normalized:
                event_type = "exchange_order.filled"
                severity = EventSeverity.INFO
                detail = f"真实策略委托已成交 {order.qty}@{order.price} ({order.status})"
            elif "cancel" in status_normalized:
                event_type = "exchange_order.cancelled"
                severity = EventSeverity.WARNING
                detail = f"真实策略委托已撤销 {order.qty}@{order.price} ({order.status})"
            elif "reject" in status_normalized:
                event_type = "exchange_order.rejected"
                severity = EventSeverity.ERROR
                detail = f"真实策略委托被拒绝 {order.qty}@{order.price} ({order.status})"
            else:
                continue
            if any(_event_payload_matches(event, event_type, order.order_id) for event in repo.state.audit_events):  # type: ignore[attr-defined]
                continue
            repo.add_event(
                event_type=event_type,
                source="quant-core",
                severity=severity,
                payload={
                    "order_id": order.order_id,
                    "order_created_at": order.created_at,
                    "strategy_id": order.strategy_id,
                    "symbol": order.symbol,
                    "market": order.market,
                    "status": order.status,
                    "qty": order.qty,
                    "price": order.price,
                    "detail": detail,
                },
                symbol=order.symbol,
                strategy_id=order.strategy_id,
                parameter_snapshot=_resolve_strategy_parameter_snapshot(order.strategy_id),
            )
            changed = True
        if changed:
            repo._persist()  # type: ignore[attr-defined]

def _sync_strategy_exchange_order_history_alerts(history_items: List[OrderRecord]) -> None:
    snapshot_state = repo.snapshot()
    strategies_by_id = {item.id: item for item in snapshot_state.strategies}
    fallback_mode = snapshot_state.workspace_preferences.selected_mode

    def _parse_order_time(value: Optional[str]) -> datetime:
        if not value:
            return datetime.fromtimestamp(0, tz=timezone.utc)
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.fromtimestamp(0, tz=timezone.utc)

    latest_by_strategy: Dict[str, OrderRecord] = {}
    for order in history_items:
        if order.origin != "strategy" or not order.strategy_id:
            continue
        current = latest_by_strategy.get(order.strategy_id)
        if current is None or _parse_order_time(order.created_at) >= _parse_order_time(current.created_at):
            latest_by_strategy[order.strategy_id] = order

    for strategy_id, order in latest_by_strategy.items():
        if "reject" not in order.status.lower():
            _clear_strategy_exchange_rejected_alerts(
                strategy_id,
                resolution_detail="最新真实策略委托已不再处于拒单状态，异常提醒已收起。",
            )
            continue
        strategy = strategies_by_id.get(strategy_id)
        strategy_name = strategy.name if strategy is not None else strategy_id
        issue_mode = strategy.mode if strategy is not None else fallback_mode
        changed = False
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=f"strategy-exchange-rejected:{strategy_id}:{order.order_id}",
                severity="P1",
                symbol=order.symbol,
                title=f"{order.symbol} 策略真实委托被拒绝",
                description=(
                    f"{strategy_name} 最近一笔真实策略委托被交易所拒绝。"
                    f"委托参数 {order.qty}@{order.price}，状态 {order.status}。"
                ),
                suggested_action="打开策略页、交易记录和账户页复核真实仓位、委托参数与模式配置。",
                strategy_id=strategy_id,
            )
            if changed:
                _queue_strategy_issue_review_locked(
                    strategy_id=strategy_id,
                    strategy_name=strategy_name,
                    symbol=order.symbol,
                    mode=issue_mode,
                    issue_type="exchange_order_rejected",
                    summary=f"{order.symbol} 策略真实委托被拒绝",
                    detail=f"委托参数 {order.qty}@{order.price}，状态 {order.status}。",
                    rule_key=f"strategy-exchange-rejected:{strategy_id}:{order.order_id}",
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]

def _sync_strategy_exchange_rejection_guards(current_items: List[StrategyRuntimeSnapshot]) -> None:
    state = repo.snapshot()
    strategies_by_id = {item.id: item for item in state.strategies}
    for snapshot in current_items:
        strategy = strategies_by_id.get(snapshot.strategy_id)
        if strategy is None:
            continue
        remaining = _strategy_exchange_rejection_guard_remaining_minutes(strategy)
        if remaining is None:
            _clear_strategy_exchange_rejection_guard_alerts(
                snapshot.strategy_id,
                resolution_detail="连续拒单熔断已结束，真实策略自动执行可在人工确认后恢复。",
            )
            continue
        rejection_count = _strategy_exchange_rejection_recent_count(strategy)
        detail = (
            f"最近 {_strategy_exchange_rejection_guard_window_minutes(strategy)} 分钟真实策略委托已连续拒绝 "
            f"{rejection_count} 次，自动执行冷却剩余约 {remaining} 分钟。"
        )
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=f"strategy-exchange-rejection-guard:{snapshot.strategy_id}:{snapshot.mode.value}",
                severity="P1",
                symbol=snapshot.symbol,
                title=f"{snapshot.symbol} 策略连续拒单已熔断",
                description=f"{snapshot.strategy_name} 当前已进入连续拒单冷却期。{detail}",
                suggested_action="先复核交易所模式、仓位、委托参数和最小下单约束，确认后再恢复自动执行。",
                strategy_id=snapshot.strategy_id,
            )
            if changed:
                _queue_strategy_issue_review_locked(
                    strategy_id=snapshot.strategy_id,
                    strategy_name=snapshot.strategy_name,
                    symbol=snapshot.symbol,
                    mode=snapshot.mode,
                    issue_type="exchange_rejection_guard",
                    summary=f"{snapshot.symbol} 策略连续拒单已熔断",
                    detail=detail,
                    rule_key=f"strategy-exchange-rejection-guard:{snapshot.strategy_id}:{snapshot.mode.value}",
                )
                repo.add_event(
                    event_type="strategy.exchange_order.rejection_guard.alerted",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={
                        "strategy_id": snapshot.strategy_id,
                        "strategy_name": snapshot.strategy_name,
                        "symbol": snapshot.symbol,
                        "mode": snapshot.mode.value,
                        "rejection_count": rejection_count,
                        "window_minutes": _strategy_exchange_rejection_guard_window_minutes(strategy),
                        "cooldown_remaining_minutes": remaining,
                        "detail": detail,
                    },
                    symbol=snapshot.symbol,
                    strategy_id=snapshot.strategy_id,
                    parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]

def _sync_strategy_stale_order_issues(current_items: List[StrategyRuntimeSnapshot]) -> None:
    state = repo.snapshot()
    strategies_by_id = {item.id: item for item in state.strategies}
    for snapshot in current_items:
        strategy = strategies_by_id.get(snapshot.strategy_id)
        if strategy is None:
            continue
        active_order_count, active_order = _build_strategy_active_order_summary(
            snapshot.strategy_id,
            snapshot.mode,
            snapshot.symbol,
            snapshot.market,
        )
        if (
            snapshot.mode == AccountMode.PAPER
            or snapshot.runtime_status != "running"
            or active_order_count == 0
            or active_order is None
            or not _is_strategy_active_order_stale(strategy, active_order)
        ):
            _clear_strategy_stale_order_alerts(
                snapshot.strategy_id,
                resolution_detail="当前已不再存在长时间未处理的策略挂单，停滞提醒已收起。",
            )
            continue

        stale_age_minutes = _strategy_active_order_stale_age_minutes(active_order)
        detail = (
            f"当前真实策略委托已挂单约 {stale_age_minutes} 分钟仍未成交或撤单，"
            f"超过 { _strategy_exchange_order_stale_minutes(strategy) } 分钟阈值。"
        )
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=f"strategy-stale-order:{snapshot.strategy_id}:{active_order.order_id}",
                severity="P1",
                symbol=snapshot.symbol,
                title=f"{snapshot.symbol} 策略挂单停滞",
                description=f"{snapshot.strategy_name} 当前存在长时间未处理的真实策略委托。{detail}",
                suggested_action="先复核委托价格是否偏离、交易所限制与市场状态；必要时改价、撤单或人工接管。",
                strategy_id=snapshot.strategy_id,
            )
            if changed:
                _queue_strategy_issue_review_locked(
                    strategy_id=snapshot.strategy_id,
                    strategy_name=snapshot.strategy_name,
                    symbol=snapshot.symbol,
                    mode=snapshot.mode,
                    issue_type="stale_order",
                    summary=f"{snapshot.symbol} 策略挂单停滞",
                    detail=detail,
                    rule_key=f"strategy-stale-order:{snapshot.strategy_id}:{active_order.order_id}",
                )
                repo.add_event(
                    event_type="strategy.exchange_order.stale_alerted",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={
                        "strategy_id": snapshot.strategy_id,
                        "strategy_name": snapshot.strategy_name,
                        "symbol": snapshot.symbol,
                        "mode": snapshot.mode.value,
                        "order_id": active_order.order_id,
                        "stale_age_minutes": stale_age_minutes,
                        "threshold_minutes": _strategy_exchange_order_stale_minutes(strategy),
                        "detail": detail,
                    },
                    symbol=snapshot.symbol,
                    strategy_id=snapshot.strategy_id,
                    parameter_snapshot=parameter_resolver.snapshot_parameters(strategy),
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]

def _build_strategy_last_execution_summary(
    strategy_id: str,
    symbol: str,
    market: str,
    mode: AccountMode,
    recent_order_history: Optional[List[OrderRecord]] = None,
) -> tuple[Optional[str], Optional[str], Optional[EventSeverity], Optional[str], Optional[str]]:
    strategy_execution_events = {
        "strategy.exchange_order.cancelled_inactive",
        "strategy.exchange_order.cancelled_stale",
        "strategy.exchange_order.cancelled_stale_timeout",
        "strategy.exchange_order.reused_existing",
        "strategy.exchange_order.replaced_existing",
        "strategy.exchange_order.submitted",
        "strategy.exchange_order.reconcile_missing_order",
        "strategy.exchange_order.auto_blocked",
        "strategy.exchange_order.auto_noop",
        "strategy.execution.blocked",
    }

    def _parse_iso(value: Optional[str]) -> datetime:
        if not value:
            return datetime.fromtimestamp(0, tz=timezone.utc)
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.fromtimestamp(0, tz=timezone.utc)

    best_event_type: Optional[str] = None
    best_occurred_at: Optional[str] = None
    best_severity: Optional[EventSeverity] = None
    best_detail: Optional[str] = None
    best_recommended_action: Optional[str] = None
    best_at = datetime.fromtimestamp(0, tz=timezone.utc)

    for event in repo.snapshot().audit_events:
        if event.strategy_id != strategy_id:
            continue
        if not (
            event.event_type in strategy_execution_events
            or event.event_type.startswith("strategy.paper_trade.")
            or event.event_type == "strategy.paper_stop_loss.executed"
            or event.event_type.startswith("exchange_order.")
        ):
            continue
        detail = (
            str(event.payload.get("detail") or "").strip()
            or str(event.payload.get("message") or "").strip()
            or (
                f'order_id={event.payload.get("order_id")}'
                if event.payload.get("order_id")
                else event.event_type
            )
        )
        event_sort_key = event.payload.get("order_created_at") if event.event_type.startswith("exchange_order.") else event.occurred_at
        occurred_at = _parse_iso(event_sort_key)
        if occurred_at >= best_at:
            best_event_type = event.event_type
            best_occurred_at = event.occurred_at
            best_severity = event.severity
            best_detail = detail
            best_recommended_action = str(event.payload.get("recommended_action") or "").strip() or None
            best_at = occurred_at

    if mode != AccountMode.PAPER:
        history_items = recent_order_history if recent_order_history is not None else parse_order_history(use_private_only=True)
        for order in history_items:
            if order.origin != "strategy":
                continue
            if order.symbol != symbol or order.market != market:
                continue
            if order.strategy_id not in {strategy_id, None}:
                continue
            order_at = _parse_iso(order.created_at)
            if order_at < best_at:
                continue
            status_normalized = order.status.lower()
            if "fill" in status_normalized:
                event_type = "exchange_order.filled"
                severity = EventSeverity.INFO
                detail = f"最近真实策略委托已成交 {order.qty}@{order.price} ({order.status})"
            elif "cancel" in status_normalized:
                event_type = "exchange_order.cancelled"
                severity = EventSeverity.WARNING
                detail = f"最近真实策略委托已撤销 {order.qty}@{order.price} ({order.status})"
            elif "reject" in status_normalized:
                event_type = "exchange_order.rejected"
                severity = EventSeverity.ERROR
                detail = f"最近真实策略委托被拒绝 {order.qty}@{order.price} ({order.status})"
            else:
                event_type = "exchange_order.updated"
                severity = EventSeverity.INFO
                detail = f"最近真实策略委托状态 {order.status} {order.qty}@{order.price}"
            best_event_type = event_type
            best_occurred_at = order.created_at
            best_severity = severity
            best_detail = detail
            best_recommended_action = None
            best_at = order_at

    return best_event_type, best_occurred_at, best_severity, best_detail, best_recommended_action

def _sync_strategy_position_drift_issues(current_items: List[StrategyRuntimeSnapshot]) -> None:
    for snapshot in current_items:
        active_order_count, _active_order = _build_strategy_active_order_summary(
            snapshot.strategy_id,
            snapshot.mode,
            snapshot.symbol,
            snapshot.market,
        )
        (
            target_position_side,
            target_position_size,
            position_alignment,
            position_alignment_detail,
        ) = _build_strategy_position_alignment_summary(
            snapshot.strategy_id,
            snapshot.mode,
            snapshot.symbol,
            snapshot.market,
            active_order_count,
        )
        enriched = snapshot.model_copy(
            update={
                "target_position_side": target_position_side,
                "target_position_size": target_position_size,
                "position_alignment": position_alignment,
                "position_alignment_detail": position_alignment_detail,
            }
        )
        _sync_strategy_position_drift_issue(enriched, active_order_count=active_order_count)

def _get_strategy_signal_order_hint_for_runtime_snapshot(
    strategy_id: str,
    runtime_snapshot: StrategyRuntimeSnapshot,
) -> Dict[str, Any]:
    current_getter = repo.get_strategy_signal_order_hint
    if getattr(current_getter, "__func__", None) is AppRepository.get_strategy_signal_order_hint:
        with repo._lock:  # type: ignore[attr-defined]
            strategy = repo._find_strategy(strategy_id)  # type: ignore[attr-defined]
            target_signed_qty = repo._resolve_strategy_target_signed_qty_locked(  # type: ignore[attr-defined]
                strategy,
                runtime_snapshot,
            )
        if target_signed_qty is None:
            raise ValueError("当前策略仍处于 watch 观察状态，暂时没有可提交的委托方向。")
        price = round(runtime_snapshot.reference_price or runtime_snapshot.last_price, 6)
        return {
            "strategy_id": strategy.id,
            "strategy_name": strategy.name,
            "symbol": runtime_snapshot.symbol,
            "market": runtime_snapshot.market,
            "signal": runtime_snapshot.signal,
            "risk_budget": strategy.risk_budget,
            "target_signed_qty": target_signed_qty,
            "price": price,
            "note": runtime_snapshot.next_action,
        }

    with repo._lock:  # type: ignore[attr-defined]
        original_snapshots = list(repo.state.strategy_runtime_snapshots)
        next_snapshots = [
            runtime_snapshot if item.strategy_id == strategy_id else item
            for item in repo.state.strategy_runtime_snapshots
        ]
        if not any(item.strategy_id == strategy_id for item in repo.state.strategy_runtime_snapshots):
            next_snapshots.append(runtime_snapshot)
        repo.state.strategy_runtime_snapshots = next_snapshots
    try:
        return current_getter(strategy_id)
    finally:
        with repo._lock:  # type: ignore[attr-defined]
            repo.state.strategy_runtime_snapshots = original_snapshots

def _build_strategy_execution_preview_from_state(
    strategy_id: str,
    mode: Optional[AccountMode] = None,
    runtime_snapshot_override: Optional[StrategyRuntimeSnapshot] = None,
) -> ExecutionPreview:
    state = repo.snapshot()
    resolved_mode = mode or state.workspace_preferences.selected_mode
    runtime_health = _build_strategy_runtime_worker_health()
    strategy = next((item for item in state.strategies if item.id == strategy_id), None)
    if strategy is None:
        raise KeyError(strategy_id)

    snapshot = runtime_snapshot_override or next(
        (item for item in state.strategy_runtime_snapshots if item.strategy_id == strategy_id),
        None,
    )
    if snapshot is None:
        raise RuntimeError("当前策略运行态尚未准备好，请先刷新策略页后再试。")
    if snapshot.runtime_status == "paused":
        raise RuntimeError("当前策略已暂停，不能生成执行预检。")
    if resolved_mode == AccountMode.PAPER:
        if not (strategy.mode == AccountMode.PAPER or strategy.status == "paper_only"):
            raise RuntimeError("当前策略并未运行在 Paper 模式，不能生成 Paper 执行预检。")
    elif strategy.mode != resolved_mode:
        raise RuntimeError(f"当前策略并未运行在 {resolved_mode.value.upper()} 模式，不能直接按该模式执行。")

    if resolved_mode == AccountMode.PAPER:
        preview = snapshot.execution_preview
        if preview is None:
            raise RuntimeError("当前策略没有可执行的 Paper 预检结果。")
        return preview

    public_channel_issue = get_public_execution_channel_issue(snapshot.market, snapshot.symbol)
    if public_channel_issue is not None:
        # Round 74 — typed subclass so ``build_strategy_execution_preview``
        # can recover this as a blocked preview without substring-probing
        # ``str(exc)`` for "公共 WS".
        # Round 80 — pass ``channel="public"`` so the exception carries the
        # typed ``RISK_REASON_RUNTIME_UNAVAILABLE_PUBLIC_CHANNEL`` sub-code
        # alongside the umbrella ``RISK_REASON_RUNTIME_UNAVAILABLE`` block code.
        raise StrategyExecutionChannelOutageError(public_channel_issue, channel="public")

    private_channel_issue = get_private_execution_channel_issue(resolved_mode)
    if private_channel_issue is not None:
        # Round 74 — see ``public_channel_issue`` branch above.
        # Round 80 — see ``channel="public"`` note above; this path emits the
        # ``RISK_REASON_RUNTIME_UNAVAILABLE_PRIVATE_CHANNEL`` sub-code.
        raise StrategyExecutionChannelOutageError(private_channel_issue, channel="private")

    if runtime_health["runtime_last_error"]:
        raise RuntimeError("当前策略运行线程存在异常，请先在设置页恢复运行线程后再执行真实策略。")
    if runtime_health["runtime_worker_stale"]:
        raise RuntimeError("当前策略运行线程已停滞，请先在设置页恢复运行线程并确认最新信号后再执行真实策略。")

    cooldown_remaining = _strategy_live_stop_loss_cooldown_remaining_minutes(strategy)
    if cooldown_remaining is not None:
        raise RuntimeError(f"当前处于真实模式止损后冷却期，剩余约 {cooldown_remaining} 分钟，请先人工复核后再恢复策略执行。")
    rejection_guard_remaining = _strategy_exchange_rejection_guard_remaining_minutes(strategy)
    if rejection_guard_remaining is not None:
        raise RuntimeError(
            f"最近真实策略委托连续拒绝，自动执行冷却剩余约 {rejection_guard_remaining} 分钟，请先人工复核交易所约束和委托参数。"
        )

    if runtime_snapshot_override is not None:
        hint = _get_strategy_signal_order_hint_for_runtime_snapshot(strategy_id, snapshot)
    else:
        hint = repo.get_strategy_signal_order_hint(strategy_id)
    positions = parse_positions(use_private_only=True)
    position = next(
        (
            item
            for item in positions
            if item.symbol == hint["symbol"] and item.market == hint["market"]
        ),
        None,
    )
    current_signed_qty = 0.0
    if position is not None:
        current_signed_qty = parse_metric_number(position.size) * (1 if position.side == "long" else -1)
    existing_strategy_orders = _list_strategy_private_open_orders(strategy_id, hint["symbol"], hint["market"])
    release_order_ids, released_buy_reservation = _strategy_order_release_context(existing_strategy_orders)
    reusable_open_order_abs = _strategy_reusable_open_order_abs(
        existing_strategy_orders,
        raw_target_signed_qty=float(hint["target_signed_qty"]),
    )
    target_resolution = _resolve_balance_linked_strategy_target_signed_qty(
        symbol=hint["symbol"],
        market=hint["market"],
        mode=resolved_mode,
        price=float(hint["price"]),
        raw_target_signed_qty=float(hint["target_signed_qty"]),
        current_signed_qty=current_signed_qty,
        risk_budget=hint.get("risk_budget"),
        released_buy_reservation=released_buy_reservation,
        reusable_open_order_abs=reusable_open_order_abs,
    )
    target_signed_qty = float(target_resolution["target_signed_qty"])
    preview_target_signed_qty = float(target_resolution["preview_target_signed_qty"])
    strategy_adjustment_warnings = list(target_resolution["warnings"])
    delta_signed_qty = round(preview_target_signed_qty - current_signed_qty, 12)
    if abs(delta_signed_qty) <= 1e-9 and target_resolution["blocked_reason"] is not None:
        current_position_side = repo._classify_position_side(current_signed_qty)  # type: ignore[attr-defined]
        current_position_size = repo._format_quantity(abs(current_signed_qty), 6)  # type: ignore[attr-defined]
        current_avg_price = position.avg_price if position is not None and abs(current_signed_qty) > 1e-9 else "--"
        return ExecutionPreview(
            symbol=hint["symbol"],
            market=hint["market"],
            mode=resolved_mode,
            side=Direction.BUY if float(hint["target_signed_qty"]) > current_signed_qty else Direction.SELL,
            origin="strategy",
            strategy_id=strategy_id,
            quantity=0.0,
            price=round(float(hint["price"]), 6),
            notional=format_usdt(0.0),
            action=hint["note"] or "等待真实执行引擎",
            allowed=False,
            blocked_reason=str(target_resolution["blocked_reason"]),
            block_code=target_resolution.get("block_code"),
            recommended_action=target_resolution["recommended_action"],
            sizing_risk_budget=target_resolution["sizing_risk_budget"],
            sizing_budget_notional=target_resolution["sizing_budget_notional"],
            sizing_minimum_required_notional=target_resolution["sizing_minimum_required_notional"],
            sizing_available_balance_gap=target_resolution["sizing_available_balance_gap"],
            warnings=strategy_adjustment_warnings,
            current_position_side=current_position_side,
            current_position_size=current_position_size,
            current_avg_price=current_avg_price,
            projected_position_side=current_position_side,
            projected_position_size=current_position_size,
            projected_avg_price=current_avg_price,
            available_balance_before="--",
            available_balance_after="--",
            estimated_realized_pnl="--",
            generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
    if abs(delta_signed_qty) <= 1e-9:
        # Round 81 — typed subclass lets ``_classify_auto_dispatch_outcome``
        # dispatch via ``isinstance`` instead of substring-probing the detail
        # string.  Raising the subclass at the single source that emits the
        # "无需再次提交委托" copy is the only producer of this noop verdict.
        raise StrategyExecutionNoopError(
            "当前真实持仓已经与策略目标一致，无需再次提交委托。"
        )
    side = Direction.BUY if delta_signed_qty > 0 else Direction.SELL
    price, price_adjustment_warning = _align_strategy_limit_price_to_exchange_constraints(
        hint["symbol"],
        hint["market"],
        side,
        float(hint["price"]),
    )
    preview = build_private_execution_preview(
        ExecutionPreviewRequest(
            symbol=hint["symbol"],
            market=hint["market"],
            mode=resolved_mode,
            side=side,
            quantity=abs(delta_signed_qty),
            price=price,
            origin="strategy",
            strategy_id=strategy_id,
            note=hint["note"],
            release_order_ids=release_order_ids,
        )
    )
    if price_adjustment_warning is not None:
        strategy_adjustment_warnings.append(price_adjustment_warning)
    warnings = strategy_adjustment_warnings + list(preview.warnings)
    if target_resolution["blocked_reason"] is not None:
        return preview.model_copy(
            update={
                "allowed": False,
                "blocked_reason": target_resolution["blocked_reason"],
                "recommended_action": target_resolution["recommended_action"],
                "sizing_risk_budget": target_resolution["sizing_risk_budget"],
                "sizing_budget_notional": target_resolution["sizing_budget_notional"],
                "sizing_minimum_required_notional": target_resolution["sizing_minimum_required_notional"],
                "sizing_available_balance_gap": target_resolution["sizing_available_balance_gap"],
                "warnings": warnings,
            }
        )
    matching_order = next((item for item in existing_strategy_orders if item.side == side), None)
    stale_orders = [
        item
        for item in existing_strategy_orders
        if matching_order is None or item.order_id != matching_order.order_id
    ]
    if matching_order is not None:
        if _exchange_order_matches_requested_target(
            matching_order,
            preview.quantity,
            preview.price,
            require_reduce_only=_execution_preview_requires_reduce_only(preview),
        ):
            warnings.append("当前已有同参数策略委托，若继续执行会直接复用旧委托。")
        else:
            warnings.append("当前已有策略委托，若继续执行会按最新信号参数改单。")
    if stale_orders:
        warnings.append("当前还存在旧策略委托，若继续执行会先自动撤掉旧委托。")
    if _has_active_strategy_live_stop_loss_alert(strategy_id):
        warnings.append("当前真实模式止损保护仍在生效。")
        # Round 82 — tag the stop-loss-guard block with the typed
        # ``RISK_REASON_STOP_LOSS_GUARD`` code at source so downstream
        # recommenders branch on the typed field rather than substring-probe
        # ``"止损保护"`` on the detail.
        return preview.model_copy(
            update={
                "allowed": False,
                "blocked_reason": "当前已触发真实模式止损保护，请先人工复核真实仓位后再决定是否恢复策略执行。",
                "recommended_action": "请先人工复核真实仓位与策略参数，确认无误后再恢复策略执行。",
                "block_code": RISK_REASON_STOP_LOSS_GUARD,
                "warnings": warnings,
            }
        )
    return preview.model_copy(update={"warnings": warnings})

def _runtime_worker_execution_block_reason(runtime_health: Dict[str, Any]) -> Optional[str]:
    if runtime_health["runtime_last_error"]:
        return "当前策略运行线程存在异常，请先在设置页恢复运行线程后再执行真实策略。"
    if runtime_health["runtime_worker_stale"]:
        return "当前策略运行线程已停滞，请先在设置页恢复运行线程并确认最新信号后再执行真实策略。"
    if runtime_health.get("runtime_worker_stopped"):
        return "当前策略运行线程未运行，请先在设置页恢复运行线程后再执行真实策略。"
    return None

def build_strategy_execution_preview(strategy_id: str, mode: Optional[AccountMode] = None) -> ExecutionPreview:
    state = repo.snapshot()
    resolved_mode = mode or state.workspace_preferences.selected_mode
    runtime_health = _build_strategy_runtime_worker_health()
    if resolved_mode != AccountMode.PAPER:
        runtime_block_reason = _runtime_worker_execution_block_reason(runtime_health)
        if runtime_block_reason is not None:
            raise RuntimeError(runtime_block_reason)
    refresh_strategy_runtime_once()
    try:
        return _build_strategy_execution_preview_from_state(strategy_id, mode)
    except StrategyExecutionChannelOutageError as exc:
        # Round 74 — replaces the previous
        # ``except RuntimeError`` + ``if "私有 WS" not in detail and "公共 WS" not in detail: raise``
        # substring branch.  The typed subclass is only raised for the two
        # realtime-channel outage paths in
        # ``_build_strategy_execution_preview_from_state``; every other
        # ``RuntimeError`` now propagates naturally without a re-raise.
        # Round 80 — forward the typed ``sub_block_code`` (public/private
        # channel) so the blocked preview carries it and
        # ``_build_execution_preview_recommended_action`` dispatches without
        # substring-probing the detail for ``"私有 WS"`` / ``"公共 WS"``.
        # Round 96 — also forward the typed ``issue_kind`` populated by
        # ``StrategyExecutionChannelOutageError.__init__`` (R95) so the channel
        # recommender picks NO_FEED / STALE / AUTH copy off the typed kind
        # without re-classifying ``detail`` at the umbrella boundary.
        detail = str(exc)
        snapshot = next((item for item in repo.snapshot().strategy_runtime_snapshots if item.strategy_id == strategy_id), None)
        if snapshot is None:
            raise
        return _build_blocked_strategy_execution_preview(
            snapshot,
            resolved_mode,
            detail,
            block_code=exc.block_code,
            sub_block_code=exc.sub_block_code,
            issue_kind=exc.issue_kind,
        )

def _apply_runtime_blocked_preview_context(
    item: StrategyRuntimeSnapshot,
    preview: Optional[ExecutionPreview],
) -> StrategyRuntimeSnapshot:
    if preview is None:
        return item
    # Round 65 — route the blocked-preview decoration through the typed
    # ``RiskDecision`` wrapper so ``guard_detail`` / ``note`` come from
    # ``decision.reason_detail`` rather than the raw ``preview.blocked_reason``.
    # The ``not preview.blocked_reason`` short-circuit is preserved so the
    # defensive ``allowed=False`` + empty-reason edge case still short-circuits.
    decision = evaluate_risk_decision(preview)
    if decision.verdict != "block" or not preview.blocked_reason:
        return item
    update: Dict[str, Any] = {
        "guard_detail": decision.reason_detail,
        "note": decision.reason_detail,
        "next_action": preview.recommended_action or item.next_action,
    }
    if item.guard_state == "none":
        update["guard_state"] = "auto_dispatch_blocked"
    return item.model_copy(update=update)

def build_strategy_runtime_response() -> List[StrategyRuntimeSnapshot]:
    runtime_health_before_refresh = _build_strategy_runtime_worker_health()
    items = refresh_strategy_runtime_once()
    state = repo.snapshot()
    resolved_mode = state.workspace_preferences.selected_mode
    runtime_block_reason = None
    if resolved_mode != AccountMode.PAPER:
        runtime_block_reason = _runtime_worker_execution_block_reason(runtime_health_before_refresh)
    private_order_history = parse_order_history(use_private_only=True)
    next_items: List[StrategyRuntimeSnapshot] = []
    for item in items:
        item = _decorate_strategy_runtime_item(item)
        active_order_count, active_order = _build_strategy_active_order_summary(
            item.strategy_id,
            item.mode,
            item.symbol,
            item.market,
        )
        (
            last_execution_event_type,
            last_execution_at,
            last_execution_severity,
            last_execution_detail,
            last_execution_recommended_action,
        ) = _build_strategy_last_execution_summary(
            item.strategy_id,
            item.symbol,
            item.market,
            item.mode,
            private_order_history,
        )
        (
            target_position_side,
            target_position_size,
            position_alignment,
            position_alignment_detail,
        ) = _build_strategy_position_alignment_summary(
            item.strategy_id,
            item.mode,
            item.symbol,
            item.market,
            active_order_count,
        )
        current_position_side, current_position_size, current_position_avg_price = _build_strategy_current_position_summary(
            item.mode,
            item.symbol,
            item.market,
        )
        item = item.model_copy(
            update={
                "active_order_count": active_order_count,
                "active_order": active_order,
                "current_position_side": current_position_side,
                "current_position_size": current_position_size,
                "current_position_avg_price": current_position_avg_price,
                "target_position_side": target_position_side,
                "target_position_size": target_position_size,
                "position_alignment": position_alignment,
                "position_alignment_detail": position_alignment_detail,
                "last_execution_event_type": last_execution_event_type,
                "last_execution_at": last_execution_at,
                "last_execution_severity": last_execution_severity,
                "last_execution_detail": last_execution_detail,
            }
        )
        if (
            item.guard_state == "auto_dispatch_blocked"
            and last_execution_event_type in {"strategy.execution.blocked", "strategy.exchange_order.auto_blocked"}
            and last_execution_detail
        ):
            recommended_action = last_execution_recommended_action or _build_execution_preview_recommended_action(
                last_execution_detail, market=item.market
            )
            item = item.model_copy(
                update={
                    "note": last_execution_detail,
                    "guard_detail": last_execution_detail,
                    "next_action": recommended_action or item.next_action,
                }
            )
        _sync_strategy_position_drift_issue(item, active_order_count=active_order_count)
        if item.runtime_status == "paused":
            next_items.append(item)
            continue
        if resolved_mode == AccountMode.PAPER or item.mode != resolved_mode:
            next_items.append(item)
            continue
        if runtime_block_reason is not None:
            blocked_item = item
            if item.guard_state == "none":
                blocked_item = item.model_copy(
                    update={
                        "guard_state": "auto_dispatch_blocked",
                        "guard_detail": runtime_block_reason,
                    }
                )
            # Round 80 — tag the runtime worker-thread outage with the typed
            # sub-code so the recommender picks the "打开设置页…恢复运行线程"
            # copy off ``sub_block_code`` rather than the ``"运行线程"`` probe.
            blocked_preview = _build_blocked_strategy_execution_preview(
                blocked_item,
                resolved_mode,
                runtime_block_reason,
                block_code=RISK_REASON_RUNTIME_UNAVAILABLE,
                sub_block_code=RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD,
            )
            blocked_item = _apply_runtime_blocked_preview_context(blocked_item, blocked_preview)
            next_items.append(
                blocked_item.model_copy(
                    update={
                        "execution_preview": blocked_preview
                    }
                )
            )
            continue
        try:
            preview = _build_strategy_execution_preview_from_state(item.strategy_id, resolved_mode)
        except RuntimeError as exc:
            # Round 90 — thread typed ``block_code`` / ``sub_block_code``
            # attrs (carried by :class:`StrategyExecutionChannelOutageError`
            # / other typed subclasses) through to the blocked preview so
            # the recommender's typed sub-dispatch fires on the snapshot's
            # execution_preview.  Plain ``RuntimeError`` carries neither
            # attr so ``getattr(..., None)`` falls back cleanly.
            # Round 96 — also forward ``issue_kind`` (populated on
            # :class:`StrategyExecutionChannelOutageError` by R95) so the
            # channel recommender picks NO_FEED / STALE / AUTH copy off the
            # typed kind end-to-end.
            preview = _build_blocked_strategy_execution_preview(
                item,
                resolved_mode,
                str(exc),
                block_code=getattr(exc, "block_code", None),
                sub_block_code=getattr(exc, "sub_block_code", None),
                issue_kind=getattr(exc, "issue_kind", None),
            )
        except ValueError as exc:
            preview = _build_blocked_strategy_execution_preview(item, resolved_mode, str(exc))
        item = _apply_runtime_blocked_preview_context(item, preview)
        next_items.append(item.model_copy(update={"execution_preview": preview}))
    return next_items


def dispatch_strategy_signal(strategy_id: str, payload: StrategyExecutionRequest) -> StrategyExecutionResult:
    state = repo.snapshot()
    resolved_mode = payload.mode or state.workspace_preferences.selected_mode
    if resolved_mode != AccountMode.PAPER:
        runtime_block_reason = _runtime_worker_execution_block_reason(_build_strategy_runtime_worker_health())
        if runtime_block_reason is not None:
            strategy = next((item for item in state.strategies if item.id == strategy_id), None)
            snapshot = next((item for item in state.strategy_runtime_snapshots if item.strategy_id == strategy_id), None)
            if strategy is not None:
                symbol = snapshot.symbol if snapshot is not None else (strategy.symbols[0] if strategy.symbols else "")
                watch_item = next((item for item in state.watchlist if item.symbol == symbol), None)
                _ = watch_item
                # Round 84 — the runtime-worker outage is the canonical
                # producer of the ``"运行线程"`` detail substring; thread the
                # typed ``RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD``
                # sub-code through so the recommender picks the
                # "打开设置页…恢复运行线程" copy off the typed sub-code
                # rather than the substring probe.
                _record_strategy_manual_execution_issue(
                    strategy_id,
                    strategy.name,
                    symbol,
                    resolved_mode,
                    runtime_block_reason,
                    strategy=strategy,
                    reason_code=RISK_REASON_RUNTIME_UNAVAILABLE,
                    sub_block_code=RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD,
                )
            raise StrategyExecutionBlockedError(
                runtime_block_reason,
                _build_manual_execution_recommended_action(
                    runtime_block_reason,
                    sub_block_code=RISK_REASON_RUNTIME_UNAVAILABLE_WORKER_THREAD,
                ),
            )
    refresh_strategy_runtime_once()
    try:
        return _dispatch_strategy_signal_from_state(strategy_id, payload)
    except StrategyExecutionNoopError:
        # Round 86 — noop is a "target already matches, nothing to submit"
        # signal rather than an error; propagate without recording an issue
        # so the manual-dispatch route does not spam the blocked-execution
        # audit feed with a pseudo-block.
        raise
    except RuntimeError as exc:
        if resolved_mode != AccountMode.PAPER:
            strategy = next((item for item in repo.snapshot().strategies if item.id == strategy_id), None)
            snapshot = next((item for item in repo.snapshot().strategy_runtime_snapshots if item.strategy_id == strategy_id), None)
            if strategy is not None:
                symbol = snapshot.symbol if snapshot is not None else (strategy.symbols[0] if strategy.symbols else "")
                # Round 86 — ``StrategyExecutionChannelOutageError`` carries the
                # typed ``block_code`` / ``sub_block_code`` discriminators; read
                # them off the instance so the record helper can forward the
                # typed sub-code to ``_build_manual_execution_recommended_action``
                # instead of leaning on the ``"私有 WS"`` / ``"公共 WS"``
                # substring probe.  Plain ``RuntimeError`` instances carry
                # neither attr so ``getattr(..., None)`` falls back cleanly.
                exc_block_code = getattr(exc, "block_code", None)
                exc_sub_block_code = getattr(exc, "sub_block_code", None)
                _record_strategy_manual_execution_issue(
                    strategy_id,
                    strategy.name,
                    symbol,
                    resolved_mode,
                    str(exc),
                    recommended_action=exc.recommended_action if isinstance(exc, StrategyExecutionBlockedError) else None,
                    strategy=strategy,
                    reason_code=exc_block_code,
                    sub_block_code=exc_sub_block_code,
                )
        raise


def build_strategy_live_snapshot_payload() -> StrategyLiveSnapshot:
    items = build_strategy_runtime_response()
    return StrategyLiveSnapshot(
        items=items,
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def run_strategy_runtime_loop() -> None:
    strategy_runtime_state["running"] = True
    while not strategy_runtime_stop_event.is_set():
        try:
            refresh_strategy_runtime_once(auto_dispatch=True)
        except Exception as exc:  # pragma: no cover - background loop safety
            strategy_runtime_state["last_error"] = str(exc)
            try:
                repo.add_event(
                    event_type="strategy.runtime.worker.error",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={"error": str(exc)},
                )
                repo._persist()  # type: ignore[attr-defined]
            except Exception:
                pass
        if strategy_runtime_stop_event.wait(8.0):
            break
    strategy_runtime_state["running"] = False


def _start_strategy_runtime_worker(clear_error: bool = False) -> bool:
    global strategy_runtime_thread
    if strategy_runtime_thread is not None and strategy_runtime_thread.is_alive():
        return False
    if clear_error:
        strategy_runtime_state["last_error"] = None
    strategy_runtime_state["started_once"] = True
    strategy_runtime_state["running"] = False
    strategy_runtime_stop_event.clear()
    strategy_runtime_thread = threading.Thread(
        target=run_strategy_runtime_loop,
        name="strategy-runtime-worker",
        daemon=True,
    )
    strategy_runtime_thread.start()
    return True


def _stop_strategy_runtime_worker(timeout: float = 3.0) -> bool:
    global strategy_runtime_thread
    thread = strategy_runtime_thread
    strategy_runtime_stop_event.set()
    if thread is None or not thread.is_alive():
        strategy_runtime_state["running"] = False
        strategy_runtime_thread = None
        return True
    thread.join(timeout=timeout)
    if thread.is_alive():
        return False
    strategy_runtime_state["running"] = False
    strategy_runtime_thread = None
    return True


def restart_strategy_runtime_worker(payload: RuntimeWorkerActionPayload) -> RuntimeWorkerActionResult:
    requested_at = datetime.now(timezone.utc).astimezone().isoformat()
    restart_failed_rule_key = "strategy-runtime-worker:restart-failed"
    repo.add_event(
        event_type="strategy.runtime.worker.restart_requested",
        source="desktop",
        severity=EventSeverity.INFO,
        payload={
            "requested_by": payload.requested_by,
            "reason": payload.reason or "手动恢复策略运行线程",
        },
    )
    if not _stop_strategy_runtime_worker():
        description = "尝试恢复后台策略运行线程时，线程未能在超时时间内停止。"
        suggested_action = "稍后重试恢复运行线程；若反复失败，请打开系统日志/审计查看最近线程事件。"
        with repo._lock:  # type: ignore[attr-defined]
            changed = repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=restart_failed_rule_key,
                severity="P1",
                symbol="SYSTEM",
                title="恢复运行线程失败",
                description=description,
                suggested_action=suggested_action,
            )
            if changed:
                repo.add_event(
                    event_type="strategy.runtime.worker.restart_failed_alerted",
                    source="quant-core",
                    severity=EventSeverity.WARNING,
                    payload={"detail": description},
                )
                repo._refresh_derived_state()  # type: ignore[attr-defined]
                repo._persist()  # type: ignore[attr-defined]
        repo.add_event(
            event_type="strategy.runtime.worker.restart_failed",
            source="quant-core",
            severity=EventSeverity.ERROR,
            payload={
                "requested_by": payload.requested_by,
                "reason": payload.reason or "手动恢复策略运行线程",
                "detail": description,
            },
        )
        repo._persist()  # type: ignore[attr-defined]
        raise RuntimeError("策略运行线程未能在超时时间内停止，请稍后重试。")
    _start_strategy_runtime_worker(clear_error=True)
    repo.add_event(
        event_type="strategy.runtime.worker.restarted",
        source="quant-core",
        severity=EventSeverity.INFO,
        payload={
            "requested_by": payload.requested_by,
            "reason": payload.reason or "手动恢复策略运行线程",
        },
    )
    repo._persist()  # type: ignore[attr-defined]
    _clear_strategy_runtime_worker_alerts(
        restart_failed_rule_key,
        resolved_event_type="strategy.runtime.worker.restart_failed_resolved",
        resolution_detail="恢复运行线程失败的异常状态已解除。",
    )
    _sync_strategy_runtime_worker_issue_alerts()
    running = bool(strategy_runtime_thread and strategy_runtime_thread.is_alive())
    return RuntimeWorkerActionResult(
        running=running,
        restarted_at=requested_at,
        last_error=strategy_runtime_state.get("last_error"),
        last_refresh_at=strategy_runtime_state.get("last_refresh_at"),
        message="策略运行线程已重新启动。" if running else "策略运行线程已收到重启请求。",
    )


def build_scheduler_snapshot_payload() -> SchedulerSnapshot:
    state = repo.snapshot()
    return SchedulerSnapshot(
        scheduler=state.control_snapshot.scheduler,
        jobs=state.agent_jobs,
        change_requests=state.change_requests[:8],
        latest_scheduler_command=_build_latest_scheduler_command(state.audit_events),
    )


def build_ai_live_snapshot_payload() -> AiLiveSnapshot:
    state = repo.snapshot()
    scheduler_snapshot = build_scheduler_snapshot_payload()
    activity_feed = [
        event
        for event in state.audit_events
        if event.source in {"openclaw", "desktop"}
    ][:10]
    return AiLiveSnapshot(
        scheduler=scheduler_snapshot.scheduler,
        jobs=scheduler_snapshot.jobs,
        change_requests=scheduler_snapshot.change_requests,
        latest_scheduler_command=scheduler_snapshot.latest_scheduler_command,
        activity_feed=activity_feed,
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def build_ops_live_snapshot_payload() -> OpsLiveSnapshot:
    _sync_strategy_runtime_worker_issue_alerts()
    _sync_private_execution_channel_alerts()
    state = repo.snapshot()
    alerts = state.alerts
    trades = parse_trades()
    audit_events = state.audit_events[:80]
    execution_health = _build_control_snapshot_response().execution_health
    latest_scheduler_command = _build_latest_scheduler_command(state.audit_events)

    return OpsLiveSnapshot(
        summary=OpsLiveSummary(
            pending_alerts=sum(1 for item in alerts if not item.acknowledged),
            p0_alerts=sum(1 for item in alerts if item.severity == "P0" and not item.acknowledged),
            recent_trades=len(trades[:20]),
            manual_trades=sum(1 for item in trades if item.origin == "manual"),
            strategy_trades=sum(1 for item in trades if item.origin == "strategy"),
            audit_warnings=sum(1 for item in audit_events if item.severity == "warning"),
            audit_critical=sum(1 for item in audit_events if item.severity == "critical"),
            execution_issue_total=(
                (1 if execution_health.runtime_worker_issue else 0)
                +
                execution_health.active_stop_loss_guards
                + execution_health.cooldowns
                + execution_health.auto_dispatch_blocked
                + execution_health.rejection_guards
                + execution_health.stale_order_guards
                + execution_health.drifts
            ),
            execution_top_issue=execution_health.top_issue,
            execution_top_issue_strategy_id=execution_health.top_issue_strategy_id,
            execution_top_issue_strategy_name=execution_health.top_issue_strategy_name,
            execution_top_issue_symbol=execution_health.top_issue_symbol,
            execution_top_issue_detail=execution_health.top_issue_detail,
            latest_event_type=audit_events[0].event_type if audit_events else None,
        ),
        alerts=alerts,
        trades=trades,
        audit_events=audit_events,
        latest_scheduler_command=latest_scheduler_command,
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def build_account_live_snapshot_payload(mode: Optional[AccountMode] = None) -> AccountLiveSnapshot:
    overview = parse_account_overview(mode=mode)
    positions = parse_positions(mode=mode)
    orders = parse_open_orders(mode=mode)
    order_history = parse_order_history(mode=mode)
    return AccountLiveSnapshot(
        overview=overview,
        positions=positions,
        orders=orders,
        order_history=order_history,
        generated_at=datetime.now(timezone.utc).astimezone().isoformat(),
    )


def _summarize_strategy_activity_execution_preview(
    preview: Optional[ExecutionPreview],
) -> Optional[Dict[str, Any]]:
    if preview is None:
        return None
    return {
        "mode": preview.mode.value,
        "allowed": preview.allowed,
        "action": preview.action,
        "side": preview.side.value,
        "quantity": preview.quantity,
        "price": preview.price,
        "notional": preview.notional,
        "blocked_reason": preview.blocked_reason,
        "recommended_action": preview.recommended_action,
        "projected_position_side": preview.projected_position_side,
        "projected_position_size": preview.projected_position_size,
        "available_balance_after": preview.available_balance_after,
        "sizing_risk_budget": preview.sizing_risk_budget,
        "sizing_budget_notional": preview.sizing_budget_notional,
        "sizing_minimum_required_notional": preview.sizing_minimum_required_notional,
        "sizing_available_balance_gap": preview.sizing_available_balance_gap,
    }


def _build_strategy_activity_review_context(strategy_id: str) -> Optional[Dict[str, Any]]:
    if not strategy_id:
        return None
    try:
        activity = build_strategy_activity_payload(strategy_id)
    except KeyError:
        return None

    runtime = activity.runtime
    indexes = build_strategy_activity_review_context_indexes(activity)

    latest_key_audit_event = AppRepository._pick_latest_key_execution_event(activity.recent_audit_events)
    latest_active_order_record = max(
        activity.active_orders,
        key=lambda item: parse_optional_iso_datetime(item.created_at),
        default=None,
    )
    latest_historical_order_record = max(
        activity.recent_orders,
        key=lambda item: parse_optional_iso_datetime(item.created_at),
        default=None,
    )
    latest_trade_record = max(
        activity.recent_trades,
        key=lambda item: parse_optional_iso_datetime(item.created_at),
        default=None,
    )
    latest_alert_record = max(
        activity.recent_alerts,
        key=lambda item: parse_optional_iso_datetime(item.triggered_at),
        default=None,
    )
    latest_pending_alert_record = max(
        [item for item in activity.recent_alerts if not item.acknowledged],
        key=lambda item: parse_optional_iso_datetime(item.triggered_at),
        default=None,
    )
    latest_order_record = max(
        [
            item
            for item in [
                latest_active_order_record,
                latest_historical_order_record,
            ]
            if item is not None
        ],
        key=lambda item: parse_optional_iso_datetime(item.created_at),
        default=None,
    )
    latest_ops = _build_strategy_activity_latest_ops_snapshot(
        latest_active_order_summary=summarize_order(latest_active_order_record) if latest_active_order_record else None,
        latest_historical_order_summary=(
            summarize_order(latest_historical_order_record) if latest_historical_order_record else None
        ),
        latest_order_summary=summarize_order(latest_order_record) if latest_order_record else None,
        latest_pending_alert_summary=summarize_alert(latest_pending_alert_record) if latest_pending_alert_record else None,
        latest_trade_summary=summarize_trade(latest_trade_record) if latest_trade_record else None,
        latest_alert_summary=summarize_alert(latest_alert_record) if latest_alert_record else None,
        latest_audit_event_summary=AppRepository._summarize_execution_event(latest_key_audit_event)
        if latest_key_audit_event
        else None,
        latest_active_order_record=latest_active_order_record,
        latest_historical_order_record=latest_historical_order_record,
        latest_order_record=latest_order_record,
        latest_pending_alert_record=latest_pending_alert_record,
        latest_trade_record=latest_trade_record,
        latest_alert_record=latest_alert_record,
        latest_audit_event_record=latest_key_audit_event,
    )

    return {
        "strategy_id": activity.strategy_id,
        "strategy_name": activity.strategy_name,
        "symbol": activity.symbol,
        "mode": activity.mode.value,
        "generated_at": activity.generated_at,
        "decision_context": (
            activity.decision_context.model_dump(mode="json")
            if activity.decision_context is not None
            else None
        ),
        "activity_sections": (
            activity.activity_sections.model_dump(mode="json")
            if activity.activity_sections is not None
            else None
        ),
        "runtime": (
            {
                "signal": runtime.signal,
                "guard_state": runtime.guard_state,
                "guard_detail": runtime.guard_detail,
                "note": runtime.note,
                "next_action": runtime.next_action,
                "position_alignment": runtime.position_alignment,
                "position_alignment_detail": runtime.position_alignment_detail,
                "last_execution_event_type": runtime.last_execution_event_type,
                "execution_preview": _summarize_strategy_activity_execution_preview(runtime.execution_preview),
            }
            if runtime is not None
            else None
        ),
        "latest_runtime": _build_strategy_activity_latest_runtime_snapshot(runtime=runtime, latest_ops=latest_ops).model_dump(mode="json"),
        "latest_ops": latest_ops.model_dump(mode="json"),
        "active_order_count": len(activity.active_orders),
        "active_orders": [summarize_order(order) for order in activity.active_orders[:3]],
        "latest_active_order": latest_ops.latest_active_order,
        "latest_active_order_record": (
            latest_ops.latest_active_order_record.model_dump(mode="json") if latest_ops.latest_active_order_record else None
        ),
        "latest_historical_order": latest_ops.latest_historical_order,
        "latest_historical_order_record": (
            latest_ops.latest_historical_order_record.model_dump(mode="json")
            if latest_ops.latest_historical_order_record
            else None
        ),
        "latest_order": latest_ops.latest_order,
        "latest_order_record": latest_ops.latest_order_record.model_dump(mode="json") if latest_ops.latest_order_record else None,
        "recent_orders": [summarize_order(order) for order in activity.recent_orders[:3]],
        "latest_trade": latest_ops.latest_trade,
        "latest_trade_record": latest_ops.latest_trade_record.model_dump(mode="json") if latest_ops.latest_trade_record else None,
        "recent_trades": [summarize_trade(trade) for trade in activity.recent_trades[:3]],
        "latest_pending_alert": latest_ops.latest_pending_alert,
        "latest_pending_alert_record": (
            latest_ops.latest_pending_alert_record.model_dump(mode="json")
            if latest_ops.latest_pending_alert_record
            else None
        ),
        "latest_alert": latest_ops.latest_alert,
        "latest_alert_record": latest_ops.latest_alert_record.model_dump(mode="json") if latest_ops.latest_alert_record else None,
        "recent_alerts": [summarize_alert(alert) for alert in activity.recent_alerts[:3]],
        "latest_proposal": (
            summarize_strategy_activity_proposal(activity, activity.latest_proposal, indexes)
            if activity.latest_proposal
            else None
        ),
        "latest_actionable_proposal": (
            summarize_strategy_activity_proposal(activity, activity.latest_actionable_proposal, indexes)
            if activity.latest_actionable_proposal
            else None
        ),
        "latest_proposal_change_request": (
            summarize_change_request(activity.latest_proposal_change_request)
            if activity.latest_proposal_change_request
            else None
        ),
        "latest_proposal_backtest": (
            summarize_backtest(activity.latest_proposal_backtest) if activity.latest_proposal_backtest else None
        ),
        "latest_proposal_backtest_record": (
            activity.latest_proposal_backtest_record.model_dump(mode="json")
            if activity.latest_proposal_backtest_record
            else None
        ),
        "latest_proposal_review": (
            summarize_review(activity.latest_proposal_review) if activity.latest_proposal_review else None
        ),
        "latest_proposal_review_record": (
            activity.latest_proposal_review_record.model_dump(mode="json")
            if activity.latest_proposal_review_record
            else None
        ),
        "latest_proposal_job": (
            summarize_agent_job(activity.latest_proposal_job) if activity.latest_proposal_job else None
        ),
        "latest_proposal_job_record": (
            activity.latest_proposal_job_record.model_dump(mode="json")
            if activity.latest_proposal_job_record
            else None
        ),
        "latest_actionable_proposal_change_request": (
            summarize_change_request(activity.latest_actionable_proposal_change_request)
            if activity.latest_actionable_proposal_change_request
            else None
        ),
        "latest_actionable_proposal_backtest": (
            summarize_backtest(activity.latest_actionable_proposal_backtest)
            if activity.latest_actionable_proposal_backtest
            else None
        ),
        "latest_actionable_proposal_backtest_record": (
            activity.latest_actionable_proposal_backtest_record.model_dump(mode="json")
            if activity.latest_actionable_proposal_backtest_record
            else None
        ),
        "latest_actionable_proposal_review": (
            summarize_review(activity.latest_actionable_proposal_review)
            if activity.latest_actionable_proposal_review
            else None
        ),
        "latest_actionable_proposal_review_record": (
            activity.latest_actionable_proposal_review_record.model_dump(mode="json")
            if activity.latest_actionable_proposal_review_record
            else None
        ),
        "latest_actionable_proposal_job": (
            summarize_agent_job(activity.latest_actionable_proposal_job)
            if activity.latest_actionable_proposal_job
            else None
        ),
        "latest_actionable_proposal_job_record": (
            activity.latest_actionable_proposal_job_record.model_dump(mode="json")
            if activity.latest_actionable_proposal_job_record
            else None
        ),
        "recent_proposals": [
            summarize_strategy_activity_proposal(activity, proposal, indexes)
            for proposal in activity.recent_proposals[:3]
        ],
        "latest_change_request": summarize_change_request(activity.latest_change_request) if activity.latest_change_request else None,
        "latest_actionable_change_request": (
            summarize_change_request(activity.latest_actionable_change_request)
            if activity.latest_actionable_change_request
            else None
        ),
        "latest_change_request_backtest_record": (
            activity.latest_change_request_backtest_record.model_dump(mode="json")
            if activity.latest_change_request_backtest_record
            else None
        ),
        "latest_change_request_review_record": (
            activity.latest_change_request_review_record.model_dump(mode="json")
            if activity.latest_change_request_review_record
            else None
        ),
        "latest_change_request_job_record": (
            activity.latest_change_request_job_record.model_dump(mode="json")
            if activity.latest_change_request_job_record
            else None
        ),
        "latest_change_request_source_backtest_record": (
            activity.latest_change_request_source_backtest_record.model_dump(mode="json")
            if activity.latest_change_request_source_backtest_record
            else None
        ),
        "latest_change_request_source_review_record": (
            activity.latest_change_request_source_review_record.model_dump(mode="json")
            if activity.latest_change_request_source_review_record
            else None
        ),
        "latest_change_request_source_proposal_record": (
            activity.latest_change_request_source_proposal_record.model_dump(mode="json")
            if activity.latest_change_request_source_proposal_record
            else None
        ),
        "latest_actionable_change_request_backtest_record": (
            activity.latest_actionable_change_request_backtest_record.model_dump(mode="json")
            if activity.latest_actionable_change_request_backtest_record
            else None
        ),
        "latest_actionable_change_request_review_record": (
            activity.latest_actionable_change_request_review_record.model_dump(mode="json")
            if activity.latest_actionable_change_request_review_record
            else None
        ),
        "latest_actionable_change_request_job_record": (
            activity.latest_actionable_change_request_job_record.model_dump(mode="json")
            if activity.latest_actionable_change_request_job_record
            else None
        ),
        "latest_actionable_change_request_source_backtest_record": (
            activity.latest_actionable_change_request_source_backtest_record.model_dump(mode="json")
            if activity.latest_actionable_change_request_source_backtest_record
            else None
        ),
        "latest_actionable_change_request_source_review_record": (
            activity.latest_actionable_change_request_source_review_record.model_dump(mode="json")
            if activity.latest_actionable_change_request_source_review_record
            else None
        ),
        "latest_actionable_change_request_source_proposal_record": (
            activity.latest_actionable_change_request_source_proposal_record.model_dump(mode="json")
            if activity.latest_actionable_change_request_source_proposal_record
            else None
        ),
        "recent_change_requests": [
            summarize_change_request(change_request)
            for change_request in activity.recent_change_requests[:3]
        ],
        "latest_backtest": summarize_backtest(activity.latest_backtest) if activity.latest_backtest else None,
        "latest_actionable_backtest": (
            summarize_backtest(activity.latest_actionable_backtest)
            if activity.latest_actionable_backtest
            else None
        ),
        "latest_backtest_record": (
            activity.latest_backtest_record.model_dump(mode="json") if activity.latest_backtest_record else None
        ),
        "latest_actionable_backtest_record": (
            activity.latest_actionable_backtest_record.model_dump(mode="json")
            if activity.latest_actionable_backtest_record
            else None
        ),
        "latest_actionable_backtest_review": (
            summarize_review(activity.latest_actionable_backtest_review)
            if activity.latest_actionable_backtest_review
            else None
        ),
        "latest_backtest_review_record": (
            activity.latest_backtest_review_record.model_dump(mode="json")
            if activity.latest_backtest_review_record
            else None
        ),
        "latest_backtest_job_record": (
            activity.latest_backtest_job_record.model_dump(mode="json")
            if activity.latest_backtest_job_record
            else None
        ),
        "latest_actionable_backtest_review_record": (
            activity.latest_actionable_backtest_review_record.model_dump(mode="json")
            if activity.latest_actionable_backtest_review_record
            else None
        ),
        "latest_actionable_backtest_job_record": (
            activity.latest_actionable_backtest_job_record.model_dump(mode="json")
            if activity.latest_actionable_backtest_job_record
            else None
        ),
        "latest_actionable_backtest_job": (
            summarize_agent_job(activity.latest_actionable_backtest_job)
            if activity.latest_actionable_backtest_job
            else None
        ),
        "latest_backtest_review": summarize_review(activity.latest_backtest_review) if activity.latest_backtest_review else None,
        "latest_backtest_job": summarize_agent_job(activity.latest_backtest_job) if activity.latest_backtest_job else None,
        "recent_backtests": [summarize_backtest(backtest) for backtest in activity.recent_backtests[:3]],
        "latest_primary_review": summarize_review(activity.latest_primary_review) if activity.latest_primary_review else None,
        "latest_actionable_primary_review": (
            summarize_review(activity.latest_actionable_primary_review)
            if activity.latest_actionable_primary_review
            else None
        ),
        "latest_primary_review_record": (
            activity.latest_primary_review_record.model_dump(mode="json")
            if activity.latest_primary_review_record
            else None
        ),
        "latest_actionable_primary_review_record": (
            activity.latest_actionable_primary_review_record.model_dump(mode="json")
            if activity.latest_actionable_primary_review_record
            else None
        ),
        "latest_tracking_review": summarize_review(activity.latest_tracking_review) if activity.latest_tracking_review else None,
        "latest_tracking_job": summarize_agent_job(activity.latest_tracking_job) if activity.latest_tracking_job else None,
        "latest_tracking_review_record": (
            activity.latest_tracking_review_record.model_dump(mode="json")
            if activity.latest_tracking_review_record
            else None
        ),
        "latest_tracking_job_record": (
            activity.latest_tracking_job_record.model_dump(mode="json")
            if activity.latest_tracking_job_record
            else None
        ),
        "latest_retryable_tracking_job": (
            summarize_agent_job(activity.latest_retryable_tracking_job)
            if activity.latest_retryable_tracking_job
            else None
        ),
        "latest_retryable_tracking_job_record": (
            activity.latest_retryable_tracking_job_record.model_dump(mode="json")
            if activity.latest_retryable_tracking_job_record
            else None
        ),
        "latest_audit_event": latest_ops.latest_audit_event,
        "latest_audit_event_record": (
            latest_ops.latest_audit_event_record.model_dump(mode="json")
            if latest_ops.latest_audit_event_record
            else None
        ),
        "recent_reviews": [summarize_review(review) for review in activity.recent_reviews[:3]],
        "recent_agent_jobs": [summarize_agent_job(job) for job in activity.recent_agent_jobs[:4]],
        "recent_audit_events": [summarize_event(event) for event in activity.recent_audit_events[:4]],
    }



@app.get("/api/strategies")
def get_strategies():
    return repo.snapshot().strategies


@app.get("/api/strategies/live", response_model=List[StrategyRuntimeSnapshot])
def get_strategy_runtime():
    return build_strategy_runtime_response()


@app.get(
    "/api/strategies/{strategy_id}/activity",
    response_model=StrategyActivitySnapshot,
    response_model_exclude_none=True,
)
def get_strategy_activity(strategy_id: str):
    try:
        return build_strategy_activity_payload(strategy_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc


@app.post("/api/strategies/{strategy_id}/review")
def create_strategy_tracking_review(strategy_id: str, payload: StrategyTrackingReviewRequest):
    try:
        job_payload = build_manual_strategy_review_job(strategy_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    job = repo.create_agent_job(job_payload)
    repo.add_event(
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


@app.get("/api/strategies/stream", response_model=StrategyLiveSnapshot)
async def stream_strategy_runtime(once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(build_strategy_live_snapshot_payload)
            yield format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/strategies/{strategy_id}/execution-preview", response_model=ExecutionPreview)
def get_strategy_execution_preview(strategy_id: str, mode: Optional[AccountMode] = None):
    try:
        return build_strategy_execution_preview(strategy_id, mode)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/strategies/{strategy_id}/execute", response_model=StrategyExecutionResult)
def execute_strategy_signal(strategy_id: str, payload: StrategyExecutionRequest):
    try:
        return dispatch_strategy_signal(strategy_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=_format_runtime_error_detail(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/account/overview", response_model=AccountOverview)
def get_account_overview(mode: Optional[AccountMode] = None):
    return parse_account_overview(mode=mode)


@app.get("/api/account/live", response_model=AccountLiveSnapshot)
def get_account_live_snapshot(mode: Optional[AccountMode] = None):
    return build_account_live_snapshot_payload(mode=mode)


@app.get("/api/account/positions", response_model=List[PositionRecord])
def get_account_positions(mode: Optional[AccountMode] = None):
    return parse_positions(mode=mode)


@app.get("/api/account/orders", response_model=List[OrderRecord])
def get_account_orders(mode: Optional[AccountMode] = None):
    return parse_open_orders(mode=mode)


@app.get("/api/account/order-history", response_model=List[OrderRecord])
def get_account_order_history(mode: Optional[AccountMode] = None):
    return parse_order_history(mode=mode)


@app.get("/api/account/stream")
async def stream_account_live(once: bool = False, interval_ms: int = 4000, mode: Optional[AccountMode] = None):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(build_account_live_snapshot_payload, mode)
            yield format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/backtests")
def get_backtests():
    return repo.snapshot().backtests


@app.post("/api/backtests")
def create_backtest(payload: BacktestCreate):
    try:
        normalized_timeframe = normalize_backtest_timeframe(payload.timeframe)
        return repo.create_backtest(
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


@app.get("/api/change-requests")
def get_change_requests():
    return repo.snapshot().change_requests


@app.post("/api/change-requests")
def create_change_request(payload: ChangeRequestCreate):
    return repo.create_change_request(payload)


@app.get("/api/ai/scheduler", response_model=SchedulerSnapshot)
def get_scheduler():
    return build_scheduler_snapshot_payload()


@app.get("/api/ai/live", response_model=AiLiveSnapshot)
def get_ai_live_snapshot():
    return build_ai_live_snapshot_payload()


@app.get("/api/ai/stream")
async def stream_ai_live(once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(build_ai_live_snapshot_payload)
            yield format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/ops/live", response_model=OpsLiveSnapshot)
def get_ops_live_snapshot():
    return build_ops_live_snapshot_payload()


@app.get("/api/ops/stream")
async def stream_ops_live(once: bool = False, interval_ms: int = 4000):
    interval_seconds = max(interval_ms, 1000) / 1000

    async def event_generator():
        while True:
            snapshot = await asyncio.to_thread(build_ops_live_snapshot_payload)
            yield format_sse(snapshot.model_dump(mode="json"))
            if once:
                break
            await asyncio.sleep(interval_seconds)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/ai/scheduler/commands")
def apply_scheduler_command(payload: SchedulerCommand):
    return repo.apply_scheduler_command(payload)


@app.post("/api/runtime/strategy-worker/restart", response_model=RuntimeWorkerActionResult)
def post_restart_strategy_runtime_worker(payload: RuntimeWorkerActionPayload):
    try:
        return restart_strategy_runtime_worker(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/runtime/strategy-worker/status", response_model=RuntimeWorkerStatus)
def get_runtime_worker_status():
    _sync_strategy_runtime_worker_issue_alerts()
    _sync_private_execution_channel_alerts()
    return build_runtime_worker_status()


@app.get("/api/ai/jobs")
def get_agent_jobs():
    return repo.snapshot().agent_jobs


@app.post("/api/ai/jobs")
def create_agent_job(payload: AgentJobCreate):
    if payload.job_type in {"generate_daily_review", "generate_backtest_review"}:
        payload = payload.model_copy(update={"context": enrich_review_job_context(dict(payload.context))})
    return repo.create_agent_job(payload)


@app.post("/api/ai/jobs/{job_id}/retry")
def retry_agent_job(job_id: str, payload: AgentJobRetryPayload):
    try:
        return repo.retry_agent_job(job_id, requested_by=payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"任务不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


class ExecutionImpactSummarizeRequest(BaseModel):
    strategy_id: str
    strategy_name: str
    window_start: str
    window_end: str
    order_count: int
    fill_count: int
    total_notional: float
    slippage_bps: float
    expected_pnl: float
    realized_pnl: float
    anomalies: Optional[List[Dict[str, Any]]] = None
    requested_by: Optional[str] = None


@app.post("/api/execution-impact/summarize")
def summarize_execution_impact(payload: ExecutionImpactSummarizeRequest):
    job_id = repo.queue_summarize_execution_impact(
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


@app.get("/api/execution-impact/records", response_model=List[ExecutionImpactRecord])
def get_execution_impact_records():
    return repo.snapshot().execution_impact_records


@app.get("/api/ai/reviews")
def get_reviews(
    strategy_id: Optional[str] = None,
    period: Optional[str] = None,
    backtest_id: Optional[str] = None,
):
    reviews = repo.snapshot().reviews

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


@app.post("/api/ai/proposals/{proposal_id}/action", response_model=StrategyProposalActionResult)
def apply_strategy_proposal_action(proposal_id: str, payload: StrategyProposalActionPayload):
    try:
        return repo.apply_strategy_proposal(proposal_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"提案不存在: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/news")
def get_news():
    feed = build_news_feed()
    repo.sync_news_events(feed)
    return repo.snapshot().news_events


@app.get("/api/alerts")
def get_alerts():
    return repo.snapshot().alerts


@app.get("/api/alert-rules")
def get_alert_rules():
    return repo.snapshot().alert_rules


@app.post("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: str, payload: AlertAcknowledgePayload):
    try:
        return repo.acknowledge_alert(alert_id, payload)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"提醒不存在: {exc}") from exc


@app.get("/api/trades")
def get_trades():
    return parse_trades()


@app.post("/api/trades/manual")
def create_manual_trade(payload: ManualOrderRequest):
    if payload.mode != AccountMode.PAPER:
        raise HTTPException(
            status_code=409,
            detail="当前版本只开放 Paper 模式的手动交易录入；Demo / Live 待真实执行引擎接通后再开放。",
        )
    try:
        return repo.create_manual_trade(payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/orders/exchange", response_model=OrderRecord)
def create_exchange_order(payload: ManualOrderRequest):
    if payload.mode == AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="Paper 模式请继续使用本地手动交易或 Paper 委托接口。")
    try:
        return submit_exchange_order(payload)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/orders/exchange/{order_id}/cancel", response_model=OrderRecord)
def post_cancel_exchange_order(order_id: str, payload: PaperOrderCancelPayload):
    try:
        return cancel_exchange_order(order_id, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待取消的真实委托: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/orders/exchange/{order_id}/replace", response_model=OrderRecord)
def post_replace_exchange_order(order_id: str, payload: PaperOrderReplacePayload):
    try:
        return replace_exchange_order(order_id, payload.quantity, payload.price, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待修改的真实委托: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/orders/exchange/cancel-all", response_model=PaperOrderBulkCancelResult)
def post_cancel_all_exchange_orders(payload: PaperOrderCancelPayload):
    try:
        return cancel_all_exchange_orders(payload.requested_by)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/account/paper/orders", response_model=OrderRecord)
def create_paper_order(payload: ManualOrderRequest):
    if payload.mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下创建本地限价委托。")
    if repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前工作台不在 Paper 模式，无法创建本地限价委托。")
    try:
        return repo.create_paper_order(payload)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def _build_preview_for_request(payload: ExecutionPreviewRequest) -> ExecutionPreview:
    """Route ``payload`` to the Paper or private preview builder.

    Round 58 — extracted so the raw preview endpoint and the new structured
    ``/api/trades/preview/decision`` endpoint share a single dispatch path.
    """

    if payload.mode == AccountMode.PAPER:
        return repo.preview_execution(payload)
    return build_private_execution_preview(payload)


@app.post("/api/trades/preview", response_model=ExecutionPreview)
def preview_trade(payload: ExecutionPreviewRequest):
    return _build_preview_for_request(payload)


@app.post("/api/trades/preview/decision", response_model=RiskDecision)
def preview_trade_decision(payload: ExecutionPreviewRequest) -> RiskDecision:
    """Return the Round 58 :class:`RiskDecision` for ``payload``.

    Wraps the same preview the ``/api/trades/preview`` endpoint returns so
    callers can branch on the typed ``verdict`` / ``reason_code`` while still
    reading the embedded preview's numeric fields (notional, projected
    position, sizing budgets, …).
    """

    preview = _build_preview_for_request(payload)
    return evaluate_risk_decision(preview)


@app.post("/api/account/paper/orders/{order_id}/cancel", response_model=OrderRecord)
def cancel_paper_order(order_id: str, payload: PaperOrderCancelPayload):
    if repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下取消本地限价委托。")
    try:
        return repo.cancel_paper_order(order_id, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待取消的 Paper 委托: {exc}") from exc


@app.post("/api/account/paper/orders/cancel-all", response_model=PaperOrderBulkCancelResult)
def cancel_all_paper_orders(payload: PaperOrderCancelPayload):
    if repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下批量取消本地限价委托。")
    return repo.cancel_all_paper_orders(payload.requested_by)


@app.post("/api/account/paper/orders/{order_id}/replace", response_model=OrderRecord)
def replace_paper_order(order_id: str, payload: PaperOrderReplacePayload):
    if repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下修改本地限价委托。")
    try:
        return repo.replace_paper_order(order_id, payload.quantity, payload.price, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"找不到待修改的 Paper 委托: {exc}") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/account/paper/positions/{symbol}/close")
def close_paper_position(symbol: str, payload: ClosePaperPositionPayload):
    if repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下一键平仓。")
    try:
        return repo.close_paper_position(symbol, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 当前没有可平的 Paper 持仓。") from exc
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/account/paper/positions/close-all", response_model=PaperPositionBulkCloseResult)
def close_all_paper_positions(payload: ClosePaperPositionPayload):
    if repo.snapshot().workspace_preferences.selected_mode != AccountMode.PAPER:
        raise HTTPException(status_code=409, detail="当前仅允许在 Paper 模式下批量平仓。")
    return repo.close_all_paper_positions(payload.requested_by)


@app.post("/api/account/exchange/positions/{symbol}/close", response_model=OrderRecord)
def post_close_exchange_position(symbol: str, payload: ClosePaperPositionPayload):
    try:
        return close_exchange_position(symbol, payload.requested_by)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"{symbol.upper()} 当前没有可平的真实持仓。") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/api/account/exchange/positions/close-all", response_model=ExchangePositionBulkCloseResult)
def post_close_all_exchange_positions(payload: ClosePaperPositionPayload):
    try:
        return close_all_exchange_positions(payload.requested_by)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.get("/api/audit/events")
def get_audit_events():
    return repo.snapshot().audit_events


@app.get("/api/settings", response_model=SettingsPayload)
def get_settings():
    return repo.snapshot().settings


@app.post("/api/settings", response_model=SettingsPayload)
def update_settings(payload: SettingsUpdatePayload):
    try:
        settings = repo.update_settings(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    market_data.base_url = settings.api_base_url.rstrip("/")
    if hasattr(market_data, "_candle_cache"):
        market_data._candle_cache.clear()  # type: ignore[attr-defined]
    if hasattr(market_data, "_recent_trade_cache"):
        market_data._recent_trade_cache.clear()  # type: ignore[attr-defined]
    if hasattr(market_data, "_announcement_cache"):
        market_data._announcement_cache.clear()  # type: ignore[attr-defined]
    if hasattr(market_data, "_instrument_cache"):
        market_data._instrument_cache.clear()  # type: ignore[attr-defined]
    if hasattr(market_data, "_connectivity_probe_cache"):
        market_data._connectivity_probe_cache = None  # type: ignore[attr-defined]
    if hasattr(market_data, "_candle_history_cache"):
        market_data._candle_history_cache.clear()  # type: ignore[attr-defined]
    return settings


@app.get("/api/workspace/preferences", response_model=WorkspacePreferences)
def get_workspace_preferences():
    return repo.snapshot().workspace_preferences


@app.post("/api/workspace/preferences", response_model=WorkspacePreferences)
def update_workspace_preferences(payload: WorkspacePreferencesUpdate):
    return repo.update_workspace_preferences(payload)


@app.get("/api/integrations/openclaw", response_model=OpenClawStatus)
def get_openclaw_status():
    status = openclaw.get_status(worker_state=agent_worker_state)
    repo.set_openclaw_connection(status.reachable)
    return status


@app.get("/api/integrations/bybit-private", response_model=BybitPrivateStatus)
def get_bybit_private_status():
    status = private_data.get_status()
    realtime_status = _build_private_realtime_health()
    balance_diagnostics = _build_private_usdt_balance_diagnostics(status)
    private_rest_reachable: Optional[bool]
    if balance_diagnostics:
        private_rest_reachable = any(item.error is None for item in balance_diagnostics)
    else:
        private_rest_reachable = None
    realtime_issue = get_private_execution_channel_issue(status.mode)
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
                # Round 97 — thread the typed ``issue_kind`` so the R95
                # typed-first branch picks the AUTH recovery copy off the
                # typed kind rather than the legacy ``"鉴权"`` substring fallback.
                _build_private_execution_channel_recommended_action(
                    realtime_issue,
                    last_error=realtime_status.get("last_error"),
                    rest_reachable=private_rest_reachable,
                    issue_kind=_classify_channel_issue_kind(realtime_issue),
                )
                if realtime_issue
                else None
            ),
            "usdt_balance_diagnostics": balance_diagnostics,
        }
    )


@app.get("/api/integrations/bybit-public", response_model=BybitPublicStatus)
def get_bybit_public_status():
    return build_bybit_public_status()


@app.get("/api/integrations/grafana", response_model=GrafanaIntegrationStatus)
def get_grafana_status():
    return build_grafana_status()


@app.post("/api/integrations/bybit-private/probe-trade", response_model=BybitTradeProbeResult)
def post_bybit_trade_probe():
    return probe_private_trade_route()


def ensure_background_services_started() -> None:
    global agent_worker_thread
    market_data.start_realtime(repo.snapshot().watchlist)
    if hasattr(market_data, "schedule_watchlist_history_prime"):
        market_data.schedule_watchlist_history_prime(repo.snapshot().watchlist)
    ensure_private_realtime_started()
    if agent_worker_thread is None or not agent_worker_thread.is_alive():
        agent_worker_stop_event.clear()
        agent_worker_thread = threading.Thread(
            target=run_agent_worker_loop,
            name="openclaw-agent-worker",
            daemon=True,
        )
        agent_worker_thread.start()
    _start_strategy_runtime_worker()


@app.get("/api/strategies/{strategy_id}/risk-hints")
def get_strategy_runtime_risk_hints(strategy_id: str):
    """Expose structured stop/target/band reference prices for a strategy.

    Additive read-only helper: derives hints from the same market detail the
    runtime evaluator already sees, so the UI (or risk-gate middleware) can
    surface concrete "距离止损/止盈" numbers without re-implementing the math.
    """

    from strategy_runtime import compute_strategy_runtime_risk_hints

    state = repo.snapshot()
    strategy = next((item for item in state.strategies if item.id == strategy_id), None)
    if strategy is None:
        raise HTTPException(status_code=404, detail=f"策略不存在: {strategy_id}")
    if not strategy.symbols:
        raise HTTPException(status_code=400, detail="策略未绑定任何交易对，无法生成风控提示。")

    symbol = strategy.symbols[0]
    watch_item = next((item for item in state.watchlist if item.symbol == symbol), None)
    if watch_item is None:
        raise HTTPException(status_code=404, detail=f"观察列表未包含 {symbol}，无法生成风控提示。")

    fallback_detail = state.market_details.get(symbol) or build_market_detail_for_watchlist(watch_item)
    try:
        detail = market_data.enrich_market_detail(
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


if __name__ == "__main__":
    runtime_root = Path(__file__).resolve().parent / ".runtime"
    runtime_root.mkdir(parents=True, exist_ok=True)
    ensure_background_services_started()
    uvicorn.run(app, host="127.0.0.1", port=8787, reload=False)

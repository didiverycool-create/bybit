"""Prometheus metric rendering helpers extracted from ``main.py``.

The ``build_prometheus_metrics`` function previously lived inline in
``services/control-api/main.py``.  It depended on a large number of module level
globals (``repo``, ``agent_worker_state``, ``strategy_runtime_thread``, a dozen
helper functions, etc.).  Following the pattern established by
``execution_health.py``, this module defines a single entry point that accepts
each collaborator as an explicit argument so the implementation no longer needs
to reach into ``main``'s module globals.  ``main.py`` keeps a thin
``build_prometheus_metrics()`` wrapper that supplies the concrete objects.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List, Optional, Tuple


def build_prometheus_metrics(
    *,
    repo: Any,
    agent_worker_state: Dict[str, Any],
    strategy_runtime_thread: Any,
    strategy_runtime_state: Dict[str, Any],
    http_exception_cls: type,
    sync_strategy_runtime_worker_issue_alerts: Callable[[], None],
    sync_public_execution_channel_alerts: Callable[[], None],
    sync_private_execution_channel_alerts: Callable[[], None],
    build_strategy_runtime_worker_health: Callable[[], Dict[str, Any]],
    parse_account_overview: Callable[..., Any],
    build_public_realtime_health: Callable[[], Dict[str, Any]],
    build_private_realtime_health: Callable[[], Dict[str, Any]],
    build_market_live_snapshot_payload: Callable[..., Any],
    prometheus_labels: Callable[..., str],
    parse_metric_number: Callable[[Any], float],
    build_control_snapshot_response: Callable[[], Any],
    collect_dynamic_auto_dispatch_blocked_contexts: Callable[[Any], List[Dict[str, Optional[str]]]],
    build_strategy_active_order_summary: Callable[..., Tuple[int, Any]],
    build_strategy_position_alignment_summary: Callable[..., Tuple[Any, Any, str, Any]],
    has_active_strategy_live_stop_loss_alert: Callable[[str], bool],
    strategy_live_stop_loss_cooldown_remaining_minutes: Callable[[Any], Optional[int]],
    has_active_strategy_auto_dispatch_alert: Callable[[str], bool],
    strategy_exchange_rejection_guard_remaining_minutes: Callable[[Any], Optional[int]],
    has_active_strategy_stale_order_alert: Callable[[str], bool],
) -> str:
    """Render the control-API Prometheus scrape payload as a single string.

    Every collaborator is injected explicitly so this module stays independent
    of ``main.py`` and is easy to unit test in isolation.  The function retains
    the original sequencing semantics: it syncs runtime worker alerts, derives
    the current control snapshot, builds the market-live snapshot (tolerating
    HTTP or arbitrary exceptions) and then emits Prometheus lines in the same
    order as before.
    """

    sync_strategy_runtime_worker_issue_alerts()
    sync_public_execution_channel_alerts()
    sync_private_execution_channel_alerts()
    state = repo.snapshot()
    runtime_health = build_strategy_runtime_worker_health()
    account = parse_account_overview()
    paper_account = repo.get_paper_account_overview()
    paper_positions = repo.get_paper_positions()
    realtime_status = build_public_realtime_health()
    private_realtime_status = build_private_realtime_health()
    risk_map = {"low": 1, "medium": 2, "high": 3}
    signal_map = {"neutral": 0, "watch": 1, "active": 2}
    alignment_map = {"unknown": 0, "aligned": 1, "reconciling": 2, "drifted": 3}
    scheduler_status_map = {
        "running": 1,
        "paused": 2,
        "manual_override": 3,
        "degraded": 4,
    }
    worker_status_map = {
        None: 0,
        "queued": 1,
        "running": 2,
        "completed": 3,
        "failed": 4,
        "cancelled": 5,
        "waiting": 6,
    }
    lines: List[str] = []
    metric_headers_written = set()
    market_live_snapshot: Optional[Any] = None
    market_live_error: Optional[str] = None

    def add_metric_line(metric_name: str, help_text: str, value_line: str, metric_type: str = "gauge") -> None:
        if metric_name not in metric_headers_written:
            lines.append(f"# HELP {metric_name} {help_text}")
            lines.append(f"# TYPE {metric_name} {metric_type}")
            metric_headers_written.add(metric_name)
        lines.append(value_line)

    workspace_symbol = state.workspace_preferences.selected_symbol
    workspace_timeframe = state.workspace_preferences.selected_market_timeframe
    try:
        market_live_snapshot = build_market_live_snapshot_payload(
            workspace_symbol,
            timeframe=workspace_timeframe,
        )
    except http_exception_cls as exc:
        market_live_error = str(getattr(exc, "detail", None) or exc)
    except Exception as exc:
        market_live_error = str(exc)

    add_metric_line(
        "bybit_control_watchlist_total",
        "Number of instruments in watchlist",
        f"bybit_control_watchlist_total {len(state.watchlist)}",
    )
    add_metric_line(
        "bybit_control_scheduler_queue_depth",
        "Number of queued AI jobs",
        f"bybit_control_scheduler_queue_depth {state.control_snapshot.scheduler.queue_depth}",
    )
    add_metric_line(
        "bybit_control_scheduler_status",
        "Scheduler state as numeric code",
        (
            f"bybit_control_scheduler_status{{{prometheus_labels(status=state.control_snapshot.scheduler.status)}}} "
            f"{scheduler_status_map.get(state.control_snapshot.scheduler.status, 0)}"
        ),
    )
    add_metric_line(
        "bybit_control_scheduler_freeze_publish",
        "Whether publish is frozen",
        f"bybit_control_scheduler_freeze_publish {1 if state.control_snapshot.scheduler.freeze_publish else 0}",
    )
    add_metric_line(
        "bybit_control_openclaw_connected",
        "Whether OpenClaw is reachable",
        f"bybit_control_openclaw_connected {1 if state.control_snapshot.scheduler.openclaw_connected else 0}",
    )
    add_metric_line(
        "bybit_control_openclaw_worker_running",
        "Whether local OpenClaw worker loop is running",
        f"bybit_control_openclaw_worker_running {1 if agent_worker_state.get('running') else 0}",
    )
    add_metric_line(
        "bybit_control_openclaw_active_job",
        "Whether the OpenClaw worker currently has an active job",
        f"bybit_control_openclaw_active_job {1 if agent_worker_state.get('active_job_id') else 0}",
    )
    add_metric_line(
        "bybit_control_openclaw_last_job_status",
        "Last OpenClaw job status as numeric code",
        f"bybit_control_openclaw_last_job_status {worker_status_map.get(agent_worker_state.get('last_job_status'), 0)}",
    )
    add_metric_line(
        "bybit_control_strategy_runtime_worker_running",
        "Whether the local strategy runtime worker loop is running",
        f"bybit_control_strategy_runtime_worker_running {1 if strategy_runtime_thread and strategy_runtime_thread.is_alive() and strategy_runtime_state.get('running') else 0}",
    )
    add_metric_line(
        "bybit_control_strategy_runtime_worker_error",
        "Whether the local strategy runtime worker currently has a recorded error",
        f"bybit_control_strategy_runtime_worker_error {1 if strategy_runtime_state.get('last_error') else 0}",
    )
    control_snapshot = build_control_snapshot_response()
    execution_health = control_snapshot.execution_health
    dynamic_auto_dispatch_blocked_strategy_ids = {
        str(item.get("top_issue_strategy_id") or "")
        for item in collect_dynamic_auto_dispatch_blocked_contexts(state)
        if item.get("top_issue_strategy_id")
    }
    add_metric_line(
        "bybit_control_strategy_runtime_worker_stale",
        "Whether the local strategy runtime worker appears stalled",
        f"bybit_control_strategy_runtime_worker_stale {1 if execution_health.runtime_worker_stale else 0}",
    )
    add_metric_line(
        "bybit_control_strategy_runtime_worker_stopped",
        "Whether the local strategy runtime worker is currently not running after a previous successful refresh",
        f"bybit_control_strategy_runtime_worker_stopped {1 if runtime_health.get('runtime_worker_stopped') else 0}",
    )
    add_metric_line(
        "bybit_control_strategy_runtime_stale_seconds",
        "How many seconds since the strategy runtime worker last refreshed successfully",
        f"bybit_control_strategy_runtime_stale_seconds {execution_health.runtime_stale_seconds}",
    )
    add_metric_line(
        "bybit_control_account_total_equity",
        "Total equity from account overview",
        f"bybit_control_account_total_equity {parse_metric_number(account.total_equity)}",
    )
    add_metric_line(
        "bybit_control_paper_realized_pnl",
        "Derived paper realized pnl from local paper trades",
        f"bybit_control_paper_realized_pnl {parse_metric_number(state.control_snapshot.today_performance.get('realized_pnl'))}",
    )
    add_metric_line(
        "bybit_control_paper_win_rate",
        "Derived paper win rate percentage from local paper closing trades",
        f"bybit_control_paper_win_rate {parse_metric_number(state.control_snapshot.today_performance.get('win_rate'))}",
    )
    add_metric_line(
        "bybit_control_paper_open_orders",
        "Current number of local paper open orders",
        f"bybit_control_paper_open_orders {int(paper_account.open_orders_count)}",
    )
    add_metric_line(
        "bybit_control_paper_positions",
        "Current number of local paper positions",
        f"bybit_control_paper_positions {int(len(paper_positions))}",
    )
    add_metric_line(
        "bybit_control_paper_available_balance",
        "Current available balance in local paper account",
        f"bybit_control_paper_available_balance {parse_metric_number(paper_account.total_available_balance)}",
    )
    add_metric_line(
        "bybit_control_market_ws_connected",
        "Public Bybit websocket connection state by channel",
        f'bybit_control_market_ws_connected{{channel="spot"}} {1 if realtime_status.get("connected_spot") else 0}',
    )
    add_metric_line(
        "bybit_control_market_ws_connected",
        "Public Bybit websocket connection state by channel",
        f'bybit_control_market_ws_connected{{channel="linear"}} {1 if realtime_status.get("connected_linear") else 0}',
    )
    add_metric_line(
        "bybit_control_public_ws_stale",
        "Whether the public Bybit websocket feed appears stale by channel",
        f'bybit_control_public_ws_stale{{channel="spot"}} {1 if realtime_status.get("spot_stale") else 0}',
    )
    add_metric_line(
        "bybit_control_public_ws_stale",
        "Whether the public Bybit websocket feed appears stale by channel",
        f'bybit_control_public_ws_stale{{channel="linear"}} {1 if realtime_status.get("linear_stale") else 0}',
    )
    add_metric_line(
        "bybit_control_public_ws_stale_seconds",
        "How many seconds since the public Bybit websocket last received a message by channel",
        f'bybit_control_public_ws_stale_seconds{{channel="spot"}} {int(realtime_status.get("spot_stale_seconds") or 0)}',
    )
    add_metric_line(
        "bybit_control_public_ws_stale_seconds",
        "How many seconds since the public Bybit websocket last received a message by channel",
        f'bybit_control_public_ws_stale_seconds{{channel="linear"}} {int(realtime_status.get("linear_stale_seconds") or 0)}',
    )
    add_metric_line(
        "bybit_control_private_ws_connected",
        "Private Bybit websocket connection state",
        f"bybit_control_private_ws_connected {1 if private_realtime_status.get('connected') else 0}",
    )
    add_metric_line(
        "bybit_control_private_ws_authenticated",
        "Private Bybit websocket authentication state",
        f"bybit_control_private_ws_authenticated {1 if private_realtime_status.get('authenticated') else 0}",
    )
    add_metric_line(
        "bybit_control_private_ws_stale",
        "Whether the private Bybit websocket feed appears stale",
        f"bybit_control_private_ws_stale {1 if private_realtime_status.get('stale') else 0}",
    )
    add_metric_line(
        "bybit_control_private_ws_stale_seconds",
        "How many seconds since the private Bybit websocket last received a message",
        f"bybit_control_private_ws_stale_seconds {int(private_realtime_status.get('stale_seconds') or 0)}",
    )
    add_metric_line(
        "bybit_control_private_ws_open_orders",
        "Number of open orders tracked by private Bybit websocket cache",
        f"bybit_control_private_ws_open_orders {int(private_realtime_status.get('open_orders_count') or 0)}",
    )
    add_metric_line(
        "bybit_control_private_ws_positions",
        "Number of positions tracked by private Bybit websocket cache",
        f"bybit_control_private_ws_positions {int(private_realtime_status.get('positions_count') or 0)}",
    )
    add_metric_line(
        "bybit_control_market_live_snapshot_error",
        "Whether the current workspace market live snapshot failed to build",
        (
            f"bybit_control_market_live_snapshot_error"
            f"{{{prometheus_labels(requested_symbol=workspace_symbol, timeframe=workspace_timeframe)}}} "
            f"{1 if market_live_error else 0}"
        ),
    )
    if market_live_snapshot is not None:
        diagnostics = market_live_snapshot.diagnostics
        add_metric_line(
            "bybit_control_market_live_generation_ms",
            "How many milliseconds were needed to build the current workspace market live snapshot",
            (
                f"bybit_control_market_live_generation_ms"
                f"{{{prometheus_labels(requested_symbol=diagnostics.requested_symbol, effective_symbol=diagnostics.effective_symbol, timeframe=diagnostics.timeframe, detail_source=diagnostics.detail_source)}}} "
                f"{diagnostics.generated_in_ms}"
            ),
        )
        add_metric_line(
            "bybit_control_market_live_detail_candle_count",
            "How many candles the current workspace market live detail contains",
            (
                f"bybit_control_market_live_detail_candle_count"
                f"{{{prometheus_labels(requested_symbol=diagnostics.requested_symbol, effective_symbol=diagnostics.effective_symbol, timeframe=diagnostics.timeframe, detail_source=diagnostics.detail_source)}}} "
                f"{diagnostics.detail_candle_count}"
            ),
        )
        add_metric_line(
            "bybit_control_market_live_selection_corrected",
            "Whether the current workspace market live request had to be corrected to a valid watchlist symbol",
            (
                f"bybit_control_market_live_selection_corrected"
                f"{{{prometheus_labels(requested_symbol=diagnostics.requested_symbol, effective_symbol=diagnostics.effective_symbol, timeframe=diagnostics.timeframe)}}} "
                f"{1 if diagnostics.selection_corrected else 0}"
            ),
        )
        add_metric_line(
            "bybit_control_market_live_watchlist_real_detail_count",
            "How many watchlist symbols currently resolve to real public market details for the selected timeframe",
            (
                f"bybit_control_market_live_watchlist_real_detail_count"
                f"{{{prometheus_labels(timeframe=diagnostics.timeframe)}}} "
                f"{diagnostics.watchlist_real_detail_count}"
            ),
        )
        add_metric_line(
            "bybit_control_market_live_watchlist_fallback_detail_count",
            "How many watchlist symbols currently fall back to non-real market details for the selected timeframe",
            (
                f"bybit_control_market_live_watchlist_fallback_detail_count"
                f"{{{prometheus_labels(timeframe=diagnostics.timeframe)}}} "
                f"{diagnostics.watchlist_fallback_detail_count}"
            ),
        )
        for source, count in sorted(diagnostics.watchlist_source_breakdown.items()):
            add_metric_line(
                "bybit_control_market_live_watchlist_source_breakdown",
                "Current watchlist detail source distribution for the selected timeframe",
                (
                    f"bybit_control_market_live_watchlist_source_breakdown"
                    f"{{{prometheus_labels(timeframe=diagnostics.timeframe, source=source)}}} {count}"
                ),
            )

    for severity, count in state.control_snapshot.alerts_summary.items():
        add_metric_line(
            "bybit_control_alerts_total",
            "Unacknowledged alerts by severity",
            f"bybit_control_alerts_total{{{prometheus_labels(severity=severity)}}} {count}",
        )
    for issue_name, count in (
        ("runtime_worker_issue", 1 if execution_health.runtime_worker_issue else 0),
        ("public_execution_channel_issue", 1 if execution_health.public_execution_channel_issue else 0),
        ("private_execution_channel_issue", 1 if execution_health.private_execution_channel_issue else 0),
        ("stop_loss_guard", execution_health.active_stop_loss_guards),
        ("cooldown", execution_health.cooldowns),
        ("auto_dispatch_blocked", execution_health.auto_dispatch_blocked),
        ("exchange_rejection_guard", execution_health.rejection_guards),
        ("stale_order_guard", execution_health.stale_order_guards),
        ("position_drift", execution_health.drifts),
    ):
        add_metric_line(
            "bybit_control_strategy_issue_total",
            "Current strategy execution health issues by issue type",
            f"bybit_control_strategy_issue_total{{{prometheus_labels(issue=issue_name)}}} {count}",
        )

    for strategy in state.strategies:
        runtime_snapshot = next((item for item in state.strategy_runtime_snapshots if item.strategy_id == strategy.id), None)
        if runtime_snapshot is not None:
            active_order_count, _active_order = build_strategy_active_order_summary(
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
            ) = build_strategy_position_alignment_summary(
                runtime_snapshot.strategy_id,
                runtime_snapshot.mode,
                runtime_snapshot.symbol,
                runtime_snapshot.market,
                active_order_count,
            )
        else:
            position_alignment = "unknown"
        add_metric_line(
            "bybit_control_strategy_pnl_7d",
            "Seven day strategy pnl percentage",
            (
                f"bybit_control_strategy_pnl_7d"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status)}}} "
                f"{parse_metric_number(strategy.pnl_7d)}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_drawdown",
            "Seven day max drawdown percentage",
            (
                f"bybit_control_strategy_drawdown"
                f"{{{prometheus_labels(strategy_id=strategy.id)}}} {parse_metric_number(strategy.max_drawdown)}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_live_stop_loss_guard",
            "Whether a live or demo strategy is currently blocked by active real stop loss protection",
            (
                f"bybit_control_strategy_live_stop_loss_guard"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status)}}} "
                f"{1 if has_active_strategy_live_stop_loss_alert(strategy.id) else 0}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_live_stop_loss_cooldown_minutes",
            "Remaining cooldown minutes after a live or demo strategy stop loss guard event",
            (
                f"bybit_control_strategy_live_stop_loss_cooldown_minutes"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status)}}} "
                f"{strategy_live_stop_loss_cooldown_remaining_minutes(strategy) or 0}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_auto_dispatch_blocked",
            "Whether a strategy currently has an active or dynamically detected auto dispatch blocking condition",
            (
                f"bybit_control_strategy_auto_dispatch_blocked"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status)}}} "
                f"{1 if has_active_strategy_auto_dispatch_alert(strategy.id) or strategy.id in dynamic_auto_dispatch_blocked_strategy_ids else 0}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_exchange_rejection_guard",
            "Whether a strategy is currently in cooldown after repeated rejected live or demo orders",
            (
                f"bybit_control_strategy_exchange_rejection_guard"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status)}}} "
                f"{1 if strategy_exchange_rejection_guard_remaining_minutes(strategy) is not None else 0}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_exchange_rejection_cooldown_minutes",
            "Remaining cooldown minutes after repeated rejected live or demo strategy orders",
            (
                f"bybit_control_strategy_exchange_rejection_cooldown_minutes"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status)}}} "
                f"{strategy_exchange_rejection_guard_remaining_minutes(strategy) or 0}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_stale_order_guard",
            "Whether a strategy currently has a stale real exchange order alert",
            (
                f"bybit_control_strategy_stale_order_guard"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status)}}} "
                f"{1 if has_active_strategy_stale_order_alert(strategy.id) else 0}"
            ),
        )
        add_metric_line(
            "bybit_control_strategy_position_alignment_state",
            "Current position alignment state for the strategy target position",
            (
                f"bybit_control_strategy_position_alignment_state"
                f"{{{prometheus_labels(strategy_id=strategy.id, mode=strategy.mode.value, status=strategy.status, alignment=position_alignment)}}} "
                f"{alignment_map.get(position_alignment, 0)}"
            ),
        )

    for item in state.watchlist:
        add_metric_line(
            "bybit_control_watchlist_change_24h",
            "24h percentage change of watched symbol",
            (
                f"bybit_control_watchlist_change_24h"
                f"{{{prometheus_labels(symbol=item.symbol, market=item.market)}}} {item.change_24h}"
            ),
        )
        add_metric_line(
            "bybit_control_watchlist_risk_level",
            "Risk score of watched symbol",
            (
                f"bybit_control_watchlist_risk_level"
                f"{{{prometheus_labels(symbol=item.symbol)}}} {risk_map.get(item.risk_level, 0)}"
            ),
        )
        add_metric_line(
            "bybit_control_watchlist_signal_state",
            "Signal score of watched symbol",
            (
                f"bybit_control_watchlist_signal_state"
                f"{{{prometheus_labels(symbol=item.symbol)}}} {signal_map.get(item.signal, 0)}"
            ),
        )

    return "\n".join(lines) + "\n"

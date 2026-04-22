"""Private execution preview builders extracted from ``main.py``.

``build_private_execution_preview`` and its narrow preview helpers previously
lived inline in ``services/control-api/main.py``.  They depended on a handful
of module-level globals (``repo``, ``parse_open_orders``, the various
recommended-action builders, etc.) which made the surface hard to reason
about.  Following the pattern established by ``execution_health.py``,
``prometheus_metrics.py`` and ``alert_and_guard_sync.py`` this module exposes
pure functions that accept their collaborators as explicit arguments.
``main.py`` keeps thin wrappers with the original names so every existing call
site stays untouched.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from models import (
    Direction,
    ExecutionPreview,
    ExecutionPreviewRequest,
    OrderRecord,
    RISK_REASON_ACCOUNT_MODE_UNAVAILABLE,
    RISK_REASON_EXCHANGE_CONSTRAINT,
    RISK_REASON_INSUFFICIENT_BALANCE,
    RISK_REASON_INSUFFICIENT_INVENTORY,
    RISK_REASON_RUNTIME_UNAVAILABLE,
)


def load_private_open_order_records_for_preview(
    *,
    parse_open_orders: Callable[..., List[OrderRecord]],
) -> List[OrderRecord]:
    """Return the private open-order snapshot tolerated for preview flows.

    Mirrors the ``_load_private_open_order_records_for_preview`` helper that
    previously lived in ``main.py``.  ``parse_open_orders`` is injected so the
    module does not depend on ``main``'s global.
    """

    try:
        return parse_open_orders(use_private_only=True)
    except RuntimeError:
        return []


def execution_preview_requires_reduce_only(preview: ExecutionPreview) -> bool:
    """Return ``True`` when a preview corresponds to a reducing perp order."""

    return preview.market == "perp" and preview.action in {"减多", "减空", "平多", "平空"}


def private_released_order_reservation(
    open_orders: List[OrderRecord],
    *,
    symbol: str,
    market: str,
    exclude_order_id: Optional[str],
    release_order_ids: Optional[List[str]] = None,
    parse_metric_number: Callable[[Any], float],
    private_order_reserves_private_balance: Callable[[OrderRecord], bool],
) -> float:
    """Return the USDT reservation released by cancelling the named orders."""

    release_ids = {str(item) for item in (release_order_ids or []) if str(item)}
    if exclude_order_id:
        release_ids.add(str(exclude_order_id))
    if not release_ids:
        return 0.0
    upper_symbol = symbol.upper()
    released = 0.0
    for item in open_orders:
        if str(item.order_id) not in release_ids:
            continue
        if item.market != market or item.symbol != upper_symbol:
            continue
        if not private_order_reserves_private_balance(item):
            continue
        released += parse_metric_number(item.qty) * parse_metric_number(item.price)
    return released


def private_reserved_spot_sell_quantity(
    open_orders: List[OrderRecord],
    *,
    symbol: str,
    exclude_order_id: Optional[str] = None,
    parse_metric_number: Callable[[Any], float],
) -> float:
    """Return the spot base-quantity reserved by outstanding SELL orders."""

    reserved_quantity = 0.0
    upper_symbol = symbol.upper()
    for item in open_orders:
        if item.order_id == exclude_order_id:
            continue
        if item.market != "spot" or item.side != Direction.SELL or item.symbol != upper_symbol:
            continue
        reserved_quantity += parse_metric_number(item.qty)
    return reserved_quantity


def build_private_execution_preview(
    payload: ExecutionPreviewRequest,
    *,
    repo: Any,
    format_usdt: Callable[[float], str],
    resolve_private_mode_access: Callable[..., Any],
    load_private_wallet_snapshot: Callable[[], Any],
    load_private_positions_snapshot: Callable[[], Any],
    build_position_records: Callable[..., List[Any]],
    parse_metric_number: Callable[[Any], float],
    parse_open_orders: Callable[..., List[OrderRecord]],
    calculate_private_perp_balance_delta_notional: Callable[..., float],
    private_wallet_available_spot_quantity: Callable[..., Optional[float]],
    private_released_spot_sell_reservation: Callable[..., float],
    validate_exchange_order_constraints: Callable[..., Optional[str]],
    build_private_insufficient_balance_reason: Callable[..., str],
    build_private_insufficient_balance_recommended_action: Callable[..., Optional[str]],
    build_private_spot_inventory_recommended_action: Callable[..., Optional[str]],
    build_exchange_constraint_recommended_action: Callable[..., Optional[str]],
    build_execution_preview_recommended_action: Callable[..., Optional[str]],
    private_order_reserves_private_balance: Callable[[OrderRecord], bool],
) -> ExecutionPreview:
    """Return the Bybit private-account execution preview for ``payload``.

    Every collaborator is injected so this function stays independent of
    ``main.py``.  The implementation preserves the original behaviour and call
    ordering from the inline ``main.build_private_execution_preview``.
    """

    notional = payload.quantity * payload.price
    base_preview = {
        "symbol": payload.symbol.upper(),
        "market": payload.market,
        "mode": payload.mode,
        "side": payload.side,
        "origin": payload.origin,
        "strategy_id": payload.strategy_id,
        "quantity": payload.quantity,
        "price": payload.price,
        "notional": format_usdt(notional),
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(),
    }
    status, access_error = resolve_private_mode_access(payload.mode)
    if access_error is not None:
        return ExecutionPreview(
            **base_preview,
            action="等待真实执行引擎",
            allowed=False,
            blocked_reason=access_error,
            block_code=RISK_REASON_ACCOUNT_MODE_UNAVAILABLE,
            recommended_action=build_execution_preview_recommended_action(access_error),
            warnings=["当前结果仅适用于已配置且模式一致的 Demo / Live 私有 API。"],
            current_position_size="--",
            current_avg_price="--",
            projected_position_size="--",
            projected_avg_price="--",
            available_balance_before="--",
            available_balance_after="--",
            estimated_realized_pnl="--",
        )

    try:
        _wallet_status, wallet_snapshot, _wallet_updated_at = load_private_wallet_snapshot()
        positions_status, position_items, positions_updated_at = load_private_positions_snapshot()
    except RuntimeError as exc:
        return ExecutionPreview(
            **base_preview,
            action="等待真实执行引擎",
            allowed=False,
            blocked_reason=str(exc),
            block_code=RISK_REASON_RUNTIME_UNAVAILABLE,
            recommended_action="请先恢复 Bybit 私有账户链路，再重试真实交易预检。",
            warnings=["当前结果仅适用于已配置且链路可用的 Demo / Live 私有 API。"],
            current_position_size="--",
            current_avg_price="--",
            projected_position_size="--",
            projected_avg_price="--",
            available_balance_before="--",
            available_balance_after="--",
            estimated_realized_pnl="--",
        )

    positions = build_position_records(position_items, positions_status, positions_updated_at)
    position = next(
        (
            item
            for item in positions
            if item.symbol == payload.symbol.upper() and item.market == payload.market
        ),
        None,
    )
    current_qty = 0.0
    current_avg = 0.0
    if position is not None:
        current_qty = parse_metric_number(position.size) * (1 if position.side == "long" else -1)
        current_avg = parse_metric_number(position.avg_price)

    signed_qty = payload.quantity if payload.side == Direction.BUY else -payload.quantity
    next_qty = current_qty + signed_qty
    close_qty = 0.0
    realized_on_fill = 0.0

    if current_qty != 0 and current_qty * signed_qty < 0:
        close_qty = min(abs(current_qty), abs(signed_qty))
        realized_on_fill = close_qty * (payload.price - current_avg) * (1 if current_qty > 0 else -1)

    if current_qty == 0 or current_qty * signed_qty > 0:
        total_size = abs(current_qty) + abs(signed_qty)
        projected_avg = (
            ((abs(current_qty) * current_avg) + (abs(signed_qty) * payload.price)) / total_size
            if total_size > 0
            else 0.0
        )
    elif abs(next_qty) <= 1e-9:
        projected_avg = 0.0
    elif current_qty * next_qty > 0:
        projected_avg = current_avg
    else:
        projected_avg = payload.price

    perp_balance_delta_notional = 0.0
    perp_additional_required_notional = 0.0
    if payload.market == "perp":
        perp_balance_delta_notional = calculate_private_perp_balance_delta_notional(
            current_qty=current_qty,
            next_qty=next_qty,
            price=payload.price,
        )
        perp_additional_required_notional = max(perp_balance_delta_notional, 0.0)

    available_before = float(wallet_snapshot.get("totalAvailableBalance") or 0)
    preview_open_orders: List[OrderRecord] = []
    if payload.exclude_order_id or payload.release_order_ids or (payload.market == "spot" and payload.side == Direction.SELL):
        preview_open_orders = load_private_open_order_records_for_preview(
            parse_open_orders=parse_open_orders,
        )
    available_before += private_released_order_reservation(
        preview_open_orders,
        symbol=payload.symbol,
        market=payload.market,
        exclude_order_id=payload.exclude_order_id,
        release_order_ids=payload.release_order_ids,
        parse_metric_number=parse_metric_number,
        private_order_reserves_private_balance=private_order_reserves_private_balance,
    )
    reserved_spot_sell_qty = 0.0
    released_spot_sell_qty = 0.0
    wallet_available_spot_qty: Optional[float] = None
    if payload.market == "spot" and payload.side == Direction.SELL:
        wallet_available_spot_qty = private_wallet_available_spot_quantity(
            wallet_snapshot,
            symbol=payload.symbol,
        )
        reserved_spot_sell_qty = private_reserved_spot_sell_quantity(
            preview_open_orders,
            symbol=payload.symbol,
            exclude_order_id=payload.exclude_order_id,
            parse_metric_number=parse_metric_number,
        )
        released_spot_sell_qty = private_released_spot_sell_reservation(
            preview_open_orders,
            symbol=payload.symbol,
            exclude_order_id=payload.exclude_order_id,
        )
    blocked_reason = validate_exchange_order_constraints(
        symbol=payload.symbol,
        market=payload.market,
        quantity=payload.quantity,
        price=payload.price,
    )
    # Round 70 — track a typed ``block_code`` alongside the free-form
    # ``blocked_reason`` so ``evaluate_risk_decision`` does not have to
    # re-derive it via substring probe.
    block_code: Optional[str] = (
        RISK_REASON_EXCHANGE_CONSTRAINT if blocked_reason is not None else None
    )
    recommended_action = build_exchange_constraint_recommended_action(blocked_reason)
    if blocked_reason is None and payload.market == "spot" and payload.side == Direction.BUY and available_before + 1e-9 < notional:
        blocked_reason = build_private_insufficient_balance_reason(
            available_balance=available_before,
            required_notional=notional,
            buy_order=True,
        )
        block_code = RISK_REASON_INSUFFICIENT_BALANCE
        recommended_action = build_private_insufficient_balance_recommended_action(
            account_type=status.account_type,
            available_balance=available_before,
            required_notional=notional,
            buy_order=True,
        )
    elif blocked_reason is None and payload.market == "spot" and payload.side == Direction.SELL:
        if wallet_available_spot_qty is not None:
            available_spot_qty = max(wallet_available_spot_qty + released_spot_sell_qty, 0.0)
        else:
            available_spot_qty = max(current_qty - reserved_spot_sell_qty, 0.0)
        if available_spot_qty + 1e-9 < payload.quantity:
            blocked_reason = (
                "当前 Bybit 现货可卖数量不足，"
                f"扣除未成交卖单占用后最多可卖 {repo._format_quantity(available_spot_qty, 6)}。"
            )
            block_code = RISK_REASON_INSUFFICIENT_INVENTORY
            recommended_action = build_private_spot_inventory_recommended_action(payload.symbol)
    elif blocked_reason is None and payload.market == "perp" and available_before + 1e-9 < perp_additional_required_notional:
        blocked_reason = build_private_insufficient_balance_reason(
            available_balance=available_before,
            required_notional=perp_additional_required_notional,
            buy_order=False,
        )
        block_code = RISK_REASON_INSUFFICIENT_BALANCE
        recommended_action = build_private_insufficient_balance_recommended_action(
            account_type=status.account_type,
            available_balance=available_before,
            required_notional=perp_additional_required_notional,
            buy_order=False,
        )

    warnings = [
        "当前为真实交易顾问式预检，最终风控、最小下单单位和精度仍以 Bybit 返回为准。",
    ]
    if wallet_available_spot_qty is not None:
        warnings.append(
            f"当前 {payload.symbol.upper()} 钱包可用数量为 {repo._format_quantity(wallet_available_spot_qty, 6)}。"
        )
    if reserved_spot_sell_qty > 1e-9:
        warnings.append(
            f"当前已扣除 {payload.symbol.upper()} 未成交卖单占用 {repo._format_quantity(reserved_spot_sell_qty, 6)}。"
        )
    if close_qty > 0:
        warnings.append("本次委托若成交，会先结算一部分已实现盈亏。")
    if current_qty != 0 and current_qty * next_qty < 0:
        warnings.append("本次委托若成交，会让当前仓位发生反手。")

    if payload.market == "perp":
        available_after = available_before - perp_balance_delta_notional
    else:
        available_after = available_before - (notional if payload.side == Direction.BUY else -notional)

    return ExecutionPreview(
        **base_preview,
        action=repo._describe_execution_action_locked(payload.market, payload.side, current_qty, next_qty),  # type: ignore[attr-defined]
        allowed=blocked_reason is None,
        blocked_reason=blocked_reason,
        block_code=block_code,
        recommended_action=recommended_action,
        warnings=warnings,
        current_position_side=repo._classify_position_side(current_qty),  # type: ignore[attr-defined]
        current_position_size=repo._format_quantity(abs(current_qty), 6),  # type: ignore[attr-defined]
        current_avg_price=repo._format_ratio(current_avg) if abs(current_qty) > 1e-9 else "--",  # type: ignore[attr-defined]
        projected_position_side=repo._classify_position_side(next_qty),  # type: ignore[attr-defined]
        projected_position_size=repo._format_quantity(abs(next_qty), 6),  # type: ignore[attr-defined]
        projected_avg_price=repo._format_ratio(projected_avg) if abs(next_qty) > 1e-9 else "--",  # type: ignore[attr-defined]
        available_balance_before=format_usdt(available_before),
        available_balance_after=format_usdt(available_after),
        estimated_realized_pnl=repo._format_usdt_delta(realized_on_fill) if close_qty > 0 else "--",  # type: ignore[attr-defined]
    )

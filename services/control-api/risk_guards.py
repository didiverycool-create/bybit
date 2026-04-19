"""Risk-guard helpers extracted from ``repository.py``.

These helpers were previously defined inline on :class:`AppRepository` in
``services/control-api/repository.py``.  They have been moved here to keep
``repository.py`` easier to navigate while preserving the original behaviour.

The original implementations relied on a number of ``_locked`` instance
helpers (``_build_paper_ledger_locked``, ``_paper_reserved_cash_locked``,
``_paper_reserved_sell_quantity_locked``, ``_format_usdt``,
``_format_quantity``).  Those helpers themselves touch ``self.state`` and
other lazy caches and therefore must stay on :class:`AppRepository` so the
``self._lock`` contract is not broken.  Every callable in this module is a
module-level pure function that accepts those collaborators as explicit
parameters.  ``repository.py`` wraps each function so the public call sites
stay unchanged and the outer lock is still held by the caller.
"""

from __future__ import annotations

from typing import Any, Callable, Dict, Optional

from models import Direction


def evaluate_paper_order_risk(
    symbol: str,
    market: str,
    side: Direction,
    quantity: float,
    price: float,
    *,
    ledger_snapshot: Dict[str, Any],
    reserved_cash: float,
    reserved_spot_sell_qty: float,
    format_usdt: Callable[[float], str],
    format_quantity: Callable[[float, int], str],
) -> Optional[str]:
    """Return a blocked-reason string when a paper order violates risk limits.

    Parameters mirror :meth:`AppRepository._evaluate_paper_order_risk_locked`
    but the dependencies that previously came from ``self`` are now passed in
    explicitly:

    * ``ledger_snapshot`` — the output of
      ``AppRepository._build_paper_ledger_locked``; its ``cash_balance`` and
      ``positions`` fields are consumed here.
    * ``reserved_cash`` — already-reduced value (typically the output of
      ``_paper_reserved_cash_locked(exclude_order_id)``).
    * ``reserved_spot_sell_qty`` — already-reduced value (typically the
      output of ``_paper_reserved_sell_quantity_locked(symbol,
      exclude_order_id)``).
    * ``format_usdt`` / ``format_quantity`` — formatting callables used to
      build the human-readable blocked-reason messages (the existing
      ``_format_usdt`` and ``_format_quantity`` static methods).

    The function is stateless: it does not mutate any argument and does not
    read or write any globals.  It is safe to call from any thread as long
    as the caller is already holding whatever lock protects the state that
    produced ``ledger_snapshot`` / ``reserved_cash`` /
    ``reserved_spot_sell_qty``.
    """

    if quantity <= 0 or price <= 0:
        return "数量和价格必须大于 0。"

    cash_balance = float(ledger_snapshot["cash_balance"])
    available_cash = cash_balance - reserved_cash
    ledger = dict(ledger_snapshot["positions"])
    notional = quantity * price
    symbol_state = ledger.get(symbol, {"qty": 0.0})
    current_qty = float(symbol_state.get("qty") or 0.0)

    if side == Direction.BUY and notional > available_cash + 1e-9:
        return f"Paper 可用余额不足，当前仅剩 {format_usdt(available_cash)}。"

    if (
        market == "spot"
        and side == Direction.SELL
        and current_qty - reserved_spot_sell_qty + 1e-9 < quantity
    ):
        return (
            f"{symbol} 当前 Paper 现货可卖数量不足，"
            f"最多可卖 {format_quantity(max(current_qty - reserved_spot_sell_qty, 0.0), 6)}。"
        )

    return None

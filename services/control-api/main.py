from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from bybit_private_client import BybitPrivateClient
from bybit_public_client import BybitPublicMarketClient
from models import (
    AccountMode,
    AccountAsset,
    AccountOverview,
    AgentJobCreate,
    BybitPrivateStatus,
    BybitTradeProbeResult,
    ChangeRequestCreate,
    ManualOrderRequest,
    OpenClawStatus,
    OrderRecord,
    PositionRecord,
    SchedulerCommand,
    WorkspacePreferences,
    WorkspacePreferencesUpdate,
)
from openclaw_client import OpenClawGatewayClient
from repository import AppRepository


app = FastAPI(title="Bybit 控制端本地服务", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

repo = AppRepository()
openclaw = OpenClawGatewayClient()
market_data = BybitPublicMarketClient(repo.snapshot().settings.api_base_url)
private_data = BybitPrivateClient()


class BacktestCreate(BaseModel):
    strategy_id: str
    data_range: str = "2026-01-01 ~ 2026-03-29"
    timeframe: str = "1h"


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


def timestamp_ms_to_iso(value: Any) -> str:
    try:
        return datetime.fromtimestamp(int(str(value)) / 1000, tz=timezone.utc).astimezone().isoformat()
    except (TypeError, ValueError):
        return private_data.get_status().updated_at


def parse_account_overview() -> AccountOverview:
    status = private_data.get_status()
    if not status.can_query_private:
        return repo.get_mock_account_overview()

    try:
        result = private_data.fetch_wallet_balance()
        wallets = result.get("list", [])
        if not wallets:
            raise RuntimeError("Bybit 账户余额结果为空")
        account = wallets[0]
        coins = account.get("coin", [])
        top_holdings: List[AccountAsset] = []
        sorted_coins = sorted(
            coins,
            key=lambda item: float(item.get("usdValue") or 0),
            reverse=True,
        )
        for coin in sorted_coins[:5]:
            wallet_balance = coin.get("walletBalance") or "0"
            usd_value = float(coin.get("usdValue") or 0)
            available_balance = (
                coin.get("availableToWithdraw")
                or coin.get("transferBalance")
                or wallet_balance
            )
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

        orders = parse_open_orders(use_private_only=True)
        positions = parse_positions(use_private_only=True)
        return AccountOverview(
            source="bybit_private",
            mode=status.mode,
            account_type=status.account_type,
            total_equity=format_usdt(float(account.get("totalEquity") or 0)),
            total_wallet_balance=format_usdt(float(account.get("totalWalletBalance") or 0)),
            total_available_balance=format_usdt(float(account.get("totalAvailableBalance") or 0)),
            unrealised_pnl=format_usdt(float(account.get("totalPerpUPL") or 0)),
            positions_count=len(positions),
            open_orders_count=len(orders),
            top_holdings=top_holdings,
            updated_at=status.updated_at,
        )
    except RuntimeError:
        return repo.get_mock_account_overview()


def parse_positions(use_private_only: bool = False) -> List[PositionRecord]:
    status = private_data.get_status()
    if not status.can_query_private:
        return [] if use_private_only else repo.get_mock_positions()

    try:
        positions = private_data.fetch_positions()
        records: List[PositionRecord] = []
        timestamp = status.updated_at
        for item in positions:
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
                    updated_at=timestamp,
                )
            )
        return records
    except RuntimeError:
        return [] if use_private_only else repo.get_mock_positions()


def parse_open_orders(use_private_only: bool = False) -> List[OrderRecord]:
    status = private_data.get_status()
    if not status.can_query_private:
        return [] if use_private_only else repo.get_mock_orders()

    try:
        orders = private_data.fetch_open_orders()
        records: List[OrderRecord] = []
        for item in orders:
            category = str(item.get("category") or "linear").lower()
            records.append(
                OrderRecord(
                    source="bybit_private",
                    order_id=str(item.get("orderId") or "--"),
                    symbol=str(item.get("symbol") or "--"),
                    market="spot" if category == "spot" else "perp",
                    side=private_data.safe_direction(item.get("side")),
                    order_type=str(item.get("orderType") or "--"),
                    qty=normalize_number(item.get("qty"), 6),
                    price=normalize_number(item.get("price"), 4),
                    status=str(item.get("orderStatus") or "--"),
                    created_at=timestamp_ms_to_iso(item.get("createdTime")),
                )
            )
        return records
    except RuntimeError:
        return [] if use_private_only else repo.get_mock_orders()


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


@app.get("/health")
def health() -> dict:
    state = repo.snapshot()
    return {
        "ok": True,
        "service": "control-api",
        "watchlist_count": len(state.watchlist),
        "strategy_count": len(state.strategies),
        "openclaw_connected": state.control_snapshot.scheduler.openclaw_connected,
    }


@app.get("/api/control/snapshot")
def get_control_snapshot():
    return repo.snapshot().control_snapshot


@app.get("/api/market/watchlist")
def get_watchlist():
    return market_data.enrich_watchlist(repo.snapshot().watchlist)


@app.get("/api/market/{symbol}")
def get_market_detail(symbol: str):
    state = repo.snapshot()
    uppercase_symbol = symbol.upper()
    detail = state.market_details.get(uppercase_symbol)
    if not detail:
        raise HTTPException(status_code=404, detail="找不到该品种")
    watch_item = next((item for item in state.watchlist if item.symbol == uppercase_symbol), None)
    try:
        return market_data.enrich_market_detail(
            symbol=uppercase_symbol,
            market=detail.market,
            fallback_detail=detail,
            watch_item=watch_item,
        )
    except RuntimeError:
        return detail


@app.get("/api/strategies")
def get_strategies():
    return repo.snapshot().strategies


@app.get("/api/account/overview", response_model=AccountOverview)
def get_account_overview():
    return parse_account_overview()


@app.get("/api/account/positions", response_model=List[PositionRecord])
def get_account_positions():
    return parse_positions()


@app.get("/api/account/orders", response_model=List[OrderRecord])
def get_account_orders():
    return parse_open_orders()


@app.get("/api/backtests")
def get_backtests():
    return repo.snapshot().backtests


@app.post("/api/backtests")
def create_backtest(payload: BacktestCreate):
    try:
        return repo.create_backtest(payload.strategy_id, payload.data_range, payload.timeframe)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=f"策略不存在: {exc}") from exc


@app.get("/api/change-requests")
def get_change_requests():
    return repo.snapshot().change_requests


@app.post("/api/change-requests")
def create_change_request(payload: ChangeRequestCreate):
    return repo.create_change_request(payload)


@app.get("/api/ai/scheduler")
def get_scheduler():
    state = repo.snapshot()
    return {
        "scheduler": state.control_snapshot.scheduler,
        "jobs": state.agent_jobs,
        "change_requests": state.change_requests[:8],
    }


@app.post("/api/ai/scheduler/commands")
def apply_scheduler_command(payload: SchedulerCommand):
    return repo.apply_scheduler_command(payload)


@app.get("/api/ai/jobs")
def get_agent_jobs():
    return repo.snapshot().agent_jobs


@app.post("/api/ai/jobs")
def create_agent_job(payload: AgentJobCreate):
    return repo.create_agent_job(payload)


@app.get("/api/ai/reviews")
def get_reviews():
    return repo.snapshot().reviews


@app.get("/api/news")
def get_news():
    return repo.snapshot().news_events


@app.get("/api/alerts")
def get_alerts():
    return repo.snapshot().alerts


@app.get("/api/trades")
def get_trades():
    return repo.snapshot().trades


@app.post("/api/trades/manual")
def create_manual_trade(payload: ManualOrderRequest):
    if payload.mode != AccountMode.PAPER:
        raise HTTPException(
            status_code=409,
            detail="当前版本只开放 Paper 模式的手动交易录入；Demo / Live 待真实执行引擎接通后再开放。",
        )
    return repo.create_manual_trade(payload)


@app.get("/api/audit/events")
def get_audit_events():
    return repo.snapshot().audit_events


@app.get("/api/settings")
def get_settings():
    return repo.snapshot().settings


@app.get("/api/workspace/preferences", response_model=WorkspacePreferences)
def get_workspace_preferences():
    return repo.snapshot().workspace_preferences


@app.post("/api/workspace/preferences", response_model=WorkspacePreferences)
def update_workspace_preferences(payload: WorkspacePreferencesUpdate):
    return repo.update_workspace_preferences(payload)


@app.get("/api/integrations/openclaw", response_model=OpenClawStatus)
def get_openclaw_status():
    return openclaw.get_status()


@app.get("/api/integrations/bybit-private", response_model=BybitPrivateStatus)
def get_bybit_private_status():
    return private_data.get_status()


@app.post("/api/integrations/bybit-private/probe-trade", response_model=BybitTradeProbeResult)
def post_bybit_trade_probe():
    return probe_private_trade_route()


if __name__ == "__main__":
    runtime_root = Path(__file__).resolve().parent / ".runtime"
    runtime_root.mkdir(parents=True, exist_ok=True)
    uvicorn.run(app, host="127.0.0.1", port=8787, reload=False)

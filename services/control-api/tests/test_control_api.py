from __future__ import annotations

import copy
import json
import socket
import sys
import threading
import time
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import uvicorn


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import main as control_main  # type: ignore  # noqa: E402
from bybit_private_client import BybitPrivateClient  # type: ignore  # noqa: E402
from bybit_public_client import BybitPublicMarketClient  # type: ignore  # noqa: E402
from models import AgentJob, AlertRecord, AccountMode, BacktestMetrics, BacktestRun, BybitPrivateStatus, CandlePoint, ChangeRequestCreate, Direction, MarketRecentTrade, OpenClawStatus, OrderBookLevel, OrderRecord, ReviewDocument, StrategyParameter, StrategyRuntimeSnapshot, TradeRecord, WatchlistInstrument  # type: ignore  # noqa: E402
from seed import build_market_detail_for_watchlist, build_state  # type: ignore  # noqa: E402


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _request_json(base_url: str, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Any:
    data = None
    headers = {"Accept": "application/json"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    request = Request(f"{base_url}{path}", data=data, method=method.upper(), headers=headers)
    try:
        with urlopen(request, timeout=10) as response:
            body = response.read().decode("utf-8")
            return response.status, json.loads(body)
    except HTTPError as exc:
        body = exc.read().decode("utf-8")
        try:
            parsed = json.loads(body)
        except json.JSONDecodeError:
            parsed = body
        return exc.code, parsed


def _wait_for_server(base_url: str, timeout: float = 10.0) -> None:
    deadline = time.time() + timeout
    last_error: Optional[Exception] = None
    while time.time() < deadline:
        try:
            with urlopen(f"{base_url}/health", timeout=1) as response:
                if response.status == 200:
                    return
        except Exception as exc:  # pragma: no cover - best effort startup polling
            last_error = exc
            time.sleep(0.1)
    raise RuntimeError(f"control-api 服务未能在 {timeout} 秒内启动: {last_error}")


def _request_text(base_url: str, method: str, path: str) -> tuple[int, str]:
    request = Request(f"{base_url}{path}", method=method.upper(), headers={"Accept": "text/plain"})
    with urlopen(request, timeout=10) as response:
        return response.status, response.read().decode("utf-8")


class StubOpenClawClient:
    def get_status(self, worker_state: Optional[Dict[str, Any]] = None) -> OpenClawStatus:
        return OpenClawStatus(
            configured=False,
            config_path=str(Path.home() / ".openclaw" / "openclaw.json"),
            config_exists=False,
            command_available=False,
            gateway_url="ws://127.0.0.1:18789",
            auth_mode=None,
            default_agent=None,
            resolved_agent=None,
            heartbeat=None,
            health_output=None,
            status_output=None,
            reachable=False,
            worker_running=bool(worker_state.get("running")) if worker_state else False,
            active_job_id=worker_state.get("active_job_id") if worker_state else None,
            last_worker_event_at=worker_state.get("last_worker_event_at") if worker_state else None,
            last_job_id=worker_state.get("last_job_id") if worker_state else None,
            last_job_status=worker_state.get("last_job_status") if worker_state else None,
            last_job_summary=worker_state.get("last_job_summary") if worker_state else None,
        )


class StubBybitPrivateClient:
    def get_status(self) -> BybitPrivateStatus:
        return BybitPrivateStatus(
            configured=False,
            can_query_private=False,
            source="none",
            config_path=str(Path.home() / ".bybit-control" / "private-api.json"),
            config_exists=False,
            example_config_path=str(Path(control_main.__file__).resolve().parent / "private-api.example.json"),
            api_base_url="https://api.bybit.com",
            account_type="UNIFIED",
            mode=AccountMode.PAPER,
            key_hint=None,
            last_error=None,
            updated_at="2026-03-30T00:00:00+08:00",
        )

    def probe_trade_route(self) -> Dict[str, Any]:
        return {
            "outcome": "not_configured",
            "trade_permission": None,
            "ret_code": None,
            "ret_msg": "未检测到 Bybit 私有 API 配置，无法探测真实下单链路。",
            "order_link_id": None,
            "tested_at": "2026-03-30T00:00:00+08:00",
        }


class StubConfiguredEmptyBybitPrivateClient:
    def get_status(self) -> BybitPrivateStatus:
        return BybitPrivateStatus(
            configured=True,
            can_query_private=True,
            source="file",
            config_path=str(Path.home() / ".bybit-control" / "private-api.json"),
            config_exists=True,
            example_config_path=str(Path(control_main.__file__).resolve().parent / "private-api.example.json"),
            api_base_url="https://api.bybit.com",
            account_type="UNIFIED",
            mode=AccountMode.LIVE,
            key_hint="test...1234",
            last_error=None,
            updated_at="2026-03-30T00:00:00+08:00",
        )

    def fetch_wallet_balance(self) -> Dict[str, Any]:
        return {
            "list": [
                {
                    "accountType": "UNIFIED",
                    "totalEquity": "0",
                    "totalWalletBalance": "0",
                    "totalAvailableBalance": "0",
                    "totalPerpUPL": "0",
                    "coin": [],
                }
            ]
        }

    def fetch_usdt_balance_diagnostics(self) -> list[Dict[str, Any]]:
        return [
            {
                "account_type": "UNIFIED",
                "coin": "USDT",
                "wallet_balance": "0",
                "transfer_balance": "0",
                "available_balance": "0",
                "source": "coin-balance",
                "error": None,
            },
            {
                "account_type": "FUND",
                "coin": "USDT",
                "wallet_balance": "0",
                "transfer_balance": "0",
                "available_balance": "0",
                "source": "coin-balance",
                "error": None,
            },
            {
                "account_type": "CONTRACT",
                "coin": "USDT",
                "wallet_balance": "0",
                "transfer_balance": "0",
                "available_balance": "0",
                "source": "coin-balance",
                "error": None,
            },
        ]

    def fetch_positions(self) -> list[Dict[str, Any]]:
        return []

    def fetch_open_orders(self) -> list[Dict[str, Any]]:
        return []

    def fetch_order_history(self) -> list[Dict[str, Any]]:
        return []

    def fetch_execution_history(self) -> list[Dict[str, Any]]:
        return []

    def probe_trade_route(self) -> Dict[str, Any]:
        return {
            "outcome": "validation_rejected",
            "trade_permission": True,
            "ret_code": 10001,
            "ret_msg": "qty invalid",
            "order_link_id": "probe-123",
            "tested_at": "2026-03-30T00:00:00+08:00",
        }

    def create_order(self, body: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "orderId": "created-order-001",
            "orderLinkId": body.get("orderLinkId"),
            "orderStatus": "New",
        }

    def amend_order(self, body: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "orderId": body.get("orderId"),
            "orderStatus": "New",
        }

    def cancel_order(self, body: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "orderId": body.get("orderId"),
            "orderLinkId": None,
            "orderStatus": "Cancelled",
        }

    def cancel_all_orders(self, body: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "list": [],
            "success": "1",
        }


class StubConfiguredTradingBybitPrivateClient(StubConfiguredEmptyBybitPrivateClient):
    def __init__(self) -> None:
        self.created_order_bodies: list[Dict[str, Any]] = []
        self.amended_order_bodies: list[Dict[str, Any]] = []
        self.cancelled_order_bodies: list[Dict[str, Any]] = []
        self.order_history_items: list[Dict[str, Any]] = []

    def get_status(self) -> BybitPrivateStatus:
        return BybitPrivateStatus(
            configured=True,
            can_query_private=True,
            source="file",
            config_path=str(Path.home() / ".bybit-control" / "private-api.json"),
            config_exists=True,
            example_config_path=str(Path(control_main.__file__).resolve().parent / "private-api.example.json"),
            api_base_url="https://api.bybit.com",
            account_type="UNIFIED",
            mode=AccountMode.LIVE,
            key_hint="test...1234",
            last_error=None,
            updated_at="2026-03-30T00:00:00+08:00",
        )

    def fetch_wallet_balance(self) -> Dict[str, Any]:
        return {
            "list": [
                {
                    "accountType": "UNIFIED",
                    "totalEquity": "5000",
                    "totalWalletBalance": "5000",
                    "totalAvailableBalance": "4200",
                    "totalPerpUPL": "0",
                    "coin": [
                        {
                            "coin": "USDT",
                            "walletBalance": "4200",
                            "usdValue": "4200",
                            "availableToWithdraw": "4200",
                        }
                    ],
                }
            ]
        }

    def fetch_positions(self) -> list[Dict[str, Any]]:
        return [
            {
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Buy",
                "size": "0.15",
                "avgPrice": "66500",
                "markPrice": "66800",
                "positionValue": "10020",
                "leverage": "2",
                "unrealisedPnl": "45.5",
            },
            {
                "symbol": "ETHUSDT",
                "category": "spot",
                "side": "Buy",
                "size": "2.5",
                "avgPrice": "2050",
                "markPrice": "2062",
                "positionValue": "5155",
                "leverage": "1",
                "unrealisedPnl": "30",
            },
        ]

    def create_order(self, body: Dict[str, Any]) -> Dict[str, Any]:
        self.created_order_bodies.append(dict(body))
        return {
            "orderId": f"live-order-created-{len(self.created_order_bodies):03d}",
            "orderLinkId": body.get("orderLinkId"),
            "orderStatus": "New",
        }

    def amend_order(self, body: Dict[str, Any]) -> Dict[str, Any]:
        self.amended_order_bodies.append(dict(body))
        return {
            "orderId": body.get("orderId"),
            "orderStatus": "New",
        }

    def cancel_order(self, body: Dict[str, Any]) -> Dict[str, Any]:
        self.cancelled_order_bodies.append(dict(body))
        return {
            "orderId": body.get("orderId"),
            "orderLinkId": None,
            "orderStatus": "Cancelled",
        }

    def fetch_order_history(self) -> list[Dict[str, Any]]:
        return copy.deepcopy(self.order_history_items)


class StubConfiguredDemoBybitPrivateClient(StubConfiguredTradingBybitPrivateClient):
    def get_status(self) -> BybitPrivateStatus:
        return BybitPrivateStatus(
            configured=True,
            can_query_private=True,
            source="file",
            config_path=str(Path.home() / ".bybit-control" / "private-api.json"),
            config_exists=True,
            example_config_path=str(Path(control_main.__file__).resolve().parent / "private-api.example.json"),
            api_base_url="https://api-demo.bybit.com",
            account_type="UNIFIED",
            mode=AccountMode.DEMO,
            key_hint="demo...1234",
            last_error=None,
            updated_at="2026-03-30T00:00:00+08:00",
        )


class StubConfiguredTradeHistoryBybitPrivateClient(StubConfiguredEmptyBybitPrivateClient):
    def fetch_execution_history(self) -> list[Dict[str, Any]]:
        return [
            {
                "execId": "exec-btc-001",
                "orderId": "order-btc-001",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Buy",
                "execQty": "0.12",
                "execPrice": "66780.5",
                "closedPnl": "12.45",
                "execTime": "1774887000000",
                "orderLinkId": "live-review-btc",
            },
            {
                "execId": "exec-eth-001",
                "orderId": "order-eth-001",
                "symbol": "ETHUSDT",
                "category": "spot",
                "side": "Sell",
                "execQty": "1.5",
                "execPrice": "2058.4",
                "closedPnl": "0",
                "execTime": "1774887600000",
                "orderLinkId": "",
            },
        ]


class StubConfiguredOrderHistoryBybitPrivateClient(StubConfiguredEmptyBybitPrivateClient):
    def fetch_order_history(self) -> list[Dict[str, Any]]:
        return [
            {
                "orderId": "hist-order-001",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Buy",
                "orderType": "Limit",
                "qty": "0.50",
                "price": "66820",
                "orderStatus": "Filled",
                "createdTime": "1774887000000",
            },
            {
                "orderId": "hist-order-002",
                "symbol": "ETHUSDT",
                "category": "spot",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "2",
                "price": "2068",
                "orderStatus": "Cancelled",
                "createdTime": "1774887600000",
            },
        ]


class StubBybitPrivateRealtimeClient:
    def __init__(
        self,
        *,
        client: Optional[Any] = None,
        wallet: Optional[Dict[str, Any]] = None,
        positions: Optional[list[Dict[str, Any]]] = None,
        orders: Optional[list[Dict[str, Any]]] = None,
        executions: Optional[list[Dict[str, Any]]] = None,
        connected: bool = False,
        authenticated: bool = False,
        last_message_at: Optional[str] = None,
        last_error: Optional[str] = None,
    ) -> None:
        self.client = client
        self.wallet = copy.deepcopy(wallet)
        self.positions = copy.deepcopy(positions or [])
        self.orders = copy.deepcopy(orders or [])
        self.executions = copy.deepcopy(executions or [])
        self.connected = connected
        self.authenticated = authenticated
        self.last_message_at = (
            last_message_at
            if last_message_at is not None
            else (datetime.now(timezone.utc).astimezone().isoformat() if connected else None)
        )
        self.last_error = last_error
        self.ensure_started_calls = 0

    def start(self) -> bool:
        self.ensure_started_calls += 1
        return self.connected

    def ensure_started(self) -> bool:
        self.ensure_started_calls += 1
        return self.connected

    def stop(self) -> None:
        return None

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": True,
            "connected": self.connected,
            "authenticated": self.authenticated,
            "last_message_at": self.last_message_at,
            "last_error": self.last_error,
            "has_wallet": self.wallet is not None,
            "positions_count": len(self.positions),
            "open_orders_count": len(self.orders),
            "executions_count": len(self.executions),
        }

    def get_wallet_snapshot(self) -> Optional[Dict[str, Any]]:
        return copy.deepcopy(self.wallet)

    def get_positions_snapshot(self) -> list[Dict[str, Any]]:
        return copy.deepcopy(self.positions)

    def get_open_orders_snapshot(self) -> list[Dict[str, Any]]:
        return copy.deepcopy(self.orders)

    def get_execution_snapshot(self, limit: int = 50) -> list[Dict[str, Any]]:
        return copy.deepcopy(self.executions[:limit])

    def seed_wallet_snapshot(self, wallet: Dict[str, Any]) -> None:
        self.wallet = copy.deepcopy(wallet)

    def seed_positions_snapshot(self, positions: list[Dict[str, Any]]) -> None:
        self.positions = copy.deepcopy(positions)

    def seed_open_orders_snapshot(self, orders: list[Dict[str, Any]]) -> None:
        self.orders = copy.deepcopy(orders)

    def seed_execution_snapshot(self, executions: list[Dict[str, Any]]) -> None:
        self.executions = copy.deepcopy(executions)


class StubAliveThread:
    def is_alive(self) -> bool:
        return True

    def join(self, timeout: Optional[float] = None) -> None:
        return None


class StubBybitPublicMarketClient:
    def __init__(self) -> None:
        seeded_items = {item.symbol: item for item in build_state().watchlist}
        seeded_items["XRPUSDT"] = WatchlistInstrument(
            symbol="XRPUSDT",
            market="perp",
            last_price=1.2648,
            change_24h=1.83,
            volume_24h=182_000_000,
            signal="watch",
            position_side="flat",
            risk_level="medium",
        )
        self._items = seeded_items
        self.rest_probe = {
            "reachable": True,
            "last_error": None,
            "tested_at": "2026-03-31T09:00:00+08:00",
        }
        self.enrich_watchlist_calls = 0
        self.enrich_watchlist_fast_calls = 0

    @staticmethod
    def normalize_timeframe(timeframe: str) -> str:
        normalized = str(timeframe or "1h").strip().lower()
        mapping = {
            "15": "15m",
            "15m": "15m",
            "60": "1h",
            "1h": "1h",
            "240": "4h",
            "4h": "4h",
            "d": "1d",
            "1d": "1d",
        }
        if normalized not in mapping:
            raise ValueError("当前仅支持 15m、1h、4h、1d 四种 K 线周期。")
        return mapping[normalized]

    def _lookup_item(self, symbol: str, market: str) -> WatchlistInstrument:
        normalized = symbol.upper()
        item = self._items.get(normalized)
        if item is None:
            item = WatchlistInstrument(
                symbol=normalized,
                market="spot" if market == "spot" else "perp",
                last_price=1.0,
                change_24h=0.92,
                volume_24h=12_000_000,
                signal="neutral",
                position_side="flat",
                risk_level="low",
            )
            self._items[normalized] = item
        if item.market != market:
            return item.model_copy(update={"market": "spot" if market == "spot" else "perp"})
        return item

    def get_ticker(self, symbol: str, market: str) -> Dict[str, Any]:
        item = self._lookup_item(symbol, market)
        last_price = float(item.last_price)
        return {
            "lastPrice": str(last_price),
            "price24hPcnt": str(item.change_24h / 100.0),
            "turnover24h": str(item.volume_24h),
            "volume24h": str(item.volume_24h),
            "highPrice24h": str(last_price * 1.03),
            "lowPrice24h": str(last_price * 0.97),
            "fundingRate": "0.0001" if item.market == "perp" else "",
            "openInterestValue": "125000000",
        }

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[Any]:
        item = self._lookup_item(symbol, market)
        return build_market_detail_for_watchlist(item).candles[:limit]

    def get_orderbook(self, symbol: str, market: str, limit: int = 8) -> Dict[str, Any]:
        item = self._lookup_item(symbol, market)
        detail = build_market_detail_for_watchlist(item)
        return {"bids": detail.bids[:limit], "asks": detail.asks[:limit]}

    def get_recent_public_trades(self, symbol: str, market: str, limit: int = 12) -> list[Any]:
        item = self._lookup_item(symbol, market)
        detail = build_market_detail_for_watchlist(item)
        return detail.recent_public_trades[:limit]

    def get_announcements(self, locale: str = "zh-TW", limit: int = 8) -> list[Dict[str, Any]]:
        return [
            {
                "id": "ann-btc-maintenance",
                "title": "BTCUSDT 永续合约维护窗口提醒",
                "description": "Bybit 将在短时维护窗口内更新 BTCUSDT 永续合约相关服务。",
                "url": "https://announcements.bybit.com/article/btc-maintenance",
                "publishTime": "1774887600000",
                "tags": ["maintenance", "derivatives"],
            },
            {
                "id": "ann-sol-listing",
                "title": "SOL 生态新币上线公告",
                "description": "新资产将在 Bybit 现货区开放交易。",
                "url": "https://announcements.bybit.com/article/sol-listing",
                "publishTime": "1774884000000",
                "tags": ["listing", "spot"],
            },
        ]

    def get_instrument_constraints(self, symbol: str, market: str) -> Dict[str, str]:
        return {
            "symbol": symbol.upper(),
            "market": market,
            "tick_size": "0.1",
            "qty_step": "0.0001",
            "min_order_qty": "0.0001",
            "min_notional_value": "5",
        }

    def enrich_watchlist(self, watchlist: list[WatchlistInstrument]) -> list[WatchlistInstrument]:
        self.enrich_watchlist_calls += 1
        enriched: list[WatchlistInstrument] = []
        for item in watchlist:
            realtime_item = self._lookup_item(item.symbol, item.market)
            enriched.append(
                item.model_copy(
                    update={
                        "last_price": realtime_item.last_price,
                        "change_24h": realtime_item.change_24h,
                        "volume_24h": realtime_item.volume_24h,
                        "signal": realtime_item.signal,
                        "position_side": realtime_item.position_side,
                        "risk_level": realtime_item.risk_level,
                    }
                )
            )
        return enriched

    def enrich_watchlist_fast(self, watchlist: list[WatchlistInstrument]) -> list[WatchlistInstrument]:
        self.enrich_watchlist_fast_calls += 1
        return self.enrich_watchlist(watchlist)

    def enrich_market_detail(
        self,
        symbol: str,
        market: str,
        fallback_detail: Any,
        watch_item: Optional[WatchlistInstrument] = None,
        timeframe: str = "1h",
        allow_rest_refresh: bool = True,
    ) -> Any:
        item = watch_item or self._lookup_item(symbol, market)
        detail = build_market_detail_for_watchlist(item)
        return detail.model_copy(
            update={
                "timeframe": timeframe,
                "source": "bybit_rest",
                "updated_at": "2026-03-30T00:00:00+08:00",
            }
        )

    def probe_rest_connectivity(self, force: bool = False) -> Dict[str, Any]:  # noqa: ARG002
        return dict(self.rest_probe)


class StubStrategyRuntimeMarketClient(StubBybitPublicMarketClient):
    def __init__(
        self,
        symbol: str,
        price: float,
        change_24h: float,
        candles: list[CandlePoint],
        instrument_constraints: Optional[Dict[str, str]] = None,
    ) -> None:
        super().__init__()
        normalized = symbol.upper()
        base_item = self._lookup_item(normalized, "perp")
        self._items[normalized] = base_item.model_copy(
            update={
                "last_price": price,
                "change_24h": change_24h,
                "signal": "active" if abs(change_24h) >= 3 else "watch",
                "risk_level": "medium",
            }
        )
        self._candles = candles
        self._instrument_constraints = {
            "tick_size": "0.1",
            "qty_step": "0.0001",
            "min_order_qty": "0.0001",
            "min_notional_value": "5",
        }
        if instrument_constraints:
            self._instrument_constraints.update({key: str(value) for key, value in instrument_constraints.items()})

    def get_instrument_constraints(self, symbol: str, market: str) -> Dict[str, str]:
        return {
            "symbol": symbol.upper(),
            "market": market,
            **self._instrument_constraints,
        }

    def enrich_market_detail(
        self,
        symbol: str,
        market: str,
        fallback_detail: Any,
        watch_item: Optional[WatchlistInstrument] = None,
        timeframe: str = "1h",
    ) -> Any:
        item = watch_item or self._lookup_item(symbol, market)
        detail = build_market_detail_for_watchlist(item)
        return detail.model_copy(
            update={
                "timeframe": timeframe,
                "candles": list(self._candles),
                "source": "bybit_rest",
                "updated_at": "2026-03-31T09:00:00+08:00",
            }
        )


class RecordingBacktestMarketClient(StubBybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__()
        self.requested_markets: list[str] = []
        self.candle_requests: list[dict[str, Any]] = []

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[Any]:
        self.requested_markets.append(market)
        self.candle_requests.append(
            {
                "symbol": symbol.upper(),
                "market": market,
                "interval": interval,
                "limit": limit,
            }
        )
        return super().get_candles(symbol, market, interval=interval, limit=limit)


class LongHistoryBacktestMarketClient(RecordingBacktestMarketClient):
    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[Any]:
        self.requested_markets.append(market)
        self.candle_requests.append(
            {
                "symbol": symbol.upper(),
                "market": market,
                "interval": interval,
                "limit": limit,
            }
        )
        base_time = datetime(2025, 1, 1, tzinfo=timezone.utc)
        candles = [
            CandlePoint(
                time=(base_time + timedelta(hours=index)).astimezone().isoformat(),
                open=100.0 + index * 0.05,
                high=100.2 + index * 0.05,
                low=99.8 + index * 0.05,
                close=100.0 + index * 0.05,
                volume=1000 + index,
            )
            for index in range(limit)
        ]
        return candles


class PaginatedHistoryBacktestMarketClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.requested_markets: list[str] = []
        self.candle_requests: list[dict[str, Any]] = []

    @staticmethod
    def _interval_delta(interval: str) -> timedelta:
        return {
            "15": timedelta(minutes=15),
            "60": timedelta(hours=1),
            "240": timedelta(hours=4),
            "D": timedelta(days=1),
        }.get(interval, timedelta(hours=1))

    def get_candles_page(
        self,
        symbol: str,
        market: str,
        interval: str = "60",
        limit: int = 48,
        end: Optional[int] = None,
    ) -> list[CandlePoint]:
        self.requested_markets.append(market)
        self.candle_requests.append(
            {
                "symbol": symbol.upper(),
                "market": market,
                "interval": interval,
                "limit": limit,
                "end": end,
            }
        )
        delta = self._interval_delta(interval)
        if end is None:
            newest_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
        else:
            newest_time = datetime.fromtimestamp((int(end) + 1) / 1000, tz=timezone.utc) - delta
        return [
            CandlePoint(
                time=(newest_time - delta * (limit - index - 1)).astimezone().isoformat(),
                open=100.0 + index * 0.05,
                high=100.2 + index * 0.05,
                low=99.8 + index * 0.05,
                close=100.0 + index * 0.05,
                volume=1000 + index,
            )
            for index in range(limit)
        ]


class ShortHistoryBacktestMarketClient(PaginatedHistoryBacktestMarketClient):
    def __init__(self, total_available: int = 60) -> None:
        super().__init__()
        self.total_available = total_available

    def get_candles_page(
        self,
        symbol: str,
        market: str,
        interval: str = "60",
        limit: int = 48,
        end: Optional[int] = None,
    ) -> list[CandlePoint]:
        fetched = sum(int(item["returned"]) for item in self.candle_requests if item.get("interval") == interval)
        remaining = max(self.total_available - fetched, 0)
        page_limit = min(limit, remaining)
        self.requested_markets.append(market)
        self.candle_requests.append(
            {
                "symbol": symbol.upper(),
                "market": market,
                "interval": interval,
                "limit": limit,
                "end": end,
                "returned": page_limit,
            }
        )
        if page_limit <= 0:
            return []
        delta = self._interval_delta(interval)
        if end is None:
            newest_time = datetime(2026, 1, 1, tzinfo=timezone.utc)
        else:
            newest_time = datetime.fromtimestamp((int(end) + 1) / 1000, tz=timezone.utc) - delta
        return [
            CandlePoint(
                time=(newest_time - delta * (page_limit - index - 1)).astimezone().isoformat(),
                open=100.0 + index * 0.05,
                high=100.2 + index * 0.05,
                low=99.8 + index * 0.05,
                close=100.0 + index * 0.05,
                volume=1000 + index,
            )
            for index in range(page_limit)
        ]


class FailingBacktestHistoryMarketClient(StubBybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__()
        self.history_requests: list[dict[str, Any]] = []

    def get_candles_history(
        self,
        symbol: str,
        market: str,
        timeframe: str = "1h",
        limit: int = 48,
    ) -> list[CandlePoint]:
        self.history_requests.append(
            {
                "symbol": symbol.upper(),
                "market": market,
                "timeframe": timeframe,
                "limit": limit,
            }
        )
        raise RuntimeError("Bybit history api unavailable")


class StubPublicExecutionRealtimeFeed:
    def __init__(
        self,
        *,
        enabled: bool = True,
        connected_spot: bool = True,
        connected_linear: bool = True,
        last_message_at_spot: Optional[str] = None,
        last_message_at_linear: Optional[str] = None,
        symbol_last_message_at: Optional[Dict[str, str]] = None,
        ticker_symbols: Optional[list[str]] = None,
        last_error: Optional[str] = None,
    ) -> None:
        now_iso = datetime.now(timezone.utc).astimezone().isoformat()
        self.enabled = enabled
        self.connected_spot = connected_spot
        self.connected_linear = connected_linear
        self.last_message_at_spot = last_message_at_spot if last_message_at_spot is not None else (now_iso if connected_spot else None)
        self.last_message_at_linear = (
            last_message_at_linear if last_message_at_linear is not None else (now_iso if connected_linear else None)
        )
        self.symbol_last_message_at = {str(key).upper(): value for key, value in (symbol_last_message_at or {}).items()}
        self.ticker_symbols = {str(item).upper() for item in (ticker_symbols or [])}
        self.last_error = last_error

    @staticmethod
    def _market_key(symbol: str, market: Optional[str] = None) -> str:
        normalized_symbol = symbol.upper()
        return f"{market}:{normalized_symbol}".upper() if market else normalized_symbol

    def update_watchlist(self, watchlist: list[Any]) -> None:
        return None

    def get_status(self) -> Dict[str, Any]:
        latest = self.last_message_at_linear or self.last_message_at_spot
        return {
            "enabled": self.enabled,
            "connected_spot": self.connected_spot,
            "connected_linear": self.connected_linear,
            "last_message_at_spot": self.last_message_at_spot,
            "last_message_at_linear": self.last_message_at_linear,
            "last_message_at": latest,
            "last_error": self.last_error,
        }

    def has_ticker(self, symbol: str, market: Optional[str] = None) -> bool:
        return self._market_key(symbol, market) in self.ticker_symbols or symbol.upper() in self.ticker_symbols

    def get_symbol_last_message_at(self, symbol: str, market: Optional[str] = None) -> Optional[str]:
        return self.symbol_last_message_at.get(self._market_key(symbol, market)) or self.symbol_last_message_at.get(
            symbol.upper()
        )


class FakeRealtimeFeed:
    def __init__(
        self,
        live_candle: CandlePoint,
        recent_trades: Optional[list[Dict[str, Any]]] = None,
        orderbook_snapshot: Optional[Dict[str, Any]] = None,
    ) -> None:
        self.live_candle = live_candle
        self.recent_trades = recent_trades or []
        self.orderbook_snapshot = orderbook_snapshot or {"bids": [], "asks": []}

    def get_ticker_snapshot(self, symbol: str, market: Optional[str] = None) -> Dict[str, Any]:  # noqa: ARG002
        return {
            "lastPrice": str(self.live_candle.close),
            "price24hPcnt": "0.021",
            "highPrice24h": str(self.live_candle.high * 1.01),
            "lowPrice24h": str(self.live_candle.low * 0.99),
            "fundingRate": "0.0001",
            "openInterestValue": "125000000",
        }

    def merge_candles(
        self,
        symbol: str,
        candles: list[CandlePoint],
        market: Optional[str] = None,
        timeframe: str = "1h",
    ) -> list[CandlePoint]:  # noqa: ARG002
        if candles and candles[-1].time == self.live_candle.time:
            return [*candles[:-1], self.live_candle]
        return [*candles, self.live_candle]

    def get_status(self) -> Dict[str, Any]:
        return {"last_message_at": self.live_candle.time}

    def get_recent_trades_snapshot(
        self,
        symbol: str,
        limit: int = 12,
        market: Optional[str] = None,
    ) -> list[Any]:  # noqa: ARG002
        return self.recent_trades[:limit]

    def get_orderbook_snapshot(
        self,
        symbol: str,
        limit: int = 8,
        market: Optional[str] = None,
    ) -> Dict[str, Any]:  # noqa: ARG002
        return {
            "bids": list(self.orderbook_snapshot.get("bids", []))[:limit],
            "asks": list(self.orderbook_snapshot.get("asks", []))[:limit],
        }


class MultiMarketRealtimeFeed:
    def __init__(self) -> None:
        self._live_candles = {
            "spot": CandlePoint(
                time="2026-03-31T06:00:00+08:00",
                open=101.0,
                high=103.0,
                low=100.5,
                close=102.5,
                volume=2400.0,
            ),
            "perp": CandlePoint(
                time="2026-03-31T06:00:00+08:00",
                open=201.0,
                high=203.0,
                low=200.5,
                close=202.5,
                volume=4200.0,
            ),
        }

    @staticmethod
    def _normalize_market(market: Optional[str]) -> str:
        return "spot" if market == "spot" else "perp"

    def get_ticker_snapshot(self, symbol: str, market: Optional[str] = None) -> Dict[str, Any]:  # noqa: ARG002
        candle = self._live_candles[self._normalize_market(market)]
        return {
            "lastPrice": str(candle.close),
            "price24hPcnt": "0.021",
            "highPrice24h": str(candle.high * 1.01),
            "lowPrice24h": str(candle.low * 0.99),
            "fundingRate": "0.0001" if self._normalize_market(market) == "perp" else "",
            "openInterestValue": "125000000",
        }

    def merge_candles(
        self,
        symbol: str,
        candles: list[CandlePoint],
        market: Optional[str] = None,
        timeframe: str = "1h",
    ) -> list[CandlePoint]:  # noqa: ARG002
        return [*candles, self._live_candles[self._normalize_market(market)]]

    def get_status(self) -> Dict[str, Any]:
        return {"last_message_at": "2026-03-31T06:00:00+08:00"}

    def get_recent_trades_snapshot(
        self,
        symbol: str,
        limit: int = 12,
        market: Optional[str] = None,
    ) -> list[Any]:  # noqa: ARG002
        normalized_market = self._normalize_market(market)
        price = 102.5 if normalized_market == "spot" else 202.5
        return [
            {
                "side": "buy",
                "price": price,
                "size": 0.25,
                "value": round(price * 0.25, 6),
                "occurred_at": "2026-03-31T06:00:05+08:00",
                "is_block_trade": False,
            }
        ][:limit]

    def get_orderbook_snapshot(
        self,
        symbol: str,
        limit: int = 8,
        market: Optional[str] = None,
    ) -> Dict[str, Any]:  # noqa: ARG002
        normalized_market = self._normalize_market(market)
        bid_price = 102.4 if normalized_market == "spot" else 202.4
        ask_price = 102.6 if normalized_market == "spot" else 202.6
        return {
            "bids": [OrderBookLevel(price=bid_price, size=12.4, total=12.4)][:limit],
            "asks": [OrderBookLevel(price=ask_price, size=10.8, total=10.8)][:limit],
        }


class MultiMarketRealtimeClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.realtime = MultiMarketRealtimeFeed()

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[CandlePoint]:
        base_price = 100.0 if market == "spot" else 200.0
        return [
            CandlePoint(
                time="2026-03-31T05:00:00+08:00",
                open=base_price,
                high=base_price + 1.0,
                low=base_price - 1.0,
                close=base_price + 0.5,
                volume=1800.0,
            )
        ][:limit]


class FakeRealtimeHistoryMarketClient(BybitPublicMarketClient):
    def __init__(self, rest_candles: list[CandlePoint], live_candle: CandlePoint) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self._rest_candles = rest_candles
        self.realtime = FakeRealtimeFeed(live_candle)

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[CandlePoint]:
        return list(self._rest_candles[:limit])

    def get_orderbook(self, symbol: str, market: str, limit: int = 8) -> Dict[str, Any]:
        return {"bids": [], "asks": []}

    def get_recent_public_trades(self, symbol: str, market: str, limit: int = 12) -> list[Any]:
        detail = build_market_detail_for_watchlist(
            WatchlistInstrument(
                symbol=symbol,
                market=market,
                last_price=self._rest_candles[-1].close,
                change_24h=1.2,
                volume_24h=1_000_000,
                signal="active",
                position_side="flat",
                risk_level="medium",
            )
        )
        return detail.recent_public_trades[:limit]


class FakeRealtimeTradePriorityClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.rest_called = False
        self.realtime = FakeRealtimeFeed(
            live_candle=CandlePoint(
                time="2026-03-31T06:00:00+08:00",
                open=66_620,
                high=66_820,
                low=66_540,
                close=66_727.3,
                volume=1_075.993,
            ),
            recent_trades=[
                {
                    "side": "buy",
                    "price": 66727.3,
                    "size": 0.42,
                    "value": 28025.466,
                    "occurred_at": "2026-03-31T06:00:05+08:00",
                    "is_block_trade": False,
                }
            ],
        )

    def _request(self, path: str, params: Dict[str, object]) -> Dict:
        self.rest_called = True
        return {"list": []}


class NonHourlyRealtimePriorityClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.rest_ticker_called = False
        self.rest_orderbook_called = False
        self.rest_trade_called = False
        self.realtime = FakeRealtimeFeed(
            live_candle=CandlePoint(
                time="2026-03-31T06:00:00+08:00",
                open=66_620,
                high=66_820,
                low=66_540,
                close=66_727.3,
                volume=1_075.993,
            ),
            recent_trades=[
                {
                    "side": "buy",
                    "price": 66727.3,
                    "size": 0.42,
                    "value": 28025.466,
                    "occurred_at": "2026-03-31T06:00:05+08:00",
                    "is_block_trade": False,
                }
            ],
            orderbook_snapshot={
                "bids": [OrderBookLevel(price=66726.8, size=12.4, total=12.4)],
                "asks": [OrderBookLevel(price=66727.1, size=11.1, total=11.1)],
            },
        )

    def get_ticker(self, symbol: str, market: str) -> Dict[str, Any]:  # noqa: ARG002
        self.rest_ticker_called = True
        return {
            "lastPrice": "66000",
            "price24hPcnt": "0.01",
            "highPrice24h": "66100",
            "lowPrice24h": "65900",
        }

    def get_orderbook(self, symbol: str, market: str, limit: int = 8) -> Dict[str, Any]:  # noqa: ARG002
        self.rest_orderbook_called = True
        return {
            "bids": [OrderBookLevel(price=66000.0, size=8.0, total=8.0)][:limit],
            "asks": [OrderBookLevel(price=66010.0, size=7.5, total=7.5)][:limit],
        }

    def get_recent_public_trades(self, symbol: str, market: str, limit: int = 12) -> list[Any]:  # noqa: ARG002
        self.rest_trade_called = True
        return super().get_recent_public_trades(symbol, market, limit=limit)

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[CandlePoint]:  # noqa: ARG002
        return [
            CandlePoint(
                time="2026-03-31T05:30:00+08:00",
                open=66_410,
                high=66_520,
                low=66_350,
                close=66_480,
                volume=1_800,
            ),
            CandlePoint(
                time="2026-03-31T05:45:00+08:00",
                open=66_480,
                high=66_710,
                low=66_420,
                close=66_620,
                volume=1_950,
            ),
        ][:limit]


class RealtimeTickerOnlyMarketClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.rest_ticker_called = False
        self.rest_orderbook_called = False
        self.rest_trade_called = False
        self.realtime = FakeRealtimeFeed(
            live_candle=CandlePoint(
                time="2026-03-31T06:00:00+08:00",
                open=66_620,
                high=66_820,
                low=66_540,
                close=66_727.3,
                volume=1_075.993,
            ),
            recent_trades=[],
            orderbook_snapshot={"bids": [], "asks": []},
        )

    def get_ticker(self, symbol: str, market: str) -> Dict[str, Any]:  # noqa: ARG002
        self.rest_ticker_called = True
        return {
            "lastPrice": "66000",
            "price24hPcnt": "0.01",
            "highPrice24h": "66100",
            "lowPrice24h": "65900",
        }

    def get_orderbook(self, symbol: str, market: str, limit: int = 8) -> Dict[str, Any]:  # noqa: ARG002
        self.rest_orderbook_called = True
        return {
            "bids": [OrderBookLevel(price=66000.0, size=8.0, total=8.0)][:limit],
            "asks": [OrderBookLevel(price=66010.0, size=7.5, total=7.5)][:limit],
        }

    def get_recent_public_trades(self, symbol: str, market: str, limit: int = 12) -> list[Any]:  # noqa: ARG002
        self.rest_trade_called = True
        return [
            MarketRecentTrade(
                side="buy",
                price=66_727.3,
                size=0.42,
                value=28_025.466,
                occurred_at="2026-03-31T06:00:05+08:00",
                is_block_trade=False,
            )
        ][:limit]

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[CandlePoint]:  # noqa: ARG002
        return [
            CandlePoint(
                time="2026-03-31T05:30:00+08:00",
                open=66_410,
                high=66_520,
                low=66_350,
                close=66_480,
                volume=1_800,
            ),
            CandlePoint(
                time="2026-03-31T05:45:00+08:00",
                open=66_480,
                high=66_710,
                low=66_420,
                close=66_620,
                volume=1_950,
            ),
        ][:limit]


class RecordingHistoryPrimeMarketClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.primed_symbols: list[str] = []
        self.realtime = type(
            "HistoryPrimeRealtimeFeed",
            (),
            {
                "update_watchlist": staticmethod(lambda watchlist: None),
                "enrich_watchlist": staticmethod(lambda watchlist: list(watchlist)),
            },
        )()

    def schedule_watchlist_history_prime(self, watchlist: list[WatchlistInstrument]) -> None:
        self.primed_symbols = [item.symbol for item in watchlist]


class HistoryCachingPrimeMarketClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.history_calls: list[tuple[str, str]] = []
        self.realtime = type(
            "HistoryCachingRealtimeFeed",
            (),
            {
                "update_watchlist": staticmethod(lambda watchlist: None),
                "enrich_watchlist": staticmethod(lambda watchlist: list(watchlist)),
            },
        )()

    def get_candles_history(self, symbol: str, market: str, timeframe: str = "1h", limit: int = 48) -> list[CandlePoint]:
        self.history_calls.append((symbol, timeframe))
        return [
            CandlePoint(
                time=f"2026-03-31T{(index % 24):02d}:00:00+08:00",
                open=100 + index,
                high=101 + index,
                low=99 + index,
                close=100.5 + index,
                volume=1_000 + index,
            )
            for index in range(limit)
        ]


class FailingRealtimeHistoryClient(NonHourlyRealtimePriorityClient):
    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[CandlePoint]:  # noqa: ARG002
        raise RuntimeError("temporary kline failure")


class FakeRealtimeOrderbookPriorityClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.rest_called = False
        self.realtime = FakeRealtimeFeed(
            live_candle=CandlePoint(
                time="2026-03-31T06:00:00+08:00",
                open=66_620,
                high=66_820,
                low=66_540,
                close=66_727.3,
                volume=1_075.993,
            ),
            orderbook_snapshot={
                "bids": [
                    OrderBookLevel(price=66726.8, size=12.4, total=12.4),
                    OrderBookLevel(price=66726.7, size=9.8, total=22.2),
                ],
                "asks": [
                    OrderBookLevel(price=66727.1, size=11.1, total=11.1),
                    OrderBookLevel(price=66727.2, size=8.7, total=19.8),
                ],
            },
        )

    def _request(self, path: str, params: Dict[str, object]) -> Dict:
        self.rest_called = True
        return {"b": [], "a": []}


class FakeRecentTradeMarketClient(BybitPublicMarketClient):
    def _request(self, path: str, params: Dict[str, object]) -> Dict:
        self.assert_path = path
        self.assert_params = params
        return {
            "list": [
                {"T": "1711812900000", "S": "Buy", "p": "67705.9", "v": "0.752", "BT": False},
                {"T": "1711812840000", "S": "Sell", "p": "67701.1", "v": "1.204", "BT": True},
            ]
        }


class StaleCacheFallbackMarketClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")

    def get_ticker(self, symbol: str, market: str) -> Dict[str, Any]:  # noqa: ARG002
        raise RuntimeError("ticker refresh failed")

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> list[CandlePoint]:  # noqa: ARG002
        raise RuntimeError("candle refresh failed")

    def get_orderbook(self, symbol: str, market: str, limit: int = 8) -> Dict[str, Any]:  # noqa: ARG002
        raise RuntimeError("orderbook refresh failed")

    def _request(self, path: str, params: Dict[str, object]) -> Dict[str, Any]:  # noqa: ARG002
        raise RuntimeError("trade refresh failed")


class PartialRealtimeWatchlistFeed:
    def __init__(self) -> None:
        self.updated_symbols: list[str] = []

    def update_watchlist(self, watchlist: list[WatchlistInstrument]) -> None:
        self.updated_symbols = [item.symbol for item in watchlist]

    def enrich_watchlist(self, watchlist: list[WatchlistInstrument]) -> list[WatchlistInstrument]:
        enriched: list[WatchlistInstrument] = []
        for item in watchlist:
            if item.symbol == "BTCUSDT":
                enriched.append(
                    item.model_copy(
                        update={
                            "last_price": 70250.0,
                            "change_24h": 4.25,
                            "volume_24h": 999_000_000,
                        }
                    )
                )
            else:
                enriched.append(item)
        return enriched

    def has_ticker(self, symbol: str, market: Optional[str] = None) -> bool:  # noqa: ARG002
        return symbol == "BTCUSDT"


class PartialRealtimeWatchlistClient(BybitPublicMarketClient):
    def __init__(self) -> None:
        super().__init__(base_url="https://api.bybit.com")
        self.realtime = PartialRealtimeWatchlistFeed()
        self.rest_calls: list[str] = []

    def get_ticker(self, symbol: str, market: str) -> Dict[str, Any]:
        self.rest_calls.append(symbol)
        price_map = {
            "ETHUSDT": 2155.5,
            "SOLUSDT": 86.4,
        }
        change_map = {
            "ETHUSDT": 1.8,
            "SOLUSDT": -0.4,
        }
        volume_map = {
            "ETHUSDT": 555_000_000,
            "SOLUSDT": 222_000_000,
        }
        last_price = price_map.get(symbol, 100.0)
        return {
            "lastPrice": str(last_price),
            "price24hPcnt": str(change_map.get(symbol, 0.0) / 100.0),
            "turnover24h": str(volume_map.get(symbol, 0)),
            "volume24h": str(volume_map.get(symbol, 0)),
        }


class BybitPublicMarketClientUnitTests(unittest.TestCase):
    def test_candle_cache_ttl_is_timeframe_aware(self) -> None:
        client = BybitPublicMarketClient(base_url="https://api.bybit.com")

        self.assertEqual(client._candle_cache_ttl_for_timeframe("15m"), 1.0)
        self.assertEqual(client._candle_cache_ttl_for_timeframe("1h"), 2.0)
        self.assertEqual(client._candle_cache_ttl_for_timeframe("4h"), 3.0)
        self.assertEqual(client._candle_cache_ttl_for_timeframe("1d"), 4.0)
        self.assertEqual(client._candle_cache_ttl_for_timeframe("15m", history=True), 3.0)
        self.assertEqual(client._candle_cache_ttl_for_timeframe("1h", history=True), 4.0)
        self.assertEqual(client._candle_cache_ttl_for_timeframe("4h", history=True), 6.0)
        self.assertEqual(client._candle_cache_ttl_for_timeframe("1d", history=True), 8.0)

    def test_get_candles_cached_only_skips_stale_entries(self) -> None:
        client = BybitPublicMarketClient(base_url="https://api.bybit.com")
        stale_at = time.monotonic() - 30
        cached_candle = CandlePoint(
            time="2026-03-31T05:30:00+08:00",
            open=66_410,
            high=66_520,
            low=66_350,
            close=66_480,
            volume=1_800,
        )

        client._candle_history_cache[("BTCUSDT", "perp", "15m", 48)] = (stale_at, [cached_candle])  # type: ignore[attr-defined]
        client._candle_cache[("BTCUSDT", "perp", "15", 48)] = (stale_at, [cached_candle])  # type: ignore[attr-defined]

        self.assertEqual(client.get_candles_cached_only("BTCUSDT", "perp", timeframe="15m"), [])

    def test_probe_rest_connectivity_caches_latest_result(self) -> None:
        class ProbeConnectivityClient(BybitPublicMarketClient):
            def __init__(self) -> None:
                super().__init__(base_url="https://api.bybit.com")
                self.calls = 0

            def _request(self, path: str, params: Dict[str, object]) -> Dict[str, Any]:
                self.calls += 1
                assert path == "/v5/market/time"
                assert params == {}
                return {"timeSecond": "1775000000"}

        client = ProbeConnectivityClient()

        first = client.probe_rest_connectivity()
        second = client.probe_rest_connectivity()

        self.assertTrue(first["reachable"])
        self.assertIsNone(first["last_error"])
        self.assertEqual(client.calls, 1)
        self.assertEqual(first, second)

    def test_orderbook_prefers_realtime_snapshot(self) -> None:
        client = FakeRealtimeOrderbookPriorityClient()

        result = client.get_orderbook("BTCUSDT", "perp", limit=2)

        self.assertFalse(client.rest_called)
        self.assertEqual(len(result["bids"]), 2)
        self.assertEqual(result["bids"][0].price, 66726.8)
        self.assertEqual(result["asks"][0].price, 66727.1)

    def test_recent_public_trades_prefers_realtime_snapshot(self) -> None:
        client = FakeRealtimeTradePriorityClient()
        trades = client.get_recent_public_trades("BTCUSDT", "perp", limit=4)

        self.assertEqual(len(trades), 1)
        self.assertEqual(trades[0]["side"] if isinstance(trades[0], dict) else trades[0].side, "buy")
        self.assertFalse(client.rest_called)

    def test_recent_public_trades_supports_bybit_short_fields(self) -> None:
        client = FakeRecentTradeMarketClient(base_url="https://api.bybit.com")
        trades = client.get_recent_public_trades("BTCUSDT", "perp", limit=2)

        self.assertEqual(client.assert_path, "/v5/market/recent-trade")
        self.assertEqual(client.assert_params["category"], "linear")
        self.assertEqual(client.assert_params["limit"], 2)
        self.assertEqual(len(trades), 2)
        self.assertEqual(trades[0].side, "buy")
        self.assertEqual(trades[1].side, "sell")
        self.assertAlmostEqual(trades[0].value, 67705.9 * 0.752, places=4)
        self.assertTrue(trades[1].is_block_trade)

    def test_realtime_market_detail_reuses_ws_priority_for_non_hourly_timeframe(self) -> None:
        client = NonHourlyRealtimePriorityClient()
        item = WatchlistInstrument(
            symbol="BTCUSDT",
            market="perp",
            last_price=66_727.3,
            change_24h=1.2,
            volume_24h=1_000_000,
            signal="active",
            position_side="flat",
            risk_level="medium",
        )
        fallback_detail = build_market_detail_for_watchlist(item)

        detail = client.enrich_market_detail(
            symbol="BTCUSDT",
            market="perp",
            fallback_detail=fallback_detail,
            watch_item=item,
            timeframe="15m",
        )

        self.assertEqual(detail.source, "bybit_ws")
        self.assertFalse(client.rest_ticker_called)
        self.assertFalse(client.rest_orderbook_called)
        self.assertFalse(client.rest_trade_called)
        self.assertEqual(len(detail.candles), 3)
        self.assertAlmostEqual(detail.candles[-1].close, 66727.3)
        self.assertAlmostEqual(detail.recent_public_trades[0]["price"], 66727.3)
        self.assertAlmostEqual(detail.bids[0].price, 66726.8)
        self.assertAlmostEqual(detail.asks[0].price, 66727.1)

    def test_realtime_market_detail_skips_rest_refresh_when_disabled(self) -> None:
        client = NonHourlyRealtimePriorityClient()
        item = WatchlistInstrument(
            symbol="BTCUSDT",
            market="perp",
            last_price=66_727.3,
            change_24h=1.2,
            volume_24h=1_000_000,
            signal="active",
            position_side="flat",
            risk_level="medium",
        )
        fallback_detail = build_market_detail_for_watchlist(item)

        detail = client.enrich_market_detail(
            symbol="BTCUSDT",
            market="perp",
            fallback_detail=fallback_detail,
            watch_item=item,
            timeframe="15m",
            allow_rest_refresh=False,
        )

        self.assertEqual(detail.source, fallback_detail.source)
        self.assertFalse(client.rest_ticker_called)
        self.assertFalse(client.rest_orderbook_called)
        self.assertFalse(client.rest_trade_called)
        self.assertAlmostEqual(detail.recent_public_trades[0]["price"], 66727.3)
        self.assertAlmostEqual(detail.bids[0].price, 66726.8)
        self.assertAlmostEqual(detail.asks[0].price, 66727.1)
        self.assertEqual(detail.source, fallback_detail.source)
        self.assertEqual(detail.headline, fallback_detail.headline)
        self.assertEqual(len(detail.candles), len(fallback_detail.candles))

    def test_realtime_market_detail_uses_cached_snapshot_stats_when_rest_refresh_is_disabled(self) -> None:
        client = BybitPublicMarketClient(base_url="https://api.bybit.com")
        item = WatchlistInstrument(
            symbol="BTCUSDT",
            market="perp",
            last_price=66_727.3,
            change_24h=1.2,
            volume_24h=1_000_000,
            signal="active",
            position_side="flat",
            risk_level="medium",
        )
        fallback_detail = build_market_detail_for_watchlist(item)
        cached_at = time.monotonic()
        cached_ticker = {
            "lastPrice": "66727.3",
            "price24hPcnt": "0.018",
            "highPrice24h": "70000",
            "lowPrice24h": "65000",
            "fundingRate": "0.00025",
            "openInterestValue": "125000000",
        }
        cached_orderbook = {
            "bids": [OrderBookLevel(price=66726.8, size=12.4, total=12.4)],
            "asks": [OrderBookLevel(price=66727.1, size=11.1, total=11.1)],
        }
        cached_trades = [
            MarketRecentTrade(
                side="buy",
                price=66_727.3,
                size=0.42,
                value=28_025.466,
                occurred_at="2026-03-31T06:00:05+08:00",
                is_block_trade=False,
            )
        ]
        cached_candles = [
            CandlePoint(
                time="2026-03-31T05:30:00+08:00",
                open=66_410,
                high=66_520,
                low=66_350,
                close=66_480,
                volume=1_800,
            ),
            CandlePoint(
                time="2026-03-31T05:45:00+08:00",
                open=66_480,
                high=66_710,
                low=66_420,
                close=66_620,
                volume=1_950,
            ),
        ]
        client._set_cached_entry(  # type: ignore[attr-defined]
            client._ticker_cache,
            ("BTCUSDT", "perp"),
            (cached_at, cached_ticker),
            max_entries=client._ticker_cache_max_entries,
        )
        client._set_cached_entry(  # type: ignore[attr-defined]
            client._orderbook_cache,
            ("BTCUSDT", "perp", 8),
            (cached_at, cached_orderbook),
            max_entries=client._orderbook_cache_max_entries,
        )
        client._set_cached_entry(  # type: ignore[attr-defined]
            client._recent_trade_cache,
            ("BTCUSDT", "perp", 12),
            (cached_at, cached_trades),
            max_entries=client._recent_trade_cache_max_entries,
        )
        client._set_cached_entry(  # type: ignore[attr-defined]
            client._candle_cache,
            ("BTCUSDT", "perp", client.interval_for_timeframe("15m"), 48),
            (cached_at, cached_candles),
            max_entries=client._candle_cache_max_entries,
        )

        detail = client.enrich_market_detail(
            symbol="BTCUSDT",
            market="perp",
            fallback_detail=fallback_detail,
            watch_item=item,
            timeframe="15m",
            allow_rest_refresh=False,
        )

        self.assertEqual(detail.source, fallback_detail.source)
        self.assertEqual(detail.timeframe, "15m")
        self.assertEqual(detail.stats["数据源"], "本地快照")
        self.assertEqual(detail.stats["24h振幅"], "7.69%")
        self.assertEqual(detail.stats["资金费率"], "0.0250%")
        self.assertEqual(detail.stats["持仓价值"], "0.12B")
        self.assertEqual(detail.stats["24h高点"], "70,000.00")
        self.assertEqual(detail.stats["24h低点"], "65,000.00")
        self.assertEqual(detail.bids[0].price, 66_726.8)
        self.assertEqual(detail.asks[0].price, 66_727.1)
        self.assertEqual(detail.recent_public_trades[0].price, 66_727.3)
        self.assertEqual(len(detail.candles), len(cached_candles))
        self.assertEqual(detail.candles[-1].close, 66_620)

    def test_realtime_market_detail_keeps_ws_path_non_blocking_when_depth_snapshots_are_missing(self) -> None:
        client = RealtimeTickerOnlyMarketClient()
        item = WatchlistInstrument(
            symbol="BTCUSDT",
            market="perp",
            last_price=66_727.3,
            change_24h=1.2,
            volume_24h=1_000_000,
            signal="active",
            position_side="flat",
            risk_level="medium",
        )
        fallback_detail = build_market_detail_for_watchlist(item)

        detail = client.enrich_market_detail(
            symbol="BTCUSDT",
            market="perp",
            fallback_detail=fallback_detail,
            watch_item=item,
            timeframe="15m",
            allow_rest_refresh=True,
        )

        self.assertEqual(detail.source, "bybit_ws")
        self.assertFalse(client.rest_ticker_called)
        self.assertFalse(client.rest_orderbook_called)
        self.assertFalse(client.rest_trade_called)
        self.assertEqual(len(detail.candles), 3)
        self.assertEqual(detail.bids, fallback_detail.bids)
        self.assertEqual(detail.asks, fallback_detail.asks)

    def test_enrich_watchlist_fast_schedules_history_prime(self) -> None:
        client = RecordingHistoryPrimeMarketClient()
        watchlist = [
            WatchlistInstrument(
                symbol="BTCUSDT",
                market="perp",
                last_price=66_000,
                change_24h=0.8,
                volume_24h=1_100_000,
                signal="watch",
                position_side="flat",
                risk_level="medium",
            ),
            WatchlistInstrument(
                symbol="ETHUSDT",
                market="perp",
                last_price=3_200,
                change_24h=1.1,
                volume_24h=910_000,
                signal="watch",
                position_side="flat",
                risk_level="medium",
            ),
        ]

        client.enrich_watchlist_fast(watchlist)

        self.assertEqual(client.primed_symbols, ["BTCUSDT", "ETHUSDT"])

    def test_prime_watchlist_history_cache_populates_cached_timeframes(self) -> None:
        client = HistoryCachingPrimeMarketClient()
        watchlist = [
            WatchlistInstrument(
                symbol="BNBUSDT",
                market="perp",
                last_price=588.1,
                change_24h=0.6,
                volume_24h=178_420,
                signal="watch",
                position_side="flat",
                risk_level="medium",
            )
        ]

        client._prime_watchlist_history_cache(watchlist)

        self.assertEqual(
            client.history_calls,
            [
                ("BNBUSDT", "15m"),
                ("BNBUSDT", "1h"),
                ("BNBUSDT", "4h"),
                ("BNBUSDT", "1d"),
            ],
        )
        self.assertEqual(len(client.get_candles_cached_only("BNBUSDT", "perp", timeframe="1d")), 48)
        self.assertEqual(len(client.get_candles_cached_only("BNBUSDT", "perp", timeframe="15m")), 48)

    def test_realtime_market_detail_does_not_degrade_to_single_live_candle_when_history_fetch_fails(self) -> None:
        client = FailingRealtimeHistoryClient()
        fallback_detail = control_main.MarketDetail(
            symbol="BTCUSDT",
            market="perp",
            timeframe="15m",
            candles=[],
            bids=[],
            asks=[],
            recent_public_trades=[],
            headline="BTCUSDT 当前未拿到 Bybit 最新 K 线，请稍后自动重试。",
            stats={"数据源": "Bybit 实时拉取待恢复"},
            source="mock",
            updated_at=None,
        )

        detail = client.enrich_market_detail(
            symbol="BTCUSDT",
            market="perp",
            fallback_detail=fallback_detail,
            watch_item=None,
            timeframe="15m",
            allow_rest_refresh=True,
        )

        self.assertEqual(detail.source, fallback_detail.source)
        self.assertEqual(detail.candles, [])
        self.assertAlmostEqual(detail.recent_public_trades[0]["price"], 66727.3)
        self.assertAlmostEqual(detail.bids[0].price, 66726.8)
        self.assertAlmostEqual(detail.asks[0].price, 66727.1)

    def test_market_client_cached_helpers_fall_back_to_stale_cache_on_refresh_failure(self) -> None:
        client = StaleCacheFallbackMarketClient()
        expired_at = time.monotonic() - 30
        cached_candle = CandlePoint(
            time="2026-03-31T05:00:00+08:00",
            open=66_400,
            high=66_520,
            low=66_210,
            close=66_480,
            volume=1_800,
        )
        cached_trade = MarketRecentTrade(
            side="buy",
            price=66_480,
            size=0.25,
            value=16_620,
            occurred_at="2026-03-31T05:00:05+08:00",
            is_block_trade=False,
        )
        cached_orderbook = {
            "bids": [OrderBookLevel(price=66_470, size=12.4, total=12.4)],
            "asks": [OrderBookLevel(price=66_490, size=11.8, total=11.8)],
        }
        client._ticker_cache[("BTCUSDT", "perp")] = (expired_at, {"lastPrice": "66480"})  # type: ignore[attr-defined]
        client._candle_cache[("BTCUSDT", "perp", "15", 48)] = (expired_at, [cached_candle])  # type: ignore[attr-defined]
        client._orderbook_cache[("BTCUSDT", "perp", 8)] = (expired_at, cached_orderbook)  # type: ignore[attr-defined]
        client._recent_trade_cache[("BTCUSDT", "perp", 12)] = (expired_at, [cached_trade])  # type: ignore[attr-defined]

        ticker = client.get_ticker_cached("BTCUSDT", "perp")
        candles = client.get_candles_cached("BTCUSDT", "perp", timeframe="15m")
        orderbook = client.get_orderbook_cached("BTCUSDT", "perp", limit=8)
        trades = client.get_recent_public_trades("BTCUSDT", "perp", limit=12)

        self.assertEqual(ticker["lastPrice"], "66480")
        self.assertEqual(len(candles), 1)
        self.assertAlmostEqual(candles[0].close, 66_480)
        self.assertAlmostEqual(orderbook["bids"][0].price, 66_470)
        self.assertAlmostEqual(orderbook["asks"][0].price, 66_490)
        self.assertEqual(len(trades), 1)
        self.assertAlmostEqual(trades[0].price, 66_480)

    def test_realtime_market_detail_uses_rest_history_instead_of_stale_fallback(self) -> None:
        stale_item = WatchlistInstrument(
            symbol="BTCUSDT",
            market="perp",
            last_price=86_000,
            change_24h=1.2,
            volume_24h=1_000_000,
            signal="active",
            position_side="flat",
            risk_level="medium",
        )
        fallback_detail = build_market_detail_for_watchlist(stale_item)

        rest_candles = [
            CandlePoint(
                time="2026-03-31T04:00:00+08:00",
                open=66_400,
                high=66_520,
                low=66_210,
                close=66_480,
                volume=1_800,
            ),
            CandlePoint(
                time="2026-03-31T05:00:00+08:00",
                open=66_480,
                high=66_710,
                low=66_350,
                close=66_620,
                volume=1_950,
            ),
        ]
        live_candle = CandlePoint(
            time="2026-03-31T06:00:00+08:00",
            open=66_620,
            high=66_820,
            low=66_540,
            close=66_727.3,
            volume=1_075.993,
        )
        client = FakeRealtimeHistoryMarketClient(rest_candles=rest_candles, live_candle=live_candle)

        detail = client.enrich_market_detail(
            symbol="BTCUSDT",
            market="perp",
            fallback_detail=fallback_detail,
            watch_item=stale_item.model_copy(update={"last_price": 66_727.3}),
        )

        self.assertEqual(detail.source, "bybit_ws")
        self.assertEqual(len(detail.candles), 3)
        self.assertAlmostEqual(detail.candles[0].open, 66_400)
        self.assertAlmostEqual(detail.candles[-1].close, 66_727.3)
        self.assertTrue(all(candle.high < 70_000 for candle in detail.candles))
        self.assertIn("盘口价差", detail.stats)
        self.assertIn("Top5 买盘占比", detail.stats)

    def test_realtime_market_detail_uses_market_scoped_snapshot_for_same_symbol(self) -> None:
        client = MultiMarketRealtimeClient()
        spot_item = WatchlistInstrument(
            symbol="BTCUSDT",
            market="spot",
            last_price=102.5,
            change_24h=1.2,
            volume_24h=1_200_000,
            signal="watch",
            position_side="flat",
            risk_level="medium",
        )
        fallback_detail = build_market_detail_for_watchlist(spot_item)

        detail = client.enrich_market_detail(
            symbol="BTCUSDT",
            market="spot",
            fallback_detail=fallback_detail,
            watch_item=spot_item,
        )

        self.assertEqual(detail.source, "bybit_ws")
        self.assertAlmostEqual(detail.candles[-1].close, 102.5)
        self.assertEqual(detail.recent_public_trades[0]["price"], 102.5)
        self.assertEqual(detail.bids[0].price, 102.4)
        self.assertEqual(detail.asks[0].price, 102.6)

    def test_enrich_watchlist_keeps_rest_fallback_for_symbols_without_ws_ticker(self) -> None:
        client = PartialRealtimeWatchlistClient()
        watchlist = [
            WatchlistInstrument(
                symbol="BTCUSDT",
                market="perp",
                last_price=66000,
                change_24h=0.8,
                volume_24h=100,
                signal="neutral",
                position_side="flat",
                risk_level="low",
            ),
            WatchlistInstrument(
                symbol="ETHUSDT",
                market="perp",
                last_price=2000,
                change_24h=0.2,
                volume_24h=80,
                signal="neutral",
                position_side="flat",
                risk_level="low",
            ),
        ]

        enriched = client.enrich_watchlist(watchlist)

        self.assertEqual(client.realtime.updated_symbols, ["BTCUSDT", "ETHUSDT"])
        self.assertEqual(client.rest_calls, ["ETHUSDT"])
        self.assertEqual(enriched[0].last_price, 70250.0)
        self.assertEqual(enriched[1].last_price, 2155.5)
        self.assertEqual(enriched[1].change_24h, 1.8)

    def test_enrich_watchlist_keeps_rest_fallback_for_symbols_without_ws_ticker(self) -> None:
        client = PartialRealtimeWatchlistClient()
        watchlist = [
            WatchlistInstrument(
                symbol="BTCUSDT",
                market="perp",
                last_price=66000,
                change_24h=0.8,
                volume_24h=100,
                signal="neutral",
                position_side="flat",
                risk_level="low",
            ),
            WatchlistInstrument(
                symbol="ETHUSDT",
                market="perp",
                last_price=2000,
                change_24h=0.2,
                volume_24h=80,
                signal="neutral",
                position_side="flat",
                risk_level="low",
            ),
        ]

        enriched = client.enrich_watchlist(watchlist)

        self.assertEqual(client.realtime.updated_symbols, ["BTCUSDT", "ETHUSDT"])
        self.assertEqual(client.rest_calls, ["ETHUSDT"])
        self.assertEqual(enriched[0].last_price, 70250.0)
        self.assertEqual(enriched[1].last_price, 2155.5)
        self.assertEqual(enriched[1].change_24h, 1.8)


class BybitPrivateClientUnitTests(unittest.TestCase):
    def test_fetch_usdt_balance_diagnostics_reads_nested_balance_payload(self) -> None:
        test_case = self

        class StubNestedBalanceClient(BybitPrivateClient):
            def _signed_get(self, path: str, params: Dict[str, object]) -> Dict[str, Any]:
                test_case.assertEqual(path, "/v5/asset/transfer/query-account-coin-balance")
                account_type = str(params.get("accountType"))
                payloads = {
                    "UNIFIED": {
                        "accountType": "UNIFIED",
                        "balance": {"coin": "USDT", "walletBalance": "0", "transferBalance": "0"},
                    },
                    "FUND": {
                        "accountType": "FUND",
                        "balance": {"coin": "USDT", "walletBalance": "20", "transferBalance": "20"},
                    },
                    "CONTRACT": {
                        "accountType": "CONTRACT",
                        "balance": {"coin": "USDT", "walletBalance": "0", "transferBalance": "0"},
                    },
                }
                return payloads[account_type]

        diagnostics = StubNestedBalanceClient().fetch_usdt_balance_diagnostics()

        self.assertEqual(len(diagnostics), 3)
        self.assertEqual(diagnostics[1]["account_type"], "FUND")
        self.assertEqual(diagnostics[1]["wallet_balance"], "20")
        self.assertEqual(diagnostics[1]["transfer_balance"], "20")
        self.assertEqual(diagnostics[1]["available_balance"], "20")

    def test_fetch_positions_ignores_optional_spot_error_without_polluting_last_error(self) -> None:
        class StubOptionalSpotErrorClient(BybitPrivateClient):
            def _signed_get(self, path: str, params: Dict[str, object]) -> Dict[str, Any]:
                self._last_error = None
                if str(params.get("category")) == "linear":
                    return {"list": [{"symbol": "BTCUSDT", "side": "Buy"}]}
                self._last_error = "category only support linear or option"
                raise RuntimeError(self._last_error)

        client = StubOptionalSpotErrorClient()

        positions = client.fetch_positions()

        self.assertEqual(positions, [{"symbol": "BTCUSDT", "side": "Buy"}])
        self.assertIsNone(client.get_status().last_error)

    def test_fetch_usdt_balance_diagnostics_preserves_last_error_on_optional_account_probe_failure(self) -> None:
        class StubBalanceDiagnosticErrorClient(BybitPrivateClient):
            def _signed_get(self, path: str, params: Dict[str, object]) -> Dict[str, Any]:
                account_type = str(params.get("accountType"))
                if account_type == "UNIFIED":
                    self._last_error = None
                    return {
                        "accountType": "UNIFIED",
                        "balance": {"coin": "USDT", "walletBalance": "20", "transferBalance": "20"},
                    }
                self._last_error = f"{account_type} unavailable"
                raise RuntimeError(self._last_error)

        client = StubBalanceDiagnosticErrorClient()

        diagnostics = client.fetch_usdt_balance_diagnostics()

        self.assertEqual(diagnostics[0]["account_type"], "UNIFIED")
        self.assertEqual(diagnostics[0]["available_balance"], "20")
        self.assertEqual(diagnostics[1]["error"], "FUND unavailable")
        self.assertEqual(diagnostics[2]["error"], "CONTRACT unavailable")
        self.assertIsNone(client.get_status().last_error)


class ReviewParsingUnitTests(unittest.TestCase):
    def test_build_agent_job_prompt_includes_execution_health_context(self) -> None:
        original_running = control_main.strategy_runtime_state.get("running")
        original_last_refresh = control_main.strategy_runtime_state.get("last_refresh_at")
        original_last_error = control_main.strategy_runtime_state.get("last_error")
        original_started_once = control_main.strategy_runtime_state.get("started_once")
        try:
            control_main.strategy_runtime_state.update(
                {
                    "running": False,
                    "last_refresh_at": None,
                    "last_error": "runtime boom",
                    "started_once": True,
                }
            )
            prompt = control_main.build_agent_job_prompt(
                "generate_daily_review",
                {"focus_symbols": ["BTCUSDT"], "mode": "live"},
            )
            self.assertIn("执行健康：", prompt)
            self.assertIn("运行线程异常", prompt)
            self.assertIn("execution_top_issue_detail", prompt)
        finally:
            control_main.strategy_runtime_state.update(
                {
                    "running": original_running,
                    "last_refresh_at": original_last_refresh,
                    "last_error": original_last_error,
                    "started_once": original_started_once,
                }
            )

    def test_enrich_review_job_context_includes_strategy_activity(self) -> None:
        original_market = control_main.market_data
        candles = [
            CandlePoint(
                time=f"2026-03-30T{hour:02d}:00:00+08:00",
                open=3520.0 + hour * 2,
                high=3530.0 + hour * 2,
                low=3510.0 + hour * 2,
                close=3525.0 + hour * 2,
                volume=1200.0 + hour * 10,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=3568.0,
            change_24h=1.8,
            candles=candles,
        )
        self.addCleanup(setattr, control_main, "market_data", original_market)
        context = control_main.enrich_review_job_context(
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "paper",
            }
        )
        activity = context.get("review_strategy_activity")
        self.assertIsInstance(activity, dict)
        self.assertEqual(activity["strategy_id"], "eth-revert-02")
        self.assertEqual(activity["strategy_name"], "ETH 均值回归")
        self.assertIsInstance(activity.get("runtime"), dict)
        self.assertIn("next_action", activity["runtime"])
        self.assertIn("recent_alerts", activity)
        self.assertIn("recent_audit_events", activity)

    def test_enrich_review_job_context_includes_strategy_execution_preview_summary(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        original_selected_mode = control_main.repo.state.workspace_preferences.selected_mode
        original_scheduler_mode = control_main.repo.state.control_snapshot.scheduler.current_mode
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "20",
                "totalWalletBalance": "20",
                "totalAvailableBalance": "20",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "20",
                        "availableToWithdraw": "20",
                    }
                ],
            },
            connected=True,
            authenticated=True,
        )

        def tiny_balance_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": 0.015,
                "price": 68450.0,
                "note": "tiny balance preview",
            }

        control_main.repo.get_strategy_signal_order_hint = tiny_balance_hint  # type: ignore[method-assign]
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))
        self.addCleanup(
            lambda: setattr(
                control_main.repo.state.workspace_preferences,
                "selected_mode",
                original_selected_mode,
            )
        )
        self.addCleanup(
            lambda: setattr(
                control_main.repo.state.control_snapshot.scheduler,
                "current_mode",
                original_scheduler_mode,
            )
        )

        context = control_main.enrich_review_job_context(
            {
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "live",
            }
        )
        activity = context.get("review_strategy_activity")
        self.assertIsInstance(activity, dict)
        assert isinstance(activity, dict)
        runtime = activity.get("runtime")
        self.assertIsInstance(runtime, dict)
        assert isinstance(runtime, dict)
        self.assertEqual(runtime["guard_state"], "auto_dispatch_blocked")
        self.assertIn("risk_budget 18%", runtime["next_action"])
        preview = runtime.get("execution_preview")
        self.assertIsInstance(preview, dict)
        assert isinstance(preview, dict)
        self.assertEqual(preview["mode"], "live")
        self.assertFalse(preview["allowed"])
        self.assertIn("当前 Bybit 可用余额 20.00 USDT", preview["blocked_reason"])
        self.assertEqual(preview["sizing_risk_budget"], "18%")
        self.assertEqual(preview["sizing_budget_notional"], "3.60 USDT")
        self.assertEqual(preview["sizing_minimum_required_notional"], "68.45 USDT")
        self.assertEqual(preview["sizing_available_balance_gap"], "360.28 USDT")

        prompt = control_main.build_agent_job_prompt(
            "review_strategy_issue",
            {
                "issue_type": "manual_execution_blocked",
                "summary": "BTCUSDT 手动策略执行被拦截",
                "detail": "账户余额不足，需补齐最小下单门槛。",
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "live",
            },
        )
        self.assertIn('"execution_preview"', prompt)
        self.assertIn('"sizing_available_balance_gap": "360.28 USDT"', prompt)

    def test_build_backtest_review_prompt_includes_strategy_activity_context(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "source_change_request_id": "cr-parent-001",
                "source_backtest_id": "bt-parent-001",
                "source_review_id": "review-parent-001",
                "source_proposal_id": "prop-parent-001",
                "trigger_reason": "decision_rerun",
                "mode": "paper",
                "focus_symbols": ["ETHUSDT"],
                "timeframe": "1h",
                "data_range": "最近 90 天",
                "reference_only": True,
                "requested_candle_estimate": 2165,
                "requested_candle_limit": 600,
                "requested_range_start": "2026-01-02T00:00:00+08:00",
                "requested_range_end": "2026-04-02T00:00:00+08:00",
                "retrieved_window_completion_pct": 27.71,
                "used_window_completion_pct": 27.71,
                "retrieved_candle_count": 600,
                "used_candle_count": 600,
                "history_truncated": True,
                "metrics": {"annual_return": "+8.2%", "max_drawdown": "-2.4%"},
                "parameter_snapshot": {"entry_z": 2.1},
                "review_strategy_activity": {
                    "strategy_id": "eth-revert-02",
                    "strategy_name": "ETH 均值回归",
                    "symbol": "ETHUSDT",
                    "mode": "paper",
                    "generated_at": "2026-04-02T00:00:00+08:00",
                    "runtime": {
                        "signal": "watch",
                        "guard_state": "none",
                        "guard_detail": None,
                        "note": "继续观察。",
                        "next_action": "等待下一次信号。",
                        "position_alignment": "unknown",
                        "position_alignment_detail": None,
                        "last_execution_event_type": None,
                        "execution_preview": None,
                    },
                    "active_order_count": 0,
                    "active_orders": [],
                    "recent_orders": [],
                    "recent_trades": [],
                    "recent_alerts": [],
                    "recent_audit_events": ["strategy.runtime.refreshed · quant-core"],
                },
            },
        )
        self.assertIn("策略最近活动：", prompt)
        self.assertIn('"strategy_id": "eth-revert-02"', prompt)
        self.assertIn('"recent_audit_events"', prompt)
        self.assertIn("来源链路：触发原因=decision_rerun；来源变更=cr-parent-001；来源回测=bt-parent-001；来源复盘=review-parent-001；来源提案=prop-parent-001", prompt)
        self.assertIn("样本性质：仅参考路径（未命中真实入场信号）", prompt)
        self.assertIn("当前没有真实成交样本", prompt)
        self.assertIn("优先只给 backtest_request", prompt)
        self.assertIn("1d->4h、4h->1h、1h->15m", prompt)
        self.assertIn("理论需要 2165 根", prompt)
        self.assertIn("当前上限 600 根", prompt)
        self.assertIn("请求窗口：2026-01-02T00:00:00+08:00 -> 2026-04-02T00:00:00+08:00", prompt)
        self.assertIn("窗口覆盖：取样 27.71% · 回测 27.71%", prompt)
        self.assertIn("样本覆盖：", prompt)
        self.assertIn("截断状态 是", prompt)
        self.assertIn("切换到能覆盖完整区间的更粗周期", prompt)

    def test_build_backtest_review_prompt_marks_uncoverable_truncated_window(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "paper",
                "focus_symbols": ["ETHUSDT"],
                "timeframe": "1d",
                "data_range": "最近 30000 天",
                "requested_candle_estimate": 30005,
                "requested_candle_limit": 20000,
                "retrieved_candle_count": 20000,
                "used_candle_count": 20000,
                "history_truncated": True,
                "metrics": {"annual_return": "+8.2%", "max_drawdown": "-2.4%", "trades": 12},
                "parameter_snapshot": {"entry_z": 2.1},
            },
        )
        self.assertIn("当前请求区间即使切到最粗周期也无法完整覆盖", prompt)
        self.assertIn("优先缩短 data_range 到可完整覆盖的窗口", prompt)
        self.assertIn("最近 19995 天 @ 1d", prompt)

    def test_build_backtest_review_prompt_marks_insufficient_history_window(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "paper",
                "focus_symbols": ["ETHUSDT"],
                "timeframe": "1d",
                "data_range": "最近 90 天",
                "requested_candle_estimate": 95,
                "requested_candle_limit": 95,
                "requested_range_start": "2025-10-03T00:00:00+00:00",
                "requested_range_end": "2026-01-01T00:00:00+00:00",
                "retrieved_window_completion_pct": 63.16,
                "used_window_completion_pct": 63.16,
                "retrieved_candle_count": 60,
                "used_candle_count": 60,
                "retrieved_range_start": "2025-11-03T00:00:00+00:00",
                "retrieved_range_end": "2026-01-01T00:00:00+00:00",
                "used_range_start": "2025-11-03T00:00:00+00:00",
                "used_range_end": "2026-01-01T00:00:00+00:00",
                "history_truncated": True,
                "history_gap_reason": "insufficient_history",
                "full_window_recommended_data_range": "2025-11-03 ~ 2026-01-01",
                "full_window_recommended_timeframe": "1d",
                "full_window_recommended_action": "当前交易所可用历史仅覆盖 2025-11-03 ~ 2026-01-01，建议先缩短到该可用区间并保持 1d 重新回测。",
                "metrics": {"annual_return": "+8.2%", "max_drawdown": "-2.4%", "trades": 12},
                "parameter_snapshot": {"entry_z": 2.1},
            },
        )
        self.assertIn("请求窗口：2025-10-03T00:00:00+00:00 -> 2026-01-01T00:00:00+00:00", prompt)
        self.assertIn("窗口覆盖：取样 63.16% · 回测 63.16%", prompt)
        self.assertIn("样本覆盖：取到 2025-11-03T00:00:00+00:00 -> 2026-01-01T00:00:00+00:00", prompt)
        self.assertIn("交易所当前可用历史不够", prompt)
        self.assertIn("优先缩短 data_range 到当前已取到的历史范围", prompt)

    def test_build_backtest_review_prompt_marks_market_detail_fallback_source(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "paper",
                "focus_symbols": ["ETHUSDT"],
                "timeframe": "1h",
                "data_range": "最近 90 天",
                "history_source": "market_detail_fallback",
                "history_source_reason": "exchange_fetch_failed",
                "history_source_detail": "Bybit history api unavailable",
                "requested_range_start": "2026-01-02T00:00:00+08:00",
                "requested_range_end": "2026-04-02T00:00:00+08:00",
                "retrieved_window_completion_pct": 100.0,
                "used_window_completion_pct": 100.0,
                "requested_candle_estimate": 2165,
                "requested_candle_limit": 2165,
                "retrieved_candle_count": 2165,
                "used_candle_count": 2165,
                "metrics": {"annual_return": "+8.2%", "max_drawdown": "-2.4%", "trades": 12},
                "parameter_snapshot": {"entry_z": 2.1},
            },
        )
        self.assertIn("样本来源：行情快照回退（历史拉取报错）", prompt)
        self.assertIn("来源细节：Bybit history api unavailable", prompt)
        self.assertIn("来源建议：请先恢复交易所历史 K 线拉取，再按当前区间 最近 90 天 和周期 1h 重跑。", prompt)
        self.assertIn("结论门禁：仅供研究参考", prompt)
        self.assertIn("门禁详情：当前交易所历史拉取仍未恢复", prompt)
        self.assertIn("门禁重跑：最近 90 天 @ 1h", prompt)
        self.assertIn("门禁建议：请先恢复交易所历史 K 线拉取", prompt)
        self.assertIn("仅适合研究排障", prompt)
        self.assertIn("优先建议恢复交易所历史后重跑", prompt)

    def test_build_backtest_review_prompt_uses_structured_full_window_recommendation(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "paper",
                "focus_symbols": ["ETHUSDT"],
                "timeframe": "1h",
                "data_range": "最近 180 天",
                "requested_candle_estimate": 4325,
                "requested_candle_limit": 600,
                "retrieved_candle_count": 600,
                "used_candle_count": 600,
                "history_truncated": True,
                "full_window_recommended_data_range": "最近 180 天",
                "full_window_recommended_timeframe": "1d",
                "full_window_recommended_action": "保持当前区间，切换到 1d 补足完整样本窗口。",
                "metrics": {"annual_return": "+8.2%", "max_drawdown": "-2.4%", "trades": 12},
                "parameter_snapshot": {"entry_z": 2.1},
            },
        )
        self.assertIn("建议动作：保持当前区间，切换到 1d 补足完整样本窗口。", prompt)
        self.assertIn("门禁重跑：最近 180 天 @ 1d", prompt)
        self.assertIn("门禁建议：保持当前区间，切换到 1d 补足完整样本窗口。", prompt)

    def test_build_backtest_review_prompt_marks_low_sample_real_trades(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "paper",
                "focus_symbols": ["ETHUSDT"],
                "timeframe": "1h",
                "data_range": "最近 90 天",
                "metrics": {
                    "annual_return": "+8.2%",
                    "max_drawdown": "-2.4%",
                    "win_rate": "66.7%",
                    "trades": 2,
                },
                "parameter_snapshot": {"entry_z": 2.1},
            },
        )
        self.assertIn("样本性质：低样本真实成交（仅 2 笔）", prompt)
        self.assertIn("样本量偏小", prompt)
        self.assertIn("优先只给 backtest_request", prompt)
        self.assertIn("1d->4h、4h->1h、1h->15m", prompt)

    def test_build_backtest_review_prompt_does_not_pull_live_health_when_context_is_sparse(self) -> None:
        original_health = control_main.build_review_health_context
        original_activity = control_main._build_strategy_activity_review_context

        def _raise_if_called() -> Dict[str, Any]:
            raise AssertionError("should not fetch live review context")

        control_main.build_review_health_context = _raise_if_called
        control_main._build_strategy_activity_review_context = _raise_if_called
        self.addCleanup(setattr, control_main, "build_review_health_context", original_health)
        self.addCleanup(setattr, control_main, "_build_strategy_activity_review_context", original_activity)

        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "paper",
                "focus_symbols": ["ETHUSDT"],
                "timeframe": "1h",
                "data_range": "最近 90 天",
                "metrics": {"annual_return": "+8.2%", "max_drawdown": "-2.4%", "trades": 2},
                "parameter_snapshot": {"entry_z": 2.1},
            },
        )
        self.assertIn("策略最近活动：", prompt)

    def test_build_strategy_change_review_prompt_includes_strategy_activity_context(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "review_strategy_change",
            {
                "change_type": "strategy.parameter.update",
                "summary": "更新 ETH 均值回归参数",
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "target_mode": "paper",
                "review_strategy_activity": {
                    "strategy_id": "eth-revert-02",
                    "strategy_name": "ETH 均值回归",
                    "active_order_count": 1,
                    "recent_alerts": ["P2 ETH 风险提示"],
                },
            },
        )
        self.assertIn("策略最近活动：", prompt)
        self.assertIn('"strategy_id": "eth-revert-02"', prompt)
        self.assertIn('"active_order_count"', prompt)

    def test_build_strategy_issue_review_prompt_includes_strategy_activity_context(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "review_strategy_issue",
            {
                "issue_type": "manual_execution_blocked",
                "summary": "BTCUSDT 手动策略执行被拦截",
                "detail": "运行线程异常，建议先恢复运行线程。",
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "mode": "live",
                "review_strategy_activity": {
                    "strategy_id": "eth-revert-02",
                    "strategy_name": "ETH 均值回归",
                    "recent_alerts": ["P1 执行受阻"],
                    "recent_audit_events": ["strategy.execution.blocked · desktop-control"],
                },
            },
        )
        self.assertIn("策略最近活动：", prompt)
        self.assertIn('"strategy_id": "eth-revert-02"', prompt)
        self.assertIn('"recent_alerts"', prompt)

    def test_build_agent_job_prompt_handles_summarize_execution_impact(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "summarize_execution_impact",
            {
                "strategy_id": "eth-revert-02",
                "strategy_name": "ETH 均值回归",
                "window_start": "2026-04-18T00:00:00+08:00",
                "window_end": "2026-04-19T00:00:00+08:00",
                "order_count": 42,
                "fill_count": 37,
                "total_notional": "125000.50",
                "slippage_bps": "4.2",
                "expected_pnl": "+320.10",
                "realized_pnl": "+285.64",
                "anomalies": [
                    {"type": "partial_fill_spike", "detail": "ETHUSDT 单笔低于 50% 成交"},
                ],
            },
        )
        self.assertIn("执行质量综述", prompt)
        self.assertIn("ETH 均值回归", prompt)
        self.assertIn("订单总数：42", prompt)
        self.assertIn("impact_level", prompt)
        self.assertIn("follow_up_checks", prompt)

    def test_build_agent_job_prompt_summarize_execution_impact_handles_missing_fields(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "summarize_execution_impact",
            {"strategy_id": "eth-revert-02"},
        )
        self.assertIn("未提供", prompt)

    def test_parse_review_text_supports_json_payload(self) -> None:
        parsed = control_main.parse_review_text(
            json.dumps(
                {
                    "summary": "BTC 趋势维持强势，建议补充短周期验证。",
                    "highlights": ["收益质量稳定", "滑点表现可控"],
                    "risks": ["ETH 回撤扩大"],
                    "proposals": [
                        {
                            "proposal_type": "backtest_request",
                            "title": "补跑 15m 样本",
                            "description": "验证短周期稳定性。",
                            "expected_impact": "降低过拟合风险。",
                            "payload": {"data_range": "最近 45 天", "timeframe": "15m"},
                        }
                    ],
                },
                ensure_ascii=False,
            )
        )

        self.assertEqual(parsed["summary"], "BTC 趋势维持强势，建议补充短周期验证。")
        self.assertEqual(parsed["highlights"], ["收益质量稳定", "滑点表现可控"])
        self.assertEqual(parsed["risks"], ["ETH 回撤扩大"])
        self.assertEqual(len(parsed["proposals"]), 1)

    def test_build_review_document_merges_json_proposals_with_heuristics(self) -> None:
        text = json.dumps(
            {
                "summary": "SOL 回测收益较强，但回撤仍需控制。",
                "highlights": ["年化收益抬升", "胜率维持在高位"],
                "risks": ["最大回撤偏高"],
                "proposals": [
                    {
                        "proposal_type": "param_update",
                        "title": "下调止损阈值",
                        "description": "将止损收紧到 1.1%。",
                        "expected_impact": "压缩回撤尖峰。",
                        "payload": {"stop_loss_pct": 1.1},
                    }
                ],
            },
            ensure_ascii=False,
        )
        context = {
            "strategy_id": "sol-breakout-01",
            "strategy_name": "SOL 突破增强",
            "mode": "paper",
            "timeframe": "1h",
            "metrics": {
                "annual_return": "+24.8%",
                "max_drawdown": "-6.3%",
                "win_rate": "61.2%",
                "trades": 6,
            },
        }

        review = control_main.build_review_document_from_text(
            text=text,
            context=context,
            source="openclaw",
            job_type="generate_backtest_review",
        )

        proposal_types = {proposal.proposal_type for proposal in review.proposals}
        self.assertIn("param_update", proposal_types)
        self.assertIn("risk_update", proposal_types)
        parsed_param = next((proposal for proposal in review.proposals if proposal.proposal_type == "param_update"), None)
        self.assertIsNotNone(parsed_param)
        assert parsed_param is not None
        self.assertEqual(parsed_param.payload["target_mode"], "paper")
        self.assertEqual(parsed_param.strategy_id, "sol-breakout-01")

    def test_build_review_document_skips_backtest_heuristics_when_no_real_trades(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "本次区间未命中真实入场信号。",
                    "highlights": ["参考路径收益较强"],
                    "risks": ["参考路径回撤偏高"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "backtest_id": "bt-reference-001",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "reference_only": True,
                "data_range": "最近 90 天",
                "timeframe": "1h",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "100.0%",
                    "trades": 0,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.backtest_id, "bt-reference-001")
        self.assertEqual(review.decision_readiness, "research_only")
        self.assertEqual(review.decision_recommended_data_range, "最近 180 天")
        self.assertEqual(review.decision_recommended_timeframe, "1h")
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "BTC 趋势跟随 扩大样本验证")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertTrue(any("未命中真实入场信号" in item for item in review.risks))

    def test_build_review_document_preserves_backtest_lineage_fields(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "本轮回测需要继续补样本。",
                    "highlights": ["收益暂时稳定"],
                    "risks": ["样本窗口仍需补齐"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "backtest_id": "bt-child-001",
                "source_change_request_id": "cr-parent-001",
                "source_backtest_id": "bt-parent-001",
                "source_review_id": "review-parent-001",
                "source_proposal_id": "prop-parent-001",
                "trigger_reason": "proposal_accept",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "61.2%",
                    "trades": 6,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(review.backtest_id, "bt-child-001")
        self.assertEqual(review.source_change_request_id, "cr-parent-001")
        self.assertEqual(review.source_backtest_id, "bt-parent-001")
        self.assertEqual(review.source_review_id, "review-parent-001")
        self.assertEqual(review.source_proposal_id, "prop-parent-001")
        self.assertEqual(review.trigger_reason, "proposal_accept")

    def test_build_review_document_skips_backtest_heuristics_when_trade_count_is_low(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "样本量偏少，但收益表现暂时不错。",
                    "highlights": ["已有少量真实成交"],
                    "risks": ["样本量偏少"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "100.0%",
                    "trades": 2,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "BTC 趋势跟随 扩大样本验证")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertTrue(any("样本量偏小" in item for item in review.risks))

    def test_build_review_document_uses_full_window_backtest_request_when_history_is_truncated(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本窗口被截断，但收益表现暂时不错。",
                    "highlights": ["回撤可控"],
                    "risks": ["样本窗口未完整覆盖"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "data_range": "最近 180 天",
                "history_truncated": True,
                "requested_candle_estimate": 4325,
                "requested_candle_limit": 600,
                "retrieved_candle_count": 600,
                "used_candle_count": 600,
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-3.2%",
                    "win_rate": "61.0%",
                    "trades": 12,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "BTC 趋势跟随 补足完整样本窗口")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "4h")
        self.assertTrue(any("样本窗口提示" in item for item in review.risks))

    def test_build_review_document_preserves_safe_backtest_request_when_history_is_truncated(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本窗口被截断。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本窗口未完整覆盖"],
                    "proposals": [
                        {
                            "proposal_type": "backtest_request",
                            "title": "改跑 1d 覆盖完整区间",
                            "description": "保持最近 180 天，切到 1d 补足完整样本窗口。",
                            "expected_impact": "先获得完整时间覆盖，再判断收益质量。",
                            "payload": {"data_range": "最近 180 天", "timeframe": "1d"},
                        },
                        {
                            "proposal_type": "risk_update",
                            "title": "提高风险预算",
                            "description": "继续放大仓位。",
                            "expected_impact": "追求更高收益。",
                            "payload": {"risk_budget": "24%"},
                        },
                    ],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "data_range": "最近 180 天",
                "history_truncated": True,
                "requested_candle_estimate": 4325,
                "requested_candle_limit": 600,
                "retrieved_candle_count": 600,
                "used_candle_count": 600,
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-3.2%",
                    "win_rate": "61.0%",
                    "trades": 12,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "改跑 1d 覆盖完整区间")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1d")

    def test_build_review_document_rejects_shorter_range_backtest_request_when_history_is_truncated(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本窗口被截断。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本窗口未完整覆盖"],
                    "proposals": [
                        {
                            "proposal_type": "backtest_request",
                            "title": "缩短区间后重跑",
                            "description": "改成最近 45 天的 1d 回测。",
                            "expected_impact": "尽快获得完整样本。",
                            "payload": {"data_range": "最近 45 天", "timeframe": "1d"},
                        }
                    ],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "data_range": "最近 180 天",
                "history_truncated": True,
                "requested_candle_estimate": 4325,
                "requested_candle_limit": 600,
                "retrieved_candle_count": 600,
                "used_candle_count": 600,
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-3.2%",
                    "win_rate": "61.0%",
                    "trades": 12,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "BTC 趋势跟随 补足完整样本窗口")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "4h")

    def test_build_review_document_uses_shorter_range_request_when_truncated_window_is_still_uncoverable(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本窗口被截断。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本窗口未完整覆盖"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1d",
                "data_range": "最近 30000 天",
                "history_truncated": True,
                "requested_candle_estimate": 30005,
                "requested_candle_limit": 20000,
                "retrieved_candle_count": 20000,
                "used_candle_count": 20000,
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-3.2%",
                    "win_rate": "61.0%",
                    "trades": 12,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "BTC 趋势跟随 缩短区间以补足样本窗口")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 19995 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1d")
        self.assertTrue(any("即使切到最粗周期" in item for item in review.risks))

    def test_build_review_document_preserves_safe_shorter_range_request_when_truncated_window_is_still_uncoverable(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本窗口被截断。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本窗口未完整覆盖"],
                    "proposals": [
                        {
                            "proposal_type": "backtest_request",
                            "title": "缩短到最近 19995 天",
                            "description": "保持 1d，把区间缩短到最近 19995 天。",
                            "expected_impact": "先拿到完整样本窗口。",
                            "payload": {"data_range": "最近 19995 天", "timeframe": "1d"},
                        },
                        {
                            "proposal_type": "risk_update",
                            "title": "提高风险预算",
                            "description": "继续放大仓位。",
                            "expected_impact": "追求更高收益。",
                            "payload": {"risk_budget": "24%"},
                        },
                    ],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1d",
                "data_range": "最近 30000 天",
                "history_truncated": True,
                "requested_candle_estimate": 30005,
                "requested_candle_limit": 20000,
                "retrieved_candle_count": 20000,
                "used_candle_count": 20000,
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-3.2%",
                    "win_rate": "61.0%",
                    "trades": 12,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "缩短到最近 19995 天")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 19995 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1d")

    def test_build_review_document_preserves_safe_backtest_request_when_reference_only(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "本次区间未命中真实入场信号。",
                    "highlights": ["参考路径收益较强"],
                    "risks": ["参考路径回撤偏高"],
                    "proposals": [
                        {
                            "proposal_type": "backtest_request",
                            "title": "补跑更细粒度样本",
                            "description": "改跑 15m 验证更多真实触发。",
                            "expected_impact": "更快补足真实样本。",
                            "payload": {"data_range": "最近 180 天", "timeframe": "15m"},
                        },
                        {
                            "proposal_type": "risk_update",
                            "title": "压缩风险预算",
                            "description": "将风险预算降到 8%。",
                            "expected_impact": "快速压缩回撤。",
                            "payload": {"risk_budget": "8%"},
                        },
                        {
                            "proposal_type": "publish_recommendation",
                            "title": "建议灰度发布",
                            "description": "可尝试小流量发布。",
                            "expected_impact": "验证线上效果。",
                            "payload": {"publish_scope": "canary"},
                        },
                    ],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "reference_only": True,
                "timeframe": "1h",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "0.0%",
                    "trades": 0,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "补跑更细粒度样本")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "15m")

    def test_build_review_document_filters_aggressive_parsed_proposals_when_low_sample(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本量偏少。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本量偏少"],
                    "proposals": [
                        {
                            "proposal_type": "backtest_request",
                            "title": "补跑同区间样本",
                            "description": "继续补样本。",
                            "expected_impact": "验证稳定性。",
                            "payload": {"data_range": "最近 180 天", "timeframe": "4h"},
                        },
                        {
                            "proposal_type": "param_update",
                            "title": "收紧止损",
                            "description": "把止损阈值调到 0.8%。",
                            "expected_impact": "降低最大回撤。",
                            "payload": {"stop_loss_pct": 0.8},
                        },
                        {
                            "proposal_type": "script_patch_proposal",
                            "title": "优化下单脚本",
                            "description": "增加更激进的追单逻辑。",
                            "expected_impact": "提升成交效率。",
                            "payload": {"summary": "raise aggressiveness"},
                        },
                    ],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "4h",
                "data_range": "最近 180 天",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "50.0%",
                    "trades": 2,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].title, "BTC 趋势跟随 扩大样本验证")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1h")

    def test_build_review_document_filters_aggressive_parsed_proposals_when_history_source_is_fallback(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前结果不错。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["等待更多确认"],
                    "proposals": [
                        {
                            "proposal_type": "backtest_request",
                            "title": "恢复后重跑",
                            "description": "恢复交易所历史后重跑。",
                            "expected_impact": "拿到正式样本。",
                            "payload": {"data_range": "最近 90 天", "timeframe": "1h"},
                        },
                        {
                            "proposal_type": "risk_update",
                            "title": "提高风险预算",
                            "description": "把风险预算提高到 25%。",
                            "expected_impact": "提升收益。",
                            "payload": {"risk_budget": "25%"},
                        },
                    ],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "data_range": "最近 90 天",
                "history_source": "market_detail_fallback",
                "history_source_reason": "exchange_fetch_failed",
                "history_source_detail": "Bybit history api unavailable",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "58.0%",
                    "trades": 12,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 90 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1h")
        self.assertTrue(any("行情快照回退" in item for item in review.risks))
        self.assertTrue(any("Bybit history api unavailable" in item for item in review.risks))

    def test_build_review_document_uses_conservative_backtest_request_when_history_source_is_fallback(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前结果不错。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["等待更多确认"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "4h",
                "data_range": "最近 180 天",
                "history_source": "market_detail_fallback",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-4.0%",
                    "win_rate": "60.0%",
                    "trades": 18,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertIn("恢复交易所历史后重跑", review.proposals[0].title)
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "4h")

    def test_build_review_document_uses_sample_recovery_backtest_request_when_history_source_samples_are_insufficient(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前结果不错。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["等待更多确认"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "4h",
                "data_range": "最近 180 天",
                "history_source": "market_detail_fallback",
                "history_source_reason": "insufficient_exchange_samples",
                "history_source_detail": "交易所历史仅返回 20 根样本，低于最小回测门槛 30 根。",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-4.0%",
                    "win_rate": "60.0%",
                    "trades": 18,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(len(review.proposals), 1)
        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertIn("补足交易所历史样本", review.proposals[0].title)
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1h")

    def test_build_review_document_does_not_pull_live_health_when_context_is_sparse(self) -> None:
        original_health = control_main.build_review_health_context
        original_activity = control_main._build_strategy_activity_review_context

        def _raise_if_called() -> Dict[str, Any]:
            raise AssertionError("should not fetch live review context")

        control_main.build_review_health_context = _raise_if_called
        control_main._build_strategy_activity_review_context = _raise_if_called
        self.addCleanup(setattr, control_main, "build_review_health_context", original_health)
        self.addCleanup(setattr, control_main, "_build_strategy_activity_review_context", original_activity)

        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本量偏少。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本量偏少"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "4h",
                "data_range": "最近 180 天",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "50.0%",
                    "trades": 2,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")

    def test_build_review_document_uses_finer_timeframe_when_sample_validation_range_is_already_180d(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本量偏少。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本量偏少"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "4h",
                "data_range": "最近 180 天",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "50.0%",
                    "trades": 2,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1h")

    def test_build_review_document_keeps_timeframe_when_range_is_not_explicitly_provided(self) -> None:
        review = control_main.build_review_document_from_text(
            text=json.dumps(
                {
                    "summary": "当前样本量偏少。",
                    "highlights": ["收益表现暂时不错"],
                    "risks": ["样本量偏少"],
                    "proposals": [],
                },
                ensure_ascii=False,
            ),
            context={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "50.0%",
                    "trades": 2,
                },
            },
            source="openclaw",
            job_type="generate_backtest_review",
        )

        self.assertEqual(review.proposals[0].proposal_type, "backtest_request")
        self.assertEqual(review.proposals[0].payload["data_range"], "最近 180 天")
        self.assertEqual(review.proposals[0].payload["timeframe"], "1h")

    def test_build_fallback_backtest_review_marks_reference_only_sample_risk(self) -> None:
        review = control_main.build_fallback_review_document(
            {
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "data_range": "最近 90 天",
                "reference_only": True,
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "0.0%",
                    "trades": 0,
                },
            },
            job_type="generate_backtest_review",
        )

        self.assertTrue(any("未命中真实入场信号" in item for item in review.risks))
        self.assertTrue(any("参考路径年化" in item for item in review.highlights))

    def test_build_fallback_backtest_review_includes_requested_window_and_coverage(self) -> None:
        review = control_main.build_fallback_review_document(
            {
                "strategy_id": "trend-btc-01",
                "backtest_id": "bt-fallback-001",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1d",
                "data_range": "最近 90 天",
                "history_source": "market_detail_fallback",
                "history_source_reason": "insufficient_exchange_samples",
                "history_source_detail": "交易所历史仅返回 20 根样本，低于最小回测门槛 30 根。",
                "requested_range_start": "2025-10-03T00:00:00+00:00",
                "requested_range_end": "2026-01-01T00:00:00+00:00",
                "retrieved_window_completion_pct": 63.16,
                "used_window_completion_pct": 63.16,
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "50.0%",
                    "trades": 12,
                },
            },
            job_type="generate_backtest_review",
        )

        self.assertEqual(review.backtest_id, "bt-fallback-001")
        self.assertEqual(review.decision_readiness, "research_only")
        self.assertEqual(review.decision_recommended_data_range, "最近 180 天")
        self.assertEqual(review.decision_recommended_timeframe, "1d")
        self.assertTrue(any("请求窗口 2025-10-03T00:00:00+00:00 -> 2026-01-01T00:00:00+00:00" in item for item in review.highlights))
        self.assertTrue(any("工作台行情快照样本" in item for item in review.highlights))
        self.assertTrue(any("交易所历史仅返回 20 根样本" in item for item in review.highlights))
        self.assertTrue(any("结论门禁：" in item for item in review.highlights))
        self.assertTrue(any("门禁重跑：" in item for item in review.highlights))
        self.assertTrue(any("来源建议：" in item for item in review.highlights))
        self.assertTrue(any("窗口覆盖率：取样 63.16% ，实际回测 63.16%。" in item for item in review.highlights))

    def test_build_fallback_backtest_review_preserves_backtest_lineage_fields(self) -> None:
        review = control_main.build_fallback_review_document(
            {
                "strategy_id": "trend-btc-01",
                "backtest_id": "bt-fallback-001",
                "source_change_request_id": "cr-parent-001",
                "source_backtest_id": "bt-parent-001",
                "source_review_id": "review-parent-001",
                "source_proposal_id": "prop-parent-001",
                "trigger_reason": "review_decision_rerun",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1d",
                "data_range": "最近 90 天",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "50.0%",
                    "trades": 12,
                },
            },
            job_type="generate_backtest_review",
        )

        self.assertEqual(review.backtest_id, "bt-fallback-001")
        self.assertEqual(review.source_change_request_id, "cr-parent-001")
        self.assertEqual(review.source_backtest_id, "bt-parent-001")
        self.assertEqual(review.source_review_id, "review-parent-001")
        self.assertEqual(review.source_proposal_id, "prop-parent-001")
        self.assertEqual(review.trigger_reason, "review_decision_rerun")
        self.assertTrue(any("来源链路：触发原因 review_decision_rerun；来源变更 cr-parent-001；来源回测 bt-parent-001" in item for item in review.highlights))

    def test_build_fallback_backtest_review_marks_low_sample_trade_risk(self) -> None:
        review = control_main.build_fallback_review_document(
            {
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "mode": "paper",
                "timeframe": "1h",
                "data_range": "最近 90 天",
                "metrics": {
                    "annual_return": "+24.8%",
                    "max_drawdown": "-6.3%",
                    "win_rate": "50.0%",
                    "trades": 2,
                },
            },
            job_type="generate_backtest_review",
        )

        self.assertTrue(any("样本量偏小" in item for item in review.risks))
        self.assertTrue(any("仅产生 2 笔真实成交" in item for item in review.highlights))

    def test_build_review_document_appends_execution_health_issue_to_risks(self) -> None:
        original_running = control_main.strategy_runtime_state.get("running")
        original_last_refresh = control_main.strategy_runtime_state.get("last_refresh_at")
        original_last_error = control_main.strategy_runtime_state.get("last_error")
        original_started_once = control_main.strategy_runtime_state.get("started_once")
        try:
            control_main.strategy_runtime_state.update(
                {
                    "running": False,
                    "last_refresh_at": None,
                    "last_error": "runtime boom",
                    "started_once": True,
                }
            )
            review = control_main.build_review_document_from_text(
                text=json.dumps(
                    {
                        "summary": "系统已完成今日复盘。",
                        "highlights": ["收益稳定"],
                        "risks": ["ETH 波动抬升"],
                        "proposals": [],
                    },
                    ensure_ascii=False,
                ),
                context={"strategy_id": "trend-btc-01", "strategy_name": "BTC 趋势跟随", "mode": "live"},
                source="openclaw",
                job_type="generate_daily_review",
            )
            self.assertTrue(
                any(
                    "运行线程异常" in item
                    and "runtime boom" in item
                    and "恢复运行线程" in item
                    for item in review.risks
                )
            )
        finally:
            control_main.strategy_runtime_state.update(
                {
                    "running": original_running,
                    "last_refresh_at": original_last_refresh,
                    "last_error": original_last_error,
                    "started_once": original_started_once,
                }
            )

    def test_build_fallback_review_document_appends_execution_health_issue_to_risks(self) -> None:
        original_running = control_main.strategy_runtime_state.get("running")
        original_last_refresh = control_main.strategy_runtime_state.get("last_refresh_at")
        original_last_error = control_main.strategy_runtime_state.get("last_error")
        original_started_once = control_main.strategy_runtime_state.get("started_once")
        try:
            control_main.strategy_runtime_state.update(
                {
                    "running": False,
                    "last_refresh_at": None,
                    "last_error": "runtime boom",
                    "started_once": True,
                }
            )
            review = control_main.build_fallback_review_document(
                {"strategy_id": "trend-btc-01", "strategy_name": "BTC 趋势跟随"},
                job_type="generate_daily_review",
            )
            self.assertTrue(
                any(
                    "运行线程异常" in item
                    and "runtime boom" in item
                    and "恢复运行线程" in item
                    for item in review.risks
                )
            )
        finally:
            control_main.strategy_runtime_state.update(
                {
                    "running": original_running,
                    "last_refresh_at": original_last_refresh,
                    "last_error": original_last_error,
                    "started_once": original_started_once,
                }
            )


class ReconcileChangeRequestOutcomeUnitTests(unittest.TestCase):
    def _make_change_request(self) -> str:
        payload = ChangeRequestCreate(
            type="alert_rule.update",
            payload={"symbol": "BTCUSDT", "strategy_id": "btc-trend-01"},
            summary="调高 BTCUSDT 提醒阈值",
        )
        created = control_main.repo.create_change_request(payload)
        return created.id

    def test_parse_reconcile_change_request_response_structured_json(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "提醒阈值已更新，运行线程正常",'
            ' "landed": true,'
            ' "needs_manual_review": false,'
            ' "needs_manual_review_detail": "",'
            ' "next_actions": ["观察 24 小时", "若再次触发补审计"]}'
        )
        parsed = OpenClawGatewayClient.parse_reconcile_change_request_response(raw)
        self.assertEqual(parsed["summary"], "提醒阈值已更新，运行线程正常")
        self.assertTrue(parsed["landed"])
        self.assertFalse(parsed["needs_manual_review"])
        self.assertIsNone(parsed["needs_manual_review_detail"])
        self.assertEqual(parsed["next_actions"], ["观察 24 小时", "若再次触发补审计"])

    def test_parse_reconcile_change_request_response_with_manual_review(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            "```json\n"
            '{"summary": "脚本补丁尚未生效",'
            ' "landed": false,'
            ' "needs_manual_review": "yes",'
            ' "needs_manual_review_detail": "策略运行线程停滞，需要人工排查",'
            ' "next_actions": "恢复运行线程;重新排队变更"}\n'
            "```"
        )
        parsed = OpenClawGatewayClient.parse_reconcile_change_request_response(raw)
        self.assertTrue(parsed["needs_manual_review"])
        self.assertIn("策略运行线程停滞", parsed["needs_manual_review_detail"] or "")
        self.assertEqual(parsed["next_actions"], ["恢复运行线程", "重新排队变更"])
        self.assertFalse(parsed["landed"])

    def test_parse_reconcile_change_request_response_plain_text_fallback(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed = OpenClawGatewayClient.parse_reconcile_change_request_response(
            "变更已经按预期落地，没有额外风险。"
        )
        self.assertEqual(parsed["summary"], "变更已经按预期落地，没有额外风险。")
        self.assertIsNone(parsed["landed"])
        self.assertIsNone(parsed["needs_manual_review"])
        self.assertEqual(parsed["next_actions"], [])

    def test_parse_reconcile_change_request_response_blank_text_falls_back_to_default_summary(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed = OpenClawGatewayClient.parse_reconcile_change_request_response("")
        self.assertEqual(parsed["summary"], "OpenClaw 已返回变更请求跟进结果。")
        self.assertIsNone(parsed["landed"])
        self.assertIsNone(parsed["needs_manual_review"])

    def test_build_reconcile_change_request_prompt_requests_structured_json(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "reconcile_change_request",
            {
                "change_request_id": "cr-demo-01",
                "change_type": "alert_rule.update",
                "summary": "调高 BTCUSDT 提醒阈值",
                "strategy_id": "btc-trend-01",
                "target_mode": "paper",
            },
        )
        self.assertIn("landed", prompt)
        self.assertIn("needs_manual_review", prompt)
        self.assertIn("next_actions", prompt)
        self.assertIn("上下文：", prompt)

    def test_apply_reconcile_change_request_outcome_flags_manual_followup(self) -> None:
        change_request_id = self._make_change_request()
        raw_response = json.dumps(
            {
                "summary": "策略运行线程停滞，变更尚未落地",
                "landed": False,
                "needs_manual_review": True,
                "needs_manual_review_detail": "先恢复运行线程再推进",
                "next_actions": ["恢复运行线程", "复核报警配置"],
            },
            ensure_ascii=False,
        )

        parsed = control_main.apply_reconcile_change_request_outcome_from_text(
            {"change_request_id": change_request_id},
            raw_response,
            source="openclaw",
        )
        self.assertTrue(parsed["needs_manual_review"])

        snapshot = control_main.repo.snapshot()
        record = next(item for item in snapshot.change_requests if item.id == change_request_id)
        self.assertTrue(record.manual_followup_required)
        self.assertEqual(record.manual_followup_detail, "先恢复运行线程再推进")
        self.assertEqual(record.follow_up_result_summary, "策略运行线程停滞，变更尚未落地")

        # A follow-up outcome saying "landed" should clear the manual follow-up flag.
        cleared = control_main.apply_reconcile_change_request_outcome_from_text(
            {"change_request_id": change_request_id},
            json.dumps(
                {
                    "summary": "运行线程恢复后变更已生效",
                    "landed": True,
                    "needs_manual_review": False,
                    "needs_manual_review_detail": "",
                    "next_actions": [],
                },
                ensure_ascii=False,
            ),
            source="openclaw",
        )
        self.assertFalse(cleared["needs_manual_review"])

        snapshot_after = control_main.repo.snapshot()
        record_after = next(item for item in snapshot_after.change_requests if item.id == change_request_id)
        self.assertFalse(record_after.manual_followup_required)
        self.assertIsNone(record_after.manual_followup_detail)
        self.assertEqual(record_after.follow_up_result_summary, "运行线程恢复后变更已生效")

    def test_apply_reconcile_change_request_outcome_emits_audit_event(self) -> None:
        change_request_id = self._make_change_request()
        control_main.apply_reconcile_change_request_outcome_from_text(
            {"change_request_id": change_request_id},
            "变更已经按预期落地，没有额外风险。",
            source="openclaw",
        )
        snapshot = control_main.repo.snapshot()
        matched = [
            evt
            for evt in snapshot.audit_events
            if evt.event_type == "change_request.reconcile_outcome"
            and (evt.payload or {}).get("change_request_id") == change_request_id
        ]
        self.assertTrue(matched, "expected reconcile outcome audit event")
        self.assertEqual((matched[0].payload or {}).get("source"), "openclaw")

    def test_apply_reconcile_change_request_outcome_unknown_id_is_noop(self) -> None:
        # Should simply return parsed payload without raising.
        parsed = control_main.apply_reconcile_change_request_outcome_from_text(
            {"change_request_id": "cr-does-not-exist"},
            "任意中文总结",
            source="openclaw",
        )
        self.assertEqual(parsed["summary"], "任意中文总结")


class StrategyTrackingReviewResponseUnitTests(unittest.TestCase):
    def test_parse_strategy_tracking_review_response_structured_json(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "参数调整已落地，运行线程稳定",'
            ' "status": "on_track",'
            ' "findings": ["快速均线已切换", "最近 30 分钟无异常"],'
            ' "next_actions": ["继续观察一个交易日", "若再触发告警则回滚"],'
            ' "highlights": ["活跃委托 2 笔"],'
            ' "risks": ["下一次变更需等待窗口"]}'
        )
        parsed = OpenClawGatewayClient.parse_strategy_tracking_review_response(raw)
        self.assertEqual(parsed["summary"], "参数调整已落地，运行线程稳定")
        self.assertEqual(parsed["status"], "on_track")
        self.assertEqual(parsed["findings"], ["快速均线已切换", "最近 30 分钟无异常"])
        self.assertEqual(parsed["next_actions"], ["继续观察一个交易日", "若再触发告警则回滚"])
        self.assertEqual(parsed["highlights"], ["活跃委托 2 笔"])
        self.assertEqual(parsed["risks"], ["下一次变更需等待窗口"])
        self.assertEqual(parsed["raw_text"], raw)

    def test_parse_strategy_tracking_review_response_status_alias_and_codeblock(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            "```json\n"
            '{"summary": "策略重启后问题仍在，建议升级人工处理",'
            ' "status": "升级",'
            ' "findings": "运行线程停滞;心跳丢失",'
            ' "next_actions": "恢复运行线程;通知值班工程师"}\n'
            "```"
        )
        parsed = OpenClawGatewayClient.parse_strategy_tracking_review_response(raw)
        self.assertEqual(parsed["status"], "escalate")
        self.assertEqual(parsed["findings"], ["运行线程停滞", "心跳丢失"])
        self.assertEqual(parsed["next_actions"], ["恢复运行线程", "通知值班工程师"])

    def test_parse_strategy_tracking_review_response_synthesizes_findings_from_highlights(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "变更回归观察中",'
            ' "status": "needs_attention",'
            ' "highlights": ["信号频率下降 20%", "活跃委托仍在 3 笔"],'
            ' "risks": ["下一次 1h K 线仍需观察"],'
            ' "next_actions": []}'
        )
        parsed = OpenClawGatewayClient.parse_strategy_tracking_review_response(raw)
        self.assertEqual(parsed["status"], "needs_attention")
        # findings omitted → synthesized from highlights + risks
        self.assertEqual(
            parsed["findings"],
            ["信号频率下降 20%", "活跃委托仍在 3 笔", "下一次 1h K 线仍需观察"],
        )
        self.assertEqual(parsed["next_actions"], [])

    def test_parse_strategy_tracking_review_response_plain_text_fallback(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed = OpenClawGatewayClient.parse_strategy_tracking_review_response(
            "策略变更已落实，建议继续观察执行健康。"
        )
        self.assertEqual(parsed["summary"], "策略变更已落实，建议继续观察执行健康。")
        self.assertIsNone(parsed["status"])
        self.assertEqual(parsed["findings"], [])
        self.assertEqual(parsed["next_actions"], [])
        self.assertEqual(parsed["highlights"], [])
        self.assertEqual(parsed["risks"], [])

    def test_parse_strategy_tracking_review_response_blank_uses_default_summary(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed = OpenClawGatewayClient.parse_strategy_tracking_review_response("")
        self.assertEqual(parsed["summary"], "OpenClaw 已返回策略跟踪结果。")
        self.assertIsNone(parsed["status"])
        self.assertEqual(parsed["findings"], [])
        self.assertEqual(parsed["next_actions"], [])

    def test_parse_strategy_tracking_review_response_unknown_status_defaults_to_none(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = '{"summary": "结果不明", "status": "maybe"}'
        parsed = OpenClawGatewayClient.parse_strategy_tracking_review_response(raw)
        self.assertEqual(parsed["summary"], "结果不明")
        self.assertIsNone(parsed["status"])

    def test_build_backtest_review_prompt_includes_new_stat_sections(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "generate_backtest_review",
            {
                "strategy_name": "Trend BTC",
                "strategy_id": "trend-btc-01",
                "data_range": "最近 90 天",
                "timeframe": "1h",
                "metrics": {"sharpe": "1.8"},
                "parameter_snapshot": {"fast_ma": 15},
                "volatility_stats": {
                    "return_volatility_pct": 0.8,
                    "annualized_volatility_pct": 12.4,
                    "max_drawdown_duration_bars": 14,
                    "max_run_up_pct": 6.2,
                    "positive_bar_ratio_pct": 52.0,
                },
                "risk_ratios": {
                    "sortino_ratio": 2.1,
                    "calmar_ratio": 1.5,
                    "profit_factor": 1.8,
                    "expectancy_pct": 0.12,
                    "worst_bar_return_pct": -1.2,
                    "best_bar_return_pct": 1.5,
                },
                "trade_rhythm_stats": {
                    "total_bars": 100,
                    "positive_bars": 55,
                    "negative_bars": 40,
                    "flat_bars": 5,
                    "win_loss_bar_ratio": 1.375,
                    "longest_winning_streak_bars": 6,
                    "longest_losing_streak_bars": 4,
                    "avg_positive_bar_return_pct": 0.8,
                    "avg_negative_bar_return_pct": -0.7,
                    "median_bar_return_pct": 0.05,
                },
                "benchmark_stats": {
                    "buy_hold_return_pct": 5.4,
                    "buy_hold_max_drawdown_pct": -8.1,
                    "strategy_over_buy_hold_pct": 2.3,
                    "alpha_pct": 3.1,
                    "correlation": 0.65,
                    "tracking_error_pct": 4.2,
                },
            },
        )
        self.assertIn("波动统计", prompt)
        self.assertIn("annualized_volatility_pct", prompt)
        self.assertIn("风险比率", prompt)
        self.assertIn("sortino_ratio", prompt)
        self.assertIn("节奏统计", prompt)
        self.assertIn("longest_winning_streak_bars", prompt)
        self.assertIn("对比基准", prompt)
        self.assertIn("buy_hold_return_pct", prompt)

    def test_build_review_strategy_change_prompt_requests_structured_status_fields(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "review_strategy_change",
            {
                "change_type": "parameter_update",
                "summary": "调整 fast_ma=15",
                "strategy_id": "trend-btc-01",
                "target_mode": "paper",
            },
        )
        self.assertIn("status", prompt)
        self.assertIn("findings", prompt)
        self.assertIn("next_actions", prompt)
        self.assertIn("on_track", prompt)
        self.assertIn("needs_attention", prompt)
        self.assertIn("escalate", prompt)

    def test_build_review_strategy_issue_prompt_requests_structured_status_fields(self) -> None:
        prompt = control_main.build_agent_job_prompt(
            "review_strategy_issue",
            {
                "issue_type": "runtime_guard_triggered",
                "summary": "盈亏护栏触发",
                "detail": "最大回撤触达预警阈值",
                "strategy_id": "trend-btc-01",
                "mode": "paper",
            },
        )
        self.assertIn("status", prompt)
        self.assertIn("findings", prompt)
        self.assertIn("next_actions", prompt)
        self.assertIn("on_track", prompt)
        self.assertIn("needs_attention", prompt)
        self.assertIn("escalate", prompt)

    def test_build_strategy_tracking_review_document_applies_change_verdict_prefix_and_highlights(self) -> None:
        raw = (
            '{"summary": "参数调整已落地",'
            ' "verdict": "approve",'
            ' "confidence": "high",'
            ' "highlights": ["快速均线按预期切换"],'
            ' "risks": ["下一次变更需等待窗口"],'
            ' "required_adjustments": ["记录本次变更的回归观察窗口"]}'
        )
        review = control_main.build_strategy_tracking_review_document(
            raw,
            {"strategy_id": "trend-btc-01", "change_request_id": "cr-unit-structured"},
            "review_strategy_change",
        )
        self.assertTrue(review.summary.startswith("[approve/high] "))
        self.assertIn("参数调整已落地", review.summary)
        self.assertIn("快速均线按预期切换", review.highlights)
        self.assertIn("下一次变更需等待窗口", review.risks)
        self.assertIn("记录本次变更的回归观察窗口", review.risks)

    def test_build_strategy_tracking_review_document_applies_issue_severity_prefix(self) -> None:
        raw = (
            '{"summary": "运行线程心跳持续丢失",'
            ' "severity": "critical",'
            ' "root_causes": ["心跳线程阻塞"],'
            ' "mitigations": ["重启运行线程"],'
            ' "follow_ups": ["跟踪 30 分钟心跳"]}'
        )
        review = control_main.build_strategy_tracking_review_document(
            raw,
            {"strategy_id": "trend-btc-01"},
            "review_strategy_issue",
        )
        self.assertTrue(review.summary.startswith("[critical] "))
        self.assertIn("运行线程心跳持续丢失", review.summary)
        self.assertIn("心跳线程阻塞", review.highlights)
        self.assertIn("重启运行线程", review.risks)
        self.assertIn("跟踪 30 分钟心跳", review.risks)

    def test_build_strategy_tracking_review_document_plain_text_does_not_get_structured_prefix(self) -> None:
        review = control_main.build_strategy_tracking_review_document(
            "策略变更已落实，建议继续观察执行健康。",
            {"strategy_id": "trend-btc-01"},
            "review_strategy_change",
        )
        self.assertFalse(review.summary.startswith("["))
        self.assertIn("策略变更已落实", review.summary)

    def test_build_review_document_from_text_merges_daily_review_structured_payload(self) -> None:
        raw = (
            '{"summary": "今日策略稳定运行",'
            ' "sentiment": "bullish",'
            ' "key_wins": ["Trend BTC 盈利 120 USDT"],'
            ' "key_losses": ["MeanRevert ETH 触发止损"],'
            ' "market_observations": ["BTC 夜间波动放大"],'
            ' "next_day_priorities": ["复核 MeanRevert 参数"]}'
        )
        review = control_main.build_review_document_from_text(
            raw,
            {"strategy_id": "trend-btc-01"},
            source="openclaw",
            job_type="generate_daily_review",
        )
        self.assertTrue(review.summary.startswith("[bullish] "))
        self.assertIn("今日策略稳定运行", review.summary)
        self.assertIn("Trend BTC 盈利 120 USDT", review.highlights)
        self.assertIn("MeanRevert ETH 触发止损", review.risks)
        self.assertIn("BTC 夜间波动放大", review.risks)
        self.assertIn("复核 MeanRevert 参数", review.risks)

    def test_build_review_document_from_text_merges_backtest_review_structured_payload(self) -> None:
        raw = (
            '{"summary": "回测整体可用",'
            ' "overall_rating": "strong",'
            ' "strengths": ["Sharpe 1.8", "回撤可控"],'
            ' "weaknesses": ["最近一段样本偏少"],'
            ' "risk_flags": ["样本窗口提示"],'
            ' "recommended_actions": ["扩展到最近 180 天再跑一次"]}'
        )
        review = control_main.build_review_document_from_text(
            raw,
            {"strategy_id": "trend-btc-01", "backtest_id": "bt-001"},
            source="openclaw",
            job_type="generate_backtest_review",
        )
        self.assertTrue(review.summary.startswith("[strong] "))
        self.assertIn("回测整体可用", review.summary)
        self.assertIn("Sharpe 1.8", review.highlights)
        self.assertIn("回撤可控", review.highlights)
        self.assertIn("最近一段样本偏少", review.risks)
        self.assertIn("扩展到最近 180 天再跑一次", review.risks)

    def test_build_review_document_from_text_plain_text_does_not_get_structured_prefix(self) -> None:
        review = control_main.build_review_document_from_text(
            "策略运行整体平稳。",
            {"strategy_id": "trend-btc-01"},
            source="openclaw",
            job_type="generate_daily_review",
        )
        self.assertFalse(review.summary.startswith("["))
        self.assertIn("策略运行整体平稳", review.summary)


class ControlApiHelperUnitTests(unittest.TestCase):
    def test_load_private_positions_snapshot_fetches_and_seeds_realtime_cache(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime

        class CountingPrivateClient(StubConfiguredTradingBybitPrivateClient):
            def __init__(self) -> None:
                super().__init__()
                self.fetch_positions_calls = 0

            def fetch_positions(self) -> list[Dict[str, Any]]:
                self.fetch_positions_calls += 1
                return super().fetch_positions()

        private_client = CountingPrivateClient()
        realtime_client = StubBybitPrivateRealtimeClient(client=private_client, positions=[])
        control_main.private_data = private_client
        control_main.private_realtime = realtime_client
        self.addCleanup(setattr, control_main, "private_data", original_private)
        self.addCleanup(setattr, control_main, "private_realtime", original_realtime)

        status, positions, updated_at = control_main.load_private_positions_snapshot()

        self.assertEqual(private_client.fetch_positions_calls, 1)
        self.assertEqual(len(positions), 2)
        self.assertEqual(realtime_client.get_positions_snapshot(), positions)
        self.assertEqual(updated_at, control_main.get_private_runtime_updated_at(status))

        cached_status, cached_positions, cached_updated_at = control_main.load_private_positions_snapshot()

        self.assertEqual(private_client.fetch_positions_calls, 1)
        self.assertEqual(cached_status.account_type, status.account_type)
        self.assertEqual(cached_positions, positions)
        self.assertEqual(cached_updated_at, updated_at)


class PrometheusLabelEscapeTests(unittest.TestCase):
    def test_label_value_none_becomes_empty_string(self) -> None:
        self.assertEqual(control_main.prometheus_label_value(None), "")

    def test_label_value_passes_through_plain_string(self) -> None:
        self.assertEqual(control_main.prometheus_label_value("running"), "running")

    def test_label_value_escapes_double_quote(self) -> None:
        self.assertEqual(
            control_main.prometheus_label_value('status"} malicious{x="1'),
            'status\\"} malicious{x=\\"1',
        )

    def test_label_value_escapes_backslash_before_quote(self) -> None:
        self.assertEqual(
            control_main.prometheus_label_value('a\\"b'),
            'a\\\\\\"b',
        )

    def test_label_value_escapes_newline(self) -> None:
        self.assertEqual(
            control_main.prometheus_label_value("line1\nline2"),
            "line1\\nline2",
        )

    def test_label_value_coerces_non_string(self) -> None:
        self.assertEqual(control_main.prometheus_label_value(42), "42")
        self.assertEqual(control_main.prometheus_label_value(True), "True")

    def test_labels_wraps_each_value_in_quotes(self) -> None:
        rendered = control_main.prometheus_labels(status="running", queue=3)
        self.assertEqual(rendered, 'status="running",queue="3"')

    def test_labels_escapes_injection_attempt(self) -> None:
        rendered = control_main.prometheus_labels(status='x"} fake_metric{y="1')
        self.assertEqual(rendered, 'status="x\\"} fake_metric{y=\\"1"')

    def test_labels_preserves_key_ordering(self) -> None:
        rendered = control_main.prometheus_labels(z="a", a="b", m="c")
        self.assertEqual(rendered, 'z="a",a="b",m="c"')

    def test_prometheus_metrics_escapes_injected_scheduler_status(self) -> None:
        original_scheduler = control_main.repo.state.control_snapshot.scheduler
        mutated_scheduler = original_scheduler.model_copy(
            update={"status": 'running"} injected_metric{evil="1'}
        )
        control_main.repo.state.control_snapshot.scheduler = mutated_scheduler
        self.addCleanup(
            setattr,
            control_main.repo.state.control_snapshot,
            "scheduler",
            original_scheduler,
        )

        output = control_main.build_prometheus_metrics()

        self.assertIn(
            'status="running\\"} injected_metric{evil=\\"1"',
            output,
        )


class ControlApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._original_repo_state = copy.deepcopy(control_main.repo.state)
        cls._original_openclaw = control_main.openclaw
        cls._original_private_data = control_main.private_data
        cls._original_private_realtime = control_main.private_realtime
        cls._original_market_data = control_main.market_data

        control_main.openclaw = StubOpenClawClient()
        control_main.private_data = StubBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        control_main.market_data = StubBybitPublicMarketClient()

        cls._port = _find_free_port()
        cls._base_url = f"http://127.0.0.1:{cls._port}"
        cls._server = uvicorn.Server(
            uvicorn.Config(
                control_main.app,
                host="127.0.0.1",
                port=cls._port,
                log_level="error",
                lifespan="off",
            )
        )
        cls._thread = threading.Thread(target=cls._server.run, name="control-api-test-server", daemon=True)
        cls._thread.start()
        _wait_for_server(cls._base_url)

    @classmethod
    def tearDownClass(cls) -> None:
        cls._server.should_exit = True
        cls._thread.join(timeout=10)
        control_main.repo.state = cls._original_repo_state
        control_main.repo._persist(cls._original_repo_state)
        control_main.openclaw = cls._original_openclaw
        control_main.private_data = cls._original_private_data
        control_main.private_realtime = cls._original_private_realtime
        control_main.market_data = cls._original_market_data

    def setUp(self) -> None:
        self._state_backup = build_state()
        self._strategy_runtime_state_backup = copy.deepcopy(control_main.strategy_runtime_state)
        if control_main.strategy_runtime_thread is not None and control_main.strategy_runtime_thread.is_alive():
            control_main.strategy_runtime_stop_event.set()
            control_main.strategy_runtime_thread.join(timeout=2)
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_stop_event.clear()
        control_main.repo.state = copy.deepcopy(self._state_backup)
        control_main.repo._persist(control_main.repo.state)
        control_main.private_order_metadata.clear()
        control_main.private_trade_cache.update({"status_key": None, "updated_at": 0.0, "items": []})
        control_main.private_order_history_cache.update({"status_key": None, "updated_at": 0.0, "items": []})
        control_main.market_data.base_url = control_main.repo.state.settings.api_base_url
        if hasattr(control_main.market_data, "enrich_watchlist_calls"):
            control_main.market_data.enrich_watchlist_calls = 0
        if hasattr(control_main.market_data, "enrich_watchlist_fast_calls"):
            control_main.market_data.enrich_watchlist_fast_calls = 0
        control_main.strategy_runtime_state.update({"running": False, "last_refresh_at": None, "last_error": None, "started_once": False})
        self.addCleanup(self._restore_state)

    def _restore_state(self) -> None:
        if control_main.strategy_runtime_thread is not None and control_main.strategy_runtime_thread.is_alive():
            control_main.strategy_runtime_stop_event.set()
            control_main.strategy_runtime_thread.join(timeout=2)
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_stop_event.clear()
        control_main.repo.state = self._state_backup
        control_main.repo._persist(self._state_backup)
        control_main.private_order_metadata.clear()
        control_main.private_trade_cache.update({"status_key": None, "updated_at": 0.0, "items": []})
        control_main.private_order_history_cache.update({"status_key": None, "updated_at": 0.0, "items": []})
        control_main.market_data.base_url = self._state_backup.settings.api_base_url
        control_main.strategy_runtime_state.clear()
        control_main.strategy_runtime_state.update(self._strategy_runtime_state_backup)

    def _get(self, path: str) -> tuple[int, Any]:
        return _request_json(self._base_url, "GET", path)

    def _post(self, path: str, payload: Dict[str, Any]) -> tuple[int, Any]:
        return _request_json(self._base_url, "POST", path, payload)

    def _delete(self, path: str) -> tuple[int, Any]:
        return _request_json(self._base_url, "DELETE", path)

    def _get_text(self, path: str) -> tuple[int, str]:
        return _request_text(self._base_url, "GET", path)

    def _assert_missing_keys(self, payload: Dict[str, Any], *keys: str) -> None:
        for key in keys:
            self.assertNotIn(key, payload)

    def _reset_strategy_paper_state(self, strategy_id: str) -> None:
        control_main.repo.state.trades = [
            trade
            for trade in control_main.repo.state.trades
            if not (trade.mode == AccountMode.PAPER and trade.strategy_id == strategy_id)
        ]
        control_main.repo.state.strategy_runtime_snapshots = [
            snapshot
            for snapshot in control_main.repo.state.strategy_runtime_snapshots
            if snapshot.strategy_id != strategy_id
        ]
        control_main.repo._persist(control_main.repo.state)

    def test_health_and_key_get_endpoints_return_basic_payloads(self) -> None:
        status, health = self._get("/health")
        self.assertEqual(status, 200)
        self.assertTrue(health["ok"])
        self.assertEqual(health["service"], "control-api")
        self.assertIn("watchlist_count", health)
        self.assertIn("strategy_count", health)
        self.assertIn("openclaw_connected", health)

        cases = {
            "/api/control/snapshot": ("scheduler", "account_metrics"),
            "/api/strategies": None,
            "/api/strategies/live": None,
            "/api/news": None,
            "/api/alerts": None,
            "/api/trades": None,
            "/api/ops/live": ("summary", "alerts"),
            "/api/account/live": ("overview", "positions"),
            "/api/account/order-history": None,
            "/api/runtime/strategy-worker/status": ("running", "issue"),
            "/api/workspace/preferences": ("active_section", "updated_at"),
            "/api/ai/live": ("scheduler", "activity_feed"),
            "/api/integrations/openclaw": ("configured", "gateway_url", "config_path", "config_exists", "command_available"),
            "/api/integrations/bybit-public": ("enabled", "updated_at"),
            "/api/integrations/bybit-private": ("configured", "can_query_private", "config_path", "config_exists", "example_config_path"),
            "/api/integrations/grafana": ("configured", "metrics_path"),
            "/api/integrations/bybit-private/probe-trade": ("configured", "outcome"),
        }

        for path, required_keys in cases.items():
            with self.subTest(path=path):
                status, payload = (
                    self._post(path, {})
                    if path.endswith("/probe-trade")
                    else self._get(path)
                )
                self.assertEqual(status, 200)
                if required_keys is None:
                    self.assertIsInstance(payload, list)
                else:
                    self.assertIsInstance(payload, dict)
                    for key in required_keys:
                        self.assertIn(key, payload)

    def test_workspace_preferences_update_persists(self) -> None:
        initial_status, initial_preferences = self._get("/api/workspace/preferences")
        self.assertEqual(initial_status, 200)

        payload = {
            "active_section": "settings",
            "layout_preset": "dense",
            "selected_mode": "demo",
            "selected_symbol": "ETHUSDT",
            "selected_market_timeframe": "4h",
            "selected_strategy_id": "eth-revert-02",
            "selected_backtest_id": "bt-002",
            "selected_scheduler_job_id": "job-oc-001",
            "selected_strategy_detail_panel": "tracking",
            "selected_strategy_tracking_kind": "change",
            "selected_strategy_tracking_summary": "ETH 变更需要继续跟踪",
            "selected_strategy_tracking_detail": "重点观察回测样本是否完整覆盖。",
            "selected_strategy_editor_strategy_id": "eth-revert-02",
            "selected_strategy_editor_parameter_drafts": {"lookback": "18"},
            "selected_strategy_editor_risk_budget_draft": "22%",
            "selected_review_inspector_id": "review-20260330-daily",
            "selected_review_inspector_strategy_id": "trend-btc-01",
            "selected_review_id": "review-20260330-daily",
            "selected_proposal_id": "prop-001",
            "selected_change_request_id": "cr-002",
            "backtest_filter": "all",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "P1",
            "alert_status_filter": "acknowledged",
            "alert_scope_filter": "selected",
            "trade_mode_filter": "live",
            "trade_origin_filter": "strategy",
            "trade_scope_filter": "selected",
            "audit_severity_filter": "warning",
            "audit_source_filter": "openclaw",
            "audit_scope_filter": "selected",
            "audit_search": "runtime boom",
            "overview_card_order": ["ai_center", "account_center", "strategy_watch", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center", "unknown", "account_center"],
            "overview_collapsed_cards": ["account_center", "unknown", "account_center"],
        }

        post_status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(post_status, 200)
        self.assertEqual(updated["active_section"], "settings")
        self.assertEqual(updated["layout_preset"], "dense")
        self.assertEqual(updated["selected_mode"], "demo")
        self.assertEqual(updated["selected_symbol"], "ETHUSDT")
        self.assertEqual(updated["selected_market_timeframe"], "4h")
        self.assertEqual(updated["selected_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["selected_backtest_id"], "bt-002")
        self.assertEqual(updated["selected_scheduler_job_id"], "job-oc-001")
        self.assertIsNone(updated["selected_strategy_detail_panel"])
        self.assertIsNone(updated["selected_strategy_tracking_kind"])
        self.assertEqual(updated["selected_strategy_tracking_summary"], "")
        self.assertEqual(updated["selected_strategy_tracking_detail"], "")
        self.assertIsNone(updated["selected_strategy_editor_strategy_id"])
        self.assertEqual(updated["selected_strategy_editor_parameter_drafts"], {})
        self.assertEqual(updated["selected_strategy_editor_risk_budget_draft"], "")
        self.assertEqual(updated["selected_review_inspector_id"], "review-20260330-daily")
        self.assertEqual(updated["selected_review_inspector_strategy_id"], "trend-btc-01")
        self.assertEqual(updated["selected_review_id"], "review-20260330-daily")
        self.assertEqual(updated["selected_proposal_id"], "prop-001")
        self.assertEqual(updated["selected_change_request_id"], "cr-002")
        self.assertEqual(updated["backtest_filter"], "all")
        self.assertEqual(updated["replay_tracking_scope"], "selected")
        self.assertEqual(updated["alert_severity_filter"], "P1")
        self.assertEqual(updated["alert_status_filter"], "acknowledged")
        self.assertEqual(updated["alert_scope_filter"], "selected")
        self.assertEqual(updated["trade_mode_filter"], "live")
        self.assertEqual(updated["trade_origin_filter"], "strategy")
        self.assertEqual(updated["trade_scope_filter"], "selected")
        self.assertEqual(updated["audit_severity_filter"], "warning")
        self.assertEqual(updated["audit_source_filter"], "openclaw")
        self.assertEqual(updated["audit_scope_filter"], "selected")
        self.assertEqual(updated["audit_search"], "runtime boom")
        self.assertEqual(updated["overview_card_order"][:3], ["ai_center", "account_center", "strategy_watch"])
        self.assertEqual(updated["overview_visible_cards"], ["account_center", "strategy_watch"])
        self.assertEqual(updated["overview_collapsed_cards"], ["account_center"])

        get_status, persisted = self._get("/api/workspace/preferences")
        self.assertEqual(get_status, 200)
        self.assertEqual(persisted, updated)
        self.assertNotEqual(initial_preferences, updated)

    def test_workspace_preferences_get_clears_missing_change_request_selection(self) -> None:
        control_main.repo.state.workspace_preferences.selected_scheduler_job_id = "job-missing"
        control_main.repo.state.workspace_preferences.selected_review_inspector_id = "review-missing"
        control_main.repo.state.workspace_preferences.selected_review_inspector_strategy_id = "strategy-missing"
        control_main.repo.state.workspace_preferences.selected_review_id = "review-missing"
        control_main.repo.state.workspace_preferences.selected_proposal_id = "prop-missing"
        control_main.repo.state.workspace_preferences.selected_change_request_id = "cr-missing"
        control_main.repo._persist()

        status, preferences = self._get("/api/workspace/preferences")
        self.assertEqual(status, 200)
        self.assertIsNone(preferences["selected_scheduler_job_id"])
        self.assertIsNone(preferences["selected_review_inspector_id"])
        self.assertIsNone(preferences["selected_review_inspector_strategy_id"])
        self.assertIsNone(preferences["selected_review_id"])
        self.assertIsNone(preferences["selected_proposal_id"])
        self.assertIsNone(preferences["selected_change_request_id"])
        self.assertIsNone(control_main.repo.state.workspace_preferences.selected_scheduler_job_id)
        self.assertIsNone(control_main.repo.state.workspace_preferences.selected_review_inspector_id)
        self.assertIsNone(control_main.repo.state.workspace_preferences.selected_review_inspector_strategy_id)
        self.assertIsNone(control_main.repo.state.workspace_preferences.selected_review_id)
        self.assertIsNone(control_main.repo.state.workspace_preferences.selected_proposal_id)
        self.assertIsNone(control_main.repo.state.workspace_preferences.selected_change_request_id)

    def test_workspace_preferences_get_clears_missing_symbol_strategy_and_backtest_selection(self) -> None:
        control_main.repo.state.workspace_preferences.selected_symbol = "DOGEUSDT"
        control_main.repo.state.workspace_preferences.selected_strategy_id = "strategy-missing"
        control_main.repo.state.workspace_preferences.selected_backtest_id = "bt-missing"
        control_main.repo.state.workspace_preferences.selected_change_request_id = "cr-missing"
        control_main.repo.state.workspace_preferences.selected_review_inspector_id = "review-missing"
        control_main.repo._persist()

        status, preferences = self._get("/api/workspace/preferences")
        self.assertEqual(status, 200)
        self.assertEqual(preferences["selected_symbol"], control_main.repo.state.watchlist[0].symbol)
        self.assertEqual(preferences["selected_strategy_id"], control_main.repo.state.strategies[0].id)
        self.assertIsNone(preferences["selected_backtest_id"])
        self.assertIsNone(preferences["selected_review_inspector_id"])
        self.assertIsNone(preferences["selected_change_request_id"])

    def test_workspace_preferences_update_returns_and_audits_sanitized_selection(self) -> None:
        payload = {
            "active_section": "strategy",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "DOGEUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "strategy-missing",
            "selected_backtest_id": "bt-missing",
            "selected_scheduler_job_id": "job-missing",
            "selected_review_inspector_id": "review-missing",
            "selected_review_inspector_strategy_id": "strategy-missing",
            "selected_review_id": "review-missing",
            "selected_proposal_id": "prop-missing",
            "selected_change_request_id": "cr-missing",
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_symbol"], control_main.repo.state.watchlist[0].symbol)
        self.assertEqual(updated["selected_strategy_id"], control_main.repo.state.strategies[0].id)
        self.assertIsNone(updated["selected_backtest_id"])
        self.assertIsNone(updated["selected_scheduler_job_id"])
        self.assertIsNone(updated["selected_review_inspector_id"])
        self.assertIsNone(updated["selected_review_inspector_strategy_id"])
        self.assertIsNone(updated["selected_review_id"])
        self.assertIsNone(updated["selected_proposal_id"])
        self.assertIsNone(updated["selected_change_request_id"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        event = next(
            item for item in audit_events if item["event_type"] == "workspace.preferences.updated"
        )
        self.assertEqual(event["payload"]["selected_symbol"], control_main.repo.state.watchlist[0].symbol)
        self.assertEqual(event["payload"]["selected_strategy_id"], control_main.repo.state.strategies[0].id)
        self.assertIsNone(event["payload"]["selected_backtest_id"])
        self.assertIsNone(event["payload"]["selected_scheduler_job_id"])
        self.assertIsNone(event["payload"]["selected_review_inspector_id"])
        self.assertIsNone(event["payload"]["selected_review_inspector_strategy_id"])
        self.assertIsNone(event["payload"]["selected_review_id"])
        self.assertIsNone(event["payload"]["selected_proposal_id"])
        self.assertIsNone(event["payload"]["selected_change_request_id"])

    def test_workspace_preferences_update_clears_strategy_detail_panel_outside_strategy_section(self) -> None:
        payload = {
            "active_section": "backtest",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "ETHUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "eth-revert-02",
            "selected_backtest_id": "bt-002",
            "selected_scheduler_job_id": None,
            "selected_strategy_detail_panel": "tracking",
            "selected_strategy_tracking_kind": "change",
            "selected_strategy_tracking_summary": "这轮回测需要继续观察",
            "selected_strategy_tracking_detail": "先补样本再决定是否继续。",
            "selected_strategy_editor_strategy_id": "eth-revert-02",
            "selected_strategy_editor_parameter_drafts": {"lookback": "18"},
            "selected_strategy_editor_risk_budget_draft": "22%",
            "selected_review_inspector_id": None,
            "selected_review_inspector_strategy_id": None,
            "selected_review_id": None,
            "selected_proposal_id": None,
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["selected_backtest_id"], "bt-002")
        self.assertIsNone(updated["selected_strategy_detail_panel"])
        self.assertIsNone(updated["selected_strategy_tracking_kind"])
        self.assertEqual(updated["selected_strategy_tracking_summary"], "")
        self.assertEqual(updated["selected_strategy_tracking_detail"], "")
        self.assertIsNone(updated["selected_strategy_editor_strategy_id"])
        self.assertEqual(updated["selected_strategy_editor_parameter_drafts"], {})
        self.assertEqual(updated["selected_strategy_editor_risk_budget_draft"], "")

    def test_workspace_preferences_update_persists_strategy_detail_panel_on_strategy_section(self) -> None:
        payload = {
            "active_section": "strategy",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "ETHUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "eth-revert-02",
            "selected_backtest_id": None,
            "selected_scheduler_job_id": None,
            "selected_strategy_detail_panel": "tracking",
            "selected_strategy_tracking_kind": "change",
            "selected_strategy_tracking_summary": "这轮变更需要继续跟踪",
            "selected_strategy_tracking_detail": "优先观察样本窗口与回测结论门禁。",
            "selected_strategy_editor_strategy_id": "eth-revert-02",
            "selected_strategy_editor_parameter_drafts": {
                "lookback": "18",
            },
            "selected_strategy_editor_risk_budget_draft": "22%",
            "selected_review_inspector_id": None,
            "selected_review_inspector_strategy_id": None,
            "selected_review_id": None,
            "selected_proposal_id": None,
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_symbol"], "ETHUSDT")
        self.assertEqual(updated["selected_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["selected_strategy_detail_panel"], "tracking")
        self.assertEqual(updated["selected_strategy_tracking_kind"], "change")
        self.assertEqual(updated["selected_strategy_tracking_summary"], "这轮变更需要继续跟踪")
        self.assertEqual(updated["selected_strategy_tracking_detail"], "优先观察样本窗口与回测结论门禁。")
        self.assertEqual(updated["selected_strategy_editor_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["selected_strategy_editor_parameter_drafts"], {"lookback": "18"})
        self.assertEqual(updated["selected_strategy_editor_risk_budget_draft"], "22%")

    def test_workspace_preferences_update_persists_strategy_editor_drafts_on_strategy_section(self) -> None:
        payload = {
            "active_section": "strategy",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "BTCUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "trend-btc-01",
            "selected_backtest_id": None,
            "selected_scheduler_job_id": None,
            "selected_strategy_detail_panel": "editor",
            "selected_strategy_tracking_kind": None,
            "selected_strategy_tracking_summary": "",
            "selected_strategy_tracking_detail": "",
            "selected_strategy_editor_strategy_id": "trend-btc-01",
            "selected_strategy_editor_parameter_drafts": {
                "lookback": "26",
                "confirmation": "2",
            },
            "selected_strategy_editor_risk_budget_draft": "18%",
            "selected_review_inspector_id": None,
            "selected_review_inspector_strategy_id": None,
            "selected_review_id": None,
            "selected_proposal_id": None,
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_strategy_detail_panel"], "editor")
        self.assertEqual(updated["selected_strategy_editor_strategy_id"], "trend-btc-01")
        self.assertEqual(
            updated["selected_strategy_editor_parameter_drafts"],
            {"lookback": "26", "confirmation": "2"},
        )
        self.assertEqual(updated["selected_strategy_editor_risk_budget_draft"], "18%")
        self.assertIsNone(updated["selected_strategy_tracking_kind"])
        self.assertEqual(updated["selected_strategy_tracking_summary"], "")
        self.assertEqual(updated["selected_strategy_tracking_detail"], "")

    def test_workspace_preferences_update_clears_strategy_editor_drafts_when_strategy_realigns(self) -> None:
        payload = {
            "active_section": "strategy",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "BTCUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "strategy-missing",
            "selected_backtest_id": None,
            "selected_scheduler_job_id": None,
            "selected_strategy_detail_panel": "tracking",
            "selected_strategy_tracking_kind": "issue",
            "selected_strategy_tracking_summary": "继续观察",
            "selected_strategy_tracking_detail": "等待切回正确策略。",
            "selected_strategy_editor_strategy_id": "strategy-missing",
            "selected_strategy_editor_parameter_drafts": {
                "lookback": "26",
            },
            "selected_strategy_editor_risk_budget_draft": "18%",
            "selected_review_inspector_id": None,
            "selected_review_inspector_strategy_id": None,
            "selected_review_id": None,
            "selected_proposal_id": None,
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_strategy_id"], control_main.repo.state.strategies[0].id)
        self.assertEqual(updated["selected_symbol"], control_main.repo.state.watchlist[0].symbol)
        self.assertEqual(updated["selected_strategy_detail_panel"], "tracking")
        self.assertIsNone(updated["selected_strategy_editor_strategy_id"])
        self.assertEqual(updated["selected_strategy_editor_parameter_drafts"], {})
        self.assertEqual(updated["selected_strategy_editor_risk_budget_draft"], "")

    def test_workspace_preferences_update_prefers_editor_strategy_when_restoring_editor_panel(self) -> None:
        payload = {
            "active_section": "strategy",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "BTCUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "strategy-missing",
            "selected_backtest_id": None,
            "selected_scheduler_job_id": None,
            "selected_strategy_detail_panel": "editor",
            "selected_strategy_tracking_kind": None,
            "selected_strategy_tracking_summary": "",
            "selected_strategy_tracking_detail": "",
            "selected_strategy_editor_strategy_id": "trend-btc-01",
            "selected_strategy_editor_parameter_drafts": {
                "lookback": "26",
            },
            "selected_strategy_editor_risk_budget_draft": "18%",
            "selected_review_inspector_id": None,
            "selected_review_inspector_strategy_id": None,
            "selected_review_id": None,
            "selected_proposal_id": None,
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_strategy_id"], "trend-btc-01")
        self.assertEqual(updated["selected_symbol"], "BTCUSDT")
        self.assertEqual(updated["selected_strategy_detail_panel"], "editor")
        self.assertEqual(updated["selected_strategy_editor_strategy_id"], "trend-btc-01")
        self.assertEqual(updated["selected_strategy_editor_parameter_drafts"], {"lookback": "26"})
        self.assertEqual(updated["selected_strategy_editor_risk_budget_draft"], "18%")

    def test_workspace_preferences_update_aligns_strategy_to_selected_scheduler_job_on_scheduler_section(self) -> None:
        control_main.repo.state.agent_jobs.append(
            AgentJob(
                id="job-eth-scheduler",
                job_type="review_strategy_change",
                context={"strategy_id": "eth-revert-02"},
                strategy_id="eth-revert-02",
                allowed_actions=["cancel"],
                timeout=120,
                idempotency_key="job-eth-scheduler",
                writeback_target="scheduler",
                status="queued",
                created_at="2026-03-30T00:00:00+08:00",
                updated_at="2026-03-30T00:00:00+08:00",
            )
        )

        payload = {
            "active_section": "scheduler",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "BTCUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "trend-btc-01",
            "selected_backtest_id": None,
            "selected_scheduler_job_id": "job-eth-scheduler",
            "selected_review_id": None,
            "selected_proposal_id": None,
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_symbol"], "ETHUSDT")
        self.assertEqual(updated["selected_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["selected_scheduler_job_id"], "job-eth-scheduler")

    def test_workspace_preferences_update_aligns_strategy_to_selected_review_on_replay_section(self) -> None:
        control_main.repo.state.reviews.append(
            ReviewDocument(
                id="review-eth-replay",
                period="backtest",
                strategy_id="eth-revert-02",
                title="ETH replay focus",
                summary="ETH 策略回放聚焦项。",
                highlights=[],
                risks=[],
                proposals=[],
                created_at="2026-03-30T00:00:00+08:00",
            )
        )

        payload = {
            "active_section": "replay",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "BTCUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "trend-btc-01",
            "selected_backtest_id": None,
            "selected_review_id": "review-eth-replay",
            "selected_proposal_id": None,
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_symbol"], "ETHUSDT")
        self.assertEqual(updated["selected_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["selected_review_id"], "review-eth-replay")

    def test_workspace_preferences_update_aligns_strategy_to_selected_proposal_on_strategy_section(self) -> None:
        payload = {
            "active_section": "strategy",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "ETHUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "eth-revert-02",
            "selected_backtest_id": None,
            "selected_proposal_id": "prop-002",
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_symbol"], "BTCUSDT")
        self.assertEqual(updated["selected_strategy_id"], "trend-btc-01")
        self.assertEqual(updated["selected_proposal_id"], "prop-002")

    def test_workspace_preferences_update_aligns_strategy_to_selected_change_request_on_strategy_section(self) -> None:
        payload = {
            "active_section": "strategy",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "BTCUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "eth-revert-02",
            "selected_backtest_id": None,
            "selected_change_request_id": "cr-003",
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_symbol"], "BTCUSDT")
        self.assertEqual(updated["selected_strategy_id"], "trend-btc-01")
        self.assertEqual(updated["selected_change_request_id"], "cr-003")

    def test_workspace_preferences_update_aligns_strategy_to_selected_backtest_on_backtest_section(self) -> None:
        payload = {
            "active_section": "backtest",
            "layout_preset": "balanced",
            "selected_mode": "paper",
            "selected_symbol": "ETHUSDT",
            "selected_market_timeframe": "1h",
            "selected_strategy_id": "trend-btc-01",
            "selected_backtest_id": "bt-002",
            "selected_change_request_id": None,
            "backtest_filter": "selected",
            "replay_tracking_scope": "selected",
            "alert_severity_filter": "all",
            "alert_status_filter": "pending",
            "alert_scope_filter": "all",
            "trade_mode_filter": "all",
            "trade_origin_filter": "all",
            "trade_scope_filter": "all",
            "audit_severity_filter": "all",
            "audit_source_filter": "all",
            "audit_scope_filter": "all",
            "audit_search": "",
            "overview_card_order": ["strategy_watch", "ai_center", "account_center"],
            "overview_visible_cards": ["strategy_watch", "account_center"],
            "overview_collapsed_cards": [],
        }

        status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(status, 200)
        self.assertEqual(updated["selected_symbol"], "ETHUSDT")
        self.assertEqual(updated["selected_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["selected_backtest_id"], "bt-002")

    def test_alert_acknowledge_updates_alert_summary_and_audit(self) -> None:
        initial_snapshot_status, initial_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(initial_snapshot_status, 200)
        initial_p1_count = initial_snapshot["alerts_summary"]["P1"]

        status, alerts = self._get("/api/alerts")
        self.assertEqual(status, 200)
        target = next((item for item in alerts if item["id"] == "alert-002"), None)
        self.assertIsNotNone(target)
        self.assertFalse(target["acknowledged"])

        ack_status, acknowledged = self._post(
            "/api/alerts/alert-002/acknowledge",
            {"acknowledged": True, "requested_by": "test-suite"},
        )
        self.assertEqual(ack_status, 200)
        self.assertTrue(acknowledged["acknowledged"])

        status, refreshed_alerts = self._get("/api/alerts")
        self.assertEqual(status, 200)
        refreshed_target = next((item for item in refreshed_alerts if item["id"] == "alert-002"), None)
        self.assertIsNotNone(refreshed_target)
        self.assertTrue(refreshed_target["acknowledged"])

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(snapshot["alerts_summary"]["P1"], initial_p1_count - 1)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        acknowledged_event = next((item for item in audit_events if item["event_type"] == "alert.acknowledged"), None)
        self.assertIsNotNone(acknowledged_event)

        reopen_status, reopened = self._post(
            "/api/alerts/alert-002/acknowledge",
            {"acknowledged": False, "requested_by": "test-suite"},
        )
        self.assertEqual(reopen_status, 200)
        self.assertFalse(reopened["acknowledged"])

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(snapshot["alerts_summary"]["P1"], initial_p1_count)

    def test_account_endpoints_gracefully_fallback_without_private_api(self) -> None:
        status, status_payload = self._get("/api/integrations/bybit-private")
        self.assertEqual(status, 200)
        self.assertFalse(status_payload["configured"])
        self.assertFalse(status_payload["can_query_private"])
        self.assertEqual(status_payload["source"], "none")
        self.assertTrue(status_payload["config_path"].endswith(".bybit-control/private-api.json"))
        self.assertFalse(status_payload["config_exists"])
        self.assertTrue(status_payload["example_config_path"].endswith("services/control-api/private-api.example.json"))
        self.assertEqual(status_payload["usdt_balance_diagnostics"], [])

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["source"], "paper")
        self.assertIn("total_equity", overview)
        self.assertGreaterEqual(int(overview["positions_count"]), 0)
        self.assertGreaterEqual(int(overview["open_orders_count"]), 0)
        self.assertGreaterEqual(len(overview["top_holdings"]), 1)

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        self.assertIsInstance(positions, list)
        self.assertGreaterEqual(len(positions), 1)
        self.assertTrue(all(item["source"] == "paper" for item in positions))

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertIsInstance(orders, list)
        self.assertEqual(len(orders), 0)

        history_status, history_orders = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertGreaterEqual(len(history_orders), 1)
        self.assertTrue(all(item["source"] == "paper" for item in history_orders))

    def test_scheduler_freeze_publish_toggles(self) -> None:
        initial_status, initial_scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(initial_status, 200)
        initial_freeze = bool(initial_scheduler["scheduler"]["freeze_publish"])

        post_status, result = self._post(
            "/api/ai/scheduler/commands",
            {"command": "freeze_publish", "requested_by": "unit_test", "reason": "toggle"},
        )
        self.assertEqual(post_status, 200)
        self.assertEqual(result["status"], "accepted")
        self.assertEqual(result["freeze_publish"], (not initial_freeze))

        after_status, after_scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(after_status, 200)
        self.assertEqual(after_scheduler["scheduler"]["freeze_publish"], (not initial_freeze))

        second_status, second_result = self._post(
            "/api/ai/scheduler/commands",
            {"command": "freeze_publish", "requested_by": "unit_test", "reason": "toggle-back"},
        )
        self.assertEqual(second_status, 200)
        self.assertEqual(second_result["freeze_publish"], initial_freeze)

        final_status, final_scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(final_status, 200)
        self.assertEqual(final_scheduler["scheduler"]["freeze_publish"], initial_freeze)

    def test_real_private_empty_account_does_not_fallback_to_mock_positions_or_orders(self) -> None:
        original_private = control_main.private_data
        control_main.private_data = StubConfiguredEmptyBybitPrivateClient()
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["source"], "bybit_private")
        self.assertEqual(overview["positions_count"], 0)
        self.assertEqual(overview["open_orders_count"], 0)
        self.assertEqual(overview["top_holdings"], [])

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        self.assertEqual(positions, [])

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(orders, [])

        probe_status, probe = self._post("/api/integrations/bybit-private/probe-trade", {})
        self.assertEqual(probe_status, 200)
        self.assertEqual(probe["outcome"], "validation_rejected")
        self.assertTrue(probe["authenticated"])
        self.assertTrue(probe["trade_permission"])

    def test_account_positions_derives_spot_holdings_from_wallet_snapshot(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "9355",
                "totalWalletBalance": "9355",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "availableToWithdraw": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "availableToWithdraw": "2.5",
                    },
                ],
            },
            positions=[],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["positions_count"], 1)

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        eth_position = next((item for item in positions if item["symbol"] == "ETHUSDT"), None)
        self.assertIsNotNone(eth_position)
        assert eth_position is not None
        self.assertEqual(eth_position["market"], "spot")
        self.assertEqual(eth_position["side"], "long")
        self.assertEqual(eth_position["size"], "2.5")
        self.assertEqual(eth_position["avg_price"], "--")
        self.assertEqual(control_main.parse_metric_number(eth_position["mark_price"]), 2062.0)
        self.assertEqual(eth_position["value"], "5,155.00 USDT")

    def test_account_positions_dedupes_wallet_spot_holdings_against_private_position_records(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "9355",
                "totalWalletBalance": "9355",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "availableToWithdraw": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "availableToWithdraw": "2.5",
                    },
                ],
            },
            positions=[],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        eth_spot_positions = [item for item in positions if item["symbol"] == "ETHUSDT" and item["market"] == "spot"]
        self.assertEqual(len(eth_spot_positions), 1)

    def test_private_execution_history_populates_recent_trades(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradeHistoryBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient()
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        trades_status, trades = self._get("/api/trades")
        self.assertEqual(trades_status, 200)
        self.assertGreaterEqual(len(trades), 2)
        exchange_trades = [item for item in trades if item["origin"] == "exchange"]
        self.assertEqual(len(exchange_trades), 2)
        self.assertEqual({item["symbol"] for item in exchange_trades}, {"BTCUSDT", "ETHUSDT"})
        self.assertTrue(all(item["mode"] == "live" for item in exchange_trades))

        ops_status, ops = self._get("/api/ops/live")
        self.assertEqual(ops_status, 200)
        self.assertGreaterEqual(ops["summary"]["recent_trades"], 2)
        self.assertTrue(any(item["origin"] == "exchange" for item in ops["trades"]))

    def test_private_execution_history_infers_strategy_origin_and_strategy_id(self) -> None:
        class StubStrategyExecutionHistoryClient(StubConfiguredEmptyBybitPrivateClient):
            def fetch_execution_history(self) -> list[Dict[str, Any]]:
                return [
                    {
                        "execId": "exec-strategy-001",
                        "orderId": "order-strategy-001",
                        "symbol": "BTCUSDT",
                        "category": "linear",
                        "side": "Sell",
                        "execQty": "0.08",
                        "execPrice": "66840.5",
                        "closedPnl": "16.25",
                        "execTime": "1774887000000",
                        "orderLinkId": "strategy-live-trend-btc-01-abcd1234",
                    }
                ]

        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubStrategyExecutionHistoryClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient()
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        trades_status, trades = self._get("/api/trades")
        self.assertEqual(trades_status, 200)
        strategy_trade = next((item for item in trades if item["id"] == "exec-strategy-001"), None)
        self.assertIsNotNone(strategy_trade)
        assert strategy_trade is not None
        self.assertEqual(strategy_trade["origin"], "strategy")
        self.assertEqual(strategy_trade["strategy_id"], "trend-btc-01")

    def test_private_order_history_endpoint_returns_recent_exchange_orders(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredOrderHistoryBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertEqual(len(history), 2)
        self.assertEqual(history[0]["order_id"], "hist-order-001")
        self.assertEqual(history[0]["status"], "Filled")
        self.assertEqual(history[1]["market"], "spot")

    def test_private_realtime_snapshots_enrich_account_and_trade_views(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "128.54",
                "totalWalletBalance": "127.30",
                "totalAvailableBalance": "118.10",
                "totalPerpUPL": "1.24",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "118.1",
                        "usdValue": "118.1",
                        "availableToWithdraw": "118.1",
                    }
                ],
            },
            positions=[
                {
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "size": "0.25",
                    "avgPrice": "66850",
                    "markPrice": "66910",
                    "positionValue": "16727.5",
                    "leverage": "3",
                    "unrealisedPnl": "15.2",
                }
            ],
            orders=[
                {
                    "orderId": "live-order-001",
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.8",
                    "price": "2100",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            executions=[
                {
                    "execId": "ws-exec-001",
                    "orderId": "live-order-002",
                    "symbol": "SOLUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "execQty": "4",
                    "execPrice": "84.51",
                    "closedPnl": "0",
                    "execTime": "1774888200000",
                    "orderLinkId": "ws-review-sol",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        status_code, private_status = self._get("/api/integrations/bybit-private")
        self.assertEqual(status_code, 200)
        self.assertTrue(private_status["configured"])
        self.assertTrue(private_status["realtime_enabled"])
        self.assertTrue(private_status["realtime_connected"])
        self.assertTrue(private_status["realtime_authenticated"])
        self.assertFalse(private_status["realtime_stale"])
        self.assertEqual(private_status["realtime_stale_seconds"], 0)
        self.assertEqual(len(private_status["usdt_balance_diagnostics"]), 3)
        self.assertEqual(private_status["usdt_balance_diagnostics"][0]["account_type"], "UNIFIED")
        self.assertEqual(private_status["usdt_balance_diagnostics"][0]["available_balance"], "0")

        live_status, live_snapshot = self._get("/api/account/live")
        self.assertEqual(live_status, 200)
        self.assertEqual(live_snapshot["overview"]["source"], "bybit_private")
        self.assertEqual(live_snapshot["overview"]["total_equity"], "128.54 USDT")
        self.assertEqual(live_snapshot["overview"]["positions_count"], 1)
        self.assertEqual(live_snapshot["overview"]["open_orders_count"], 1)
        self.assertEqual(live_snapshot["positions"][0]["symbol"], "BTCUSDT")
        self.assertEqual(live_snapshot["orders"][0]["order_id"], "live-order-001")

        trades_status, trades = self._get("/api/trades")
        self.assertEqual(trades_status, 200)
        realtime_trade = next((item for item in trades if item["id"] == "ws-exec-001"), None)
        self.assertIsNotNone(realtime_trade)
        assert realtime_trade is not None
        self.assertEqual(realtime_trade["origin"], "exchange")
        self.assertEqual(realtime_trade["symbol"], "SOLUSDT")

    def test_bybit_public_status_endpoint_returns_realtime_diagnostics(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=True,
            ticker_symbols=["BTCUSDT"],
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.market_data = market_client
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        public_status_code, public_status = self._get("/api/integrations/bybit-public")
        self.assertEqual(public_status_code, 200)
        self.assertTrue(public_status["enabled"])
        self.assertTrue(public_status["connected_linear"])
        self.assertTrue(public_status["rest_reachable"])
        self.assertIsNotNone(public_status["recommended_action"])
        btc_diag = next((item for item in public_status["watched_symbol_diagnostics"] if item["symbol"] == "BTCUSDT"), None)
        self.assertIsNotNone(btc_diag)
        assert btc_diag is not None
        self.assertEqual(btc_diag["channel"], "linear")
        self.assertTrue(btc_diag["connected"])
        self.assertIsNone(btc_diag["recommended_action"])

    def test_account_overview_prefers_wallet_entry_matching_configured_account_type(self) -> None:
        class StubMultiWalletBybitPrivateClient(StubConfiguredEmptyBybitPrivateClient):
            def get_status(self) -> BybitPrivateStatus:
                return BybitPrivateStatus(
                    configured=True,
                    can_query_private=True,
                    source="file",
                    api_base_url="https://api.bybit.com",
                    account_type="UNIFIED",
                    mode=AccountMode.LIVE,
                    key_hint="test...1234",
                    last_error=None,
                    updated_at="2026-03-30T00:00:00+08:00",
                )

            def fetch_wallet_balance(self) -> Dict[str, Any]:
                return {
                    "list": [
                        {
                            "accountType": "FUND",
                            "totalEquity": "25",
                            "totalWalletBalance": "25",
                            "totalAvailableBalance": "25",
                            "totalPerpUPL": "0",
                            "coin": [
                                {
                                    "coin": "USDT",
                                    "walletBalance": "25",
                                    "usdValue": "25",
                                    "transferBalance": "25",
                                }
                            ],
                        },
                        {
                            "accountType": "UNIFIED",
                            "totalEquity": "4200",
                            "totalWalletBalance": "4200",
                            "totalAvailableBalance": "4200",
                            "totalPerpUPL": "0",
                            "coin": [
                                {
                                    "coin": "USDT",
                                    "walletBalance": "4200",
                                    "usdValue": "4200",
                                    "transferBalance": "4200",
                                }
                            ],
                        },
                    ]
                }

        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubMultiWalletBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["account_type"], "UNIFIED")
        self.assertEqual(overview["total_available_balance"], "4,200.00 USDT")
        self.assertEqual(overview["top_holdings"][0]["available_balance"], "4,200.00")

    def test_paper_mode_prefers_derived_account_even_when_private_key_is_configured(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            orders=[
                {
                    "orderId": "live-order-001",
                    "orderLinkId": "manual-live-btc",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.15",
                    "price": "66500",
                    "orderStatus": "New",
                    "createdTime": "1774887000000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.PAPER
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.PAPER

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["source"], "paper")

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        self.assertTrue(all(item["source"] == "paper" for item in positions))

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertTrue(all(item["source"] == "paper" for item in history))

        live_overview_status, live_overview = self._get("/api/account/overview?mode=live")
        self.assertEqual(live_overview_status, 200)
        self.assertEqual(live_overview["source"], "bybit_private")
        self.assertEqual(live_overview["total_equity"], "5,000.00 USDT")

        live_positions_status, live_positions = self._get("/api/account/positions?mode=live")
        self.assertEqual(live_positions_status, 200)
        self.assertTrue(any(item["source"] == "bybit_private" and item["symbol"] == "BTCUSDT" for item in live_positions))

        live_orders_status, live_orders = self._get("/api/account/orders?mode=live")
        self.assertEqual(live_orders_status, 200)
        self.assertTrue(any(item["source"] == "bybit_private" and item["order_id"] == "live-order-001" for item in live_orders))

        live_history_status, live_history = self._get("/api/account/order-history?mode=live")
        self.assertEqual(live_history_status, 200)
        self.assertEqual(live_history, [])

        live_snapshot_status, live_snapshot = self._get("/api/account/live?mode=live")
        self.assertEqual(live_snapshot_status, 200)
        self.assertEqual(live_snapshot["overview"]["source"], "bybit_private")
        self.assertTrue(any(item["symbol"] == "BTCUSDT" for item in live_snapshot["positions"]))
        self.assertTrue(any(item["order_id"] == "live-order-001" for item in live_snapshot["orders"]))

    def test_watchlist_add_remove_updates_market_state_and_selected_symbol(self) -> None:
        watchlist_status, initial_watchlist = self._get("/api/market/watchlist")
        self.assertEqual(watchlist_status, 200)
        self.assertEqual(len(initial_watchlist), 4)

        add_status, added_item = self._post(
            "/api/market/watchlist",
            {
                "symbol": "XRPUSDT",
                "market": "perp",
                "requested_by": "unit_test",
            },
        )
        self.assertEqual(add_status, 200)
        self.assertEqual(added_item["symbol"], "XRPUSDT")
        self.assertEqual(added_item["market"], "perp")

        watchlist_status, updated_watchlist = self._get("/api/market/watchlist")
        self.assertEqual(watchlist_status, 200)
        self.assertEqual(len(updated_watchlist), 5)
        self.assertTrue(any(item["symbol"] == "XRPUSDT" for item in updated_watchlist))

        detail_status, market_detail = self._get("/api/market/XRPUSDT")
        self.assertEqual(detail_status, 200)
        self.assertEqual(market_detail["symbol"], "XRPUSDT")
        self.assertEqual(market_detail["source"], "bybit_rest")

        remove_status, remove_result = self._delete("/api/market/watchlist/BTCUSDT?requested_by=unit_test")
        self.assertEqual(remove_status, 200)
        self.assertTrue(remove_result["removed"])
        self.assertEqual(remove_result["next_selected_symbol"], "ETHUSDT")

        preferences_status, preferences = self._get("/api/workspace/preferences")
        self.assertEqual(preferences_status, 200)
        self.assertEqual(preferences["selected_symbol"], "ETHUSDT")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        event_types = [event["event_type"] for event in audit_events]
        self.assertIn("watchlist.added", event_types)
        self.assertIn("watchlist.removed", event_types)

    def test_remove_watchlist_item_keeps_selection_near_removed_symbol(self) -> None:
        update_status, _updated = self._post(
            "/api/workspace/preferences",
            {
                "active_section": "market",
                "layout_preset": "balanced",
                "selected_mode": "paper",
                "selected_symbol": "ETHUSDT",
                "selected_market_timeframe": "1h",
                "selected_strategy_id": "eth-revert-02",
                "overview_card_order": ["ai_center", "strategy_watch", "account_center"],
                "overview_visible_cards": ["ai_center", "strategy_watch", "account_center"],
                "overview_collapsed_cards": [],
            },
        )
        self.assertEqual(update_status, 200)

        remove_status, remove_result = self._delete("/api/market/watchlist/ETHUSDT?requested_by=unit_test")
        self.assertEqual(remove_status, 200)
        self.assertEqual(remove_result["next_selected_symbol"], "SOLUSDT")

        preferences_status, preferences = self._get("/api/workspace/preferences")
        self.assertEqual(preferences_status, 200)
        self.assertEqual(preferences["selected_symbol"], "SOLUSDT")

    def test_watchlist_alert_rule_update_generates_market_alert_without_duplicates(self) -> None:
        add_status, added_item = self._post(
            "/api/market/watchlist",
            {
                "symbol": "XRPUSDT",
                "market": "perp",
                "requested_by": "unit_test",
            },
        )
        self.assertEqual(add_status, 200)
        self.assertEqual(added_item["symbol"], "XRPUSDT")

        update_status, updated_rule = self._post(
            "/api/change-requests",
            {
                "type": "alert.rule.update",
                "payload": {"symbol": "XRPUSDT", "threshold_pct": 1.5, "alert_enabled": True, "cooldown_minutes": 45},
                "requested_by": "unit_test",
                "target_mode": "paper",
                "priority": "normal",
                "summary": "更新 XRP 提醒阈值",
            },
        )
        self.assertEqual(update_status, 200)
        self.assertEqual(updated_rule["status"], "applied")

        live_status, live_snapshot = self._get("/api/market/live?symbol=XRPUSDT&timeframe=1h")
        self.assertEqual(live_status, 200)
        self.assertEqual(live_snapshot["selected_symbol"], "XRPUSDT")

        rules_status, rules = self._get("/api/alert-rules")
        self.assertEqual(rules_status, 200)
        target_rule = next((item for item in rules if item["symbol"] == "XRPUSDT"), None)
        self.assertIsNotNone(target_rule)
        self.assertEqual(target_rule["threshold_pct"], 1.5)
        self.assertEqual(target_rule["cooldown_minutes"], 45)
        self.assertTrue(target_rule["enabled"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        rule_key = "watchlist-volatility:XRPUSDT:up"
        matching_alerts = [item for item in alerts if item.get("rule_key") == rule_key]
        self.assertEqual(len(matching_alerts), 1)
        self.assertEqual(matching_alerts[0]["severity"], "P2")
        self.assertFalse(matching_alerts[0]["acknowledged"])
        self.assertEqual(matching_alerts[0]["source_type"], "rule")
        self.assertEqual(matching_alerts[0]["rule_id"], target_rule["id"])
        self.assertEqual(matching_alerts[0]["threshold_value"], 1.5)
        self.assertEqual(matching_alerts[0]["trigger_value"], 1.83)

        ack_status, acknowledged = self._post(
            f"/api/alerts/{matching_alerts[0]['id']}/acknowledge",
            {"acknowledged": True, "requested_by": "unit_test"},
        )
        self.assertEqual(ack_status, 200)
        self.assertTrue(acknowledged["acknowledged"])

        second_live_status, _second_live_snapshot = self._get("/api/market/live?symbol=XRPUSDT&timeframe=1h")
        self.assertEqual(second_live_status, 200)

        alerts_status, refreshed_alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        refreshed_matching = [item for item in refreshed_alerts if item.get("rule_key") == rule_key]
        self.assertEqual(len(refreshed_matching), 1)
        self.assertTrue(refreshed_matching[0]["acknowledged"])
        self.assertEqual(sum(1 for item in refreshed_matching if not item["acknowledged"]), 0)

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertGreaterEqual(snapshot["alerts_summary"]["P2"], 0)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(
          any(
              item["event_type"] == "alert.market_triggered"
              and item["payload"].get("rule_key") == rule_key
              for item in audit_events
          )
        )

    def test_market_live_snapshot_returns_watchlist_and_detail_together(self) -> None:
        status, payload = self._get("/api/market/live?symbol=ETHUSDT")
        self.assertEqual(status, 200)
        self.assertEqual(payload["selected_symbol"], "ETHUSDT")
        self.assertEqual(payload["detail"]["symbol"], "ETHUSDT")
        self.assertEqual(payload["detail"]["source"], "bybit_rest")
        self.assertGreaterEqual(len(payload["detail"]["recent_public_trades"]), 1)
        self.assertGreaterEqual(len(payload["watchlist"]), 4)
        self.assertGreaterEqual(len(payload["watchlist_details"]), 4)
        self.assertEqual(
            [item["symbol"] for item in payload["watchlist_details"]],
            [item["symbol"] for item in payload["watchlist"]],
        )
        self.assertTrue(any(item["symbol"] == "ETHUSDT" for item in payload["watchlist_details"]))
        self.assertTrue(any(item["symbol"] == "ETHUSDT" for item in payload["watchlist"]))
        self.assertEqual(payload["diagnostics"]["requested_symbol"], "ETHUSDT")
        self.assertEqual(payload["diagnostics"]["effective_symbol"], "ETHUSDT")
        self.assertEqual(payload["diagnostics"]["timeframe"], "1h")
        self.assertEqual(payload["diagnostics"]["detail_source"], payload["detail"]["source"])
        self.assertEqual(payload["diagnostics"]["detail_candle_count"], len(payload["detail"]["candles"]))
        self.assertEqual(payload["diagnostics"]["watchlist_symbol_count"], len(payload["watchlist_details"]))
        self.assertGreaterEqual(payload["diagnostics"]["watchlist_real_detail_count"], 1)
        self.assertIn("bybit_rest", payload["diagnostics"]["watchlist_source_breakdown"])
        self.assertIn("generated_at", payload)

    def test_market_live_snapshot_uses_renderable_fallback_candles_when_live_fetch_fails(self) -> None:
        class FailingMarketLiveClient(StubBybitPublicMarketClient):
            def enrich_market_detail(
                self,
                symbol: str,
                market: str,
                fallback_detail: Any,
                watch_item: Optional[WatchlistInstrument] = None,
                timeframe: str = "1h",
                allow_rest_refresh: bool = True,
            ) -> Any:
                raise RuntimeError("Bybit public api request failed: timed out")

        original_market_data = control_main.market_data
        control_main.market_data = FailingMarketLiveClient()
        try:
            status, payload = self._get("/api/market/live?symbol=BNBUSDT&timeframe=1d")
        finally:
            control_main.market_data = original_market_data

        self.assertEqual(status, 200)
        self.assertEqual(payload["detail"]["symbol"], "BNBUSDT")
        self.assertEqual(payload["detail"]["timeframe"], "1d")
        self.assertGreater(len(payload["detail"]["candles"]), 0)
        self.assertIn("已回退到本地基线继续展示", payload["detail"]["headline"])
        self.assertEqual(payload["diagnostics"]["detail_source"], "fallback")
        self.assertEqual(payload["diagnostics"]["detail_candle_count"], len(payload["detail"]["candles"]))
        self.assertGreaterEqual(payload["diagnostics"]["watchlist_fallback_detail_count"], 1)
        selected_watch_item = next(item for item in payload["watchlist"] if item["symbol"] == "BNBUSDT")
        self.assertEqual(payload["detail"]["candles"][-1]["close"], selected_watch_item["last_price"])

    def test_market_live_snapshot_refreshes_selected_symbol_when_fast_path_has_no_candles(self) -> None:
        class SelectedSymbolRefreshMarketClient(StubBybitPublicMarketClient):
            def __init__(self) -> None:
                super().__init__()
                self.calls: list[tuple[str, str, bool]] = []

            def enrich_market_detail(
                self,
                symbol: str,
                market: str,
                fallback_detail: Any,
                watch_item: Optional[WatchlistInstrument] = None,
                timeframe: str = "1h",
                allow_rest_refresh: bool = True,
            ) -> Any:
                normalized_symbol = symbol.upper()
                self.calls.append((normalized_symbol, timeframe, allow_rest_refresh))
                item = watch_item or self._lookup_item(normalized_symbol, market)
                if normalized_symbol == "ETHUSDT" and not allow_rest_refresh:
                    return fallback_detail.model_copy(
                        update={
                            "symbol": normalized_symbol,
                            "timeframe": timeframe,
                            "candles": [],
                            "source": "fallback",
                            "updated_at": fallback_detail.updated_at,
                        }
                    )
                detail = build_market_detail_for_watchlist(item)
                return detail.model_copy(
                    update={
                        "symbol": normalized_symbol,
                        "timeframe": timeframe,
                        "source": "bybit_rest",
                        "updated_at": "2026-03-31T09:30:00+08:00",
                    }
                )

        original_market_data = control_main.market_data
        client = SelectedSymbolRefreshMarketClient()
        control_main.market_data = client
        try:
            status, payload = self._get("/api/market/live?symbol=ETHUSDT&timeframe=1h")
        finally:
            control_main.market_data = original_market_data

        self.assertEqual(status, 200)
        self.assertEqual(payload["selected_symbol"], "ETHUSDT")
        self.assertEqual(payload["detail"]["symbol"], "ETHUSDT")
        self.assertEqual(payload["detail"]["source"], "bybit_rest")
        self.assertGreater(len(payload["detail"]["candles"]), 0)
        self.assertEqual(payload["diagnostics"]["detail_source"], "bybit_rest")
        self.assertGreater(payload["diagnostics"]["detail_candle_count"], 0)
        self.assertIn(("ETHUSDT", "1h", False), client.calls)
        self.assertIn(("ETHUSDT", "1h", True), client.calls)

    def test_market_watchlist_endpoint_prefers_fast_path_by_default(self) -> None:
        status, payload = self._get("/api/market/watchlist")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(payload), 4)
        self.assertEqual(control_main.market_data.enrich_watchlist_fast_calls, 1)
        self.assertEqual(control_main.market_data.enrich_watchlist_calls, 1)

    def test_market_watchlist_endpoint_supports_explicit_full_refresh(self) -> None:
        status, payload = self._get("/api/market/watchlist?refresh=true")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(payload), 4)
        self.assertEqual(control_main.market_data.enrich_watchlist_fast_calls, 0)
        self.assertEqual(control_main.market_data.enrich_watchlist_calls, 1)

    def test_strategy_runtime_endpoint_generates_paper_trade_once_for_signal_change(self) -> None:
        original_market = control_main.market_data
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")

        initial_trades_status, initial_trades = self._get("/api/trades")
        self.assertEqual(initial_trades_status, 200)
        initial_eth_strategy_trades = len(
            [
                item
                for item in initial_trades
                if item["origin"] == "strategy" and item.get("strategy_id") == "eth-revert-02"
            ]
        )

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        eth_runtime = next((item for item in runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(eth_runtime)
        assert eth_runtime is not None
        self.assertEqual(eth_runtime["signal"], "long")
        self.assertEqual(eth_runtime["runtime_status"], "paper_only")
        self.assertGreater(eth_runtime["confidence"], 0)
        self.assertIsNotNone(eth_runtime["last_trade_id"])
        self.assertIsNotNone(eth_runtime["execution_preview"])
        self.assertTrue(eth_runtime["execution_preview"]["allowed"])
        self.assertEqual(eth_runtime["execution_preview"]["projected_position_side"], "long")

        after_status, after_trades = self._get("/api/trades")
        self.assertEqual(after_status, 200)
        after_eth_strategy_trades = len(
            [
                item
                for item in after_trades
                if item["origin"] == "strategy" and item.get("strategy_id") == "eth-revert-02"
            ]
        )
        self.assertEqual(after_eth_strategy_trades, initial_eth_strategy_trades + 1)

        second_runtime_status, second_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(second_runtime_status, 200)
        second_eth_runtime = next((item for item in second_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(second_eth_runtime)
        assert second_eth_runtime is not None
        self.assertEqual(second_eth_runtime["signal"], "long")
        self.assertIsNone(second_eth_runtime["execution_preview"])

        final_status, final_trades = self._get("/api/trades")
        self.assertEqual(final_status, 200)
        final_eth_strategy_trades = len(
            [
                item
                for item in final_trades
                if item["origin"] == "strategy" and item.get("strategy_id") == "eth-revert-02"
            ]
        )
        self.assertEqual(final_eth_strategy_trades, after_eth_strategy_trades)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.runtime.signal_changed" for item in audit_events))

    def test_execute_strategy_signal_endpoint_creates_manual_strategy_trade(self) -> None:
        original_market = control_main.market_data
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        eth_runtime = next((item for item in runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(eth_runtime)
        assert eth_runtime is not None
        self.assertTrue(eth_runtime["execution_preview"]["allowed"])

        control_main.repo.state.trades.insert(
            0,
            control_main.repo.state.trades[0].model_copy(
                update={
                    "id": "trade-strategy-drift-001",
                    "symbol": "ETHUSDT",
                    "market": "perp",
                    "mode": AccountMode.PAPER,
                    "origin": "strategy",
                    "side": Direction.SELL,
                    "quantity": 0.12,
                    "price": 94.0,
                    "strategy_id": "eth-revert-02",
                    "created_at": "2026-03-31T09:05:00+08:00",
                    "status": "filled",
                }
            ),
        )
        control_main.repo._persist(control_main.repo.state)

        drifted_runtime_status, drifted_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(drifted_runtime_status, 200)
        drifted_runtime = next((item for item in drifted_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(drifted_runtime)
        assert drifted_runtime is not None
        self.assertIsNotNone(drifted_runtime["execution_preview"])
        self.assertTrue(drifted_runtime["execution_preview"]["allowed"])
        self.assertIn(drifted_runtime["execution_preview"]["action"], {"开多", "加多"})

        execute_status, trade = self._post(
            "/api/strategies/eth-revert-02/execute",
            {"requested_by": "unit_test", "note": "execute current strategy signal"},
        )
        self.assertEqual(execute_status, 200)
        self.assertEqual(trade["strategy_id"], "eth-revert-02")
        self.assertEqual(trade["kind"], "paper_trade")
        self.assertEqual(trade["mode"], "paper")
        self.assertEqual(trade["trade"]["origin"], "strategy")
        self.assertEqual(trade["trade"]["mode"], "paper")
        self.assertEqual(trade["trade"]["side"], "buy")

        second_runtime_status, second_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(second_runtime_status, 200)
        second_eth_runtime = next((item for item in second_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(second_eth_runtime)
        assert second_eth_runtime is not None
        self.assertEqual(second_eth_runtime["last_trade_id"], trade["trade"]["id"])
        self.assertTrue(
            second_eth_runtime["execution_preview"] is None
            or not second_eth_runtime["execution_preview"]["allowed"]
            or second_eth_runtime["execution_preview"]["projected_position_side"] == "long"
        )

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.paper_trade.executed_manual" for item in audit_events))

    def test_execute_strategy_signal_endpoint_rejects_paused_strategy(self) -> None:
        target = next(item for item in control_main.repo.state.strategies if item.id == "eth-revert-02")
        target.status = "paused"

        execute_status, payload = self._post(
            "/api/strategies/eth-revert-02/execute",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(execute_status, 409)
        self.assertIn("已暂停", payload["detail"])

    def test_strategy_execution_preview_endpoint_builds_live_advisory_preview(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertEqual(preview["mode"], "live")
        self.assertEqual(preview["origin"], "strategy")
        self.assertEqual(preview["symbol"], "BTCUSDT")
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["side"], "sell")
        self.assertAlmostEqual(preview["quantity"], 0.1342, places=4)

    def test_strategy_execution_preview_endpoint_aligns_live_target_quantity_to_bybit_qty_step(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["side"], "sell")
        self.assertAlmostEqual(preview["quantity"], 0.135, places=6)
        self.assertIn("数量步长 0.001", preview["warnings"][0])
        self.assertIn("收敛到 0.015", preview["warnings"][0])

    def test_strategy_execution_preview_reports_recommended_action_when_live_balance_is_insufficient(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("当前可用", preview["blocked_reason"])
        self.assertIn("UNIFIED 账户可用", preview["recommended_action"])

    def test_strategy_execution_preview_endpoint_caps_live_target_quantity_by_available_balance(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "100",
                "totalWalletBalance": "100",
                "totalAvailableBalance": "100",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "100",
                        "availableToWithdraw": "100",
                    }
                ],
            },
            positions=[
                {
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Buy",
                    "size": "1",
                    "avgPrice": "2000",
                    "markPrice": "2005",
                    "positionValue": "2005",
                    "leverage": "1",
                    "unrealisedPnl": "5",
                }
            ],
            connected=True,
            authenticated=True,
        )

        def balance_capped_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "risk_budget": "100%",
                "target_signed_qty": 0.015,
                "price": 68450.0,
                "note": "balance linked sizing preview",
            }

        control_main.repo.get_strategy_signal_order_hint = balance_capped_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["side"], "buy")
        self.assertAlmostEqual(preview["quantity"], 0.001, places=6)
        self.assertEqual(preview["notional"], "68.45 USDT")
        self.assertTrue(any("账户可用余额 100.00 USDT" in item for item in preview["warnings"]))
        self.assertTrue(any("risk_budget 100%" in item for item in preview["warnings"]))
        self.assertTrue(any("数量步长 0.001" in item for item in preview["warnings"]))

    def test_strategy_execution_preview_endpoint_blocks_live_when_balance_linked_target_is_below_min_order_qty(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "20",
                "totalWalletBalance": "20",
                "totalAvailableBalance": "20",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "20",
                        "availableToWithdraw": "20",
                    }
                ],
            },
            positions=[
                {
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Buy",
                    "size": "1",
                    "avgPrice": "2000",
                    "markPrice": "2005",
                    "positionValue": "2005",
                    "leverage": "1",
                    "unrealisedPnl": "5",
                }
            ],
            connected=True,
            authenticated=True,
        )

        def tiny_balance_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": 0.015,
                "price": 68450.0,
                "note": "tiny balance preview",
            }

        control_main.repo.get_strategy_signal_order_hint = tiny_balance_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertEqual(preview["side"], "buy")
        self.assertLess(preview["quantity"], 0.001)
        self.assertEqual(preview["notional"], "3.60 USDT")
        self.assertIn("当前 Bybit 可用余额 20.00 USDT", preview["blocked_reason"])
        self.assertIn("risk_budget 18%", preview["blocked_reason"])
        self.assertIn("最小下单数量 0.001", preview["blocked_reason"])
        self.assertIn("risk_budget", preview["recommended_action"])
        self.assertEqual(preview["sizing_risk_budget"], "18%")
        self.assertEqual(preview["sizing_budget_notional"], "3.60 USDT")
        self.assertEqual(preview["sizing_minimum_required_notional"], "68.45 USDT")
        self.assertIn("360.28 USDT", preview["recommended_action"])
        self.assertEqual(preview["sizing_available_balance_gap"], "360.28 USDT")
        self.assertNotIn("1,015", preview["blocked_reason"])

    def test_strategy_execution_preview_releases_existing_strategy_buy_order_reservation_for_balance_linked_sizing(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "0",
                "totalWalletBalance": "0",
                "totalAvailableBalance": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "0",
                        "availableToWithdraw": "0",
                    }
                ],
            },
            orders=[
                {
                    "orderId": "live-open-strategy-balance-001",
                    "orderLinkId": "strategy-live-trend-btc-01-balance001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.001",
                    "price": "68450",
                    "orderStatus": "New",
                    "createdTime": str(now_ms),
                }
            ],
            connected=True,
            authenticated=True,
        )

        def reserved_balance_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": 0.001,
                "price": 68450.0,
                "note": "reuse reserved strategy order",
            }

        control_main.repo.get_strategy_signal_order_hint = reserved_balance_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["quantity"], 0.001)
        self.assertEqual(preview["notional"], "68.45 USDT")
        self.assertIn("当前已有同参数策略委托", preview["warnings"][-1])

    def test_strategy_execution_preview_allows_perp_flip_by_reusing_current_position_capacity(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "0",
                "totalWalletBalance": "0",
                "totalAvailableBalance": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "0",
                        "availableToWithdraw": "0",
                    }
                ],
            },
            positions=[
                {
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "size": "0.01",
                    "avgPrice": "68520",
                    "markPrice": "68450",
                    "positionValue": "684.5",
                    "leverage": "1",
                    "unrealisedPnl": "0.7",
                }
            ],
            connected=True,
            authenticated=True,
        )

        def flip_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": 0.02,
                "price": 68450.0,
                "note": "perp flip balance linked preview",
            }

        control_main.repo.get_strategy_signal_order_hint = flip_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["side"], "buy")
        self.assertAlmostEqual(preview["quantity"], 0.02, places=6)
        self.assertEqual(preview["projected_position_side"], "long")
        self.assertEqual(preview["projected_position_size"], "0.01")
        self.assertTrue(any("账户可用余额 0.00 USDT" in item and "收敛到 0.01" in item for item in preview["warnings"]))

    def test_strategy_execution_preview_endpoint_aligns_live_price_to_bybit_tick_size(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"tick_size": "0.1"},
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)

        def misaligned_price_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "price": 68450.07,
            }

        control_main.repo.get_strategy_signal_order_hint = misaligned_price_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertIsNone(preview["blocked_reason"])
        self.assertAlmostEqual(preview["price"], 68450.1, places=6)
        self.assertIn("价格步长 0.1", preview["warnings"][0])

    def test_strategy_execution_preview_endpoint_blocks_live_when_runtime_worker_is_unhealthy(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": None,
                "last_error": "runtime boom",
            }
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 409)
        self.assertIn("恢复运行线程", preview["detail"])

    def test_strategy_execution_preview_endpoint_blocks_live_when_runtime_worker_is_stopped(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": datetime.now(timezone.utc).astimezone().isoformat(),
                "last_error": None,
                "started_once": True,
            }
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 409)
        self.assertIn("恢复运行线程", preview["detail"])

    def test_strategy_runtime_endpoint_embeds_live_execution_preview_for_selected_mode(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        preview = runtime_snapshot.get("execution_preview")
        self.assertIsNotNone(preview)
        assert preview is not None
        self.assertEqual(preview["mode"], "live")
        self.assertEqual(preview["origin"], "strategy")
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["side"], "sell")

    def test_strategy_runtime_endpoint_uses_balance_linked_target_size_for_live_summary(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "20",
                "totalWalletBalance": "20",
                "totalAvailableBalance": "20",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "20",
                        "availableToWithdraw": "20",
                    }
                ],
            },
            positions=[
                {
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Buy",
                    "size": "1",
                    "avgPrice": "2000",
                    "markPrice": "2005",
                    "positionValue": "2005",
                    "leverage": "1",
                    "unrealisedPnl": "5",
                }
            ],
            connected=True,
            authenticated=True,
        )

        def tiny_balance_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": 0.015,
                "price": 68450.0,
                "note": "runtime balance linked sizing",
            }

        control_main.repo.get_strategy_signal_order_hint = tiny_balance_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["position_alignment"], "unknown")
        self.assertEqual(runtime_snapshot["target_position_side"], "long")
        self.assertEqual(runtime_snapshot["target_position_size"], "0.000053")
        self.assertIn("当前 Bybit 可用余额 20.00 USDT", runtime_snapshot["position_alignment_detail"])
        self.assertIn("risk_budget 18%", runtime_snapshot["position_alignment_detail"])
        preview = runtime_snapshot.get("execution_preview")
        self.assertIsNotNone(preview)
        assert preview is not None
        self.assertFalse(preview["allowed"])
        self.assertEqual(preview["notional"], "3.60 USDT")
        self.assertEqual(preview["sizing_risk_budget"], "18%")
        self.assertEqual(preview["sizing_budget_notional"], "3.60 USDT")
        self.assertEqual(preview["sizing_minimum_required_notional"], "68.45 USDT")
        self.assertEqual(preview["sizing_available_balance_gap"], "360.28 USDT")

    def test_strategy_runtime_and_control_snapshot_surface_live_balance_block_without_existing_alert(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("当前 Bybit 可用余额不足", runtime_snapshot["guard_detail"])
        self.assertIn("当前 Bybit 可用余额不足", runtime_snapshot["note"])
        self.assertIn("UNIFIED 账户可用余额", runtime_snapshot["next_action"])
        preview = runtime_snapshot.get("execution_preview")
        self.assertIsNotNone(preview)
        assert preview is not None
        self.assertFalse(preview["allowed"])
        self.assertIn("UNIFIED 账户可用余额", preview["recommended_action"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertFalse(any(str(item.get("rule_key") or "").startswith("strategy-auto-dispatch:trend-btc-01:") for item in alerts))

        snapshot_status, control_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(control_snapshot["strategy_metrics"][0]["delta"], "执行受阻 1")
        self.assertEqual(control_snapshot["execution_health"]["auto_dispatch_blocked"], 1)
        self.assertEqual(control_snapshot["execution_health"]["top_issue"], "执行受阻 1")
        self.assertIn("当前 Bybit 可用余额不足", control_snapshot["execution_health"]["top_issue_detail"])
        self.assertIn("UNIFIED 账户可用余额", control_snapshot["execution_health"]["top_issue_recommended_action"])

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertIn(
            'bybit_control_strategy_auto_dispatch_blocked{strategy_id="trend-btc-01",mode="live",status="running"} 1',
            metrics_body,
        )

    def test_strategy_runtime_prefers_latest_block_detail_when_selected_mode_differs(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        blocked_detail = "当前 Bybit 可用余额不足，当前可用 0.00 USDT，按该价格提交本次买入约需 1,014.87 USDT。"
        blocked_action = "请先补充 UNIFIED 账户可用余额，或先把资金划转到 UNIFIED 后再重试。"
        control_main.repo.state.alerts.insert(
            0,
            AlertRecord(
                id="alert-auto-dispatch-balance-001",
                severity="P1",
                symbol="BTCUSDT",
                title="BTCUSDT 自动执行被拦截",
                description=f"BTC 趋势跟随 在 LIVE 自动执行时被阻断。{blocked_detail}",
                triggered_at="2026-03-31T00:00:00+08:00",
                suggested_action="切到策略页查看执行预检与当前委托，必要时进入人工接管。",
                acknowledged=False,
                source_type="system",
                rule_key="strategy-auto-dispatch:trend-btc-01:long:live",
            ),
        )
        control_main.repo.add_event(
            event_type="strategy.exchange_order.auto_blocked",
            source="quant-core",
            severity=control_main.EventSeverity.WARNING,
            payload={
                "strategy_id": "trend-btc-01",
                "strategy_name": "BTC 趋势跟随",
                "symbol": "BTCUSDT",
                "mode": AccountMode.LIVE.value,
                "detail": blocked_detail,
                "recommended_action": blocked_action,
            },
            symbol="BTCUSDT",
            strategy_id="trend-btc-01",
        )

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertTrue(any(str(item.get("rule_key") or "").startswith("strategy-auto-dispatch:trend-btc-01:") for item in alerts))

        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.PAPER
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.PAPER

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("当前 Bybit 可用余额不足", runtime_snapshot["guard_detail"])
        self.assertIn("当前 Bybit 可用余额不足", runtime_snapshot["note"])
        self.assertEqual(runtime_snapshot["next_action"], blocked_action)
        self.assertIsNone(runtime_snapshot.get("execution_preview"))

        snapshot_status, control_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(control_snapshot["execution_health"]["top_issue"], "执行受阻 1")
        self.assertIn("当前 Bybit 可用余额不足", control_snapshot["execution_health"]["top_issue_detail"])
        self.assertEqual(control_snapshot["execution_health"]["top_issue_recommended_action"], blocked_action)

    def test_strategy_activity_endpoint_includes_strategy_mode_execution_preview_when_selected_mode_differs(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.PAPER
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.PAPER

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertIsNone(runtime_snapshot.get("execution_preview"))

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        runtime = activity.get("runtime")
        self.assertIsInstance(runtime, dict)
        assert isinstance(runtime, dict)
        preview = runtime.get("execution_preview")
        self.assertIsInstance(preview, dict)
        assert isinstance(preview, dict)
        self.assertEqual(preview["mode"], "live")
        self.assertFalse(preview["allowed"])
        self.assertIn("当前 Bybit 可用余额不足", preview["blocked_reason"])
        self.assertIn("UNIFIED 账户可用余额", preview["recommended_action"])
        self.assertEqual(runtime["guard_state"], "auto_dispatch_blocked")
        self.assertIn("当前 Bybit 可用余额不足", runtime["guard_detail"])
        self.assertIn("UNIFIED 账户可用余额", runtime["next_action"])

    def test_record_strategy_auto_dispatch_balance_issue_uses_account_type_suggested_action(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.private_data = private_client
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        control_main.repo.state.alerts = []

        blocked_detail = "当前 Bybit 可用余额不足，当前可用 0.00 USDT，按该价格提交本次买入约需 1,014.87 USDT。"
        blocked_action = "当前还差 1,014.87 USDT，请补足 UNIFIED 账户可用余额，或降低下单数量后再重试。"
        control_main._record_strategy_auto_dispatch_issue(
            "trend-btc-01",
            "BTC 趋势跟随",
            "BTCUSDT",
            "long",
            AccountMode.LIVE,
            blocked_detail,
            recommended_action=blocked_action,
        )

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        auto_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-auto-dispatch:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(auto_alert)
        assert auto_alert is not None
        self.assertEqual(auto_alert["suggested_action"], blocked_action)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        blocked_event = next((item for item in audit_events if item["event_type"] == "strategy.exchange_order.auto_blocked"), None)
        self.assertIsNotNone(blocked_event)
        assert blocked_event is not None
        self.assertEqual(blocked_event["payload"]["recommended_action"], blocked_action)

        snapshot_status, control_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(control_snapshot["execution_health"]["top_issue"], "执行受阻 1")
        self.assertEqual(control_snapshot["execution_health"]["top_issue_recommended_action"], blocked_action)

    def test_strategy_runtime_endpoint_blocks_live_execution_preview_when_runtime_worker_is_unhealthy(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": None,
                "last_error": "runtime boom",
            }
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        preview = runtime_snapshot.get("execution_preview")
        self.assertIsNotNone(preview)
        assert preview is not None
        self.assertEqual(preview["mode"], "live")
        self.assertFalse(preview["allowed"])
        self.assertIn("恢复运行线程", preview["blocked_reason"])
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("恢复运行线程", runtime_snapshot["guard_detail"])
        self.assertIn("恢复运行线程", runtime_snapshot["note"])
        self.assertIn("恢复运行线程", runtime_snapshot["next_action"])

    def test_strategy_execution_preview_endpoint_blocks_live_when_private_ws_is_unavailable(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=False,
            authenticated=False,
            last_error="EOF occurred in violation of protocol (_ssl.c:1129)",
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("私有 WS", preview["blocked_reason"])
        self.assertIn("TLS", preview["recommended_action"])

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("私有 WS", runtime_snapshot["guard_detail"])
        self.assertIn("私有 WS", runtime_snapshot["note"])
        self.assertIn("TLS", runtime_snapshot["next_action"])

        private_status_code, private_status = self._get("/api/integrations/bybit-private")
        self.assertEqual(private_status_code, 200)
        self.assertEqual(private_status["realtime_last_error"], "EOF occurred in violation of protocol (_ssl.c:1129)")
        self.assertIn("REST 已可达", private_status["realtime_recommended_action"])

    def test_strategy_execution_preview_endpoint_blocks_live_when_private_ws_is_stale(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            last_message_at="2026-03-29T08:00:00+08:00",
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        status_code, private_status = self._get("/api/integrations/bybit-private")
        self.assertEqual(status_code, 200)
        self.assertTrue(private_status["realtime_stale"])
        self.assertGreater(private_status["realtime_stale_seconds"], 0)

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("超过约", preview["blocked_reason"])
        self.assertIn("私有 WS", preview["blocked_reason"])

    def test_strategy_execution_preview_endpoint_blocks_live_when_public_ws_is_unavailable(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=False,
            ticker_symbols=[],
        )
        control_main.market_data = market_client
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("公共 WS", preview["blocked_reason"])

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("公共 WS", runtime_snapshot["guard_detail"])
        self.assertIn("公共 WS", runtime_snapshot["note"])
        self.assertIn("Bybit 公共实时链路", runtime_snapshot["next_action"])

    def test_strategy_runtime_endpoint_blocks_live_execution_preview_when_runtime_worker_is_stopped(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": datetime.now(timezone.utc).astimezone().isoformat(),
                "last_error": None,
                "started_once": True,
            }
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        preview = runtime_snapshot.get("execution_preview")
        self.assertIsNotNone(preview)
        assert preview is not None
        self.assertEqual(preview["mode"], "live")
        self.assertFalse(preview["allowed"])
        self.assertIn("恢复运行线程", preview["blocked_reason"])
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("恢复运行线程", runtime_snapshot["guard_detail"])
        self.assertIn("恢复运行线程", runtime_snapshot["note"])
        self.assertIn("恢复运行线程", runtime_snapshot["next_action"])

    def test_execute_strategy_signal_endpoint_submits_live_exchange_order(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "dispatch live strategy signal"},
        )
        self.assertEqual(execute_status, 200)
        self.assertEqual(result["kind"], "exchange_order")
        self.assertEqual(result["mode"], "live")
        self.assertEqual(result["order"]["source"], "bybit_private")
        self.assertEqual(result["order"]["origin"], "strategy")
        self.assertEqual(result["order"]["strategy_id"], "trend-btc-01")
        self.assertEqual(result["order"]["symbol"], "BTCUSDT")
        self.assertTrue(private_client.created_order_bodies)
        created_body = private_client.created_order_bodies[-1]
        self.assertEqual(created_body["symbol"], "BTCUSDT")
        self.assertEqual(created_body["side"], "Sell")

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        strategy_order = next((item for item in orders if item["order_id"] == result["order"]["order_id"]), None)
        self.assertIsNotNone(strategy_order)
        self.assertEqual(strategy_order["origin"], "strategy")
        self.assertEqual(strategy_order["strategy_id"], "trend-btc-01")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)

    def test_execute_strategy_signal_endpoint_blocks_live_when_runtime_worker_is_unhealthy(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": None,
                "last_error": "runtime boom",
            }
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "dispatch live strategy signal"},
        )
        self.assertEqual(execute_status, 409)
        self.assertIn("恢复运行线程", result["detail"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        blocked_event = next((item for item in audit_events if item["event_type"] == "strategy.execution.blocked"), None)
        self.assertIsNotNone(blocked_event)
        assert blocked_event is not None
        self.assertEqual(blocked_event["strategy_id"], "trend-btc-01")
        self.assertIn("恢复运行线程", blocked_event["payload"]["detail"])

        alerts_status, alerts_payload = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        blocked_alert = next(
            (
                item
                for item in alerts_payload
                if item["source_type"] == "system" and item["title"] == "BTCUSDT 手动策略执行被拦截"
            ),
            None,
        )
        self.assertIsNotNone(blocked_alert)

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        issue_job = next(
            (
                item
                for item in activity["recent_agent_jobs"]
                if item["job_type"] == "review_strategy_issue"
            ),
            None,
        )
        self.assertIsNotNone(issue_job)

    def test_execute_strategy_signal_endpoint_blocks_live_when_runtime_worker_is_stopped(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": datetime.now(timezone.utc).astimezone().isoformat(),
                "last_error": None,
                "started_once": True,
            }
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "dispatch live strategy signal"},
        )
        self.assertEqual(execute_status, 409)
        self.assertIn("恢复运行线程", result["detail"])

        alerts_status, alerts_payload = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        blocked_alert = next(
            (
                item
                for item in alerts_payload
                if item["source_type"] == "system" and item["title"] == "BTCUSDT 手动策略执行被拦截"
            ),
            None,
        )
        self.assertIsNotNone(blocked_alert)

    def test_execute_strategy_signal_endpoint_surfaces_recommended_action_when_live_balance_is_insufficient(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "dispatch live strategy signal"},
        )
        self.assertEqual(execute_status, 409)
        self.assertIn("当前 Bybit 可用余额不足", result["detail"])
        self.assertIn("建议 按当前策略 risk_budget 18%", result["detail"])
        self.assertIn("账户可用余额还差约", result["detail"])
        self.assertIn("UNIFIED 账户可用余额", result["detail"])
        self.assertIn("risk_budget", result["detail"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        blocked_event = next((item for item in audit_events if item["event_type"] == "strategy.execution.blocked"), None)
        self.assertIsNotNone(blocked_event)
        assert blocked_event is not None
        self.assertIn("当前 Bybit 可用余额不足", blocked_event["payload"]["detail"])
        self.assertIn("UNIFIED 账户可用余额", blocked_event["payload"]["recommended_action"])

        alerts_status, alerts_payload = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        blocked_alert = next(
            (
                item
                for item in alerts_payload
                if item["source_type"] == "system" and item["title"] == "BTCUSDT 手动策略执行被拦截"
            ),
            None,
        )
        self.assertIsNotNone(blocked_alert)
        assert blocked_alert is not None
        self.assertIn("UNIFIED 账户可用余额", blocked_alert["suggested_action"])

    def test_execute_strategy_signal_endpoint_resolves_blocked_live_alert_after_later_success(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": None,
                "last_error": "runtime boom",
            }
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        blocked_status, _ = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "blocked live strategy signal"},
        )
        self.assertEqual(blocked_status, 409)

        alerts_status, alerts_payload = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        blocked_alert = next(
            (
                item
                for item in alerts_payload
                if item["source_type"] == "system" and item["title"] == "BTCUSDT 手动策略执行被拦截"
            ),
            None,
        )
        self.assertIsNotNone(blocked_alert)
        assert blocked_alert is not None
        self.assertFalse(blocked_alert["acknowledged"])

        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": None,
                "last_error": None,
            }
        )

        success_status, success_result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "recovered live strategy signal"},
        )
        self.assertEqual(success_status, 200)
        self.assertEqual(success_result["kind"], "exchange_order")

        refreshed_alerts_status, refreshed_alerts = self._get("/api/alerts")
        self.assertEqual(refreshed_alerts_status, 200)
        refreshed_blocked_alert = next((item for item in refreshed_alerts if item["id"] == blocked_alert["id"]), None)
        self.assertIsNotNone(refreshed_blocked_alert)
        assert refreshed_blocked_alert is not None
        self.assertTrue(refreshed_blocked_alert["acknowledged"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        blocked_resolved_event = next(
            (item for item in audit_events if item["event_type"] == "strategy.execution.blocked_resolved"),
            None,
        )
        self.assertIsNotNone(blocked_resolved_event)
        assert blocked_resolved_event is not None
        self.assertEqual(blocked_resolved_event["strategy_id"], "trend-btc-01")
        self.assertEqual(blocked_resolved_event["payload"]["mode"], "live")

    def test_execute_strategy_signal_endpoint_blocks_live_when_private_ws_is_unavailable(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=False, authenticated=False)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, payload = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "private ws down"},
        )
        self.assertEqual(execute_status, 409)
        self.assertIn("私有 WS", payload["detail"])
        self.assertEqual(len(private_client.created_order_bodies), 0)

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        blocked_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-blocked-execution:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(blocked_alert)
        assert blocked_alert is not None
        self.assertIn("私有 WS", blocked_alert["description"])

    def test_execute_strategy_signal_endpoint_blocks_live_when_private_ws_is_stale(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            last_message_at="2026-03-29T08:00:00+08:00",
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, payload = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "private ws stale"},
        )
        self.assertEqual(execute_status, 409)
        self.assertIn("私有 WS", payload["detail"])
        self.assertIn("超过约", payload["detail"])
        self.assertEqual(len(private_client.created_order_bodies), 0)

    def test_execute_strategy_signal_endpoint_blocks_live_when_public_ws_is_stale(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=True,
            ticker_symbols=["BTCUSDT"],
            symbol_last_message_at={"BTCUSDT": "2026-03-29T08:00:00+08:00"},
            last_message_at_linear="2026-03-29T08:00:00+08:00",
        )
        control_main.market_data = market_client
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, payload = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "public ws stale"},
        )
        self.assertEqual(execute_status, 409)
        self.assertIn("公共 WS", payload["detail"])
        self.assertIn("超过约", payload["detail"])
        self.assertEqual(len(private_client.created_order_bodies), 0)

    def test_execute_strategy_signal_endpoint_reuses_existing_live_strategy_order_without_amend(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        first_status, first_result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "first live strategy order"},
        )
        self.assertEqual(first_status, 200)
        self.assertEqual(first_result["order"]["origin"], "strategy")
        self.assertEqual(len(private_client.created_order_bodies), 1)
        self.assertEqual(len(private_client.amended_order_bodies), 0)

        second_status, second_result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "second live strategy order"},
        )
        self.assertEqual(second_status, 200)
        self.assertEqual(second_result["order"]["order_id"], first_result["order"]["order_id"])
        self.assertEqual(second_result["order"]["origin"], "strategy")
        self.assertEqual(len(private_client.created_order_bodies), 1)
        self.assertEqual(len(private_client.amended_order_bodies), 0)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.reused_existing" for item in audit_events))

    def test_execute_strategy_signal_endpoint_reuses_existing_live_strategy_order_even_when_balance_is_fully_reserved(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=4.2,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        private_client.fetch_positions = lambda: []
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "0",
                "totalWalletBalance": "0",
                "totalAvailableBalance": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "0",
                        "availableToWithdraw": "0",
                    }
                ],
            },
            orders=[
                {
                    "orderId": "live-open-strategy-balance-001",
                    "orderLinkId": "strategy-live-trend-btc-01-balance001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.001",
                    "price": "68450",
                    "orderStatus": "New",
                    "createdTime": str(now_ms),
                }
            ],
            connected=True,
            authenticated=True,
        )

        def reserved_balance_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": 0.001,
                "price": 68450.0,
                "note": "reuse reserved strategy order",
            }

        control_main.repo.get_strategy_signal_order_hint = reserved_balance_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "reuse reserved live strategy order"},
        )
        self.assertEqual(execute_status, 200)
        self.assertEqual(result["order"]["order_id"], "live-open-strategy-balance-001")
        self.assertEqual(result["order"]["origin"], "strategy")
        self.assertEqual(private_client.created_order_bodies, [])
        self.assertEqual(private_client.amended_order_bodies, [])

    def test_execute_strategy_signal_endpoint_reuses_existing_live_strategy_sell_order_even_when_margin_is_fully_reserved(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=4.2,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        private_client.fetch_positions = lambda: []
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "0",
                "totalWalletBalance": "0",
                "totalAvailableBalance": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "0",
                        "availableToWithdraw": "0",
                    }
                ],
            },
            orders=[
                {
                    "orderId": "live-open-strategy-sell-balance-001",
                    "orderLinkId": "strategy-live-trend-btc-01-sellbalance001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.001",
                    "price": "68450",
                    "orderStatus": "New",
                    "createdTime": str(now_ms),
                }
            ],
            connected=True,
            authenticated=True,
        )

        def reserved_sell_balance_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": -0.001,
                "price": 68450.0,
                "note": "reuse reserved strategy sell order",
            }

        control_main.repo.get_strategy_signal_order_hint = reserved_sell_balance_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "reuse reserved live strategy sell order"},
        )
        self.assertEqual(execute_status, 200)
        self.assertEqual(result["order"]["order_id"], "live-open-strategy-sell-balance-001")
        self.assertEqual(result["order"]["origin"], "strategy")
        self.assertEqual(private_client.created_order_bodies, [])
        self.assertEqual(private_client.amended_order_bodies, [])

    def test_execute_strategy_signal_endpoint_amends_existing_order_to_add_reduce_only_when_needed(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        original_hint_getter = control_main.repo.get_strategy_signal_order_hint
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66800.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            orders=[
                {
                    "orderId": "live-open-strategy-reduce-only-001",
                    "orderLinkId": "strategy-live-trend-btc-01-reduceonly001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.05",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )

        def reduce_only_hint(strategy_id: str) -> Dict[str, Any]:
            hint = original_hint_getter(strategy_id)
            return {
                **hint,
                "target_signed_qty": 0.10,
                "price": 66800.0,
                "note": "align reduce-only strategy order",
            }

        control_main.repo.get_strategy_signal_order_hint = reduce_only_hint  # type: ignore[method-assign]
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        self.addCleanup(lambda: setattr(control_main.repo, "get_strategy_signal_order_hint", original_hint_getter))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        execute_status, result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "align reduce-only strategy order"},
        )
        self.assertEqual(execute_status, 200)
        self.assertEqual(result["order"]["order_id"], "live-open-strategy-reduce-only-001")
        self.assertEqual(private_client.created_order_bodies, [])
        self.assertEqual(len(private_client.amended_order_bodies), 1)
        self.assertTrue(private_client.amended_order_bodies[-1].get("reduceOnly"))

    def test_execute_strategy_signal_endpoint_replaces_existing_live_strategy_order_when_target_changes(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 95,
                high=66290.0 + hour * 95,
                low=66130.0 + hour * 95,
                close=66250.0 + hour * 95,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68520.0,
            change_24h=4.2,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        realtime_client = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        control_main.private_data = private_client
        control_main.private_realtime = realtime_client
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        first_status, first_result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "first live strategy order"},
        )
        self.assertEqual(first_status, 200)
        self.assertEqual(len(private_client.created_order_bodies), 1)
        self.assertEqual(len(private_client.amended_order_bodies), 0)

        realtime_client.seed_open_orders_snapshot(
            [
                {
                    "orderId": first_result["order"]["order_id"],
                    "orderLinkId": first_result["order"].get("order_link_id") or "strategy-live-trend-btc-01-deadbeef",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.10",
                    "price": "69999",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ]
        )

        second_status, second_result = self._post(
            "/api/strategies/trend-btc-01/execute",
            {"requested_by": "unit_test", "mode": "live", "note": "second live strategy order"},
        )
        self.assertEqual(second_status, 200)
        self.assertEqual(second_result["order"]["order_id"], first_result["order"]["order_id"])
        self.assertEqual(len(private_client.created_order_bodies), 1)
        self.assertEqual(len(private_client.amended_order_bodies), 1)
        self.assertEqual(private_client.amended_order_bodies[-1]["orderId"], first_result["order"]["order_id"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.replaced_existing" for item in audit_events))

    def test_strategy_runtime_refresh_auto_dispatches_live_strategy_signal(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.PAPER
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.PAPER
        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=28.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertTrue(private_client.created_order_bodies)
        created_body = private_client.created_order_bodies[-1]
        self.assertEqual(created_body["symbol"], "BTCUSDT")
        self.assertEqual(created_body["side"], "Sell")

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["active_order_count"], 1)
        self.assertIsNotNone(runtime_snapshot["active_order"])
        self.assertEqual(runtime_snapshot["active_order"]["strategy_id"], "trend-btc-01")
        self.assertEqual(runtime_snapshot["active_order"]["status"], "New")
        self.assertEqual(runtime_snapshot["current_position_side"], "long")
        self.assertEqual(runtime_snapshot["current_position_size"], "0.15")
        self.assertEqual(runtime_snapshot["current_position_avg_price"], "66,500.00")
        self.assertEqual(runtime_snapshot["target_position_side"], "short")
        self.assertEqual(runtime_snapshot["position_alignment"], "reconciling")
        self.assertIn("正在向目标仓位对齐", runtime_snapshot["position_alignment_detail"])
        self.assertEqual(runtime_snapshot["last_execution_event_type"], "strategy.exchange_order.submitted")
        self.assertEqual(runtime_snapshot["last_execution_severity"], "info")
        self.assertIn("order_id=", runtime_snapshot["last_execution_detail"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.submitted" for item in audit_events))

    def test_strategy_runtime_refresh_auto_dispatches_live_strategy_signal_with_qty_step_aligned_target(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
            instrument_constraints={"qty_step": "0.001", "min_order_qty": "0.001"},
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.PAPER
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.PAPER
        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=28.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertTrue(private_client.created_order_bodies)
        created_body = private_client.created_order_bodies[-1]
        self.assertEqual(created_body["symbol"], "BTCUSDT")
        self.assertEqual(created_body["side"], "Sell")
        self.assertEqual(created_body["qty"], "0.166")

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["target_position_size"], "0.016")
        self.assertEqual(runtime_snapshot["position_alignment"], "reconciling")

    def test_strategy_runtime_endpoint_does_not_auto_dispatch_live_strategy_signal(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=28.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        self.assertEqual(private_client.created_order_bodies, [])

    def test_strategy_runtime_refresh_cancels_live_strategy_orders_when_strategy_enters_shadow(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66800.0 + (5 if hour % 2 == 0 else -5),
                high=66830.0,
                low=66770.0,
                close=66805.0 + (4 if hour % 2 == 0 else -4),
                volume=1200.0 + hour * 10,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66802.0,
            change_24h=0.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-open-strategy-watch-001",
                    "orderLinkId": "strategy-live-watch-001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "66880",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.strategies = [
            item.model_copy(update={"status": "shadow"}) if item.id == "trend-btc-01" else item
            for item in control_main.repo.state.strategies
        ]

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="long",
                confidence=74.0,
                last_price=68900.0,
                reference_price=68200.0,
                change_24h=4.2,
                note="上一轮仍为多头。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.runtime_status, "shadow")
        self.assertEqual(private_client.created_order_bodies, [])
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.cancelled_order_bodies[-1]["orderId"], "live-open-strategy-watch-001")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.cancelled_inactive" for item in audit_events))

    def test_strategy_runtime_refresh_skips_auto_dispatch_when_scheduler_paused(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.control_snapshot.scheduler.status = "paused"
        self.addCleanup(lambda: setattr(control_main.repo.state.control_snapshot.scheduler, "status", "running"))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=28.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertEqual(private_client.created_order_bodies, [])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        auto_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-auto-dispatch:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(auto_alert)
        drift_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-position-drift:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(drift_alert)
        assert drift_alert is not None
        self.assertEqual(drift_alert["severity"], "P1")
        self.assertIn("仓位偏离目标", drift_alert["title"])
        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("当前 AI 调度已暂停", runtime_snapshot["guard_detail"])
        self.assertEqual(runtime_snapshot["current_position_side"], "long")
        self.assertEqual(runtime_snapshot["current_position_size"], "0.15")
        self.assertEqual(runtime_snapshot["position_alignment"], "drifted")
        self.assertIn("仍有偏差", runtime_snapshot["position_alignment_detail"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.position_drift.alerted" for item in audit_events))

        snapshot_status, control_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(control_snapshot["strategy_metrics"][0]["delta"], "执行受阻 1")
        self.assertEqual(control_snapshot["strategy_metrics"][0]["tone"], "warning")
        self.assertEqual(control_snapshot["strategy_metrics"][1]["delta"], "偏离 1")
        self.assertEqual(control_snapshot["strategy_metrics"][1]["tone"], "warning")
        self.assertEqual(control_snapshot["execution_health"]["auto_dispatch_blocked"], 1)
        self.assertEqual(control_snapshot["execution_health"]["drifts"], 1)
        self.assertEqual(control_snapshot["execution_health"]["top_issue"], "执行受阻 1")

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertIn(
            'bybit_control_strategy_auto_dispatch_blocked{strategy_id="trend-btc-01",mode="live",status="running"} 1',
            metrics_body,
        )
        self.assertIn(
            'bybit_control_strategy_position_alignment_state{strategy_id="trend-btc-01",mode="live",status="running",alignment="drifted"} 3',
            metrics_body,
        )

    def test_strategy_runtime_refresh_skips_auto_dispatch_when_private_ws_is_unavailable(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=False, authenticated=False)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=28.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertEqual(private_client.created_order_bodies, [])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        auto_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-auto-dispatch:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(auto_alert)
        assert auto_alert is not None
        self.assertIn("私有 WS", auto_alert["description"])
        self.assertIn("恢复 Bybit 私有实时链路", auto_alert["suggested_action"])

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("私有 WS", runtime_snapshot["guard_detail"])

    def test_strategy_runtime_refresh_skips_auto_dispatch_when_private_ws_is_stale(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            last_message_at="2026-03-29T08:00:00+08:00",
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=28.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertEqual(private_client.created_order_bodies, [])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        auto_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-auto-dispatch:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(auto_alert)
        assert auto_alert is not None
        self.assertIn("私有 WS", auto_alert["description"])
        self.assertIn("超过约", auto_alert["description"])

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("私有 WS", runtime_snapshot["guard_detail"])

    def test_strategy_runtime_refresh_reconciles_missed_auto_dispatch_after_resume(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.control_snapshot.scheduler.status = "paused"
        self.addCleanup(lambda: setattr(control_main.repo.state.control_snapshot.scheduler, "status", "running"))
        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=28.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        first_snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        first_updated = next((item for item in first_snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(first_updated)
        assert first_updated is not None
        self.assertEqual(first_updated.signal, "short")
        self.assertEqual(private_client.created_order_bodies, [])

        control_main.repo.state.control_snapshot.scheduler.status = "running"
        second_snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        second_updated = next((item for item in second_snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(second_updated)
        assert second_updated is not None
        self.assertEqual(second_updated.signal, "short")
        self.assertEqual(len(private_client.created_order_bodies), 1)
        self.assertEqual(private_client.created_order_bodies[-1]["side"], "Sell")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertFalse(
            any(
                str(item.get("rule_key") or "").startswith("strategy-auto-dispatch:trend-btc-01:")
                and not item.get("acknowledged")
                for item in alerts
            )
        )
        self.assertFalse(
            any(
                str(item.get("rule_key") or "").startswith("strategy-position-drift:trend-btc-01:")
                and not item.get("acknowledged")
                for item in alerts
            )
        )

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.position_drift.resolved" for item in audit_events))

    def test_strategy_runtime_refresh_recreates_missing_live_strategy_order_when_signal_is_unchanged(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="short",
                confidence=61.0,
                last_price=66120.0,
                reference_price=66220.0,
                change_24h=-4.3,
                note="上一轮已经是空头信号。",
                next_action="保持当前策略委托。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertEqual(len(private_client.created_order_bodies), 1)
        self.assertEqual(private_client.created_order_bodies[-1]["side"], "Sell")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.reconcile_missing_order" for item in audit_events))

    def test_strategy_runtime_uses_exchange_order_history_for_last_execution_summary(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        private_client.order_history_items = [
            {
                "orderId": "hist-live-strategy-001",
                "orderLinkId": "strategy-live-trend-btc-01-history01",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66120",
                "orderStatus": "Filled",
                "createdTime": "1774888800000",
            }
        ]
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="short",
                confidence=61.0,
                last_price=66120.0,
                reference_price=66220.0,
                change_24h=-4.3,
                note="上一轮已经是空头信号。",
                next_action="保持当前策略委托。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["last_execution_event_type"], "exchange_order.filled")
        self.assertEqual(runtime_snapshot["last_execution_severity"], "info")
        self.assertIn("已成交", runtime_snapshot["last_execution_detail"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(
            any(
                item["event_type"] == "exchange_order.filled"
                and item["payload"].get("order_id") == "hist-live-strategy-001"
                for item in audit_events
            )
        )

    def test_strategy_activity_endpoint_returns_recent_strategy_activity(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        private_client.order_history_items = [
            {
                "orderId": "hist-live-strategy-001",
                "orderLinkId": "strategy-live-trend-btc-01-history01",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66120",
                "orderStatus": "Filled",
                "createdTime": "1774888800000",
            }
        ]
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="short",
                confidence=61.0,
                last_price=66120.0,
                reference_price=66220.0,
                change_24h=-4.3,
                note="上一轮已经是空头信号。",
                next_action="保持当前策略委托。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        review_change_status, review_change = self._post(
            "/api/change-requests",
            {
                "type": "strategy.parameter.update",
                "payload": {"strategy_id": "trend-btc-01", "fast_ma": 15},
                "requested_by": "unit_test",
                "target_mode": "live",
                "priority": "high",
                "summary": "策略活动测试触发参数更新",
            },
        )
        self.assertEqual(review_change_status, 200)
        followup_change_status, followup_change = self._post(
            "/api/change-requests",
            {
                "type": "proposal.script_patch_proposal",
                "payload": {"strategy_id": "trend-btc-01", "proposal_id": "prop-manual-followup-001"},
                "requested_by": "unit_test",
                "source_proposal_id": "prop-manual-followup-001",
                "trigger_reason": "proposal_accept",
                "manual_followup_required": True,
                "manual_followup_detail": "脚本补丁提案已转成待处理 ChangeRequest，需后续人工或编排链落实。",
                "target_mode": "paper",
                "priority": "high",
                "summary": "策略活动测试脚本补丁待跟进",
            },
        )
        self.assertEqual(followup_change_status, 200)

        _status, _runtime_payload = self._get("/api/strategies/live")
        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self.assertEqual(activity["strategy_id"], "trend-btc-01")
        self.assertEqual(activity["strategy_name"], "BTC 趋势跟随")
        self.assertEqual(activity["symbol"], "BTCUSDT")
        self.assertEqual(activity["mode"], "live")
        self.assertEqual(activity["runtime"]["strategy_id"], "trend-btc-01")
        self.assertEqual(activity["latest_backtest"]["id"], "bt-001")
        self.assertEqual(activity["latest_backtest"]["timeframe"], "1h")
        self.assertEqual(activity["latest_backtest_record"]["id"], "bt-001")
        self.assertEqual(activity["latest_backtest_record"]["timeframe"], "1h")
        self._assert_missing_keys(
            activity,
            "latest_actionable_backtest",
            "latest_actionable_backtest_record",
            "latest_backtest_review",
            "latest_backtest_job",
            "latest_actionable_backtest_review",
            "latest_actionable_backtest_job",
            "latest_backtest_review_record",
            "latest_backtest_job_record",
            "latest_actionable_backtest_review_record",
            "latest_actionable_backtest_job_record",
        )
        self.assertTrue(any(item["id"] == "bt-001" for item in activity["recent_backtests"]))
        self.assertTrue(any(item["id"] == "review-20260330-daily" for item in activity["recent_reviews"]))
        self.assertEqual(activity["latest_primary_review"]["id"], "review-20260330-daily")
        self.assertEqual(activity["latest_primary_review_record"]["id"], "review-20260330-daily")
        self._assert_missing_keys(
            activity,
            "latest_actionable_primary_review",
            "latest_actionable_primary_review_record",
            "latest_tracking_review",
            "latest_tracking_review_record",
        )
        self.assertIn(
            activity["latest_tracking_job"]["job_type"],
            {"review_strategy_change", "review_strategy_issue"},
        )
        self.assertEqual(activity["latest_tracking_job_record"]["id"], activity["latest_tracking_job"]["id"])
        self.assertNotIn("latest_retryable_tracking_job_record", activity)
        decision_context = activity["decision_context"]
        self.assertEqual(decision_context["backtest"]["latest_record"]["id"], "bt-001")
        self.assertEqual(decision_context["review"]["latest_primary_record"]["id"], "review-20260330-daily")
        self.assertEqual(decision_context["tracking"]["latest_job_record"]["id"], activity["latest_tracking_job"]["id"])
        activity_sections = activity["activity_sections"]
        self.assertEqual(activity_sections["backtest"]["latest"]["id"], activity["latest_backtest"]["id"])
        self.assertEqual(activity_sections["proposal"]["latest"]["id"], activity["latest_proposal"]["id"])
        self.assertEqual(
            activity_sections["change_request"]["latest"]["id"],
            activity["latest_change_request"]["id"],
        )
        self.assertEqual(
            activity_sections["review"]["latest_primary"]["id"],
            activity["latest_primary_review"]["id"],
        )
        self.assertEqual(
            activity_sections["tracking"]["latest_job"]["id"],
            activity["latest_tracking_job"]["id"],
        )
        self.assertEqual(
            activity["latest_ops"]["latest_audit_event_record"]["event_type"],
            "openclaw.job.queued",
        )
        self.assertEqual(
            activity["latest_ops"]["latest_audit_event_record"]["summary"],
            "任务已入队：review_strategy_issue",
        )
        self.assertEqual(activity["latest_ops"]["latest_audit_event_record"]["priority"], 1)
        self.assertTrue(activity["latest_ops"]["latest_audit_event_record"]["is_key_event"])
        self.assertEqual(
            activity["latest_ops"]["latest_audit_event_record"]["payload"]["job_type"],
            activity["latest_tracking_job"]["job_type"],
        )
        self._assert_missing_keys(
            activity,
            "latest_active_order",
            "latest_active_order_record",
            "latest_historical_order",
            "latest_historical_order_record",
            "latest_order",
            "latest_order_record",
            "latest_pending_alert",
            "latest_pending_alert_record",
            "latest_trade",
            "latest_trade_record",
            "latest_alert",
            "latest_alert_record",
            "latest_audit_event",
            "latest_audit_event_record",
        )
        self.assertIn("latest_ops", activity)
        self.assertEqual(activity["latest_ops"]["latest_order_record"]["order_id"], "hist-live-strategy-001")
        self.assertEqual(
            activity["latest_ops"]["latest_trade_record"]["id"],
            activity["latest_runtime"]["latest_ops"]["latest_trade_record"]["id"],
        )
        self.assertEqual(
            activity["latest_ops"]["latest_alert_record"]["id"],
            activity["latest_runtime"]["latest_ops"]["latest_alert_record"]["id"],
        )
        self.assertEqual(
            activity["latest_ops"]["latest_audit_event_record"]["event_type"],
            activity["latest_runtime"]["latest_ops"]["latest_audit_event_record"]["event_type"],
        )
        self.assertIn("latest_runtime", activity)
        self.assertEqual(
            activity["latest_runtime"]["latest_ops"]["latest_order_record"]["order_id"],
            "hist-live-strategy-001",
        )
        self.assertTrue(any(item["order_id"] == "hist-live-strategy-001" for item in activity["recent_orders"]))
        self.assertTrue(any(item["event_type"] == "exchange_order.filled" for item in activity["recent_audit_events"]))
        self.assertTrue(any(item["job_type"] == "review_strategy_change" for item in activity["recent_agent_jobs"]))
        self.assertTrue(
            any(
                item["job_type"] == "review_strategy_change"
                and item["requested_by"] == "unit_test"
                for item in activity["recent_agent_jobs"]
            )
        )
        self.assertTrue(any(item["id"] == review_change["id"] for item in activity["recent_change_requests"]))
        self.assertEqual(activity["latest_change_request"]["id"], activity["recent_change_requests"][0]["id"])
        self._assert_missing_keys(
            activity,
            "latest_change_request_source_backtest_record",
            "latest_change_request_source_review_record",
            "latest_change_request_source_proposal_record",
            "latest_actionable_change_request_source_backtest_record",
            "latest_actionable_change_request_source_review_record",
            "latest_actionable_change_request_source_proposal_record",
        )
        manual_followup_change = next(
            (item for item in activity["recent_change_requests"] if item["id"] == followup_change["id"]),
            None,
        )
        self.assertIsNotNone(manual_followup_change)
        assert manual_followup_change is not None
        self.assertTrue(manual_followup_change["manual_followup_required"])
        self.assertEqual(
            manual_followup_change["manual_followup_detail"],
            "脚本补丁提案已转成待处理 ChangeRequest，需后续人工或编排链落实。",
        )
        self.assertTrue(any(item["id"] == "prop-002" for item in activity["recent_proposals"]))
        self.assertEqual(activity["latest_proposal"]["id"], activity["recent_proposals"][0]["id"])
        self.assertEqual(activity["latest_actionable_proposal"]["id"], "prop-002")
        self._assert_missing_keys(
            activity,
            "latest_proposal_change_request",
            "latest_proposal_backtest",
            "latest_proposal_review",
            "latest_proposal_job",
            "latest_proposal_backtest_record",
            "latest_proposal_review_record",
            "latest_proposal_job_record",
            "latest_actionable_proposal_change_request",
            "latest_actionable_proposal_backtest",
            "latest_actionable_proposal_review",
            "latest_actionable_proposal_job",
            "latest_actionable_proposal_backtest_record",
            "latest_actionable_proposal_review_record",
            "latest_actionable_proposal_job_record",
            "latest_change_request_backtest_record",
            "latest_change_request_review_record",
            "latest_change_request_job_record",
            "latest_actionable_change_request_backtest_record",
            "latest_actionable_change_request_review_record",
            "latest_actionable_change_request_job_record",
            "latest_actionable_change_request",
            "latest_retryable_tracking_job",
        )
        latest_proposal = next((item for item in activity["recent_proposals"] if item["id"] == "prop-002"), None)
        self.assertIsNotNone(latest_proposal)
        assert latest_proposal is not None
        self.assertEqual(latest_proposal["strategy_id"], "trend-btc-01")
        self.assertEqual(latest_proposal["proposal_type"], "publish_recommendation")
        self.assertEqual(latest_proposal["status"], "pending")

    def test_strategy_activity_orders_recent_proposals_by_created_at(self) -> None:
        base_review = control_main.repo.state.reviews[0]
        base_proposal = next(
            proposal for proposal in base_review.proposals if proposal.strategy_id == "trend-btc-01"
        )
        older_proposal = base_proposal.model_copy(
            update={
                "id": "prop-order-older-001",
                "title": "较早提案",
                "description": "这条提案更早产生，用来验证 recent_proposals 排序。",
                "created_at": "2026-03-30T08:00:00+08:00",
                "status": "testing",
            }
        )
        newer_proposal = base_proposal.model_copy(
            update={
                "id": "prop-order-newer-001",
                "title": "较新提案",
                "description": "这条提案更新产生，必须排在 recent_proposals 第一位。",
                "created_at": "2026-03-30T09:30:00+08:00",
                "status": "pending",
            }
        )
        older_review = base_review.model_copy(
            deep=True,
            update={
                "id": "review-proposal-order-older-001",
                "title": "较早复盘",
                "summary": "较早复盘里的提案应排在后面。",
                "created_at": "2026-03-30T08:10:00+08:00",
                "proposals": [older_proposal],
            },
        )
        newer_review = base_review.model_copy(
            deep=True,
            update={
                "id": "review-proposal-order-newer-001",
                "title": "较新复盘",
                "summary": "较新复盘里的提案应排在前面。",
                "created_at": "2026-03-30T09:40:00+08:00",
                "proposals": [newer_proposal],
            },
        )
        control_main.repo.state.reviews = [older_review, newer_review]
        control_main.repo._persist(control_main.repo.state)

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self.assertEqual(
            [item["id"] for item in activity["recent_reviews"][:2]],
            ["review-proposal-order-newer-001", "review-proposal-order-older-001"],
        )
        self.assertEqual(
            [item["id"] for item in activity["recent_proposals"][:2]],
            ["prop-order-newer-001", "prop-order-older-001"],
        )
        self.assertEqual(activity["latest_proposal"]["id"], "prop-order-newer-001")
        self.assertEqual(activity["latest_actionable_proposal"]["id"], "prop-order-newer-001")
        self.assertEqual(activity["activity_sections"]["proposal"]["latest"]["id"], "prop-order-newer-001")
        self.assertEqual(activity["recent_proposals"][0]["created_at"], "2026-03-30T09:30:00+08:00")
        self.assertEqual(activity["recent_proposals"][1]["created_at"], "2026-03-30T08:00:00+08:00")

    def test_get_strategy_activity_uses_cached_runtime_snapshot(self) -> None:
        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="long",
                confidence=72.0,
                last_price=68000.0,
                reference_price=67920.0,
                change_24h=2.1,
                note="使用缓存运行态快照。",
                next_action="继续观察缓存运行态。",
                last_evaluated_at="2026-04-05T10:00:00+08:00",
            )
        ]

        with patch.object(
            control_main,
            "build_strategy_runtime_response",
            side_effect=AssertionError("strategy activity 不应触发重型 runtime 刷新"),
        ):
            activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")

        self.assertEqual(activity_status, 200)
        self.assertEqual(activity["strategy_id"], "trend-btc-01")
        self.assertIsNotNone(activity["runtime"])
        self.assertEqual(activity["runtime"]["strategy_id"], "trend-btc-01")
        self.assertIsNotNone(activity["runtime"]["signal"])
        self.assertIsNotNone(activity["runtime"]["last_price"])

    def test_review_strategy_activity_context_scans_primary_reviews_once(self) -> None:
        now = datetime.now(timezone.utc).astimezone()
        primary_review = ReviewDocument(
            id="review-primary-actionable-001",
            period="backtest",
            strategy_id="trend-btc-01",
            backtest_id="bt-primary-actionable-001",
            source_change_request_id=None,
            source_backtest_id=None,
            source_review_id=None,
            source_proposal_id=None,
            trigger_reason=None,
            source_job_id=None,
            source_job_type=None,
            source_job_status=None,
            decision_readiness=None,
            decision_readiness_detail=None,
            decision_recommended_data_range="最近 180 天",
            decision_recommended_timeframe="4h",
            decision_readiness_action=None,
            title="可行动主复盘",
            summary="主复盘需要保留为 actionable primary。",
            highlights=[],
            risks=[],
            proposals=[],
            created_at=(now - timedelta(seconds=5)).isoformat(),
        )
        tracking_review = ReviewDocument(
            id="review-tracking-issue-001",
            period="strategy_issue",
            strategy_id="trend-btc-01",
            backtest_id=None,
            source_change_request_id=None,
            source_backtest_id=None,
            source_review_id=None,
            source_proposal_id=None,
            trigger_reason=None,
            source_job_id=None,
            source_job_type=None,
            source_job_status=None,
            decision_readiness=None,
            decision_readiness_detail=None,
            decision_recommended_data_range=None,
            decision_recommended_timeframe=None,
            decision_readiness_action=None,
            title="跟踪复盘",
            summary="跟踪复盘不应进入 primary actionable。",
            highlights=[],
            risks=[],
            proposals=[],
            created_at=now.isoformat(),
        )
        control_main.repo.state.reviews.insert(0, primary_review)
        control_main.repo.state.reviews.insert(0, tracking_review)
        self.addCleanup(
            lambda: control_main.repo.state.reviews.remove(tracking_review)
            if tracking_review in control_main.repo.state.reviews
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.reviews.remove(primary_review)
            if primary_review in control_main.repo.state.reviews
            else None
        )

        activity_context = control_main.repo._build_review_strategy_activity_context_locked("trend-btc-01")
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        self.assertIn(primary_review.id, str(activity_context["latest_primary_review"] or ""))
        self.assertIn(primary_review.id, str(activity_context["latest_actionable_primary_review"] or ""))
        self.assertIn(tracking_review.id, str(activity_context["latest_tracking_review"] or ""))
        review_context = activity_context["decision_context"]["review"]
        self.assertEqual(review_context["latest_primary_record"]["id"], primary_review.id)
        self.assertEqual(review_context["latest_actionable_primary_record"]["id"], primary_review.id)

    def test_strategy_runtime_rejected_exchange_order_creates_system_alert(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        private_client.order_history_items = [
            {
                "orderId": "hist-live-strategy-rejected-001",
                "orderLinkId": "strategy-live-trend-btc-01-reject01",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66120",
                "orderStatus": "Rejected",
                "createdTime": "1774888800000",
            }
        ]
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="short",
                confidence=61.0,
                last_price=66120.0,
                reference_price=66220.0,
                change_24h=-4.3,
                note="上一轮已经是空头信号。",
                next_action="保持当前策略委托。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["last_execution_event_type"], "exchange_order.rejected")
        self.assertEqual(runtime_snapshot["last_execution_severity"], "error")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        reject_alert = next(
            (
                item
                for item in alerts
                if str(item.get("rule_key") or "") == "strategy-exchange-rejected:trend-btc-01:hist-live-strategy-rejected-001"
            ),
            None,
        )
        self.assertIsNotNone(reject_alert)
        assert reject_alert is not None
        self.assertEqual(reject_alert["severity"], "P1")
        self.assertIn("真实委托被拒绝", reject_alert["title"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(
            any(
                item["event_type"] == "exchange_order.rejected"
                and item["payload"].get("order_id") == "hist-live-strategy-rejected-001"
                for item in audit_events
            )
        )

    def test_strategy_runtime_rejected_exchange_order_alert_resolves_after_newer_success(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        private_client.order_history_items = [
            {
                "orderId": "hist-live-strategy-rejected-002",
                "orderLinkId": "strategy-live-trend-btc-01-reject02",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66120",
                "orderStatus": "Rejected",
                "createdTime": "1774888800000",
            }
        ]
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="short",
                confidence=61.0,
                last_price=66120.0,
                reference_price=66220.0,
                change_24h=-4.3,
                note="上一轮已经是空头信号。",
                next_action="保持当前策略委托。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        first_status, _first_payload = self._get("/api/strategies/live")
        self.assertEqual(first_status, 200)
        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertTrue(
            any(
                str(item.get("rule_key") or "") == "strategy-exchange-rejected:trend-btc-01:hist-live-strategy-rejected-002"
                and not item["acknowledged"]
                for item in alerts
            )
        )

        private_client.order_history_items = [
            {
                "orderId": "hist-live-strategy-filled-002",
                "orderLinkId": "strategy-live-trend-btc-01-fill02",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66120",
                "orderStatus": "Filled",
                "createdTime": "1774889800000",
            }
        ]

        second_status, second_payload = self._get("/api/strategies/live")
        self.assertEqual(second_status, 200)
        runtime_snapshot = next((item for item in second_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["last_execution_event_type"], "exchange_order.filled")

        refreshed_alerts_status, refreshed_alerts = self._get("/api/alerts")
        self.assertEqual(refreshed_alerts_status, 200)
        self.assertFalse(
            any(
                str(item.get("rule_key") or "") == "strategy-exchange-rejected:trend-btc-01:hist-live-strategy-rejected-002"
                and not item["acknowledged"]
                for item in refreshed_alerts
            )
        )

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.rejection_resolved" for item in audit_events))

    def test_strategy_runtime_repeated_exchange_rejection_enters_guard_cooldown(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 90,
                high=69080.0 - hour * 90,
                low=68920.0 - hour * 90,
                close=68940.0 - hour * 90,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        now_ms = lambda minutes_ago: str(
            int((datetime.now(timezone.utc).astimezone() - timedelta(minutes=minutes_ago)).timestamp() * 1000)
        )
        private_client.order_history_items = [
            {
                "orderId": "hist-live-strategy-rejected-guard-001",
                "orderLinkId": "strategy-live-trend-btc-01-rg01",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66120",
                "orderStatus": "Rejected",
                "createdTime": now_ms(4),
            },
            {
                "orderId": "hist-live-strategy-rejected-guard-002",
                "orderLinkId": "strategy-live-trend-btc-01-rg02",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66100",
                "orderStatus": "Rejected",
                "createdTime": now_ms(2),
            },
        ]
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="short",
                confidence=61.0,
                last_price=66120.0,
                reference_price=66220.0,
                change_24h=-4.3,
                note="上一轮已经是空头信号。",
                next_action="保持当前策略委托。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        status, payload = self._get("/api/strategies/live")
        self.assertEqual(status, 200)
        runtime_snapshot = next((item for item in payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("连续拒绝", runtime_snapshot["guard_detail"])

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 409)
        self.assertIn("连续拒绝", preview["detail"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertTrue(
            any(
                str(item.get("rule_key") or "") == "strategy-exchange-rejection-guard:trend-btc-01:live"
                and not item["acknowledged"]
                for item in alerts
            )
        )
        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(snapshot["execution_health"]["rejection_guards"], 1)
        self.assertEqual(snapshot["execution_health"]["top_issue"], "连续拒单 1")

    def test_strategy_runtime_exchange_rejection_guard_resolves_after_window_expires(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 90,
                high=69080.0 - hour * 90,
                low=68920.0 - hour * 90,
                close=68940.0 - hour * 90,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        old_ms = lambda minutes_ago: str(
            int((datetime.now(timezone.utc).astimezone() - timedelta(minutes=minutes_ago)).timestamp() * 1000)
        )
        private_client.order_history_items = [
            {
                "orderId": "hist-live-strategy-rejected-expired-001",
                "orderLinkId": "strategy-live-trend-btc-01-exp01",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66120",
                "orderStatus": "Rejected",
                "createdTime": old_ms(40),
            },
            {
                "orderId": "hist-live-strategy-rejected-expired-002",
                "orderLinkId": "strategy-live-trend-btc-01-exp02",
                "symbol": "BTCUSDT",
                "category": "linear",
                "side": "Sell",
                "orderType": "Limit",
                "qty": "0.030000",
                "price": "66100",
                "orderStatus": "Rejected",
                "createdTime": old_ms(35),
            },
        ]
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.alerts.insert(
            0,
            AlertRecord(
                id="alert-rejection-guard-existing",
                symbol="BTCUSDT",
                severity="P1",
                title="BTCUSDT 策略连续拒单已熔断",
                description="旧的连续拒单熔断提醒。",
                source_type="system",
                triggered_at=datetime.now(timezone.utc).astimezone().isoformat(),
                acknowledged=False,
                suggested_action="人工复核后恢复。",
                rule_key="strategy-exchange-rejection-guard:trend-btc-01:live",
                strategy_id="trend-btc-01",
            ),
        )

        status, payload = self._get("/api/strategies/live")
        self.assertEqual(status, 200)
        runtime_snapshot = next((item for item in payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertNotEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertNotIn("连续拒绝", runtime_snapshot.get("guard_detail") or "")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertFalse(
            any(
                str(item.get("rule_key") or "") == "strategy-exchange-rejection-guard:trend-btc-01:live"
                and not item["acknowledged"]
                for item in alerts
            )
        )

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(
            any(item["event_type"] == "strategy.exchange_order.rejection_guard.resolved" for item in audit_events)
        )

    def test_strategy_runtime_stale_live_order_alerts_without_auto_dispatch(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 90,
                high=69080.0 - hour * 90,
                low=68920.0 - hour * 90,
                close=68940.0 - hour * 90,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-stale-order-001",
                    "orderLinkId": "strategy-live-trend-btc-01-stale01",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "66880",
                    "orderStatus": "New",
                    "createdTime": "1774880000000",
                }
            ],
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        status, payload = self._get("/api/strategies/live")
        self.assertEqual(status, 200)
        runtime_snapshot = next((item for item in payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["guard_state"], "auto_dispatch_blocked")
        self.assertIn("长时间未处理", runtime_snapshot["guard_detail"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertTrue(
            any(
                str(item.get("rule_key") or "") == "strategy-stale-order:trend-btc-01:live-stale-order-001"
                and not item["acknowledged"]
                for item in alerts
            )
        )
        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(snapshot["execution_health"]["stale_order_guards"], 1)
        self.assertEqual(snapshot["execution_health"]["top_issue"], "挂单停滞 1")

    def test_strategy_runtime_refresh_replaces_stale_live_order_when_signal_is_unchanged(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1700.0 + hour * 22,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-stale-order-002",
                    "orderLinkId": "strategy-live-trend-btc-01-stale02",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "66880",
                    "orderStatus": "New",
                    "createdTime": "1774880000000",
                }
            ],
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="short",
                confidence=61.0,
                last_price=66120.0,
                reference_price=66220.0,
                change_24h=-4.3,
                note="上一轮已经是空头信号。",
                next_action="保持当前策略委托。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.cancelled_order_bodies[-1]["orderId"], "live-stale-order-002")
        self.assertEqual(len(private_client.created_order_bodies), 1)
        self.assertEqual(private_client.created_order_bodies[-1]["side"], "Sell")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.cancelled_stale_timeout" for item in audit_events))
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.reconcile_missing_order" for item in audit_events))

    def test_strategy_runtime_refresh_cancels_live_strategy_orders_when_manual_override_enabled(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-open-strategy-manual-001",
                    "orderLinkId": "strategy-live-trend-btc-01-deadbeef",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "66880",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.control_snapshot.scheduler.status = "manual_override"
        self.addCleanup(lambda: setattr(control_main.repo.state.control_snapshot.scheduler, "status", "running"))
        control_main.repo.state.control_snapshot.scheduler.freeze_publish = True
        self.addCleanup(lambda: setattr(control_main.repo.state.control_snapshot.scheduler, "freeze_publish", False))

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="long",
                confidence=74.0,
                last_price=68900.0,
                reference_price=68200.0,
                change_24h=4.2,
                note="上一轮仍为多头。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.cancelled_order_bodies[-1]["orderId"], "live-open-strategy-manual-001")

    def test_strategy_runtime_refresh_cancels_live_strategy_orders_when_public_ws_is_unavailable(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66800.0 + (5 if hour % 2 == 0 else -5),
                high=66830.0,
                low=66770.0,
                close=66805.0 + (4 if hour % 2 == 0 else -4),
                volume=1200.0 + hour * 10,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66802.0,
            change_24h=0.3,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=False,
            ticker_symbols=[],
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.market_data = market_client
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-open-strategy-public-001",
                    "orderLinkId": "strategy-live-trend-btc-01-public",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "66880",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.cancelled_order_bodies[-1]["orderId"], "live-open-strategy-public-001")
        self.assertEqual(private_client.created_order_bodies, [])

    def test_strategy_runtime_refresh_cancels_surplus_live_strategy_orders(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        now_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66800.0 + (5 if hour % 2 == 0 else -5),
                high=66830.0,
                low=66770.0,
                close=66805.0 + (4 if hour % 2 == 0 else -4),
                volume=1200.0 + hour * 10,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66802.0,
            change_24h=0.3,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=True,
            ticker_symbols=["BTCUSDT"],
            symbol_last_message_at={"BTCUSDT": datetime.now(timezone.utc).astimezone().isoformat()},
            last_message_at_linear=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.market_data = market_client
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-open-strategy-dup-new",
                    "orderLinkId": "strategy-live-trend-btc-01-new",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "66890",
                    "orderStatus": "New",
                    "createdTime": str(now_ms),
                },
                {
                    "orderId": "live-open-strategy-dup-old",
                    "orderLinkId": "strategy-live-trend-btc-01-old",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "66880",
                    "orderStatus": "New",
                    "createdTime": str(now_ms - 60_000),
                },
            ],
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.cancelled_order_bodies[-1]["orderId"], "live-open-strategy-dup-old")
        self.assertEqual(private_client.created_order_bodies, [])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_order.cancelled_surplus" for item in audit_events))

    def test_strategy_runtime_refresh_triggers_live_stop_loss_guard_and_cancels_strategy_orders(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 160,
                high=69060.0 - hour * 160,
                low=68910.0 - hour * 160,
                close=68920.0 - hour * 160,
                volume=1600.0 + hour * 18,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=65520.0,
            change_24h=-5.8,
            candles=candles,
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        realtime_client = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-open-strategy-stop-001",
                    "orderLinkId": "strategy-live-trend-btc-01-deadbeef",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "65480",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
        )
        control_main.private_data = private_client
        control_main.private_realtime = realtime_client
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        strategy = next(item for item in control_main.repo.state.strategies if item.id == "trend-btc-01")
        original_parameters = list(strategy.parameters)
        self.addCleanup(lambda: setattr(strategy, "parameters", original_parameters))
        strategy.parameters = [
            *original_parameters,
            StrategyParameter(key="stop_loss_pct", label="止损", value=1.2, unit="%"),
        ]

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=18.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        updated = next((item for item in snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(updated)
        assert updated is not None
        self.assertEqual(updated.signal, "short")
        self.assertEqual(private_client.created_order_bodies, [])
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.cancelled_order_bodies[-1]["orderId"], "live-open-strategy-stop-001")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        stop_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-live-stop-loss:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(stop_alert)

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("止损保护", preview["blocked_reason"])
        self.assertTrue(any("止损保护" in item for item in preview["warnings"]))

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertIn("止损保护", runtime_snapshot["note"])
        self.assertIn("复核真实仓位", runtime_snapshot["next_action"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.exchange_stop_loss.alerted" for item in audit_events))

    def test_live_stop_loss_guard_persists_while_real_position_remains_open(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        initial_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 160,
                high=69060.0 - hour * 160,
                low=68910.0 - hour * 160,
                close=68920.0 - hour * 160,
                volume=1600.0 + hour * 18,
            )
            for hour in range(24)
        ]
        recovery_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=68000.0 + hour * 60,
                high=68080.0 + hour * 60,
                low=67940.0 + hour * 60,
                close=68040.0 + hour * 60,
                volume=1500.0 + hour * 15,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=65520.0,
            change_24h=-5.8,
            candles=initial_candles,
        )
        control_main.market_data = market_client
        private_client = StubConfiguredTradingBybitPrivateClient()
        realtime_client = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            orders=[
                {
                    "orderId": "live-open-strategy-stop-002",
                    "orderLinkId": "strategy-live-trend-btc-01-beadfeed",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "65480",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
        )
        control_main.private_data = private_client
        control_main.private_realtime = realtime_client
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        strategy = next(item for item in control_main.repo.state.strategies if item.id == "trend-btc-01")
        original_parameters = list(strategy.parameters)
        self.addCleanup(lambda: setattr(strategy, "parameters", original_parameters))
        strategy.parameters = [
            *original_parameters,
            StrategyParameter(key="stop_loss_pct", label="止损", value=1.2, unit="%"),
        ]

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=18.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        first_snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        first_updated = next((item for item in first_snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(first_updated)
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.created_order_bodies, [])

        market_client.price = 68450.0
        market_client.change_24h = 2.6
        market_client.candles = recovery_candles

        second_snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        second_updated = next((item for item in second_snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(second_updated)
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.created_order_bodies, [])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertTrue(
            any(
                str(item.get("rule_key") or "").startswith("strategy-live-stop-loss:trend-btc-01:")
                and not item.get("acknowledged")
                for item in alerts
            )
        )

    def test_live_stop_loss_cooldown_blocks_reentry_after_position_is_flattened(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        initial_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 160,
                high=69060.0 - hour * 160,
                low=68910.0 - hour * 160,
                close=68920.0 - hour * 160,
                volume=1600.0 + hour * 18,
            )
            for hour in range(24)
        ]
        recovery_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=68000.0 + hour * 60,
                high=68080.0 + hour * 60,
                low=67940.0 + hour * 60,
                close=68040.0 + hour * 60,
                volume=1500.0 + hour * 15,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=65520.0,
            change_24h=-5.8,
            candles=initial_candles,
        )
        control_main.market_data = market_client
        private_client = StubConfiguredTradingBybitPrivateClient()
        realtime_client = StubBybitPrivateRealtimeClient(
            client=private_client,
            connected=True,
            authenticated=True,
            positions=[
                {
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "size": "0.15",
                    "avgPrice": "66500",
                    "markPrice": "65520",
                    "positionValue": "9828",
                    "leverage": "2",
                    "unrealisedPnl": "-147",
                }
            ],
            orders=[
                {
                    "orderId": "live-open-strategy-stop-003",
                    "orderLinkId": "strategy-live-trend-btc-01-facefeed",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "65480",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
        )
        control_main.private_data = private_client
        control_main.private_realtime = realtime_client
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        strategy = next(item for item in control_main.repo.state.strategies if item.id == "trend-btc-01")
        original_parameters = list(strategy.parameters)
        self.addCleanup(lambda: setattr(strategy, "parameters", original_parameters))
        strategy.parameters = [
            *original_parameters,
            StrategyParameter(key="stop_loss_pct", label="止损", value=1.2, unit="%"),
            StrategyParameter(key="cooldown_minutes", label="冷却", value=35, unit="分钟"),
        ]

        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="watch",
                confidence=18.0,
                last_price=66800.0,
                reference_price=66720.0,
                change_24h=0.6,
                note="上一轮仍在观察。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]

        first_snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        first_updated = next((item for item in first_snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(first_updated)
        self.assertEqual(len(private_client.cancelled_order_bodies), 1)
        self.assertEqual(private_client.created_order_bodies, [])

        realtime_client.seed_positions_snapshot([])
        realtime_client.seed_open_orders_snapshot([])
        market_client.price = 68450.0
        market_client.change_24h = 2.6
        market_client.candles = recovery_candles

        second_snapshots = control_main.refresh_strategy_runtime_once(auto_dispatch=True)
        second_updated = next((item for item in second_snapshots if item.strategy_id == "trend-btc-01"), None)
        self.assertIsNotNone(second_updated)
        self.assertEqual(private_client.created_order_bodies, [])

        preview_status, preview = self._get("/api/strategies/trend-btc-01/execution-preview?mode=live")
        self.assertEqual(preview_status, 409)
        self.assertIn("冷却期", preview["detail"])

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertTrue(
            "冷却期" in runtime_snapshot["note"] or "止损保护" in runtime_snapshot["note"]
        )
        self.assertIn(runtime_snapshot["guard_state"], {"cooldown", "live_stop_loss"})
        self.assertTrue(
            "冷却期" in runtime_snapshot["guard_detail"] or "止损保护" in runtime_snapshot["guard_detail"]
        )

        snapshot_status, control_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(control_snapshot["strategy_metrics"][0]["delta"], "止损保护 1")
        self.assertEqual(control_snapshot["strategy_metrics"][0]["tone"], "critical")
        self.assertEqual(control_snapshot["strategy_metrics"][2]["delta"], "冷却中 1")
        self.assertEqual(control_snapshot["strategy_metrics"][2]["tone"], "critical")
        self.assertEqual(control_snapshot["execution_health"]["active_stop_loss_guards"], 1)
        self.assertEqual(control_snapshot["execution_health"]["cooldowns"], 1)
        self.assertEqual(control_snapshot["execution_health"]["top_issue"], "止损保护 1")
        self.assertEqual(control_snapshot["execution_health"]["top_issue_strategy_id"], "trend-btc-01")
        self.assertEqual(control_snapshot["execution_health"]["top_issue_strategy_name"], "BTC 趋势跟随")
        self.assertEqual(control_snapshot["execution_health"]["top_issue_symbol"], "BTCUSDT")
        self.assertIn("真实模式止损保护", control_snapshot["execution_health"]["top_issue_detail"])
        self.assertIn("恢复自动执行", control_snapshot["execution_health"]["top_issue_recommended_action"])

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertIn(
            'bybit_control_strategy_live_stop_loss_guard{strategy_id="trend-btc-01",mode="live",status="running"} 1',
            metrics_body,
        )
        self.assertRegex(
            metrics_body,
            r'bybit_control_strategy_live_stop_loss_cooldown_minutes\{strategy_id="trend-btc-01",mode="live",status="running"\} [1-9][0-9]*',
        )

    def test_live_strategy_signal_change_creates_system_alert(self) -> None:
        original_market = control_main.market_data
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 110,
                high=66290.0 + hour * 110,
                low=66140.0 + hour * 110,
                close=66260.0 + hour * 110,
                volume=1800.0 + hour * 24,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68900.0,
            change_24h=4.6,
            candles=candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        control_main.repo.state.strategy_runtime_snapshots = []

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["signal"], "long")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        strategy_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "").startswith("strategy-signal:trend-btc-01:")),
            None,
        )
        self.assertIsNotNone(strategy_alert)
        assert strategy_alert is not None
        self.assertEqual(strategy_alert["source_type"], "system")
        self.assertEqual(strategy_alert["severity"], "P1")
        self.assertEqual(strategy_alert["symbol"], "BTCUSDT")
        self.assertIn("做多", strategy_alert["title"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(
            any(
                item["event_type"] == "alert.system_triggered"
                and item["payload"].get("strategy_id") == "trend-btc-01"
                for item in audit_events
            )
        )

    def test_live_strategy_signal_alert_retires_previous_unacknowledged_alert(self) -> None:
        original_market = control_main.market_data
        bearish_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=69000.0 - hour * 120,
                high=69080.0 - hour * 120,
                low=68920.0 - hour * 120,
                close=68940.0 - hour * 120,
                volume=1650.0 + hour * 20,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=66120.0,
            change_24h=-4.3,
            candles=bearish_candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        control_main.repo.state.strategy_runtime_snapshots = [
            StrategyRuntimeSnapshot(
                strategy_id="trend-btc-01",
                strategy_name="BTC 趋势跟随",
                symbol="BTCUSDT",
                market="perp",
                mode=AccountMode.LIVE,
                runtime_status="running",
                signal="long",
                confidence=72.0,
                last_price=68900.0,
                reference_price=68200.0,
                change_24h=4.1,
                note="上一轮为多头。",
                next_action="继续观察。",
                last_evaluated_at="2026-03-31T00:00:00+08:00",
            )
        ]
        control_main.repo.state.alerts.insert(
            0,
            AlertRecord(
                id="alert-strategy-old-001",
                severity="P1",
                symbol="BTCUSDT",
                title="BTCUSDT 策略信号更新 · 做多",
                description="旧的多头提醒",
                triggered_at="2026-03-31T00:00:00+08:00",
                suggested_action="旧动作",
                acknowledged=False,
                source_type="system",
                rule_key="strategy-signal:trend-btc-01:running:long",
            ),
        )

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        runtime_snapshot = next((item for item in runtime_payload if item["strategy_id"] == "trend-btc-01"), None)
        self.assertIsNotNone(runtime_snapshot)
        assert runtime_snapshot is not None
        self.assertEqual(runtime_snapshot["signal"], "short")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        old_alert = next((item for item in alerts if item["id"] == "alert-strategy-old-001"), None)
        self.assertIsNotNone(old_alert)
        assert old_alert is not None
        self.assertTrue(old_alert["acknowledged"])

        current_alert = next(
            (
                item
                for item in alerts
                if str(item.get("rule_key") or "") == "strategy-signal:trend-btc-01:running:short"
            ),
            None,
        )
        self.assertIsNotNone(current_alert)
        assert current_alert is not None
        self.assertFalse(current_alert["acknowledged"])
        self.assertIn("做空", current_alert["title"])

    def test_strategy_runtime_signal_flip_reconciles_to_short_target(self) -> None:
        original_market = control_main.market_data
        long_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        long_candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=long_candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")

        long_status, long_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(long_status, 200)
        long_runtime = next((item for item in long_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(long_runtime)
        assert long_runtime is not None
        self.assertEqual(long_runtime["signal"], "long")

        account_status, account_payload = self._get("/api/account/live")
        self.assertEqual(account_status, 200)
        long_position = next((item for item in account_payload["positions"] if item["symbol"] == "ETHUSDT"), None)
        self.assertIsNotNone(long_position)
        assert long_position is not None
        self.assertEqual(long_position["side"], "long")

        short_candles = [
            CandlePoint(
                time=f"2026-03-30T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        short_candles.append(
            CandlePoint(
                time="2026-03-31T23:00:00+08:00",
                open=100.0,
                high=106.4,
                low=99.8,
                close=106.0,
                volume=1900.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=106.0,
            change_24h=2.6,
            candles=short_candles,
        )

        short_status, short_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(short_status, 200)
        short_runtime = next((item for item in short_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(short_runtime)
        assert short_runtime is not None
        self.assertEqual(short_runtime["signal"], "short")
        self.assertEqual(short_runtime["execution_preview"]["projected_position_side"], "short")

        second_account_status, second_account_payload = self._get("/api/account/live")
        self.assertEqual(second_account_status, 200)
        short_position = next((item for item in second_account_payload["positions"] if item["symbol"] == "ETHUSDT"), None)
        self.assertIsNotNone(short_position)
        assert short_position is not None
        self.assertEqual(short_position["side"], "short")
        self.assertEqual(short_runtime["current_position_side"], "short")
        self.assertEqual(short_runtime["current_position_size"], short_position["size"])
        self.assertEqual(short_runtime["current_position_avg_price"], short_position["avg_price"])
        self.assertEqual(short_runtime["target_position_side"], "short")
        self.assertEqual(short_runtime["position_alignment"], "aligned")
        self.assertIn("已与策略目标仓位对齐", short_runtime["position_alignment_detail"])

    def test_strategy_runtime_preview_ignores_manual_position_drift_on_same_symbol(self) -> None:
        original_market = control_main.market_data
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")

        first_status, first_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(first_status, 200)
        first_eth_runtime = next((item for item in first_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(first_eth_runtime)
        assert first_eth_runtime is not None
        self.assertEqual(first_eth_runtime["signal"], "long")

        second_status, second_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(second_status, 200)
        second_eth_runtime = next((item for item in second_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(second_eth_runtime)
        assert second_eth_runtime is not None
        self.assertIsNone(second_eth_runtime["execution_preview"])

        manual_status, manual_trade = self._post(
            "/api/trades/manual",
            {
                "symbol": "ETHUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0.18,
                "price": 94.0,
                "note": "manual drift on strategy symbol",
            },
        )
        self.assertEqual(manual_status, 200)
        self.assertEqual(manual_trade["origin"], "manual")

        third_status, third_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(third_status, 200)
        third_eth_runtime = next((item for item in third_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(third_eth_runtime)
        assert third_eth_runtime is not None
        self.assertIsNone(third_eth_runtime["execution_preview"])

    def test_strategy_runtime_flat_signal_closes_existing_paper_position(self) -> None:
        original_market = control_main.market_data
        long_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        long_candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=long_candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")

        long_status, _long_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(long_status, 200)

        flat_candles = [
            CandlePoint(
                time=f"2026-03-30T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.2,
                low=99.8,
                close=100.0,
                volume=1180.0,
            )
            for hour in range(24)
        ]
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=100.0,
            change_24h=0.1,
            candles=flat_candles,
        )

        flat_status, flat_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(flat_status, 200)
        flat_runtime = next((item for item in flat_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(flat_runtime)
        assert flat_runtime is not None
        self.assertEqual(flat_runtime["signal"], "flat")
        self.assertEqual(flat_runtime["execution_preview"]["projected_position_side"], "flat")

        account_status, account_payload = self._get("/api/account/live")
        self.assertEqual(account_status, 200)
        self.assertFalse(any(item["symbol"] == "ETHUSDT" for item in account_payload["positions"]))

    def test_strategy_runtime_blocked_execution_promotes_system_alert(self) -> None:
        original_market = control_main.market_data
        long_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        long_candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=long_candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")
        overview_status, overview_payload = self._get("/api/account/live")
        self.assertEqual(overview_status, 200)

        available_cash = float(str(overview_payload["overview"]["total_available_balance"]).replace("USDT", "").replace(",", "").strip())
        drain_quantity = round(max((available_cash - 8.0) / 86125.4, 0.001), 4)
        drain_status, _drain_trade = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": drain_quantity,
                "price": 86125.4,
                "note": "drain paper cash before blocked strategy test",
            },
        )
        self.assertEqual(drain_status, 200)

        runtime_status, runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(runtime_status, 200)
        eth_runtime = next((item for item in runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(eth_runtime)
        assert eth_runtime is not None
        self.assertFalse(eth_runtime["execution_preview"]["allowed"])
        self.assertIn("余额不足", eth_runtime["execution_preview"]["blocked_reason"])

        alerts_status, alerts_payload = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        blocked_alerts = [
            item
            for item in alerts_payload
            if item["source_type"] == "system" and item["title"].endswith("执行被风控拦截")
        ]
        self.assertEqual(len(blocked_alerts), 1)
        self.assertEqual(blocked_alerts[0]["symbol"], "ETHUSDT")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "risk.blocked_order" for item in audit_events))
        self.assertTrue(any(item["event_type"] == "alert.system_triggered" for item in audit_events))

    def test_strategy_runtime_stop_loss_closes_paper_position_and_alerts(self) -> None:
        original_market = control_main.market_data
        long_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        long_candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=long_candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")

        first_status, first_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(first_status, 200)
        first_eth_runtime = next((item for item in first_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(first_eth_runtime)
        assert first_eth_runtime is not None
        self.assertEqual(first_eth_runtime["signal"], "long")

        stop_candles = [
            CandlePoint(
                time=f"2026-03-30T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.2,
                low=99.4,
                close=100.0,
                volume=1180.0,
            )
            for hour in range(23)
        ]
        stop_candles.append(
            CandlePoint(
                time="2026-03-31T23:00:00+08:00",
                open=100.0,
                high=100.1,
                low=91.8,
                close=92.0,
                volume=2200.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=92.0,
            change_24h=-3.1,
            candles=stop_candles,
        )

        second_status, second_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(second_status, 200)
        second_eth_runtime = next((item for item in second_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(second_eth_runtime)
        assert second_eth_runtime is not None
        self.assertIn("已触发本地止损", second_eth_runtime["note"])

        account_status, account_payload = self._get("/api/account/live")
        self.assertEqual(account_status, 200)
        self.assertFalse(any(item["symbol"] == "ETHUSDT" for item in account_payload["positions"]))

        alerts_status, alerts_payload = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertTrue(
            any(item["source_type"] == "system" and item["title"].endswith("触发本地止损") for item in alerts_payload)
        )

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.paper_stop_loss.executed" for item in audit_events))

    def test_strategy_runtime_stop_loss_enforces_cooldown_before_reentry(self) -> None:
        original_market = control_main.market_data
        long_candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        long_candles.append(
            CandlePoint(
                time="2026-03-30T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=long_candles,
        )
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))

        self._reset_strategy_paper_state("eth-revert-02")

        first_status, first_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(first_status, 200)
        first_eth_runtime = next((item for item in first_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(first_eth_runtime)
        assert first_eth_runtime is not None
        self.assertEqual(first_eth_runtime["signal"], "long")

        stop_candles = [
            CandlePoint(
                time=f"2026-03-30T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.2,
                low=99.4,
                close=100.0,
                volume=1180.0,
            )
            for hour in range(23)
        ]
        stop_candles.append(
            CandlePoint(
                time="2026-03-31T23:00:00+08:00",
                open=100.0,
                high=100.1,
                low=91.8,
                close=92.0,
                volume=2200.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=92.0,
            change_24h=-3.1,
            candles=stop_candles,
        )
        stop_status, _stop_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(stop_status, 200)

        reentry_candles = [
            CandlePoint(
                time=f"2026-03-31T{hour:02d}:00:00+08:00",
                open=100.0,
                high=100.6,
                low=99.4,
                close=100.0,
                volume=1200.0,
            )
            for hour in range(23)
        ]
        reentry_candles.append(
            CandlePoint(
                time="2026-04-01T23:00:00+08:00",
                open=100.0,
                high=100.2,
                low=93.6,
                close=94.0,
                volume=1880.0,
            )
        )
        control_main.market_data = StubStrategyRuntimeMarketClient(
            symbol="ETHUSDT",
            price=94.0,
            change_24h=-2.4,
            candles=reentry_candles,
        )

        cooldown_status, cooldown_runtime_payload = self._get("/api/strategies/live")
        self.assertEqual(cooldown_status, 200)
        cooldown_runtime = next((item for item in cooldown_runtime_payload if item["strategy_id"] == "eth-revert-02"), None)
        self.assertIsNotNone(cooldown_runtime)
        assert cooldown_runtime is not None
        self.assertEqual(cooldown_runtime["signal"], "long")
        self.assertIsNone(cooldown_runtime["execution_preview"])
        self.assertIn("冷却期", cooldown_runtime["note"])

        account_status, account_payload = self._get("/api/account/live")
        self.assertEqual(account_status, 200)
        self.assertFalse(any(item["symbol"] == "ETHUSDT" for item in account_payload["positions"]))

    def test_market_live_snapshot_supports_timeframe_override(self) -> None:
        status, payload = self._get("/api/market/live?symbol=ETHUSDT&timeframe=4h")
        self.assertEqual(status, 200)
        self.assertEqual(payload["detail"]["timeframe"], "4h")
        self.assertEqual(payload["detail"]["source"], "bybit_rest")
        self.assertEqual(payload["diagnostics"]["timeframe"], "4h")
        self.assertGreaterEqual(len(payload["watchlist_details"]), 4)
        self.assertTrue(all(item["timeframe"] == "4h" for item in payload["watchlist_details"]))
        self.assertTrue(any(item["symbol"] == "ETHUSDT" for item in payload["watchlist_details"]))

    def test_market_live_snapshot_auto_corrects_missing_symbol_to_valid_watchlist_item(self) -> None:
        status, payload = self._get("/api/market/live?symbol=DOGEUSDT&timeframe=1h")
        self.assertEqual(status, 200)
        self.assertEqual(payload["diagnostics"]["requested_symbol"], "DOGEUSDT")
        self.assertTrue(payload["diagnostics"]["selection_corrected"])
        self.assertEqual(payload["selected_symbol"], payload["diagnostics"]["effective_symbol"])
        self.assertEqual(payload["detail"]["symbol"], payload["selected_symbol"])
        self.assertTrue(any(item["symbol"] == payload["selected_symbol"] for item in payload["watchlist"]))

    def test_market_live_snapshot_rejects_invalid_timeframe(self) -> None:
        status, payload = self._get("/api/market/live?symbol=ETHUSDT&timeframe=2h")
        self.assertEqual(status, 400)
        self.assertIn("仅支持", payload["detail"])

    def test_market_stream_once_returns_sse_snapshot(self) -> None:
        status, body = self._get_text("/api/market/stream?symbol=BTCUSDT&once=true")
        self.assertEqual(status, 200)
        self.assertIn("event: snapshot", body)
        self.assertIn('"selected_symbol": "BTCUSDT"', body)
        self.assertIn('"symbol": "BTCUSDT"', body)

    def test_market_stream_rejects_invalid_timeframe_before_streaming(self) -> None:
        status, payload = self._get("/api/market/stream?symbol=BTCUSDT&once=true&timeframe=2h")
        self.assertEqual(status, 400)
        self.assertIn("仅支持", payload["detail"])

    def test_news_endpoint_merges_bybit_announcements(self) -> None:
        status, payload = self._get("/api/news")
        self.assertEqual(status, 200)
        self.assertGreaterEqual(len(payload), 1)
        self.assertTrue(any(item["source"] == "Bybit 公告" for item in payload))
        target = next(item for item in payload if item["source"] == "Bybit 公告")
        self.assertEqual(target["category"], "announcement")
        self.assertTrue(target["url"].startswith("https://"))
        self.assertGreaterEqual(len(target["related_alert_ids"]), 1)

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertTrue(any(item["related_news_id"] == target["id"] and item["source_type"] == "news" for item in alerts))

        second_status, second_payload = self._get("/api/news")
        self.assertEqual(second_status, 200)
        second_target = next(item for item in second_payload if item["id"] == target["id"])
        self.assertEqual(len(second_target["related_alert_ids"]), 1)

        refreshed_alerts_status, refreshed_alerts = self._get("/api/alerts")
        self.assertEqual(refreshed_alerts_status, 200)
        matching_news_alerts = [item for item in refreshed_alerts if item["related_news_id"] == target["id"]]
        self.assertEqual(len(matching_news_alerts), 1)

    def test_grafana_status_and_metrics_endpoint_are_available(self) -> None:
        status, grafana = self._get("/api/integrations/grafana")
        self.assertEqual(status, 200)
        self.assertFalse(grafana["configured"])
        self.assertEqual(grafana["metrics_path"], "/metrics")
        self.assertEqual(grafana["recommended_scope"], "ops_monitoring_only")

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertIn("bybit_control_watchlist_total", metrics_body)
        self.assertIn("bybit_control_scheduler_queue_depth", metrics_body)
        self.assertIn('bybit_control_watchlist_change_24h{symbol="BTCUSDT"', metrics_body)
        self.assertIn('bybit_control_market_ws_connected{channel="spot"}', metrics_body)
        self.assertIn("bybit_control_private_ws_connected", metrics_body)
        self.assertIn("bybit_control_private_ws_authenticated", metrics_body)
        self.assertIn("bybit_control_private_ws_stale", metrics_body)
        self.assertIn("bybit_control_private_ws_stale_seconds", metrics_body)
        self.assertIn("bybit_control_market_live_snapshot_error", metrics_body)
        self.assertIn("bybit_control_market_live_generation_ms", metrics_body)
        self.assertIn("bybit_control_market_live_detail_candle_count", metrics_body)
        self.assertIn("bybit_control_market_live_selection_corrected", metrics_body)
        self.assertIn("bybit_control_market_live_watchlist_real_detail_count", metrics_body)
        self.assertIn("bybit_control_market_live_watchlist_fallback_detail_count", metrics_body)
        self.assertIn("bybit_control_market_live_watchlist_source_breakdown", metrics_body)
        self.assertIn("bybit_control_paper_realized_pnl", metrics_body)
        self.assertIn("bybit_control_paper_win_rate", metrics_body)
        self.assertIn("bybit_control_paper_open_orders", metrics_body)
        self.assertIn("bybit_control_paper_positions", metrics_body)
        self.assertIn("bybit_control_paper_available_balance", metrics_body)
        self.assertIn("bybit_control_strategy_live_stop_loss_guard", metrics_body)
        self.assertIn("bybit_control_strategy_live_stop_loss_cooldown_minutes", metrics_body)
        self.assertIn("bybit_control_strategy_auto_dispatch_blocked", metrics_body)
        self.assertIn("bybit_control_strategy_exchange_rejection_guard", metrics_body)
        self.assertIn("bybit_control_strategy_exchange_rejection_cooldown_minutes", metrics_body)
        self.assertIn("bybit_control_strategy_stale_order_guard", metrics_body)
        self.assertIn('bybit_control_strategy_issue_total{issue="stale_order_guard"}', metrics_body)
        self.assertIn('bybit_control_strategy_issue_total{issue="position_drift"}', metrics_body)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_ws_connected "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_ws_connected "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_private_ws_connected "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_private_ws_connected "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_private_ws_stale "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_private_ws_stale "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_private_ws_stale_seconds "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_private_ws_stale_seconds "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_live_snapshot_error "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_live_snapshot_error "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_live_generation_ms "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_live_generation_ms "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_live_detail_candle_count "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_live_detail_candle_count "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_live_selection_corrected "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_live_selection_corrected "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_live_watchlist_real_detail_count "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_live_watchlist_real_detail_count "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_live_watchlist_fallback_detail_count "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_live_watchlist_fallback_detail_count "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_market_live_watchlist_source_breakdown "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_market_live_watchlist_source_breakdown "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_alerts_total "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_alerts_total "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_watchlist_signal_state "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_watchlist_signal_state "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_paper_realized_pnl "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_paper_realized_pnl "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_paper_open_orders "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_paper_open_orders "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_live_stop_loss_guard "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_live_stop_loss_guard "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_live_stop_loss_cooldown_minutes "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_live_stop_loss_cooldown_minutes "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_auto_dispatch_blocked "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_auto_dispatch_blocked "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_exchange_rejection_guard "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_exchange_rejection_guard "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_exchange_rejection_cooldown_minutes "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_exchange_rejection_cooldown_minutes "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_stale_order_guard "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_stale_order_guard "), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_issue_total "), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_issue_total "), 1)
        self.assertRegex(
            metrics_body,
            r'bybit_control_market_live_snapshot_error\{requested_symbol="BTCUSDT",timeframe="1h"\} 0',
        )
        self.assertRegex(
            metrics_body,
            r'bybit_control_market_live_generation_ms\{requested_symbol="BTCUSDT",effective_symbol="BTCUSDT",timeframe="1h",detail_source="(?:bybit_ws|bybit_rest|fallback|mock)"\} \d+',
        )
        self.assertRegex(
            metrics_body,
            r'bybit_control_market_live_detail_candle_count\{requested_symbol="BTCUSDT",effective_symbol="BTCUSDT",timeframe="1h",detail_source="(?:bybit_ws|bybit_rest|fallback|mock)"\} \d+',
        )
        self.assertIn(
            'bybit_control_market_live_selection_corrected{requested_symbol="BTCUSDT",effective_symbol="BTCUSDT",timeframe="1h"} 0',
            metrics_body,
        )
        self.assertRegex(
            metrics_body,
            r'bybit_control_market_live_watchlist_real_detail_count\{timeframe="1h"\} \d+',
        )
        self.assertRegex(
            metrics_body,
            r'bybit_control_market_live_watchlist_fallback_detail_count\{timeframe="1h"\} \d+',
        )

    def test_metrics_endpoint_escapes_strategy_id_labels(self) -> None:
        injected_strategy_id = 'trend"\n\\btc'
        first_strategy = control_main.repo.state.strategies[0]
        control_main.repo.state.strategies[0] = first_strategy.model_copy(update={"id": injected_strategy_id})
        control_main.repo._persist(control_main.repo.state)

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)

        escaped_strategy_id = (
            injected_strategy_id.replace("\\", "\\\\").replace("\n", "\\n").replace('"', '\\"')
        )

        self.assertIn(f'strategy_id="{escaped_strategy_id}"', metrics_body)
        self.assertNotIn(f'strategy_id="{injected_strategy_id}"', metrics_body)

    def test_settings_endpoint_updates_local_settings_and_grafana_status(self) -> None:
        status, payload = self._post(
            "/api/settings",
            {
                "bybit_web_entry": "https://www.bybit-global.com/",
                "api_base_url": "https://api-demo.bybit.com/",
                "default_mode": "live",
                "notification_channels": ["desktop", "email"],
                "notification_quiet_hours_enabled": True,
                "notification_quiet_hours_start": "22:30",
                "notification_quiet_hours_end": "07:15",
                "product_language": "en-US",
                "grafana_base_url": "https://grafana.local/",
                "grafana_dashboard_uid": "control-tower",
                "grafana_org_id": 2,
                "grafana_theme": "light",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["bybit_web_entry"], "https://www.bybit-global.com")
        self.assertEqual(payload["api_base_url"], "https://api-demo.bybit.com")
        self.assertEqual(payload["default_mode"], "live")
        self.assertEqual(payload["notification_channels"], ["desktop", "email"])
        self.assertTrue(payload["notification_quiet_hours_enabled"])
        self.assertEqual(payload["notification_quiet_hours_start"], "22:30")
        self.assertEqual(payload["notification_quiet_hours_end"], "07:15")
        self.assertEqual(payload["product_language"], "en-US")
        self.assertEqual(payload["grafana_base_url"], "https://grafana.local")
        self.assertEqual(payload["grafana_dashboard_uid"], "control-tower")
        self.assertEqual(payload["grafana_org_id"], 2)
        self.assertEqual(payload["grafana_theme"], "light")
        self.assertEqual(control_main.market_data.base_url, "https://api-demo.bybit.com")

        settings_status, settings = self._get("/api/settings")
        self.assertEqual(settings_status, 200)
        self.assertEqual(settings["api_base_url"], "https://api-demo.bybit.com")
        self.assertEqual(settings["notification_channels"], ["desktop", "email"])
        self.assertTrue(settings["notification_quiet_hours_enabled"])

        grafana_status, grafana = self._get("/api/integrations/grafana")
        self.assertEqual(grafana_status, 200)
        self.assertTrue(grafana["configured"])
        self.assertEqual(grafana["base_url"], "https://grafana.local")
        self.assertEqual(grafana["dashboard_uid"], "control-tower")
        self.assertEqual(grafana["org_id"], 2)
        self.assertEqual(grafana["theme"], "light")
        self.assertIn("https://grafana.local/d/control-tower", grafana["dashboard_url"])

        audit_status, audit = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        event = next(item for item in audit if item["event_type"] == "settings.updated")
        self.assertEqual(event["source"], "desktop")
        self.assertEqual(event["payload"]["summary"], "本地设置已更新。")
        self.assertEqual(event["payload"]["default_mode"], "live")
        self.assertEqual(event["payload"]["notification_channels"], ["desktop", "email"])
        self.assertTrue(event["payload"]["notification_quiet_hours_enabled"])
        self.assertEqual(event["payload"]["notification_quiet_hours_start"], "22:30")
        self.assertEqual(event["payload"]["notification_quiet_hours_end"], "07:15")

    def test_settings_endpoint_validates_notification_channels_and_supports_clearing_grafana(self) -> None:
        seeded_status, seeded = self._post(
            "/api/settings",
            {
                "grafana_base_url": "https://grafana.local/",
                "grafana_dashboard_uid": "control-tower",
                "grafana_org_id": 3,
                "grafana_theme": "dark",
                "notification_quiet_hours_enabled": True,
                "notification_quiet_hours_start": "23:00",
                "notification_quiet_hours_end": "08:00",
            },
        )
        self.assertEqual(seeded_status, 200)
        self.assertEqual(seeded["grafana_base_url"], "https://grafana.local")

        cleared_status, cleared = self._post(
            "/api/settings",
            {
                "grafana_base_url": "",
                "grafana_dashboard_uid": "",
            },
        )
        self.assertEqual(cleared_status, 200)
        self.assertIsNone(cleared["grafana_base_url"])
        self.assertIsNone(cleared["grafana_dashboard_uid"])

        grafana_status, grafana = self._get("/api/integrations/grafana")
        self.assertEqual(grafana_status, 200)
        self.assertFalse(grafana["configured"])
        self.assertIsNone(grafana["dashboard_url"])

        invalid_status, error = self._post("/api/settings", {"notification_channels": []})
        self.assertEqual(invalid_status, 400)
        self.assertIn("至少保留一个通知渠道", error["detail"])

        invalid_quiet_status, quiet_error = self._post(
            "/api/settings",
            {
                "notification_quiet_hours_enabled": True,
                "notification_quiet_hours_start": "09:00",
                "notification_quiet_hours_end": "09:00",
            },
        )
        self.assertEqual(invalid_quiet_status, 400)
        self.assertIn("通知静默开始和结束时间不能相同", quiet_error["detail"])

    def test_ai_live_snapshot_returns_scheduler_jobs_and_activity(self) -> None:
        status, payload = self._get("/api/ai/live")
        self.assertEqual(status, 200)
        self.assertIn("scheduler", payload)
        self.assertIn("jobs", payload)
        self.assertIn("change_requests", payload)
        self.assertIn("latest_scheduler_command", payload)
        self.assertIn("activity_feed", payload)
        self.assertGreaterEqual(len(payload["activity_feed"]), 1)
        self.assertIn("generated_at", payload)

    def test_ai_stream_once_returns_sse_snapshot(self) -> None:
        status, body = self._get_text("/api/ai/stream?once=true")
        self.assertEqual(status, 200)
        self.assertIn("event: snapshot", body)
        self.assertIn('"scheduler"', body)
        self.assertIn('"activity_feed"', body)

    def test_strategy_stream_once_returns_sse_snapshot(self) -> None:
        status, body = self._get_text("/api/strategies/stream?once=true")
        self.assertEqual(status, 200)
        self.assertIn("event: snapshot", body)
        self.assertIn('"items"', body)
        self.assertIn('"strategy_id"', body)

    def test_ops_live_snapshot_returns_alerts_trades_and_audit_together(self) -> None:
        status, payload = self._get("/api/ops/live")
        self.assertEqual(status, 200)
        self.assertIn("summary", payload)
        self.assertIn("alerts", payload)
        self.assertIn("trades", payload)
        self.assertIn("audit_events", payload)
        self.assertIn("latest_scheduler_command", payload)
        self.assertIn("generated_at", payload)
        self.assertGreaterEqual(payload["summary"]["pending_alerts"], 0)
        self.assertGreaterEqual(payload["summary"]["recent_trades"], 0)
        self.assertIn("execution_issue_total", payload["summary"])
        self.assertIn("execution_top_issue", payload["summary"])
        self.assertIn("execution_top_issue_symbol", payload["summary"])
        self.assertIn("execution_top_issue_detail", payload["summary"])

    def test_scheduler_snapshots_surface_latest_scheduler_command(self) -> None:
        control_main.repo.add_event(
            event_type="scheduler.command",
            source="desktop",
            severity=control_main.EventSeverity.WARNING,
            payload={
                "command": "cancel_all",
                "summary": "已终止 1 个回测复盘任务。",
                "review_id": "review-unit-latest-command",
                "retry_job_id": "job-retry-latest-command",
                "cancelled_job_types": ["generate_backtest_review"],
                "cancelled_strategy_ids": ["trend-btc-01"],
                "cancelled_backtest_ids": ["bt-unit-latest-command"],
                "cancelled_source_change_request_ids": ["cr-unit-source-command"],
                "cancelled_source_backtest_ids": ["bt-unit-source-command"],
                "cancelled_source_review_ids": ["review-unit-source-command"],
                "cancelled_source_proposal_ids": ["proposal-unit-source-command"],
                "cancelled_trigger_reasons": ["manual_review"],
                "cancelled_decision_readiness_values": ["sample_incomplete"],
            },
        )

        for path in ("/api/control/snapshot", "/api/ai/scheduler", "/api/ai/live", "/api/ops/live"):
            status, payload = self._get(path)
            self.assertEqual(status, 200, path)
            latest = payload.get("latest_scheduler_command")
            self.assertIsNotNone(latest, path)
            assert latest is not None
            self.assertEqual(latest["command"], "cancel_all", path)
            self.assertEqual(latest["summary"], "已终止 1 个回测复盘任务。", path)
            self.assertEqual(latest["job_id"], "job-retry-latest-command", path)
            self.assertEqual(latest["linked_review_id"], "review-unit-latest-command", path)
            self.assertEqual(latest["strategy_id"], "trend-btc-01", path)
            self.assertEqual(latest["backtest_id"], "bt-unit-latest-command", path)
            self.assertEqual(latest["source_change_request_id"], "cr-unit-source-command", path)
            self.assertEqual(latest["source_backtest_id"], "bt-unit-source-command", path)
            self.assertEqual(latest["source_review_id"], "review-unit-source-command", path)
            self.assertEqual(latest["source_proposal_id"], "proposal-unit-source-command", path)
            self.assertEqual(latest["severity"], "warning", path)
            self.assertIn("任务 generate_backtest_review", latest["impact_detail"], path)
            self.assertIn("策略 trend-btc-01", latest["impact_detail"], path)
            self.assertIn("来源变更 cr-unit-source-command", latest["impact_detail"], path)

    def test_ops_stream_once_returns_sse_snapshot(self) -> None:
        status, body = self._get_text("/api/ops/stream?once=true")
        self.assertEqual(status, 200)
        self.assertIn("event: snapshot", body)
        self.assertIn('"summary"', body)
        self.assertIn('"alerts"', body)
        self.assertIn('"audit_events"', body)

    def test_account_live_snapshot_and_stream_are_available(self) -> None:
        status, payload = self._get("/api/account/live")
        self.assertEqual(status, 200)
        self.assertIn("overview", payload)
        self.assertIn("positions", payload)
        self.assertIn("orders", payload)
        self.assertIn("order_history", payload)
        self.assertIn("generated_at", payload)

        stream_status, body = self._get_text("/api/account/stream?once=true")
        self.assertEqual(stream_status, 200)
        self.assertIn("event: snapshot", body)
        self.assertIn('"overview"', body)
        self.assertIn('"positions"', body)
        self.assertIn('"order_history"', body)

    def test_agent_job_lifecycle_can_be_claimed_and_completed(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None

        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_daily_review",
                "context": {"focus_symbols": ["BTCUSDT"], "mode": "paper"},
                "allowed_actions": ["review", "summarize"],
                "timeout": 60,
                "idempotency_key": "unit-test-job-lifecycle",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created["status"], "queued")
        self.assertIn("execution_health", created["context"])
        self.assertIn("execution_top_issue", created["context"])

        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        self.assertEqual(claimed.status.value, "running")

        review = control_main.build_fallback_review_document({"focus_symbols": ["BTCUSDT"]})
        completed = control_main.repo.complete_agent_job(
            claimed.id,
            result_summary="本地回退复盘已完成。",
            review=review,
            source="local_fallback",
        )
        self.assertEqual(completed.status.value, "completed")

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        self.assertIsNone(scheduler["scheduler"]["current_job_id"])

        reviews_status, reviews = self._get("/api/ai/reviews")
        self.assertEqual(reviews_status, 200)
        self.assertEqual(reviews[0]["id"], review.id)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "openclaw.job.completed")
        self.assertEqual(audit_events[0]["payload"]["review_id"], review.id)
        self.assertEqual(audit_events[0]["payload"]["review_title"], review.title)
        self.assertEqual(audit_events[0]["payload"]["review_period"], review.period)

    def test_backtest_review_job_completion_writes_lineage_and_decision_into_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None

        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-001",
                    "source_change_request_id": "cr-parent-001",
                    "source_backtest_id": "bt-parent-001",
                    "source_review_id": "review-parent-001",
                    "source_proposal_id": "prop-parent-001",
                    "trigger_reason": "proposal_accept",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 180 天",
                    "decision_recommended_timeframe": "4h",
                    "decision_readiness_action": "保持最近 180 天，改成 4h 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-backtest-review-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created["status"], "queued")

        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        assert claimed is not None
        self.assertEqual(claimed.status.value, "running")

        review = control_main.ReviewDocument(
            id="review-backtest-audit-001",
            period="backtest",
            strategy_id="trend-btc-01",
            backtest_id="bt-unit-001",
            source_change_request_id="cr-parent-001",
            source_backtest_id="bt-parent-001",
            source_review_id="review-parent-001",
            source_proposal_id="prop-parent-001",
            trigger_reason="proposal_accept",
            decision_readiness="sample_incomplete",
            decision_readiness_detail="当前样本窗口仍未完整覆盖。",
            decision_recommended_data_range="最近 180 天",
            decision_recommended_timeframe="4h",
            decision_readiness_action="保持最近 180 天，改成 4h 后重跑。",
            title="BTC 回测复盘",
            summary="当前样本窗口仍未完整覆盖，建议补样本后重跑。",
            highlights=["来源链路已保留。"],
            risks=["当前样本仍待补。"],
            proposals=[],
            created_at="2026-04-03T12:00:00Z",
        )
        completed = control_main.repo.complete_agent_job(
            claimed.id,
            result_summary="回测复盘已完成。",
            review=review,
            source="openclaw",
        )
        self.assertEqual(completed.status.value, "completed")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "openclaw.job.completed")
        payload = audit_events[0]["payload"]
        self.assertEqual(payload["review_id"], review.id)
        self.assertEqual(payload["backtest_id"], "bt-unit-001")
        self.assertEqual(payload["source_change_request_id"], "cr-parent-001")
        self.assertEqual(payload["source_backtest_id"], "bt-parent-001")
        self.assertEqual(payload["source_review_id"], "review-parent-001")
        self.assertEqual(payload["source_proposal_id"], "prop-parent-001")
        self.assertEqual(payload["trigger_reason"], "proposal_accept")
        self.assertEqual(payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(payload["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(payload["decision_recommended_timeframe"], "4h")
        self.assertEqual(payload["decision_readiness_action"], "保持最近 180 天，改成 4h 后重跑。")

    def test_backtest_review_job_queued_event_writes_lineage_and_decision_into_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None

        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-000",
                    "source_change_request_id": "cr-parent-000",
                    "source_backtest_id": "bt-parent-000",
                    "source_review_id": "review-parent-000",
                    "source_proposal_id": "prop-parent-000",
                    "trigger_reason": "manual_create",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 180 天",
                    "decision_recommended_timeframe": "4h",
                    "decision_readiness_action": "保持最近 180 天，改成 4h 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-backtest-review-queued-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created["status"], "queued")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "openclaw.job.queued")
        payload = audit_events[0]["payload"]
        self.assertEqual(payload["summary"], "任务已入队：generate_backtest_review")
        self.assertEqual(payload["job_id"], created["id"])
        self.assertEqual(payload["backtest_id"], "bt-unit-000")
        self.assertEqual(payload["source_change_request_id"], "cr-parent-000")
        self.assertEqual(payload["source_backtest_id"], "bt-parent-000")
        self.assertEqual(payload["source_review_id"], "review-parent-000")
        self.assertEqual(payload["source_proposal_id"], "prop-parent-000")
        self.assertEqual(payload["trigger_reason"], "manual_create")
        self.assertEqual(payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(payload["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(payload["decision_recommended_timeframe"], "4h")
        self.assertEqual(payload["decision_readiness_action"], "保持最近 180 天，改成 4h 后重跑。")

    def test_backtest_review_job_started_event_writes_lineage_and_decision_into_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None

        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-002",
                    "source_backtest_id": "bt-parent-002",
                    "source_review_id": "review-parent-002",
                    "source_proposal_id": "prop-parent-002",
                    "trigger_reason": "review_decision_rerun",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 180 天",
                    "decision_recommended_timeframe": "4h",
                    "decision_readiness_action": "保持最近 180 天，改成 4h 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-backtest-review-start-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created["status"], "queued")

        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        assert claimed is not None
        self.assertEqual(claimed.status.value, "running")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "openclaw.job.started")
        payload = audit_events[0]["payload"]
        self.assertEqual(payload["summary"], "任务开始执行：generate_backtest_review")
        self.assertEqual(payload["backtest_id"], "bt-unit-002")
        self.assertEqual(payload["source_backtest_id"], "bt-parent-002")
        self.assertEqual(payload["source_review_id"], "review-parent-002")
        self.assertEqual(payload["source_proposal_id"], "prop-parent-002")
        self.assertEqual(payload["trigger_reason"], "review_decision_rerun")
        self.assertEqual(payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(payload["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(payload["decision_recommended_timeframe"], "4h")
        self.assertEqual(payload["decision_readiness_action"], "保持最近 180 天，改成 4h 后重跑。")

    def test_backtest_review_job_failure_writes_lineage_and_decision_into_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None

        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-003",
                    "source_backtest_id": "bt-parent-003",
                    "source_review_id": "review-parent-003",
                    "source_proposal_id": "prop-parent-003",
                    "trigger_reason": "proposal_accept",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 90 天",
                    "decision_recommended_timeframe": "1d",
                    "decision_readiness_action": "保持最近 90 天，改成 1d 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-backtest-review-failed-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created["status"], "queued")

        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        assert claimed is not None
        failed = control_main.repo.fail_agent_job(claimed.id, "OpenClaw 连接中断。", source="openclaw")
        self.assertEqual(failed.status.value, "failed")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "openclaw.job.failed")
        payload = audit_events[0]["payload"]
        self.assertEqual(payload["summary"], "OpenClaw 连接中断。")
        self.assertEqual(payload["error"], "OpenClaw 连接中断。")
        self.assertEqual(payload["backtest_id"], "bt-unit-003")
        self.assertEqual(payload["source_backtest_id"], "bt-parent-003")
        self.assertEqual(payload["source_review_id"], "review-parent-003")
        self.assertEqual(payload["source_proposal_id"], "prop-parent-003")
        self.assertEqual(payload["trigger_reason"], "proposal_accept")
        self.assertEqual(payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(payload["decision_recommended_data_range"], "最近 90 天")
        self.assertEqual(payload["decision_recommended_timeframe"], "1d")
        self.assertEqual(payload["decision_readiness_action"], "保持最近 90 天，改成 1d 后重跑。")

    def test_strategy_change_review_job_completion_writes_strategy_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        job = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="review_strategy_change",
                context={
                    "change_request_id": "cr-unit-001",
                    "strategy_id": "trend-btc-01",
                    "summary": "单元测试策略变更跟踪",
                },
                allowed_actions=["review_strategy_change"],
                timeout=60,
                idempotency_key="unit-test-strategy-change-review",
                writeback_target="strategy_activity",
            )
        )
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        review = control_main.build_strategy_tracking_review_document(
            "策略变更已落实，建议继续观察执行健康。",
            job.context,
            "review_strategy_change",
        )
        completed = control_main.repo.complete_agent_job(
            job.id,
            result_summary="策略变更已落实，建议继续观察执行健康。",
            review=review,
            source="local_fallback",
        )
        self.assertEqual(completed.status.value, "completed")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        review_event = next((item for item in audit_events if item["event_type"] == "strategy.change.review.completed"), None)
        self.assertIsNotNone(review_event)
        assert review_event is not None
        self.assertEqual(review_event["payload"]["change_request_id"], "cr-unit-001")
        self.assertEqual(review_event["payload"]["strategy_id"], "trend-btc-01")
        self.assertIsNone(review_event["payload"]["source_review_id"])
        self.assertIsNone(review_event["payload"]["source_proposal_id"])
        self.assertIsNone(review_event["payload"]["trigger_reason"])
        self.assertEqual(review_event["payload"]["linked_review_id"], review.id)
        self.assertEqual(review_event["payload"]["linked_review_title"], review.title)
        self.assertEqual(review_event["payload"]["linked_review_period"], review.period)

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self.assertTrue(any(item["id"] == review.id for item in activity["recent_reviews"]))

    def test_strategy_change_review_job_failure_writes_strategy_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        job = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="review_strategy_change",
                context={
                    "change_request_id": "cr-unit-002",
                    "strategy_id": "trend-btc-01",
                    "summary": "单元测试策略变更跟踪失败",
                },
                allowed_actions=["review_strategy_change"],
                timeout=60,
                idempotency_key="unit-test-strategy-change-review-failed",
                writeback_target="strategy_activity",
            )
        )
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        failed = control_main.repo.fail_agent_job(job.id, "OpenClaw 任务执行失败。", source="local_fallback")
        self.assertEqual(failed.status.value, "failed")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        review_event = next((item for item in audit_events if item["event_type"] == "strategy.change.review.failed"), None)
        self.assertIsNotNone(review_event)
        assert review_event is not None
        self.assertEqual(review_event["payload"]["change_request_id"], "cr-unit-002")
        self.assertEqual(review_event["payload"]["strategy_id"], "trend-btc-01")
        self.assertIsNone(review_event["payload"]["source_review_id"])
        self.assertIsNone(review_event["payload"]["source_proposal_id"])
        self.assertIsNone(review_event["payload"]["trigger_reason"])

    def test_change_request_follow_up_fields_update_after_strategy_change_review_completion(self) -> None:
        status, change_request = self._post(
            "/api/change-requests",
            {
                "type": "strategy.parameter.update",
                "payload": {"strategy_id": "trend-btc-01", "fast_ma": 15},
                "requested_by": "unit_test",
                "source_backtest_id": "bt-001",
                "source_review_id": "review-20260330-daily",
                "source_proposal_id": "prop-002",
                "target_mode": "paper",
                "priority": "high",
                "summary": "补齐变更跟踪结果写回",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(change_request["follow_up_job_type"], "review_strategy_change")
        self.assertEqual(change_request["follow_up_job_status"], "queued")
        follow_up_job_id = change_request["follow_up_job_id"]
        self.assertIsNotNone(follow_up_job_id)

        job = next(item for item in control_main.repo.state.agent_jobs if item.id == follow_up_job_id)
        review = control_main.build_strategy_tracking_review_document(
            "这次参数调整已经落地，执行状态稳定。",
            job.context,
            "review_strategy_change",
        )
        completed = control_main.repo.complete_agent_job(
            job.id,
            result_summary="这次参数调整已经落地，执行状态稳定。",
            review=review,
            source="local_fallback",
        )
        self.assertEqual(completed.status.value, "completed")

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        updated = next(item for item in change_requests if item["id"] == change_request["id"])
        self.assertEqual(updated["follow_up_job_id"], job.id)
        self.assertEqual(updated["follow_up_job_type"], "review_strategy_change")
        self.assertEqual(updated["follow_up_job_status"], "completed")
        self.assertEqual(updated["follow_up_result_summary"], "这次参数调整已经落地，执行状态稳定。")
        self.assertEqual(updated["linked_review_id"], review.id)
        self.assertEqual(updated["linked_review_title"], review.title)
        self.assertEqual(updated["linked_review_period"], review.period)
        activity_context = control_main._build_strategy_activity_review_context("trend-btc-01")
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        change_request_context = activity_context["decision_context"]["change_request"]
        self.assertEqual(change_request_context["latest_job_record"]["id"], job.id)
        self.assertEqual(change_request_context["latest_review_record"]["id"], review.id)
        self.assertEqual(change_request_context["latest_source_backtest_record"]["id"], "bt-001")
        self.assertEqual(
            change_request_context["latest_source_review_record"]["id"],
            "review-20260330-daily",
        )
        self.assertEqual(change_request_context["latest_source_proposal_record"]["id"], "prop-002")

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        change_request_context = activity["decision_context"]["change_request"]
        self.assertEqual(change_request_context["latest_job_record"]["id"], job.id)
        self.assertEqual(change_request_context["latest_review_record"]["id"], review.id)
        self.assertEqual(change_request_context["latest_source_backtest_record"]["id"], "bt-001")
        self.assertEqual(change_request_context["latest_source_review_record"]["id"], "review-20260330-daily")
        self.assertEqual(change_request_context["latest_source_proposal_record"]["id"], "prop-002")
        self.assertEqual(activity["latest_change_request_job_record"]["id"], job.id)
        self.assertEqual(activity["latest_change_request_review_record"]["id"], review.id)
        self.assertEqual(activity["latest_change_request_source_backtest_record"]["id"], "bt-001")
        self.assertEqual(activity["latest_change_request_source_review_record"]["id"], "review-20260330-daily")
        self.assertEqual(activity["latest_change_request_source_proposal_record"]["id"], "prop-002")

    def test_change_request_follow_up_fields_update_after_strategy_change_review_failure(self) -> None:
        status, change_request = self._post(
            "/api/change-requests",
            {
                "type": "strategy.risk_update",
                "payload": {"strategy_id": "trend-btc-01", "risk_budget": "10%"},
                "requested_by": "unit_test",
                "source_backtest_id": "bt-001",
                "source_review_id": "review-20260330-daily",
                "source_proposal_id": "prop-002",
                "target_mode": "paper",
                "priority": "high",
                "summary": "补齐变更跟踪失败写回",
            },
        )
        self.assertEqual(status, 200)
        follow_up_job_id = change_request["follow_up_job_id"]
        self.assertIsNotNone(follow_up_job_id)

        failed = control_main.repo.fail_agent_job(
            follow_up_job_id,
            "OpenClaw 任务执行失败。",
            source="local_fallback",
        )
        self.assertEqual(failed.status.value, "failed")

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        updated = next(item for item in change_requests if item["id"] == change_request["id"])
        self.assertEqual(updated["follow_up_job_id"], follow_up_job_id)
        self.assertEqual(updated["follow_up_job_type"], "review_strategy_change")
        self.assertEqual(updated["follow_up_job_status"], "failed")
        self.assertEqual(updated["follow_up_result_summary"], "OpenClaw 任务执行失败。")
        self.assertIsNone(updated["linked_review_id"])
        activity_context = control_main._build_strategy_activity_review_context("trend-btc-01")
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        self.assertIn(change_request["id"], str(activity_context["latest_actionable_change_request"] or ""))
        self.assertIn(follow_up_job_id, str(activity_context["latest_retryable_tracking_job"] or ""))
        change_request_context = activity_context["decision_context"]["change_request"]
        self.assertEqual(change_request_context["actionable_job_record"]["id"], follow_up_job_id)
        self.assertIsNone(change_request_context.get("actionable_review_record"))
        self.assertEqual(change_request_context["actionable_source_backtest_record"]["id"], "bt-001")
        self.assertEqual(
            change_request_context["actionable_source_review_record"]["id"],
            "review-20260330-daily",
        )
        self.assertEqual(change_request_context["actionable_source_proposal_record"]["id"], "prop-002")

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self.assertEqual(activity["latest_actionable_change_request"]["id"], change_request["id"])
        self.assertEqual(activity["latest_retryable_tracking_job"]["id"], follow_up_job_id)
        change_request_context = activity["decision_context"]["change_request"]
        self.assertEqual(change_request_context["actionable_job_record"]["id"], follow_up_job_id)
        self.assertIsNone(change_request_context.get("actionable_review_record"))
        self.assertEqual(change_request_context["actionable_source_backtest_record"]["id"], "bt-001")
        self.assertEqual(change_request_context["actionable_source_review_record"]["id"], "review-20260330-daily")
        self.assertEqual(change_request_context["actionable_source_proposal_record"]["id"], "prop-002")
        self.assertEqual(activity["latest_actionable_change_request_job_record"]["id"], follow_up_job_id)
        self.assertNotIn("latest_actionable_change_request_review_record", activity)
        self.assertEqual(activity["latest_actionable_change_request_source_backtest_record"]["id"], "bt-001")
        self.assertEqual(
            activity["latest_actionable_change_request_source_review_record"]["id"],
            "review-20260330-daily",
        )
        self.assertEqual(activity["latest_actionable_change_request_source_proposal_record"]["id"], "prop-002")

    def test_review_strategy_activity_context_scans_change_requests_once(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        first = control_main.repo.create_change_request(
            control_main.ChangeRequestCreate(
                type="strategy.parameter.update",
                payload={"strategy_id": "trend-btc-01", "fast_ma": 13},
                requested_by="unit_test",
                target_mode=AccountMode.PAPER,
                priority="high",
                summary="旧变更请求",
            )
        )
        first_job = next(item for item in control_main.repo.state.agent_jobs if item.id == first.follow_up_job_id)
        control_main.repo.fail_agent_job(first_job.id, "OpenClaw 任务执行失败。", source="local_fallback")

        second = control_main.repo.create_change_request(
            control_main.ChangeRequestCreate(
                type="strategy.risk_update",
                payload={"strategy_id": "trend-btc-01", "risk_budget": "9%"},
                requested_by="unit_test",
                target_mode=AccountMode.PAPER,
                priority="high",
                summary="更新的普通变更请求",
            )
        )
        second_job = next(item for item in control_main.repo.state.agent_jobs if item.id == second.follow_up_job_id)
        self.addCleanup(
            lambda: control_main.repo.state.change_requests.remove(second)
            if second in control_main.repo.state.change_requests
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.change_requests.remove(first)
            if first in control_main.repo.state.change_requests
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.agent_jobs.remove(first_job)
            if first_job in control_main.repo.state.agent_jobs
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.agent_jobs.remove(second_job)
            if second_job in control_main.repo.state.agent_jobs
            else None
        )

        activity_context = control_main.repo._build_review_strategy_activity_context_locked("trend-btc-01")
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        self.assertIn(second.id, str(activity_context["latest_change_request"] or ""))
        self.assertIn(first.id, str(activity_context["latest_actionable_change_request"] or ""))
        change_request_context = activity_context["decision_context"]["change_request"]
        self.assertEqual(change_request_context["latest_job_record"]["id"], second.follow_up_job_id)
        self.assertEqual(change_request_context["actionable_job_record"]["id"], first.follow_up_job_id)

    def test_change_request_follow_up_fields_reset_when_retrying_cancelled_tracking_job(self) -> None:
        status, change_request = self._post(
            "/api/change-requests",
            {
                "type": "strategy.parameter.update",
                "payload": {"strategy_id": "trend-btc-01", "slow_ma": 30},
                "requested_by": "unit_test",
                "target_mode": "paper",
                "priority": "high",
                "summary": "验证变更跟踪取消后重试回写",
            },
        )
        self.assertEqual(status, 200)
        follow_up_job_id = change_request["follow_up_job_id"]
        self.assertIsNotNone(follow_up_job_id)

        cancel_status, cancel_payload = self._post(
            "/api/ai/scheduler/commands",
            {
                "command": "cancel_job",
                "job_id": follow_up_job_id,
                "requested_by": "unit_test",
                "reason": "人工取消变更跟踪",
            },
        )
        self.assertEqual(cancel_status, 200)
        self.assertEqual(cancel_payload["job_id"], follow_up_job_id)

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        cancelled = next(item for item in change_requests if item["id"] == change_request["id"])
        self.assertEqual(cancelled["follow_up_job_id"], follow_up_job_id)
        self.assertEqual(cancelled["follow_up_job_status"], "cancelled")
        self.assertEqual(cancelled["follow_up_result_summary"], "人工取消变更跟踪")
        self.assertIsNone(cancelled["linked_review_id"])

        retry_status, retried = self._post(
            f"/api/ai/jobs/{follow_up_job_id}/retry",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(retry_status, 200)
        self.assertNotEqual(retried["id"], follow_up_job_id)
        self.assertEqual(retried["status"], "queued")
        self.assertEqual(retried["context"]["change_request_id"], change_request["id"])

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        updated = next(item for item in change_requests if item["id"] == change_request["id"])
        self.assertEqual(updated["follow_up_job_id"], retried["id"])
        self.assertEqual(updated["follow_up_job_type"], "review_strategy_change")
        self.assertEqual(updated["follow_up_job_status"], "queued")
        self.assertIsNone(updated["follow_up_result_summary"])
        self.assertIsNone(updated["linked_review_id"])
        self.assertIsNone(updated["linked_review_title"])
        self.assertIsNone(updated["linked_review_period"])

    def test_strategy_issue_review_job_completion_writes_strategy_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        job = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="review_strategy_issue",
                context={
                    "issue_type": "manual_execution_blocked",
                    "summary": "BTCUSDT 手动策略执行被拦截",
                    "detail": "运行线程异常，建议先恢复运行线程。",
                    "strategy_id": "trend-btc-01",
                },
                allowed_actions=["review_strategy_issue"],
                timeout=60,
                idempotency_key="unit-test-strategy-issue-review",
                writeback_target="strategy_activity",
            )
        )
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        review = control_main.build_strategy_tracking_review_document(
            "策略问题已跟踪，建议先恢复运行线程后再观察执行健康。",
            job.context,
            "review_strategy_issue",
        )
        completed = control_main.repo.complete_agent_job(
            job.id,
            result_summary="策略问题已跟踪，建议先恢复运行线程后再观察执行健康。",
            review=review,
            source="local_fallback",
        )
        self.assertEqual(completed.status.value, "completed")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        review_event = next((item for item in audit_events if item["event_type"] == "strategy.issue.review.completed"), None)
        self.assertIsNotNone(review_event)
        assert review_event is not None
        self.assertEqual(review_event["payload"]["issue_type"], "manual_execution_blocked")
        self.assertEqual(review_event["payload"]["strategy_id"], "trend-btc-01")
        self.assertEqual(review_event["payload"]["linked_review_id"], review.id)
        self.assertEqual(review_event["payload"]["linked_review_title"], review.title)
        self.assertEqual(review_event["payload"]["linked_review_period"], review.period)

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self.assertTrue(any(item["id"] == review.id for item in activity["recent_reviews"]))

    def test_strategy_issue_review_job_failure_writes_strategy_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        job = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="review_strategy_issue",
                context={
                    "issue_type": "stale_order",
                    "summary": "BTCUSDT 策略挂单停滞",
                    "detail": "真实策略委托挂单超过阈值。",
                    "strategy_id": "trend-btc-01",
                },
                allowed_actions=["review_strategy_issue"],
                timeout=60,
                idempotency_key="unit-test-strategy-issue-review-failed",
                writeback_target="strategy_activity",
            )
        )
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        failed = control_main.repo.fail_agent_job(job.id, "OpenClaw 问题跟踪任务失败。", source="local_fallback")
        self.assertEqual(failed.status.value, "failed")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        review_event = next((item for item in audit_events if item["event_type"] == "strategy.issue.review.failed"), None)
        self.assertIsNotNone(review_event)
        assert review_event is not None
        self.assertEqual(review_event["payload"]["issue_type"], "stale_order")
        self.assertEqual(review_event["payload"]["strategy_id"], "trend-btc-01")

    def test_get_reviews_supports_strategy_filter(self) -> None:
        review = control_main.ReviewDocument(
            id="review-unit-strategy-issue",
            period="strategy_issue",
            strategy_id="eth-revert-02",
            title="ETH 问题跟踪",
            summary="ETH 策略执行阻断后已进入跟踪。",
            highlights=["已记录最近一次执行阻断上下文。"],
            risks=["仍需观察冷却结束后的真实执行门禁。"],
            proposals=[],
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        control_main.repo.state.reviews.insert(0, review)

        status, reviews = self._get("/api/ai/reviews?strategy_id=eth-revert-02")
        self.assertEqual(status, 200)
        review_ids = {item["id"] for item in reviews}
        self.assertIn("review-unit-strategy-issue", review_ids)
        self.assertIn("review-20260330-daily", review_ids)

    def test_get_reviews_supports_period_filter(self) -> None:
        issue_review = control_main.ReviewDocument(
            id="review-unit-strategy-issue",
            period="strategy_issue",
            strategy_id="trend-btc-01",
            title="BTC 问题跟踪",
            summary="BTC 策略问题已进入单策略跟踪。",
            highlights=["已记录问题快照。"],
            risks=["仍需观察后续恢复情况。"],
            proposals=[],
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        change_review = control_main.ReviewDocument(
            id="review-unit-strategy-change",
            period="strategy_change",
            strategy_id="trend-btc-01",
            title="BTC 变更跟踪",
            summary="BTC 策略参数变更已进入跟踪。",
            highlights=["已记录最新参数快照。"],
            risks=["仍需结合真实执行观察影响。"],
            proposals=[],
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        control_main.repo.state.reviews.insert(0, change_review)
        control_main.repo.state.reviews.insert(0, issue_review)

        status, reviews = self._get("/api/ai/reviews?period=strategy_issue,strategy_change")
        self.assertEqual(status, 200)
        self.assertTrue(reviews)
        self.assertTrue(all(item["period"] in {"strategy_issue", "strategy_change"} for item in reviews))
        review_ids = {item["id"] for item in reviews}
        self.assertIn("review-unit-strategy-issue", review_ids)
        self.assertIn("review-unit-strategy-change", review_ids)

    def test_get_reviews_supports_backtest_filter(self) -> None:
        matching_review = control_main.ReviewDocument(
            id="review-unit-backtest-match",
            period="backtest",
            strategy_id="trend-btc-01",
            backtest_id="bt-review-001",
            title="BTC 回测复盘",
            summary="这轮回测需要继续补样本。",
            highlights=["当前样本窗口仍未完整覆盖。"],
            risks=["暂不建议直接用于上线判断。"],
            proposals=[],
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        other_review = control_main.ReviewDocument(
            id="review-unit-backtest-other",
            period="backtest",
            strategy_id="trend-btc-01",
            backtest_id="bt-review-002",
            title="BTC 另一轮回测复盘",
            summary="另一轮回测。",
            highlights=["这是另一条记录。"],
            risks=["仍需继续观察。"],
            proposals=[],
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        control_main.repo.state.reviews.insert(0, other_review)
        control_main.repo.state.reviews.insert(0, matching_review)

        status, reviews = self._get("/api/ai/reviews?backtest_id=bt-review-001&period=backtest")
        self.assertEqual(status, 200)
        review_ids = {item["id"] for item in reviews}
        self.assertEqual(review_ids, {"review-unit-backtest-match"})
        self.assertNotIn("review-20260330-daily", review_ids)

    def test_manual_strategy_issue_review_endpoint_queues_tracking_job(self) -> None:
        status, job = self._post(
            "/api/strategies/trend-btc-01/review",
            {
                "review_kind": "issue",
                "summary": "BTC 策略最近出现连续拒单，需要单独跟踪。",
                "detail": "请重点观察最近的真实委托和执行健康。",
                "requested_by": "unit_test",
                "request_key": "manual-issue-001",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(job["job_type"], "review_strategy_issue")
        self.assertEqual(job["writeback_target"], "strategy_activity")
        self.assertEqual(job["context"]["strategy_id"], "trend-btc-01")
        self.assertEqual(job["context"]["requested_by"], "unit_test")
        self.assertEqual(job["context"]["issue_type"], "manual_issue_review")
        self.assertIn("review_strategy_activity", job["context"])
        self.assertIn("execution_health", job["context"])
        activity_context = job["context"]["review_strategy_activity"]
        self.assertEqual(activity_context["strategy_id"], "trend-btc-01")
        self.assertIsNotNone(activity_context["latest_backtest"])
        self.assertTrue(any("bt-" in item for item in activity_context["recent_backtests"]))
        self.assertTrue(
            any(
                job["id"] in item and "review_strategy_issue" in item and "queued" in item
                for item in activity_context["recent_agent_jobs"]
            )
        )
        self.assertIn(job["id"], str(activity_context["latest_tracking_job"] or ""))
        tracking_context = activity_context["decision_context"]["tracking"]
        self.assertEqual(tracking_context["latest_job_record"]["id"], job["id"])
        self.assertIn("latest_proposal", activity_context)
        self.assertIn("latest_proposal_change_request", activity_context)
        self.assertIn("latest_proposal_backtest", activity_context)
        self.assertIn("latest_proposal_review", activity_context)
        self.assertIn("latest_proposal_job", activity_context)
        self.assertIn("latest_change_request", activity_context)
        self.assertIn("recent_reviews", activity_context)

        repeated_status, repeated_job = self._post(
            "/api/strategies/trend-btc-01/review",
            {
                "review_kind": "issue",
                "summary": "BTC 策略最近出现连续拒单，需要单独跟踪。",
                "detail": "请重点观察最近的真实委托和执行健康。",
                "requested_by": "unit_test",
                "request_key": "manual-issue-001",
            },
        )
        self.assertEqual(repeated_status, 200)
        self.assertEqual(repeated_job["id"], job["id"])

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self.assertTrue(any(item["id"] == job["id"] for item in activity["recent_agent_jobs"]))
        self.assertTrue(
            any(
                item["event_type"] == "strategy.review.requested"
                for item in activity["recent_audit_events"]
            )
        )

    def test_manual_strategy_change_review_endpoint_queues_tracking_job(self) -> None:
        status, job = self._post(
            "/api/strategies/eth-revert-02/review",
            {
                "review_kind": "change",
                "summary": "ETH 回归策略刚刚更新止损阈值，继续跟踪执行影响。",
                "detail": "重点确认这次变更是否真正落地，以及是否影响当前执行健康。",
                "requested_by": "unit_test",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(job["job_type"], "review_strategy_change")
        self.assertEqual(job["writeback_target"], "strategy_activity")
        self.assertEqual(job["context"]["strategy_id"], "eth-revert-02")
        self.assertEqual(job["context"]["requested_by"], "unit_test")
        self.assertEqual(job["context"]["change_type"], "manual_change_review")
        self.assertIn("review_strategy_activity", job["context"])
        self.assertIn("execution_health", job["context"])
        activity_context = job["context"]["review_strategy_activity"]
        self.assertEqual(activity_context["strategy_id"], "eth-revert-02")
        self.assertIsNotNone(activity_context["latest_backtest"])
        self.assertTrue(any("bt-" in item for item in activity_context["recent_backtests"]))
        self.assertTrue(
            any(
                job["id"] in item and "review_strategy_change" in item and "queued" in item
                for item in activity_context["recent_agent_jobs"]
            )
        )
        self.assertIn(job["id"], str(activity_context["latest_tracking_job"] or ""))
        self.assertIn("latest_proposal", activity_context)
        self.assertIn("latest_proposal_change_request", activity_context)
        self.assertIn("latest_proposal_backtest", activity_context)
        self.assertIn("latest_proposal_review", activity_context)
        self.assertIn("latest_proposal_job", activity_context)
        self.assertIn("latest_change_request", activity_context)
        self.assertIn("recent_reviews", activity_context)

        activity_status, activity = self._get("/api/strategies/eth-revert-02/activity")
        self.assertEqual(activity_status, 200)
        self.assertTrue(any(item["id"] == job["id"] for item in activity["recent_agent_jobs"]))
        self.assertTrue(
            any(
                item["event_type"] == "strategy.review.requested"
                for item in activity["recent_audit_events"]
            )
        )

    def test_review_strategy_activity_context_uses_high_value_audit_summary(self) -> None:
        audit_event = control_main.ExecutionEvent(
            id="audit-review-strategy-activity-001",
            event_type="scheduler.command",
            severity="warning",
            source="desktop-control",
            symbol="BTCUSDT",
            strategy_id="trend-btc-01",
            payload={
                "summary": "已终止 2 个任务。",
                "cancelled_job_types": ["review_strategy_change", "generate_backtest_review"],
                "cancelled_backtest_ids": ["bt-audit-001"],
                "manual_followup_required": True,
                "manual_followup_detail": "脚本补丁仍待人工落实。",
            },
            trace_id="trace-audit-review-strategy-activity-001",
            occurred_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        control_main.repo.state.audit_events.insert(0, audit_event)
        self.addCleanup(
            lambda: control_main.repo.state.audit_events.remove(audit_event)
            if audit_event in control_main.repo.state.audit_events
            else None
        )

        activity_context = control_main.repo._build_review_strategy_activity_context_locked("trend-btc-01")
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        latest_audit_event = str(activity_context["latest_audit_event"] or "")
        self.assertIn("scheduler.command", latest_audit_event)
        self.assertIn("已终止 2 个任务", latest_audit_event)
        self.assertIn("回测 bt-audit-001", latest_audit_event)
        self.assertIn("需人工跟进", latest_audit_event)
        self.assertIn("脚本补丁仍待人工落实", latest_audit_event)
        self.assertEqual(activity_context["latest_audit_event_record"]["event_type"], "scheduler.command")
        self.assertEqual(activity_context["latest_audit_event_record"]["summary"], "已终止 2 个任务。")
        self.assertIn("回测 bt-audit-001", str(activity_context["latest_audit_event_record"]["impact_detail"] or ""))
        self.assertEqual(activity_context["latest_audit_event_record"]["priority"], 0)
        self.assertTrue(activity_context["latest_audit_event_record"]["is_key_event"])
        self.assertEqual(activity_context["latest_audit_event_record"]["payload"]["summary"], "已终止 2 个任务。")
        self.assertEqual(
            activity_context["latest_audit_event_record"]["payload"]["cancelled_backtest_ids"],
            ["bt-audit-001"],
        )
        self.assertIn("latest_ops", activity_context)
        self.assertEqual(activity_context["latest_ops"]["latest_audit_event_record"]["event_type"], "scheduler.command")
        self.assertIn("latest_runtime", activity_context)
        self.assertEqual(activity_context["latest_runtime"]["latest_ops"]["latest_audit_event_record"]["event_type"], "scheduler.command")
        self.assertTrue(
            any(
                "已终止 2 个任务" in item
                and "回测 bt-audit-001" in item
                and "需人工跟进" in item
                for item in activity_context["recent_audit_events"]
            )
        )

        public_context = control_main._build_strategy_activity_review_context("trend-btc-01")
        self.assertIsNotNone(public_context)
        assert public_context is not None
        self.assertTrue(
            any(
                "已终止 2 个任务" in item
                and "回测 bt-audit-001" in item
                and "需人工跟进" in item
                for item in public_context["recent_audit_events"]
            )
        )

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self._assert_missing_keys(activity, "latest_audit_event", "latest_audit_event_record")
        self.assertIn("已终止 2 个任务", str(activity["latest_ops"].get("latest_audit_event") or ""))
        self.assertIn("回测 bt-audit-001", str(activity["latest_ops"].get("latest_audit_event") or ""))
        self.assertIn("需人工跟进", str(activity["latest_ops"].get("latest_audit_event") or ""))
        self.assertEqual(activity["latest_ops"]["latest_audit_event_record"]["event_type"], "scheduler.command")
        self.assertEqual(activity["latest_ops"]["latest_audit_event_record"]["summary"], "已终止 2 个任务。")
        self.assertIn(
            "回测 bt-audit-001",
            str(activity["latest_ops"]["latest_audit_event_record"]["impact_detail"] or ""),
        )
        self.assertEqual(
            activity["latest_ops"]["latest_audit_event_record"]["payload"]["summary"],
            "已终止 2 个任务。",
        )

    def test_review_strategy_activity_context_includes_latest_alert_order_and_trade(self) -> None:
        now = datetime.now(timezone.utc).astimezone().isoformat()
        later = (datetime.now(timezone.utc).astimezone() + timedelta(seconds=5)).isoformat()
        latest_trade_time = (datetime.now(timezone.utc).astimezone() + timedelta(seconds=10)).isoformat()
        latest_alert_time = (datetime.now(timezone.utc).astimezone() + timedelta(seconds=15)).isoformat()
        strategy_id = "eth-revert-02"
        symbol = "ETHUSDT"
        order = OrderRecord(
            source="paper",
            origin="strategy",
            strategy_id=strategy_id,
            order_id="order-review-context-001",
            symbol=symbol,
            market="perp",
            side="buy",
            order_type="limit",
            qty="0.500",
            price="3568",
            status="filled",
            created_at=now,
        )
        active_order = OrderRecord(
            source="paper",
            origin="strategy",
            strategy_id=strategy_id,
            order_id="order-review-context-active-001",
            symbol=symbol,
            market="perp",
            side="sell",
            order_type="limit",
            qty="0.250",
            price="999999",
            status="New",
            created_at=later,
        )
        trade = TradeRecord(
            id="trade-review-context-001",
            symbol=symbol,
            market="perp",
            mode="paper",
            origin="strategy",
            side="buy",
            quantity=0.5,
            price=3568.0,
            pnl="+12.80 USDT",
            strategy_id=strategy_id,
            created_at=now,
            status="filled",
        )
        latest_trade = TradeRecord(
            id="trade-review-context-002",
            symbol=symbol,
            market="perp",
            mode="paper",
            origin="strategy",
            side="sell",
            quantity=0.25,
            price=3576.0,
            pnl="+18.60 USDT",
            strategy_id=strategy_id,
            created_at=latest_trade_time,
            status="filled",
        )
        alert = AlertRecord(
            id="alert-review-context-001",
            severity="P1",
            symbol=symbol,
            title="ETH 执行受阻",
            description="最近一次策略执行需要人工复核。",
            triggered_at=now,
            suggested_action="先检查最近执行日志。",
            source_type="system",
            rule_key="strategy-manual-execution:eth-revert-02:context",
        )
        latest_alert = AlertRecord(
            id="alert-review-context-002",
            severity="P0",
            symbol=symbol,
            title="ETH 二次执行阻断",
            description="最新一次执行阻断仍需立即人工确认。",
            triggered_at=latest_alert_time,
            suggested_action="立即核对最新阻断详情。",
            acknowledged=True,
            source_type="system",
            rule_key="strategy-manual-execution:eth-revert-02:context-latest",
        )
        latest_pending_alert_time = (datetime.now(timezone.utc).astimezone() + timedelta(seconds=12)).isoformat()
        pending_alert = AlertRecord(
            id="alert-review-context-003",
            severity="P1",
            symbol=symbol,
            title="ETH 待处理执行提醒",
            description="这条提醒仍未确认，需要继续处理。",
            triggered_at=latest_pending_alert_time,
            suggested_action="优先确认这条待处理提醒。",
            acknowledged=False,
            source_type="system",
            rule_key="strategy-manual-execution:eth-revert-02:context-pending",
        )
        control_main.repo.state.paper_orders.insert(0, active_order)
        control_main.repo.state.paper_order_history.insert(0, order)
        control_main.repo.state.trades.insert(0, trade)
        control_main.repo.state.trades.append(latest_trade)
        control_main.repo.state.alerts.insert(0, alert)
        control_main.repo.state.alerts.append(pending_alert)
        control_main.repo.state.alerts.append(latest_alert)
        self.addCleanup(
            lambda: control_main.repo.state.paper_orders.remove(active_order)
            if active_order in control_main.repo.state.paper_orders
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.paper_order_history.remove(order)
            if order in control_main.repo.state.paper_order_history
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.trades.remove(trade)
            if trade in control_main.repo.state.trades
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.trades.remove(latest_trade)
            if latest_trade in control_main.repo.state.trades
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.alerts.remove(alert)
            if alert in control_main.repo.state.alerts
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.alerts.remove(pending_alert)
            if pending_alert in control_main.repo.state.alerts
            else None
        )
        self.addCleanup(
            lambda: control_main.repo.state.alerts.remove(latest_alert)
            if latest_alert in control_main.repo.state.alerts
            else None
        )

        activity_context = control_main.repo._build_review_strategy_activity_context_locked(strategy_id)
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        self.assertIn("ETHUSDT sell 0.25@3576.0", str(activity_context["latest_trade"] or ""))
        self.assertIn("pnl +18.60 USDT", str(activity_context["latest_trade"] or ""))
        self.assertEqual(activity_context["latest_trade_record"]["id"], "trade-review-context-002")
        self.assertEqual(activity_context["latest_trade_record"]["symbol"], symbol)
        self.assertIn("latest_ops", activity_context)
        self.assertEqual(activity_context["latest_ops"]["latest_trade_record"]["id"], "trade-review-context-002")
        self.assertIn("latest_runtime", activity_context)
        self.assertEqual(activity_context["latest_runtime"]["latest_ops"]["latest_trade_record"]["id"], "trade-review-context-002")
        self.assertIn("ETHUSDT sell 0.25@3576.0", str(activity_context["recent_trades"][0] or ""))
        self.assertIn("ETHUSDT sell 0.250@999999", str(activity_context["latest_order"] or ""))
        self.assertIn("New", str(activity_context["latest_order"] or ""))
        self.assertIn("ETHUSDT sell 0.250@999999", str(activity_context["latest_active_order"] or ""))
        self.assertIn("New", str(activity_context["latest_active_order"] or ""))
        self.assertIn("ETHUSDT buy 0.500@3568", str(activity_context["latest_historical_order"] or ""))
        self.assertIn("filled", str(activity_context["latest_historical_order"] or ""))
        self.assertEqual(activity_context["latest_active_order_record"]["order_id"], "order-review-context-active-001")
        self.assertEqual(activity_context["latest_historical_order_record"]["order_id"], "order-review-context-001")
        self.assertEqual(activity_context["latest_order_record"]["order_id"], "order-review-context-active-001")
        self.assertEqual(activity_context["latest_order_record"]["symbol"], symbol)
        self.assertIn("P0 ETH 二次执行阻断", str(activity_context["latest_alert"] or ""))
        self.assertIn("最新一次执行阻断仍需立即人工确认", str(activity_context["latest_alert"] or ""))
        self.assertEqual(activity_context["latest_alert_record"]["id"], "alert-review-context-002")
        self.assertEqual(activity_context["latest_alert_record"]["symbol"], symbol)
        self.assertIn("P1 ETH 待处理执行提醒", str(activity_context["latest_pending_alert"] or ""))
        self.assertIn("仍未确认", str(activity_context["latest_pending_alert"] or ""))
        self.assertEqual(activity_context["latest_pending_alert_record"]["id"], "alert-review-context-003")
        self.assertIn("ETH 二次执行阻断", str(activity_context["recent_alerts"][0] or ""))

        public_context = control_main._build_strategy_activity_review_context(strategy_id)
        self.assertIsNotNone(public_context)
        assert public_context is not None
        self.assertIn("ETHUSDT sell 0.25@3576.0", str(public_context["latest_trade"] or ""))
        self.assertIn("filled", str(public_context["latest_trade"] or ""))
        self.assertEqual(public_context["latest_trade_record"]["id"], "trade-review-context-002")
        self.assertIn("ETHUSDT sell 0.25@3576.0", str(public_context["recent_trades"][0] or ""))
        self.assertIn("ETHUSDT sell 0.250@999999", str(public_context["latest_order"] or ""))
        self.assertIn("New", str(public_context["latest_order"] or ""))
        self.assertIn("ETHUSDT sell 0.250@999999", str(public_context["latest_active_order"] or ""))
        self.assertIn("New", str(public_context["latest_active_order"] or ""))
        self.assertIn("ETHUSDT buy 0.500@3568", str(public_context["latest_historical_order"] or ""))
        self.assertIn("filled", str(public_context["latest_historical_order"] or ""))
        self.assertEqual(public_context["latest_active_order_record"]["order_id"], "order-review-context-active-001")
        self.assertEqual(public_context["latest_historical_order_record"]["order_id"], "order-review-context-001")
        self.assertEqual(public_context["latest_order_record"]["order_id"], "order-review-context-active-001")
        self.assertIn("ETH 二次执行阻断", str(public_context["latest_alert"] or ""))
        self.assertIn("ETH 待处理执行提醒", str(public_context["latest_pending_alert"] or ""))
        self.assertEqual(public_context["latest_pending_alert_record"]["id"], "alert-review-context-003")
        self.assertEqual(public_context["latest_alert_record"]["id"], "alert-review-context-002")
        self.assertIn("ETH 二次执行阻断", str(public_context["recent_alerts"][0] or ""))

        activity_status, activity = self._get(f"/api/strategies/{strategy_id}/activity")
        self.assertEqual(activity_status, 200)
        self._assert_missing_keys(
            activity,
            "latest_active_order",
            "latest_active_order_record",
            "latest_historical_order",
            "latest_historical_order_record",
            "latest_order",
            "latest_order_record",
            "latest_pending_alert",
            "latest_pending_alert_record",
            "latest_trade",
            "latest_trade_record",
            "latest_alert",
            "latest_alert_record",
        )
        self.assertIn("ETHUSDT 卖 0.250@999999", str(activity["latest_ops"].get("latest_order") or ""))
        self.assertIn("New", str(activity["latest_ops"].get("latest_order") or ""))
        self.assertIn("ETHUSDT 卖 0.250@999999", str(activity["latest_ops"].get("latest_active_order") or ""))
        self.assertIn("New", str(activity["latest_ops"].get("latest_active_order") or ""))
        self.assertIn("ETHUSDT 买 0.500@3568", str(activity["latest_ops"].get("latest_historical_order") or ""))
        self.assertIn("filled", str(activity["latest_ops"].get("latest_historical_order") or ""))
        self.assertEqual(activity["latest_ops"]["latest_active_order_record"]["order_id"], "order-review-context-active-001")
        self.assertEqual(activity["latest_ops"]["latest_historical_order_record"]["order_id"], "order-review-context-001")
        self.assertEqual(activity["latest_ops"]["latest_order_record"]["order_id"], "order-review-context-active-001")
        self.assertIn("ETHUSDT 卖 0.25@3576.0", str(activity["latest_ops"].get("latest_trade") or ""))
        self.assertIn("filled", str(activity["latest_ops"].get("latest_trade") or ""))
        self.assertIn("latest_ops", activity)
        self.assertEqual(activity["latest_ops"]["latest_trade_record"]["id"], "trade-review-context-002")
        self.assertIn("latest_runtime", activity)
        self.assertEqual(activity["latest_runtime"]["latest_ops"]["latest_trade_record"]["id"], "trade-review-context-002")
        self.assertEqual(activity["latest_ops"]["latest_trade_record"]["id"], "trade-review-context-002")
        self.assertEqual(activity["recent_trades"][0]["id"], "trade-review-context-002")
        self.assertIn("P0 ETH 二次执行阻断", str(activity["latest_ops"].get("latest_alert") or ""))
        self.assertIn("P1 ETH 待处理执行提醒", str(activity["latest_ops"].get("latest_pending_alert") or ""))
        self.assertEqual(activity["latest_ops"]["latest_pending_alert_record"]["id"], "alert-review-context-003")
        self.assertEqual(activity["latest_ops"]["latest_alert_record"]["id"], "alert-review-context-002")
        self.assertEqual(activity["recent_alerts"][0]["id"], "alert-review-context-002")

    def test_build_backtest_payload_prefers_strategy_market_resolution_when_watchlist_missing(self) -> None:
        original_market_data = control_main.market_data
        backtest_market_data = RecordingBacktestMarketClient()
        control_main.market_data = backtest_market_data
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        control_main.repo.state.watchlist = [
            item for item in control_main.repo.state.watchlist if item.symbol != "SOLUSDT"
        ]
        control_main.repo.state.strategy_runtime_snapshots = [
            snapshot
            for snapshot in control_main.repo.state.strategy_runtime_snapshots
            if snapshot.strategy_id != "sol-breakout-03"
        ]

        strategy = next(
            item for item in control_main.repo.state.strategies if item.id == "sol-breakout-03"
        )
        payload = control_main.build_backtest_payload(
            strategy,
            data_range="2025-12-01 ~ 2026-03-29",
            timeframe="1h",
        )

        self.assertIsNotNone(payload)
        self.assertEqual(backtest_market_data.requested_markets[-1], "spot")
        self.assertEqual(payload["symbol_scope"], ["SOLUSDT"])

    def test_build_backtest_payload_exposes_stat_dataclasses_on_response(self) -> None:
        original_market_data = control_main.market_data
        control_main.market_data = RecordingBacktestMarketClient()
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        strategy = next(
            item for item in control_main.repo.state.strategies if item.id == "trend-btc-01"
        )
        payload = control_main.build_backtest_payload(
            strategy,
            data_range="2025-12-01 ~ 2026-03-29",
            timeframe="1h",
        )

        self.assertIsNotNone(payload)
        for stat_key in (
            "volatility_stats",
            "risk_ratios",
            "trade_rhythm_stats",
            "benchmark_stats",
            "exposure_stats",
            "tail_risk_stats",
            "order_flow_stats",
        ):
            self.assertIn(stat_key, payload, f"{stat_key} missing from backtest payload")
            self.assertIsInstance(payload[stat_key], dict, f"{stat_key} should be a dict")

        self.assertIn("annualized_volatility_pct", payload["volatility_stats"])
        self.assertIn("sortino_ratio", payload["risk_ratios"])
        self.assertIn("longest_winning_streak_bars", payload["trade_rhythm_stats"])
        self.assertIn("correlation", payload["benchmark_stats"])
        self.assertIn("return_skew", payload["exposure_stats"])
        self.assertIn("var_95_pct", payload["tail_risk_stats"])
        self.assertIn("avg_holding_bars", payload["order_flow_stats"])

    def test_change_request_backtest_and_agent_job_endpoints(self) -> None:
        scheduler_status, scheduler_before = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        initial_queue_depth = int(scheduler_before["scheduler"]["queue_depth"])

        change_status, change_request = self._post(
            "/api/change-requests",
            {
                "type": "strategy.parameter.update",
                "payload": {"strategy_id": "trend-btc-01", "fast_ma": 13},
                "requested_by": "unit_test",
                "target_mode": "paper",
                "priority": "high",
                "summary": "单元测试提交参数更新",
            },
        )
        self.assertEqual(change_status, 200)
        self.assertEqual(change_request["status"], "applied")
        self.assertEqual(change_request["requested_by"], "unit_test")
        self.assertEqual(change_request["trigger_reason"], "manual_create")

        scheduler_after_change_status, scheduler_after_change = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_after_change_status, 200)
        review_job = next(
            (item for item in scheduler_after_change["jobs"] if item["idempotency_key"] == f"strategy-change-review-{change_request['id']}"),
            None,
        )
        self.assertIsNotNone(review_job)
        self.assertEqual(review_job["job_type"], "review_strategy_change")
        self.assertEqual(review_job["writeback_target"], "strategy_activity")
        self.assertEqual(review_job["context"]["strategy_id"], "trend-btc-01")
        self.assertIsNone(review_job["context"]["source_review_id"])
        self.assertIsNone(review_job["context"]["source_proposal_id"])
        self.assertEqual(review_job["context"]["trigger_reason"], "manual_create")

        strategies_status, strategies = self._get("/api/strategies")
        self.assertEqual(strategies_status, 200)
        trend_strategy = next((item for item in strategies if item["id"] == "trend-btc-01"), None)
        self.assertIsNotNone(trend_strategy)
        fast_ma = next((item for item in trend_strategy["parameters"] if item["key"] == "fast_ma"), None)
        self.assertIsNotNone(fast_ma)
        self.assertEqual(fast_ma["value"], 13)

        backtest_status, backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "2025-12-01 ~ 2026-03-29",
                "timeframe": "1h",
            },
        )
        self.assertEqual(backtest_status, 200)
        self.assertEqual(backtest["strategy_id"], "trend-btc-01")
        self.assertEqual(backtest["status"], "completed")
        self.assertIsNone(backtest["source_backtest_id"])
        self.assertIsNone(backtest["source_review_id"])
        self.assertIsNone(backtest["source_proposal_id"])
        self.assertEqual(backtest["trigger_reason"], "manual_create")
        self.assertIn("本地回测引擎", backtest["notes"])
        self.assertGreaterEqual(backtest["metrics"]["trades"], 0)
        if backtest["metrics"]["trades"] == 0:
            self.assertTrue(backtest["reference_only"])
            self.assertEqual(backtest["sample_quality"], "reference_only")
            self.assertIn("未命中真实入场信号", backtest["notes"])
        elif backtest["metrics"]["trades"] < 5:
            self.assertFalse(backtest["reference_only"])
            self.assertEqual(backtest["sample_quality"], "low_sample")
        else:
            self.assertFalse(backtest["reference_only"])
            self.assertEqual(backtest["sample_quality"], "sufficient")

        scheduler_after_backtest_status, scheduler_after_backtest = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_after_backtest_status, 200)
        review_job = next(
            (item for item in scheduler_after_backtest["jobs"] if item.get("idempotency_key") == f"backtest-review-{backtest['id']}"),
            None,
        )
        self.assertIsNotNone(review_job)
        self.assertEqual(review_job["job_type"], "generate_backtest_review")
        self.assertEqual(review_job["context"]["reference_only"], backtest["reference_only"])
        self.assertEqual(review_job["context"]["sample_quality"], backtest["sample_quality"])
        self.assertIsNone(review_job["context"]["source_backtest_id"])
        self.assertIsNone(review_job["context"]["source_review_id"])
        self.assertIsNone(review_job["context"]["source_proposal_id"])
        self.assertEqual(review_job["context"]["trigger_reason"], "manual_create")
        self.assertIn("execution_health", review_job["context"])
        self.assertIn("execution_top_issue", review_job["context"])

        alert_rule_change_status, alert_rule_change = self._post(
            "/api/change-requests",
            {
                "type": "alert.rule.update",
                "payload": {"symbol": "BTCUSDT", "threshold_pct": 4.8, "alert_enabled": True},
                "requested_by": "unit_test",
                "target_mode": "paper",
                "priority": "normal",
                "summary": "单元测试更新提醒阈值",
            },
        )
        self.assertEqual(alert_rule_change_status, 200)

        scheduler_after_alert_status, scheduler_after_alert = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_after_alert_status, 200)
        reconcile_job = next(
            (item for item in scheduler_after_alert["jobs"] if item["idempotency_key"] == f"change-request-reconcile-{alert_rule_change['id']}"),
            None,
        )
        self.assertIsNotNone(reconcile_job)
        self.assertEqual(reconcile_job["job_type"], "reconcile_change_request")

        missing_status, missing_backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "missing-strategy",
                "data_range": "2025-12-01 ~ 2026-03-29",
                "timeframe": "1h",
            },
        )
        self.assertEqual(missing_status, 404)
        self.assertIn("策略不存在", missing_backtest["detail"])

        job_status, job = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_daily_review",
                "context": {"focus_symbols": ["BTCUSDT"]},
                "allowed_actions": ["review", "change_request"],
                "timeout": 180,
                "idempotency_key": "unit-test-job",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(job_status, 200)
        self.assertEqual(job["status"], "queued")
        self.assertIn("execution_health", job["context"])
        self.assertIn("runtime_worker_top_issue", job["context"])

        duplicate_status, duplicate_job = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_daily_review",
                "context": {"focus_symbols": ["BTCUSDT"]},
                "allowed_actions": ["review", "change_request"],
                "timeout": 180,
                "idempotency_key": "unit-test-job",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(duplicate_status, 200)
        self.assertEqual(duplicate_job["id"], job["id"])

        scheduler_after_status, scheduler_after = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_after_status, 200)
        self.assertGreaterEqual(scheduler_after["scheduler"]["queue_depth"], initial_queue_depth)
        self.assertTrue(any(item["id"] == job["id"] for item in scheduler_after["jobs"]))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        queued_events = [item for item in audit_events if item["event_type"] == "openclaw.job.queued" and item["payload"].get("job_id") == job["id"]]
        self.assertEqual(len(queued_events), 1)

    def test_scheduler_cancel_job_marks_job_cancelled_and_clears_current_slot(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        created = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="generate_daily_review",
                context={"focus_symbols": ["BTCUSDT"], "mode": "paper"},
                allowed_actions=["review"],
                timeout=60,
                idempotency_key="unit-test-cancel-job",
                writeback_target="ai_review",
            )
        )
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        self.assertEqual(claimed.id, created.id)

        status, payload = self._post(
            "/api/ai/scheduler/commands",
            {
                "command": "cancel_job",
                "job_id": created.id,
                "requested_by": "unit_test",
                "reason": "人工终止当前任务",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["command"], "cancel_job")
        self.assertEqual(payload["summary"], "已终止任务：generate_daily_review")
        self.assertEqual(payload["job_id"], created.id)
        self.assertEqual(payload["cancelled_job_ids"], [created.id])
        self.assertEqual(payload["cancelled_job_count"], 1)

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        cancelled_job = next((item for item in scheduler["jobs"] if item["id"] == created.id), None)
        self.assertIsNotNone(cancelled_job)
        self.assertEqual(cancelled_job["status"], "cancelled")
        self.assertEqual(cancelled_job["result_summary"], "人工终止当前任务")
        self.assertIsNone(scheduler["scheduler"]["current_job_id"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "scheduler.command")
        self.assertEqual(audit_events[0]["payload"]["summary"], "已终止任务：generate_daily_review")
        self.assertTrue(any(item["event_type"] == "openclaw.job.cancelled" for item in audit_events))
        cancelled_event = next((item for item in audit_events if item["event_type"] == "openclaw.job.cancelled"), None)
        self.assertIsNotNone(cancelled_event)
        cancelled_payload = cancelled_event["payload"]
        self.assertEqual(cancelled_payload["summary"], "人工终止当前任务")
        self.assertEqual(cancelled_payload["reason"], "人工终止当前任务")

    def test_scheduler_cancel_job_command_event_carries_backtest_review_lineage(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-006",
                    "source_change_request_id": "cr-parent-006",
                    "source_backtest_id": "bt-parent-006",
                    "source_review_id": "review-parent-006",
                    "source_proposal_id": "prop-parent-006",
                    "trigger_reason": "proposal_accept",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 180 天",
                    "decision_recommended_timeframe": "4h",
                    "decision_readiness_action": "保持最近 180 天，改成 4h 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-scheduler-command-cancel-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)

        status, payload = self._post(
            "/api/ai/scheduler/commands",
            {
                "command": "cancel_job",
                "job_id": created["id"],
                "requested_by": "unit_test",
                "reason": "人工终止回测复盘任务",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["command"], "cancel_job")
        self.assertEqual(payload["summary"], "已终止任务：generate_backtest_review")
        self.assertEqual(payload["job_id"], created["id"])
        self.assertEqual(payload["backtest_id"], "bt-unit-006")
        self.assertEqual(payload["source_change_request_id"], "cr-parent-006")
        self.assertEqual(payload["source_backtest_id"], "bt-parent-006")
        self.assertEqual(payload["source_review_id"], "review-parent-006")
        self.assertEqual(payload["source_proposal_id"], "prop-parent-006")
        self.assertEqual(payload["trigger_reason"], "proposal_accept")
        self.assertEqual(payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(payload["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(payload["decision_recommended_timeframe"], "4h")
        self.assertEqual(payload["decision_readiness_action"], "保持最近 180 天，改成 4h 后重跑。")
        self.assertEqual(payload["cancelled_job_ids"], [created["id"]])
        self.assertEqual(payload["cancelled_job_count"], 1)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        command_event = next((item for item in audit_events if item["event_type"] == "scheduler.command"), None)
        self.assertIsNotNone(command_event)
        command_payload = command_event["payload"]
        self.assertEqual(command_payload["summary"], "已终止任务：generate_backtest_review")
        self.assertEqual(command_payload["job_id"], created["id"])
        self.assertEqual(command_payload["backtest_id"], "bt-unit-006")
        self.assertEqual(command_payload["source_change_request_id"], "cr-parent-006")
        self.assertEqual(command_payload["source_backtest_id"], "bt-parent-006")
        self.assertEqual(command_payload["source_review_id"], "review-parent-006")
        self.assertEqual(command_payload["source_proposal_id"], "prop-parent-006")
        self.assertEqual(command_payload["trigger_reason"], "proposal_accept")
        self.assertEqual(command_payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(command_payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(command_payload["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(command_payload["decision_recommended_timeframe"], "4h")
        self.assertEqual(command_payload["decision_readiness_action"], "保持最近 180 天，改成 4h 后重跑。")
        self.assertEqual(command_payload["cancelled_job_ids"], [created["id"]])
        self.assertEqual(command_payload["cancelled_job_count"], 1)

    def test_enter_manual_override_command_event_carries_current_job_lineage(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-007",
                    "source_change_request_id": "cr-parent-007",
                    "source_backtest_id": "bt-parent-007",
                    "source_review_id": "review-parent-007",
                    "source_proposal_id": "prop-parent-007",
                    "trigger_reason": "decision_rerun",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 90 天",
                    "decision_recommended_timeframe": "1d",
                    "decision_readiness_action": "保持最近 90 天，改成 1d 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-scheduler-command-manual-override-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)

        status, payload = self._post(
            "/api/ai/scheduler/commands",
            {
                "command": "enter_manual_override",
                "requested_by": "unit_test",
                "reason": "切人工接管排障",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["command"], "enter_manual_override")
        self.assertEqual(payload["summary"], "已进入人工接管，并终止当前任务：generate_backtest_review")
        self.assertEqual(payload["job_id"], created["id"])
        self.assertEqual(payload["backtest_id"], "bt-unit-007")
        self.assertEqual(payload["source_change_request_id"], "cr-parent-007")
        self.assertEqual(payload["source_backtest_id"], "bt-parent-007")
        self.assertEqual(payload["source_review_id"], "review-parent-007")
        self.assertEqual(payload["source_proposal_id"], "prop-parent-007")
        self.assertEqual(payload["trigger_reason"], "decision_rerun")
        self.assertEqual(payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(payload["decision_recommended_data_range"], "最近 90 天")
        self.assertEqual(payload["decision_recommended_timeframe"], "1d")
        self.assertEqual(payload["decision_readiness_action"], "保持最近 90 天，改成 1d 后重跑。")
        self.assertEqual(payload["cancelled_job_ids"], [created["id"]])
        self.assertEqual(payload["cancelled_job_count"], 1)
        self.assertEqual(payload["scheduler_status"], "manual_override")
        self.assertTrue(payload["freeze_publish"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        command_event = next((item for item in audit_events if item["event_type"] == "scheduler.command"), None)
        self.assertIsNotNone(command_event)
        command_payload = command_event["payload"]
        self.assertEqual(command_payload["summary"], "已进入人工接管，并终止当前任务：generate_backtest_review")
        self.assertEqual(command_payload["job_id"], created["id"])
        self.assertEqual(command_payload["backtest_id"], "bt-unit-007")
        self.assertEqual(command_payload["source_change_request_id"], "cr-parent-007")
        self.assertEqual(command_payload["source_backtest_id"], "bt-parent-007")
        self.assertEqual(command_payload["source_review_id"], "review-parent-007")
        self.assertEqual(command_payload["source_proposal_id"], "prop-parent-007")
        self.assertEqual(command_payload["trigger_reason"], "decision_rerun")
        self.assertEqual(command_payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(command_payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(command_payload["decision_recommended_data_range"], "最近 90 天")
        self.assertEqual(command_payload["decision_recommended_timeframe"], "1d")
        self.assertEqual(command_payload["decision_readiness_action"], "保持最近 90 天，改成 1d 后重跑。")
        self.assertEqual(command_payload["cancelled_job_ids"], [created["id"]])
        self.assertEqual(command_payload["cancelled_job_count"], 1)
        self.assertEqual(command_payload["scheduler_status"], "manual_override")
        self.assertTrue(command_payload["freeze_publish"])

    def test_scheduler_cancel_all_command_event_summarizes_affected_jobs_and_lineage(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        control_main.repo.state.agent_jobs = []
        control_main.repo._recompute_scheduler_queue_depth()

        review_job_status, review_job = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-008",
                    "source_change_request_id": "cr-parent-008",
                    "source_backtest_id": "bt-parent-008",
                    "source_review_id": "review-parent-008",
                    "source_proposal_id": "prop-parent-008",
                    "trigger_reason": "proposal_accept",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 180 天",
                    "decision_recommended_timeframe": "4h",
                    "decision_readiness_action": "保持最近 180 天，改成 4h 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-scheduler-command-cancel-all-review",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(review_job_status, 200)
        daily_job_status, daily_job = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_daily_review",
                "context": {"focus_symbols": ["BTCUSDT"], "mode": "paper"},
                "allowed_actions": ["review"],
                "timeout": 60,
                "idempotency_key": "unit-test-scheduler-command-cancel-all-daily",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(daily_job_status, 200)
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)

        status, payload = self._post(
            "/api/ai/scheduler/commands",
            {
                "command": "cancel_all",
                "requested_by": "unit_test",
                "reason": "批量终止排障",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["command"], "cancel_all")
        self.assertEqual(
            payload["summary"],
            "已终止 2 个任务，其中 generate_daily_review 1 个、generate_backtest_review 1 个。",
        )
        self.assertEqual(payload["cancelled_job_count"], 2)
        self.assertEqual(set(payload["cancelled_job_ids"]), {review_job["id"], daily_job["id"]})
        self.assertEqual(
            set(payload["cancelled_job_types"]),
            {"generate_backtest_review", "generate_daily_review"},
        )
        self.assertEqual(payload["cancelled_backtest_ids"], ["bt-unit-008"])
        self.assertEqual(payload["cancelled_source_change_request_ids"], ["cr-parent-008"])
        self.assertEqual(payload["cancelled_source_backtest_ids"], ["bt-parent-008"])
        self.assertEqual(payload["cancelled_source_review_ids"], ["review-parent-008"])
        self.assertEqual(payload["cancelled_source_proposal_ids"], ["prop-parent-008"])
        self.assertEqual(payload["cancelled_trigger_reasons"], ["proposal_accept"])
        self.assertEqual(payload["cancelled_decision_readiness_values"], ["sample_incomplete"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        command_event = next((item for item in audit_events if item["event_type"] == "scheduler.command"), None)
        self.assertIsNotNone(command_event)
        command_payload = command_event["payload"]
        self.assertEqual(
            command_payload["summary"],
            "已终止 2 个任务，其中 generate_daily_review 1 个、generate_backtest_review 1 个。",
        )
        self.assertEqual(command_payload["cancelled_job_count"], 2)
        self.assertEqual(set(command_payload["cancelled_job_ids"]), {review_job["id"], daily_job["id"]})
        self.assertEqual(
            set(command_payload["cancelled_job_types"]),
            {"generate_backtest_review", "generate_daily_review"},
        )
        self.assertEqual(command_payload["cancelled_backtest_ids"], ["bt-unit-008"])
        self.assertEqual(command_payload["cancelled_source_change_request_ids"], ["cr-parent-008"])
        self.assertEqual(command_payload["cancelled_source_backtest_ids"], ["bt-parent-008"])
        self.assertEqual(command_payload["cancelled_source_review_ids"], ["review-parent-008"])
        self.assertEqual(command_payload["cancelled_source_proposal_ids"], ["prop-parent-008"])
        self.assertEqual(command_payload["cancelled_trigger_reasons"], ["proposal_accept"])
        self.assertEqual(command_payload["cancelled_decision_readiness_values"], ["sample_incomplete"])

    def test_backtest_review_job_cancelled_event_writes_lineage_and_decision_into_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None

        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-004",
                    "source_backtest_id": "bt-parent-004",
                    "source_review_id": "review-parent-004",
                    "source_proposal_id": "prop-parent-004",
                    "trigger_reason": "decision_rerun",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 180 天",
                    "decision_recommended_timeframe": "4h",
                    "decision_readiness_action": "保持最近 180 天，改成 4h 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-backtest-review-cancelled-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created["status"], "queued")

        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        assert claimed is not None

        status, payload = self._post(
            "/api/ai/scheduler/commands",
            {
                "command": "cancel_job",
                "job_id": created["id"],
                "requested_by": "unit_test",
                "reason": "人工终止回测复盘任务",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(payload["command"], "cancel_job")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        cancelled_event = next((item for item in audit_events if item["event_type"] == "openclaw.job.cancelled"), None)
        self.assertIsNotNone(cancelled_event)
        cancelled_payload = cancelled_event["payload"]
        self.assertEqual(cancelled_payload["summary"], "人工终止回测复盘任务")
        self.assertEqual(cancelled_payload["reason"], "人工终止回测复盘任务")
        self.assertEqual(cancelled_payload["backtest_id"], "bt-unit-004")
        self.assertEqual(cancelled_payload["source_backtest_id"], "bt-parent-004")
        self.assertEqual(cancelled_payload["source_review_id"], "review-parent-004")
        self.assertEqual(cancelled_payload["source_proposal_id"], "prop-parent-004")
        self.assertEqual(cancelled_payload["trigger_reason"], "decision_rerun")
        self.assertEqual(cancelled_payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(cancelled_payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(cancelled_payload["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(cancelled_payload["decision_recommended_timeframe"], "4h")
        self.assertEqual(cancelled_payload["decision_readiness_action"], "保持最近 180 天，改成 4h 后重跑。")

    def test_retry_cancelled_job_creates_new_retry_job(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        created = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="generate_daily_review",
                context={"focus_symbols": ["BTCUSDT"], "mode": "paper"},
                allowed_actions=["review"],
                timeout=60,
                idempotency_key="unit-test-retry-job",
                writeback_target="ai_review",
            )
        )
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        self.assertEqual(claimed.id, created.id)
        control_main.repo.apply_scheduler_command(
            control_main.SchedulerCommand(
                command="cancel_job",
                job_id=created.id,
                requested_by="unit_test",
                reason="准备验证重试",
            )
        )

        retry_status, retried = self._post(
            f"/api/ai/jobs/{created.id}/retry",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(retry_status, 200)
        self.assertNotEqual(retried["id"], created.id)
        self.assertEqual(retried["status"], "queued")
        self.assertTrue(retried["idempotency_key"].startswith("unit-test-retry-job-retry-"))
        self.assertEqual(retried["retried_from_job_id"], created.id)
        self.assertEqual(retried["retry_count"], 1)
        self.assertEqual(retried["context"]["retried_from_job_id"], created.id)

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        self.assertTrue(any(item["id"] == retried["id"] for item in scheduler["jobs"]))

        bad_retry_status, bad_retry = self._post(
            f"/api/ai/jobs/{retried['id']}/retry",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(bad_retry_status, 409)
        self.assertIn("只有失败或已取消的任务可以重试", bad_retry["detail"])

    def test_strategy_activity_includes_retry_metadata_for_tracking_jobs(self) -> None:
        status, created = self._post(
            "/api/strategies/trend-btc-01/review",
            {
                "review_kind": "issue",
                "summary": "BTC 策略问题需要继续跟踪。",
                "detail": "先制造一条可重试的策略跟踪任务。",
                "requested_by": "unit_test",
                "request_key": "retry-activity-001",
            },
        )
        self.assertEqual(status, 200)

        control_main.repo.apply_scheduler_command(
            control_main.SchedulerCommand(
                command="cancel_job",
                job_id=created["id"],
                requested_by="unit_test",
                reason="准备验证策略活动里的重试元数据",
            )
        )

        retry_status, retried = self._post(
            f"/api/ai/jobs/{created['id']}/retry",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(retry_status, 200)

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        retried_job = next((item for item in activity["recent_agent_jobs"] if item["id"] == retried["id"]), None)
        self.assertIsNotNone(retried_job)
        self.assertEqual(retried_job["strategy_id"], "trend-btc-01")
        self.assertEqual(retried_job["retry_count"], 1)
        self.assertEqual(retried_job["retried_from_job_id"], created["id"])

    def test_backtest_review_job_retry_requested_event_writes_lineage_and_decision_into_audit_event(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None

        create_status, created = self._post(
            "/api/ai/jobs",
            {
                "job_type": "generate_backtest_review",
                "context": {
                    "strategy_id": "trend-btc-01",
                    "backtest_id": "bt-unit-005",
                    "source_backtest_id": "bt-parent-005",
                    "source_review_id": "review-parent-005",
                    "source_proposal_id": "prop-parent-005",
                    "trigger_reason": "proposal_accept",
                    "decision_readiness": "sample_incomplete",
                    "decision_readiness_detail": "当前样本窗口仍未完整覆盖。",
                    "decision_recommended_data_range": "最近 180 天",
                    "decision_recommended_timeframe": "4h",
                    "decision_readiness_action": "保持最近 180 天，改成 4h 后重跑。",
                },
                "allowed_actions": ["review_backtest", "propose_next_step"],
                "timeout": 60,
                "idempotency_key": "unit-test-backtest-review-retry-audit",
                "writeback_target": "ai_review",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created["status"], "queued")

        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        assert claimed is not None
        control_main.repo.apply_scheduler_command(
            control_main.SchedulerCommand(
                command="cancel_job",
                job_id=claimed.id,
                requested_by="unit_test",
                reason="准备验证重试事件",
            )
        )

        retry_status, retried = self._post(
            f"/api/ai/jobs/{created['id']}/retry",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(retry_status, 200)

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        retry_event = next((item for item in audit_events if item["event_type"] == "openclaw.job.retry_requested"), None)
        self.assertIsNotNone(retry_event)
        retry_payload = retry_event["payload"]
        self.assertEqual(retry_payload["summary"], "已请求重试任务：generate_backtest_review")
        self.assertEqual(retry_payload["previous_job_id"], created["id"])
        self.assertEqual(retry_payload["retry_job_id"], retried["id"])
        self.assertEqual(retry_payload["retried_from_job_id"], created["id"])
        self.assertEqual(retry_payload["retry_count"], 1)
        self.assertEqual(retry_payload["job_id"], retried["id"])
        self.assertEqual(retry_payload["backtest_id"], "bt-unit-005")
        self.assertEqual(retry_payload["source_backtest_id"], "bt-parent-005")
        self.assertEqual(retry_payload["source_review_id"], "review-parent-005")
        self.assertEqual(retry_payload["source_proposal_id"], "prop-parent-005")
        self.assertEqual(retry_payload["trigger_reason"], "proposal_accept")
        self.assertEqual(retry_payload["decision_readiness"], "sample_incomplete")
        self.assertEqual(retry_payload["decision_readiness_detail"], "当前样本窗口仍未完整覆盖。")
        self.assertEqual(retry_payload["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(retry_payload["decision_recommended_timeframe"], "4h")
        self.assertEqual(retry_payload["decision_readiness_action"], "保持最近 180 天，改成 4h 后重跑。")

    def test_strategy_activity_job_carries_linked_review_metadata_after_completion(self) -> None:
        created = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="review_strategy_issue",
                context={
                    "strategy_id": "trend-btc-01",
                    "strategy_name": "BTC 趋势跟随",
                    "symbol": "BTCUSDT",
                    "mode": "live",
                    "issue_type": "manual_issue_review",
                    "summary": "BTC 策略问题需要继续跟踪。",
                    "requested_by": "unit_test",
                },
                allowed_actions=["review_strategy_issue"],
                timeout=60,
                idempotency_key="unit-test-linked-review-job",
                writeback_target="strategy_activity",
            )
        )
        control_main.repo.claim_next_agent_job()
        review = control_main.build_strategy_tracking_review_document(
            '{"summary":"问题已跟踪","highlights":["已记录最近活动"],"risks":["仍需观察"],"proposals":[]}',
            created.context,
            "review_strategy_issue",
        )
        control_main.repo.complete_agent_job(
            created.id,
            result_summary="问题已跟踪",
            review=review,
            source="unit_test",
        )

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        completed_job = next((item for item in activity["recent_agent_jobs"] if item["id"] == created.id), None)
        self.assertIsNotNone(completed_job)
        self.assertEqual(completed_job["linked_review_id"], review.id)
        self.assertEqual(completed_job["linked_review_title"], review.title)
        self.assertEqual(completed_job["linked_review_period"], review.period)

        reviews_status, reviews = self._get("/api/ai/reviews?strategy_id=trend-btc-01&period=strategy_issue")
        self.assertEqual(reviews_status, 200)
        linked_review = next((item for item in reviews if item["id"] == review.id), None)
        self.assertIsNotNone(linked_review)
        self.assertEqual(linked_review["source_job_id"], created.id)
        self.assertEqual(linked_review["source_job_type"], "review_strategy_issue")
        self.assertEqual(linked_review["source_job_status"], "completed")

    def test_strategy_activity_review_summary_carries_backtest_lineage_metadata(self) -> None:
        backtest = control_main.BacktestRun(
            id="bt-child-001",
            strategy_id="trend-btc-01",
            strategy_name="BTC 趋势跟随",
            source_change_request_id="cr-parent-001",
            source_backtest_id="bt-parent-001",
            source_review_id="review-parent-001",
            source_proposal_id="prop-parent-001",
            trigger_reason="proposal_accept",
            status="completed",
            started_at=datetime.now(timezone.utc).astimezone().isoformat(),
            finished_at=datetime.now(timezone.utc).astimezone().isoformat(),
            symbol_scope=["BTCUSDT"],
            timeframe="4h",
            data_range="最近 180 天",
            data_granularity="kline",
            fee_model="paper-fee",
            slippage_model="fixed-0.10%",
            parameter_snapshot={"fast_ma": 21},
            metrics=BacktestMetrics(
                annual_return="+12.4%",
                max_drawdown="-3.2%",
                sharpe="1.18",
                win_rate="56.0%",
                pnl="+12,300 USDT",
                trades=42,
            ),
            decision_readiness="sample_incomplete",
            decision_readiness_detail="样本窗口仍可继续拉长。",
            decision_recommended_data_range="最近 240 天",
            decision_recommended_timeframe="4h",
            decision_readiness_action="建议补齐更长样本后再判断。",
            notes="补齐活动摘要链路测试。",
        )
        control_main.repo.state.backtests.insert(0, backtest)
        review = control_main.ReviewDocument(
            id="review-unit-backtest-lineage",
            period="backtest",
            strategy_id="trend-btc-01",
            backtest_id="bt-child-001",
            source_job_id="job-backtest-review-001",
            source_job_type="generate_backtest_review",
            source_job_status="completed",
            source_change_request_id="cr-parent-001",
            source_backtest_id="bt-parent-001",
            source_review_id="review-parent-001",
            source_proposal_id="prop-parent-001",
            trigger_reason="proposal_accept",
            title="BTC 回测复盘",
            summary="本轮回测来自接受提案后的补样本重跑。",
            decision_recommended_data_range="最近 240 天",
            decision_recommended_timeframe="4h",
            decision_readiness_action="建议继续补样本后重跑。",
            highlights=["已完成补样本。"],
            risks=["仍需继续观察。"],
            proposals=[],
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        control_main.repo.state.reviews.insert(0, review)

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        linked_review = next((item for item in activity["recent_reviews"] if item["id"] == review.id), None)
        self.assertIsNotNone(linked_review)
        assert linked_review is not None
        self.assertEqual(linked_review["backtest_id"], "bt-child-001")
        self.assertEqual(linked_review["source_job_id"], "job-backtest-review-001")
        self.assertEqual(linked_review["source_job_type"], "generate_backtest_review")
        self.assertEqual(linked_review["source_job_status"], "completed")
        self.assertEqual(linked_review["source_change_request_id"], "cr-parent-001")
        self.assertEqual(linked_review["source_backtest_id"], "bt-parent-001")
        self.assertEqual(linked_review["source_review_id"], "review-parent-001")
        self.assertEqual(linked_review["source_proposal_id"], "prop-parent-001")
        self.assertEqual(linked_review["trigger_reason"], "proposal_accept")
        self.assertEqual(activity["latest_backtest"]["id"], "bt-child-001")
        self.assertEqual(activity["latest_actionable_backtest"]["id"], "bt-child-001")
        self.assertEqual(activity["latest_actionable_backtest_review"]["id"], review.id)
        self.assertEqual(activity["latest_actionable_backtest_review"]["backtest_id"], "bt-child-001")
        self.assertNotIn("latest_actionable_backtest_job", activity)
        self.assertEqual(activity["latest_primary_review"]["id"], review.id)
        self.assertEqual(activity["latest_actionable_primary_review"]["id"], review.id)
        self.assertEqual(activity["latest_primary_review"]["source_change_request_id"], "cr-parent-001")
        self.assertEqual(activity["latest_primary_review"]["source_backtest_id"], "bt-parent-001")
        activity_context = control_main._build_strategy_activity_review_context("trend-btc-01")
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        self.assertIn("bt-child-001", str(activity_context["latest_actionable_backtest"] or ""))
        self.assertIn(review.id, str(activity_context["latest_actionable_backtest_review"] or ""))
        self.assertIsNone(activity_context["latest_actionable_backtest_job"])
        self.assertIn(review.id, str(activity_context["latest_actionable_primary_review"] or ""))

    def test_strategy_pause_and_risk_update_requests_apply_immediately(self) -> None:
        pause_status, pause_request = self._post(
            "/api/change-requests",
            {
                "type": "strategy.pause_resume",
                "payload": {"strategy_id": "trend-btc-01", "next_status": "paused"},
                "requested_by": "unit_test",
                "target_mode": "paper",
                "priority": "high",
                "summary": "暂停 BTC 策略",
            },
        )
        self.assertEqual(pause_status, 200)
        self.assertEqual(pause_request["status"], "applied")

        risk_status, risk_request = self._post(
            "/api/change-requests",
            {
                "type": "strategy.risk_update",
                "payload": {"strategy_id": "trend-btc-01", "risk_budget": "12%"},
                "requested_by": "unit_test",
                "target_mode": "paper",
                "priority": "high",
                "summary": "调整 BTC 风险预算",
            },
        )
        self.assertEqual(risk_status, 200)
        self.assertEqual(risk_request["status"], "applied")

        strategies_status, strategies = self._get("/api/strategies")
        self.assertEqual(strategies_status, 200)
        trend_strategy = next((item for item in strategies if item["id"] == "trend-btc-01"), None)
        self.assertIsNotNone(trend_strategy)
        self.assertEqual(trend_strategy["status"], "paused")
        self.assertEqual(trend_strategy["risk_budget"], "12%")

    def test_accepting_strategy_proposal_creates_follow_up_work(self) -> None:
        reviews_status, reviews = self._get("/api/ai/reviews")
        self.assertEqual(reviews_status, 200)
        proposal = next(
            (
                item
                for review in reviews
                for item in review["proposals"]
                if item["id"] == "prop-001"
            ),
            None,
        )
        self.assertIsNotNone(proposal)
        self.assertEqual(proposal["status"], "testing")

        action_status, result = self._post(
            "/api/ai/proposals/prop-001/action",
            {"action": "accept", "requested_by": "unit_test"},
        )
        self.assertEqual(action_status, 200)
        self.assertEqual(result["proposal"]["status"], "accepted")
        self.assertIsNotNone(result["created_change_request"])
        self.assertIsNone(result["created_backtest"])

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        self.assertEqual(change_requests[0]["type"], "proposal.param_update")
        self.assertEqual(change_requests[0]["payload"]["proposal_id"], "prop-001")
        self.assertEqual(change_requests[0]["source_review_id"], "review-20260330-daily")
        self.assertEqual(change_requests[0]["source_proposal_id"], "prop-001")
        self.assertEqual(change_requests[0]["trigger_reason"], "proposal_accept")
        self.assertEqual(change_requests[0]["follow_up_job_type"], "review_strategy_change")
        self.assertEqual(change_requests[0]["follow_up_job_status"], "queued")

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            (item for item in scheduler["jobs"] if item["idempotency_key"] == f"strategy-change-review-{change_requests[0]['id']}"),
            None,
        )
        self.assertIsNotNone(review_job)
        assert review_job is not None
        self.assertEqual(review_job["context"]["source_review_id"], "review-20260330-daily")
        self.assertEqual(review_job["context"]["source_proposal_id"], "prop-001")
        self.assertEqual(review_job["context"]["trigger_reason"], "proposal_accept")
        self.assertEqual(change_requests[0]["follow_up_job_id"], review_job["id"])
        self.assertEqual(review_job["context"]["review_strategy_activity"]["strategy_id"], proposal["strategy_id"])
        self.assertTrue(
            any(
                "prop-001" in item
                and "param_update" in item
                and "accepted" in item
                and change_requests[0]["id"] in item
                and "变更" in item
                and "review_strategy_change" in item
                and "queued" in item
                for item in review_job["context"]["review_strategy_activity"]["recent_proposals"]
            )
        )
        self.assertTrue(
            any(
                change_requests[0]["id"] in item
                and "proposal.param_update" in item
                and change_requests[0]["status"] in item
                for item in review_job["context"]["review_strategy_activity"]["recent_change_requests"]
            )
        )
        self.assertTrue(
            any(
                review_job["id"] in item
                and "review_strategy_change" in item
                and "queued" in item
                for item in review_job["context"]["review_strategy_activity"]["recent_agent_jobs"]
            )
        )
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_actionable_proposal"])
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_actionable_backtest"])
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_actionable_backtest_review"])
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_actionable_backtest_job"])
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_actionable_primary_review"])
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_actionable_change_request"])
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_retryable_tracking_job"])
        self.assertIn(
            review_job["id"],
            str(review_job["context"]["review_strategy_activity"]["latest_tracking_job"] or ""),
        )
        self.assertIn("recent_reviews", review_job["context"]["review_strategy_activity"])

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(snapshot["strategy_metrics"][2]["value"], "2")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        accepted_event = next((item for item in audit_events if item["event_type"] == "strategy_proposal.accepted"), None)
        self.assertIsNotNone(accepted_event)

    def test_accepting_processed_proposal_is_rejected(self) -> None:
        first_status, _first_result = self._post(
            "/api/ai/proposals/prop-001/action",
            {"action": "accept", "requested_by": "unit_test"},
        )
        self.assertEqual(first_status, 200)

        second_status, second_result = self._post(
            "/api/ai/proposals/prop-001/action",
            {"action": "accept", "requested_by": "unit_test"},
        )
        self.assertEqual(second_status, 409)
        self.assertIn("不能重复处理", second_result["detail"])

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        proposal_requests = [item for item in change_requests if item["payload"].get("proposal_id") == "prop-001"]
        self.assertEqual(len(proposal_requests), 1)

    def test_accepting_backtest_request_proposal_creates_backtest(self) -> None:
        action_status, result = self._post(
            "/api/ai/proposals/prop-003/action",
            {"action": "accept", "requested_by": "unit_test"},
        )
        self.assertEqual(action_status, 200)
        self.assertEqual(result["proposal"]["status"], "accepted")
        self.assertIsNone(result["created_change_request"])
        self.assertIsNotNone(result["created_backtest"])
        self.assertEqual(result["created_backtest"]["strategy_id"], "sol-breakout-03")
        self.assertIsNone(result["created_backtest"]["source_backtest_id"])
        self.assertEqual(result["created_backtest"]["source_review_id"], "review-20260330-daily")
        self.assertEqual(result["created_backtest"]["source_proposal_id"], "prop-003")
        self.assertEqual(result["created_backtest"]["trigger_reason"], "proposal_accept")

        backtests_status, backtests = self._get("/api/backtests")
        self.assertEqual(backtests_status, 200)
        self.assertEqual(backtests[0]["id"], result["created_backtest"]["id"])
        self.assertEqual(backtests[0]["timeframe"], "15m")
        self.assertEqual(backtests[0]["source_review_id"], "review-20260330-daily")
        self.assertEqual(backtests[0]["source_proposal_id"], "prop-003")
        self.assertEqual(backtests[0]["trigger_reason"], "proposal_accept")

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{result['created_backtest']['id']}"
        )
        self.assertEqual(review_job["context"]["source_review_id"], "review-20260330-daily")
        self.assertEqual(review_job["context"]["source_proposal_id"], "prop-003")
        self.assertEqual(review_job["context"]["trigger_reason"], "proposal_accept")
        activity_context = review_job["context"]["review_strategy_activity"]
        self.assertIn("prop-003", str(activity_context["latest_proposal"] or ""))
        self.assertIn(result["created_backtest"]["id"], str(activity_context["latest_proposal_backtest"] or ""))
        self.assertIsNone(activity_context["latest_proposal_change_request"])
        self.assertIsNone(activity_context["latest_proposal_review"])
        self.assertIn(review_job["id"], str(activity_context["latest_proposal_job"] or ""))
        proposal_context = activity_context["decision_context"]["proposal"]
        backtest_context = activity_context["decision_context"]["backtest"]
        self.assertEqual(proposal_context["latest_backtest_record"]["id"], result["created_backtest"]["id"])
        self.assertIsNone(proposal_context.get("latest_review_record"))
        self.assertEqual(proposal_context["latest_job_record"]["id"], review_job["id"])
        self.assertEqual(backtest_context["latest_record"]["id"], result["created_backtest"]["id"])
        self.assertEqual(
            backtest_context["actionable_record"]["id"],
            result["created_backtest"]["id"],
        )
        self.assertIn(result["created_backtest"]["id"], str(activity_context["latest_backtest"] or ""))
        self.assertIn(review_job["id"], str(activity_context["latest_backtest_job"] or ""))
        self.assertIsNone(activity_context["latest_backtest_review"])
        self.assertEqual(backtest_context["latest_job_record"]["id"], review_job["id"])
        self.assertEqual(backtest_context["actionable_job_record"]["id"], review_job["id"])
        self.assertIsNone(backtest_context.get("latest_review_record"))
        self.assertIsNone(backtest_context.get("actionable_review_record"))

        activity_status, activity = self._get("/api/strategies/sol-breakout-03/activity")
        self.assertEqual(activity_status, 200)
        proposal_context = activity["decision_context"]["proposal"]
        backtest_context = activity["decision_context"]["backtest"]
        self.assertEqual(proposal_context["latest_backtest_record"]["id"], result["created_backtest"]["id"])
        self.assertIsNone(proposal_context.get("latest_review_record"))
        self.assertEqual(proposal_context["latest_job_record"]["id"], review_job["id"])
        self.assertEqual(backtest_context["latest_record"]["id"], result["created_backtest"]["id"])
        self.assertEqual(backtest_context["actionable_record"]["id"], result["created_backtest"]["id"])
        self.assertEqual(backtest_context["latest_job_record"]["id"], review_job["id"])
        self.assertEqual(backtest_context["actionable_job_record"]["id"], review_job["id"])
        self.assertEqual(activity["latest_proposal"]["id"], "prop-003")
        self.assertEqual(activity["latest_proposal_backtest"]["id"], result["created_backtest"]["id"])
        self.assertEqual(activity["latest_proposal_job"]["id"], review_job["id"])
        self.assertEqual(activity["latest_proposal_backtest_record"]["id"], result["created_backtest"]["id"])
        self.assertNotIn("latest_proposal_review_record", activity)
        self.assertEqual(activity["latest_proposal_job_record"]["id"], review_job["id"])
        self.assertEqual(activity["latest_backtest_record"]["id"], result["created_backtest"]["id"])
        self.assertEqual(activity["latest_actionable_backtest_record"]["id"], result["created_backtest"]["id"])
        self.assertEqual(activity["latest_backtest_job_record"]["id"], review_job["id"])
        self.assertEqual(activity["latest_actionable_backtest_job_record"]["id"], review_job["id"])
        self._assert_missing_keys(
            activity,
            "latest_backtest_review_record",
            "latest_actionable_backtest_review_record",
            "latest_proposal_change_request",
            "latest_proposal_review",
            "latest_actionable_proposal_backtest_record",
            "latest_actionable_proposal_review_record",
            "latest_actionable_proposal_job_record",
        )

    def test_strategy_activity_ignores_retryable_backtest_jobs_from_other_strategies(self) -> None:
        control_main.repo.state.control_snapshot.scheduler.current_job_id = None
        created = control_main.repo.create_agent_job(
            control_main.AgentJobCreate(
                job_type="generate_backtest_review",
                context={
                    "strategy_id": "sol-breakout-03",
                    "backtest_id": "bt-001",
                },
                allowed_actions=["review_backtest"],
                timeout=60,
                idempotency_key="unit-test-cross-strategy-backtest-retryable-job",
                writeback_target="ai_review",
            )
        )
        failed = control_main.repo.fail_agent_job(created.id, "cross strategy failed job", source="local_fallback")
        self.assertEqual(failed.status.value, "failed")

        activity_context = control_main.repo._build_review_strategy_activity_context_locked("trend-btc-01")
        self.assertIsNotNone(activity_context)
        assert activity_context is not None
        self.assertIsNone(activity_context.get("latest_actionable_backtest"))
        self.assertIsNone(activity_context.get("latest_actionable_backtest_record"))
        self.assertIsNone(activity_context.get("latest_actionable_backtest_job"))

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self._assert_missing_keys(
            activity,
            "latest_actionable_backtest",
            "latest_actionable_backtest_record",
            "latest_actionable_backtest_job",
        )

    def test_backtest_launch_change_request_preserves_source_change_request_lineage(self) -> None:
        status, change_request = self._post(
            "/api/change-requests",
            {
                "type": "backtest.launch",
                "payload": {
                    "strategy_id": "trend-btc-01",
                    "data_range": "最近 90 天",
                    "timeframe": "1h",
                },
                "requested_by": "unit_test",
                "source_review_id": "review-parent-010",
                "source_proposal_id": "prop-parent-010",
                "trigger_reason": "proposal_accept",
                "target_mode": "paper",
                "priority": "high",
                "summary": "按提案补跑回测",
            },
        )

        self.assertEqual(status, 200)
        self.assertEqual(change_request["status"], "applied")
        self.assertEqual(change_request["source_review_id"], "review-parent-010")
        self.assertEqual(change_request["source_proposal_id"], "prop-parent-010")
        self.assertEqual(change_request["trigger_reason"], "proposal_accept")
        self.assertEqual(change_request["follow_up_job_type"], "generate_backtest_review")
        self.assertEqual(change_request["follow_up_job_status"], "queued")
        self.assertIsNotNone(change_request["linked_backtest_id"])
        self.assertEqual(change_request["linked_backtest_timeframe"], "1h")
        self.assertEqual(change_request["linked_backtest_data_range"], "最近 90 天")

        backtests_status, backtests = self._get("/api/backtests")
        self.assertEqual(backtests_status, 200)
        self.assertEqual(change_request["linked_backtest_id"], backtests[0]["id"])
        self.assertEqual(backtests[0]["source_change_request_id"], change_request["id"])
        self.assertEqual(backtests[0]["source_review_id"], "review-parent-010")
        self.assertEqual(backtests[0]["source_proposal_id"], "prop-parent-010")
        self.assertEqual(backtests[0]["trigger_reason"], "proposal_accept")

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        self.assertEqual(change_requests[0]["linked_backtest_id"], backtests[0]["id"])
        self.assertEqual(change_requests[0]["linked_backtest_timeframe"], "1h")
        self.assertEqual(change_requests[0]["linked_backtest_data_range"], "最近 90 天")
        self.assertEqual(change_requests[0]["linked_backtest_sample_quality"], backtests[0]["sample_quality"])
        self.assertEqual(change_requests[0]["linked_backtest_history_source"], backtests[0]["history_source"])
        self.assertEqual(change_requests[0]["linked_backtest_history_source_reason"], backtests[0]["history_source_reason"])
        self.assertEqual(change_requests[0]["linked_backtest_history_source_detail"], backtests[0]["history_source_detail"])
        self.assertEqual(
            change_requests[0]["linked_backtest_history_source_recommended_data_range"],
            backtests[0]["history_source_recommended_data_range"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_history_source_recommended_timeframe"],
            backtests[0]["history_source_recommended_timeframe"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_history_source_recommended_action"],
            backtests[0]["history_source_recommended_action"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_requested_candle_estimate"],
            backtests[0]["requested_candle_estimate"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_requested_candle_limit"],
            backtests[0]["requested_candle_limit"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_requested_range_start"],
            backtests[0]["requested_range_start"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_requested_range_end"],
            backtests[0]["requested_range_end"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_retrieved_window_completion_pct"],
            backtests[0]["retrieved_window_completion_pct"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_used_window_completion_pct"],
            backtests[0]["used_window_completion_pct"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_retrieved_candle_count"],
            backtests[0]["retrieved_candle_count"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_used_candle_count"],
            backtests[0]["used_candle_count"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_retrieved_range_start"],
            backtests[0]["retrieved_range_start"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_retrieved_range_end"],
            backtests[0]["retrieved_range_end"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_used_range_start"],
            backtests[0]["used_range_start"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_used_range_end"],
            backtests[0]["used_range_end"],
        )
        self.assertEqual(change_requests[0]["linked_backtest_history_truncated"], backtests[0]["history_truncated"])
        self.assertEqual(change_requests[0]["linked_backtest_history_gap_reason"], backtests[0]["history_gap_reason"])
        self.assertEqual(
            change_requests[0]["linked_backtest_full_window_recommended_data_range"],
            backtests[0]["full_window_recommended_data_range"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_full_window_recommended_timeframe"],
            backtests[0]["full_window_recommended_timeframe"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_full_window_recommended_action"],
            backtests[0]["full_window_recommended_action"],
        )
        self.assertEqual(change_requests[0]["linked_backtest_decision_readiness"], backtests[0]["decision_readiness"])
        self.assertEqual(
            change_requests[0]["linked_backtest_decision_readiness_detail"],
            backtests[0]["decision_readiness_detail"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_decision_recommended_data_range"],
            backtests[0]["decision_recommended_data_range"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_decision_recommended_timeframe"],
            backtests[0]["decision_recommended_timeframe"],
        )
        self.assertEqual(
            change_requests[0]["linked_backtest_decision_readiness_action"],
            backtests[0]["decision_readiness_action"],
        )

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{backtests[0]['id']}"
        )
        self.assertEqual(change_request["follow_up_job_id"], review_job["id"])
        self.assertEqual(review_job["context"]["source_change_request_id"], change_request["id"])
        self.assertEqual(review_job["context"]["source_review_id"], "review-parent-010")
        self.assertEqual(review_job["context"]["source_proposal_id"], "prop-parent-010")
        self.assertEqual(review_job["context"]["trigger_reason"], "proposal_accept")

    def test_backtest_review_completion_links_review_back_to_source_change_request(self) -> None:
        status, change_request = self._post(
            "/api/change-requests",
            {
                "type": "backtest.launch",
                "payload": {
                    "strategy_id": "trend-btc-01",
                    "data_range": "最近 180 天",
                    "timeframe": "4h",
                },
                "requested_by": "unit_test",
                "source_review_id": "review-parent-011",
                "source_proposal_id": "prop-parent-011",
                "trigger_reason": "proposal_accept",
                "target_mode": "paper",
                "priority": "high",
                "summary": "按提案继续补样本回测",
            },
        )

        self.assertEqual(status, 200)

        backtests_status, backtests = self._get("/api/backtests")
        self.assertEqual(backtests_status, 200)
        linked_backtest = backtests[0]

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{linked_backtest['id']}"
        )
        reconcile_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"change-request-reconcile-{change_request['id']}"
        )
        self.assertEqual(change_request["follow_up_job_id"], review_job["id"])
        self.assertEqual(change_request["follow_up_job_type"], "generate_backtest_review")

        control_main.repo.complete_agent_job(
            reconcile_job["id"],
            result_summary="AI 执行记录已补齐。",
            review=None,
            source="unit_test",
        )

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        unchanged = next(item for item in change_requests if item["id"] == change_request["id"])
        self.assertEqual(unchanged["follow_up_job_id"], review_job["id"])
        self.assertEqual(unchanged["follow_up_job_type"], "generate_backtest_review")
        self.assertEqual(unchanged["follow_up_job_status"], "queued")
        self.assertIsNone(unchanged["follow_up_result_summary"])

        review = control_main.ReviewDocument(
            id="review-backtest-change-request-001",
            period="backtest",
            strategy_id="trend-btc-01",
            backtest_id=linked_backtest["id"],
            source_change_request_id=change_request["id"],
            source_review_id="review-parent-011",
            source_proposal_id="prop-parent-011",
            trigger_reason="proposal_accept",
            title="BTC 补样本回测复盘",
            summary="本轮回测已补齐更长窗口，可继续评估。",
            highlights=["回测结果已经挂回来源变更。"],
            risks=["仍需继续观察资金门槛。"],
            proposals=[],
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        control_main.repo.complete_agent_job(
            review_job["id"],
            result_summary="回测复盘已完成。",
            review=review,
            source="unit_test",
        )

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        updated = next(item for item in change_requests if item["id"] == change_request["id"])
        self.assertEqual(updated["follow_up_job_id"], review_job["id"])
        self.assertEqual(updated["follow_up_job_type"], "generate_backtest_review")
        self.assertEqual(updated["follow_up_job_status"], "completed")
        self.assertEqual(updated["follow_up_result_summary"], "回测复盘已完成。")
        self.assertEqual(updated["linked_backtest_id"], linked_backtest["id"])
        self.assertEqual(updated["linked_backtest_timeframe"], "4h")
        self.assertEqual(updated["linked_backtest_data_range"], "最近 180 天")
        self.assertEqual(updated["linked_backtest_sample_quality"], linked_backtest["sample_quality"])
        self.assertEqual(updated["linked_backtest_history_source"], linked_backtest["history_source"])
        self.assertEqual(updated["linked_backtest_history_source_reason"], linked_backtest["history_source_reason"])
        self.assertEqual(updated["linked_backtest_history_source_detail"], linked_backtest["history_source_detail"])
        self.assertEqual(
            updated["linked_backtest_history_source_recommended_data_range"],
            linked_backtest["history_source_recommended_data_range"],
        )
        self.assertEqual(
            updated["linked_backtest_history_source_recommended_timeframe"],
            linked_backtest["history_source_recommended_timeframe"],
        )
        self.assertEqual(
            updated["linked_backtest_history_source_recommended_action"],
            linked_backtest["history_source_recommended_action"],
        )
        self.assertEqual(
            updated["linked_backtest_requested_candle_estimate"],
            linked_backtest["requested_candle_estimate"],
        )
        self.assertEqual(
            updated["linked_backtest_requested_candle_limit"],
            linked_backtest["requested_candle_limit"],
        )
        self.assertEqual(
            updated["linked_backtest_requested_range_start"],
            linked_backtest["requested_range_start"],
        )
        self.assertEqual(
            updated["linked_backtest_requested_range_end"],
            linked_backtest["requested_range_end"],
        )
        self.assertEqual(
            updated["linked_backtest_retrieved_window_completion_pct"],
            linked_backtest["retrieved_window_completion_pct"],
        )
        self.assertEqual(
            updated["linked_backtest_used_window_completion_pct"],
            linked_backtest["used_window_completion_pct"],
        )
        self.assertEqual(
            updated["linked_backtest_retrieved_candle_count"],
            linked_backtest["retrieved_candle_count"],
        )
        self.assertEqual(
            updated["linked_backtest_used_candle_count"],
            linked_backtest["used_candle_count"],
        )
        self.assertEqual(
            updated["linked_backtest_retrieved_range_start"],
            linked_backtest["retrieved_range_start"],
        )
        self.assertEqual(
            updated["linked_backtest_retrieved_range_end"],
            linked_backtest["retrieved_range_end"],
        )
        self.assertEqual(
            updated["linked_backtest_used_range_start"],
            linked_backtest["used_range_start"],
        )
        self.assertEqual(
            updated["linked_backtest_used_range_end"],
            linked_backtest["used_range_end"],
        )
        self.assertEqual(updated["linked_backtest_history_truncated"], linked_backtest["history_truncated"])
        self.assertEqual(updated["linked_backtest_history_gap_reason"], linked_backtest["history_gap_reason"])
        self.assertEqual(
            updated["linked_backtest_full_window_recommended_data_range"],
            linked_backtest["full_window_recommended_data_range"],
        )
        self.assertEqual(
            updated["linked_backtest_full_window_recommended_timeframe"],
            linked_backtest["full_window_recommended_timeframe"],
        )
        self.assertEqual(
            updated["linked_backtest_full_window_recommended_action"],
            linked_backtest["full_window_recommended_action"],
        )
        self.assertEqual(updated["linked_backtest_decision_readiness"], linked_backtest["decision_readiness"])
        self.assertEqual(
            updated["linked_backtest_decision_readiness_detail"],
            linked_backtest["decision_readiness_detail"],
        )
        self.assertEqual(
            updated["linked_backtest_decision_recommended_data_range"],
            linked_backtest["decision_recommended_data_range"],
        )
        self.assertEqual(
            updated["linked_backtest_decision_recommended_timeframe"],
            linked_backtest["decision_recommended_timeframe"],
        )
        self.assertEqual(
            updated["linked_backtest_decision_readiness_action"],
            linked_backtest["decision_readiness_action"],
        )
        self.assertEqual(updated["linked_review_id"], review.id)
        self.assertEqual(updated["linked_review_title"], review.title)
        self.assertEqual(updated["linked_review_period"], "backtest")

        activity_status, activity = self._get("/api/strategies/trend-btc-01/activity")
        self.assertEqual(activity_status, 200)
        self.assertEqual(activity["latest_backtest"]["id"], linked_backtest["id"])
        self.assertEqual(activity["latest_backtest_job"]["id"], review_job["id"])
        self.assertEqual(activity["latest_backtest_job"]["backtest_id"], linked_backtest["id"])
        self.assertEqual(activity["latest_backtest_job"]["source_change_request_id"], change_request["id"])
        self.assertEqual(activity["latest_backtest_review"]["id"], review.id)
        self.assertEqual(activity["latest_backtest_review"]["backtest_id"], linked_backtest["id"])
        self.assertEqual(activity["latest_actionable_backtest"]["id"], linked_backtest["id"])
        self.assertEqual(activity["latest_backtest_record"]["id"], linked_backtest["id"])
        self.assertEqual(activity["latest_actionable_backtest_record"]["id"], linked_backtest["id"])
        self.assertEqual(activity["latest_actionable_backtest_review"]["id"], review.id)
        self.assertEqual(activity["latest_actionable_backtest_job"]["id"], review_job["id"])

    def test_change_request_endpoint_mirrors_linked_backtest_window_hints_without_backtest_lookup(self) -> None:
        record = control_main.repo.create_change_request(
            ChangeRequestCreate(
                type="backtest.launch",
                payload={
                    "strategy_id": "trend-btc-01",
                    "data_range": "最近 180 天",
                    "timeframe": "4h",
                },
                requested_by="unit_test",
                source_review_id="review-parent-window-001",
                source_proposal_id="prop-parent-window-001",
                trigger_reason="proposal_accept",
                target_mode=AccountMode.PAPER,
                priority="high",
                summary="验证 ChangeRequest 镜像回测窗口提示",
            )
        )
        now = datetime.now(timezone.utc).astimezone().isoformat()
        mirrored_backtest = BacktestRun(
            id="backtest-window-hints-001",
            strategy_id="trend-btc-01",
            strategy_name="BTC 趋势跟随",
            source_change_request_id=record.id,
            source_review_id="review-parent-window-001",
            source_proposal_id="prop-parent-window-001",
            trigger_reason="proposal_accept",
            status="completed",
            started_at=now,
            finished_at=now,
            symbol_scope=["BTCUSDT"],
            timeframe="4h",
            data_range="最近 180 天",
            data_granularity="4h",
            fee_model="taker",
            slippage_model="fixed_bp_5",
            parameter_snapshot={},
            metrics=BacktestMetrics(
                annual_return="+2.00%",
                max_drawdown="-3.00%",
                sharpe="0.80",
                win_rate="40.00%",
                pnl="+120.00 USDT",
                trades=2,
            ),
            reference_only=False,
            sample_quality="low_sample",
            history_source="market_detail_fallback",
            history_source_reason="exchange_fetch_failed",
            history_source_detail="upstream TLS EOF while reading",
            history_source_recommended_data_range="最近 90 天",
            history_source_recommended_timeframe="1h",
            history_source_recommended_action="恢复交易所历史 K 线拉取后，再按 最近 90 天 / 1h 重跑。",
            decision_readiness="sample_incomplete",
            decision_readiness_detail="样本窗口未完整覆盖。",
            decision_recommended_data_range=None,
            decision_recommended_timeframe=None,
            decision_readiness_action="先补样本后再继续判断。",
            requested_candle_estimate=1200,
            requested_candle_limit=600,
            requested_range_start="2025-01-01T00:00:00+08:00",
            requested_range_end="2025-06-30T00:00:00+08:00",
            retrieved_window_completion_pct=50.0,
            used_window_completion_pct=50.0,
            retrieved_candle_count=600,
            used_candle_count=600,
            retrieved_range_start="2025-01-01T00:00:00+08:00",
            retrieved_range_end="2025-03-31T00:00:00+08:00",
            used_range_start="2025-01-01T00:00:00+08:00",
            used_range_end="2025-03-31T00:00:00+08:00",
            history_truncated=True,
            history_gap_reason="sample_cap",
            full_window_recommended_data_range="最近 45 天",
            full_window_recommended_timeframe="1d",
            full_window_recommended_action="保持研究目标不变，建议先缩短到 最近 45 天 并保持 1d 重跑。",
            notes="synthetic backtest for change request mirror",
        )
        control_main.repo._sync_change_request_follow_up_locked(record.id, backtest=mirrored_backtest)

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        updated = next(item for item in change_requests if item["id"] == record.id)
        self.assertEqual(updated["linked_backtest_id"], mirrored_backtest.id)
        self.assertEqual(updated["linked_backtest_history_source"], "market_detail_fallback")
        self.assertEqual(updated["linked_backtest_history_source_reason"], "exchange_fetch_failed")
        self.assertEqual(updated["linked_backtest_history_source_detail"], "upstream TLS EOF while reading")
        self.assertEqual(updated["linked_backtest_history_source_recommended_data_range"], "最近 90 天")
        self.assertEqual(updated["linked_backtest_history_source_recommended_timeframe"], "1h")
        self.assertIn("恢复交易所历史 K 线拉取", updated["linked_backtest_history_source_recommended_action"])
        self.assertEqual(updated["linked_backtest_requested_candle_estimate"], 1200)
        self.assertEqual(updated["linked_backtest_requested_candle_limit"], 600)
        self.assertEqual(updated["linked_backtest_requested_range_start"], "2025-01-01T00:00:00+08:00")
        self.assertEqual(updated["linked_backtest_requested_range_end"], "2025-06-30T00:00:00+08:00")
        self.assertEqual(updated["linked_backtest_retrieved_window_completion_pct"], 50.0)
        self.assertEqual(updated["linked_backtest_used_window_completion_pct"], 50.0)
        self.assertEqual(updated["linked_backtest_retrieved_candle_count"], 600)
        self.assertEqual(updated["linked_backtest_used_candle_count"], 600)
        self.assertEqual(updated["linked_backtest_retrieved_range_start"], "2025-01-01T00:00:00+08:00")
        self.assertEqual(updated["linked_backtest_retrieved_range_end"], "2025-03-31T00:00:00+08:00")
        self.assertEqual(updated["linked_backtest_used_range_start"], "2025-01-01T00:00:00+08:00")
        self.assertEqual(updated["linked_backtest_used_range_end"], "2025-03-31T00:00:00+08:00")
        self.assertTrue(updated["linked_backtest_history_truncated"])
        self.assertEqual(updated["linked_backtest_history_gap_reason"], "sample_cap")
        self.assertEqual(updated["linked_backtest_full_window_recommended_data_range"], "最近 45 天")
        self.assertEqual(updated["linked_backtest_full_window_recommended_timeframe"], "1d")
        self.assertIn("建议先缩短到 最近 45 天", updated["linked_backtest_full_window_recommended_action"])

    def test_backtest_endpoint_rejects_invalid_timeframe(self) -> None:
        status, payload = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 90 天",
                "timeframe": "2h",
            },
        )
        self.assertEqual(status, 400)
        self.assertIn("回测周期仅支持 15m / 1h / 4h / 1d", payload["detail"])

    def test_backtest_endpoint_preserves_source_lineage_fields(self) -> None:
        status, backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 90 天",
                "timeframe": "1h",
                "source_change_request_id": "cr-parent-001",
                "source_backtest_id": "bt-parent-001",
                "source_review_id": "review-parent-001",
                "source_proposal_id": "prop-parent-001",
                "trigger_reason": "decision_rerun",
            },
        )

        self.assertEqual(status, 200)
        self.assertEqual(backtest["source_change_request_id"], "cr-parent-001")
        self.assertEqual(backtest["source_backtest_id"], "bt-parent-001")
        self.assertEqual(backtest["source_review_id"], "review-parent-001")
        self.assertEqual(backtest["source_proposal_id"], "prop-parent-001")
        self.assertEqual(backtest["trigger_reason"], "decision_rerun")

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{backtest['id']}"
        )
        self.assertEqual(review_job["context"]["source_change_request_id"], "cr-parent-001")
        self.assertEqual(review_job["context"]["source_backtest_id"], "bt-parent-001")
        self.assertEqual(review_job["context"]["source_review_id"], "review-parent-001")
        self.assertEqual(review_job["context"]["source_proposal_id"], "prop-parent-001")
        self.assertEqual(review_job["context"]["trigger_reason"], "decision_rerun")

    def test_backtest_endpoint_expands_candle_window_for_relative_data_range(self) -> None:
        original_market_data = control_main.market_data
        backtest_market_data = RecordingBacktestMarketClient()
        control_main.market_data = backtest_market_data
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        status_90, _ = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 90 天",
                "timeframe": "1d",
            },
        )
        status_180, _ = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 180 天",
                "timeframe": "1d",
            },
        )

        self.assertEqual(status_90, 200)
        self.assertEqual(status_180, 200)
        self.assertGreaterEqual(len(backtest_market_data.candle_requests), 2)
        self.assertEqual(backtest_market_data.candle_requests[-2]["interval"], "D")
        self.assertEqual(backtest_market_data.candle_requests[-2]["limit"], 95)
        self.assertEqual(backtest_market_data.candle_requests[-1]["interval"], "D")
        self.assertEqual(backtest_market_data.candle_requests[-1]["limit"], 185)

    def test_backtest_endpoint_fetches_full_sample_window_with_paginated_history(self) -> None:
        original_market_data = control_main.market_data
        backtest_market_data = PaginatedHistoryBacktestMarketClient()
        control_main.market_data = backtest_market_data
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        status, backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 180 天",
                "timeframe": "1h",
            },
        )

        self.assertEqual(status, 200)
        self.assertGreater(len(backtest_market_data.candle_requests), 1)
        self.assertEqual(backtest_market_data.candle_requests[0]["limit"], 600)
        self.assertEqual(backtest["requested_candle_estimate"], 4325)
        self.assertEqual(backtest["requested_candle_limit"], 4325)
        self.assertTrue(backtest["requested_range_start"])
        self.assertTrue(backtest["requested_range_end"])
        self.assertEqual(backtest["retrieved_window_completion_pct"], 100.0)
        self.assertEqual(backtest["used_window_completion_pct"], 100.0)
        self.assertEqual(backtest["retrieved_candle_count"], 4325)
        self.assertEqual(backtest["used_candle_count"], 4325)
        self.assertTrue(backtest["retrieved_range_start"])
        self.assertTrue(backtest["retrieved_range_end"])
        self.assertEqual(backtest["retrieved_range_start"], backtest["used_range_start"])
        self.assertEqual(backtest["retrieved_range_end"], backtest["used_range_end"])
        self.assertFalse(backtest["history_truncated"])
        self.assertIsNone(backtest["full_window_recommended_data_range"])
        self.assertIsNone(backtest["full_window_recommended_timeframe"])
        self.assertIsNone(backtest["full_window_recommended_action"])
        self.assertEqual(backtest["decision_readiness"], "ready")
        self.assertIn("已达到最小门槛", backtest["decision_readiness_detail"])
        self.assertIsNone(backtest["decision_recommended_data_range"])
        self.assertIsNone(backtest["decision_recommended_timeframe"])
        self.assertIsNone(backtest["decision_readiness_action"])
        self.assertNotIn("理论需要约 4325 根 K 线", backtest["notes"])

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{backtest['id']}"
        )
        self.assertEqual(review_job["context"]["requested_candle_estimate"], 4325)
        self.assertEqual(review_job["context"]["requested_candle_limit"], 4325)
        self.assertEqual(review_job["context"]["requested_range_start"], backtest["requested_range_start"])
        self.assertEqual(review_job["context"]["requested_range_end"], backtest["requested_range_end"])
        self.assertEqual(review_job["context"]["retrieved_window_completion_pct"], 100.0)
        self.assertEqual(review_job["context"]["used_window_completion_pct"], 100.0)
        self.assertEqual(review_job["context"]["retrieved_candle_count"], 4325)
        self.assertEqual(review_job["context"]["used_candle_count"], 4325)
        self.assertEqual(review_job["context"]["retrieved_range_start"], backtest["retrieved_range_start"])
        self.assertEqual(review_job["context"]["retrieved_range_end"], backtest["retrieved_range_end"])
        self.assertEqual(review_job["context"]["used_range_start"], backtest["used_range_start"])
        self.assertEqual(review_job["context"]["used_range_end"], backtest["used_range_end"])
        self.assertFalse(review_job["context"]["history_truncated"])
        self.assertIsNone(review_job["context"]["full_window_recommended_data_range"])
        self.assertIsNone(review_job["context"]["full_window_recommended_timeframe"])
        self.assertIsNone(review_job["context"]["full_window_recommended_action"])
        self.assertEqual(review_job["context"]["decision_readiness"], "ready")
        self.assertIn("已达到最小门槛", review_job["context"]["decision_readiness_detail"])
        self.assertIsNone(review_job["context"]["decision_recommended_data_range"])
        self.assertIsNone(review_job["context"]["decision_recommended_timeframe"])
        self.assertIsNone(review_job["context"]["decision_readiness_action"])
        self.assertEqual(review_job["context"]["review_strategy_activity"]["strategy_id"], "trend-btc-01")
        self.assertIn("recent_audit_events", review_job["context"]["review_strategy_activity"])

    def test_backtest_endpoint_surfaces_shorter_range_recommendation_when_even_1d_cannot_cover(self) -> None:
        original_market_data = control_main.market_data
        backtest_market_data = PaginatedHistoryBacktestMarketClient()
        control_main.market_data = backtest_market_data
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        status, backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 30000 天",
                "timeframe": "1d",
            },
        )

        self.assertEqual(status, 200)
        self.assertGreater(len(backtest_market_data.candle_requests), 1)
        self.assertEqual(backtest_market_data.candle_requests[0]["interval"], "D")
        self.assertEqual(backtest_market_data.candle_requests[0]["limit"], 600)
        self.assertEqual(backtest["requested_candle_estimate"], 30005)
        self.assertEqual(backtest["requested_candle_limit"], 20000)
        self.assertTrue(backtest["requested_range_start"])
        self.assertTrue(backtest["requested_range_end"])
        self.assertEqual(backtest["retrieved_window_completion_pct"], 66.66)
        self.assertEqual(backtest["used_window_completion_pct"], 66.66)
        self.assertEqual(backtest["retrieved_candle_count"], 20000)
        self.assertEqual(backtest["used_candle_count"], 20000)
        self.assertTrue(backtest["retrieved_range_start"])
        self.assertTrue(backtest["retrieved_range_end"])
        self.assertEqual(backtest["retrieved_range_start"], backtest["used_range_start"])
        self.assertEqual(backtest["retrieved_range_end"], backtest["used_range_end"])
        self.assertTrue(backtest["history_truncated"])
        self.assertEqual(backtest["full_window_recommended_data_range"], "最近 19995 天")
        self.assertEqual(backtest["full_window_recommended_timeframe"], "1d")
        self.assertIn("缩短到 最近 19995 天", backtest["full_window_recommended_action"])
        self.assertEqual(backtest["decision_readiness"], "sample_incomplete")
        self.assertEqual(backtest["decision_recommended_data_range"], "最近 19995 天")
        self.assertEqual(backtest["decision_recommended_timeframe"], "1d")
        self.assertIn("补足完整样本", backtest["decision_readiness_detail"])
        self.assertIn("缩短到 最近 19995 天", backtest["decision_readiness_action"])

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{backtest['id']}"
        )
        self.assertEqual(review_job["context"]["retrieved_range_start"], backtest["retrieved_range_start"])
        self.assertEqual(review_job["context"]["retrieved_range_end"], backtest["retrieved_range_end"])
        self.assertEqual(review_job["context"]["requested_range_start"], backtest["requested_range_start"])
        self.assertEqual(review_job["context"]["requested_range_end"], backtest["requested_range_end"])
        self.assertEqual(review_job["context"]["retrieved_window_completion_pct"], 66.66)
        self.assertEqual(review_job["context"]["used_window_completion_pct"], 66.66)
        self.assertEqual(review_job["context"]["used_range_start"], backtest["used_range_start"])
        self.assertEqual(review_job["context"]["used_range_end"], backtest["used_range_end"])
        self.assertEqual(review_job["context"]["full_window_recommended_data_range"], "最近 19995 天")
        self.assertEqual(review_job["context"]["full_window_recommended_timeframe"], "1d")
        self.assertIn("缩短到 最近 19995 天", review_job["context"]["full_window_recommended_action"])
        self.assertEqual(review_job["context"]["decision_readiness"], "sample_incomplete")
        self.assertEqual(review_job["context"]["decision_recommended_data_range"], "最近 19995 天")
        self.assertEqual(review_job["context"]["decision_recommended_timeframe"], "1d")
        self.assertIn("补足完整样本", review_job["context"]["decision_readiness_detail"])
        self.assertIn("缩短到 最近 19995 天", review_job["context"]["decision_readiness_action"])
        self.assertEqual(review_job["context"]["review_strategy_activity"]["strategy_id"], "trend-btc-01")
        self.assertIn(backtest["id"], str(review_job["context"]["review_strategy_activity"]["latest_backtest"] or ""))
        self.assertIn(review_job["id"], str(review_job["context"]["review_strategy_activity"]["latest_backtest_job"] or ""))
        self.assertIsNone(review_job["context"]["review_strategy_activity"]["latest_backtest_review"])
        self.assertTrue(
            any(backtest["id"] in item for item in review_job["context"]["review_strategy_activity"]["recent_backtests"])
        )
        self.assertTrue(
            any(
                review_job["id"] in item
                and "generate_backtest_review" in item
                and "queued" in item
                for item in review_job["context"]["review_strategy_activity"]["recent_agent_jobs"]
            )
        )
        self.assertIn("recent_reviews", review_job["context"]["review_strategy_activity"])

    def test_backtest_endpoint_surfaces_available_history_range_when_exchange_history_is_short(self) -> None:
        original_market_data = control_main.market_data
        backtest_market_data = ShortHistoryBacktestMarketClient(total_available=60)
        control_main.market_data = backtest_market_data
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        status, backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 90 天",
                "timeframe": "1d",
            },
        )

        self.assertEqual(status, 200)
        self.assertEqual(backtest["requested_candle_estimate"], 95)
        self.assertEqual(backtest["requested_candle_limit"], 95)
        self.assertTrue(backtest["requested_range_start"])
        self.assertTrue(backtest["requested_range_end"])
        self.assertEqual(backtest["retrieved_window_completion_pct"], 63.16)
        self.assertEqual(backtest["used_window_completion_pct"], 63.16)
        self.assertEqual(backtest["retrieved_candle_count"], 60)
        self.assertEqual(backtest["used_candle_count"], 60)
        self.assertEqual(backtest["history_gap_reason"], "insufficient_history")
        self.assertTrue(backtest["history_truncated"])
        self.assertTrue(backtest["retrieved_range_start"])
        self.assertTrue(backtest["retrieved_range_end"])
        self.assertEqual(backtest["full_window_recommended_timeframe"], "1d")
        self.assertIn("建议先缩短到该可用区间", backtest["full_window_recommended_action"])

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{backtest['id']}"
        )
        self.assertEqual(review_job["context"]["history_gap_reason"], "insufficient_history")
        self.assertEqual(review_job["context"]["requested_range_start"], backtest["requested_range_start"])
        self.assertEqual(review_job["context"]["requested_range_end"], backtest["requested_range_end"])
        self.assertEqual(review_job["context"]["retrieved_window_completion_pct"], 63.16)
        self.assertEqual(review_job["context"]["used_window_completion_pct"], 63.16)
        self.assertEqual(review_job["context"]["retrieved_range_start"], backtest["retrieved_range_start"])
        self.assertEqual(review_job["context"]["retrieved_range_end"], backtest["retrieved_range_end"])
        self.assertIn("建议先缩短到该可用区间", review_job["context"]["full_window_recommended_action"])

    def test_backtest_endpoint_marks_market_detail_fallback_history_source_when_history_fetch_fails(self) -> None:
        original_market_data = control_main.market_data
        backtest_market_data = FailingBacktestHistoryMarketClient()
        control_main.market_data = backtest_market_data
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        status, backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 90 天",
                "timeframe": "1h",
            },
        )

        self.assertEqual(status, 200)
        self.assertEqual(len(backtest_market_data.history_requests), 1)
        self.assertEqual(backtest["history_source"], "market_detail_fallback")
        self.assertEqual(backtest["history_source_reason"], "exchange_fetch_failed")
        self.assertEqual(backtest["history_source_detail"], "Bybit history api unavailable")
        self.assertEqual(backtest["history_source_recommended_data_range"], "最近 90 天")
        self.assertEqual(backtest["history_source_recommended_timeframe"], "1h")
        self.assertIn("恢复交易所历史 K 线拉取", backtest["history_source_recommended_action"])
        self.assertEqual(backtest["decision_readiness"], "research_only")
        self.assertIn("仅适合研究排障", backtest["decision_readiness_detail"])
        self.assertEqual(backtest["decision_recommended_data_range"], "最近 90 天")
        self.assertEqual(backtest["decision_recommended_timeframe"], "1h")
        self.assertIn("恢复交易所历史 K 线拉取", backtest["decision_readiness_action"])
        self.assertIn("工作台行情快照样本", backtest["notes"])
        self.assertIn("回退原因：Bybit history api unavailable", backtest["notes"])
        self.assertIn("建议动作：请先恢复交易所历史 K 线拉取", backtest["notes"])

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{backtest['id']}"
        )
        self.assertEqual(review_job["context"]["history_source"], "market_detail_fallback")
        self.assertEqual(review_job["context"]["history_source_reason"], "exchange_fetch_failed")
        self.assertEqual(review_job["context"]["history_source_detail"], "Bybit history api unavailable")
        self.assertEqual(review_job["context"]["history_source_recommended_data_range"], "最近 90 天")
        self.assertEqual(review_job["context"]["history_source_recommended_timeframe"], "1h")
        self.assertIn("恢复交易所历史 K 线拉取", review_job["context"]["history_source_recommended_action"])
        self.assertEqual(review_job["context"]["decision_readiness"], "research_only")
        self.assertIn("仅适合研究排障", review_job["context"]["decision_readiness_detail"])
        self.assertEqual(review_job["context"]["decision_recommended_data_range"], "最近 90 天")
        self.assertEqual(review_job["context"]["decision_recommended_timeframe"], "1h")
        self.assertIn("恢复交易所历史 K 线拉取", review_job["context"]["decision_readiness_action"])

    def test_backtest_endpoint_marks_market_detail_fallback_when_exchange_history_samples_are_insufficient(self) -> None:
        original_market_data = control_main.market_data
        backtest_market_data = ShortHistoryBacktestMarketClient(total_available=20)
        control_main.market_data = backtest_market_data
        self.addCleanup(setattr, control_main, "market_data", original_market_data)

        status, backtest = self._post(
            "/api/backtests",
            {
                "strategy_id": "trend-btc-01",
                "data_range": "最近 90 天",
                "timeframe": "1d",
            },
        )

        self.assertEqual(status, 200)
        self.assertEqual(backtest["history_source"], "market_detail_fallback")
        self.assertEqual(backtest["history_source_reason"], "insufficient_exchange_samples")
        self.assertEqual(
            backtest["history_source_detail"],
            "交易所历史仅返回 20 根样本，低于最小回测门槛 30 根。",
        )
        self.assertEqual(backtest["history_source_recommended_data_range"], "最近 180 天")
        self.assertEqual(backtest["history_source_recommended_timeframe"], "1d")
        self.assertIn("改用 最近 180 天，并保持 1d 补样本后再重跑", backtest["history_source_recommended_action"])
        self.assertEqual(backtest["decision_readiness"], "research_only")
        self.assertIn("暂不建议直接用于调参或上线判断", backtest["decision_readiness_detail"])
        self.assertEqual(backtest["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(backtest["decision_recommended_timeframe"], "1d")
        self.assertIn("改用 最近 180 天，并保持 1d 补样本后再重跑", backtest["decision_readiness_action"])
        self.assertIn("回退原因：交易所历史仅返回 20 根样本", backtest["notes"])
        self.assertIn("建议动作：当前交易所历史样本不足", backtest["notes"])

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"backtest-review-{backtest['id']}"
        )
        self.assertEqual(review_job["context"]["history_source"], "market_detail_fallback")
        self.assertEqual(review_job["context"]["history_source_reason"], "insufficient_exchange_samples")
        self.assertEqual(
            review_job["context"]["history_source_detail"],
            "交易所历史仅返回 20 根样本，低于最小回测门槛 30 根。",
        )
        self.assertEqual(review_job["context"]["history_source_recommended_data_range"], "最近 180 天")
        self.assertEqual(review_job["context"]["history_source_recommended_timeframe"], "1d")
        self.assertIn("改用 最近 180 天，并保持 1d 补样本后再重跑", review_job["context"]["history_source_recommended_action"])
        self.assertEqual(review_job["context"]["decision_readiness"], "research_only")
        self.assertIn("暂不建议直接用于调参或上线判断", review_job["context"]["decision_readiness_detail"])
        self.assertEqual(review_job["context"]["decision_recommended_data_range"], "最近 180 天")
        self.assertEqual(review_job["context"]["decision_recommended_timeframe"], "1d")
        self.assertIn("改用 最近 180 天，并保持 1d 补样本后再重跑", review_job["context"]["decision_readiness_action"])

    def test_accepting_backtest_request_proposal_rejects_invalid_timeframe_without_mutating_status(self) -> None:
        proposal = next(
            item
            for review in control_main.repo.state.reviews
            for item in review.proposals
            if item.id == "prop-003"
        )
        original_payload = dict(proposal.payload)
        original_backtest_count = len(control_main.repo.snapshot().backtests)
        proposal.payload = {**proposal.payload, "timeframe": "2h"}
        try:
            action_status, result = self._post(
                "/api/ai/proposals/prop-003/action",
                {"action": "accept", "requested_by": "unit_test"},
            )
            self.assertEqual(action_status, 409)
            self.assertIn("回测周期仅支持 15m / 1h / 4h / 1d", result["detail"])
            self.assertEqual(proposal.status, "pending")
            self.assertEqual(len(control_main.repo.snapshot().backtests), original_backtest_count)
        finally:
            proposal.payload = original_payload

    def test_publish_recommendation_is_blocked_when_freeze_publish_enabled(self) -> None:
        toggle_status, toggle_result = self._post(
            "/api/ai/scheduler/commands",
            {"command": "freeze_publish", "requested_by": "unit_test", "reason": "proposal gate"},
        )
        self.assertEqual(toggle_status, 200)
        self.assertTrue(toggle_result["freeze_publish"])

        action_status, result = self._post(
            "/api/ai/proposals/prop-002/action",
            {"action": "accept", "requested_by": "unit_test"},
        )
        self.assertEqual(action_status, 409)
        self.assertIn("冻结自动发布", result["detail"])

    def test_publish_recommendation_requires_recommendation_without_mutating_status(self) -> None:
        proposal = next(
            item
            for review in control_main.repo.state.reviews
            for item in review.proposals
            if item.id == "prop-002"
        )
        original_payload = dict(proposal.payload)
        original_change_request_count = len(control_main.repo.snapshot().change_requests)
        proposal.payload = {key: value for key, value in proposal.payload.items() if key != "recommendation"}
        try:
            action_status, result = self._post(
                "/api/ai/proposals/prop-002/action",
                {"action": "accept", "requested_by": "unit_test"},
            )
            self.assertEqual(action_status, 409)
            self.assertIn("缺少 recommendation", result["detail"])
            self.assertEqual(proposal.status, "pending")
            self.assertEqual(len(control_main.repo.snapshot().change_requests), original_change_request_count)
        finally:
            proposal.payload = original_payload

    def test_accepting_script_patch_proposal_creates_queued_change_request_and_manual_followup_event(self) -> None:
        review = control_main.repo.state.reviews[0]
        proposal = control_main.StrategyProposal(
            id="prop-script-001",
            proposal_type="script_patch_proposal",
            strategy_id="trend-btc-01",
            title="补执行摘要脚本补丁",
            description="为回测复盘脚本补上更细的执行摘要。",
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
            status="pending",
            expected_impact="让后续编排链能按补丁提案继续推进。",
            payload={
                "target_mode": "paper",
                "summary": "补回测复盘执行摘要",
                "files": ["services/control-api/main.py"],
            },
        )
        review.proposals.insert(0, proposal)
        self.addCleanup(lambda: review.proposals.remove(proposal) if proposal in review.proposals else None)

        action_status, result = self._post(
            "/api/ai/proposals/prop-script-001/action",
            {"action": "accept", "requested_by": "unit_test"},
        )
        self.assertEqual(action_status, 200)
        self.assertEqual(result["proposal"]["status"], "accepted")
        self.assertIsNotNone(result["created_change_request"])
        self.assertIsNone(result["created_backtest"])
        assert result["created_change_request"] is not None
        self.assertEqual(result["created_change_request"]["type"], "proposal.script_patch_proposal")
        self.assertEqual(result["created_change_request"]["status"], "queued")
        self.assertEqual(result["created_change_request"]["source_review_id"], "review-20260330-daily")
        self.assertEqual(result["created_change_request"]["source_proposal_id"], "prop-script-001")
        self.assertEqual(result["created_change_request"]["trigger_reason"], "proposal_accept")
        self.assertTrue(result["created_change_request"]["manual_followup_required"])
        self.assertEqual(
            result["created_change_request"]["manual_followup_detail"],
            "脚本补丁提案已转成待处理 ChangeRequest，需后续人工或编排链落实。",
        )

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        patch_request = next(
            (item for item in change_requests if item["payload"].get("proposal_id") == "prop-script-001"),
            None,
        )
        self.assertIsNotNone(patch_request)
        self.assertEqual(patch_request["status"], "queued")
        self.assertEqual(patch_request["source_review_id"], "review-20260330-daily")
        self.assertEqual(patch_request["source_proposal_id"], "prop-script-001")
        self.assertEqual(patch_request["trigger_reason"], "proposal_accept")
        self.assertTrue(patch_request["manual_followup_required"])
        self.assertEqual(
            patch_request["manual_followup_detail"],
            "脚本补丁提案已转成待处理 ChangeRequest，需后续人工或编排链落实。",
        )

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        followup_event = next(
            (
                item
                for item in audit_events
                if item["event_type"] == "change_request.manual_followup_required"
                and item["payload"].get("proposal_id") == "prop-script-001"
            ),
            None,
        )
        self.assertIsNotNone(followup_event)

        review_status, review_job = self._post(
            "/api/strategies/trend-btc-01/review",
            {
                "review_kind": "issue",
                "summary": "跟踪脚本补丁提案后续落实情况。",
                "detail": "确认这条脚本补丁提案生成的变更是否仍需人工跟进。",
                "requested_by": "unit_test",
                "request_key": "manual-script-patch-followup-001",
            },
        )
        self.assertEqual(review_status, 200)
        self.assertTrue(
            any(
                "prop-script-001" in item
                and patch_request["id"] in item
                and "需人工跟进" in item
                and "变更" in item
                for item in review_job["context"]["review_strategy_activity"]["recent_proposals"]
            )
        )

    def test_manual_change_request_defaults_to_manual_create_trigger_reason(self) -> None:
        status, created = self._post(
            "/api/change-requests",
            {
                "type": "strategy.parameter.update",
                "payload": {"strategy_id": "trend-btc-01", "ema_fast": 11},
                "requested_by": "unit_test",
                "source_backtest_id": "bt-manual-001",
                "target_mode": "paper",
                "priority": "high",
                "summary": "手动调整 BTC 趋势快线参数",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(created["trigger_reason"], "manual_create")
        self.assertEqual(created["source_backtest_id"], "bt-manual-001")
        self.assertIsNone(created["source_review_id"])
        self.assertIsNone(created["source_proposal_id"])

    def test_accepting_strategy_proposal_from_backtest_review_preserves_source_backtest_lineage(self) -> None:
        review = control_main.ReviewDocument(
            id="review-backtest-proposal-001",
            title="BTC 趋势回测复盘",
            period="backtest",
            summary="基于回测结果给出一条调参建议。",
            highlights=["快线参数仍有轻微优化空间。"],
            symbols=["BTCUSDT"],
            overall_risk="medium",
            market_bias="bullish",
            confidence=0.68,
            actions=["观察 4h 周期趋势一致性"],
            suggestions=["保留 4h 主趋势，但略微放宽快线参数。"],
            risks=["近期样本仍需持续观察。"],
            proposal_status="pending",
            proposals=[
                control_main.StrategyProposal(
                    id="prop-backtest-param-001",
                    proposal_type="param_update",
                    strategy_id="trend-btc-01",
                    title="放宽快线参数",
                    description="基于回测结果建议把快线参数调到 13。",
                    created_at=datetime.now(timezone.utc).astimezone().isoformat(),
                    status="pending",
                    expected_impact="减少短噪音触发频率。",
                    payload={"target_mode": "paper", "ema_fast": 13},
                )
            ],
            backtest_id="bt-parent-from-review-001",
            created_at=datetime.now(timezone.utc).astimezone().isoformat(),
        )
        control_main.repo.state.reviews.insert(0, review)
        self.addCleanup(lambda: control_main.repo.state.reviews.remove(review) if review in control_main.repo.state.reviews else None)

        action_status, result = self._post(
            "/api/ai/proposals/prop-backtest-param-001/action",
            {"action": "accept", "requested_by": "unit_test"},
        )
        self.assertEqual(action_status, 200)
        assert result["created_change_request"] is not None
        self.assertEqual(result["created_change_request"]["source_backtest_id"], "bt-parent-from-review-001")
        self.assertEqual(result["created_change_request"]["source_review_id"], "review-backtest-proposal-001")
        self.assertEqual(result["created_change_request"]["source_proposal_id"], "prop-backtest-param-001")
        self.assertEqual(result["created_change_request"]["trigger_reason"], "proposal_accept")

        change_requests_status, change_requests = self._get("/api/change-requests")
        self.assertEqual(change_requests_status, 200)
        created_request = next(item for item in change_requests if item["id"] == result["created_change_request"]["id"])
        self.assertEqual(created_request["source_backtest_id"], "bt-parent-from-review-001")
        self.assertEqual(created_request["source_review_id"], "review-backtest-proposal-001")

        scheduler_status, scheduler = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_status, 200)
        review_job = next(
            item for item in scheduler["jobs"] if item["idempotency_key"] == f"strategy-change-review-{created_request['id']}"
        )
        self.assertEqual(review_job["context"]["source_backtest_id"], "bt-parent-from-review-001")
        self.assertEqual(review_job["context"]["source_review_id"], "review-backtest-proposal-001")
        self.assertEqual(review_job["context"]["source_proposal_id"], "prop-backtest-param-001")
        self.assertEqual(review_job["context"]["trigger_reason"], "proposal_accept")

    def test_manual_trade_only_accepts_paper_mode(self) -> None:
        before_status, before_overview = self._get("/api/account/overview")
        self.assertEqual(before_status, 200)
        self.assertEqual(before_overview["source"], "paper")
        self.assertEqual(before_overview["positions_count"], 1)

        success_status, success_trade = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 1.2,
                "price": 65000,
                "note": "unit test",
            },
        )
        self.assertEqual(success_status, 200)
        self.assertEqual(success_trade["mode"], "paper")
        self.assertEqual(success_trade["status"], "filled")

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["source"], "paper")
        self.assertEqual(overview["positions_count"], 2)
        self.assertEqual(overview["open_orders_count"], 0)

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        self.assertEqual({item["source"] for item in positions}, {"paper"})
        self.assertTrue(any(item["symbol"] == "BTCUSDT" for item in positions))
        self.assertTrue(any(item["symbol"] == "ETHUSDT" for item in positions))

        live_status, live_snapshot = self._get("/api/account/live")
        self.assertEqual(live_status, 200)
        self.assertEqual(live_snapshot["overview"]["source"], "paper")
        self.assertEqual(live_snapshot["overview"]["positions_count"], 2)
        self.assertEqual(len(live_snapshot["positions"]), 2)

        reject_status, reject_payload = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 1.2,
                "price": 65000,
                "note": "unit test",
            },
        )
        self.assertEqual(reject_status, 409)
        self.assertIn("只开放 Paper 模式", reject_payload["detail"])

        invalid_status, invalid_payload = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0,
                "price": 65000,
                "note": "unit test",
            },
        )
        self.assertEqual(invalid_status, 422)
        self.assertIn("greater than 0", json.dumps(invalid_payload, ensure_ascii=False))

    def test_trade_preview_reports_position_and_balance_impact(self) -> None:
        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 1.0,
                "price": 65000,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["action"], "开多")
        self.assertEqual(preview["current_position_side"], "flat")
        self.assertEqual(preview["projected_position_side"], "long")
        self.assertEqual(preview["projected_position_size"], "1")
        self.assertEqual(preview["estimated_realized_pnl"], "--")
        self.assertIn("65,000.00 USDT", preview["notional"])
        self.assertIn("USDT", preview["available_balance_before"])
        self.assertIn("USDT", preview["available_balance_after"])

    def test_trade_preview_surfaces_same_paper_risk_gate_as_execution(self) -> None:
        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 10,
                "price": 65000,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("可用余额不足", preview["blocked_reason"])

        execution_status, execution_payload = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 10,
                "price": 65000,
                "note": "oversized buy",
            },
        )
        self.assertEqual(execution_status, 409)
        self.assertEqual(execution_payload["detail"], preview["blocked_reason"])

    def test_live_trade_preview_uses_private_account_context(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.05,
                "price": 66800,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["mode"], "live")
        self.assertEqual(preview["current_position_side"], "long")
        self.assertEqual(preview["action"], "加多")
        self.assertIn("真实交易顾问式预检", " ".join(preview["warnings"]))

    def test_live_trade_preview_reports_available_balance_gap_when_private_balance_is_insufficient(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.05,
                "price": 66800,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("当前可用 0.00 USDT", preview["blocked_reason"])
        self.assertIn("当前可用保证金不足", preview["blocked_reason"])
        self.assertIn("本次委托约需 3,340.00 USDT", preview["blocked_reason"])
        self.assertIn("UNIFIED 账户可用保证金", preview["recommended_action"])

    def test_live_trade_preview_allows_perp_buy_to_reduce_short_without_extra_margin(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "0",
                "totalWalletBalance": "0",
                "totalAvailableBalance": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "0",
                        "availableToWithdraw": "0",
                    }
                ],
            },
            positions=[
                {
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "size": "0.01",
                    "avgPrice": "67000",
                    "markPrice": "66800",
                    "positionValue": "668",
                    "leverage": "1",
                    "unrealisedPnl": "2",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.01,
                "price": 66800,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])
        self.assertEqual(preview["projected_position_side"], "flat")
        self.assertEqual(preview["available_balance_before"], "0.00 USDT")
        self.assertEqual(preview["available_balance_after"], "668.00 USDT")
        self.assertEqual(preview["estimated_realized_pnl"], "+2.00 USDT")

    def test_live_trade_preview_blocks_perp_flip_only_on_incremental_margin_gap(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredEmptyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "500",
                "totalWalletBalance": "500",
                "totalAvailableBalance": "500",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "500",
                        "availableToWithdraw": "500",
                    }
                ],
            },
            positions=[
                {
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "size": "0.01",
                    "avgPrice": "67000",
                    "markPrice": "66800",
                    "positionValue": "668",
                    "leverage": "1",
                    "unrealisedPnl": "2",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.03,
                "price": 66800,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("当前可用 500.00 USDT", preview["blocked_reason"])
        self.assertIn("约需 668.00 USDT", preview["blocked_reason"])
        self.assertNotIn("2,004.00 USDT", preview["blocked_reason"])
        self.assertIn("降低委托数量", preview["recommended_action"])
        self.assertEqual(preview["projected_position_side"], "long")
        self.assertEqual(preview["projected_position_size"], "0.02")

    def test_live_trade_preview_blocks_spot_sell_when_open_orders_reserve_inventory(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            orders=[
                {
                    "orderId": "live-spot-sell-001",
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "1.8",
                    "price": "2068",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "ETHUSDT",
                "market": "spot",
                "mode": "live",
                "side": "sell",
                "quantity": 1.0,
                "price": 2068,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("扣除未成交卖单占用后最多可卖", preview["blocked_reason"])
        self.assertIn("撤销 ETHUSDT 相关未成交卖单", preview["recommended_action"])
        self.assertTrue(any("未成交卖单占用" in item for item in preview["warnings"]))

    def test_live_trade_preview_prefers_wallet_available_quantity_for_spot_sell(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "5000",
                "totalWalletBalance": "5000",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "availableToWithdraw": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "availableToWithdraw": "0.4",
                    },
                ],
            },
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "ETHUSDT",
                "market": "spot",
                "mode": "live",
                "side": "sell",
                "quantity": 1.0,
                "price": 2068,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("最多可卖 0.4", preview["blocked_reason"])
        self.assertTrue(any("钱包可用数量为 0.4" in item for item in preview["warnings"]))

    def test_live_trade_preview_prefers_wallet_transfer_balance_for_spot_sell(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "5000",
                "totalWalletBalance": "5000",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "transferBalance": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "transferBalance": "0.3",
                        "availableToWithdraw": "0.4",
                    },
                ],
            },
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "ETHUSDT",
                "market": "spot",
                "mode": "live",
                "side": "sell",
                "quantity": 0.35,
                "price": 2068,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("最多可卖 0.3", preview["blocked_reason"])
        self.assertTrue(any("钱包可用数量为 0.3" in item for item in preview["warnings"]))

    def test_live_trade_preview_rejects_private_mode_mismatch(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredDemoBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.05,
                "price": 66800,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("LIVE", preview["blocked_reason"])
        self.assertIn("DEMO", preview["blocked_reason"])

    def test_live_trade_preview_rejects_quantity_that_violates_bybit_qty_step(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.05005,
                "price": 66800,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("数量步长", preview["blocked_reason"])

    def test_live_trade_preview_rejects_price_that_violates_bybit_tick_size(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.05,
                "price": 66800.03,
                "origin": "manual",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertFalse(preview["allowed"])
        self.assertIn("价格步长", preview["blocked_reason"])

    def test_create_exchange_order_returns_private_order_record_and_audit(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=control_main.private_data)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        create_status, created_order = self._post(
            "/api/orders/exchange",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.05,
                "price": 66800,
                "note": "unit test live order",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created_order["source"], "bybit_private")
        self.assertEqual(created_order["origin"], "manual")
        self.assertIsNone(created_order["strategy_id"])
        self.assertEqual(created_order["order_id"], "live-order-created-001")
        self.assertEqual(created_order["status"], "New")

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertTrue(any(item["order_id"] == "live-order-created-001" for item in orders))

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertTrue(any(item["order_id"] == "live-order-created-001" for item in history))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "exchange_order.created")

    def test_create_exchange_order_marks_perp_reduce_only_when_manual_order_only_reduces_position(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        create_status, created_order = self._post(
            "/api/orders/exchange",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "sell",
                "quantity": 0.05,
                "price": 66800,
                "note": "unit test reduce-only live order",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(created_order["source"], "bybit_private")
        self.assertTrue(private_client.created_order_bodies)
        created_body = private_client.created_order_bodies[-1]
        self.assertEqual(created_body["side"], "Sell")
        self.assertTrue(created_body.get("reduceOnly"))

    def test_replace_exchange_order_updates_private_open_order_and_audit(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            orders=[
                {
                    "orderId": "live-open-001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.05",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        replace_status, replaced = self._post(
            "/api/orders/exchange/live-open-001/replace",
            {
                "requested_by": "unit_test",
                "quantity": 0.07,
                "price": 66720,
            },
        )
        self.assertEqual(replace_status, 200)
        self.assertEqual(replaced["order_id"], "live-open-001")
        self.assertEqual(replaced["origin"], "manual")
        self.assertEqual(replaced["qty"], "0.07")
        self.assertEqual(replaced["price"], "66720")

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["qty"], "0.07")
        self.assertEqual(orders[0]["price"].replace(",", ""), "66720.00")

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertTrue(any(item["order_id"] == "live-open-001" and item["price"].replace(",", "") == "66720.00" for item in history))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "exchange_order.replaced")

    def test_replace_exchange_order_returns_existing_order_without_amend_when_aligned(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            orders=[
                {
                    "orderId": "live-open-noop-001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.05",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        replace_status, replaced = self._post(
            "/api/orders/exchange/live-open-noop-001/replace",
            {
                "requested_by": "unit_test",
                "quantity": 0.05,
                "price": 66800,
            },
        )
        self.assertEqual(replace_status, 200)
        self.assertEqual(replaced["order_id"], "live-open-noop-001")
        self.assertEqual(replaced["qty"], "0.05")
        self.assertEqual(replaced["price"].replace(",", ""), "66800.00")
        self.assertEqual(private_client.amended_order_bodies, [])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "exchange_order.replace_noop")

    def test_replace_exchange_order_amends_reduce_only_even_when_qty_and_price_are_aligned(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            orders=[
                {
                    "orderId": "live-open-reduce-only-001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.05",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        replace_status, replaced = self._post(
            "/api/orders/exchange/live-open-reduce-only-001/replace",
            {
                "requested_by": "unit_test",
                "quantity": 0.05,
                "price": 66800,
            },
        )
        self.assertEqual(replace_status, 200)
        self.assertEqual(replaced["order_id"], "live-open-reduce-only-001")
        self.assertEqual(len(private_client.amended_order_bodies), 1)
        self.assertTrue(private_client.amended_order_bodies[-1].get("reduceOnly"))

    def test_replace_exchange_order_reuses_current_reservation_in_preview(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            orders=[
                {
                    "orderId": "live-open-002",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.05",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "buy",
                "quantity": 0.08,
                "price": 66800,
                "origin": "manual",
                "exclude_order_id": "live-open-002",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])

    def test_replace_exchange_order_reuses_current_sell_reservation_in_preview(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        private_client.fetch_positions = lambda: []
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "0",
                "totalWalletBalance": "0",
                "totalAvailableBalance": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "0",
                        "availableToWithdraw": "0",
                    }
                ],
            },
            orders=[
                {
                    "orderId": "live-open-sell-002",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.08",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "live",
                "side": "sell",
                "quantity": 0.08,
                "price": 66800,
                "origin": "manual",
                "exclude_order_id": "live-open-sell-002",
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])

    def test_replace_exchange_order_reuses_current_spot_sell_reservation_in_preview(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "5000",
                "totalWalletBalance": "5000",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "availableToWithdraw": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "availableToWithdraw": "0.4",
                    },
                ],
            },
            orders=[
                {
                    "orderId": "live-open-spot-001",
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "1.8",
                    "price": "2068",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                },
                {
                    "orderId": "live-open-spot-002",
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.2",
                    "price": "2072",
                    "orderStatus": "New",
                    "createdTime": "1774887900000",
                },
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        replace_status, replaced = self._post(
            "/api/orders/exchange/live-open-spot-001/replace",
            {
                "requested_by": "unit_test",
                "quantity": 2.2,
                "price": 2069,
            },
        )
        self.assertEqual(replace_status, 200)
        self.assertEqual(replaced["order_id"], "live-open-spot-001")
        self.assertEqual(replaced["market"], "spot")
        self.assertEqual(replaced["qty"], "2.2")
        self.assertEqual(private_client.amended_order_bodies[-1]["qty"], "2.2")

    def test_cancel_exchange_order_removes_private_open_order(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            orders=[
                {
                    "orderId": "live-open-001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.05",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        cancel_status, cancelled = self._post(
            "/api/orders/exchange/live-open-001/cancel",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(cancel_status, 200)
        self.assertEqual(cancelled["order_id"], "live-open-001")
        self.assertEqual(cancelled["status"], "Cancelled")

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(orders, [])

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertTrue(any(item["order_id"] == "live-open-001" and item["status"] == "Cancelled" for item in history))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "exchange_order.cancelled")

    def test_cancel_all_exchange_orders_clears_private_open_order_book(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            orders=[
                {
                    "orderId": "live-open-001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "orderType": "Limit",
                    "qty": "0.05",
                    "price": "66800",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                },
                {
                    "orderId": "live-open-002",
                    "symbol": "ETHUSDT",
                    "category": "spot",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "1.2",
                    "price": "2068",
                    "orderStatus": "New",
                    "createdTime": "1774887900000",
                },
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        cancel_status, result = self._post(
            "/api/orders/exchange/cancel-all",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(cancel_status, 200)
        self.assertEqual(result["cancelled_count"], 2)
        self.assertEqual(set(result["cancelled_order_ids"]), {"live-open-001", "live-open-002"})

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(orders, [])

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertTrue(any(item["order_id"] == "live-open-001" and item["status"] == "Cancelled" for item in history))
        self.assertTrue(any(item["order_id"] == "live-open-002" and item["status"] == "Cancelled" for item in history))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "exchange_order.cancelled_all")

    def test_cancel_all_exchange_orders_preserves_strategy_origin_in_history(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        control_main.private_data = StubConfiguredTradingBybitPrivateClient()
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=control_main.private_data,
            orders=[
                {
                    "orderId": "live-open-strategy-001",
                    "orderLinkId": "strategy-live-abc001",
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Sell",
                    "orderType": "Limit",
                    "qty": "0.03",
                    "price": "67100",
                    "orderStatus": "New",
                    "createdTime": "1774887600000",
                }
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        cancel_status, payload = self._post(
            "/api/orders/exchange/cancel-all",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(cancel_status, 200)
        self.assertEqual(payload["cancelled_count"], 1)

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        cancelled = next((item for item in history if item["order_id"] == "live-open-strategy-001"), None)
        self.assertIsNotNone(cancelled)
        self.assertEqual(cancelled["origin"], "strategy")

    def test_close_exchange_position_submits_reduce_only_order_for_perp(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        close_status, order = self._post(
            "/api/account/exchange/positions/BTCUSDT/close",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 200)
        self.assertEqual(order["symbol"], "BTCUSDT")
        self.assertEqual(order["origin"], "manual")
        self.assertEqual(order["side"], "sell")

        self.assertTrue(private_client.created_order_bodies)
        created_body = private_client.created_order_bodies[-1]
        self.assertEqual(created_body["symbol"], "BTCUSDT")
        self.assertEqual(created_body["side"], "Sell")
        self.assertTrue(created_body.get("reduceOnly"))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "exchange_position.close_submitted")

    def test_close_exchange_position_blocks_spot_when_wallet_available_is_insufficient(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "5000",
                "totalWalletBalance": "5000",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "availableToWithdraw": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "availableToWithdraw": "0.4",
                    },
                ],
            },
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        close_status, payload = self._post(
            "/api/account/exchange/positions/ETHUSDT/close",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 409)
        self.assertIn("请先撤销相关挂单后再平仓", payload["detail"])
        self.assertEqual(private_client.created_order_bodies, [])

    def test_close_exchange_position_uses_wallet_derived_spot_position_when_private_position_list_has_no_spot_entry(self) -> None:
        class StubWalletSpotOnlyBybitPrivateClient(StubConfiguredTradingBybitPrivateClient):
            def fetch_positions(self) -> list[Dict[str, Any]]:
                return [
                    {
                        "symbol": "BTCUSDT",
                        "category": "linear",
                        "side": "Buy",
                        "size": "0.15",
                        "avgPrice": "66500",
                        "markPrice": "66800",
                        "positionValue": "10020",
                        "leverage": "2",
                        "unrealisedPnl": "45.5",
                    }
                ]

        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubWalletSpotOnlyBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "9355",
                "totalWalletBalance": "9355",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "availableToWithdraw": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "availableToWithdraw": "2.5",
                    },
                ],
            },
            positions=[],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        close_status, order = self._post(
            "/api/account/exchange/positions/ETHUSDT/close",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 200)
        self.assertEqual(order["symbol"], "ETHUSDT")
        self.assertEqual(order["market"], "spot")
        self.assertEqual(order["side"], "sell")
        self.assertTrue(any(body.get("symbol") == "ETHUSDT" and body.get("category") == "spot" for body in private_client.created_order_bodies))
        self.assertTrue(all("reduceOnly" not in body for body in private_client.created_order_bodies))

    def test_close_exchange_position_blocks_when_symbol_exists_in_multiple_markets(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            positions=[
                {
                    "symbol": "BTCUSDT",
                    "category": "linear",
                    "side": "Buy",
                    "size": "0.15",
                    "avgPrice": "66500",
                    "markPrice": "66800",
                    "positionValue": "10020",
                    "leverage": "2",
                    "unrealisedPnl": "45.5",
                },
                {
                    "symbol": "BTCUSDT",
                    "category": "spot",
                    "side": "Buy",
                    "size": "0.8",
                    "avgPrice": "66200",
                    "markPrice": "66800",
                    "positionValue": "53440",
                    "leverage": "1",
                    "unrealisedPnl": "480",
                },
            ],
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        close_status, payload = self._post(
            "/api/account/exchange/positions/BTCUSDT/close",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 409)
        self.assertIn("多个市场持仓", payload["detail"])
        self.assertEqual(private_client.created_order_bodies, [])

    def test_close_all_exchange_positions_submits_orders_for_all_positions(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        close_status, payload = self._post(
            "/api/account/exchange/positions/close-all",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 200)
        self.assertEqual(payload["submitted_count"], 2)
        self.assertEqual(len(payload["order_ids"]), 2)
        self.assertEqual(len(private_client.created_order_bodies), 2)
        self.assertTrue(any(body.get("reduceOnly") for body in private_client.created_order_bodies))
        self.assertTrue(any(body.get("symbol") == "ETHUSDT" and "reduceOnly" not in body for body in private_client.created_order_bodies))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertEqual(audit_events[0]["event_type"], "exchange_position.close_all_submitted")

    def test_close_all_exchange_positions_blocks_without_partial_submit_when_any_position_is_uncloseable(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(
            client=private_client,
            wallet={
                "accountType": "UNIFIED",
                "totalEquity": "5000",
                "totalWalletBalance": "5000",
                "totalAvailableBalance": "4200",
                "totalPerpUPL": "0",
                "coin": [
                    {
                        "coin": "USDT",
                        "walletBalance": "4200",
                        "usdValue": "4200",
                        "availableToWithdraw": "4200",
                    },
                    {
                        "coin": "ETH",
                        "walletBalance": "2.5",
                        "usdValue": "5155",
                        "availableToWithdraw": "0.4",
                    },
                ],
            },
            connected=True,
            authenticated=True,
        )
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        close_status, payload = self._post(
            "/api/account/exchange/positions/close-all",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 409)
        self.assertIn("请先撤销相关挂单后再平仓", payload["detail"])
        self.assertEqual(private_client.created_order_bodies, [])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertFalse(any(item["event_type"] == "exchange_position.close_all_submitted" for item in audit_events))

    def test_manual_trade_respects_paper_risk_gate(self) -> None:
        oversized_status, oversized_payload = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 10,
                "price": 65000,
                "note": "oversized buy",
            },
        )
        self.assertEqual(oversized_status, 409)
        self.assertIn("可用余额不足", oversized_payload["detail"])

        spot_short_status, spot_short_payload = self._post(
            "/api/trades/manual",
            {
                "symbol": "SOLUSDT",
                "market": "spot",
                "mode": "paper",
                "side": "sell",
                "quantity": 1,
                "price": 84,
                "note": "spot short",
            },
        )
        self.assertEqual(spot_short_status, 409)
        self.assertIn("可卖数量不足", spot_short_payload["detail"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        risk_events = [item for item in audit_events if item["event_type"] == "risk.blocked_order"]
        self.assertGreaterEqual(len(risk_events), 2)

    def test_paper_order_history_includes_manual_and_strategy_records(self) -> None:
        history_status, history_orders = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertTrue(any(item["symbol"] == "ETHUSDT" for item in history_orders))

        create_status, created_trade = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0.5,
                "price": 65000,
                "note": "history test",
            },
        )
        self.assertEqual(create_status, 200)

        refreshed_status, refreshed_history = self._get("/api/account/order-history")
        self.assertEqual(refreshed_status, 200)
        self.assertEqual(refreshed_history[0]["source"], "paper")
        self.assertEqual(refreshed_history[0]["symbol"], created_trade["symbol"])

    def test_paper_close_trade_updates_realized_pnl_and_trade_record(self) -> None:
        create_status, created_trade = self._post(
            "/api/trades/manual",
            {
                "symbol": "ETHUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "sell",
                "quantity": 10,
                "price": 4900,
                "note": "close partial eth long",
            },
        )
        self.assertEqual(create_status, 200)

        trades_status, trades = self._get("/api/trades")
        self.assertEqual(trades_status, 200)
        latest_trade = next((item for item in trades if item["id"] == created_trade["id"]), None)
        self.assertIsNotNone(latest_trade)
        assert latest_trade is not None
        self.assertEqual(latest_trade["pnl"], "+1,018.00 USDT")

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertEqual(snapshot["today_performance"]["realized_pnl"], "+1,018.00 USDT")
        self.assertEqual(snapshot["today_performance"]["win_rate"], "100.0%")

    def test_close_paper_position_endpoint_flattens_position(self) -> None:
        close_status, close_trade = self._post(
            "/api/account/paper/positions/ETHUSDT/close",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 200)
        self.assertEqual(close_trade["symbol"], "ETHUSDT")
        self.assertEqual(close_trade["side"], "sell")
        self.assertEqual(close_trade["quantity"], 22)

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        self.assertEqual(positions, [])

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["positions_count"], 0)

        mode_update_status, _ = self._post(
            "/api/workspace/preferences",
            {
                "active_section": "trades",
                "layout_preset": "balanced",
                "selected_mode": "live",
                "selected_symbol": "BTCUSDT",
                "selected_market_timeframe": "1h",
                "selected_strategy_id": "trend-btc-01",
                "overview_card_order": ["ai_center", "strategy_watch", "account_center"],
                "overview_visible_cards": ["ai_center", "strategy_watch", "account_center"],
                "overview_collapsed_cards": [],
            },
        )
        self.assertEqual(mode_update_status, 200)

        rejected_status, rejected_payload = self._post(
            "/api/account/paper/positions/BTCUSDT/close",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(rejected_status, 409)
        self.assertIn("仅允许在 Paper 模式", rejected_payload["detail"])

    def test_close_all_paper_positions_endpoint_flattens_everything(self) -> None:
        create_status, _ = self._post(
            "/api/trades/manual",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0.4,
                "price": 65000,
                "note": "prepare second position",
            },
        )
        self.assertEqual(create_status, 200)

        close_status, result = self._post(
            "/api/account/paper/positions/close-all",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(close_status, 200)
        self.assertGreaterEqual(result["closed_count"], 1)

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        self.assertEqual(positions, [])

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["positions_count"], 0)

    def test_create_paper_order_enters_open_orders_and_reserves_balance(self) -> None:
        before_status, before_overview = self._get("/api/account/overview")
        self.assertEqual(before_status, 200)

        create_status, order = self._post(
            "/api/account/paper/orders",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 1.0,
                "price": 85000,
                "note": "resting order",
            },
        )
        self.assertEqual(create_status, 200)
        self.assertEqual(order["source"], "paper")
        self.assertEqual(order["status"], "New")

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(len(orders), 1)
        self.assertEqual(orders[0]["order_id"], order["order_id"])

        after_status, after_overview = self._get("/api/account/overview")
        self.assertEqual(after_status, 200)
        self.assertEqual(after_overview["open_orders_count"], 1)
        self.assertNotEqual(after_overview["total_available_balance"], before_overview["total_available_balance"])

    def test_paper_order_auto_fills_when_price_crosses(self) -> None:
        create_status, order = self._post(
            "/api/account/paper/orders",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0.6,
                "price": 85000,
                "note": "resting fill",
            },
        )
        self.assertEqual(create_status, 200)

        for item in control_main.repo.state.watchlist:
            if item.symbol == "BTCUSDT":
                item.last_price = 84950
        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(orders, [])

        trades_status, trades = self._get("/api/trades")
        self.assertEqual(trades_status, 200)
        filled_trade = next((item for item in trades if item["symbol"] == "BTCUSDT" and item["price"] == 85000), None)
        self.assertIsNotNone(filled_trade)

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        filled_order = next((item for item in history if item["order_id"] == order["order_id"]), None)
        self.assertIsNotNone(filled_order)
        assert filled_order is not None
        self.assertEqual(filled_order["status"], "Filled")

    def test_cancel_paper_order_moves_it_to_history(self) -> None:
        create_status, order = self._post(
            "/api/account/paper/orders",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0.7,
                "price": 84000,
                "note": "cancel me",
            },
        )
        self.assertEqual(create_status, 200)

        cancel_status, cancelled = self._post(
            f"/api/account/paper/orders/{order['order_id']}/cancel",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(cancel_status, 200)
        self.assertEqual(cancelled["status"], "Cancelled")

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(orders, [])

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        history_item = next((item for item in history if item["order_id"] == order["order_id"]), None)
        self.assertIsNotNone(history_item)
        assert history_item is not None
        self.assertEqual(history_item["status"], "Cancelled")

    def test_replace_paper_order_updates_reservations_and_price(self) -> None:
        create_status, order = self._post(
            "/api/account/paper/orders",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0.5,
                "price": 82000,
                "note": "replace me",
            },
        )
        self.assertEqual(create_status, 200)

        before_status, before_overview = self._get("/api/account/overview")
        self.assertEqual(before_status, 200)

        replace_status, replaced = self._post(
            f"/api/account/paper/orders/{order['order_id']}/replace",
            {
                "quantity": 0.8,
                "price": 83500,
                "requested_by": "unit_test",
            },
        )
        self.assertEqual(replace_status, 200)
        self.assertEqual(replaced["price"], "83,500")
        self.assertEqual(replaced["qty"], "0.8")

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(orders[0]["order_id"], order["order_id"])
        self.assertEqual(orders[0]["price"], "83,500")
        self.assertEqual(orders[0]["qty"], "0.8")

        after_status, after_overview = self._get("/api/account/overview")
        self.assertEqual(after_status, 200)
        self.assertNotEqual(after_overview["total_available_balance"], before_overview["total_available_balance"])

    def test_replace_paper_order_uses_excluded_reservation_when_rechecking_risk(self) -> None:
        create_status, order = self._post(
            "/api/account/paper/orders",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 1.0,
                "price": 80000,
                "note": "reserve then replace",
            },
        )
        self.assertEqual(create_status, 200)

        replace_status, replaced = self._post(
            f"/api/account/paper/orders/{order['order_id']}/replace",
            {
                "quantity": 1.0,
                "price": 81000,
                "requested_by": "unit_test",
            },
        )
        self.assertEqual(replace_status, 200)
        self.assertEqual(replaced["price"], "81,000")

        preview_status, preview = self._post(
            "/api/trades/preview",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 1.0,
                "price": 81000,
                "origin": "manual",
                "exclude_order_id": order["order_id"],
            },
        )
        self.assertEqual(preview_status, 200)
        self.assertTrue(preview["allowed"])

    def test_cancel_all_paper_orders_clears_open_order_book(self) -> None:
        first_status, first_order = self._post(
            "/api/account/paper/orders",
            {
                "symbol": "BTCUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 0.4,
                "price": 82000,
                "note": "bulk cancel 1",
            },
        )
        second_status, second_order = self._post(
            "/api/account/paper/orders",
            {
                "symbol": "ETHUSDT",
                "market": "perp",
                "mode": "paper",
                "side": "buy",
                "quantity": 2.5,
                "price": 2000,
                "note": "bulk cancel 2",
            },
        )
        self.assertEqual(first_status, 200)
        self.assertEqual(second_status, 200)

        cancel_status, result = self._post(
            "/api/account/paper/orders/cancel-all",
            {"requested_by": "unit_test"},
        )
        self.assertEqual(cancel_status, 200)
        self.assertEqual(result["cancelled_count"], 2)
        self.assertIn(first_order["order_id"], result["cancelled_order_ids"])
        self.assertIn(second_order["order_id"], result["cancelled_order_ids"])

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertEqual(orders, [])

        history_status, history = self._get("/api/account/order-history")
        self.assertEqual(history_status, 200)
        self.assertTrue(any(item["order_id"] == first_order["order_id"] and item["status"] == "Cancelled" for item in history))
        self.assertTrue(any(item["order_id"] == second_order["order_id"] and item["status"] == "Cancelled" for item in history))

    def test_control_snapshot_surfaces_runtime_worker_issue(self) -> None:
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": None,
                "last_error": "runtime boom",
            }
        )

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertTrue(snapshot["execution_health"]["runtime_worker_issue"])
        self.assertEqual(snapshot["execution_health"]["runtime_last_error"], "runtime boom")
        self.assertEqual(snapshot["execution_health"]["top_issue"], "运行线程异常")
        self.assertEqual(snapshot["execution_health"]["top_issue_detail"], "后台策略运行线程最近一次报错：runtime boom")
        self.assertIn("恢复运行线程", snapshot["execution_health"]["top_issue_recommended_action"])
        self.assertEqual(snapshot["strategy_metrics"][0]["delta"], "运行线程异常")
        self.assertEqual(snapshot["strategy_metrics"][0]["tone"], "critical")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        issue_alert = next((item for item in alerts if item["title"] == "策略运行线程异常" and not item["acknowledged"]), None)
        self.assertIsNotNone(issue_alert)

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_runtime_worker_running"), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_runtime_worker_running gauge"), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_runtime_worker_error"), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_runtime_worker_error gauge"), 1)
        self.assertIn("bybit_control_strategy_runtime_worker_running 0", metrics_body)
        self.assertIn("bybit_control_strategy_runtime_worker_error 1", metrics_body)

        ops_status, ops = self._get("/api/ops/live")
        self.assertEqual(ops_status, 200)
        self.assertEqual(ops["summary"]["execution_top_issue"], "运行线程异常")
        self.assertEqual(ops["summary"]["execution_top_issue_detail"], "后台策略运行线程最近一次报错：runtime boom")
        self.assertEqual(ops["summary"]["execution_issue_total"], 1)

    def test_control_snapshot_surfaces_runtime_worker_stale(self) -> None:
        control_main.strategy_runtime_thread = StubAliveThread()
        control_main.strategy_runtime_state.update(
            {
                "running": True,
                "last_refresh_at": (datetime.now(timezone.utc).astimezone() - timedelta(seconds=95)).isoformat(),
                "last_error": None,
            }
        )

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertTrue(snapshot["execution_health"]["runtime_worker_running"])
        self.assertTrue(snapshot["execution_health"]["runtime_worker_issue"])
        self.assertTrue(snapshot["execution_health"]["runtime_worker_stale"])
        self.assertGreaterEqual(snapshot["execution_health"]["runtime_stale_seconds"], 90)
        self.assertEqual(snapshot["execution_health"]["top_issue"], "运行线程停滞")
        self.assertEqual(snapshot["strategy_metrics"][0]["delta"], "运行线程停滞")
        self.assertEqual(snapshot["strategy_metrics"][0]["tone"], "critical")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        stale_alert = next((item for item in alerts if item["title"] == "策略运行线程停滞" and not item["acknowledged"]), None)
        self.assertIsNotNone(stale_alert)

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_runtime_worker_stale"), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_runtime_worker_stale gauge"), 1)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_runtime_stale_seconds"), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_runtime_stale_seconds gauge"), 1)
        self.assertIn("bybit_control_strategy_runtime_worker_stale 1", metrics_body)

        ops_status, ops = self._get("/api/ops/live")
        self.assertEqual(ops_status, 200)
        self.assertEqual(ops["summary"]["execution_top_issue"], "运行线程停滞")
        self.assertEqual(ops["summary"]["execution_issue_total"], 1)

    def test_control_snapshot_surfaces_runtime_worker_stopped(self) -> None:
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": datetime.now(timezone.utc).astimezone().isoformat(),
                "last_error": None,
                "started_once": True,
            }
        )

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertFalse(snapshot["execution_health"]["runtime_worker_running"])
        self.assertTrue(snapshot["execution_health"]["runtime_worker_issue"])
        self.assertTrue(snapshot["execution_health"]["runtime_worker_stopped"])
        self.assertEqual(snapshot["execution_health"]["top_issue"], "运行线程未运行")
        self.assertEqual(snapshot["strategy_metrics"][0]["delta"], "运行线程未运行")
        self.assertEqual(snapshot["strategy_metrics"][0]["tone"], "critical")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        stopped_alert = next((item for item in alerts if item["title"] == "策略运行线程未运行" and not item["acknowledged"]), None)
        self.assertIsNotNone(stopped_alert)

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertEqual(metrics_body.count("# HELP bybit_control_strategy_runtime_worker_stopped"), 1)
        self.assertEqual(metrics_body.count("# TYPE bybit_control_strategy_runtime_worker_stopped gauge"), 1)
        self.assertIn("bybit_control_strategy_runtime_worker_stopped 1", metrics_body)

        ops_status, ops = self._get("/api/ops/live")
        self.assertEqual(ops_status, 200)
        self.assertEqual(ops["summary"]["execution_top_issue"], "运行线程未运行")
        self.assertEqual(ops["summary"]["execution_issue_total"], 1)

        runtime_status, runtime_payload = self._get("/api/runtime/strategy-worker/status")
        self.assertEqual(runtime_status, 200)
        self.assertFalse(runtime_payload["running"])
        self.assertTrue(runtime_payload["started_once"])
        self.assertTrue(runtime_payload["stopped"])
        self.assertEqual(runtime_payload["top_issue"], "运行线程未运行")
        self.assertIn("恢复运行线程", runtime_payload["recommended_action"])

    def test_control_snapshot_promotes_private_execution_channel_alert_and_resolves_after_recovery(self) -> None:
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=False, authenticated=False)
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertTrue(snapshot["execution_health"]["private_execution_channel_issue"])
        self.assertEqual(snapshot["execution_health"]["top_issue"], "私有链路异常")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        issue_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "") == "private-execution-channel:live"),
            None,
        )
        self.assertIsNotNone(issue_alert)
        assert issue_alert is not None
        self.assertIn("私有 WS", issue_alert["description"])

        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)

        recovered_status, recovered_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(recovered_status, 200)
        self.assertFalse(recovered_snapshot["execution_health"]["private_execution_channel_issue"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        active_issue_alert = next(
            (
                item
                for item in alerts
                if str(item.get("rule_key") or "") == "private-execution-channel:live" and not item["acknowledged"]
            ),
            None,
        )
        self.assertIsNone(active_issue_alert)
        resolved_issue_alert = next(
            (item for item in alerts if str(item.get("rule_key") or "") == "private-execution-channel:live"),
            None,
        )
        self.assertIsNotNone(resolved_issue_alert)
        assert resolved_issue_alert is not None
        self.assertTrue(resolved_issue_alert["acknowledged"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        resolved_event = next((item for item in audit_events if item["event_type"] == "private.execution.channel.resolved"), None)
        self.assertIsNotNone(resolved_event)

    def test_control_snapshot_surfaces_public_execution_channel_stale_issue(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=True,
            ticker_symbols=["BTCUSDT"],
            symbol_last_message_at={"BTCUSDT": "2026-03-29T08:00:00+08:00"},
            last_message_at_linear="2026-03-29T08:00:00+08:00",
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.market_data = market_client
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertTrue(snapshot["execution_health"]["public_execution_channel_issue"])
        self.assertTrue(snapshot["execution_health"]["public_execution_stale"])
        self.assertGreater(snapshot["execution_health"]["public_execution_stale_seconds"], 0)
        self.assertEqual(snapshot["execution_health"]["top_issue"], "公有链路失活")
        self.assertEqual(snapshot["execution_health"]["top_issue_strategy_id"], "trend-btc-01")
        self.assertIn("公共 WS", snapshot["execution_health"]["top_issue_detail"])

        metrics_status, metrics_body = self._get_text("/metrics")
        self.assertEqual(metrics_status, 200)
        self.assertIn('bybit_control_public_ws_stale{channel="linear"} 1', metrics_body)
        self.assertIn('bybit_control_strategy_issue_total{issue="public_execution_channel_issue"} 1', metrics_body)

    def test_control_snapshot_surfaces_public_execution_channel_transport_error_detail(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=False,
            ticker_symbols=[],
            last_error="EOF occurred in violation of protocol (_ssl.c:1129)",
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.market_data = market_client
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertTrue(snapshot["execution_health"]["public_execution_channel_issue"])
        self.assertIn("公共 WS", snapshot["execution_health"]["top_issue_detail"])
        self.assertIn("EOF occurred in violation of protocol", snapshot["execution_health"]["top_issue_detail"])
        self.assertIn("REST 已可达", snapshot["execution_health"]["top_issue_recommended_action"])

        public_status_code, public_status = self._get("/api/integrations/bybit-public")
        self.assertEqual(public_status_code, 200)
        self.assertEqual(public_status["last_error"], "EOF occurred in violation of protocol (_ssl.c:1129)")
        self.assertTrue(public_status["rest_reachable"])
        self.assertIn("REST 已可达", public_status["recommended_action"])
        btc_diag = next((item for item in public_status["watched_symbol_diagnostics"] if item["symbol"] == "BTCUSDT"), None)
        self.assertIsNotNone(btc_diag)
        assert btc_diag is not None
        self.assertIn("EOF occurred in violation of protocol", btc_diag["issue"])
        self.assertIn("REST 已可达", btc_diag["recommended_action"])

    def test_control_snapshot_promotes_public_execution_channel_alert_and_resolves_after_recovery(self) -> None:
        original_market = control_main.market_data
        original_private = control_main.private_data
        original_realtime = control_main.private_realtime
        candles = [
            CandlePoint(
                time=f"2026-03-29T{hour:02d}:00:00+08:00",
                open=66200.0 + hour * 90,
                high=66280.0 + hour * 90,
                low=66140.0 + hour * 90,
                close=66240.0 + hour * 90,
                volume=1800.0 + hour * 25,
            )
            for hour in range(24)
        ]
        market_client = StubStrategyRuntimeMarketClient(
            symbol="BTCUSDT",
            price=68450.0,
            change_24h=3.9,
            candles=candles,
        )
        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=True,
            ticker_symbols=["BTCUSDT"],
            symbol_last_message_at={"BTCUSDT": "2026-03-29T08:00:00+08:00"},
            last_message_at_linear="2026-03-29T08:00:00+08:00",
        )
        private_client = StubConfiguredTradingBybitPrivateClient()
        control_main.market_data = market_client
        control_main.private_data = private_client
        control_main.private_realtime = StubBybitPrivateRealtimeClient(client=private_client, connected=True, authenticated=True)
        self.addCleanup(lambda: setattr(control_main, "market_data", original_market))
        self.addCleanup(lambda: setattr(control_main, "private_data", original_private))
        self.addCleanup(lambda: setattr(control_main, "private_realtime", original_realtime))
        control_main.repo.state.workspace_preferences.selected_mode = AccountMode.LIVE
        control_main.repo.state.control_snapshot.scheduler.current_mode = AccountMode.LIVE

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertTrue(snapshot["execution_health"]["public_execution_channel_issue"])
        self.assertEqual(snapshot["execution_health"]["top_issue"], "公有链路失活")

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        issue_alert = next(
            (
                item
                for item in alerts
                if str(item.get("rule_key") or "") == "public-execution-channel:trend-btc-01:live"
            ),
            None,
        )
        self.assertIsNotNone(issue_alert)
        assert issue_alert is not None
        self.assertIn("公共 WS", issue_alert["description"])

        market_client.realtime = StubPublicExecutionRealtimeFeed(
            connected_linear=True,
            ticker_symbols=["BTCUSDT"],
            symbol_last_message_at={"BTCUSDT": datetime.now(timezone.utc).astimezone().isoformat()},
            last_message_at_linear=datetime.now(timezone.utc).astimezone().isoformat(),
        )

        recovered_status, recovered_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(recovered_status, 200)
        self.assertFalse(recovered_snapshot["execution_health"]["public_execution_channel_issue"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        active_issue_alert = next(
            (
                item
                for item in alerts
                if str(item.get("rule_key") or "") == "public-execution-channel:trend-btc-01:live"
                and not item["acknowledged"]
            ),
            None,
        )
        self.assertIsNone(active_issue_alert)
        resolved_issue_alert = next(
            (
                item
                for item in alerts
                if str(item.get("rule_key") or "") == "public-execution-channel:trend-btc-01:live"
            ),
            None,
        )
        self.assertIsNotNone(resolved_issue_alert)
        assert resolved_issue_alert is not None
        self.assertTrue(resolved_issue_alert["acknowledged"])

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        resolved_event = next((item for item in audit_events if item["event_type"] == "public.execution.channel.resolved"), None)
        self.assertIsNotNone(resolved_event)

    def test_restart_strategy_runtime_worker_endpoint_clears_error_and_starts_loop(self) -> None:
        original_refresh = control_main.refresh_strategy_runtime_once

        def stub_refresh_strategy_runtime_once(auto_dispatch: bool = False) -> list[Any]:
            control_main.strategy_runtime_state["last_refresh_at"] = datetime.now(timezone.utc).astimezone().isoformat()
            control_main.strategy_runtime_state["last_error"] = None
            return []

        control_main.refresh_strategy_runtime_once = stub_refresh_strategy_runtime_once
        self.addCleanup(setattr, control_main, "refresh_strategy_runtime_once", original_refresh)
        control_main.strategy_runtime_state.update(
            {
                "running": False,
                "last_refresh_at": None,
                "last_error": "runtime boom",
            }
        )
        initial_snapshot_status, _initial_snapshot = self._get("/api/control/snapshot")
        self.assertEqual(initial_snapshot_status, 200)

        restart_status, restart_result = self._post(
            "/api/runtime/strategy-worker/restart",
            {
                "requested_by": "unit_test",
                "reason": "恢复后台运行线程",
            },
        )
        self.assertEqual(restart_status, 200)
        self.assertTrue(restart_result["running"])

        deadline = time.time() + 2
        while time.time() < deadline and control_main.strategy_runtime_state.get("last_refresh_at") is None:
            time.sleep(0.05)

        self.assertIsNone(control_main.strategy_runtime_state.get("last_error"))
        self.assertIsNotNone(control_main.strategy_runtime_state.get("last_refresh_at"))

        snapshot_status, snapshot = self._get("/api/control/snapshot")
        self.assertEqual(snapshot_status, 200)
        self.assertTrue(snapshot["execution_health"]["runtime_worker_running"])
        self.assertFalse(snapshot["execution_health"]["runtime_worker_issue"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertFalse(any(item["title"] == "策略运行线程异常" and not item["acknowledged"] for item in alerts))
        self.assertFalse(any(item["title"] == "策略运行线程未运行" and not item["acknowledged"] for item in alerts))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.runtime.worker.restarted" for item in audit_events))
        self.assertTrue(any(item["event_type"] == "strategy.runtime.worker.issue_resolved" for item in audit_events))

    def test_restart_strategy_runtime_worker_endpoint_surfaces_restart_failure_alert(self) -> None:
        original_stop = control_main._stop_strategy_runtime_worker
        control_main._stop_strategy_runtime_worker = lambda timeout=3.0: False
        self.addCleanup(setattr, control_main, "_stop_strategy_runtime_worker", original_stop)

        restart_status, restart_result = self._post(
            "/api/runtime/strategy-worker/restart",
            {
                "requested_by": "unit_test",
                "reason": "模拟线程无法停止",
            },
        )
        self.assertEqual(restart_status, 409)
        self.assertIn("未能在超时时间内停止", restart_result["detail"])

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        restart_failed_alert = next((item for item in alerts if item["title"] == "恢复运行线程失败" and not item["acknowledged"]), None)
        self.assertIsNotNone(restart_failed_alert)
        self.assertEqual(restart_failed_alert["severity"], "P1")

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.runtime.worker.restart_failed" for item in audit_events))

    def test_restart_strategy_runtime_worker_success_resolves_restart_failure_alert(self) -> None:
        original_refresh = control_main.refresh_strategy_runtime_once
        original_stop = control_main._stop_strategy_runtime_worker

        def stub_refresh_strategy_runtime_once(auto_dispatch: bool = False) -> list[Any]:
            control_main.strategy_runtime_state["last_refresh_at"] = datetime.now(timezone.utc).astimezone().isoformat()
            control_main.strategy_runtime_state["last_error"] = None
            return []

        control_main.refresh_strategy_runtime_once = stub_refresh_strategy_runtime_once
        self.addCleanup(setattr, control_main, "refresh_strategy_runtime_once", original_refresh)

        control_main._stop_strategy_runtime_worker = lambda timeout=3.0: False
        failed_status, _failed_result = self._post(
            "/api/runtime/strategy-worker/restart",
            {
                "requested_by": "unit_test",
                "reason": "先制造一次恢复失败",
            },
        )
        self.assertEqual(failed_status, 409)

        control_main._stop_strategy_runtime_worker = original_stop
        self.addCleanup(setattr, control_main, "_stop_strategy_runtime_worker", original_stop)

        restart_status, restart_result = self._post(
            "/api/runtime/strategy-worker/restart",
            {
                "requested_by": "unit_test",
                "reason": "再次恢复后台运行线程",
            },
        )
        self.assertEqual(restart_status, 200)
        self.assertTrue(restart_result["running"])

        deadline = time.time() + 2
        while time.time() < deadline and control_main.strategy_runtime_state.get("last_refresh_at") is None:
            time.sleep(0.05)

        alerts_status, alerts = self._get("/api/alerts")
        self.assertEqual(alerts_status, 200)
        self.assertFalse(any(item["title"] == "恢复运行线程失败" and not item["acknowledged"] for item in alerts))

        audit_status, audit_events = self._get("/api/audit/events")
        self.assertEqual(audit_status, 200)
        self.assertTrue(any(item["event_type"] == "strategy.runtime.worker.restart_failed_resolved" for item in audit_events))


class StrategyChangeReviewResponseUnitTests(unittest.TestCase):
    def test_parses_structured_json_payload(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "参数更新方向合理，但缺少回测对照",'
            ' "verdict": "request_changes",'
            ' "confidence": "medium",'
            ' "highlights": ["参数与当前趋势一致", "风险敞口未显著扩大"],'
            ' "risks": ["缺少对比回测", "未覆盖极端行情"],'
            ' "required_adjustments": ["补充对照回测", "增加最大回撤护栏"]}'
        )
        parsed = OpenClawGatewayClient.parse_strategy_change_review_response(raw)
        self.assertEqual(parsed["summary"], "参数更新方向合理，但缺少回测对照")
        self.assertEqual(parsed["verdict"], "request_changes")
        self.assertEqual(parsed["confidence"], "medium")
        self.assertEqual(parsed["highlights"], ["参数与当前趋势一致", "风险敞口未显著扩大"])
        self.assertEqual(parsed["risks"], ["缺少对比回测", "未覆盖极端行情"])
        self.assertEqual(
            parsed["required_adjustments"],
            ["补充对照回测", "增加最大回撤护栏"],
        )
        self.assertEqual(parsed["raw_text"], raw)

    def test_parses_json_from_fenced_code_block(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            "Here is the review:\n"
            "```json\n"
            '{"summary": "变更已通过", "verdict": "approve",'
            ' "confidence": "high", "highlights": ["逻辑清晰"],'
            ' "risks": [], "required_adjustments": []}\n'
            "```"
        )
        parsed = OpenClawGatewayClient.parse_strategy_change_review_response(raw)
        self.assertEqual(parsed["verdict"], "approve")
        self.assertEqual(parsed["confidence"], "high")
        self.assertEqual(parsed["summary"], "变更已通过")
        self.assertEqual(parsed["highlights"], ["逻辑清晰"])
        self.assertEqual(parsed["risks"], [])
        self.assertEqual(parsed["required_adjustments"], [])

    def test_coerces_chinese_verdict_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        approve_raw = '{"summary": "方案可行", "verdict": "通过"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(approve_raw)["verdict"],
            "approve",
        )

        needs_raw = '{"summary": "需要调整", "verdict": "待调整"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(needs_raw)["verdict"],
            "request_changes",
        )

        reject_raw = '{"summary": "不建议上线", "verdict": "拒绝"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(reject_raw)["verdict"],
            "reject",
        )

        english_hyphen_raw = '{"summary": "fix first", "verdict": "needs-changes"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(english_hyphen_raw)["verdict"],
            "request_changes",
        )

        blocked_raw = '{"summary": "blocked", "verdict": "blocked"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(blocked_raw)["verdict"],
            "reject",
        )

    def test_falls_back_to_heuristic_when_not_json(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = "建议补充一次对照回测后再落地此变更。"
        parsed = OpenClawGatewayClient.parse_strategy_change_review_response(raw)
        self.assertEqual(parsed["summary"], raw)
        # Plain-text falls back to the conservative defaults.
        self.assertEqual(parsed["verdict"], "request_changes")
        self.assertEqual(parsed["confidence"], "medium")
        self.assertEqual(parsed["highlights"], [])
        self.assertEqual(parsed["risks"], [])
        self.assertEqual(parsed["required_adjustments"], [])
        self.assertEqual(parsed["raw_text"], raw)

    def test_returns_defaults_on_empty_input(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed_none = OpenClawGatewayClient.parse_strategy_change_review_response(None)
        self.assertEqual(parsed_none["summary"], "")
        self.assertEqual(parsed_none["verdict"], "request_changes")
        self.assertEqual(parsed_none["confidence"], "medium")
        self.assertEqual(parsed_none["highlights"], [])
        self.assertEqual(parsed_none["risks"], [])
        self.assertEqual(parsed_none["required_adjustments"], [])
        self.assertEqual(parsed_none["raw_text"], "")

        parsed_blank = OpenClawGatewayClient.parse_strategy_change_review_response("   \n  ")
        self.assertEqual(parsed_blank["summary"], "")
        self.assertEqual(parsed_blank["verdict"], "request_changes")
        self.assertEqual(parsed_blank["confidence"], "medium")

    def test_coerces_confidence_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        low_raw = '{"summary": "需更多信息", "verdict": "request_changes", "confidence": "低"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(low_raw)["confidence"],
            "low",
        )

        high_raw = '{"summary": "完全同意", "verdict": "approve", "confidence": "高"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(high_raw)["confidence"],
            "high",
        )

        mid_raw = '{"summary": "基本可行", "verdict": "approve", "confidence": "mid"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(mid_raw)["confidence"],
            "medium",
        )

        unknown_raw = '{"summary": "不确定", "verdict": "approve", "confidence": "unspecified"}'
        # Unknown confidence degrades to the default ``medium``.
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_change_review_response(unknown_raw)["confidence"],
            "medium",
        )

    def test_accepts_newline_separated_lists(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "方向正确，但需完善风控",'
            ' "verdict": "request_changes",'
            ' "confidence": "medium",'
            ' "highlights": "参数方向合理\\n风险敞口可控",'
            ' "risks": "- 缺少极端行情覆盖\\n- 未接入回放集",'
            ' "required_adjustments": "补充回放集验证\\n增加最大回撤护栏\\n"}'
        )
        parsed = OpenClawGatewayClient.parse_strategy_change_review_response(raw)
        self.assertEqual(parsed["highlights"], ["参数方向合理", "风险敞口可控"])
        self.assertEqual(parsed["risks"], ["缺少极端行情覆盖", "未接入回放集"])
        self.assertEqual(
            parsed["required_adjustments"],
            ["补充回放集验证", "增加最大回撤护栏"],
        )


class StrategyIssueReviewResponseUnitTests(unittest.TestCase):
    def test_parses_structured_issue_payload(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "运行线程因心跳丢失自动退出",'
            ' "severity": "critical",'
            ' "root_causes": ["网关心跳丢失", "策略线程未设置守护"],'
            ' "mitigations": ["立即重启运行线程", "通知值班工程师"],'
            ' "follow_ups": ["观察 30 分钟无再触发", "记录到运行周报"]}'
        )
        parsed = OpenClawGatewayClient.parse_strategy_issue_review_response(raw)
        self.assertEqual(parsed["summary"], "运行线程因心跳丢失自动退出")
        self.assertEqual(parsed["severity"], "critical")
        self.assertEqual(parsed["root_causes"], ["网关心跳丢失", "策略线程未设置守护"])
        self.assertEqual(parsed["mitigations"], ["立即重启运行线程", "通知值班工程师"])
        self.assertEqual(parsed["follow_ups"], ["观察 30 分钟无再触发", "记录到运行周报"])
        self.assertEqual(parsed["raw_text"], raw)

    def test_coerces_severity_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        info_chinese = '{"summary": "一切正常", "severity": "信息"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_issue_review_response(info_chinese)["severity"],
            "info",
        )

        info_english = '{"summary": "no action", "severity": "normal"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_issue_review_response(info_english)["severity"],
            "info",
        )

        warning_chinese = '{"summary": "建议关注", "severity": "注意"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_issue_review_response(warning_chinese)["severity"],
            "warning",
        )

        warning_english = '{"summary": "watch closely", "severity": "warn"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_issue_review_response(warning_english)["severity"],
            "warning",
        )

        critical_chinese = '{"summary": "必须人工介入", "severity": "严重"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_issue_review_response(critical_chinese)["severity"],
            "critical",
        )

        critical_english = '{"summary": "escalate", "severity": "blocker"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_issue_review_response(critical_english)["severity"],
            "critical",
        )

        unknown_raw = '{"summary": "未知严重度", "severity": "unspecified"}'
        # Unknown severity degrades to the conservative default ``warning``.
        self.assertEqual(
            OpenClawGatewayClient.parse_strategy_issue_review_response(unknown_raw)["severity"],
            "warning",
        )

    def test_returns_defaults_on_empty_input(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed_none = OpenClawGatewayClient.parse_strategy_issue_review_response(None)
        self.assertEqual(parsed_none["summary"], "")
        self.assertEqual(parsed_none["severity"], "warning")
        self.assertEqual(parsed_none["root_causes"], [])
        self.assertEqual(parsed_none["mitigations"], [])
        self.assertEqual(parsed_none["follow_ups"], [])
        self.assertEqual(parsed_none["raw_text"], "")

        parsed_blank = OpenClawGatewayClient.parse_strategy_issue_review_response("   \n \t ")
        self.assertEqual(parsed_blank["summary"], "")
        self.assertEqual(parsed_blank["severity"], "warning")
        self.assertEqual(parsed_blank["root_causes"], [])

    def test_parses_from_fenced_block(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            "Analysis:\n"
            "```json\n"
            '{"summary": "执行滑点偏高",'
            ' "severity": "警告",'
            ' "root_causes": "盘口深度不足\\n下单速率过快",'
            ' "mitigations": ["降低下单速率", "切换到迭代限价"],'
            ' "follow_ups": "观察 1 小时\\n汇报滑点指标"}\n'
            "```"
        )
        parsed = OpenClawGatewayClient.parse_strategy_issue_review_response(raw)
        self.assertEqual(parsed["summary"], "执行滑点偏高")
        self.assertEqual(parsed["severity"], "warning")
        self.assertEqual(parsed["root_causes"], ["盘口深度不足", "下单速率过快"])
        self.assertEqual(parsed["mitigations"], ["降低下单速率", "切换到迭代限价"])
        self.assertEqual(parsed["follow_ups"], ["观察 1 小时", "汇报滑点指标"])

    def test_falls_back_to_heuristic_summary(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = "运行线程偶发心跳丢失，建议重启并持续观察 30 分钟。"
        parsed = OpenClawGatewayClient.parse_strategy_issue_review_response(raw)
        self.assertEqual(parsed["summary"], raw)
        # Plain-text falls back to the conservative defaults.
        self.assertEqual(parsed["severity"], "warning")
        self.assertEqual(parsed["root_causes"], [])
        self.assertEqual(parsed["mitigations"], [])
        self.assertEqual(parsed["follow_ups"], [])
        self.assertEqual(parsed["raw_text"], raw)


class DailyReviewResponseUnitTests(unittest.TestCase):
    def test_parses_structured_json_payload(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "今日整体运行稳定，净收益小幅为正",'
            ' "sentiment": "bullish",'
            ' "key_wins": ["趋势策略抓到早盘突破", "滑点控制达标"],'
            ' "key_losses": ["套利策略触及止损一次"],'
            ' "market_observations": ["BTC 放量上行", "资金费率持续为正"],'
            ' "next_day_priorities": ["复盘套利止损", "扩大趋势策略仓位"]}'
        )
        parsed = OpenClawGatewayClient.parse_daily_review_response(raw)
        self.assertEqual(parsed["summary"], "今日整体运行稳定，净收益小幅为正")
        self.assertEqual(parsed["sentiment"], "bullish")
        self.assertEqual(parsed["key_wins"], ["趋势策略抓到早盘突破", "滑点控制达标"])
        self.assertEqual(parsed["key_losses"], ["套利策略触及止损一次"])
        self.assertEqual(
            parsed["market_observations"],
            ["BTC 放量上行", "资金费率持续为正"],
        )
        self.assertEqual(
            parsed["next_day_priorities"],
            ["复盘套利止损", "扩大趋势策略仓位"],
        )
        self.assertEqual(parsed["raw_text"], raw)

    def test_parses_from_fenced_code_block(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            "Daily summary follows:\n"
            "```json\n"
            '{"summary": "整体表现中规中矩",'
            ' "sentiment": "neutral",'
            ' "key_wins": ["执行路径稳定"],'
            ' "key_losses": [],'
            ' "market_observations": ["行情震荡"],'
            ' "next_day_priorities": ["继续观察"]}\n'
            "```"
        )
        parsed = OpenClawGatewayClient.parse_daily_review_response(raw)
        self.assertEqual(parsed["summary"], "整体表现中规中矩")
        self.assertEqual(parsed["sentiment"], "neutral")
        self.assertEqual(parsed["key_wins"], ["执行路径稳定"])
        self.assertEqual(parsed["key_losses"], [])
        self.assertEqual(parsed["market_observations"], ["行情震荡"])
        self.assertEqual(parsed["next_day_priorities"], ["继续观察"])

    def test_coerces_sentiment_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        bullish_chinese = '{"summary": "表现积极", "sentiment": "看多"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_daily_review_response(bullish_chinese)["sentiment"],
            "bullish",
        )

        bullish_english = '{"summary": "upbeat", "sentiment": "positive"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_daily_review_response(bullish_english)["sentiment"],
            "bullish",
        )

        neutral_chinese = '{"summary": "中性", "sentiment": "中性"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_daily_review_response(neutral_chinese)["sentiment"],
            "neutral",
        )

        neutral_english = '{"summary": "flat day", "sentiment": "flat"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_daily_review_response(neutral_english)["sentiment"],
            "neutral",
        )

        bearish_chinese = '{"summary": "偏弱", "sentiment": "看空"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_daily_review_response(bearish_chinese)["sentiment"],
            "bearish",
        )

        bearish_english = '{"summary": "down day", "sentiment": "negative"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_daily_review_response(bearish_english)["sentiment"],
            "bearish",
        )

        unknown_raw = '{"summary": "未定", "sentiment": "unspecified"}'
        # Unknown sentiment degrades to the conservative default ``neutral``.
        self.assertEqual(
            OpenClawGatewayClient.parse_daily_review_response(unknown_raw)["sentiment"],
            "neutral",
        )

    def test_returns_defaults_on_empty_input(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed_none = OpenClawGatewayClient.parse_daily_review_response(None)
        self.assertEqual(parsed_none["summary"], "")
        self.assertEqual(parsed_none["sentiment"], "neutral")
        self.assertEqual(parsed_none["key_wins"], [])
        self.assertEqual(parsed_none["key_losses"], [])
        self.assertEqual(parsed_none["market_observations"], [])
        self.assertEqual(parsed_none["next_day_priorities"], [])
        self.assertEqual(parsed_none["raw_text"], "")

        parsed_blank = OpenClawGatewayClient.parse_daily_review_response("   \n \t ")
        self.assertEqual(parsed_blank["summary"], "")
        self.assertEqual(parsed_blank["sentiment"], "neutral")
        self.assertEqual(parsed_blank["key_wins"], [])

    def test_falls_back_to_heuristic_when_not_json(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = "今日整体净收益微正，建议明日继续保持仓位结构。"
        parsed = OpenClawGatewayClient.parse_daily_review_response(raw)
        self.assertEqual(parsed["summary"], raw)
        # Plain-text falls back to the conservative defaults.
        self.assertEqual(parsed["sentiment"], "neutral")
        self.assertEqual(parsed["key_wins"], [])
        self.assertEqual(parsed["key_losses"], [])
        self.assertEqual(parsed["market_observations"], [])
        self.assertEqual(parsed["next_day_priorities"], [])
        self.assertEqual(parsed["raw_text"], raw)

    def test_accepts_newline_separated_lists_in_fields(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "整体偏稳",'
            ' "sentiment": "neutral",'
            ' "key_wins": "趋势策略小幅盈利\\n执行链路稳定",'
            ' "key_losses": "- 套利单次止损\\n- 手续费略增",'
            ' "market_observations": "BTC 横盘\\n成交量缩量",'
            ' "next_day_priorities": "复盘止损\\n评估手续费\\n"}'
        )
        parsed = OpenClawGatewayClient.parse_daily_review_response(raw)
        self.assertEqual(parsed["key_wins"], ["趋势策略小幅盈利", "执行链路稳定"])
        self.assertEqual(parsed["key_losses"], ["套利单次止损", "手续费略增"])
        self.assertEqual(parsed["market_observations"], ["BTC 横盘", "成交量缩量"])
        self.assertEqual(parsed["next_day_priorities"], ["复盘止损", "评估手续费"])


class BacktestReviewResponseUnitTests(unittest.TestCase):
    def test_parses_structured_backtest_payload(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "回测整体收益稳定，夏普满足上线标准",'
            ' "overall_rating": "strong",'
            ' "strengths": ["夏普 2.1", "最大回撤低于预算"],'
            ' "weaknesses": ["样本覆盖偏短"],'
            ' "risk_flags": ["缺少熊市样本", "滑点假设偏乐观"],'
            ' "recommended_actions": ["补充 2022 年熊市回测", "提高滑点模型置信度"]}'
        )
        parsed = OpenClawGatewayClient.parse_backtest_review_response(raw)
        self.assertEqual(parsed["summary"], "回测整体收益稳定，夏普满足上线标准")
        self.assertEqual(parsed["overall_rating"], "strong")
        self.assertEqual(parsed["strengths"], ["夏普 2.1", "最大回撤低于预算"])
        self.assertEqual(parsed["weaknesses"], ["样本覆盖偏短"])
        self.assertEqual(parsed["risk_flags"], ["缺少熊市样本", "滑点假设偏乐观"])
        self.assertEqual(
            parsed["recommended_actions"],
            ["补充 2022 年熊市回测", "提高滑点模型置信度"],
        )
        self.assertEqual(parsed["raw_text"], raw)

    def test_coerces_rating_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        strong_chinese = '{"summary": "表现出色", "overall_rating": "优秀"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(strong_chinese)["overall_rating"],
            "strong",
        )

        strong_english = '{"summary": "solid run", "overall_rating": "excellent"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(strong_english)["overall_rating"],
            "strong",
        )

        acceptable_chinese = '{"summary": "尚可", "overall_rating": "合格"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(acceptable_chinese)["overall_rating"],
            "acceptable",
        )

        acceptable_english = '{"summary": "meets bar", "overall_rating": "fair"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(acceptable_english)["overall_rating"],
            "acceptable",
        )

        weak_chinese = '{"summary": "不建议上线", "overall_rating": "偏弱"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(weak_chinese)["overall_rating"],
            "weak",
        )

        weak_english = '{"summary": "needs work", "overall_rating": "poor"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(weak_english)["overall_rating"],
            "weak",
        )

        unknown_raw = '{"summary": "未定级", "overall_rating": "unspecified"}'
        # Unknown rating degrades to the conservative default ``acceptable``.
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(unknown_raw)["overall_rating"],
            "acceptable",
        )

    def test_returns_defaults_on_empty_input(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed_none = OpenClawGatewayClient.parse_backtest_review_response(None)
        self.assertEqual(parsed_none["summary"], "")
        self.assertEqual(parsed_none["overall_rating"], "acceptable")
        self.assertEqual(parsed_none["strengths"], [])
        self.assertEqual(parsed_none["weaknesses"], [])
        self.assertEqual(parsed_none["risk_flags"], [])
        self.assertEqual(parsed_none["recommended_actions"], [])
        self.assertEqual(parsed_none["raw_text"], "")

        parsed_blank = OpenClawGatewayClient.parse_backtest_review_response("   \n \t ")
        self.assertEqual(parsed_blank["summary"], "")
        self.assertEqual(parsed_blank["overall_rating"], "acceptable")
        self.assertEqual(parsed_blank["strengths"], [])

    def test_parses_from_fenced_block(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            "Review below:\n"
            "```json\n"
            '{"summary": "回测收益略低于预期",'
            ' "overall_rating": "合格",'
            ' "strengths": "胜率稳定\\n回撤可控",'
            ' "weaknesses": ["样本时间段偏短"],'
            ' "risk_flags": "缺少极端行情覆盖\\n手续费假设偏乐观",'
            ' "recommended_actions": "拓展样本区间\\n复核手续费模型"}\n'
            "```"
        )
        parsed = OpenClawGatewayClient.parse_backtest_review_response(raw)
        self.assertEqual(parsed["summary"], "回测收益略低于预期")
        self.assertEqual(parsed["overall_rating"], "acceptable")
        self.assertEqual(parsed["strengths"], ["胜率稳定", "回撤可控"])
        self.assertEqual(parsed["weaknesses"], ["样本时间段偏短"])
        self.assertEqual(
            parsed["risk_flags"],
            ["缺少极端行情覆盖", "手续费假设偏乐观"],
        )
        self.assertEqual(
            parsed["recommended_actions"],
            ["拓展样本区间", "复核手续费模型"],
        )

    def test_falls_back_to_heuristic_summary(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = "回测整体收益与夏普达标，建议再补一次压力测试后再推上线。"
        parsed = OpenClawGatewayClient.parse_backtest_review_response(raw)
        self.assertEqual(parsed["summary"], raw)
        # Plain-text falls back to the conservative defaults.
        self.assertEqual(parsed["overall_rating"], "acceptable")
        self.assertEqual(parsed["strengths"], [])
        self.assertEqual(parsed["weaknesses"], [])
        self.assertEqual(parsed["risk_flags"], [])
        self.assertEqual(parsed["recommended_actions"], [])
        self.assertEqual(parsed["raw_text"], raw)

    def test_accepts_mixed_case_rating_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        mixed_strong = '{"summary": "great run", "overall_rating": "STRONG"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(mixed_strong)["overall_rating"],
            "strong",
        )

        mixed_acceptable = '{"summary": "ok run", "overall_rating": "Acceptable"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(mixed_acceptable)["overall_rating"],
            "acceptable",
        )

        mixed_weak = '{"summary": "weak run", "overall_rating": "Weak"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(mixed_weak)["overall_rating"],
            "weak",
        )

        mixed_ok = '{"summary": "passable", "overall_rating": "OK"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_backtest_review_response(mixed_ok)["overall_rating"],
            "acceptable",
        )


class QueueSummarizeExecutionImpactUnitTests(unittest.TestCase):
    def setUp(self) -> None:
        self._agent_jobs_backup = copy.deepcopy(control_main.repo.state.agent_jobs)
        self.addCleanup(self._restore_agent_jobs)

    def _restore_agent_jobs(self) -> None:
        control_main.repo.state.agent_jobs = self._agent_jobs_backup

    def test_queue_summarize_execution_impact_enqueues_agent_job_with_full_context(self) -> None:
        anomalies = [
            {"type": "slippage_spike", "detail": "滑点突增至 18bps"},
            {"type": "fill_rate_drop", "detail": "成交率从 92% 跌至 78%"},
        ]

        job_id = control_main.repo.queue_summarize_execution_impact(
            strategy_id="trend-btc-01",
            strategy_name="Trend BTC",
            window_start="2026-04-19T08:00:00+08:00",
            window_end="2026-04-19T09:00:00+08:00",
            order_count=12,
            fill_count=10,
            total_notional=125_400.5,
            slippage_bps=4.8,
            expected_pnl=820.0,
            realized_pnl=745.2,
            anomalies=anomalies,
            requested_by="desktop_operator",
        )

        self.assertIsInstance(job_id, str)
        self.assertTrue(job_id)

        job = next(
            (item for item in control_main.repo.state.agent_jobs if item.id == job_id),
            None,
        )
        self.assertIsNotNone(job, "新入队的 AgentJob 应能在 repo.state.agent_jobs 中找到")
        assert job is not None  # for type narrowing
        self.assertEqual(job.job_type, "summarize_execution_impact")
        self.assertEqual(job.context["strategy_id"], "trend-btc-01")
        self.assertEqual(job.context["strategy_name"], "Trend BTC")
        self.assertEqual(job.context["window_start"], "2026-04-19T08:00:00+08:00")
        self.assertEqual(job.context["window_end"], "2026-04-19T09:00:00+08:00")
        self.assertEqual(job.context["order_count"], 12)
        self.assertEqual(job.context["fill_count"], 10)
        self.assertEqual(job.context["total_notional"], 125_400.5)
        self.assertEqual(job.context["slippage_bps"], 4.8)
        self.assertEqual(job.context["expected_pnl"], 820.0)
        self.assertEqual(job.context["realized_pnl"], 745.2)
        self.assertEqual(job.context["requested_by"], "desktop_operator")
        self.assertIsInstance(job.context["anomalies"], list)
        self.assertEqual(job.context["anomalies"], anomalies)

    def test_queue_summarize_execution_impact_empty_anomalies_becomes_list(self) -> None:
        job_id = control_main.repo.queue_summarize_execution_impact(
            strategy_id="eth-revert-02",
            strategy_name="Revert ETH",
            window_start="2026-04-19T10:00:00+08:00",
            window_end="2026-04-19T11:00:00+08:00",
            order_count=3,
            fill_count=3,
            total_notional=12_340.0,
            slippage_bps=1.1,
            expected_pnl=42.0,
            realized_pnl=40.5,
            anomalies=None,
        )

        job = next(
            (item for item in control_main.repo.state.agent_jobs if item.id == job_id),
            None,
        )
        self.assertIsNotNone(job)
        assert job is not None
        self.assertEqual(job.context["anomalies"], [])
        self.assertIsInstance(job.context["anomalies"], list)


class PersistExecutionImpactRecordUnitTests(unittest.TestCase):
    def setUp(self) -> None:
        self._records_backup = copy.deepcopy(
            control_main.repo.state.execution_impact_records
        )
        self.addCleanup(self._restore_records)

    def _restore_records(self) -> None:
        control_main.repo.state.execution_impact_records = self._records_backup

    def test_persist_execution_impact_record_creates_entry_with_generated_id(
        self,
    ) -> None:
        record = control_main.repo.persist_execution_impact_record(
            strategy_id="trend-btc-01",
            strategy_name="Trend BTC",
            window_start="2026-04-19T08:00:00+08:00",
            window_end="2026-04-19T09:00:00+08:00",
            summary="滑点飙升导致整体执行质量恶化",
            impact_level="significant",
            direction="worsened",
            affected_orders=["O1", "O2"],
            affected_positions=["BTCUSDT-LONG"],
            metrics_deltas=["slippage +12bps", "fill rate -15%"],
            follow_up_checks=["复核撮合链路", "监控下一小时滑点"],
            raw_text="原始模型输出",
            agent_job_id="job-abc123",
            source="openclaw",
        )

        self.assertIsInstance(record.id, str)
        self.assertTrue(record.id)
        self.assertTrue(record.created_at)
        self.assertTrue(record.updated_at)

        stored = control_main.repo.state.execution_impact_records[0]
        self.assertEqual(stored.id, record.id)
        self.assertEqual(stored.strategy_id, "trend-btc-01")
        self.assertEqual(stored.strategy_name, "Trend BTC")
        self.assertEqual(stored.window_start, "2026-04-19T08:00:00+08:00")
        self.assertEqual(stored.window_end, "2026-04-19T09:00:00+08:00")
        self.assertEqual(stored.summary, "滑点飙升导致整体执行质量恶化")
        self.assertEqual(stored.impact_level, "significant")
        self.assertEqual(stored.direction, "worsened")
        self.assertEqual(stored.affected_orders, ["O1", "O2"])
        self.assertEqual(stored.affected_positions, ["BTCUSDT-LONG"])
        self.assertEqual(
            stored.metrics_deltas,
            ["slippage +12bps", "fill rate -15%"],
        )
        self.assertEqual(
            stored.follow_up_checks,
            ["复核撮合链路", "监控下一小时滑点"],
        )
        self.assertEqual(stored.raw_text, "原始模型输出")
        self.assertEqual(stored.agent_job_id, "job-abc123")
        self.assertEqual(stored.source, "openclaw")
        self.assertEqual(stored.created_at, record.created_at)
        self.assertEqual(stored.updated_at, record.updated_at)

    def test_persist_execution_impact_record_normalizes_optional_lists(self) -> None:
        record = control_main.repo.persist_execution_impact_record(
            strategy_id="eth-revert-02",
            strategy_name="Revert ETH",
            window_start="2026-04-19T10:00:00+08:00",
            window_end="2026-04-19T11:00:00+08:00",
            summary="调仓后影响可忽略",
        )

        self.assertEqual(record.affected_orders, [])
        self.assertEqual(record.affected_positions, [])
        self.assertEqual(record.metrics_deltas, [])
        self.assertEqual(record.follow_up_checks, [])
        self.assertIsInstance(record.affected_orders, list)
        self.assertIsInstance(record.affected_positions, list)
        self.assertIsInstance(record.metrics_deltas, list)
        self.assertIsInstance(record.follow_up_checks, list)
        # Defaults should also be applied when no level/direction is provided.
        self.assertEqual(record.impact_level, "moderate")
        self.assertEqual(record.direction, "neutral")
        self.assertEqual(record.raw_text, "")
        self.assertIsNone(record.agent_job_id)
        self.assertEqual(record.source, "openclaw")

    def test_persist_execution_impact_record_upsert_replaces_by_id(self) -> None:
        first = control_main.repo.persist_execution_impact_record(
            strategy_id="sol-breakout-03",
            strategy_name="Breakout SOL",
            window_start="2026-04-19T12:00:00+08:00",
            window_end="2026-04-19T13:00:00+08:00",
            summary="初稿摘要",
            impact_level="moderate",
            direction="neutral",
            follow_up_checks=["原始检查项"],
        )

        length_before = len(control_main.repo.state.execution_impact_records)

        updated = control_main.repo.persist_execution_impact_record(
            strategy_id="sol-breakout-03",
            strategy_name="Breakout SOL",
            window_start="2026-04-19T12:00:00+08:00",
            window_end="2026-04-19T13:00:00+08:00",
            summary="修订后摘要",
            impact_level="significant",
            direction="worsened",
            follow_up_checks=["新的检查项", "补充风控复核"],
            record_id=first.id,
        )

        self.assertEqual(updated.id, first.id)
        self.assertEqual(
            len(control_main.repo.state.execution_impact_records),
            length_before,
        )
        stored = next(
            item
            for item in control_main.repo.state.execution_impact_records
            if item.id == first.id
        )
        self.assertEqual(stored.summary, "修订后摘要")
        self.assertEqual(stored.impact_level, "significant")
        self.assertEqual(stored.direction, "worsened")
        self.assertEqual(
            stored.follow_up_checks,
            ["新的检查项", "补充风控复核"],
        )
        # Upsert should preserve the original created_at and bump updated_at.
        self.assertEqual(stored.created_at, first.created_at)
        self.assertNotEqual(stored.updated_at, first.updated_at)


class BuildExecutionImpactRecordFromTextUnitTests(unittest.TestCase):
    def setUp(self) -> None:
        self._records_backup = copy.deepcopy(
            control_main.repo.state.execution_impact_records
        )
        self._jobs_backup = copy.deepcopy(control_main.repo.state.agent_jobs)
        self._events_backup = copy.deepcopy(control_main.repo.state.audit_events)
        self._scheduler_current = (
            control_main.repo.state.control_snapshot.scheduler.current_job_id
        )
        self.addCleanup(self._restore)

    def _restore(self) -> None:
        control_main.repo.state.execution_impact_records = self._records_backup
        control_main.repo.state.agent_jobs = self._jobs_backup
        control_main.repo.state.audit_events = self._events_backup
        control_main.repo.state.control_snapshot.scheduler.current_job_id = (
            self._scheduler_current
        )

    def test_builds_record_from_structured_json_and_persists(self) -> None:
        text = (
            '{"summary": "滑点轻微上升",'
            ' "impact_level": "moderate",'
            ' "direction": "worsened",'
            ' "affected_orders": ["ORD-1", "ORD-2"],'
            ' "affected_positions": ["BTCUSDT-LONG"],'
            ' "metrics_deltas": ["slippage +4bps"],'
            ' "follow_up_checks": ["复核撮合链路"]}'
        )
        context = {
            "strategy_id": "trend-btc-01",
            "strategy_name": "Trend BTC",
            "window_start": "2026-04-19T08:00:00+08:00",
            "window_end": "2026-04-19T09:00:00+08:00",
        }

        record = control_main.build_execution_impact_record_from_text(
            text,
            context,
            source="openclaw",
            job_id="job-xyz-001",
        )

        self.assertEqual(record.strategy_id, "trend-btc-01")
        self.assertEqual(record.strategy_name, "Trend BTC")
        self.assertEqual(record.window_start, "2026-04-19T08:00:00+08:00")
        self.assertEqual(record.window_end, "2026-04-19T09:00:00+08:00")
        self.assertEqual(record.summary, "滑点轻微上升")
        self.assertEqual(record.impact_level, "moderate")
        self.assertEqual(record.direction, "worsened")
        self.assertEqual(record.affected_orders, ["ORD-1", "ORD-2"])
        self.assertEqual(record.affected_positions, ["BTCUSDT-LONG"])
        self.assertEqual(record.metrics_deltas, ["slippage +4bps"])
        self.assertEqual(record.follow_up_checks, ["复核撮合链路"])
        self.assertEqual(record.raw_text, text)
        self.assertEqual(record.agent_job_id, "job-xyz-001")
        self.assertEqual(record.source, "openclaw")
        stored = control_main.repo.state.execution_impact_records[0]
        self.assertEqual(stored.id, record.id)

    def test_plain_text_falls_back_to_moderate_neutral(self) -> None:
        context = {
            "strategy_id": "eth-revert-02",
            "strategy_name": "Revert ETH",
            "window_start": "2026-04-19T10:00:00+08:00",
            "window_end": "2026-04-19T11:00:00+08:00",
        }

        record = control_main.build_execution_impact_record_from_text(
            "执行整体稳定，没有显著异常。",
            context,
            source="openclaw",
            job_id="job-xyz-002",
        )

        self.assertEqual(record.impact_level, "moderate")
        self.assertEqual(record.direction, "neutral")
        self.assertEqual(record.summary, "执行整体稳定，没有显著异常。")
        self.assertEqual(record.affected_orders, [])
        self.assertEqual(record.metrics_deltas, [])
        self.assertEqual(record.agent_job_id, "job-xyz-002")


class CompleteAgentJobExecutionImpactUnitTests(unittest.TestCase):
    def setUp(self) -> None:
        self._records_backup = copy.deepcopy(
            control_main.repo.state.execution_impact_records
        )
        self._jobs_backup = copy.deepcopy(control_main.repo.state.agent_jobs)
        self._events_backup = copy.deepcopy(control_main.repo.state.audit_events)
        scheduler = control_main.repo.state.control_snapshot.scheduler
        self._scheduler_current = scheduler.current_job_id
        self._scheduler_status = scheduler.status
        control_main.repo.state.agent_jobs = []
        scheduler.current_job_id = None
        scheduler.status = "running"
        self.addCleanup(self._restore)

    def _restore(self) -> None:
        control_main.repo.state.execution_impact_records = self._records_backup
        control_main.repo.state.agent_jobs = self._jobs_backup
        control_main.repo.state.audit_events = self._events_backup
        scheduler = control_main.repo.state.control_snapshot.scheduler
        scheduler.current_job_id = self._scheduler_current
        scheduler.status = self._scheduler_status

    def test_complete_agent_job_with_execution_impact_record_updates_context_and_event(
        self,
    ) -> None:
        job_id = control_main.repo.queue_summarize_execution_impact(
            strategy_id="trend-btc-01",
            strategy_name="Trend BTC",
            window_start="2026-04-19T08:00:00+08:00",
            window_end="2026-04-19T09:00:00+08:00",
            order_count=5,
            fill_count=5,
            total_notional=100_000.0,
            slippage_bps=3.2,
            expected_pnl=150.0,
            realized_pnl=138.0,
        )
        claimed = control_main.repo.claim_next_agent_job()
        self.assertIsNotNone(claimed)
        assert claimed is not None
        self.assertEqual(claimed.id, job_id)

        record = control_main.build_execution_impact_record_from_text(
            '{"summary": "滑点轻微恶化",'
            ' "impact_level": "significant",'
            ' "direction": "worsened",'
            ' "metrics_deltas": ["slippage +12bps"],'
            ' "follow_up_checks": ["复核撮合"]}',
            claimed.context,
            source="openclaw",
            job_id=claimed.id,
        )

        completed = control_main.repo.complete_agent_job(
            claimed.id,
            result_summary=record.summary[:160],
            review=None,
            source="openclaw",
            execution_impact_record=record,
        )

        self.assertEqual(completed.status.value, "completed")
        self.assertEqual(
            completed.context["linked_execution_impact_id"], record.id
        )
        self.assertEqual(
            completed.context["linked_execution_impact_level"], "significant"
        )
        self.assertEqual(
            completed.context["linked_execution_impact_direction"], "worsened"
        )

        latest_event = next(
            item
            for item in control_main.repo.state.audit_events
            if item.event_type == "openclaw.job.completed"
            and item.payload.get("job_id") == claimed.id
        )
        self.assertEqual(
            latest_event.payload["execution_impact_id"], record.id
        )
        self.assertEqual(
            latest_event.payload["execution_impact_level"], "significant"
        )
        self.assertEqual(
            latest_event.payload["execution_impact_direction"], "worsened"
        )

    def test_complete_agent_job_without_execution_impact_record_has_null_fields(
        self,
    ) -> None:
        job_id = control_main.repo.queue_summarize_execution_impact(
            strategy_id="eth-revert-02",
            strategy_name="Revert ETH",
            window_start="2026-04-19T10:00:00+08:00",
            window_end="2026-04-19T11:00:00+08:00",
            order_count=3,
            fill_count=3,
            total_notional=12_340.0,
            slippage_bps=1.1,
            expected_pnl=42.0,
            realized_pnl=40.5,
        )
        claimed = control_main.repo.claim_next_agent_job()
        assert claimed is not None

        completed = control_main.repo.complete_agent_job(
            claimed.id,
            result_summary="本地回退总结",
            review=None,
            source="local_fallback",
        )

        self.assertNotIn("linked_execution_impact_id", completed.context)
        latest_event = next(
            item
            for item in control_main.repo.state.audit_events
            if item.event_type == "openclaw.job.completed"
            and item.payload.get("job_id") == claimed.id
        )
        self.assertIsNone(latest_event.payload["execution_impact_id"])
        self.assertIsNone(latest_event.payload["execution_impact_level"])
        self.assertIsNone(latest_event.payload["execution_impact_direction"])


class ExecutionImpactResponseUnitTests(unittest.TestCase):
    def test_parses_structured_json_payload(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "调仓后整体执行质量小幅提升",'
            ' "impact_level": "moderate",'
            ' "direction": "improved",'
            ' "affected_orders": ["ORD-101", "ORD-102"],'
            ' "affected_positions": ["BTCUSDT-LONG"],'
            ' "metrics_deltas": ["slippage +3bps", "fill rate -12%"],'
            ' "follow_up_checks": ["观察明日滑点", "复核撤单率"]}'
        )
        parsed = OpenClawGatewayClient.parse_execution_impact_response(raw)
        self.assertEqual(parsed["summary"], "调仓后整体执行质量小幅提升")
        self.assertEqual(parsed["impact_level"], "moderate")
        self.assertEqual(parsed["direction"], "improved")
        self.assertEqual(parsed["affected_orders"], ["ORD-101", "ORD-102"])
        self.assertEqual(parsed["affected_positions"], ["BTCUSDT-LONG"])
        self.assertEqual(
            parsed["metrics_deltas"],
            ["slippage +3bps", "fill rate -12%"],
        )
        self.assertEqual(
            parsed["follow_up_checks"],
            ["观察明日滑点", "复核撤单率"],
        )
        self.assertEqual(parsed["raw_text"], raw)

    def test_parses_from_fenced_code_block(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            "Impact follows:\n"
            "```json\n"
            '{"summary": "加仓决策触发后市场滑点恶化",'
            ' "impact_level": "significant",'
            ' "direction": "worsened",'
            ' "affected_orders": "ORD-501\\nORD-502",'
            ' "affected_positions": ["ETHUSDT-SHORT"],'
            ' "metrics_deltas": "slippage +12bps\\nfill rate -20%",'
            ' "follow_up_checks": "复盘撮合链路\\n评估对冲策略"}\n'
            "```"
        )
        parsed = OpenClawGatewayClient.parse_execution_impact_response(raw)
        self.assertEqual(parsed["summary"], "加仓决策触发后市场滑点恶化")
        self.assertEqual(parsed["impact_level"], "significant")
        self.assertEqual(parsed["direction"], "worsened")
        self.assertEqual(parsed["affected_orders"], ["ORD-501", "ORD-502"])
        self.assertEqual(parsed["affected_positions"], ["ETHUSDT-SHORT"])
        self.assertEqual(
            parsed["metrics_deltas"],
            ["slippage +12bps", "fill rate -20%"],
        )
        self.assertEqual(
            parsed["follow_up_checks"],
            ["复盘撮合链路", "评估对冲策略"],
        )

    def test_coerces_level_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        negligible_chinese = '{"summary": "可忽略的影响", "impact_level": "可忽略"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(negligible_chinese)["impact_level"],
            "negligible",
        )

        negligible_english = '{"summary": "tiny change", "impact_level": "tiny"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(negligible_english)["impact_level"],
            "negligible",
        )

        moderate_chinese = '{"summary": "一般影响", "impact_level": "一般"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(moderate_chinese)["impact_level"],
            "moderate",
        )

        moderate_english = '{"summary": "normal impact", "impact_level": "medium"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(moderate_english)["impact_level"],
            "moderate",
        )

        significant_chinese = '{"summary": "重大影响", "impact_level": "重大"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(significant_chinese)["impact_level"],
            "significant",
        )

        significant_english = '{"summary": "critical shift", "impact_level": "critical"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(significant_english)["impact_level"],
            "significant",
        )

        unknown_raw = '{"summary": "未定级", "impact_level": "unspecified"}'
        # Unknown level degrades to the conservative default ``moderate``.
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(unknown_raw)["impact_level"],
            "moderate",
        )

    def test_coerces_direction_aliases(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        improved_chinese = '{"summary": "执行改善", "direction": "改善"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(improved_chinese)["direction"],
            "improved",
        )

        improved_english = '{"summary": "better quality", "direction": "positive"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(improved_english)["direction"],
            "improved",
        )

        neutral_chinese = '{"summary": "持平", "direction": "持平"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(neutral_chinese)["direction"],
            "neutral",
        )

        neutral_english = '{"summary": "flat shift", "direction": "unchanged"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(neutral_english)["direction"],
            "neutral",
        )

        worsened_chinese = '{"summary": "恶化", "direction": "恶化"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(worsened_chinese)["direction"],
            "worsened",
        )

        worsened_english = '{"summary": "degraded quality", "direction": "degraded"}'
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(worsened_english)["direction"],
            "worsened",
        )

        unknown_raw = '{"summary": "未知", "direction": "unspecified"}'
        # Unknown direction degrades to the conservative default ``neutral``.
        self.assertEqual(
            OpenClawGatewayClient.parse_execution_impact_response(unknown_raw)["direction"],
            "neutral",
        )

    def test_returns_defaults_on_empty_input(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        parsed_none = OpenClawGatewayClient.parse_execution_impact_response(None)
        self.assertEqual(parsed_none["summary"], "")
        self.assertEqual(parsed_none["impact_level"], "moderate")
        self.assertEqual(parsed_none["direction"], "neutral")
        self.assertEqual(parsed_none["affected_orders"], [])
        self.assertEqual(parsed_none["affected_positions"], [])
        self.assertEqual(parsed_none["metrics_deltas"], [])
        self.assertEqual(parsed_none["follow_up_checks"], [])
        self.assertEqual(parsed_none["raw_text"], "")

        parsed_blank = OpenClawGatewayClient.parse_execution_impact_response("   \n \t ")
        self.assertEqual(parsed_blank["summary"], "")
        self.assertEqual(parsed_blank["impact_level"], "moderate")
        self.assertEqual(parsed_blank["direction"], "neutral")
        self.assertEqual(parsed_blank["affected_orders"], [])

    def test_falls_back_to_heuristic_summary_when_plain_text(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = "策略调整对未平仓订单影响有限，建议继续观察滑点表现。"
        parsed = OpenClawGatewayClient.parse_execution_impact_response(raw)
        self.assertEqual(parsed["summary"], raw)
        # Plain-text falls back to the conservative defaults.
        self.assertEqual(parsed["impact_level"], "moderate")
        self.assertEqual(parsed["direction"], "neutral")
        self.assertEqual(parsed["affected_orders"], [])
        self.assertEqual(parsed["affected_positions"], [])
        self.assertEqual(parsed["metrics_deltas"], [])
        self.assertEqual(parsed["follow_up_checks"], [])
        self.assertEqual(parsed["raw_text"], raw)

    def test_accepts_alternate_keys_for_order_and_position_lists(self) -> None:
        from openclaw_client import OpenClawGatewayClient  # type: ignore

        raw = (
            '{"summary": "使用备用键的影响摘要",'
            ' "level": "significant",'
            ' "direction": "worsened",'
            ' "orders": ["ORD-A", "ORD-B"],'
            ' "positions": ["POS-1"],'
            ' "deltas": ["slippage +5bps"],'
            ' "follow_ups": ["复核执行路径"]}'
        )
        parsed = OpenClawGatewayClient.parse_execution_impact_response(raw)
        self.assertEqual(parsed["summary"], "使用备用键的影响摘要")
        self.assertEqual(parsed["impact_level"], "significant")
        self.assertEqual(parsed["direction"], "worsened")
        self.assertEqual(parsed["affected_orders"], ["ORD-A", "ORD-B"])
        self.assertEqual(parsed["affected_positions"], ["POS-1"])
        self.assertEqual(parsed["metrics_deltas"], ["slippage +5bps"])
        self.assertEqual(parsed["follow_up_checks"], ["复核执行路径"])

        raw_alt = (
            '{"summary": "使用另一组备用键",'
            ' "impact_level": "negligible",'
            ' "direction": "improved",'
            ' "order_ids": "ORD-X\\nORD-Y",'
            ' "position_ids": "POS-Z",'
            ' "metric_deltas": "fill rate +4%",'
            ' "checks": "monitor next hour"}'
        )
        parsed_alt = OpenClawGatewayClient.parse_execution_impact_response(raw_alt)
        self.assertEqual(parsed_alt["impact_level"], "negligible")
        self.assertEqual(parsed_alt["direction"], "improved")
        self.assertEqual(parsed_alt["affected_orders"], ["ORD-X", "ORD-Y"])
        self.assertEqual(parsed_alt["affected_positions"], ["POS-Z"])
        self.assertEqual(parsed_alt["metrics_deltas"], ["fill rate +4%"])
        self.assertEqual(parsed_alt["follow_up_checks"], ["monitor next hour"])


if __name__ == "__main__":
    unittest.main(verbosity=2)

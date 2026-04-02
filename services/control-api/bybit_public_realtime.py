from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from models import CandlePoint, MarketRecentTrade, OrderBookLevel, WatchlistInstrument

try:
    from websockets.sync.client import connect
except Exception:  # pragma: no cover - graceful fallback when dependency isn't installed
    connect = None


class BybitPublicRealtimeClient:
    def __init__(self) -> None:
        self.enabled = connect is not None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._threads: Dict[str, threading.Thread] = {}
        self._desired_symbols: Dict[str, Set[str]] = {"spot": set(), "linear": set()}
        self._ticker_cache: Dict[tuple[str, str], Dict[str, object]] = {}
        self._symbol_last_message_at: Dict[tuple[str, str], str] = {}
        self._latest_kline: Dict[tuple[str, str], CandlePoint] = {}
        self._recent_trades: Dict[tuple[str, str], List[MarketRecentTrade]] = {}
        self._orderbooks: Dict[tuple[str, str], Dict[str, Dict[float, float]]] = {}
        self._channel_connected: Dict[str, bool] = {"spot": False, "linear": False}
        self._channel_last_message_at: Dict[str, Optional[str]] = {"spot": None, "linear": None}
        self._last_error: Optional[str] = None
        self._last_message_at: Optional[str] = None
        self._recent_trade_limit = 40

    @staticmethod
    def _channel_for_market(market: str) -> str:
        return "spot" if market == "spot" else "linear"

    @staticmethod
    def _cache_key(channel: str, symbol: str) -> tuple[str, str]:
        return channel, symbol.upper()

    def _resolve_cache_key_locked(self, symbol: str, market: Optional[str] = None) -> Optional[tuple[str, str]]:
        normalized_symbol = symbol.upper()
        if market is not None:
            return self._cache_key(self._channel_for_market(market), normalized_symbol)

        matches = [
            self._cache_key(channel, normalized_symbol)
            for channel in ("spot", "linear")
            if self._cache_key(channel, normalized_symbol) in self._ticker_cache
            or self._cache_key(channel, normalized_symbol) in self._symbol_last_message_at
            or self._cache_key(channel, normalized_symbol) in self._latest_kline
            or self._cache_key(channel, normalized_symbol) in self._recent_trades
            or self._cache_key(channel, normalized_symbol) in self._orderbooks
        ]
        if len(matches) == 1:
            return matches[0]
        return None

    @staticmethod
    def _ws_url(channel: str) -> str:
        return f"wss://stream.bybit.com/v5/public/{channel}"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).astimezone().isoformat()

    @staticmethod
    def _to_float(value: object, default: float = 0.0) -> float:
        try:
            return float(value) if value not in (None, "") else default
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _topic_set(symbols: Set[str]) -> List[str]:
        topics: List[str] = []
        for symbol in sorted(symbols):
            topics.append(f"tickers.{symbol}")
            topics.append(f"kline.60.{symbol}")
            topics.append(f"publicTrade.{symbol}")
            topics.append(f"orderbook.50.{symbol}")
        return topics

    @staticmethod
    def _candle_from_ws_row(row: Dict[str, object]) -> CandlePoint:
        timestamp = int(str(row.get("start") or row.get("startTime") or row.get("timestamp") or "0"))
        return CandlePoint(
            time=datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc).astimezone().isoformat(),
            open=BybitPublicRealtimeClient._to_float(row.get("open")),
            high=BybitPublicRealtimeClient._to_float(row.get("high")),
            low=BybitPublicRealtimeClient._to_float(row.get("low")),
            close=BybitPublicRealtimeClient._to_float(row.get("close")),
            volume=BybitPublicRealtimeClient._to_float(row.get("volume")),
        )

    @staticmethod
    def _trade_from_ws_row(row: Dict[str, object]) -> MarketRecentTrade:
        timestamp = int(str(row.get("T") or row.get("time") or row.get("ts") or "0"))
        side = str(row.get("S") or row.get("side") or "Buy").strip().lower()
        price = BybitPublicRealtimeClient._to_float(row.get("p") or row.get("price"))
        size = BybitPublicRealtimeClient._to_float(row.get("v") or row.get("size"))
        is_block_trade_raw = row.get("BT") if row.get("BT") is not None else row.get("isBlockTrade")
        is_block_trade = False
        if isinstance(is_block_trade_raw, bool):
            is_block_trade = is_block_trade_raw
        elif is_block_trade_raw not in (None, ""):
            is_block_trade = str(is_block_trade_raw).strip().lower() in {"1", "true", "yes"}
        return MarketRecentTrade(
            side="sell" if side.startswith("sell") else "buy",
            price=price,
            size=size,
            value=round(price * size, 6),
            occurred_at=datetime.fromtimestamp(timestamp / 1000, tz=timezone.utc).astimezone().isoformat()
            if timestamp
            else BybitPublicRealtimeClient._now_iso(),
            is_block_trade=is_block_trade,
        )

    def start(self, watchlist: List[WatchlistInstrument]) -> bool:
        if not self.enabled:
            return False
        self.update_watchlist(watchlist)
        for channel in ("spot", "linear"):
            thread = self._threads.get(channel)
            if thread and thread.is_alive():
                continue
            thread = threading.Thread(
                target=self._run_channel,
                args=(channel,),
                name=f"bybit-public-ws-{channel}",
                daemon=True,
            )
            self._threads[channel] = thread
            thread.start()
        return True

    def stop(self) -> None:
        self._stop_event.set()

    def update_watchlist(self, watchlist: List[WatchlistInstrument]) -> None:
        if not self.enabled:
            return
        with self._lock:
            self._desired_symbols = {
                "spot": {item.symbol for item in watchlist if item.market == "spot"},
                "linear": {item.symbol for item in watchlist if item.market != "spot"},
            }

    def has_ticker(self, symbol: str, market: Optional[str] = None) -> bool:
        with self._lock:
            cache_key = self._resolve_cache_key_locked(symbol, market)
            return cache_key in self._ticker_cache if cache_key is not None else False

    def get_status(self) -> Dict[str, object]:
        with self._lock:
            return {
                "enabled": self.enabled,
                "connected_spot": self._channel_connected["spot"],
                "connected_linear": self._channel_connected["linear"],
                "last_message_at_spot": self._channel_last_message_at["spot"],
                "last_message_at_linear": self._channel_last_message_at["linear"],
                "last_message_at": self._last_message_at,
                "last_error": self._last_error,
            }

    def get_symbol_last_message_at(self, symbol: str, market: Optional[str] = None) -> Optional[str]:
        with self._lock:
            cache_key = self._resolve_cache_key_locked(symbol, market)
            return self._symbol_last_message_at.get(cache_key) if cache_key is not None else None

    def enrich_watchlist(self, watchlist: List[WatchlistInstrument]) -> List[WatchlistInstrument]:
        enriched: List[WatchlistInstrument] = []
        with self._lock:
            for item in watchlist:
                ticker = self._ticker_cache.get(self._cache_key(self._channel_for_market(item.market), item.symbol))
                if not ticker:
                    enriched.append(item)
                    continue
                enriched.append(
                    item.model_copy(
                        update={
                            "last_price": self._to_float(ticker.get("lastPrice"), item.last_price),
                            "change_24h": round(
                                self._to_float(ticker.get("price24hPcnt"), item.change_24h / 100.0) * 100,
                                2,
                            ),
                            "volume_24h": self._to_float(
                                ticker.get("turnover24h") or ticker.get("volume24h"),
                                item.volume_24h,
                            ),
                        }
                    )
                )
        return enriched

    def merge_candles(
        self,
        symbol: str,
        candles: List[CandlePoint],
        market: Optional[str] = None,
    ) -> List[CandlePoint]:
        with self._lock:
            cache_key = self._resolve_cache_key_locked(symbol, market)
            live_candle = self._latest_kline.get(cache_key) if cache_key is not None else None
        if live_candle is None:
            return candles

        merged = list(candles)
        if not merged:
            return [live_candle]
        if merged[-1].time == live_candle.time:
            merged[-1] = live_candle
        elif merged[-1].time < live_candle.time:
            merged.append(live_candle)
            merged = merged[-48:]
        return merged

    def get_ticker_snapshot(self, symbol: str, market: Optional[str] = None) -> Optional[Dict[str, object]]:
        with self._lock:
            cache_key = self._resolve_cache_key_locked(symbol, market)
            snapshot = self._ticker_cache.get(cache_key) if cache_key is not None else None
            return dict(snapshot) if snapshot else None

    def get_recent_trades_snapshot(
        self,
        symbol: str,
        limit: int = 12,
        market: Optional[str] = None,
    ) -> List[MarketRecentTrade]:
        with self._lock:
            cache_key = self._resolve_cache_key_locked(symbol, market)
            trades = list(self._recent_trades.get(cache_key, [])) if cache_key is not None else []
        return trades[:limit]

    def get_orderbook_snapshot(
        self,
        symbol: str,
        limit: int = 8,
        market: Optional[str] = None,
    ) -> Dict[str, List[OrderBookLevel]]:
        with self._lock:
            cache_key = self._resolve_cache_key_locked(symbol, market)
            raw_book = self._orderbooks.get(cache_key) if cache_key is not None else None
            if not raw_book:
                return {"bids": [], "asks": []}
            bids = self._build_levels(raw_book.get("bids", {}), reverse=True, limit=limit)
            asks = self._build_levels(raw_book.get("asks", {}), reverse=False, limit=limit)
        return {"bids": bids, "asks": asks}

    @staticmethod
    def _build_levels(side: Dict[float, float], reverse: bool, limit: int) -> List[OrderBookLevel]:
        total = 0.0
        levels: List[OrderBookLevel] = []
        for price in sorted(side.keys(), reverse=reverse)[:limit]:
            size = float(side[price])
            total += size
            levels.append(
                OrderBookLevel(
                    price=float(price),
                    size=size,
                    total=round(total, 6),
                )
            )
        return levels

    @staticmethod
    def _apply_orderbook_updates(side: Dict[float, float], entries: object) -> None:
        rows = entries if isinstance(entries, list) else []
        for row in rows:
            if not isinstance(row, list) or len(row) < 2:
                continue
            price = BybitPublicRealtimeClient._to_float(row[0])
            size = BybitPublicRealtimeClient._to_float(row[1])
            if price <= 0:
                continue
            if size <= 0:
                side.pop(price, None)
            else:
                side[price] = size

    def _run_channel(self, channel: str) -> None:
        while not self._stop_event.is_set():
            with self._lock:
                desired_symbols = set(self._desired_symbols.get(channel, set()))

            if not desired_symbols:
                self._set_channel_connected(channel, False)
                time.sleep(1.0)
                continue

            if connect is None:  # pragma: no cover - dependency fallback
                return

            try:
                with connect(
                    self._ws_url(channel),
                    open_timeout=8,
                    ping_interval=20,
                    ping_timeout=20,
                    close_timeout=5,
                    max_size=2_000_000,
                ) as websocket:
                    subscribe_payload = {
                        "op": "subscribe",
                        "args": self._topic_set(desired_symbols),
                    }
                    websocket.send(json.dumps(subscribe_payload))
                    self._set_channel_connected(channel, True)

                    while not self._stop_event.is_set():
                        with self._lock:
                            latest_symbols = set(self._desired_symbols.get(channel, set()))
                        if latest_symbols != desired_symbols:
                            break

                        try:
                            message = websocket.recv(timeout=1.0)
                        except TimeoutError:
                            # Public topics may stay quiet briefly; keep the channel
                            # alive and let symbol-level stale checks decide whether
                            # the target instrument is still refreshing.
                            self._mark_channel_message(channel)
                            self._set_channel_connected(channel, True)
                            continue
                        if not isinstance(message, str):
                            continue
                        self._handle_message(message, channel)
            except Exception as exc:  # pragma: no cover - external network dependency
                with self._lock:
                    self._last_error = str(exc)
                self._set_channel_connected(channel, False)
                time.sleep(2.0)

        self._set_channel_connected(channel, False)

    def _set_channel_connected(self, channel: str, value: bool) -> None:
        with self._lock:
            self._channel_connected[channel] = value
            if value:
                self._last_error = None

    def _mark_channel_message(self, channel: str) -> None:
        now_iso = self._now_iso()
        with self._lock:
            self._last_message_at = now_iso
            self._channel_last_message_at[channel] = now_iso
            self._last_error = None

    def _handle_message(self, message: str, channel: str) -> None:
        payload = json.loads(message)
        if payload.get("op") == "ping":
            self._mark_channel_message(channel)
            return
        if payload.get("op") == "pong":
            self._mark_channel_message(channel)
            return
        topic = str(payload.get("topic") or "")
        if not topic:
            return

        now_iso = self._now_iso()
        self._mark_channel_message(channel)
        with self._lock:

            if topic.startswith("tickers."):
                symbol = topic.split(".", 1)[1]
                cache_key = self._cache_key(channel, symbol)
                self._symbol_last_message_at[cache_key] = now_iso
                previous = dict(self._ticker_cache.get(cache_key, {}))
                data = payload.get("data")
                if isinstance(data, dict):
                    previous.update(data)
                    self._ticker_cache[cache_key] = previous
                return

            if topic.startswith("kline."):
                parts = topic.split(".")
                if len(parts) < 3:
                    return
                symbol = parts[2]
                cache_key = self._cache_key(channel, symbol)
                self._symbol_last_message_at[cache_key] = now_iso
                data = payload.get("data")
                rows = data if isinstance(data, list) else []
                if not rows:
                    return
                latest_row = rows[-1]
                if isinstance(latest_row, dict):
                    self._latest_kline[cache_key] = self._candle_from_ws_row(latest_row)
                return

            if topic.startswith("publicTrade."):
                symbol = topic.split(".", 1)[1]
                cache_key = self._cache_key(channel, symbol)
                self._symbol_last_message_at[cache_key] = now_iso
                data = payload.get("data")
                rows = data if isinstance(data, list) else []
                if not rows:
                    return
                existing = list(self._recent_trades.get(cache_key, []))
                incoming = [self._trade_from_ws_row(row) for row in rows if isinstance(row, dict)]
                merged = sorted([*incoming, *existing], key=lambda item: item.occurred_at, reverse=True)
                deduped: List[MarketRecentTrade] = []
                seen = set()
                for item in merged:
                    key = (item.occurred_at, item.side, item.price, item.size)
                    if key in seen:
                        continue
                    seen.add(key)
                    deduped.append(item)
                    if len(deduped) >= self._recent_trade_limit:
                        break
                self._recent_trades[cache_key] = deduped
                return

            if topic.startswith("orderbook."):
                parts = topic.split(".")
                if len(parts) < 3:
                    return
                symbol = parts[2]
                cache_key = self._cache_key(channel, symbol)
                self._symbol_last_message_at[cache_key] = now_iso
                data = payload.get("data")
                if not isinstance(data, dict):
                    return
                message_type = str(payload.get("type") or "snapshot").lower()
                book = self._orderbooks.setdefault(cache_key, {"bids": {}, "asks": {}})
                if message_type == "snapshot":
                    book["bids"] = {}
                    book["asks"] = {}
                self._apply_orderbook_updates(book["bids"], data.get("b"))
                self._apply_orderbook_updates(book["asks"], data.get("a"))

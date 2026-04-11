from __future__ import annotations

import json
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from hashlib import md5
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from models import CandlePoint, MarketDetail, MarketRecentTrade, OrderBookLevel, WatchlistInstrument
try:
    from bybit_public_realtime import BybitPublicRealtimeClient
except ModuleNotFoundError:
    class BybitPublicRealtimeClient:  # type: ignore[no-redef]
        def start(self, watchlist: List[WatchlistInstrument]) -> bool:
            return False

        def stop(self) -> None:
            return None

        def update_watchlist(self, watchlist: List[WatchlistInstrument]) -> None:
            return None

        def has_ticker(self, symbol: str, market: Optional[str] = None) -> bool:
            return False

        def get_status(self) -> Dict[str, object]:
            return {
                "enabled": False,
                "connected_spot": False,
                "connected_linear": False,
                "last_message_at_spot": None,
                "last_message_at_linear": None,
                "last_message_at": None,
                "last_error": "bybit_public_realtime 模块缺失，已回退 REST。",
            }

        def get_symbol_last_message_at(self, symbol: str, market: Optional[str] = None) -> Optional[str]:
            return None

        def enrich_watchlist(self, watchlist: List[WatchlistInstrument]) -> List[WatchlistInstrument]:
            return list(watchlist)

        def merge_candles(
            self,
            symbol: str,
            candles: List[CandlePoint],
            market: Optional[str] = None,
            timeframe: str = "1h",
        ) -> List[CandlePoint]:
            return list(candles)

        def get_ticker_snapshot(self, symbol: str, market: Optional[str] = None) -> Optional[Dict[str, object]]:
            return None

        def get_recent_trades_snapshot(
            self,
            symbol: str,
            limit: int = 12,
            market: Optional[str] = None,
        ) -> List[MarketRecentTrade]:
            return []

        def get_orderbook_snapshot(
            self,
            symbol: str,
            limit: int = 8,
            market: Optional[str] = None,
        ) -> Dict[str, List[OrderBookLevel]]:
            return {"bids": [], "asks": []}


class BybitPublicMarketClient:
    def __init__(self, base_url: str = "https://api.bybit.com", timeout: float = 4.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.realtime = BybitPublicRealtimeClient()
        self._cache_lock = threading.RLock()
        self._ticker_cache: Dict[Tuple[str, str], Tuple[float, Dict[str, object]]] = {}
        self._candle_cache: Dict[Tuple[str, str, str, int], Tuple[float, List[CandlePoint]]] = {}
        self._orderbook_cache: Dict[Tuple[str, str, int], Tuple[float, Dict[str, List[OrderBookLevel]]]] = {}
        self._recent_trade_cache: Dict[Tuple[str, str, int], Tuple[float, List[MarketRecentTrade]]] = {}
        self._announcement_cache: Dict[Tuple[str, int], Tuple[float, List[Dict]]] = {}
        self._instrument_cache: Dict[Tuple[str, str], Tuple[float, Dict[str, str]]] = {}
        self._connectivity_probe_cache: Optional[Tuple[float, Dict[str, object]]] = None
        self._candle_history_cache: Dict[Tuple[str, str, str, int], Tuple[float, List[CandlePoint]]] = {}
        self._ticker_cache_ttl = 3.0
        self._candle_cache_ttls = {
            "15m": 20.0,
            "1h": 20.0,
            "4h": 45.0,
            "1d": 120.0,
        }
        self._orderbook_cache_ttl = 3.0
        self._recent_trade_cache_ttl = 3.0
        self._announcement_cache_ttl = 300.0
        self._instrument_cache_ttl = 600.0
        self._connectivity_probe_cache_ttl = 20.0
        self._candle_history_cache_ttls = {
            "15m": 45.0,
            "1h": 60.0,
            "4h": 90.0,
            "1d": 180.0,
        }
        self._candle_page_limit = 600
        self._ticker_cache_max_entries = 256
        self._candle_cache_max_entries = 1024
        self._orderbook_cache_max_entries = 256
        self._recent_trade_cache_max_entries = 256
        self._announcement_cache_max_entries = 64
        self._instrument_cache_max_entries = 256
        self._candle_history_cache_max_entries = 1024
        self._history_prime_lock = threading.Lock()
        self._history_prime_thread: Optional[threading.Thread] = None

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

    @staticmethod
    def interval_for_timeframe(timeframe: str) -> str:
        normalized = BybitPublicMarketClient.normalize_timeframe(timeframe)
        return {
            "15m": "15",
            "1h": "60",
            "4h": "240",
            "1d": "D",
        }[normalized]

    @staticmethod
    def _category_for_market(market: str) -> str:
        return "spot" if market == "spot" else "linear"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).astimezone().isoformat()

    @staticmethod
    def _cache_symbol(symbol: str) -> str:
        return symbol.upper()

    def _candle_cache_ttl_for_timeframe(self, timeframe: str, *, history: bool = False) -> float:
        normalized = self.normalize_timeframe(timeframe)
        ttl_map = self._candle_history_cache_ttls if history else self._candle_cache_ttls
        return ttl_map.get(normalized, 20.0 if not history else 60.0)

    @staticmethod
    def _prune_cache_locked(cache: Dict[Any, Tuple[float, Any]], max_entries: int) -> None:
        overflow = len(cache) - max_entries
        if overflow <= 0:
            return
        for cache_key, _cached_value in sorted(cache.items(), key=lambda item: item[1][0])[:overflow]:
            cache.pop(cache_key, None)

    def _get_cached_entry(self, cache: Dict[Any, Tuple[float, Any]], cache_key: Any) -> Optional[Tuple[float, Any]]:
        with self._cache_lock:
            return cache.get(cache_key)

    def _set_cached_entry(
        self,
        cache: Dict[Any, Tuple[float, Any]],
        cache_key: Any,
        value: Tuple[float, Any],
        *,
        max_entries: int,
    ) -> None:
        with self._cache_lock:
            cache[cache_key] = value
            self._prune_cache_locked(cache, max_entries)

    @staticmethod
    def _to_float(value: Optional[str], default: float = 0.0) -> float:
        try:
            return float(value) if value not in (None, "") else default
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _format_price(value: float) -> str:
        if value >= 1000:
            return f"{value:,.2f}"
        if value >= 1:
            return f"{value:,.4f}".rstrip("0").rstrip(".")
        return f"{value:,.6f}".rstrip("0").rstrip(".")

    @staticmethod
    def _build_orderbook_stats(
        bids: List[OrderBookLevel],
        asks: List[OrderBookLevel],
    ) -> Dict[str, str]:
        if not bids or not asks:
            return {
                "盘口价差": "--",
                "Top5 买盘占比": "--",
            }

        best_bid = bids[0].price
        best_ask = asks[0].price
        spread = max(best_ask - best_bid, 0.0)
        spread_pct = (spread / best_bid * 100) if best_bid else 0.0
        top_bid_total = sum(level.size for level in bids[:5])
        top_ask_total = sum(level.size for level in asks[:5])
        depth_total = top_bid_total + top_ask_total
        bid_share = (top_bid_total / depth_total * 100) if depth_total else 0.0
        imbalance = top_bid_total - top_ask_total
        imbalance_prefix = "+" if imbalance >= 0 else ""

        return {
            "盘口价差": f"{spread_pct:.3f}% · {spread:.2f}",
            "Top5 买盘占比": f"{bid_share:.1f}% · {imbalance_prefix}{imbalance:.2f}",
        }

    @staticmethod
    def _to_bool(value: object) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        return str(value).strip().lower() in {"1", "true", "yes", "y"}

    def _request(self, path: str, params: Dict[str, object]) -> Dict:
        query = urlencode(params)
        url = f"{self.base_url}{path}?{query}"
        request = Request(url, headers={"User-Agent": "bybit-control-terminal/0.1"})
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Bybit public api request failed: {exc}") from exc

        if payload.get("retCode") != 0:
            raise RuntimeError(payload.get("retMsg") or "Bybit public api returned error")
        return payload.get("result", {})

    def probe_rest_connectivity(self, force: bool = False) -> Dict[str, object]:
        now = time.monotonic()
        with self._cache_lock:
            cached = self._connectivity_probe_cache
        if cached and not force and now - cached[0] < self._connectivity_probe_cache_ttl:
            return dict(cached[1])

        tested_at = self._now_iso()
        try:
            self._request("/v5/market/time", {})
        except RuntimeError as exc:
            result: Dict[str, object] = {
                "reachable": False,
                "last_error": str(exc),
                "tested_at": tested_at,
            }
        else:
            result = {
                "reachable": True,
                "last_error": None,
                "tested_at": tested_at,
            }
        with self._cache_lock:
            self._connectivity_probe_cache = (now, dict(result))
        return dict(result)

    def get_ticker(self, symbol: str, market: str) -> Dict:
        result = self._request(
            "/v5/market/tickers",
            {"category": self._category_for_market(market), "symbol": symbol},
        )
        items = result.get("list", [])
        if not items:
            raise RuntimeError(f"Ticker not found for {symbol}")
        return items[0]

    def get_ticker_cached(self, symbol: str, market: str) -> Dict:
        cache_key = (self._cache_symbol(symbol), market)
        cached = self._get_cached_entry(self._ticker_cache, cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self._ticker_cache_ttl:
            return dict(cached[1])

        try:
            ticker = self.get_ticker(symbol, market)
        except RuntimeError:
            if cached:
                return dict(cached[1])
            raise

        self._set_cached_entry(
            self._ticker_cache,
            cache_key,
            (now, dict(ticker)),
            max_entries=self._ticker_cache_max_entries,
        )
        return dict(ticker)

    def _build_candle_points(self, rows: List[List[str]]) -> List[CandlePoint]:
        candles: List[CandlePoint] = []
        for row in reversed(rows):
            if len(row) < 6:
                continue
            candles.append(
                CandlePoint(
                    time=datetime.fromtimestamp(int(row[0]) / 1000, tz=timezone.utc).astimezone().isoformat(),
                    open=self._to_float(row[1]),
                    high=self._to_float(row[2]),
                    low=self._to_float(row[3]),
                    close=self._to_float(row[4]),
                    volume=self._to_float(row[5]),
                )
            )
        return candles

    def get_candles_page(
        self,
        symbol: str,
        market: str,
        interval: str = "60",
        limit: int = 48,
        end: Optional[int] = None,
    ) -> List[CandlePoint]:
        params: Dict[str, object] = {
            "category": self._category_for_market(market),
            "symbol": symbol,
            "interval": interval,
            "limit": max(1, min(int(limit), self._candle_page_limit)),
        }
        if end is not None:
            params["end"] = int(end)
        result = self._request(
            "/v5/market/kline",
            params,
        )
        rows = result.get("list", [])
        return self._build_candle_points(rows)

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> List[CandlePoint]:
        return self.get_candles_page(symbol, market, interval=interval, limit=limit)

    def get_candles_cached(self, symbol: str, market: str, timeframe: str = "1h", limit: int = 48) -> List[CandlePoint]:
        normalized_timeframe = self.normalize_timeframe(timeframe)
        interval = self.interval_for_timeframe(normalized_timeframe)
        cache_key = (self._cache_symbol(symbol), market, interval, limit)
        cached = self._get_cached_entry(self._candle_cache, cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self._candle_cache_ttl_for_timeframe(normalized_timeframe):
            return list(cached[1])

        try:
            candles = self.get_candles(symbol, market, interval=interval, limit=limit)
        except RuntimeError:
            if cached:
                return list(cached[1])
            raise
        self._set_cached_entry(
            self._candle_cache,
            cache_key,
            (now, list(candles)),
            max_entries=self._candle_cache_max_entries,
        )
        return candles

    def get_candles_history(self, symbol: str, market: str, timeframe: str = "1h", limit: int = 48) -> List[CandlePoint]:
        normalized_timeframe = self.normalize_timeframe(timeframe)
        target_limit = max(int(limit), 1)
        cache_key = (self._cache_symbol(symbol), market, normalized_timeframe, target_limit)
        cached = self._get_cached_entry(self._candle_history_cache, cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self._candle_cache_ttl_for_timeframe(normalized_timeframe, history=True):
            return list(cached[1])

        interval = self.interval_for_timeframe(normalized_timeframe)
        remaining = target_limit
        page_end: Optional[int] = None
        candles_by_time: Dict[str, CandlePoint] = {}
        previous_oldest_time: Optional[str] = None
        while remaining > 0:
            page_limit = min(remaining, self._candle_page_limit)
            page = self.get_candles_page(symbol, market, interval=interval, limit=page_limit, end=page_end)
            if not page:
                break
            for candle in page:
                candles_by_time[candle.time] = candle
            oldest_time = page[0].time
            if previous_oldest_time == oldest_time:
                break
            previous_oldest_time = oldest_time
            if len(page) < page_limit:
                break
            oldest_dt = datetime.fromisoformat(oldest_time)
            page_end = int(oldest_dt.timestamp() * 1000) - 1
            remaining = target_limit - len(candles_by_time)

        candles = sorted(candles_by_time.values(), key=lambda item: item.time)
        if len(candles) > target_limit:
            candles = candles[-target_limit:]
        self._set_cached_entry(
            self._candle_history_cache,
            cache_key,
            (now, list(candles)),
            max_entries=self._candle_history_cache_max_entries,
        )
        return candles

    def get_orderbook(self, symbol: str, market: str, limit: int = 8) -> Dict[str, List[OrderBookLevel]]:
        realtime_orderbook = self.realtime.get_orderbook_snapshot(symbol, limit=limit, market=market)
        if realtime_orderbook["bids"] and realtime_orderbook["asks"]:
            return realtime_orderbook

        result = self._request(
            "/v5/market/orderbook",
            {
                "category": self._category_for_market(market),
                "symbol": symbol,
                "limit": limit,
            },
        )

        def build_levels(entries: List[List[str]]) -> List[OrderBookLevel]:
            total = 0.0
            levels: List[OrderBookLevel] = []
            for price_text, size_text in entries:
                size = self._to_float(size_text)
                total += size
                levels.append(
                    OrderBookLevel(
                        price=self._to_float(price_text),
                        size=size,
                        total=round(total, 6),
                    )
                )
            return levels

        return {
            "bids": build_levels(result.get("b", [])),
            "asks": build_levels(result.get("a", [])),
        }

    def get_orderbook_cached(self, symbol: str, market: str, limit: int = 8) -> Dict[str, List[OrderBookLevel]]:
        cache_key = (self._cache_symbol(symbol), market, limit)
        cached = self._get_cached_entry(self._orderbook_cache, cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self._orderbook_cache_ttl:
            return {
                "bids": list(cached[1]["bids"]),
                "asks": list(cached[1]["asks"]),
            }

        try:
            orderbook = self.get_orderbook(symbol, market, limit=limit)
        except RuntimeError:
            if cached:
                return {
                    "bids": list(cached[1]["bids"]),
                    "asks": list(cached[1]["asks"]),
                }
            raise

        cached_value = {
            "bids": list(orderbook.get("bids", [])),
            "asks": list(orderbook.get("asks", [])),
        }
        self._set_cached_entry(
            self._orderbook_cache,
            cache_key,
            (now, cached_value),
            max_entries=self._orderbook_cache_max_entries,
        )
        return {
            "bids": list(cached_value["bids"]),
            "asks": list(cached_value["asks"]),
        }

    def get_recent_public_trades(self, symbol: str, market: str, limit: int = 12) -> List[MarketRecentTrade]:
        realtime_trades = self.realtime.get_recent_trades_snapshot(symbol, limit=limit, market=market)
        if realtime_trades:
            return realtime_trades

        cache_key = (self._cache_symbol(symbol), market, limit)
        cached = self._get_cached_entry(self._recent_trade_cache, cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self._recent_trade_cache_ttl:
            return list(cached[1])

        try:
            result = self._request(
                "/v5/market/recent-trade",
                {
                    "category": self._category_for_market(market),
                    "symbol": symbol,
                    "limit": limit,
                },
            )
        except RuntimeError:
            if cached:
                return list(cached[1])
            raise

        rows = result.get("list", [])
        trades: List[MarketRecentTrade] = []
        for row in rows:
            side = str(row.get("side") or row.get("S") or "Buy").strip().lower()
            occurred_at_raw = row.get("time") or row.get("T") or row.get("execTime")
            occurred_at = self._now_iso()
            try:
                if occurred_at_raw is not None:
                    occurred_at = (
                        datetime.fromtimestamp(int(float(occurred_at_raw)) / 1000, tz=timezone.utc)
                        .astimezone()
                        .isoformat()
                    )
            except (TypeError, ValueError):
                occurred_at = self._now_iso()

            price = self._to_float(row.get("price") or row.get("p"))
            size = self._to_float(row.get("size") or row.get("v"))
            trades.append(
                MarketRecentTrade(
                    side="sell" if side.startswith("sell") else "buy",
                    price=price,
                    size=size,
                    value=round(price * size, 6),
                    occurred_at=occurred_at,
                    is_block_trade=self._to_bool(
                        row.get("isBlockTrade")
                        if row.get("isBlockTrade") is not None
                        else row.get("BT")
                    ),
                )
            )

        ordered = sorted(trades, key=lambda item: item.occurred_at, reverse=True)
        self._set_cached_entry(
            self._recent_trade_cache,
            cache_key,
            (now, list(ordered)),
            max_entries=self._recent_trade_cache_max_entries,
        )
        return ordered

    def get_announcements(self, locale: str = "zh-TW", limit: int = 8) -> List[Dict]:
        cache_key = (locale, limit)
        cached = self._get_cached_entry(self._announcement_cache, cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self._announcement_cache_ttl:
            return list(cached[1])

        result = self._request(
            "/v5/announcements/index",
            {
                "locale": locale,
                "limit": limit,
            },
        )
        rows = result.get("list", [])
        normalized = []
        for row in rows:
            row_copy = dict(row)
            if not row_copy.get("id"):
                raw_key = str(row_copy.get("url") or row_copy.get("title") or md5(json.dumps(row_copy, ensure_ascii=False).encode("utf-8")).hexdigest())
                row_copy["id"] = f"ann-{md5(raw_key.encode('utf-8')).hexdigest()[:10]}"
            normalized.append(row_copy)
        self._set_cached_entry(
            self._announcement_cache,
            cache_key,
            (now, list(normalized)),
            max_entries=self._announcement_cache_max_entries,
        )
        return normalized

    def get_instrument_constraints(self, symbol: str, market: str) -> Dict[str, str]:
        cache_key = (symbol.upper(), market)
        cached = self._get_cached_entry(self._instrument_cache, cache_key)
        now = time.monotonic()
        if cached and now - cached[0] < self._instrument_cache_ttl:
            return dict(cached[1])

        result = self._request(
            "/v5/market/instruments-info",
            {
                "category": self._category_for_market(market),
                "symbol": symbol.upper(),
                "limit": 1,
            },
        )
        items = result.get("list", [])
        if not items:
            raise RuntimeError(f"Instrument info not found for {symbol}")
        item = items[0]
        lot_filter = item.get("lotSizeFilter") if isinstance(item.get("lotSizeFilter"), dict) else {}
        price_filter = item.get("priceFilter") if isinstance(item.get("priceFilter"), dict) else {}
        constraints = {
            "symbol": str(item.get("symbol") or symbol.upper()),
            "market": market,
            "tick_size": str(price_filter.get("tickSize") or "0"),
            "qty_step": str(lot_filter.get("qtyStep") or "0"),
            "min_order_qty": str(lot_filter.get("minOrderQty") or "0"),
            "min_notional_value": str(
                lot_filter.get("minNotionalValue")
                or lot_filter.get("minOrderAmt")
                or "0"
            ),
        }
        self._set_cached_entry(
            self._instrument_cache,
            cache_key,
            (now, dict(constraints)),
            max_entries=self._instrument_cache_max_entries,
        )
        return constraints

    def enrich_watchlist(self, watchlist: List[WatchlistInstrument]) -> List[WatchlistInstrument]:
        self.realtime.update_watchlist(watchlist)
        realtime_watchlist = {
            (item.symbol.upper(), item.market): item for item in self.realtime.enrich_watchlist(watchlist)
        }

        enriched: List[WatchlistInstrument] = []
        for item in watchlist:
            if self.realtime.has_ticker(item.symbol, market=item.market):
                enriched.append(realtime_watchlist.get((item.symbol.upper(), item.market), item))
                continue
            try:
                ticker = self.get_ticker(item.symbol, item.market)
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
            except RuntimeError:
                enriched.append(item)
        return enriched

    def enrich_watchlist_fast(self, watchlist: List[WatchlistInstrument]) -> List[WatchlistInstrument]:
        self.realtime.update_watchlist(watchlist)
        self.schedule_watchlist_history_prime(watchlist)
        realtime_watchlist = {
            (item.symbol.upper(), item.market): item for item in self.realtime.enrich_watchlist(watchlist)
        }

        enriched: List[WatchlistInstrument] = []
        for item in watchlist:
            realtime_item = realtime_watchlist.get((item.symbol.upper(), item.market))
            if realtime_item is not None:
                enriched.append(realtime_item)
                continue
            cached_ticker = self.get_ticker_cached_only(item.symbol, item.market)
            if cached_ticker:
                enriched.append(
                    item.model_copy(
                        update={
                            "last_price": self._to_float(cached_ticker.get("lastPrice"), item.last_price),
                            "change_24h": round(
                                self._to_float(cached_ticker.get("price24hPcnt"), item.change_24h / 100.0) * 100,
                                2,
                            ),
                            "volume_24h": self._to_float(
                                cached_ticker.get("turnover24h") or cached_ticker.get("volume24h"),
                                item.volume_24h,
                            ),
                        }
                    )
                )
                continue
            enriched.append(item)
        return enriched

    def _prime_watchlist_history_cache(self, watchlist: List[WatchlistInstrument]) -> None:
        def prime_symbol_timeframe(item: WatchlistInstrument, timeframe: str) -> None:
            try:
                candles = self.get_candles_history(item.symbol, item.market, timeframe=timeframe)
                interval = self.interval_for_timeframe(timeframe)
                now = time.monotonic()
                self._set_cached_entry(
                    self._candle_cache,
                    (self._cache_symbol(item.symbol), item.market, interval, 48),
                    (now, list(candles)),
                    max_entries=self._candle_cache_max_entries,
                )
            except RuntimeError:
                return

        tasks = [(item, timeframe) for item in watchlist for timeframe in ("15m", "1h", "4h", "1d")]
        if not tasks:
            return
        with ThreadPoolExecutor(max_workers=min(4, len(tasks))) as executor:
            futures = [executor.submit(prime_symbol_timeframe, item, timeframe) for item, timeframe in tasks]
            for future in futures:
                future.result()

    def schedule_watchlist_history_prime(self, watchlist: List[WatchlistInstrument]) -> None:
        if not watchlist:
            return
        with self._history_prime_lock:
            if self._history_prime_thread and self._history_prime_thread.is_alive():
                return
            snapshot = [item.model_copy() for item in watchlist]
            thread = threading.Thread(
                target=self._prime_watchlist_history_cache,
                args=(snapshot,),
                name="bybit-public-history-primer",
                daemon=True,
            )
            self._history_prime_thread = thread
            thread.start()

    def get_ticker_cached_only(self, symbol: str, market: str) -> Optional[Dict[str, object]]:
        cached = self._get_cached_entry(self._ticker_cache, (self._cache_symbol(symbol), market))
        return dict(cached[1]) if cached else None

    def get_candles_cached_only(
        self,
        symbol: str,
        market: str,
        timeframe: str = "1h",
        limit: int = 48,
    ) -> List[CandlePoint]:
        normalized_timeframe = self.normalize_timeframe(timeframe)
        target_limit = max(int(limit), 1)
        history_cached = self._get_cached_entry(
            self._candle_history_cache,
            (self._cache_symbol(symbol), market, normalized_timeframe, target_limit),
        )
        if history_cached:
            return list(history_cached[1])
        interval = self.interval_for_timeframe(normalized_timeframe)
        candle_cached = self._get_cached_entry(
            self._candle_cache,
            (self._cache_symbol(symbol), market, interval, target_limit),
        )
        return list(candle_cached[1]) if candle_cached else []

    def get_orderbook_cached_only(self, symbol: str, market: str, limit: int = 8) -> Dict[str, List[OrderBookLevel]]:
        cached = self._get_cached_entry(self._orderbook_cache, (self._cache_symbol(symbol), market, limit))
        if not cached:
            return {"bids": [], "asks": []}
        return {
            "bids": list(cached[1].get("bids", [])),
            "asks": list(cached[1].get("asks", [])),
        }

    def get_recent_public_trades_cached_only(
        self,
        symbol: str,
        market: str,
        limit: int = 12,
    ) -> List[MarketRecentTrade]:
        cached = self._get_cached_entry(self._recent_trade_cache, (self._cache_symbol(symbol), market, limit))
        return list(cached[1]) if cached else []

    def enrich_market_detail(
        self,
        symbol: str,
        market: str,
        fallback_detail: MarketDetail,
        watch_item: Optional[WatchlistInstrument] = None,
        timeframe: str = "1h",
        allow_rest_refresh: bool = True,
    ) -> MarketDetail:
        normalized_timeframe = self.normalize_timeframe(timeframe)
        realtime_ticker = self.realtime.get_ticker_snapshot(symbol, market=market)
        realtime_orderbook = self.realtime.get_orderbook_snapshot(symbol, limit=8, market=market)
        realtime_trades = self.realtime.get_recent_trades_snapshot(symbol, limit=12, market=market)
        has_realtime_orderbook = bool(realtime_orderbook["bids"] and realtime_orderbook["asks"])
        has_realtime_trades = bool(realtime_trades)
        if realtime_ticker is not None or has_realtime_orderbook or has_realtime_trades:
            try:
                orderbook = (
                    realtime_orderbook
                    if has_realtime_orderbook
                    else self.get_orderbook_cached_only(symbol, market, limit=8)
                )
            except RuntimeError:
                orderbook = {"bids": fallback_detail.bids, "asks": fallback_detail.asks}
            try:
                recent_public_trades = (
                    list(realtime_trades)
                    if has_realtime_trades
                    else self.get_recent_public_trades_cached_only(symbol, market, limit=12)
                )
            except RuntimeError:
                recent_public_trades = fallback_detail.recent_public_trades
            try:
                ticker = realtime_ticker or self.get_ticker_cached_only(symbol, market) or {}
            except RuntimeError:
                ticker = {}

            history_candles: List[CandlePoint]
            try:
                history_candles = (
                    self.get_candles_cached_only(symbol, market, timeframe=normalized_timeframe)
                    if not allow_rest_refresh
                    else self.get_candles_cached(symbol, market, timeframe=normalized_timeframe)
                )
            except RuntimeError:
                history_candles = fallback_detail.candles

            merged_candles = self.realtime.merge_candles(
                symbol,
                history_candles,
                market=market,
                timeframe=normalized_timeframe,
            )
            if not history_candles and len(merged_candles) <= 1:
                merged_candles = []
            rescued_by_rest = False
            if not merged_candles and allow_rest_refresh:
                try:
                    merged_candles = list(
                        self.get_candles(
                            symbol,
                            market,
                            interval=self.interval_for_timeframe(normalized_timeframe),
                            limit=48,
                        )
                    )
                    rescued_by_rest = bool(merged_candles)
                except RuntimeError:
                    merged_candles = []
                    rescued_by_rest = False
            effective_candles = merged_candles or list(fallback_detail.candles)

            high_price = self._to_float(ticker.get("highPrice24h"))
            low_price = self._to_float(ticker.get("lowPrice24h"))
            amplitude = ((high_price - low_price) / low_price * 100) if low_price else 0.0
            headline_suffix = "策略跟踪" if watch_item and watch_item.signal != "neutral" else "观察"
            live_bids = orderbook["bids"] or fallback_detail.bids
            live_asks = orderbook["asks"] or fallback_detail.asks
            stats: Dict[str, str] = {
                "数据源": "Bybit WS + REST",
                **self._build_orderbook_stats(live_bids, live_asks),
                "24h振幅": f"{amplitude:.2f}%",
                "24h高点": self._format_price(high_price) if high_price else "--",
                "24h低点": self._format_price(low_price) if low_price else "--",
            }
            funding_rate = ticker.get("fundingRate")
            if funding_rate not in (None, ""):
                stats["资金费率"] = f"{self._to_float(funding_rate) * 100:.4f}%"
            open_interest_value = self._to_float(ticker.get("openInterestValue"))
            if open_interest_value:
                stats["持仓价值"] = f"{open_interest_value / 1_000_000_000:.2f}B"
            if rescued_by_rest:
                stats["数据源"] = "Bybit REST K 线 + 实时深度"
            elif not merged_candles:
                fallback_data_source = fallback_detail.stats.get("数据源")
                stats["数据源"] = (
                    str(fallback_data_source).strip()
                    if isinstance(fallback_data_source, str) and fallback_data_source.strip()
                    else ("Bybit 本地缓存" if fallback_detail.source in {"bybit_ws", "bybit_rest"} else "Bybit 实时拉取待恢复")
                )

            return fallback_detail.model_copy(
                update={
                    "timeframe": normalized_timeframe,
                    "candles": effective_candles,
                    "bids": live_bids,
                    "asks": live_asks,
                    "recent_public_trades": recent_public_trades or fallback_detail.recent_public_trades,
                    "headline": (
                        f"{symbol} 当前由 Bybit 公共行情驱动，处于{headline_suffix}状态"
                        if rescued_by_rest
                        else
                        f"{symbol} 当前由 Bybit 公共实时行情驱动，处于{headline_suffix}状态"
                        if merged_candles
                        else fallback_detail.headline
                    ),
                    "stats": stats if merged_candles else {**fallback_detail.stats, **stats},
                    "source": "bybit_rest" if rescued_by_rest else ("bybit_ws" if merged_candles else fallback_detail.source),
                    "updated_at": (
                        self.realtime.get_symbol_last_message_at(symbol, market=market)
                        if hasattr(self.realtime, "get_symbol_last_message_at")
                        else None
                    )
                    or self.realtime.get_status().get("last_message_at")
                    or self._now_iso(),
                }
            )

        if not allow_rest_refresh:
            cached_orderbook = self.get_orderbook_cached_only(symbol, market, limit=8)
            cached_trades = self.get_recent_public_trades_cached_only(symbol, market, limit=12)
            cached_ticker = self.get_ticker_cached_only(symbol, market) or {}
            cached_candles = self.get_candles_cached_only(symbol, market, timeframe=normalized_timeframe)
            merged_candles = self.realtime.merge_candles(
                symbol,
                cached_candles or fallback_detail.candles,
                market=market,
                timeframe=normalized_timeframe,
            )
            live_bids = cached_orderbook["bids"] or fallback_detail.bids
            live_asks = cached_orderbook["asks"] or fallback_detail.asks
            stats: Dict[str, str] = {
                "数据源": "本地快照",
                **self._build_orderbook_stats(live_bids, live_asks),
            }
            high_price = self._to_float(cached_ticker.get("highPrice24h"))
            low_price = self._to_float(cached_ticker.get("lowPrice24h"))
            amplitude = ((high_price - low_price) / low_price * 100) if low_price else 0.0
            if high_price or low_price:
                stats.update(
                    {
                        "24h振幅": f"{amplitude:.2f}%",
                        "24h高点": self._format_price(high_price) if high_price else "--",
                        "24h低点": self._format_price(low_price) if low_price else "--",
                    }
                )
            funding_rate = cached_ticker.get("fundingRate")
            if funding_rate not in (None, ""):
                stats["资金费率"] = f"{self._to_float(funding_rate) * 100:.4f}%"
            open_interest_value = self._to_float(cached_ticker.get("openInterestValue"))
            if open_interest_value:
                stats["持仓价值"] = f"{open_interest_value / 1_000_000_000:.2f}B"

            return fallback_detail.model_copy(
                update={
                    "timeframe": normalized_timeframe,
                    "candles": merged_candles or fallback_detail.candles,
                    "bids": live_bids,
                    "asks": live_asks,
                    "recent_public_trades": cached_trades or fallback_detail.recent_public_trades,
                    "headline": fallback_detail.headline,
                    "stats": {**fallback_detail.stats, **stats},
                    "source": fallback_detail.source,
                    "updated_at": (
                        self.realtime.get_symbol_last_message_at(symbol, market=market)
                        if hasattr(self.realtime, "get_symbol_last_message_at")
                        else None
                    )
                    or fallback_detail.updated_at,
                }
            )

        ticker = self.get_ticker_cached(symbol, market)
        candles = self.get_candles_cached(symbol, market, timeframe=normalized_timeframe)
        orderbook = self.get_orderbook_cached(symbol, market)
        recent_public_trades = self.get_recent_public_trades(symbol, market)
        updated_at = self._now_iso()

        high_price = self._to_float(ticker.get("highPrice24h"))
        low_price = self._to_float(ticker.get("lowPrice24h"))
        amplitude = ((high_price - low_price) / low_price * 100) if low_price else 0.0
        headline_suffix = "策略跟踪" if watch_item and watch_item.signal != "neutral" else "观察"
        rest_bids = orderbook["bids"] or fallback_detail.bids
        rest_asks = orderbook["asks"] or fallback_detail.asks

        stats: Dict[str, str] = {
            "数据源": "Bybit REST",
            **self._build_orderbook_stats(rest_bids, rest_asks),
            "24h振幅": f"{amplitude:.2f}%",
            "24h高点": self._format_price(high_price) if high_price else "--",
            "24h低点": self._format_price(low_price) if low_price else "--",
        }
        funding_rate = ticker.get("fundingRate")
        if funding_rate not in (None, ""):
            stats["资金费率"] = f"{self._to_float(funding_rate) * 100:.4f}%"
        open_interest_value = self._to_float(ticker.get("openInterestValue"))
        if open_interest_value:
            stats["持仓价值"] = f"{open_interest_value / 1_000_000_000:.2f}B"

        return fallback_detail.model_copy(
            update={
                "timeframe": normalized_timeframe,
                "candles": candles or fallback_detail.candles,
                "bids": rest_bids,
                "asks": rest_asks,
                "recent_public_trades": recent_public_trades or fallback_detail.recent_public_trades,
                "headline": f"{symbol} 当前由 Bybit 公共行情驱动，处于{headline_suffix}状态",
                "stats": stats,
                "source": "bybit_rest",
                "updated_at": updated_at,
            }
        )

    def start_realtime(self, watchlist: List[WatchlistInstrument]) -> bool:
        return self.realtime.start(watchlist)

    def stop_realtime(self) -> None:
        self.realtime.stop()

    def update_realtime_watchlist(self, watchlist: List[WatchlistInstrument]) -> None:
        self.realtime.update_watchlist(watchlist)

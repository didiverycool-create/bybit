from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from models import CandlePoint, MarketDetail, OrderBookLevel, WatchlistInstrument


class BybitPublicMarketClient:
    def __init__(self, base_url: str = "https://api.bybit.com", timeout: float = 4.0) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    @staticmethod
    def _category_for_market(market: str) -> str:
        return "spot" if market == "spot" else "linear"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).astimezone().isoformat()

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

    def _request(self, path: str, params: Dict[str, object]) -> Dict:
        query = urlencode(params)
        url = f"{self.base_url}{path}?{query}"
        request = Request(url, headers={"User-Agent": "bybit-control-terminal/0.1"})
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"Bybit public api request failed: {exc}") from exc

        if payload.get("retCode") != 0:
            raise RuntimeError(payload.get("retMsg") or "Bybit public api returned error")
        return payload.get("result", {})

    def get_ticker(self, symbol: str, market: str) -> Dict:
        result = self._request(
            "/v5/market/tickers",
            {"category": self._category_for_market(market), "symbol": symbol},
        )
        items = result.get("list", [])
        if not items:
            raise RuntimeError(f"Ticker not found for {symbol}")
        return items[0]

    def get_candles(self, symbol: str, market: str, interval: str = "60", limit: int = 48) -> List[CandlePoint]:
        result = self._request(
            "/v5/market/kline",
            {
                "category": self._category_for_market(market),
                "symbol": symbol,
                "interval": interval,
                "limit": limit,
            },
        )
        rows = result.get("list", [])
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

    def get_orderbook(self, symbol: str, market: str, limit: int = 8) -> Dict[str, List[OrderBookLevel]]:
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

    def enrich_watchlist(self, watchlist: List[WatchlistInstrument]) -> List[WatchlistInstrument]:
        enriched: List[WatchlistInstrument] = []
        for item in watchlist:
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

    def enrich_market_detail(
        self,
        symbol: str,
        market: str,
        fallback_detail: MarketDetail,
        watch_item: Optional[WatchlistInstrument] = None,
    ) -> MarketDetail:
        ticker = self.get_ticker(symbol, market)
        candles = self.get_candles(symbol, market)
        orderbook = self.get_orderbook(symbol, market)
        updated_at = self._now_iso()

        high_price = self._to_float(ticker.get("highPrice24h"))
        low_price = self._to_float(ticker.get("lowPrice24h"))
        amplitude = ((high_price - low_price) / low_price * 100) if low_price else 0.0
        headline_suffix = "策略跟踪" if watch_item and watch_item.signal != "neutral" else "观察"

        stats: Dict[str, str] = {
            "数据源": "Bybit REST",
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
                "timeframe": "1h",
                "candles": candles or fallback_detail.candles,
                "bids": orderbook["bids"] or fallback_detail.bids,
                "asks": orderbook["asks"] or fallback_detail.asks,
                "headline": f"{symbol} 当前由 Bybit 公共行情驱动，处于{headline_suffix}状态",
                "stats": stats,
                "source": "bybit_rest",
                "updated_at": updated_at,
            }
        )

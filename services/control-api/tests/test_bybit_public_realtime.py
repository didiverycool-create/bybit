from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import bybit_public_realtime  # type: ignore  # noqa: E402


class FakeWebSocket:
    def __init__(self, owner: bybit_public_realtime.BybitPublicRealtimeClient) -> None:
        self.owner = owner
        self.sent: list[dict[str, object]] = []
        self._recv_count = 0

    def send(self, payload: str) -> None:
        self.sent.append(json.loads(payload))

    def recv(self, timeout: float = 1.0):  # noqa: ARG002 - mirrors websockets API
        self._recv_count += 1
        if self._recv_count == 1:
            return json.dumps({"op": "pong"})
        self.owner._stop_event.set()
        raise TimeoutError("timed out in 1.0s")


class FakeConnectContext:
    def __init__(self, websocket: FakeWebSocket) -> None:
        self.websocket = websocket

    def __enter__(self) -> FakeWebSocket:
        return self.websocket

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class BybitPublicRealtimeUnitTests(unittest.TestCase):
    def test_run_channel_keeps_connection_alive_on_idle_recv_timeout(self) -> None:
        client = bybit_public_realtime.BybitPublicRealtimeClient()
        websocket = FakeWebSocket(client)
        with client._lock:
            client._desired_symbols["linear"] = {"BTCUSDT"}
        mark_calls = 0
        original_mark_channel_message = client._mark_channel_message

        def mark_channel_and_count(channel: str) -> None:
            nonlocal mark_calls
            mark_calls += 1
            original_mark_channel_message(channel)

        with patch.object(
            bybit_public_realtime,
            "connect",
            return_value=FakeConnectContext(websocket),
        ), patch.object(client, "_mark_channel_message", side_effect=mark_channel_and_count):
            client._run_channel("linear")

        status = client.get_status()
        self.assertIsNone(status["last_error"])
        self.assertIsNotNone(status["last_message_at_linear"])
        self.assertEqual(mark_calls, 2)
        self.assertEqual(
            websocket.sent[0],
            {
                "op": "subscribe",
                "args": [
                    "tickers.BTCUSDT",
                    "kline.15.BTCUSDT",
                    "kline.60.BTCUSDT",
                    "kline.240.BTCUSDT",
                    "kline.D.BTCUSDT",
                    "publicTrade.BTCUSDT",
                    "orderbook.50.BTCUSDT",
                ],
            },
        )

    def test_market_scoped_cache_keeps_spot_and_perp_data_separate(self) -> None:
        client = bybit_public_realtime.BybitPublicRealtimeClient()

        client._handle_message(
            json.dumps(
                {
                    "topic": "tickers.BTCUSDT",
                    "data": {"lastPrice": "101.5", "price24hPcnt": "0.01"},
                }
            ),
            "spot",
        )
        client._handle_message(
            json.dumps(
                {
                    "topic": "tickers.BTCUSDT",
                    "data": {"lastPrice": "202.5", "price24hPcnt": "0.02"},
                }
            ),
            "linear",
        )
        client._handle_message(
            json.dumps(
                {
                    "topic": "kline.60.BTCUSDT",
                    "data": [
                        {
                            "start": "1775000000000",
                            "open": "100.0",
                            "high": "102.0",
                            "low": "99.5",
                            "close": "101.5",
                            "volume": "18.2",
                        }
                    ],
                }
            ),
            "spot",
        )
        client._handle_message(
            json.dumps(
                {
                    "topic": "publicTrade.BTCUSDT",
                    "data": [{"T": 1775000000000, "S": "Buy", "p": "202.5", "v": "0.3"}],
                }
            ),
            "linear",
        )
        client._handle_message(
            json.dumps(
                {
                    "topic": "orderbook.50.BTCUSDT",
                    "type": "snapshot",
                    "data": {"b": [["101.4", "1.2"]], "a": [["101.6", "1.4"]]},
                }
            ),
            "spot",
        )

        self.assertFalse(client.has_ticker("BTCUSDT"))
        self.assertIsNone(client.get_symbol_last_message_at("BTCUSDT"))

        spot_ticker = client.get_ticker_snapshot("BTCUSDT", market="spot")
        perp_ticker = client.get_ticker_snapshot("BTCUSDT", market="perp")
        self.assertEqual(spot_ticker["lastPrice"], "101.5")
        self.assertEqual(perp_ticker["lastPrice"], "202.5")

        merged_spot_candles = client.merge_candles("BTCUSDT", [], market="spot")
        self.assertEqual(len(merged_spot_candles), 1)
        self.assertEqual(merged_spot_candles[0].close, 101.5)

        perp_trades = client.get_recent_trades_snapshot("BTCUSDT", market="perp")
        self.assertEqual(len(perp_trades), 1)
        self.assertEqual(perp_trades[0].price, 202.5)

        spot_orderbook = client.get_orderbook_snapshot("BTCUSDT", market="spot")
        self.assertEqual(spot_orderbook["bids"][0].price, 101.4)
        self.assertEqual(spot_orderbook["asks"][0].price, 101.6)

    def test_merge_candles_uses_requested_timeframe(self) -> None:
        client = bybit_public_realtime.BybitPublicRealtimeClient()

        client._handle_message(
            json.dumps(
                {
                    "topic": "kline.15.BTCUSDT",
                    "data": [
                        {
                            "start": "1775000000000",
                            "open": "100.0",
                            "high": "101.0",
                            "low": "99.0",
                            "close": "100.5",
                            "volume": "11.0",
                        }
                    ],
                }
            ),
            "linear",
        )
        client._handle_message(
            json.dumps(
                {
                    "topic": "kline.240.BTCUSDT",
                    "data": [
                        {
                            "start": "1775003600000",
                            "open": "200.0",
                            "high": "205.0",
                            "low": "198.0",
                            "close": "202.5",
                            "volume": "22.0",
                        }
                    ],
                }
            ),
            "linear",
        )

        merged_15m = client.merge_candles("BTCUSDT", [], market="perp", timeframe="15m")
        merged_4h = client.merge_candles("BTCUSDT", [], market="perp", timeframe="4h")
        merged_1h = client.merge_candles("BTCUSDT", [], market="perp", timeframe="1h")

        self.assertEqual(len(merged_15m), 1)
        self.assertEqual(merged_15m[0].close, 100.5)
        self.assertEqual(len(merged_4h), 1)
        self.assertEqual(merged_4h[0].close, 202.5)
        self.assertEqual(merged_1h, [])


if __name__ == "__main__":
    unittest.main()

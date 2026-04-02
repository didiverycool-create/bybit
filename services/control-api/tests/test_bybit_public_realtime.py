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
                    "kline.60.BTCUSDT",
                    "publicTrade.BTCUSDT",
                    "orderbook.50.BTCUSDT",
                ],
            },
        )


if __name__ == "__main__":
    unittest.main()

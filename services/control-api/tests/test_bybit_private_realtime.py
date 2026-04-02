from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import bybit_private_realtime  # type: ignore  # noqa: E402


class StubPrivateClient:
    def get_websocket_auth_payload(self):
        return {
            "url": "wss://example.invalid/v5/private",
            "message": {"op": "auth", "args": ["key", 1234567890, "signature"]},
        }


class FakeWebSocket:
    def __init__(self, owner: bybit_private_realtime.BybitPrivateRealtimeClient) -> None:
        self.owner = owner
        self.sent: list[dict[str, object]] = []
        self._recv_count = 0

    def send(self, payload: str) -> None:
        self.sent.append(json.loads(payload))

    def recv(self, timeout: float = 1.0):  # noqa: ARG002 - mirrors websockets API
        self._recv_count += 1
        if self._recv_count == 1:
            return json.dumps({"op": "auth", "success": True})
        if self._recv_count == 2:
            return json.dumps({"op": "subscribe", "success": True})
        self.owner._stop_event.set()
        raise TimeoutError("timed out in 1.0s")


class FakeConnectContext:
    def __init__(self, websocket: FakeWebSocket) -> None:
        self.websocket = websocket

    def __enter__(self) -> FakeWebSocket:
        return self.websocket

    def __exit__(self, exc_type, exc, tb) -> bool:  # noqa: ANN001
        return False


class BybitPrivateRealtimeUnitTests(unittest.TestCase):
    def test_run_once_keeps_connection_alive_on_idle_recv_timeout(self) -> None:
        client = bybit_private_realtime.BybitPrivateRealtimeClient(StubPrivateClient())
        websocket = FakeWebSocket(client)
        mark_calls = 0
        original_mark_message = client._mark_message

        def mark_message_and_count() -> None:
            nonlocal mark_calls
            mark_calls += 1
            original_mark_message()

        with patch.object(
            bybit_private_realtime,
            "connect",
            return_value=FakeConnectContext(websocket),
        ), patch.object(client, "_mark_message", side_effect=mark_message_and_count):
            client._run_once()

        status = client.get_status()
        self.assertTrue(status["connected"])
        self.assertTrue(status["authenticated"])
        self.assertIsNone(status["last_error"])
        self.assertEqual(mark_calls, 3)
        self.assertEqual(websocket.sent[0]["op"], "auth")
        self.assertEqual(
            websocket.sent[1],
            {"op": "subscribe", "args": ["wallet", "position", "order", "execution"]},
        )


if __name__ == "__main__":
    unittest.main()

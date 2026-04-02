from __future__ import annotations

import json
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bybit_private_client import BybitPrivateClient

try:
    from websockets.sync.client import connect
except Exception:  # pragma: no cover - graceful fallback when dependency isn't installed
    connect = None


class BybitPrivateRealtimeClient:
    def __init__(self, client: BybitPrivateClient) -> None:
        self.client = client
        self.enabled = connect is not None
        self._lock = threading.Lock()
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._connected = False
        self._authenticated = False
        self._last_error: Optional[str] = None
        self._last_message_at: Optional[str] = None
        self._wallet_snapshot: Optional[Dict[str, Any]] = None
        self._positions: Dict[str, Dict[str, Any]] = {}
        self._open_orders: Dict[str, Dict[str, Any]] = {}
        self._executions: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).astimezone().isoformat()

    @staticmethod
    def _coerce_float(value: Any, default: float = 0.0) -> float:
        try:
            return float(value) if value not in (None, "") else default
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _position_key(item: Dict[str, Any]) -> str:
        symbol = str(item.get("symbol") or "--")
        side = str(item.get("side") or "--")
        position_idx = str(item.get("positionIdx") or "0")
        category = str(item.get("category") or "linear")
        return f"{category}:{symbol}:{side}:{position_idx}"

    @staticmethod
    def _order_key(item: Dict[str, Any]) -> str:
        return str(item.get("orderId") or item.get("id") or f"order-{hash(json.dumps(item, sort_keys=True, ensure_ascii=False))}")

    @staticmethod
    def _execution_key(item: Dict[str, Any]) -> str:
        return str(item.get("execId") or item.get("orderId") or f"exec-{hash(json.dumps(item, sort_keys=True, ensure_ascii=False))}")

    @staticmethod
    def _is_order_open(item: Dict[str, Any]) -> bool:
        status = str(item.get("orderStatus") or "").strip().lower()
        return status not in {
            "",
            "filled",
            "cancelled",
            "rejected",
            "deactivated",
            "partiallyfilledcanceled",
            "partiallyfilledcancelled",
            "triggered",
        }

    def start(self) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.get_websocket_auth_payload()
        except RuntimeError as exc:
            with self._lock:
                self._last_error = str(exc)
            return False

        thread = self._thread
        if thread and thread.is_alive():
            return True

        self._stop_event.clear()
        thread = threading.Thread(
            target=self._run,
            name="bybit-private-ws",
            daemon=True,
        )
        self._thread = thread
        thread.start()
        return True

    def ensure_started(self) -> bool:
        return self.start()

    def stop(self) -> None:
        self._stop_event.set()

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "enabled": self.enabled,
                "connected": self._connected,
                "authenticated": self._authenticated,
                "last_message_at": self._last_message_at,
                "last_error": self._last_error,
                "has_wallet": self._wallet_snapshot is not None,
                "positions_count": len(self._positions),
                "open_orders_count": len(self._open_orders),
                "executions_count": len(self._executions),
            }

    def get_wallet_snapshot(self) -> Optional[Dict[str, Any]]:
        with self._lock:
            return dict(self._wallet_snapshot) if self._wallet_snapshot is not None else None

    def get_positions_snapshot(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(item) for item in self._positions.values()]

    def get_open_orders_snapshot(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [dict(item) for item in self._open_orders.values()]

    def get_execution_snapshot(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            rows = list(self._executions.values())
        rows.sort(key=lambda item: int(str(item.get("execTime") or item.get("createdTime") or 0)), reverse=True)
        return [dict(item) for item in rows[:limit]]

    def seed_wallet_snapshot(self, wallet: Dict[str, Any]) -> None:
        if not wallet:
            return
        with self._lock:
            self._wallet_snapshot = dict(wallet)

    def seed_positions_snapshot(self, positions: List[Dict[str, Any]]) -> None:
        with self._lock:
            self._positions = {}
            for item in positions:
                if self._coerce_float(item.get("size"), 0.0) <= 0:
                    continue
                self._positions[self._position_key(item)] = dict(item)

    def seed_open_orders_snapshot(self, orders: List[Dict[str, Any]]) -> None:
        with self._lock:
            self._open_orders = {}
            for item in orders:
                if not self._is_order_open(item):
                    continue
                self._open_orders[self._order_key(item)] = dict(item)

    def seed_execution_snapshot(self, executions: List[Dict[str, Any]]) -> None:
        with self._lock:
            self._executions = {}
            for item in executions:
                self._executions[self._execution_key(item)] = dict(item)

    def _mark_message(self) -> None:
        with self._lock:
            self._last_message_at = self._now_iso()
            self._last_error = None

    def _set_connected(self, connected: bool, authenticated: Optional[bool] = None, error: Optional[str] = None) -> None:
        with self._lock:
            self._connected = connected
            if authenticated is not None:
                self._authenticated = authenticated
            if error is not None:
                self._last_error = error

    def _run(self) -> None:
        while not self._stop_event.is_set():
            try:
                self._run_once()
            except Exception as exc:  # pragma: no cover - network reconnect loop
                self._set_connected(False, authenticated=False, error=str(exc))
                time.sleep(2.0)

    def _run_once(self) -> None:
        if connect is None:  # pragma: no cover - dependency fallback
            return

        auth_payload = self.client.get_websocket_auth_payload()
        with connect(
            auth_payload["url"],
            open_timeout=8,
            ping_interval=20,
            ping_timeout=20,
            close_timeout=5,
            max_size=2_000_000,
            user_agent_header="bybit-control-terminal/0.1",
        ) as websocket:
            websocket.send(json.dumps(auth_payload["message"], ensure_ascii=False))
            authenticated = False
            subscribed = False
            topics = ["wallet", "position", "order", "execution"]

            while not self._stop_event.is_set():
                try:
                    message = websocket.recv(timeout=1.0)
                except TimeoutError:
                    # Private topics may stay quiet for a while; rely on the stale
                    # threshold instead of treating a short idle read as disconnect.
                    if authenticated and subscribed:
                        self._set_connected(True, authenticated=True)
                        self._mark_message()
                    continue
                if message is None:
                    continue
                payload = json.loads(message)
                topic = str(payload.get("topic") or "")

                if payload.get("op") == "auth":
                    success = bool(payload.get("success"))
                    if not success:
                        raise RuntimeError(payload.get("ret_msg") or payload.get("retMsg") or "Bybit 私有 WS 鉴权失败")
                    authenticated = True
                    self._set_connected(True, authenticated=True)
                    self._mark_message()
                    websocket.send(json.dumps({"op": "subscribe", "args": topics}, ensure_ascii=False))
                    continue

                if payload.get("op") == "subscribe":
                    if not bool(payload.get("success")):
                        raise RuntimeError(payload.get("ret_msg") or payload.get("retMsg") or "Bybit 私有 WS 订阅失败")
                    subscribed = True
                    self._set_connected(True, authenticated=authenticated)
                    self._mark_message()
                    continue

                if payload.get("op") == "ping":
                    self._mark_message()
                    websocket.send(json.dumps({"op": "pong"}, ensure_ascii=False))
                    continue
                if payload.get("op") == "pong":
                    self._mark_message()
                    continue

                if not subscribed or not topic:
                    continue

                self._mark_message()
                if topic == "wallet":
                    self._handle_wallet(payload)
                elif topic == "position":
                    self._handle_positions(payload)
                elif topic == "order":
                    self._handle_orders(payload)
                elif topic == "execution":
                    self._handle_executions(payload)

    def _handle_wallet(self, payload: Dict[str, Any]) -> None:
        data = payload.get("data") or []
        if isinstance(data, list) and data:
            preferred_account_type = str(self.client.get_status().account_type or "").upper()
            wallet = next(
                (
                    item
                    for item in data
                    if isinstance(item, dict) and str(item.get("accountType") or "").upper() == preferred_account_type
                ),
                data[0],
            )
            if isinstance(wallet, dict):
                with self._lock:
                    self._wallet_snapshot = dict(wallet)

    def _handle_positions(self, payload: Dict[str, Any]) -> None:
        rows = payload.get("data") or []
        if not isinstance(rows, list):
            return
        with self._lock:
            for item in rows:
                if not isinstance(item, dict):
                    continue
                key = self._position_key(item)
                if self._coerce_float(item.get("size"), 0.0) <= 0:
                    self._positions.pop(key, None)
                    continue
                self._positions[key] = dict(item)

    def _handle_orders(self, payload: Dict[str, Any]) -> None:
        rows = payload.get("data") or []
        if not isinstance(rows, list):
            return
        with self._lock:
            for item in rows:
                if not isinstance(item, dict):
                    continue
                key = self._order_key(item)
                if self._is_order_open(item):
                    self._open_orders[key] = dict(item)
                else:
                    self._open_orders.pop(key, None)

    def _handle_executions(self, payload: Dict[str, Any]) -> None:
        rows = payload.get("data") or []
        if not isinstance(rows, list):
            return
        with self._lock:
            for item in rows:
                if not isinstance(item, dict):
                    continue
                self._executions[self._execution_key(item)] = dict(item)
            if len(self._executions) > 120:
                ordered = sorted(
                    self._executions.values(),
                    key=lambda entry: int(str(entry.get("execTime") or entry.get("createdTime") or 0)),
                    reverse=True,
                )[:80]
                self._executions = {
                    self._execution_key(item): dict(item)
                    for item in ordered
                }

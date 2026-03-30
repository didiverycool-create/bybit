from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from time import time
from typing import Any, Dict, List, Optional
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from models import AccountMode, BybitPrivateStatus, Direction


class BybitPrivateClient:
    def __init__(self, config_path: Optional[Path] = None, recv_window: int = 5000, timeout: float = 5.0) -> None:
        self.config_path = config_path or Path.home() / ".bybit-control" / "private-api.json"
        self.recv_window = recv_window
        self.timeout = timeout
        self._last_error: Optional[str] = None
        self._time_offset_ms: int = 0
        self._time_offset_synced_at: float = 0.0

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).astimezone().isoformat()

    def _load_file_config(self) -> Dict:
        if not self.config_path.exists():
            return {}
        try:
            return json.loads(self.config_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            self._last_error = f"Bybit 私有配置文件不是有效 JSON: {self.config_path}"
            return {}

    def _load_config(self) -> Dict:
        file_config = self._load_file_config()
        config = {
            "api_key": os.getenv("BYBIT_API_KEY") or file_config.get("api_key"),
            "api_secret": os.getenv("BYBIT_API_SECRET") or file_config.get("api_secret"),
            "api_base_url": os.getenv("BYBIT_API_BASE_URL") or file_config.get("api_base_url") or "https://api.bybit.com",
            "account_type": os.getenv("BYBIT_ACCOUNT_TYPE") or file_config.get("account_type") or "UNIFIED",
            "mode": os.getenv("BYBIT_ACTIVE_MODE") or file_config.get("mode"),
            "source": "env"
            if os.getenv("BYBIT_API_KEY") or os.getenv("BYBIT_API_SECRET")
            else ("file" if file_config else "none"),
        }
        return config

    @staticmethod
    def _infer_mode(base_url: str, explicit_mode: Optional[str]) -> AccountMode:
        if explicit_mode in {"paper", "demo", "live"}:
            return AccountMode(explicit_mode)
        lowered = base_url.lower()
        if "demo" in lowered or "testnet" in lowered:
            return AccountMode.DEMO
        return AccountMode.LIVE

    @staticmethod
    def _key_hint(api_key: Optional[str]) -> Optional[str]:
        if not api_key:
            return None
        if len(api_key) <= 8:
            return "*" * len(api_key)
        return f"{api_key[:4]}...{api_key[-4:]}"

    def get_status(self) -> BybitPrivateStatus:
        config = self._load_config()
        api_key = config.get("api_key")
        api_secret = config.get("api_secret")
        api_base_url = config.get("api_base_url") or "https://api.bybit.com"
        mode = self._infer_mode(api_base_url, config.get("mode"))

        return BybitPrivateStatus(
            configured=bool(api_key and api_secret),
            can_query_private=bool(api_key and api_secret),
            source=config.get("source", "none"),
            api_base_url=api_base_url,
            account_type=str(config.get("account_type") or "UNIFIED"),
            mode=mode,
            key_hint=self._key_hint(api_key),
            last_error=self._last_error,
            updated_at=self._now_iso(),
        )

    def _load_required_config(self) -> Dict[str, str]:
        config = self._load_config()
        api_key = config.get("api_key")
        api_secret = config.get("api_secret")
        base_url = str(config.get("api_base_url") or "https://api.bybit.com").rstrip("/")
        if not api_key or not api_secret:
            raise RuntimeError("Bybit 私有 API 未配置")
        return {
            "api_key": str(api_key),
            "api_secret": str(api_secret),
            "base_url": base_url,
        }

    def _get_server_time_ms(self, base_url: str) -> int:
        request = Request(
            f"{base_url}/v5/market/time",
            headers={"User-Agent": "bybit-control-terminal/0.1"},
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            self._last_error = f"Bybit 服务器时间获取失败: {exc}"
            raise RuntimeError(self._last_error) from exc

        if payload.get("retCode") != 0:
            self._last_error = payload.get("retMsg") or "Bybit 时间接口返回错误"
            raise RuntimeError(self._last_error)

        result = payload.get("result", {})
        time_second = result.get("timeSecond")
        time_nano = result.get("timeNano")
        if time_nano:
            return int(str(time_nano)[:13])
        if time_second:
            return int(time_second) * 1000
        raise RuntimeError("Bybit 时间接口未返回可用时间戳")

    def _sync_time_offset(self, force: bool = False) -> None:
        config = self._load_required_config()
        now = time()
        if not force and self._time_offset_synced_at and now - self._time_offset_synced_at < 30:
            return
        server_time_ms = self._get_server_time_ms(config["base_url"])
        local_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        self._time_offset_ms = server_time_ms - local_time_ms
        self._time_offset_synced_at = now

    def _signed_request(
        self,
        method: str,
        path: str,
        *,
        params: Optional[Dict[str, object]] = None,
        body: Optional[Dict[str, Any]] = None,
        retry_on_time_sync: bool = True,
        return_payload: bool = False,
    ) -> Dict:
        config = self._load_required_config()
        self._sync_time_offset()
        timestamp = str(int(datetime.now(timezone.utc).timestamp() * 1000 + self._time_offset_ms))
        query = urlencode(params or {})
        body_text = json.dumps(body or {}, separators=(",", ":"), ensure_ascii=False) if method.upper() == "POST" else ""
        if method.upper() == "POST":
            sign_payload = f"{timestamp}{config['api_key']}{self.recv_window}{body_text}"
        else:
            sign_payload = f"{timestamp}{config['api_key']}{self.recv_window}{query}"
        signature = hmac.new(
            config["api_secret"].encode("utf-8"),
            sign_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        request_url = f"{config['base_url']}{path}"
        if query:
            request_url = f"{request_url}?{query}"

        headers = {
            "X-BAPI-API-KEY": config["api_key"],
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": signature,
            "X-BAPI-RECV-WINDOW": str(self.recv_window),
            "User-Agent": "bybit-control-terminal/0.1",
        }
        payload_data = None
        if method.upper() == "POST":
            headers["Content-Type"] = "application/json"
            payload_data = body_text.encode("utf-8")

        request = Request(
            request_url,
            data=payload_data,
            method=method.upper(),
            headers=headers,
        )

        try:
            with urlopen(request, timeout=self.timeout) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
            self._last_error = f"Bybit 私有 API 请求失败: {exc}"
            raise RuntimeError(self._last_error) from exc

        if payload.get("retCode") != 0:
            error_message = payload.get("retMsg") or "Bybit 私有 API 返回错误"
            self._last_error = error_message
            if retry_on_time_sync and ("server timestamp" in error_message or "recv_window" in error_message):
                self._sync_time_offset(force=True)
                return self._signed_request(
                    method,
                    path,
                    params=params,
                    body=body,
                    retry_on_time_sync=False,
                    return_payload=return_payload,
                )
            if return_payload:
                self._last_error = None
                return payload
            raise RuntimeError(self._last_error)

        self._last_error = None
        return payload if return_payload else payload.get("result", {})

    def _signed_get(self, path: str, params: Dict[str, object]) -> Dict:
        return self._signed_request("GET", path, params=params)

    def _signed_post(self, path: str, body: Dict[str, Any]) -> Dict:
        return self._signed_request("POST", path, body=body)

    def fetch_wallet_balance(self) -> Dict:
        status = self.get_status()
        return self._signed_get(
            "/v5/account/wallet-balance",
            {"accountType": status.account_type},
        )

    def fetch_positions(self) -> List[Dict]:
        positions: List[Dict] = []
        for category, extra in (
            ("linear", {"settleCoin": "USDT"}),
            ("spot", {}),
        ):
            try:
                result = self._signed_get("/v5/position/list", {"category": category, **extra})
            except RuntimeError:
                if category == "linear":
                    raise
                continue
            positions.extend(result.get("list", []))
        return positions

    def fetch_open_orders(self) -> List[Dict]:
        orders: List[Dict] = []
        for category, extra in (
            ("linear", {"settleCoin": "USDT", "openOnly": 0, "limit": 50}),
            ("spot", {"openOnly": 0, "limit": 50}),
        ):
            try:
                result = self._signed_get("/v5/order/realtime", {"category": category, **extra})
            except RuntimeError:
                if category == "linear":
                    raise
                continue
            orders.extend(result.get("list", []))
        return orders

    def create_order(self, body: Dict[str, Any]) -> Dict:
        return self._signed_post("/v5/order/create", body)

    def cancel_order(self, body: Dict[str, Any]) -> Dict:
        return self._signed_post("/v5/order/cancel", body)

    def probe_trade_route(self) -> Dict[str, Any]:
        order_link_id = f"probe-{int(datetime.now(timezone.utc).timestamp())}"
        previous_error = self._last_error
        payload = self._signed_request(
            "POST",
            "/v5/order/create",
            body={
                "category": "spot",
                "symbol": "BTCUSDT",
                "side": "Buy",
                "orderType": "Limit",
                "qty": "0",
                "price": "1000",
                "timeInForce": "GTC",
                "orderLinkId": order_link_id,
            },
            return_payload=True,
        )
        self._last_error = previous_error

        ret_code = int(payload.get("retCode") or 0)
        ret_msg = str(payload.get("retMsg") or "")
        trade_permission = None
        outcome = "authenticated"
        if ret_code == 0:
            outcome = "accepted_unexpectedly"
            trade_permission = True
        elif "permission" in ret_msg.lower() or "api key is invalid" in ret_msg.lower():
            outcome = "permission_denied"
            trade_permission = False
        elif (
            "qty" in ret_msg.lower()
            or "price" in ret_msg.lower()
            or "order" in ret_msg.lower()
            or "not valid" in ret_msg.lower()
            or ret_code == 170130
        ):
            outcome = "validation_rejected"
            trade_permission = True
        else:
            outcome = "request_rejected"

        return {
            "outcome": outcome,
            "trade_permission": trade_permission,
            "ret_code": ret_code,
            "ret_msg": ret_msg,
            "order_link_id": order_link_id,
            "tested_at": self._now_iso(),
        }

    @staticmethod
    def safe_direction(value: Optional[str]) -> Direction:
        return Direction.BUY if str(value).lower() == "buy" else Direction.SELL

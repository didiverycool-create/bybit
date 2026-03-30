from __future__ import annotations

import copy
import json
import socket
import sys
import threading
import time
import unittest
from pathlib import Path
from typing import Any, Dict, Optional
from urllib.error import HTTPError
from urllib.request import Request, urlopen

import uvicorn


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import main as control_main  # type: ignore  # noqa: E402
from models import AccountMode, BybitPrivateStatus, OpenClawStatus  # type: ignore  # noqa: E402


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


class StubOpenClawClient:
    def get_status(self) -> OpenClawStatus:
        return OpenClawStatus(
            configured=False,
            gateway_url="ws://127.0.0.1:18789",
            auth_mode=None,
            default_agent=None,
            heartbeat=None,
            health_output=None,
            status_output=None,
            reachable=False,
        )


class StubBybitPrivateClient:
    def get_status(self) -> BybitPrivateStatus:
        return BybitPrivateStatus(
            configured=False,
            can_query_private=False,
            source="none",
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

    def fetch_positions(self) -> list[Dict[str, Any]]:
        return []

    def fetch_open_orders(self) -> list[Dict[str, Any]]:
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


class ControlApiIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._original_repo_state = copy.deepcopy(control_main.repo.state)
        cls._original_openclaw = control_main.openclaw
        cls._original_private_data = control_main.private_data

        control_main.openclaw = StubOpenClawClient()
        control_main.private_data = StubBybitPrivateClient()

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

    def setUp(self) -> None:
        self._state_backup = copy.deepcopy(control_main.repo.state)
        self.addCleanup(self._restore_state)

    def _restore_state(self) -> None:
        control_main.repo.state = self._state_backup
        control_main.repo._persist(self._state_backup)

    def _get(self, path: str) -> tuple[int, Any]:
        return _request_json(self._base_url, "GET", path)

    def _post(self, path: str, payload: Dict[str, Any]) -> tuple[int, Any]:
        return _request_json(self._base_url, "POST", path, payload)

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
            "/api/news": None,
            "/api/alerts": None,
            "/api/trades": None,
            "/api/workspace/preferences": ("active_section", "updated_at"),
            "/api/integrations/openclaw": ("configured", "gateway_url"),
            "/api/integrations/bybit-private": ("configured", "can_query_private"),
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
            "active_section": "strategy",
            "layout_preset": "dense",
            "selected_mode": "demo",
            "selected_symbol": "ETHUSDT",
            "selected_strategy_id": "eth-revert-02",
            "overview_card_order": ["risk", "account", "strategy", "account"],
            "overview_visible_cards": ["strategy", "risk", "unknown", "risk"],
        }

        post_status, updated = self._post("/api/workspace/preferences", payload)
        self.assertEqual(post_status, 200)
        self.assertEqual(updated["active_section"], "strategy")
        self.assertEqual(updated["layout_preset"], "dense")
        self.assertEqual(updated["selected_mode"], "demo")
        self.assertEqual(updated["selected_symbol"], "ETHUSDT")
        self.assertEqual(updated["selected_strategy_id"], "eth-revert-02")
        self.assertEqual(updated["overview_card_order"][:3], ["risk", "account", "strategy"])
        self.assertEqual(updated["overview_visible_cards"], ["risk", "strategy"])

        get_status, persisted = self._get("/api/workspace/preferences")
        self.assertEqual(get_status, 200)
        self.assertEqual(persisted, updated)
        self.assertNotEqual(initial_preferences, updated)

    def test_account_endpoints_gracefully_fallback_without_private_api(self) -> None:
        status, status_payload = self._get("/api/integrations/bybit-private")
        self.assertEqual(status, 200)
        self.assertFalse(status_payload["configured"])
        self.assertFalse(status_payload["can_query_private"])
        self.assertEqual(status_payload["source"], "none")

        overview_status, overview = self._get("/api/account/overview")
        self.assertEqual(overview_status, 200)
        self.assertEqual(overview["source"], "mock")
        self.assertIn("total_equity", overview)
        self.assertGreaterEqual(int(overview["positions_count"]), 0)
        self.assertGreaterEqual(int(overview["open_orders_count"]), 0)
        self.assertGreaterEqual(len(overview["top_holdings"]), 1)

        positions_status, positions = self._get("/api/account/positions")
        self.assertEqual(positions_status, 200)
        self.assertIsInstance(positions, list)
        self.assertGreaterEqual(len(positions), 1)
        self.assertTrue(all(item["source"] == "mock" for item in positions))

        orders_status, orders = self._get("/api/account/orders")
        self.assertEqual(orders_status, 200)
        self.assertIsInstance(orders, list)
        self.assertGreaterEqual(len(orders), 1)
        self.assertTrue(all(item["source"] == "mock" for item in orders))

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
        self.assertEqual(change_request["status"], "queued")
        self.assertEqual(change_request["requested_by"], "unit_test")

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

        scheduler_after_status, scheduler_after = self._get("/api/ai/scheduler")
        self.assertEqual(scheduler_after_status, 200)
        self.assertEqual(scheduler_after["scheduler"]["queue_depth"], initial_queue_depth + 1)

    def test_manual_trade_only_accepts_paper_mode(self) -> None:
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


if __name__ == "__main__":
    unittest.main(verbosity=2)

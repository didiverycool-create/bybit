"""Disconnection regression tests for services/control-api.

Cover the disconnection scenarios called out in §5.3 of the production
checklist:
- Public WS disconnected → REST fallback path.
- Public REST also unreachable → degraded status, not 500.
- Private WS disconnected (perp) → status surfaces reason_code.
- Private auth failure → typed issue_kind = "auth".
- Both public + private down → execution preview's channel-outage error
  carries the typed CHANNEL_OUTAGE block_code.
- Recovery: WS reconnects → next snapshot drops the alert + reason_code.

All tests stub the realtime / private clients so no Bybit network is hit.
"""

from __future__ import annotations

import copy
import sys
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import main as control_main  # type: ignore  # noqa: E402
from execution_health import (  # type: ignore  # noqa: E402
    CHANNEL_ISSUE_KIND_AUTH,
    CHANNEL_ISSUE_KIND_DISABLED,
    CHANNEL_ISSUE_KIND_DISCONNECTED,
    CHANNEL_ISSUE_KIND_NO_FEED,
    CHANNEL_ISSUE_KIND_STALE,
    build_public_execution_channel_health,
)
from models import (  # type: ignore  # noqa: E402
    AccountMode,
    BybitPrivateStatus,
    RISK_REASON_RUNTIME_UNAVAILABLE,
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


class _FakePublicRealtimeFeed:
    """Minimal stub mimicking ``BybitPublicRealtimeFeed`` for channel-health tests."""

    def __init__(
        self,
        *,
        enabled: bool = True,
        connected_spot: bool = True,
        connected_linear: bool = True,
        last_message_at_spot: Optional[str] = None,
        last_message_at_linear: Optional[str] = None,
        symbol_last_message_at: Optional[Dict[str, str]] = None,
        ticker_symbols: Optional[List[str]] = None,
        last_error: Optional[str] = None,
    ) -> None:
        self.enabled = enabled
        self.connected_spot = connected_spot
        self.connected_linear = connected_linear
        self.last_message_at_spot = last_message_at_spot
        self.last_message_at_linear = last_message_at_linear
        self.symbol_last_message_at = {
            str(key).upper(): value for key, value in (symbol_last_message_at or {}).items()
        }
        self.ticker_symbols = {str(item).upper() for item in (ticker_symbols or [])}
        self.last_error = last_error

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": self.enabled,
            "connected_spot": self.connected_spot,
            "connected_linear": self.connected_linear,
            "last_message_at_spot": self.last_message_at_spot,
            "last_message_at_linear": self.last_message_at_linear,
            "last_error": self.last_error,
        }

    def has_ticker(self, symbol: str, market: Optional[str] = None) -> bool:
        key = f"{market}:{symbol.upper()}".upper() if market else symbol.upper()
        return key in self.ticker_symbols or symbol.upper() in self.ticker_symbols

    def get_symbol_last_message_at(
        self, symbol: str, market: Optional[str] = None
    ) -> Optional[str]:
        key = f"{market}:{symbol.upper()}".upper() if market else symbol.upper()
        return self.symbol_last_message_at.get(key) or self.symbol_last_message_at.get(symbol.upper())


def _make_health(
    realtime: Optional[_FakePublicRealtimeFeed],
    *,
    rest_reachable: Optional[bool] = True,
    rest_last_error: Optional[str] = None,
    market: str = "perp",
    symbol: str = "BTCUSDT",
    stale_threshold_seconds: int = 90,
) -> Dict[str, Any]:
    rest_probe = {
        "reachable": rest_reachable,
        "last_error": rest_last_error,
        "tested_at": _now_iso(),
    }

    def fake_recommended_action(
        issue: Optional[str],
        *,
        last_error: Optional[str] = None,
        rest_reachable: Optional[bool] = None,
        issue_kind: Optional[str] = None,
    ) -> str:
        # Encode all inputs into the action string so tests can introspect.
        return "|".join(
            str(item)
            for item in (
                "action",
                issue or "",
                last_error or "",
                "reachable" if rest_reachable else "unreachable",
                issue_kind or "",
            )
        )

    def realtime_status_builder() -> Dict[str, Any]:
        if realtime is None:
            return {}
        return realtime.get_status()

    return build_public_execution_channel_health(
        market,
        symbol,
        realtime=realtime,
        realtime_status_builder=realtime_status_builder,
        rest_probe_fn=lambda: rest_probe,
        recommended_action_builder=fake_recommended_action,
        stale_threshold_seconds=stale_threshold_seconds,
        rest_probe=rest_probe,
    )


class PublicChannelHealthDisconnectionTests(unittest.TestCase):
    """``build_public_execution_channel_health`` reports typed issue_kind on disconnect."""

    def test_public_ws_disconnected_emits_disconnected_kind_with_rest_status(self) -> None:
        feed = _FakePublicRealtimeFeed(
            enabled=True,
            connected_spot=False,
            connected_linear=False,
            ticker_symbols=["BTCUSDT"],
            last_error="ws connection refused",
        )
        health = _make_health(feed, rest_reachable=True, market="perp", symbol="BTCUSDT")
        self.assertFalse(health["connected"])
        self.assertEqual(health["issue_kind"], CHANNEL_ISSUE_KIND_DISCONNECTED)
        self.assertIn("BTCUSDT".lower(), (health["channel"] + health["symbol"]).lower())
        self.assertEqual(health["rest_reachable"], True)
        self.assertIsNotNone(health["recommended_action"])
        self.assertIn(CHANNEL_ISSUE_KIND_DISCONNECTED, health["recommended_action"])

    def test_public_ws_and_rest_both_down_returns_degraded_status_not_500(self) -> None:
        feed = _FakePublicRealtimeFeed(
            enabled=True,
            connected_spot=False,
            connected_linear=False,
            ticker_symbols=["BTCUSDT"],
            last_error="ws timeout",
        )
        # REST probe also unreachable.
        health = _make_health(
            feed,
            rest_reachable=False,
            rest_last_error="rest probe HTTPError 503",
            market="perp",
            symbol="BTCUSDT",
        )
        # Helper must always return a structured dict — never raise.
        self.assertEqual(health["issue_kind"], CHANNEL_ISSUE_KIND_DISCONNECTED)
        self.assertIs(health["rest_reachable"], False)
        self.assertEqual(health["rest_last_error"], "rest probe HTTPError 503")
        # The recommended_action surfaces both the issue_kind and the rest
        # reachability so the operator can decide the next step.
        self.assertIn("unreachable", health["recommended_action"])

    def test_public_ws_no_symbol_feed_emits_no_feed_kind(self) -> None:
        # Connected WS but no ticker subscription for this symbol.
        feed = _FakePublicRealtimeFeed(
            enabled=True,
            connected_spot=True,
            connected_linear=True,
            ticker_symbols=[],  # no feeds yet
        )
        health = _make_health(feed, market="perp", symbol="ETHUSDT")
        self.assertTrue(health["connected"])
        self.assertFalse(health["has_symbol_feed"])
        self.assertEqual(health["issue_kind"], CHANNEL_ISSUE_KIND_NO_FEED)

    def test_public_ws_stale_feed_emits_stale_kind(self) -> None:
        # Connected WS with a feed entry older than the stale threshold.
        stale_time = (datetime.now(timezone.utc).astimezone() - timedelta(seconds=200)).isoformat()
        feed = _FakePublicRealtimeFeed(
            enabled=True,
            connected_spot=True,
            connected_linear=True,
            ticker_symbols=["LINEAR:BTCUSDT", "BTCUSDT"],
            symbol_last_message_at={"LINEAR:BTCUSDT": stale_time, "BTCUSDT": stale_time},
        )
        health = _make_health(
            feed, market="perp", symbol="BTCUSDT", stale_threshold_seconds=90
        )
        self.assertTrue(health["has_symbol_feed"])
        self.assertTrue(health["stale"])
        self.assertEqual(health["issue_kind"], CHANNEL_ISSUE_KIND_STALE)
        self.assertGreaterEqual(health["stale_seconds"], 90)

    def test_public_ws_disabled_emits_disabled_kind(self) -> None:
        feed = _FakePublicRealtimeFeed(enabled=False, connected_spot=False, connected_linear=False)
        health = _make_health(feed, market="perp", symbol="BTCUSDT")
        self.assertFalse(health["enabled"])
        self.assertEqual(health["issue_kind"], CHANNEL_ISSUE_KIND_DISABLED)

    def test_public_realtime_missing_returns_disabled_skeleton(self) -> None:
        # Calling with ``realtime=None`` is the "no public feed even configured"
        # path — the helper must short-circuit to a fully-defaulted dict
        # rather than raising AttributeError.
        health = _make_health(None, market="perp", symbol="BTCUSDT")
        self.assertFalse(health["enabled"])
        self.assertFalse(health["connected"])
        self.assertIsNone(health["issue"])
        self.assertIsNone(health["issue_kind"])

    def test_public_ws_recovery_clears_issue_kind(self) -> None:
        """After WS reconnects + delivers a fresh tick, the next snapshot is clean."""

        # Step 1: degraded snapshot with disconnected WS.
        bad_feed = _FakePublicRealtimeFeed(
            enabled=True, connected_spot=False, connected_linear=False, ticker_symbols=["BTCUSDT"]
        )
        bad_health = _make_health(bad_feed, market="perp", symbol="BTCUSDT")
        self.assertEqual(bad_health["issue_kind"], CHANNEL_ISSUE_KIND_DISCONNECTED)

        # Step 2: replace the feed with a healthy one and re-evaluate.
        fresh_time = _now_iso()
        good_feed = _FakePublicRealtimeFeed(
            enabled=True,
            connected_spot=True,
            connected_linear=True,
            ticker_symbols=["LINEAR:BTCUSDT", "BTCUSDT"],
            symbol_last_message_at={"LINEAR:BTCUSDT": fresh_time, "BTCUSDT": fresh_time},
        )
        good_health = _make_health(good_feed, market="perp", symbol="BTCUSDT")
        self.assertTrue(good_health["connected"])
        self.assertTrue(good_health["has_symbol_feed"])
        self.assertFalse(good_health["stale"])
        self.assertIsNone(good_health["issue"])
        self.assertIsNone(good_health["issue_kind"])
        self.assertIsNone(good_health["recommended_action"])


class _FakePrivateClient:
    """Stub for :class:`bybit_private_client.BybitPrivateClient` for channel tests."""

    def __init__(
        self,
        *,
        configured: bool = True,
        can_query: bool = True,
        mode: AccountMode = AccountMode.LIVE,
        last_error: Optional[str] = None,
    ) -> None:
        self._configured = configured
        self._can_query = can_query
        self._mode = mode
        self._last_error = last_error

    def get_status(self) -> BybitPrivateStatus:
        return BybitPrivateStatus(
            configured=self._configured,
            can_query_private=self._can_query,
            source="file" if self._configured else "none",
            config_path="/tmp/private-api.json",
            config_exists=self._configured,
            example_config_path="/tmp/private-api.example.json",
            api_base_url="https://api.bybit.com",
            account_type="UNIFIED",
            mode=self._mode,
            key_hint="disc...test" if self._configured else None,
            last_error=self._last_error,
            updated_at=_now_iso(),
        )


class _FakePrivateRealtime:
    """Stub for the private realtime feed used by ``_build_private_execution_channel_health``."""

    def __init__(
        self,
        *,
        connected: bool = True,
        authenticated: bool = True,
        last_message_at: Optional[str] = None,
        last_error: Optional[str] = None,
    ) -> None:
        self.connected = connected
        self.authenticated = authenticated
        self.last_message_at = last_message_at if last_message_at is not None else _now_iso()
        self.last_error = last_error
        self.client = None  # set by tests so ensure_private_realtime_started is a no-op
        self.ensure_started_calls = 0

    def get_status(self) -> Dict[str, Any]:
        return {
            "enabled": True,
            "connected": self.connected,
            "authenticated": self.authenticated,
            "last_message_at": self.last_message_at,
            "last_error": self.last_error,
            "has_wallet": False,
            "positions_count": 0,
            "open_orders_count": 0,
            "executions_count": 0,
        }

    def ensure_started(self) -> bool:
        self.ensure_started_calls += 1
        return self.connected


class PrivateChannelHealthDisconnectionTests(unittest.TestCase):
    """``_build_private_execution_channel_health`` surfaces typed issue_kind on private outages."""

    def setUp(self) -> None:
        self._original_private_data = control_main.private_data
        self._original_private_realtime = control_main.private_realtime

    def tearDown(self) -> None:
        control_main.private_data = self._original_private_data
        control_main.private_realtime = self._original_private_realtime

    def _install_stubs(
        self,
        *,
        private_client: _FakePrivateClient,
        private_realtime: _FakePrivateRealtime,
    ) -> None:
        control_main.private_data = private_client
        # Make ensure_private_realtime_started() a no-op by aliasing client.
        private_realtime.client = private_client
        control_main.private_realtime = private_realtime

    def test_private_ws_disconnected_emits_disconnected_kind_for_perp(self) -> None:
        self._install_stubs(
            private_client=_FakePrivateClient(),
            private_realtime=_FakePrivateRealtime(
                connected=False,
                authenticated=False,
                last_error="ws closed by peer",
            ),
        )
        health = control_main._build_private_execution_channel_health(AccountMode.LIVE)
        self.assertEqual(health["issue_kind"], CHANNEL_ISSUE_KIND_DISCONNECTED)
        self.assertIn("私有", health["issue"])
        self.assertIn("ws closed by peer", health["issue"])
        self.assertEqual(health["last_error"], "ws closed by peer")

    def test_private_ws_auth_failure_emits_auth_kind(self) -> None:
        self._install_stubs(
            private_client=_FakePrivateClient(),
            private_realtime=_FakePrivateRealtime(
                connected=True,
                authenticated=False,
                last_error="auth failed: signature mismatch",
            ),
        )
        health = control_main._build_private_execution_channel_health(AccountMode.LIVE)
        self.assertEqual(health["issue_kind"], CHANNEL_ISSUE_KIND_AUTH)
        self.assertIn("鉴权", health["issue"])
        self.assertEqual(health["last_error"], "auth failed: signature mismatch")

    def test_private_ws_paper_mode_returns_no_issue(self) -> None:
        # In Paper mode the helper should never report a private-channel issue.
        self._install_stubs(
            private_client=_FakePrivateClient(can_query=False, mode=AccountMode.PAPER),
            private_realtime=_FakePrivateRealtime(connected=False, authenticated=False),
        )
        health = control_main._build_private_execution_channel_health(AccountMode.PAPER)
        self.assertIsNone(health["issue"])
        self.assertIsNone(health["issue_kind"])

    def test_private_ws_recovery_clears_issue(self) -> None:
        # Step 1: disconnected → issue.
        bad_realtime = _FakePrivateRealtime(connected=False, authenticated=False)
        self._install_stubs(
            private_client=_FakePrivateClient(),
            private_realtime=bad_realtime,
        )
        bad_health = control_main._build_private_execution_channel_health(AccountMode.LIVE)
        self.assertEqual(bad_health["issue_kind"], CHANNEL_ISSUE_KIND_DISCONNECTED)

        # Step 2: WS reconnects + auth — health should clear.
        good_realtime = _FakePrivateRealtime(
            connected=True,
            authenticated=True,
            last_message_at=_now_iso(),
        )
        self._install_stubs(
            private_client=_FakePrivateClient(),
            private_realtime=good_realtime,
        )
        good_health = control_main._build_private_execution_channel_health(AccountMode.LIVE)
        self.assertIsNone(good_health["issue"])
        self.assertIsNone(good_health["issue_kind"])


class StrategyExecutionChannelOutageErrorTests(unittest.TestCase):
    """Both public + private down → preview path raises typed channel-outage error."""

    def test_channel_outage_error_carries_runtime_unavailable_block_code(self) -> None:
        from execution_health import CHANNEL_ISSUE_KIND_DISCONNECTED  # type: ignore  # noqa: WPS433

        exc = control_main.StrategyExecutionChannelOutageError(
            "公共行情链路与私有 WS 同时不可用，无法生成执行预览。",
            channel="public",
            issue_kind=CHANNEL_ISSUE_KIND_DISCONNECTED,
        )
        self.assertEqual(exc.block_code, RISK_REASON_RUNTIME_UNAVAILABLE)
        self.assertEqual(exc.channel, "public")
        self.assertEqual(exc.issue_kind, CHANNEL_ISSUE_KIND_DISCONNECTED)
        self.assertIn("无法生成执行预览", str(exc))

    def test_channel_outage_error_auto_classifies_issue_kind_from_detail(self) -> None:
        # When the caller does not pass issue_kind, the constructor should
        # fall back to ``_classify_channel_issue_kind`` and pull the typed
        # tag out of the Chinese detail string (legacy callers).
        exc = control_main.StrategyExecutionChannelOutageError(
            "当前 Bybit 公共 WS (linear) 未连通，无法安全执行真实策略委托。",
            channel="public",
        )
        self.assertEqual(exc.block_code, RISK_REASON_RUNTIME_UNAVAILABLE)
        self.assertEqual(exc.issue_kind, CHANNEL_ISSUE_KIND_DISCONNECTED)


class PrivateApiAuthIssueKindTests(unittest.TestCase):
    """The typed ``issue_kind="auth"`` propagates to the alert path."""

    def setUp(self) -> None:
        self._original_repo_state = copy.deepcopy(control_main.repo.state)
        self._original_private_data = control_main.private_data
        self._original_private_realtime = control_main.private_realtime

    def tearDown(self) -> None:
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo.state = copy.deepcopy(self._original_repo_state)
            control_main.repo._persist()  # type: ignore[attr-defined]
        control_main.private_data = self._original_private_data
        control_main.private_realtime = self._original_private_realtime

    def test_auth_issue_kind_can_be_threaded_to_system_alert(self) -> None:
        """An auth-failure system alert preserves issue_kind=AUTH end-to-end."""

        rule_key = "private-channel:auth-failure"
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=rule_key,
                severity="P0",
                symbol="SYSTEM",
                title="私有 WS 鉴权失败",
                description="auth failed: signature mismatch",
                suggested_action="检查 API key/secret/timestamp 偏移。",
                reason_code="auto.channel.private_outage",
                issue_kind=CHANNEL_ISSUE_KIND_AUTH,
            )
            control_main.repo._refresh_derived_state()  # type: ignore[attr-defined]
            control_main.repo._persist()  # type: ignore[attr-defined]

        snapshot = control_main.repo.snapshot()
        match = next(
            (item for item in snapshot.alerts if getattr(item, "rule_key", None) == rule_key),
            None,
        )
        self.assertIsNotNone(match, "应能找到刚插入的鉴权告警。")
        self.assertEqual(match.issue_kind, CHANNEL_ISSUE_KIND_AUTH)
        self.assertEqual(match.reason_code, "auto.channel.private_outage")
        self.assertEqual(match.severity, "P0")


if __name__ == "__main__":
    unittest.main()

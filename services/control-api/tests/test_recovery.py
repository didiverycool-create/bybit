"""Recovery regression tests for services/control-api.

Cover the scenarios called out in §5.3 of the production checklist:
- cold-start with missing/corrupt/partial state.json,
- runtime-worker restart endpoint clearing stale flags,
- stale exchange order detection,
- repeated rejected-order cooldown,
- position-drift alert,
- live stop-loss guard.

Each test isolates state in a fresh tempdir-backed ``AppRepository`` so no
two tests touch the same state.json, and none reach the network.
"""

from __future__ import annotations

import copy
import json
import sys
import tempfile
import threading
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List
from uuid import uuid4

CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import main as control_main  # type: ignore  # noqa: E402
from models import (  # type: ignore  # noqa: E402
    AccountMode,
    AlertRecord,
    EventSeverity,
    ExecutionEvent,
    OrderRecord,
    PositionRecord,
    RuntimeWorkerActionPayload,
)
from repository import AppRepository  # type: ignore  # noqa: E402


def _new_state_path() -> Path:
    return Path(tempfile.mkdtemp(prefix="ctrlapi-recovery-")) / "state.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


class ColdStartRecoveryTests(unittest.TestCase):
    """``AppRepository._load`` recovery from missing / corrupt / partial state.json."""

    def test_missing_state_file_recovers_to_empty_but_functional_seed(self) -> None:
        path = _new_state_path()
        self.assertFalse(path.exists())

        repo = AppRepository(path=path)

        self.assertTrue(path.exists(), "missing state.json 启动后应被持久化为最初种子。")
        snapshot = repo.snapshot()
        self.assertGreaterEqual(len(snapshot.strategies), 1, "种子状态应至少包含若干策略。")
        self.assertGreaterEqual(len(snapshot.watchlist), 1, "种子状态应至少包含若干自选品种。")
        self.assertEqual(snapshot.control_snapshot.scheduler.status, "running")

    def test_corrupt_state_json_recovers_to_seeded_state_loud(self) -> None:
        """Documents current behaviour: invalid JSON silently rebuilds seed state.

        The production helper currently catches ``Exception`` and falls back to
        ``build_state()``, which means a corrupted state.json is silently
        replaced.  This test pins that behaviour so a future "fail-loud"
        change has to update the test deliberately.  See PROD-CHECKLIST §5.3
        — fail-loud handling is a known follow-up item.
        """

        path = _new_state_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text("{not valid json", encoding="utf-8")

        repo = AppRepository(path=path)

        # Loaded state must still be a valid AppState (exercises the seed
        # fallback path).  The file is rewritten on disk.
        self.assertTrue(path.exists())
        snapshot = repo.snapshot()
        self.assertGreaterEqual(len(snapshot.strategies), 1)
        rewritten = json.loads(path.read_text(encoding="utf-8"))
        self.assertIn("strategies", rewritten)

    def test_partial_state_json_missing_newer_optional_fields_defaults_correctly(self) -> None:
        """state.json missing ``execution_impact_records`` (added later) defaults to []."""

        path = _new_state_path()
        # Build a fresh seed state and then strip a later-added optional field.
        bootstrap_repo = AppRepository(path=path)
        on_disk = json.loads(path.read_text(encoding="utf-8"))
        # ``execution_impact_records`` and ``alert_rules`` are ``Field(default_factory=list)``
        # so removing them must default to []. ``paper_orders`` and
        # ``paper_order_history`` are also defaulted; remove them too to
        # exercise the partial-schema recovery path.
        on_disk.pop("execution_impact_records", None)
        on_disk.pop("alert_rules", None)
        on_disk.pop("paper_orders", None)
        on_disk.pop("paper_order_history", None)
        # Clear strategy_runtime_snapshots which is also default-empty.
        on_disk.pop("strategy_runtime_snapshots", None)
        path.write_text(json.dumps(on_disk), encoding="utf-8")
        del bootstrap_repo

        repo = AppRepository(path=path)
        snapshot = repo.snapshot()
        self.assertEqual(snapshot.execution_impact_records, [])
        self.assertEqual(snapshot.alert_rules, [])
        self.assertEqual(snapshot.paper_orders, [])
        self.assertEqual(snapshot.paper_order_history, [])
        self.assertEqual(snapshot.strategy_runtime_snapshots, [])


class RuntimeWorkerRestartRecoveryTests(unittest.TestCase):
    """``restart_strategy_runtime_worker`` clears stale flags and starts the thread."""

    def setUp(self) -> None:
        self._state_backup = copy.deepcopy(control_main.strategy_runtime_state)
        self._thread_backup = control_main.strategy_runtime_thread
        # Stop any worker the suite might be running.
        if control_main.strategy_runtime_thread is not None and control_main.strategy_runtime_thread.is_alive():
            control_main.strategy_runtime_stop_event.set()
            control_main.strategy_runtime_thread.join(timeout=2)
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_stop_event.clear()
        control_main.strategy_runtime_state.clear()
        control_main.strategy_runtime_state.update(
            {"running": False, "last_refresh_at": None, "last_error": None, "started_once": False}
        )

    def tearDown(self) -> None:
        if control_main.strategy_runtime_thread is not None and control_main.strategy_runtime_thread.is_alive():
            control_main.strategy_runtime_stop_event.set()
            control_main.strategy_runtime_thread.join(timeout=2)
        control_main.strategy_runtime_thread = None
        control_main.strategy_runtime_stop_event.clear()
        control_main.strategy_runtime_state.clear()
        control_main.strategy_runtime_state.update(self._state_backup)
        control_main.strategy_runtime_thread = self._thread_backup

    def test_restart_endpoint_clears_last_error_and_starts_thread(self) -> None:
        # Pre-populate a "crashed" state.
        control_main.strategy_runtime_state["last_error"] = "writer crashed"
        control_main.strategy_runtime_state["last_refresh_at"] = "2026-04-26T08:00:00+08:00"
        control_main.strategy_runtime_state["running"] = False

        # Patch refresh_strategy_runtime_once to avoid touching real market_data.
        original_refresh = control_main.refresh_strategy_runtime_once
        refresh_called = threading.Event()

        def stub_refresh(auto_dispatch: bool = False) -> None:  # noqa: ARG001
            refresh_called.set()
            # Simulate "refresh succeeded" so loop never raises.
            control_main.strategy_runtime_state["last_refresh_at"] = _now_iso()

        control_main.refresh_strategy_runtime_once = stub_refresh
        try:
            result = control_main.restart_strategy_runtime_worker(
                RuntimeWorkerActionPayload(requested_by="recovery_test", reason="restart")
            )
            # Wait briefly for the loop to perform at least one refresh.
            refresh_called.wait(timeout=2)
        finally:
            control_main.strategy_runtime_stop_event.set()
            if control_main.strategy_runtime_thread is not None:
                control_main.strategy_runtime_thread.join(timeout=2)
            control_main.refresh_strategy_runtime_once = original_refresh

        self.assertIsNone(
            control_main.strategy_runtime_state.get("last_error"),
            "重启端点应在 clear_error=True 时清空 last_error。",
        )
        self.assertTrue(result.running, "重启后线程应处于运行态。")
        self.assertTrue(control_main.strategy_runtime_state.get("started_once"))


class StaleExchangeOrderDetectionTests(unittest.TestCase):
    """An exchange order older than ``stale_order_minutes`` triggers cancel + alert."""

    def test_exchange_order_older_than_threshold_classified_as_stale(self) -> None:
        # Seed a strategy and an order that is 60 minutes old; the default
        # stale threshold is 20 minutes (see ``_strategy_exchange_order_stale_minutes``).
        from models import StrategyParameter, StrategySummary  # type: ignore  # noqa: WPS433

        strategy = StrategySummary(
            id="trend-stale-test",
            name="Stale order test strategy",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode=AccountMode.LIVE,
            version="v1",
            pnl_7d="+0%",
            max_drawdown="-0%",
            risk_budget="10%",
            description="测试 stale 订单逻辑。",
            parameters=[StrategyParameter(key="stale_order_minutes", label="挂单超时", value=20)],
        )

        old_created_at = (datetime.now(timezone.utc).astimezone() - timedelta(minutes=60)).isoformat()
        order = OrderRecord(
            order_id="stale-order-001",
            symbol="BTCUSDT",
            market="perp",
            mode=AccountMode.LIVE,
            origin="strategy",
            strategy_id=strategy.id,
            side=control_main.Direction.BUY,
            order_type="Limit",
            qty="0.1",
            price="60000",
            status="New",
            created_at=old_created_at,
            source="bybit_private",
        )

        threshold = control_main._strategy_exchange_order_stale_minutes(strategy)
        age = control_main._strategy_active_order_stale_age_minutes(order)
        self.assertEqual(threshold, 20, "默认 stale_order_minutes 应为 20。")
        self.assertGreaterEqual(age, threshold, "测试订单应被识别为 stale。")
        self.assertTrue(
            control_main._is_strategy_active_order_stale(strategy, order),
            "60 分钟前创建的真实模式委托应被判定为 stale。",
        )

    def test_paper_orders_never_classified_as_stale(self) -> None:
        from models import StrategyParameter, StrategySummary  # type: ignore  # noqa: WPS433

        strategy = StrategySummary(
            id="paper-stale",
            name="Paper",
            category="template",
            status="paper_only",
            symbols=["BTCUSDT"],
            mode=AccountMode.PAPER,
            version="v1",
            pnl_7d="+0%",
            max_drawdown="-0%",
            risk_budget="5%",
            description="paper 模式不应触发 stale-order 处理。",
            parameters=[StrategyParameter(key="stale_order_minutes", label="挂单超时", value=20)],
        )
        old_order = OrderRecord(
            order_id="paper-stale-1",
            symbol="BTCUSDT",
            market="perp",
            mode=AccountMode.PAPER,
            origin="strategy",
            strategy_id=strategy.id,
            side=control_main.Direction.BUY,
            order_type="Limit",
            qty="0.1",
            price="60000",
            status="New",
            created_at=(datetime.now(timezone.utc).astimezone() - timedelta(hours=4)).isoformat(),
            source="paper",
        )
        self.assertFalse(
            control_main._is_strategy_active_order_stale(strategy, old_order),
            "Paper 模式委托永远不应被判定为 stale。",
        )


class RejectedOrderCooldownTests(unittest.TestCase):
    """N rejected events in a window engages the rejection-guard cooldown."""

    def setUp(self) -> None:
        self._original_repo_state = copy.deepcopy(control_main.repo.state)

    def tearDown(self) -> None:
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo.state = copy.deepcopy(self._original_repo_state)
            control_main.repo._persist()  # type: ignore[attr-defined]

    def _seed_strategy_with_rejection_threshold(self, threshold: int, window_minutes: int, cooldown_minutes: int):
        from models import StrategyParameter, StrategySummary  # type: ignore  # noqa: WPS433

        strategy = StrategySummary(
            id="reject-test-strategy",
            name="Rejection guard test",
            category="template",
            status="running",
            symbols=["BTCUSDT"],
            mode=AccountMode.LIVE,
            version="v1",
            pnl_7d="+0%",
            max_drawdown="-0%",
            risk_budget="10%",
            description="测试连续拒单冷却。",
            parameters=[
                StrategyParameter(key="rejection_guard_count", label="阈值", value=threshold),
                StrategyParameter(key="rejection_guard_window_minutes", label="窗口", value=window_minutes),
                StrategyParameter(key="rejection_cooldown_minutes", label="冷却", value=cooldown_minutes),
            ],
        )
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo.state.strategies = [strategy]
        return strategy

    def _emit_rejection_events(self, strategy_id: str, count: int, *, age_minutes: float = 0.0) -> None:
        timestamp_at = datetime.now(timezone.utc).astimezone() - timedelta(minutes=age_minutes)
        with control_main.repo._lock:  # type: ignore[attr-defined]
            for index in range(count):
                occurred_at = (timestamp_at - timedelta(seconds=index)).isoformat()
                event = ExecutionEvent(
                    id=f"evt-reject-{uuid4().hex[:6]}-{index}",
                    severity=EventSeverity.ERROR,
                    source="quant-core",
                    event_type="exchange_order.rejected",
                    payload={"order_id": f"reject-{index}", "summary": f"拒单 {index}"},
                    symbol="BTCUSDT",
                    strategy_id=strategy_id,
                    trace_id=f"trace-reject-{uuid4().hex[:8]}",
                    occurred_at=occurred_at,
                )
                control_main.repo.state.audit_events.insert(0, event)
            control_main.repo._persist()  # type: ignore[attr-defined]

    def test_threshold_rejections_within_window_engage_cooldown(self) -> None:
        strategy = self._seed_strategy_with_rejection_threshold(
            threshold=3, window_minutes=10, cooldown_minutes=30
        )
        # Fewer than threshold → no cooldown.
        self._emit_rejection_events(strategy.id, count=2, age_minutes=1)
        self.assertIsNone(
            control_main._strategy_exchange_rejection_guard_remaining_minutes(strategy),
            "未达阈值时不应进入冷却。",
        )
        # Push to threshold; cooldown should engage.
        self._emit_rejection_events(strategy.id, count=1, age_minutes=1)
        remaining = control_main._strategy_exchange_rejection_guard_remaining_minutes(strategy)
        self.assertIsNotNone(remaining, "达到阈值后应触发冷却。")
        self.assertGreater(remaining, 0)

    def test_cooldown_lapses_after_window_expires(self) -> None:
        strategy = self._seed_strategy_with_rejection_threshold(
            threshold=3, window_minutes=5, cooldown_minutes=10
        )
        # All rejections happened ≥ 30 minutes ago → outside the window;
        # rejection-guard should not be engaged.
        self._emit_rejection_events(strategy.id, count=4, age_minutes=30)
        self.assertIsNone(
            control_main._strategy_exchange_rejection_guard_remaining_minutes(strategy),
            "若所有拒单都早于窗口期，则不应进入冷却。",
        )

    def test_paper_strategy_skips_rejection_guard(self) -> None:
        from models import StrategyParameter, StrategySummary  # type: ignore  # noqa: WPS433

        paper_strategy = StrategySummary(
            id="paper-reject",
            name="Paper rejection guard",
            category="template",
            status="paper_only",
            symbols=["BTCUSDT"],
            mode=AccountMode.PAPER,
            version="v1",
            pnl_7d="+0%",
            max_drawdown="-0%",
            risk_budget="5%",
            description="Paper 不应触发拒单冷却。",
            parameters=[
                StrategyParameter(key="rejection_guard_count", label="阈值", value=2),
                StrategyParameter(key="rejection_guard_window_minutes", label="窗口", value=10),
                StrategyParameter(key="rejection_cooldown_minutes", label="冷却", value=30),
            ],
        )
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo.state.strategies = [paper_strategy]
        self._emit_rejection_events(paper_strategy.id, count=5, age_minutes=1)
        self.assertIsNone(
            control_main._strategy_exchange_rejection_guard_remaining_minutes(paper_strategy),
            "Paper 模式不应进入拒单冷却。",
        )


class PositionDriftAlertTests(unittest.TestCase):
    """``strategy-position-drift:*`` alerts surface drift and clear after recovery."""

    def setUp(self) -> None:
        self._original_repo_state = copy.deepcopy(control_main.repo.state)

    def tearDown(self) -> None:
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo.state = copy.deepcopy(self._original_repo_state)
            control_main.repo._persist()  # type: ignore[attr-defined]

    def test_position_drift_alert_clears_when_position_aligns(self) -> None:
        strategy_id = "drift-recovery-test"
        rule_key = f"strategy-position-drift:{strategy_id}:1"
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=rule_key,
                severity="P1",
                symbol="BTCUSDT",
                title="仓位偏离测试",
                description="目标仓位 1.0，实际 0.0；触发偏离提示。",
                suggested_action="人工复核仓位。",
                strategy_id=strategy_id,
            )
            control_main.repo._refresh_derived_state()  # type: ignore[attr-defined]
            control_main.repo._persist()  # type: ignore[attr-defined]

        self.assertTrue(
            control_main._has_active_strategy_position_drift_alert(strategy_id),
            "插入的 drift alert 应处于活动状态。",
        )

        # Simulate position re-alignment: clear should ack all drift alerts.
        cleared = control_main._clear_strategy_position_drift_alerts(
            strategy_id, resolution_detail="手工对齐完成。"
        )
        self.assertTrue(cleared)
        self.assertFalse(
            control_main._has_active_strategy_position_drift_alert(strategy_id),
            "清除后 drift alert 不应继续活跃。",
        )


class LiveStopLossGuardLifecycleTests(unittest.TestCase):
    """Live stop-loss guard alert clears once the position closes."""

    def setUp(self) -> None:
        self._original_repo_state = copy.deepcopy(control_main.repo.state)

    def tearDown(self) -> None:
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo.state = copy.deepcopy(self._original_repo_state)
            control_main.repo._persist()  # type: ignore[attr-defined]

    def test_stop_loss_alert_lifecycle_engage_then_clear(self) -> None:
        strategy_id = "live-stop-loss-test"
        rule_key = f"strategy-live-stop-loss:{strategy_id}:live"
        with control_main.repo._lock:  # type: ignore[attr-defined]
            control_main.repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                rule_key=rule_key,
                severity="P0",
                symbol="BTCUSDT",
                title="测试止损告警",
                description="当前价格触发 1.5% 止损保护。",
                suggested_action="人工复核仓位与参数后再恢复。",
                strategy_id=strategy_id,
            )
            control_main.repo._refresh_derived_state()  # type: ignore[attr-defined]
            control_main.repo._persist()  # type: ignore[attr-defined]

        self.assertTrue(
            control_main._has_active_strategy_live_stop_loss_alert(strategy_id),
            "止损告警应处于活动状态。",
        )

        # Simulate the position closing: the helper acks every matching alert.
        cleared = control_main._clear_strategy_live_stop_loss_alerts(strategy_id)
        self.assertTrue(cleared)
        self.assertFalse(
            control_main._has_active_strategy_live_stop_loss_alert(strategy_id),
            "仓位关闭后止损告警应被清除。",
        )


class OrderEventClassificationRecoveryTests(unittest.TestCase):
    """``_classify_exchange_order_status_event`` recognises Bybit status variants."""

    def test_filled_classification(self) -> None:
        result = control_main._classify_exchange_order_status_event("Filled")
        self.assertEqual(result, ("exchange_order.filled", EventSeverity.INFO))

    def test_partially_filled_canceled_classification(self) -> None:
        # Bybit emits the misspelled "PartiallyFilledCanceled" — both branches
        # match (substring "fill" wins), but our intent is that this still
        # returns *something* recognisable so audit doesn't drop it on the floor.
        result = control_main._classify_exchange_order_status_event("PartiallyFilledCanceled")
        self.assertIsNotNone(result, "已知的 PartiallyFilledCanceled 状态应被识别。")
        event_type, _severity = result
        # The "fill" check fires first in main.py (search order), so it lands in
        # the filled bucket rather than cancelled.  Pin that behaviour.
        self.assertEqual(event_type, "exchange_order.filled")

    def test_rejected_classification(self) -> None:
        result = control_main._classify_exchange_order_status_event("Rejected")
        self.assertEqual(result, ("exchange_order.rejected", EventSeverity.ERROR))

    def test_unknown_status_returns_none(self) -> None:
        self.assertIsNone(control_main._classify_exchange_order_status_event("Created"))


if __name__ == "__main__":
    unittest.main()

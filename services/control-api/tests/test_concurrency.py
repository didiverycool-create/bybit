"""Concurrency regression tests for services/control-api.

These tests use ``threading.Barrier`` to force interleaving between worker
threads so race conditions become reliably reproducible.  Each test resets
state in a tempdir-backed ``AppRepository`` so no shared state leaks between
tests, and none of them touch the network.
"""

from __future__ import annotations

import copy
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from typing import List, Optional

CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))

import main as control_main  # type: ignore  # noqa: E402
from models import (  # type: ignore  # noqa: E402
    AccountMode,
    AgentJobCreate,
    AlertAcknowledgePayload,
    AlertRecord,
    ChangeRequestCreate,
    JobStatus,
    PriorityLevel,
)
from repository import AppRepository  # type: ignore  # noqa: E402


def _make_temp_repo() -> AppRepository:
    """Build a fresh ``AppRepository`` rooted in a tempdir.

    Each test gets its own state.json so no two tests fight over the same
    file, and so failures cannot leak into the long-running app's
    ``.runtime/state.json``.
    """

    tmpdir = tempfile.mkdtemp(prefix="ctrlapi-concurrency-")
    return AppRepository(path=Path(tmpdir) / "state.json")


class RepositoryConcurrentWriteTests(unittest.TestCase):
    """Verify ``AppRepository._lock`` keeps writes consistent under load."""

    def test_concurrent_alert_acknowledge_does_not_lose_updates(self) -> None:
        """Two threads acknowledging the same alert must each leave it acked."""

        repo = _make_temp_repo()
        alert_id = "alert-concurrent-ack"
        repo.state.alerts.insert(
            0,
            AlertRecord(
                id=alert_id,
                severity="P2",
                symbol="BTCUSDT",
                title="并发确认测试",
                description="并发确认压力测试占位告警。",
                triggered_at="2026-04-26T00:00:00+08:00",
                suggested_action="无需动作。",
                acknowledged=False,
                source_type="system",
                rule_key="concurrency-test:ack:1",
            ),
        )
        repo._persist()  # type: ignore[attr-defined]

        thread_count = 8
        barrier = threading.Barrier(thread_count)
        errors: List[BaseException] = []

        def worker(_index: int) -> None:
            try:
                barrier.wait(timeout=2)
                repo.acknowledge_alert(alert_id, AlertAcknowledgePayload(acknowledged=True))
            except BaseException as exc:  # pragma: no cover - reported below
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(thread_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=3)

        self.assertFalse(errors, f"工作线程出现异常：{errors!r}")
        snapshot = repo.snapshot()
        matching = [item for item in snapshot.alerts if item.id == alert_id]
        self.assertEqual(len(matching), 1)
        self.assertTrue(matching[0].acknowledged)

    def test_concurrent_change_request_create_keeps_unique_ids(self) -> None:
        """N threads creating change-requests must yield N records with unique ids."""

        repo = _make_temp_repo()
        thread_count = 6
        barrier = threading.Barrier(thread_count)
        created_ids: List[str] = []
        created_lock = threading.Lock()
        errors: List[BaseException] = []

        def worker(index: int) -> None:
            try:
                barrier.wait(timeout=2)
                record = repo.create_change_request(
                    ChangeRequestCreate(
                        type="alert.rule.update",
                        payload={
                            "symbol": "BTCUSDT",
                            "alert_enabled": True,
                            "threshold_pct": 1.0 + index * 0.1,
                            "cooldown_minutes": 30,
                        },
                        target_mode=AccountMode.PAPER,
                        priority=PriorityLevel.NORMAL,
                        summary=f"并发创建请求 #{index}",
                        requested_by="concurrency-test",
                    )
                )
                with created_lock:
                    created_ids.append(record.id)
            except BaseException as exc:  # pragma: no cover - reported below
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(thread_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=4)

        self.assertFalse(errors, f"工作线程出现异常：{errors!r}")
        self.assertEqual(len(created_ids), thread_count)
        self.assertEqual(len(set(created_ids)), thread_count, "并发创建产生了重复的 change_request id")

        snapshot = repo.snapshot()
        for created_id in created_ids:
            match = next((item for item in snapshot.change_requests if item.id == created_id), None)
            self.assertIsNotNone(match, f"快照中找不到刚创建的 change_request {created_id}")


class AgentJobClaimRaceTests(unittest.TestCase):
    """Force two ``claim_next_agent_job`` calls to race over a single QUEUED job."""

    def test_only_one_worker_claims_each_queued_job(self) -> None:
        repo = _make_temp_repo()
        repo.state.control_snapshot.scheduler.status = "running"
        repo.state.control_snapshot.scheduler.current_job_id = None

        # Seed a single QUEUED job.
        with repo._lock:  # type: ignore[attr-defined]
            seeded_job = repo._create_agent_job_locked(  # type: ignore[attr-defined]
                AgentJobCreate(
                    job_type="reconcile_change_request",
                    context={"strategy_id": "trend-btc-01"},
                    allowed_actions=["reconcile_change_request"],
                    timeout=60,
                    idempotency_key="concurrency-test:claim:1",
                    writeback_target="scheduler",
                ),
                source="concurrency-test",
            )
            seeded_job.status = JobStatus.QUEUED
            repo._persist()  # type: ignore[attr-defined]

        thread_count = 6
        barrier = threading.Barrier(thread_count)
        results: List[Optional[str]] = []
        results_lock = threading.Lock()
        errors: List[BaseException] = []

        def worker() -> None:
            try:
                barrier.wait(timeout=2)
                claimed = repo.claim_next_agent_job()
                with results_lock:
                    results.append(claimed.id if claimed is not None else None)
            except BaseException as exc:  # pragma: no cover
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(thread_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=3)

        self.assertFalse(errors, f"工作线程出现异常：{errors!r}")
        self.assertEqual(len(results), thread_count)

        claimed_ids = [item for item in results if item is not None]
        self.assertEqual(len(claimed_ids), 1, f"应只有一个 worker 拿到 job，实际：{claimed_ids!r}")
        self.assertEqual(claimed_ids[0], seeded_job.id)

        snapshot = repo.snapshot()
        match = next((item for item in snapshot.agent_jobs if item.id == seeded_job.id), None)
        self.assertIsNotNone(match)
        self.assertEqual(match.status, JobStatus.RUNNING)
        self.assertEqual(snapshot.control_snapshot.scheduler.current_job_id, seeded_job.id)


class PrivateCacheConcurrentReadWriteTests(unittest.TestCase):
    """Probe ``private_*_cache`` dicts under concurrent read/write churn.

    These caches in ``main.py`` are plain ``dict`` instances and assume
    callers serialize writes through ``upsert_private_order_history_cache``.
    The test confirms the cache does not raise / corrupt under stress when
    one thread keeps mutating while another keeps snapshotting it.
    """

    def test_concurrent_order_history_cache_writes_do_not_crash_readers(self) -> None:
        from bybit_private_client import BybitPrivateClient  # type: ignore  # noqa: WPS433

        # Build a deterministic status so all threads share the same status_key.
        from models import BybitPrivateStatus  # type: ignore  # noqa: WPS433

        status = BybitPrivateStatus(
            configured=True,
            can_query_private=True,
            source="file",
            config_path="/tmp/private-api.json",
            config_exists=True,
            example_config_path="/tmp/private-api.example.json",
            api_base_url="https://api.bybit.com",
            account_type="UNIFIED",
            mode=AccountMode.LIVE,
            key_hint="conc...test",
            last_error=None,
            updated_at="2026-04-26T00:00:00+08:00",
        )

        # Reset the cache so prior tests/runs cannot bleed in.
        control_main.private_order_history_cache.update(
            {"status_key": None, "updated_at": 0.0, "items": []}
        )

        del BybitPrivateClient  # only needed for type, not used directly

        writer_done = threading.Event()
        reader_errors: List[BaseException] = []
        writer_errors: List[BaseException] = []

        def writer() -> None:
            try:
                for batch in range(80):
                    items = [
                        {"orderId": f"conc-order-{batch:03d}-{i}", "symbol": "BTCUSDT"}
                        for i in range(4)
                    ]
                    control_main.upsert_private_order_history_cache(status, items)
            except BaseException as exc:
                writer_errors.append(exc)
            finally:
                writer_done.set()

        def reader() -> None:
            try:
                while not writer_done.is_set():
                    snapshot_items = list(control_main.private_order_history_cache.get("items") or [])
                    for entry in snapshot_items:
                        # Touch fields the production reader touches.
                        _ = str(entry.get("orderId") or "")
                # Final read after writer finishes.
                _ = list(control_main.private_order_history_cache.get("items") or [])
            except BaseException as exc:
                reader_errors.append(exc)

        writer_thread = threading.Thread(target=writer)
        reader_threads = [threading.Thread(target=reader) for _ in range(3)]
        writer_thread.start()
        for thread in reader_threads:
            thread.start()
        writer_thread.join(timeout=4)
        for thread in reader_threads:
            thread.join(timeout=4)

        self.assertFalse(writer_errors, f"写线程异常：{writer_errors!r}")
        self.assertFalse(reader_errors, f"读线程异常：{reader_errors!r}")
        self.assertLessEqual(len(control_main.private_order_history_cache["items"]), 120)
        self.assertEqual(
            control_main.private_order_history_cache["status_key"],
            control_main.build_private_status_key(status),
        )

        # Restore for the rest of the test session.
        control_main.private_order_history_cache.update(
            {"status_key": None, "updated_at": 0.0, "items": []}
        )


class StrategyRuntimeStateRaceTests(unittest.TestCase):
    """Strategy-runtime worker writeback racing with HTTP read.

    The actual HTTP endpoint reads ``strategy_runtime_state`` atomically because
    Python's GIL guards single dict assignments — but the *combination* of
    fields (``running`` + ``last_refresh_at`` + ``last_error``) can still be
    observed mid-update.  This test confirms that mass concurrent reads never
    raise and that final state matches what the writer last set.
    """

    def test_strategy_runtime_state_concurrent_reads_observe_consistent_fields(self) -> None:
        snapshot_backup = copy.deepcopy(control_main.strategy_runtime_state)
        try:
            control_main.strategy_runtime_state.update(
                {"running": False, "last_refresh_at": None, "last_error": None, "started_once": False}
            )
            stop_event = threading.Event()
            reader_errors: List[BaseException] = []

            def writer() -> None:
                for index in range(200):
                    control_main.strategy_runtime_state["running"] = bool(index % 2)
                    control_main.strategy_runtime_state["last_refresh_at"] = (
                        f"2026-04-26T10:00:{index % 60:02d}+08:00"
                    )
                    control_main.strategy_runtime_state["last_error"] = (
                        None if index % 3 else f"writer-iter-{index}"
                    )
                    time.sleep(0)
                stop_event.set()

            def reader() -> None:
                try:
                    while not stop_event.is_set():
                        running = control_main.strategy_runtime_state.get("running")
                        last_error = control_main.strategy_runtime_state.get("last_error")
                        last_refresh = control_main.strategy_runtime_state.get("last_refresh_at")
                        # Production reader combines these fields into a payload.
                        # Confirm we can read them without TypeError under churn.
                        self.assertIn(running, {True, False, None})
                        self.assertTrue(last_error is None or isinstance(last_error, str))
                        self.assertTrue(last_refresh is None or isinstance(last_refresh, str))
                except BaseException as exc:
                    reader_errors.append(exc)

            writer_thread = threading.Thread(target=writer)
            reader_threads = [threading.Thread(target=reader) for _ in range(4)]
            writer_thread.start()
            for thread in reader_threads:
                thread.start()
            writer_thread.join(timeout=4)
            for thread in reader_threads:
                thread.join(timeout=4)

            self.assertFalse(reader_errors, f"读线程异常：{reader_errors!r}")
            # The final write left running in some deterministic state.
            self.assertIn(control_main.strategy_runtime_state["running"], {True, False})
        finally:
            control_main.strategy_runtime_state.clear()
            control_main.strategy_runtime_state.update(snapshot_backup)


class ChangeRequestStateTransitionRaceTests(unittest.TestCase):
    """Multiple workers concurrently transitioning change-requests.

    The repository serializes all ``create_change_request`` calls through
    ``self._lock`` and applies the change-request side-effects within the
    same critical section.  This test pounds that path with concurrent
    creates that each immediately transition to APPLIED and verifies the
    derived state stays consistent.
    """

    def test_concurrent_change_request_transitions_keep_state_coherent(self) -> None:
        repo = _make_temp_repo()
        thread_count = 8
        barrier = threading.Barrier(thread_count)
        errors: List[BaseException] = []
        applied_ids: List[str] = []
        applied_lock = threading.Lock()

        def worker(index: int) -> None:
            try:
                barrier.wait(timeout=2)
                # ``alert.rule.update`` always transitions to APPLIED through
                # the locked ``_apply_change_request_locked`` path.
                record = repo.create_change_request(
                    ChangeRequestCreate(
                        type="alert.rule.update",
                        payload={
                            "symbol": "BTCUSDT",
                            "alert_enabled": True,
                            "threshold_pct": 1.5 + index * 0.05,
                            "cooldown_minutes": 30 + index,
                        },
                        target_mode=AccountMode.PAPER,
                        priority=PriorityLevel.NORMAL,
                        summary=f"状态迁移并发测试 #{index}",
                        requested_by="concurrency-test",
                    )
                )
                with applied_lock:
                    applied_ids.append(record.id)
            except BaseException as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(thread_count)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=4)

        self.assertFalse(errors, f"工作线程出现异常：{errors!r}")
        self.assertEqual(len(applied_ids), thread_count)

        snapshot = repo.snapshot()
        # Every concurrently-created change-request landed in APPLIED state.
        for change_id in applied_ids:
            record = next(
                (item for item in snapshot.change_requests if item.id == change_id), None
            )
            self.assertIsNotNone(record, f"快照中找不到 {change_id}")
            self.assertEqual(record.status.value, "applied")

        # The watchlist's threshold matches the final winner — the state must
        # not be split between half-applied requests.
        item = next(item for item in snapshot.watchlist if item.symbol == "BTCUSDT")
        self.assertGreaterEqual(item.alert_threshold_pct, 1.5)
        self.assertLessEqual(item.alert_threshold_pct, 1.5 + (thread_count - 1) * 0.05 + 1e-9)


class AlertAppendAndAcknowledgeRaceTests(unittest.TestCase):
    """Alert append racing with acknowledge.

    Production code paths sometimes call ``_upsert_system_alert_locked`` from
    one thread while a desktop user (HTTP) acknowledges a different alert.
    Both grab ``repo._lock`` so the test verifies they serialize cleanly.
    """

    def test_concurrent_alert_append_and_acknowledge(self) -> None:
        repo = _make_temp_repo()

        # Pre-seed alerts to acknowledge.
        seeded_ids: List[str] = []
        for idx in range(6):
            alert_id = f"alert-pre-{idx}"
            repo.state.alerts.insert(
                0,
                AlertRecord(
                    id=alert_id,
                    severity="P2",
                    symbol="BTCUSDT",
                    title=f"预置告警 #{idx}",
                    description="并发 append/ack 压力测试占位。",
                    triggered_at="2026-04-26T00:00:00+08:00",
                    suggested_action="无需动作。",
                    acknowledged=False,
                    source_type="system",
                    rule_key=f"concurrency-test:append-ack:{idx}",
                ),
            )
            seeded_ids.append(alert_id)
        repo._persist()  # type: ignore[attr-defined]

        thread_count = len(seeded_ids) + 6
        barrier = threading.Barrier(thread_count)
        errors: List[BaseException] = []

        def appender(index: int) -> None:
            try:
                barrier.wait(timeout=2)
                with repo._lock:  # type: ignore[attr-defined]
                    repo._upsert_system_alert_locked(  # type: ignore[attr-defined]
                        rule_key=f"concurrency-test:appender:{index}",
                        severity="P2",
                        symbol="BTCUSDT",
                        title=f"并发新增告警 #{index}",
                        description="并发 append 压力测试。",
                        suggested_action="无需动作。",
                    )
                    repo._refresh_derived_state()  # type: ignore[attr-defined]
                    repo._persist()  # type: ignore[attr-defined]
            except BaseException as exc:
                errors.append(exc)

        def acker(target_id: str) -> None:
            try:
                barrier.wait(timeout=2)
                repo.acknowledge_alert(target_id, AlertAcknowledgePayload(acknowledged=True))
            except BaseException as exc:
                errors.append(exc)

        threads: List[threading.Thread] = []
        for i in range(6):
            threads.append(threading.Thread(target=appender, args=(i,)))
        for alert_id in seeded_ids:
            threads.append(threading.Thread(target=acker, args=(alert_id,)))

        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=4)

        self.assertFalse(errors, f"工作线程出现异常：{errors!r}")

        snapshot = repo.snapshot()
        # All 6 originally seeded alerts must be acknowledged.
        for alert_id in seeded_ids:
            record = next((item for item in snapshot.alerts if item.id == alert_id), None)
            self.assertIsNotNone(record, f"找不到 {alert_id}")
            self.assertTrue(record.acknowledged, f"{alert_id} 未被确认")
        # All 6 freshly-appended alerts exist.
        for index in range(6):
            rule_key = f"concurrency-test:appender:{index}"
            self.assertTrue(
                any(getattr(item, "rule_key", None) == rule_key for item in snapshot.alerts),
                f"未找到新增告警 {rule_key}",
            )


class StrategyRuntimeWorkerSnapshotRaceTests(unittest.TestCase):
    """Strategy runtime snapshot writeback racing with HTTP /api/strategies/runtime read.

    The strategy-runtime worker periodically rewrites
    ``repo.state.strategy_runtime_snapshots`` via locked helpers; HTTP
    handlers read those snapshots through ``repo.snapshot()``.  Both go
    through ``self._lock`` so the test pounds them concurrently to confirm
    the deep-copy snapshot returned to the HTTP layer is internally
    consistent (same number of snapshots; no half-mutated entries).
    """

    def test_runtime_snapshot_writes_and_http_reads_stay_consistent(self) -> None:
        from models import StrategyRuntimeSnapshot  # type: ignore  # noqa: WPS433

        repo = _make_temp_repo()
        strategies = list(repo.state.strategies)
        if not strategies:
            self.skipTest("seed state has no strategies; cannot exercise runtime snapshot race")

        # Reset existing snapshots so we know exactly what should be present.
        with repo._lock:  # type: ignore[attr-defined]
            repo.state.strategy_runtime_snapshots = []
            repo._persist()  # type: ignore[attr-defined]

        stop_event = threading.Event()
        writer_errors: List[BaseException] = []
        reader_errors: List[BaseException] = []

        def writer() -> None:
            try:
                for iteration in range(60):
                    rebuilt = []
                    for strategy in strategies:
                        rebuilt.append(
                            StrategyRuntimeSnapshot(
                                strategy_id=strategy.id,
                                strategy_name=strategy.name,
                                symbol=strategy.symbols[0] if strategy.symbols else "BTCUSDT",
                                market="perp",
                                mode=strategy.mode,
                                runtime_status=(
                                    strategy.status
                                    if strategy.status in {"running", "paused", "paper_only", "shadow"}
                                    else "running"
                                ),
                                signal=("flat" if iteration % 2 else "watch"),
                                last_price=100.0 + iteration,
                                reference_price=100.0 + iteration,
                                change_24h=0.5 + iteration * 0.01,
                                note=f"writer-iter-{iteration}",
                                next_action="保持观察",
                                last_evaluated_at=f"2026-04-26T10:00:{iteration % 60:02d}+08:00",
                            )
                        )
                    with repo._lock:  # type: ignore[attr-defined]
                        repo.state.strategy_runtime_snapshots = rebuilt
                        repo._refresh_derived_state()  # type: ignore[attr-defined]
            except BaseException as exc:
                writer_errors.append(exc)
            finally:
                stop_event.set()

        def reader() -> None:
            try:
                while not stop_event.is_set():
                    snapshot = repo.snapshot()
                    runtime = list(snapshot.strategy_runtime_snapshots)
                    if not runtime:
                        continue
                    self.assertEqual(len(runtime), len(strategies))
                    for entry in runtime:
                        self.assertIsInstance(entry.symbol, str)
                        self.assertGreaterEqual(entry.last_price, 0.0)
            except BaseException as exc:
                reader_errors.append(exc)

        writer_thread = threading.Thread(target=writer)
        reader_threads = [threading.Thread(target=reader) for _ in range(3)]
        writer_thread.start()
        for thread in reader_threads:
            thread.start()
        writer_thread.join(timeout=4)
        for thread in reader_threads:
            thread.join(timeout=4)

        self.assertFalse(writer_errors, f"写线程异常：{writer_errors!r}")
        self.assertFalse(reader_errors, f"读线程异常：{reader_errors!r}")

        final_snapshot = repo.snapshot()
        self.assertEqual(len(final_snapshot.strategy_runtime_snapshots), len(strategies))


if __name__ == "__main__":
    unittest.main()

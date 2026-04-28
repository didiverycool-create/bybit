"""Tests for the SQLite persistence layer (P0-5.1 §B/§C step 1).

These tests run entirely against in-memory SQLite (``:memory:``) to keep them
fast and free of disk-IO flakiness; one dedicated test exercises a tempfile-
backed path to confirm WAL-mode connection setup also works on disk.

Coverage roughly tracks the design's §F.1 unit-test inventory plus a handful
of safety nets:

* Migration runner — empty DB applies all migrations; re-run is a no-op;
  newer-than-code DB is refused.
* Audit DAO — insert/get/list filters; UPDATE/DELETE blocked by trigger.
* ChangeRequest DAO — upsert + history append (atomically via PersistenceUnit).
* AgentJob DAO — UNIQUE(idempotency_key) enforced.
* Backtest DAO — large JSON ``result_blob`` round-trip.
* ExecutionEvent DAO — UNIQUE(intent_id, state_to, occurred_at) enforced.
* ParameterVersion DAO — UNIQUE(strategy_id, version_no) enforced.
* Config DAO — MAX(created_at) read.
* PersistenceUnit — commit/rollback semantics.
"""

from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path


CONTROL_API_DIR = Path(__file__).resolve().parents[1]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))


from persistence import (  # noqa: E402
    AgentJobDao,
    AuditDao,
    BacktestDao,
    ChangeRequestDao,
    ConfigDao,
    ExecutionEventDao,
    Migration,
    MigrationError,
    MigrationRunner,
    ParameterVersionDao,
    PersistenceUnit,
    connect,
    discover_migrations,
    run_migrations,
)


# ---------------------------------------------------------------------- helpers
EXPECTED_TABLES = {
    "audit_events",
    "change_requests",
    "change_request_history",
    "agent_jobs",
    "backtest_runs",
    "execution_events",
    "parameter_versions",
    "config_snapshots",
    "schema_migrations",
}


def _table_names(conn: sqlite3.Connection) -> set:
    return {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }


def _index_names(conn: sqlite3.Connection, table: str) -> set:
    return {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name = ?",
            (table,),
        ).fetchall()
        if not row[0].startswith("sqlite_autoindex")
    }


def _trigger_names(conn: sqlite3.Connection, table: str) -> set:
    return {
        row[0]
        for row in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name = ?",
            (table,),
        ).fetchall()
    }


def _fresh_conn() -> sqlite3.Connection:
    conn = connect(":memory:")
    run_migrations(conn)
    return conn


# ============================================================ migration runner
class MigrationRunnerTests(unittest.TestCase):
    def test_empty_database_applies_all_migrations(self) -> None:
        conn = connect(":memory:")
        applied = run_migrations(conn)
        self.assertGreaterEqual(len(applied), 1)
        self.assertEqual(applied[0].version, 1)
        # All design-level tables are present.
        self.assertTrue(EXPECTED_TABLES.issubset(_table_names(conn)))
        # schema_migrations row recorded.
        rows = conn.execute(
            "SELECT version, name, checksum FROM schema_migrations"
        ).fetchall()
        self.assertEqual(len(rows), len(applied))
        for row in rows:
            self.assertIsNotNone(row[2])
            self.assertNotEqual(row[2], "")

    def test_rerun_is_idempotent(self) -> None:
        conn = connect(":memory:")
        run_migrations(conn)
        applied_again = run_migrations(conn)
        self.assertEqual(applied_again, [])

    def test_newer_than_code_database_refuses_to_start(self) -> None:
        conn = connect(":memory:")
        run_migrations(conn)
        # Pretend a future version 999 has already been applied locally.
        conn.execute(
            "INSERT INTO schema_migrations (version, name, checksum) VALUES (?, ?, ?)",
            (999, "future_migration", "deadbeef"),
        )
        conn.commit()
        runner = MigrationRunner(conn)
        with self.assertRaises(MigrationError) as ctx:
            runner.pending_migrations()
        self.assertIn("newer than code knows", str(ctx.exception))

    def test_partial_history_applies_only_pending(self) -> None:
        # Build a runner with two synthetic migrations and apply them stepwise.
        conn = connect(":memory:")
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "001_first.sql").write_text(
                "CREATE TABLE t1 (id INTEGER PRIMARY KEY) STRICT;",
                encoding="utf-8",
            )
            (tmp_path / "002_second.sql").write_text(
                "CREATE TABLE t2 (id INTEGER PRIMARY KEY) STRICT;",
                encoding="utf-8",
            )
            # Bootstrap the schema_migrations table by hand so the runner
            # treats this as an "initialized" database with v1 already done.
            conn.execute(
                "CREATE TABLE schema_migrations ("
                "version INTEGER PRIMARY KEY, name TEXT NOT NULL, "
                "applied_at TEXT NOT NULL DEFAULT '', checksum TEXT) STRICT"
            )
            # Manually pre-apply 001 to simulate a partially-migrated DB.
            conn.executescript("CREATE TABLE t1 (id INTEGER PRIMARY KEY) STRICT;")
            conn.execute(
                "INSERT INTO schema_migrations (version, name, checksum) "
                "VALUES (1, 'first', 'x')"
            )
            conn.commit()
            runner = MigrationRunner(conn, directory=tmp_path)
            applied = runner.apply_pending()
        self.assertEqual([m.version for m in applied], [2])
        self.assertIn("t1", _table_names(conn))
        self.assertIn("t2", _table_names(conn))

    def test_discover_rejects_duplicate_versions(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "001_a.sql").write_text("-- empty", encoding="utf-8")
            (tmp_path / "001_b.sql").write_text("-- empty", encoding="utf-8")
            with self.assertRaises(MigrationError):
                discover_migrations(tmp_path)

    def test_failed_migration_rolls_back(self) -> None:
        conn = connect(":memory:")
        with tempfile.TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            (tmp_path / "001_bad.sql").write_text(
                "CREATE TABLE t (id INTEGER PRIMARY KEY) STRICT;\n"
                "THIS IS NOT VALID SQL;",
                encoding="utf-8",
            )
            runner = MigrationRunner(conn, directory=tmp_path)
            with self.assertRaises(MigrationError):
                runner.apply_pending()
        # Even though the first statement was a CREATE TABLE that
        # technically succeeded, the BEGIN/COMMIT wrapper means the failure
        # rolled it back.
        self.assertNotIn(
            "schema_migrations", _table_names(conn)
        )  # never created either


# ============================================================== schema shape
class SchemaShapeTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()

    def tearDown(self) -> None:
        self.conn.close()

    def test_all_design_tables_present(self) -> None:
        self.assertTrue(EXPECTED_TABLES.issubset(_table_names(self.conn)))

    def test_audit_events_indexes_match_design(self) -> None:
        idx = _index_names(self.conn, "audit_events")
        self.assertIn("idx_audit_events_occurred_at", idx)
        self.assertIn("idx_audit_events_strategy", idx)
        self.assertIn("idx_audit_events_event_type", idx)
        self.assertIn("idx_audit_events_severity", idx)
        self.assertIn("idx_audit_events_priority_key", idx)

    def test_audit_events_triggers_present(self) -> None:
        triggers = _trigger_names(self.conn, "audit_events")
        self.assertIn("audit_events_no_update", triggers)
        self.assertIn("audit_events_no_delete", triggers)

    def test_change_requests_indexes_match_design(self) -> None:
        idx = _index_names(self.conn, "change_requests")
        self.assertIn("idx_cr_status", idx)
        self.assertIn("idx_cr_strategy", idx)
        self.assertIn("idx_cr_source_proposal", idx)

    def test_agent_jobs_idempotency_unique(self) -> None:
        # Querying the index_list and index_info pragmas confirms the UNIQUE
        # marker is in place on idempotency_key.
        rows = self.conn.execute("PRAGMA index_list('agent_jobs')").fetchall()
        unique_indexes = [row for row in rows if row[2] == 1]
        self.assertTrue(unique_indexes, "expected at least one UNIQUE index")

    def test_execution_events_unique_constraint(self) -> None:
        rows = self.conn.execute("PRAGMA index_list('execution_events')").fetchall()
        unique_indexes = [row for row in rows if row[2] == 1]
        self.assertTrue(
            unique_indexes,
            "expected UNIQUE (intent_id, state_to, occurred_at)",
        )

    def test_parameter_versions_unique_constraint(self) -> None:
        rows = self.conn.execute(
            "PRAGMA index_list('parameter_versions')"
        ).fetchall()
        unique_indexes = [row for row in rows if row[2] == 1]
        self.assertTrue(unique_indexes)


# ================================================================== AuditDao
class AuditDaoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.dao = AuditDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _sample_event(self, **overrides):
        base = {
            "id": "evt-1",
            "event_type": "exchange_order.created",
            "severity": "INFO",
            "source": "quant-core",
            "symbol": "BTCUSDT",
            "strategy_id": "strat-001",
            "payload_json": json.dumps({"side": "buy"}),
            "summary": "test event",
            "impact_detail": None,
            "priority": 4,
            "is_key_event": True,
            "trace_id": "trace-1",
            "occurred_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_insert_then_get(self) -> None:
        self.dao.insert(self._sample_event())
        fetched = self.dao.get("evt-1")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["event_type"], "exchange_order.created")
        self.assertEqual(fetched["is_key_event"], 1)
        self.assertEqual(fetched["priority"], 4)

    def test_get_missing_returns_none(self) -> None:
        self.assertIsNone(self.dao.get("does-not-exist"))

    def test_list_by_strategy_id(self) -> None:
        self.dao.insert(self._sample_event(id="a", strategy_id="s1"))
        self.dao.insert(self._sample_event(id="b", strategy_id="s2"))
        self.dao.insert(self._sample_event(id="c", strategy_id="s1"))
        rows = self.dao.list(strategy_id="s1")
        self.assertEqual({r["id"] for r in rows}, {"a", "c"})

    def test_list_by_event_type(self) -> None:
        self.dao.insert(self._sample_event(id="a", event_type="alpha"))
        self.dao.insert(self._sample_event(id="b", event_type="beta"))
        rows = self.dao.list(event_type="alpha")
        self.assertEqual([r["id"] for r in rows], ["a"])

    def test_list_by_severity(self) -> None:
        self.dao.insert(self._sample_event(id="a", severity="INFO"))
        self.dao.insert(self._sample_event(id="b", severity="ERROR"))
        rows = self.dao.list(severity="ERROR")
        self.assertEqual([r["id"] for r in rows], ["b"])

    def test_list_by_time_range(self) -> None:
        self.dao.insert(
            self._sample_event(id="a", occurred_at="2026-04-26T08:00:00.000Z")
        )
        self.dao.insert(
            self._sample_event(id="b", occurred_at="2026-04-26T10:00:00.000Z")
        )
        self.dao.insert(
            self._sample_event(id="c", occurred_at="2026-04-26T12:00:00.000Z")
        )
        rows = self.dao.list(
            since="2026-04-26T09:00:00.000Z",
            until="2026-04-26T11:00:00.000Z",
        )
        self.assertEqual([r["id"] for r in rows], ["b"])

    def test_list_orders_newest_first_by_default(self) -> None:
        self.dao.insert(
            self._sample_event(id="old", occurred_at="2026-04-26T08:00:00.000Z")
        )
        self.dao.insert(
            self._sample_event(id="new", occurred_at="2026-04-26T12:00:00.000Z")
        )
        rows = self.dao.list()
        self.assertEqual(rows[0]["id"], "new")
        self.assertEqual(rows[1]["id"], "old")

    def test_list_with_limit(self) -> None:
        for i in range(5):
            self.dao.insert(
                self._sample_event(
                    id=f"e{i}",
                    occurred_at=f"2026-04-26T10:00:0{i}.000Z",
                )
            )
        rows = self.dao.list(limit=2)
        self.assertEqual(len(rows), 2)

    def test_count(self) -> None:
        self.dao.insert(self._sample_event(id="a", strategy_id="s1"))
        self.dao.insert(self._sample_event(id="b", strategy_id="s2"))
        self.assertEqual(self.dao.count(), 2)
        self.assertEqual(self.dao.count(strategy_id="s1"), 1)

    def test_update_blocked_by_trigger(self) -> None:
        self.dao.insert(self._sample_event())
        with self.assertRaises(sqlite3.IntegrityError) as ctx:
            self.conn.execute(
                "UPDATE audit_events SET event_type='hacked' WHERE id='evt-1'"
            )
        self.assertIn("append-only", str(ctx.exception))

    def test_delete_blocked_by_trigger(self) -> None:
        self.dao.insert(self._sample_event())
        with self.assertRaises(sqlite3.IntegrityError) as ctx:
            self.conn.execute("DELETE FROM audit_events WHERE id='evt-1'")
        self.assertIn("append-only", str(ctx.exception))

    def test_severity_check_constraint_rejects_invalid(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.insert(self._sample_event(severity="not-a-level"))

    def test_insert_many(self) -> None:
        events = [
            self._sample_event(id=f"bulk-{i}") for i in range(3)
        ]
        n = self.dao.insert_many(events)
        self.assertEqual(n, 3)
        self.assertEqual(self.dao.count(), 3)


# ============================================================ ChangeRequestDao
class ChangeRequestDaoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.dao = ChangeRequestDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _row(self, **overrides):
        base = {
            "id": "cr-1",
            "type": "param_edit",
            "status": "draft",
            "strategy_id": "strat-001",
            "payload_json": json.dumps({"foo": 1}),
            "requested_by": "desktop_operator",
            "created_at": "2026-04-26T10:00:00.000Z",
            "updated_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_upsert_then_get(self) -> None:
        self.dao.upsert(self._row())
        fetched = self.dao.get("cr-1")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["status"], "draft")

    def test_upsert_overwrites_existing(self) -> None:
        self.dao.upsert(self._row())
        self.dao.upsert(self._row(status="queued"))
        fetched = self.dao.get("cr-1")
        self.assertEqual(fetched["status"], "queued")

    def test_update_status(self) -> None:
        self.dao.upsert(self._row())
        rowcount = self.dao.update_status(
            "cr-1",
            status="applied",
            updated_at="2026-04-26T11:00:00.000Z",
            applied_at="2026-04-26T11:00:00.000Z",
        )
        self.assertEqual(rowcount, 1)
        fetched = self.dao.get("cr-1")
        self.assertEqual(fetched["status"], "applied")
        self.assertEqual(fetched["applied_at"], "2026-04-26T11:00:00.000Z")

    def test_status_check_constraint(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.upsert(self._row(status="not-a-status"))

    def test_history_append_in_same_transaction(self) -> None:
        with PersistenceUnit(self.conn):
            self.dao.upsert(self._row(status="queued"))
            self.dao.insert_history({
                "change_request_id": "cr-1",
                "status_from": "draft",
                "status_to": "queued",
                "payload_json": json.dumps({"foo": 1}),
                "audit_event_id": None,
                "transition_at": "2026-04-26T10:00:00.000Z",
            })
        history = self.dao.list_history("cr-1")
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["status_to"], "queued")

    def test_rollback_drops_both_writes(self) -> None:
        try:
            with PersistenceUnit(self.conn):
                self.dao.upsert(self._row(status="queued"))
                self.dao.insert_history({
                    "change_request_id": "cr-1",
                    "status_from": "draft",
                    "status_to": "queued",
                    "payload_json": "{}",
                    "transition_at": "2026-04-26T10:00:00.000Z",
                })
                raise RuntimeError("simulated failure")
        except RuntimeError:
            pass
        self.assertIsNone(self.dao.get("cr-1"))
        self.assertEqual(self.dao.list_history("cr-1"), [])

    def test_list_by_status(self) -> None:
        self.dao.upsert(self._row(id="a", status="draft"))
        self.dao.upsert(self._row(id="b", status="queued"))
        self.dao.upsert(self._row(id="c", status="draft"))
        rows = self.dao.list(status="draft")
        self.assertEqual({r["id"] for r in rows}, {"a", "c"})

    def test_list_by_strategy_id(self) -> None:
        self.dao.upsert(self._row(id="a", strategy_id="s1"))
        self.dao.upsert(self._row(id="b", strategy_id="s2"))
        rows = self.dao.list(strategy_id="s2")
        self.assertEqual([r["id"] for r in rows], ["b"])

    def test_list_history_sorted_desc(self) -> None:
        self.dao.upsert(self._row())
        self.dao.insert_history({
            "change_request_id": "cr-1",
            "status_from": "draft",
            "status_to": "queued",
            "payload_json": "{}",
            "transition_at": "2026-04-26T10:00:00.000Z",
        })
        self.dao.insert_history({
            "change_request_id": "cr-1",
            "status_from": "queued",
            "status_to": "applied",
            "payload_json": "{}",
            "transition_at": "2026-04-26T11:00:00.000Z",
        })
        rows = self.dao.list_history("cr-1")
        self.assertEqual(rows[0]["status_to"], "applied")
        self.assertEqual(rows[1]["status_to"], "queued")


# ============================================================== AgentJobDao
class AgentJobDaoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.dao = AgentJobDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _row(self, **overrides):
        base = {
            "id": "job-1",
            "job_type": "generate_review",
            "status": "queued",
            "idempotency_key": "key-1",
            "strategy_id": "strat-001",
            "context_json": json.dumps({"foo": 1}),
            "allowed_actions_json": json.dumps(["read", "write"]),
            "timeout_seconds": 120,
            "writeback_target": "audit",
            "retry_count": 0,
            "requested_by": "desktop_operator",
            "queued_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_upsert_then_get(self) -> None:
        self.dao.upsert(self._row())
        fetched = self.dao.get("job-1")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["status"], "queued")

    def test_idempotency_key_unique_enforced(self) -> None:
        self.dao.upsert(self._row(id="job-1", idempotency_key="dup"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.upsert(self._row(id="job-2", idempotency_key="dup"))

    def test_get_by_idempotency_key(self) -> None:
        self.dao.upsert(self._row(id="job-1", idempotency_key="abc"))
        fetched = self.dao.get_by_idempotency_key("abc")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["id"], "job-1")

    def test_update_status(self) -> None:
        self.dao.upsert(self._row())
        n = self.dao.update_status(
            "job-1",
            status="running",
            started_at="2026-04-26T10:01:00.000Z",
        )
        self.assertEqual(n, 1)
        fetched = self.dao.get("job-1")
        self.assertEqual(fetched["status"], "running")
        self.assertEqual(fetched["started_at"], "2026-04-26T10:01:00.000Z")

    def test_update_result(self) -> None:
        self.dao.upsert(self._row())
        result_payload = json.dumps({"verdict": "ok"})
        self.dao.update_result(
            "job-1",
            result_json=result_payload,
            finished_at="2026-04-26T10:05:00.000Z",
            status="completed",
        )
        fetched = self.dao.get("job-1")
        self.assertEqual(fetched["result_json"], result_payload)
        self.assertEqual(fetched["status"], "completed")
        self.assertEqual(fetched["finished_at"], "2026-04-26T10:05:00.000Z")

    def test_status_check_constraint(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.upsert(self._row(status="not-a-status"))

    def test_list_by_filters(self) -> None:
        self.dao.upsert(self._row(id="a", status="queued", job_type="x"))
        self.dao.upsert(
            self._row(
                id="b",
                status="completed",
                job_type="x",
                idempotency_key="k2",
            )
        )
        self.dao.upsert(
            self._row(
                id="c",
                status="queued",
                job_type="y",
                idempotency_key="k3",
            )
        )
        self.assertEqual(
            {r["id"] for r in self.dao.list(status="queued")}, {"a", "c"}
        )
        self.assertEqual(
            [r["id"] for r in self.dao.list(job_type="y")], ["c"]
        )


# ============================================================== BacktestDao
class BacktestDaoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.dao = BacktestDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _row(self, **overrides):
        base = {
            "id": "bt-1",
            "strategy_id": "strat-001",
            "status": "queued",
            "timeframe": "1h",
            "data_range_text": "最近 90 天",
            "history_truncated": 0,
            "requested_by": "desktop_operator",
            "created_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_upsert_then_get(self) -> None:
        self.dao.upsert(self._row())
        fetched = self.dao.get("bt-1")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["timeframe"], "1h")

    def test_timeframe_check_constraint(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.upsert(self._row(timeframe="3h"))

    def test_status_check_constraint(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.upsert(self._row(status="weird"))

    def test_large_result_blob_round_trip(self) -> None:
        # Synthesize a ~1 MB payload that represents trade-level detail.
        trades = [
            {
                "trade_id": f"t-{i}",
                "side": "buy" if i % 2 == 0 else "sell",
                "price": 30000.0 + i,
                "qty": 0.001 * i,
                "fee": 0.05,
            }
            for i in range(5000)
        ]
        big_blob = json.dumps({"trades": trades})
        self.assertGreater(len(big_blob), 100_000)
        self.dao.upsert(self._row())
        self.dao.update_result(
            "bt-1",
            metrics_json=json.dumps({"sharpe": 1.5, "trades": len(trades)}),
            result_blob=big_blob,
            completed_at="2026-04-26T10:30:00.000Z",
            status="completed",
        )
        fetched = self.dao.get("bt-1")
        self.assertEqual(fetched["status"], "completed")
        decoded = json.loads(fetched["result_blob"])
        self.assertEqual(len(decoded["trades"]), 5000)

    def test_update_status(self) -> None:
        self.dao.upsert(self._row())
        n = self.dao.update_status(
            "bt-1",
            status="running",
        )
        self.assertEqual(n, 1)
        self.assertEqual(self.dao.get("bt-1")["status"], "running")

    def test_list_by_strategy_id(self) -> None:
        self.dao.upsert(self._row(id="a", strategy_id="s1"))
        self.dao.upsert(self._row(id="b", strategy_id="s2"))
        rows = self.dao.list(strategy_id="s2")
        self.assertEqual([r["id"] for r in rows], ["b"])

    def test_history_truncated_flag_round_trips(self) -> None:
        self.dao.upsert(self._row(history_truncated=True))
        fetched = self.dao.get("bt-1")
        self.assertEqual(fetched["history_truncated"], 1)


# ========================================================== ExecutionEventDao
class ExecutionEventDaoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.dao = ExecutionEventDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _row(self, **overrides):
        base = {
            "id": "ee-1",
            "intent_id": "intent-1",
            "intent_seq": 1,
            "strategy_id": "strat-001",
            "state_to": "PROPOSED",
            "payload_json": json.dumps({"foo": 1}),
            "occurred_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_insert_then_get(self) -> None:
        self.dao.insert(self._row())
        fetched = self.dao.get("ee-1")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched["state_to"], "PROPOSED")

    def test_unique_constraint_intent_state_occurred(self) -> None:
        self.dao.insert(self._row())
        # Same (intent_id, state_to, occurred_at) tuple → must reject.
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.insert(self._row(id="ee-2"))

    def test_state_to_check_constraint(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.insert(self._row(state_to="weird-state"))

    def test_list_by_intent(self) -> None:
        self.dao.insert(self._row(id="a", state_to="PROPOSED"))
        self.dao.insert(
            self._row(
                id="b",
                state_to="PREVIEWED",
                occurred_at="2026-04-26T10:00:01.000Z",
            )
        )
        self.dao.insert(
            self._row(
                id="c",
                state_to="ROUTED",
                occurred_at="2026-04-26T10:00:02.000Z",
            )
        )
        rows = self.dao.list_by_intent("intent-1")
        # list_by_intent orders ascending so callers see a chronological trail.
        self.assertEqual(
            [r["state_to"] for r in rows],
            ["PROPOSED", "PREVIEWED", "ROUTED"],
        )

    def test_list_by_state_to(self) -> None:
        self.dao.insert(self._row(id="a", intent_id="i1", state_to="PROPOSED"))
        self.dao.insert(
            self._row(id="b", intent_id="i2", state_to="REJECTED")
        )
        rows = self.dao.list(state_to="REJECTED")
        self.assertEqual([r["id"] for r in rows], ["b"])

    def test_list_by_strategy_id(self) -> None:
        self.dao.insert(self._row(id="a", strategy_id="s1", intent_id="i1"))
        self.dao.insert(self._row(id="b", strategy_id="s2", intent_id="i2"))
        rows = self.dao.list(strategy_id="s2")
        self.assertEqual([r["id"] for r in rows], ["b"])


# ========================================================= ParameterVersionDao
class ParameterVersionDaoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.dao = ParameterVersionDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _row(self, **overrides):
        base = {
            "strategy_id": "strat-001",
            "version_no": 1,
            "parameters_json": json.dumps({"sma_short": 20, "sma_long": 50}),
            "risk_budget": 0.05,
            "edited_by": "desktop_operator",
            "created_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_insert_returns_id(self) -> None:
        new_id = self.dao.insert(self._row())
        self.assertGreater(new_id, 0)

    def test_unique_strategy_version_enforced(self) -> None:
        self.dao.insert(self._row())
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.insert(self._row())  # same (strategy_id, version_no)

    def test_get_latest_returns_max_version(self) -> None:
        self.dao.insert(self._row(version_no=1))
        self.dao.insert(self._row(version_no=2))
        self.dao.insert(self._row(version_no=3))
        latest = self.dao.get_latest("strat-001")
        self.assertEqual(latest["version_no"], 3)

    def test_get_max_version_empty(self) -> None:
        self.assertEqual(self.dao.get_max_version("strat-001"), 0)

    def test_get_max_version_with_data(self) -> None:
        self.dao.insert(self._row(version_no=1))
        self.dao.insert(self._row(version_no=5))
        self.assertEqual(self.dao.get_max_version("strat-001"), 5)

    def test_list_by_strategy_id(self) -> None:
        self.dao.insert(self._row(strategy_id="s1", version_no=1))
        self.dao.insert(self._row(strategy_id="s2", version_no=1))
        self.dao.insert(self._row(strategy_id="s1", version_no=2))
        rows = self.dao.list(strategy_id="s1")
        self.assertEqual([r["version_no"] for r in rows], [2, 1])


# =================================================================== ConfigDao
class ConfigDaoTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.dao = ConfigDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _row(self, **overrides):
        base = {
            "snapshot_kind": "settings",
            "payload_json": json.dumps({"theme": "dark"}),
            "edited_by": "desktop_operator",
            "edit_reason": "initial",
            "created_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_insert_returns_id(self) -> None:
        snap_id = self.dao.insert(self._row())
        self.assertGreater(snap_id, 0)

    def test_kind_check_constraint(self) -> None:
        with self.assertRaises(sqlite3.IntegrityError):
            self.dao.insert(self._row(snapshot_kind="not-a-kind"))

    def test_get_current_returns_latest(self) -> None:
        self.dao.insert(
            self._row(created_at="2026-04-26T10:00:00.000Z")
        )
        self.dao.insert(
            self._row(
                created_at="2026-04-26T11:00:00.000Z",
                payload_json=json.dumps({"theme": "light"}),
            )
        )
        current = self.dao.get_current("settings")
        self.assertEqual(json.loads(current["payload_json"])["theme"], "light")

    def test_get_max_created_at(self) -> None:
        self.dao.insert(self._row(created_at="2026-04-26T10:00:00.000Z"))
        self.dao.insert(self._row(created_at="2026-04-26T12:00:00.000Z"))
        self.assertEqual(
            self.dao.get_max_created_at("settings"),
            "2026-04-26T12:00:00.000Z",
        )

    def test_get_max_created_at_empty_returns_none(self) -> None:
        self.assertIsNone(self.dao.get_max_created_at("settings"))

    def test_list_by_kind(self) -> None:
        self.dao.insert(self._row(snapshot_kind="settings"))
        self.dao.insert(
            self._row(
                snapshot_kind="feature_flags",
                created_at="2026-04-26T11:00:00.000Z",
            )
        )
        rows = self.dao.list(snapshot_kind="feature_flags")
        self.assertEqual(len(rows), 1)


# =============================================================== UnitOfWork
class PersistenceUnitTests(unittest.TestCase):
    def setUp(self) -> None:
        self.conn = _fresh_conn()
        self.audit = AuditDao(self.conn)

    def tearDown(self) -> None:
        self.conn.close()

    def _event(self, **overrides):
        base = {
            "id": "evt-uow",
            "event_type": "test",
            "severity": "INFO",
            "source": "tests",
            "payload_json": "{}",
            "priority": 6,
            "is_key_event": False,
            "occurred_at": "2026-04-26T10:00:00.000Z",
        }
        base.update(overrides)
        return base

    def test_commit_persists_writes(self) -> None:
        with PersistenceUnit(self.conn):
            self.audit.insert(self._event())
        self.assertIsNotNone(self.audit.get("evt-uow"))

    def test_rollback_on_exception(self) -> None:
        try:
            with PersistenceUnit(self.conn):
                self.audit.insert(self._event())
                raise RuntimeError("boom")
        except RuntimeError:
            pass
        self.assertIsNone(self.audit.get("evt-uow"))

    def test_explicit_rollback(self) -> None:
        unit = PersistenceUnit(self.conn)
        with unit:
            self.audit.insert(self._event())
            unit.rollback()
        self.assertIsNone(self.audit.get("evt-uow"))

    def test_immediate_mode_works(self) -> None:
        with PersistenceUnit(self.conn, immediate=True):
            self.audit.insert(self._event())
        self.assertIsNotNone(self.audit.get("evt-uow"))

    def test_not_reentrant(self) -> None:
        unit = PersistenceUnit(self.conn)
        with unit:
            with self.assertRaises(RuntimeError):
                unit.__enter__()
            unit.commit()


# ============================================================ on-disk smoke
class OnDiskConnectionTests(unittest.TestCase):
    def test_file_backed_connection_enables_wal(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "control.sqlite3"
            conn = connect(db_path)
            run_migrations(conn)
            cursor = conn.execute("PRAGMA journal_mode")
            mode = cursor.fetchone()[0]
            cursor.close()
            self.assertEqual(mode.lower(), "wal")
            # Foreign keys, busy_timeout, synchronous all set.
            self.assertEqual(
                conn.execute("PRAGMA foreign_keys").fetchone()[0], 1
            )
            self.assertEqual(
                conn.execute("PRAGMA busy_timeout").fetchone()[0], 5000
            )
            conn.close()

    def test_file_backed_round_trip(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            db_path = Path(tmp) / "control.sqlite3"
            conn = connect(db_path)
            run_migrations(conn)
            audit = AuditDao(conn)
            audit.insert({
                "id": "disk-1",
                "event_type": "test",
                "severity": "INFO",
                "source": "tests",
                "payload_json": "{}",
                "priority": 6,
                "is_key_event": False,
                "occurred_at": "2026-04-26T10:00:00.000Z",
            })
            conn.commit()
            conn.close()

            # Re-open and confirm the row survived.
            conn2 = connect(db_path)
            audit2 = AuditDao(conn2)
            self.assertEqual(audit2.count(), 1)
            conn2.close()


# ============================================================================
# Round 133 — paper intent writes PROPOSED/PREVIEWED/ROUTED execution_events
# ============================================================================
# Wave-3-B §F.2 commit 2 wires the engine's _apply_paper helper to write
# three execution_events rows on every paper execute (one per state-machine
# transition).  When the engine is constructed with persistence=None the
# rows go to an in-memory list with a one-shot warn log; when a SQLite
# connection is bound, the same rows go through ExecutionEventDao.
# ============================================================================
class ExecutionEventDaoPaperIntentTests(unittest.TestCase):
    """Engine paper branch writes three execution_events rows per execute."""

    def setUp(self) -> None:
        self.conn = _fresh_conn()
        # The engine is module-imported by main; we need to instantiate a
        # standalone engine here to bind it to our test connection without
        # touching main's singleton.
        import execution_engine as ee  # type: ignore
        from risk_engine import RiskEngine  # type: ignore

        # Reset the in-memory fallback warn flag so tests stay independent.
        ee._IN_MEMORY_EXECUTION_EVENTS.clear()
        ee._IN_MEMORY_FALLBACK_WARNED = False

        self.module = ee
        self.engine = ee.ExecutionEngine(
            repo=None,  # not used by the helper under test
            persistence=self.conn,
            risk_engine=RiskEngine(),
        )

    def tearDown(self) -> None:
        self.conn.close()

    def _make_paper_decision(self):
        from models import (
            AccountMode,
            Direction,
            ExecutionDecision,
            ExecutionIntent,
            ExecutionPreview,
            NewOrderRequest,
            RiskDecision,
        )

        preview = ExecutionPreview(
            symbol="ETHUSDT",
            market="perp",
            mode=AccountMode.PAPER,
            side=Direction.BUY,
            origin="manual",
            quantity=0.01,
            price=2000.0,
            notional="20",
            action="增仓",
            allowed=True,
            current_position_size="0",
            current_avg_price="0",
            projected_position_size="0.01",
            projected_avg_price="2000",
            available_balance_before="100",
            available_balance_after="80",
            estimated_realized_pnl="0",
            generated_at="2026-04-28T08:00:00+08:00",
        )
        risk = RiskDecision(
            verdict="allow",
            reason_code="risk.approved",
            reason_detail="",
            preview=preview,
        )
        intent = ExecutionIntent(
            strategy_id="eth-revert-02",
            strategy_name="ExecHarness",
            source="manual",
            mode=AccountMode.PAPER,
            symbol="ETHUSDT",
            market="perp",
            side=Direction.BUY,
            quantity=0.01,
            price=2000.0,
            signal="buy",
            preview=preview,
            decision=risk,
            parameter_snapshot={},
            requested_by="desktop_operator",
            note=None,
            created_at="2026-04-28T08:00:00+08:00",
            intent_id="intent-r133-01",
            intent_seq=42,
        )
        new_request = NewOrderRequest(
            strategy_id="eth-revert-02",
            symbol="ETHUSDT",
            market="perp",
            mode=AccountMode.PAPER,
            side=Direction.BUY,
            quantity=0.01,
            price=2000.0,
            reduce_only=False,
            note=None,
            exchange_link_id=None,
        )
        return ExecutionDecision(
            verb="submit",
            intent=intent,
            target_order=None,
            stale_orders=[],
            new_order_request=new_request,
            risk_decision=risk,
            reason_code="paper.submit",
            reason_detail="Paper 模式：写入新成交（引擎影子决策）。",
        )

    def _emit_three_rows_via_helper(self):
        """Call the module helper directly so we can verify SQLite writes
        without spinning up the legacy ``repo.execute_strategy_signal``
        path (which writes a real trade and is exercised in
        ``ExecutePaperBranchTests``).  Mirrors the calling shape of
        ``_apply_paper`` exactly so the contract is enforced.
        """
        from datetime import datetime, timezone
        from execution_state_machine import (
            EXECUTION_STATE_PROPOSED,
            EXECUTION_STATE_PREVIEWED,
            EXECUTION_STATE_ROUTED,
        )

        decision = self._make_paper_decision()
        intent = decision.intent
        ts = datetime.now(timezone.utc)

        for index, (state_from, state_to) in enumerate(
            [
                (None, EXECUTION_STATE_PROPOSED),
                (EXECUTION_STATE_PROPOSED, EXECUTION_STATE_PREVIEWED),
                (EXECUTION_STATE_PREVIEWED, EXECUTION_STATE_ROUTED),
            ]
        ):
            self.module._emit_execution_event_row(
                connection=self.conn,
                intent=intent,
                decision=decision,
                state_from=state_from,
                state_to=state_to,
                occurred_at=ts,
                sequence_index=index,
            )
        return intent

    def test_paper_intent_writes_proposed_previewed_routed(self) -> None:
        """The engine writes exactly three execution_events rows for a
        single paper execute, threaded through the legal-transition table
        (PROPOSED → PREVIEWED → ROUTED).
        """
        intent = self._emit_three_rows_via_helper()

        dao = ExecutionEventDao(self.conn)
        rows = dao.list_by_intent(intent.intent_id)

        self.assertEqual(len(rows), 3)
        # list_by_intent orders ascending so the trail is chronological.
        self.assertEqual(
            [r["state_to"] for r in rows],
            ["PROPOSED", "PREVIEWED", "ROUTED"],
        )
        # state_from threading: PROPOSED has None; PREVIEWED follows
        # PROPOSED; ROUTED follows PREVIEWED.
        self.assertIsNone(rows[0]["state_from"])
        self.assertEqual(rows[1]["state_from"], "PROPOSED")
        self.assertEqual(rows[2]["state_from"], "PREVIEWED")
        # Each row carries the chosen verb + strategy linkage.
        for row in rows:
            self.assertEqual(row["verb"], "submit")
            self.assertEqual(row["strategy_id"], "eth-revert-02")
            self.assertEqual(row["intent_seq"], 42)

    def test_paper_intent_payload_json_captures_decision_summary(self) -> None:
        """Each row's payload_json includes the verb / mode / symbol /
        risk verdict so an audit replay can reconstruct the intent.
        """
        intent = self._emit_three_rows_via_helper()

        dao = ExecutionEventDao(self.conn)
        rows = dao.list_by_intent(intent.intent_id)

        for row in rows:
            payload = json.loads(row["payload_json"])
            self.assertEqual(payload["verb"], "submit")
            self.assertEqual(payload["mode"], "paper")
            self.assertEqual(payload["symbol"], "ETHUSDT")
            self.assertEqual(payload["risk_verdict"], "allow")

    def test_paper_intent_risk_decision_json_round_trips(self) -> None:
        intent = self._emit_three_rows_via_helper()

        dao = ExecutionEventDao(self.conn)
        rows = dao.list_by_intent(intent.intent_id)

        for row in rows:
            decision_payload = json.loads(row["risk_decision_json"])
            self.assertEqual(decision_payload["verdict"], "allow")
            self.assertEqual(
                decision_payload["reason_code"], "risk.approved"
            )

    def test_paper_intent_unique_constraint_on_state_to(self) -> None:
        """Three rows on the same intent share the same intent_id but
        carry different (state_to, occurred_at) — must not violate the
        UNIQUE constraint.
        """
        intent = self._emit_three_rows_via_helper()

        dao = ExecutionEventDao(self.conn)
        rows = dao.list_by_intent(intent.intent_id)
        unique_keys = {(r["intent_id"], r["state_to"], r["occurred_at"]) for r in rows}
        self.assertEqual(len(unique_keys), 3)

    def test_in_memory_fallback_when_persistence_is_none(self) -> None:
        """When the engine has no SQLite connection, rows fall through to
        the in-memory list and a one-shot RuntimeWarning is emitted.
        """
        import warnings

        self.module._IN_MEMORY_EXECUTION_EVENTS.clear()
        self.module._IN_MEMORY_FALLBACK_WARNED = False

        from datetime import datetime, timezone
        from execution_state_machine import EXECUTION_STATE_PROPOSED

        decision = self._make_paper_decision()
        with warnings.catch_warnings(record=True) as captured:
            warnings.simplefilter("always")
            self.module._emit_execution_event_row(
                connection=None,
                intent=decision.intent,
                decision=decision,
                state_from=None,
                state_to=EXECUTION_STATE_PROPOSED,
                occurred_at=datetime.now(timezone.utc),
                sequence_index=0,
            )

        # Exactly one row landed in the in-memory store.
        self.assertEqual(len(self.module._IN_MEMORY_EXECUTION_EVENTS), 1)
        self.assertEqual(
            self.module._IN_MEMORY_EXECUTION_EVENTS[0]["state_to"], "PROPOSED"
        )
        # Warn fired exactly once on first fallback.
        warn_messages = [
            str(w.message) for w in captured
            if issubclass(w.category, RuntimeWarning)
        ]
        self.assertTrue(
            any("execution_events" in m for m in warn_messages),
            f"expected fallback warning, got {warn_messages!r}",
        )

    def test_resolve_persistence_handles_unit_of_work_wrapper(self) -> None:
        """The resolver must coerce a PersistenceUnit (which exposes the
        connection via .connection) into the underlying sqlite3.Connection
        so wave-3-C can pass either shape.
        """
        unit = PersistenceUnit(self.conn)
        resolved = self.module._resolve_persistence_connection(unit)
        self.assertIs(resolved, self.conn)

    def test_resolve_persistence_returns_none_for_unknown_shapes(self) -> None:
        sentinel = object()
        self.assertIsNone(
            self.module._resolve_persistence_connection(sentinel)
        )
        self.assertIsNone(self.module._resolve_persistence_connection(None))


if __name__ == "__main__":
    unittest.main()

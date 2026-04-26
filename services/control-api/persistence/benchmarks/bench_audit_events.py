"""1M-row ``audit_events`` benchmark for P0-5.1 §G.1 gating.

This benchmark validates the wave-2 gating decision recorded in
``docs/P0-design-decisions-2026-04-26.md`` G.1:

    "1M-row audit_events, P95 query latency < 100ms"

If the verdict passes, wave-3 may use the schema from
``services/control-api/persistence/migrations/001_initial.sql`` as-is. If it
fails (any of Q1-Q7 P95 > 100ms), the 90-day archive strategy from P0-5.1 §G.5
must move from wave-4 to wave-2 to keep desktop UI latency in budget.

The script is **standalone** — invoke it directly:

    cd services/control-api
    python3 -m persistence.benchmarks.bench_audit_events

It writes to a tempfile-backed SQLite (NOT ``:memory:``) so we measure realistic
disk-IO behaviour with WAL enabled. The tempfile is removed in a ``finally``
block even on failure.

Methodology
-----------
1. Apply migration 001 (creates ``audit_events`` plus indexes).
2. Insert 1,000,000 synthetic events using ``executemany`` in 10,000-row
   batches, capturing realistic distribution (30 event_types, 50 strategies,
   severity 70/25/5 INFO/WARNING/ERROR, 180-day occurred_at spread,
   ~500-byte payload_json each).
3. Run seven typical desktop-UI queries 100 times each with random bind
   parameters, recording min / P50 / P95 / P99 / max in milliseconds.
4. Record ``EXPLAIN QUERY PLAN`` for each query so we can flag any seq-scan.
5. Print a summary table to stdout. The companion report
   ``docs/P0-5.1-perf-benchmark-2026-04-27.md`` is written by hand from this
   output.
"""

from __future__ import annotations

import json
import os
import platform
import random
import statistics
import string
import sys
import tempfile
import time
import uuid
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple


CONTROL_API_DIR = Path(__file__).resolve().parents[2]
if str(CONTROL_API_DIR) not in sys.path:
    sys.path.insert(0, str(CONTROL_API_DIR))


from persistence.connection import connect  # noqa: E402  (path setup above)
from persistence.runner import MigrationRunner  # noqa: E402


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------
TOTAL_ROWS = 1_000_000
BATCH_SIZE = 10_000
NUM_EVENT_TYPES = 30
NUM_STRATEGIES = 50
PAYLOAD_TARGET_BYTES = 500
DAYS_BACK = 180
QUERY_REPEATS = 100
RANDOM_SEED = 20260427  # determinism for the run


# Approximate the production set of event_type strings; the exact list is
# intentionally not consulted (this benchmark just needs realistic *cardinality*
# and string lengths, not semantic equivalence).
EVENT_TYPES: Tuple[str, ...] = (
    "exchange_order.created",
    "exchange_order.acked",
    "exchange_order.partially_filled",
    "exchange_order.filled",
    "exchange_order.canceled",
    "exchange_order.rejected",
    "exchange_order.amended",
    "exchange_order.externally_modified",
    "strategy.runtime.started",
    "strategy.runtime.stopped",
    "strategy.runtime.paused",
    "strategy.runtime.resumed",
    "strategy.runtime.error",
    "strategy.parameter.edited",
    "strategy.position.drift_detected",
    "strategy.position.drift_acknowledged",
    "strategy.health.degraded",
    "strategy.health.recovered",
    "risk.budget.adjusted",
    "risk.budget.consumed",
    "risk.guardrail.tripped",
    "channel.private.disconnected",
    "channel.private.reconnected",
    "channel.public.degraded",
    "backtest.run.started",
    "backtest.run.completed",
    "backtest.run.failed",
    "agent.job.queued",
    "agent.job.completed",
    "system.config.changed",
)
assert len(EVENT_TYPES) == NUM_EVENT_TYPES, (
    f"EVENT_TYPES len {len(EVENT_TYPES)} != NUM_EVENT_TYPES {NUM_EVENT_TYPES}"
)


SOURCES: Tuple[str, ...] = ("quant-core", "desktop", "openclaw", "system")
SYMBOLS: Tuple[str, ...] = (
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "BNBUSDT",
    "XRPUSDT",
    "DOGEUSDT",
    "ADAUSDT",
    "MATICUSDT",
)


def _strategy_ids() -> List[str]:
    return [f"strat-{i:03d}" for i in range(NUM_STRATEGIES)]


def _severity_for(rng: random.Random) -> str:
    """70% INFO, 25% WARNING, 5% ERROR."""

    r = rng.random()
    if r < 0.70:
        return "INFO"
    if r < 0.95:
        return "WARNING"
    return "ERROR"


def _ulid_like(rng: random.Random) -> str:
    """Cheap monotonic-ish unique id. Real ULIDs would be sortable; for the
    benchmark we just need uniqueness — the ``id`` column is not in any of the
    benchmarked WHERE clauses so its sort key doesn't matter."""

    return uuid.UUID(int=rng.getrandbits(128)).hex


def _make_payload(rng: random.Random) -> str:
    """Produce a JSON string near ``PAYLOAD_TARGET_BYTES`` long.

    We mix a small dict of realistic-ish keys with a padding string so the
    serialized size lands in the right neighbourhood without being uniform.
    """

    base: Dict[str, Any] = {
        "order_id": uuid.UUID(int=rng.getrandbits(128)).hex[:16],
        "side": rng.choice(("Buy", "Sell")),
        "qty": round(rng.uniform(0.01, 100.0), 4),
        "price": round(rng.uniform(0.5, 70_000.0), 2),
        "fill_qty": round(rng.uniform(0.0, 100.0), 4),
        "leverage": rng.choice((1, 2, 3, 5, 10)),
        "fee": round(rng.uniform(0.0, 5.0), 4),
        "trace_id": uuid.UUID(int=rng.getrandbits(128)).hex,
        "client_link_id": "".join(
            rng.choices(string.ascii_letters + string.digits, k=18)
        ),
        "tags": rng.sample(
            ["auto", "manual", "recovery", "preview", "guardrail", "drift"],
            k=2,
        ),
        "note": "synthetic-benchmark-row",
    }
    initial = json.dumps(base, separators=(",", ":"))
    deficit = PAYLOAD_TARGET_BYTES - len(initial) - len(',"pad":""')
    if deficit > 0:
        base["pad"] = "".join(
            rng.choices(string.ascii_letters + string.digits, k=deficit)
        )
    return json.dumps(base, separators=(",", ":"))


def _format_ts(dt: datetime) -> str:
    """Format as ISO8601 with millisecond precision and trailing Z."""

    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


# ---------------------------------------------------------------------------
# Insert phase
# ---------------------------------------------------------------------------
INSERT_SQL = """
INSERT INTO audit_events (
    id, event_type, severity, source, symbol, strategy_id, payload_json,
    summary, impact_detail, priority, is_key_event, trace_id, occurred_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
"""


def _generate_batch(
    rng: random.Random,
    strategy_ids: Sequence[str],
    base_dt: datetime,
    start_index: int,
    batch_size: int,
) -> List[Tuple[Any, ...]]:
    """Build a list of ``executemany`` parameter tuples for one batch."""

    rows: List[Tuple[Any, ...]] = []
    span_seconds = DAYS_BACK * 24 * 3600
    for i in range(batch_size):
        idx = start_index + i
        # Spread occurrences uniformly over the 180-day window so timestamp
        # distribution is realistic for ORDER BY occurred_at queries.
        seconds_offset = rng.randint(0, span_seconds)
        occurred_at = base_dt + timedelta(seconds=seconds_offset)
        severity = _severity_for(rng)
        priority = rng.randint(1, 9)
        is_key_event = 1 if priority <= 3 and rng.random() < 0.5 else 0
        rows.append(
            (
                _ulid_like(rng),
                rng.choice(EVENT_TYPES),
                severity,
                rng.choice(SOURCES),
                rng.choice(SYMBOLS) if rng.random() < 0.85 else None,
                rng.choice(strategy_ids) if rng.random() < 0.95 else None,
                _make_payload(rng),
                f"synthetic event #{idx}",
                "n/a" if rng.random() < 0.7 else "potential drift detected",
                priority,
                is_key_event,
                uuid.UUID(int=rng.getrandbits(128)).hex,
                _format_ts(occurred_at),
            )
        )
    return rows


def insert_synthetic_rows(conn) -> Dict[str, Any]:
    """Insert ``TOTAL_ROWS`` rows in ``BATCH_SIZE`` chunks. Returns timing dict."""

    rng = random.Random(RANDOM_SEED)
    strategy_ids = _strategy_ids()
    base_dt = datetime.now(tz=timezone.utc) - timedelta(days=DAYS_BACK)

    batch_durations: List[float] = []
    overall_start = time.perf_counter()
    inserted = 0
    while inserted < TOTAL_ROWS:
        batch_size = min(BATCH_SIZE, TOTAL_ROWS - inserted)
        rows = _generate_batch(rng, strategy_ids, base_dt, inserted, batch_size)
        t0 = time.perf_counter()
        with conn:  # implicit BEGIN ... COMMIT
            conn.executemany(INSERT_SQL, rows)
        t1 = time.perf_counter()
        batch_durations.append(t1 - t0)
        inserted += batch_size
        if inserted % (BATCH_SIZE * 10) == 0 or inserted == TOTAL_ROWS:
            elapsed = time.perf_counter() - overall_start
            rate = inserted / elapsed if elapsed > 0 else 0.0
            print(
                f"  inserted {inserted:>10,} / {TOTAL_ROWS:,}  "
                f"elapsed={elapsed:6.1f}s  rate={rate:>10,.0f} rows/s",
                flush=True,
            )

    overall_elapsed = time.perf_counter() - overall_start
    return {
        "total_rows": TOTAL_ROWS,
        "elapsed_seconds": overall_elapsed,
        "rows_per_second": TOTAL_ROWS / overall_elapsed if overall_elapsed else 0.0,
        "batch_count": len(batch_durations),
        "batch_size": BATCH_SIZE,
        "batch_min_ms": min(batch_durations) * 1000.0,
        "batch_p50_ms": statistics.median(batch_durations) * 1000.0,
        "batch_p95_ms": _percentile(batch_durations, 95) * 1000.0,
        "batch_max_ms": max(batch_durations) * 1000.0,
    }


# ---------------------------------------------------------------------------
# Query phase
# ---------------------------------------------------------------------------
def _percentile(values: Sequence[float], pct: float) -> float:
    """Linear-interpolation percentile, percent in [0, 100]."""

    if not values:
        return 0.0
    s = sorted(values)
    if len(s) == 1:
        return s[0]
    rank = (pct / 100.0) * (len(s) - 1)
    lo = int(rank)
    hi = min(lo + 1, len(s) - 1)
    frac = rank - lo
    return s[lo] + (s[hi] - s[lo]) * frac


QUERIES: Dict[str, str] = {
    "Q1_recent_50": (
        "SELECT * FROM audit_events ORDER BY occurred_at DESC LIMIT 50"
    ),
    "Q2_strategy_recent": (
        "SELECT * FROM audit_events WHERE strategy_id = ? "
        "ORDER BY occurred_at DESC LIMIT 100"
    ),
    "Q3_severity_error_recent": (
        "SELECT * FROM audit_events WHERE severity = 'ERROR' "
        "AND occurred_at >= ? ORDER BY occurred_at DESC LIMIT 100"
    ),
    "Q4_event_type_recent": (
        "SELECT * FROM audit_events WHERE event_type = ? "
        "ORDER BY occurred_at DESC LIMIT 50"
    ),
    "Q5_count_since": (
        "SELECT COUNT(*) FROM audit_events WHERE occurred_at >= ?"
    ),
    "Q6_priority_key_events": (
        "SELECT * FROM audit_events WHERE priority <= 3 AND is_key_event = 1 "
        "ORDER BY occurred_at DESC LIMIT 50"
    ),
    "Q7_per_strategy_count": (
        "SELECT strategy_id, COUNT(*) FROM audit_events GROUP BY strategy_id "
        "ORDER BY 2 DESC LIMIT 20"
    ),
}


def _params_for(label: str, rng: random.Random, strategy_ids: Sequence[str]) -> Tuple[Any, ...]:
    """Build a random bind-parameter tuple for the given query."""

    if label == "Q1_recent_50":
        return ()
    if label == "Q2_strategy_recent":
        return (rng.choice(strategy_ids),)
    if label == "Q3_severity_error_recent":
        days = rng.choice((1, 3, 7, 14, 30))
        since = datetime.now(tz=timezone.utc) - timedelta(days=days)
        return (_format_ts(since),)
    if label == "Q4_event_type_recent":
        return (rng.choice(EVENT_TYPES),)
    if label == "Q5_count_since":
        days = rng.choice((1, 7, 30, 90, 180))
        since = datetime.now(tz=timezone.utc) - timedelta(days=days)
        return (_format_ts(since),)
    if label == "Q6_priority_key_events":
        return ()
    if label == "Q7_per_strategy_count":
        return ()
    raise ValueError(f"unknown query label: {label}")


def _explain(conn, sql: str, params: Tuple[Any, ...]) -> List[str]:
    """Run ``EXPLAIN QUERY PLAN`` and return human-readable lines."""

    cursor = conn.execute(f"EXPLAIN QUERY PLAN {sql}", params)
    rows = cursor.fetchall()
    cursor.close()
    return [f"id={r[0]} parent={r[1]} notused={r[2]} detail={r[3]}" for r in rows]


def benchmark_queries(conn) -> Tuple[Dict[str, Dict[str, float]], Dict[str, List[str]]]:
    """Run each query ``QUERY_REPEATS`` times and collect timings + plans.

    Returns ``(timings, plans)`` where ``timings[label]`` is a stats dict and
    ``plans[label]`` is the EXPLAIN QUERY PLAN output captured once per query.
    """

    rng = random.Random(RANDOM_SEED + 1)
    strategy_ids = _strategy_ids()

    timings: Dict[str, Dict[str, float]] = {}
    plans: Dict[str, List[str]] = {}

    # Capture one EXPLAIN per query (using a representative parameter set).
    for label, sql in QUERIES.items():
        params = _params_for(label, rng, strategy_ids)
        plans[label] = _explain(conn, sql, params)

    # Run timed iterations. We pull rows fully (fetchall) to make sure we are
    # measuring end-to-end latency for the desktop UI use case, not just plan
    # selection or first-row latency.
    for label, sql in QUERIES.items():
        durations: List[float] = []
        for _ in range(QUERY_REPEATS):
            params = _params_for(label, rng, strategy_ids)
            t0 = time.perf_counter()
            cursor = conn.execute(sql, params)
            cursor.fetchall()
            cursor.close()
            t1 = time.perf_counter()
            durations.append(t1 - t0)

        durations_ms = [d * 1000.0 for d in durations]
        timings[label] = {
            "runs": float(len(durations_ms)),
            "min_ms": min(durations_ms),
            "p50_ms": _percentile(durations_ms, 50),
            "p95_ms": _percentile(durations_ms, 95),
            "p99_ms": _percentile(durations_ms, 99),
            "max_ms": max(durations_ms),
        }

    return timings, plans


# ---------------------------------------------------------------------------
# Reporting helpers
# ---------------------------------------------------------------------------
P95_BUDGET_MS = 100.0


def _verdict_for(stats: Dict[str, float]) -> str:
    return "PASS" if stats["p95_ms"] < P95_BUDGET_MS else "FAIL"


def _print_environment() -> None:
    print("=" * 78)
    print("audit_events 1M-row benchmark — P0-5.1 §G.1 gating")
    print("=" * 78)
    print(f"platform : {platform.platform()}")
    print(f"python   : {sys.version.replace(chr(10), ' ')}")
    print(f"sqlite   : {_sqlite_version()}")
    print(f"target   : {TOTAL_ROWS:,} rows, batch={BATCH_SIZE:,}")
    print(f"queries  : {len(QUERIES)} query types × {QUERY_REPEATS} runs each")
    print(f"budget   : P95 < {P95_BUDGET_MS:.0f}ms (per design G.1)")
    print()


def _sqlite_version() -> str:
    import sqlite3 as _sql

    return f"runtime={_sql.sqlite_version} module={_sql.version}"


def _print_insert_stats(stats: Dict[str, Any]) -> None:
    print("Insert phase")
    print("-" * 78)
    print(f"  total rows      : {stats['total_rows']:,}")
    print(f"  elapsed         : {stats['elapsed_seconds']:.2f} s")
    print(f"  throughput      : {stats['rows_per_second']:,.0f} rows/s")
    print(f"  batches         : {stats['batch_count']}")
    print(
        f"  per-batch (ms)  : "
        f"min={stats['batch_min_ms']:.1f}  "
        f"p50={stats['batch_p50_ms']:.1f}  "
        f"p95={stats['batch_p95_ms']:.1f}  "
        f"max={stats['batch_max_ms']:.1f}"
    )
    print()


def _print_query_table(timings: Dict[str, Dict[str, float]]) -> None:
    print("Query phase — latency in ms (n=100 each)")
    print("-" * 78)
    header = f"  {'label':<28}{'min':>9}{'P50':>9}{'P95':>9}{'P99':>9}{'max':>9}  verdict"
    print(header)
    print("  " + "-" * (len(header) - 2))
    for label, stats in timings.items():
        verdict = _verdict_for(stats)
        print(
            f"  {label:<28}"
            f"{stats['min_ms']:>9.2f}"
            f"{stats['p50_ms']:>9.2f}"
            f"{stats['p95_ms']:>9.2f}"
            f"{stats['p99_ms']:>9.2f}"
            f"{stats['max_ms']:>9.2f}"
            f"  {verdict}"
        )
    print()


def _print_explain_plans(plans: Dict[str, List[str]]) -> None:
    print("EXPLAIN QUERY PLAN")
    print("-" * 78)
    for label, lines in plans.items():
        print(f"  {label}:")
        for line in lines:
            print(f"    {line}")
    print()


def _print_overall_verdict(timings: Dict[str, Dict[str, float]]) -> None:
    failures = [label for label, stats in timings.items() if stats["p95_ms"] >= P95_BUDGET_MS]
    print("Overall verdict")
    print("-" * 78)
    if not failures:
        print(f"  PASS — all 7 queries P95 < {P95_BUDGET_MS:.0f}ms")
        print("  Wave-3 may use the schema as-is; archive strategy stays in wave-4.")
    else:
        print(f"  FAIL — P95 >= {P95_BUDGET_MS:.0f}ms for: {', '.join(failures)}")
        print(
            "  Recommendation: advance G.5 archive strategy from wave-4 to wave-2."
        )
    print()


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main() -> int:
    _print_environment()

    tmp = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
    tmp_path = Path(tmp.name)
    tmp.close()

    try:
        # Open the connection and set up schema. ``connect`` enables WAL +
        # foreign_keys + busy_timeout exactly like production startup will.
        conn = connect(tmp_path)
        try:
            print(f"db file : {tmp_path}")
            print()
            applied = MigrationRunner(conn).apply_pending()
            print(f"applied migrations: {[m.filename for m in applied]}")
            print()

            print("-> insert phase")
            insert_stats = insert_synthetic_rows(conn)
            print()

            db_size = tmp_path.stat().st_size
            wal_path = tmp_path.with_suffix(tmp_path.suffix + "-wal")
            wal_size = wal_path.stat().st_size if wal_path.exists() else 0
            print(
                f"db size: {db_size / (1024*1024):.1f} MiB  "
                f"(wal={wal_size / (1024*1024):.1f} MiB)"
            )
            print()

            # Force a checkpoint so the WAL doesn't dominate later read latency
            # the way it would on a server that has just stopped writing.
            with closing(conn.cursor()) as cur:
                cur.execute("PRAGMA wal_checkpoint(TRUNCATE)")

            # Refresh statistics so the planner makes realistic choices.
            with closing(conn.cursor()) as cur:
                cur.execute("ANALYZE")

            print("-> query phase")
            timings, plans = benchmark_queries(conn)
            print()

            _print_insert_stats(insert_stats)
            _print_query_table(timings)
            _print_explain_plans(plans)
            _print_overall_verdict(timings)
        finally:
            conn.close()
    finally:
        # Clean up tempfile + companion -wal/-shm files even if we crashed.
        for suffix in ("", "-wal", "-shm", "-journal"):
            companion = tmp_path.with_suffix(tmp_path.suffix + suffix) if suffix else tmp_path
            try:
                if companion.exists():
                    companion.unlink()
            except OSError:
                pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

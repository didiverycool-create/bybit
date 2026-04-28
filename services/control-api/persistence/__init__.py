"""SQLite persistence layer for control-api.

This package implements the schema, migrations, and DAOs designed in
``docs/P0-5.1-persistence-design.md``. It is intentionally decoupled from
``AppRepository`` and ``state.json`` — wave-3 will integrate dual-write at the
repository layer; this package only delivers schema + migrations + thin DAOs.

Public re-exports below cover the surface that wave-3 callers will need.
"""

from __future__ import annotations

from .connection import (
    PersistenceConnectionError,
    apply_pragmas,
    connect,
)
from .runner import (
    Migration,
    MigrationError,
    MigrationRunner,
    discover_migrations,
    run_migrations,
)
from .unit_of_work import PersistenceUnit
from .dao_audit import AuditDao, AuditEventRow
from .dao_change_request import (
    ChangeRequestDao,
    ChangeRequestHistoryRow,
    ChangeRequestRow,
)
from .dao_agent_job import AgentJobDao, AgentJobRow
from .dao_backtest import BacktestDao, BacktestRunRow
from .dao_execution_event import ExecutionEventDao, ExecutionEventRow
from .dao_parameter_version import (
    ParameterVersionDao,
    ParameterVersionRow,
)
from .dao_config import ConfigDao, ConfigSnapshotRow

__all__ = [
    "PersistenceConnectionError",
    "apply_pragmas",
    "connect",
    "Migration",
    "MigrationError",
    "MigrationRunner",
    "discover_migrations",
    "run_migrations",
    "PersistenceUnit",
    "AuditDao",
    "AuditEventRow",
    "ChangeRequestDao",
    "ChangeRequestRow",
    "ChangeRequestHistoryRow",
    "AgentJobDao",
    "AgentJobRow",
    "BacktestDao",
    "BacktestRunRow",
    "ExecutionEventDao",
    "ExecutionEventRow",
    "ParameterVersionDao",
    "ParameterVersionRow",
    "ConfigDao",
    "ConfigSnapshotRow",
]

-- Migration 001 — initial schema.
-- Source of truth: docs/P0-5.1-persistence-design.md §B.1 - §B.8.
-- Any schema change in production goes via a *new* migration file, not by
-- editing this one.

-- ------------------------------------------------------------------
-- B.1 audit_events  (append-only event source)
-- ------------------------------------------------------------------
CREATE TABLE audit_events (
    id              TEXT PRIMARY KEY,        -- ULID, time-sortable
    event_type      TEXT NOT NULL,           -- e.g. "exchange_order.created"
    severity        TEXT NOT NULL CHECK (severity IN ('INFO','WARNING','ERROR')),
    source          TEXT NOT NULL,           -- "quant-core" / "desktop" / "openclaw" / "system"
    symbol          TEXT,
    strategy_id     TEXT,
    payload_json    TEXT NOT NULL,           -- serialized dict
    summary         TEXT,                    -- repo._build_audit_event_summary precompute
    impact_detail   TEXT,
    priority        INTEGER NOT NULL DEFAULT 6,  -- 1-9, smaller = more critical
    is_key_event    INTEGER NOT NULL DEFAULT 0 CHECK (is_key_event IN (0,1)),
    trace_id        TEXT,
    occurred_at     TEXT NOT NULL,
    created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
) STRICT;

CREATE INDEX idx_audit_events_occurred_at  ON audit_events(occurred_at DESC);
CREATE INDEX idx_audit_events_strategy     ON audit_events(strategy_id, occurred_at DESC);
CREATE INDEX idx_audit_events_event_type   ON audit_events(event_type, occurred_at DESC);
CREATE INDEX idx_audit_events_severity     ON audit_events(severity, occurred_at DESC);
CREATE INDEX idx_audit_events_priority_key ON audit_events(priority, is_key_event, occurred_at DESC);

-- Enforce append-only:
CREATE TRIGGER audit_events_no_update
BEFORE UPDATE ON audit_events
BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only');
END;

CREATE TRIGGER audit_events_no_delete
BEFORE DELETE ON audit_events
BEGIN
    SELECT RAISE(ABORT, 'audit_events is append-only; use archive flow');
END;

-- ------------------------------------------------------------------
-- B.2 change_requests  +  change_request_history
-- ------------------------------------------------------------------
CREATE TABLE change_requests (
    id                          TEXT PRIMARY KEY,
    type                        TEXT NOT NULL,
    status                      TEXT NOT NULL CHECK (status IN
        ('draft','queued','running','applied','failed','rolled_back')),
    strategy_id                 TEXT,
    payload_json                TEXT NOT NULL,
    source_change_request_id    TEXT,
    source_backtest_id          TEXT,
    source_review_id            TEXT,
    source_proposal_id          TEXT,
    trigger_reason              TEXT,
    linked_backtest_id          TEXT,
    linked_review_id            TEXT,
    follow_up_job_id            TEXT,
    follow_up_job_type          TEXT,
    follow_up_job_status        TEXT,
    manual_followup_required    INTEGER NOT NULL DEFAULT 0 CHECK (manual_followup_required IN (0,1)),
    manual_followup_detail      TEXT,
    requested_by                TEXT NOT NULL,
    created_at                  TEXT NOT NULL,
    updated_at                  TEXT NOT NULL,
    applied_at                  TEXT
) STRICT;

CREATE INDEX idx_cr_status   ON change_requests(status, updated_at DESC);
CREATE INDEX idx_cr_strategy ON change_requests(strategy_id, updated_at DESC);
CREATE INDEX idx_cr_source_proposal ON change_requests(source_proposal_id);

CREATE TABLE change_request_history (
    history_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    change_request_id TEXT NOT NULL,
    status_from     TEXT,
    status_to       TEXT NOT NULL,
    payload_json    TEXT NOT NULL,
    audit_event_id  TEXT,
    transition_at   TEXT NOT NULL,
    FOREIGN KEY (change_request_id) REFERENCES change_requests(id),
    FOREIGN KEY (audit_event_id) REFERENCES audit_events(id)
) STRICT;

CREATE INDEX idx_cr_hist_cr ON change_request_history(change_request_id, transition_at DESC);

-- ------------------------------------------------------------------
-- B.3 agent_jobs
-- ------------------------------------------------------------------
CREATE TABLE agent_jobs (
    id                  TEXT PRIMARY KEY,
    job_type            TEXT NOT NULL,
    status              TEXT NOT NULL CHECK (status IN
        ('queued','claimed','running','completed','failed','cancelled')),
    idempotency_key     TEXT UNIQUE,        -- already used for dedup
    strategy_id         TEXT,
    backtest_id         TEXT,
    context_json        TEXT NOT NULL,
    allowed_actions_json TEXT NOT NULL,
    timeout_seconds     INTEGER,
    writeback_target    TEXT,
    linked_review_id    TEXT,
    linked_review_title TEXT,
    linked_review_period TEXT,
    retried_from_job_id TEXT,
    retry_count         INTEGER NOT NULL DEFAULT 0,
    result_json         TEXT,
    requested_by        TEXT NOT NULL,
    queued_at           TEXT NOT NULL,
    started_at          TEXT,
    finished_at         TEXT,
    FOREIGN KEY (retried_from_job_id) REFERENCES agent_jobs(id)
) STRICT;

CREATE INDEX idx_jobs_status        ON agent_jobs(status, queued_at);
CREATE INDEX idx_jobs_type          ON agent_jobs(job_type, queued_at DESC);
CREATE INDEX idx_jobs_strategy      ON agent_jobs(strategy_id, queued_at DESC);
CREATE INDEX idx_jobs_backtest      ON agent_jobs(backtest_id, queued_at DESC);
CREATE INDEX idx_jobs_idempotency   ON agent_jobs(idempotency_key);

-- ------------------------------------------------------------------
-- B.4 backtest_runs
-- ------------------------------------------------------------------
CREATE TABLE backtest_runs (
    id                                          TEXT PRIMARY KEY,
    strategy_id                                 TEXT NOT NULL,
    status                                      TEXT NOT NULL CHECK (status IN
        ('queued','running','completed','failed','cancelled')),
    timeframe                                   TEXT NOT NULL CHECK (timeframe IN ('15m','1h','4h','1d')),
    data_range_text                             TEXT NOT NULL,
    requested_range_start                       TEXT,
    requested_range_end                         TEXT,
    parameter_snapshot_id                       INTEGER,
    history_source                              TEXT CHECK (history_source IN ('exchange_history','market_detail_fallback')),
    history_source_reason                       TEXT,
    history_source_detail                       TEXT,
    sample_quality                              TEXT CHECK (sample_quality IN ('reference_only','low_sample','sufficient')),
    decision_readiness                          TEXT CHECK (decision_readiness IN ('ready','sample_incomplete','research_only')),
    history_truncated                           INTEGER NOT NULL DEFAULT 0 CHECK (history_truncated IN (0,1)),
    history_gap_reason                          TEXT,
    requested_candle_estimate                   INTEGER,
    requested_candle_limit                      INTEGER,
    retrieved_candle_count                      INTEGER,
    used_candle_count                           INTEGER,
    source_change_request_id                    TEXT,
    source_backtest_id                          TEXT,
    source_review_id                            TEXT,
    source_proposal_id                          TEXT,
    trigger_reason                              TEXT,
    metrics_json                                TEXT,
    result_blob                                 TEXT,
    requested_by                                TEXT NOT NULL,
    created_at                                  TEXT NOT NULL,
    completed_at                                TEXT,
    FOREIGN KEY (parameter_snapshot_id) REFERENCES parameter_versions(id),
    FOREIGN KEY (source_backtest_id) REFERENCES backtest_runs(id),
    FOREIGN KEY (source_change_request_id) REFERENCES change_requests(id)
) STRICT;

CREATE INDEX idx_bt_strategy   ON backtest_runs(strategy_id, created_at DESC);
CREATE INDEX idx_bt_status     ON backtest_runs(status, created_at DESC);
CREATE INDEX idx_bt_source_cr  ON backtest_runs(source_change_request_id);

-- ------------------------------------------------------------------
-- B.5 execution_events  (append-only state-machine trail)
-- ------------------------------------------------------------------
CREATE TABLE execution_events (
    id              TEXT PRIMARY KEY,        -- ULID
    intent_id       TEXT NOT NULL,
    intent_seq      INTEGER NOT NULL,
    strategy_id     TEXT NOT NULL,
    exchange_link_id TEXT,
    state_from      TEXT,
    state_to        TEXT NOT NULL CHECK (state_to IN
        ('PROPOSED','PREVIEWED','ROUTED','ACKED','PARTIALLY_FILLED','FILLED',
         'CANCELED','REJECTED','EXTERNALLY_MODIFIED')),
    verb            TEXT,
    order_id        TEXT,
    risk_decision_json TEXT,
    payload_json    TEXT NOT NULL,
    audit_event_id  TEXT,
    occurred_at     TEXT NOT NULL,
    UNIQUE (intent_id, state_to, occurred_at),
    FOREIGN KEY (audit_event_id) REFERENCES audit_events(id)
) STRICT;

CREATE INDEX idx_ee_intent      ON execution_events(intent_id, occurred_at);
CREATE INDEX idx_ee_strategy    ON execution_events(strategy_id, occurred_at DESC);
CREATE INDEX idx_ee_link        ON execution_events(exchange_link_id);
CREATE INDEX idx_ee_state       ON execution_events(state_to, occurred_at DESC);

-- ------------------------------------------------------------------
-- B.6 parameter_versions
-- ------------------------------------------------------------------
CREATE TABLE parameter_versions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id     TEXT NOT NULL,
    version_no      INTEGER NOT NULL,
    parameters_json TEXT NOT NULL,
    risk_budget     REAL,
    edited_by       TEXT NOT NULL,
    change_request_id TEXT,
    created_at      TEXT NOT NULL,
    UNIQUE (strategy_id, version_no),
    FOREIGN KEY (change_request_id) REFERENCES change_requests(id)
) STRICT;

CREATE INDEX idx_pv_strategy ON parameter_versions(strategy_id, version_no DESC);

-- ------------------------------------------------------------------
-- B.7 config_snapshots
-- ------------------------------------------------------------------
CREATE TABLE config_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_kind   TEXT NOT NULL CHECK (snapshot_kind IN ('settings','workspace_preferences','feature_flags')),
    payload_json    TEXT NOT NULL,
    edited_by       TEXT NOT NULL,
    edit_reason     TEXT,
    created_at      TEXT NOT NULL
) STRICT;

CREATE INDEX idx_cs_kind ON config_snapshots(snapshot_kind, created_at DESC);

-- ------------------------------------------------------------------
-- B.8 schema_migrations  (meta-table for the migration runner)
-- ------------------------------------------------------------------
CREATE TABLE schema_migrations (
    version         INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    applied_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    checksum        TEXT
) STRICT;

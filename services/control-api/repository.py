from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Any, Dict, Optional
from uuid import uuid4

from models import (
    AccountMode,
    AccountAsset,
    AccountOverview,
    AgentJob,
    AgentJobCreate,
    AppState,
    BacktestMetrics,
    BacktestRun,
    ChangeRequest,
    ChangeRequestCreate,
    ChangeRequestStatus,
    EventSeverity,
    ExecutionEvent,
    JobStatus,
    ManualOrderRequest,
    OrderRecord,
    PositionRecord,
    SchedulerCommand,
    SchedulerCommandType,
    TradeRecord,
    WorkspacePreferences,
    WorkspacePreferencesUpdate,
)
from seed import build_state


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


class AppRepository:
    def __init__(self, path: Optional[Path] = None) -> None:
        self.path = path or Path(__file__).resolve().parent / ".runtime" / "state.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        self.state = self._load()

    def _load(self) -> AppState:
        if self.path.exists():
            try:
                return AppState.model_validate_json(self.path.read_text(encoding="utf-8"))
            except Exception:
                pass
        state = build_state()
        self._persist(state)
        return state

    def _persist(self, state: Optional[AppState] = None) -> None:
        target = state or self.state
        self.path.write_text(target.model_dump_json(indent=2), encoding="utf-8")

    def snapshot(self) -> AppState:
        return self.state

    @staticmethod
    def _dedupe_strings(values: list[str]) -> list[str]:
        deduped = []
        seen = set()
        for value in values:
            if not value or value in seen:
                continue
            seen.add(value)
            deduped.append(value)
        return deduped

    def add_event(
        self,
        event_type: str,
        source: str,
        severity: EventSeverity,
        payload: Dict[str, Any],
        symbol: Optional[str] = None,
        strategy_id: Optional[str] = None,
    ) -> ExecutionEvent:
        event = ExecutionEvent(
            id=f"evt-{uuid4().hex[:8]}",
            event_type=event_type,
            severity=severity,
            source=source,
            symbol=symbol,
            strategy_id=strategy_id,
            payload=payload,
            trace_id=f"trace-{uuid4().hex[:12]}",
            occurred_at=now_iso(),
        )
        self.state.audit_events.insert(0, event)
        return event

    def create_change_request(self, payload: ChangeRequestCreate) -> ChangeRequest:
        with self._lock:
            timestamp = now_iso()
            record = ChangeRequest(
                id=f"cr-{uuid4().hex[:6]}",
                type=payload.type,
                payload=payload.payload,
                requested_by=payload.requested_by,
                target_mode=payload.target_mode,
                priority=payload.priority,
                status=ChangeRequestStatus.QUEUED,
                correlation_id=f"corr-{uuid4().hex[:10]}",
                created_at=timestamp,
                updated_at=timestamp,
                summary=payload.summary,
            )
            self.state.change_requests.insert(0, record)
            self.add_event(
                event_type="change_request.created",
                source="desktop",
                severity=EventSeverity.INFO,
                payload=record.model_dump(mode="json"),
                symbol=payload.payload.get("symbol"),
                strategy_id=payload.payload.get("strategy_id"),
            )
            self._persist()
            return record

    def create_agent_job(self, payload: AgentJobCreate) -> AgentJob:
        with self._lock:
            timestamp = now_iso()
            record = AgentJob(
                id=f"job-{uuid4().hex[:6]}",
                job_type=payload.job_type,
                context=payload.context,
                allowed_actions=payload.allowed_actions,
                timeout=payload.timeout,
                idempotency_key=payload.idempotency_key,
                writeback_target=payload.writeback_target,
                status=JobStatus.QUEUED,
                created_at=timestamp,
                updated_at=timestamp,
            )
            self.state.agent_jobs.insert(0, record)
            self.state.control_snapshot.scheduler.queue_depth = max(
                0, self.state.control_snapshot.scheduler.queue_depth + 1
            )
            self.add_event(
                event_type="openclaw.job.queued",
                source="desktop",
                severity=EventSeverity.INFO,
                payload=record.model_dump(mode="json"),
                strategy_id=payload.context.get("strategy_id"),
            )
            self._persist()
            return record

    def create_backtest(self, strategy_id: str, data_range: str, timeframe: str) -> BacktestRun:
        with self._lock:
            strategy = next((item for item in self.state.strategies if item.id == strategy_id), None)
            if strategy is None:
                raise KeyError(strategy_id)
            timestamp = now_iso()
            record = BacktestRun(
                id=f"bt-{uuid4().hex[:6]}",
                strategy_id=strategy.id,
                strategy_name=strategy.name,
                status="completed",
                started_at=timestamp,
                finished_at=timestamp,
                symbol_scope=strategy.symbols,
                timeframe=timeframe,
                data_range=data_range,
                data_granularity="kline+trade" if strategy.category == "python" else "kline",
                fee_model="bybit-v5-standard",
                slippage_model="control-v1-adaptive",
                parameter_snapshot={param.key: param.value for param in strategy.parameters},
                metrics=BacktestMetrics(
                    annual_return="+26.4%",
                    max_drawdown="-5.2%",
                    sharpe="1.57",
                    win_rate="59.8%",
                    pnl="+52,400 USDT",
                    trades=112,
                ),
                notes="由控制端发起的即时回测，当前为 mock 结果用于联调。",
            )
            self.state.backtests.insert(0, record)
            self.add_event(
                event_type="backtest.completed",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload=record.model_dump(mode="json"),
                strategy_id=strategy_id,
                symbol=",".join(strategy.symbols),
            )
            self._persist()
            return record

    def apply_scheduler_command(self, command: SchedulerCommand) -> dict:
        with self._lock:
            scheduler = self.state.control_snapshot.scheduler
            result = {"status": "accepted", "command": command.command}
            if command.command == SchedulerCommandType.PAUSE:
                scheduler.status = "paused"
            elif command.command == SchedulerCommandType.RESUME:
                scheduler.status = "running"
            elif command.command == SchedulerCommandType.CANCEL_JOB and command.job_id:
                for job in self.state.agent_jobs:
                    if job.id == command.job_id:
                        job.status = JobStatus.CANCELLED
                        job.updated_at = now_iso()
                        scheduler.current_job_id = None if scheduler.current_job_id == job.id else scheduler.current_job_id
                        break
            elif command.command == SchedulerCommandType.CANCEL_ALL:
                for job in self.state.agent_jobs:
                    if job.status in {JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING}:
                        job.status = JobStatus.CANCELLED
                        job.updated_at = now_iso()
                scheduler.current_job_id = None
                scheduler.queue_depth = 0
            elif command.command == SchedulerCommandType.FREEZE_PUBLISH:
                scheduler.freeze_publish = not scheduler.freeze_publish
                result["freeze_publish"] = scheduler.freeze_publish
            elif command.command == SchedulerCommandType.ENTER_MANUAL_OVERRIDE:
                scheduler.status = "manual_override"
                scheduler.freeze_publish = True
            scheduler.last_heartbeat_at = now_iso()
            self.add_event(
                event_type="scheduler.command",
                source="desktop",
                severity=EventSeverity.WARNING
                if command.command in {SchedulerCommandType.CANCEL_ALL, SchedulerCommandType.ENTER_MANUAL_OVERRIDE}
                else EventSeverity.INFO,
                payload=command.model_dump(mode="json"),
            )
            self._persist()
            return result

    def update_workspace_preferences(
        self, payload: WorkspacePreferencesUpdate
    ) -> WorkspacePreferences:
        with self._lock:
            previous = self.state.workspace_preferences
            card_order = self._dedupe_strings(payload.overview_card_order)
            if not card_order:
                card_order = previous.overview_card_order

            for card_id in previous.overview_card_order:
                if card_id not in card_order:
                    card_order.append(card_id)

            visible_candidates = self._dedupe_strings(payload.overview_visible_cards)
            visible_cards = [card_id for card_id in card_order if card_id in visible_candidates]
            if not visible_cards:
                visible_cards = previous.overview_visible_cards[:]

            next_preferences = WorkspacePreferences(
                active_section=payload.active_section,
                layout_preset=payload.layout_preset,
                selected_mode=payload.selected_mode,
                selected_symbol=payload.selected_symbol,
                selected_strategy_id=payload.selected_strategy_id,
                overview_card_order=card_order,
                overview_visible_cards=visible_cards,
                updated_at=now_iso(),
            )
            self.state.workspace_preferences = next_preferences
            self.add_event(
                event_type="workspace.preferences.updated",
                source="desktop",
                severity=EventSeverity.INFO,
                payload=next_preferences.model_dump(mode="json"),
                symbol=payload.selected_symbol,
                strategy_id=payload.selected_strategy_id,
            )
            self._persist()
            return next_preferences

    def get_mock_account_overview(self) -> AccountOverview:
        snapshot = self.state.control_snapshot
        updated_at = now_iso()
        return AccountOverview(
            source="mock",
            mode=snapshot.scheduler.current_mode,
            account_type="UNIFIED",
            total_equity=snapshot.account_metrics[0].value,
            total_wallet_balance="1,102,000 USDT",
            total_available_balance="482,000 USDT",
            unrealised_pnl=snapshot.today_performance.get("unrealized_pnl", "--"),
            positions_count=len([item for item in self.state.watchlist if item.position_side != "flat"]),
            open_orders_count=2,
            top_holdings=[
                AccountAsset(
                    coin="USDT",
                    wallet_balance="482,000",
                    usd_value="482,000 USDT",
                    available_balance="482,000",
                ),
                AccountAsset(
                    coin="BTC",
                    wallet_balance="9.8400",
                    usd_value="651,600 USDT",
                    available_balance="6.2100",
                ),
                AccountAsset(
                    coin="SOL",
                    wallet_balance="1,890.00",
                    usd_value="152,800 USDT",
                    available_balance="1,240.00",
                ),
            ],
            updated_at=updated_at,
        )

    def get_mock_positions(self) -> list[PositionRecord]:
        timestamp = now_iso()
        positions: list[PositionRecord] = []
        templates = {
            "BTCUSDT": {
                "market": "perp",
                "side": "long",
                "size": "1.60",
                "avg_price": "65420.50",
                "mark_price": "66241.30",
                "value": "105,986.08 USDT",
                "leverage": "2.0x",
                "unrealised_pnl": "+1,313.28 USDT",
            },
            "SOLUSDT": {
                "market": "spot",
                "side": "long",
                "size": "1890.00",
                "avg_price": "79.42",
                "mark_price": "81.27",
                "value": "153,600.30 USDT",
                "leverage": "1.0x",
                "unrealised_pnl": "+3,496.50 USDT",
            },
        }
        for symbol, template in templates.items():
            positions.append(
                PositionRecord(
                    source="mock",
                    symbol=symbol,
                    market=template["market"],
                    side=template["side"],
                    size=template["size"],
                    avg_price=template["avg_price"],
                    mark_price=template["mark_price"],
                    value=template["value"],
                    leverage=template["leverage"],
                    unrealised_pnl=template["unrealised_pnl"],
                    updated_at=timestamp,
                )
            )
        return positions

    def get_mock_orders(self) -> list[OrderRecord]:
        return [
            OrderRecord(
                source="mock",
                order_id="ord-mock-001",
                symbol="ETHUSDT",
                market="perp",
                side="buy",
                order_type="Limit",
                qty="12.00",
                price="1982.50",
                status="New",
                created_at=now_iso(),
            ),
            OrderRecord(
                source="mock",
                order_id="ord-mock-002",
                symbol="BTCUSDT",
                market="perp",
                side="sell",
                order_type="Limit",
                qty="0.80",
                price="66880.00",
                status="PartiallyFilled",
                created_at=now_iso(),
            ),
        ]

    def create_manual_trade(self, payload: ManualOrderRequest) -> TradeRecord:
        with self._lock:
            record = TradeRecord(
                id=f"trade-{uuid4().hex[:6]}",
                symbol=payload.symbol,
                market=payload.market,
                mode=payload.mode,
                origin="manual",
                side=payload.side,
                quantity=payload.quantity,
                price=payload.price,
                pnl="--",
                strategy_id=None,
                created_at=now_iso(),
                status="filled",
            )
            self.state.trades.insert(0, record)
            self.add_event(
                event_type="manual_trade.executed",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload=record.model_dump(mode="json"),
                symbol=payload.symbol,
            )
            self._persist()
            return record

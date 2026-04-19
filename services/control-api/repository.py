from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Callable, Dict, Optional
from uuid import uuid4

from models import (
    AccountMode,
    AccountAsset,
    AccountOverview,
    AlertRecord,
    AlertAcknowledgePayload,
    AlertRule,
    AgentJob,
    AgentJobCreate,
    AppState,
    BacktestMetrics,
    derive_backtest_sample_quality,
    normalize_backtest_timeframe,
    BacktestRun,
    ChangeRequest,
    ChangeRequestCreate,
    ChangeRequestStatus,
    Direction,
    ExecutionPreview,
    ExecutionPreviewRequest,
    EventSeverity,
    ExecutionEvent,
    JobStatus,
    ManualOrderRequest,
    MarketDetail,
    NewsEvent,
    OrderRecord,
    PositionRecord,
    SchedulerCommand,
    SchedulerCommandType,
    StrategyParameter,
    StrategyRuntimeSnapshot,
    StrategyProposal,
    StrategyProposalActionPayload,
    StrategyProposalActionResult,
    TradeRecord,
    WatchlistInstrument,
    WatchlistRemoveResult,
    ReviewDocument,
    SettingsPayload,
    SettingsUpdatePayload,
    WorkspacePreferences,
    WorkspacePreferencesUpdate,
)
from datetime_utils import parse_optional_iso_datetime
from seed import build_market_detail_for_watchlist, build_state


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def _prune_compact_review_value(value: Any) -> Any:
    if isinstance(value, dict):
        pruned: Dict[str, Any] = {}
        for key, item in value.items():
            cleaned = _prune_compact_review_value(item)
            if cleaned is None:
                continue
            if isinstance(cleaned, dict) and not cleaned:
                continue
            pruned[key] = cleaned
        return pruned
    if value is None:
        return None
    return value


def _compact_review_strategy_activity_context(context: Dict[str, Any]) -> Dict[str, Any]:
    compact = dict(context)
    decision_context = _prune_compact_review_value({
        "proposal": {
            "latest_backtest_record": compact.pop("latest_proposal_backtest_record", None),
            "latest_review_record": compact.pop("latest_proposal_review_record", None),
            "latest_job_record": compact.pop("latest_proposal_job_record", None),
            "actionable_backtest_record": compact.pop("latest_actionable_proposal_backtest_record", None),
            "actionable_review_record": compact.pop("latest_actionable_proposal_review_record", None),
            "actionable_job_record": compact.pop("latest_actionable_proposal_job_record", None),
        },
        "change_request": {
            "latest_backtest_record": compact.pop("latest_change_request_backtest_record", None),
            "latest_review_record": compact.pop("latest_change_request_review_record", None),
            "latest_job_record": compact.pop("latest_change_request_job_record", None),
            "latest_source_backtest_record": compact.pop("latest_change_request_source_backtest_record", None),
            "latest_source_review_record": compact.pop("latest_change_request_source_review_record", None),
            "latest_source_proposal_record": compact.pop("latest_change_request_source_proposal_record", None),
            "actionable_backtest_record": compact.pop("latest_actionable_change_request_backtest_record", None),
            "actionable_review_record": compact.pop("latest_actionable_change_request_review_record", None),
            "actionable_job_record": compact.pop("latest_actionable_change_request_job_record", None),
            "actionable_source_backtest_record": compact.pop("latest_actionable_change_request_source_backtest_record", None),
            "actionable_source_review_record": compact.pop("latest_actionable_change_request_source_review_record", None),
            "actionable_source_proposal_record": compact.pop("latest_actionable_change_request_source_proposal_record", None),
        },
        "backtest": {
            "latest_record": compact.pop("latest_backtest_record", None),
            "actionable_record": compact.pop("latest_actionable_backtest_record", None),
            "latest_review_record": compact.pop("latest_backtest_review_record", None),
            "latest_job_record": compact.pop("latest_backtest_job_record", None),
            "actionable_review_record": compact.pop("latest_actionable_backtest_review_record", None),
            "actionable_job_record": compact.pop("latest_actionable_backtest_job_record", None),
        },
        "review": {
            "latest_primary_record": compact.pop("latest_primary_review_record", None),
            "latest_actionable_primary_record": compact.pop("latest_actionable_primary_review_record", None),
        },
        "tracking": {
            "latest_review_record": compact.pop("latest_tracking_review_record", None),
            "latest_job_record": compact.pop("latest_tracking_job_record", None),
            "latest_retryable_job_record": compact.pop("latest_retryable_tracking_job_record", None),
        },
    })
    if decision_context:
        compact["decision_context"] = decision_context
    return compact


class AppRepository:
    PAPER_STARTING_CASH = 250_000.0

    def __init__(
        self,
        path: Optional[Path] = None,
        backtest_runner: Optional[Callable[[Any, str, str], Optional[Dict[str, Any]]]] = None,
    ) -> None:
        self.path = path or Path(__file__).resolve().parent / ".runtime" / "state.json"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self.backtest_runner = backtest_runner
        self.state = self._load()
        self._refresh_derived_state()

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
        with self._lock:
            self._sanitize_workspace_preferences_locked()
            snapshot = self.state.model_copy(deep=True)
            snapshot.audit_events = [self._decorate_execution_event(item) for item in snapshot.audit_events]
            return snapshot

    @staticmethod
    def _normalize_setting_url(value: Optional[str], *, field_label: str) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized:
            return None
        if not normalized.startswith(("http://", "https://")):
            raise ValueError(f"{field_label} 必须以 http:// 或 https:// 开头。")
        return normalized.rstrip("/")

    @staticmethod
    def _normalize_optional_string(value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = str(value).strip()
        return normalized or None

    @staticmethod
    def _normalize_quiet_hours_time(value: Optional[str], *, field_label: str) -> str:
        normalized = str(value or "").strip()
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", normalized):
            raise ValueError(f"{field_label} 必须使用 HH:MM 的 24 小时格式。")
        return normalized

    @staticmethod
    def _non_empty_string(value: Any) -> Optional[str]:
        normalized = str(value or "").strip()
        return normalized or None

    @staticmethod
    def _non_empty_string_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        items: list[str] = []
        for item in value:
            normalized = AppRepository._non_empty_string(item)
            if normalized and normalized not in items:
                items.append(normalized)
        return items

    @staticmethod
    def _build_audit_event_impact_detail(payload: Dict[str, Any]) -> Optional[str]:
        job_types = AppRepository._non_empty_string_list(payload.get("cancelled_job_types"))
        strategy_ids = AppRepository._non_empty_string_list(payload.get("cancelled_strategy_ids"))
        backtest_ids = AppRepository._non_empty_string_list(payload.get("cancelled_backtest_ids"))
        source_change_request_ids = AppRepository._non_empty_string_list(payload.get("cancelled_source_change_request_ids"))
        source_backtest_ids = AppRepository._non_empty_string_list(payload.get("cancelled_source_backtest_ids"))
        source_review_ids = AppRepository._non_empty_string_list(payload.get("cancelled_source_review_ids"))
        source_proposal_ids = AppRepository._non_empty_string_list(payload.get("cancelled_source_proposal_ids"))
        trigger_reasons = AppRepository._non_empty_string_list(payload.get("cancelled_trigger_reasons"))
        decision_readiness_values = AppRepository._non_empty_string_list(payload.get("cancelled_decision_readiness_values"))
        parts: list[str] = []
        if job_types:
            parts.append(f"任务 {' / '.join(job_types)}")
        if strategy_ids:
            parts.append(f"策略 {strategy_ids[0]}" if len(strategy_ids) == 1 else f"策略 {len(strategy_ids)} 条")
        if backtest_ids:
            parts.append(f"回测 {backtest_ids[0]}" if len(backtest_ids) == 1 else f"回测 {len(backtest_ids)} 轮")
        if source_change_request_ids:
            parts.append(
                f"来源变更 {source_change_request_ids[0]}"
                if len(source_change_request_ids) == 1
                else f"来源变更 {len(source_change_request_ids)} 条"
            )
        if source_backtest_ids:
            parts.append(
                f"来源回测 {source_backtest_ids[0]}"
                if len(source_backtest_ids) == 1
                else f"来源回测 {len(source_backtest_ids)} 轮"
            )
        if source_review_ids:
            parts.append(
                f"来源复盘 {source_review_ids[0]}"
                if len(source_review_ids) == 1
                else f"来源复盘 {len(source_review_ids)} 条"
            )
        if source_proposal_ids:
            parts.append(
                f"来源提案 {source_proposal_ids[0]}"
                if len(source_proposal_ids) == 1
                else f"来源提案 {len(source_proposal_ids)} 条"
            )
        if trigger_reasons:
            parts.append(f"触发 {' / '.join(trigger_reasons)}")
        if decision_readiness_values:
            parts.append(f"门禁 {' / '.join(decision_readiness_values)}")
        manual_followup_required = payload.get("manual_followup_required") is True
        manual_followup_detail = AppRepository._non_empty_string(payload.get("manual_followup_detail"))
        if not manual_followup_detail and AppRepository._non_empty_string(payload.get("change_request_id")):
            manual_followup_detail = AppRepository._non_empty_string(payload.get("detail"))
        if manual_followup_required or manual_followup_detail:
            parts.append(
                f"需人工跟进 · {manual_followup_detail}"
                if manual_followup_detail
                else "需人工跟进"
            )
        return " · ".join(parts) if parts else None

    @staticmethod
    def _build_audit_event_summary(payload: Dict[str, Any]) -> str:
        for key in ("summary", "result_summary", "command", "title", "detail", "symbol"):
            normalized = AppRepository._non_empty_string(payload.get(key))
            if normalized:
                return normalized if key != "command" else f"命令 {normalized}"
        return "事件已记录"

    @staticmethod
    def _summarize_execution_event(event: ExecutionEvent) -> str:
        payload = event.payload if isinstance(event.payload, dict) else {}
        summary = AppRepository._non_empty_string(getattr(event, "summary", None)) or AppRepository._build_audit_event_summary(
            payload
        )
        impact_detail = AppRepository._non_empty_string(getattr(event, "impact_detail", None)) or AppRepository._build_audit_event_impact_detail(
            payload
        )
        parts = [event.event_type]
        if summary != "事件已记录":
            parts.append(summary)
        else:
            source = AppRepository._non_empty_string(event.source)
            if source:
                parts.append(source)
        if impact_detail and impact_detail != summary:
            parts.append(impact_detail)
        return " · ".join(parts)

    @staticmethod
    def _execution_event_priority(event: ExecutionEvent) -> int:
        preset_priority = getattr(event, "priority", None)
        if isinstance(preset_priority, int):
            return preset_priority
        event_type = str(event.event_type or "")
        if event_type == "scheduler.command":
            return 0
        if event_type.startswith("openclaw.job."):
            return 1
        if event_type.startswith("strategy.issue.review.") or event_type.startswith("strategy.change.review."):
            return 1
        if event_type.startswith("change_request.") or event_type.startswith("strategy.review."):
            return 2
        if event_type.startswith("exchange_order."):
            return 3
        if event_type.startswith("strategy."):
            return 4
        if event_type.startswith("alert."):
            return 5
        return 6

    @staticmethod
    def _pick_latest_key_execution_event(events: List[ExecutionEvent]) -> Optional[ExecutionEvent]:
        if not events:
            return None
        prioritized = min(
            enumerate(events),
            key=lambda item: (AppRepository._execution_event_priority(item[1]), item[0]),
        )
        return prioritized[1]

    @staticmethod
    def _decorate_execution_event(event: ExecutionEvent) -> ExecutionEvent:
        payload = event.payload if isinstance(event.payload, dict) else {}
        priority = AppRepository._execution_event_priority(event)
        return event.model_copy(
            update={
                "summary": AppRepository._non_empty_string(getattr(event, "summary", None))
                or AppRepository._build_audit_event_summary(payload),
                "impact_detail": AppRepository._non_empty_string(getattr(event, "impact_detail", None))
                or AppRepository._build_audit_event_impact_detail(payload),
                "priority": priority,
                "is_key_event": bool(getattr(event, "is_key_event", priority <= 2) or priority <= 2),
            }
        )

    @staticmethod
    def _normalize_notification_channels(channels: Optional[list[str]]) -> Optional[list[str]]:
        if channels is None:
            return None
        allowed = {"desktop", "telegram", "email"}
        normalized: list[str] = []
        for item in channels:
            candidate = str(item or "").strip().lower()
            if not candidate:
                continue
            if candidate not in allowed:
                raise ValueError("通知渠道仅支持 desktop / telegram / email。")
            if candidate not in normalized:
                normalized.append(candidate)
        if not normalized:
            raise ValueError("至少保留一个通知渠道。")
        return normalized

    @staticmethod
    def _normalize_workspace_filter_value(value: Optional[str], *, fallback: str = "all") -> str:
        normalized = str(value or "").strip()
        return normalized or fallback

    def _sanitize_workspace_preferences_locked(self) -> bool:
        preferences = self.state.workspace_preferences
        updates: dict[str, Any] = {}
        strategy_ids = {strategy.id for strategy in self.state.strategies}
        strategy_symbols = {
            strategy.id: strategy.symbols[0]
            for strategy in self.state.strategies
            if strategy.symbols and isinstance(strategy.symbols[0], str) and strategy.symbols[0].strip()
        }
        watchlist_symbols = {item.symbol for item in self.state.watchlist}
        proposal_by_id = {
            proposal.id: proposal
            for review in self.state.reviews
            for proposal in review.proposals
        }
        review_by_id = {review.id: review for review in self.state.reviews}
        scheduler_job_by_id = {job.id: job for job in self.state.agent_jobs}

        selected_symbol = preferences.selected_symbol
        if self.state.watchlist and not any(item.symbol == selected_symbol for item in self.state.watchlist):
            updates["selected_symbol"] = self.state.watchlist[0].symbol

        selected_strategy_id = preferences.selected_strategy_id
        if selected_strategy_id and selected_strategy_id not in strategy_ids:
            updates["selected_strategy_id"] = self.state.strategies[0].id if self.state.strategies else None

        selected_backtest_id = preferences.selected_backtest_id
        selected_backtest = next((backtest for backtest in self.state.backtests if backtest.id == selected_backtest_id), None)
        if selected_backtest_id and selected_backtest is None:
            updates["selected_backtest_id"] = None

        selected_scheduler_job_id = preferences.selected_scheduler_job_id
        selected_scheduler_job = scheduler_job_by_id.get(selected_scheduler_job_id) if selected_scheduler_job_id else None
        if selected_scheduler_job_id and selected_scheduler_job is None:
            updates["selected_scheduler_job_id"] = None

        selected_strategy_detail_panel = preferences.selected_strategy_detail_panel
        if preferences.active_section != "strategy":
            if selected_strategy_detail_panel is not None:
                updates["selected_strategy_detail_panel"] = None
            if preferences.selected_strategy_tracking_kind is not None:
                updates["selected_strategy_tracking_kind"] = None
            if preferences.selected_strategy_tracking_summary:
                updates["selected_strategy_tracking_summary"] = ""
            if preferences.selected_strategy_tracking_detail:
                updates["selected_strategy_tracking_detail"] = ""
            if preferences.selected_strategy_editor_strategy_id is not None:
                updates["selected_strategy_editor_strategy_id"] = None
        elif selected_strategy_detail_panel != "tracking":
            if preferences.selected_strategy_tracking_kind is not None:
                updates["selected_strategy_tracking_kind"] = None
            if preferences.selected_strategy_tracking_summary:
                updates["selected_strategy_tracking_summary"] = ""
            if preferences.selected_strategy_tracking_detail:
                updates["selected_strategy_tracking_detail"] = ""
        elif preferences.selected_strategy_tracking_kind is None:
            updates["selected_strategy_tracking_kind"] = "issue"

        if preferences.active_section != "strategy":
            if preferences.selected_strategy_editor_parameter_drafts:
                updates["selected_strategy_editor_parameter_drafts"] = {}
            if preferences.selected_strategy_editor_risk_budget_draft:
                updates["selected_strategy_editor_risk_budget_draft"] = ""

        selected_review_inspector_id = preferences.selected_review_inspector_id
        selected_review_inspector = (
            review_by_id.get(selected_review_inspector_id) if selected_review_inspector_id else None
        )
        if selected_review_inspector_id and selected_review_inspector is None:
            updates["selected_review_inspector_id"] = None
            updates["selected_review_inspector_strategy_id"] = None

        selected_review_inspector_strategy_id = preferences.selected_review_inspector_strategy_id
        if (
            selected_review_inspector_strategy_id
            and selected_review_inspector_strategy_id not in strategy_ids
        ):
            updates["selected_review_inspector_strategy_id"] = None

        selected_review_id = preferences.selected_review_id
        selected_review = review_by_id.get(selected_review_id) if selected_review_id else None
        if selected_review_id and selected_review is None:
            updates["selected_review_id"] = None

        selected_proposal_id = preferences.selected_proposal_id
        selected_proposal = proposal_by_id.get(selected_proposal_id) if selected_proposal_id else None
        if selected_proposal_id and selected_proposal is None:
            updates["selected_proposal_id"] = None

        selected_change_request_id = preferences.selected_change_request_id
        selected_change_request = next(
            (request for request in self.state.change_requests if request.id == selected_change_request_id),
            None,
        )
        if selected_change_request_id and selected_change_request is None:
            updates["selected_change_request_id"] = None

        selected_strategy_editor_strategy_id = preferences.selected_strategy_editor_strategy_id
        if (
            preferences.active_section == "strategy"
            and not selected_strategy_editor_strategy_id
        ):
            if preferences.selected_strategy_editor_parameter_drafts:
                updates["selected_strategy_editor_parameter_drafts"] = {}
            if preferences.selected_strategy_editor_risk_budget_draft:
                updates["selected_strategy_editor_risk_budget_draft"] = ""
        if (
            selected_strategy_editor_strategy_id
            and selected_strategy_editor_strategy_id not in strategy_ids
        ):
            updates["selected_strategy_editor_strategy_id"] = None
            if preferences.selected_strategy_editor_parameter_drafts:
                updates["selected_strategy_editor_parameter_drafts"] = {}
            if preferences.selected_strategy_editor_risk_budget_draft:
                updates["selected_strategy_editor_risk_budget_draft"] = ""

        next_selected_strategy_id = updates.get("selected_strategy_id", preferences.selected_strategy_id)
        if preferences.active_section == "strategy" and selected_change_request is not None:
            payload_strategy_id = selected_change_request.payload.get("strategy_id")
            if (
                isinstance(payload_strategy_id, str)
                and payload_strategy_id in strategy_ids
                and payload_strategy_id != next_selected_strategy_id
            ):
                updates["selected_strategy_id"] = payload_strategy_id
                next_selected_strategy_id = payload_strategy_id
        elif preferences.active_section == "strategy" and selected_proposal is not None:
            if selected_proposal.strategy_id in strategy_ids and selected_proposal.strategy_id != next_selected_strategy_id:
                updates["selected_strategy_id"] = selected_proposal.strategy_id
                next_selected_strategy_id = selected_proposal.strategy_id
        elif preferences.active_section == "backtest" and selected_backtest is not None:
            if selected_backtest.strategy_id in strategy_ids and selected_backtest.strategy_id != next_selected_strategy_id:
                updates["selected_strategy_id"] = selected_backtest.strategy_id
                next_selected_strategy_id = selected_backtest.strategy_id
        elif preferences.active_section == "replay" and selected_review is not None:
            review_strategy_id = selected_review.strategy_id
            if not review_strategy_id:
                review_strategy_candidates = {
                    proposal.strategy_id
                    for proposal in selected_review.proposals
                    if isinstance(proposal.strategy_id, str) and proposal.strategy_id in strategy_ids
                }
                if len(review_strategy_candidates) == 1:
                    review_strategy_id = next(iter(review_strategy_candidates))
            if review_strategy_id in strategy_ids and review_strategy_id != next_selected_strategy_id:
                updates["selected_strategy_id"] = review_strategy_id
                next_selected_strategy_id = review_strategy_id
        elif preferences.active_section == "scheduler" and selected_scheduler_job is not None:
            scheduler_strategy_id = selected_scheduler_job.strategy_id
            if not scheduler_strategy_id:
                context_strategy_id = selected_scheduler_job.context.get("strategy_id")
                if isinstance(context_strategy_id, str) and context_strategy_id in strategy_ids:
                    scheduler_strategy_id = context_strategy_id
            if scheduler_strategy_id in strategy_ids and scheduler_strategy_id != next_selected_strategy_id:
                updates["selected_strategy_id"] = scheduler_strategy_id
                next_selected_strategy_id = scheduler_strategy_id

        next_editor_strategy_id = updates.get(
            "selected_strategy_editor_strategy_id",
            preferences.selected_strategy_editor_strategy_id,
        )
        if (
            preferences.active_section == "strategy"
            and selected_strategy_detail_panel == "editor"
            and selected_change_request is None
            and selected_proposal is None
            and next_editor_strategy_id in strategy_ids
            and next_editor_strategy_id != next_selected_strategy_id
        ):
            updates["selected_strategy_id"] = next_editor_strategy_id
            next_selected_strategy_id = next_editor_strategy_id
        if (
            preferences.active_section == "strategy"
            and next_editor_strategy_id
            and next_selected_strategy_id != next_editor_strategy_id
        ):
            updates["selected_strategy_editor_strategy_id"] = None
            if preferences.selected_strategy_editor_parameter_drafts:
                updates["selected_strategy_editor_parameter_drafts"] = {}
            if preferences.selected_strategy_editor_risk_budget_draft:
                updates["selected_strategy_editor_risk_budget_draft"] = ""

        next_selected_symbol = updates.get("selected_symbol", preferences.selected_symbol)
        if preferences.active_section in {"strategy", "replay", "scheduler"} and next_selected_strategy_id in strategy_symbols:
            strategy_symbol = strategy_symbols[next_selected_strategy_id]
            if strategy_symbol in watchlist_symbols and strategy_symbol != next_selected_symbol:
                updates["selected_symbol"] = strategy_symbol
        elif preferences.active_section == "backtest" and selected_backtest is not None:
            backtest_symbol = next(
                (
                    symbol
                    for symbol in selected_backtest.symbol_scope
                    if isinstance(symbol, str) and symbol.strip() and symbol in watchlist_symbols
                ),
                None,
            )
            if backtest_symbol and backtest_symbol != next_selected_symbol:
                updates["selected_symbol"] = backtest_symbol

        if not updates:
            return False
        self.state.workspace_preferences = preferences.model_copy(update=updates)
        return True

    def _recompute_alert_summary(self) -> None:
        summary = {"P0": 0, "P1": 0, "P2": 0}
        for alert in self.state.alerts:
            if not alert.acknowledged:
                summary[alert.severity] = summary.get(alert.severity, 0) + 1
        self.state.control_snapshot.alerts_summary = summary

    def _recompute_strategy_metrics(self) -> None:
        running_count = sum(1 for strategy in self.state.strategies if strategy.status == "running")
        paper_count = sum(
            1 for strategy in self.state.strategies if strategy.mode == AccountMode.PAPER or strategy.status == "paper_only"
        )
        proposal_count = sum(
            1
            for review in self.state.reviews
            for proposal in review.proposals
            if proposal.status in {"pending", "testing"}
        )
        self.state.control_snapshot.strategy_metrics = [
            self.state.control_snapshot.strategy_metrics[0].model_copy(
                update={"value": str(running_count)}
            ),
            self.state.control_snapshot.strategy_metrics[1].model_copy(
                update={"value": str(paper_count)}
            ),
            self.state.control_snapshot.strategy_metrics[2].model_copy(
                update={"value": str(proposal_count)}
            ),
        ]

    def _refresh_derived_state(self) -> None:
        self._sanitize_workspace_preferences_locked()
        self._settle_open_paper_orders_locked()
        self._refresh_paper_state_locked()
        self._recompute_alert_summary()
        self._recompute_strategy_metrics()
        self._recompute_scheduler_queue_depth()

    @staticmethod
    def _format_usdt(value: float) -> str:
        return f"{value:,.2f} USDT"

    @staticmethod
    def _format_usdt_delta(value: float) -> str:
        sign = "+" if value > 0 else ""
        return f"{sign}{value:,.2f} USDT"

    @staticmethod
    def _format_quantity(value: float, digits: int = 4) -> str:
        return f"{value:,.{digits}f}".rstrip("0").rstrip(".")

    @staticmethod
    def _format_ratio(value: float) -> str:
        return f"{value:,.2f}".rstrip("0").rstrip(".")

    @staticmethod
    def _parse_metric_number(value: Any) -> float:
        normalized = str(value if value is not None else 0).replace("USDT", "").replace("%", "").replace(",", "").replace("+", "").strip()
        try:
            return float(normalized)
        except (TypeError, ValueError):
            return 0.0

    @staticmethod
    def _symbol_coin(symbol: str) -> str:
        return symbol[:-4] if symbol.endswith("USDT") else symbol

    @staticmethod
    def _parse_trade_time(value: str) -> datetime:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return datetime.min.replace(tzinfo=timezone.utc)

    @staticmethod
    def _require_proposal_target_mode(
        payload: Dict[str, Any],
        message: str,
        default_mode: Optional[AccountMode] = None,
    ) -> AccountMode:
        raw_mode = str(payload.get("target_mode") or (default_mode.value if default_mode is not None else "")).strip().lower()
        if raw_mode not in {"paper", "demo", "live"}:
            raise ValueError(message)
        return AccountMode(raw_mode)

    @staticmethod
    def _build_script_patch_change_summary(proposal: StrategyProposal, payload: Dict[str, Any]) -> str:
        payload_summary = str(payload.get("summary") or payload.get("patch_summary") or "").strip()
        if payload_summary:
            return f"接受脚本补丁提案：{proposal.title} - {payload_summary}"
        description = str(proposal.description or "").strip()
        if description:
            return f"接受脚本补丁提案：{proposal.title} - {description}"
        return f"接受脚本补丁提案：{proposal.title}"

    @staticmethod
    def _merge_event_payload_value(payload: Dict[str, Any], key: str, value: Any) -> None:
        existing = payload.get(key)
        if isinstance(existing, str):
            if existing.strip():
                return
        elif existing is not None:
            return
        if value is None:
            return
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return
        payload[key] = value

    @staticmethod
    def _dedupe_non_empty_strings(values: list[Any]) -> list[str]:
        normalized: list[str] = []
        for value in values:
            if value is None:
                continue
            text = str(value).strip()
            if text and text not in normalized:
                normalized.append(text)
        return normalized

    def _enrich_agent_job_event_payload(
        self,
        payload: Dict[str, Any],
        job: AgentJob,
        review: Optional[ReviewDocument] = None,
    ) -> Dict[str, Any]:
        context = job.context if isinstance(job.context, dict) else {}
        self._merge_event_payload_value(payload, "job_id", job.id)
        self._merge_event_payload_value(payload, "job_type", job.job_type)
        self._merge_event_payload_value(payload, "strategy_id", context.get("strategy_id"))
        self._merge_event_payload_value(
            payload,
            "review_id",
            review.id if review is not None and getattr(review, "id", None) else context.get("linked_review_id"),
        )
        self._merge_event_payload_value(
            payload,
            "review_title",
            review.title if review is not None and getattr(review, "title", None) else context.get("linked_review_title"),
        )
        self._merge_event_payload_value(
            payload,
            "review_period",
            review.period if review is not None and getattr(review, "period", None) else context.get("linked_review_period"),
        )
        self._merge_event_payload_value(
            payload,
            "linked_review_id",
            review.id if review is not None and getattr(review, "id", None) else context.get("linked_review_id"),
        )
        self._merge_event_payload_value(
            payload,
            "linked_review_title",
            review.title if review is not None and getattr(review, "title", None) else context.get("linked_review_title"),
        )
        self._merge_event_payload_value(
            payload,
            "linked_review_period",
            review.period if review is not None and getattr(review, "period", None) else context.get("linked_review_period"),
        )
        self._merge_event_payload_value(
            payload,
            "backtest_id",
            review.backtest_id if review is not None and getattr(review, "backtest_id", None) else context.get("backtest_id"),
        )
        self._merge_event_payload_value(
            payload,
            "source_change_request_id",
            review.source_change_request_id
            if review is not None and getattr(review, "source_change_request_id", None)
            else context.get("source_change_request_id"),
        )
        self._merge_event_payload_value(
            payload,
            "source_backtest_id",
            review.source_backtest_id
            if review is not None and getattr(review, "source_backtest_id", None)
            else context.get("source_backtest_id"),
        )
        self._merge_event_payload_value(
            payload,
            "source_review_id",
            review.source_review_id
            if review is not None and getattr(review, "source_review_id", None)
            else context.get("source_review_id"),
        )
        self._merge_event_payload_value(
            payload,
            "source_proposal_id",
            review.source_proposal_id
            if review is not None and getattr(review, "source_proposal_id", None)
            else context.get("source_proposal_id"),
        )
        self._merge_event_payload_value(
            payload,
            "trigger_reason",
            review.trigger_reason if review is not None and getattr(review, "trigger_reason", None) else context.get("trigger_reason"),
        )
        self._merge_event_payload_value(
            payload,
            "decision_readiness",
            review.decision_readiness
            if review is not None and getattr(review, "decision_readiness", None)
            else context.get("decision_readiness"),
        )
        self._merge_event_payload_value(
            payload,
            "decision_readiness_detail",
            review.decision_readiness_detail
            if review is not None and getattr(review, "decision_readiness_detail", None)
            else context.get("decision_readiness_detail"),
        )
        self._merge_event_payload_value(
            payload,
            "decision_recommended_data_range",
            review.decision_recommended_data_range
            if review is not None and getattr(review, "decision_recommended_data_range", None)
            else context.get("decision_recommended_data_range"),
        )
        self._merge_event_payload_value(
            payload,
            "decision_recommended_timeframe",
            review.decision_recommended_timeframe
            if review is not None and getattr(review, "decision_recommended_timeframe", None)
            else context.get("decision_recommended_timeframe"),
        )
        self._merge_event_payload_value(
            payload,
            "decision_readiness_action",
            review.decision_readiness_action
            if review is not None and getattr(review, "decision_readiness_action", None)
            else context.get("decision_readiness_action"),
        )
        return payload

    def _enrich_agent_job_collection_payload(
        self,
        payload: Dict[str, Any],
        jobs: list[AgentJob],
        prefix: str,
    ) -> Dict[str, Any]:
        if not jobs:
            return payload
        contexts = [job.context if isinstance(job.context, dict) else {} for job in jobs]
        payload[f"{prefix}_job_ids"] = self._dedupe_non_empty_strings([job.id for job in jobs])
        payload[f"{prefix}_job_types"] = self._dedupe_non_empty_strings([job.job_type for job in jobs])
        payload[f"{prefix}_strategy_ids"] = self._dedupe_non_empty_strings([context.get("strategy_id") for context in contexts])
        payload[f"{prefix}_backtest_ids"] = self._dedupe_non_empty_strings([context.get("backtest_id") for context in contexts])
        payload[f"{prefix}_source_change_request_ids"] = self._dedupe_non_empty_strings(
            [context.get("source_change_request_id") for context in contexts]
        )
        payload[f"{prefix}_source_backtest_ids"] = self._dedupe_non_empty_strings(
            [context.get("source_backtest_id") for context in contexts]
        )
        payload[f"{prefix}_source_review_ids"] = self._dedupe_non_empty_strings(
            [context.get("source_review_id") for context in contexts]
        )
        payload[f"{prefix}_source_proposal_ids"] = self._dedupe_non_empty_strings(
            [context.get("source_proposal_id") for context in contexts]
        )
        payload[f"{prefix}_trigger_reasons"] = self._dedupe_non_empty_strings(
            [context.get("trigger_reason") for context in contexts]
        )
        payload[f"{prefix}_decision_readiness_values"] = self._dedupe_non_empty_strings(
            [context.get("decision_readiness") for context in contexts]
        )
        return payload

    @staticmethod
    def _summarize_job_type_breakdown(jobs: list[AgentJob]) -> str:
        counts: Dict[str, int] = {}
        order: list[str] = []
        for job in jobs:
            job_type = str(job.job_type or "").strip()
            if not job_type:
                continue
            if job_type not in counts:
                counts[job_type] = 0
                order.append(job_type)
            counts[job_type] += 1
        parts = [f"{job_type} {counts[job_type]} 个" for job_type in order]
        return "、".join(parts)

    @staticmethod
    def _build_scheduler_command_summary(
        command: SchedulerCommand,
        target_job: Optional[AgentJob],
        cancelled_jobs: list[AgentJob],
        scheduler_status: str,
        freeze_publish: bool,
    ) -> str:
        if command.command == SchedulerCommandType.PAUSE:
            return "AI 调度已暂停。"
        if command.command == SchedulerCommandType.RESUME:
            return "AI 调度已恢复运行。"
        if command.command == SchedulerCommandType.FREEZE_PUBLISH:
            return "自动发布已冻结。" if freeze_publish else "自动发布已恢复。"
        if command.command == SchedulerCommandType.CANCEL_JOB:
            if target_job is not None:
                return f"已终止任务：{target_job.job_type}"
            return "已请求终止指定任务。"
        if command.command == SchedulerCommandType.CANCEL_ALL:
            if cancelled_jobs:
                breakdown = AppRepository._summarize_job_type_breakdown(cancelled_jobs)
                if breakdown:
                    return f"已终止 {len(cancelled_jobs)} 个任务，其中 {breakdown}。"
                return f"已终止 {len(cancelled_jobs)} 个任务。"
            return "已请求终止全部任务。"
        if command.command == SchedulerCommandType.ENTER_MANUAL_OVERRIDE:
            if target_job is not None:
                return f"已进入人工接管，并终止当前任务：{target_job.job_type}"
            return "已进入人工接管。"
        return f"已执行调度命令：{command.command}"

    @staticmethod
    def _summarize_review_execution_preview(preview: Optional[ExecutionPreview]) -> Optional[Dict[str, Any]]:
        if preview is None:
            return None
        return {
            "action": preview.action,
            "allowed": preview.allowed,
            "blocked_reason": preview.blocked_reason,
            "recommended_action": preview.recommended_action,
            "projected_position_side": preview.projected_position_side,
            "projected_position_size": preview.projected_position_size,
            "available_balance_after": preview.available_balance_after,
            "sizing_risk_budget": preview.sizing_risk_budget,
            "sizing_budget_notional": preview.sizing_budget_notional,
            "sizing_minimum_required_notional": preview.sizing_minimum_required_notional,
            "sizing_available_balance_gap": preview.sizing_available_balance_gap,
        }

    def _build_review_strategy_activity_context_locked(
        self,
        strategy_id: str,
        proposal_status_overrides: Optional[Dict[str, str]] = None,
        change_request_follow_up_overrides: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> Optional[Dict[str, Any]]:
        strategy = next((item for item in self.state.strategies if item.id == strategy_id), None)
        if strategy is None:
            return None

        snapshot = next((item for item in self.state.strategy_runtime_snapshots if item.strategy_id == strategy_id), None)
        symbol = snapshot.symbol if snapshot is not None else (strategy.symbols[0] if strategy.symbols else "--")
        market = (
            snapshot.market
            if snapshot is not None
            else next((item.market for item in self.state.watchlist if item.symbol == symbol), "perp")
        )

        def matches_order(order: OrderRecord) -> bool:
            return (
                order.origin == "strategy"
                and order.symbol == symbol
                and order.market == market
                and order.strategy_id in {strategy_id, None}
            )

        def matches_trade(trade: TradeRecord) -> bool:
            return (
                trade.origin == "strategy"
                and trade.symbol == symbol
                and trade.market == market
                and trade.strategy_id in {strategy_id, None}
            )

        def matches_alert(alert: AlertRecord) -> bool:
            if alert.source_type != "system":
                return False
            rule_key = str(getattr(alert, "rule_key", None) or "")
            strategy_prefixes = (
                f"strategy-auto-dispatch:{strategy_id}:",
                f"strategy-blocked-execution:{strategy_id}:",
                f"strategy-manual-execution:{strategy_id}:",
                f"strategy-position-drift:{strategy_id}:",
                f"strategy-live-stop-loss:{strategy_id}:",
                f"strategy-exchange-rejected:{strategy_id}:",
                f"strategy-exchange-rejection-guard:{strategy_id}:",
                f"strategy-stale-order:{strategy_id}:",
            )
            return rule_key.startswith(strategy_prefixes) or alert.symbol == symbol

        def matches_event(event: ExecutionEvent) -> bool:
            if event.strategy_id == strategy_id:
                return True
            if event.symbol != symbol:
                return False
            return event.event_type.startswith("strategy.") or event.event_type.startswith("exchange_order.")

        def summarize_order(order: OrderRecord) -> str:
            return f"{order.symbol} {order.side.value} {order.qty}@{order.price} · {order.status} · {order.source}"

        def summarize_trade(trade: TradeRecord) -> str:
            parts = [f"{trade.symbol} {trade.side.value} {trade.quantity}@{trade.price}", str(trade.status or "filled")]
            pnl = str(trade.pnl or "").strip()
            if pnl and pnl != "--":
                parts.append(f"pnl {pnl}")
            return " · ".join(parts)

        def summarize_alert(alert: AlertRecord) -> str:
            return f"{alert.severity} {alert.title} · {alert.description}"

        def summarize_event(event: ExecutionEvent) -> str:
            return AppRepository._summarize_execution_event(event)

        def summarize_backtest(backtest: BacktestRun) -> str:
            parts = [
                f"{backtest.id} · {backtest.timeframe} · {backtest.data_range}",
                backtest.status,
                backtest.decision_readiness,
            ]
            if backtest.history_source != "exchange_history":
                parts.append(backtest.history_source)
            if backtest.source_change_request_id:
                parts.append(f"变更 {backtest.source_change_request_id}")
            if backtest.source_backtest_id:
                parts.append(f"来源回测 {backtest.source_backtest_id}")
            if backtest.source_review_id:
                parts.append(f"来源复盘 {backtest.source_review_id}")
            if backtest.source_proposal_id:
                parts.append(f"来源提案 {backtest.source_proposal_id}")
            return " · ".join(parts)

        def summarize_review(review: ReviewDocument) -> str:
            parts = [f"{review.id} · {review.period}", review.title]
            if review.source_job_type:
                job_parts = [f"任务 {review.source_job_type}"]
                if review.source_job_status:
                    job_parts.append(review.source_job_status)
                parts.append(" / ".join(job_parts))
            if review.source_change_request_id:
                parts.append(f"变更 {review.source_change_request_id}")
            if review.backtest_id:
                parts.append(f"回测 {review.backtest_id}")
            if review.source_proposal_id:
                parts.append(f"提案 {review.source_proposal_id}")
            return " · ".join(parts)

        def summarize_agent_job(job: AgentJob) -> str:
            parts = [f"{job.id} · {job.job_type}", job.status.value]
            backtest_id = str(job.context.get("backtest_id") or "").strip()
            linked_review_title = str(job.linked_review_title or "").strip()
            linked_review_id = str(job.linked_review_id or "").strip()
            result_summary = str(job.result_summary or "").strip()
            if backtest_id:
                parts.append(f"回测 {backtest_id}")
            if linked_review_title:
                parts.append(f"结果 {linked_review_title}")
            elif linked_review_id:
                parts.append(f"复盘 {linked_review_id}")
            elif result_summary:
                parts.append(result_summary)
            return " · ".join(parts)

        def summarize_change_request(change_request: ChangeRequest) -> str:
            parts = [f"{change_request.id} · {change_request.type}", change_request.status.value]
            if change_request.manual_followup_required:
                parts.append("需人工跟进")
            if change_request.linked_backtest_id:
                parts.append(f"回测 {change_request.linked_backtest_id}")
            if change_request.linked_review_id:
                parts.append(f"复盘 {change_request.linked_review_id}")
            follow_up_override = (change_request_follow_up_overrides or {}).get(change_request.id, {})
            follow_up_job_type = (
                str(follow_up_override.get("follow_up_job_type") or "").strip()
                or str(change_request.follow_up_job_type or "").strip()
            )
            follow_up_job_status = (
                str(follow_up_override.get("follow_up_job_status") or "").strip()
                or str(change_request.follow_up_job_status.value if change_request.follow_up_job_status else "")
            )
            if follow_up_job_type:
                follow_up_parts = [f"跟踪 {follow_up_job_type}"]
                if follow_up_job_status:
                    follow_up_parts.append(follow_up_job_status)
                parts.append(" / ".join(follow_up_parts))
            return " · ".join(parts)

        def get_change_request_source_proposal_id(change_request: ChangeRequest) -> Optional[str]:
            source_proposal_id = str(change_request.source_proposal_id or "").strip()
            if source_proposal_id:
                return source_proposal_id
            payload_proposal_id = str(change_request.payload.get("proposal_id") or "").strip()
            return payload_proposal_id or None

        def get_change_request_source_backtest_id(change_request: ChangeRequest) -> Optional[str]:
            source_backtest_id = str(change_request.source_backtest_id or "").strip()
            return source_backtest_id or None

        def get_change_request_source_review_id(change_request: ChangeRequest) -> Optional[str]:
            source_review_id = str(change_request.source_review_id or "").strip()
            return source_review_id or None

        def summarize_proposal(proposal: StrategyProposal) -> str:
            proposal_status = str(
                (proposal_status_overrides or {}).get(proposal.id, proposal.status)
            )
            parts = [
                proposal.id,
                proposal.proposal_type,
                proposal_status,
                proposal.title,
                proposal.expected_impact,
            ]
            linked_change_request = get_linked_change_request_for_proposal(proposal)
            linked_backtest = get_linked_backtest_for_proposal(proposal)
            linked_review = get_linked_review_for_proposal(proposal)
            linked_job = get_linked_job_for_proposal(proposal)
            if linked_change_request:
                follow_up_override = (change_request_follow_up_overrides or {}).get(linked_change_request.id, {})
                parts.append(f"变更 {linked_change_request.id}")
                if linked_change_request.manual_followup_required:
                    parts.append("需人工跟进")
                follow_up_job_type = (
                    str(follow_up_override.get("follow_up_job_type") or "").strip()
                    or str(linked_change_request.follow_up_job_type or "").strip()
                )
                follow_up_job_status = (
                    str(follow_up_override.get("follow_up_job_status") or "").strip()
                    or str(linked_change_request.follow_up_job_status.value if linked_change_request.follow_up_job_status else "")
                )
                linked_review_title = (
                    str(follow_up_override.get("linked_review_title") or "").strip()
                    or str(linked_change_request.linked_review_title or "").strip()
                )
                follow_up_result_summary = (
                    str(follow_up_override.get("follow_up_result_summary") or "").strip()
                    or str(linked_change_request.follow_up_result_summary or "").strip()
                )
                if follow_up_job_type:
                    follow_up_parts = [f"跟踪 {follow_up_job_type}"]
                    if follow_up_job_status:
                        follow_up_parts.append(follow_up_job_status)
                    if linked_review_title:
                        follow_up_parts.append(f"结果 {linked_review_title}")
                    elif follow_up_result_summary:
                        follow_up_parts.append(follow_up_result_summary)
                    parts.append(" / ".join(follow_up_parts))
            elif linked_job:
                follow_up_parts = [f"任务 {linked_job.job_type}"]
                if linked_job.status:
                    follow_up_parts.append(linked_job.status.value)
                linked_review_title = read_text(linked_job.context.get("linked_review_title"))
                if linked_review_title:
                    follow_up_parts.append(f"结果 {linked_review_title}")
                elif linked_job.result_summary:
                    follow_up_parts.append(linked_job.result_summary)
                parts.append(" / ".join(follow_up_parts))
            elif proposal.proposal_type == "script_patch_proposal" and proposal_status in {"pending", "testing"}:
                parts.append("接受后需人工跟进")
            if linked_backtest:
                parts.append(f"回测 {linked_backtest.id}")
            if linked_review:
                parts.append(f"复盘 {linked_review.id}")
            return " · ".join(parts)

        active_orders = [item for item in self.state.paper_orders if matches_order(item)]
        recent_orders = [item for item in self.state.paper_order_history if matches_order(item)]
        recent_trades = [item for item in self.state.trades if matches_trade(item)]
        recent_alerts = [item for item in self.state.alerts if matches_alert(item)]
        recent_audit_events = [self._decorate_execution_event(item) for item in self.state.audit_events if matches_event(item)]
        active_orders.sort(key=lambda item: parse_optional_iso_datetime(item.created_at), reverse=True)
        recent_orders.sort(key=lambda item: parse_optional_iso_datetime(item.created_at), reverse=True)
        recent_trades.sort(key=lambda item: parse_optional_iso_datetime(item.created_at), reverse=True)
        recent_alerts.sort(key=lambda item: parse_optional_iso_datetime(item.triggered_at), reverse=True)
        recent_audit_events.sort(key=lambda item: parse_optional_iso_datetime(item.occurred_at), reverse=True)
        recent_proposals = [
            proposal
            for review in self.state.reviews
            for proposal in review.proposals
            if proposal.strategy_id == strategy_id
        ]
        recent_proposals.sort(key=lambda item: item.created_at, reverse=True)
        recent_reviews = [
            review
            for review in self.state.reviews
            if review.strategy_id == strategy_id
            or any(proposal.strategy_id == strategy_id for proposal in review.proposals)
        ]
        recent_reviews.sort(key=lambda item: item.created_at, reverse=True)
        recent_agent_jobs = [
            item
            for item in self.state.agent_jobs
            if str(item.context.get("strategy_id") or "") == strategy_id
        ]
        recent_agent_jobs.sort(key=lambda item: item.updated_at or item.created_at, reverse=True)
        recent_change_requests = [
            item
            for item in self.state.change_requests
            if str(item.payload.get("strategy_id") or "") == strategy_id
        ]
        recent_change_requests.sort(key=lambda item: item.updated_at or item.created_at, reverse=True)
        recent_backtests = [
            item
            for item in self.state.backtests
            if item.strategy_id == strategy_id
        ]
        recent_backtests.sort(key=lambda item: item.finished_at or item.started_at, reverse=True)

        def read_text(value: object) -> Optional[str]:
            if not isinstance(value, str):
                return None
            text = value.strip()
            return text or None

        proposal_change_request_map: Dict[str, ChangeRequest] = {}
        for change_request in recent_change_requests:
            source_proposal_id = get_change_request_source_proposal_id(change_request)
            if source_proposal_id and source_proposal_id not in proposal_change_request_map:
                proposal_change_request_map[source_proposal_id] = change_request
        proposal_backtest_map: Dict[str, BacktestRun] = {}
        for backtest in recent_backtests:
            source_proposal_id = str(backtest.source_proposal_id or "").strip()
            if source_proposal_id and source_proposal_id not in proposal_backtest_map:
                proposal_backtest_map[source_proposal_id] = backtest
        proposal_review_map: Dict[str, ReviewDocument] = {}
        for review in recent_reviews:
            source_proposal_id = str(review.source_proposal_id or "").strip()
            if source_proposal_id and source_proposal_id not in proposal_review_map:
                proposal_review_map[source_proposal_id] = review
        proposal_by_id = {item.id: item for item in recent_proposals}
        backtest_by_id = {item.id: item for item in recent_backtests}
        review_by_id = {item.id: item for item in recent_reviews}
        agent_job_by_id = {item.id: item for item in recent_agent_jobs}
        review_by_backtest_id: Dict[str, ReviewDocument] = {}
        for review in recent_reviews:
            if review.backtest_id and review.backtest_id not in review_by_backtest_id:
                review_by_backtest_id[review.backtest_id] = review
        agent_job_by_backtest_id: Dict[str, AgentJob] = {}
        for job in recent_agent_jobs:
            backtest_id = str(job.context.get("backtest_id") or "").strip()
            if backtest_id and backtest_id not in agent_job_by_backtest_id:
                agent_job_by_backtest_id[backtest_id] = job
        retryable_backtest_ids: set[str] = set()
        for job in recent_agent_jobs:
            backtest_id = str(job.context.get("backtest_id") or "").strip()
            if backtest_id and job.status in {"failed", "cancelled"}:
                retryable_backtest_ids.add(backtest_id)

        def get_linked_change_request_for_proposal(proposal: Optional[StrategyProposal]) -> Optional[ChangeRequest]:
            if proposal is None:
                return None
            return proposal_change_request_map.get(proposal.id)

        def get_linked_backtest_for_proposal(proposal: Optional[StrategyProposal]) -> Optional[BacktestRun]:
            if proposal is None:
                return None
            linked_backtest = proposal_backtest_map.get(proposal.id)
            if linked_backtest is not None:
                return linked_backtest
            linked_change_request = proposal_change_request_map.get(proposal.id)
            if linked_change_request and linked_change_request.linked_backtest_id:
                return backtest_by_id.get(linked_change_request.linked_backtest_id)
            linked_review = proposal_review_map.get(proposal.id)
            if linked_review and linked_review.backtest_id:
                return backtest_by_id.get(linked_review.backtest_id)
            return None

        def get_linked_review_for_proposal(proposal: Optional[StrategyProposal]) -> Optional[ReviewDocument]:
            if proposal is None:
                return None
            linked_review = proposal_review_map.get(proposal.id)
            if linked_review is not None:
                return linked_review
            linked_change_request = proposal_change_request_map.get(proposal.id)
            if linked_change_request and linked_change_request.linked_review_id:
                return review_by_id.get(linked_change_request.linked_review_id)
            linked_backtest = get_linked_backtest_for_proposal(proposal)
            if linked_backtest is not None:
                return review_by_backtest_id.get(linked_backtest.id)
            return None

        def get_linked_job_for_proposal(proposal: Optional[StrategyProposal]) -> Optional[AgentJob]:
            if proposal is None:
                return None
            linked_change_request = proposal_change_request_map.get(proposal.id)
            if linked_change_request and linked_change_request.follow_up_job_id:
                linked_job = agent_job_by_id.get(linked_change_request.follow_up_job_id)
                if linked_job is not None:
                    return linked_job
            linked_review = get_linked_review_for_proposal(proposal)
            if linked_review and linked_review.source_job_id:
                linked_job = agent_job_by_id.get(linked_review.source_job_id)
                if linked_job is not None:
                    return linked_job
            linked_backtest = get_linked_backtest_for_proposal(proposal)
            if linked_backtest is not None:
                return agent_job_by_backtest_id.get(linked_backtest.id)
            return None
        latest_proposal = next(iter(recent_proposals), None)
        latest_actionable_proposal = next(
            (
                item
                for item in recent_proposals
                if str((proposal_status_overrides or {}).get(item.id, item.status)) in {"pending", "testing"}
            ),
            None,
        )
        latest_proposal_change_request = get_linked_change_request_for_proposal(latest_proposal)
        latest_proposal_backtest = get_linked_backtest_for_proposal(latest_proposal)
        latest_proposal_review = get_linked_review_for_proposal(latest_proposal)
        latest_proposal_job = get_linked_job_for_proposal(latest_proposal)
        latest_actionable_proposal_change_request = get_linked_change_request_for_proposal(
            latest_actionable_proposal
        )
        latest_actionable_proposal_backtest = get_linked_backtest_for_proposal(latest_actionable_proposal)
        latest_actionable_proposal_review = get_linked_review_for_proposal(latest_actionable_proposal)
        latest_actionable_proposal_job = get_linked_job_for_proposal(latest_actionable_proposal)
        latest_backtest = next(iter(recent_backtests), None)
        latest_backtest_review = (
            review_by_backtest_id.get(latest_backtest.id)
            if latest_backtest
            else None
        )
        latest_backtest_job = (
            agent_job_by_backtest_id.get(latest_backtest.id)
            if latest_backtest
            else None
        )
        latest_tracking_job = next(
            (item for item in recent_agent_jobs if item.job_type in {"review_strategy_issue", "review_strategy_change"}),
            None,
        )
        latest_change_request = next(iter(recent_change_requests), None)
        latest_change_request_backtest_record = (
            backtest_by_id.get(latest_change_request.linked_backtest_id)
            if latest_change_request and latest_change_request.linked_backtest_id
            else None
        )
        latest_change_request_review_record = (
            review_by_id.get(latest_change_request.linked_review_id)
            if latest_change_request and latest_change_request.linked_review_id
            else None
        )
        latest_change_request_job_record = (
            agent_job_by_id.get(latest_change_request.follow_up_job_id)
            if latest_change_request and latest_change_request.follow_up_job_id
            else None
        )
        latest_change_request_source_backtest_record = (
            backtest_by_id.get(get_change_request_source_backtest_id(latest_change_request))
            if latest_change_request
            else None
        )
        latest_change_request_source_review_record = (
            review_by_id.get(get_change_request_source_review_id(latest_change_request))
            if latest_change_request
            else None
        )
        latest_change_request_source_proposal_record = (
            proposal_by_id.get(get_change_request_source_proposal_id(latest_change_request))
            if latest_change_request
            else None
        )
        def has_change_request_rerun_recommendation(change_request: ChangeRequest) -> bool:
            linked_backtest = (
                backtest_by_id.get(change_request.linked_backtest_id)
                if change_request.linked_backtest_id
                else None
            )
            linked_history_source_reason = (
                read_text(getattr(linked_backtest, "history_source_reason", None))
                or read_text(change_request.linked_backtest_history_source_reason)
                or "none"
            )
            decision_range = read_text(
                getattr(linked_backtest, "decision_recommended_data_range", None)
            ) or read_text(change_request.linked_backtest_decision_recommended_data_range)
            decision_timeframe = read_text(
                getattr(linked_backtest, "decision_recommended_timeframe", None)
            ) or read_text(change_request.linked_backtest_decision_recommended_timeframe)
            if linked_history_source_reason != "exchange_fetch_failed" and decision_range and decision_timeframe:
                return True
            full_window_range = read_text(
                getattr(linked_backtest, "full_window_recommended_data_range", None)
            ) or read_text(change_request.linked_backtest_full_window_recommended_data_range)
            full_window_timeframe = read_text(
                getattr(linked_backtest, "full_window_recommended_timeframe", None)
            ) or read_text(change_request.linked_backtest_full_window_recommended_timeframe)
            if full_window_range and full_window_timeframe:
                return True
            history_range = read_text(
                getattr(linked_backtest, "history_source_recommended_data_range", None)
            ) or read_text(change_request.linked_backtest_history_source_recommended_data_range)
            history_timeframe = read_text(
                getattr(linked_backtest, "history_source_recommended_timeframe", None)
            ) or read_text(change_request.linked_backtest_history_source_recommended_timeframe)
            return linked_history_source_reason != "exchange_fetch_failed" and bool(history_range and history_timeframe)

        def has_backtest_rerun_recommendation(backtest: BacktestRun) -> bool:
            history_source_reason = read_text(getattr(backtest, "history_source_reason", None)) or "none"
            decision_range = read_text(getattr(backtest, "decision_recommended_data_range", None))
            decision_timeframe = read_text(getattr(backtest, "decision_recommended_timeframe", None))
            if history_source_reason != "exchange_fetch_failed" and decision_range and decision_timeframe:
                return True
            full_window_range = read_text(getattr(backtest, "full_window_recommended_data_range", None))
            full_window_timeframe = read_text(getattr(backtest, "full_window_recommended_timeframe", None))
            if full_window_range and full_window_timeframe:
                return True
            history_range = read_text(getattr(backtest, "history_source_recommended_data_range", None))
            history_timeframe = read_text(getattr(backtest, "history_source_recommended_timeframe", None))
            return history_source_reason != "exchange_fetch_failed" and bool(history_range and history_timeframe)

        def has_review_rerun_recommendation(review: ReviewDocument) -> bool:
            decision_range = read_text(getattr(review, "decision_recommended_data_range", None))
            decision_timeframe = read_text(getattr(review, "decision_recommended_timeframe", None))
            return bool(decision_range and decision_timeframe)

        latest_primary_review: Optional[ReviewDocument] = None
        latest_actionable_primary_review: Optional[ReviewDocument] = None
        latest_tracking_review: Optional[ReviewDocument] = None
        for item in recent_reviews:
            if item.period in {"strategy_issue", "strategy_change"}:
                if latest_tracking_review is None:
                    latest_tracking_review = item
                continue
            if latest_primary_review is None:
                latest_primary_review = item
            if latest_actionable_primary_review is None and has_review_rerun_recommendation(item):
                latest_actionable_primary_review = item
            if (
                latest_primary_review is not None
                and latest_actionable_primary_review is not None
                and latest_tracking_review is not None
            ):
                break

        latest_change_request: Optional[ChangeRequest] = None
        latest_actionable_change_request: Optional[ChangeRequest] = None
        for item in recent_change_requests:
            if latest_change_request is None:
                latest_change_request = item
            if latest_actionable_change_request is None and (
                (
                    item.follow_up_job_id
                    and item.follow_up_job_status in {"failed", "cancelled"}
                )
                or has_change_request_rerun_recommendation(item)
            ):
                latest_actionable_change_request = item
            if latest_change_request is not None and latest_actionable_change_request is not None:
                break

        latest_actionable_change_request_backtest_record = (
            backtest_by_id.get(latest_actionable_change_request.linked_backtest_id)
            if latest_actionable_change_request and latest_actionable_change_request.linked_backtest_id
            else None
        )
        latest_actionable_change_request_review_record = (
            review_by_id.get(latest_actionable_change_request.linked_review_id)
            if latest_actionable_change_request and latest_actionable_change_request.linked_review_id
            else None
        )
        latest_actionable_change_request_job_record = (
            agent_job_by_id.get(latest_actionable_change_request.follow_up_job_id)
            if latest_actionable_change_request and latest_actionable_change_request.follow_up_job_id
            else None
        )
        latest_actionable_change_request_source_backtest_record = (
            backtest_by_id.get(get_change_request_source_backtest_id(latest_actionable_change_request))
            if latest_actionable_change_request
            else None
        )
        latest_actionable_change_request_source_review_record = (
            review_by_id.get(get_change_request_source_review_id(latest_actionable_change_request))
            if latest_actionable_change_request
            else None
        )
        latest_actionable_change_request_source_proposal_record = (
            proposal_by_id.get(get_change_request_source_proposal_id(latest_actionable_change_request))
            if latest_actionable_change_request
            else None
        )
        latest_actionable_backtest = next(
            (
                item
                for item in recent_backtests
                if has_backtest_rerun_recommendation(item)
                or item.id in retryable_backtest_ids
            ),
            None,
        )
        latest_backtest_record = (
            backtest_by_id.get(latest_backtest.id)
            if latest_backtest
            else None
        )
        latest_actionable_backtest_record = (
            backtest_by_id.get(latest_actionable_backtest.id)
            if latest_actionable_backtest
            else None
        )
        latest_actionable_backtest_review = (
            review_by_backtest_id.get(latest_actionable_backtest.id)
            if latest_actionable_backtest is not None
            else None
        )
        latest_actionable_backtest_job = (
            agent_job_by_backtest_id.get(latest_actionable_backtest.id)
            if latest_actionable_backtest is not None
            else None
        )
        latest_retryable_tracking_job = next(
            (
                item
                for item in recent_agent_jobs
                if item.job_type in {"review_strategy_issue", "review_strategy_change"}
                and item.status in {"failed", "cancelled"}
            ),
            None,
        )
        latest_key_audit_event = AppRepository._pick_latest_key_execution_event(recent_audit_events)
        latest_active_order_record = max(
            active_orders,
            key=lambda item: parse_optional_iso_datetime(item.created_at),
            default=None,
        )
        latest_historical_order_record = max(
            recent_orders,
            key=lambda item: parse_optional_iso_datetime(item.created_at),
            default=None,
        )
        latest_trade_record = max(
            recent_trades,
            key=lambda item: parse_optional_iso_datetime(item.created_at),
            default=None,
        )
        latest_alert_record = max(
            recent_alerts,
            key=lambda item: parse_optional_iso_datetime(item.triggered_at),
            default=None,
        )
        latest_pending_alert_record = max(
            [item for item in recent_alerts if not item.acknowledged],
            key=lambda item: parse_optional_iso_datetime(item.triggered_at),
            default=None,
        )
        latest_order_record = max(
            [item for item in [latest_active_order_record, latest_historical_order_record] if item is not None],
            key=lambda item: parse_optional_iso_datetime(item.created_at),
            default=None,
        )
        latest_ops = {
            "latest_active_order": summarize_order(latest_active_order_record) if latest_active_order_record else None,
            "latest_historical_order": (
                summarize_order(latest_historical_order_record) if latest_historical_order_record else None
            ),
            "latest_order": summarize_order(latest_order_record) if latest_order_record else None,
            "latest_pending_alert": summarize_alert(latest_pending_alert_record) if latest_pending_alert_record else None,
            "latest_trade": summarize_trade(latest_trade_record) if latest_trade_record else None,
            "latest_alert": summarize_alert(latest_alert_record) if latest_alert_record else None,
            "latest_audit_event": summarize_event(latest_key_audit_event) if latest_key_audit_event else None,
            "latest_active_order_record": latest_active_order_record.model_dump(mode="json")
            if latest_active_order_record
            else None,
            "latest_historical_order_record": latest_historical_order_record.model_dump(mode="json")
            if latest_historical_order_record
            else None,
            "latest_order_record": latest_order_record.model_dump(mode="json") if latest_order_record else None,
            "latest_pending_alert_record": latest_pending_alert_record.model_dump(mode="json")
            if latest_pending_alert_record
            else None,
            "latest_trade_record": latest_trade_record.model_dump(mode="json") if latest_trade_record else None,
            "latest_alert_record": latest_alert_record.model_dump(mode="json") if latest_alert_record else None,
            "latest_audit_event_record": latest_key_audit_event.model_dump(mode="json")
            if latest_key_audit_event
            else None,
        }

        runtime = (
            {
                "signal": snapshot.signal,
                "guard_state": snapshot.guard_state,
                "guard_detail": snapshot.guard_detail,
                "note": snapshot.note,
                "next_action": snapshot.next_action,
                "position_alignment": snapshot.position_alignment,
                "position_alignment_detail": snapshot.position_alignment_detail,
                "last_execution_event_type": snapshot.last_execution_event_type,
                "execution_preview": self._summarize_review_execution_preview(snapshot.execution_preview),
            }
            if snapshot is not None
            else None
        )
        latest_runtime = {"runtime": runtime, "latest_ops": latest_ops}

        context = {
            "strategy_id": strategy.id,
            "strategy_name": strategy.name,
            "symbol": symbol,
            "mode": strategy.mode.value,
            "generated_at": now_iso(),
            "runtime": runtime,
            "latest_runtime": latest_runtime,
            "latest_ops": latest_ops,
            "active_order_count": len(active_orders),
            "active_orders": [summarize_order(order) for order in active_orders[:3]],
            "latest_active_order": latest_ops["latest_active_order"],
            "latest_active_order_record": latest_ops["latest_active_order_record"],
            "latest_historical_order": latest_ops["latest_historical_order"],
            "latest_historical_order_record": latest_ops["latest_historical_order_record"],
            "latest_order": latest_ops["latest_order"],
            "latest_order_record": latest_ops["latest_order_record"],
            "recent_orders": [summarize_order(order) for order in recent_orders[:3]],
            "latest_trade": latest_ops["latest_trade"],
            "latest_trade_record": latest_ops["latest_trade_record"],
            "recent_trades": [summarize_trade(trade) for trade in recent_trades[:3]],
            "latest_pending_alert": latest_ops["latest_pending_alert"],
            "latest_pending_alert_record": latest_ops["latest_pending_alert_record"],
            "latest_alert": latest_ops["latest_alert"],
            "latest_alert_record": latest_ops["latest_alert_record"],
            "recent_alerts": [summarize_alert(alert) for alert in recent_alerts[:3]],
            "latest_proposal": summarize_proposal(latest_proposal) if latest_proposal else None,
            "latest_actionable_proposal": (
                summarize_proposal(latest_actionable_proposal) if latest_actionable_proposal else None
            ),
            "latest_proposal_change_request": (
                summarize_change_request(latest_proposal_change_request)
                if latest_proposal_change_request
                else None
            ),
            "latest_proposal_backtest": (
                summarize_backtest(latest_proposal_backtest) if latest_proposal_backtest else None
            ),
            "latest_proposal_backtest_record": (
                latest_proposal_backtest.model_dump(mode="json") if latest_proposal_backtest else None
            ),
            "latest_proposal_review": (
                summarize_review(latest_proposal_review) if latest_proposal_review else None
            ),
            "latest_proposal_review_record": (
                latest_proposal_review.model_dump(mode="json") if latest_proposal_review else None
            ),
            "latest_proposal_job": (
                summarize_agent_job(latest_proposal_job) if latest_proposal_job else None
            ),
            "latest_proposal_job_record": (
                latest_proposal_job.model_dump(mode="json") if latest_proposal_job else None
            ),
            "latest_actionable_proposal_change_request": (
                summarize_change_request(latest_actionable_proposal_change_request)
                if latest_actionable_proposal_change_request
                else None
            ),
            "latest_actionable_proposal_backtest": (
                summarize_backtest(latest_actionable_proposal_backtest)
                if latest_actionable_proposal_backtest
                else None
            ),
            "latest_actionable_proposal_backtest_record": (
                latest_actionable_proposal_backtest.model_dump(mode="json")
                if latest_actionable_proposal_backtest
                else None
            ),
            "latest_actionable_proposal_review": (
                summarize_review(latest_actionable_proposal_review)
                if latest_actionable_proposal_review
                else None
            ),
            "latest_actionable_proposal_review_record": (
                latest_actionable_proposal_review.model_dump(mode="json")
                if latest_actionable_proposal_review
                else None
            ),
            "latest_actionable_proposal_job": (
                summarize_agent_job(latest_actionable_proposal_job)
                if latest_actionable_proposal_job
                else None
            ),
            "latest_actionable_proposal_job_record": (
                latest_actionable_proposal_job.model_dump(mode="json")
                if latest_actionable_proposal_job
                else None
            ),
            "recent_proposals": [summarize_proposal(proposal) for proposal in recent_proposals[:3]],
            "latest_change_request": summarize_change_request(latest_change_request) if latest_change_request else None,
            "latest_actionable_change_request": (
                summarize_change_request(latest_actionable_change_request)
                if latest_actionable_change_request
                else None
            ),
            "latest_change_request_backtest_record": (
                latest_change_request_backtest_record.model_dump(mode="json")
                if latest_change_request_backtest_record
                else None
            ),
            "latest_change_request_review_record": (
                latest_change_request_review_record.model_dump(mode="json")
                if latest_change_request_review_record
                else None
            ),
            "latest_change_request_job_record": (
                latest_change_request_job_record.model_dump(mode="json")
                if latest_change_request_job_record
                else None
            ),
            "latest_change_request_source_backtest_record": (
                latest_change_request_source_backtest_record.model_dump(mode="json")
                if latest_change_request_source_backtest_record
                else None
            ),
            "latest_change_request_source_review_record": (
                latest_change_request_source_review_record.model_dump(mode="json")
                if latest_change_request_source_review_record
                else None
            ),
            "latest_change_request_source_proposal_record": (
                latest_change_request_source_proposal_record.model_dump(mode="json")
                if latest_change_request_source_proposal_record
                else None
            ),
            "latest_actionable_change_request_backtest_record": (
                latest_actionable_change_request_backtest_record.model_dump(mode="json")
                if latest_actionable_change_request_backtest_record
                else None
            ),
            "latest_actionable_change_request_review_record": (
                latest_actionable_change_request_review_record.model_dump(mode="json")
                if latest_actionable_change_request_review_record
                else None
            ),
            "latest_actionable_change_request_job_record": (
                latest_actionable_change_request_job_record.model_dump(mode="json")
                if latest_actionable_change_request_job_record
                else None
            ),
            "latest_actionable_change_request_source_backtest_record": (
                latest_actionable_change_request_source_backtest_record.model_dump(mode="json")
                if latest_actionable_change_request_source_backtest_record
                else None
            ),
            "latest_actionable_change_request_source_review_record": (
                latest_actionable_change_request_source_review_record.model_dump(mode="json")
                if latest_actionable_change_request_source_review_record
                else None
            ),
            "latest_actionable_change_request_source_proposal_record": (
                latest_actionable_change_request_source_proposal_record.model_dump(mode="json")
                if latest_actionable_change_request_source_proposal_record
                else None
            ),
            "recent_change_requests": [
                summarize_change_request(change_request)
                for change_request in recent_change_requests[:3]
            ],
            "latest_backtest": summarize_backtest(latest_backtest) if latest_backtest else None,
            "latest_actionable_backtest": (
                summarize_backtest(latest_actionable_backtest) if latest_actionable_backtest else None
            ),
            "latest_backtest_record": (
                latest_backtest_record.model_dump(mode="json") if latest_backtest_record else None
            ),
            "latest_actionable_backtest_record": (
                latest_actionable_backtest_record.model_dump(mode="json")
                if latest_actionable_backtest_record
                else None
            ),
            "latest_actionable_backtest_review": (
                summarize_review(latest_actionable_backtest_review)
                if latest_actionable_backtest_review
                else None
            ),
            "latest_backtest_review_record": (
                latest_backtest_review.model_dump(mode="json") if latest_backtest_review else None
            ),
            "latest_backtest_job_record": (
                latest_backtest_job.model_dump(mode="json") if latest_backtest_job else None
            ),
            "latest_actionable_backtest_review_record": (
                latest_actionable_backtest_review.model_dump(mode="json")
                if latest_actionable_backtest_review
                else None
            ),
            "latest_actionable_backtest_job_record": (
                latest_actionable_backtest_job.model_dump(mode="json")
                if latest_actionable_backtest_job
                else None
            ),
            "latest_actionable_backtest_job": (
                summarize_agent_job(latest_actionable_backtest_job)
                if latest_actionable_backtest_job
                else None
            ),
            "latest_backtest_review": summarize_review(latest_backtest_review) if latest_backtest_review else None,
            "latest_backtest_job": summarize_agent_job(latest_backtest_job) if latest_backtest_job else None,
            "recent_backtests": [summarize_backtest(backtest) for backtest in recent_backtests[:3]],
            "latest_primary_review": summarize_review(latest_primary_review) if latest_primary_review else None,
            "latest_actionable_primary_review": (
                summarize_review(latest_actionable_primary_review) if latest_actionable_primary_review else None
            ),
            "latest_primary_review_record": (
                latest_primary_review.model_dump(mode="json") if latest_primary_review else None
            ),
            "latest_actionable_primary_review_record": (
                latest_actionable_primary_review.model_dump(mode="json")
                if latest_actionable_primary_review
                else None
            ),
            "latest_tracking_review": summarize_review(latest_tracking_review) if latest_tracking_review else None,
            "latest_tracking_job": summarize_agent_job(latest_tracking_job) if latest_tracking_job else None,
            "latest_tracking_review_record": (
                latest_tracking_review.model_dump(mode="json") if latest_tracking_review else None
            ),
            "latest_tracking_job_record": (
                latest_tracking_job.model_dump(mode="json") if latest_tracking_job else None
            ),
            "latest_retryable_tracking_job": (
                summarize_agent_job(latest_retryable_tracking_job) if latest_retryable_tracking_job else None
            ),
            "latest_retryable_tracking_job_record": (
                latest_retryable_tracking_job.model_dump(mode="json")
                if latest_retryable_tracking_job
                else None
            ),
            "latest_audit_event": latest_ops["latest_audit_event"],
            "latest_audit_event_record": latest_ops["latest_audit_event_record"],
            "recent_reviews": [summarize_review(review) for review in recent_reviews[:3]],
            "recent_agent_jobs": [summarize_agent_job(job) for job in recent_agent_jobs[:4]],
            "recent_audit_events": [summarize_event(event) for event in recent_audit_events[:4]],
        }
        return _compact_review_strategy_activity_context(context)

    def _refresh_agent_job_review_strategy_activity_locked(
        self,
        job: AgentJob,
        proposal_status_overrides: Optional[Dict[str, str]] = None,
        change_request_follow_up_overrides: Optional[Dict[str, Dict[str, Any]]] = None,
    ) -> None:
        strategy_id = str(job.context.get("strategy_id") or "").strip()
        if not strategy_id:
            return
        job.context["review_strategy_activity"] = self._build_review_strategy_activity_context_locked(
            strategy_id,
            proposal_status_overrides=proposal_status_overrides,
            change_request_follow_up_overrides=change_request_follow_up_overrides,
        )

    def _resolve_mark_price_locked(self, symbol: str, fallback_price: float) -> float:
        watch_item = next((item for item in self.state.watchlist if item.symbol == symbol), None)
        if watch_item is not None and watch_item.last_price > 0:
            return watch_item.last_price
        detail = self.state.market_details.get(symbol)
        if detail is not None and detail.candles:
            latest_close = float(detail.candles[-1].close)
            if latest_close > 0:
                return latest_close
        return max(fallback_price, 0.0)

    def _paper_reserved_cash_locked(self, exclude_order_id: Optional[str] = None) -> float:
        reserved = 0.0
        for order in self.state.paper_orders:
            if exclude_order_id and order.order_id == exclude_order_id:
                continue
            if order.side != Direction.BUY:
                continue
            reserved += self._parse_metric_number(order.qty) * self._parse_metric_number(order.price)
        return reserved

    def _paper_reserved_sell_quantity_locked(self, symbol: str, exclude_order_id: Optional[str] = None) -> float:
        reserved = 0.0
        for order in self.state.paper_orders:
            if exclude_order_id and order.order_id == exclude_order_id:
                continue
            if order.symbol != symbol or order.side != Direction.SELL or order.market != "spot":
                continue
            reserved += self._parse_metric_number(order.qty)
        return reserved

    def _append_paper_order_history_locked(self, order: OrderRecord, status: str) -> None:
        history_order = order.model_copy(update={"status": status})
        self.state.paper_order_history.insert(0, history_order)
        self.state.paper_order_history = self.state.paper_order_history[:120]

    def _is_paper_order_marketable_locked(self, order: OrderRecord) -> bool:
        order_price = self._parse_metric_number(order.price)
        reference_price = self._resolve_mark_price_locked(order.symbol, order_price)
        if order.side == Direction.BUY:
            return reference_price <= order_price + 1e-9
        return reference_price >= order_price - 1e-9

    def _settle_open_paper_orders_locked(self) -> bool:
        if not self.state.paper_orders:
            return False

        changed = False
        remaining_orders: list[OrderRecord] = []
        for order in sorted(self.state.paper_orders, key=lambda item: self._parse_trade_time(item.created_at)):
            if not self._is_paper_order_marketable_locked(order):
                remaining_orders.append(order)
                continue

            trade = TradeRecord(
                id=f"trade-{uuid4().hex[:6]}",
                symbol=order.symbol,
                market=order.market,
                mode=AccountMode.PAPER,
                origin="manual",
                side=order.side,
                quantity=self._parse_metric_number(order.qty),
                price=self._parse_metric_number(order.price),
                pnl="--",
                strategy_id=None,
                created_at=now_iso(),
                status="filled",
            )
            self.state.trades.insert(0, trade)
            self._append_paper_order_history_locked(order, "Filled")
            self.add_event(
                event_type="paper_order.filled",
                source="quant-core",
                severity=EventSeverity.INFO,
                payload={
                    "order_id": order.order_id,
                    "symbol": order.symbol,
                    "market": order.market,
                    "side": order.side.value,
                    "qty": order.qty,
                    "price": order.price,
                    "trade_id": trade.id,
                },
                symbol=order.symbol,
            )
            changed = True

        if changed:
            self.state.paper_orders = remaining_orders
        return changed

    @staticmethod
    def _classify_position_side(quantity: float) -> str:
        if quantity > 1e-9:
            return "long"
        if quantity < -1e-9:
            return "short"
        return "flat"

    def _describe_execution_action_locked(
        self,
        market: str,
        side: Direction,
        current_qty: float,
        next_qty: float,
    ) -> str:
        if side == Direction.BUY:
            if current_qty > 1e-9:
                return "加多"
            if current_qty < -1e-9:
                if next_qty < -1e-9:
                    return "减空"
                if abs(next_qty) <= 1e-9:
                    return "平空"
                return "反手开多"
            return "开多"

        if current_qty < -1e-9:
            return "加空"
        if current_qty > 1e-9:
            if next_qty > 1e-9:
                return "减多"
            if abs(next_qty) <= 1e-9:
                return "平多"
            return "反手开空"
        return "开空" if market == "perp" else "卖出"

    def _build_execution_preview_locked(self, payload: ExecutionPreviewRequest) -> ExecutionPreview:
        notional = payload.quantity * payload.price
        base_preview = {
            "symbol": payload.symbol.upper(),
            "market": payload.market,
            "mode": payload.mode,
            "side": payload.side,
            "origin": payload.origin,
            "strategy_id": payload.strategy_id,
            "quantity": payload.quantity,
            "price": payload.price,
            "notional": self._format_usdt(notional),
            "generated_at": now_iso(),
        }

        if payload.mode != AccountMode.PAPER:
            return ExecutionPreview(
                **base_preview,
                action="等待真实执行引擎",
                allowed=False,
                blocked_reason="当前统一执行预检仅开放 Paper 模式；Demo / Live 待真实执行引擎接通后再开放。",
                warnings=["当前结果仅适用于 Paper 执行链路。"],
                current_position_size="--",
                current_avg_price="--",
                projected_position_size="--",
                projected_avg_price="--",
                available_balance_before="--",
                available_balance_after="--",
                estimated_realized_pnl="--",
            )

        ledger_snapshot = self._build_paper_ledger_locked()
        cash_balance = float(ledger_snapshot["cash_balance"])
        available_cash = max(cash_balance - self._paper_reserved_cash_locked(payload.exclude_order_id), 0.0)
        positions = dict(ledger_snapshot["positions"])
        position = positions.get(payload.symbol.upper(), {"qty": 0.0, "avg_price": 0.0})
        current_qty = float(position.get("qty") or 0.0)
        current_avg = float(position.get("avg_price") or 0.0)
        signed_qty = payload.quantity if payload.side == Direction.BUY else -payload.quantity
        next_qty = current_qty + signed_qty
        close_qty = 0.0
        realized_on_fill = 0.0

        if current_qty != 0 and current_qty * signed_qty < 0:
            close_qty = min(abs(current_qty), abs(signed_qty))
            realized_on_fill = close_qty * (payload.price - current_avg) * (1 if current_qty > 0 else -1)

        if current_qty == 0 or current_qty * signed_qty > 0:
            total_size = abs(current_qty) + abs(signed_qty)
            projected_avg = (
                ((abs(current_qty) * current_avg) + (abs(signed_qty) * payload.price)) / total_size
                if total_size > 0
                else 0.0
            )
        elif abs(next_qty) <= 1e-9:
            projected_avg = 0.0
        elif current_qty * next_qty > 0:
            projected_avg = current_avg
        else:
            projected_avg = payload.price

        available_after = available_cash - (signed_qty * payload.price)
        blocked_reason = self._evaluate_paper_order_risk_locked(
            payload.symbol,
            payload.market,
            payload.side,
            payload.quantity,
            payload.price,
            exclude_order_id=payload.exclude_order_id,
        )
        warnings: list[str] = []
        if close_qty > 0:
            warnings.append("本次成交会先结算一部分已实现盈亏。")
        if current_qty != 0 and current_qty * next_qty < 0:
            warnings.append("本次成交会反手切换持仓方向。")

        return ExecutionPreview(
            **base_preview,
            action=self._describe_execution_action_locked(payload.market, payload.side, current_qty, next_qty),
            allowed=blocked_reason is None,
            blocked_reason=blocked_reason,
            warnings=warnings,
            current_position_side=self._classify_position_side(current_qty),
            current_position_size=self._format_quantity(abs(current_qty), 6),
            current_avg_price=self._format_ratio(current_avg) if abs(current_qty) > 1e-9 else "--",
            projected_position_side=self._classify_position_side(next_qty),
            projected_position_size=self._format_quantity(abs(next_qty), 6),
            projected_avg_price=self._format_ratio(projected_avg) if abs(next_qty) > 1e-9 else "--",
            available_balance_before=self._format_usdt(available_cash),
            available_balance_after=self._format_usdt(available_after),
            estimated_realized_pnl=self._format_usdt_delta(realized_on_fill) if close_qty > 0 else "--",
        )

    def _build_paper_ledger_locked(self) -> dict[str, Any]:
        cash_balance = self.PAPER_STARTING_CASH
        positions: dict[str, dict[str, Any]] = {}
        realized_pnl = 0.0
        closed_trades = 0
        winning_trades = 0
        strategy_realized: dict[str, float] = {}
        trade_pnl_map: dict[str, str] = {}
        paper_trades = sorted(
            (
                trade
                for trade in self.state.trades
                if trade.mode == AccountMode.PAPER and trade.status in {"filled", "partially_filled"}
            ),
            key=lambda item: self._parse_trade_time(item.created_at),
        )

        for trade in paper_trades:
            signed_qty = trade.quantity if trade.side == Direction.BUY else -trade.quantity
            if signed_qty == 0 or trade.price <= 0:
                continue

            cash_balance -= signed_qty * trade.price
            position = positions.setdefault(
                trade.symbol,
                {
                    "symbol": trade.symbol,
                    "market": trade.market,
                    "qty": 0.0,
                    "avg_price": 0.0,
                    "last_trade_at": trade.created_at,
                },
            )
            current_qty = float(position["qty"])
            current_avg = float(position["avg_price"])
            realized_on_trade = 0.0
            close_qty = 0.0

            if current_qty == 0 or current_qty * signed_qty > 0:
                total_size = abs(current_qty) + abs(signed_qty)
                next_avg = (
                    ((abs(current_qty) * current_avg) + (abs(signed_qty) * trade.price)) / total_size
                    if total_size > 0
                    else 0.0
                )
                position["qty"] = current_qty + signed_qty
                position["avg_price"] = next_avg
            else:
                close_qty = min(abs(current_qty), abs(signed_qty))
                realized_on_trade = close_qty * (trade.price - current_avg) * (1 if current_qty > 0 else -1)
                realized_pnl += realized_on_trade
                closed_trades += 1
                if realized_on_trade > 0:
                    winning_trades += 1
                if trade.strategy_id:
                    strategy_realized[trade.strategy_id] = strategy_realized.get(trade.strategy_id, 0.0) + realized_on_trade
                next_qty = current_qty + signed_qty
                if next_qty == 0:
                    position["qty"] = 0.0
                    position["avg_price"] = 0.0
                elif current_qty * next_qty > 0:
                    position["qty"] = next_qty
                    position["avg_price"] = current_avg
                else:
                    position["qty"] = next_qty
                    position["avg_price"] = trade.price

            position["market"] = trade.market
            position["last_trade_at"] = trade.created_at
            trade_pnl_map[trade.id] = self._format_usdt_delta(realized_on_trade) if close_qty > 0 else "--"

        return {
            "cash_balance": cash_balance,
            "positions": positions,
            "realized_pnl": realized_pnl,
            "closed_trades": closed_trades,
            "winning_trades": winning_trades,
            "strategy_realized": strategy_realized,
            "trade_pnl_map": trade_pnl_map,
        }

    def _build_paper_strategy_ledger_locked(self, strategy_id: str) -> dict[str, Any]:
        positions: dict[str, dict[str, Any]] = {}
        strategy_trades = sorted(
            (
                trade
                for trade in self.state.trades
                if trade.mode == AccountMode.PAPER
                and trade.origin == "strategy"
                and trade.strategy_id == strategy_id
                and trade.status in {"filled", "partially_filled"}
            ),
            key=lambda item: self._parse_trade_time(item.created_at),
        )

        for trade in strategy_trades:
            signed_qty = trade.quantity if trade.side == Direction.BUY else -trade.quantity
            if signed_qty == 0 or trade.price <= 0:
                continue

            position = positions.setdefault(
                trade.symbol,
                {
                    "symbol": trade.symbol,
                    "market": trade.market,
                    "qty": 0.0,
                    "avg_price": 0.0,
                    "last_trade_at": trade.created_at,
                },
            )
            current_qty = float(position["qty"])
            current_avg = float(position["avg_price"])

            if current_qty == 0 or current_qty * signed_qty > 0:
                total_size = abs(current_qty) + abs(signed_qty)
                next_avg = (
                    ((abs(current_qty) * current_avg) + (abs(signed_qty) * trade.price)) / total_size
                    if total_size > 0
                    else 0.0
                )
                position["qty"] = current_qty + signed_qty
                position["avg_price"] = next_avg
            else:
                next_qty = current_qty + signed_qty
                if abs(next_qty) <= 1e-9:
                    position["qty"] = 0.0
                    position["avg_price"] = 0.0
                elif current_qty * next_qty > 0:
                    position["qty"] = next_qty
                    position["avg_price"] = current_avg
                else:
                    position["qty"] = next_qty
                    position["avg_price"] = trade.price

            position["market"] = trade.market
            position["last_trade_at"] = trade.created_at

        return {"positions": positions}

    def _evaluate_paper_order_risk_locked(
        self,
        symbol: str,
        market: str,
        side: Direction,
        quantity: float,
        price: float,
        exclude_order_id: Optional[str] = None,
    ) -> Optional[str]:
        if quantity <= 0 or price <= 0:
            return "数量和价格必须大于 0。"

        ledger_snapshot = self._build_paper_ledger_locked()
        cash_balance = float(ledger_snapshot["cash_balance"])
        available_cash = cash_balance - self._paper_reserved_cash_locked(exclude_order_id)
        ledger = dict(ledger_snapshot["positions"])
        notional = quantity * price
        symbol_state = ledger.get(symbol, {"qty": 0.0})
        current_qty = float(symbol_state.get("qty") or 0.0)
        reserved_spot_sell_qty = self._paper_reserved_sell_quantity_locked(symbol, exclude_order_id)

        if side == Direction.BUY and notional > available_cash + 1e-9:
            return f"Paper 可用余额不足，当前仅剩 {self._format_usdt(available_cash)}。"

        if market == "spot" and side == Direction.SELL and current_qty - reserved_spot_sell_qty + 1e-9 < quantity:
            return (
                f"{symbol} 当前 Paper 现货可卖数量不足，"
                f"最多可卖 {self._format_quantity(max(current_qty - reserved_spot_sell_qty, 0.0), 6)}。"
            )

        return None

    def _build_paper_positions_locked(self) -> list[PositionRecord]:
        ledger_snapshot = self._build_paper_ledger_locked()
        ledger = dict(ledger_snapshot["positions"])
        timestamp = now_iso()
        records: list[PositionRecord] = []
        for item in ledger.values():
            qty = float(item["qty"])
            if abs(qty) < 1e-9:
                continue
            avg_price = float(item["avg_price"])
            mark_price = self._resolve_mark_price_locked(str(item["symbol"]), avg_price)
            value = abs(qty) * mark_price
            unrealized_pnl = abs(qty) * (mark_price - avg_price) * (1 if qty > 0 else -1)
            records.append(
                PositionRecord(
                    source="paper",
                    symbol=str(item["symbol"]),
                    market=str(item["market"]),
                    side="long" if qty > 0 else "short",
                    size=self._format_quantity(abs(qty), 6),
                    avg_price=self._format_ratio(avg_price),
                    mark_price=self._format_ratio(mark_price),
                    value=self._format_usdt(value),
                    leverage="1.0x" if str(item["market"]) == "spot" else "2.0x",
                    unrealised_pnl=self._format_usdt(unrealized_pnl),
                    updated_at=timestamp,
                )
            )
        records.sort(key=lambda entry: self._parse_metric_number(entry.value), reverse=True)
        return records

    def _build_paper_account_overview_locked(self) -> AccountOverview:
        ledger_snapshot = self._build_paper_ledger_locked()
        cash_balance = float(ledger_snapshot["cash_balance"])
        reserved_cash = self._paper_reserved_cash_locked()
        available_cash = max(cash_balance - reserved_cash, 0.0)
        ledger = dict(ledger_snapshot["positions"])
        positions = self._build_paper_positions_locked()
        unrealized_pnl = 0.0
        total_position_value = 0.0
        for item in ledger.values():
            qty = float(item["qty"])
            if abs(qty) < 1e-9:
                continue
            avg_price = float(item["avg_price"])
            mark_price = self._resolve_mark_price_locked(str(item["symbol"]), avg_price)
            total_position_value += abs(qty) * mark_price
            unrealized_pnl += abs(qty) * (mark_price - avg_price) * (1 if qty > 0 else -1)

        total_equity = cash_balance + total_position_value
        assets = [
            AccountAsset(
                coin="USDT",
                wallet_balance=self._format_ratio(cash_balance),
                usd_value=self._format_usdt(cash_balance),
                available_balance=self._format_ratio(available_cash),
            )
        ]
        for item in sorted(ledger.values(), key=lambda entry: abs(float(entry["qty"])) * self._resolve_mark_price_locked(str(entry["symbol"]), float(entry["avg_price"])), reverse=True):
            qty = float(item["qty"])
            if abs(qty) < 1e-9:
                continue
            coin = self._symbol_coin(str(item["symbol"]))
            mark_price = self._resolve_mark_price_locked(str(item["symbol"]), float(item["avg_price"]))
            available_qty = qty
            if str(item["market"]) == "spot" and qty > 0:
                available_qty = max(qty - self._paper_reserved_sell_quantity_locked(str(item["symbol"])), 0.0)
            assets.append(
                AccountAsset(
                    coin=coin,
                    wallet_balance=self._format_quantity(qty, 6),
                    usd_value=self._format_usdt(abs(qty) * mark_price),
                    available_balance=self._format_quantity(available_qty, 6),
                )
            )

        return AccountOverview(
            source="paper",
            mode=AccountMode.PAPER,
            account_type="PAPER",
            total_equity=self._format_usdt(total_equity),
            total_wallet_balance=self._format_usdt(cash_balance),
            total_available_balance=self._format_usdt(available_cash),
            unrealised_pnl=self._format_usdt(unrealized_pnl),
            positions_count=len(positions),
            open_orders_count=len(self.state.paper_orders),
            top_holdings=assets[:6],
            updated_at=now_iso(),
        )

    def _refresh_paper_state_locked(self) -> None:
        side_by_symbol = {item.symbol: "flat" for item in self.state.watchlist}
        paper_positions = self._build_paper_positions_locked()
        for position in paper_positions:
            side_by_symbol[position.symbol] = position.side
        for item in self.state.watchlist:
            item.position_side = side_by_symbol.get(item.symbol, "flat")

        current_mode = self.state.workspace_preferences.selected_mode
        self.state.control_snapshot.scheduler.current_mode = current_mode
        ledger_snapshot = self._build_paper_ledger_locked()
        trade_pnl_map = dict(ledger_snapshot["trade_pnl_map"])
        for trade in self.state.trades:
            if trade.mode != AccountMode.PAPER:
                continue
            next_pnl = trade_pnl_map.get(trade.id, "--")
            if trade.pnl != next_pnl:
                trade.pnl = next_pnl

        if current_mode != AccountMode.PAPER:
            return

        overview = self._build_paper_account_overview_locked()
        total_equity = max(self._parse_metric_number(overview.total_equity), 0.01)
        total_available = self._parse_metric_number(overview.total_available_balance)
        total_position_value = sum(self._parse_metric_number(position.value) for position in paper_positions)
        exposure_pct = (total_position_value / total_equity) * 100 if total_equity > 0 else 0.0
        unrealized = self._parse_metric_number(overview.unrealised_pnl)
        realized = float(ledger_snapshot["realized_pnl"])
        closed_trades = int(ledger_snapshot["closed_trades"])
        winning_trades = int(ledger_snapshot["winning_trades"])
        strategy_realized = dict(ledger_snapshot["strategy_realized"])
        total_delta = f"{unrealized:+,.2f} USDT"
        available_delta = f"{overview.positions_count} 持仓"

        self.state.control_snapshot.account_metrics = [
            self.state.control_snapshot.account_metrics[0].model_copy(
                update={
                    "value": overview.total_equity,
                    "delta": total_delta,
                    "tone": "positive" if unrealized >= 0 else "warning",
                }
            ),
            self.state.control_snapshot.account_metrics[1].model_copy(
                update={
                    "value": overview.total_available_balance,
                    "delta": available_delta,
                    "tone": "positive" if total_available >= 0 else "critical",
                }
            ),
            self.state.control_snapshot.account_metrics[2].model_copy(
                update={
                    "value": f"{exposure_pct:.1f}%",
                    "delta": f"{len(paper_positions)} 个方向",
                    "tone": "warning" if exposure_pct >= 65 else "neutral",
                }
            ),
        ]
        best_strategy_name = "暂无已平仓策略"
        if strategy_realized:
            best_strategy_id = max(strategy_realized, key=strategy_realized.get)
            try:
                best_strategy_name = self._find_strategy(best_strategy_id).name
            except KeyError:
                best_strategy_name = best_strategy_id
        self.state.control_snapshot.today_performance["realized_pnl"] = self._format_usdt_delta(realized)
        self.state.control_snapshot.today_performance["unrealized_pnl"] = overview.unrealised_pnl
        self.state.control_snapshot.today_performance["win_rate"] = (
            f"{(winning_trades / closed_trades) * 100:.1f}%" if closed_trades > 0 else "--"
        )
        self.state.control_snapshot.today_performance["best_strategy"] = best_strategy_name

    def _recompute_scheduler_queue_depth(self) -> None:
        self.state.control_snapshot.scheduler.queue_depth = sum(
            1 for job in self.state.agent_jobs if job.status in {JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING}
        )

    def _find_watchlist_item(self, symbol: str) -> WatchlistInstrument:
        item = next((entry for entry in self.state.watchlist if entry.symbol == symbol.upper()), None)
        if item is None:
            raise KeyError(symbol.upper())
        return item

    def _find_alert_rule_locked(self, symbol: str) -> Optional[AlertRule]:
        uppercase_symbol = symbol.upper()
        return next((rule for rule in self.state.alert_rules if rule.symbol == uppercase_symbol), None)

    def _ensure_market_alert_rule_locked(self, item: WatchlistInstrument) -> AlertRule:
        existing = self._find_alert_rule_locked(item.symbol)
        timestamp = now_iso()
        if existing is not None:
            existing.market = item.market
            existing.threshold_pct = max(float(item.alert_threshold_pct or existing.threshold_pct), 0.1)
            existing.enabled = bool(item.alert_enabled)
            existing.rule_key = f"watchlist-volatility:{item.symbol}"
            existing.updated_at = timestamp
            return existing

        rule = AlertRule(
            id=f"rule-watchlist-{item.symbol.lower()}",
            symbol=item.symbol,
            market=item.market,
            threshold_pct=max(float(item.alert_threshold_pct or 2.5), 0.1),
            enabled=bool(item.alert_enabled),
            cooldown_minutes=30,
            created_at=timestamp,
            updated_at=timestamp,
            rule_key=f"watchlist-volatility:{item.symbol}",
        )
        self.state.alert_rules.insert(0, rule)
        return rule

    @staticmethod
    def _is_alert_rule_on_cooldown(rule: AlertRule) -> bool:
        if not rule.last_triggered_at:
            return False
        try:
            last_triggered_at = datetime.fromisoformat(rule.last_triggered_at)
        except ValueError:
            return False
        return (datetime.now(timezone.utc).astimezone() - last_triggered_at).total_seconds() < rule.cooldown_minutes * 60

    @staticmethod
    def _market_alert_rule_key(item: WatchlistInstrument) -> str:
        direction = "up" if item.change_24h >= 0 else "down"
        return f"watchlist-volatility:{item.symbol}:{direction}"

    @staticmethod
    def _market_alert_severity(item: WatchlistInstrument) -> str:
        magnitude = abs(item.change_24h)
        threshold = max(float(item.alert_threshold_pct or 0), 0.1)
        if item.risk_level == "high" or magnitude >= threshold * 2:
            return "P0"
        if item.signal == "active" or magnitude >= threshold * 1.35:
            return "P1"
        return "P2"

    @staticmethod
    def _market_alert_action(item: WatchlistInstrument) -> str:
        if item.signal == "active" or item.risk_level == "high":
            return "切到行情页复核盘口与最近成交，必要时进入人工接管。"
        return "打开提醒中心查看详情，并确认是否需要提高关注级别。"

    @staticmethod
    def _strategy_signal_alert_rule_prefix(strategy_id: str) -> str:
        return f"strategy-signal:{strategy_id}:"

    @classmethod
    def _strategy_signal_alert_rule_key(cls, strategy_id: str, runtime_status: str, signal: str) -> str:
        return f"{cls._strategy_signal_alert_rule_prefix(strategy_id)}{runtime_status}:{signal}"

    @staticmethod
    def _strategy_signal_label(signal: str) -> str:
        return {
            "long": "做多",
            "short": "做空",
            "flat": "平仓",
            "watch": "观察",
        }.get(signal, signal)

    def _retire_strategy_signal_alerts_locked(self, strategy_id: str, active_rule_key: str) -> bool:
        prefix = self._strategy_signal_alert_rule_prefix(strategy_id)
        changed = False
        for alert in self.state.alerts:
            if alert.source_type != "system" or alert.acknowledged:
                continue
            rule_key = getattr(alert, "rule_key", None) or ""
            if not rule_key.startswith(prefix) or rule_key == active_rule_key:
                continue
            alert.acknowledged = True
            changed = True
        return changed

    def _sync_strategy_signal_alert_locked(
        self,
        strategy,
        snapshot: StrategyRuntimeSnapshot,
        previous: Optional[StrategyRuntimeSnapshot],
    ) -> bool:
        if strategy.mode == AccountMode.PAPER or strategy.status == "paper_only":
            return False

        if previous is None:
            if snapshot.signal not in {"long", "short"} or snapshot.runtime_status not in {"running", "shadow"}:
                return False
        elif previous.signal == snapshot.signal and previous.runtime_status == snapshot.runtime_status:
            return False

        signal_label = self._strategy_signal_label(snapshot.signal)
        runtime_label = "影子模式" if snapshot.runtime_status == "shadow" else "运行中"
        severity = "P1" if snapshot.runtime_status == "running" and snapshot.signal in {"long", "short", "flat"} else "P2"
        if snapshot.signal == "watch":
            severity = "P2"
        title = f"{snapshot.symbol} 策略信号更新 · {signal_label}"
        description = (
            f"{snapshot.strategy_name} 当前切到 {signal_label}，运行状态 {runtime_label}，"
            f"置信度 {snapshot.confidence:.1f}%。{snapshot.note}"
        )
        if snapshot.signal == "flat":
            suggested_action = "切到策略页复核执行预检，确认是否需要平仓或撤单。"
        elif snapshot.signal in {"long", "short"}:
            suggested_action = "切到策略页查看执行预检；确认后可直接提交当前信号。"
        else:
            suggested_action = "当前信号已回到观察，继续盯住行情页与提醒中心即可。"

        rule_key = self._strategy_signal_alert_rule_key(strategy.id, snapshot.runtime_status, snapshot.signal)
        retired = self._retire_strategy_signal_alerts_locked(strategy.id, rule_key)
        created = self._upsert_system_alert_locked(
            rule_key=rule_key,
            severity=severity,
            symbol=snapshot.symbol,
            title=title,
            description=description,
            suggested_action=suggested_action,
            strategy_id=strategy.id,
        )
        return retired or created

    def _upsert_market_alert_locked(self, item: WatchlistInstrument) -> bool:
        rule = self._ensure_market_alert_rule_locked(item)
        if not item.alert_enabled or not rule.enabled:
            return False

        threshold = max(float(rule.threshold_pct or item.alert_threshold_pct or 0), 0.0)
        if threshold <= 0 or abs(item.change_24h) < threshold:
            return False

        rule_key = self._market_alert_rule_key(item)
        existing = next(
            (
                alert
                for alert in self.state.alerts
                if getattr(alert, "rule_key", None) == rule_key and not alert.acknowledged
            ),
            None,
        )
        severity = self._market_alert_severity(item)
        direction_label = "上涨" if item.change_24h >= 0 else "下跌"
        title = f"{item.symbol} {direction_label}触发提醒阈值"
        description = (
            f"24h 涨跌 {item.change_24h:+.2f}%，已超过你设置的提醒阈值 {threshold:.2f}%。"
        )
        suggested_action = self._market_alert_action(item)

        if existing is not None:
            changed = (
                existing.severity != severity
                or existing.title != title
                or existing.description != description
                or existing.suggested_action != suggested_action
                or existing.symbol != item.symbol
                or existing.source_type != "rule"
                or existing.rule_id != rule.id
                or existing.rule_key != rule_key
                or abs(float(existing.trigger_value or 0.0) - float(item.change_24h)) >= 0.1
                or abs(float(existing.threshold_value or 0.0) - float(threshold)) >= 1e-9
            )
            if not changed:
                return False
            refreshed_at = now_iso()
            existing.severity = severity
            existing.title = title
            existing.description = description
            existing.triggered_at = refreshed_at
            existing.suggested_action = suggested_action
            existing.symbol = item.symbol
            existing.source_type = "rule"
            existing.rule_id = rule.id
            existing.rule_key = rule_key
            existing.trigger_value = item.change_24h
            existing.threshold_value = threshold
            rule.last_triggered_at = refreshed_at
            rule.last_triggered_change_24h = item.change_24h
            rule.updated_at = refreshed_at
            return True

        if self._is_alert_rule_on_cooldown(rule):
            return False

        alert = AlertRecord(
            id=f"alert-{uuid4().hex[:6]}",
            severity=severity,
            symbol=item.symbol,
            title=title,
            description=description,
            triggered_at=now_iso(),
            suggested_action=suggested_action,
            acknowledged=False,
            source_type="rule",
            rule_id=rule.id,
            rule_key=rule_key,
            trigger_value=item.change_24h,
            threshold_value=threshold,
        )
        rule.last_triggered_at = alert.triggered_at
        rule.last_triggered_change_24h = item.change_24h
        rule.updated_at = alert.triggered_at
        self.state.alerts.insert(0, alert)
        self.add_event(
            event_type="alert.market_triggered",
            source="quant-core",
            severity=EventSeverity.WARNING if severity != "P0" else EventSeverity.CRITICAL,
            payload={
                "rule_id": rule.id,
                "rule_key": rule_key,
                "symbol": item.symbol,
                "change_24h": item.change_24h,
                "threshold_pct": threshold,
                "severity": severity,
                "cooldown_minutes": rule.cooldown_minutes,
            },
            symbol=item.symbol,
        )
        return True

    def sync_market_watchlist(
        self,
        watchlist: list[WatchlistInstrument],
        detail_overrides: Optional[Dict[str, MarketDetail]] = None,
    ) -> None:
        with self._lock:
            watchlist_map = {item.symbol: item for item in watchlist}
            alert_changed = False
            for index, existing in enumerate(self.state.watchlist):
                incoming = watchlist_map.get(existing.symbol)
                if incoming is None:
                    continue
                self.state.watchlist[index] = incoming
                if detail_overrides and incoming.symbol in detail_overrides:
                    self.state.market_details[incoming.symbol] = detail_overrides[incoming.symbol]
                alert_changed = self._upsert_market_alert_locked(incoming) or alert_changed
            self._refresh_derived_state()
            if alert_changed:
                self._persist()

    def sync_news_events(self, news_events: list[NewsEvent]) -> None:
        with self._lock:
            changed = False
            existing_index = {item.id: index for index, item in enumerate(self.state.news_events)}
            synced_events: list[NewsEvent] = []
            for item in sorted(news_events, key=lambda entry: entry.published_at, reverse=True):
                alert, alert_changed = self._upsert_news_alert_locked(item)
                changed = changed or alert_changed
                related_alert_ids = [alert.id] if alert is not None else list(item.related_alert_ids)
                synced_item = item.model_copy(update={"related_alert_ids": related_alert_ids})
                if item.id in existing_index:
                    current = self.state.news_events[existing_index[item.id]]
                    if current.model_dump(mode="json") != synced_item.model_dump(mode="json"):
                        changed = True
                else:
                    changed = True
                synced_events.append(synced_item)
            if synced_events:
                self.state.news_events = synced_events
            self._refresh_derived_state()
            if changed:
                self._persist()

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

    @staticmethod
    def _parse_percent_threshold(value: Any, default: float = 2.5) -> float:
        normalized = str(value if value is not None else default).replace("%", "").strip()
        try:
            parsed = float(normalized)
        except (TypeError, ValueError):
            return default
        return max(parsed, 0.1)

    @staticmethod
    def _coerce_bool(value: Any, default: bool = True) -> bool:
        if value is None:
            return default
        if isinstance(value, bool):
            return value
        if isinstance(value, (int, float)):
            return value != 0
        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    @staticmethod
    def _coerce_int(value: Any, default: int = 30) -> int:
        try:
            parsed = int(float(value))
        except (TypeError, ValueError):
            return default
        return max(parsed, 1)

    @staticmethod
    def _alert_rule_severity(change_24h: float, threshold_pct: float) -> str:
        ratio = abs(change_24h) / max(threshold_pct, 0.1)
        if ratio >= 1.75:
            return "P0"
        if ratio >= 1.25:
            return "P1"
        return "P2"

    @staticmethod
    def _alert_rule_action(change_24h: float, risk_level: str) -> str:
        if risk_level == "high" or abs(change_24h) >= 6:
            return "切到行情页确认盘口与最近成交，再决定是否人工接管。"
        if abs(change_24h) >= 3:
            return "关注后续成交与 K 线延续，必要时提高策略风控。"
        return "继续观察波动是否延续。"

    @staticmethod
    def _news_alert_rule_key(news_id: str) -> str:
        return f"news-event:{news_id}"

    @staticmethod
    def _news_alert_severity(impact_score: int) -> str:
        if impact_score >= 85:
            return "P0"
        if impact_score >= 75:
            return "P1"
        return "P2"

    @staticmethod
    def _news_alert_action(news: NewsEvent) -> str:
        if news.symbols:
            return "打开新闻事件页查看详情，并切到行情页复核相关品种。"
        return "打开新闻事件页查看详情，并评估是否需要人工关注。"

    def _upsert_system_alert_locked(
        self,
        *,
        rule_key: str,
        severity: str,
        symbol: str,
        title: str,
        description: str,
        suggested_action: str,
        strategy_id: Optional[str] = None,
    ) -> bool:
        existing = next(
            (
                alert
                for alert in self.state.alerts
                if getattr(alert, "rule_key", None) == rule_key and not alert.acknowledged
            ),
            None,
        )
        if existing is not None:
            changed = (
                existing.severity != severity
                or existing.symbol != symbol
                or existing.title != title
                or existing.description != description
                or existing.suggested_action != suggested_action
                or existing.source_type != "system"
            )
            existing.severity = severity
            existing.symbol = symbol
            existing.title = title
            existing.description = description
            existing.suggested_action = suggested_action
            existing.source_type = "system"
            existing.triggered_at = now_iso()
            return changed

        alert = AlertRecord(
            id=f"alert-system-{uuid4().hex[:6]}",
            severity=severity,
            symbol=symbol,
            title=title,
            description=description,
            triggered_at=now_iso(),
            suggested_action=suggested_action,
            acknowledged=False,
            source_type="system",
            rule_key=rule_key,
        )
        self.state.alerts.insert(0, alert)
        self.add_event(
            event_type="alert.system_triggered",
            source="quant-core",
            severity=EventSeverity.CRITICAL if severity == "P0" else EventSeverity.WARNING,
            payload={
                "rule_key": rule_key,
                "symbol": symbol,
                "title": title,
                "strategy_id": strategy_id,
            },
            symbol=symbol,
            strategy_id=strategy_id,
        )
        return True

    def _upsert_news_alert_locked(self, news: NewsEvent) -> tuple[Optional[AlertRecord], bool]:
        if news.impact_score < 75:
            return None, False
        watchlist_symbols = {item.symbol for item in self.state.watchlist}
        if news.symbols and not any(symbol in watchlist_symbols for symbol in news.symbols):
            return None, False

        primary_symbol = next((symbol for symbol in news.symbols if symbol in watchlist_symbols), news.symbols[0] if news.symbols else "全市场")
        rule_key = self._news_alert_rule_key(news.id)
        existing = next(
            (
                alert
                for alert in self.state.alerts
                if getattr(alert, "rule_key", None) == rule_key
                or alert.related_news_id == news.id
            ),
            None,
        )
        severity = self._news_alert_severity(news.impact_score)
        title = f"{primary_symbol} 新闻高影响提醒"
        description = news.title
        suggested_action = self._news_alert_action(news)
        if existing is not None:
            changed = (
                existing.severity != severity
                or existing.symbol != primary_symbol
                or existing.title != title
                or existing.description != description
                or existing.suggested_action != suggested_action
                or existing.source_type != "news"
                or existing.related_news_id != news.id
                or existing.rule_key != rule_key
            )
            existing.severity = severity
            existing.symbol = primary_symbol
            existing.title = title
            existing.description = description
            existing.suggested_action = suggested_action
            existing.source_type = "news"
            existing.related_news_id = news.id
            existing.rule_key = rule_key
            return existing, changed

        alert = AlertRecord(
            id=f"alert-news-{uuid4().hex[:6]}",
            severity=severity,
            symbol=primary_symbol,
            title=title,
            description=description,
            triggered_at=news.published_at,
            related_news_id=news.id,
            suggested_action=suggested_action,
            acknowledged=False,
            source_type="news",
            rule_key=rule_key,
        )
        self.state.alerts.insert(0, alert)
        self.add_event(
            event_type="alert.news_triggered",
            source="quant-core",
            severity=EventSeverity.WARNING if severity != "P0" else EventSeverity.CRITICAL,
            payload={
                "news_id": news.id,
                "rule_key": rule_key,
                "symbols": news.symbols,
                "impact_score": news.impact_score,
                "source": news.source,
            },
            symbol=primary_symbol if primary_symbol != "全市场" else None,
        )
        return alert, True

    def add_event(
        self,
        event_type: str,
        source: str,
        severity: EventSeverity,
        payload: Dict[str, Any],
        symbol: Optional[str] = None,
        strategy_id: Optional[str] = None,
    ) -> ExecutionEvent:
        event = self._decorate_execution_event(
            ExecutionEvent(
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
        )
        self.state.audit_events.insert(0, event)
        return event

    def _create_change_request_locked(self, payload: ChangeRequestCreate) -> ChangeRequest:
        timestamp = now_iso()
        record = ChangeRequest(
            id=f"cr-{uuid4().hex[:6]}",
            type=payload.type,
            payload=payload.payload,
            requested_by=payload.requested_by,
            source_backtest_id=payload.source_backtest_id,
            source_review_id=payload.source_review_id,
            source_proposal_id=payload.source_proposal_id,
            trigger_reason=payload.trigger_reason or "manual_create",
            manual_followup_required=payload.manual_followup_required,
            manual_followup_detail=payload.manual_followup_detail,
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
        return record

    def _sync_change_request_follow_up_locked(
        self,
        change_request_id: Optional[str],
        *,
        job: Optional[AgentJob] = None,
        backtest: Optional[BacktestRun] = None,
        review: Optional[ReviewDocument] = None,
        result_summary: Optional[str] = None,
    ) -> Optional[ChangeRequest]:
        change_request_key = str(change_request_id or "").strip()
        if not change_request_key:
            return None
        record = next((item for item in self.state.change_requests if item.id == change_request_key), None)
        if record is None:
            return None
        if job is not None and record.type == "backtest.launch" and job.job_type == "reconcile_change_request":
            if backtest is not None:
                record.linked_backtest_id = backtest.id
                record.linked_backtest_timeframe = backtest.timeframe
                record.linked_backtest_data_range = backtest.data_range
                record.linked_backtest_sample_quality = backtest.sample_quality
                record.linked_backtest_decision_readiness = backtest.decision_readiness
                record.linked_backtest_decision_readiness_detail = backtest.decision_readiness_detail
                record.linked_backtest_decision_recommended_data_range = backtest.decision_recommended_data_range
                record.linked_backtest_decision_recommended_timeframe = backtest.decision_recommended_timeframe
                record.linked_backtest_decision_readiness_action = backtest.decision_readiness_action
                record.linked_backtest_history_source = backtest.history_source
                record.linked_backtest_history_source_reason = backtest.history_source_reason
                record.linked_backtest_history_source_detail = backtest.history_source_detail
                record.linked_backtest_history_source_recommended_data_range = (
                    backtest.history_source_recommended_data_range
                )
                record.linked_backtest_history_source_recommended_timeframe = (
                    backtest.history_source_recommended_timeframe
                )
                record.linked_backtest_history_source_recommended_action = backtest.history_source_recommended_action
                record.linked_backtest_requested_candle_estimate = backtest.requested_candle_estimate
                record.linked_backtest_requested_candle_limit = backtest.requested_candle_limit
                record.linked_backtest_requested_range_start = backtest.requested_range_start
                record.linked_backtest_requested_range_end = backtest.requested_range_end
                record.linked_backtest_retrieved_window_completion_pct = backtest.retrieved_window_completion_pct
                record.linked_backtest_used_window_completion_pct = backtest.used_window_completion_pct
                record.linked_backtest_retrieved_candle_count = backtest.retrieved_candle_count
                record.linked_backtest_used_candle_count = backtest.used_candle_count
                record.linked_backtest_retrieved_range_start = backtest.retrieved_range_start
                record.linked_backtest_retrieved_range_end = backtest.retrieved_range_end
                record.linked_backtest_used_range_start = backtest.used_range_start
                record.linked_backtest_used_range_end = backtest.used_range_end
                record.linked_backtest_history_truncated = backtest.history_truncated
                record.linked_backtest_history_gap_reason = backtest.history_gap_reason
                record.linked_backtest_full_window_recommended_data_range = (
                    backtest.full_window_recommended_data_range
                )
                record.linked_backtest_full_window_recommended_timeframe = (
                    backtest.full_window_recommended_timeframe
                )
                record.linked_backtest_full_window_recommended_action = backtest.full_window_recommended_action
            if review is not None:
                record.linked_review_id = review.id
                record.linked_review_title = review.title
                record.linked_review_period = review.period
            record.updated_at = now_iso()
            return record
        if job is not None:
            record.follow_up_job_id = job.id
            record.follow_up_job_type = job.job_type
            record.follow_up_job_status = job.status
        if backtest is not None:
            record.linked_backtest_id = backtest.id
            record.linked_backtest_timeframe = backtest.timeframe
            record.linked_backtest_data_range = backtest.data_range
            record.linked_backtest_sample_quality = backtest.sample_quality
            record.linked_backtest_decision_readiness = backtest.decision_readiness
            record.linked_backtest_decision_readiness_detail = backtest.decision_readiness_detail
            record.linked_backtest_decision_recommended_data_range = backtest.decision_recommended_data_range
            record.linked_backtest_decision_recommended_timeframe = backtest.decision_recommended_timeframe
            record.linked_backtest_decision_readiness_action = backtest.decision_readiness_action
            record.linked_backtest_history_source = backtest.history_source
            record.linked_backtest_history_source_reason = backtest.history_source_reason
            record.linked_backtest_history_source_detail = backtest.history_source_detail
            record.linked_backtest_history_source_recommended_data_range = (
                backtest.history_source_recommended_data_range
            )
            record.linked_backtest_history_source_recommended_timeframe = (
                backtest.history_source_recommended_timeframe
            )
            record.linked_backtest_history_source_recommended_action = backtest.history_source_recommended_action
            record.linked_backtest_requested_candle_estimate = backtest.requested_candle_estimate
            record.linked_backtest_requested_candle_limit = backtest.requested_candle_limit
            record.linked_backtest_requested_range_start = backtest.requested_range_start
            record.linked_backtest_requested_range_end = backtest.requested_range_end
            record.linked_backtest_retrieved_window_completion_pct = backtest.retrieved_window_completion_pct
            record.linked_backtest_used_window_completion_pct = backtest.used_window_completion_pct
            record.linked_backtest_retrieved_candle_count = backtest.retrieved_candle_count
            record.linked_backtest_used_candle_count = backtest.used_candle_count
            record.linked_backtest_retrieved_range_start = backtest.retrieved_range_start
            record.linked_backtest_retrieved_range_end = backtest.retrieved_range_end
            record.linked_backtest_used_range_start = backtest.used_range_start
            record.linked_backtest_used_range_end = backtest.used_range_end
            record.linked_backtest_history_truncated = backtest.history_truncated
            record.linked_backtest_history_gap_reason = backtest.history_gap_reason
            record.linked_backtest_full_window_recommended_data_range = (
                backtest.full_window_recommended_data_range
            )
            record.linked_backtest_full_window_recommended_timeframe = (
                backtest.full_window_recommended_timeframe
            )
            record.linked_backtest_full_window_recommended_action = backtest.full_window_recommended_action
        if result_summary is not None:
            record.follow_up_result_summary = result_summary
        elif job is not None:
            if job.result_summary is not None:
                record.follow_up_result_summary = job.result_summary
            elif job.status in {JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING}:
                record.follow_up_result_summary = None
        if review is not None:
            record.linked_review_id = review.id
            record.linked_review_title = review.title
            record.linked_review_period = review.period
        elif job is not None and job.status in {JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING, JobStatus.FAILED, JobStatus.CANCELLED}:
            record.linked_review_id = None
            record.linked_review_title = None
            record.linked_review_period = None
        record.updated_at = now_iso()
        return record

    def _create_agent_job_locked(self, payload: AgentJobCreate, source: str = "desktop") -> AgentJob:
        existing = next(
            (
                job
                for job in self.state.agent_jobs
                if job.idempotency_key == payload.idempotency_key and job.status not in {JobStatus.CANCELLED, JobStatus.FAILED}
            ),
            None,
        )
        if existing is not None:
            return existing

        timestamp = now_iso()
        record = AgentJob(
            id=f"job-{uuid4().hex[:6]}",
            job_type=payload.job_type,
            context=payload.context,
            strategy_id=str(payload.context.get("strategy_id") or "") or None,
            allowed_actions=payload.allowed_actions,
            timeout=payload.timeout,
            idempotency_key=payload.idempotency_key,
            writeback_target=payload.writeback_target,
            status=JobStatus.QUEUED,
            created_at=timestamp,
            updated_at=timestamp,
        )
        self.state.agent_jobs.insert(0, record)
        self._recompute_scheduler_queue_depth()
        queued_event_payload = record.model_dump(mode="json")
        queued_event_payload["summary"] = f"任务已入队：{record.job_type}"
        self._enrich_agent_job_event_payload(queued_event_payload, record)
        self.add_event(
            event_type="openclaw.job.queued",
            source=source,
            severity=EventSeverity.INFO,
            payload=queued_event_payload,
            strategy_id=payload.context.get("strategy_id"),
        )
        return record

    def _queue_change_request_reconcile_locked(self, record: ChangeRequest) -> AgentJob:
        job = self._create_agent_job_locked(
            AgentJobCreate(
                job_type="reconcile_change_request",
                context={
                    "change_request_id": record.id,
                    "change_type": record.type,
                    "summary": record.summary,
                    "strategy_id": record.payload.get("strategy_id"),
                    "symbol": record.payload.get("symbol"),
                    "requested_by": record.requested_by,
                    "source_backtest_id": record.source_backtest_id,
                    "source_review_id": record.source_review_id,
                    "source_proposal_id": record.source_proposal_id,
                    "trigger_reason": record.trigger_reason,
                    "target_mode": record.target_mode.value,
                    "payload": record.payload,
                },
                allowed_actions=["summarize_change_request"],
                timeout=45,
                idempotency_key=f"change-request-reconcile-{record.id}",
                writeback_target="scheduler",
            ),
            source="mock-orchestrator",
        )
        self._sync_change_request_follow_up_locked(record.id, job=job)
        return job

    def _queue_strategy_change_review_locked(self, record: ChangeRequest) -> AgentJob:
        proposal_status_overrides = (
            {str(record.source_proposal_id): "accepted"}
            if record.trigger_reason == "proposal_accept" and record.source_proposal_id
            else None
        )
        change_request_follow_up_overrides = {
            record.id: {
                "follow_up_job_type": "review_strategy_change",
                "follow_up_job_status": JobStatus.QUEUED.value,
            }
        }
        job = self._create_agent_job_locked(
            AgentJobCreate(
                job_type="review_strategy_change",
                context={
                    "change_request_id": record.id,
                    "change_type": record.type,
                    "summary": record.summary,
                    "strategy_id": record.payload.get("strategy_id"),
                    "symbol": record.payload.get("symbol"),
                    "requested_by": record.requested_by,
                    "source_backtest_id": record.source_backtest_id,
                    "source_review_id": record.source_review_id,
                    "source_proposal_id": record.source_proposal_id,
                    "trigger_reason": record.trigger_reason,
                    "target_mode": record.target_mode.value,
                    "payload": record.payload,
                },
                allowed_actions=["review_strategy_change", "summarize_execution_impact"],
                timeout=60,
                idempotency_key=f"strategy-change-review-{record.id}",
                writeback_target="strategy_activity",
            ),
            source="mock-orchestrator",
        )
        self._refresh_agent_job_review_strategy_activity_locked(
            job,
            proposal_status_overrides=proposal_status_overrides,
            change_request_follow_up_overrides=change_request_follow_up_overrides,
        )
        self._sync_change_request_follow_up_locked(record.id, job=job)
        return job

    @staticmethod
    def _should_queue_strategy_change_review(record: ChangeRequest) -> bool:
        strategy_id = str(record.payload.get("strategy_id") or "")
        if not strategy_id:
            return False
        return record.type in {
            "strategy.parameter.update",
            "strategy.pause_resume",
            "strategy.risk_update",
            "proposal.param_update",
            "proposal.pause_resume",
            "proposal.risk_update",
            "proposal.publish_recommendation",
            "proposal.script_patch_proposal",
        }

    def _create_backtest_locked(
        self,
        strategy_id: str,
        data_range: str,
        timeframe: str,
        source_change_request_id: Optional[str] = None,
        source_backtest_id: Optional[str] = None,
        source_review_id: Optional[str] = None,
        source_proposal_id: Optional[str] = None,
        trigger_reason: Optional[str] = None,
    ) -> BacktestRun:
        strategy = next((item for item in self.state.strategies if item.id == strategy_id), None)
        if strategy is None:
            raise KeyError(strategy_id)
        normalized_timeframe = normalize_backtest_timeframe(timeframe)
        timestamp = now_iso()
        computed = self.backtest_runner(strategy, data_range, normalized_timeframe) if self.backtest_runner else None
        record = BacktestRun(
            id=f"bt-{uuid4().hex[:6]}",
            strategy_id=strategy.id,
            strategy_name=strategy.name,
            source_change_request_id=source_change_request_id,
            source_backtest_id=source_backtest_id,
            source_review_id=source_review_id,
            source_proposal_id=source_proposal_id,
            trigger_reason=trigger_reason or "manual_create",
            status="completed",
            started_at=timestamp,
            finished_at=timestamp,
            symbol_scope=list(computed.get("symbol_scope", strategy.symbols)) if computed else strategy.symbols,
            timeframe=normalized_timeframe,
            data_range=data_range,
            data_granularity=str(computed.get("data_granularity", "kline+trade" if strategy.category == "python" else "kline")) if computed else ("kline+trade" if strategy.category == "python" else "kline"),
            fee_model="bybit-v5-standard",
            slippage_model="control-v1-adaptive",
            parameter_snapshot=computed.get("parameter_snapshot", {param.key: param.value for param in strategy.parameters}) if computed else {param.key: param.value for param in strategy.parameters},
            metrics=computed.get("metrics") if computed else BacktestMetrics(
                annual_return="+26.4%",
                max_drawdown="-5.2%",
                sharpe="1.57",
                win_rate="59.8%",
                pnl="+52,400 USDT",
                trades=112,
            ),
            reference_only=bool(computed.get("reference_only")) if computed else False,
            sample_quality=(
                str(computed.get("sample_quality"))
                if computed and computed.get("sample_quality")
                else derive_backtest_sample_quality(
                    bool(computed.get("reference_only")) if computed else False,
                    int(computed.get("metrics").trades) if computed and computed.get("metrics") else 112,
                )
            ),
            history_source=(
                str(computed.get("history_source"))
                if computed and computed.get("history_source")
                else "exchange_history"
            ),
            history_source_reason=(
                str(computed.get("history_source_reason"))
                if computed and computed.get("history_source_reason")
                else "none"
            ),
            history_source_detail=(
                str(computed.get("history_source_detail"))
                if computed and computed.get("history_source_detail")
                else None
            ),
            history_source_recommended_data_range=(
                str(computed.get("history_source_recommended_data_range"))
                if computed and computed.get("history_source_recommended_data_range")
                else None
            ),
            history_source_recommended_timeframe=(
                str(computed.get("history_source_recommended_timeframe"))
                if computed and computed.get("history_source_recommended_timeframe")
                else None
            ),
            history_source_recommended_action=(
                str(computed.get("history_source_recommended_action"))
                if computed and computed.get("history_source_recommended_action")
                else None
            ),
            decision_readiness=(
                str(computed.get("decision_readiness"))
                if computed and computed.get("decision_readiness")
                else "ready"
            ),
            decision_readiness_detail=(
                str(computed.get("decision_readiness_detail"))
                if computed and computed.get("decision_readiness_detail")
                else ""
            ),
            decision_recommended_data_range=(
                str(computed.get("decision_recommended_data_range"))
                if computed and computed.get("decision_recommended_data_range")
                else None
            ),
            decision_recommended_timeframe=(
                str(computed.get("decision_recommended_timeframe"))
                if computed and computed.get("decision_recommended_timeframe")
                else None
            ),
            decision_readiness_action=(
                str(computed.get("decision_readiness_action"))
                if computed and computed.get("decision_readiness_action")
                else None
            ),
            requested_candle_estimate=(
                int(computed.get("requested_candle_estimate"))
                if computed and computed.get("requested_candle_estimate") is not None
                else 0
            ),
            requested_candle_limit=(
                int(computed.get("requested_candle_limit"))
                if computed and computed.get("requested_candle_limit") is not None
                else 0
            ),
            requested_range_start=(
                str(computed.get("requested_range_start"))
                if computed and computed.get("requested_range_start")
                else None
            ),
            requested_range_end=(
                str(computed.get("requested_range_end"))
                if computed and computed.get("requested_range_end")
                else None
            ),
            retrieved_window_completion_pct=(
                float(computed.get("retrieved_window_completion_pct"))
                if computed and computed.get("retrieved_window_completion_pct") is not None
                else 0.0
            ),
            used_window_completion_pct=(
                float(computed.get("used_window_completion_pct"))
                if computed and computed.get("used_window_completion_pct") is not None
                else 0.0
            ),
            retrieved_candle_count=(
                int(computed.get("retrieved_candle_count"))
                if computed and computed.get("retrieved_candle_count") is not None
                else 0
            ),
            used_candle_count=(
                int(computed.get("used_candle_count"))
                if computed and computed.get("used_candle_count") is not None
                else 0
            ),
            retrieved_range_start=(
                str(computed.get("retrieved_range_start"))
                if computed and computed.get("retrieved_range_start")
                else None
            ),
            retrieved_range_end=(
                str(computed.get("retrieved_range_end"))
                if computed and computed.get("retrieved_range_end")
                else None
            ),
            used_range_start=(
                str(computed.get("used_range_start"))
                if computed and computed.get("used_range_start")
                else None
            ),
            used_range_end=(
                str(computed.get("used_range_end"))
                if computed and computed.get("used_range_end")
                else None
            ),
            history_truncated=bool(computed.get("history_truncated")) if computed else False,
            history_gap_reason=(
                str(computed.get("history_gap_reason"))
                if computed and computed.get("history_gap_reason")
                else "none"
            ),
            full_window_recommended_data_range=(
                str(computed.get("full_window_recommended_data_range"))
                if computed and computed.get("full_window_recommended_data_range")
                else None
            ),
            full_window_recommended_timeframe=(
                str(computed.get("full_window_recommended_timeframe"))
                if computed and computed.get("full_window_recommended_timeframe")
                else None
            ),
            full_window_recommended_action=(
                str(computed.get("full_window_recommended_action"))
                if computed and computed.get("full_window_recommended_action")
                else None
            ),
            notes=str(computed.get("notes")) if computed else "由控制端发起的即时回测，当前为 mock 结果用于联调。",
            volatility_stats=computed.get("volatility_stats") if computed else None,
            risk_ratios=computed.get("risk_ratios") if computed else None,
            trade_rhythm_stats=computed.get("trade_rhythm_stats") if computed else None,
            benchmark_stats=computed.get("benchmark_stats") if computed else None,
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
        return record

    def _queue_backtest_review_locked(self, backtest: BacktestRun, requested_by: str) -> AgentJob:
        idempotency_key = f"backtest-review-{backtest.id}"
        existing = next((job for job in self.state.agent_jobs if job.idempotency_key == idempotency_key), None)
        if existing is not None:
            return existing

        strategy = self._find_strategy(backtest.strategy_id)
        execution_health = self.state.control_snapshot.execution_health.model_dump(mode="json")
        payload = AgentJobCreate(
            job_type="generate_backtest_review",
            context={
                "change_request_id": backtest.source_change_request_id,
                "strategy_id": backtest.strategy_id,
                "strategy_name": backtest.strategy_name,
                "focus_symbols": backtest.symbol_scope,
                "timeframe": backtest.timeframe,
                "data_range": backtest.data_range,
                "metrics": backtest.metrics.model_dump(mode="json"),
                "reference_only": backtest.reference_only,
                "sample_quality": backtest.sample_quality,
                "history_source": backtest.history_source,
                "history_source_reason": backtest.history_source_reason,
                "history_source_detail": backtest.history_source_detail,
                "history_source_recommended_data_range": backtest.history_source_recommended_data_range,
                "history_source_recommended_timeframe": backtest.history_source_recommended_timeframe,
                "history_source_recommended_action": backtest.history_source_recommended_action,
                "decision_readiness": backtest.decision_readiness,
                "decision_readiness_detail": backtest.decision_readiness_detail,
                "decision_recommended_data_range": backtest.decision_recommended_data_range,
                "decision_recommended_timeframe": backtest.decision_recommended_timeframe,
                "decision_readiness_action": backtest.decision_readiness_action,
                "requested_candle_estimate": backtest.requested_candle_estimate,
                "requested_candle_limit": backtest.requested_candle_limit,
                "requested_range_start": backtest.requested_range_start,
                "requested_range_end": backtest.requested_range_end,
                "retrieved_window_completion_pct": backtest.retrieved_window_completion_pct,
                "used_window_completion_pct": backtest.used_window_completion_pct,
                "retrieved_candle_count": backtest.retrieved_candle_count,
                "used_candle_count": backtest.used_candle_count,
                "retrieved_range_start": backtest.retrieved_range_start,
                "retrieved_range_end": backtest.retrieved_range_end,
                "used_range_start": backtest.used_range_start,
                "used_range_end": backtest.used_range_end,
                "history_truncated": backtest.history_truncated,
                "history_gap_reason": backtest.history_gap_reason,
                "full_window_recommended_data_range": backtest.full_window_recommended_data_range,
                "full_window_recommended_timeframe": backtest.full_window_recommended_timeframe,
                "full_window_recommended_action": backtest.full_window_recommended_action,
                "parameter_snapshot": backtest.parameter_snapshot,
                "volatility_stats": backtest.volatility_stats.model_dump(mode="json") if backtest.volatility_stats else None,
                "risk_ratios": backtest.risk_ratios.model_dump(mode="json") if backtest.risk_ratios else None,
                "trade_rhythm_stats": backtest.trade_rhythm_stats.model_dump(mode="json") if backtest.trade_rhythm_stats else None,
                "benchmark_stats": backtest.benchmark_stats.model_dump(mode="json") if backtest.benchmark_stats else None,
                "requested_by": requested_by,
                "mode": strategy.mode.value,
                "backtest_id": backtest.id,
                "source_change_request_id": backtest.source_change_request_id,
                "source_backtest_id": backtest.source_backtest_id,
                "source_review_id": backtest.source_review_id,
                "source_proposal_id": backtest.source_proposal_id,
                "trigger_reason": backtest.trigger_reason,
                "execution_health": execution_health,
                "execution_top_issue": execution_health.get("top_issue"),
                "review_strategy_activity": self._build_review_strategy_activity_context_locked(
                    backtest.strategy_id,
                    proposal_status_overrides=(
                        {str(backtest.source_proposal_id): "accepted"}
                        if backtest.trigger_reason == "proposal_accept" and backtest.source_proposal_id
                        else None
                    ),
                ),
            },
            allowed_actions=["review_backtest", "propose_next_step"],
            timeout=90,
            idempotency_key=idempotency_key,
            writeback_target="reviews",
        )
        job = self._create_agent_job_locked(payload, source="quant-core")
        proposal_status_overrides = (
            {str(backtest.source_proposal_id): "accepted"}
            if backtest.trigger_reason == "proposal_accept" and backtest.source_proposal_id
            else None
        )
        self._refresh_agent_job_review_strategy_activity_locked(
            job,
            proposal_status_overrides=proposal_status_overrides,
        )
        return job

    def _find_proposal(self, proposal_id: str) -> StrategyProposal:
        for review in self.state.reviews:
            for proposal in review.proposals:
                if proposal.id == proposal_id:
                    return proposal
        raise KeyError(proposal_id)

    def _find_review_for_proposal(self, proposal_id: str) -> ReviewDocument:
        for review in self.state.reviews:
            for proposal in review.proposals:
                if proposal.id == proposal_id:
                    return review
        raise KeyError(proposal_id)

    def _find_strategy(self, strategy_id: str):
        strategy = next((item for item in self.state.strategies if item.id == strategy_id), None)
        if strategy is None:
            raise KeyError(strategy_id)
        return strategy

    @staticmethod
    def _normalize_strategy_value(current_value: Any, next_value: Any) -> Any:
        if isinstance(current_value, bool):
            if isinstance(next_value, str):
                return next_value.strip().lower() in {"1", "true", "yes", "on"}
            return bool(next_value)
        if isinstance(current_value, int) and not isinstance(current_value, bool):
            return int(float(next_value))
        if isinstance(current_value, float):
            return float(next_value)
        return str(next_value)

    @staticmethod
    def _extract_parameter_patch(payload: Dict[str, Any]) -> Dict[str, Any]:
        patch = payload.get("parameter_patch")
        if isinstance(patch, dict):
            return patch

        reserved_keys = {
            "strategy_id",
            "proposal_id",
            "target_mode",
            "next_status",
            "risk_budget",
            "recommendation",
            "symbol",
            "threshold_pct",
            "data_range",
            "timeframe",
        }
        return {key: value for key, value in payload.items() if key not in reserved_keys}

    def _apply_parameter_patch(self, strategy_id: str, patch: Dict[str, Any]) -> None:
        if not patch:
            return

        strategy = self._find_strategy(strategy_id)
        parameter_map = {parameter.key: parameter for parameter in strategy.parameters}
        for key, value in patch.items():
            current = parameter_map.get(key)
            if current is None:
                strategy.parameters.append(
                    StrategyParameter(
                        key=key,
                        label=key.replace("_", " ").title(),
                        value=value,
                    )
                )
                continue
            current.value = self._normalize_strategy_value(current.value, value)

    def _apply_change_request_locked(self, record: ChangeRequest) -> Optional[BacktestRun]:
        change_type = record.type
        payload = record.payload
        strategy_id = str(payload.get("strategy_id") or "")
        created_backtest = None
        applied = False

        if change_type in {"strategy.parameter.update", "proposal.param_update"} and strategy_id:
            self._apply_parameter_patch(strategy_id, self._extract_parameter_patch(payload))
            applied = True
        elif change_type in {"strategy.pause_resume", "proposal.pause_resume"} and strategy_id:
            strategy = self._find_strategy(strategy_id)
            next_status = str(payload.get("next_status") or ("paused" if strategy.status == "running" else "running"))
            if next_status in {"running", "paused", "paper_only", "shadow"}:
                strategy.status = next_status
                applied = True
        elif change_type in {"strategy.risk_update", "proposal.risk_update"} and strategy_id:
            strategy = self._find_strategy(strategy_id)
            risk_budget = payload.get("risk_budget")
            if risk_budget is not None:
                strategy.risk_budget = str(risk_budget)
                applied = True
        elif change_type in {"proposal.publish_recommendation"} and strategy_id:
            strategy = self._find_strategy(strategy_id)
            target_mode = payload.get("target_mode")
            if target_mode in {"paper", "demo", "live"}:
                strategy.mode = AccountMode(target_mode)
            applied = True
        elif change_type == "backtest.launch" and strategy_id:
            created_backtest = self._create_backtest_locked(
                strategy_id=strategy_id,
                data_range=str(payload.get("data_range", "2025-12-01 ~ 2026-03-29")),
                timeframe=str(payload.get("timeframe", "1h")),
                source_change_request_id=record.id,
                source_review_id=record.source_review_id,
                source_proposal_id=record.source_proposal_id,
                trigger_reason=record.trigger_reason,
            )
            self._sync_change_request_follow_up_locked(record.id, backtest=created_backtest)
            backtest_review_job = self._queue_backtest_review_locked(created_backtest, requested_by=record.requested_by)
            self._sync_change_request_follow_up_locked(record.id, job=backtest_review_job, backtest=created_backtest)
            applied = True
        elif change_type == "alert.rule.update":
            symbol = str(payload.get("symbol") or "").upper()
            if symbol:
                watch_item = self._find_watchlist_item(symbol)
                if payload.get("threshold_pct") is not None:
                    try:
                        watch_item.alert_threshold_pct = float(payload.get("threshold_pct"))
                    except (TypeError, ValueError):
                        pass
                if payload.get("alert_enabled") is not None:
                    watch_item.alert_enabled = bool(payload.get("alert_enabled"))
                else:
                    watch_item.alert_enabled = True
                rule = self._ensure_market_alert_rule_locked(watch_item)
                rule.enabled = watch_item.alert_enabled
                rule.threshold_pct = max(float(watch_item.alert_threshold_pct or rule.threshold_pct), 0.1)
                if payload.get("cooldown_minutes") is not None:
                    rule.cooldown_minutes = self._coerce_int(payload.get("cooldown_minutes"), rule.cooldown_minutes)
                rule.updated_at = now_iso()
                applied = True

        if not applied:
            return created_backtest

        record.status = ChangeRequestStatus.APPLIED
        record.updated_at = now_iso()
        self.add_event(
            event_type="change_request.applied",
            source="mock-orchestrator",
            severity=EventSeverity.INFO,
            payload=record.model_dump(mode="json"),
            symbol=payload.get("symbol"),
            strategy_id=payload.get("strategy_id"),
        )
        if self._should_queue_strategy_change_review(record):
            self._queue_strategy_change_review_locked(record)
        else:
            self._queue_change_request_reconcile_locked(record)
        return created_backtest

    def create_change_request(self, payload: ChangeRequestCreate) -> ChangeRequest:
        with self._lock:
            record = self._create_change_request_locked(payload)
            self._apply_change_request_locked(record)
            self._refresh_derived_state()
            self._persist()
            return record

    def update_settings(self, payload: SettingsUpdatePayload) -> SettingsPayload:
        with self._lock:
            current = self.state.settings
            bybit_web_entry = (
                self._normalize_setting_url(payload.bybit_web_entry, field_label="网页入口")
                if payload.bybit_web_entry is not None
                else current.bybit_web_entry
            )
            api_base_url = (
                self._normalize_setting_url(payload.api_base_url, field_label="API Base URL")
                if payload.api_base_url is not None
                else current.api_base_url
            )
            product_language = (
                self._normalize_optional_string(payload.product_language)
                if payload.product_language is not None
                else current.product_language
            )
            if not product_language:
                raise ValueError("产品语言不能为空。")
            grafana_base_url = (
                self._normalize_setting_url(payload.grafana_base_url, field_label="Grafana Base URL")
                if payload.grafana_base_url is not None
                else current.grafana_base_url
            )
            grafana_dashboard_uid = (
                self._normalize_optional_string(payload.grafana_dashboard_uid)
                if payload.grafana_dashboard_uid is not None
                else current.grafana_dashboard_uid
            )
            grafana_org_id = payload.grafana_org_id if payload.grafana_org_id is not None else current.grafana_org_id
            if grafana_org_id < 1:
                raise ValueError("Grafana Org ID 必须大于等于 1。")
            notification_channels = (
                self._normalize_notification_channels(payload.notification_channels)
                if payload.notification_channels is not None
                else list(current.notification_channels)
            )
            notification_quiet_hours_enabled = (
                payload.notification_quiet_hours_enabled
                if payload.notification_quiet_hours_enabled is not None
                else current.notification_quiet_hours_enabled
            )
            notification_quiet_hours_start = (
                self._normalize_quiet_hours_time(
                    payload.notification_quiet_hours_start,
                    field_label="通知静默开始时间",
                )
                if payload.notification_quiet_hours_start is not None
                else current.notification_quiet_hours_start
            )
            notification_quiet_hours_end = (
                self._normalize_quiet_hours_time(
                    payload.notification_quiet_hours_end,
                    field_label="通知静默结束时间",
                )
                if payload.notification_quiet_hours_end is not None
                else current.notification_quiet_hours_end
            )
            if notification_quiet_hours_enabled and notification_quiet_hours_start == notification_quiet_hours_end:
                raise ValueError("通知静默开始和结束时间不能相同。")
            next_settings = SettingsPayload(
                bybit_web_entry=bybit_web_entry or current.bybit_web_entry,
                api_base_url=api_base_url or current.api_base_url,
                openclaw_gateway_url=current.openclaw_gateway_url,
                openclaw_agent=current.openclaw_agent,
                default_mode=payload.default_mode or current.default_mode,
                notification_channels=notification_channels,
                notification_quiet_hours_enabled=notification_quiet_hours_enabled,
                notification_quiet_hours_start=notification_quiet_hours_start,
                notification_quiet_hours_end=notification_quiet_hours_end,
                product_language=product_language,
                grafana_base_url=grafana_base_url,
                grafana_dashboard_uid=grafana_dashboard_uid,
                grafana_org_id=grafana_org_id,
                grafana_theme=payload.grafana_theme or current.grafana_theme,
            )
            self.state.settings = next_settings
            self.add_event(
                event_type="settings.updated",
                source="desktop",
                severity=EventSeverity.INFO,
                payload={
                    "summary": "本地设置已更新。",
                    "bybit_web_entry": next_settings.bybit_web_entry,
                    "api_base_url": next_settings.api_base_url,
                    "default_mode": next_settings.default_mode.value,
                    "notification_channels": next_settings.notification_channels,
                    "notification_quiet_hours_enabled": next_settings.notification_quiet_hours_enabled,
                    "notification_quiet_hours_start": next_settings.notification_quiet_hours_start,
                    "notification_quiet_hours_end": next_settings.notification_quiet_hours_end,
                    "grafana_base_url": next_settings.grafana_base_url,
                    "grafana_dashboard_uid": next_settings.grafana_dashboard_uid,
                    "grafana_org_id": next_settings.grafana_org_id,
                    "grafana_theme": next_settings.grafana_theme,
                },
            )
            self._persist()
            return next_settings

    def acknowledge_alert(self, alert_id: str, payload: AlertAcknowledgePayload) -> AlertRecord:
        with self._lock:
            alert = next((item for item in self.state.alerts if item.id == alert_id), None)
            if alert is None:
                raise KeyError(alert_id)
            alert.acknowledged = payload.acknowledged
            self._refresh_derived_state()
            self.add_event(
                event_type="alert.acknowledged" if payload.acknowledged else "alert.reopened",
                source="desktop",
                severity=EventSeverity.INFO,
                payload={
                    "alert_id": alert.id,
                    "requested_by": payload.requested_by,
                    "acknowledged": payload.acknowledged,
                    "title": alert.title,
                },
                symbol=alert.symbol,
            )
            self._persist()
            return alert

    def create_agent_job(self, payload: AgentJobCreate) -> AgentJob:
        with self._lock:
            record = self._create_agent_job_locked(payload)
            if record.job_type in {"review_strategy_issue", "review_strategy_change", "generate_backtest_review"}:
                self._refresh_agent_job_review_strategy_activity_locked(record)
            self._persist()
            return record

    def retry_agent_job(self, job_id: str, requested_by: str) -> AgentJob:
        with self._lock:
            job = next((item for item in self.state.agent_jobs if item.id == job_id), None)
            if job is None:
                raise KeyError(job_id)
            if job.status not in {JobStatus.FAILED, JobStatus.CANCELLED}:
                raise ValueError("只有失败或已取消的任务可以重试。")

            retry_count = int(job.context.get("retry_count", 0)) + 1
            retried_job = self._create_agent_job_locked(
                AgentJobCreate(
                    job_type=job.job_type,
                    context={
                        **job.context,
                        "retried_from_job_id": job.id,
                        "retry_count": retry_count,
                    },
                    allowed_actions=job.allowed_actions,
                    timeout=job.timeout,
                    idempotency_key=f"{job.idempotency_key}-retry-{retry_count}",
                    writeback_target=job.writeback_target,
                ),
                source="desktop",
            )
            retried_job.retried_from_job_id = job.id
            retried_job.retry_count = retry_count
            if retried_job.job_type in {"review_strategy_issue", "review_strategy_change", "generate_backtest_review"}:
                self._refresh_agent_job_review_strategy_activity_locked(retried_job)
            self._sync_change_request_follow_up_locked(
                str(retried_job.context.get("change_request_id") or "") or None,
                job=retried_job,
            )
            retry_requested_payload = {
                "previous_job_id": job.id,
                "retry_job_id": retried_job.id,
                "requested_by": requested_by,
                "retried_from_job_id": job.id,
                "retry_count": retry_count,
                "summary": f"已请求重试任务：{job.job_type}",
            }
            self._enrich_agent_job_event_payload(retry_requested_payload, retried_job)
            self.add_event(
                event_type="openclaw.job.retry_requested",
                source="desktop",
                severity=EventSeverity.INFO,
                payload=retry_requested_payload,
                strategy_id=str(job.context.get("strategy_id") or "") or None,
            )
            self._persist()
            return retried_job

    def claim_next_agent_job(self) -> Optional[AgentJob]:
        with self._lock:
            scheduler = self.state.control_snapshot.scheduler
            if scheduler.status != "running" or scheduler.current_job_id:
                return None

            next_job = next((item for item in self.state.agent_jobs if item.status == JobStatus.QUEUED), None)
            if next_job is None:
                return None

            next_job.status = JobStatus.RUNNING
            next_job.updated_at = now_iso()
            scheduler.current_job_id = next_job.id
            scheduler.last_heartbeat_at = now_iso()
            self._recompute_scheduler_queue_depth()
            self._sync_change_request_follow_up_locked(
                str(next_job.context.get("change_request_id") or "") or None,
                job=next_job,
            )
            started_event_payload = next_job.model_dump(mode="json")
            started_event_payload["summary"] = f"任务开始执行：{next_job.job_type}"
            self._enrich_agent_job_event_payload(started_event_payload, next_job)
            self.add_event(
                event_type="openclaw.job.started",
                source="openclaw",
                severity=EventSeverity.INFO,
                payload=started_event_payload,
                strategy_id=str(next_job.context.get("strategy_id") or "") or None,
            )
            self._persist()
            return next_job.model_copy(deep=True)

    def complete_agent_job(
        self,
        job_id: str,
        result_summary: str,
        review: Optional[ReviewDocument] = None,
        source: str = "openclaw",
    ) -> AgentJob:
        with self._lock:
            job = next((item for item in self.state.agent_jobs if item.id == job_id), None)
            if job is None:
                raise KeyError(job_id)

            job.status = JobStatus.COMPLETED
            job.result_summary = result_summary
            job.updated_at = now_iso()
            scheduler = self.state.control_snapshot.scheduler
            if scheduler.current_job_id == job.id:
                scheduler.current_job_id = None
            scheduler.last_heartbeat_at = now_iso()
            if review is not None:
                review.source_job_id = job.id
                review.source_job_type = job.job_type
                review.source_job_status = job.status.value if hasattr(job.status, "value") else str(job.status)
                job.context = {
                    **job.context,
                    "linked_review_id": review.id,
                    "linked_review_title": review.title,
                    "linked_review_period": review.period,
                }
                job.linked_review_id = review.id
                job.linked_review_title = review.title
                job.linked_review_period = review.period
                self.state.reviews.insert(0, review)
            self._sync_change_request_follow_up_locked(
                str(job.context.get("change_request_id") or "") or None,
                job=job,
                review=review,
                result_summary=result_summary,
            )
            if job.job_type == "generate_backtest_review":
                linked_backtest_id = (
                    review.backtest_id
                    if review is not None and getattr(review, "backtest_id", None)
                    else str(job.context.get("backtest_id") or "").strip() or None
                )
                linked_backtest = next(
                    (item for item in self.state.backtests if item.id == linked_backtest_id),
                    None,
                )
                self._sync_change_request_follow_up_locked(
                    str(job.context.get("source_change_request_id") or "") or None,
                    backtest=linked_backtest,
                    review=review,
                )
            self._recompute_scheduler_queue_depth()
            completed_event_payload = {
                "job_id": job.id,
                "job_type": job.job_type,
                "result_summary": result_summary,
                "review_id": review.id if review else None,
                "review_title": review.title if review else None,
                "review_period": review.period if review else None,
            }
            if job.job_type == "generate_backtest_review":
                completed_event_payload.update(
                    {
                        "backtest_id": (
                            review.backtest_id
                            if review and review.backtest_id
                            else job.context.get("backtest_id")
                        ),
                        "source_backtest_id": (
                            review.source_backtest_id
                            if review and review.source_backtest_id
                            else job.context.get("source_backtest_id")
                        ),
                        "source_review_id": (
                            review.source_review_id
                            if review and review.source_review_id
                            else job.context.get("source_review_id")
                        ),
                        "source_proposal_id": (
                            review.source_proposal_id
                            if review and review.source_proposal_id
                            else job.context.get("source_proposal_id")
                        ),
                        "trigger_reason": (
                            review.trigger_reason
                            if review and review.trigger_reason
                            else job.context.get("trigger_reason")
                        ),
                        "decision_readiness": (
                            review.decision_readiness
                            if review and review.decision_readiness
                            else job.context.get("decision_readiness")
                        ),
                        "decision_readiness_detail": (
                            review.decision_readiness_detail
                            if review and review.decision_readiness_detail
                            else job.context.get("decision_readiness_detail")
                        ),
                        "decision_recommended_data_range": (
                            review.decision_recommended_data_range
                            if review and review.decision_recommended_data_range
                            else job.context.get("decision_recommended_data_range")
                        ),
                        "decision_recommended_timeframe": (
                            review.decision_recommended_timeframe
                            if review and review.decision_recommended_timeframe
                            else job.context.get("decision_recommended_timeframe")
                        ),
                        "decision_readiness_action": (
                            review.decision_readiness_action
                            if review and review.decision_readiness_action
                            else job.context.get("decision_readiness_action")
                        ),
                    }
                )
            self._enrich_agent_job_event_payload(completed_event_payload, job, review=review)
            self.add_event(
                event_type="openclaw.job.completed",
                source=source,
                severity=EventSeverity.INFO,
                payload=completed_event_payload,
                strategy_id=str(job.context.get("strategy_id") or "") or None,
            )
            if job.job_type == "review_strategy_change":
                self.add_event(
                    event_type="strategy.change.review.completed",
                    source=source,
                    severity=EventSeverity.INFO,
                    payload={
                        "job_id": job.id,
                        "change_request_id": job.context.get("change_request_id"),
                        "strategy_id": job.context.get("strategy_id"),
                        "source_backtest_id": job.context.get("source_backtest_id"),
                        "source_review_id": job.context.get("source_review_id"),
                        "source_proposal_id": job.context.get("source_proposal_id"),
                        "trigger_reason": job.context.get("trigger_reason"),
                        "summary": result_summary,
                        "writeback_target": job.writeback_target,
                        "linked_review_id": review.id if review else None,
                        "linked_review_title": review.title if review else None,
                        "linked_review_period": review.period if review else None,
                    },
                    strategy_id=str(job.context.get("strategy_id") or "") or None,
                )
            if job.job_type == "review_strategy_issue":
                self.add_event(
                    event_type="strategy.issue.review.completed",
                    source=source,
                    severity=EventSeverity.INFO,
                    payload={
                        "job_id": job.id,
                        "issue_type": job.context.get("issue_type"),
                        "strategy_id": job.context.get("strategy_id"),
                        "summary": result_summary,
                        "writeback_target": job.writeback_target,
                        "linked_review_id": review.id if review else None,
                        "linked_review_title": review.title if review else None,
                        "linked_review_period": review.period if review else None,
                    },
                    strategy_id=str(job.context.get("strategy_id") or "") or None,
                )
            self._refresh_derived_state()
            self._persist()
            return job.model_copy(deep=True)

    def fail_agent_job(self, job_id: str, error: str, source: str = "openclaw") -> AgentJob:
        with self._lock:
            job = next((item for item in self.state.agent_jobs if item.id == job_id), None)
            if job is None:
                raise KeyError(job_id)

            job.status = JobStatus.FAILED
            job.result_summary = error
            job.updated_at = now_iso()
            scheduler = self.state.control_snapshot.scheduler
            if scheduler.current_job_id == job.id:
                scheduler.current_job_id = None
            scheduler.last_heartbeat_at = now_iso()
            self._recompute_scheduler_queue_depth()
            failed_event_payload = {
                "job_id": job.id,
                "job_type": job.job_type,
                "error": error,
                "summary": error,
            }
            self._sync_change_request_follow_up_locked(
                str(job.context.get("change_request_id") or "") or None,
                job=job,
                result_summary=error,
            )
            self._enrich_agent_job_event_payload(failed_event_payload, job)
            self.add_event(
                event_type="openclaw.job.failed",
                source=source,
                severity=EventSeverity.WARNING,
                payload=failed_event_payload,
                strategy_id=str(job.context.get("strategy_id") or "") or None,
            )
            if job.job_type == "review_strategy_change":
                self.add_event(
                    event_type="strategy.change.review.failed",
                    source=source,
                    severity=EventSeverity.WARNING,
                    payload={
                        "job_id": job.id,
                        "change_request_id": job.context.get("change_request_id"),
                        "strategy_id": job.context.get("strategy_id"),
                        "source_backtest_id": job.context.get("source_backtest_id"),
                        "source_review_id": job.context.get("source_review_id"),
                        "source_proposal_id": job.context.get("source_proposal_id"),
                        "trigger_reason": job.context.get("trigger_reason"),
                        "error": error,
                    },
                    strategy_id=str(job.context.get("strategy_id") or "") or None,
                )
            if job.job_type == "review_strategy_issue":
                self.add_event(
                    event_type="strategy.issue.review.failed",
                    source=source,
                    severity=EventSeverity.WARNING,
                    payload={
                        "job_id": job.id,
                        "issue_type": job.context.get("issue_type"),
                        "strategy_id": job.context.get("strategy_id"),
                        "error": error,
                    },
                    strategy_id=str(job.context.get("strategy_id") or "") or None,
                )
            self._persist()
            return job.model_copy(deep=True)

    def should_cancel_agent_job(self, job_id: str) -> bool:
        with self._lock:
            job = next((item for item in self.state.agent_jobs if item.id == job_id), None)
            if job is None:
                return True
            scheduler = self.state.control_snapshot.scheduler
            return job.status == JobStatus.CANCELLED or scheduler.current_job_id != job.id

    def _cancel_agent_job_locked(self, job: AgentJob, requested_by: str, reason: Optional[str]) -> None:
        if job.status not in {JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING}:
            return

        job.status = JobStatus.CANCELLED
        job.result_summary = reason or "已由桌面控制端终止。"
        job.updated_at = now_iso()
        scheduler = self.state.control_snapshot.scheduler
        if scheduler.current_job_id == job.id:
            scheduler.current_job_id = None
        self._sync_change_request_follow_up_locked(
            str(job.context.get("change_request_id") or "") or None,
            job=job,
            result_summary=job.result_summary,
        )
        cancelled_event_payload = {
            "job_id": job.id,
            "job_type": job.job_type,
            "requested_by": requested_by,
            "reason": reason,
            "summary": reason or "已由桌面控制端终止。",
        }
        self._enrich_agent_job_event_payload(cancelled_event_payload, job)
        self.add_event(
            event_type="openclaw.job.cancelled",
            source="desktop",
            severity=EventSeverity.WARNING,
            payload=cancelled_event_payload,
            strategy_id=str(job.context.get("strategy_id") or "") or None,
        )

    def set_openclaw_connection(self, connected: bool) -> None:
        with self._lock:
            scheduler = self.state.control_snapshot.scheduler
            if scheduler.openclaw_connected == connected:
                return
            scheduler.openclaw_connected = connected
            scheduler.last_heartbeat_at = now_iso()
            self.add_event(
                event_type="openclaw.connection.restored" if connected else "openclaw.connection.lost",
                source="openclaw",
                severity=EventSeverity.INFO if connected else EventSeverity.WARNING,
                payload={"connected": connected},
            )
            self._persist()

    def create_backtest(
        self,
        strategy_id: str,
        data_range: str,
        timeframe: str,
        source_change_request_id: Optional[str] = None,
        source_backtest_id: Optional[str] = None,
        source_review_id: Optional[str] = None,
        source_proposal_id: Optional[str] = None,
        trigger_reason: Optional[str] = None,
    ) -> BacktestRun:
        with self._lock:
            record = self._create_backtest_locked(
                strategy_id,
                data_range,
                timeframe,
                source_change_request_id=source_change_request_id,
                source_backtest_id=source_backtest_id,
                source_review_id=source_review_id,
                source_proposal_id=source_proposal_id,
                trigger_reason=trigger_reason or "manual_create",
            )
            self._queue_backtest_review_locked(record, requested_by="desktop_operator")
            self._refresh_derived_state()
            self._persist()
            return record

    def apply_strategy_proposal(
        self, proposal_id: str, payload: StrategyProposalActionPayload
    ) -> StrategyProposalActionResult:
        with self._lock:
            proposal = self._find_proposal(proposal_id)
            parent_review = self._find_review_for_proposal(proposal_id)
            if proposal.status not in {"pending", "testing"}:
                raise ValueError(f"提案当前状态为 {proposal.status}，不能重复处理。")
            created_change_request = None
            created_backtest = None

            if payload.action == "accept":
                scheduler = self.state.control_snapshot.scheduler
                if proposal.proposal_type == "publish_recommendation":
                    if scheduler.status == "manual_override":
                        raise ValueError("当前处于人工接管状态，不能接受发布建议。")
                    if scheduler.freeze_publish:
                        raise ValueError("当前已冻结自动发布，不能接受发布建议。")
                proposal_payload = dict(proposal.payload)
                strategy_id = proposal.strategy_id
                if proposal.proposal_type == "publish_recommendation":
                    recommendation = str(proposal_payload.get("recommendation") or "").strip()
                    if not recommendation:
                        raise ValueError("发布建议缺少 recommendation，当前不能直接接受。")
                    target_mode = self._require_proposal_target_mode(
                        proposal_payload,
                        "发布建议缺少有效 target_mode，当前不能直接接受。",
                    )
                else:
                    target_mode = self._require_proposal_target_mode(
                        proposal_payload,
                        "提案缺少有效 target_mode，当前不能直接接受。",
                        default_mode=AccountMode.PAPER,
                    ) if proposal.proposal_type in {"param_update", "pause_resume", "risk_update", "script_patch_proposal"} else None

                if proposal.proposal_type == "script_patch_proposal":
                    manual_followup_detail = "脚本补丁提案已转成待处理 ChangeRequest，需后续人工或编排链落实。"
                    created_change_request = self._create_change_request_locked(
                        ChangeRequestCreate(
                            type="proposal.script_patch_proposal",
                            payload={"strategy_id": strategy_id, **proposal_payload, "proposal_id": proposal.id},
                            requested_by=payload.requested_by,
                            source_backtest_id=parent_review.backtest_id,
                            source_review_id=parent_review.id,
                            source_proposal_id=proposal.id,
                            trigger_reason="proposal_accept",
                            manual_followup_required=True,
                            manual_followup_detail=manual_followup_detail,
                            target_mode=target_mode or AccountMode.PAPER,
                            priority="high",
                            summary=self._build_script_patch_change_summary(proposal, proposal_payload),
                        )
                    )
                    self.add_event(
                        event_type="change_request.manual_followup_required",
                        source="desktop",
                        severity=EventSeverity.INFO,
                        payload={
                            "change_request_id": created_change_request.id,
                            "proposal_id": proposal.id,
                            "proposal_type": proposal.proposal_type,
                            "requested_by": payload.requested_by,
                            "detail": manual_followup_detail,
                        },
                        strategy_id=strategy_id,
                    )
                elif proposal.proposal_type in {"param_update", "pause_resume", "risk_update", "publish_recommendation"}:
                    created_change_request = self._create_change_request_locked(
                        ChangeRequestCreate(
                            type=f"proposal.{proposal.proposal_type}",
                            payload={"strategy_id": strategy_id, **proposal_payload, "proposal_id": proposal.id},
                            requested_by=payload.requested_by,
                            source_backtest_id=parent_review.backtest_id,
                            source_review_id=parent_review.id,
                            source_proposal_id=proposal.id,
                            trigger_reason="proposal_accept",
                            target_mode=target_mode or AccountMode.PAPER,
                            priority="high" if proposal.proposal_type != "publish_recommendation" else "normal",
                            summary=f"接受提案：{proposal.title}",
                        )
                    )
                    self._apply_change_request_locked(created_change_request)
                elif proposal.proposal_type == "backtest_request":
                    created_backtest = self._create_backtest_locked(
                        strategy_id=strategy_id,
                        data_range=str(proposal_payload.get("data_range", "2025-12-01 ~ 2026-03-29")),
                        timeframe=str(proposal_payload.get("timeframe", "1h")),
                        source_backtest_id=parent_review.backtest_id,
                        source_review_id=parent_review.id,
                        source_proposal_id=proposal.id,
                        trigger_reason="proposal_accept",
                    )
                    self._queue_backtest_review_locked(created_backtest, requested_by=payload.requested_by)
                proposal.status = "accepted"
            else:
                proposal.status = "rejected"

            self.add_event(
                event_type=f"strategy_proposal.{payload.action}ed",
                source="desktop",
                severity=EventSeverity.INFO if payload.action == "accept" else EventSeverity.WARNING,
                payload={
                    "proposal_id": proposal.id,
                    "proposal_type": proposal.proposal_type,
                    "requested_by": payload.requested_by,
                    "created_change_request_id": created_change_request.id if created_change_request else None,
                    "created_backtest_id": created_backtest.id if created_backtest else None,
                },
                strategy_id=proposal.strategy_id,
            )
            self._refresh_derived_state()
            self._persist()
            return StrategyProposalActionResult(
                proposal=proposal,
                created_change_request=created_change_request,
                created_backtest=created_backtest,
            )

    def apply_scheduler_command(self, command: SchedulerCommand) -> dict:
        with self._lock:
            scheduler = self.state.control_snapshot.scheduler
            result = {"status": "accepted", "command": command.command}
            target_job: Optional[AgentJob] = None
            cancelled_jobs: list[AgentJob] = []
            if command.command == SchedulerCommandType.PAUSE:
                scheduler.status = "paused"
            elif command.command == SchedulerCommandType.RESUME:
                scheduler.status = "running"
            elif command.command == SchedulerCommandType.CANCEL_JOB and command.job_id:
                for job in self.state.agent_jobs:
                    if job.id == command.job_id:
                        target_job = job
                        self._cancel_agent_job_locked(job, requested_by=command.requested_by, reason=command.reason)
                        cancelled_jobs.append(job)
                        break
            elif command.command == SchedulerCommandType.CANCEL_ALL:
                for job in self.state.agent_jobs:
                    if job.status not in {JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING}:
                        continue
                    if target_job is None:
                        target_job = job
                    self._cancel_agent_job_locked(job, requested_by=command.requested_by, reason=command.reason)
                    cancelled_jobs.append(job)
                scheduler.current_job_id = None
            elif command.command == SchedulerCommandType.FREEZE_PUBLISH:
                scheduler.freeze_publish = not scheduler.freeze_publish
                result["freeze_publish"] = scheduler.freeze_publish
            elif command.command == SchedulerCommandType.ENTER_MANUAL_OVERRIDE:
                scheduler.status = "manual_override"
                scheduler.freeze_publish = True
                if scheduler.current_job_id:
                    current = next((job for job in self.state.agent_jobs if job.id == scheduler.current_job_id), None)
                    if current is not None:
                        target_job = current
                        self._cancel_agent_job_locked(current, requested_by=command.requested_by, reason=command.reason)
                        cancelled_jobs.append(current)
            scheduler.last_heartbeat_at = now_iso()
            self._recompute_scheduler_queue_depth()
            command_event_payload = command.model_dump(mode="json")
            command_event_payload["scheduler_status"] = scheduler.status
            command_event_payload["freeze_publish"] = scheduler.freeze_publish
            if cancelled_jobs:
                command_event_payload["cancelled_job_ids"] = [job.id for job in cancelled_jobs]
                command_event_payload["cancelled_job_count"] = len(cancelled_jobs)
                self._enrich_agent_job_collection_payload(command_event_payload, cancelled_jobs, prefix="cancelled")
            if target_job is not None:
                self._enrich_agent_job_event_payload(command_event_payload, target_job)
            command_event_payload["summary"] = self._build_scheduler_command_summary(
                command=command,
                target_job=target_job,
                cancelled_jobs=cancelled_jobs,
                scheduler_status=scheduler.status,
                freeze_publish=scheduler.freeze_publish,
            )
            for key in (
                "summary",
                "scheduler_status",
                "freeze_publish",
                "job_id",
                "strategy_id",
                "review_id",
                "review_title",
                "review_period",
                "linked_review_id",
                "linked_review_title",
                "linked_review_period",
                "backtest_id",
                "source_change_request_id",
                "source_backtest_id",
                "source_review_id",
                "source_proposal_id",
                "trigger_reason",
                "decision_readiness",
                "decision_readiness_detail",
                "decision_recommended_data_range",
                "decision_recommended_timeframe",
                "decision_readiness_action",
                "cancelled_job_ids",
                "cancelled_job_count",
                "cancelled_job_types",
                "cancelled_strategy_ids",
                "cancelled_backtest_ids",
                "cancelled_source_change_request_ids",
                "cancelled_source_backtest_ids",
                "cancelled_source_review_ids",
                "cancelled_source_proposal_ids",
                "cancelled_trigger_reasons",
                "cancelled_decision_readiness_values",
            ):
                value = command_event_payload.get(key)
                if value is None:
                    continue
                if isinstance(value, list) and not value:
                    continue
                result[key] = value
            self.add_event(
                event_type="scheduler.command",
                source="desktop",
                severity=EventSeverity.WARNING
                if command.command in {SchedulerCommandType.CANCEL_ALL, SchedulerCommandType.ENTER_MANUAL_OVERRIDE}
                else EventSeverity.INFO,
                payload=command_event_payload,
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

            collapsed_candidates = self._dedupe_strings(payload.overview_collapsed_cards)
            collapsed_cards = [card_id for card_id in card_order if card_id in collapsed_candidates]
            editor_strategy_id = self._normalize_optional_string(payload.selected_strategy_editor_strategy_id)
            if editor_strategy_id is None and (
                payload.selected_strategy_detail_panel == "editor"
                or payload.selected_strategy_editor_parameter_drafts
                or payload.selected_strategy_editor_risk_budget_draft
            ):
                editor_strategy_id = self._normalize_optional_string(payload.selected_strategy_id)

            next_preferences = WorkspacePreferences(
                active_section=payload.active_section,
                layout_preset=payload.layout_preset,
                selected_mode=payload.selected_mode,
                selected_symbol=payload.selected_symbol,
                selected_market_timeframe=payload.selected_market_timeframe,
                selected_strategy_id=payload.selected_strategy_id,
                selected_backtest_id=self._normalize_optional_string(payload.selected_backtest_id),
                selected_scheduler_job_id=self._normalize_optional_string(payload.selected_scheduler_job_id),
                selected_strategy_detail_panel=payload.selected_strategy_detail_panel,
                selected_strategy_tracking_kind=payload.selected_strategy_tracking_kind,
                selected_strategy_tracking_summary=(
                    self._normalize_optional_string(payload.selected_strategy_tracking_summary) or ""
                ),
                selected_strategy_tracking_detail=(
                    self._normalize_optional_string(payload.selected_strategy_tracking_detail) or ""
                ),
                selected_strategy_editor_strategy_id=editor_strategy_id,
                selected_strategy_editor_parameter_drafts={
                    str(key).strip(): str(value)
                    for key, value in payload.selected_strategy_editor_parameter_drafts.items()
                    if str(key).strip()
                },
                selected_strategy_editor_risk_budget_draft=(
                    self._normalize_optional_string(payload.selected_strategy_editor_risk_budget_draft) or ""
                ),
                selected_review_inspector_id=self._normalize_optional_string(payload.selected_review_inspector_id),
                selected_review_inspector_strategy_id=self._normalize_optional_string(
                    payload.selected_review_inspector_strategy_id
                ),
                selected_review_id=self._normalize_optional_string(payload.selected_review_id),
                selected_proposal_id=self._normalize_optional_string(payload.selected_proposal_id),
                selected_change_request_id=self._normalize_optional_string(payload.selected_change_request_id),
                backtest_filter=payload.backtest_filter,
                replay_tracking_scope=payload.replay_tracking_scope,
                alert_severity_filter=payload.alert_severity_filter,
                alert_status_filter=payload.alert_status_filter,
                alert_scope_filter=payload.alert_scope_filter,
                trade_mode_filter=payload.trade_mode_filter,
                trade_origin_filter=payload.trade_origin_filter,
                trade_scope_filter=payload.trade_scope_filter,
                audit_severity_filter=payload.audit_severity_filter,
                audit_source_filter=self._normalize_workspace_filter_value(payload.audit_source_filter),
                audit_scope_filter=payload.audit_scope_filter,
                audit_search=self._normalize_optional_string(payload.audit_search) or "",
                overview_card_order=card_order,
                overview_visible_cards=visible_cards,
                overview_collapsed_cards=collapsed_cards,
                updated_at=now_iso(),
            )
            self.state.workspace_preferences = next_preferences
            self._sanitize_workspace_preferences_locked()
            persisted_preferences = self.state.workspace_preferences
            self.state.control_snapshot.scheduler.current_mode = persisted_preferences.selected_mode
            self._refresh_derived_state()
            self.add_event(
                event_type="workspace.preferences.updated",
                source="desktop",
                severity=EventSeverity.INFO,
                payload=persisted_preferences.model_dump(mode="json"),
                symbol=persisted_preferences.selected_symbol,
                strategy_id=persisted_preferences.selected_strategy_id,
            )
            self._persist()
            return persisted_preferences

    def add_watchlist_item(
        self,
        item: WatchlistInstrument,
        requested_by: str,
        detail_override: Optional[MarketDetail] = None,
    ) -> WatchlistInstrument:
        with self._lock:
            existing = next((entry for entry in self.state.watchlist if entry.symbol == item.symbol), None)
            if existing is not None:
                existing.market = item.market
                existing.last_price = item.last_price
                existing.change_24h = item.change_24h
                existing.volume_24h = item.volume_24h
                existing.signal = item.signal
                existing.position_side = item.position_side
                existing.risk_level = item.risk_level
                existing.alert_enabled = item.alert_enabled
                existing.alert_threshold_pct = item.alert_threshold_pct
                self._ensure_market_alert_rule_locked(existing)
                detail = detail_override or build_market_detail_for_watchlist(existing)
                self.state.market_details[item.symbol] = detail
                self.add_event(
                    event_type="watchlist.updated",
                    source="desktop",
                    severity=EventSeverity.INFO,
                    payload={"symbol": item.symbol, "market": item.market, "requested_by": requested_by},
                    symbol=item.symbol,
                )
                self._persist()
                return existing

            self.state.watchlist.append(item)
            self._ensure_market_alert_rule_locked(item)
            detail = detail_override or build_market_detail_for_watchlist(item)
            self.state.market_details[item.symbol] = detail
            self.add_event(
                event_type="watchlist.added",
                source="desktop",
                severity=EventSeverity.INFO,
                payload={"symbol": item.symbol, "market": item.market, "requested_by": requested_by},
                symbol=item.symbol,
            )
            self._persist()
            return item

    def remove_watchlist_item(self, symbol: str, requested_by: str) -> WatchlistRemoveResult:
        with self._lock:
            uppercase_symbol = symbol.upper()
            if len(self.state.watchlist) <= 1:
                raise ValueError("至少保留一个自选品种，当前不能删除最后一个。")

            target_index = next(
                (index for index, item in enumerate(self.state.watchlist) if item.symbol == uppercase_symbol),
                None,
            )
            if target_index is None:
                raise KeyError(uppercase_symbol)

            removed_item = self.state.watchlist.pop(target_index)
            self.state.market_details.pop(uppercase_symbol, None)
            self.state.alert_rules = [rule for rule in self.state.alert_rules if rule.symbol != uppercase_symbol]

            next_selected_symbol = self.state.workspace_preferences.selected_symbol
            if next_selected_symbol == uppercase_symbol:
                next_index = min(target_index, len(self.state.watchlist) - 1)
                next_selected_symbol = self.state.watchlist[next_index].symbol
                self.state.workspace_preferences.selected_symbol = next_selected_symbol
                self.state.workspace_preferences.updated_at = now_iso()

            self.add_event(
                event_type="watchlist.removed",
                source="desktop",
                severity=EventSeverity.WARNING,
                payload={"symbol": removed_item.symbol, "requested_by": requested_by},
                symbol=removed_item.symbol,
            )
            self._persist()
            return WatchlistRemoveResult(
                symbol=removed_item.symbol,
                removed=True,
                updated_at=now_iso(),
                next_selected_symbol=next_selected_symbol,
            )

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

    def get_paper_account_overview(self) -> AccountOverview:
        with self._lock:
            self._refresh_derived_state()
            overview = self._build_paper_account_overview_locked()
            return overview.model_copy(deep=True)

    def get_paper_positions(self) -> list[PositionRecord]:
        with self._lock:
            self._refresh_derived_state()
            return [item.model_copy(deep=True) for item in self._build_paper_positions_locked()]

    def get_paper_orders(self) -> list[OrderRecord]:
        with self._lock:
            self._refresh_derived_state()
            return [item.model_copy(deep=True) for item in self.state.paper_orders]

    def get_paper_order_history(self) -> list[OrderRecord]:
        with self._lock:
            self._refresh_derived_state()
            trade_records = [
                OrderRecord(
                    source="paper",
                    order_id=f"paper-order-{trade.id}",
                    symbol=trade.symbol,
                    market=trade.market,
                    side=trade.side,
                    order_type="Market",
                    qty=self._format_quantity(trade.quantity, 6),
                    price=self._format_ratio(trade.price),
                    status=trade.status.title().replace("_", ""),
                    created_at=trade.created_at,
                )
                for trade in sorted(
                    (
                        item
                        for item in self.state.trades
                        if item.mode == AccountMode.PAPER and item.status in {"filled", "partially_filled", "cancelled"}
                    ),
                    key=lambda item: self._parse_trade_time(item.created_at),
                    reverse=True,
                )
            ]
            combined: list[OrderRecord] = []
            seen_order_ids: set[str] = set()
            for item in [*self.state.paper_order_history, *trade_records]:
                if item.order_id in seen_order_ids:
                    continue
                seen_order_ids.add(item.order_id)
                combined.append(item)
            combined.sort(key=lambda item: self._parse_trade_time(item.created_at), reverse=True)
            return [item.model_copy(deep=True) for item in combined[:80]]

    def create_paper_order(self, payload: ManualOrderRequest) -> OrderRecord:
        with self._lock:
            blocked_reason = self._evaluate_paper_order_risk_locked(
                payload.symbol,
                payload.market,
                payload.side,
                payload.quantity,
                payload.price,
            )
            if blocked_reason is not None:
                self.add_event(
                    event_type="risk.blocked_order",
                    source="quant-core",
                    severity=EventSeverity.ERROR,
                    payload={
                        "symbol": payload.symbol,
                        "market": payload.market,
                        "mode": payload.mode.value,
                        "side": payload.side.value,
                        "quantity": payload.quantity,
                        "price": payload.price,
                        "reason": blocked_reason,
                        "stage": "paper_order_create",
                    },
                    symbol=payload.symbol,
                )
                self._persist()
                raise ValueError(blocked_reason)

            order = OrderRecord(
                source="paper",
                order_id=f"paper-order-{uuid4().hex[:8]}",
                symbol=payload.symbol.upper(),
                market=payload.market,
                side=payload.side,
                order_type="Limit",
                qty=self._format_quantity(payload.quantity, 6),
                price=self._format_ratio(payload.price),
                status="New",
                created_at=now_iso(),
            )
            self.state.paper_orders.insert(0, order)
            self.add_event(
                event_type="paper_order.placed",
                source="desktop",
                severity=EventSeverity.INFO,
                payload={
                    "order_id": order.order_id,
                    "symbol": order.symbol,
                    "market": order.market,
                    "side": order.side.value,
                    "quantity": payload.quantity,
                    "price": payload.price,
                    "note": payload.note,
                },
                symbol=order.symbol,
            )
            self._refresh_derived_state()
            self._persist()
            return order.model_copy(deep=True)

    def cancel_paper_order(self, order_id: str, requested_by: str) -> OrderRecord:
        with self._lock:
            target_index = next((index for index, item in enumerate(self.state.paper_orders) if item.order_id == order_id), None)
            if target_index is None:
                raise KeyError(order_id)

            order = self.state.paper_orders.pop(target_index)
            self._append_paper_order_history_locked(order, "Cancelled")
            self.add_event(
                event_type="paper_order.cancelled",
                source="desktop",
                severity=EventSeverity.WARNING,
                payload={
                    "order_id": order.order_id,
                    "symbol": order.symbol,
                    "requested_by": requested_by,
                },
                symbol=order.symbol,
            )
            self._refresh_derived_state()
            self._persist()
            return order.model_copy(update={"status": "Cancelled"}, deep=True)

    def replace_paper_order(self, order_id: str, quantity: float, price: float, requested_by: str) -> OrderRecord:
        with self._lock:
            target_index = next((index for index, item in enumerate(self.state.paper_orders) if item.order_id == order_id), None)
            if target_index is None:
                raise KeyError(order_id)

            order = self.state.paper_orders[target_index]
            blocked_reason = self._evaluate_paper_order_risk_locked(
                order.symbol,
                order.market,
                order.side,
                quantity,
                price,
                exclude_order_id=order_id,
            )
            if blocked_reason is not None:
                self.add_event(
                    event_type="risk.blocked_order",
                    source="quant-core",
                    severity=EventSeverity.ERROR,
                    payload={
                        "order_id": order.order_id,
                        "symbol": order.symbol,
                        "market": order.market,
                        "mode": AccountMode.PAPER.value,
                        "side": order.side.value,
                        "quantity": quantity,
                        "price": price,
                        "reason": blocked_reason,
                        "stage": "paper_order_replace",
                    },
                    symbol=order.symbol,
                )
                self._persist()
                raise ValueError(blocked_reason)

            updated_order = order.model_copy(
                update={
                    "qty": self._format_quantity(quantity, 6),
                    "price": self._format_ratio(price),
                    "status": "New",
                }
            )
            self.state.paper_orders[target_index] = updated_order
            self.add_event(
                event_type="paper_order.replaced",
                source="desktop",
                severity=EventSeverity.INFO,
                payload={
                    "order_id": updated_order.order_id,
                    "symbol": updated_order.symbol,
                    "requested_by": requested_by,
                    "quantity": quantity,
                    "price": price,
                },
                symbol=updated_order.symbol,
            )
            self._refresh_derived_state()
            current_order = next((item for item in self.state.paper_orders if item.order_id == order_id), None)
            if current_order is not None:
                result = current_order.model_copy(deep=True)
            else:
                history_order = next((item for item in self.state.paper_order_history if item.order_id == order_id), None)
                result = (history_order or updated_order).model_copy(deep=True)
            self._persist()
            return result

    def cancel_all_paper_orders(self, requested_by: str) -> dict[str, Any]:
        with self._lock:
            if not self.state.paper_orders:
                return {
                    "cancelled_count": 0,
                    "cancelled_order_ids": [],
                    "requested_by": requested_by,
                    "updated_at": now_iso(),
                }

            cancelled_orders = [item.model_copy(deep=True) for item in self.state.paper_orders]
            self.state.paper_orders = []
            for order in cancelled_orders:
                self._append_paper_order_history_locked(order, "Cancelled")

            self.add_event(
                event_type="paper_order.cancelled_all",
                source="desktop",
                severity=EventSeverity.WARNING,
                payload={
                    "requested_by": requested_by,
                    "cancelled_count": len(cancelled_orders),
                    "cancelled_order_ids": [item.order_id for item in cancelled_orders],
                },
            )
            self._refresh_derived_state()
            updated_at = now_iso()
            self._persist()
            return {
                "cancelled_count": len(cancelled_orders),
                "cancelled_order_ids": [item.order_id for item in cancelled_orders],
                "requested_by": requested_by,
                "updated_at": updated_at,
            }

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

    @staticmethod
    def _parse_percent_number(value: Any, default: float = 1.0) -> float:
        normalized = str(value if value is not None else default).replace("%", "").replace(",", "").strip()
        try:
            return max(float(normalized), 0.1)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def _get_strategy_parameter(strategy, key: str, default: Optional[float] = None) -> Optional[float]:
        parameter = next((item for item in strategy.parameters if item.key == key), None)
        if parameter is None:
            return default
        try:
            return float(parameter.value)
        except (TypeError, ValueError):
            return default

    def _strategy_cooldown_remaining_minutes_locked(self, strategy) -> Optional[int]:
        cooldown_minutes = self._get_strategy_parameter(strategy, "cooldown_minutes", 0.0) or 0.0
        if cooldown_minutes <= 0:
            return None
        latest_stop_loss = next(
            (
                event
                for event in self.state.audit_events
                if event.event_type == "strategy.paper_stop_loss.executed"
                and event.strategy_id == strategy.id
            ),
            None,
        )
        if latest_stop_loss is None:
            return None
        try:
            occurred_at = datetime.fromisoformat(latest_stop_loss.occurred_at)
        except ValueError:
            return None
        elapsed_minutes = (datetime.now(timezone.utc).astimezone() - occurred_at).total_seconds() / 60
        remaining = int(round(cooldown_minutes - elapsed_minutes))
        return remaining if remaining > 0 else None

    def _estimate_strategy_trade_quantity(self, strategy_id: str, price: float) -> float:
        strategy = self._find_strategy(strategy_id)
        risk_budget_pct = self._parse_percent_number(strategy.risk_budget, 1.0)
        base_notional = max(250.0, 6000.0 * (risk_budget_pct / 100.0))
        if price <= 0:
            return 0.0
        raw_qty = base_notional / price
        if price >= 1000:
            return round(raw_qty, 4)
        if price >= 10:
            return round(raw_qty, 3)
        return round(raw_qty, 2)

    def _resolve_strategy_target_signed_qty_locked(
        self,
        strategy,
        snapshot: StrategyRuntimeSnapshot,
    ) -> Optional[float]:
        base_quantity = max(self._estimate_strategy_trade_quantity(strategy.id, snapshot.last_price), 0.001)
        if snapshot.signal == "long":
            return base_quantity
        if snapshot.signal == "short":
            if snapshot.market == "spot":
                return 0.0
            return -base_quantity
        if snapshot.signal == "flat":
            return 0.0
        return None

    def _apply_strategy_risk_controls_locked(
        self,
        strategy,
        snapshot: StrategyRuntimeSnapshot,
    ) -> Optional[TradeRecord]:
        if not (strategy.mode == AccountMode.PAPER or strategy.status == "paper_only"):
            return None
        if snapshot.runtime_status == "paused":
            return None

        strategy_ledger = self._build_paper_strategy_ledger_locked(strategy.id)
        position = dict(strategy_ledger["positions"]).get(snapshot.symbol)
        if position is None:
            return None

        current_qty = float(position.get("qty") or 0.0)
        current_avg = float(position.get("avg_price") or 0.0)
        if abs(current_qty) <= 1e-9 or current_avg <= 0:
            return None

        stop_loss_pct = self._get_strategy_parameter(strategy, "stop_loss_pct")
        if stop_loss_pct is None or stop_loss_pct <= 0:
            return None

        stop_triggered = False
        if current_qty > 0 and snapshot.last_price <= current_avg * (1 - stop_loss_pct / 100):
            stop_triggered = True
        elif current_qty < 0 and snapshot.last_price >= current_avg * (1 + stop_loss_pct / 100):
            stop_triggered = True

        if not stop_triggered:
            return None

        record = TradeRecord(
            id=f"trade-{uuid4().hex[:6]}",
            symbol=snapshot.symbol,
            market=snapshot.market,
            mode=AccountMode.PAPER,
            origin="strategy",
            side=Direction.SELL if current_qty > 0 else Direction.BUY,
            quantity=abs(current_qty),
            price=round(snapshot.last_price, 6),
            pnl="--",
            strategy_id=strategy.id,
            created_at=now_iso(),
            status="filled",
        )
        self.state.trades.insert(0, record)
        self.add_event(
            event_type="strategy.paper_stop_loss.executed",
            source="quant-core",
            severity=EventSeverity.CRITICAL,
            payload={
                **record.model_dump(mode="json"),
                "stop_loss_pct": stop_loss_pct,
                "avg_price": current_avg,
                "last_price": snapshot.last_price,
            },
            symbol=snapshot.symbol,
            strategy_id=strategy.id,
        )
        self._upsert_system_alert_locked(
            rule_key=f"strategy-stop-loss:{strategy.id}:{snapshot.symbol}",
            severity="P0",
            symbol=snapshot.symbol,
            title=f"{strategy.name} 触发本地止损",
            description=(
                f"{snapshot.symbol} 当前参考价 {snapshot.last_price:.4f} 已触发 {stop_loss_pct:.2f}% 止损，"
                "系统已按当前持仓自动平仓。"
            ),
            suggested_action="打开策略页复核当前信号、止损参数与回测表现，必要时暂停该策略。",
            strategy_id=strategy.id,
        )
        return record

    def _create_strategy_trade_locked(
        self,
        strategy_id: str,
        symbol: str,
        market: str,
        side: Direction,
        price: float,
        note: str,
        quantity_override: Optional[float] = None,
        event_type: str = "strategy.paper_trade.executed",
        requested_by: Optional[str] = None,
    ) -> Optional[TradeRecord]:
        quantity = max(quantity_override or self._estimate_strategy_trade_quantity(strategy_id, price), 0.001)
        preview = self._build_execution_preview_locked(
            ExecutionPreviewRequest(
                symbol=symbol,
                market=market,
                mode=AccountMode.PAPER,
                side=side,
                quantity=quantity,
                price=price,
                origin="strategy",
                strategy_id=strategy_id,
                note=note,
            )
        )
        if not preview.allowed:
            strategy_name = strategy_id
            try:
                strategy_name = self._find_strategy(strategy_id).name
            except KeyError:
                pass
            self.add_event(
                event_type="risk.blocked_order",
                source="quant-core",
                severity=EventSeverity.ERROR,
                payload={
                    "strategy_id": strategy_id,
                    "symbol": symbol,
                    "market": market,
                    "side": side.value,
                    "quantity": quantity,
                    "price": price,
                    "reason": preview.blocked_reason,
                },
                symbol=symbol,
                strategy_id=strategy_id,
            )
            self._upsert_system_alert_locked(
                rule_key=f"strategy-risk:{strategy_id}:{symbol}",
                severity="P1",
                symbol=symbol,
                title=f"{strategy_name} 执行被风控拦截",
                description=preview.blocked_reason or "当前策略纸面执行未通过风控校验。",
                suggested_action="打开策略页查看当前 execution preview、Paper 余额与已有持仓，再决定是否手动处理。",
                strategy_id=strategy_id,
            )
            return None

        record = TradeRecord(
            id=f"trade-{uuid4().hex[:6]}",
            symbol=symbol,
            market=market,
            mode=AccountMode.PAPER,
            origin="strategy",
            side=side,
            quantity=quantity,
            price=round(price, 6),
            pnl="--",
            strategy_id=strategy_id,
            created_at=now_iso(),
            status="filled",
        )
        self.state.trades.insert(0, record)
        self.add_event(
            event_type=event_type,
            source="quant-core",
            severity=EventSeverity.INFO,
            payload={
                **record.model_dump(mode="json"),
                "note": note,
                "requested_by": requested_by,
            },
            symbol=symbol,
            strategy_id=strategy_id,
        )
        return record

    def _build_strategy_execution_preview_locked(
        self,
        strategy,
        snapshot: StrategyRuntimeSnapshot,
        previous: Optional[StrategyRuntimeSnapshot],
    ) -> Optional[ExecutionPreview]:
        if not (strategy.mode == AccountMode.PAPER or strategy.status == "paper_only"):
            return None
        if snapshot.runtime_status == "paused":
            return None
        if self._strategy_cooldown_remaining_minutes_locked(strategy) is not None:
            return None

        target_signed_qty = self._resolve_strategy_target_signed_qty_locked(strategy, snapshot)
        if target_signed_qty is None:
            return None

        strategy_ledger = self._build_paper_strategy_ledger_locked(strategy.id)
        strategy_position = dict(strategy_ledger["positions"]).get(snapshot.symbol, {})
        current_qty = float(strategy_position.get("qty") or 0.0)
        current_avg = float(strategy_position.get("avg_price") or 0.0)
        delta_qty = round(target_signed_qty - current_qty, 12)
        if abs(delta_qty) <= 1e-9:
            return None

        side = Direction.BUY if delta_qty > 0 else Direction.SELL
        quantity = abs(delta_qty)
        notional = quantity * snapshot.last_price
        account_ledger = self._build_paper_ledger_locked()
        cash_balance = float(account_ledger["cash_balance"])
        available_cash = max(cash_balance - self._paper_reserved_cash_locked(), 0.0)
        next_qty = current_qty + delta_qty
        close_qty = 0.0
        realized_on_fill = 0.0

        if current_qty != 0 and current_qty * delta_qty < 0:
            close_qty = min(abs(current_qty), abs(delta_qty))
            realized_on_fill = close_qty * (snapshot.last_price - current_avg) * (1 if current_qty > 0 else -1)

        if current_qty == 0 or current_qty * delta_qty > 0:
            total_size = abs(current_qty) + abs(delta_qty)
            projected_avg = (
                ((abs(current_qty) * current_avg) + (abs(delta_qty) * snapshot.last_price)) / total_size
                if total_size > 0
                else 0.0
            )
        elif abs(next_qty) <= 1e-9:
            projected_avg = 0.0
        elif current_qty * next_qty > 0:
            projected_avg = current_avg
        else:
            projected_avg = snapshot.last_price

        blocked_reason = self._evaluate_paper_order_risk_locked(
            snapshot.symbol,
            snapshot.market,
            side,
            quantity,
            snapshot.last_price,
        )
        warnings: list[str] = []
        if close_qty > 0:
            warnings.append("本次执行会先结算该策略自身的一部分已实现盈亏。")
        if current_qty != 0 and current_qty * next_qty < 0:
            warnings.append("本次执行会让该策略自身仓位发生反手。")
        if snapshot.market == "spot" and snapshot.signal == "short":
            warnings.append("现货模式不支持裸做空，short 信号会按减仓或清仓处理。")

        return ExecutionPreview(
            symbol=snapshot.symbol,
            market=snapshot.market,
            mode=AccountMode.PAPER,
            side=side,
            origin="strategy",
            strategy_id=strategy.id,
            quantity=quantity,
            price=snapshot.last_price,
            notional=self._format_usdt(notional),
            action=self._describe_execution_action_locked(snapshot.market, side, current_qty, next_qty),
            allowed=blocked_reason is None,
            blocked_reason=blocked_reason,
            warnings=warnings,
            current_position_side=self._classify_position_side(current_qty),
            current_position_size=self._format_quantity(abs(current_qty), 6),
            current_avg_price=self._format_ratio(current_avg) if abs(current_qty) > 1e-9 else "--",
            projected_position_side=self._classify_position_side(next_qty),
            projected_position_size=self._format_quantity(abs(next_qty), 6),
            projected_avg_price=self._format_ratio(projected_avg) if abs(next_qty) > 1e-9 else "--",
            available_balance_before=self._format_usdt(available_cash),
            available_balance_after=self._format_usdt(available_cash - (delta_qty * snapshot.last_price)),
            estimated_realized_pnl=self._format_usdt_delta(realized_on_fill) if close_qty > 0 else "--",
            generated_at=now_iso(),
        )

    def get_strategy_signal_order_hint(self, strategy_id: str) -> Dict[str, Any]:
        with self._lock:
            strategy = self._find_strategy(strategy_id)
            snapshot = next((item for item in self.state.strategy_runtime_snapshots if item.strategy_id == strategy_id), None)
            if snapshot is None:
                raise ValueError("当前策略运行态尚未准备好，请先刷新策略页后再试。")
            if snapshot.runtime_status == "paused":
                raise ValueError("当前策略已暂停，不能提交策略信号委托。")

            target_signed_qty = self._resolve_strategy_target_signed_qty_locked(strategy, snapshot)
            if target_signed_qty is None:
                raise ValueError("当前策略仍处于 watch 观察状态，暂时没有可提交的委托方向。")
            price = round(snapshot.reference_price or snapshot.last_price, 6)
            return {
                "strategy_id": strategy.id,
                "strategy_name": strategy.name,
                "symbol": snapshot.symbol,
                "market": snapshot.market,
                "signal": snapshot.signal,
                "risk_budget": strategy.risk_budget,
                "target_signed_qty": target_signed_qty,
                "price": price,
                "note": snapshot.next_action,
            }

    def update_strategy_runtime_snapshots(
        self,
        snapshots: list[StrategyRuntimeSnapshot],
    ) -> list[StrategyRuntimeSnapshot]:
        with self._lock:
            previous_by_id = {item.strategy_id: item for item in self.state.strategy_runtime_snapshots}
            changed = False
            next_snapshots: list[StrategyRuntimeSnapshot] = []

            for snapshot in snapshots:
                previous = previous_by_id.get(snapshot.strategy_id)
                strategy = self._find_strategy(snapshot.strategy_id)
                trade_record: Optional[TradeRecord] = None
                risk_trade_record = self._apply_strategy_risk_controls_locked(strategy, snapshot)
                if risk_trade_record is not None:
                    trade_record = risk_trade_record
                    execution_preview = None
                    snapshot = snapshot.model_copy(
                        update={
                            "note": f"{snapshot.note} 已触发本地止损并自动平仓。",
                            "next_action": "等待下一次信号切换，或先在策略页复核参数后再恢复人工执行。",
                        }
                    )
                else:
                    cooldown_remaining = self._strategy_cooldown_remaining_minutes_locked(strategy)
                    execution_preview = self._build_strategy_execution_preview_locked(strategy, snapshot, previous)
                    if cooldown_remaining is not None:
                        snapshot = snapshot.model_copy(
                            update={
                                "note": f"{snapshot.note} 当前处于止损后冷却期，剩余约 {cooldown_remaining} 分钟。",
                                "next_action": "冷却结束前不再给出可执行预估；可在策略页检查止损与冷却参数。",
                            }
                        )

                if trade_record is None and (strategy.mode == AccountMode.PAPER or strategy.status == "paper_only"):
                    previous_signal = previous.signal if previous else "flat"
                    if previous_signal != snapshot.signal and execution_preview is not None:
                        note = f"{snapshot.strategy_name} 信号切换至 {snapshot.signal}，按目标仓位差额执行纸面成交。"
                        if snapshot.signal == "flat":
                            note = f"{snapshot.strategy_name} 信号回到 flat，按当前剩余仓位纸面平仓。"
                        trade_record = self._create_strategy_trade_locked(
                            strategy_id=snapshot.strategy_id,
                            symbol=snapshot.symbol,
                            market=snapshot.market,
                            side=execution_preview.side,
                            price=execution_preview.price,
                            note=note,
                            quantity_override=execution_preview.quantity,
                        )

                if previous is None or previous.signal != snapshot.signal or previous.runtime_status != snapshot.runtime_status:
                    self.add_event(
                        event_type="strategy.runtime.signal_changed",
                        source="quant-core",
                        severity=EventSeverity.INFO,
                        payload={
                            "strategy_id": snapshot.strategy_id,
                            "strategy_name": snapshot.strategy_name,
                            "previous_signal": previous.signal if previous else None,
                            "signal": snapshot.signal,
                            "runtime_status": snapshot.runtime_status,
                            "confidence": snapshot.confidence,
                            "note": snapshot.note,
                            "next_action": snapshot.next_action,
                        },
                        symbol=snapshot.symbol,
                        strategy_id=snapshot.strategy_id,
                    )
                    changed = True
                    if self._sync_strategy_signal_alert_locked(strategy, snapshot, previous):
                        changed = True

                if trade_record is None and previous is not None:
                    snapshot = snapshot.model_copy(
                        update={
                            "last_trade_id": snapshot.last_trade_id or previous.last_trade_id,
                            "last_trade_at": snapshot.last_trade_at or previous.last_trade_at,
                            "execution_preview": execution_preview,
                        }
                    )
                elif trade_record is not None:
                    snapshot = snapshot.model_copy(
                        update={
                            "last_trade_id": trade_record.id,
                            "last_trade_at": trade_record.created_at,
                            "execution_preview": execution_preview,
                        }
                    )
                    changed = True
                else:
                    snapshot = snapshot.model_copy(update={"execution_preview": execution_preview})

                next_snapshots.append(snapshot)

            if len(next_snapshots) != len(self.state.strategy_runtime_snapshots):
                changed = True

            self.state.strategy_runtime_snapshots = next_snapshots
            self._refresh_derived_state()
            if changed:
                self._persist()
            return [item.model_copy(deep=True) for item in next_snapshots]

    def create_manual_trade(self, payload: ManualOrderRequest) -> TradeRecord:
        with self._lock:
            preview = self._build_execution_preview_locked(
                ExecutionPreviewRequest(
                    symbol=payload.symbol,
                    market=payload.market,
                    mode=payload.mode,
                    side=payload.side,
                    quantity=payload.quantity,
                    price=payload.price,
                    origin="manual",
                    note=payload.note,
                )
            )
            if not preview.allowed:
                self.add_event(
                    event_type="risk.blocked_order",
                    source="quant-core",
                    severity=EventSeverity.ERROR,
                    payload={
                        "symbol": payload.symbol,
                        "market": payload.market,
                        "mode": payload.mode.value,
                        "side": payload.side.value,
                        "quantity": payload.quantity,
                        "price": payload.price,
                        "reason": preview.blocked_reason,
                    },
                    symbol=payload.symbol,
                )
                self._persist()
                raise ValueError(preview.blocked_reason or "当前执行预检未通过。")

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
            self._refresh_derived_state()
            self._persist()
            return record

    def preview_execution(self, payload: ExecutionPreviewRequest) -> ExecutionPreview:
        with self._lock:
            return self._build_execution_preview_locked(payload)

    def close_paper_position(self, symbol: str, requested_by: str) -> TradeRecord:
        with self._lock:
            ledger_snapshot = self._build_paper_ledger_locked()
            position = dict(ledger_snapshot["positions"]).get(symbol.upper())
            if position is None or abs(float(position.get("qty") or 0.0)) < 1e-9:
                raise KeyError(symbol.upper())

            qty = float(position["qty"])
            price = self._resolve_mark_price_locked(str(position["symbol"]), float(position["avg_price"]))
            if price <= 0:
                raise ValueError("当前无法获取可用的平仓参考价，请稍后再试。")

            record = TradeRecord(
                id=f"trade-{uuid4().hex[:6]}",
                symbol=str(position["symbol"]),
                market=str(position["market"]),
                mode=AccountMode.PAPER,
                origin="manual",
                side=Direction.SELL if qty > 0 else Direction.BUY,
                quantity=abs(qty),
                price=price,
                pnl="--",
                strategy_id=None,
                created_at=now_iso(),
                status="filled",
            )
            self.state.trades.insert(0, record)
            self.add_event(
                event_type="manual_trade.position_closed",
                source="desktop",
                severity=EventSeverity.INFO,
                payload={
                    "requested_by": requested_by,
                    **record.model_dump(mode="json"),
                },
                symbol=record.symbol,
            )
            self._refresh_derived_state()
            self._persist()
            return record

    def close_all_paper_positions(self, requested_by: str) -> dict[str, Any]:
        with self._lock:
            ledger_snapshot = self._build_paper_ledger_locked()
            positions = [
                item
                for item in dict(ledger_snapshot["positions"]).values()
                if abs(float(item.get("qty") or 0.0)) >= 1e-9
            ]
            if not positions:
                return {
                    "closed_count": 0,
                    "trade_ids": [],
                    "requested_by": requested_by,
                    "updated_at": now_iso(),
                }

            trades: list[TradeRecord] = []
            for position in positions:
                qty = float(position["qty"])
                price = self._resolve_mark_price_locked(str(position["symbol"]), float(position["avg_price"]))
                if price <= 0:
                    continue
                record = TradeRecord(
                    id=f"trade-{uuid4().hex[:6]}",
                    symbol=str(position["symbol"]),
                    market=str(position["market"]),
                    mode=AccountMode.PAPER,
                    origin="manual",
                    side=Direction.SELL if qty > 0 else Direction.BUY,
                    quantity=abs(qty),
                    price=price,
                    pnl="--",
                    strategy_id=None,
                    created_at=now_iso(),
                    status="filled",
                )
                self.state.trades.insert(0, record)
                trades.append(record)

            if trades:
                self.add_event(
                    event_type="manual_trade.positions_closed_all",
                    source="desktop",
                    severity=EventSeverity.INFO,
                    payload={
                        "requested_by": requested_by,
                        "closed_count": len(trades),
                        "trade_ids": [item.id for item in trades],
                        "symbols": [item.symbol for item in trades],
                    },
                )
                self._refresh_derived_state()
                self._persist()

            return {
                "closed_count": len(trades),
                "trade_ids": [item.id for item in trades],
                "requested_by": requested_by,
                "updated_at": now_iso(),
            }

    def execute_strategy_signal(self, strategy_id: str, requested_by: str, note: Optional[str] = None) -> TradeRecord:
        with self._lock:
            strategy = self._find_strategy(strategy_id)
            if not (strategy.mode == AccountMode.PAPER or strategy.status == "paper_only"):
                raise ValueError("当前仅允许执行 Paper / 仅模拟盘策略的纸面信号。")

            snapshot = next((item for item in self.state.strategy_runtime_snapshots if item.strategy_id == strategy_id), None)
            if snapshot is None:
                raise ValueError("当前策略运行态尚未准备好，请先刷新策略页后再试。")
            if snapshot.runtime_status == "paused":
                raise ValueError("当前策略已暂停，不能执行纸面信号。")

            preview = snapshot.execution_preview
            if preview is None:
                raise ValueError("当前策略没有可执行的纸面预估。")
            if not preview.allowed:
                raise ValueError(preview.blocked_reason or "当前策略纸面执行预估未通过。")

            trade = self._create_strategy_trade_locked(
                strategy_id=strategy_id,
                symbol=snapshot.symbol,
                market=snapshot.market,
                side=preview.side,
                price=preview.price,
                quantity_override=preview.quantity,
                note=note or snapshot.next_action or f"{snapshot.strategy_name} 人工执行当前纸面信号。",
                event_type="strategy.paper_trade.executed_manual",
                requested_by=requested_by,
            )
            if trade is None:
                raise ValueError("当前策略纸面执行被风控拦截。")

            next_snapshots: list[StrategyRuntimeSnapshot] = []
            for item in self.state.strategy_runtime_snapshots:
                if item.strategy_id == strategy_id:
                    next_snapshots.append(
                        item.model_copy(
                            update={
                                "last_trade_id": trade.id,
                                "last_trade_at": trade.created_at,
                            }
                        )
                    )
                else:
                    next_snapshots.append(item)
            self.state.strategy_runtime_snapshots = next_snapshots
            self._refresh_derived_state()
            self._persist()
            return trade.model_copy(deep=True)

    def apply_reconcile_change_request_outcome(
        self,
        change_request_id: str,
        outcome: Any,
        *,
        source: str = "openclaw",
    ) -> Optional[ChangeRequest]:
        """Persist a structured ``reconcile_change_request`` outcome onto a ChangeRequest.

        The outcome may be a ``ReconcileChangeRequestOutcome`` pydantic model or
        any object exposing the matching attributes (``summary``, ``landed``,
        ``needs_manual_review``, ``needs_manual_review_detail``, ``next_actions``).
        The call is idempotent: re-applying the same outcome will only update
        ``updated_at`` and any fields that changed.
        """

        key = str(change_request_id or "").strip()
        if not key:
            return None

        summary = str(getattr(outcome, "summary", "") or "").strip()
        landed = getattr(outcome, "landed", None)
        needs_manual = getattr(outcome, "needs_manual_review", None)
        manual_detail_raw = getattr(outcome, "needs_manual_review_detail", None)
        manual_detail = str(manual_detail_raw).strip() if manual_detail_raw else None
        next_actions_raw = getattr(outcome, "next_actions", None) or []
        next_actions: list[str] = []
        if isinstance(next_actions_raw, list):
            for item in next_actions_raw:
                text = str(item).strip()
                if text:
                    next_actions.append(text)
                if len(next_actions) >= 6:
                    break

        with self._lock:
            record = next((item for item in self.state.change_requests if item.id == key), None)
            if record is None:
                return None

            previous_manual_required = record.manual_followup_required
            previous_manual_detail = record.manual_followup_detail
            previous_result_summary = record.follow_up_result_summary

            if needs_manual is True:
                record.manual_followup_required = True
                if manual_detail:
                    record.manual_followup_detail = manual_detail
                elif summary and not record.manual_followup_detail:
                    record.manual_followup_detail = summary[:160]
            elif needs_manual is False:
                record.manual_followup_required = False
                # Clear any stale detail once the agent confirmed no human action is needed.
                record.manual_followup_detail = None

            if summary:
                record.follow_up_result_summary = summary[:160]

            record.updated_at = now_iso()

            manual_required_changed = record.manual_followup_required != previous_manual_required
            manual_detail_changed = record.manual_followup_detail != previous_manual_detail
            summary_changed = record.follow_up_result_summary != previous_result_summary

            event_payload: Dict[str, Any] = {
                "change_request_id": record.id,
                "summary": summary or record.summary,
                "landed": landed,
                "needs_manual_review": needs_manual,
                "needs_manual_review_detail": manual_detail,
                "next_actions": next_actions,
                "manual_followup_required": record.manual_followup_required,
                "manual_followup_detail": record.manual_followup_detail,
                "source": source,
            }
            self.add_event(
                event_type="change_request.reconcile_outcome",
                source=source,
                severity=EventSeverity.INFO,
                payload=event_payload,
                strategy_id=record.payload.get("strategy_id") if isinstance(record.payload, dict) else None,
                symbol=record.payload.get("symbol") if isinstance(record.payload, dict) else None,
            )

            if manual_required_changed or manual_detail_changed or summary_changed:
                self._persist()

            return record.model_copy(deep=True)

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

from datetime_utils import parse_optional_iso_datetime
from models import (
    AgentJob,
    AlertRecord,
    BacktestRun,
    ChangeRequest,
    ExecutionEvent,
    OrderRecord,
    ReviewDocument,
    StrategyActivityJobSummary,
    StrategyActivityReviewSummary,
    StrategyProposal,
    TradeRecord,
)
from strategy_activity_decision import (
    StrategyActivityDecisionSectionsBundle,
    build_strategy_activity_backtest_decision_context_payload,
    build_strategy_activity_backtest_sections_payload,
    build_strategy_activity_change_request_decision_context_payload,
    build_strategy_activity_change_request_sections_payload,
    build_strategy_activity_decision_sections_bundle,
    build_strategy_activity_proposal_decision_context_payload,
    build_strategy_activity_proposal_sections_payload,
    build_strategy_activity_review_decision_context_payload,
    build_strategy_activity_review_sections_payload,
    build_strategy_activity_tracking_decision_context_payload,
    build_strategy_activity_tracking_sections_payload,
)
from strategy_activity_latest_ops import (
    StrategyActivityLatestOpsSnapshot,
    build_strategy_activity_latest_ops,
)
from strategy_activity_lineage import (
    StrategyActivityLineageContext,
    StrategyActivityLineageMaps,
    build_strategy_activity_lineage_context,
    build_strategy_activity_lineage_maps,
)
from strategy_activity_summary import StrategyActivitySummaryCollections


@dataclass(frozen=True)
class StrategyActivityRecentData:
    active_orders: List[OrderRecord]
    recent_orders: List[OrderRecord]
    recent_trades: List[TradeRecord]
    recent_alerts: List[AlertRecord]
    recent_audit_events: List[ExecutionEvent]
    recent_review_records: List[ReviewDocument]
    recent_proposals: List[StrategyProposal]
    strategy_proposal_count_by_review_id: Dict[str, int]
    recent_change_requests: List[ChangeRequest]
    recent_backtest_records: List[BacktestRun]
    recent_agent_job_records: List[AgentJob]


@dataclass(frozen=True)
class StrategyActivityPayloadLineageAssemblies:
    decision_sections: StrategyActivityDecisionSectionsBundle
    lineage_context: StrategyActivityLineageContext


@dataclass(frozen=True)
class StrategyActivityPayloadAssemblies:
    latest_ops: StrategyActivityLatestOpsSnapshot
    decision_sections: StrategyActivityDecisionSectionsBundle
    lineage_context: StrategyActivityLineageContext
    recent_proposals: List[StrategyProposal]
    recent_change_requests: List[ChangeRequest]


def build_strategy_activity_recent_data(
    *,
    strategy_id: str,
    active_orders: List[OrderRecord],
    recent_orders: List[OrderRecord],
    recent_trades: List[TradeRecord],
    recent_alerts: List[AlertRecord],
    recent_audit_events: List[ExecutionEvent],
    reviews: List[ReviewDocument],
    change_requests: List[ChangeRequest],
    backtests: List[BacktestRun],
    agent_jobs: List[AgentJob],
) -> StrategyActivityRecentData:
    recent_review_records: List[ReviewDocument] = []
    recent_proposals: List[StrategyProposal] = []
    strategy_proposal_count_by_review_id: Dict[str, int] = {}
    for review in reviews:
        strategy_review_proposals = [proposal for proposal in review.proposals if proposal.strategy_id == strategy_id]
        if review.strategy_id != strategy_id and not strategy_review_proposals:
            continue
        recent_review_records.append(review)
        recent_proposals.extend(strategy_review_proposals)
        strategy_proposal_count_by_review_id[review.id] = len(strategy_review_proposals)

    recent_review_records.sort(key=lambda item: item.created_at, reverse=True)
    recent_proposals.sort(key=lambda item: item.created_at, reverse=True)
    recent_change_requests = [
        item for item in change_requests if (str(item.payload.get("strategy_id") or "") == strategy_id)
    ]
    recent_change_requests.sort(key=lambda item: item.updated_at or item.created_at, reverse=True)
    recent_backtest_records = [item for item in backtests if item.strategy_id == strategy_id]
    recent_backtest_records.sort(key=lambda item: item.finished_at or item.started_at, reverse=True)
    recent_agent_job_records = [item for item in agent_jobs if str(item.context.get("strategy_id") or "") == strategy_id]
    recent_agent_job_records.sort(key=lambda item: item.updated_at or item.created_at, reverse=True)
    active_orders.sort(key=lambda item: parse_optional_iso_datetime(item.created_at), reverse=True)
    recent_orders.sort(key=lambda item: parse_optional_iso_datetime(item.created_at), reverse=True)
    recent_trades.sort(key=lambda item: parse_optional_iso_datetime(item.created_at), reverse=True)
    recent_alerts.sort(key=lambda item: parse_optional_iso_datetime(item.triggered_at), reverse=True)
    recent_audit_events.sort(key=lambda item: parse_optional_iso_datetime(item.occurred_at), reverse=True)
    return StrategyActivityRecentData(
        active_orders=active_orders,
        recent_orders=recent_orders,
        recent_trades=recent_trades,
        recent_alerts=recent_alerts,
        recent_audit_events=recent_audit_events,
        recent_review_records=recent_review_records,
        recent_proposals=recent_proposals,
        strategy_proposal_count_by_review_id=strategy_proposal_count_by_review_id,
        recent_change_requests=recent_change_requests,
        recent_backtest_records=recent_backtest_records,
        recent_agent_job_records=recent_agent_job_records,
    )


def assemble_strategy_activity_decision_context_payload(
    *,
    latest_proposal_backtest_record: Optional[BacktestRun],
    latest_proposal_review_record: Optional[ReviewDocument],
    latest_proposal_job_record: Optional[AgentJob],
    latest_actionable_proposal_backtest_record: Optional[BacktestRun],
    latest_actionable_proposal_review_record: Optional[ReviewDocument],
    latest_actionable_proposal_job_record: Optional[AgentJob],
    latest_change_request_backtest_record: Optional[BacktestRun],
    latest_change_request_review_record: Optional[ReviewDocument],
    latest_change_request_job_record: Optional[AgentJob],
    latest_change_request_source_backtest_record: Optional[BacktestRun],
    latest_change_request_source_review_record: Optional[ReviewDocument],
    latest_change_request_source_proposal_record: Optional[StrategyProposal],
    latest_actionable_change_request_backtest_record: Optional[BacktestRun],
    latest_actionable_change_request_review_record: Optional[ReviewDocument],
    latest_actionable_change_request_job_record: Optional[AgentJob],
    latest_actionable_change_request_source_backtest_record: Optional[BacktestRun],
    latest_actionable_change_request_source_review_record: Optional[ReviewDocument],
    latest_actionable_change_request_source_proposal_record: Optional[StrategyProposal],
    latest_backtest_record: Optional[BacktestRun],
    latest_actionable_backtest_record: Optional[BacktestRun],
    latest_backtest_review_record: Optional[ReviewDocument],
    latest_backtest_job_record: Optional[AgentJob],
    latest_actionable_backtest_review_record: Optional[ReviewDocument],
    latest_actionable_backtest_job_record: Optional[AgentJob],
    latest_primary_review_record: Optional[ReviewDocument],
    latest_actionable_primary_review_record: Optional[ReviewDocument],
    latest_tracking_review_record: Optional[ReviewDocument],
    latest_tracking_job_record: Optional[AgentJob],
    latest_retryable_job: Optional[StrategyActivityJobSummary],
    latest_retryable_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "proposal": build_strategy_activity_proposal_decision_context_payload(
            latest_backtest_record=latest_proposal_backtest_record,
            latest_review_record=latest_proposal_review_record,
            latest_job_record=latest_proposal_job_record,
            actionable_backtest_record=latest_actionable_proposal_backtest_record,
            actionable_review_record=latest_actionable_proposal_review_record,
            actionable_job_record=latest_actionable_proposal_job_record,
        ),
        "change_request": build_strategy_activity_change_request_decision_context_payload(
            latest_backtest_record=latest_change_request_backtest_record,
            latest_review_record=latest_change_request_review_record,
            latest_job_record=latest_change_request_job_record,
            latest_source_backtest_record=latest_change_request_source_backtest_record,
            latest_source_review_record=latest_change_request_source_review_record,
            latest_source_proposal_record=latest_change_request_source_proposal_record,
            actionable_backtest_record=latest_actionable_change_request_backtest_record,
            actionable_review_record=latest_actionable_change_request_review_record,
            actionable_job_record=latest_actionable_change_request_job_record,
            actionable_source_backtest_record=latest_actionable_change_request_source_backtest_record,
            actionable_source_review_record=latest_actionable_change_request_source_review_record,
            actionable_source_proposal_record=latest_actionable_change_request_source_proposal_record,
        ),
        "backtest": build_strategy_activity_backtest_decision_context_payload(
            latest_record=latest_backtest_record,
            actionable_record=latest_actionable_backtest_record,
            latest_review_record=latest_backtest_review_record,
            latest_job_record=latest_backtest_job_record,
            actionable_review_record=latest_actionable_backtest_review_record,
            actionable_job_record=latest_actionable_backtest_job_record,
        ),
        "review": build_strategy_activity_review_decision_context_payload(
            latest_primary_record=latest_primary_review_record,
            latest_actionable_primary_record=latest_actionable_primary_review_record,
        ),
        "tracking": build_strategy_activity_tracking_decision_context_payload(
            latest_review_record=latest_tracking_review_record,
            latest_job_record=latest_tracking_job_record,
            latest_retryable_job=latest_retryable_job,
            latest_retryable_job_record=latest_retryable_job_record,
        ),
    }


def assemble_strategy_activity_sections_payload(
    *,
    latest_backtest: Optional[Any],
    latest_actionable_backtest: Optional[Any],
    latest_backtest_record: Optional[BacktestRun],
    latest_actionable_backtest_record: Optional[BacktestRun],
    latest_backtest_review: Optional[StrategyActivityReviewSummary],
    latest_backtest_job: Optional[StrategyActivityJobSummary],
    latest_actionable_backtest_review: Optional[StrategyActivityReviewSummary],
    latest_actionable_backtest_job: Optional[StrategyActivityJobSummary],
    latest_backtest_review_record: Optional[ReviewDocument],
    latest_backtest_job_record: Optional[AgentJob],
    latest_actionable_backtest_review_record: Optional[ReviewDocument],
    latest_actionable_backtest_job_record: Optional[AgentJob],
    latest_primary_review: Optional[StrategyActivityReviewSummary],
    latest_actionable_primary_review: Optional[StrategyActivityReviewSummary],
    latest_primary_review_record: Optional[ReviewDocument],
    latest_actionable_primary_review_record: Optional[ReviewDocument],
    latest_tracking_review: Optional[StrategyActivityReviewSummary],
    latest_tracking_job: Optional[StrategyActivityJobSummary],
    latest_tracking_review_record: Optional[ReviewDocument],
    latest_tracking_job_record: Optional[AgentJob],
    latest_proposal: Optional[StrategyProposal],
    latest_actionable_proposal: Optional[StrategyProposal],
    latest_proposal_change_request: Optional[Any],
    latest_proposal_backtest: Optional[Any],
    latest_proposal_review: Optional[StrategyActivityReviewSummary],
    latest_proposal_job: Optional[StrategyActivityJobSummary],
    latest_proposal_backtest_record: Optional[BacktestRun],
    latest_proposal_review_record: Optional[ReviewDocument],
    latest_proposal_job_record: Optional[AgentJob],
    latest_actionable_proposal_change_request: Optional[Any],
    latest_actionable_proposal_backtest: Optional[Any],
    latest_actionable_proposal_review: Optional[StrategyActivityReviewSummary],
    latest_actionable_proposal_job: Optional[StrategyActivityJobSummary],
    latest_actionable_proposal_backtest_record: Optional[BacktestRun],
    latest_actionable_proposal_review_record: Optional[ReviewDocument],
    latest_actionable_proposal_job_record: Optional[AgentJob],
    latest_change_request: Optional[Any],
    latest_actionable_change_request: Optional[Any],
    latest_change_request_backtest_record: Optional[BacktestRun],
    latest_change_request_review_record: Optional[ReviewDocument],
    latest_change_request_job_record: Optional[AgentJob],
    latest_change_request_source_backtest_record: Optional[BacktestRun],
    latest_change_request_source_review_record: Optional[ReviewDocument],
    latest_change_request_source_proposal_record: Optional[StrategyProposal],
    latest_actionable_change_request_backtest_record: Optional[BacktestRun],
    latest_actionable_change_request_review_record: Optional[ReviewDocument],
    latest_actionable_change_request_job_record: Optional[AgentJob],
    latest_actionable_change_request_source_backtest_record: Optional[BacktestRun],
    latest_actionable_change_request_source_review_record: Optional[ReviewDocument],
    latest_actionable_change_request_source_proposal_record: Optional[StrategyProposal],
    latest_retryable_tracking_job: Optional[StrategyActivityJobSummary],
    latest_retryable_tracking_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "proposal": build_strategy_activity_proposal_sections_payload(
            latest=latest_proposal,
            latest_actionable=latest_actionable_proposal,
            latest_change_request=latest_proposal_change_request,
            latest_backtest=latest_proposal_backtest,
            latest_review=latest_proposal_review,
            latest_job=latest_proposal_job,
            latest_backtest_record=latest_proposal_backtest_record,
            latest_review_record=latest_proposal_review_record,
            latest_job_record=latest_proposal_job_record,
            latest_actionable_change_request=latest_actionable_proposal_change_request,
            latest_actionable_backtest=latest_actionable_proposal_backtest,
            latest_actionable_review=latest_actionable_proposal_review,
            latest_actionable_job=latest_actionable_proposal_job,
            latest_actionable_backtest_record=latest_actionable_proposal_backtest_record,
            latest_actionable_review_record=latest_actionable_proposal_review_record,
            latest_actionable_job_record=latest_actionable_proposal_job_record,
        ),
        "change_request": build_strategy_activity_change_request_sections_payload(
            latest=latest_change_request,
            latest_actionable=latest_actionable_change_request,
            latest_backtest_record=latest_change_request_backtest_record,
            latest_review_record=latest_change_request_review_record,
            latest_job_record=latest_change_request_job_record,
            latest_source_backtest_record=latest_change_request_source_backtest_record,
            latest_source_review_record=latest_change_request_source_review_record,
            latest_source_proposal_record=latest_change_request_source_proposal_record,
            latest_actionable_backtest_record=latest_actionable_change_request_backtest_record,
            latest_actionable_review_record=latest_actionable_change_request_review_record,
            latest_actionable_job_record=latest_actionable_change_request_job_record,
            latest_actionable_source_backtest_record=latest_actionable_change_request_source_backtest_record,
            latest_actionable_source_review_record=latest_actionable_change_request_source_review_record,
            latest_actionable_source_proposal_record=latest_actionable_change_request_source_proposal_record,
        ),
        "backtest": build_strategy_activity_backtest_sections_payload(
            latest=latest_backtest,
            latest_actionable=latest_actionable_backtest,
            latest_record=latest_backtest_record,
            latest_actionable_record=latest_actionable_backtest_record,
            latest_review=latest_backtest_review,
            latest_job=latest_backtest_job,
            latest_actionable_review=latest_actionable_backtest_review,
            latest_actionable_job=latest_actionable_backtest_job,
            latest_review_record=latest_backtest_review_record,
            latest_job_record=latest_backtest_job_record,
            latest_actionable_review_record=latest_actionable_backtest_review_record,
            latest_actionable_job_record=latest_actionable_backtest_job_record,
        ),
        "review": build_strategy_activity_review_sections_payload(
            latest_primary=latest_primary_review,
            latest_actionable_primary=latest_actionable_primary_review,
            latest_tracking=latest_tracking_review,
            latest_primary_record=latest_primary_review_record,
            latest_actionable_primary_record=latest_actionable_primary_review_record,
            latest_tracking_record=latest_tracking_review_record,
        ),
        "tracking": build_strategy_activity_tracking_sections_payload(
            latest_review=latest_tracking_review,
            latest_job=latest_tracking_job,
            latest_retryable_job=latest_retryable_tracking_job,
            latest_review_record=latest_tracking_review_record,
            latest_job_record=latest_tracking_job_record,
            latest_retryable_job_record=latest_retryable_tracking_job_record,
        ),
    }


def build_strategy_activity_payload_lineage_assemblies(
    *,
    recent_data: StrategyActivityRecentData,
    summary_collections: StrategyActivitySummaryCollections,
    recent_change_requests: List[ChangeRequest],
    has_backtest_rerun_recommendation: Callable[[BacktestRun], bool],
    has_change_request_rerun_recommendation: Callable[[ChangeRequest, StrategyActivityLineageMaps], bool],
) -> StrategyActivityPayloadLineageAssemblies:
    lineage_maps = build_strategy_activity_lineage_maps(
        recent_change_requests=recent_change_requests,
        recent_backtests=summary_collections.recent_backtests,
        recent_backtest_records=recent_data.recent_backtest_records,
        recent_reviews=summary_collections.recent_reviews,
        recent_review_records=recent_data.recent_review_records,
        recent_agent_jobs=summary_collections.recent_agent_jobs,
        recent_agent_job_records=recent_data.recent_agent_job_records,
        recent_proposals=recent_data.recent_proposals,
    )
    lineage_context = build_strategy_activity_lineage_context(
        recent_backtest_records=recent_data.recent_backtest_records,
        recent_backtests=summary_collections.recent_backtests,
        recent_primary_review_summaries=summary_collections.recent_primary_review_summaries,
        latest_actionable_primary_review=summary_collections.latest_actionable_primary_review,
        recent_tracking_review_records=summary_collections.recent_tracking_review_records,
        latest_tracking_job=summary_collections.latest_tracking_job,
        recent_proposals=recent_data.recent_proposals,
        recent_change_requests=recent_change_requests,
        latest_retryable_tracking_job=summary_collections.latest_retryable_tracking_job,
        latest_retryable_tracking_job_record=summary_collections.latest_retryable_tracking_job_record,
        maps=lineage_maps,
        has_backtest_rerun_recommendation=has_backtest_rerun_recommendation,
        has_change_request_rerun_recommendation=has_change_request_rerun_recommendation,
    )
    return StrategyActivityPayloadLineageAssemblies(
        decision_sections=build_strategy_activity_decision_sections_bundle(
            lineage_context=lineage_context,
            latest_tracking_job=summary_collections.latest_tracking_job,
        ),
        lineage_context=lineage_context,
    )


def build_strategy_activity_payload_assemblies(
    *,
    recent_data: StrategyActivityRecentData,
    summary_collections: StrategyActivitySummaryCollections,
    has_backtest_rerun_recommendation: Callable[[BacktestRun], bool],
    has_change_request_rerun_recommendation: Callable[[ChangeRequest, StrategyActivityLineageMaps], bool],
) -> StrategyActivityPayloadAssemblies:
    recent_proposals = recent_data.recent_proposals
    recent_change_requests = recent_data.recent_change_requests
    latest_ops = build_strategy_activity_latest_ops(recent_data)
    lineage_assemblies = build_strategy_activity_payload_lineage_assemblies(
        recent_data=recent_data,
        summary_collections=summary_collections,
        recent_change_requests=recent_change_requests,
        has_backtest_rerun_recommendation=has_backtest_rerun_recommendation,
        has_change_request_rerun_recommendation=has_change_request_rerun_recommendation,
    )
    return StrategyActivityPayloadAssemblies(
        latest_ops=latest_ops,
        decision_sections=lineage_assemblies.decision_sections,
        lineage_context=lineage_assemblies.lineage_context,
        recent_proposals=recent_proposals,
        recent_change_requests=recent_change_requests,
    )

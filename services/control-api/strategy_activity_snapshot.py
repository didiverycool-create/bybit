from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from models import (
    ChangeRequest,
    StrategyActivityBacktestSummary,
    StrategyActivityDecisionContext,
    StrategyActivityJobSummary,
    StrategyActivityLatestRuntimeSnapshot,
    StrategyActivityReviewSummary,
    StrategyActivitySections,
    StrategyActivitySnapshot,
    StrategyProposal,
    StrategyRuntimeSnapshot,
)
from strategy_activity_decision import StrategyActivityDecisionSectionsBundle
from strategy_activity_latest_ops import StrategyActivityLatestOpsSnapshot
from strategy_activity_lineage import StrategyActivityLineageContext
from strategy_activity_payload import StrategyActivityRecentData


def build_strategy_activity_snapshot_core_kwargs(
    *,
    strategy: Any,
    symbol: str,
    market: str,
    runtime: Optional[StrategyRuntimeSnapshot],
    latest_runtime: StrategyActivityLatestRuntimeSnapshot,
    latest_ops: StrategyActivityLatestOpsSnapshot,
    decision_context: Optional[StrategyActivityDecisionContext],
    activity_sections: Optional[StrategyActivitySections],
) -> Dict[str, Any]:
    return {
        "strategy_id": strategy.id,
        "strategy_name": strategy.name,
        "symbol": symbol,
        "market": market,
        "mode": strategy.mode,
        "runtime": runtime,
        "latest_runtime": latest_runtime,
        "latest_ops": latest_ops,
        "decision_context": decision_context,
        "activity_sections": activity_sections,
    }


def build_strategy_activity_snapshot_generated_at() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()


def build_strategy_activity_backtest_lineage_snapshot_kwargs(
    *,
    lineage_context: StrategyActivityLineageContext,
) -> Dict[str, Any]:
    latest_backtest_linkage = lineage_context.latest_backtest_linkage
    latest_actionable_backtest_linkage = lineage_context.latest_actionable_backtest_linkage
    return {
        "latest_backtest": lineage_context.latest_backtest,
        "latest_actionable_backtest": lineage_context.latest_actionable_backtest,
        "latest_backtest_record": lineage_context.latest_backtest_record,
        "latest_actionable_backtest_record": lineage_context.latest_actionable_backtest_record,
        "latest_backtest_review": latest_backtest_linkage.review,
        "latest_backtest_job": latest_backtest_linkage.job,
        "latest_actionable_backtest_review": latest_actionable_backtest_linkage.review,
        "latest_actionable_backtest_job": latest_actionable_backtest_linkage.job,
        "latest_backtest_review_record": latest_backtest_linkage.review_record,
        "latest_backtest_job_record": latest_backtest_linkage.job_record,
        "latest_actionable_backtest_review_record": latest_actionable_backtest_linkage.review_record,
        "latest_actionable_backtest_job_record": latest_actionable_backtest_linkage.job_record,
    }


def build_strategy_activity_change_request_lineage_snapshot_kwargs(
    *,
    lineage_context: StrategyActivityLineageContext,
) -> Dict[str, Any]:
    latest_change_request_linkage = lineage_context.latest_change_request_linkage
    latest_actionable_change_request_linkage = lineage_context.latest_actionable_change_request_linkage
    return {
        "latest_change_request": lineage_context.latest_change_request,
        "latest_actionable_change_request": lineage_context.latest_actionable_change_request,
        "latest_change_request_backtest_record": latest_change_request_linkage.backtest_record,
        "latest_change_request_review_record": latest_change_request_linkage.review_record,
        "latest_change_request_job_record": latest_change_request_linkage.job_record,
        "latest_change_request_source_backtest_record": latest_change_request_linkage.source_backtest_record,
        "latest_change_request_source_review_record": latest_change_request_linkage.source_review_record,
        "latest_change_request_source_proposal_record": latest_change_request_linkage.source_proposal_record,
        "latest_actionable_change_request_backtest_record": latest_actionable_change_request_linkage.backtest_record,
        "latest_actionable_change_request_review_record": latest_actionable_change_request_linkage.review_record,
        "latest_actionable_change_request_job_record": latest_actionable_change_request_linkage.job_record,
        "latest_actionable_change_request_source_backtest_record": (
            latest_actionable_change_request_linkage.source_backtest_record
        ),
        "latest_actionable_change_request_source_review_record": (
            latest_actionable_change_request_linkage.source_review_record
        ),
        "latest_actionable_change_request_source_proposal_record": (
            latest_actionable_change_request_linkage.source_proposal_record
        ),
    }


def build_strategy_activity_proposal_lineage_snapshot_kwargs(
    *,
    lineage_context: StrategyActivityLineageContext,
) -> Dict[str, Any]:
    latest_proposal_linkage = lineage_context.latest_proposal_linkage
    latest_actionable_proposal_linkage = lineage_context.latest_actionable_proposal_linkage
    return {
        "latest_proposal": lineage_context.latest_proposal,
        "latest_actionable_proposal": lineage_context.latest_actionable_proposal,
        "latest_proposal_change_request": latest_proposal_linkage.change_request,
        "latest_proposal_backtest": latest_proposal_linkage.backtest,
        "latest_proposal_review": latest_proposal_linkage.review,
        "latest_proposal_job": latest_proposal_linkage.job,
        "latest_proposal_backtest_record": latest_proposal_linkage.backtest_record,
        "latest_proposal_review_record": latest_proposal_linkage.review_record,
        "latest_proposal_job_record": latest_proposal_linkage.job_record,
        "latest_actionable_proposal_change_request": latest_actionable_proposal_linkage.change_request,
        "latest_actionable_proposal_backtest": latest_actionable_proposal_linkage.backtest,
        "latest_actionable_proposal_review": latest_actionable_proposal_linkage.review,
        "latest_actionable_proposal_job": latest_actionable_proposal_linkage.job,
        "latest_actionable_proposal_backtest_record": latest_actionable_proposal_linkage.backtest_record,
        "latest_actionable_proposal_review_record": latest_actionable_proposal_linkage.review_record,
        "latest_actionable_proposal_job_record": latest_actionable_proposal_linkage.job_record,
    }


def build_strategy_activity_review_lineage_snapshot_kwargs(
    *,
    lineage_context: StrategyActivityLineageContext,
    latest_tracking_job: Optional[StrategyActivityJobSummary],
) -> Dict[str, Any]:
    review_tail_linkage = lineage_context.review_tail_linkage
    return {
        "latest_primary_review": review_tail_linkage.latest_primary_review,
        "latest_actionable_primary_review": review_tail_linkage.latest_actionable_primary_review,
        "latest_primary_review_record": review_tail_linkage.latest_primary_review_record,
        "latest_actionable_primary_review_record": review_tail_linkage.latest_actionable_primary_review_record,
        "latest_tracking_review": review_tail_linkage.latest_tracking_review,
        "latest_tracking_job": latest_tracking_job,
        "latest_tracking_review_record": review_tail_linkage.latest_tracking_review_record,
        "latest_tracking_job_record": review_tail_linkage.latest_tracking_job_record,
    }


def build_strategy_activity_tracking_lineage_snapshot_kwargs(
    *,
    lineage_context: StrategyActivityLineageContext,
) -> Dict[str, Any]:
    return {
        "latest_retryable_tracking_job": lineage_context.latest_retryable_tracking_job,
        "latest_retryable_tracking_job_record": lineage_context.latest_retryable_tracking_job_record,
    }


def build_strategy_activity_lineage_snapshot_kwargs(
    *,
    lineage_context: StrategyActivityLineageContext,
    latest_tracking_job: Optional[StrategyActivityJobSummary],
) -> Dict[str, Any]:
    return {
        **build_strategy_activity_backtest_lineage_snapshot_kwargs(lineage_context=lineage_context),
        **build_strategy_activity_review_lineage_snapshot_kwargs(
            lineage_context=lineage_context,
            latest_tracking_job=latest_tracking_job,
        ),
        **build_strategy_activity_proposal_lineage_snapshot_kwargs(lineage_context=lineage_context),
        **build_strategy_activity_change_request_lineage_snapshot_kwargs(
            lineage_context=lineage_context
        ),
        **build_strategy_activity_tracking_lineage_snapshot_kwargs(lineage_context=lineage_context),
    }


def build_strategy_activity_snapshot_recent_kwargs(
    *,
    recent_data: StrategyActivityRecentData,
    recent_proposals: List[StrategyProposal],
    recent_change_requests: List[ChangeRequest],
    recent_backtests: List[StrategyActivityBacktestSummary],
    recent_reviews: List[StrategyActivityReviewSummary],
    recent_agent_jobs: List[StrategyActivityJobSummary],
) -> Dict[str, Any]:
    return {
        "recent_proposals": recent_proposals,
        "recent_change_requests": recent_change_requests,
        "recent_backtests": recent_backtests,
        "recent_reviews": recent_reviews,
        "active_orders": recent_data.active_orders,
        "recent_orders": recent_data.recent_orders,
        "recent_trades": recent_data.recent_trades,
        "recent_alerts": recent_data.recent_alerts,
        "recent_audit_events": recent_data.recent_audit_events,
        "recent_agent_jobs": recent_agent_jobs,
    }


def build_strategy_activity_snapshot_kwargs(
    *,
    strategy: Any,
    symbol: str,
    market: str,
    runtime: Optional[StrategyRuntimeSnapshot],
    latest_runtime: StrategyActivityLatestRuntimeSnapshot,
    latest_ops: StrategyActivityLatestOpsSnapshot,
    decision_context: Optional[StrategyActivityDecisionContext],
    activity_sections: Optional[StrategyActivitySections],
    lineage_context: StrategyActivityLineageContext,
    recent_data: StrategyActivityRecentData,
    latest_tracking_job: Optional[StrategyActivityJobSummary],
    recent_backtests: List[StrategyActivityBacktestSummary],
    recent_reviews: List[StrategyActivityReviewSummary],
    recent_agent_jobs: List[StrategyActivityJobSummary],
    recent_proposals: List[StrategyProposal],
    recent_change_requests: List[ChangeRequest],
) -> Dict[str, Any]:
    return {
        **build_strategy_activity_snapshot_core_kwargs(
            strategy=strategy,
            symbol=symbol,
            market=market,
            runtime=runtime,
            latest_runtime=latest_runtime,
            latest_ops=latest_ops,
            decision_context=decision_context,
            activity_sections=activity_sections,
        ),
        **build_strategy_activity_lineage_snapshot_kwargs(
            lineage_context=lineage_context,
            latest_tracking_job=latest_tracking_job,
        ),
        **build_strategy_activity_snapshot_recent_kwargs(
            recent_data=recent_data,
            recent_proposals=recent_proposals,
            recent_change_requests=recent_change_requests,
            recent_backtests=recent_backtests,
            recent_reviews=recent_reviews,
            recent_agent_jobs=recent_agent_jobs,
        ),
        "generated_at": build_strategy_activity_snapshot_generated_at(),
    }


def build_strategy_activity_latest_runtime_snapshot(
    *,
    runtime: Optional[StrategyRuntimeSnapshot],
    latest_ops: StrategyActivityLatestOpsSnapshot,
) -> StrategyActivityLatestRuntimeSnapshot:
    return StrategyActivityLatestRuntimeSnapshot(runtime=runtime, latest_ops=latest_ops)


def build_strategy_activity_snapshot(
    *,
    strategy: Any,
    symbol: str,
    market: str,
    runtime: Optional[StrategyRuntimeSnapshot],
    latest_runtime: StrategyActivityLatestRuntimeSnapshot,
    latest_ops: StrategyActivityLatestOpsSnapshot,
    decision_context: Optional[StrategyActivityDecisionContext],
    activity_sections: Optional[StrategyActivitySections],
    lineage_context: StrategyActivityLineageContext,
    recent_data: StrategyActivityRecentData,
    latest_tracking_job: Optional[StrategyActivityJobSummary],
    recent_backtests: List[StrategyActivityBacktestSummary],
    recent_reviews: List[StrategyActivityReviewSummary],
    recent_agent_jobs: List[StrategyActivityJobSummary],
    recent_proposals: List[StrategyProposal],
    recent_change_requests: List[ChangeRequest],
) -> StrategyActivitySnapshot:
    return StrategyActivitySnapshot(
        **build_strategy_activity_snapshot_kwargs(
            strategy=strategy,
            symbol=symbol,
            market=market,
            runtime=runtime,
            latest_runtime=latest_runtime,
            latest_ops=latest_ops,
            decision_context=decision_context,
            activity_sections=activity_sections,
            lineage_context=lineage_context,
            recent_data=recent_data,
            latest_tracking_job=latest_tracking_job,
            recent_backtests=recent_backtests,
            recent_reviews=recent_reviews,
            recent_agent_jobs=recent_agent_jobs,
            recent_proposals=recent_proposals,
            recent_change_requests=recent_change_requests,
        )
    )


def build_strategy_activity_snapshot_from_sections(
    *,
    strategy: Any,
    symbol: str,
    market: str,
    runtime: Optional[StrategyRuntimeSnapshot],
    recent_data: StrategyActivityRecentData,
    latest_ops: StrategyActivityLatestOpsSnapshot,
    decision_sections: StrategyActivityDecisionSectionsBundle,
    lineage_context: StrategyActivityLineageContext,
    latest_tracking_job: Optional[StrategyActivityJobSummary],
    recent_backtests: List[StrategyActivityBacktestSummary],
    recent_reviews: List[StrategyActivityReviewSummary],
    recent_agent_jobs: List[StrategyActivityJobSummary],
    recent_proposals: List[StrategyProposal],
    recent_change_requests: List[ChangeRequest],
) -> StrategyActivitySnapshot:
    latest_runtime = build_strategy_activity_latest_runtime_snapshot(
        runtime=runtime,
        latest_ops=latest_ops,
    )
    return build_strategy_activity_snapshot(
        strategy=strategy,
        symbol=symbol,
        market=market,
        runtime=runtime,
        latest_runtime=latest_runtime,
        latest_ops=latest_ops,
        decision_context=decision_sections.decision_context,
        activity_sections=decision_sections.activity_sections,
        lineage_context=lineage_context,
        recent_data=recent_data,
        latest_tracking_job=latest_tracking_job,
        recent_backtests=recent_backtests,
        recent_reviews=recent_reviews,
        recent_agent_jobs=recent_agent_jobs,
        recent_proposals=recent_proposals,
        recent_change_requests=recent_change_requests,
    )

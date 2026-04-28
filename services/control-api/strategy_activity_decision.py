from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Optional, TypeVar

from models import (
    AgentJob,
    BacktestRun,
    ReviewDocument,
    StrategyActivityDecisionContext,
    StrategyActivityJobSummary,
    StrategyActivityReviewSummary,
    StrategyActivitySections,
    StrategyProposal,
)
from strategy_activity_lineage import StrategyActivityLineageContext

ModelT = TypeVar("ModelT")


@dataclass(frozen=True)
class StrategyActivityDecisionSectionsBundle:
    decision_context: Optional[StrategyActivityDecisionContext]
    activity_sections: Optional[StrategyActivitySections]


def prune_strategy_activity_payload_value(value: Any) -> Any:
    if isinstance(value, dict):
        pruned: Dict[str, Any] = {}
        for key, item in value.items():
            cleaned = prune_strategy_activity_payload_value(item)
            if cleaned is None:
                continue
            if isinstance(cleaned, dict) and not cleaned:
                continue
            pruned[key] = cleaned
        return pruned
    if value is None:
        return None
    return value


def _prune_strategy_activity_value_legacy(value: Any) -> Any:
    if isinstance(value, dict):
        pruned: Dict[str, Any] = {}
        for key, item in value.items():
            cleaned = _prune_strategy_activity_value_legacy(item)
            if cleaned is None:
                continue
            if isinstance(cleaned, dict) and not cleaned:
                continue
            pruned[key] = cleaned
        return pruned
    if value is None:
        return None
    return value


def build_strategy_activity_backtest_decision_context_payload(
    *,
    latest_record: Optional[BacktestRun],
    actionable_record: Optional[BacktestRun],
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    actionable_review_record: Optional[ReviewDocument],
    actionable_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "latest_record": latest_record,
        "actionable_record": actionable_record,
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "actionable_review_record": actionable_review_record,
        "actionable_job_record": actionable_job_record,
    }


def build_strategy_activity_backtest_sections_payload(
    *,
    latest: Optional[Any],
    latest_actionable: Optional[Any],
    latest_record: Optional[BacktestRun],
    latest_actionable_record: Optional[BacktestRun],
    latest_review: Optional[StrategyActivityReviewSummary],
    latest_job: Optional[StrategyActivityJobSummary],
    latest_actionable_review: Optional[StrategyActivityReviewSummary],
    latest_actionable_job: Optional[StrategyActivityJobSummary],
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    latest_actionable_review_record: Optional[ReviewDocument],
    latest_actionable_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "latest": latest,
        "latest_actionable": latest_actionable,
        "latest_record": latest_record,
        "latest_actionable_record": latest_actionable_record,
        "latest_review": latest_review,
        "latest_job": latest_job,
        "latest_actionable_review": latest_actionable_review,
        "latest_actionable_job": latest_actionable_job,
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "latest_actionable_review_record": latest_actionable_review_record,
        "latest_actionable_job_record": latest_actionable_job_record,
    }


def build_strategy_activity_change_request_decision_context_payload(
    *,
    latest_backtest_record: Optional[BacktestRun],
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    latest_source_backtest_record: Optional[BacktestRun],
    latest_source_review_record: Optional[ReviewDocument],
    latest_source_proposal_record: Optional[StrategyProposal],
    actionable_backtest_record: Optional[BacktestRun],
    actionable_review_record: Optional[ReviewDocument],
    actionable_job_record: Optional[AgentJob],
    actionable_source_backtest_record: Optional[BacktestRun],
    actionable_source_review_record: Optional[ReviewDocument],
    actionable_source_proposal_record: Optional[StrategyProposal],
) -> Dict[str, Any]:
    return {
        "latest_backtest_record": latest_backtest_record,
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "latest_source_backtest_record": latest_source_backtest_record,
        "latest_source_review_record": latest_source_review_record,
        "latest_source_proposal_record": latest_source_proposal_record,
        "actionable_backtest_record": actionable_backtest_record,
        "actionable_review_record": actionable_review_record,
        "actionable_job_record": actionable_job_record,
        "actionable_source_backtest_record": actionable_source_backtest_record,
        "actionable_source_review_record": actionable_source_review_record,
        "actionable_source_proposal_record": actionable_source_proposal_record,
    }


def build_strategy_activity_change_request_sections_payload(
    *,
    latest: Optional[Any],
    latest_actionable: Optional[Any],
    latest_backtest_record: Optional[BacktestRun],
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    latest_source_backtest_record: Optional[BacktestRun],
    latest_source_review_record: Optional[ReviewDocument],
    latest_source_proposal_record: Optional[StrategyProposal],
    latest_actionable_backtest_record: Optional[BacktestRun],
    latest_actionable_review_record: Optional[ReviewDocument],
    latest_actionable_job_record: Optional[AgentJob],
    latest_actionable_source_backtest_record: Optional[BacktestRun],
    latest_actionable_source_review_record: Optional[ReviewDocument],
    latest_actionable_source_proposal_record: Optional[StrategyProposal],
) -> Dict[str, Any]:
    return {
        "latest": latest,
        "latest_actionable": latest_actionable,
        "latest_backtest_record": latest_backtest_record,
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "latest_source_backtest_record": latest_source_backtest_record,
        "latest_source_review_record": latest_source_review_record,
        "latest_source_proposal_record": latest_source_proposal_record,
        "latest_actionable_backtest_record": latest_actionable_backtest_record,
        "latest_actionable_review_record": latest_actionable_review_record,
        "latest_actionable_job_record": latest_actionable_job_record,
        "latest_actionable_source_backtest_record": latest_actionable_source_backtest_record,
        "latest_actionable_source_review_record": latest_actionable_source_review_record,
        "latest_actionable_source_proposal_record": latest_actionable_source_proposal_record,
    }


def build_strategy_activity_proposal_decision_context_payload(
    *,
    latest_backtest_record: Optional[BacktestRun],
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    actionable_backtest_record: Optional[BacktestRun],
    actionable_review_record: Optional[ReviewDocument],
    actionable_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "latest_backtest_record": latest_backtest_record,
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "actionable_backtest_record": actionable_backtest_record,
        "actionable_review_record": actionable_review_record,
        "actionable_job_record": actionable_job_record,
    }


def build_strategy_activity_proposal_sections_payload(
    *,
    latest: Optional[StrategyProposal],
    latest_actionable: Optional[StrategyProposal],
    latest_change_request: Optional[Any],
    latest_backtest: Optional[Any],
    latest_review: Optional[StrategyActivityReviewSummary],
    latest_job: Optional[StrategyActivityJobSummary],
    latest_backtest_record: Optional[BacktestRun],
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    latest_actionable_change_request: Optional[Any],
    latest_actionable_backtest: Optional[Any],
    latest_actionable_review: Optional[StrategyActivityReviewSummary],
    latest_actionable_job: Optional[StrategyActivityJobSummary],
    latest_actionable_backtest_record: Optional[BacktestRun],
    latest_actionable_review_record: Optional[ReviewDocument],
    latest_actionable_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "latest": latest,
        "latest_actionable": latest_actionable,
        "latest_change_request": latest_change_request,
        "latest_backtest": latest_backtest,
        "latest_review": latest_review,
        "latest_job": latest_job,
        "latest_backtest_record": latest_backtest_record,
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "latest_actionable_change_request": latest_actionable_change_request,
        "latest_actionable_backtest": latest_actionable_backtest,
        "latest_actionable_review": latest_actionable_review,
        "latest_actionable_job": latest_actionable_job,
        "latest_actionable_backtest_record": latest_actionable_backtest_record,
        "latest_actionable_review_record": latest_actionable_review_record,
        "latest_actionable_job_record": latest_actionable_job_record,
    }


def build_strategy_activity_review_decision_context_payload(
    *,
    latest_primary_record: Optional[ReviewDocument],
    latest_actionable_primary_record: Optional[ReviewDocument],
) -> Dict[str, Any]:
    return {
        "latest_primary_record": latest_primary_record,
        "latest_actionable_primary_record": latest_actionable_primary_record,
    }


def build_strategy_activity_review_sections_payload(
    *,
    latest_primary: Optional[StrategyActivityReviewSummary],
    latest_actionable_primary: Optional[StrategyActivityReviewSummary],
    latest_tracking: Optional[StrategyActivityReviewSummary],
    latest_primary_record: Optional[ReviewDocument],
    latest_actionable_primary_record: Optional[ReviewDocument],
    latest_tracking_record: Optional[ReviewDocument],
) -> Dict[str, Any]:
    return {
        "latest_primary": latest_primary,
        "latest_actionable_primary": latest_actionable_primary,
        "latest_tracking": latest_tracking,
        "latest_primary_record": latest_primary_record,
        "latest_actionable_primary_record": latest_actionable_primary_record,
        "latest_tracking_record": latest_tracking_record,
    }


def build_strategy_activity_tracking_decision_context_payload(
    *,
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    latest_retryable_job: Optional[StrategyActivityJobSummary],
    latest_retryable_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "latest_retryable_job": latest_retryable_job,
        "latest_retryable_job_record": latest_retryable_job_record,
    }


def build_strategy_activity_tracking_sections_payload(
    *,
    latest_review: Optional[StrategyActivityReviewSummary],
    latest_job: Optional[StrategyActivityJobSummary],
    latest_retryable_job: Optional[StrategyActivityJobSummary],
    latest_review_record: Optional[ReviewDocument],
    latest_job_record: Optional[AgentJob],
    latest_retryable_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "latest_review": latest_review,
        "latest_job": latest_job,
        "latest_retryable_job": latest_retryable_job,
        "latest_review_record": latest_review_record,
        "latest_job_record": latest_job_record,
        "latest_retryable_job_record": latest_retryable_job_record,
    }


def build_strategy_activity_decision_context_payload(
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
) -> Optional[Dict[str, Any]]:
    from strategy_activity_payload import (
        assemble_strategy_activity_decision_context_payload,
    )

    payload = prune_strategy_activity_payload_value(
        assemble_strategy_activity_decision_context_payload(
            latest_proposal_backtest_record=latest_proposal_backtest_record,
            latest_proposal_review_record=latest_proposal_review_record,
            latest_proposal_job_record=latest_proposal_job_record,
            latest_actionable_proposal_backtest_record=latest_actionable_proposal_backtest_record,
            latest_actionable_proposal_review_record=latest_actionable_proposal_review_record,
            latest_actionable_proposal_job_record=latest_actionable_proposal_job_record,
            latest_change_request_backtest_record=latest_change_request_backtest_record,
            latest_change_request_review_record=latest_change_request_review_record,
            latest_change_request_job_record=latest_change_request_job_record,
            latest_change_request_source_backtest_record=latest_change_request_source_backtest_record,
            latest_change_request_source_review_record=latest_change_request_source_review_record,
            latest_change_request_source_proposal_record=latest_change_request_source_proposal_record,
            latest_actionable_change_request_backtest_record=latest_actionable_change_request_backtest_record,
            latest_actionable_change_request_review_record=latest_actionable_change_request_review_record,
            latest_actionable_change_request_job_record=latest_actionable_change_request_job_record,
            latest_actionable_change_request_source_backtest_record=(
                latest_actionable_change_request_source_backtest_record
            ),
            latest_actionable_change_request_source_review_record=(
                latest_actionable_change_request_source_review_record
            ),
            latest_actionable_change_request_source_proposal_record=(
                latest_actionable_change_request_source_proposal_record
            ),
            latest_backtest_record=latest_backtest_record,
            latest_actionable_backtest_record=latest_actionable_backtest_record,
            latest_backtest_review_record=latest_backtest_review_record,
            latest_backtest_job_record=latest_backtest_job_record,
            latest_actionable_backtest_review_record=latest_actionable_backtest_review_record,
            latest_actionable_backtest_job_record=latest_actionable_backtest_job_record,
            latest_primary_review_record=latest_primary_review_record,
            latest_actionable_primary_review_record=latest_actionable_primary_review_record,
            latest_tracking_review_record=latest_tracking_review_record,
            latest_tracking_job_record=latest_tracking_job_record,
            latest_retryable_job=latest_retryable_job,
            latest_retryable_job_record=latest_retryable_job_record,
        )
    )
    return payload if payload else None


def build_strategy_activity_sections_payload(
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
) -> Optional[Dict[str, Any]]:
    from strategy_activity_payload import (
        assemble_strategy_activity_sections_payload,
    )

    payload = prune_strategy_activity_payload_value(
        assemble_strategy_activity_sections_payload(
            latest_backtest=latest_backtest,
            latest_actionable_backtest=latest_actionable_backtest,
            latest_backtest_record=latest_backtest_record,
            latest_actionable_backtest_record=latest_actionable_backtest_record,
            latest_backtest_review=latest_backtest_review,
            latest_backtest_job=latest_backtest_job,
            latest_actionable_backtest_review=latest_actionable_backtest_review,
            latest_actionable_backtest_job=latest_actionable_backtest_job,
            latest_backtest_review_record=latest_backtest_review_record,
            latest_backtest_job_record=latest_backtest_job_record,
            latest_actionable_backtest_review_record=latest_actionable_backtest_review_record,
            latest_actionable_backtest_job_record=latest_actionable_backtest_job_record,
            latest_primary_review=latest_primary_review,
            latest_actionable_primary_review=latest_actionable_primary_review,
            latest_primary_review_record=latest_primary_review_record,
            latest_actionable_primary_review_record=latest_actionable_primary_review_record,
            latest_tracking_review=latest_tracking_review,
            latest_tracking_job=latest_tracking_job,
            latest_tracking_review_record=latest_tracking_review_record,
            latest_tracking_job_record=latest_tracking_job_record,
            latest_proposal=latest_proposal,
            latest_actionable_proposal=latest_actionable_proposal,
            latest_proposal_change_request=latest_proposal_change_request,
            latest_proposal_backtest=latest_proposal_backtest,
            latest_proposal_review=latest_proposal_review,
            latest_proposal_job=latest_proposal_job,
            latest_proposal_backtest_record=latest_proposal_backtest_record,
            latest_proposal_review_record=latest_proposal_review_record,
            latest_proposal_job_record=latest_proposal_job_record,
            latest_actionable_proposal_change_request=latest_actionable_proposal_change_request,
            latest_actionable_proposal_backtest=latest_actionable_proposal_backtest,
            latest_actionable_proposal_review=latest_actionable_proposal_review,
            latest_actionable_proposal_job=latest_actionable_proposal_job,
            latest_actionable_proposal_backtest_record=latest_actionable_proposal_backtest_record,
            latest_actionable_proposal_review_record=latest_actionable_proposal_review_record,
            latest_actionable_proposal_job_record=latest_actionable_proposal_job_record,
            latest_change_request=latest_change_request,
            latest_actionable_change_request=latest_actionable_change_request,
            latest_change_request_backtest_record=latest_change_request_backtest_record,
            latest_change_request_review_record=latest_change_request_review_record,
            latest_change_request_job_record=latest_change_request_job_record,
            latest_change_request_source_backtest_record=latest_change_request_source_backtest_record,
            latest_change_request_source_review_record=latest_change_request_source_review_record,
            latest_change_request_source_proposal_record=latest_change_request_source_proposal_record,
            latest_actionable_change_request_backtest_record=latest_actionable_change_request_backtest_record,
            latest_actionable_change_request_review_record=latest_actionable_change_request_review_record,
            latest_actionable_change_request_job_record=latest_actionable_change_request_job_record,
            latest_actionable_change_request_source_backtest_record=(
                latest_actionable_change_request_source_backtest_record
            ),
            latest_actionable_change_request_source_review_record=(
                latest_actionable_change_request_source_review_record
            ),
            latest_actionable_change_request_source_proposal_record=(
                latest_actionable_change_request_source_proposal_record
            ),
            latest_retryable_tracking_job=latest_retryable_tracking_job,
            latest_retryable_tracking_job_record=latest_retryable_tracking_job_record,
        )
    )
    return payload if payload else None


def build_strategy_activity_decision_context_payload_legacy(
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
) -> Optional[Dict[str, Any]]:
    payload = _prune_strategy_activity_value_legacy(
        {
            "proposal": {
                "latest_backtest_record": latest_proposal_backtest_record,
                "latest_review_record": latest_proposal_review_record,
                "latest_job_record": latest_proposal_job_record,
                "actionable_backtest_record": latest_actionable_proposal_backtest_record,
                "actionable_review_record": latest_actionable_proposal_review_record,
                "actionable_job_record": latest_actionable_proposal_job_record,
            },
            "change_request": {
                "latest_backtest_record": latest_change_request_backtest_record,
                "latest_review_record": latest_change_request_review_record,
                "latest_job_record": latest_change_request_job_record,
                "latest_source_backtest_record": latest_change_request_source_backtest_record,
                "latest_source_review_record": latest_change_request_source_review_record,
                "latest_source_proposal_record": latest_change_request_source_proposal_record,
                "actionable_backtest_record": latest_actionable_change_request_backtest_record,
                "actionable_review_record": latest_actionable_change_request_review_record,
                "actionable_job_record": latest_actionable_change_request_job_record,
                "actionable_source_backtest_record": latest_actionable_change_request_source_backtest_record,
                "actionable_source_review_record": latest_actionable_change_request_source_review_record,
                "actionable_source_proposal_record": latest_actionable_change_request_source_proposal_record,
            },
            "backtest": {
                "latest_record": latest_backtest_record,
                "actionable_record": latest_actionable_backtest_record,
                "latest_review_record": latest_backtest_review_record,
                "latest_job_record": latest_backtest_job_record,
                "actionable_review_record": latest_actionable_backtest_review_record,
                "actionable_job_record": latest_actionable_backtest_job_record,
            },
            "review": {
                "latest_primary_record": latest_primary_review_record,
                "latest_actionable_primary_record": latest_actionable_primary_review_record,
            },
            "tracking": {
                "latest_review_record": latest_tracking_review_record,
                "latest_job_record": latest_tracking_job_record,
                "latest_retryable_job": latest_retryable_job,
                "latest_retryable_job_record": latest_retryable_job_record,
            },
        }
    )
    return payload if payload else None


def build_strategy_activity_sections_payload_legacy(
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
) -> Optional[Dict[str, Any]]:
    payload = _prune_strategy_activity_value_legacy(
        {
            "proposal": {
                "latest": latest_proposal,
                "latest_actionable": latest_actionable_proposal,
                "latest_change_request": latest_proposal_change_request,
                "latest_backtest": latest_proposal_backtest,
                "latest_review": latest_proposal_review,
                "latest_job": latest_proposal_job,
                "latest_backtest_record": latest_proposal_backtest_record,
                "latest_review_record": latest_proposal_review_record,
                "latest_job_record": latest_proposal_job_record,
                "latest_actionable_change_request": latest_actionable_proposal_change_request,
                "latest_actionable_backtest": latest_actionable_proposal_backtest,
                "latest_actionable_review": latest_actionable_proposal_review,
                "latest_actionable_job": latest_actionable_proposal_job,
                "latest_actionable_backtest_record": latest_actionable_proposal_backtest_record,
                "latest_actionable_review_record": latest_actionable_proposal_review_record,
                "latest_actionable_job_record": latest_actionable_proposal_job_record,
            },
            "change_request": {
                "latest": latest_change_request,
                "latest_actionable": latest_actionable_change_request,
                "latest_backtest_record": latest_change_request_backtest_record,
                "latest_review_record": latest_change_request_review_record,
                "latest_job_record": latest_change_request_job_record,
                "latest_source_backtest_record": latest_change_request_source_backtest_record,
                "latest_source_review_record": latest_change_request_source_review_record,
                "latest_source_proposal_record": latest_change_request_source_proposal_record,
                "latest_actionable_backtest_record": latest_actionable_change_request_backtest_record,
                "latest_actionable_review_record": latest_actionable_change_request_review_record,
                "latest_actionable_job_record": latest_actionable_change_request_job_record,
                "latest_actionable_source_backtest_record": latest_actionable_change_request_source_backtest_record,
                "latest_actionable_source_review_record": latest_actionable_change_request_source_review_record,
                "latest_actionable_source_proposal_record": latest_actionable_change_request_source_proposal_record,
            },
            "backtest": {
                "latest": latest_backtest,
                "latest_actionable": latest_actionable_backtest,
                "latest_record": latest_backtest_record,
                "latest_actionable_record": latest_actionable_backtest_record,
                "latest_review": latest_backtest_review,
                "latest_job": latest_backtest_job,
                "latest_actionable_review": latest_actionable_backtest_review,
                "latest_actionable_job": latest_actionable_backtest_job,
                "latest_review_record": latest_backtest_review_record,
                "latest_job_record": latest_backtest_job_record,
                "latest_actionable_review_record": latest_actionable_backtest_review_record,
                "latest_actionable_job_record": latest_actionable_backtest_job_record,
            },
            "review": {
                "latest_primary": latest_primary_review,
                "latest_actionable_primary": latest_actionable_primary_review,
                "latest_tracking": latest_tracking_review,
                "latest_primary_record": latest_primary_review_record,
                "latest_actionable_primary_record": latest_actionable_primary_review_record,
                "latest_tracking_record": latest_tracking_review_record,
            },
            "tracking": {
                "latest_review": latest_tracking_review,
                "latest_job": latest_tracking_job,
                "latest_retryable_job": latest_retryable_tracking_job,
                "latest_review_record": latest_tracking_review_record,
                "latest_job_record": latest_tracking_job_record,
                "latest_retryable_job_record": latest_retryable_tracking_job_record,
            },
        }
    )
    return payload if payload else None


def build_strategy_activity_model_from_payload(
    model_type: type[ModelT],
    payload: Optional[dict[str, Any]],
) -> Optional[ModelT]:
    if not payload:
        return None
    return model_type(**payload)


def build_strategy_activity_decision_context(
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
) -> Optional[StrategyActivityDecisionContext]:
    return build_strategy_activity_model_from_payload(
        StrategyActivityDecisionContext,
        build_strategy_activity_decision_context_payload(
            latest_proposal_backtest_record=latest_proposal_backtest_record,
            latest_proposal_review_record=latest_proposal_review_record,
            latest_proposal_job_record=latest_proposal_job_record,
            latest_actionable_proposal_backtest_record=latest_actionable_proposal_backtest_record,
            latest_actionable_proposal_review_record=latest_actionable_proposal_review_record,
            latest_actionable_proposal_job_record=latest_actionable_proposal_job_record,
            latest_change_request_backtest_record=latest_change_request_backtest_record,
            latest_change_request_review_record=latest_change_request_review_record,
            latest_change_request_job_record=latest_change_request_job_record,
            latest_change_request_source_backtest_record=latest_change_request_source_backtest_record,
            latest_change_request_source_review_record=latest_change_request_source_review_record,
            latest_change_request_source_proposal_record=latest_change_request_source_proposal_record,
            latest_actionable_change_request_backtest_record=latest_actionable_change_request_backtest_record,
            latest_actionable_change_request_review_record=latest_actionable_change_request_review_record,
            latest_actionable_change_request_job_record=latest_actionable_change_request_job_record,
            latest_actionable_change_request_source_backtest_record=(
                latest_actionable_change_request_source_backtest_record
            ),
            latest_actionable_change_request_source_review_record=(
                latest_actionable_change_request_source_review_record
            ),
            latest_actionable_change_request_source_proposal_record=(
                latest_actionable_change_request_source_proposal_record
            ),
            latest_backtest_record=latest_backtest_record,
            latest_actionable_backtest_record=latest_actionable_backtest_record,
            latest_backtest_review_record=latest_backtest_review_record,
            latest_backtest_job_record=latest_backtest_job_record,
            latest_actionable_backtest_review_record=latest_actionable_backtest_review_record,
            latest_actionable_backtest_job_record=latest_actionable_backtest_job_record,
            latest_primary_review_record=latest_primary_review_record,
            latest_actionable_primary_review_record=latest_actionable_primary_review_record,
            latest_tracking_review_record=latest_tracking_review_record,
            latest_tracking_job_record=latest_tracking_job_record,
            latest_retryable_job=latest_retryable_job,
            latest_retryable_job_record=latest_retryable_job_record,
        ),
    )


def build_strategy_activity_sections(
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
) -> Optional[StrategyActivitySections]:
    return build_strategy_activity_model_from_payload(
        StrategyActivitySections,
        build_strategy_activity_sections_payload(
            latest_backtest=latest_backtest,
            latest_actionable_backtest=latest_actionable_backtest,
            latest_backtest_record=latest_backtest_record,
            latest_actionable_backtest_record=latest_actionable_backtest_record,
            latest_backtest_review=latest_backtest_review,
            latest_backtest_job=latest_backtest_job,
            latest_actionable_backtest_review=latest_actionable_backtest_review,
            latest_actionable_backtest_job=latest_actionable_backtest_job,
            latest_backtest_review_record=latest_backtest_review_record,
            latest_backtest_job_record=latest_backtest_job_record,
            latest_actionable_backtest_review_record=latest_actionable_backtest_review_record,
            latest_actionable_backtest_job_record=latest_actionable_backtest_job_record,
            latest_primary_review=latest_primary_review,
            latest_actionable_primary_review=latest_actionable_primary_review,
            latest_primary_review_record=latest_primary_review_record,
            latest_actionable_primary_review_record=latest_actionable_primary_review_record,
            latest_tracking_review=latest_tracking_review,
            latest_tracking_job=latest_tracking_job,
            latest_tracking_review_record=latest_tracking_review_record,
            latest_tracking_job_record=latest_tracking_job_record,
            latest_proposal=latest_proposal,
            latest_actionable_proposal=latest_actionable_proposal,
            latest_proposal_change_request=latest_proposal_change_request,
            latest_proposal_backtest=latest_proposal_backtest,
            latest_proposal_review=latest_proposal_review,
            latest_proposal_job=latest_proposal_job,
            latest_proposal_backtest_record=latest_proposal_backtest_record,
            latest_proposal_review_record=latest_proposal_review_record,
            latest_proposal_job_record=latest_proposal_job_record,
            latest_actionable_proposal_change_request=latest_actionable_proposal_change_request,
            latest_actionable_proposal_backtest=latest_actionable_proposal_backtest,
            latest_actionable_proposal_review=latest_actionable_proposal_review,
            latest_actionable_proposal_job=latest_actionable_proposal_job,
            latest_actionable_proposal_backtest_record=latest_actionable_proposal_backtest_record,
            latest_actionable_proposal_review_record=latest_actionable_proposal_review_record,
            latest_actionable_proposal_job_record=latest_actionable_proposal_job_record,
            latest_change_request=latest_change_request,
            latest_actionable_change_request=latest_actionable_change_request,
            latest_change_request_backtest_record=latest_change_request_backtest_record,
            latest_change_request_review_record=latest_change_request_review_record,
            latest_change_request_job_record=latest_change_request_job_record,
            latest_change_request_source_backtest_record=latest_change_request_source_backtest_record,
            latest_change_request_source_review_record=latest_change_request_source_review_record,
            latest_change_request_source_proposal_record=latest_change_request_source_proposal_record,
            latest_actionable_change_request_backtest_record=latest_actionable_change_request_backtest_record,
            latest_actionable_change_request_review_record=latest_actionable_change_request_review_record,
            latest_actionable_change_request_job_record=latest_actionable_change_request_job_record,
            latest_actionable_change_request_source_backtest_record=(
                latest_actionable_change_request_source_backtest_record
            ),
            latest_actionable_change_request_source_review_record=(
                latest_actionable_change_request_source_review_record
            ),
            latest_actionable_change_request_source_proposal_record=(
                latest_actionable_change_request_source_proposal_record
            ),
            latest_retryable_tracking_job=latest_retryable_tracking_job,
            latest_retryable_tracking_job_record=latest_retryable_tracking_job_record,
        ),
    )


def build_strategy_activity_decision_context_args(
    *,
    lineage_context: StrategyActivityLineageContext,
) -> Dict[str, Any]:
    review_tail_linkage = lineage_context.review_tail_linkage
    return {
        "latest_proposal_backtest_record": lineage_context.latest_proposal_linkage.backtest_record,
        "latest_proposal_review_record": lineage_context.latest_proposal_linkage.review_record,
        "latest_proposal_job_record": lineage_context.latest_proposal_linkage.job_record,
        "latest_actionable_proposal_backtest_record": (
            lineage_context.latest_actionable_proposal_linkage.backtest_record
        ),
        "latest_actionable_proposal_review_record": (
            lineage_context.latest_actionable_proposal_linkage.review_record
        ),
        "latest_actionable_proposal_job_record": lineage_context.latest_actionable_proposal_linkage.job_record,
        "latest_change_request_backtest_record": lineage_context.latest_change_request_linkage.backtest_record,
        "latest_change_request_review_record": lineage_context.latest_change_request_linkage.review_record,
        "latest_change_request_job_record": lineage_context.latest_change_request_linkage.job_record,
        "latest_change_request_source_backtest_record": (
            lineage_context.latest_change_request_linkage.source_backtest_record
        ),
        "latest_change_request_source_review_record": (
            lineage_context.latest_change_request_linkage.source_review_record
        ),
        "latest_change_request_source_proposal_record": (
            lineage_context.latest_change_request_linkage.source_proposal_record
        ),
        "latest_actionable_change_request_backtest_record": (
            lineage_context.latest_actionable_change_request_linkage.backtest_record
        ),
        "latest_actionable_change_request_review_record": (
            lineage_context.latest_actionable_change_request_linkage.review_record
        ),
        "latest_actionable_change_request_job_record": (
            lineage_context.latest_actionable_change_request_linkage.job_record
        ),
        "latest_actionable_change_request_source_backtest_record": (
            lineage_context.latest_actionable_change_request_linkage.source_backtest_record
        ),
        "latest_actionable_change_request_source_review_record": (
            lineage_context.latest_actionable_change_request_linkage.source_review_record
        ),
        "latest_actionable_change_request_source_proposal_record": (
            lineage_context.latest_actionable_change_request_linkage.source_proposal_record
        ),
        "latest_backtest_record": lineage_context.latest_backtest_record,
        "latest_actionable_backtest_record": lineage_context.latest_actionable_backtest_record,
        "latest_backtest_review_record": lineage_context.latest_backtest_linkage.review_record,
        "latest_backtest_job_record": lineage_context.latest_backtest_linkage.job_record,
        "latest_actionable_backtest_review_record": (
            lineage_context.latest_actionable_backtest_linkage.review_record
        ),
        "latest_actionable_backtest_job_record": lineage_context.latest_actionable_backtest_linkage.job_record,
        "latest_primary_review_record": review_tail_linkage.latest_primary_review_record,
        "latest_actionable_primary_review_record": review_tail_linkage.latest_actionable_primary_review_record,
        "latest_tracking_review_record": review_tail_linkage.latest_tracking_review_record,
        "latest_tracking_job_record": review_tail_linkage.latest_tracking_job_record,
        "latest_retryable_job": lineage_context.latest_retryable_tracking_job,
        "latest_retryable_job_record": lineage_context.latest_retryable_tracking_job_record,
    }


def build_strategy_activity_sections_args(
    *,
    lineage_context: StrategyActivityLineageContext,
    latest_tracking_job: Optional[StrategyActivityJobSummary],
) -> Dict[str, Any]:
    review_tail_linkage = lineage_context.review_tail_linkage
    return {
        "latest_backtest": lineage_context.latest_backtest,
        "latest_actionable_backtest": lineage_context.latest_actionable_backtest,
        "latest_backtest_record": lineage_context.latest_backtest_record,
        "latest_actionable_backtest_record": lineage_context.latest_actionable_backtest_record,
        "latest_backtest_review": lineage_context.latest_backtest_linkage.review,
        "latest_backtest_job": lineage_context.latest_backtest_linkage.job,
        "latest_actionable_backtest_review": lineage_context.latest_actionable_backtest_linkage.review,
        "latest_actionable_backtest_job": lineage_context.latest_actionable_backtest_linkage.job,
        "latest_backtest_review_record": lineage_context.latest_backtest_linkage.review_record,
        "latest_backtest_job_record": lineage_context.latest_backtest_linkage.job_record,
        "latest_actionable_backtest_review_record": (
            lineage_context.latest_actionable_backtest_linkage.review_record
        ),
        "latest_actionable_backtest_job_record": lineage_context.latest_actionable_backtest_linkage.job_record,
        "latest_primary_review": review_tail_linkage.latest_primary_review,
        "latest_actionable_primary_review": review_tail_linkage.latest_actionable_primary_review,
        "latest_primary_review_record": review_tail_linkage.latest_primary_review_record,
        "latest_actionable_primary_review_record": review_tail_linkage.latest_actionable_primary_review_record,
        "latest_tracking_review": review_tail_linkage.latest_tracking_review,
        "latest_tracking_job": latest_tracking_job,
        "latest_tracking_review_record": review_tail_linkage.latest_tracking_review_record,
        "latest_tracking_job_record": review_tail_linkage.latest_tracking_job_record,
        "latest_proposal": lineage_context.latest_proposal,
        "latest_actionable_proposal": lineage_context.latest_actionable_proposal,
        "latest_proposal_change_request": lineage_context.latest_proposal_linkage.change_request,
        "latest_proposal_backtest": lineage_context.latest_proposal_linkage.backtest,
        "latest_proposal_review": lineage_context.latest_proposal_linkage.review,
        "latest_proposal_job": lineage_context.latest_proposal_linkage.job,
        "latest_proposal_backtest_record": lineage_context.latest_proposal_linkage.backtest_record,
        "latest_proposal_review_record": lineage_context.latest_proposal_linkage.review_record,
        "latest_proposal_job_record": lineage_context.latest_proposal_linkage.job_record,
        "latest_actionable_proposal_change_request": (
            lineage_context.latest_actionable_proposal_linkage.change_request
        ),
        "latest_actionable_proposal_backtest": lineage_context.latest_actionable_proposal_linkage.backtest,
        "latest_actionable_proposal_review": lineage_context.latest_actionable_proposal_linkage.review,
        "latest_actionable_proposal_job": lineage_context.latest_actionable_proposal_linkage.job,
        "latest_actionable_proposal_backtest_record": (
            lineage_context.latest_actionable_proposal_linkage.backtest_record
        ),
        "latest_actionable_proposal_review_record": (
            lineage_context.latest_actionable_proposal_linkage.review_record
        ),
        "latest_actionable_proposal_job_record": lineage_context.latest_actionable_proposal_linkage.job_record,
        "latest_change_request": lineage_context.latest_change_request,
        "latest_actionable_change_request": lineage_context.latest_actionable_change_request,
        "latest_change_request_backtest_record": lineage_context.latest_change_request_linkage.backtest_record,
        "latest_change_request_review_record": lineage_context.latest_change_request_linkage.review_record,
        "latest_change_request_job_record": lineage_context.latest_change_request_linkage.job_record,
        "latest_change_request_source_backtest_record": (
            lineage_context.latest_change_request_linkage.source_backtest_record
        ),
        "latest_change_request_source_review_record": (
            lineage_context.latest_change_request_linkage.source_review_record
        ),
        "latest_change_request_source_proposal_record": (
            lineage_context.latest_change_request_linkage.source_proposal_record
        ),
        "latest_actionable_change_request_backtest_record": (
            lineage_context.latest_actionable_change_request_linkage.backtest_record
        ),
        "latest_actionable_change_request_review_record": (
            lineage_context.latest_actionable_change_request_linkage.review_record
        ),
        "latest_actionable_change_request_job_record": (
            lineage_context.latest_actionable_change_request_linkage.job_record
        ),
        "latest_actionable_change_request_source_backtest_record": (
            lineage_context.latest_actionable_change_request_linkage.source_backtest_record
        ),
        "latest_actionable_change_request_source_review_record": (
            lineage_context.latest_actionable_change_request_linkage.source_review_record
        ),
        "latest_actionable_change_request_source_proposal_record": (
            lineage_context.latest_actionable_change_request_linkage.source_proposal_record
        ),
        "latest_retryable_tracking_job": lineage_context.latest_retryable_tracking_job,
        "latest_retryable_tracking_job_record": lineage_context.latest_retryable_tracking_job_record,
    }


def build_strategy_activity_decision_sections_bundle(
    *,
    lineage_context: StrategyActivityLineageContext,
    latest_tracking_job: Optional[StrategyActivityJobSummary],
) -> StrategyActivityDecisionSectionsBundle:
    decision_context = build_strategy_activity_decision_context(
        **build_strategy_activity_decision_context_args(lineage_context=lineage_context)
    )
    activity_sections = build_strategy_activity_sections(
        **build_strategy_activity_sections_args(
            lineage_context=lineage_context,
            latest_tracking_job=latest_tracking_job,
        )
    )
    return StrategyActivityDecisionSectionsBundle(
        decision_context=decision_context,
        activity_sections=activity_sections,
    )

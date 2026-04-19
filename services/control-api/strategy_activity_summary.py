from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from models import (
    AgentJob,
    BacktestRun,
    ChangeRequest,
    ReviewDocument,
    StrategyActivityBacktestSummary,
    StrategyActivityJobSummary,
    StrategyActivityReviewSummary,
)

from strategy_activity_review import build_strategy_activity_review_summaries


@dataclass(frozen=True)
class StrategyActivitySummaryCollections:
    recent_reviews: List[StrategyActivityReviewSummary]
    recent_primary_review_summaries: List[StrategyActivityReviewSummary]
    recent_tracking_review_records: List[StrategyActivityReviewSummary]
    latest_actionable_primary_review: Optional[StrategyActivityReviewSummary]
    recent_backtests: List[StrategyActivityBacktestSummary]
    recent_agent_jobs: List[StrategyActivityJobSummary]
    latest_tracking_job: Optional[StrategyActivityJobSummary]
    latest_retryable_tracking_job: Optional[StrategyActivityJobSummary]
    latest_retryable_tracking_job_record: Optional[AgentJob]


def read_strategy_activity_text(value: object) -> Optional[str]:
    if not isinstance(value, str):
        return None
    text = value.strip()
    return text or None


def has_strategy_activity_backtest_rerun_recommendation(backtest: BacktestRun) -> bool:
    history_source_reason = read_strategy_activity_text(getattr(backtest, "history_source_reason", None)) or "none"
    decision_range = read_strategy_activity_text(getattr(backtest, "decision_recommended_data_range", None))
    decision_timeframe = read_strategy_activity_text(getattr(backtest, "decision_recommended_timeframe", None))
    if history_source_reason != "exchange_fetch_failed" and decision_range and decision_timeframe:
        return True
    full_window_range = read_strategy_activity_text(getattr(backtest, "full_window_recommended_data_range", None))
    full_window_timeframe = read_strategy_activity_text(getattr(backtest, "full_window_recommended_timeframe", None))
    if full_window_range and full_window_timeframe:
        return True
    history_range = read_strategy_activity_text(getattr(backtest, "history_source_recommended_data_range", None))
    history_timeframe = read_strategy_activity_text(getattr(backtest, "history_source_recommended_timeframe", None))
    return history_source_reason != "exchange_fetch_failed" and bool(history_range and history_timeframe)


def has_strategy_activity_change_request_rerun_recommendation(
    change_request: ChangeRequest,
    *,
    maps,
) -> bool:
    linked_backtest = (
        maps.backtest_summary_by_id.get(change_request.linked_backtest_id)
        if change_request.linked_backtest_id
        else None
    )
    linked_history_source_reason = (
        read_strategy_activity_text(getattr(linked_backtest, "history_source_reason", None))
        or read_strategy_activity_text(change_request.linked_backtest_history_source_reason)
        or "none"
    )
    decision_range = read_strategy_activity_text(
        getattr(linked_backtest, "decision_recommended_data_range", None)
    ) or read_strategy_activity_text(change_request.linked_backtest_decision_recommended_data_range)
    decision_timeframe = read_strategy_activity_text(
        getattr(linked_backtest, "decision_recommended_timeframe", None)
    ) or read_strategy_activity_text(change_request.linked_backtest_decision_recommended_timeframe)
    if linked_history_source_reason != "exchange_fetch_failed" and decision_range and decision_timeframe:
        return True
    full_window_range = read_strategy_activity_text(
        getattr(linked_backtest, "full_window_recommended_data_range", None)
    ) or read_strategy_activity_text(change_request.linked_backtest_full_window_recommended_data_range)
    full_window_timeframe = read_strategy_activity_text(
        getattr(linked_backtest, "full_window_recommended_timeframe", None)
    ) or read_strategy_activity_text(change_request.linked_backtest_full_window_recommended_timeframe)
    if full_window_range and full_window_timeframe:
        return True
    history_range = read_strategy_activity_text(
        getattr(linked_backtest, "history_source_recommended_data_range", None)
    ) or read_strategy_activity_text(change_request.linked_backtest_history_source_recommended_data_range)
    history_timeframe = read_strategy_activity_text(
        getattr(linked_backtest, "history_source_recommended_timeframe", None)
    ) or read_strategy_activity_text(change_request.linked_backtest_history_source_recommended_timeframe)
    return linked_history_source_reason != "exchange_fetch_failed" and bool(history_range and history_timeframe)


def has_strategy_activity_review_rerun_recommendation(review: ReviewDocument) -> bool:
    decision_range = read_strategy_activity_text(getattr(review, "decision_recommended_data_range", None))
    decision_timeframe = read_strategy_activity_text(getattr(review, "decision_recommended_timeframe", None))
    return bool(decision_range and decision_timeframe)


def _build_strategy_activity_backtest_summary(
    item: BacktestRun,
) -> StrategyActivityBacktestSummary:
    return StrategyActivityBacktestSummary(
        id=item.id,
        status=item.status,
        timeframe=item.timeframe,
        data_range=item.data_range,
        sample_quality=item.sample_quality,
        history_source=item.history_source,
        decision_readiness=item.decision_readiness,
        source_change_request_id=item.source_change_request_id,
        source_backtest_id=item.source_backtest_id,
        source_review_id=item.source_review_id,
        source_proposal_id=item.source_proposal_id,
        trigger_reason=item.trigger_reason,
        created_at=item.started_at,
        finished_at=item.finished_at,
    )


def build_strategy_activity_backtest_summaries(
    recent_backtest_records: List[BacktestRun],
) -> List[StrategyActivityBacktestSummary]:
    return [
        _build_strategy_activity_backtest_summary(item)
        for item in recent_backtest_records
    ]


def _build_strategy_activity_job_summary(item: AgentJob) -> StrategyActivityJobSummary:
    return StrategyActivityJobSummary(
        id=item.id,
        job_type=item.job_type,
        status=item.status,
        strategy_id=str(item.context.get("strategy_id") or "") or None,
        backtest_id=str(item.context.get("backtest_id") or "") or None,
        source_change_request_id=str(item.context.get("source_change_request_id") or "") or None,
        source_backtest_id=str(item.context.get("source_backtest_id") or "") or None,
        source_review_id=str(item.context.get("source_review_id") or "") or None,
        source_proposal_id=str(item.context.get("source_proposal_id") or "") or None,
        requested_by=str(item.context.get("requested_by") or "") or None,
        result_summary=item.result_summary,
        linked_review_id=str(item.context.get("linked_review_id") or "") or None,
        linked_review_title=str(item.context.get("linked_review_title") or "") or None,
        linked_review_period=str(item.context.get("linked_review_period") or "") or None,
        writeback_target=item.writeback_target,
        created_at=item.created_at,
        updated_at=item.updated_at,
        retry_count=int(item.context.get("retry_count") or 0),
        retried_from_job_id=str(item.context.get("retried_from_job_id") or "") or None,
    )


def build_strategy_activity_job_summaries(
    recent_agent_job_records: List[AgentJob],
) -> Tuple[
    List[StrategyActivityJobSummary],
    Optional[StrategyActivityJobSummary],
    Optional[StrategyActivityJobSummary],
    Optional[AgentJob],
]:
    recent_agent_jobs: List[StrategyActivityJobSummary] = []
    latest_tracking_job: Optional[StrategyActivityJobSummary] = None
    latest_retryable_tracking_job: Optional[StrategyActivityJobSummary] = None
    latest_retryable_tracking_job_record: Optional[AgentJob] = None

    for item in recent_agent_job_records:
        summary = _build_strategy_activity_job_summary(item)
        recent_agent_jobs.append(summary)
        if summary.job_type not in {"review_strategy_issue", "review_strategy_change"}:
            continue
        if latest_tracking_job is None:
            latest_tracking_job = summary
        if latest_retryable_tracking_job is None and summary.status in {"failed", "cancelled"}:
            latest_retryable_tracking_job = summary
            latest_retryable_tracking_job_record = item
        if latest_tracking_job is not None and latest_retryable_tracking_job is not None:
            break
    return (
        recent_agent_jobs,
        latest_tracking_job,
        latest_retryable_tracking_job,
        latest_retryable_tracking_job_record,
    )


def build_strategy_activity_summary_collections(
    *,
    recent_review_records: List[ReviewDocument],
    strategy_proposal_count_by_review_id: Dict[str, int],
    recent_backtest_records: List[BacktestRun],
    recent_agent_job_records: List[AgentJob],
) -> StrategyActivitySummaryCollections:
    (
        recent_reviews,
        _recent_primary_review_records,
        recent_primary_review_summaries,
        recent_tracking_review_records,
        latest_actionable_primary_review,
    ) = build_strategy_activity_review_summaries(
        recent_review_records,
        strategy_proposal_count_by_review_id,
    )
    recent_backtests = build_strategy_activity_backtest_summaries(recent_backtest_records)
    (
        recent_agent_jobs,
        latest_tracking_job,
        latest_retryable_tracking_job,
        latest_retryable_tracking_job_record,
    ) = build_strategy_activity_job_summaries(recent_agent_job_records)
    return StrategyActivitySummaryCollections(
        recent_reviews=recent_reviews,
        recent_primary_review_summaries=recent_primary_review_summaries,
        recent_tracking_review_records=recent_tracking_review_records,
        latest_actionable_primary_review=latest_actionable_primary_review,
        recent_backtests=recent_backtests,
        recent_agent_jobs=recent_agent_jobs,
        latest_tracking_job=latest_tracking_job,
        latest_retryable_tracking_job=latest_retryable_tracking_job,
        latest_retryable_tracking_job_record=latest_retryable_tracking_job_record,
    )

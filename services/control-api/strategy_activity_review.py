from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from models import (
    AlertRecord,
    ChangeRequest,
    ExecutionEvent,
    OrderRecord,
    ReviewDocument,
    StrategyActivityBacktestSummary,
    StrategyActivityJobSummary,
    StrategyActivityReviewSummary,
    StrategyActivitySnapshot,
    StrategyProposal,
    TradeRecord,
)
from repository import AppRepository


@dataclass(frozen=True)
class StrategyActivityReviewContextIndexes:
    proposal_change_request_map: Dict[str, ChangeRequest]
    proposal_backtest_map: Dict[str, StrategyActivityBacktestSummary]
    proposal_review_map: Dict[str, ReviewDocument]
    backtest_by_id: Dict[str, StrategyActivityBacktestSummary]
    review_by_id: Dict[str, ReviewDocument]
    agent_job_by_id: Dict[str, StrategyActivityJobSummary]
    review_by_backtest_id: Dict[str, ReviewDocument]
    agent_job_by_backtest_id: Dict[str, StrategyActivityJobSummary]


def get_strategy_activity_change_request_source_proposal_id(change_request: ChangeRequest) -> Optional[str]:
    source_proposal_id = str(change_request.source_proposal_id or "").strip()
    if source_proposal_id:
        return source_proposal_id
    payload_proposal_id = str(change_request.payload.get("proposal_id") or "").strip()
    return payload_proposal_id or None


def build_strategy_activity_review_context_indexes(
    activity: StrategyActivitySnapshot,
) -> StrategyActivityReviewContextIndexes:
    proposal_change_request_map: Dict[str, ChangeRequest] = {}
    for change_request in activity.recent_change_requests:
        source_proposal_id = get_strategy_activity_change_request_source_proposal_id(change_request)
        if source_proposal_id and source_proposal_id not in proposal_change_request_map:
            proposal_change_request_map[source_proposal_id] = change_request

    proposal_backtest_map: Dict[str, StrategyActivityBacktestSummary] = {}
    for backtest in activity.recent_backtests:
        source_proposal_id = str(backtest.source_proposal_id or "").strip()
        if source_proposal_id and source_proposal_id not in proposal_backtest_map:
            proposal_backtest_map[source_proposal_id] = backtest

    proposal_review_map: Dict[str, ReviewDocument] = {}
    review_by_backtest_id: Dict[str, ReviewDocument] = {}
    for review in activity.recent_reviews:
        source_proposal_id = str(review.source_proposal_id or "").strip()
        if source_proposal_id and source_proposal_id not in proposal_review_map:
            proposal_review_map[source_proposal_id] = review
        backtest_id = str(review.backtest_id or "").strip()
        if backtest_id and backtest_id not in review_by_backtest_id:
            review_by_backtest_id[backtest_id] = review

    backtest_by_id = {item.id: item for item in activity.recent_backtests}
    review_by_id = {item.id: item for item in activity.recent_reviews}
    agent_job_by_id = {item.id: item for item in activity.recent_agent_jobs}

    agent_job_by_backtest_id: Dict[str, StrategyActivityJobSummary] = {}
    for job in activity.recent_agent_jobs:
        backtest_id = str(job.backtest_id or "").strip()
        if backtest_id and backtest_id not in agent_job_by_backtest_id:
            agent_job_by_backtest_id[backtest_id] = job

    return StrategyActivityReviewContextIndexes(
        proposal_change_request_map=proposal_change_request_map,
        proposal_backtest_map=proposal_backtest_map,
        proposal_review_map=proposal_review_map,
        backtest_by_id=backtest_by_id,
        review_by_id=review_by_id,
        agent_job_by_id=agent_job_by_id,
        review_by_backtest_id=review_by_backtest_id,
        agent_job_by_backtest_id=agent_job_by_backtest_id,
    )


def get_strategy_activity_linked_change_request_for_proposal(
    activity: StrategyActivitySnapshot,
    proposal: Optional[StrategyProposal],
    indexes: StrategyActivityReviewContextIndexes,
) -> Optional[ChangeRequest]:
    if proposal is None:
        return None
    if activity.latest_actionable_proposal and activity.latest_actionable_proposal.id == proposal.id:
        return activity.latest_actionable_proposal_change_request
    if activity.latest_proposal and activity.latest_proposal.id == proposal.id:
        return activity.latest_proposal_change_request
    return indexes.proposal_change_request_map.get(proposal.id)


def get_strategy_activity_linked_backtest_for_proposal(
    activity: StrategyActivitySnapshot,
    proposal: Optional[StrategyProposal],
    indexes: StrategyActivityReviewContextIndexes,
) -> Optional[StrategyActivityBacktestSummary]:
    if proposal is None:
        return None
    if activity.latest_actionable_proposal and activity.latest_actionable_proposal.id == proposal.id:
        if activity.latest_actionable_proposal_backtest is not None:
            return activity.latest_actionable_proposal_backtest
    if activity.latest_proposal and activity.latest_proposal.id == proposal.id:
        if activity.latest_proposal_backtest is not None:
            return activity.latest_proposal_backtest
    linked_backtest = indexes.proposal_backtest_map.get(proposal.id)
    if linked_backtest is not None:
        return linked_backtest
    linked_change_request = indexes.proposal_change_request_map.get(proposal.id)
    if linked_change_request and linked_change_request.linked_backtest_id:
        return indexes.backtest_by_id.get(linked_change_request.linked_backtest_id)
    linked_review = indexes.proposal_review_map.get(proposal.id)
    if linked_review and linked_review.backtest_id:
        return indexes.backtest_by_id.get(linked_review.backtest_id)
    return None


def get_strategy_activity_linked_review_for_proposal(
    activity: StrategyActivitySnapshot,
    proposal: Optional[StrategyProposal],
    indexes: StrategyActivityReviewContextIndexes,
) -> Optional[ReviewDocument]:
    if proposal is None:
        return None
    if activity.latest_actionable_proposal and activity.latest_actionable_proposal.id == proposal.id:
        if activity.latest_actionable_proposal_review is not None:
            return activity.latest_actionable_proposal_review
    if activity.latest_proposal and activity.latest_proposal.id == proposal.id:
        if activity.latest_proposal_review is not None:
            return activity.latest_proposal_review
    linked_review = indexes.proposal_review_map.get(proposal.id)
    if linked_review is not None:
        return linked_review
    linked_change_request = indexes.proposal_change_request_map.get(proposal.id)
    if linked_change_request and linked_change_request.linked_review_id:
        return indexes.review_by_id.get(linked_change_request.linked_review_id)
    linked_backtest = get_strategy_activity_linked_backtest_for_proposal(activity, proposal, indexes)
    if linked_backtest is not None:
        return indexes.review_by_backtest_id.get(linked_backtest.id)
    return None


def get_strategy_activity_linked_job_for_proposal(
    activity: StrategyActivitySnapshot,
    proposal: Optional[StrategyProposal],
    indexes: StrategyActivityReviewContextIndexes,
) -> Optional[StrategyActivityJobSummary]:
    if proposal is None:
        return None
    if activity.latest_actionable_proposal and activity.latest_actionable_proposal.id == proposal.id:
        if activity.latest_actionable_proposal_job is not None:
            return activity.latest_actionable_proposal_job
    if activity.latest_proposal and activity.latest_proposal.id == proposal.id:
        if activity.latest_proposal_job is not None:
            return activity.latest_proposal_job
    linked_change_request = get_strategy_activity_linked_change_request_for_proposal(activity, proposal, indexes)
    if linked_change_request and linked_change_request.follow_up_job_id:
        linked_job = indexes.agent_job_by_id.get(linked_change_request.follow_up_job_id)
        if linked_job is not None:
            return linked_job
    linked_review = get_strategy_activity_linked_review_for_proposal(activity, proposal, indexes)
    if linked_review and linked_review.source_job_id:
        linked_job = indexes.agent_job_by_id.get(linked_review.source_job_id)
        if linked_job is not None:
            return linked_job
    linked_backtest = get_strategy_activity_linked_backtest_for_proposal(activity, proposal, indexes)
    if linked_backtest is not None:
        return indexes.agent_job_by_backtest_id.get(linked_backtest.id)
    return None


def summarize_strategy_activity_proposal(
    activity: StrategyActivitySnapshot,
    proposal: StrategyProposal,
    indexes: StrategyActivityReviewContextIndexes,
) -> str:
    parts = [
        proposal.id,
        proposal.proposal_type,
        proposal.status,
        proposal.title,
        proposal.expected_impact,
    ]
    linked_change_request = get_strategy_activity_linked_change_request_for_proposal(activity, proposal, indexes)
    linked_backtest = get_strategy_activity_linked_backtest_for_proposal(activity, proposal, indexes)
    linked_review = get_strategy_activity_linked_review_for_proposal(activity, proposal, indexes)
    linked_job = get_strategy_activity_linked_job_for_proposal(activity, proposal, indexes)
    if linked_change_request:
        parts.append(f"变更 {linked_change_request.id}")
        if linked_change_request.manual_followup_required:
            parts.append("需人工跟进")
        if linked_change_request.follow_up_job_type:
            follow_up_parts = [f"跟踪 {linked_change_request.follow_up_job_type}"]
            if linked_change_request.follow_up_job_status:
                follow_up_parts.append(linked_change_request.follow_up_job_status.value)
            if linked_change_request.linked_review_title:
                follow_up_parts.append(f"结果 {linked_change_request.linked_review_title}")
            elif linked_change_request.follow_up_result_summary:
                follow_up_parts.append(linked_change_request.follow_up_result_summary)
            parts.append(" / ".join(follow_up_parts))
    elif linked_job:
        follow_up_parts = [f"任务 {linked_job.job_type}"]
        if linked_job.status:
            follow_up_parts.append(linked_job.status.value)
        if linked_job.linked_review_title:
            follow_up_parts.append(f"结果 {linked_job.linked_review_title}")
        elif linked_job.result_summary:
            follow_up_parts.append(linked_job.result_summary)
        parts.append(" / ".join(follow_up_parts))
    elif proposal.proposal_type == "script_patch_proposal" and proposal.status in {"pending", "testing"}:
        parts.append("接受后需人工跟进")
    if linked_backtest:
        parts.append(f"回测 {linked_backtest.id}")
    if linked_review:
        parts.append(f"复盘 {linked_review.id}")
    return " · ".join(parts)


def summarize_strategy_activity_order(order: OrderRecord) -> str:
    return f"{order.symbol} {order.side.value} {order.qty}@{order.price} · {order.status} · {order.source}"


def summarize_strategy_activity_trade(trade: TradeRecord) -> str:
    parts = [f"{trade.symbol} {trade.side.value} {trade.quantity}@{trade.price}", str(trade.status or "filled")]
    pnl = str(trade.pnl or "").strip()
    if pnl and pnl != "--":
        parts.append(f"pnl {pnl}")
    return " · ".join(parts)


def summarize_strategy_activity_alert(alert: AlertRecord) -> str:
    return f"{alert.severity} {alert.title} · {alert.description}"


def summarize_strategy_activity_event(event: ExecutionEvent) -> str:
    return AppRepository._summarize_execution_event(event)


def summarize_strategy_activity_backtest(backtest: StrategyActivityBacktestSummary) -> str:
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


def summarize_strategy_activity_review(review: ReviewDocument) -> str:
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


def summarize_strategy_activity_job(job: StrategyActivityJobSummary) -> str:
    parts = [f"{job.id} · {job.job_type}", job.status.value]
    if job.backtest_id:
        parts.append(f"回测 {job.backtest_id}")
    if job.linked_review_title:
        parts.append(f"结果 {job.linked_review_title}")
    elif job.linked_review_id:
        parts.append(f"复盘 {job.linked_review_id}")
    elif job.result_summary:
        parts.append(job.result_summary)
    return " · ".join(parts)


def summarize_strategy_activity_change_request(change_request: ChangeRequest) -> str:
    parts = [f"{change_request.id} · {change_request.type}", change_request.status.value]
    if change_request.manual_followup_required:
        parts.append("需人工跟进")
    if change_request.linked_backtest_id:
        parts.append(f"回测 {change_request.linked_backtest_id}")
    if change_request.linked_review_id:
        parts.append(f"复盘 {change_request.linked_review_id}")
    return " · ".join(parts)


def _build_strategy_activity_review_summary(
    review_record: ReviewDocument,
    strategy_proposal_count_by_review_id: Dict[str, int],
) -> StrategyActivityReviewSummary:
    return StrategyActivityReviewSummary(
        id=review_record.id,
        period=review_record.period,
        backtest_id=review_record.backtest_id,
        source_job_id=review_record.source_job_id,
        source_job_type=review_record.source_job_type,
        source_job_status=review_record.source_job_status,
        source_change_request_id=review_record.source_change_request_id,
        source_backtest_id=review_record.source_backtest_id,
        source_review_id=review_record.source_review_id,
        source_proposal_id=review_record.source_proposal_id,
        trigger_reason=review_record.trigger_reason,
        title=review_record.title,
        summary=review_record.summary,
        proposal_count=strategy_proposal_count_by_review_id.get(review_record.id, 0),
        created_at=review_record.created_at,
    )


def build_strategy_activity_review_summaries(
    recent_review_records: List[ReviewDocument],
    strategy_proposal_count_by_review_id: Dict[str, int],
) -> Tuple[
    List[StrategyActivityReviewSummary],
    List[ReviewDocument],
    List[StrategyActivityReviewSummary],
    List[StrategyActivityReviewSummary],
    Optional[StrategyActivityReviewSummary],
]:
    from strategy_activity_summary import has_strategy_activity_review_rerun_recommendation

    recent_reviews: List[StrategyActivityReviewSummary] = []
    recent_primary_review_records: List[ReviewDocument] = []
    recent_primary_review_summaries: List[StrategyActivityReviewSummary] = []
    recent_tracking_review_records: List[StrategyActivityReviewSummary] = []
    latest_actionable_primary_review: Optional[StrategyActivityReviewSummary] = None

    for review_record in recent_review_records:
        review_summary = _build_strategy_activity_review_summary(
            review_record,
            strategy_proposal_count_by_review_id,
        )
        recent_reviews.append(review_summary)
        if review_summary.period in {"strategy_issue", "strategy_change"}:
            recent_tracking_review_records.append(review_summary)
            continue
        recent_primary_review_records.append(review_record)
        recent_primary_review_summaries.append(review_summary)
        if (
            latest_actionable_primary_review is None
            and has_strategy_activity_review_rerun_recommendation(review_record)
        ):
            latest_actionable_primary_review = review_summary
    return (
        recent_reviews,
        recent_primary_review_records,
        recent_primary_review_summaries,
        recent_tracking_review_records,
        latest_actionable_primary_review,
    )

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Tuple

from models import (
    AgentJob,
    BacktestRun,
    ChangeRequest,
    ReviewDocument,
    StrategyActivityBacktestSummary,
    StrategyActivityJobSummary,
    StrategyActivityReviewSummary,
    StrategyProposal,
)


@dataclass(frozen=True)
class StrategyActivityProposalLinkage:
    change_request: Optional[ChangeRequest]
    backtest: Optional[StrategyActivityBacktestSummary]
    review: Optional[StrategyActivityReviewSummary]
    job: Optional[StrategyActivityJobSummary]
    backtest_record: Optional[BacktestRun]
    review_record: Optional[ReviewDocument]
    job_record: Optional[AgentJob]


@dataclass(frozen=True)
class StrategyActivityChangeRequestLinkage:
    backtest_record: Optional[BacktestRun]
    review_record: Optional[ReviewDocument]
    job_record: Optional[AgentJob]
    source_backtest_record: Optional[BacktestRun]
    source_review_record: Optional[ReviewDocument]
    source_proposal_record: Optional[StrategyProposal]


@dataclass(frozen=True)
class StrategyActivityBacktestLinkage:
    review: Optional[StrategyActivityReviewSummary]
    job: Optional[StrategyActivityJobSummary]
    review_record: Optional[ReviewDocument]
    job_record: Optional[AgentJob]


@dataclass(frozen=True)
class StrategyActivityReviewLinkage:
    review_record: Optional[ReviewDocument]
    job_record: Optional[AgentJob]


@dataclass(frozen=True)
class StrategyActivityReviewTailLinkage:
    latest_primary_review: Optional[StrategyActivityReviewSummary]
    latest_actionable_primary_review: Optional[StrategyActivityReviewSummary]
    latest_primary_review_record: Optional[ReviewDocument]
    latest_actionable_primary_review_record: Optional[ReviewDocument]
    latest_tracking_review: Optional[StrategyActivityReviewSummary]
    latest_tracking_review_record: Optional[ReviewDocument]
    latest_tracking_job_record: Optional[AgentJob]


@dataclass(frozen=True)
class StrategyActivityLineageMaps:
    proposal_change_request_map: Dict[str, ChangeRequest]
    proposal_backtest_map: Dict[str, StrategyActivityBacktestSummary]
    proposal_review_map: Dict[str, StrategyActivityReviewSummary]
    proposal_by_id: Dict[str, StrategyProposal]
    backtest_summary_by_id: Dict[str, StrategyActivityBacktestSummary]
    backtest_record_by_id: Dict[str, BacktestRun]
    review_summary_by_id: Dict[str, StrategyActivityReviewSummary]
    review_record_by_id: Dict[str, ReviewDocument]
    agent_job_summary_by_id: Dict[str, StrategyActivityJobSummary]
    agent_job_record_by_id: Dict[str, AgentJob]
    review_summary_by_backtest_id: Dict[str, StrategyActivityReviewSummary]
    agent_job_summary_by_backtest_id: Dict[str, StrategyActivityJobSummary]
    retryable_agent_job_summary_by_backtest_id: Dict[str, StrategyActivityJobSummary]


@dataclass(frozen=True)
class StrategyActivityLineageContext:
    latest_backtest_record: Optional[BacktestRun]
    latest_actionable_backtest_record: Optional[BacktestRun]
    latest_backtest: Optional[StrategyActivityBacktestSummary]
    latest_actionable_backtest: Optional[StrategyActivityBacktestSummary]
    latest_backtest_linkage: StrategyActivityBacktestLinkage
    latest_actionable_backtest_linkage: StrategyActivityBacktestLinkage
    review_tail_linkage: StrategyActivityReviewTailLinkage
    latest_proposal: Optional[StrategyProposal]
    latest_actionable_proposal: Optional[StrategyProposal]
    latest_proposal_linkage: StrategyActivityProposalLinkage
    latest_actionable_proposal_linkage: StrategyActivityProposalLinkage
    latest_change_request: Optional[ChangeRequest]
    latest_actionable_change_request: Optional[ChangeRequest]
    latest_change_request_linkage: StrategyActivityChangeRequestLinkage
    latest_actionable_change_request_linkage: StrategyActivityChangeRequestLinkage
    latest_retryable_tracking_job: Optional[StrategyActivityJobSummary]
    latest_retryable_tracking_job_record: Optional[AgentJob]


def get_strategy_activity_change_request_source_proposal_id(
    change_request: ChangeRequest,
) -> Optional[str]:
    source_proposal_id = str(change_request.source_proposal_id or "").strip()
    if source_proposal_id:
        return source_proposal_id
    payload_proposal_id = str(change_request.payload.get("proposal_id") or "").strip()
    return payload_proposal_id or None


def get_strategy_activity_change_request_source_backtest_id(
    change_request: ChangeRequest,
) -> Optional[str]:
    source_backtest_id = str(change_request.source_backtest_id or "").strip()
    return source_backtest_id or None


def get_strategy_activity_change_request_source_review_id(
    change_request: ChangeRequest,
) -> Optional[str]:
    source_review_id = str(change_request.source_review_id or "").strip()
    return source_review_id or None


def build_strategy_activity_lineage_maps(
    *,
    recent_change_requests: List[ChangeRequest],
    recent_backtests: List[StrategyActivityBacktestSummary],
    recent_backtest_records: List[BacktestRun],
    recent_reviews: List[StrategyActivityReviewSummary],
    recent_review_records: List[ReviewDocument],
    recent_agent_jobs: List[StrategyActivityJobSummary],
    recent_agent_job_records: List[AgentJob],
    recent_proposals: List[StrategyProposal],
) -> StrategyActivityLineageMaps:
    proposal_change_request_map: Dict[str, ChangeRequest] = {}
    for change_request in recent_change_requests:
        source_proposal_id = get_strategy_activity_change_request_source_proposal_id(change_request)
        if source_proposal_id and source_proposal_id not in proposal_change_request_map:
            proposal_change_request_map[source_proposal_id] = change_request

    proposal_backtest_map: Dict[str, StrategyActivityBacktestSummary] = {}
    for backtest in recent_backtests:
        source_proposal_id = str(backtest.source_proposal_id or "").strip()
        if source_proposal_id and source_proposal_id not in proposal_backtest_map:
            proposal_backtest_map[source_proposal_id] = backtest

    proposal_review_map: Dict[str, StrategyActivityReviewSummary] = {}
    review_summary_by_backtest_id: Dict[str, StrategyActivityReviewSummary] = {}
    for review in recent_reviews:
        source_proposal_id = str(review.source_proposal_id or "").strip()
        if source_proposal_id and source_proposal_id not in proposal_review_map:
            proposal_review_map[source_proposal_id] = review
        backtest_id = str(review.backtest_id or "").strip()
        if backtest_id and backtest_id not in review_summary_by_backtest_id:
            review_summary_by_backtest_id[backtest_id] = review

    agent_job_summary_by_backtest_id: Dict[str, StrategyActivityJobSummary] = {}
    retryable_agent_job_summary_by_backtest_id: Dict[str, StrategyActivityJobSummary] = {}
    for job in recent_agent_jobs:
        backtest_id = str(job.backtest_id or "").strip()
        if backtest_id and backtest_id not in agent_job_summary_by_backtest_id:
            agent_job_summary_by_backtest_id[backtest_id] = job
        if (
            backtest_id
            and job.status in {"failed", "cancelled"}
            and backtest_id not in retryable_agent_job_summary_by_backtest_id
        ):
            retryable_agent_job_summary_by_backtest_id[backtest_id] = job

    return StrategyActivityLineageMaps(
        proposal_change_request_map=proposal_change_request_map,
        proposal_backtest_map=proposal_backtest_map,
        proposal_review_map=proposal_review_map,
        proposal_by_id={item.id: item for item in recent_proposals},
        backtest_summary_by_id={item.id: item for item in recent_backtests},
        backtest_record_by_id={item.id: item for item in recent_backtest_records},
        review_summary_by_id={item.id: item for item in recent_reviews},
        review_record_by_id={item.id: item for item in recent_review_records},
        agent_job_summary_by_id={item.id: item for item in recent_agent_jobs},
        agent_job_record_by_id={item.id: item for item in recent_agent_job_records},
        review_summary_by_backtest_id=review_summary_by_backtest_id,
        agent_job_summary_by_backtest_id=agent_job_summary_by_backtest_id,
        retryable_agent_job_summary_by_backtest_id=retryable_agent_job_summary_by_backtest_id,
    )


def get_strategy_activity_linked_backtest_for_proposal(
    proposal: Optional[StrategyProposal],
    *,
    maps: StrategyActivityLineageMaps,
) -> Optional[StrategyActivityBacktestSummary]:
    if proposal is None:
        return None
    linked_backtest = maps.proposal_backtest_map.get(proposal.id)
    if linked_backtest is not None:
        return linked_backtest
    linked_change_request = maps.proposal_change_request_map.get(proposal.id)
    if linked_change_request and linked_change_request.linked_backtest_id:
        return maps.backtest_summary_by_id.get(linked_change_request.linked_backtest_id)
    linked_review = maps.proposal_review_map.get(proposal.id)
    if linked_review and linked_review.backtest_id:
        return maps.backtest_summary_by_id.get(linked_review.backtest_id)
    return None


def get_strategy_activity_linked_review_for_proposal(
    proposal: Optional[StrategyProposal],
    *,
    maps: StrategyActivityLineageMaps,
) -> Optional[StrategyActivityReviewSummary]:
    if proposal is None:
        return None
    linked_review = maps.proposal_review_map.get(proposal.id)
    if linked_review is not None:
        return linked_review
    linked_change_request = maps.proposal_change_request_map.get(proposal.id)
    if linked_change_request and linked_change_request.linked_review_id:
        return maps.review_summary_by_id.get(linked_change_request.linked_review_id)
    linked_backtest = get_strategy_activity_linked_backtest_for_proposal(proposal, maps=maps)
    if linked_backtest is not None:
        return maps.review_summary_by_backtest_id.get(linked_backtest.id)
    return None


def get_strategy_activity_linked_job_for_proposal(
    proposal: Optional[StrategyProposal],
    *,
    maps: StrategyActivityLineageMaps,
) -> Optional[StrategyActivityJobSummary]:
    if proposal is None:
        return None
    linked_change_request = maps.proposal_change_request_map.get(proposal.id)
    if linked_change_request and linked_change_request.follow_up_job_id:
        linked_job = maps.agent_job_summary_by_id.get(linked_change_request.follow_up_job_id)
        if linked_job is not None:
            return linked_job
    linked_review = get_strategy_activity_linked_review_for_proposal(proposal, maps=maps)
    if linked_review and linked_review.source_job_id:
        linked_job = maps.agent_job_summary_by_id.get(linked_review.source_job_id)
        if linked_job is not None:
            return linked_job
    linked_backtest = get_strategy_activity_linked_backtest_for_proposal(proposal, maps=maps)
    if linked_backtest is not None:
        return maps.agent_job_summary_by_backtest_id.get(linked_backtest.id)
    return None


def build_strategy_activity_proposal_linkage(
    proposal: Optional[StrategyProposal],
    *,
    maps: StrategyActivityLineageMaps,
) -> StrategyActivityProposalLinkage:
    if proposal is None:
        return StrategyActivityProposalLinkage(
            change_request=None,
            backtest=None,
            review=None,
            job=None,
            backtest_record=None,
            review_record=None,
            job_record=None,
        )
    change_request = maps.proposal_change_request_map.get(proposal.id)
    backtest = get_strategy_activity_linked_backtest_for_proposal(proposal, maps=maps)
    review = get_strategy_activity_linked_review_for_proposal(proposal, maps=maps)
    job = get_strategy_activity_linked_job_for_proposal(proposal, maps=maps)
    return StrategyActivityProposalLinkage(
        change_request=change_request,
        backtest=backtest,
        review=review,
        job=job,
        backtest_record=maps.backtest_record_by_id.get(backtest.id) if backtest is not None else None,
        review_record=maps.review_record_by_id.get(review.id) if review is not None else None,
        job_record=maps.agent_job_record_by_id.get(job.id) if job is not None else None,
    )


def build_strategy_activity_change_request_linkage(
    change_request: Optional[ChangeRequest],
    *,
    maps: StrategyActivityLineageMaps,
) -> StrategyActivityChangeRequestLinkage:
    if change_request is None:
        return StrategyActivityChangeRequestLinkage(
            backtest_record=None,
            review_record=None,
            job_record=None,
            source_backtest_record=None,
            source_review_record=None,
            source_proposal_record=None,
        )
    return StrategyActivityChangeRequestLinkage(
        backtest_record=maps.backtest_record_by_id.get(change_request.linked_backtest_id)
        if change_request.linked_backtest_id
        else None,
        review_record=maps.review_record_by_id.get(change_request.linked_review_id)
        if change_request.linked_review_id
        else None,
        job_record=maps.agent_job_record_by_id.get(change_request.follow_up_job_id)
        if change_request.follow_up_job_id
        else None,
        source_backtest_record=maps.backtest_record_by_id.get(
            get_strategy_activity_change_request_source_backtest_id(change_request)
        ),
        source_review_record=maps.review_record_by_id.get(
            get_strategy_activity_change_request_source_review_id(change_request)
        ),
        source_proposal_record=maps.proposal_by_id.get(
            get_strategy_activity_change_request_source_proposal_id(change_request)
        ),
    )


def build_strategy_activity_backtest_linkage(
    backtest: Optional[StrategyActivityBacktestSummary],
    *,
    maps: StrategyActivityLineageMaps,
) -> StrategyActivityBacktestLinkage:
    if backtest is None:
        return StrategyActivityBacktestLinkage(review=None, job=None, review_record=None, job_record=None)
    review = maps.review_summary_by_backtest_id.get(backtest.id)
    job = maps.agent_job_summary_by_backtest_id.get(backtest.id)
    return StrategyActivityBacktestLinkage(
        review=review,
        job=job,
        review_record=maps.review_record_by_id.get(review.id) if review is not None else None,
        job_record=maps.agent_job_record_by_id.get(job.id) if job is not None else None,
    )


def build_strategy_activity_review_linkage(
    review: Optional[StrategyActivityReviewSummary],
    *,
    maps: StrategyActivityLineageMaps,
    job: Optional[StrategyActivityJobSummary] = None,
) -> StrategyActivityReviewLinkage:
    if review is None:
        return StrategyActivityReviewLinkage(
            review_record=None,
            job_record=maps.agent_job_record_by_id.get(job.id) if job is not None else None,
        )
    linked_job = job or (maps.agent_job_summary_by_id.get(review.source_job_id) if review.source_job_id else None)
    return StrategyActivityReviewLinkage(
        review_record=maps.review_record_by_id.get(review.id),
        job_record=maps.agent_job_record_by_id.get(linked_job.id) if linked_job is not None else None,
    )


def build_strategy_activity_review_tail_linkage(
    *,
    recent_primary_review_summaries: list[StrategyActivityReviewSummary],
    latest_actionable_primary_review: Optional[StrategyActivityReviewSummary],
    recent_tracking_review_records: list[StrategyActivityReviewSummary],
    latest_tracking_job: Optional[StrategyActivityJobSummary],
    maps: StrategyActivityLineageMaps,
) -> StrategyActivityReviewTailLinkage:
    latest_primary_review = next(iter(recent_primary_review_summaries), None)
    latest_primary_review_linkage = build_strategy_activity_review_linkage(
        latest_primary_review,
        maps=maps,
    )
    latest_actionable_primary_review_linkage = build_strategy_activity_review_linkage(
        latest_actionable_primary_review,
        maps=maps,
    )
    latest_tracking_review = next(iter(recent_tracking_review_records), None)
    latest_tracking_review_linkage = build_strategy_activity_review_linkage(
        latest_tracking_review,
        maps=maps,
        job=latest_tracking_job,
    )
    return StrategyActivityReviewTailLinkage(
        latest_primary_review=latest_primary_review,
        latest_actionable_primary_review=latest_actionable_primary_review,
        latest_primary_review_record=latest_primary_review_linkage.review_record,
        latest_actionable_primary_review_record=latest_actionable_primary_review_linkage.review_record,
        latest_tracking_review=latest_tracking_review,
        latest_tracking_review_record=latest_tracking_review_linkage.review_record,
        latest_tracking_job_record=latest_tracking_review_linkage.job_record,
    )


def pick_latest_and_actionable_strategy_activity_backtest_record(
    recent_backtest_records: list[BacktestRun],
    *,
    maps: StrategyActivityLineageMaps,
    has_backtest_rerun_recommendation: Callable[[BacktestRun], bool],
) -> tuple[Optional[BacktestRun], Optional[BacktestRun]]:
    latest_backtest_record: Optional[BacktestRun] = None
    latest_actionable_backtest_record: Optional[BacktestRun] = None
    for item in recent_backtest_records:
        if latest_backtest_record is None:
            latest_backtest_record = item
        if latest_actionable_backtest_record is None and (
            has_backtest_rerun_recommendation(item)
            or item.id in maps.retryable_agent_job_summary_by_backtest_id
        ):
            latest_actionable_backtest_record = item
        if latest_backtest_record is not None and latest_actionable_backtest_record is not None:
            break
    return latest_backtest_record, latest_actionable_backtest_record


def pick_latest_and_actionable_strategy_activity_proposal(
    recent_proposals: list[StrategyProposal],
) -> tuple[Optional[StrategyProposal], Optional[StrategyProposal]]:
    latest_proposal: Optional[StrategyProposal] = None
    latest_actionable_proposal: Optional[StrategyProposal] = None
    for proposal in recent_proposals:
        if latest_proposal is None:
            latest_proposal = proposal
        if latest_actionable_proposal is None and proposal.status in {"pending", "testing"}:
            latest_actionable_proposal = proposal
        if latest_proposal is not None and latest_actionable_proposal is not None:
            break
    return latest_proposal, latest_actionable_proposal


def pick_latest_and_actionable_strategy_activity_change_request(
    recent_change_requests: list[ChangeRequest],
    *,
    maps: StrategyActivityLineageMaps,
    has_change_request_rerun_recommendation: Callable[[ChangeRequest, StrategyActivityLineageMaps], bool],
) -> tuple[Optional[ChangeRequest], Optional[ChangeRequest]]:
    latest_change_request: Optional[ChangeRequest] = None
    latest_actionable_change_request: Optional[ChangeRequest] = None
    for item in recent_change_requests:
        if latest_change_request is None:
            latest_change_request = item
        if latest_actionable_change_request is None and (
            (item.follow_up_job_id and item.follow_up_job_status in {"failed", "cancelled"})
            or has_change_request_rerun_recommendation(item, maps=maps)
        ):
            latest_actionable_change_request = item
        if latest_change_request is not None and latest_actionable_change_request is not None:
            break
    return latest_change_request, latest_actionable_change_request


def build_strategy_activity_lineage_context_kwargs(
    *,
    latest_backtest_record: Optional[BacktestRun],
    latest_actionable_backtest_record: Optional[BacktestRun],
    latest_backtest: Optional[StrategyActivityBacktestSummary],
    latest_actionable_backtest: Optional[StrategyActivityBacktestSummary],
    latest_backtest_linkage: StrategyActivityBacktestLinkage,
    latest_actionable_backtest_linkage: StrategyActivityBacktestLinkage,
    review_tail_linkage: StrategyActivityReviewTailLinkage,
    latest_proposal: Optional[StrategyProposal],
    latest_actionable_proposal: Optional[StrategyProposal],
    latest_proposal_linkage: StrategyActivityProposalLinkage,
    latest_actionable_proposal_linkage: StrategyActivityProposalLinkage,
    latest_change_request: Optional[ChangeRequest],
    latest_actionable_change_request: Optional[ChangeRequest],
    latest_change_request_linkage: StrategyActivityChangeRequestLinkage,
    latest_actionable_change_request_linkage: StrategyActivityChangeRequestLinkage,
    latest_retryable_tracking_job: Optional[StrategyActivityJobSummary],
    latest_retryable_tracking_job_record: Optional[AgentJob],
) -> Dict[str, Any]:
    return {
        "latest_backtest_record": latest_backtest_record,
        "latest_actionable_backtest_record": latest_actionable_backtest_record,
        "latest_backtest": latest_backtest,
        "latest_actionable_backtest": latest_actionable_backtest,
        "latest_backtest_linkage": latest_backtest_linkage,
        "latest_actionable_backtest_linkage": latest_actionable_backtest_linkage,
        "review_tail_linkage": review_tail_linkage,
        "latest_proposal": latest_proposal,
        "latest_actionable_proposal": latest_actionable_proposal,
        "latest_proposal_linkage": latest_proposal_linkage,
        "latest_actionable_proposal_linkage": latest_actionable_proposal_linkage,
        "latest_change_request": latest_change_request,
        "latest_actionable_change_request": latest_actionable_change_request,
        "latest_change_request_linkage": latest_change_request_linkage,
        "latest_actionable_change_request_linkage": latest_actionable_change_request_linkage,
        "latest_retryable_tracking_job": latest_retryable_tracking_job,
        "latest_retryable_tracking_job_record": latest_retryable_tracking_job_record,
    }


def build_strategy_activity_lineage_context(
    *,
    recent_backtest_records: list[BacktestRun],
    recent_backtests: list[StrategyActivityBacktestSummary],
    recent_primary_review_summaries: list[StrategyActivityReviewSummary],
    latest_actionable_primary_review: Optional[StrategyActivityReviewSummary],
    recent_tracking_review_records: list[StrategyActivityReviewSummary],
    latest_tracking_job: Optional[StrategyActivityJobSummary],
    recent_proposals: list[StrategyProposal],
    recent_change_requests: list[ChangeRequest],
    latest_retryable_tracking_job: Optional[StrategyActivityJobSummary],
    latest_retryable_tracking_job_record: Optional[AgentJob],
    maps: StrategyActivityLineageMaps,
    has_backtest_rerun_recommendation: Callable[[BacktestRun], bool],
    has_change_request_rerun_recommendation: Callable[[ChangeRequest, StrategyActivityLineageMaps], bool],
) -> StrategyActivityLineageContext:
    latest_backtest_record, latest_actionable_backtest_record = (
        pick_latest_and_actionable_strategy_activity_backtest_record(
            recent_backtest_records,
            maps=maps,
            has_backtest_rerun_recommendation=has_backtest_rerun_recommendation,
        )
    )
    latest_backtest = next(iter(recent_backtests), None)
    latest_actionable_backtest = (
        maps.backtest_summary_by_id[latest_actionable_backtest_record.id]
        if latest_actionable_backtest_record is not None
        else None
    )
    latest_backtest_linkage = build_strategy_activity_backtest_linkage(latest_backtest, maps=maps)
    latest_actionable_backtest_linkage = build_strategy_activity_backtest_linkage(
        latest_actionable_backtest,
        maps=maps,
    )
    review_tail_linkage = build_strategy_activity_review_tail_linkage(
        recent_primary_review_summaries=recent_primary_review_summaries,
        latest_actionable_primary_review=latest_actionable_primary_review,
        recent_tracking_review_records=recent_tracking_review_records,
        latest_tracking_job=latest_tracking_job,
        maps=maps,
    )
    latest_proposal, latest_actionable_proposal = pick_latest_and_actionable_strategy_activity_proposal(
        recent_proposals
    )
    latest_proposal_linkage = build_strategy_activity_proposal_linkage(latest_proposal, maps=maps)
    latest_actionable_proposal_linkage = build_strategy_activity_proposal_linkage(
        latest_actionable_proposal,
        maps=maps,
    )
    latest_change_request, latest_actionable_change_request = (
        pick_latest_and_actionable_strategy_activity_change_request(
            recent_change_requests,
            maps=maps,
            has_change_request_rerun_recommendation=has_change_request_rerun_recommendation,
        )
    )
    latest_change_request_linkage = build_strategy_activity_change_request_linkage(
        latest_change_request,
        maps=maps,
    )
    latest_actionable_change_request_linkage = build_strategy_activity_change_request_linkage(
        latest_actionable_change_request,
        maps=maps,
    )
    return StrategyActivityLineageContext(
        **build_strategy_activity_lineage_context_kwargs(
            latest_backtest_record=latest_backtest_record,
            latest_actionable_backtest_record=latest_actionable_backtest_record,
            latest_backtest=latest_backtest,
            latest_actionable_backtest=latest_actionable_backtest,
            latest_backtest_linkage=latest_backtest_linkage,
            latest_actionable_backtest_linkage=latest_actionable_backtest_linkage,
            review_tail_linkage=review_tail_linkage,
            latest_proposal=latest_proposal,
            latest_actionable_proposal=latest_actionable_proposal,
            latest_proposal_linkage=latest_proposal_linkage,
            latest_actionable_proposal_linkage=latest_actionable_proposal_linkage,
            latest_change_request=latest_change_request,
            latest_actionable_change_request=latest_actionable_change_request,
            latest_change_request_linkage=latest_change_request_linkage,
            latest_actionable_change_request_linkage=latest_actionable_change_request_linkage,
            latest_retryable_tracking_job=latest_retryable_tracking_job,
            latest_retryable_tracking_job_record=latest_retryable_tracking_job_record,
        )
    )

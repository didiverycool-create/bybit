import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivitySnapshot,
  StrategyProposal,
} from '../types'
import {
  resolveStrategyActivityDecisionSection,
  resolveStrategyActivitySection,
} from './strategyActivitySelectorStructure'
import { preferStrategyActivitySectionPriority } from './strategyActivitySelectorPriority'

export function resolveStrategyActivityChangeRequestSources(activity?: StrategyActivitySnapshot | null) {
  const changeRequestSection = resolveStrategyActivitySection(activity, 'change_request')
  const changeRequestDecisionContext = resolveStrategyActivityDecisionSection(activity, 'change_request')
  return {
    latestChangeRequest: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest,
      undefined,
    ),
    latestActionableChangeRequest: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_actionable,
      undefined,
    ),
    latestChangeRequestBacktestRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_backtest_record,
      changeRequestDecisionContext?.latest_backtest_record,
    ),
    latestChangeRequestReviewRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_review_record,
      changeRequestDecisionContext?.latest_review_record,
    ),
    latestChangeRequestJobRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_job_record,
      changeRequestDecisionContext?.latest_job_record,
    ),
    latestChangeRequestSourceBacktestRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_source_backtest_record,
      changeRequestDecisionContext?.latest_source_backtest_record,
    ),
    latestChangeRequestSourceReviewRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_source_review_record,
      changeRequestDecisionContext?.latest_source_review_record,
    ),
    latestChangeRequestSourceProposalRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_source_proposal_record,
      changeRequestDecisionContext?.latest_source_proposal_record,
    ),
    latestActionableChangeRequestBacktestRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_actionable_backtest_record,
      changeRequestDecisionContext?.actionable_backtest_record,
    ),
    latestActionableChangeRequestReviewRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_actionable_review_record,
      changeRequestDecisionContext?.actionable_review_record,
    ),
    latestActionableChangeRequestJobRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_actionable_job_record,
      changeRequestDecisionContext?.actionable_job_record,
    ),
    latestActionableChangeRequestSourceBacktestRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_actionable_source_backtest_record,
      changeRequestDecisionContext?.actionable_source_backtest_record,
    ),
    latestActionableChangeRequestSourceReviewRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_actionable_source_review_record,
      changeRequestDecisionContext?.actionable_source_review_record,
    ),
    latestActionableChangeRequestSourceProposalRecord: preferStrategyActivitySectionPriority(
      changeRequestSection?.latest_actionable_source_proposal_record,
      changeRequestDecisionContext?.actionable_source_proposal_record,
    ),
  } satisfies {
    latestChangeRequest: ChangeRequest | null
    latestActionableChangeRequest: ChangeRequest | null
    latestChangeRequestBacktestRecord: BacktestRun | null
    latestChangeRequestReviewRecord: ReviewDocument | null
    latestChangeRequestJobRecord: AgentJob | null
    latestChangeRequestSourceBacktestRecord: BacktestRun | null
    latestChangeRequestSourceReviewRecord: ReviewDocument | null
    latestChangeRequestSourceProposalRecord: StrategyProposal | null
    latestActionableChangeRequestBacktestRecord: BacktestRun | null
    latestActionableChangeRequestReviewRecord: ReviewDocument | null
    latestActionableChangeRequestJobRecord: AgentJob | null
    latestActionableChangeRequestSourceBacktestRecord: BacktestRun | null
    latestActionableChangeRequestSourceReviewRecord: ReviewDocument | null
    latestActionableChangeRequestSourceProposalRecord: StrategyProposal | null
  }
}

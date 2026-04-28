import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyActivityBacktestSummary,
  StrategyActivityJobSummary,
  StrategyActivityReviewSummary,
  StrategyActivitySnapshot,
  StrategyProposal,
} from '../types'
import {
  resolveStrategyActivityDecisionSection,
  resolveStrategyActivitySection,
} from './strategyActivitySelectorStructure'
import { preferStrategyActivitySectionPriority } from './strategyActivitySelectorPriority'

export function resolveStrategyActivityProposalSources(activity?: StrategyActivitySnapshot | null) {
  const proposalSection = resolveStrategyActivitySection(activity, 'proposal')
  const proposalDecisionContext = resolveStrategyActivityDecisionSection(activity, 'proposal')
  return {
    latestProposal: preferStrategyActivitySectionPriority(
      proposalSection?.latest,
      undefined,
    ),
    latestActionableProposal: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable,
      undefined,
    ),
    latestProposalChangeRequest: preferStrategyActivitySectionPriority(
      proposalSection?.latest_change_request,
      undefined,
    ),
    latestActionableProposalChangeRequest: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable_change_request,
      undefined,
    ),
    latestProposalBacktest: preferStrategyActivitySectionPriority(
      proposalSection?.latest_backtest,
      undefined,
    ),
    latestActionableProposalBacktest: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable_backtest,
      undefined,
    ),
    latestProposalReview: preferStrategyActivitySectionPriority(
      proposalSection?.latest_review,
      undefined,
    ),
    latestActionableProposalReview: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable_review,
      undefined,
    ),
    latestProposalJob: preferStrategyActivitySectionPriority(
      proposalSection?.latest_job,
      undefined,
    ),
    latestActionableProposalJob: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable_job,
      undefined,
    ),
    latestProposalBacktestRecord: preferStrategyActivitySectionPriority(
      proposalSection?.latest_backtest_record,
      proposalDecisionContext?.latest_backtest_record,
    ),
    latestActionableProposalBacktestRecord: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable_backtest_record,
      proposalDecisionContext?.actionable_backtest_record,
    ),
    latestProposalReviewRecord: preferStrategyActivitySectionPriority(
      proposalSection?.latest_review_record,
      proposalDecisionContext?.latest_review_record,
    ),
    latestActionableProposalReviewRecord: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable_review_record,
      proposalDecisionContext?.actionable_review_record,
    ),
    latestProposalJobRecord: preferStrategyActivitySectionPriority(
      proposalSection?.latest_job_record,
      proposalDecisionContext?.latest_job_record,
    ),
    latestActionableProposalJobRecord: preferStrategyActivitySectionPriority(
      proposalSection?.latest_actionable_job_record,
      proposalDecisionContext?.actionable_job_record,
    ),
  } satisfies {
    latestProposal: StrategyProposal | null
    latestActionableProposal: StrategyProposal | null
    latestProposalChangeRequest: ChangeRequest | null
    latestActionableProposalChangeRequest: ChangeRequest | null
    latestProposalBacktest: StrategyActivityBacktestSummary | null
    latestActionableProposalBacktest: StrategyActivityBacktestSummary | null
    latestProposalReview: StrategyActivityReviewSummary | null
    latestActionableProposalReview: StrategyActivityReviewSummary | null
    latestProposalJob: StrategyActivityJobSummary | null
    latestActionableProposalJob: StrategyActivityJobSummary | null
    latestProposalBacktestRecord: BacktestRun | null
    latestActionableProposalBacktestRecord: BacktestRun | null
    latestProposalReviewRecord: ReviewDocument | null
    latestActionableProposalReviewRecord: ReviewDocument | null
    latestProposalJobRecord: AgentJob | null
    latestActionableProposalJobRecord: AgentJob | null
  }
}

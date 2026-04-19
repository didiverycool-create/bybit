import type { StrategySummary } from '../types'
import type {
  BuildStrategyWorkspaceExecutionContextStateArgs,
  StrategyWorkspaceExecutionContextState,
} from './buildStrategyWorkspaceExecutionContextState'
import { buildStrategyWorkspaceExecutionContextState } from './buildStrategyWorkspaceExecutionContextState'

export type BuildStrategyWorkspaceDerivedStateExecutionContextStateArgs = Omit<
  BuildStrategyWorkspaceExecutionContextStateArgs,
  'selectedStrategy'
> & {
  selectedStrategy: StrategySummary | null
}

export function buildStrategyWorkspaceDerivedStateExecutionContextState({
  selectedStrategy,
  selectedStrategyRuntime,
  latestStrategyBacktest,
  latestStrategyBacktestDecisionMeta,
  latestStrategyBacktestSampleMeta,
  latestStrategyBacktestWindowMeta,
  latestStrategyBacktestLineageMeta,
  latestStrategyBacktestReview,
  latestStrategyBacktestReviewJob,
  latestStrategyBacktestReviewJobMeta,
  selectedStrategyChangeRequest,
  allStrategyChangeRequests,
  strategyChangeRequests,
  strategyProposals,
  backtests,
  proposalBacktestMap,
  proposalReviewMap,
  proposalChangeRequestMap,
  proposalAgentJobMap,
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  reviewInspectorReviewId,
  replayFocusedReviewId,
  aiSchedulerFocusedJobId,
  gatedPublishProposalCount,
  schedulerState,
  serviceAvailable,
  backtestMutationPending,
  retryAgentJobMutationPending,
  proposalMutationPending,
}: BuildStrategyWorkspaceDerivedStateExecutionContextStateArgs): StrategyWorkspaceExecutionContextState | null {
  return selectedStrategy
    ? buildStrategyWorkspaceExecutionContextState({
        selectedStrategy,
        selectedStrategyRuntime,
        latestStrategyBacktest,
        latestStrategyBacktestDecisionMeta,
        latestStrategyBacktestSampleMeta,
        latestStrategyBacktestWindowMeta,
        latestStrategyBacktestLineageMeta,
        latestStrategyBacktestReview,
        latestStrategyBacktestReviewJob,
        latestStrategyBacktestReviewJobMeta,
        selectedStrategyChangeRequest,
        allStrategyChangeRequests,
        strategyChangeRequests,
        strategyProposals,
        backtests,
        proposalBacktestMap,
        proposalReviewMap,
        proposalChangeRequestMap,
        proposalAgentJobMap,
        selectedProposalId,
        selectedChangeRequestId,
        selectedBacktestId,
        reviewInspectorReviewId,
        replayFocusedReviewId,
        aiSchedulerFocusedJobId,
        gatedPublishProposalCount,
        schedulerState,
        serviceAvailable,
        backtestMutationPending,
        retryAgentJobMutationPending,
        proposalMutationPending,
      })
    : null
}

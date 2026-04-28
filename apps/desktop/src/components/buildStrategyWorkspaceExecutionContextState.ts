import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
  StrategyRuntimeSnapshot,
  StrategySummary,
} from '../types'
import type { StrategyExecutionContextSectionProps } from './StrategyExecutionContextSection'

export type StrategyWorkspaceExecutionContextState = Omit<
  StrategyExecutionContextSectionProps,
  | 'onOpenChangeRequest'
  | 'onOpenBacktestDetail'
  | 'onOpenSourceReview'
  | 'onOpenStrategyProposal'
  | 'onOpenAiSchedulerJob'
  | 'onOpenReviewInspector'
  | 'onRetryAgentJob'
  | 'onHandleProposalAction'
  | 'onRerunBacktestFromRecommendation'
  | 'onRerunBacktestFromChangeRequest'
>

export type BuildStrategyWorkspaceExecutionContextStateArgs = {
  selectedStrategy: StrategySummary
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null
  latestStrategyBacktest: BacktestRun | null
  latestStrategyBacktestDecisionMeta: StrategyWorkspaceExecutionContextState['latestStrategyBacktestDecisionMeta']
  latestStrategyBacktestSampleMeta: StrategyWorkspaceExecutionContextState['latestStrategyBacktestSampleMeta']
  latestStrategyBacktestWindowMeta: StrategyWorkspaceExecutionContextState['latestStrategyBacktestWindowMeta']
  latestStrategyBacktestLineageMeta: StrategyWorkspaceExecutionContextState['latestStrategyBacktestLineageMeta']
  latestStrategyBacktestReview: ReviewDocument | null
  latestStrategyBacktestReviewJob: AgentJob | null
  latestStrategyBacktestReviewJobMeta: StrategyWorkspaceExecutionContextState['latestStrategyBacktestReviewJobMeta']
  selectedStrategyChangeRequest: ChangeRequest | null
  allStrategyChangeRequests: ChangeRequest[]
  strategyChangeRequests: ChangeRequest[]
  strategyProposals: StrategyProposal[]
  backtests: BacktestRun[]
  proposalBacktestMap: Map<string, BacktestRun>
  proposalReviewMap: Map<string, ReviewDocument>
  proposalChangeRequestMap: Map<string, ChangeRequest>
  proposalAgentJobMap: Map<string, AgentJob>
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
  gatedPublishProposalCount: number
  schedulerState: { status?: string; freeze_publish?: boolean } | null
  serviceAvailable: boolean
  backtestMutationPending: boolean
  retryAgentJobMutationPending: boolean
  proposalMutationPending: boolean
}

export function buildStrategyWorkspaceExecutionContextState({
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
}: BuildStrategyWorkspaceExecutionContextStateArgs): StrategyWorkspaceExecutionContextState {
  return {
    selectedStrategy,
    latestStrategyBacktest,
    latestStrategyBacktestDecisionMeta,
    latestStrategyBacktestSampleMeta,
    latestStrategyBacktestWindowMeta,
    latestStrategyBacktestLineageMeta,
    latestStrategyBacktestReview,
    latestStrategyBacktestReviewJob,
    latestStrategyBacktestReviewJobMeta,
    selectedStrategyRuntime,
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
  }
}

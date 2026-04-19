import {
  type ScopeFilter,
  type UseWorkspaceNavigationArgs,
} from './workspaceNavigationShared'

export type BuildWorkspaceDetailNavigationActionsArgs = Pick<
  UseWorkspaceNavigationArgs,
  | 'strategies'
  | 'selectedStrategy'
  | 'selectedStrategyId'
  | 'backtests'
  | 'changeRequests'
  | 'proposalCatalog'
  | 'reviewCatalog'
  | 'strategyActivityReviewRecords'
  | 'schedulerJobs'
  | 'strategyActivityJobRecords'
  | 'setActiveSection'
  | 'setSelectedStrategyId'
  | 'setSelectedSymbol'
  | 'setBacktestFilter'
  | 'setSelectedBacktestId'
  | 'setReviewInspectorOpen'
  | 'setReviewInspectorReviewId'
  | 'setReviewInspectorStrategyId'
  | 'setSelectedChangeRequestId'
  | 'setSelectedProposalId'
  | 'setAiSchedulerFocusedJobId'
> & {
  closeReviewInspector: () => void
  openReplayReview: (reviewId?: string | null, strategyId?: string | null, scope?: ScopeFilter) => void
}

export type WorkspaceDetailNavigationState = {
  nextStrategyId: string | null
  nextSymbol: string | null
}

export type WorkspaceSchedulerJobNavigationState = {
  jobStrategyId: string | null
  jobSymbol: string | null
}

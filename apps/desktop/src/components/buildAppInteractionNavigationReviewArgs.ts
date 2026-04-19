import type {
  AppInteractionNavigationArgs,
  BuildAppInteractionModelsArgsInput,
} from './buildAppInteractionModelsArgsShared'

export type BuildAppInteractionNavigationReviewArgs = Pick<
  AppInteractionNavigationArgs,
  | 'backtests'
  | 'changeRequests'
  | 'proposalCatalog'
  | 'reviewCatalog'
  | 'strategyActivityReviewRecords'
  | 'strategyActivityJobRecords'
  | 'setReplayTrackingScope'
  | 'setReplayFocusedReviewId'
  | 'setBacktestFilter'
  | 'setSelectedBacktestId'
  | 'setReviewInspectorOpen'
  | 'setReviewInspectorReviewId'
  | 'setReviewInspectorStrategyId'
  | 'setSelectedChangeRequestId'
  | 'setSelectedProposalId'
  | 'setAiSchedulerFocusedJobId'
>

export function buildAppInteractionNavigationReviewArgs({
  backtests,
  changeRequests,
  proposalCatalog,
  reviewCatalog,
  strategyActivityReviewRecords,
  strategyActivityJobRecords,
  setReplayTrackingScope,
  setReplayFocusedReviewId,
  setBacktestFilter,
  setSelectedBacktestId,
  setReviewInspectorOpen,
  setReviewInspectorReviewId,
  setReviewInspectorStrategyId,
  setSelectedChangeRequestId,
  setSelectedProposalId,
  setAiSchedulerFocusedJobId,
}: BuildAppInteractionModelsArgsInput): BuildAppInteractionNavigationReviewArgs {
  return {
    backtests,
    changeRequests,
    proposalCatalog,
    reviewCatalog,
    strategyActivityReviewRecords,
    strategyActivityJobRecords,
    setReplayTrackingScope,
    setReplayFocusedReviewId,
    setBacktestFilter,
    setSelectedBacktestId,
    setReviewInspectorOpen,
    setReviewInspectorReviewId,
    setReviewInspectorStrategyId,
    setSelectedChangeRequestId,
    setSelectedProposalId,
    setAiSchedulerFocusedJobId,
  }
}

import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategyProposal } from '../types'

type BuildReplayWorkspaceFocusLabelBuildersArgs = {
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  selectedBacktestId: string | null
  reviewInspectorReviewId: string | null
  replayFocusedReviewId: string | null
  aiSchedulerFocusedJobId: string | null
}

export type BuildReplayWorkspaceFocusLabelBuildersResult = {
  backtestFocusLabels: (
    backtest: BacktestRun,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
  proposalFocusLabels: (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ) => string[]
}

export function buildReplayWorkspaceFocusLabelBuilders({
  selectedProposalId,
  selectedChangeRequestId,
  selectedBacktestId,
  reviewInspectorReviewId,
  replayFocusedReviewId,
  aiSchedulerFocusedJobId,
}: BuildReplayWorkspaceFocusLabelBuildersArgs): BuildReplayWorkspaceFocusLabelBuildersResult {
  const focusedReviewId = reviewInspectorReviewId ?? replayFocusedReviewId

  const backtestFocusLabels = (
    backtest: BacktestRun,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ): string[] => {
    const labels: string[] = []
    if (selectedBacktestId === backtest.id) {
      labels.push('当前回测')
    }
    if (backtest.source_change_request_id && selectedChangeRequestId === backtest.source_change_request_id) {
      labels.push('当前变更')
    }
    if (
      focusedReviewId &&
      ((linkedReview && focusedReviewId === linkedReview.id) || focusedReviewId === backtest.source_review_id)
    ) {
      labels.push('当前复盘')
    }
    if (linkedJob && aiSchedulerFocusedJobId === linkedJob.id) {
      labels.push('当前任务')
    }
    return labels
  }

  const proposalFocusLabels = (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: AgentJob | null,
  ): string[] => {
    const labels: string[] = []
    if (selectedProposalId === proposal.id) {
      labels.push('当前提案')
    }
    if (linkedChangeRequest && selectedChangeRequestId === linkedChangeRequest.id) {
      labels.push('当前变更')
    }
    if (linkedBacktest && selectedBacktestId === linkedBacktest.id) {
      labels.push('当前回测')
    }
    if (
      linkedReview &&
      (reviewInspectorReviewId === linkedReview.id || replayFocusedReviewId === linkedReview.id)
    ) {
      labels.push('当前复盘')
    }
    if (linkedJob && aiSchedulerFocusedJobId === linkedJob.id) {
      labels.push('当前任务')
    }
    return labels
  }

  return {
    backtestFocusLabels,
    proposalFocusLabels,
  }
}

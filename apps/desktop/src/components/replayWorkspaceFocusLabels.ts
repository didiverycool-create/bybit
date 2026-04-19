import type { AgentJob, BacktestRun, ChangeRequest, ReviewDocument, StrategyProposal } from '../types'

export function buildReplayWorkspaceFocusLabels(
  selectedProposalId: string | null,
  selectedChangeRequestId: string | null,
  selectedBacktestId: string | null,
  focusedReviewId: string | null,
  aiSchedulerFocusedJobId: string | null,
  proposal: StrategyProposal,
  linkedChangeRequest?: ChangeRequest | null,
  linkedBacktest?: BacktestRun | null,
  linkedReview?: ReviewDocument | null,
  linkedJob?: AgentJob | null,
): string[] {
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
  if (linkedReview && focusedReviewId && focusedReviewId === linkedReview.id) {
    labels.push('当前复盘')
  }
  if (linkedJob && aiSchedulerFocusedJobId === linkedJob.id) {
    labels.push('当前任务')
  }
  return labels
}

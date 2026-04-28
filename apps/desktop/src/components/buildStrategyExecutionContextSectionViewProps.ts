import type {
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  StrategyProposal,
} from '../types'
import type {
  StrategyExecutionContextSectionProps,
  StrategyExecutionContextSectionViewProps,
} from './StrategyExecutionContextSection.types'

export function buildStrategyExecutionContextSectionViewProps(
  props: StrategyExecutionContextSectionProps,
): StrategyExecutionContextSectionViewProps {
  const {
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
  } = props

  const proposalFocusLabels = (
    proposal: StrategyProposal,
    linkedChangeRequest?: ChangeRequest | null,
    linkedBacktest?: BacktestRun | null,
    linkedReview?: ReviewDocument | null,
    linkedJob?: { id: string } | null,
  ) => {
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
    ...props,
    proposalFocusLabels,
  }
}

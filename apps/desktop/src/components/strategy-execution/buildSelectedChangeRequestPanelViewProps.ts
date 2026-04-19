import type { SelectedChangeRequestPanelProps, SelectedChangeRequestPanelViewProps } from './SelectedChangeRequestPanel.types'
import {
  getChangeRequestLinkedBacktestDecisionMeta,
  getChangeRequestLinkedBacktestId,
  getChangeRequestLinkedBacktestRecommendation,
  getChangeRequestLinkedBacktestSampleMeta,
  getChangeRequestLinkedBacktestWindowMeta,
  getChangeRequestManualFollowupDetail,
  getChangeRequestSourceBacktestId,
  getChangeRequestSourceProposalId,
  getChangeRequestSourceReviewId,
  getChangeRequestStrategyId,
} from '../../utils/app-helpers'

export function buildSelectedChangeRequestPanelViewProps(
  props: SelectedChangeRequestPanelProps,
): SelectedChangeRequestPanelViewProps {
  const { backtests, ...rest } = props
  const strategyId = getChangeRequestStrategyId(rest.selectedStrategyChangeRequest, rest.selectedStrategy.id)
  const linkedBacktestId = getChangeRequestLinkedBacktestId(rest.selectedStrategyChangeRequest)
  const linkedBacktest = linkedBacktestId
    ? backtests.find((backtest) => backtest.id === linkedBacktestId) ?? null
    : null
  const manualFollowupDetail = getChangeRequestManualFollowupDetail(rest.selectedStrategyChangeRequest)
  const sampleMeta = getChangeRequestLinkedBacktestSampleMeta(rest.selectedStrategyChangeRequest, linkedBacktest)
  const decisionMeta = getChangeRequestLinkedBacktestDecisionMeta(rest.selectedStrategyChangeRequest)
  const windowMeta = getChangeRequestLinkedBacktestWindowMeta(rest.selectedStrategyChangeRequest, linkedBacktest)
  const rerunRecommendation = getChangeRequestLinkedBacktestRecommendation(
    rest.selectedStrategyChangeRequest,
    linkedBacktest,
  )
  const sourceBacktestId = getChangeRequestSourceBacktestId(rest.selectedStrategyChangeRequest)
  const sourceReviewId = getChangeRequestSourceReviewId(rest.selectedStrategyChangeRequest)
  const sourceProposalId = getChangeRequestSourceProposalId(rest.selectedStrategyChangeRequest)

  return {
    ...rest,
    strategyId,
    linkedBacktestId,
    manualFollowupDetail,
    sampleMeta,
    decisionMeta,
    windowMeta,
    rerunRecommendation,
    sourceBacktestId,
    sourceReviewId,
    sourceProposalId,
  }
}

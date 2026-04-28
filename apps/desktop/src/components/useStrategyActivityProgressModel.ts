import { buildStrategyActivityBacktestProgressModel } from './buildStrategyActivityBacktestProgressModel'
import { buildStrategyActivityChangeRequestProgressModel } from './buildStrategyActivityChangeRequestProgressModel'
import { buildStrategyActivityProgressSupplementFlags } from './buildStrategyActivityProgressSupplementFlags'
import { buildStrategyActivityReviewTrackingProgressModel } from './buildStrategyActivityReviewTrackingProgressModel'
import {
  createStrategyActivityProgressLookupContext,
  type UseStrategyActivityProgressModelArgs,
} from './strategyActivityProgressShared'

export function useStrategyActivityProgressModel({
  selectedStrategy,
  selectedStrategyChangeRequest,
  selectedStrategyProposal,
  selectedBacktest,
  focusedPrimaryReviewId,
  focusedTrackingReviewId,
  aiSchedulerFocusedJobId,
  ...lookupArgs
}: UseStrategyActivityProgressModelArgs) {
  const context = createStrategyActivityProgressLookupContext({
    ...lookupArgs,
    selectedStrategy,
    selectedStrategyChangeRequest,
    selectedStrategyProposal,
    selectedBacktest,
    focusedPrimaryReviewId,
    focusedTrackingReviewId,
    aiSchedulerFocusedJobId,
  })
  const strategyActivityChangeRequestProgressModel = buildStrategyActivityChangeRequestProgressModel(
    { selectedStrategy, selectedStrategyChangeRequest },
    context,
  )
  const strategyActivityBacktestProgressModel = buildStrategyActivityBacktestProgressModel(
    { selectedBacktest },
    context,
  )
  const strategyActivityReviewTrackingProgressModel = buildStrategyActivityReviewTrackingProgressModel(context)
  const strategyActivityProgressSupplementFlags = buildStrategyActivityProgressSupplementFlags(
    {
      selectedStrategyProposal,
      selectedStrategyChangeRequest,
      selectedBacktest,
      focusedPrimaryReviewId,
      focusedTrackingReviewId,
      aiSchedulerFocusedJobId,
    },
    context,
  )

  return {
    ...strategyActivityChangeRequestProgressModel,
    ...strategyActivityBacktestProgressModel,
    ...strategyActivityReviewTrackingProgressModel,
    ...strategyActivityProgressSupplementFlags,
  }
}

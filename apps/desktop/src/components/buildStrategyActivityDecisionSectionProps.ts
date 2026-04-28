import { buildStrategyActivityDecisionSectionDecisionProps } from './buildStrategyActivityDecisionSectionDecisionProps'
import { buildStrategyActivityDecisionSectionReviewAndJobsProps } from './buildStrategyActivityDecisionSectionReviewAndJobsProps'
import { buildStrategyActivityDecisionSectionTopDecisionProps } from './buildStrategyActivityDecisionSectionTopDecisionProps'
import type { StrategyActivityDecisionSectionsProps } from './StrategyActivityDecisionSections'
import type { StrategyActivityReviewAndJobsSectionProps } from './StrategyActivityReviewAndJobsSection'
import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionSelectors,
  StrategyActivityDecisionServiceState,
  StrategyActivityDecisionState,
  StrategyActivityDecisionSummaryState,
  StrategyActivityDecisionTopState,
  StrategyActivityReviewAndJobsState,
} from './buildStrategyActivityDecisionSectionTypes'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'

export type {
  StrategyActivityDecisionSummaryState,
  StrategyActivityDecisionTopState,
  StrategyActivityDecisionState,
  StrategyActivityReviewAndJobsState,
  StrategyActivityDecisionServiceState,
  StrategyActivityDecisionActions,
  StrategyActivityDecisionSelectors,
} from './buildStrategyActivityDecisionSectionTypes'

export function buildStrategyActivityDecisionSectionProps({
  strategyActivitySnapshotModel,
  summaryState,
  topDecisionState,
  decisionState,
  reviewAndJobsState,
  serviceState,
  actions,
  selectors,
}: {
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  summaryState: StrategyActivityDecisionSummaryState
  topDecisionState: StrategyActivityDecisionTopState
  decisionState: StrategyActivityDecisionState
  reviewAndJobsState: StrategyActivityReviewAndJobsState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
  selectors: StrategyActivityDecisionSelectors
}): {
  topDecisionActionsProps: StrategyActivityTopDecisionActionsSectionProps
  decisionSectionsProps: StrategyActivityDecisionSectionsProps
  reviewAndJobsProps: StrategyActivityReviewAndJobsSectionProps
} {
  const strategyId = strategyActivitySnapshotModel.strategyId ?? ''

  return {
    topDecisionActionsProps: buildStrategyActivityDecisionSectionTopDecisionProps({
      strategyId,
      summaryState,
      topDecisionState,
      serviceState,
      actions,
    }),
    decisionSectionsProps: buildStrategyActivityDecisionSectionDecisionProps({
      strategyId,
      strategyActivitySnapshotModel,
      decisionState,
      serviceState,
      actions,
      selectors,
    }),
    reviewAndJobsProps: buildStrategyActivityDecisionSectionReviewAndJobsProps({
      strategyId,
      strategyActivitySnapshotModel,
      reviewAndJobsState,
      serviceState,
      actions,
    }),
  }
}

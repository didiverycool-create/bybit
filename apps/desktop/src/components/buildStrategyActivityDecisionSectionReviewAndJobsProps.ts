import type { StrategyActivityReviewAndJobsSectionProps } from './StrategyActivityReviewAndJobsSection'
import { buildStrategyActivityReviewAndJobsProps } from './buildStrategyActivityReviewAndJobsProps'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionServiceState,
  StrategyActivityReviewAndJobsState,
} from './buildStrategyActivityDecisionSectionTypes'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'

type BuildStrategyActivityDecisionSectionReviewAndJobsPropsArgs = {
  strategyId: string
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  reviewAndJobsState: StrategyActivityReviewAndJobsState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
}

export function buildStrategyActivityDecisionSectionReviewAndJobsProps({
  strategyId,
  strategyActivitySnapshotModel,
  reviewAndJobsState,
  serviceState,
  actions,
}: BuildStrategyActivityDecisionSectionReviewAndJobsPropsArgs): StrategyActivityReviewAndJobsSectionProps {
  return buildStrategyActivityReviewAndJobsProps({
    strategyId,
    strategyActivitySnapshotModel,
    reviewAndJobsState,
    serviceState,
    actions,
  })
}

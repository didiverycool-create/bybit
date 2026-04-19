import type {
  StrategyActivityDecisionContext,
  UseStrategyActivityDecisionModelArgs,
} from './strategyActivityDecisionShared'
import { buildStrategyActivityJobDecisionCollections } from './buildStrategyActivityJobDecisionCollections'
import { buildStrategyActivityReviewDecisionCollections } from './buildStrategyActivityReviewDecisionCollections'

type ReviewJobDecisionCollectionArgs = Pick<
  UseStrategyActivityDecisionModelArgs,
  'selectedStrategy' | 'aiSchedulerFocusedJobId' | 'schedulerJobs'
>

export function buildStrategyActivityReviewJobDecisionCollections(
  { selectedStrategy, aiSchedulerFocusedJobId, schedulerJobs }: ReviewJobDecisionCollectionArgs,
  context: StrategyActivityDecisionContext,
) {
  const reviewCollections = buildStrategyActivityReviewDecisionCollections({ selectedStrategy }, context)
  const jobCollections = buildStrategyActivityJobDecisionCollections(
    { aiSchedulerFocusedJobId, schedulerJobs },
    context,
  )

  return {
    ...reviewCollections,
    ...jobCollections,
  }
}

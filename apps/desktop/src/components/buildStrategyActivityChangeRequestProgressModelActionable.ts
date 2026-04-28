import { getChangeRequestLinkedBacktestId, getChangeRequestLinkedBacktestRecommendation } from '../utils/app-helpers'
import type { BacktestRun, ChangeRequest } from '../types'

export function findLatestActionableChangeRequest({
  strategyActivityChangeRequests,
  latestActionableChangeRequest,
  backtestById,
}: {
  strategyActivityChangeRequests: ChangeRequest[]
  latestActionableChangeRequest: ChangeRequest | null
  backtestById: Map<string, BacktestRun>
}) {
  return (
    strategyActivityChangeRequests.find((request) => {
      if (
        request.follow_up_job_id &&
        (request.follow_up_job_status === 'failed' || request.follow_up_job_status === 'cancelled')
      ) {
        return true
      }
      const requestLinkedBacktest = backtestById.get(getChangeRequestLinkedBacktestId(request) ?? '') ?? null
      const rerunRecommendation = getChangeRequestLinkedBacktestRecommendation(request, requestLinkedBacktest)
      return Boolean(rerunRecommendation?.recommendedRange && rerunRecommendation?.recommendedTimeframe)
    }) ?? latestActionableChangeRequest
  )
}

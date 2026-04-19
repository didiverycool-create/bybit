import {
  getChangeRequestStrategyId,
  prependUniqueActivityItem,
} from '../utils/app-helpers'
import type { ChangeRequest } from '../types'
import type { StrategyActivityProgressLookupContext } from './strategyActivityProgressShared'

export function buildStrategyActivityChangeRequestList({
  activityStrategyId,
  strategyActivityCollections,
  latestChangeRequest,
  latestActionableChangeRequest,
  selectedStrategyChangeRequest,
  selectedStrategyId,
}: {
  activityStrategyId: string | null
  strategyActivityCollections: StrategyActivityProgressLookupContext['strategyActivityCollections']
  latestChangeRequest: ChangeRequest | null
  latestActionableChangeRequest: ChangeRequest | null
  selectedStrategyChangeRequest: ChangeRequest | null
  selectedStrategyId: string | null
}) {
  let activityRequests = strategyActivityCollections.recentChangeRequests ?? []
  if (
    latestChangeRequest &&
    activityStrategyId &&
    getChangeRequestStrategyId(latestChangeRequest, activityStrategyId) === activityStrategyId
  ) {
    activityRequests = prependUniqueActivityItem(activityRequests, latestChangeRequest, (request) => request.id, 8)
  }
  if (
    latestActionableChangeRequest &&
    activityStrategyId &&
    getChangeRequestStrategyId(latestActionableChangeRequest, activityStrategyId) === activityStrategyId
  ) {
    activityRequests = prependUniqueActivityItem(activityRequests, latestActionableChangeRequest, (request) => request.id, 8)
  }
  if (!selectedStrategyChangeRequest) {
    return activityRequests
  }
  const selectedRequestStrategyId = getChangeRequestStrategyId(
    selectedStrategyChangeRequest,
    selectedStrategyId ?? activityStrategyId,
  )
  if (!activityStrategyId || !selectedRequestStrategyId || activityStrategyId !== selectedRequestStrategyId) {
    return activityRequests
  }
  return prependUniqueActivityItem(activityRequests, selectedStrategyChangeRequest, (request) => request.id, 8)
}

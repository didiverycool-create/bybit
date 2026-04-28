import type { AgentJob } from '../types'
import { getAgentJobStrategyId, prependUniqueActivityItem } from '../utils/app-helpers'
import type {
  StrategyActivityDecisionContext,
  UseStrategyActivityDecisionModelArgs,
} from './strategyActivityDecisionShared'

type JobDecisionCollectionArgs = Pick<UseStrategyActivityDecisionModelArgs, 'aiSchedulerFocusedJobId' | 'schedulerJobs'>

export function buildStrategyActivityJobDecisionCollections(
  { aiSchedulerFocusedJobId, schedulerJobs }: JobDecisionCollectionArgs,
  context: StrategyActivityDecisionContext,
) {
  const {
    activityStrategyId,
    latestTrackingJobSource,
    latestActionableBacktestJobSource,
    latestRetryableTrackingJobSource,
    latestBacktestJobRecordSource,
    latestActionableBacktestJobRecordSource,
    latestTrackingJobRecordSource,
    latestRetryableTrackingJobRecordSource,
    recentAgentJobs,
  } = context

  const strategyActivityAgentJobs = (() => {
    let activityJobs = recentAgentJobs
    if (
      latestTrackingJobSource &&
      activityStrategyId &&
      getAgentJobStrategyId(latestTrackingJobSource) === activityStrategyId
    ) {
      activityJobs = prependUniqueActivityItem(activityJobs, latestTrackingJobSource, (job) => job.id, 12)
    }
    if (
      latestActionableBacktestJobSource &&
      activityStrategyId &&
      getAgentJobStrategyId(latestActionableBacktestJobSource) === activityStrategyId
    ) {
      activityJobs = prependUniqueActivityItem(activityJobs, latestActionableBacktestJobSource, (job) => job.id, 12)
    }
    if (
      latestRetryableTrackingJobSource &&
      activityStrategyId &&
      getAgentJobStrategyId(latestRetryableTrackingJobSource) === activityStrategyId
    ) {
      activityJobs = prependUniqueActivityItem(activityJobs, latestRetryableTrackingJobSource, (job) => job.id, 12)
    }
    if (!aiSchedulerFocusedJobId || !activityStrategyId || !schedulerJobs.length) {
      return activityJobs
    }
    const focusedJob = schedulerJobs.find((job) => job.id === aiSchedulerFocusedJobId) ?? null
    if (!focusedJob || getAgentJobStrategyId(focusedJob) !== activityStrategyId) {
      return activityJobs
    }
    return prependUniqueActivityItem(activityJobs, focusedJob, (job) => job.id, 12)
  })()

  const strategyActivityJobRecords = (() => {
    const activityRecords = [
      latestBacktestJobRecordSource,
      latestActionableBacktestJobRecordSource,
      latestTrackingJobRecordSource,
      latestRetryableTrackingJobRecordSource,
    ].filter((job): job is AgentJob => Boolean(job))
    if (!aiSchedulerFocusedJobId || !activityStrategyId || !schedulerJobs.length) {
      return activityRecords
    }
    const focusedJob = schedulerJobs.find((job) => job.id === aiSchedulerFocusedJobId) ?? null
    if (!focusedJob || getAgentJobStrategyId(focusedJob) !== activityStrategyId) {
      return activityRecords
    }
    return prependUniqueActivityItem(activityRecords, focusedJob, (job) => job.id, 12)
  })()

  return {
    strategyActivityAgentJobs,
    strategyActivityJobRecords,
  }
}

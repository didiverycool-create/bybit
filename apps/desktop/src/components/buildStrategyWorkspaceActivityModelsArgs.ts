import type { useStrategyActivityDecisionModel } from './useStrategyActivityDecisionModel'
import type { useStrategyActivityOpsModel } from './useStrategyActivityOpsModel'
import type { useStrategyActivityProgressModel } from './useStrategyActivityProgressModel'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'
import type { UseStrategyWorkspaceActivityModelsArgs } from './useStrategyWorkspaceActivityModels.types'

type StrategyActivityDecisionModelArgs = Parameters<typeof useStrategyActivityDecisionModel>[0]
type StrategyActivityDecisionModel = ReturnType<typeof useStrategyActivityDecisionModel>
type StrategyActivityProgressModelArgs = Parameters<typeof useStrategyActivityProgressModel>[0]
type StrategyActivityOpsModelArgs = Parameters<typeof useStrategyActivityOpsModel>[0]

export function buildStrategyWorkspaceActivityDecisionArgs(
  {
    selectedStrategy,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    schedulerJobs,
    schedulerState,
    reviewCatalogModel,
  }: UseStrategyWorkspaceActivityModelsArgs,
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel,
): StrategyActivityDecisionModelArgs {
  return {
    strategyActivitySnapshotModel,
    selectedStrategy,
    selectedProposalId,
    selectedChangeRequestId,
    selectedBacktestId,
    reviewInspectorReviewId,
    replayFocusedReviewId,
    aiSchedulerFocusedJobId,
    schedulerJobs,
    reviewCatalog: reviewCatalogModel.reviewCatalog,
    strategyProposals: reviewCatalogModel.strategyProposals,
    proposalBacktestMap: reviewCatalogModel.proposalBacktestMap,
    proposalReviewMap: reviewCatalogModel.proposalReviewMap,
    proposalChangeRequestMap: reviewCatalogModel.proposalChangeRequestMap,
    proposalAgentJobMap: reviewCatalogModel.proposalAgentJobMap,
    schedulerState: schedulerState ?? null,
  }
}

export function buildStrategyWorkspaceActivityProgressArgs(
  {
    selectedStrategy,
    aiSchedulerFocusedJobId,
    backtests,
    schedulerJobs,
    reviewCatalogModel,
    strategyBacktestSelectionModel,
  }: UseStrategyWorkspaceActivityModelsArgs,
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel,
  strategyActivityDecisionModel: StrategyActivityDecisionModel,
): StrategyActivityProgressModelArgs {
  return {
    strategyActivitySnapshotModel,
    selectedStrategy,
    selectedStrategyChangeRequest: strategyBacktestSelectionModel.selectedStrategyChangeRequest,
    selectedStrategyProposal: strategyActivityDecisionModel.selectedStrategyProposal,
    selectedBacktest: strategyBacktestSelectionModel.selectedBacktest,
    focusedPrimaryReviewId: strategyActivityDecisionModel.focusedPrimaryReviewId,
    focusedTrackingReviewId: strategyActivityDecisionModel.focusedTrackingReviewId,
    aiSchedulerFocusedJobId,
    reviewCatalog: reviewCatalogModel.reviewCatalog,
    backtests,
    backtestReviewJobs: reviewCatalogModel.backtestReviewJobs,
    strategyActivityReviewRecords: strategyActivityDecisionModel.strategyActivityReviewRecords,
    strategyActivityJobRecords: strategyActivityDecisionModel.strategyActivityJobRecords,
    schedulerJobs,
    proposalCatalog: reviewCatalogModel.proposalCatalog,
    strategyProposals: reviewCatalogModel.strategyProposals,
  }
}

export function buildStrategyWorkspaceActivityOpsArgs(
  {
    selectedMode,
  }: Pick<UseStrategyWorkspaceActivityModelsArgs, 'selectedMode'>,
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel,
): StrategyActivityOpsModelArgs {
  return {
    strategyActivitySnapshotModel,
    selectedMode,
  }
}

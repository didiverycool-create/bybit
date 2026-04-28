import {
  buildStrategyWorkspaceActivityDecisionArgs,
  buildStrategyWorkspaceActivityOpsArgs,
  buildStrategyWorkspaceActivityProgressArgs,
} from './buildStrategyWorkspaceActivityModelsArgs'
import { useStrategyActivityDecisionModel } from './useStrategyActivityDecisionModel'
import { useStrategyActivityOpsModel } from './useStrategyActivityOpsModel'
import { useStrategyActivityProgressModel } from './useStrategyActivityProgressModel'
import { resolveStrategyActivitySnapshotViewModel } from './strategyActivitySelectors'
import type { UseStrategyWorkspaceActivityModelsArgs } from './useStrategyWorkspaceActivityModels.types'

export function useStrategyWorkspaceActivityModels({
  ...args
}: UseStrategyWorkspaceActivityModelsArgs) {
  const strategyActivitySnapshotModel = resolveStrategyActivitySnapshotViewModel(
    args.selectedStrategyActivity,
  )
  const strategyActivityDecisionSource = buildStrategyWorkspaceActivityDecisionArgs(
    args,
    strategyActivitySnapshotModel,
  )
  const strategyActivityDecisionModel = useStrategyActivityDecisionModel(
    strategyActivityDecisionSource,
  )
  const strategyActivityProgressSource = buildStrategyWorkspaceActivityProgressArgs(
    args,
    strategyActivitySnapshotModel,
    strategyActivityDecisionModel,
  )
  const strategyActivityProgressModel = useStrategyActivityProgressModel(
    strategyActivityProgressSource,
  )
  const strategyActivityOpsSource = buildStrategyWorkspaceActivityOpsArgs(
    args,
    strategyActivitySnapshotModel,
  )
  const strategyActivityOpsModel = useStrategyActivityOpsModel(
    strategyActivityOpsSource,
  )

  return {
    strategyActivitySnapshotModel,
    strategyActivityDecisionModel,
    strategyActivityProgressModel,
    strategyActivityOpsModel,
  }
}

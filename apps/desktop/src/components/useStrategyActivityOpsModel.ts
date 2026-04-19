import { useMemo } from 'react'

import type { Mode } from '../types'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'
import { buildStrategyActivityOpsModelState } from './strategyActivityOpsModelAssembler'

type UseStrategyActivityOpsModelArgs = {
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  selectedMode: Mode
}

export function useStrategyActivityOpsModel({
  strategyActivitySnapshotModel,
  selectedMode,
}: UseStrategyActivityOpsModelArgs) {
  return useMemo(
    () =>
      buildStrategyActivityOpsModelState({
        strategyId: strategyActivitySnapshotModel.strategyId,
        selectedMode,
        collections: strategyActivitySnapshotModel.collections,
        opsSources: strategyActivitySnapshotModel.opsSources,
        opsSummaries: strategyActivitySnapshotModel.opsSummaries,
      }),
    [
      selectedMode,
      strategyActivitySnapshotModel.collections,
      strategyActivitySnapshotModel.opsSources,
      strategyActivitySnapshotModel.opsSummaries,
      strategyActivitySnapshotModel.strategyId,
    ],
  )
}

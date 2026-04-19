import type { StrategyActivityDecisionSectionsProps } from './StrategyActivityDecisionSections'
import { buildStrategyActivityDecisionPanelsProps } from './buildStrategyActivityDecisionPanelsProps'
import type {
  StrategyActivityDecisionActions,
  StrategyActivityDecisionSelectors,
  StrategyActivityDecisionServiceState,
  StrategyActivityDecisionState,
} from './buildStrategyActivityDecisionSectionTypes'
import type { StrategyActivitySnapshotViewModel } from './strategyActivitySelectors'

type BuildStrategyActivityDecisionSectionDecisionPropsArgs = {
  strategyId: string
  strategyActivitySnapshotModel: StrategyActivitySnapshotViewModel
  decisionState: StrategyActivityDecisionState
  serviceState: StrategyActivityDecisionServiceState
  actions: StrategyActivityDecisionActions
  selectors: StrategyActivityDecisionSelectors
}

export function buildStrategyActivityDecisionSectionDecisionProps({
  strategyId,
  strategyActivitySnapshotModel,
  decisionState,
  serviceState,
  actions,
  selectors,
}: BuildStrategyActivityDecisionSectionDecisionPropsArgs): StrategyActivityDecisionSectionsProps {
  return buildStrategyActivityDecisionPanelsProps({
    strategyId,
    strategyActivitySnapshotModel,
    decisionState,
    serviceState,
    actions,
    selectors,
  })
}

import StrategyActivityTopDecisionActionsSectionView from './StrategyActivityTopDecisionActionsSectionView'
import {
  buildStrategyActivityTopDecisionActionsSectionModel,
  type StrategyActivityTopDecisionActionsSectionModel,
} from './buildStrategyActivityTopDecisionActionsSectionModel'
import type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection.types'

export type { StrategyActivityTopDecisionActionsSectionProps } from './StrategyActivityTopDecisionActionsSection.types'

export default function StrategyActivityTopDecisionActionsSection(
  props: StrategyActivityTopDecisionActionsSectionProps,
) {
  const model: StrategyActivityTopDecisionActionsSectionModel =
    buildStrategyActivityTopDecisionActionsSectionModel(props)

  return <StrategyActivityTopDecisionActionsSectionView {...model} />
}


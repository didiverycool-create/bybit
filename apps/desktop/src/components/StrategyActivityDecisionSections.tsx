import { buildStrategyActivityDecisionSectionsViewProps } from './buildStrategyActivityDecisionSectionsViewProps'
import StrategyActivityDecisionSectionsView from './StrategyActivityDecisionSectionsView'
import type { StrategyActivityDecisionSectionsProps } from './StrategyActivityDecisionSections.types'

export type {
  ChangeRequestLinkedState,
  ProposalLinkedState,
  StrategyActivityDecisionSectionsProps,
} from './StrategyActivityDecisionSections.types'

export default function StrategyActivityDecisionSections(
  props: StrategyActivityDecisionSectionsProps,
) {
  return <StrategyActivityDecisionSectionsView {...buildStrategyActivityDecisionSectionsViewProps(props)} />
}

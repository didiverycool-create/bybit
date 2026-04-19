import type { StrategyActivityOpsSectionProps } from './StrategyActivityOpsSection'
import type { StrategyActivityTopOpsSectionProps } from './StrategyActivityTopOpsSection'
import {
  buildStrategyActivityOpsSectionOpsProps,
  type StrategyActivityOpsActions,
  type StrategyActivityOpsServiceState,
  type StrategyActivityOpsState,
} from './buildStrategyActivityOpsSectionOpsProps'
import type { StrategyActivityOpsSummaryState } from './buildStrategyActivityOpsSectionSummaryProps'
import {
  buildStrategyActivityOpsSectionTopProps,
  type StrategyActivityTopOpsState,
} from './buildStrategyActivityOpsSectionTopProps'

export function buildStrategyActivityOpsSectionProps({
  summaryState,
  topOpsState,
  opsState,
  serviceState,
  actions,
}: {
  summaryState: StrategyActivityOpsSummaryState
  topOpsState: StrategyActivityTopOpsState
  opsState: StrategyActivityOpsState
  serviceState: StrategyActivityOpsServiceState
  actions: StrategyActivityOpsActions
}): {
  topOpsProps: StrategyActivityTopOpsSectionProps
  opsSectionProps: StrategyActivityOpsSectionProps
} {
  return {
    topOpsProps: buildStrategyActivityOpsSectionTopProps({
      summaryState,
      topOpsState,
      serviceState,
      actions,
    }),
    opsSectionProps: buildStrategyActivityOpsSectionOpsProps({
      opsState,
      serviceState,
      actions,
    }),
  }
}

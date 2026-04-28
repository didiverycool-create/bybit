import type { StrategyActivityProgressLookupContext, UseStrategyActivityProgressModelArgs } from './strategyActivityProgressShared'
import { buildStrategyActivityChangeRequestProgressModelAssembler } from './buildStrategyActivityChangeRequestProgressModelAssembler'
import { buildStrategyActivityChangeRequestProgressModelState } from './buildStrategyActivityChangeRequestProgressModelHelpers'

export function buildStrategyActivityChangeRequestProgressModel(
  args: Pick<UseStrategyActivityProgressModelArgs, 'selectedStrategy' | 'selectedStrategyChangeRequest'>,
  context: StrategyActivityProgressLookupContext,
) {
  const state = buildStrategyActivityChangeRequestProgressModelState(args, context)
  return buildStrategyActivityChangeRequestProgressModelAssembler(state)
}

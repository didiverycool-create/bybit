import { buildTradeProbeTone } from './tradingExecutionActionHelpers'
import { runTradingExecutionAction } from './tradingExecutionAsyncHelpers'
import type { TradingExecutionOrderActionArgs } from './tradingExecutionOrderActionHandlers.types'

export function buildProbeBybitTradeRouteAction({
  showFeedback,
  mutations,
}: TradingExecutionOrderActionArgs) {
  return async () => {
    await runTradingExecutionAction({
      execute: () => mutations.tradeProbeMutation.mutateAsync(),
      failureTitle: '真实交易链路探测失败',
      showFeedback,
      onSuccess: (result) => {
        const tone = buildTradeProbeTone(result.outcome)
        showFeedback(tone, '真实交易链路探测已完成', result.detail)
      },
    })
  }
}

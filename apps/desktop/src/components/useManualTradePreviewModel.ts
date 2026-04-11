import { useQuery } from '@tanstack/react-query'

import { api } from '../api'
import type {
  BybitPrivateStatus,
  ExecutionPreview,
  MarketDetail,
  Mode,
  StrategyRuntimeSnapshot,
} from '../types'

type ManualOrderState = {
  side: 'buy' | 'sell'
  quantity: string
  price: string
  note: string
}

type UseManualTradePreviewModelArgs = {
  marketDetail: MarketDetail | null | undefined
  selectedMode: Mode
  manualOrder: ManualOrderState
  manualTradePanelOpen: boolean
  serviceAvailable: boolean
  editingOrderId: string | null
  bybitPrivateStatus: BybitPrivateStatus | null | undefined
  selectedStrategyRuntimePreview: ExecutionPreview | null
  selectedStrategyRuntime: StrategyRuntimeSnapshot | null | undefined
  runtimeWorkerNeedsRecovery: boolean
}

export function useManualTradePreviewModel({
  marketDetail,
  selectedMode,
  manualOrder,
  manualTradePanelOpen,
  serviceAvailable,
  editingOrderId,
  bybitPrivateStatus,
  selectedStrategyRuntimePreview,
  selectedStrategyRuntime,
  runtimeWorkerNeedsRecovery,
}: UseManualTradePreviewModelArgs) {
  const manualOrderQuantity = Number(manualOrder.quantity)
  const manualOrderPrice = Number(manualOrder.price)
  const requiresPrivateTrading = selectedMode !== 'paper'
  const privateModeMismatch =
    requiresPrivateTrading &&
    Boolean(bybitPrivateStatus?.can_query_private) &&
    bybitPrivateStatus?.mode !== selectedMode

  const manualTradePreviewQuery = useQuery({
    queryKey: [
      'execution-preview',
      marketDetail?.symbol ?? 'unknown',
      marketDetail?.market ?? 'perp',
      selectedMode,
      manualOrder.side,
      manualOrderQuantity,
      manualOrderPrice,
      editingOrderId ?? 'new',
    ],
    queryFn: () =>
      api.previewExecution({
        symbol: marketDetail!.symbol,
        market: marketDetail!.market,
        mode: selectedMode,
        side: manualOrder.side,
        quantity: manualOrderQuantity,
        price: manualOrderPrice,
        origin: 'manual',
        exclude_order_id: editingOrderId ?? undefined,
      }),
    enabled:
      manualTradePanelOpen &&
      serviceAvailable &&
      Boolean(marketDetail) &&
      Number.isFinite(manualOrderQuantity) &&
      manualOrderQuantity > 0 &&
      Number.isFinite(manualOrderPrice) &&
      manualOrderPrice > 0,
    staleTime: 0,
    refetchInterval: manualTradePanelOpen ? 5000 : false,
  })

  const manualTradePreview: ExecutionPreview | undefined = manualTradePreviewQuery.data
  const manualTradePreviewBlockedReason =
    manualTradePreview && !manualTradePreview.allowed ? manualTradePreview.blocked_reason : null
  const manualTradePreviewBlockedMessage =
    manualTradePreviewBlockedReason && manualTradePreview?.recommended_action
      ? `${manualTradePreviewBlockedReason} 建议 ${manualTradePreview.recommended_action}`
      : manualTradePreviewBlockedReason

  const selectedStrategyNeedsRuntimeRecovery = Boolean(
    (selectedStrategyRuntimePreview?.blocked_reason &&
      selectedStrategyRuntimePreview.blocked_reason.includes('恢复运行线程')) ||
      (selectedStrategyRuntime?.guard_detail &&
        selectedStrategyRuntime.guard_detail.includes('恢复运行线程')) ||
      (selectedMode !== 'paper' && runtimeWorkerNeedsRecovery),
  )

  const manualTradingBlockedReason =
    !serviceAvailable
      ? '本地控制服务当前未连接，无法提交手动交易。'
      : !marketDetail
        ? '当前品种行情尚未就绪，稍后再试。'
        : !Number.isFinite(manualOrderQuantity) || manualOrderQuantity <= 0
          ? '手动交易数量必须大于 0。'
          : !Number.isFinite(manualOrderPrice) || manualOrderPrice <= 0
            ? '手动交易价格必须大于 0。'
            : requiresPrivateTrading && !bybitPrivateStatus?.can_query_private
              ? '当前未检测到 Bybit 私有 API 配置，无法提交真实委托。'
              : privateModeMismatch
                ? `当前私有 API 指向 ${String(bybitPrivateStatus?.mode ?? '').toUpperCase()}，和当前 ${selectedMode.toUpperCase()} 模式不一致。`
                : manualTradePreviewBlockedMessage

  return {
    manualOrderQuantity,
    manualOrderPrice,
    manualTradePreviewQuery,
    manualTradePreview,
    manualTradingBlockedReason,
    selectedStrategyNeedsRuntimeRecovery,
  }
}

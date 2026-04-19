import type { Dispatch, SetStateAction } from 'react'

import type { WatchlistInstrument } from '../types'

import type {
  ActionTone,
  SubmitStrategyRequest,
} from './workspaceAlertWatchlistActionsHelpers'
import {
  buildAlertAcknowledgementFeedback,
  buildWatchlistAddFeedback,
  buildWatchlistAlertRuleErrorDetail,
  buildWatchlistAlertRuleValidationFeedback,
  buildWatchlistRemoveFeedback,
  buildWatchlistAlertRulePayload,
  normalizeWatchlistSymbol,
  resolveWatchlistAlertThreshold,
} from './workspaceAlertWatchlistActionsHelpers'

type WatchlistMutationResult = {
  symbol: string
  title?: string
  next_selected_symbol?: string | null
}

type UseWorkspaceAlertWatchlistActionHandlersArgs = {
  watchlistDraftSymbol: string
  watchlistDraftMarket: string
  watchlistAlertDrafts: Record<string, string>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setWatchlistDraftSymbol: Dispatch<SetStateAction<string>>
  setWatchlistManagerOpen: Dispatch<SetStateAction<boolean>>
  showFeedback: (tone: ActionTone, title: string, detail: string) => void
  submitStrategyRequest: SubmitStrategyRequest
  alertMutation: {
    mutateAsync: (args: { alertId: string; acknowledged: boolean }) => Promise<WatchlistMutationResult>
    isPending: boolean
  }
  watchlistAddMutation: {
    mutateAsync: (args: {
      symbol: string
      market: string
      requested_by: string
    }) => Promise<{ symbol: string }>
    isPending: boolean
  }
  watchlistRemoveMutation: {
    mutateAsync: (symbol: string) => Promise<{ symbol: string; next_selected_symbol?: string | null }>
    isPending: boolean
  }
}

export function buildWorkspaceAlertWatchlistActionHandlers({
  watchlistDraftSymbol,
  watchlistDraftMarket,
  watchlistAlertDrafts,
  setSelectedSymbol,
  setWatchlistDraftSymbol,
  setWatchlistManagerOpen,
  showFeedback,
  submitStrategyRequest,
  alertMutation,
  watchlistAddMutation,
  watchlistRemoveMutation,
}: UseWorkspaceAlertWatchlistActionHandlersArgs) {
  const toggleAlertAcknowledged = async (alertId: string, acknowledged: boolean) => {
    try {
      const result = await alertMutation.mutateAsync({ alertId, acknowledged })
      const feedback = buildAlertAcknowledgementFeedback(acknowledged, result)
      showFeedback(feedback.tone, feedback.title, feedback.detail)
    } catch (error) {
      showFeedback('error', '提醒状态更新失败', buildWatchlistAlertRuleErrorDetail(error))
    }
  }

  const submitWatchlistItem = async () => {
    const normalizedSymbol = normalizeWatchlistSymbol(watchlistDraftSymbol)
    if (!normalizedSymbol) {
      showFeedback('warning', '请输入品种代码', '例如 BTCUSDT、ETHUSDT、SOLUSDT。')
      return
    }

    try {
      const item = await watchlistAddMutation.mutateAsync({
        symbol: normalizedSymbol,
        market: watchlistDraftMarket,
        requested_by: 'desktop_operator',
      })
      setSelectedSymbol(item.symbol)
      setWatchlistDraftSymbol('')
      setWatchlistManagerOpen(false)
      const feedback = buildWatchlistAddFeedback(item.symbol)
      showFeedback(feedback.tone, feedback.title, feedback.detail)
    } catch (error) {
      showFeedback('error', '自选添加失败', buildWatchlistAlertRuleErrorDetail(error))
    }
  }

  const removeWatchlistItem = async (symbol: string) => {
    try {
      const result = await watchlistRemoveMutation.mutateAsync(symbol)
      if (result.next_selected_symbol) {
        setSelectedSymbol(result.next_selected_symbol)
      }
      const feedback = buildWatchlistRemoveFeedback(result.symbol)
      showFeedback(feedback.tone, feedback.title, feedback.detail)
    } catch (error) {
      showFeedback('error', '自选移除失败', buildWatchlistAlertRuleErrorDetail(error))
    }
  }

  const submitWatchlistAlertRule = async (
    item: WatchlistInstrument,
    options?: { alertEnabled?: boolean },
  ) => {
    const threshold = resolveWatchlistAlertThreshold(item, watchlistAlertDrafts)

    if (threshold == null) {
      const feedback = buildWatchlistAlertRuleValidationFeedback()
      showFeedback(feedback.tone, feedback.title, feedback.detail)
      return
    }

    await submitStrategyRequest(
      'alert.rule.update',
      `${item.symbol} 更新波动提醒`,
      buildWatchlistAlertRulePayload(item, threshold, options?.alertEnabled ?? item.alert_enabled),
    )
  }

  return {
    toggleAlertAcknowledged,
    submitWatchlistItem,
    removeWatchlistItem,
    submitWatchlistAlertRule,
  }
}

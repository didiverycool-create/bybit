import { useState } from 'react'

import type { Mode } from '../types'
import {
  buildSettingsDraft,
  type SettingsDraft,
} from '../utils/app-helpers'
import type { WorkspaceBootstrap } from '../utils/workspace-helpers'

type UseWorkspaceDraftAndFilterStateArgs = {
  workspaceBootstrap: WorkspaceBootstrap
  defaultBacktestRange: string
  defaultBacktestTimeframe: string
}

export function useWorkspaceDraftAndFilterState({
  workspaceBootstrap,
  defaultBacktestRange,
  defaultBacktestTimeframe,
}: UseWorkspaceDraftAndFilterStateArgs) {
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'all' | 'P0' | 'P1' | 'P2'>(
    workspaceBootstrap.alert_severity_filter,
  )
  const [alertStatusFilter, setAlertStatusFilter] = useState<'all' | 'pending' | 'acknowledged'>(
    workspaceBootstrap.alert_status_filter,
  )
  const [alertScopeFilter, setAlertScopeFilter] = useState<'all' | 'selected'>(
    workspaceBootstrap.alert_scope_filter,
  )
  const [tradeModeFilter, setTradeModeFilter] = useState<'all' | Mode>(
    workspaceBootstrap.trade_mode_filter,
  )
  const [tradeOriginFilter, setTradeOriginFilter] = useState<'all' | 'manual' | 'strategy' | 'exchange'>(
    workspaceBootstrap.trade_origin_filter,
  )
  const [tradeScopeFilter, setTradeScopeFilter] = useState<'all' | 'selected'>(
    workspaceBootstrap.trade_scope_filter,
  )
  const [auditSeverityFilter, setAuditSeverityFilter] = useState<'all' | 'info' | 'warning' | 'error' | 'critical'>(
    workspaceBootstrap.audit_severity_filter,
  )
  const [auditSourceFilter, setAuditSourceFilter] = useState(workspaceBootstrap.audit_source_filter)
  const [auditScopeFilter, setAuditScopeFilter] = useState<'all' | 'selected'>(
    workspaceBootstrap.audit_scope_filter,
  )
  const [auditSearch, setAuditSearch] = useState(workspaceBootstrap.audit_search)
  const [watchlistDraftSymbol, setWatchlistDraftSymbol] = useState('')
  const [watchlistDraftMarket, setWatchlistDraftMarket] = useState<'spot' | 'perp'>('perp')
  const [watchlistAlertDrafts, setWatchlistAlertDrafts] = useState<Record<string, string>>({})
  const [parameterDrafts, setParameterDrafts] = useState<Record<string, string>>(
    workspaceBootstrap.selected_strategy_editor_parameter_drafts,
  )
  const [riskBudgetDraft, setRiskBudgetDraft] = useState(
    workspaceBootstrap.selected_strategy_editor_risk_budget_draft,
  )
  const [strategyEditorDraftStrategyId, setStrategyEditorDraftStrategyId] = useState<string | null>(
    workspaceBootstrap.selected_strategy_editor_strategy_id,
  )
  const [backtestRangeDraft, setBacktestRangeDraft] = useState<string>(defaultBacktestRange)
  const [backtestTimeframeDraft, setBacktestTimeframeDraft] = useState<string>(
    defaultBacktestTimeframe,
  )
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>(() => buildSettingsDraft())
  const [manualOrder, setManualOrder] = useState({
    side: 'buy' as 'buy' | 'sell',
    quantity: '1',
    price: '0',
    note: '',
  })

  return {
    alertSeverityFilter,
    setAlertSeverityFilter,
    alertStatusFilter,
    setAlertStatusFilter,
    alertScopeFilter,
    setAlertScopeFilter,
    tradeModeFilter,
    setTradeModeFilter,
    tradeOriginFilter,
    setTradeOriginFilter,
    tradeScopeFilter,
    setTradeScopeFilter,
    auditSeverityFilter,
    setAuditSeverityFilter,
    auditSourceFilter,
    setAuditSourceFilter,
    auditScopeFilter,
    setAuditScopeFilter,
    auditSearch,
    setAuditSearch,
    watchlistDraftSymbol,
    setWatchlistDraftSymbol,
    watchlistDraftMarket,
    setWatchlistDraftMarket,
    watchlistAlertDrafts,
    setWatchlistAlertDrafts,
    parameterDrafts,
    setParameterDrafts,
    riskBudgetDraft,
    setRiskBudgetDraft,
    strategyEditorDraftStrategyId,
    setStrategyEditorDraftStrategyId,
    backtestRangeDraft,
    setBacktestRangeDraft,
    backtestTimeframeDraft,
    setBacktestTimeframeDraft,
    settingsDraft,
    setSettingsDraft,
    manualOrder,
    setManualOrder,
  }
}

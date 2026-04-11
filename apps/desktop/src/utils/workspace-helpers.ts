import type { LayoutPreset, Mode, SectionKey } from '../types'

export const defaultCardOrder = ['ai_center', 'strategy_watch', 'account_center']
export const defaultVisibleCards = [...defaultCardOrder]
const WORKSPACE_STORAGE_KEY = 'bybit-control-workspace-v1'

export type MarketTimeframe = '15m' | '1h' | '4h' | '1d'

export type WorkspaceBootstrap = {
  active_section: SectionKey
  layout_preset: LayoutPreset
  selected_mode: Mode
  selected_symbol: string
  selected_market_timeframe: MarketTimeframe
  selected_strategy_id: string | null
  selected_backtest_id: string | null
  selected_scheduler_job_id: string | null
  selected_strategy_detail_panel: 'activity' | 'tracking' | 'editor' | null
  selected_strategy_tracking_kind: 'issue' | 'change' | null
  selected_strategy_tracking_summary: string
  selected_strategy_tracking_detail: string
  selected_strategy_editor_strategy_id: string | null
  selected_strategy_editor_parameter_drafts: Record<string, string>
  selected_strategy_editor_risk_budget_draft: string
  selected_review_inspector_id: string | null
  selected_review_inspector_strategy_id: string | null
  selected_review_id: string | null
  selected_proposal_id: string | null
  selected_change_request_id: string | null
  backtest_filter: 'selected' | 'all'
  replay_tracking_scope: 'all' | 'selected'
  alert_severity_filter: 'all' | 'P0' | 'P1' | 'P2'
  alert_status_filter: 'all' | 'pending' | 'acknowledged'
  alert_scope_filter: 'all' | 'selected'
  trade_mode_filter: 'all' | Mode
  trade_origin_filter: 'all' | 'manual' | 'strategy' | 'exchange'
  trade_scope_filter: 'all' | 'selected'
  audit_severity_filter: 'all' | 'info' | 'warning' | 'error' | 'critical'
  audit_source_filter: string
  audit_scope_filter: 'all' | 'selected'
  audit_search: string
  overview_card_order: string[]
  overview_visible_cards: string[]
  overview_collapsed_cards: string[]
  updated_at: string | null
  source: 'local' | 'default'
}

export function normalizeCardIds(ids: string[]) {
  const validIds = ids.filter((id) => defaultCardOrder.includes(id))
  const next: string[] = []
  validIds.forEach((id) => {
    if (!next.includes(id)) {
      next.push(id)
    }
  })
  defaultCardOrder.forEach((id) => {
    if (!next.includes(id)) {
      next.push(id)
    }
  })
  return next
}

export function normalizeVisibleCardIds(ids: string[], orderedCardIds: string[]) {
  const order = normalizeCardIds(orderedCardIds)
  const valid = ids.filter((id) => order.includes(id))
  const deduped: string[] = []
  valid.forEach((id) => {
    if (!deduped.includes(id)) {
      deduped.push(id)
    }
  })
  return deduped.length ? order.filter((id) => deduped.includes(id)) : defaultVisibleCards
}

export function normalizeCollapsedCardIds(ids: string[], orderedCardIds: string[]) {
  const order = normalizeCardIds(orderedCardIds)
  const valid = ids.filter((id) => order.includes(id))
  const deduped: string[] = []
  valid.forEach((id) => {
    if (!deduped.includes(id)) {
      deduped.push(id)
    }
  })
  return order.filter((id) => deduped.includes(id))
}

export function normalizeWorkspaceMarketTimeframe(value: unknown): MarketTimeframe {
  const normalized = String(value ?? '1h').trim().toLowerCase()
  if (normalized === '15m' || normalized === '15') return '15m'
  if (normalized === '4h' || normalized === '240') return '4h'
  if (normalized === '1d' || normalized === 'd') return '1d'
  return '1h'
}

export function buildDefaultWorkspaceBootstrap(): WorkspaceBootstrap {
  return {
    active_section: 'overview',
    layout_preset: 'balanced',
    selected_mode: 'paper',
    selected_symbol: 'BTCUSDT',
    selected_market_timeframe: '1h',
    selected_strategy_id: null,
    selected_backtest_id: null,
    selected_scheduler_job_id: null,
    selected_strategy_detail_panel: null,
    selected_strategy_tracking_kind: null,
    selected_strategy_tracking_summary: '',
    selected_strategy_tracking_detail: '',
    selected_strategy_editor_strategy_id: null,
    selected_strategy_editor_parameter_drafts: {},
    selected_strategy_editor_risk_budget_draft: '',
    selected_review_inspector_id: null,
    selected_review_inspector_strategy_id: null,
    selected_review_id: null,
    selected_proposal_id: null,
    selected_change_request_id: null,
    backtest_filter: 'selected',
    replay_tracking_scope: 'all',
    alert_severity_filter: 'all',
    alert_status_filter: 'pending',
    alert_scope_filter: 'all',
    trade_mode_filter: 'all',
    trade_origin_filter: 'all',
    trade_scope_filter: 'all',
    audit_severity_filter: 'all',
    audit_source_filter: 'all',
    audit_scope_filter: 'all',
    audit_search: '',
    overview_card_order: [...defaultCardOrder],
    overview_visible_cards: [...defaultVisibleCards],
    overview_collapsed_cards: [],
    updated_at: null,
    source: 'default',
  }
}

export function readWorkspaceBootstrap(): WorkspaceBootstrap {
  if (typeof window === 'undefined') {
    return buildDefaultWorkspaceBootstrap()
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY)
    if (!raw) {
      return buildDefaultWorkspaceBootstrap()
    }
    const parsed = JSON.parse(raw) as Partial<WorkspaceBootstrap>
    const baseline = buildDefaultWorkspaceBootstrap()
    const cardOrder = normalizeCardIds(parsed.overview_card_order ?? baseline.overview_card_order)
    const selectedStrategyDetailPanel =
      parsed.selected_strategy_detail_panel === 'activity' ||
      parsed.selected_strategy_detail_panel === 'tracking' ||
      parsed.selected_strategy_detail_panel === 'editor'
        ? parsed.selected_strategy_detail_panel
        : baseline.selected_strategy_detail_panel
    const selectedStrategyTrackingKind =
      parsed.selected_strategy_tracking_kind === 'issue' || parsed.selected_strategy_tracking_kind === 'change'
        ? parsed.selected_strategy_tracking_kind
        : baseline.selected_strategy_tracking_kind
    return {
      active_section: parsed.active_section ?? baseline.active_section,
      layout_preset: parsed.layout_preset ?? baseline.layout_preset,
      selected_mode: parsed.selected_mode ?? baseline.selected_mode,
      selected_symbol: parsed.selected_symbol ?? baseline.selected_symbol,
      selected_market_timeframe: normalizeWorkspaceMarketTimeframe(
        parsed.selected_market_timeframe ?? baseline.selected_market_timeframe,
      ),
      selected_strategy_id: parsed.selected_strategy_id ?? baseline.selected_strategy_id,
      selected_backtest_id: parsed.selected_backtest_id ?? baseline.selected_backtest_id,
      selected_scheduler_job_id: parsed.selected_scheduler_job_id ?? baseline.selected_scheduler_job_id,
      selected_strategy_detail_panel: selectedStrategyDetailPanel,
      selected_strategy_tracking_kind: selectedStrategyTrackingKind,
      selected_strategy_tracking_summary:
        typeof parsed.selected_strategy_tracking_summary === 'string'
          ? parsed.selected_strategy_tracking_summary
          : baseline.selected_strategy_tracking_summary,
      selected_strategy_tracking_detail:
        typeof parsed.selected_strategy_tracking_detail === 'string'
          ? parsed.selected_strategy_tracking_detail
          : baseline.selected_strategy_tracking_detail,
      selected_strategy_editor_strategy_id:
        typeof parsed.selected_strategy_editor_strategy_id === 'string' &&
        parsed.selected_strategy_editor_strategy_id.trim()
          ? parsed.selected_strategy_editor_strategy_id
          : baseline.selected_strategy_editor_strategy_id,
      selected_strategy_editor_parameter_drafts:
        parsed.selected_strategy_editor_parameter_drafts &&
        typeof parsed.selected_strategy_editor_parameter_drafts === 'object' &&
        !Array.isArray(parsed.selected_strategy_editor_parameter_drafts)
          ? Object.fromEntries(
              Object.entries(parsed.selected_strategy_editor_parameter_drafts).flatMap(([key, value]) =>
                typeof value === 'string' && key.trim() ? [[key.trim(), value]] : [],
              ),
            )
          : baseline.selected_strategy_editor_parameter_drafts,
      selected_strategy_editor_risk_budget_draft:
        typeof parsed.selected_strategy_editor_risk_budget_draft === 'string'
          ? parsed.selected_strategy_editor_risk_budget_draft
          : baseline.selected_strategy_editor_risk_budget_draft,
      selected_review_inspector_id: parsed.selected_review_inspector_id ?? baseline.selected_review_inspector_id,
      selected_review_inspector_strategy_id:
        parsed.selected_review_inspector_strategy_id ?? baseline.selected_review_inspector_strategy_id,
      selected_review_id: parsed.selected_review_id ?? baseline.selected_review_id,
      selected_proposal_id: parsed.selected_proposal_id ?? baseline.selected_proposal_id,
      selected_change_request_id: parsed.selected_change_request_id ?? baseline.selected_change_request_id,
      backtest_filter: parsed.backtest_filter ?? baseline.backtest_filter,
      replay_tracking_scope: parsed.replay_tracking_scope ?? baseline.replay_tracking_scope,
      alert_severity_filter: parsed.alert_severity_filter ?? baseline.alert_severity_filter,
      alert_status_filter: parsed.alert_status_filter ?? baseline.alert_status_filter,
      alert_scope_filter: parsed.alert_scope_filter ?? baseline.alert_scope_filter,
      trade_mode_filter: parsed.trade_mode_filter ?? baseline.trade_mode_filter,
      trade_origin_filter: parsed.trade_origin_filter ?? baseline.trade_origin_filter,
      trade_scope_filter: parsed.trade_scope_filter ?? baseline.trade_scope_filter,
      audit_severity_filter: parsed.audit_severity_filter ?? baseline.audit_severity_filter,
      audit_source_filter:
        typeof parsed.audit_source_filter === 'string' && parsed.audit_source_filter.trim()
          ? parsed.audit_source_filter
          : baseline.audit_source_filter,
      audit_scope_filter: parsed.audit_scope_filter ?? baseline.audit_scope_filter,
      audit_search: typeof parsed.audit_search === 'string' ? parsed.audit_search : baseline.audit_search,
      overview_card_order: cardOrder,
      overview_visible_cards: normalizeVisibleCardIds(
        parsed.overview_visible_cards ?? baseline.overview_visible_cards,
        cardOrder,
      ),
      overview_collapsed_cards: normalizeCollapsedCardIds(
        parsed.overview_collapsed_cards ?? baseline.overview_collapsed_cards,
        cardOrder,
      ),
      updated_at: parsed.updated_at ?? null,
      source: 'local',
    }
  } catch (error) {
    console.warn('读取本地工作台状态失败，已回退默认布局。', error)
    return buildDefaultWorkspaceBootstrap()
  }
}

export function persistLocalWorkspace(workspace: Omit<WorkspaceBootstrap, 'source'>) {
  if (typeof window === 'undefined') return

  window.localStorage.setItem(
    WORKSPACE_STORAGE_KEY,
    JSON.stringify({
      ...workspace,
      overview_card_order: normalizeCardIds(workspace.overview_card_order),
      overview_visible_cards: normalizeVisibleCardIds(
        workspace.overview_visible_cards,
        workspace.overview_card_order,
      ),
      overview_collapsed_cards: normalizeCollapsedCardIds(
        workspace.overview_collapsed_cards,
        workspace.overview_card_order,
      ),
    }),
  )
}

export function buildWorkspaceSignature(
  workspace: Omit<WorkspaceBootstrap, 'updated_at' | 'source'> | WorkspaceBootstrap,
) {
  const defaults = buildDefaultWorkspaceBootstrap()
  return JSON.stringify({
    active_section: workspace.active_section ?? defaults.active_section,
    layout_preset: workspace.layout_preset ?? defaults.layout_preset,
    selected_mode: workspace.selected_mode ?? defaults.selected_mode,
    selected_symbol: workspace.selected_symbol ?? defaults.selected_symbol,
    selected_market_timeframe: normalizeWorkspaceMarketTimeframe(workspace.selected_market_timeframe),
    selected_strategy_id: workspace.selected_strategy_id ?? '',
    selected_backtest_id: workspace.selected_backtest_id ?? '',
    selected_scheduler_job_id: workspace.selected_scheduler_job_id ?? '',
    selected_strategy_detail_panel: workspace.selected_strategy_detail_panel ?? '',
    selected_strategy_tracking_kind: workspace.selected_strategy_tracking_kind ?? '',
    selected_strategy_tracking_summary: workspace.selected_strategy_tracking_summary ?? '',
    selected_strategy_tracking_detail: workspace.selected_strategy_tracking_detail ?? '',
    selected_strategy_editor_strategy_id: workspace.selected_strategy_editor_strategy_id ?? '',
    selected_strategy_editor_parameter_drafts: Object.fromEntries(
      Object.entries(workspace.selected_strategy_editor_parameter_drafts ?? {})
        .filter(([key, value]) => key.trim() && typeof value === 'string')
        .sort(([left], [right]) => left.localeCompare(right)),
    ),
    selected_strategy_editor_risk_budget_draft: workspace.selected_strategy_editor_risk_budget_draft ?? '',
    selected_review_inspector_id: workspace.selected_review_inspector_id ?? '',
    selected_review_inspector_strategy_id: workspace.selected_review_inspector_strategy_id ?? '',
    selected_review_id: workspace.selected_review_id ?? '',
    selected_proposal_id: workspace.selected_proposal_id ?? '',
    selected_change_request_id: workspace.selected_change_request_id ?? '',
    backtest_filter: workspace.backtest_filter ?? defaults.backtest_filter,
    replay_tracking_scope: workspace.replay_tracking_scope ?? defaults.replay_tracking_scope,
    alert_severity_filter: workspace.alert_severity_filter ?? defaults.alert_severity_filter,
    alert_status_filter: workspace.alert_status_filter ?? defaults.alert_status_filter,
    alert_scope_filter: workspace.alert_scope_filter ?? defaults.alert_scope_filter,
    trade_mode_filter: workspace.trade_mode_filter ?? defaults.trade_mode_filter,
    trade_origin_filter: workspace.trade_origin_filter ?? defaults.trade_origin_filter,
    trade_scope_filter: workspace.trade_scope_filter ?? defaults.trade_scope_filter,
    audit_severity_filter: workspace.audit_severity_filter ?? defaults.audit_severity_filter,
    audit_source_filter:
      typeof workspace.audit_source_filter === 'string' && workspace.audit_source_filter.trim()
        ? workspace.audit_source_filter.trim()
        : defaults.audit_source_filter,
    audit_scope_filter: workspace.audit_scope_filter ?? defaults.audit_scope_filter,
    audit_search: String(workspace.audit_search ?? defaults.audit_search).trim(),
    overview_card_order: normalizeCardIds(workspace.overview_card_order),
    overview_visible_cards: normalizeVisibleCardIds(
      workspace.overview_visible_cards,
      workspace.overview_card_order,
    ),
    overview_collapsed_cards: normalizeCollapsedCardIds(
      workspace.overview_collapsed_cards,
      workspace.overview_card_order,
    ),
  })
}

export type WorkspaceDraftInput = {
  activeSection: SectionKey
  layoutPreset: LayoutPreset
  selectedMode: Mode
  selectedSymbol: string
  selectedMarketTimeframe: MarketTimeframe
  selectedStrategyWorkspaceId: string | null
  selectedBacktestId: string | null
  aiSchedulerFocusedJobId: string | null
  selectedStrategyDetailPanel: WorkspaceBootstrap['selected_strategy_detail_panel']
  strategyTrackingKind: WorkspaceBootstrap['selected_strategy_tracking_kind']
  strategyTrackingSummary: string
  strategyTrackingDetail: string
  persistedStrategyEditorDraftStrategyId: string | null
  persistedStrategyEditorParameterDrafts: Record<string, string>
  persistedStrategyEditorRiskBudgetDraft: string
  reviewInspectorOpen: boolean
  reviewInspectorReviewId: string | null
  reviewInspectorStrategyId: string | null
  replayFocusedReviewId: string | null
  selectedProposalId: string | null
  selectedChangeRequestId: string | null
  backtestFilter: WorkspaceBootstrap['backtest_filter']
  replayTrackingScope: WorkspaceBootstrap['replay_tracking_scope']
  alertSeverityFilter: WorkspaceBootstrap['alert_severity_filter']
  alertStatusFilter: WorkspaceBootstrap['alert_status_filter']
  alertScopeFilter: WorkspaceBootstrap['alert_scope_filter']
  tradeModeFilter: WorkspaceBootstrap['trade_mode_filter']
  tradeOriginFilter: WorkspaceBootstrap['trade_origin_filter']
  tradeScopeFilter: WorkspaceBootstrap['trade_scope_filter']
  auditSeverityFilter: WorkspaceBootstrap['audit_severity_filter']
  auditSourceFilter: string
  auditScopeFilter: WorkspaceBootstrap['audit_scope_filter']
  auditSearch: string
  cardOrder: string[]
  visibleOverviewCards: string[]
  collapsedOverviewCards: string[]
}

export function buildWorkspaceDraft(input: WorkspaceDraftInput): Omit<WorkspaceBootstrap, 'updated_at' | 'source'> {
  return {
    active_section: input.activeSection,
    layout_preset: input.layoutPreset,
    selected_mode: input.selectedMode,
    selected_symbol: input.selectedSymbol,
    selected_market_timeframe: input.selectedMarketTimeframe,
    selected_strategy_id: input.selectedStrategyWorkspaceId,
    selected_backtest_id: input.selectedBacktestId,
    selected_scheduler_job_id: input.aiSchedulerFocusedJobId,
    selected_strategy_detail_panel: input.selectedStrategyDetailPanel,
    selected_strategy_tracking_kind:
      input.selectedStrategyDetailPanel === 'tracking' ? input.strategyTrackingKind : null,
    selected_strategy_tracking_summary:
      input.selectedStrategyDetailPanel === 'tracking' ? input.strategyTrackingSummary : '',
    selected_strategy_tracking_detail:
      input.selectedStrategyDetailPanel === 'tracking' ? input.strategyTrackingDetail : '',
    selected_strategy_editor_strategy_id: input.persistedStrategyEditorDraftStrategyId,
    selected_strategy_editor_parameter_drafts: input.persistedStrategyEditorParameterDrafts,
    selected_strategy_editor_risk_budget_draft: input.persistedStrategyEditorRiskBudgetDraft,
    selected_review_inspector_id: input.reviewInspectorOpen ? input.reviewInspectorReviewId : null,
    selected_review_inspector_strategy_id: input.reviewInspectorOpen ? input.reviewInspectorStrategyId : null,
    selected_review_id: input.replayFocusedReviewId,
    selected_proposal_id: input.selectedProposalId,
    selected_change_request_id: input.selectedChangeRequestId,
    backtest_filter: input.backtestFilter,
    replay_tracking_scope: input.replayTrackingScope,
    alert_severity_filter: input.alertSeverityFilter,
    alert_status_filter: input.alertStatusFilter,
    alert_scope_filter: input.alertScopeFilter,
    trade_mode_filter: input.tradeModeFilter,
    trade_origin_filter: input.tradeOriginFilter,
    trade_scope_filter: input.tradeScopeFilter,
    audit_severity_filter: input.auditSeverityFilter,
    audit_source_filter: input.auditSourceFilter,
    audit_scope_filter: input.auditScopeFilter,
    audit_search: input.auditSearch,
    overview_card_order: normalizeCardIds(input.cardOrder),
    overview_visible_cards: normalizeVisibleCardIds(input.visibleOverviewCards, input.cardOrder),
    overview_collapsed_cards: normalizeCollapsedCardIds(input.collapsedOverviewCards, input.cardOrder),
  }
}

export type CurrentWorkspaceDraftInput = WorkspaceDraftInput

export function buildCurrentWorkspaceDraft(input: CurrentWorkspaceDraftInput) {
  return buildWorkspaceDraft(input)
}

export function buildWorkspacePersistedState(
  draft: Omit<WorkspaceBootstrap, 'updated_at' | 'source'>,
  updatedAt: string | null,
): Omit<WorkspaceBootstrap, 'source'> {
  return {
    ...draft,
    updated_at: updatedAt,
  }
}

export function buildRestoredWorkspaceDraft({
  selectedSymbol,
  selectedStrategyId,
}: {
  selectedSymbol?: string | null
  selectedStrategyId?: string | null
}): Omit<WorkspaceBootstrap, 'updated_at' | 'source'> {
  const defaults = buildDefaultWorkspaceBootstrap()
  return {
    active_section: defaults.active_section,
    layout_preset: defaults.layout_preset,
    selected_mode: defaults.selected_mode,
    selected_symbol: selectedSymbol ?? defaults.selected_symbol,
    selected_market_timeframe: defaults.selected_market_timeframe,
    selected_strategy_id: selectedStrategyId ?? defaults.selected_strategy_id,
    selected_backtest_id: null,
    selected_scheduler_job_id: null,
    selected_strategy_detail_panel: null,
    selected_strategy_tracking_kind: null,
    selected_strategy_tracking_summary: '',
    selected_strategy_tracking_detail: '',
    selected_strategy_editor_strategy_id: null,
    selected_strategy_editor_parameter_drafts: {},
    selected_strategy_editor_risk_budget_draft: '',
    selected_review_inspector_id: null,
    selected_review_inspector_strategy_id: null,
    selected_review_id: null,
    selected_proposal_id: null,
    selected_change_request_id: null,
    backtest_filter: defaults.backtest_filter,
    replay_tracking_scope: defaults.replay_tracking_scope,
    alert_severity_filter: defaults.alert_severity_filter,
    alert_status_filter: defaults.alert_status_filter,
    alert_scope_filter: defaults.alert_scope_filter,
    trade_mode_filter: defaults.trade_mode_filter,
    trade_origin_filter: defaults.trade_origin_filter,
    trade_scope_filter: defaults.trade_scope_filter,
    audit_severity_filter: defaults.audit_severity_filter,
    audit_source_filter: defaults.audit_source_filter,
    audit_scope_filter: defaults.audit_scope_filter,
    audit_search: defaults.audit_search,
    overview_card_order: [...defaultCardOrder],
    overview_visible_cards: [...defaultVisibleCards],
    overview_collapsed_cards: [],
  }
}

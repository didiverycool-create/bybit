import { startTransition, type Dispatch, type SetStateAction } from 'react'

import type {
  AgentJob,
  BacktestRun,
  ChangeRequest,
  ReviewDocument,
  SectionKey,
  StrategyProposal,
  StrategySummary,
} from '../types'
import {
  getAgentJobStrategyId,
  getChangeRequestStrategyId,
  getReviewFocusStrategyId,
  normalizeDraftValue,
} from '../utils/app-helpers'

type ScopeFilter = 'all' | 'selected'

type UseWorkspaceNavigationArgs = {
  strategies: StrategySummary[]
  selectedStrategy: StrategySummary | null
  selectedStrategyId: string | null
  strategyEditorDraftStrategyId: string | null
  parameterDrafts: Record<string, string>
  backtests: BacktestRun[]
  changeRequests: ChangeRequest[]
  proposalCatalog: StrategyProposal[]
  reviewCatalog: ReviewDocument[]
  strategyActivityReviewRecords: ReviewDocument[]
  schedulerJobs: AgentJob[]
  strategyActivityJobRecords: AgentJob[]
  setParameterDrafts: Dispatch<SetStateAction<Record<string, string>>>
  setRiskBudgetDraft: Dispatch<SetStateAction<string>>
  setStrategyEditorDraftStrategyId: Dispatch<SetStateAction<string | null>>
  setActiveSection: Dispatch<SetStateAction<SectionKey>>
  setSelectedStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedSymbol: Dispatch<SetStateAction<string>>
  setStrategyActivityPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyTrackingPanelOpen: Dispatch<SetStateAction<boolean>>
  setStrategyEditorOpen: Dispatch<SetStateAction<boolean>>
  setReplayTrackingScope: Dispatch<SetStateAction<ScopeFilter>>
  setReplayFocusedReviewId: Dispatch<SetStateAction<string | null>>
  setBacktestFilter: Dispatch<SetStateAction<ScopeFilter>>
  setSelectedBacktestId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorOpen: Dispatch<SetStateAction<boolean>>
  setReviewInspectorReviewId: Dispatch<SetStateAction<string | null>>
  setReviewInspectorStrategyId: Dispatch<SetStateAction<string | null>>
  setSelectedChangeRequestId: Dispatch<SetStateAction<string | null>>
  setSelectedProposalId: Dispatch<SetStateAction<string | null>>
  setAiSchedulerFocusedJobId: Dispatch<SetStateAction<string | null>>
  setAlertScopeFilter: Dispatch<SetStateAction<ScopeFilter>>
  setTradeScopeFilter: Dispatch<SetStateAction<ScopeFilter>>
  setAuditScopeFilter: Dispatch<SetStateAction<ScopeFilter>>
}

export function useWorkspaceNavigation({
  strategies,
  selectedStrategy,
  selectedStrategyId,
  strategyEditorDraftStrategyId,
  parameterDrafts,
  backtests,
  changeRequests,
  proposalCatalog,
  reviewCatalog,
  strategyActivityReviewRecords,
  schedulerJobs,
  strategyActivityJobRecords,
  setParameterDrafts,
  setRiskBudgetDraft,
  setStrategyEditorDraftStrategyId,
  setActiveSection,
  setSelectedStrategyId,
  setSelectedSymbol,
  setStrategyActivityPanelOpen,
  setStrategyTrackingPanelOpen,
  setStrategyEditorOpen,
  setReplayTrackingScope,
  setReplayFocusedReviewId,
  setBacktestFilter,
  setSelectedBacktestId,
  setReviewInspectorOpen,
  setReviewInspectorReviewId,
  setReviewInspectorStrategyId,
  setSelectedChangeRequestId,
  setSelectedProposalId,
  setAiSchedulerFocusedJobId,
  setAlertScopeFilter,
  setTradeScopeFilter,
  setAuditScopeFilter,
}: UseWorkspaceNavigationArgs) {
  const closeReviewInspector = () => {
    setReviewInspectorOpen(false)
    setReviewInspectorReviewId(null)
    setReviewInspectorStrategyId(null)
  }

  const openSection = (section: SectionKey) => {
    setActiveSection(section)
  }

  const openStrategyEditor = (strategyId?: string | null) => {
    const nextStrategyId = strategyId ?? selectedStrategy?.id ?? selectedStrategyId
    if (!nextStrategyId) {
      return
    }
    const nextStrategy = strategies.find((item) => item.id === nextStrategyId) ?? null
    const nextSymbol = nextStrategy?.symbols[0] ?? null
    if (
      nextStrategy &&
      (strategyEditorDraftStrategyId !== nextStrategy.id || Object.keys(parameterDrafts).length === 0)
    ) {
      setParameterDrafts(
        Object.fromEntries(
          nextStrategy.parameters.map((parameter) => [parameter.key, normalizeDraftValue(parameter.value)]),
        ),
      )
      setRiskBudgetDraft(nextStrategy.risk_budget ?? '')
      setStrategyEditorDraftStrategyId(nextStrategy.id)
    }
    startTransition(() => {
      setActiveSection('strategy')
      setSelectedStrategyId(nextStrategyId)
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setStrategyActivityPanelOpen(false)
      setStrategyTrackingPanelOpen(false)
      setStrategyEditorOpen(true)
    })
  }

  const openStrategyActivity = (strategyId?: string | null) => {
    if (!strategyId) {
      return
    }
    const nextSymbol = strategies.find((item) => item.id === strategyId)?.symbols[0] ?? null
    startTransition(() => {
      setActiveSection('strategy')
      setSelectedStrategyId(strategyId)
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setStrategyEditorOpen(false)
      setStrategyTrackingPanelOpen(false)
      setStrategyActivityPanelOpen(true)
    })
  }

  const openStrategyReplay = (strategyId?: string | null) => {
    if (!strategyId) {
      return
    }
    startTransition(() => {
      setActiveSection('replay')
      setSelectedStrategyId(strategyId)
      setReplayTrackingScope('selected')
      setReplayFocusedReviewId(null)
    })
  }

  const openReplayReview = (
    reviewId?: string | null,
    strategyId?: string | null,
    scope: ScopeFilter = 'all',
  ) => {
    if (!reviewId && !strategyId) {
      return
    }
    const linkedReview =
      reviewCatalog.find((review) => review.id === reviewId) ??
      strategyActivityReviewRecords.find((review) => review.id === reviewId) ??
      null
    const nextStrategyId = strategyId ?? getReviewFocusStrategyId(linkedReview, selectedStrategy?.id ?? selectedStrategyId)
    const nextSymbol = strategies.find((item) => item.id === nextStrategyId)?.symbols[0] ?? null
    startTransition(() => {
      setActiveSection('replay')
      if (nextStrategyId) {
        setSelectedStrategyId(nextStrategyId)
      }
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setReplayTrackingScope(scope)
      setReplayFocusedReviewId(reviewId ?? null)
    })
  }

  const openBacktestDetail = (backtestId?: string | null, strategyId?: string | null) => {
    if (!backtestId) {
      return
    }
    const linkedBacktest = backtests.find((item) => item.id === backtestId) ?? null
    const nextStrategyId = strategyId ?? linkedBacktest?.strategy_id ?? null
    const nextSymbol =
      linkedBacktest?.symbol_scope.find((symbol) => typeof symbol === 'string' && symbol.trim()) ??
      strategies.find((item) => item.id === nextStrategyId)?.symbols[0] ??
      null
    startTransition(() => {
      setActiveSection('backtest')
      if (nextStrategyId) {
        setSelectedStrategyId(nextStrategyId)
        setBacktestFilter('selected')
      } else {
        setBacktestFilter('all')
      }
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setSelectedBacktestId(backtestId)
    })
    closeReviewInspector()
  }

  const openSourceReview = (reviewId?: string | null, strategyId?: string | null) => {
    if (!reviewId) {
      return
    }
    openReplayReview(reviewId, strategyId, strategyId ? 'selected' : 'all')
    closeReviewInspector()
  }

  const openStrategyProposal = (proposalId?: string | null, strategyId?: string | null) => {
    if (!proposalId) {
      return
    }
    const linkedProposal = proposalCatalog.find((proposal) => proposal.id === proposalId) ?? null
    const nextStrategyId = strategyId ?? linkedProposal?.strategy_id ?? null
    const nextSymbol = strategies.find((item) => item.id === nextStrategyId)?.symbols[0] ?? null
    startTransition(() => {
      setActiveSection('strategy')
      if (nextStrategyId) {
        setSelectedStrategyId(nextStrategyId)
      }
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setSelectedChangeRequestId(null)
      setSelectedProposalId(proposalId)
    })
    closeReviewInspector()
  }

  const openChangeRequest = (changeRequestId?: string | null, strategyId?: string | null) => {
    if (!changeRequestId) {
      return
    }
    const linkedChangeRequest = changeRequests.find((request) => request.id === changeRequestId) ?? null
    const nextStrategyId =
      strategyId ?? getChangeRequestStrategyId(linkedChangeRequest ?? undefined, selectedStrategy?.id ?? selectedStrategyId)
    const nextSymbol = strategies.find((item) => item.id === nextStrategyId)?.symbols[0] ?? null
    startTransition(() => {
      setActiveSection('strategy')
      if (nextStrategyId) {
        setSelectedStrategyId(nextStrategyId)
      }
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setSelectedProposalId(null)
      setSelectedChangeRequestId(changeRequestId)
    })
    closeReviewInspector()
  }

  const openReviewInspector = (reviewId?: string | null, strategyId?: string | null) => {
    if (!reviewId) {
      return
    }
    const linkedReview =
      reviewCatalog.find((review) => review.id === reviewId) ??
      strategyActivityReviewRecords.find((review) => review.id === reviewId) ??
      null
    const nextStrategyId = strategyId ?? getReviewFocusStrategyId(linkedReview, selectedStrategy?.id ?? selectedStrategyId)
    const nextSymbol = strategies.find((item) => item.id === nextStrategyId)?.symbols[0] ?? null
    startTransition(() => {
      if (nextStrategyId) {
        setSelectedStrategyId(nextStrategyId)
      }
      if (nextSymbol) {
        setSelectedSymbol(nextSymbol)
      }
      setReviewInspectorReviewId(reviewId)
      setReviewInspectorStrategyId(nextStrategyId ?? null)
      setReviewInspectorOpen(true)
    })
  }

  const openAiSchedulerJob = (jobId?: string | null) => {
    if (!jobId) {
      return
    }
    const selectedJob =
      schedulerJobs.find((job) => job.id === jobId) ??
      strategyActivityJobRecords.find((job) => job.id === jobId) ??
      null
    const jobStrategyId = selectedJob ? getAgentJobStrategyId(selectedJob) : null
    const jobSymbol = strategies.find((item) => item.id === jobStrategyId)?.symbols[0] ?? null
    startTransition(() => {
      setActiveSection('scheduler')
      if (jobStrategyId) {
        setSelectedStrategyId(jobStrategyId)
      }
      if (jobSymbol) {
        setSelectedSymbol(jobSymbol)
      }
      setAiSchedulerFocusedJobId(jobId)
    })
    closeReviewInspector()
  }

  const openMarketSymbol = (symbol?: string | null) => {
    startTransition(() => {
      if (symbol) {
        setSelectedSymbol(symbol)
      }
      openSection('market')
    })
  }

  const openAlertsSection = (symbol?: string | null) => {
    startTransition(() => {
      if (symbol) {
        setSelectedSymbol(symbol)
        setAlertScopeFilter('selected')
      } else {
        setAlertScopeFilter('all')
      }
      openSection('alerts')
    })
  }

  const openTradesSection = (symbol?: string | null) => {
    startTransition(() => {
      if (symbol) {
        setSelectedSymbol(symbol)
        setTradeScopeFilter('selected')
      } else {
        setTradeScopeFilter('all')
      }
      openSection('trades')
    })
  }

  const openAuditSection = (symbol?: string | null) => {
    startTransition(() => {
      if (symbol) {
        setSelectedSymbol(symbol)
        setAuditScopeFilter('selected')
      } else {
        setAuditScopeFilter('all')
      }
      openSection('audit')
    })
  }

  return {
    closeReviewInspector,
    openSection,
    openStrategyEditor,
    openStrategyActivity,
    openStrategyReplay,
    openReplayReview,
    openBacktestDetail,
    openSourceReview,
    openStrategyProposal,
    openChangeRequest,
    openReviewInspector,
    openAiSchedulerJob,
    openMarketSymbol,
    openAlertsSection,
    openTradesSection,
    openAuditSection,
  }
}

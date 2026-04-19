import { startTransition } from 'react'

import type { SectionKey } from '../types'

import type { UseWorkspaceNavigationArgs } from './workspaceNavigationShared'

type BuildWorkspaceSectionNavigationActionsArgs = Pick<
  UseWorkspaceNavigationArgs,
  'setSelectedSymbol' | 'setAlertScopeFilter' | 'setTradeScopeFilter' | 'setAuditScopeFilter'
> & {
  openSection: (section: SectionKey) => void
}

export function buildWorkspaceSectionNavigationActions({
  setSelectedSymbol,
  setAlertScopeFilter,
  setTradeScopeFilter,
  setAuditScopeFilter,
  openSection,
}: BuildWorkspaceSectionNavigationActionsArgs) {
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
    openMarketSymbol,
    openAlertsSection,
    openTradesSection,
    openAuditSection,
  }
}

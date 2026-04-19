import { AlertTriangle, Bell } from 'lucide-react'

import type { WorkspaceStatusActionFeedback, WorkspaceStatusHeadlineAlert } from './buildWorkspaceStatusDerivedState'

type BuildWorkspaceStatusInlineToastArgs = {
  actionFeedback: WorkspaceStatusActionFeedback | null
  headlineAlert: WorkspaceStatusHeadlineAlert | null
}

export function buildWorkspaceStatusInlineToast({
  actionFeedback,
  headlineAlert,
}: BuildWorkspaceStatusInlineToastArgs) {
  return actionFeedback
    ? {
        tone: actionFeedback.tone === 'error' ? 'error' : actionFeedback.tone === 'warning' ? 'warning' : 'success',
        title: actionFeedback.title,
        detail: actionFeedback.detail,
        icon: actionFeedback.tone === 'error' ? AlertTriangle : Bell,
      }
    : headlineAlert && ['P0', 'P1'].includes(headlineAlert.severity)
      ? {
          tone: headlineAlert.severity === 'P0' ? 'error' : 'warning',
          title: headlineAlert.title,
          detail: `${headlineAlert.symbol} · ${headlineAlert.suggested_action}`,
          icon: Bell,
        }
      : null
}

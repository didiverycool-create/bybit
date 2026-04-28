import { startTransition } from 'react'

import type { BuildWorkspaceSectionActionsResult } from './buildWorkspaceSectionActions'
import type { BuildWorkspaceSectionOpsConsumerArgs } from './buildWorkspaceSectionActionConsumerGroups'

type BuildWorkspaceNewsSectionActionsArgs = Pick<
  BuildWorkspaceSectionOpsConsumerArgs,
  'news' | 'navigationActions'
>

export type BuildWorkspaceNewsSectionActionsResult = Pick<
  BuildWorkspaceSectionActionsResult,
  'newsWorkspaceProps'
>

export function buildWorkspaceNewsSectionActions({
  news,
  navigationActions,
}: BuildWorkspaceNewsSectionActionsArgs): BuildWorkspaceNewsSectionActionsResult {
  return {
    newsWorkspaceProps: {
      news,
      onOpenAlertsSection: () => {
        startTransition(() => navigationActions.openSection('alerts'))
      },
    },
  }
}

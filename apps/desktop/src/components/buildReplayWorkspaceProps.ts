import type { ComponentProps } from 'react'

import type ReplayWorkspaceContainer from './ReplayWorkspaceContainer'

type ReplayWorkspaceContainerProps = ComponentProps<typeof ReplayWorkspaceContainer>

export type BuildReplayWorkspacePropsArgs = ReplayWorkspaceContainerProps

export function buildReplayWorkspaceProps({
  focusState,
  replayState,
  serviceState,
  actions,
}: BuildReplayWorkspacePropsArgs): ReplayWorkspaceContainerProps {
  return {
    focusState,
    replayState,
    serviceState,
    actions,
  }
}

import type { ComponentProps } from 'react'

import type SettingsWorkspaceContainer from './SettingsWorkspaceContainer'

type SettingsWorkspaceContainerProps = ComponentProps<typeof SettingsWorkspaceContainer>

export type BuildSettingsWorkspacePropsArgs = SettingsWorkspaceContainerProps

export function buildSettingsWorkspaceProps({
  workspaceState,
  settingsState,
  actions,
}: BuildSettingsWorkspacePropsArgs): SettingsWorkspaceContainerProps {
  return {
    workspaceState,
    settingsState,
    actions,
  }
}

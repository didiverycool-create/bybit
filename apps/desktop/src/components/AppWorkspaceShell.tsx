import type { ComponentProps } from 'react'

import AppChromeShell from './AppChromeShell'
import AppOverlayPanelsContainer from './AppOverlayPanelsContainer'
import AppWorkspaceSectionOutlet from './AppWorkspaceSectionOutlet'
import StrategyActivityFloatingPanelContainer from './StrategyActivityFloatingPanelContainer'

type ChromeProps = ComponentProps<typeof AppChromeShell>

export type AppWorkspaceShellProps = Pick<
  ChromeProps,
  | 'activeSection'
  | 'onOpenSection'
  | 'statusInspectorHasNotice'
  | 'statusInspectorButtonTitle'
  | 'inlineToast'
> & {
  onOpenStatusInspector: () => void
  appOverlayPanelsProps: ComponentProps<typeof AppOverlayPanelsContainer>
  strategyActivityFloatingPanelProps: ComponentProps<typeof StrategyActivityFloatingPanelContainer>
  appWorkspaceSectionOutletProps: Omit<
    ComponentProps<typeof AppWorkspaceSectionOutlet>,
    'activeSection'
  >
}

export default function AppWorkspaceShell({
  activeSection,
  onOpenSection,
  statusInspectorHasNotice,
  statusInspectorButtonTitle,
  inlineToast,
  onOpenStatusInspector,
  appOverlayPanelsProps,
  strategyActivityFloatingPanelProps,
  appWorkspaceSectionOutletProps,
}: AppWorkspaceShellProps) {
  return (
    <AppChromeShell
      activeSection={activeSection}
      onOpenSection={onOpenSection}
      statusInspectorHasNotice={statusInspectorHasNotice}
      statusInspectorButtonTitle={statusInspectorButtonTitle}
      onOpenStatusInspector={onOpenStatusInspector}
      inlineToast={inlineToast}
    >
      <AppOverlayPanelsContainer {...appOverlayPanelsProps} />

      <StrategyActivityFloatingPanelContainer {...strategyActivityFloatingPanelProps} />

      <AppWorkspaceSectionOutlet
        activeSection={activeSection}
        {...appWorkspaceSectionOutletProps}
      />
    </AppChromeShell>
  )
}

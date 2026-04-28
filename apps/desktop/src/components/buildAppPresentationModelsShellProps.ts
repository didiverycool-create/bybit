import type { AppWorkspaceShellProps } from './AppWorkspaceShell'
import type { BuildAppPresentationModelsArgs } from './buildAppPresentationModels'
import type { BuildAppPresentationModelsSurfaceWorkspaceProps } from './buildAppPresentationModelsSurfaceWorkspaceProps'

export type BuildAppPresentationModelsShellPropsArgs = {
  args: BuildAppPresentationModelsArgs
  surfaceWorkspaceProps: BuildAppPresentationModelsSurfaceWorkspaceProps
}

export function buildAppPresentationModelsShellProps({
  args,
  surfaceWorkspaceProps,
}: BuildAppPresentationModelsShellPropsArgs): AppWorkspaceShellProps {
  const {
    activeSection,
    setStatusInspectorOpen,
    workspaceNavigation,
    statusInspectorHasNotice,
    inlineToast,
    statusInspectorButtonTitle,
  } = args

  return {
    activeSection,
    onOpenSection: workspaceNavigation.openSection,
    statusInspectorHasNotice,
    statusInspectorButtonTitle,
    onOpenStatusInspector: () => setStatusInspectorOpen(true),
    inlineToast,
    appOverlayPanelsProps: surfaceWorkspaceProps.appOverlayPanelsProps,
    strategyActivityFloatingPanelProps:
      surfaceWorkspaceProps.strategyActivityFloatingPanelProps,
    appWorkspaceSectionOutletProps: surfaceWorkspaceProps.appWorkspaceSectionOutletProps,
  }
}

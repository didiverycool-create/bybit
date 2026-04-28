import { useQueryClient } from '@tanstack/react-query'
import './App.css'
import AppWorkspaceShell from './components/AppWorkspaceShell'
import {
  backtestRangePresets,
  backtestTimeframePresets,
  marketTimeframePresets,
} from './components/appWorkspacePresets'
import {
  defaultBacktestRange,
  defaultBacktestTimeframe,
} from './components/appWorkspaceBootstrapDefaults'
import { useAppWorkspaceBootstrapState } from './components/useAppWorkspaceBootstrapState'
import { useAppShellModel } from './components/useAppShellModel'

function App() {
  const queryClient = useQueryClient()
  const workspaceBootstrapState = useAppWorkspaceBootstrapState({
    defaultBacktestRange,
    defaultBacktestTimeframe,
  })
  const appWorkspaceShellProps = useAppShellModel({
    queryClient,
    workspaceBootstrapState,
    backtestRangePresets,
    backtestTimeframePresets,
    marketTimeframePresets,
  })

  return <AppWorkspaceShell {...appWorkspaceShellProps} />
}

export default App

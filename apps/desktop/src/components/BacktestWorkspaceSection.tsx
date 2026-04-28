import BacktestWorkspaceSectionView from './BacktestWorkspaceSectionView'
import {
  buildBacktestWorkspaceSectionViewProps,
  type BacktestWorkspaceSectionViewProps,
} from './buildBacktestWorkspaceSectionViewProps'
import type { BacktestWorkspaceSectionProps } from './BacktestWorkspaceSection.types'

export type { BacktestWorkspaceSectionProps } from './BacktestWorkspaceSection.types'

export default function BacktestWorkspaceSection(props: BacktestWorkspaceSectionProps) {
  const viewProps: BacktestWorkspaceSectionViewProps = buildBacktestWorkspaceSectionViewProps(props)

  return <BacktestWorkspaceSectionView {...viewProps} />
}

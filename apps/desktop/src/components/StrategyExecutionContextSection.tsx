import StrategyExecutionContextSectionView from './StrategyExecutionContextSectionView'
import { buildStrategyExecutionContextSectionViewProps } from './buildStrategyExecutionContextSectionViewProps'
export type {
  BacktestDecisionMeta,
  BacktestLineageMeta,
  BacktestReviewJobMeta,
  BacktestSampleMeta,
  BacktestWindowMeta,
  StrategyExecutionContextSectionProps,
} from './StrategyExecutionContextSection.types'
import type { StrategyExecutionContextSectionProps } from './StrategyExecutionContextSection.types'

export default function StrategyExecutionContextSection(
  props: StrategyExecutionContextSectionProps,
) {
  return <StrategyExecutionContextSectionView {...buildStrategyExecutionContextSectionViewProps(props)} />
}

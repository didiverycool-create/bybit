import StrategyActivityTopOpsAuditActions from './StrategyActivityTopOpsAuditActions'
import StrategyActivityTopOpsNotes from './StrategyActivityTopOpsNotes'
import StrategyActivityTopOpsRecentActions from './StrategyActivityTopOpsRecentActions'
import type { StrategyActivityTopOpsSectionProps } from './strategyActivityTopOpsTypes'

export type { StrategyActivityTopOpsSectionProps } from './strategyActivityTopOpsTypes'

export default function StrategyActivityTopOpsSection(props: StrategyActivityTopOpsSectionProps) {
  return (
    <>
      <StrategyActivityTopOpsNotes {...props} />
      <StrategyActivityTopOpsRecentActions {...props} />
      <StrategyActivityTopOpsAuditActions {...props} />
    </>
  )
}

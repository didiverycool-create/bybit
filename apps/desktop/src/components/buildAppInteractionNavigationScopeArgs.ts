import type {
  AppInteractionNavigationArgs,
  BuildAppInteractionModelsArgsInput,
} from './buildAppInteractionModelsArgsShared'

export type BuildAppInteractionNavigationScopeArgs = Pick<
  AppInteractionNavigationArgs,
  | 'schedulerJobs'
  | 'setActiveSection'
  | 'setStrategyActivityPanelOpen'
  | 'setStrategyTrackingPanelOpen'
  | 'setAlertScopeFilter'
  | 'setTradeScopeFilter'
  | 'setAuditScopeFilter'
>

export function buildAppInteractionNavigationScopeArgs({
  scheduler,
  setActiveSection,
  setStrategyActivityPanelOpen,
  setStrategyTrackingPanelOpen,
  setAlertScopeFilter,
  setTradeScopeFilter,
  setAuditScopeFilter,
}: BuildAppInteractionModelsArgsInput): BuildAppInteractionNavigationScopeArgs {
  return {
    schedulerJobs: scheduler?.jobs ?? [],
    setActiveSection,
    setStrategyActivityPanelOpen,
    setStrategyTrackingPanelOpen,
    setAlertScopeFilter,
    setTradeScopeFilter,
    setAuditScopeFilter,
  }
}

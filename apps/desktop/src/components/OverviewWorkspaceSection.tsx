import type {
  AgentJob,
  ChangeRequest,
  ExecutionEvent,
  ExecutionHealthSummary,
  LayoutPreset,
  MarketDetail,
  MarketLiveDiagnostics,
  StrategySummary,
  WatchlistInstrument,
} from '../types'
import OverviewWorkspaceActivityStreamSection from './OverviewWorkspaceActivityStreamSection'
import OverviewWorkspaceHeroSection from './OverviewWorkspaceHeroSection'
import type { MarketTimeframe, TimeframeOption } from './overviewWorkspaceTypes'

type OverviewWorkspaceSectionProps = {
  layoutPreset: LayoutPreset
  selectedSymbol: string
  selectedStrategy: StrategySummary | null
  showStrategyWatch: boolean
  overviewWatchlistItems: WatchlistInstrument[]
  selectedMarketTimeframe: MarketTimeframe
  marketTimeframeOptions: TimeframeOption[]
  onSelectMarketSymbol: (symbol: string, latestPrice?: number | null) => void
  onSelectMarketTimeframe: (value: MarketTimeframe) => void
  marketRenderableDetail: MarketDetail | null
  marketDiagnostics: MarketLiveDiagnostics | null
  marketDetailLoading: boolean
  marketDetailErrorMessage: string | null
  marketLiveStatusMessage: string | null
  marketLiveStatusTitle: string
  snapshotExecutionHealth?: ExecutionHealthSummary | null
  marketDiagnosticsTitle: string
  marketDiagnosticsSummary: string
  schedulerJobs: AgentJob[]
  overviewAiEvents: ExecutionEvent[]
  overviewQueuedRequests: ChangeRequest[]
  onOpenReviewInspector: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenBacktestDetail: (backtestId?: string | null, strategyId?: string | null) => void
  onOpenSourceReview: (reviewId?: string | null, strategyId?: string | null) => void
  onOpenStrategyProposal: (proposalId?: string | null, strategyId?: string | null) => void
  onOpenStrategyActivity: (strategyId: string) => void
  onOpenAiSchedulerJob: (jobId: string) => void
}

export default function OverviewWorkspaceSection({
  layoutPreset,
  selectedSymbol,
  selectedStrategy,
  showStrategyWatch,
  overviewWatchlistItems,
  selectedMarketTimeframe,
  marketTimeframeOptions,
  onSelectMarketSymbol,
  onSelectMarketTimeframe,
  marketRenderableDetail,
  marketDiagnostics,
  marketDetailLoading,
  marketDetailErrorMessage,
  marketLiveStatusMessage,
  marketLiveStatusTitle,
  snapshotExecutionHealth,
  marketDiagnosticsTitle,
  marketDiagnosticsSummary,
  schedulerJobs,
  overviewAiEvents,
  overviewQueuedRequests,
  onOpenReviewInspector,
  onOpenBacktestDetail,
  onOpenSourceReview,
  onOpenStrategyProposal,
  onOpenStrategyActivity,
  onOpenAiSchedulerJob,
}: OverviewWorkspaceSectionProps) {
  return (
    <section className={`overview-studio overview-studio--${layoutPreset} section-entrance`}>
      <div className="overview-shell no-editor">
        <div className="overview-canvas">
          <OverviewWorkspaceHeroSection
            layoutPreset={layoutPreset}
            selectedSymbol={selectedSymbol}
            selectedStrategy={selectedStrategy}
            showStrategyWatch={showStrategyWatch}
            overviewWatchlistItems={overviewWatchlistItems}
            selectedMarketTimeframe={selectedMarketTimeframe}
            marketTimeframeOptions={marketTimeframeOptions}
            onSelectMarketSymbol={onSelectMarketSymbol}
            onSelectMarketTimeframe={onSelectMarketTimeframe}
            marketRenderableDetail={marketRenderableDetail}
            marketDiagnostics={marketDiagnostics}
            marketDetailLoading={marketDetailLoading}
            marketDetailErrorMessage={marketDetailErrorMessage}
            marketLiveStatusMessage={marketLiveStatusMessage}
            marketLiveStatusTitle={marketLiveStatusTitle}
            snapshotExecutionHealth={snapshotExecutionHealth}
            marketDiagnosticsTitle={marketDiagnosticsTitle}
            marketDiagnosticsSummary={marketDiagnosticsSummary}
          />
          <OverviewWorkspaceActivityStreamSection
            schedulerJobs={schedulerJobs}
            overviewAiEvents={overviewAiEvents}
            overviewQueuedRequests={overviewQueuedRequests}
            onOpenReviewInspector={onOpenReviewInspector}
            onOpenBacktestDetail={onOpenBacktestDetail}
            onOpenSourceReview={onOpenSourceReview}
            onOpenStrategyProposal={onOpenStrategyProposal}
            onOpenStrategyActivity={onOpenStrategyActivity}
            onOpenAiSchedulerJob={onOpenAiSchedulerJob}
          />
        </div>
      </div>
    </section>
  )
}

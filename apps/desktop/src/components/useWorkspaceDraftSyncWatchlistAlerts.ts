import { useEffect } from 'react'

type UseWorkspaceDraftSyncWatchlistAlertsArgs = {
  watchlist: Array<{ symbol: string; alert_threshold_pct: number }>
  watchlistAlertSignature: string
  setWatchlistAlertDrafts: (drafts: Record<string, string>) => void
}

export function useWorkspaceDraftSyncWatchlistAlerts({
  watchlist,
  watchlistAlertSignature,
  setWatchlistAlertDrafts,
}: UseWorkspaceDraftSyncWatchlistAlertsArgs) {
  useEffect(() => {
    setWatchlistAlertDrafts(
      Object.fromEntries(watchlist.map((item) => [item.symbol, item.alert_threshold_pct.toFixed(1)])),
    )
  }, [setWatchlistAlertDrafts, watchlist, watchlistAlertSignature])
}

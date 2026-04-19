import { useRef } from 'react'

export function useWorkspaceNotificationRefs() {
  const manualOrderSymbolRef = useRef<string | null>(null)
  const lastLoadedSettingsSignatureRef = useRef<string | null>(null)
  const desktopNotificationPermissionRequestedRef = useRef(false)
  const recentDesktopNotificationRef = useRef<Map<string, number>>(new Map())
  const seenAlertNotificationIdsRef = useRef<Set<string>>(new Set())
  const seenAgentJobStatusRef = useRef<Map<string, string>>(new Map())
  const seenOpsNotificationIdsRef = useRef<Set<string>>(new Set())
  const lastSchedulerStatusRef = useRef<string | null>(null)
  const notificationBootstrapRef = useRef({
    alerts: false,
    jobs: false,
    scheduler: false,
    ops: false,
  })

  return {
    manualOrderSymbolRef,
    lastLoadedSettingsSignatureRef,
    desktopNotificationPermissionRequestedRef,
    recentDesktopNotificationRef,
    seenAlertNotificationIdsRef,
    seenAgentJobStatusRef,
    seenOpsNotificationIdsRef,
    lastSchedulerStatusRef,
    notificationBootstrapRef,
  }
}

import { useCallback, useEffect, useState } from 'react'

import {
  NOTIFICATION_SNOOZE_CHANGE_EVENT,
  NOTIFICATION_SNOOZE_STORAGE_KEY,
  readNotificationSnoozeUntil,
  scheduleNotificationSnoozeMinutes,
  writeNotificationSnoozeUntil,
} from '../utils/app-helpers'

type UseNotificationSnoozeResult = {
  snoozeUntilMs: number | null
  activateSnoozeMinutes: (minutes: number) => void
  clearSnooze: () => void
}

const SNOOZE_TICK_INTERVAL_MS = 15000

export function useNotificationSnooze(): UseNotificationSnoozeResult {
  const [snoozeUntilMs, setSnoozeUntilMs] = useState<number | null>(() => readNotificationSnoozeUntil())

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const refresh = () => {
      setSnoozeUntilMs((current) => {
        const next = readNotificationSnoozeUntil()
        return next === current ? current : next
      })
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) {
        return
      }
      if (event.key != null && event.key !== NOTIFICATION_SNOOZE_STORAGE_KEY) {
        return
      }
      refresh()
    }

    const handleCustom = () => refresh()

    window.addEventListener('storage', handleStorage)
    window.addEventListener(NOTIFICATION_SNOOZE_CHANGE_EVENT, handleCustom as EventListener)
    const timer = window.setInterval(refresh, SNOOZE_TICK_INTERVAL_MS)
    refresh()

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(NOTIFICATION_SNOOZE_CHANGE_EVENT, handleCustom as EventListener)
      window.clearInterval(timer)
    }
  }, [])

  const activateSnoozeMinutes = useCallback((minutes: number) => {
    const next = scheduleNotificationSnoozeMinutes(minutes)
    setSnoozeUntilMs(next)
  }, [])

  const clearSnooze = useCallback(() => {
    writeNotificationSnoozeUntil(null)
    setSnoozeUntilMs(null)
  }, [])

  return {
    snoozeUntilMs,
    activateSnoozeMinutes,
    clearSnooze,
  }
}

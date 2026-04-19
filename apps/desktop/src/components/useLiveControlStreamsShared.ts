import { useEffect, useRef } from 'react'

import { CONTROL_API_BASE } from '../api'

export type LiveControlStreamPhase =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'error'
  | 'polling'

export type LiveControlStreamStatus = {
  phase: LiveControlStreamPhase
  hasEverConnected: boolean
  lastEventAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
}

const MAX_RECONNECT_ATTEMPTS = 5
const INITIAL_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const POLL_INTERVAL_MS = 15000

export function createIdleLiveControlStreamStatus(): LiveControlStreamStatus {
  return {
    phase: 'idle',
    hasEverConnected: false,
    lastEventAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
  }
}

type UseLiveControlStreamArgs<TPayload> = {
  enabled: boolean
  url: string
  parsePayload: (event: MessageEvent) => TPayload
  onPayload: (payload: TPayload) => void
  errorLabel: string
  onStatusChange?: (status: LiveControlStreamStatus) => void
}

function resolvePollPath(streamUrl: string): string | null {
  const [path, query] = streamUrl.split('?')
  const suffix = query ? `?${query}` : ''
  if (path.startsWith('/api/market/stream')) {
    return `/api/market/live${suffix}`
  }
  if (path.startsWith('/api/ai/stream')) {
    return `/api/ai/live${suffix}`
  }
  if (path.startsWith('/api/ops/stream')) {
    return `/api/ops/live${suffix}`
  }
  if (path.startsWith('/api/account/stream')) {
    return `/api/account/live${suffix}`
  }
  if (path.startsWith('/api/strategies/stream')) {
    const nextQuery = query
      ? new URLSearchParams(query)
      : new URLSearchParams()
    nextQuery.set('once', 'true')
    return `/api/strategies/stream?${nextQuery.toString()}`
  }
  return null
}

export function useLiveControlStream<TPayload>({
  enabled,
  url,
  parsePayload,
  onPayload,
  errorLabel,
  onStatusChange,
}: UseLiveControlStreamArgs<TPayload>) {
  const handlersRef = useRef({
    parsePayload,
    onPayload,
    errorLabel,
    onStatusChange,
  })
  const statusRef = useRef<LiveControlStreamStatus>(createIdleLiveControlStreamStatus())

  useEffect(() => {
    handlersRef.current = {
      parsePayload,
      onPayload,
      errorLabel,
      onStatusChange,
    }
  }, [errorLabel, onPayload, onStatusChange, parsePayload])

  useEffect(() => {
    const emitStatus = (status: LiveControlStreamStatus) => {
      statusRef.current = status
      handlersRef.current.onStatusChange?.(status)
    }

    if (!enabled || typeof EventSource === 'undefined') {
      emitStatus(createIdleLiveControlStreamStatus())
      return
    }

    let currentStream: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let pollTimer: ReturnType<typeof setInterval> | null = null
    let pollAbortController: AbortController | null = null
    let disposed = false
    let reconnectAttempts = 0

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
    }

    const clearPollTimer = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer)
        pollTimer = null
      }
      if (pollAbortController) {
        pollAbortController.abort()
        pollAbortController = null
      }
    }

    const detachStream = () => {
      if (!currentStream) {
        return
      }
      currentStream.removeEventListener('open', handleOpen as EventListener)
      currentStream.removeEventListener('snapshot', handleSnapshot as EventListener)
      currentStream.removeEventListener('error', handleError as EventListener)
      currentStream.close()
      currentStream = null
    }

    const startPolling = () => {
      if (pollTimer !== null || disposed) {
        return
      }
      const pollPath = resolvePollPath(url)
      if (!pollPath) {
        return
      }
      emitStatus({
        ...statusRef.current,
        phase: 'polling',
      })
      const runPoll = async () => {
        if (disposed) {
          return
        }
        pollAbortController?.abort()
        const controller = new AbortController()
        pollAbortController = controller
        try {
          const response = await fetch(`${CONTROL_API_BASE}${pollPath}`, {
            signal: controller.signal,
          })
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
          }
          const text = await response.text()
          if (disposed) {
            return
          }
          const {
            parsePayload: currentParsePayload,
            onPayload: currentOnPayload,
          } = handlersRef.current
          const syntheticEvent = { data: text } as MessageEvent
          currentOnPayload(currentParsePayload(syntheticEvent))
          emitStatus({
            ...statusRef.current,
            phase: 'polling',
            hasEverConnected: true,
            lastEventAt: new Date().toISOString(),
            lastErrorAt: null,
            lastErrorMessage: null,
          })
        } catch (error) {
          if (disposed) {
            return
          }
          if (error instanceof DOMException && error.name === 'AbortError') {
            return
          }
          const message = error instanceof Error ? error.message : String(error)
          console.warn(handlersRef.current.errorLabel, error)
          emitStatus({
            ...statusRef.current,
            phase: 'polling',
            lastErrorAt: new Date().toISOString(),
            lastErrorMessage: `poll-error:${message}`,
          })
        }
      }
      void runPoll()
      pollTimer = setInterval(() => {
        void runPoll()
      }, POLL_INTERVAL_MS)
    }

    const scheduleReconnect = () => {
      if (disposed) {
        return
      }
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        startPolling()
        return
      }
      const delay = Math.min(
        MAX_RECONNECT_DELAY_MS,
        INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
      )
      reconnectAttempts += 1
      clearReconnectTimer()
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        if (disposed) {
          return
        }
        connect()
      }, delay)
    }

    function handleOpen() {
      reconnectAttempts = 0
      emitStatus({
        ...statusRef.current,
        phase: 'open',
        hasEverConnected: true,
        lastErrorAt: null,
        lastErrorMessage: null,
      })
    }

    function handleSnapshot(event: MessageEvent) {
      try {
        const {
          parsePayload: currentParsePayload,
          onPayload: currentOnPayload,
        } = handlersRef.current
        currentOnPayload(currentParsePayload(event))
        reconnectAttempts = 0
        emitStatus({
          ...statusRef.current,
          phase: 'open',
          hasEverConnected: true,
          lastEventAt: new Date().toISOString(),
          lastErrorAt: null,
          lastErrorMessage: null,
        })
      } catch (error) {
        console.warn(handlersRef.current.errorLabel, error)
      }
    }

    function handleError() {
      emitStatus({
        ...statusRef.current,
        phase: 'error',
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: 'event-source-error',
      })
      detachStream()
      scheduleReconnect()
    }

    function connect() {
      if (disposed) {
        return
      }
      detachStream()
      emitStatus({
        ...statusRef.current,
        phase: 'connecting',
      })
      const stream = new EventSource(`${CONTROL_API_BASE}${url}`)
      currentStream = stream
      stream.addEventListener('open', handleOpen as EventListener)
      stream.addEventListener('snapshot', handleSnapshot as EventListener)
      stream.addEventListener('error', handleError as EventListener)
    }

    emitStatus({
      ...createIdleLiveControlStreamStatus(),
      phase: 'connecting',
    })
    connect()

    return () => {
      disposed = true
      clearReconnectTimer()
      clearPollTimer()
      detachStream()
    }
  }, [enabled, url])
}

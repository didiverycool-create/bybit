import { useEffect, useRef } from 'react'

import { CONTROL_API_BASE } from '../api'

export type LiveControlStreamPhase = 'idle' | 'connecting' | 'open' | 'error'

export type LiveControlStreamStatus = {
  phase: LiveControlStreamPhase
  hasEverConnected: boolean
  lastEventAt: string | null
  lastErrorAt: string | null
  lastErrorMessage: string | null
}

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

    emitStatus({
      ...createIdleLiveControlStreamStatus(),
      phase: 'connecting',
    })

    const stream = new EventSource(`${CONTROL_API_BASE}${url}`)

    const handleOpen = () => {
      emitStatus({
        ...statusRef.current,
        phase: 'open',
        hasEverConnected: true,
        lastErrorAt: null,
        lastErrorMessage: null,
      })
    }

    const handleSnapshot = (event: MessageEvent) => {
      try {
        const { parsePayload: currentParsePayload, onPayload: currentOnPayload } = handlersRef.current
        currentOnPayload(currentParsePayload(event))
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

    const handleError = () => {
      emitStatus({
        ...statusRef.current,
        phase: 'error',
        lastErrorAt: new Date().toISOString(),
        lastErrorMessage: 'event-source-error',
      })
    }

    stream.addEventListener('open', handleOpen as EventListener)
    stream.addEventListener('snapshot', handleSnapshot as EventListener)
    stream.addEventListener('error', handleError as EventListener)

    return () => {
      stream.removeEventListener('open', handleOpen as EventListener)
      stream.removeEventListener('snapshot', handleSnapshot as EventListener)
      stream.removeEventListener('error', handleError as EventListener)
      stream.close()
    }
  }, [enabled, url])
}

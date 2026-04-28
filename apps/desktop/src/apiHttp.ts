import type { ServiceHealth } from './types'

const API_BASE =
  (import.meta.env.VITE_CONTROL_API_BASE as string | undefined) ?? 'http://127.0.0.1:8787'

export const CONTROL_API_BASE = API_BASE

let pageUnloading = false
let pendingBeforeUnloadReset: number | null = null

function resetPageUnloading() {
  pageUnloading = false
  if (pendingBeforeUnloadReset !== null && typeof window !== 'undefined') {
    window.clearTimeout(pendingBeforeUnloadReset)
  }
  pendingBeforeUnloadReset = null
}

function markPageUnloadingPending() {
  if (typeof window === 'undefined') {
    return
  }
  pageUnloading = true
  if (pendingBeforeUnloadReset !== null) {
    window.clearTimeout(pendingBeforeUnloadReset)
  }
  // `beforeunload` may fire even when the page ultimately stays put.
  pendingBeforeUnloadReset = window.setTimeout(() => {
    pendingBeforeUnloadReset = null
    pageUnloading = false
  }, 0)
}

function commitPageUnloading() {
  if (typeof window !== 'undefined' && pendingBeforeUnloadReset !== null) {
    window.clearTimeout(pendingBeforeUnloadReset)
  }
  pendingBeforeUnloadReset = null
  pageUnloading = true
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    markPageUnloadingPending()
  })
  window.addEventListener('pagehide', () => {
    commitPageUnloading()
  })
  window.addEventListener('pageshow', () => {
    resetPageUnloading()
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      resetPageUnloading()
    }
  })
}

function shouldSuppressTransientFallback(error: unknown): boolean {
  if (!pageUnloading) {
    return false
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return true
  }
  const message = error instanceof Error ? error.message : String(error)
  return /failed to fetch/i.test(message)
}

export async function fetchJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${path}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    if (!shouldSuppressTransientFallback(error)) {
      console.warn(`使用本地 fallback: ${path}`, error)
    }
    return fallback
  }
}

export async function fetchJsonStrict<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`)
  if (!response.ok) {
    const text = await response.text()
    let detail = text || `HTTP ${response.status}`
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      if (typeof parsed.detail === 'string' && parsed.detail.trim()) {
        detail = parsed.detail.trim()
      }
    } catch {
      // keep raw text fallback
    }
    throw new Error(detail)
  }
  return (await response.json()) as T
}

export async function fetchText(path: string, fallback: string): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}${path}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    return await response.text()
  } catch (error) {
    if (!shouldSuppressTransientFallback(error)) {
      console.warn(`使用本地 fallback 文本: ${path}`, error)
    }
    return fallback
  }
}

export async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      throw new Error(parsed.detail || text || `HTTP ${response.status}`)
    } catch {
      throw new Error(text || `HTTP ${response.status}`)
    }
  }

  return (await response.json()) as T
}

export async function deleteJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'DELETE',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as { detail?: string }
      throw new Error(parsed.detail || text || `HTTP ${response.status}`)
    } catch {
      throw new Error(text || `HTTP ${response.status}`)
    }
  }

  return (await response.json()) as T
}

export async function getServiceHealth(): Promise<ServiceHealth> {
  const response = await fetch(`${API_BASE}/health`)
  if (!response.ok) {
    throw new Error(`本地服务不可用: ${response.status}`)
  }
  return (await response.json()) as ServiceHealth
}

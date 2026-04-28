export {}

declare global {
  interface Window {
    bybitApp?: {
      version: string
      isElectron?: boolean
      notify?: (payload: {
        title?: string
        body?: string
        urgency?: 'normal' | 'critical'
        silent?: boolean
      }) => Promise<boolean>
      openPath?: (payload: {
        path?: string
        revealInFolder?: boolean
      }) => Promise<{
        ok: boolean
        path?: string
        message?: string
      }>
    }
  }
}

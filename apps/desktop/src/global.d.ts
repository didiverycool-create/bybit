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
    }
  }
}

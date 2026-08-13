import type { App } from './index.js'

export interface GracefulShutdownOptions {
  signals?: NodeJS.Signals[]
  drainTimeoutMs?: number
  closeTimeoutMs?: number
  exitProcess?: boolean
  onShutdownStart?: () => void
  onShutdownComplete?: () => void
}

const DEFAULT_SIGNALS: NodeJS.Signals[] = ['SIGTERM', 'SIGINT']
const DEFAULT_DRAIN_TIMEOUT_MS = 10_000
const DEFAULT_CLOSE_TIMEOUT_MS = 10_000

async function withTimeout(promise: Promise<void>, timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  await Promise.race([promise, timeoutPromise])
  clearTimeout(timer!)
}

export function gracefulShutdown(app: App, options: GracefulShutdownOptions = {}): () => Promise<void> {
  const signals = options.signals ?? DEFAULT_SIGNALS
  const drainTimeoutMs = options.drainTimeoutMs ?? DEFAULT_DRAIN_TIMEOUT_MS
  const closeTimeoutMs = options.closeTimeoutMs ?? DEFAULT_CLOSE_TIMEOUT_MS
  const exitProcess = options.exitProcess ?? true

  let shuttingDown = false

  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true

    options.onShutdownStart?.()
    app.drain()
    await app.waitForInFlight(drainTimeoutMs)
    await withTimeout(app.close(), closeTimeoutMs)
    options.onShutdownComplete?.()

    if (exitProcess) process.exit(0)
  }

  for (const signal of signals) {
    process.on(signal, () => {
      void shutdown()
    })
  }

  return shutdown
}

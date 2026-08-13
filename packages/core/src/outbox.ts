export interface OutboxEntry {
  id: string
  topic: string
  message: unknown
  createdAt: Date
}

export interface OutboxStore {
  save(entry: { topic: string; message: unknown }, tx?: unknown): Promise<void>
  listPending(limit: number): Promise<OutboxEntry[]>
  markPublished(id: string): Promise<void>
}

export interface OutboxRelayOptions {
  intervalMs?: number
  batchSize?: number
}

const DEFAULT_RELAY_INTERVAL_MS = 2000
const DEFAULT_RELAY_BATCH_SIZE = 20

export function startOutboxRelay(
  store: OutboxStore,
  publish: (topic: string, message: unknown) => Promise<void>,
  options: OutboxRelayOptions = {},
): () => void {
  const intervalMs = options.intervalMs ?? DEFAULT_RELAY_INTERVAL_MS
  const batchSize = options.batchSize ?? DEFAULT_RELAY_BATCH_SIZE
  let stopped = false
  let timer: ReturnType<typeof setTimeout>

  async function tick(): Promise<void> {
    if (stopped) return
    try {
      const pending = await store.listPending(batchSize)
      for (const entry of pending) {
        await publish(entry.topic, entry.message)
        await store.markPublished(entry.id)
      }
    } catch {}
    if (!stopped) timer = setTimeout(tick, intervalMs)
  }

  timer = setTimeout(tick, intervalMs)

  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

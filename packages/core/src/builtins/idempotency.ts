import type { Context, Middleware } from '../types.js'

export interface IdempotencyRecord {
  status: number
  headers: Record<string, string>
  body: unknown
}

export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyRecord | null>
  set(key: string, record: IdempotencyRecord, ttlMs: number): Promise<void>
}

export function memoryIdempotencyStore(): IdempotencyStore {
  const records = new Map<string, { record: IdempotencyRecord; expiresAt: number }>()

  return {
    async get(key) {
      const entry = records.get(key)
      if (!entry) return null
      if (entry.expiresAt < Date.now()) {
        records.delete(key)
        return null
      }
      return entry.record
    },
    async set(key, record, ttlMs) {
      records.set(key, { record, expiresAt: Date.now() + ttlMs })
    },
  }
}

export interface IdempotencyOptions {
  header?: string
  ttlMs?: number
  store?: IdempotencyStore
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

function extractKey(ctx: Context, header: string): string | undefined {
  const value = ctx.headers[header]
  return Array.isArray(value) ? value[0] : value
}

export function idempotency(options: IdempotencyOptions = {}): Middleware {
  const header = options.header ?? 'idempotency-key'
  const ttlMs = options.ttlMs ?? DEFAULT_IDEMPOTENCY_TTL_MS
  const store = options.store ?? memoryIdempotencyStore()

  return async (ctx, next) => {
    const key = extractKey(ctx, header)
    if (!key) {
      await next()
      return
    }

    const cached = await store.get(key)
    if (cached) {
      ctx.response.status = cached.status
      ctx.response.headers = { ...cached.headers, 'idempotency-replayed': 'true' }
      ctx.response.body = cached.body
      return
    }

    await next()
    await store.set(key, { status: ctx.response.status, headers: ctx.response.headers, body: ctx.response.body }, ttlMs)
  }
}

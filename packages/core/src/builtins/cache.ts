import type { Context, Middleware } from '../types.js'

export interface CacheRecord {
  status: number
  headers: Record<string, string>
  body: unknown
}

export interface CacheStore {
  get(key: string): Promise<CacheRecord | null>
  set(key: string, record: CacheRecord, ttlMs: number): Promise<void>
}

export function memoryCacheStore(): CacheStore {
  const records = new Map<string, { record: CacheRecord; expiresAt: number }>()

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

export interface CacheOptions {
  ttlMs?: number
  keyGenerator?: (ctx: Context) => string
  store?: CacheStore
}

const DEFAULT_CACHE_TTL_MS = 60_000

function defaultKeyGenerator(ctx: Context): string {
  return `${ctx.method}:${ctx.path}:${JSON.stringify(ctx.query ?? {})}`
}

export function cache(options: CacheOptions = {}): Middleware {
  const ttlMs = options.ttlMs ?? DEFAULT_CACHE_TTL_MS
  const store = options.store ?? memoryCacheStore()
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator

  return async (ctx, next) => {
    if (ctx.method !== 'GET') {
      await next()
      return
    }

    const key = keyGenerator(ctx)
    const cached = await store.get(key)
    if (cached) {
      ctx.response.status = cached.status
      ctx.response.headers = { ...cached.headers, 'x-cache': 'HIT' }
      ctx.response.body = cached.body
      return
    }

    await next()
    ctx.response.headers['x-cache'] = 'MISS'
    if (ctx.response.status < 400) {
      await store.set(key, { status: ctx.response.status, headers: ctx.response.headers, body: ctx.response.body }, ttlMs)
    }
  }
}

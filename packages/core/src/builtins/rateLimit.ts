import { TooManyRequests } from '../errors.js'
import type { Context, Middleware } from '../types.js'
import { parseDurationMs } from './duration.js'

export interface RateLimitRecord {
  count: number
  resetAt: number
}

export interface RateLimitStore {
  increment(key: string): Promise<RateLimitRecord>
}

export function memoryRateLimitStore(windowMs: number): RateLimitStore {
  const hits = new Map<string, RateLimitRecord>()

  return {
    async increment(key) {
      const now = Date.now()
      const existing = hits.get(key)
      if (!existing || existing.resetAt <= now) {
        const record: RateLimitRecord = { count: 1, resetAt: now + windowMs }
        hits.set(key, record)
        return record
      }
      existing.count += 1
      return existing
    },
  }
}

export interface RateLimitOptions {
  window: string
  max: number
  keyGenerator?: (ctx: Context) => string
  store?: RateLimitStore
}

function defaultKeyGenerator(ctx: Context): string {
  const req = ctx.raw.req as { ip?: string; socket?: { remoteAddress?: string } } | null
  return req?.ip ?? req?.socket?.remoteAddress ?? 'unknown'
}

export function rateLimit(options: RateLimitOptions): Middleware {
  const windowMs = parseDurationMs(options.window)
  const store = options.store ?? memoryRateLimitStore(windowMs)
  const keyGenerator = options.keyGenerator ?? defaultKeyGenerator

  return async (ctx, next) => {
    const key = keyGenerator(ctx)
    const record = await store.increment(key)

    ctx.response.headers['x-ratelimit-limit'] = String(options.max)
    ctx.response.headers['x-ratelimit-remaining'] = String(Math.max(0, options.max - record.count))
    ctx.response.headers['x-ratelimit-reset'] = String(Math.ceil(record.resetAt / 1000))

    if (record.count > options.max) {
      throw new TooManyRequests('Rate limit exceeded', { limit: options.max, window: options.window })
    }

    await next()
  }
}

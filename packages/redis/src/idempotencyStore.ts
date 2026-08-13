import type { IdempotencyRecord, IdempotencyStore } from 'api-kickstart/middleware'
import { resolveClient, resolveKeyPrefix, type RedisStoreOptions } from './client.js'

export function redisIdempotencyStore(options: RedisStoreOptions = {}): IdempotencyStore {
  const redis = resolveClient(options)
  const prefix = resolveKeyPrefix(options)

  return {
    async get(key): Promise<IdempotencyRecord | null> {
      const raw = await redis.get(`${prefix}idempotency:${key}`)
      return raw ? (JSON.parse(raw) as IdempotencyRecord) : null
    },
    async set(key, record, ttlMs): Promise<void> {
      await redis.set(`${prefix}idempotency:${key}`, JSON.stringify(record), 'PX', ttlMs)
    },
  }
}

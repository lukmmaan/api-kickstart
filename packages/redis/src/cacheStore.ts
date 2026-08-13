import type { CacheRecord, CacheStore } from 'api-kickstart/middleware'
import { resolveClient, resolveKeyPrefix, type RedisStoreOptions } from './client.js'

export function redisCacheStore(options: RedisStoreOptions = {}): CacheStore {
  const redis = resolveClient(options)
  const prefix = resolveKeyPrefix(options)

  return {
    async get(key): Promise<CacheRecord | null> {
      const raw = await redis.get(`${prefix}cache:${key}`)
      return raw ? (JSON.parse(raw) as CacheRecord) : null
    },
    async set(key, record, ttlMs): Promise<void> {
      await redis.set(`${prefix}cache:${key}`, JSON.stringify(record), 'PX', ttlMs)
    },
  }
}

import type { SessionRecord, SessionStore } from 'api-kickstart/auth'
import { resolveClient, resolveKeyPrefix, type RedisStoreOptions } from './client.js'

export function redisSessionStore(options: RedisStoreOptions = {}): SessionStore {
  const redis = resolveClient(options)
  const prefix = resolveKeyPrefix(options)

  return {
    async get(sid): Promise<SessionRecord | null> {
      const raw = await redis.get(`${prefix}session:${sid}`)
      return raw ? (JSON.parse(raw) as SessionRecord) : null
    },
    async set(sid, record): Promise<void> {
      const ttlMs = record.expiresAt - Date.now()
      const key = `${prefix}session:${sid}`
      if (ttlMs <= 0) {
        await redis.del(key)
        return
      }
      await redis.set(key, JSON.stringify(record), 'PX', ttlMs)
    },
    async destroy(sid): Promise<void> {
      await redis.del(`${prefix}session:${sid}`)
    },
  }
}

import { randomUUID } from 'node:crypto'
import type { Lock } from '../../index.js'
import { resolveClient, resolveKeyPrefix, type RedisStoreOptions } from './client.js'

const RELEASE_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
else
  return 0
end
`

export function redisLock(options: RedisStoreOptions = {}): Lock {
  const redis = resolveClient(options)
  const prefix = resolveKeyPrefix(options)
  const tokens = new Map<string, string>()

  return {
    async acquire(key, ttlMs): Promise<boolean> {
      const redisKey = `${prefix}lock:${key}`
      const token = randomUUID()
      const result = await redis.set(redisKey, token, 'PX', ttlMs, 'NX')
      if (result === 'OK') {
        tokens.set(key, token)
        return true
      }
      return false
    },

    async release(key): Promise<void> {
      const token = tokens.get(key)
      if (!token) return
      const redisKey = `${prefix}lock:${key}`
      await redis.eval(RELEASE_SCRIPT, 1, redisKey, token)
      tokens.delete(key)
    },
  }
}

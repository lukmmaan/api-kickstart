import { parseDurationMs, type RateLimitRecord, type RateLimitStore } from '../../builtins/index.js'
import { resolveClient, resolveKeyPrefix, type RedisStoreOptions } from './client.js'

export function redisRateLimitStore(window: string, options: RedisStoreOptions = {}): RateLimitStore {
  const redis = resolveClient(options)
  const prefix = resolveKeyPrefix(options)
  const windowMs = parseDurationMs(window)

  return {
    async increment(key): Promise<RateLimitRecord> {
      const redisKey = `${prefix}ratelimit:${key}`
      const count = await redis.incr(redisKey)
      if (count === 1) {
        await redis.pexpire(redisKey, windowMs)
      }
      const pttl = await redis.pttl(redisKey)
      const resetAt = Date.now() + (pttl > 0 ? pttl : windowMs)
      return { count, resetAt }
    },
  }
}

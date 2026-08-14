import { Redis } from 'ioredis'
import { DEFAULT_KEY_PREFIX, DEFAULT_REDIS_URL } from './constants.js'

export interface RedisStoreOptions {
  url?: string
  redis?: Redis
  keyPrefix?: string
}

export function resolveClient(options: RedisStoreOptions): Redis {
  return options.redis ?? new Redis(options.url ?? DEFAULT_REDIS_URL)
}

export function resolveKeyPrefix(options: RedisStoreOptions): string {
  return options.keyPrefix ?? DEFAULT_KEY_PREFIX
}

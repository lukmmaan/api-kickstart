import { randomUUID } from 'node:crypto'
import type { Lock } from '../../index.js'

interface HeldLock {
  token: string
  expiresAt: number
}

const store = new Map<string, HeldLock>()

/**
 * In-process lock backed by a module-level Map, shared by every memoryLock()
 * call in this process — no external dependency. Only coordinates a single
 * process; use redisLock/pgLock/knexLock/mongodbLock across multiple processes.
 */
export function memoryLock(): Lock {
  const myTokens = new Map<string, string>()

  return {
    async acquire(key, ttlMs): Promise<boolean> {
      const now = Date.now()
      const existing = store.get(key)
      if (existing && existing.expiresAt > now) return false

      const token = randomUUID()
      store.set(key, { token, expiresAt: now + ttlMs })
      myTokens.set(key, token)
      return true
    },

    async release(key): Promise<void> {
      const token = myTokens.get(key)
      if (!token) return
      const current = store.get(key)
      if (current?.token === token) store.delete(key)
      myTokens.delete(key)
    },
  }
}

import { randomUUID } from 'node:crypto'
import type { Db } from 'mongodb'
import type { Lock } from '../../index.js'

export interface MongodbLockOptions {
  collectionName?: string
}

interface LockDocument {
  _id: string
  token: string
  expiresAt: Date
}

const DEFAULT_LOCK_COLLECTION = '_api_kickstart_locks'
const DUPLICATE_KEY = 11000

export function mongodbLock(db: Db, options: MongodbLockOptions = {}): Lock {
  const collectionName = options.collectionName ?? DEFAULT_LOCK_COLLECTION
  const collection = db.collection<LockDocument>(collectionName)
  const tokens = new Map<string, string>()

  return {
    async acquire(key, ttlMs): Promise<boolean> {
      const token = randomUUID()
      const expiresAt = new Date(Date.now() + ttlMs)

      try {
        await collection.findOneAndUpdate(
          { _id: key, expiresAt: { $lte: new Date() } },
          { $set: { token, expiresAt } },
          { upsert: true },
        )
        tokens.set(key, token)
        return true
      } catch (err) {
        if ((err as { code?: number }).code === DUPLICATE_KEY) return false
        throw err
      }
    },

    async release(key): Promise<void> {
      const token = tokens.get(key)
      if (!token) return
      await collection.deleteOne({ _id: key, token })
      tokens.delete(key)
    },
  }
}

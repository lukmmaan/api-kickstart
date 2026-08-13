import type { ClientSession, MongoClient } from 'mongodb'
import type { DbAdapter, ScopeFilter } from 'api-kickstart'
import { normalizeMongoError } from './errors.js'

export interface MongodbOptions {
  dbName?: string
}

export function mongodb(client: MongoClient, options: MongodbOptions = {}): DbAdapter {
  const db = client.db(options.dbName)

  return {
    client: db,

    translateScope(filter: ScopeFilter): ScopeFilter {
      return filter
    },

    normalizeError: normalizeMongoError,

    async transaction<T>(fn: (tx: ClientSession) => Promise<T>): Promise<T> {
      const session = client.startSession()
      try {
        let result: T | undefined
        await session.withTransaction(async () => {
          result = await fn(session)
        })
        return result as T
      } finally {
        await session.endSession()
      }
    },

    async healthcheck() {
      try {
        await db.command({ ping: 1 })
        return true
      } catch {
        return false
      }
    },

    async close() {
      await client.close()
    },
  }
}

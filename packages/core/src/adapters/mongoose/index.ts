import type { Connection } from 'mongoose'
import type { DbAdapter, ScopeFilter } from '../../index.js'
import { normalizeMongooseError } from './errors.js'

export function mongoose(connection: Connection): DbAdapter {
  return {
    client: connection,

    translateScope(filter: ScopeFilter): ScopeFilter {
      return filter
    },

    normalizeError: normalizeMongooseError,

    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      const session = await connection.startSession()
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
      return connection.readyState === 1
    },

    async close() {
      await connection.close()
    },
  }
}

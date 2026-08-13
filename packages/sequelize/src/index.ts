import type { Sequelize, Transaction } from 'sequelize'
import type { DbAdapter, ScopeFilter } from 'api-kickstart'
import { normalizeSequelizeError } from './errors.js'

export function sequelize(client: Sequelize): DbAdapter {
  return {
    client,

    translateScope(filter: ScopeFilter): ScopeFilter {
      return filter
    },

    normalizeError: normalizeSequelizeError,

    async transaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
      return client.transaction(fn)
    },

    async healthcheck() {
      try {
        await client.authenticate()
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

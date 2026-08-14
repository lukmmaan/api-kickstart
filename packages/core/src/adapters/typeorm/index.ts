import type { DataSource, EntityManager } from 'typeorm'
import type { DbAdapter, ScopeFilter } from '../../index.js'
import { normalizeTypeOrmError } from './errors.js'

export function typeorm(dataSource: DataSource): DbAdapter {
  return {
    client: dataSource,

    translateScope(filter: ScopeFilter): ScopeFilter {
      return filter
    },

    normalizeError: normalizeTypeOrmError,

    async transaction<T>(fn: (tx: EntityManager) => Promise<T>): Promise<T> {
      return dataSource.transaction(fn)
    },

    async healthcheck() {
      try {
        await dataSource.query('SELECT 1')
        return true
      } catch {
        return false
      }
    },

    async close() {
      await dataSource.destroy()
    },
  }
}

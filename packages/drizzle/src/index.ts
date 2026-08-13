import type { DbAdapter, ScopeFilter } from 'api-kickstart'
import { normalizeDrizzleError } from './errors.js'
import { scopeToWhere } from './where.js'

export { scopeToWhere }

export interface DrizzleLikeDb {
  transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>
}

export function drizzle(client: DrizzleLikeDb): DbAdapter {
  return {
    client,

    translateScope(filter: ScopeFilter): ScopeFilter {
      return filter
    },

    normalizeError: normalizeDrizzleError,

    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return client.transaction(fn)
    },
  }
}

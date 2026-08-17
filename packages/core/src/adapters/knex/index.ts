import type { Knex } from 'knex'
import type { DbAdapter, ScopeFilter } from '../../index.js'
import { normalizeKnexError } from './errors.js'

export { knexOutboxStore, type KnexOutboxStoreOptions } from './outbox.js'
export { knexLock, type KnexLockOptions } from './lock.js'
export { knexTranslationStore, type KnexTranslationStoreOptions } from './i18n.js'

export function knex(client: Knex): DbAdapter {
  return {
    client,

    translateScope(filter: ScopeFilter): ScopeFilter {
      return filter
    },

    normalizeError: normalizeKnexError,

    async transaction<T>(fn: (tx: Knex.Transaction) => Promise<T>): Promise<T> {
      return client.transaction(fn)
    },

    async healthcheck() {
      try {
        await client.raw('select 1')
        return true
      } catch {
        return false
      }
    },

    async close() {
      await client.destroy()
    },
  }
}

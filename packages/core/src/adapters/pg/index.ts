import { Pool, type PoolClient, type PoolConfig } from 'pg'
import type { DbAdapter } from '../../index.js'
import { normalizePgError } from './errors.js'
import { pgLock, type PgLockOptions } from './lock.js'
import { pgOutboxStore, type PgOutboxStoreOptions } from './outbox.js'
import { translateScope, type PgScopeQuery } from './scope.js'

export type { PgScopeQuery }
export { pgOutboxStore, type PgOutboxStoreOptions }
export { pgLock, type PgLockOptions }
export { pgTranslationStore, type PgTranslationStoreOptions } from './i18n.js'

export function pg(configOrPool: PoolConfig | Pool): DbAdapter {
  const pool = configOrPool instanceof Pool ? configOrPool : new Pool(configOrPool)

  return {
    client: pool,

    translateScope,

    normalizeError: normalizePgError,

    async transaction<T>(fn: (tx: PoolClient) => Promise<T>): Promise<T> {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const result = await fn(client)
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    },

    async healthcheck() {
      try {
        await pool.query('SELECT 1')
        return true
      } catch {
        return false
      }
    },

    async close() {
      await pool.end()
    },
  }
}

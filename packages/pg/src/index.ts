import { Pool, type PoolClient, type PoolConfig } from 'pg'
import { BadRequest, Conflict } from 'api-kickstart/errors'
import type { DbAdapter, ScopeFilter } from 'api-kickstart'

export interface PgScopeQuery {
  where: string
  values: unknown[]
}

function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`
}

export function pg(configOrPool: PoolConfig | Pool): DbAdapter {
  const pool = configOrPool instanceof Pool ? configOrPool : new Pool(configOrPool)

  return {
    client: pool,

    translateScope(filter: ScopeFilter): PgScopeQuery {
      const keys = Object.keys(filter)
      if (keys.length === 0) return { where: 'true', values: [] }
      const clauses: string[] = []
      const values: unknown[] = []
      keys.forEach((key, i) => {
        clauses.push(`${quoteIdent(key)} = $${i + 1}`)
        values.push(filter[key])
      })
      return { where: clauses.join(' AND '), values }
    },

    normalizeError(err) {
      if (!(err instanceof Error)) return null
      const code = (err as Error & { code?: string }).code
      if (code === '23505') return new Conflict('Unique constraint violation', { code })
      if (code === '23503') return new BadRequest('Foreign key constraint violation', { code })
      if (code === '23502') return new BadRequest('Not-null constraint violation', { code })
      return null
    },

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

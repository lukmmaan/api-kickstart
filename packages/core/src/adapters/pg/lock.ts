import { randomUUID } from 'node:crypto'
import type { Pool } from 'pg'
import type { Lock } from '../../index.js'

export interface PgLockOptions {
  tableName?: string
  ensureTable?: boolean
}

const DEFAULT_LOCK_TABLE = '_api_kickstart_locks'
const UNIQUE_VIOLATION = '23505'

export function pgLock(pool: Pool, options: PgLockOptions = {}): Lock {
  const tableName = options.tableName ?? DEFAULT_LOCK_TABLE
  const shouldEnsureTable = options.ensureTable ?? true
  const tokens = new Map<string, string>()
  let ensured = false

  async function ensureTable(): Promise<void> {
    if (ensured || !shouldEnsureTable) return
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        key TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `)
    ensured = true
  }

  return {
    async acquire(key, ttlMs): Promise<boolean> {
      await ensureTable()
      const token = randomUUID()
      const expiresAt = new Date(Date.now() + ttlMs)

      const stolen = await pool.query(
        `UPDATE ${tableName} SET token = $1, expires_at = $2 WHERE key = $3 AND expires_at <= now()`,
        [token, expiresAt, key],
      )
      if ((stolen.rowCount ?? 0) > 0) {
        tokens.set(key, token)
        return true
      }

      try {
        await pool.query(`INSERT INTO ${tableName} (key, token, expires_at) VALUES ($1, $2, $3)`, [key, token, expiresAt])
        tokens.set(key, token)
        return true
      } catch (err) {
        if ((err as { code?: string }).code === UNIQUE_VIOLATION) return false
        throw err
      }
    },

    async release(key): Promise<void> {
      const token = tokens.get(key)
      if (!token) return
      await pool.query(`DELETE FROM ${tableName} WHERE key = $1 AND token = $2`, [key, token])
      tokens.delete(key)
    },
  }
}

import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import type { Lock } from '../../index.js'

export interface KnexLockOptions {
  tableName?: string
  ensureTable?: boolean
}

const DEFAULT_LOCK_TABLE = '_api_kickstart_locks'

export function knexLock(client: Knex, options: KnexLockOptions = {}): Lock {
  const tableName = options.tableName ?? DEFAULT_LOCK_TABLE
  const shouldEnsureTable = options.ensureTable ?? true
  const tokens = new Map<string, string>()
  let ensured = false

  async function ensureTable(): Promise<void> {
    if (ensured || !shouldEnsureTable) return
    const exists = await client.schema.hasTable(tableName)
    if (!exists) {
      await client.schema.createTable(tableName, (table) => {
        table.string('key').primary()
        table.string('token').notNullable()
        table.timestamp('expires_at').notNullable()
      })
    }
    ensured = true
  }

  return {
    async acquire(key, ttlMs): Promise<boolean> {
      await ensureTable()
      const token = randomUUID()
      const expiresAt = new Date(Date.now() + ttlMs)

      const stolen = await client(tableName)
        .where({ key })
        .andWhere('expires_at', '<=', new Date())
        .update({ token, expires_at: expiresAt })
      if (stolen > 0) {
        tokens.set(key, token)
        return true
      }

      try {
        await client(tableName).insert({ key, token, expires_at: expiresAt })
        tokens.set(key, token)
        return true
      } catch {
        return false
      }
    },

    async release(key): Promise<void> {
      const token = tokens.get(key)
      if (!token) return
      await client(tableName).where({ key, token }).delete()
      tokens.delete(key)
    },
  }
}

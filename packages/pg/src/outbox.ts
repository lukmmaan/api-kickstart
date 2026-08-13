import { randomUUID } from 'node:crypto'
import type { Pool, PoolClient } from 'pg'
import type { OutboxEntry, OutboxStore } from 'api-kickstart'

export interface PgOutboxStoreOptions {
  tableName?: string
  ensureTable?: boolean
}

const DEFAULT_OUTBOX_TABLE = '_api_kickstart_outbox'

export function pgOutboxStore(pool: Pool, options: PgOutboxStoreOptions = {}): OutboxStore {
  const tableName = options.tableName ?? DEFAULT_OUTBOX_TABLE
  const shouldEnsureTable = options.ensureTable ?? true
  let ensured = false

  async function ensureTable(executor: Pool | PoolClient): Promise<void> {
    if (ensured || !shouldEnsureTable) return
    await executor.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id UUID PRIMARY KEY,
        topic TEXT NOT NULL,
        message JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        published_at TIMESTAMPTZ
      )
    `)
    ensured = true
  }

  return {
    async save(entry, tx) {
      const executor = (tx as PoolClient | undefined) ?? pool
      await ensureTable(executor)
      await executor.query(`INSERT INTO ${tableName} (id, topic, message) VALUES ($1, $2, $3)`, [
        randomUUID(),
        entry.topic,
        JSON.stringify(entry.message),
      ])
    },

    async listPending(limit): Promise<OutboxEntry[]> {
      await ensureTable(pool)
      const result = await pool.query(
        `SELECT id, topic, message, created_at FROM ${tableName} WHERE published_at IS NULL ORDER BY created_at ASC LIMIT $1`,
        [limit],
      )
      return result.rows.map((row) => ({
        id: row.id as string,
        topic: row.topic as string,
        message: row.message,
        createdAt: row.created_at as Date,
      }))
    },

    async markPublished(id) {
      await pool.query(`UPDATE ${tableName} SET published_at = now() WHERE id = $1`, [id])
    },
  }
}

import { randomUUID } from 'node:crypto'
import type { Knex } from 'knex'
import type { OutboxEntry, OutboxStore } from 'api-kickstart'

export interface KnexOutboxStoreOptions {
  tableName?: string
  ensureTable?: boolean
}

const DEFAULT_OUTBOX_TABLE = '_api_kickstart_outbox'

function parseMessage(value: unknown): unknown {
  return typeof value === 'string' ? JSON.parse(value) : value
}

export function knexOutboxStore(client: Knex, options: KnexOutboxStoreOptions = {}): OutboxStore {
  const tableName = options.tableName ?? DEFAULT_OUTBOX_TABLE
  const shouldEnsureTable = options.ensureTable ?? true
  let ensured = false

  async function ensureTable(executor: Knex | Knex.Transaction): Promise<void> {
    if (ensured || !shouldEnsureTable) return
    const exists = await executor.schema.hasTable(tableName)
    if (!exists) {
      await executor.schema.createTable(tableName, (table) => {
        table.uuid('id').primary()
        table.string('topic').notNullable()
        table.json('message').notNullable()
        table.timestamp('created_at').notNullable().defaultTo(executor.fn.now())
        table.timestamp('published_at').nullable()
      })
    }
    ensured = true
  }

  return {
    async save(entry, tx) {
      const executor = (tx as Knex.Transaction | undefined) ?? client
      await ensureTable(executor)
      await executor(tableName).insert({
        id: randomUUID(),
        topic: entry.topic,
        message: JSON.stringify(entry.message),
      })
    },

    async listPending(limit): Promise<OutboxEntry[]> {
      await ensureTable(client)
      const rows = await client(tableName)
        .whereNull('published_at')
        .orderBy('created_at', 'asc')
        .limit(limit)
        .select('id', 'topic', 'message', 'created_at')

      return rows.map((row) => ({
        id: String(row.id),
        topic: String(row.topic),
        message: parseMessage(row.message),
        createdAt: new Date(row.created_at as string),
      }))
    },

    async markPublished(id) {
      await client(tableName).where({ id }).update({ published_at: client.fn.now() })
    },
  }
}

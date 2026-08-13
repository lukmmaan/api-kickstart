import Knex from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { knexOutboxStore } from './outbox.js'

let client: ReturnType<typeof Knex>

beforeEach(() => {
  client = Knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
})

afterEach(async () => {
  await client.destroy()
})

describe('knexOutboxStore', () => {
  it('creates the table lazily and saves an entry as pending', async () => {
    const store = knexOutboxStore(client)
    await store.save({ topic: 'order.created', message: { id: 1 } })

    const pending = await store.listPending(10)
    expect(pending).toHaveLength(1)
    expect(pending[0].topic).toBe('order.created')
    expect(pending[0].message).toEqual({ id: 1 })
    expect(pending[0].createdAt).toBeInstanceOf(Date)
  })

  it('orders pending entries oldest first and respects the limit', async () => {
    const store = knexOutboxStore(client)
    await store.save({ topic: 'a', message: 1 })
    await store.save({ topic: 'b', message: 2 })
    await store.save({ topic: 'c', message: 3 })

    const pending = await store.listPending(2)
    expect(pending).toHaveLength(2)
    expect(pending.map((e) => e.topic)).toEqual(['a', 'b'])
  })

  it('excludes entries once markPublished is called', async () => {
    const store = knexOutboxStore(client)
    await store.save({ topic: 'order.created', message: { id: 1 } })
    const [entry] = await store.listPending(10)

    await store.markPublished(entry.id)

    const pending = await store.listPending(10)
    expect(pending).toHaveLength(0)
  })

  it('accepts a transaction handle for save()', async () => {
    const store = knexOutboxStore(client)
    await client.transaction(async (tx) => {
      await store.save({ topic: 'order.created', message: { id: 1 } }, tx)
    })

    const pending = await store.listPending(10)
    expect(pending).toHaveLength(1)
  })
})

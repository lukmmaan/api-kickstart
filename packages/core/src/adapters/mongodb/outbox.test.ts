import type { Db } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { mongodbOutboxStore } from './outbox.js'

interface FakeDoc {
  _id: string
  topic: string
  message: unknown
  createdAt: Date
  publishedAt: Date | null
}

function fakeDb(): Db {
  const docs: FakeDoc[] = []

  const collection = {
    async createIndex() {
      return 'ok'
    },
    async insertOne(doc: FakeDoc) {
      docs.push(doc)
      return { insertedId: doc._id }
    },
    find(filter: { publishedAt: null }) {
      let results = docs.filter((d) => (filter.publishedAt === null ? d.publishedAt === null : true))
      return {
        sort() {
          results = [...results].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          return this
        },
        limit(n: number) {
          results = results.slice(0, n)
          return this
        },
        async toArray() {
          return results
        },
      }
    },
    async updateOne(filter: { _id: string }, update: { $set: { publishedAt: Date } }) {
      const doc = docs.find((d) => d._id === filter._id)
      if (doc) doc.publishedAt = update.$set.publishedAt
      return { matchedCount: doc ? 1 : 0 }
    },
  }

  return { collection: () => collection } as unknown as Db
}

describe('mongodbOutboxStore (against a fake Db double, no real MongoDB required)', () => {
  it('saves an entry and lists it as pending', async () => {
    const store = mongodbOutboxStore(fakeDb())
    await store.save({ topic: 'order.created', message: { id: 1 } })

    const pending = await store.listPending(10)
    expect(pending).toHaveLength(1)
    expect(pending[0].topic).toBe('order.created')
    expect(pending[0].message).toEqual({ id: 1 })
    expect(pending[0].id).toEqual(expect.any(String))
  })

  it('orders pending entries oldest first and respects the limit', async () => {
    const db = fakeDb()
    const store = mongodbOutboxStore(db)
    await store.save({ topic: 'a', message: 1 })
    await store.save({ topic: 'b', message: 2 })
    await store.save({ topic: 'c', message: 3 })

    const pending = await store.listPending(2)
    expect(pending).toHaveLength(2)
    expect(pending.map((e) => e.topic)).toEqual(['a', 'b'])
  })

  it('excludes entries once markPublished is called', async () => {
    const store = mongodbOutboxStore(fakeDb())
    await store.save({ topic: 'order.created', message: { id: 1 } })
    const [entry] = await store.listPending(10)

    await store.markPublished(entry.id)

    const pending = await store.listPending(10)
    expect(pending).toHaveLength(0)
  })
})

import { randomUUID } from 'node:crypto'
import type { ClientSession, Db } from 'mongodb'
import type { OutboxEntry, OutboxStore } from 'api-kickstart'

export interface MongodbOutboxStoreOptions {
  collectionName?: string
  ensureIndexes?: boolean
}

interface OutboxDocument {
  _id: string
  topic: string
  message: unknown
  createdAt: Date
  publishedAt: Date | null
}

const DEFAULT_OUTBOX_COLLECTION = '_api_kickstart_outbox'

export function mongodbOutboxStore(db: Db, options: MongodbOutboxStoreOptions = {}): OutboxStore {
  const collectionName = options.collectionName ?? DEFAULT_OUTBOX_COLLECTION
  const shouldEnsureIndexes = options.ensureIndexes ?? true
  const collection = db.collection<OutboxDocument>(collectionName)
  let indexed = false

  async function ensureIndexes(): Promise<void> {
    if (indexed || !shouldEnsureIndexes) return
    await collection.createIndex({ publishedAt: 1, createdAt: 1 })
    indexed = true
  }

  return {
    async save(entry, tx) {
      await ensureIndexes()
      await collection.insertOne(
        { _id: randomUUID(), topic: entry.topic, message: entry.message, createdAt: new Date(), publishedAt: null },
        { session: tx as ClientSession | undefined },
      )
    },

    async listPending(limit): Promise<OutboxEntry[]> {
      await ensureIndexes()
      const docs = await collection
        .find({ publishedAt: null })
        .sort({ createdAt: 1 })
        .limit(limit)
        .toArray()

      return docs.map((doc) => ({
        id: doc._id,
        topic: doc.topic,
        message: doc.message,
        createdAt: doc.createdAt,
      }))
    },

    async markPublished(id) {
      await collection.updateOne({ _id: id }, { $set: { publishedAt: new Date() } })
    },
  }
}

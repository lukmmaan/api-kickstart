import type { Db } from 'mongodb'
import { describe, expect, it } from 'vitest'
import { mongodbTranslationStore } from './i18n.js'

interface FakeDoc {
  locale: string
  key: string
  value: string
}

function fakeDb(): Db {
  const docs: FakeDoc[] = []

  const collection = {
    find() {
      return { async toArray() { return docs } }
    },
    async updateOne(filter: { locale: string; key: string }, update: { $set: FakeDoc }) {
      const existing = docs.find((d) => d.locale === filter.locale && d.key === filter.key)
      if (existing) {
        existing.value = update.$set.value
        return { matchedCount: 1, upsertedId: null }
      }
      docs.push({ ...update.$set })
      return { matchedCount: 0, upsertedId: 'x' }
    },
  }

  return { collection: () => collection } as unknown as Db
}

describe('mongodbTranslationStore (against a fake Db double, no real MongoDB required)', () => {
  it('returns an empty dictionary set with no documents', async () => {
    const store = mongodbTranslationStore(fakeDb())
    await expect(store.loadAll()).resolves.toEqual({})
  })

  it('set() inserts a new key and loadAll() reassembles it into a nested dictionary', async () => {
    const store = mongodbTranslationStore(fakeDb())
    await store.set('en', 'greeting', 'Hello')
    await store.set('en', 'errors.notFound', 'Not found')
    await store.set('id', 'greeting', 'Halo')

    await expect(store.loadAll()).resolves.toEqual({
      en: { greeting: 'Hello', errors: { notFound: 'Not found' } },
      id: { greeting: 'Halo' },
    })
  })

  it('set() on an existing locale+key updates it in place instead of duplicating', async () => {
    const store = mongodbTranslationStore(fakeDb())
    await store.set('en', 'greeting', 'Hi')
    await store.set('en', 'greeting', 'Hello')

    await expect(store.loadAll()).resolves.toEqual({ en: { greeting: 'Hello' } })
  })
})

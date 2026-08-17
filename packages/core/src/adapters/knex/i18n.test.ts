import Knex from 'knex'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { knexTranslationStore } from './i18n.js'

let client: ReturnType<typeof Knex>

beforeEach(() => {
  client = Knex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true })
})

afterEach(async () => {
  await client.destroy()
})

describe('knexTranslationStore', () => {
  it('creates the table lazily and returns an empty dictionary set', async () => {
    const store = knexTranslationStore(client)
    await expect(store.loadAll()).resolves.toEqual({})
  })

  it('set() inserts a new key and loadAll() reassembles it into a nested dictionary', async () => {
    const store = knexTranslationStore(client)
    await store.set('en', 'greeting', 'Hello')
    await store.set('en', 'errors.notFound', 'Not found')
    await store.set('id', 'greeting', 'Halo')

    await expect(store.loadAll()).resolves.toEqual({
      en: { greeting: 'Hello', errors: { notFound: 'Not found' } },
      id: { greeting: 'Halo' },
    })
  })

  it('set() on an existing locale+key updates it in place instead of duplicating', async () => {
    const store = knexTranslationStore(client)
    await store.set('en', 'greeting', 'Hi')
    await store.set('en', 'greeting', 'Hello')

    await expect(store.loadAll()).resolves.toEqual({ en: { greeting: 'Hello' } })
  })
})

import { describe, expect, it } from 'vitest'
import { memoryTranslationStore } from './i18n.js'

describe('memoryTranslationStore', () => {
  it('loads dictionaries passed in at creation time', async () => {
    const store = memoryTranslationStore({ en: { greeting: 'Hello' } })
    await expect(store.loadAll()).resolves.toEqual({ en: { greeting: 'Hello' } })
  })

  it('starts empty when no initial dictionaries are given', async () => {
    const store = memoryTranslationStore()
    await expect(store.loadAll()).resolves.toEqual({})
  })

  it('set() writes a dot-path key into the right locale, creating the locale if needed', async () => {
    const store = memoryTranslationStore()
    await store.set('en', 'errors.notFound', 'Not found')
    await store.set('id', 'errors.notFound', 'Tidak ditemukan')

    await expect(store.loadAll()).resolves.toEqual({
      en: { errors: { notFound: 'Not found' } },
      id: { errors: { notFound: 'Tidak ditemukan' } },
    })
  })

  it('set() overwrites an existing key without disturbing sibling keys', async () => {
    const store = memoryTranslationStore({ en: { greeting: 'Hi', farewell: 'Bye' } })
    await store.set('en', 'greeting', 'Hello')

    await expect(store.loadAll()).resolves.toEqual({ en: { greeting: 'Hello', farewell: 'Bye' } })
  })
})

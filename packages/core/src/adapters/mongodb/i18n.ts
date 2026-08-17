import type { Db } from 'mongodb'
import { buildDictionary, type TranslationDictionary, type TranslationStore } from '../../i18n.js'

export interface MongodbTranslationStoreOptions {
  collectionName?: string
}

interface TranslationDocument {
  locale: string
  key: string
  value: string
}

const DEFAULT_COLLECTION = '_api_kickstart_translations'

export function mongodbTranslationStore(db: Db, options: MongodbTranslationStoreOptions = {}): TranslationStore {
  const collectionName = options.collectionName ?? DEFAULT_COLLECTION
  const collection = db.collection<TranslationDocument>(collectionName)

  return {
    async loadAll(): Promise<Record<string, TranslationDictionary>> {
      const docs = await collection.find({}).toArray()

      const byLocale = new Map<string, [string, string][]>()
      for (const doc of docs) {
        const entries = byLocale.get(doc.locale) ?? []
        entries.push([doc.key, doc.value])
        byLocale.set(doc.locale, entries)
      }

      const dictionaries: Record<string, TranslationDictionary> = {}
      for (const [locale, entries] of byLocale) dictionaries[locale] = buildDictionary(entries)
      return dictionaries
    },

    async set(locale, key, value): Promise<void> {
      await collection.updateOne({ locale, key }, { $set: { locale, key, value } }, { upsert: true })
    },
  }
}

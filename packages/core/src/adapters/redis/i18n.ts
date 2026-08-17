import { buildDictionary, type TranslationDictionary, type TranslationStore } from '../../i18n.js'
import { resolveClient, resolveKeyPrefix, type RedisStoreOptions } from './client.js'

export interface RedisTranslationStoreOptions extends RedisStoreOptions {
  /** Redis has no cheap "list every locale" operation, so loadAll() only reads these. */
  locales: string[]
}

export function redisTranslationStore(options: RedisTranslationStoreOptions): TranslationStore {
  const redis = resolveClient(options)
  const prefix = resolveKeyPrefix(options)
  const hashKey = (locale: string) => `${prefix}i18n:${locale}`

  return {
    async loadAll(): Promise<Record<string, TranslationDictionary>> {
      const dictionaries: Record<string, TranslationDictionary> = {}
      for (const locale of options.locales) {
        const hash = await redis.hgetall(hashKey(locale))
        if (Object.keys(hash).length > 0) dictionaries[locale] = buildDictionary(Object.entries(hash))
      }
      return dictionaries
    },

    async set(locale, key, value): Promise<void> {
      await redis.hset(hashKey(locale), key, value)
    },
  }
}

import type { TranslationDictionary, TranslationStore } from '../../i18n.js'
import { setTranslationPath } from '../../i18n.js'

/**
 * In-process TranslationStore backed by a plain object — the "constant" backend:
 * translations are whatever you pass in (or add via set()), held in memory only.
 */
export function memoryTranslationStore(initial: Record<string, TranslationDictionary> = {}): TranslationStore {
  const data = new Map<string, TranslationDictionary>(Object.entries(initial))

  return {
    async loadAll(): Promise<Record<string, TranslationDictionary>> {
      return Object.fromEntries(data)
    },

    async set(locale, key, value): Promise<void> {
      const dictionary = data.get(locale) ?? {}
      setTranslationPath(dictionary, key, value)
      data.set(locale, dictionary)
    },
  }
}

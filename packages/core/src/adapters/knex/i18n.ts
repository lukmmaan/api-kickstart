import type { Knex } from 'knex'
import { buildDictionary, type TranslationDictionary, type TranslationStore } from '../../i18n.js'

export interface KnexTranslationStoreOptions {
  tableName?: string
  ensureTable?: boolean
}

const DEFAULT_TABLE = '_api_kickstart_translations'

export function knexTranslationStore(client: Knex, options: KnexTranslationStoreOptions = {}): TranslationStore {
  const tableName = options.tableName ?? DEFAULT_TABLE
  const shouldEnsureTable = options.ensureTable ?? true
  let ensured = false

  async function ensureTable(): Promise<void> {
    if (ensured || !shouldEnsureTable) return
    const exists = await client.schema.hasTable(tableName)
    if (!exists) {
      await client.schema.createTable(tableName, (table) => {
        table.string('locale').notNullable()
        table.string('key').notNullable()
        table.text('value').notNullable()
        table.primary(['locale', 'key'])
      })
    }
    ensured = true
  }

  return {
    async loadAll(): Promise<Record<string, TranslationDictionary>> {
      await ensureTable()
      const rows = await client(tableName).select<{ locale: string; key: string; value: string }[]>(
        'locale',
        'key',
        'value',
      )

      const byLocale = new Map<string, [string, string][]>()
      for (const row of rows) {
        const entries = byLocale.get(row.locale) ?? []
        entries.push([row.key, row.value])
        byLocale.set(row.locale, entries)
      }

      const dictionaries: Record<string, TranslationDictionary> = {}
      for (const [locale, entries] of byLocale) dictionaries[locale] = buildDictionary(entries)
      return dictionaries
    },

    async set(locale, key, value): Promise<void> {
      await ensureTable()
      const updated = await client(tableName).where({ locale, key }).update({ value })
      if (updated === 0) await client(tableName).insert({ locale, key, value })
    },
  }
}

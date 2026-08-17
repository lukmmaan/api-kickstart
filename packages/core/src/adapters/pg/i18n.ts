import type { Pool } from 'pg'
import { buildDictionary, type TranslationDictionary, type TranslationStore } from '../../i18n.js'

export interface PgTranslationStoreOptions {
  tableName?: string
  ensureTable?: boolean
}

const DEFAULT_TABLE = '_api_kickstart_translations'

export function pgTranslationStore(pool: Pool, options: PgTranslationStoreOptions = {}): TranslationStore {
  const tableName = options.tableName ?? DEFAULT_TABLE
  const shouldEnsureTable = options.ensureTable ?? true
  let ensured = false

  async function ensureTable(): Promise<void> {
    if (ensured || !shouldEnsureTable) return
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        locale TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (locale, key)
      )
    `)
    ensured = true
  }

  return {
    async loadAll(): Promise<Record<string, TranslationDictionary>> {
      await ensureTable()
      const result = await pool.query(`SELECT locale, key, value FROM ${tableName}`)

      const byLocale = new Map<string, [string, string][]>()
      for (const row of result.rows as { locale: string; key: string; value: string }[]) {
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
      await pool.query(
        `INSERT INTO ${tableName} (locale, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (locale, key) DO UPDATE SET value = excluded.value`,
        [locale, key, value],
      )
    },
  }
}

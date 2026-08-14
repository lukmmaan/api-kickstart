import { and, eq, type SQL, type Table } from 'drizzle-orm'
import type { ScopeFilter } from '../../index.js'

export function scopeToWhere<T extends Table>(table: T, filter: ScopeFilter): SQL | undefined {
  const columns = table as unknown as Record<string, unknown>
  const conditions = Object.entries(filter).map(([key, value]) => eq(columns[key] as never, value))
  if (conditions.length === 0) return undefined
  return and(...conditions)
}

import { Conflict } from '../../errors.js'
import { MYSQL_DUPLICATE_ENTRY_CODE, PG_UNIQUE_VIOLATION_CODE } from './constants.js'

export function normalizeTypeOrmError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const driverError = (err as Error & { driverError?: { code?: string } }).driverError
  const code = driverError?.code
  if (code === PG_UNIQUE_VIOLATION_CODE || code === MYSQL_DUPLICATE_ENTRY_CODE) {
    return new Conflict('Unique constraint violation', { code })
  }
  return null
}

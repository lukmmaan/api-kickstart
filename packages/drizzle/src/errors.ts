import { BadRequest, Conflict } from 'api-kickstart/errors'
import { PG_FOREIGN_KEY_VIOLATION_CODE, PG_NOT_NULL_VIOLATION_CODE, PG_UNIQUE_VIOLATION_CODE } from './constants.js'

export function normalizeDrizzleError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const code = (err as Error & { code?: string }).code
  if (code === PG_UNIQUE_VIOLATION_CODE) return new Conflict('Unique constraint violation', { code })
  if (code === PG_FOREIGN_KEY_VIOLATION_CODE) return new BadRequest('Foreign key constraint violation', { code })
  if (code === PG_NOT_NULL_VIOLATION_CODE) return new BadRequest('Not-null constraint violation', { code })
  return null
}

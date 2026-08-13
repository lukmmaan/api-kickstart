import { BadRequest, Conflict } from 'api-kickstart/errors'

const UNIQUE_CODES = new Set(['23505', 'ER_DUP_ENTRY', 'SQLITE_CONSTRAINT'])
const FOREIGN_KEY_CODES = new Set(['23503', 'ER_NO_REFERENCED_ROW_2'])

export function normalizeKnexError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const code = (err as Error & { code?: string }).code
  if (code && UNIQUE_CODES.has(code)) return new Conflict('Unique constraint violation', { code })
  if (code && FOREIGN_KEY_CODES.has(code)) return new BadRequest('Foreign key constraint violation', { code })
  return null
}

import { BadRequest, Conflict } from '../../errors.js'
import { FOREIGN_KEY_VIOLATION_CODES, UNIQUE_VIOLATION_CODES } from './constants.js'

const uniqueCodes = new Set(UNIQUE_VIOLATION_CODES)
const foreignKeyCodes = new Set(FOREIGN_KEY_VIOLATION_CODES)

export function normalizeKnexError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const code = (err as Error & { code?: string }).code
  if (code && uniqueCodes.has(code)) return new Conflict('Unique constraint violation', { code })
  if (code && foreignKeyCodes.has(code)) return new BadRequest('Foreign key constraint violation', { code })
  return null
}

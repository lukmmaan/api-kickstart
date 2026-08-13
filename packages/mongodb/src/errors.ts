import { Conflict } from 'api-kickstart/errors'
import { MONGO_DUPLICATE_KEY_CODE } from './constants.js'

export function normalizeMongoError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const code = (err as Error & { code?: number }).code
  if (code === MONGO_DUPLICATE_KEY_CODE) return new Conflict('Unique constraint violation', { code })
  return null
}

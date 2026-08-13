import { Conflict } from 'api-kickstart/errors'

export function normalizeMongooseError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const code = (err as Error & { code?: number }).code
  if (code === 11000) return new Conflict('Unique constraint violation', { code })
  return null
}

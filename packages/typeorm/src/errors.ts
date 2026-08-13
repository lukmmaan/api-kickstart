import { Conflict } from 'api-kickstart/errors'

export function normalizeTypeOrmError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const driverError = (err as Error & { driverError?: { code?: string } }).driverError
  const code = driverError?.code
  if (code === '23505' || code === 'ER_DUP_ENTRY') return new Conflict('Unique constraint violation', { code })
  return null
}

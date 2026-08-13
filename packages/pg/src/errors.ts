import { BadRequest, Conflict } from 'api-kickstart/errors'

export function normalizePgError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  const code = (err as Error & { code?: string }).code
  if (code === '23505') return new Conflict('Unique constraint violation', { code })
  if (code === '23503') return new BadRequest('Foreign key constraint violation', { code })
  if (code === '23502') return new BadRequest('Not-null constraint violation', { code })
  return null
}

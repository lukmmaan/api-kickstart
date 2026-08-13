import { BadRequest, Conflict } from 'api-kickstart/errors'

export function normalizeSequelizeError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  if (err.name === 'SequelizeUniqueConstraintError') return new Conflict('Unique constraint violation')
  if (err.name === 'SequelizeForeignKeyConstraintError') return new BadRequest('Foreign key constraint violation')
  if (err.name === 'SequelizeValidationError') return new BadRequest(err.message)
  return null
}

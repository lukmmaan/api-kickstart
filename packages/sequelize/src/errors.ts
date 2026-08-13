import { BadRequest, Conflict } from 'api-kickstart/errors'
import { SEQUELIZE_FOREIGN_KEY_CONSTRAINT_ERROR, SEQUELIZE_UNIQUE_CONSTRAINT_ERROR, SEQUELIZE_VALIDATION_ERROR } from './constants.js'

export function normalizeSequelizeError(err: unknown): Error | null {
  if (!(err instanceof Error)) return null
  if (err.name === SEQUELIZE_UNIQUE_CONSTRAINT_ERROR) return new Conflict('Unique constraint violation')
  if (err.name === SEQUELIZE_FOREIGN_KEY_CONSTRAINT_ERROR) return new BadRequest('Foreign key constraint violation')
  if (err.name === SEQUELIZE_VALIDATION_ERROR) return new BadRequest(err.message)
  return null
}

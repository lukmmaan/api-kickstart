import type { Schema } from 'joi'
import { SchemaValidationError, type Validator } from 'api-kickstart'

export function joi(): Validator {
  return {
    name: 'joi',
    parse(schema, value) {
      const result = (schema as Schema).validate(value, { abortEarly: false })
      if (result.error) {
        const issues = result.error.details.map((detail) => ({
          path: detail.path.join('.'),
          message: detail.message,
        }))
        throw new SchemaValidationError(issues)
      }
      return result.value
    },
  }
}

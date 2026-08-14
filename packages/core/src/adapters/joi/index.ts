import type { Schema } from 'joi'
import * as joiToJsonModule from 'joi-to-json'
import { SchemaValidationError, type Validator } from '../../index.js'

const joiToJson = joiToJsonModule.default as unknown as (schema: Schema) => unknown

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
    toJsonSchema(schema) {
      return joiToJson(schema as Schema)
    },
  }
}

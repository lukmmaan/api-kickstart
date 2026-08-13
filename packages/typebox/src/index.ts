import type { TSchema } from '@sinclair/typebox'
import { Value } from '@sinclair/typebox/value'
import { SchemaValidationError, type Validator } from 'api-kickstart'

export function typebox(): Validator {
  return {
    name: 'typebox',
    parse(schema, value) {
      const typedSchema = schema as TSchema
      if (Value.Check(typedSchema, value)) {
        return value
      }
      const issues = [...Value.Errors(typedSchema, value)].map((issue) => ({
        path: issue.path,
        message: issue.message,
      }))
      throw new SchemaValidationError(issues)
    },
  }
}

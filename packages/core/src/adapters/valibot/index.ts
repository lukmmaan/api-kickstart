import * as v from 'valibot'
import { toJsonSchema as valibotToJsonSchema } from '@valibot/to-json-schema'
import { SchemaValidationError, type Validator } from '../../index.js'

export function valibot(): Validator {
  return {
    name: 'valibot',
    parse(schema, value) {
      const result = v.safeParse(schema as v.GenericSchema, value)
      if (!result.success) {
        const issues = result.issues.map((issue) => ({
          path: issue.path?.map((segment) => String(segment.key)).join('.') ?? '',
          message: issue.message,
        }))
        throw new SchemaValidationError(issues)
      }
      return result.output
    },
    toJsonSchema(schema) {
      return valibotToJsonSchema(schema as v.GenericSchema)
    },
  }
}

import type { ZodSchema } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import { SchemaValidationError, type Validator } from 'api-kickstart'

export function zod(): Validator {
  return {
    name: 'zod',
    parse(schema, value) {
      const zodSchema = schema as ZodSchema
      const result = zodSchema.safeParse(value)
      if (!result.success) {
        const issues = result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        }))
        throw new SchemaValidationError(issues)
      }
      return result.data
    },
    toJsonSchema(schema) {
      return zodToJsonSchema(schema as ZodSchema, { target: 'openApi3' })
    },
  }
}

import { ValidationError, type Schema } from 'yup'
import { convertSchema } from '@sodaru/yup-to-json-schema'
import { SchemaValidationError, type Validator } from '../../index.js'

export function yup(): Validator {
  return {
    name: 'yup',
    parse(schema, value) {
      try {
        return (schema as Schema).validateSync(value, { abortEarly: false })
      } catch (err) {
        if (err instanceof ValidationError) {
          const issues = err.inner.length > 0
            ? err.inner.map((inner) => ({ path: inner.path ?? '', message: inner.message }))
            : [{ path: err.path ?? '', message: err.message }]
          throw new SchemaValidationError(issues)
        }
        throw err
      }
    },
    toJsonSchema(schema) {
      return convertSchema(schema as Schema)
    },
  }
}

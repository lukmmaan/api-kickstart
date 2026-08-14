import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { SchemaValidationError } from '../../index.js'
import { zod } from './index.js'

describe('zod validator', () => {
  const schema = z.object({ title: z.string().min(1), age: z.number().int().optional() })

  it('parses and returns the validated value on success', () => {
    const validator = zod()
    const result = validator.parse(schema, { title: 'Hello', age: 30 }, 'body')
    expect(result).toEqual({ title: 'Hello', age: 30 })
  })

  it('throws SchemaValidationError with mapped issues on failure', () => {
    const validator = zod()
    try {
      validator.parse(schema, { title: '' }, 'body')
      throw new Error('expected parse() to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError)
      const validationError = err as SchemaValidationError
      expect(validationError.issues[0]).toEqual({ path: 'title', message: expect.any(String) })
    }
  })

  it('generates a JSON Schema for OpenAPI via toJsonSchema', () => {
    const validator = zod()
    const jsonSchema = validator.toJsonSchema?.(schema) as { type?: string; properties?: Record<string, unknown> }
    expect(jsonSchema.type).toBe('object')
    expect(jsonSchema.properties).toHaveProperty('title')
    expect(jsonSchema.properties).toHaveProperty('age')
  })
})

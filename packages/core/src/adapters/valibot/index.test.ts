import * as v from 'valibot'
import { describe, expect, it } from 'vitest'
import { SchemaValidationError } from '../../index.js'
import { valibot } from './index.js'

describe('valibot validator', () => {
  const schema = v.object({
    title: v.pipe(v.string(), v.minLength(1)),
    age: v.optional(v.pipe(v.number(), v.integer())),
  })

  it('parses and returns the validated value on success', () => {
    const validator = valibot()
    const result = validator.parse(schema, { title: 'Hello', age: 30 }, 'body')
    expect(result).toEqual({ title: 'Hello', age: 30 })
  })

  it('throws SchemaValidationError with mapped issues on failure', () => {
    const validator = valibot()
    try {
      validator.parse(schema, { title: '' }, 'body')
      throw new Error('expected parse() to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError)
      const validationError = err as SchemaValidationError
      expect(validationError.issues.length).toBeGreaterThan(0)
      expect(validationError.issues[0]).toEqual({ path: expect.any(String), message: expect.any(String) })
    }
  })

  it('generates a JSON Schema for OpenAPI via toJsonSchema', () => {
    const validator = valibot()
    const jsonSchema = validator.toJsonSchema?.(schema) as { type?: string; properties?: Record<string, unknown>; required?: string[] }
    expect(jsonSchema.type).toBe('object')
    expect(jsonSchema.properties).toHaveProperty('title')
    expect(jsonSchema.properties).toHaveProperty('age')
    expect(jsonSchema.required).toEqual(['title'])
  })
})

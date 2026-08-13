import Joi from 'joi'
import { describe, expect, it } from 'vitest'
import { SchemaValidationError } from 'api-kickstart'
import { joi } from './index.js'

describe('joi validator', () => {
  const schema = Joi.object({ title: Joi.string().min(1).required(), age: Joi.number().integer().optional() })

  it('parses and returns the validated value on success', () => {
    const validator = joi()
    const result = validator.parse(schema, { title: 'Hello', age: 30 }, 'body')
    expect(result).toEqual({ title: 'Hello', age: 30 })
  })

  it('throws SchemaValidationError with mapped issues on failure', () => {
    const validator = joi()
    try {
      validator.parse(schema, { age: 'not a number' }, 'body')
      throw new Error('expected parse() to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(SchemaValidationError)
      const validationError = err as SchemaValidationError
      expect(validationError.issues.length).toBeGreaterThan(0)
      expect(validationError.issues[0]).toEqual({ path: expect.any(String), message: expect.any(String) })
    }
  })

  it('generates a JSON Schema for OpenAPI via toJsonSchema', () => {
    const validator = joi()
    const jsonSchema = validator.toJsonSchema?.(schema) as { type?: string; properties?: Record<string, unknown>; required?: string[] }
    expect(jsonSchema.type).toBe('object')
    expect(jsonSchema.properties).toHaveProperty('title')
    expect(jsonSchema.properties).toHaveProperty('age')
    expect(jsonSchema.required).toEqual(['title'])
  })
})

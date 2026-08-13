import { describe, expect, it } from 'vitest'
import { env, EnvValidationError } from './env.js'

const nonEmptyString = {
  parse(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error('must be a non-empty string')
    }
    return value
  },
}

const port = {
  parse(value: unknown): number {
    const parsed = Number(value)
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error('must be a positive integer')
    }
    return parsed
  },
}

describe('env', () => {
  it('parses and returns values matching the schema', () => {
    const result = env({ HOST: nonEmptyString, PORT: port }, { HOST: 'localhost', PORT: '3000' })
    expect(result).toEqual({ HOST: 'localhost', PORT: 3000 })
  })

  it('collects all issues and throws EnvValidationError', () => {
    try {
      env({ HOST: nonEmptyString, PORT: port }, { HOST: '', PORT: 'not-a-number' })
      throw new Error('expected env() to throw')
    } catch (err) {
      expect(err).toBeInstanceOf(EnvValidationError)
      const validationError = err as EnvValidationError
      expect(validationError.issues.map((i) => i.key).sort()).toEqual(['HOST', 'PORT'])
    }
  })

  it('defaults to reading from process.env when no source is given', () => {
    process.env.KICKSTART_TEST_VAR = 'value'
    const result = env({ KICKSTART_TEST_VAR: nonEmptyString })
    expect(result.KICKSTART_TEST_VAR).toBe('value')
    delete process.env.KICKSTART_TEST_VAR
  })
})

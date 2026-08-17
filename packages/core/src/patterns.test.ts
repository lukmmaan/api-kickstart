import { describe, expect, it } from 'vitest'
import { createPatternRegistry, patterns, UnknownPatternError } from './patterns.js'

describe('patterns', () => {
  it('ships built-in patterns that match valid input and reject invalid input', () => {
    expect(patterns.get('email').test('user@example.com')).toBe(true)
    expect(patterns.get('email').test('not-an-email')).toBe(false)

    expect(patterns.get('url').test('https://example.com/path?q=1')).toBe(true)
    expect(patterns.get('url').test('not a url')).toBe(false)

    expect(patterns.get('uuid').test('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
    expect(patterns.get('uuid').test('not-a-uuid')).toBe(false)

    expect(patterns.get('slug').test('my-blog-post-1')).toBe(true)
    expect(patterns.get('slug').test('Not A Slug')).toBe(false)

    expect(patterns.get('semver').test('1.2.3-beta.1+build.5')).toBe(true)
    expect(patterns.get('semver').test('1.2')).toBe(false)

    expect(patterns.get('jwt').test('eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature')).toBe(true)
    expect(patterns.get('jwt').test('not.a.jwt.token')).toBe(false)
  })

  it('lists every built-in pattern by name', () => {
    expect(patterns.list()).toEqual(
      expect.arrayContaining(['email', 'url', 'uuid', 'slug', 'semver', 'jwt', 'ipv4', 'ipv6', 'hexColor']),
    )
  })

  it('throws UnknownPatternError for a name that was never registered', () => {
    expect(() => patterns.get('does-not-exist')).toThrow(UnknownPatternError)
  })

  it('lets consumers register their own named patterns alongside the built-ins', () => {
    const registry = createPatternRegistry()
    registry.register('sku', /^[A-Z]{3}-\d{4}$/)

    expect(registry.has('sku')).toBe(true)
    expect(registry.get('sku').test('ABC-1234')).toBe(true)
    expect(registry.get('sku').test('abc-1234')).toBe(false)
  })

  it('creates independent registries that do not share custom patterns', () => {
    const registryA = createPatternRegistry()
    const registryB = createPatternRegistry()

    registryA.register('custom', /^a$/)

    expect(registryA.has('custom')).toBe(true)
    expect(registryB.has('custom')).toBe(false)
  })

  it('can seed a fresh registry with the built-ins explicitly', () => {
    const registry = createPatternRegistry({ digits: /^\d+$/ })
    expect(registry.has('digits')).toBe(true)
    expect(registry.has('email')).toBe(false)
  })
})

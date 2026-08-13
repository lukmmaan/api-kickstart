import { describe, expect, it } from 'vitest'
import { buildCorsHeaders, resolveCorsOptions } from './cors.js'

describe('resolveCorsOptions', () => {
  it('returns null for "off"', () => {
    expect(resolveCorsOptions('off', 'development')).toBeNull()
  })

  it('throws when "dev" is used in production', () => {
    expect(() => resolveCorsOptions('dev', 'production')).toThrow(/production/)
  })

  it('returns permissive defaults for "dev" outside production', () => {
    const options = resolveCorsOptions('dev', 'development')
    expect(options?.origin).toBe('*')
    expect(options?.credentials).toBe(true)
  })

  it('returns locked-down defaults for "strict"', () => {
    const options = resolveCorsOptions('strict', 'production')
    expect(options?.origin).toEqual([])
    expect(options?.credentials).toBe(false)
  })

  it('rejects wildcard origin combined with credentials in custom config', () => {
    expect(() => resolveCorsOptions({ origin: '*', credentials: true }, 'production')).toThrow(/credentials/)
  })

  it('passes through a valid custom config', () => {
    const custom = { origin: ['https://example.com'], credentials: true }
    expect(resolveCorsOptions(custom, 'production')).toBe(custom)
  })
})

describe('buildCorsHeaders', () => {
  it('sets a plain wildcard header when credentials are not required', () => {
    const headers = buildCorsHeaders({ origin: '*' }, 'https://example.com')
    expect(headers['access-control-allow-origin']).toBe('*')
    expect(headers.vary).toBeUndefined()
  })

  it('echoes a matching origin and sets vary when credentials are required', () => {
    const headers = buildCorsHeaders({ origin: ['https://example.com'], credentials: true }, 'https://example.com')
    expect(headers['access-control-allow-origin']).toBe('https://example.com')
    expect(headers.vary).toBe('origin')
    expect(headers['access-control-allow-credentials']).toBe('true')
  })

  it('omits the allow-origin header for a non-matching origin', () => {
    const headers = buildCorsHeaders({ origin: ['https://example.com'] }, 'https://evil.example')
    expect(headers['access-control-allow-origin']).toBeUndefined()
  })

  it('matches origins by regex', () => {
    const headers = buildCorsHeaders({ origin: [/^https:\/\/.*\.example\.com$/] }, 'https://api.example.com')
    expect(headers['access-control-allow-origin']).toBe('https://api.example.com')
  })

  it('includes methods, allowed headers, exposed headers, and max age when provided', () => {
    const headers = buildCorsHeaders(
      {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['content-type'],
        exposedHeaders: ['x-request-id'],
        maxAge: 600,
      },
      undefined,
    )
    expect(headers['access-control-allow-methods']).toBe('GET, POST')
    expect(headers['access-control-allow-headers']).toBe('content-type')
    expect(headers['access-control-expose-headers']).toBe('x-request-id')
    expect(headers['access-control-max-age']).toBe('600')
  })
})

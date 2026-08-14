import { describe, expect, it } from 'vitest'
import { parseCookies } from './cookies.js'

describe('parseCookies', () => {
  it('returns an empty object for an undefined header', () => {
    expect(parseCookies(undefined)).toEqual({})
  })

  it('parses multiple cookies separated by semicolons', () => {
    expect(parseCookies('a=1; b=2')).toEqual({ a: '1', b: '2' })
  })

  it('decodes URI-encoded values', () => {
    expect(parseCookies('session=abc%3Ddef')).toEqual({ session: 'abc=def' })
  })
})

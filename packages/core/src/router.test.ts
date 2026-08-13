import { describe, expect, it } from 'vitest'
import { compilePath, joinPaths } from './router.js'

describe('compilePath', () => {
  it('matches a static path', () => {
    const { regex, keys } = compilePath('/users')
    expect(regex.test('/users')).toBe(true)
    expect(regex.test('/users/1')).toBe(false)
    expect(keys).toEqual([])
  })

  it('extracts param keys and matches dynamic segments', () => {
    const { regex, keys } = compilePath('/users/:id/posts/:postId')
    expect(keys).toEqual(['id', 'postId'])
    const match = regex.exec('/users/42/posts/7')
    expect(match?.[1]).toBe('42')
    expect(match?.[2]).toBe('7')
  })

  it('escapes regex special characters in static segments', () => {
    const { regex } = compilePath('/a.b+c')
    expect(regex.test('/a.b+c')).toBe(true)
    expect(regex.test('/aXbYc')).toBe(false)
  })
})

describe('joinPaths', () => {
  it('joins and normalizes slashes', () => {
    expect(joinPaths('/api', '/v1/', '/users')).toBe('/api/v1/users')
  })

  it('drops undefined parts', () => {
    expect(joinPaths(undefined, '/users')).toBe('/users')
  })

  it('returns / when everything is empty', () => {
    expect(joinPaths(undefined, undefined)).toBe('/')
  })
})

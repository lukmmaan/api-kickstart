import { describe, expect, it } from 'vitest'
import { createApp } from '../index.js'
import { csrf } from './csrf.js'
import { fakeFramework } from '../test-helpers.js'

function cookieValueFromSetCookie(setCookieHeader: string, name: string): string {
  const match = new RegExp(`${name}=([^;]+)`).exec(setCookieHeader)
  if (!match) throw new Error(`no ${name} cookie in Set-Cookie header: ${setCookieHeader}`)
  return match[1]
}

describe('csrf()', () => {
  it('issues a cookie on a safe request without requiring a token', async () => {
    const app = createApp({ framework: fakeFramework(), middleware: [csrf()] })
    app.route({ method: 'GET', path: '/form', auth: false, handler: async () => ({ ok: true }) })

    const res = await app.inject({ method: 'GET', path: '/form' })
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie']).toContain('csrf_token=')
  })

  it('rejects an unsafe request with no cookie and no header at all', async () => {
    const app = createApp({ framework: fakeFramework(), middleware: [csrf()] })
    app.route({ method: 'POST', path: '/posts', auth: false, handler: async () => ({ created: true }) })

    const res = await app.inject({ method: 'POST', path: '/posts' })
    expect(res.status).toBe(403)
  })

  it('rejects an unsafe request whose header does not match the cookie', async () => {
    const app = createApp({ framework: fakeFramework(), middleware: [csrf()] })
    app.route({ method: 'GET', path: '/form', auth: false, handler: async () => ({}) })
    app.route({ method: 'POST', path: '/posts', auth: false, handler: async () => ({ created: true }) })

    const getRes = await app.inject({ method: 'GET', path: '/form' })
    const token = cookieValueFromSetCookie(getRes.headers['set-cookie'], 'csrf_token')

    const res = await app.inject({
      method: 'POST',
      path: '/posts',
      headers: { cookie: `csrf_token=${token}`, 'x-csrf-token': 'wrong-token' },
    })
    expect(res.status).toBe(403)
  })

  it('allows an unsafe request whose header matches the cookie', async () => {
    const app = createApp({ framework: fakeFramework(), middleware: [csrf()] })
    app.route({ method: 'GET', path: '/form', auth: false, handler: async () => ({}) })
    app.route({ method: 'POST', path: '/posts', auth: false, handler: async () => ({ created: true }) })

    const getRes = await app.inject({ method: 'GET', path: '/form' })
    const token = cookieValueFromSetCookie(getRes.headers['set-cookie'], 'csrf_token')

    const res = await app.inject({
      method: 'POST',
      path: '/posts',
      headers: { cookie: `csrf_token=${token}`, 'x-csrf-token': token },
    })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ created: true })
  })

  it('does not require a token for a method listed in safeMethods', async () => {
    const app = createApp({ framework: fakeFramework(), middleware: [csrf({ safeMethods: ['GET', 'HEAD', 'OPTIONS', 'POST'] })] })
    app.route({ method: 'POST', path: '/posts', auth: false, handler: async () => ({ created: true }) })

    const res = await app.inject({ method: 'POST', path: '/posts' })
    expect(res.status).toBe(200)
  })
})

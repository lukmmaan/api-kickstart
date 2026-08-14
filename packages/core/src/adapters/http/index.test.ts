import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { describe, expect, it } from 'vitest'
import { createApp } from '../../index.js'
import { http } from './index.js'

async function listen(app: ReturnType<typeof createApp>): Promise<{ port: number; close: () => Promise<void> }> {
  let server!: Server
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve()) as Server
  })
  const { port } = server.address() as AddressInfo
  return { port, close: () => app.close() }
}

describe('http() framework adapter', () => {
  it('serves a GET route end-to-end', async () => {
    const app = createApp({ framework: http() })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({ pong: true }) })
    const { port, close } = await listen(app)

    const res = await fetch(`http://127.0.0.1:${port}/ping`)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ pong: true })

    await close()
  })

  it('parses a JSON request body and returns 404 for unmatched routes', async () => {
    const app = createApp({ framework: http() })
    app.route({ method: 'POST', path: '/echo', auth: false, handler: async (ctx) => ctx.body })
    const { port, close } = await listen(app)

    const res = await fetch(`http://127.0.0.1:${port}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ hello: 'world' })

    const missing = await fetch(`http://127.0.0.1:${port}/nope`)
    expect(missing.status).toBe(404)

    await close()
  })

  it('propagates response headers set by the app, including x-request-id', async () => {
    const app = createApp({ framework: http() })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({}) })
    const { port, close } = await listen(app)

    const res = await fetch(`http://127.0.0.1:${port}/ping`)
    expect(res.headers.get('x-request-id')).toEqual(expect.any(String))

    await close()
  })
})

import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { describe, expect, it } from 'vitest'
import { createApp } from 'api-kickstart'
import { express } from './index.js'

async function listen(app: ReturnType<typeof createApp>): Promise<{ port: number; close: () => Promise<void> }> {
  let server!: Server
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve()) as Server
  })
  const { port } = server.address() as AddressInfo
  return { port, close: () => app.close() }
}

describe('express() framework adapter', () => {
  it('serves a GET route end-to-end', async () => {
    const app = createApp({ framework: express() })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({ pong: true }) })
    const { port, close } = await listen(app)

    const res = await fetch(`http://127.0.0.1:${port}/ping`)
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ pong: true })

    await close()
  })

  it('parses a JSON request body and extracts path params', async () => {
    const app = createApp({ framework: express() })
    app.route({ method: 'POST', path: '/users/:id/echo', auth: false, handler: async (ctx) => ({ params: ctx.params, body: ctx.body }) })
    const { port, close } = await listen(app)

    const res = await fetch(`http://127.0.0.1:${port}/users/7/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    })
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ params: { id: '7' }, body: { hello: 'world' } })

    await close()
  })

  it('returns 404 for a route that was never registered', async () => {
    const app = createApp({ framework: express() })
    const { port, close } = await listen(app)

    const res = await fetch(`http://127.0.0.1:${port}/anything`)
    expect(res.status).toBe(404)

    await close()
  })
})

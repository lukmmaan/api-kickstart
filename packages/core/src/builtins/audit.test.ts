import { describe, expect, it } from 'vitest'
import { createApp } from '../index.js'
import { NotFound } from '../errors.js'
import { auditLog, type AuditEntry, type AuditSink } from './audit.js'
import { fakeFramework } from '../test-helpers.js'

function recordingSink(): AuditSink & { entries: AuditEntry[] } {
  const entries: AuditEntry[] = []
  return {
    entries,
    record(entry) {
      entries.push(entry)
    },
  }
}

describe('auditLog()', () => {
  it('records an entry with user, method, path, and status after the handler runs', async () => {
    const sink = recordingSink()
    const app = createApp({ framework: fakeFramework(), middleware: [auditLog({ sink })] })
    app.route({ method: 'POST', path: '/orders', auth: true, handler: async () => ({ id: 'o1' }) })

    await app.inject({ method: 'POST', path: '/orders', as: { id: 'u1', role: 'staff' } })

    expect(sink.entries).toHaveLength(1)
    expect(sink.entries[0]).toMatchObject({
      userId: 'u1',
      method: 'POST',
      path: '/orders',
      status: 200,
    })
    expect(sink.entries[0].requestId).toEqual(expect.any(String))
    expect(sink.entries[0].timestamp).toEqual(expect.any(String))
  })

  it('records userId as null for an unauthenticated request', async () => {
    const sink = recordingSink()
    const app = createApp({ framework: fakeFramework(), middleware: [auditLog({ sink })] })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({}) })

    await app.inject({ method: 'GET', path: '/ping' })

    expect(sink.entries[0].userId).toBeNull()
  })

  it('derives action, resource, and metadata from the provided callbacks', async () => {
    const sink = recordingSink()
    const app = createApp({
      framework: fakeFramework(),
      middleware: [
        auditLog({
          sink,
          action: () => 'order.create',
          resource: (ctx) => `orders/${(ctx.response.body as { id: string }).id}`,
          metadata: (ctx) => ({ ip: (ctx.raw.req as { ip?: string } | null)?.ip ?? 'unknown' }),
        }),
      ],
    })
    app.route({ method: 'POST', path: '/orders', auth: false, handler: async () => ({ id: 'o1' }) })

    await app.inject({ method: 'POST', path: '/orders' })

    expect(sink.entries[0]).toMatchObject({
      action: 'order.create',
      resource: 'orders/o1',
      metadata: { ip: 'unknown' },
    })
  })

  it('skips recording when skip() returns true', async () => {
    const sink = recordingSink()
    const app = createApp({
      framework: fakeFramework(),
      middleware: [auditLog({ sink, skip: (ctx) => ctx.path === '/health' })],
    })
    app.route({ method: 'GET', path: '/health', auth: false, handler: async () => ({ status: 'ok' }) })
    app.route({ method: 'GET', path: '/orders', auth: false, handler: async () => ({}) })

    await app.inject({ method: 'GET', path: '/health' })
    await app.inject({ method: 'GET', path: '/orders' })

    expect(sink.entries).toHaveLength(1)
    expect(sink.entries[0].path).toBe('/orders')
  })

  it('still records an entry, with the error status, when the handler throws', async () => {
    const sink = recordingSink()
    const app = createApp({ framework: fakeFramework(), middleware: [auditLog({ sink })] })
    app.route({
      method: 'GET',
      path: '/missing',
      auth: false,
      handler: async () => {
        throw new NotFound('nope')
      },
    })

    const res = await app.inject({ method: 'GET', path: '/missing' })

    expect(res.status).toBe(404)
    expect(sink.entries).toHaveLength(1)
    expect(sink.entries[0].status).toBe(404)
  })

  it('does not record auth/role/scope failures, since those happen before the middleware chain runs', async () => {
    const sink = recordingSink()
    const app = createApp({ framework: fakeFramework(), middleware: [auditLog({ sink })] })
    app.route({ method: 'GET', path: '/secret', auth: true, handler: async () => ({}) })

    const res = await app.inject({ method: 'GET', path: '/secret' })

    expect(res.status).toBe(401)
    expect(sink.entries).toHaveLength(0)
  })

  it('falls back to ctx.logger.info when no sink is provided', async () => {
    const logged: unknown[] = []
    const app = createApp({
      framework: fakeFramework(),
      middleware: [auditLog()],
      logger: {
        debug() {},
        info(...args) { logged.push(args) },
        warn() {},
        error() {},
        child() { return this },
      },
    })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({}) })

    await app.inject({ method: 'GET', path: '/ping' })

    expect(logged).toHaveLength(1)
  })
})

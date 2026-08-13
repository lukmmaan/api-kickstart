import { describe, expect, it } from 'vitest'
import { createApp } from './index.js'
import { SchemaValidationError } from './errors.js'
import { fakeFramework } from './test-helpers.js'
import type { AuthenticatedUser, DbAdapter, Validator } from './types.js'

const testValidator: Validator = {
  name: 'test',
  parse(schema, value, path) {
    const fn = schema as (v: unknown) => unknown
    try {
      return fn(value)
    } catch (err) {
      throw new SchemaValidationError([{ path, message: err instanceof Error ? err.message : String(err) }])
    }
  },
}

function requireTitle(value: unknown): unknown {
  if (typeof (value as { title?: unknown })?.title !== 'string') {
    throw new Error('title is required')
  }
  return value
}

interface PostRecord {
  id: string
  title: string
  authorId: string
}

function matches(where: Record<string, unknown>) {
  return (record: PostRecord) => Object.entries(where).every(([key, value]) => value === undefined || (record as unknown as Record<string, unknown>)[key] === value)
}

function fakePostsDb(): DbAdapter {
  const posts = new Map<string, PostRecord>()
  let idCounter = 1
  const client = {
    posts: {
      async findMany({ where }: { where: Record<string, unknown> }) {
        return [...posts.values()].filter(matches(where))
      },
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return [...posts.values()].find(matches(where)) ?? null
      },
      async create({ data }: { data: Partial<PostRecord> }) {
        const id = String(idCounter++)
        const record = { id, ...data } as PostRecord
        posts.set(id, record)
        return record
      },
      async update({ where, data }: { where: { id: string }; data: Partial<PostRecord> }) {
        const existing = posts.get(where.id) as PostRecord
        const updated = { ...existing, ...data }
        posts.set(where.id, updated)
        return updated
      },
      async delete({ where }: { where: { id: string } }) {
        posts.delete(where.id)
      },
    },
  }
  return {
    client,
    translateScope: (filter) => filter,
    normalizeError: (err) => (err instanceof Error ? err : null),
  }
}

describe('App routing', () => {
  it('dispatches a matching route and returns its handler result', async () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({ pong: true }) })
    const res = await app.inject({ method: 'GET', path: '/ping' })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ pong: true })
  })

  it('returns 404 for an unmatched route', async () => {
    const app = createApp({ framework: fakeFramework() })
    const res = await app.inject({ method: 'GET', path: '/missing' })
    expect(res.status).toBe(404)
  })

  it('extracts path params', async () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/users/:id', auth: false, handler: async (ctx) => ctx.params })
    const res = await app.inject({ method: 'GET', path: '/users/42' })
    expect(res.body).toEqual({ id: '42' })
  })

  it('always sets an x-request-id response header', async () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({}) })
    const res = await app.inject({ method: 'GET', path: '/ping' })
    expect(res.headers['x-request-id']).toEqual(expect.any(String))
  })
})

describe('App validation', () => {
  it('returns 422 with details when body validation fails', async () => {
    const app = createApp({ framework: fakeFramework(), validator: testValidator })
    app.route({ method: 'POST', path: '/posts', auth: false, body: requireTitle, handler: async (ctx) => ctx.body })
    const res = await app.inject({ method: 'POST', path: '/posts', body: {} })
    expect(res.status).toBe(422)
    expect((res.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR')
  })

  it('passes validated body through to the handler', async () => {
    const app = createApp({ framework: fakeFramework(), validator: testValidator })
    app.route({ method: 'POST', path: '/posts', auth: false, body: requireTitle, handler: async (ctx) => ctx.body })
    const res = await app.inject({ method: 'POST', path: '/posts', body: { title: 'Hello' } })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ title: 'Hello' })
  })
})

describe('App auth, roles, and scope', () => {
  it('rejects an unauthenticated request to an auth-required route', async () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/me', auth: true, handler: async (ctx) => ctx.user })
    const res = await app.inject({ method: 'GET', path: '/me' })
    expect(res.status).toBe(401)
  })

  it('allows an injected user to satisfy auth: true', async () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/me', auth: true, handler: async (ctx) => ctx.user })
    const user: AuthenticatedUser = { id: '1', role: 'admin' }
    const res = await app.inject({ method: 'GET', path: '/me', as: user })
    expect(res.status).toBe(200)
    expect(res.body).toEqual(user)
  })

  it('enforces role requirements', async () => {
    const app = createApp({ framework: fakeFramework() })
    app.route({ method: 'GET', path: '/admin', auth: true, roles: ['admin'], handler: async () => ({}) })
    const forbidden = await app.inject({ method: 'GET', path: '/admin', as: { id: '1', role: 'viewer' } })
    expect(forbidden.status).toBe(403)
    const allowed = await app.inject({ method: 'GET', path: '/admin', as: { id: '1', role: 'admin' } })
    expect(allowed.status).toBe(200)
  })

  it('resolves ctx.scope from the configured scope map', async () => {
    const app = createApp({
      framework: fakeFramework(),
      scope: { posts: { author: (user) => ({ authorId: user.id }) } },
    })
    app.route({ method: 'GET', path: '/scoped-posts', auth: true, scope: 'posts', handler: async (ctx) => ctx.scope })
    const res = await app.inject({ method: 'GET', path: '/scoped-posts', as: { id: '7', role: 'author' } })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ authorId: '7' })
  })

  it('throws a scope audit violation when scopeAudit is "throw" and the handler ignores ctx.scope', async () => {
    const app = createApp({
      framework: fakeFramework(),
      scopeAudit: 'throw',
      scope: { posts: { author: (user) => ({ authorId: user.id }) } },
    })
    app.route({ method: 'GET', path: '/scoped-posts', auth: true, scope: 'posts', handler: async () => ({ ignoredScope: true }) })
    const res = await app.inject({ method: 'GET', path: '/scoped-posts', as: { id: '7', role: 'author' } })
    expect(res.status).toBe(500)
  })
})

describe('App resource()', () => {
  function buildApp() {
    const app = createApp({ framework: fakeFramework(), db: fakePostsDb(), validator: testValidator })
    app.resource('/posts', { model: 'posts', schema: { create: requireTitle } })
    return app
  }

  it('creates, lists, gets, updates, and deletes through the generated CRUD routes', async () => {
    const app = buildApp()
    const user: AuthenticatedUser = { id: '1', role: 'admin' }

    const created = await app.inject({ method: 'POST', path: '/posts', body: { title: 'First' }, as: user })
    expect(created.status).toBe(200)
    const id = (created.body as { id: string }).id

    const list = await app.inject({ method: 'GET', path: '/posts', as: user })
    expect(list.body).toEqual([{ id, title: 'First' }])

    const got = await app.inject({ method: 'GET', path: `/posts/${id}`, as: user })
    expect(got.body).toEqual({ id, title: 'First' })

    const updated = await app.inject({ method: 'PATCH', path: `/posts/${id}`, body: { title: 'Updated' }, as: user })
    expect(updated.body).toEqual({ id, title: 'Updated' })

    const deleted = await app.inject({ method: 'DELETE', path: `/posts/${id}`, as: user })
    expect(deleted.body).toEqual({ success: true })

    const afterDelete = await app.inject({ method: 'GET', path: `/posts/${id}`, as: user })
    expect(afterDelete.status).toBe(404)
  })
})

describe('App group()', () => {
  it('applies prefix and inherited auth/roles to nested routes', async () => {
    const app = createApp({ framework: fakeFramework() })
    app.group({ prefix: '/admin', auth: true, roles: ['admin'] }, (group) => {
      group.route({ method: 'GET', path: '/dashboard', handler: async () => ({ ok: true }) })
    })

    const unauthenticated = await app.inject({ method: 'GET', path: '/admin/dashboard' })
    expect(unauthenticated.status).toBe(401)

    const wrongRole = await app.inject({ method: 'GET', path: '/admin/dashboard', as: { id: '1', role: 'viewer' } })
    expect(wrongRole.status).toBe(403)

    const ok = await app.inject({ method: 'GET', path: '/admin/dashboard', as: { id: '1', role: 'admin' } })
    expect(ok.status).toBe(200)
    expect(ok.body).toEqual({ ok: true })
  })
})

describe('App middleware', () => {
  it('runs custom middleware around the handler and can rewrite the response', async () => {
    const app = createApp({
      framework: fakeFramework(),
      middleware: [
        async (ctx, next) => {
          await next()
          ctx.response.headers['x-custom'] = 'applied'
        },
      ],
    })
    app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({ pong: true }) })
    const res = await app.inject({ method: 'GET', path: '/ping' })
    expect(res.headers['x-custom']).toBe('applied')
  })
})

describe('App openapi()', () => {
  it('serves a generated spec that includes registered routes', async () => {
    const app = createApp({ framework: fakeFramework(), validator: testValidator })
    app.route({ method: 'GET', path: '/users/:id', auth: false, handler: async () => ({}) })
    app.openapi({ info: { title: 'Test API', version: '1.0.0' }, json: '/openapi.json' })

    const res = await app.inject({ method: 'GET', path: '/openapi.json' })
    expect(res.status).toBe(200)
    const spec = res.body as { paths: Record<string, unknown> }
    expect(spec.paths).toHaveProperty('/users/{id}')
  })

  it('serves a real interactive HTML docs page at "serve", pointing at "json"', async () => {
    const app = createApp({ framework: fakeFramework(), validator: testValidator })
    app.route({ method: 'GET', path: '/users/:id', auth: false, handler: async () => ({}) })
    app.openapi({ info: { title: 'Test API', version: '1.0.0' }, json: '/openapi.json', serve: '/docs' })

    const res = await app.inject({ method: 'GET', path: '/docs' })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    const html = res.body as Buffer
    expect(Buffer.isBuffer(html)).toBe(true)
    const text = html.toString('utf8')
    expect(text).toContain('<title>Test API</title>')
    expect(text).toContain('data-url="/openapi.json"')
    expect(text).toContain('@scalar/api-reference')
  })

  it('inlines the spec into the docs page when only "serve" is configured, no "json"', async () => {
    const app = createApp({ framework: fakeFramework(), validator: testValidator })
    app.route({ method: 'GET', path: '/users/:id', auth: false, handler: async () => ({}) })
    app.openapi({ info: { title: 'Test API', version: '1.0.0' }, serve: '/docs' })

    const res = await app.inject({ method: 'GET', path: '/docs' })
    const text = (res.body as Buffer).toString('utf8')
    expect(text).toContain('data-configuration=')
    expect(text).toContain('/users/{id}')
    expect(text).not.toContain('data-url=')
  })
})

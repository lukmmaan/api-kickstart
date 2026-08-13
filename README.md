# api-kickstart

> Stop rewriting the same 800 lines on every new project. Auth, authorization, validation, CORS, error handling, database, and message broker — wired together with sane defaults, swappable everywhere.

[![npm version](https://img.shields.io/npm/v/api-kickstart.svg)](https://www.npmjs.com/package/api-kickstart)
[![bundle size](https://img.shields.io/bundlephobia/minzip/api-kickstart)](https://bundlephobia.com/package/api-kickstart)
[![license](https://img.shields.io/npm/l/api-kickstart.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/api-kickstart.svg)](https://www.typescriptlang.org/)

---

## The problem

Day 1 and Day 2 of every new backend project look identical:

- Wire up JWT, then refresh tokens, then a blacklist for logout
- Copy the same `authenticate` and `requireRole` middleware from the last project
- Copy the CORS config and get it subtly wrong
- Copy the error handler, the request logger, the graceful shutdown
- Set up validation, and remember to validate `params` too, not just `body`
- Write `if (user.role !== 'admin') query.userId = user.id` in forty controllers
- Connect the database, connect the queue, handle reconnects

None of it is hard. All of it is tedious, and every copy drifts a little further from the last one. The forty-first controller is the one where somebody forgets the scope filter, and now users can read each other's data.

`api-kickstart` is that layer, written once.

**What it is:** a composition layer over your framework, with pluggable auth strategies, validators, database adapters, and brokers.

**What it is not:** a framework. It doesn't own your app, doesn't own your routes, and can be removed one piece at a time. Every part is opt-in.

---

## Table of contents

- [Install](#install)
- [60-second start](#60-second-start)
- [Core concepts](#core-concepts)
- [Authentication](#authentication)
  - [JWT](#jwt)
  - [Session](#session)
  - [API key](#api-key)
  - [Basic auth](#basic-auth)
  - [OAuth / OIDC](#oauth--oidc)
  - [Multiple strategies](#multiple-strategies)
  - [Custom strategy](#custom-strategy)
- [Authorization](#authorization)
- [Scope: row-level filtering](#scope-row-level-filtering)
- [Validation](#validation)
- [Routing](#routing)
- [CORS](#cors)
- [Middleware](#middleware)
- [Request context](#request-context)
- [Errors](#errors)
- [Database adapters](#database-adapters)
- [Message brokers](#message-brokers)
- [Framework adapters](#framework-adapters)
- [Configuration](#configuration)
- [OpenAPI generation](#openapi-generation)
- [Testing](#testing)
- [Production checklist](#production-checklist)
- [FAQ](#faq)

---

## Install

```bash
npm install api-kickstart
```

Then add only the adapters you need:

```bash
# framework
npm install @kickstart/express      # or @kickstart/fastify, @kickstart/hono

# database
npm install @kickstart/prisma       # or mongoose, drizzle, knex, typeorm, sequelize

# broker (optional)
npm install @kickstart/rabbitmq     # or kafka, redis-stream, sqs, nats, bullmq

# validation (pick one)
npm install @kickstart/zod          # or joi, yup, valibot, typebox
```

The core has no dependencies and pulls in nothing you didn't ask for.

---

## 60-second start

```ts
import { createApp } from 'api-kickstart'
import { express } from '@kickstart/express'
import { jwt } from 'api-kickstart/auth'
import { zod } from '@kickstart/zod'
import { prisma } from '@kickstart/prisma'
import { z } from 'zod'

const app = createApp({
  framework: express(),
  validator: zod(),
  db: prisma(prismaClient),

  auth: jwt({
    secret: env.JWT_SECRET,
    accessTtl: '15m',
    refreshTtl: '30d',
  }),

  cors: 'dev',
})

app.route({
  method: 'GET',
  path: '/orders',
  auth: true,
  roles: ['staff', 'manager', 'admin'],
  scope: 'order',
  query: z.object({
    status: z.enum(['open', 'closed']).optional(),
    limit: z.coerce.number().max(100).default(20),
  }),
  handler: async (ctx) => {
    return ctx.db.order.findMany({
      where: { ...ctx.scope, ...ctx.query },
      take: ctx.query.limit,
    })
  },
})

app.listen(3000)
```

That gives you: JWT verification, role checking, row-level filtering, query validation, CORS, a JSON error handler, request IDs, and graceful shutdown.

---

## Core concepts

Five ideas. Once you have these, the rest of the docs are reference.

**1. Routes are data, not side effects.**
`app.route({...})` registers a plain object. Because routes are inspectable, OpenAPI generation, permission audits, and route listings come for free.

**2. Everything is an adapter.**
Auth strategies, validators, databases, brokers, and frameworks all implement small interfaces. Nothing is hardcoded. If an adapter doesn't exist, writing one is usually under 50 lines.

**3. One context object.**
Handlers receive a `ctx` carrying the user, validated input, scope filter, db, broker, logger, and request ID. No juggling `req`, `res`, `next`.

**4. Fail closed.**
Undefined role in a scope map, missing permission, unknown route config — all deny. Never silently allow. Misconfiguration should break loudly in development, not leak data in production.

**5. Escape hatches everywhere.**
Every layer exposes the underlying object: `ctx.raw.req`, `ctx.raw.res`, `ctx.db.$client`. When the abstraction doesn't fit, drop through it instead of fighting it.

---

## Authentication

Authentication answers *who is this*. It attaches `ctx.user` or fails with `401`.

### JWT

```ts
import { jwt } from 'api-kickstart/auth'

jwt({
  secret: env.JWT_SECRET,          // or `publicKey` / `privateKey` for RS256
  algorithm: 'HS256',              // pinned — tokens with other algs are rejected
  accessTtl: '15m',
  refreshTtl: '30d',
  issuer: 'my-api',
  audience: 'my-app',

  // where to read the token from, in order
  from: ['header:authorization', 'cookie:access_token'],

  // called after signature verification, to load the full user
  resolveUser: async (payload) => db.user.findUnique({ where: { id: payload.sub } }),

  // optional: reject revoked tokens (logout, password change, ban)
  isRevoked: async (payload) => redis.exists(`revoked:${payload.jti}`),
})
```

Built-in token endpoints, if you want them:

```ts
app.useAuthRoutes({
  login:   '/auth/login',     // verify credentials → access + refresh token
  refresh: '/auth/refresh',   // rotate refresh token
  logout:  '/auth/logout',    // revoke by jti
  me:      '/auth/me',
})
```

Refresh tokens are **rotated** by default: using one invalidates it and issues a new pair. If a rotated token is used again, the whole family is revoked — that's the standard defense against stolen refresh tokens.

> Signing and verification use [`jose`](https://github.com/panva/jose) internally. This package handles the flow around tokens; it does not implement its own cryptography.

### Session

```ts
import { session } from 'api-kickstart/auth'

session({
  store: redisStore(redis),        // or memoryStore(), dbStore(db)
  cookieName: 'sid',
  ttl: '7d',
  rolling: true,                   // refresh expiry on activity
  cookie: {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  },
})
```

Session IDs are regenerated on login to prevent session fixation.

### API key

```ts
import { apiKey } from 'api-kickstart/auth'

apiKey({
  from: 'header:x-api-key',
  resolve: async (key) => db.apiKey.findUnique({ where: { hash: sha256(key) } }),
  rateLimit: { window: '1m', max: 100 },
})
```

Keys are compared in constant time. Store hashes, never raw keys — the `resolve` signature nudges you toward this.

### Basic auth

```ts
import { basic } from 'api-kickstart/auth'

basic({ verify: async (user, pass) => checkPassword(user, pass) })
```

Intended for internal tools and health endpoints. Refuses to run over plain HTTP unless you pass `allowInsecure: true`.

### OAuth / OIDC

```ts
import { oidc } from 'api-kickstart/auth'

oidc({
  issuer: 'https://accounts.google.com',
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'https://api.example.com/auth/callback',
  scopes: ['openid', 'email', 'profile'],
  onUser: async (profile) => db.user.upsert({ /* ... */ }),
})
```

Discovery, PKCE, state, and nonce are handled. JWKS keys are cached and rotated automatically.

### Multiple strategies

Pass an array. They're tried in order; the first success wins.

```ts
auth: [
  jwt({ /* ... */ }),          // mobile and SPA clients
  session({ /* ... */ }),      // server-rendered admin panel
  apiKey({ /* ... */ }),       // machine-to-machine
]
```

Restrict per route when it matters:

```ts
app.route({
  path: '/webhooks/stripe',
  auth: 'apiKey',        // only this strategy is accepted here
  // ...
})
```

### Custom strategy

One method:

```ts
const ldap = {
  name: 'ldap',
  async authenticate(ctx) {
    const user = await ldapClient.verify(ctx.headers.authorization)
    return user ?? null      // null → try the next strategy
  },
}
```

---

## Authorization

Authorization answers *is this allowed*. It runs after authentication and fails with `403`.

### Roles

```ts
app.route({ path: '/admin/users', roles: ['admin'], /* ... */ })
```

Hierarchies, if you want them:

```ts
createApp({
  roleHierarchy: {
    admin:   ['manager'],
    manager: ['staff'],
    staff:   [],
  },
})
```

An `admin` now satisfies `roles: ['staff']` without being listed everywhere.

### Permissions

Finer-grained than roles, and usually what you actually want long term:

```ts
createApp({
  permissions: {
    admin:   ['*'],
    manager: ['order:read', 'order:write', 'report:read'],
    staff:   ['order:read'],
  },
})

app.route({ path: '/orders', permissions: ['order:read'], /* ... */ })
```

Wildcards work per segment: `order:*` grants every order action.

### Ownership

For rules that depend on the record itself:

```ts
app.route({
  method: 'PATCH',
  path: '/orders/:id',
  load: (ctx) => ctx.db.order.findUnique({ where: { id: ctx.params.id } }),
  can: async (ctx, order) => order.createdBy === ctx.user.id || ctx.user.role === 'admin',
  handler: async (ctx) => { /* ... */ },
})
```

`load` runs first, `can` receives the loaded record, and a `404` is returned — not a `403` — when the record doesn't exist, so you don't leak which IDs are real.

---

## Scope: row-level filtering

This is the piece most auth libraries stop short of, and the one that causes real breaches.

Roles decide whether you can call `GET /orders`. Scope decides **which orders come back**.

```ts
createApp({
  scope: {
    order: {
      admin:   () => ({}),                          // everything
      manager: (u) => ({ branchId: u.branchId }),   // their branch
      staff:   (u) => ({ createdBy: u.id }),        // their own
    },
    invoice: {
      admin:   () => ({}),
      manager: (u) => ({ branchId: u.branchId }),
      // `staff` is not listed → staff are denied entirely
    },
  },
})
```

In a handler:

```ts
handler: async (ctx) => ctx.db.order.findMany({ where: ctx.scope })
```

`ctx.scope` is the filter object for the current user, in your database's own query dialect — the adapter translates it.

### It applies to writes too

Filtering reads while leaving writes open is the most common half-implementation. A `findByIdAndUpdate` with an ID from another tenant will happily succeed.

Scope is enforced on `update` and `delete` as well. A staff member updating someone else's order gets a `404`, because within their scope that row does not exist.

### Fail closed

If a role isn't defined for a resource, access is denied. There is no implicit "if unspecified, allow all." Getting this backwards is how `{}` ends up meaning "every row in the table."

### Audit mode

Turn this on in staging to find queries that bypassed scope entirely:

```ts
createApp({ scopeAudit: 'warn' })   // 'off' | 'warn' | 'throw'
```

Every query that runs on a scoped resource without a scope filter is logged with a stack trace pointing at the offending line. Run it as `throw` in CI and you'll never ship the forty-first controller.

### Hierarchies

For "a manager sees their own data plus everyone below them":

```ts
scope: {
  order: {
    manager: async (u) => ({ createdBy: { in: await getSubordinateIds(u.id) } }),
  },
}
```

Resolvers can be async, and results are cached per request.

---

## Validation

Adapters exist for Zod, Joi, Yup, Valibot, and TypeBox. Pick one; the route API is identical.

```ts
app.route({
  method: 'POST',
  path: '/orders/:id/items',
  params: z.object({ id: z.string().uuid() }),
  query:  z.object({ notify: z.coerce.boolean().default(false) }),
  body:   z.object({
    sku: z.string().min(1),
    qty: z.number().int().positive(),
  }),
  headers: z.object({ 'idempotency-key': z.string().optional() }),
  response: z.object({ id: z.string(), total: z.number() }),
  handler: async (ctx) => {
    ctx.params.id    // typed
    ctx.body.qty     // typed
  },
})
```

With Joi:

```ts
import { joi } from '@kickstart/joi'
import Joi from 'joi'

createApp({ validator: joi() })

app.route({
  body: Joi.object({
    sku: Joi.string().required(),
    qty: Joi.number().integer().positive(),
  }),
  // ...
})
```

**Types flow through.** With Zod, Valibot, or TypeBox, `ctx.body` is fully typed from the schema — no manual interface, no casting.

**Response validation** runs in development and is skipped in production by default. It catches the case where you accidentally return a password hash.

Failures produce a consistent shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [
      { "path": "body.qty", "message": "Expected positive integer, received -3" }
    ],
    "requestId": "req_01HXYZ"
  }
}
```

---

## Routing

### Single route

```ts
app.route({
  method: 'POST',
  path: '/orders',
  auth: true,
  roles: ['staff'],
  scope: 'order',
  body: CreateOrderSchema,
  handler: async (ctx) => { /* ... */ },

  // optional per-route settings
  rateLimit: { window: '1m', max: 10 },
  timeout: '10s',
  idempotent: true,        // dedupe by Idempotency-Key header
  tags: ['orders'],        // used in OpenAPI output
  summary: 'Create an order',
})
```

### Groups

Shared config, applied to everything inside:

```ts
app.group({ prefix: '/admin', auth: true, roles: ['admin'] }, (admin) => {
  admin.route({ method: 'GET',  path: '/users',     handler: listUsers })
  admin.route({ method: 'POST', path: '/users',     handler: createUser })
  admin.route({ method: 'GET',  path: '/audit-log', handler: auditLog })
})
```

Groups nest, and inner settings override outer ones.

### CRUD shorthand

For the endpoints that are always the same:

```ts
app.resource('/orders', {
  model: 'order',
  scope: 'order',
  schema: { create: CreateOrderSchema, update: UpdateOrderSchema },
  only: ['list', 'get', 'create', 'update'],   // no delete
  roles: { list: ['staff'], create: ['staff'], update: ['manager'] },
  hooks: {
    beforeCreate: async (ctx, data) => ({ ...data, createdBy: ctx.user.id }),
    afterCreate:  async (ctx, order) => ctx.broker.publish('order.created', order),
  },
})
```

Generates list (paginated), get, create, update, and delete — all scope-aware. Drop down to `app.route` the moment you need something specific; the two mix freely.

### Introspection

```ts
app.routes()
// [{ method, path, auth, roles, permissions, scope, schemas, tags }, ...]
```

Useful for permission audits, docs, and catching a route you forgot to protect.

---

## CORS

Three presets and a full escape hatch.

```ts
cors: 'dev'      // reflect any origin, allow credentials — local only
cors: 'strict'   // deny everything not explicitly listed
cors: 'off'
```

```ts
cors: {
  origin: ['https://app.example.com', /\.example\.com$/],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['content-type', 'authorization', 'idempotency-key'],
  exposedHeaders: ['x-request-id', 'x-total-count'],
  maxAge: 86400,
}
```

`'dev'` refuses to start when `NODE_ENV=production`. Wildcard origin plus credentials is the single most common CORS mistake, and it's blocked outright rather than silently ignored.

---

## Middleware

Your own, at any level:

```ts
createApp({ middleware: [requestLogger(), helmet()] })     // global
app.group({ middleware: [auditTrail()] }, /* ... */)       // group
app.route({ middleware: [captureRawBody()], /* ... */ })   // single route
```

Signature is framework-independent:

```ts
const timing = async (ctx, next) => {
  const start = Date.now()
  await next()
  ctx.res.header('x-response-time', `${Date.now() - start}ms`)
}
```

Existing Express or Fastify middleware still works — pass it through `adapt()`:

```ts
import { adapt } from '@kickstart/express'
middleware: [adapt(someExpressMiddleware)]
```

Built-ins you can turn on: `requestId`, `logger`, `rateLimit`, `compression`, `helmet`, `bodyLimit`, `timeout`, `idempotency`, `gracefulShutdown`.

---

## Request context

Everything a handler needs, in one object:

```ts
handler: async (ctx) => {
  ctx.user          // authenticated user, typed
  ctx.body          // validated body
  ctx.query         // validated query
  ctx.params        // validated params
  ctx.scope         // row-level filter for this user
  ctx.db            // database client
  ctx.broker        // message broker
  ctx.logger        // logger with requestId already bound
  ctx.requestId
  ctx.raw.req       // underlying framework request
  ctx.raw.res
}
```

### Anywhere else in your code

Backed by `AsyncLocalStorage`, so you don't have to thread `user` through every layer:

```ts
import { currentUser, currentRequestId } from 'api-kickstart/context'

// deep inside a service or model hook
const user = currentUser()
```

This is what makes audit logging painless — your model hooks can record *who* changed something without every function signature growing a `userId` parameter.

---

## Errors

Throw; the error handler formats it.

```ts
import { NotFound, Forbidden, Conflict, BadRequest } from 'api-kickstart/errors'

if (!order) throw new NotFound('Order not found')
if (order.locked) throw new Conflict('Order is locked', { orderId: order.id })
```

Every response uses the same envelope:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Order not found",
    "requestId": "req_01HXYZ"
  }
}
```

Unknown errors become a generic `500` with the details logged, never returned. Stack traces are included only when `NODE_ENV !== 'production'`.

Adapter-specific errors are normalized: a Prisma unique-constraint violation, a Mongo duplicate key, and a Postgres `23505` all surface as `CONFLICT`. You stop writing per-database error mapping.

---

## Database adapters

The adapter's job is small: give the app a client, translate scope filters into that database's query dialect, and normalize errors.

| Adapter | Databases |
|---|---|
| `@kickstart/prisma` | Postgres, MySQL, SQLite, SQL Server, CockroachDB, MongoDB |
| `@kickstart/drizzle` | Postgres, MySQL, SQLite, Turso, Neon, PlanetScale |
| `@kickstart/mongoose` | MongoDB |
| `@kickstart/knex` | Postgres, MySQL, SQLite, Oracle, SQL Server |
| `@kickstart/typeorm` | most SQL databases |
| `@kickstart/sequelize` | Postgres, MySQL, MariaDB, SQLite, SQL Server |
| `@kickstart/mongodb` | MongoDB driver, no ODM |
| `@kickstart/pg` | raw `node-postgres` |

```ts
import { prisma } from '@kickstart/prisma'
db: prisma(new PrismaClient())
```

```ts
import { mongoose } from '@kickstart/mongoose'
db: mongoose(connection)
```

### Transactions

```ts
handler: async (ctx) => {
  return ctx.db.transaction(async (tx) => {
    const order = await tx.order.create({ data: ctx.body })
    await tx.stock.decrement({ where: { sku: ctx.body.sku } })
    return order
  })
}
```

If the adapter's database doesn't support transactions, this throws at startup rather than silently running without one.

### Writing your own adapter

```ts
interface DbAdapter {
  client: unknown
  translateScope(filter: ScopeFilter): unknown
  normalizeError(err: unknown): AppError | null
  transaction?<T>(fn: (tx: unknown) => Promise<T>): Promise<T>
  healthcheck?(): Promise<boolean>
  close?(): Promise<void>
}
```

A conformance suite is published so you can verify yours:

```ts
import { runDbConformance } from 'api-kickstart/testing'
runDbConformance(() => myAdapter())
```

---

## Message brokers

Optional. Skip the import and nothing broker-related is loaded.

| Adapter | Broker |
|---|---|
| `@kickstart/rabbitmq` | RabbitMQ (AMQP 0-9-1) |
| `@kickstart/kafka` | Kafka, Redpanda |
| `@kickstart/redis-stream` | Redis Streams |
| `@kickstart/bullmq` | BullMQ (Redis) |
| `@kickstart/sqs` | AWS SQS + SNS |
| `@kickstart/nats` | NATS, JetStream |
| `@kickstart/mqtt` | MQTT |
| `@kickstart/pubsub` | Google Cloud Pub/Sub |
| `@kickstart/memory` | in-process, for tests |

### Publishing

```ts
import { rabbitmq } from '@kickstart/rabbitmq'

const app = createApp({
  broker: rabbitmq({ url: env.AMQP_URL, exchange: 'app' }),
})

handler: async (ctx) => {
  const order = await ctx.db.order.create({ data: ctx.body })
  await ctx.broker.publish('order.created', order)
  return order
}
```

Published messages automatically carry the current `requestId` and user ID as headers, so a trace survives across service boundaries.

### Consuming

```ts
app.consume({
  topic: 'order.created',
  group: 'billing-service',
  schema: OrderCreatedSchema,      // same validators as HTTP routes
  concurrency: 5,
  retry: { attempts: 5, backoff: 'exponential', maxDelay: '5m' },
  deadLetter: 'order.created.dlq',
  handler: async (ctx) => {
    ctx.message        // validated payload
    ctx.attempt        // 1-based retry counter
    ctx.db             // same clients as HTTP handlers
    ctx.logger
  },
})
```

Consumers get the same context, validation, error normalization, and logging as HTTP routes. One mental model for both.

### Transactional outbox

The hard part of publishing events: the database commits, then the broker call fails, and the event is gone forever.

```ts
broker: rabbitmq({ url: env.AMQP_URL, outbox: true })
```

With `outbox: true`, `publish()` inside a transaction writes to an outbox table in that same transaction. A background relay delivers it afterward, with at-least-once semantics.

That means consumers **must be idempotent**. Each message carries a stable `messageId` for deduplication.

### Graceful shutdown

On `SIGTERM`, in order: stop accepting HTTP requests → let in-flight requests finish → stop pulling new messages → let in-flight messages finish → close the broker → close the database → exit. Each stage has its own timeout.

Getting this order wrong is how jobs get cut in half mid-execution.

---

## Framework adapters

| Adapter | Framework |
|---|---|
| `@kickstart/express` | Express 4 and 5 |
| `@kickstart/fastify` | Fastify 4 and 5 |
| `@kickstart/hono` | Hono — Node, Bun, Deno, Cloudflare Workers |
| `@kickstart/koa` | Koa |
| `@kickstart/nest` | NestJS module |
| `@kickstart/http` | Node's built-in `http`, no framework |

Same route definitions across all of them. Switching frameworks means changing one import.

Already have an Express app? Mount instead of replacing:

```ts
const existing = express()
existing.use('/v2', app.handler())
```

---

## Configuration

Environment variables, validated at boot:

```ts
import { env } from 'api-kickstart/env'
import { z } from 'zod'

export const config = env({
  NODE_ENV:     z.enum(['development', 'test', 'production']),
  PORT:         z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET:   z.string().min(32),
  AMQP_URL:     z.string().url().optional(),
})
```

Missing or malformed variables fail at startup with a readable list of what's wrong — not at 2am when the first request touches that code path.

```bash
npx api-kickstart env:example    # generate .env.example from your schema
```

---

## OpenAPI generation

Because routes are data, the spec is free:

```ts
app.openapi({
  info: { title: 'My API', version: '1.0.0' },
  servers: [{ url: 'https://api.example.com' }],
  serve: '/docs',        // Scalar UI
  json: '/openapi.json',
})
```

Paths, parameters, request and response schemas, auth requirements, and error shapes are all derived from what you already declared. No decorators, no JSDoc comments, no second source of truth that drifts.

---

## Testing

```ts
import { createTestApp } from 'api-kickstart/testing'

const app = createTestApp({
  ...config,
  broker: memoryBroker(),
})

const res = await app.inject({
  method: 'GET',
  path: '/orders',
  as: { id: 'u1', role: 'staff' },   // skip real login
})

expect(res.status).toBe(200)
expect(app.broker.published).toContainEqual(
  expect.objectContaining({ topic: 'order.created' })
)
```

`as` builds a valid authenticated context directly, so tests don't need to hit a login endpoint. The memory broker records everything published for assertions.

---

## Production checklist

The CLI checks these for you:

```bash
npx api-kickstart doctor
```

- [ ] `cors: 'dev'` is not used in production
- [ ] `JWT_SECRET` is at least 32 bytes and not the example value
- [ ] Every route has either `auth: true` or an explicit `auth: false`
- [ ] Every scoped resource defines all roles, or explicitly denies them
- [ ] `scopeAudit` reports zero unscoped queries
- [ ] Rate limiting is enabled on auth endpoints
- [ ] Refresh token rotation is on
- [ ] Response validation passes across the test suite
- [ ] Graceful shutdown is wired to `SIGTERM`
- [ ] Broker consumers are idempotent when the outbox is enabled

---

## FAQ

**Isn't this just a framework?**
It composes your framework rather than replacing it. Routes stay data, `ctx.raw` exposes the underlying objects, and you can mount it on part of an existing app. If you delete it, you're left with ordinary Express or Fastify code, not a rewrite.

**Why not Passport, Better Auth, or Auth.js?**
Use them if they fit. They handle authentication well and stop there. This covers the rest of the day-one setup — validation, scope, errors, database, broker — and its distinctive piece is **row-level scope**, which none of them address.

**Do I have to use all of it?**
No. Every option is optional. Use it for auth and scope only, or as a broker consumer runner with no HTTP at all.

**Is it safe to write my own auth?**
Not the cryptography, and this package doesn't. `jose` handles JWT, `argon2` handles hashing. What's here is the wiring around them, which is where most real bugs live.

**How does this handle multi-tenancy?**
Scope is the mechanism. Define `tenantId` filters per resource and enable `scopeAudit: 'throw'` in CI so an unscoped query can never reach production.

**What about migrations?**
Out of scope. Use your ORM's migration tool.

---

## Monorepo layout

This repository is a workspace of independent packages:

- `packages/core` — the `api-kickstart` package itself (routing, context, auth strategies, authorization, CORS, errors, env, testing, OpenAPI). Split into focused modules (`router.ts`, `group.ts`, `middleware.ts`, `authorize.ts`, `cors.ts`, `resource.ts`, `openapi.ts`, `auth/*`) rather than one file.
- `packages/<name>` — one package per adapter, published as `@kickstart/<name>`. Each wraps its underlying library's real client and, where it has more than one concern, splits into `index.ts` (the factory), `types.ts` (options), and `errors.ts` (error-code normalization to `AppError` subclasses).

Every adapter package is a working implementation, not a placeholder — see the [Roadmap](#roadmap) for what's still open (OIDC and the CLI).

---

## Roadmap

- [x] Core: routing, context, roles/permissions/scope, CORS, errors, env, resource(), OpenAPI generation
- [x] Auth strategies: JWT (with refresh rotation), session, API key, basic
- [x] Framework adapters: Express, Fastify, native `http`, Hono, Koa, NestJS
- [x] Database adapters: `pg`, Prisma, Drizzle, Mongoose, Knex, TypeORM, Sequelize, MongoDB
- [x] Broker adapters: in-memory, RabbitMQ, Kafka, Redis Streams, BullMQ, SQS, NATS, MQTT, Pub/Sub
- [x] Validator adapters: Zod, Joi, Yup, Valibot, TypeBox
- [ ] OIDC strategy (discovery, PKCE, JWKS rotation)
- [ ] Transactional outbox for brokers
- [ ] `npx api-kickstart doctor` / `env:example` CLI

Every adapter listed above as done is a real implementation wired to its actual library, not a placeholder. Contributions welcome — the OIDC strategy and the CLI are the two pieces still open.

---

## License

MIT

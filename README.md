# api-kickstart

> Stop rewriting the same 800 lines on every new project. Auth, authorization, validation, CORS, error handling, database, and message broker — wired together with sane defaults, swappable everywhere.

[![npm version](https://img.shields.io/npm/v/%40api-kickstart%2Fapi-kickstart.svg)](https://www.npmjs.com/package/@api-kickstart/api-kickstart)
[![CI](https://github.com/lukmmaan/api-kickstart/actions/workflows/ci.yml/badge.svg)](https://github.com/lukmmaan/api-kickstart/actions/workflows/ci.yml)
[![bundle size](https://img.shields.io/bundlephobia/minzip/%40api-kickstart%2Fapi-kickstart)](https://bundlephobia.com/package/@api-kickstart/api-kickstart)
[![license](https://img.shields.io/npm/l/%40api-kickstart%2Fapi-kickstart.svg)](./LICENSE)
[![types](https://img.shields.io/npm/types/%40api-kickstart%2Fapi-kickstart.svg)](https://www.typescriptlang.org/)

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
  - [Password hashing](#password-hashing)
  - [Session](#session)
  - [API key](#api-key)
  - [Basic auth](#basic-auth)
  - [OAuth / OIDC](#oauth--oidc)
  - [Multiple strategies](#multiple-strategies)
  - [Custom strategy](#custom-strategy)
- [Authorization](#authorization)
- [Scope: row-level filtering](#scope-row-level-filtering)
- [Validation](#validation)
  - [Zod](#zod)
  - [Joi](#joi)
  - [Yup](#yup)
  - [Valibot](#valibot)
  - [TypeBox](#typebox)
  - [Writing your own validator](#writing-your-own-validator)
- [Regex patterns](#regex-patterns)
- [File uploads](#file-uploads)
- [Routing](#routing)
  - [Single route](#single-route)
  - [Route config reference](#route-config-reference)
  - [Groups](#groups)
  - [CRUD shorthand](#crud-shorthand)
  - [Introspection](#introspection)
- [CORS](#cors)
- [Middleware](#middleware)
  - [Built-ins reference](#built-ins-reference)
  - [Audit logging](#audit-logging)
- [Request context](#request-context)
- [Errors](#errors)
- [Database adapters](#database-adapters)
  - [pg](#pg)
  - [Prisma](#prisma)
  - [Drizzle](#drizzle)
  - [Mongoose](#mongoose)
  - [Knex](#knex)
  - [TypeORM](#typeorm)
  - [Sequelize](#sequelize)
  - [MongoDB driver](#mongodb-driver)
  - [Transactions](#transactions)
  - [Writing your own database adapter](#writing-your-own-database-adapter)
- [Message brokers](#message-brokers)
  - [RabbitMQ](#rabbitmq)
  - [Kafka](#kafka)
  - [Redis Streams](#redis-streams)
  - [BullMQ](#bullmq)
  - [AWS SQS](#aws-sqs)
  - [NATS](#nats)
  - [MQTT](#mqtt)
  - [Google Cloud Pub/Sub](#google-cloud-pubsub)
  - [In-memory (tests)](#in-memory-tests)
  - [Publishing](#publishing)
  - [Consuming](#consuming)
  - [Transactional outbox](#transactional-outbox)
  - [Writing your own broker adapter](#writing-your-own-broker-adapter)
  - [Graceful shutdown](#graceful-shutdown)
- [Storage](#storage)
  - [Writing your own storage adapter](#writing-your-own-storage-adapter)
- [Logging](#logging)
  - [Writing your own logger](#writing-your-own-logger)
- [Redis-backed stores and lock](#redis-backed-stores-and-lock)
- [Webhooks](#webhooks)
- [Framework adapters](#framework-adapters)
  - [Express](#express)
  - [Fastify](#fastify)
  - [Hono](#hono)
  - [Koa](#koa)
  - [NestJS](#nestjs)
  - [Node `http`](#node-http)
  - [Writing your own framework adapter](#writing-your-own-framework-adapter)
- [Configuration](#configuration)
- [OpenAPI generation](#openapi-generation)
- [Health & metrics](#health--metrics)
- [Scheduled tasks](#scheduled-tasks)
- [Testing](#testing)
- [CLI](#cli)
- [Production checklist](#production-checklist)
- [FAQ](#faq)
- [Repository layout](#repository-layout)
- [Roadmap](#roadmap)
- [License](#license)

---

## Install

```bash
npm install @api-kickstart/api-kickstart
```

That's it — one command. Every framework, database, broker, validator, storage, and logging adapter (Express, Fastify, Hono, Koa, NestJS, `pg`, Prisma-compatible, Drizzle, Mongoose, Knex, TypeORM, Sequelize, MongoDB, RabbitMQ, Kafka, Redis, BullMQ, SQS, NATS, MQTT, Pub/Sub, Zod, Joi, Yup, Valibot, TypeBox, S3, Pino, and more) ships bundled as a regular dependency, so it's already in `node_modules` — no separate `npm install express` / `npm install pg` / `npm install zod` afterwards, no picking which ones to install up front. Each adapter is still only *loaded* when you actually `import` its subpath (`@api-kickstart/api-kickstart/express`, `@api-kickstart/api-kickstart/pg`, `@api-kickstart/api-kickstart/zod`, and so on), so unused adapters don't cost you anything at runtime — the tradeoff is a larger `node_modules` on disk in exchange for zero extra install steps.

The one exception is Prisma: `db: prisma(client)` takes any object shaped like a `PrismaClient`, and `@prisma/client` itself has to be generated against *your* schema (`prisma generate`), so it can't be bundled — install and generate it yourself if you use that adapter.

---

## 60-second start

```ts
import { createApp } from '@api-kickstart/api-kickstart'
import { express } from '@api-kickstart/api-kickstart/express'
import { jwt } from '@api-kickstart/api-kickstart/auth'
import { zod } from '@api-kickstart/api-kickstart/zod'
import { prisma } from '@api-kickstart/api-kickstart/prisma'
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
Auth strategies, validators, databases, brokers, and frameworks all implement small interfaces. Nothing is hardcoded. If an adapter doesn't exist, writing one is usually under 50 lines — every category below documents the exact interface and links a real one to copy.

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
import { jwt } from '@api-kickstart/api-kickstart/auth'

jwt({
  secret: env.JWT_SECRET,          // or `publicKey` / `privateKey` for RS256 / ES256
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

  // optional: verify username/password for app.useAuthRoutes()'s login endpoint
  verifyCredentials: async ({ username, password }) => {
    const user = await db.user.findUnique({ where: { username } })
    if (!user || !(await verifyPassword(password, user.passwordHash))) return null
    return user
  },

  // optional: persist refresh-token state somewhere other than memory (see below)
  refreshStore: myRefreshStore,
})
```

`JwtOptions` reference:

| Field | Type | Required | Notes |
|---|---|---|---|
| `secret` | `string` | one of `secret`/`privateKey`+`publicKey` | HMAC secret, for `HS256`/`HS384`/`HS512` |
| `privateKey` / `publicKey` | key material | for RS/ES algorithms | used for `RS256`/`RS384`/`RS512`/`ES256`/`ES384`/`ES512` |
| `algorithm` | `string` | no, default `HS256` | pinned — verification rejects tokens signed with any other algorithm |
| `accessTtl` | `string` | no, default `15m` | duration string: `<n><s\|m\|h\|d>` |
| `refreshTtl` | `string` | no, default `30d` | same format |
| `issuer` | `string` | no | set and verified if provided |
| `audience` | `string` | no | set and verified if provided |
| `from` | `string[]` | no, default `['header:authorization', 'cookie:access_token']` | checked in order; `header:<name>` expects `Bearer <token>`, `cookie:<name>` reads the cookie value directly |
| `resolveUser` | `(payload) => Promise<AuthenticatedUser \| null>` | **yes** | loads the full user record after signature verification passes |
| `isRevoked` | `(payload) => Promise<boolean>` | no | called before `resolveUser`; return `true` to reject an otherwise-valid token |
| `verifyCredentials` | `(creds: { username, password }) => Promise<AuthenticatedUser \| null>` | no | backs `app.useAuthRoutes()`'s `login` endpoint |
| `refreshStore` | `RefreshStore` | no, default in-memory | persists refresh-token rotation state — see below |

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

Rotation state (which `jti`s exist, which are used, which families are revoked) is tracked by a `RefreshStore`:

```ts
interface RefreshRecord {
  jti: string
  familyId: string
  userId: string
  used: boolean
}

interface RefreshStore {
  save(record: RefreshRecord): Promise<void>
  get(jti: string): Promise<RefreshRecord | null>
  markUsed(jti: string): Promise<void>
  revokeFamily(familyId: string): Promise<void>
  isRevokedFamily(familyId: string): Promise<boolean>
}
```

Without a `refreshStore` option, `jwt()` uses an **in-memory** one — fine for a single instance, but state (and therefore rotation/revocation) doesn't survive a restart or get shared across instances behind a load balancer. Implement `RefreshStore` against Redis or your database for that.

> Signing and verification use [`jose`](https://github.com/panva/jose) internally. This package handles the flow around tokens; it does not implement its own cryptography.

### Password hashing

```ts
import { hashPassword, verifyPassword } from '@api-kickstart/api-kickstart/auth'

const hash = await hashPassword(plainTextPassword)   // scrypt, node:crypto, no extra dependency
await verifyPassword(plainTextPassword, hash)          // constant-time compare
```

`hashPassword(password, options?)` — `options: { keyLength?: number /* default 64 */; cost?: number /* default 16384, the scrypt CPU/memory cost parameter N */ }`.

Use these in `jwt()`'s `verifyCredentials` or wherever you check a login. `hashPassword` generates a random 16-byte salt per call and encodes the result as `scrypt$<cost>$<salt-hex>$<hash-hex>` — `verifyPassword` reads the cost and salt back out of the stored string, so there's nothing else to persist. `verifyPassword` returns `false` (never throws) for a malformed hash string.

### Session

```ts
import { session } from '@api-kickstart/api-kickstart/auth'

session({
  store: myStore,                  // required — see SessionStore below
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

`SessionOptions` reference:

| Field | Type | Required | Notes |
|---|---|---|---|
| `store` | `SessionStore` | **yes** | see below — the built-in default is only an in-memory `memoryStore()` |
| `cookieName` | `string` | no, default `'sid'` | |
| `ttl` | `string` | no, default `7d` | duration string |
| `rolling` | `boolean` | no | if `true`, every successful `authenticate()` re-writes the record with a fresh `expiresAt` |
| `cookie.httpOnly` / `.secure` / `.sameSite` | `boolean` / `boolean` / `'strict' \| 'lax' \| 'none'` | no | not enforced by `session()` itself — these are yours to apply when you set the cookie in your login route |

`SessionStore` interface:

```ts
interface SessionRecord {
  userId: string
  data: AuthenticatedUser
  expiresAt: number
}

interface SessionStore {
  get(sid: string): Promise<SessionRecord | null>
  set(sid: string, record: SessionRecord): Promise<void>
  destroy(sid: string): Promise<void>
}
```

`memoryStore()` (imported from the same `/auth` subpath) is the built-in in-memory implementation, useful for local dev and tests. For anything that needs to survive a restart or run behind more than one instance, use `redisSessionStore()` from [Redis-backed stores](#redis-backed-stores-and-lock), or implement `SessionStore` against your own database.

Session IDs are regenerated (`randomUUID()`) every time `create()` is called — i.e. on every login — to prevent session fixation.

### API key

```ts
import { apiKey } from '@api-kickstart/api-kickstart/auth'

apiKey({
  from: 'header:x-api-key',
  resolve: async (key) => db.apiKey.findUnique({ where: { hash: sha256(key) } }),
})
```

`ApiKeyOptions` reference:

| Field | Type | Required | Notes |
|---|---|---|---|
| `from` | `string` | no, default `'header:x-api-key'` | only `header:<name>` is supported (no cookie source for API keys) |
| `resolve` | `(key: string) => Promise<AuthenticatedUser \| null>` | **yes** | return `null` to reject |

`sha256(value)` and `safeCompare(a, b)` are also exported from `/auth` as small helpers — `sha256` for hashing keys before storing/looking them up, `safeCompare` for a constant-time string comparison if you need one outside `resolve`. Rate-limiting a key isn't built into `apiKey()` itself — compose it with the `rateLimit` [route option or middleware](#built-ins-reference) instead, keyed by the resolved user or the raw header value.

Store hashes, never raw keys — the `resolve` signature (receiving the raw key, looking it up by its hash) nudges you toward this.

### Basic auth

```ts
import { basic } from '@api-kickstart/api-kickstart/auth'

basic({ verify: async (user, pass) => checkPassword(user, pass) })
```

`BasicAuthOptions` reference:

| Field | Type | Required | Notes |
|---|---|---|---|
| `verify` | `(username: string, password: string) => Promise<AuthenticatedUser \| boolean \| null>` | **yes** | return `false`/`null` to reject; returning `true` authenticates as a minimal placeholder user |
| `allowInsecure` | `boolean` | no, default `false` | by default, refuses to run over plain (non-TLS) HTTP, detected via the `x-forwarded-proto` header |

Intended for internal tools and health endpoints, not end-user APIs.

### OAuth / OIDC

```ts
import { oidc } from '@api-kickstart/api-kickstart/auth'

const google = oidc({
  issuer: 'https://accounts.google.com',
  clientId: env.GOOGLE_CLIENT_ID,
  clientSecret: env.GOOGLE_CLIENT_SECRET,
  redirectUri: 'https://api.example.com/auth/callback',
  scopes: ['openid', 'email', 'profile'],
  onUser: async (profile) => db.user.upsert({ /* ... */ }),
})

createApp({ auth: google, /* ... */ })
```

`OidcOptions` reference:

| Field | Type | Required | Notes |
|---|---|---|---|
| `issuer` | `string` | **yes** | the identity provider's issuer URL; discovery is fetched from `<issuer>/.well-known/openid-configuration` |
| `clientId` / `clientSecret` | `string` | **yes** | |
| `redirectUri` | `string` | **yes** | must match what's registered with the provider |
| `scopes` | `string[]` | no, default `['openid', 'email', 'profile']` | |
| `from` | `string[]` | no, default same as `jwt()`'s | where `authenticate()` looks for a bearer access token to verify against the provider's JWKS |
| `onUser` | `(profile: Record<string, unknown>) => Promise<AuthenticatedUser>` | **yes** | maps the provider's userinfo/ID-token claims to your own user shape |

Discovery, PKCE (S256), state, and nonce are handled for you. JWKS keys are fetched and cached lazily via `jose`'s remote key set, so rotation on the identity provider's side is picked up automatically without a restart.

Wire the redirect flow with the two methods the strategy exposes beyond `authenticate()`:

```ts
app.route({
  method: 'GET',
  path: '/auth/google',
  auth: false,
  handler: async (ctx) => {
    const { url, state, codeVerifier } = await google.authorizationUrl()
    // stash state + codeVerifier in a session/cookie, then redirect the browser to `url`
    return { redirect: url }
  },
})

app.route({
  method: 'GET',
  path: '/auth/google/callback',
  auth: false,
  handler: async (ctx) => {
    const { code } = ctx.query
    // codeVerifier comes back from wherever you stashed it above
    const { user, tokens } = await google.handleCallback({ code, codeVerifier })
    return { user, tokens }
  },
})
```

`authorizationUrl(state?)` returns `{ url, state, nonce, codeVerifier }`; `handleCallback({ code, codeVerifier })` returns `{ user, tokens }` where `tokens` is the provider's raw `{ access_token, id_token?, refresh_token?, token_type, expires_in? }`.

Once a route uses `auth: true` with the OIDC strategy configured, `authenticate()` validates the bearer token's signature against the same JWKS — useful when the identity provider issues JWT access tokens you want to accept directly on your API.

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

Every strategy is just an object implementing `AuthStrategy`:

```ts
interface AuthenticateArgs {
  headers: Record<string, string | string[] | undefined>
  cookies: Record<string, string>
  raw: { req: unknown; res: unknown }
}

interface AuthStrategy {
  name: string
  authenticate(args: AuthenticateArgs): Promise<AuthenticatedUser | null>
}
```

```ts
const ldap: AuthStrategy = {
  name: 'ldap',
  async authenticate(args) {
    const header = args.headers.authorization
    const user = await ldapClient.verify(Array.isArray(header) ? header[0] : header)
    return user ?? null      // null → try the next strategy
  },
}
```

`AuthenticatedUser` only requires `{ id: string; role?: string }` plus any extra fields you want — it's an open index signature (`[key: string]: unknown`).

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

`ctx.scope` is the filter object for the current user, in your database's own query dialect — the adapter translates it. A scope resolver is `(user: AuthenticatedUser) => ScopeFilter | Promise<ScopeFilter>`, where `ScopeFilter` is an open `{ [key: string]: unknown }`.

### It applies to writes too

Filtering reads while leaving writes open is the most common half-implementation. A `findByIdAndUpdate` with an ID from another tenant will happily succeed.

Scope is enforced on `update` and `delete` as well (when using `app.resource()` — see [CRUD shorthand](#crud-shorthand)). A staff member updating someone else's order gets a `404`, because within their scope that row does not exist.

### Fail closed

If a role isn't defined for a resource, access is denied. There is no implicit "if unspecified, allow all." Getting this backwards is how `{}` ends up meaning "every row in the table."

### Audit mode

```ts
createApp({ scopeAudit: 'warn' })   // 'off' | 'warn' | 'throw'
```

When a route declares `scope`, `ctx.scope` is handed to the handler wrapped so api-kickstart knows whether it was ever actually read. If the handler finishes without touching `ctx.scope` at all — the strongest available signal that the query it ran didn't apply the filter — `'warn'` logs it (with a stack trace) and `'throw'` fails the request outright instead of returning data that was never scoped:

```
{ requestId: '...', route: 'GET /orders', message: 'Route GET /orders declares scope: "order" but the handler never read ctx.scope', stack: '...' }
```

This catches the "forgot to spread `ctx.scope` into the query" class of bug. It can't catch a handler that reads `ctx.scope` and then ignores it, since there's no way to verify what a raw database call downstream actually did with the value — that would need per-adapter query interception, which isn't implemented. `app.diagnostics().scopeAudit` exposes the configured value, and `npx api-kickstart doctor` fails the `scope-audit-enabled` check when it's left at `'off'`.

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

Adapters exist for Zod, Joi, Yup, Valibot, and TypeBox. Pick one; the route API is identical:

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

Every validator adapter is a zero-argument factory (`zod()`, `joi()`, etc.) implementing:

```ts
interface Validator {
  name: string
  parse(schema: unknown, value: unknown, path: string): unknown   // throws SchemaValidationError on failure
  toJsonSchema?(schema: unknown): unknown                          // optional — powers OpenAPI schema output
}
```

### Zod

```ts
import { zod } from '@api-kickstart/api-kickstart/zod'
import { z } from 'zod'

createApp({ validator: zod() })
```

**Types flow through** — `ctx.body`/`ctx.query`/`ctx.params` are fully typed from the Zod schema, no manual interface, no casting. `toJsonSchema` delegates to `zod-to-json-schema` (bundled as a regular dependency, so no separate install) with `target: 'openApi3'`. Uses: `zod` (`^3.23.0`).

### Joi

```ts
import { joi } from '@api-kickstart/api-kickstart/joi'
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

Validates with `schema.validate(value, { abortEarly: false })` so every field's errors are collected, not just the first. `toJsonSchema` delegates to the `joi-to-json` package. Uses: `joi` (`^17.13.3`), `joi-to-json` (`^5.0.5`) — the second is only needed if you call `toJsonSchema` (i.e. use OpenAPI schema generation).

### Yup

```ts
import { yup } from '@api-kickstart/api-kickstart/yup'
import { object, string, number } from 'yup'

createApp({ validator: yup() })

app.route({
  body: object({
    sku: string().min(1).required(),
    qty: number().integer().positive().required(),
  }),
  // ...
})
```

Validates with `schema.validateSync(value, { abortEarly: false })`. `toJsonSchema` delegates to `@sodaru/yup-to-json-schema`'s `convertSchema`. Uses: `yup` (`^1.4.0`), `@sodaru/yup-to-json-schema` (`^2.0.1`).

### Valibot

```ts
import { valibot } from '@api-kickstart/api-kickstart/valibot'
import * as v from 'valibot'

createApp({ validator: valibot() })

app.route({
  body: v.object({
    sku: v.pipe(v.string(), v.minLength(1)),
    qty: v.pipe(v.number(), v.integer()),
  }),
  // ...
})
```

Validates with `v.safeParse(schema, value)`. `toJsonSchema` delegates to `@valibot/to-json-schema`. Types flow through, same as Zod. Uses: `valibot` (`^1.4.0`), `@valibot/to-json-schema` (`^1.4.0`).

### TypeBox

```ts
import { typebox } from '@api-kickstart/api-kickstart/typebox'
import { Type } from '@sinclair/typebox'

createApp({ validator: typebox() })

app.route({
  body: Type.Object({
    sku: Type.String({ minLength: 1 }),
    qty: Type.Integer({ minimum: 1 }),
  }),
  // ...
})
```

Validates with `@sinclair/typebox/value`'s `Value.Check`/`Value.Errors`. `toJsonSchema` is a trivial passthrough — TypeBox schemas already *are* JSON Schema. Uses: `@sinclair/typebox` (`^0.33.0`).

### Writing your own validator

```ts
const myValidator: Validator = {
  name: 'my-validator',
  parse(schema, value, path) {
    const result = mySchemaLib.validate(schema, value)
    if (!result.success) {
      throw new SchemaValidationError(result.errors.map((e) => ({ path: e.path, message: e.message })))
    }
    return result.value
  },
  toJsonSchema(schema) {
    return mySchemaLib.toJsonSchema(schema)   // optional
  },
}
```

`SchemaValidationError` (from `@api-kickstart/api-kickstart/errors`) takes an array of `{ path: string; message: string }` and is what turns into the `VALIDATION_ERROR` response shown above.

---

## Regex patterns

A small named registry of common validation regexes, framework-independent — plug them into any validator's own pattern/regex support (Zod's `.regex()`, Joi's `.pattern()`, Yup's `.matches()`, Valibot's `regex()`, or TypeBox's `Type.String({ pattern })` via `.source`):

```ts
import { patterns } from '@api-kickstart/api-kickstart/patterns'
import { z } from 'zod'

const schema = z.object({
  email: z.string().regex(patterns.get('email')),
  sku: z.string().regex(patterns.get('sku')),   // registered below
})
```

Built in (`patterns.list()`): `email`, `url`, `uuid`, `slug`, `alphanumeric`, `username`, `hexColor`, `ipv4`, `ipv6`, `isoDate`, `isoDateTime`, `semver`, `jwt`, `base64`, `phone`.

```ts
interface PatternRegistry {
  get(name: string): RegExp        // throws UnknownPatternError if not registered
  has(name: string): boolean
  register(name: string, pattern: RegExp): void
  list(): string[]                  // sorted names
}
```

`patterns` (the default export) is a shared, pre-seeded registry — `register()` on it adds a name process-wide, so it's the right place for names your whole app reuses:

```ts
patterns.register('sku', /^[A-Z]{3}-\d{4}$/)
patterns.register('postalCodeUS', /^\d{5}(-\d{4})?$/)
```

For an isolated registry instead (e.g. per-module, or in tests where you don't want to leak custom names globally), use `createPatternRegistry()` — starts empty by default, or pass a seed object to start with your own set instead of the built-ins:

```ts
import { createPatternRegistry } from '@api-kickstart/api-kickstart/patterns'

const orderPatterns = createPatternRegistry({ orderId: /^ORD-\d{6}$/ })
orderPatterns.get('orderId')
```

`patterns.get('unknown-name')` throws `UnknownPatternError` (a plain `Error`, not an `AppError` — this is a programmer mistake to catch in development, not a request-time validation failure) rather than returning `undefined`, so a typo'd pattern name fails loudly at the call site instead of silently producing a schema that matches nothing (or everything).

A couple of the built-ins are deliberately loose rather than exhaustive: `phone` accepts a permissive international digit-count pattern (no universal regex correctly validates every country's phone format — use a dedicated library like `libphonenumber-js` if you need real validation, not just a shape check), and `email`/`url` use the same widely-used pattern browsers use for `<input type="email">`/`<input type="url">`, not the full RFC 5322/3986 grammar.

---

## File uploads

`multipart/form-data` requests are parsed automatically, on every framework adapter — no extra dependency, no per-route setup:

```ts
app.route({
  method: 'POST',
  path: '/avatar',
  auth: true,
  handler: async (ctx) => {
    ctx.body           // the non-file fields, as strings
    ctx.files.avatar    // UploadedFile[] for a field named "avatar"

    const [file] = ctx.files.avatar
    file.filename       // "photo.png"
    file.contentType    // "image/png"
    file.data            // Buffer
    file.size

    await ctx.storage?.put(file.filename, file.data, { contentType: file.contentType })
    return { uploaded: file.filename }
  },
})
```

`UploadedFile` is `{ fieldName: string; filename: string; contentType: string; data: Buffer; size: number }`.

The non-file fields land in `ctx.body` exactly like a JSON request, so a `body` validator schema still applies to them. Files are buffered fully in memory before the handler runs — fine for avatars and documents; put `bodyLimit()` in front of the route if you need to cap upload size, and stream large files (video, bulk data) through a signed upload URL instead rather than through this path.

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

### Route config reference

Every field `app.route({...})` accepts:

| Field | Type | Notes |
|---|---|---|
| `method` | `'GET' \| 'POST' \| 'PUT' \| 'PATCH' \| 'DELETE'` | required |
| `path` | `string` | required, Express-style (`/orders/:id`) |
| `auth` | `boolean \| string \| string[]` | `true` requires any configured strategy to succeed, `false` skips auth entirely, a string/array of strings restricts to named strategies (see [Multiple strategies](#multiple-strategies)) — `doctor` flags any route missing this field entirely |
| `roles` | `string[]` | see [Roles](#roles) |
| `permissions` | `string[]` | see [Permissions](#permissions) |
| `scope` | `string` | key into `createApp({ scope })`, see [Scope](#scope-row-level-filtering) |
| `params` / `query` / `body` / `headers` / `response` | validator schema | see [Validation](#validation) |
| `load` | `(ctx) => Promise<unknown>` | see [Ownership](#ownership) |
| `can` | `(ctx, record) => Promise<boolean> \| boolean` | see [Ownership](#ownership) |
| `handler` | `(ctx) => Promise<unknown>` | required |
| `middleware` | `Middleware[]` | route-scoped middleware, see [Middleware](#middleware) |
| `rateLimit` | `{ window: string; max: number }` | wires in the `rateLimit()` built-in for this route only |
| `timeout` | `string` | wires in the `timeout()` built-in |
| `idempotent` | `boolean` | wires in the `idempotency()` built-in |
| `tags` | `string[]` | OpenAPI grouping only |
| `summary` | `string` | OpenAPI summary only |

### Groups

Shared config, applied to everything inside:

```ts
app.group({ prefix: '/admin', auth: true, roles: ['admin'] }, (admin) => {
  admin.route({ method: 'GET',  path: '/users',     handler: listUsers })
  admin.route({ method: 'POST', path: '/users',     handler: createUser })
  admin.route({ method: 'GET',  path: '/audit-log', handler: auditLog })
})
```

`GroupOptions`: `{ prefix?: string; auth?: boolean | string | string[]; roles?: string[]; permissions?: string[]; scope?: string; middleware?: Middleware[] }`. A route's own `auth`/`roles`/`permissions`/`scope` always take precedence over the group's; `middleware` arrays concatenate (group middleware runs first). Groups nest via `admin.group({...}, (nested) => {...})`, and prefixes/middleware/settings compose down through nesting levels.

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
    afterCreate:  async (ctx, order) => ctx.broker?.publish('order.created', order),
  },
})
```

`ResourceOptions` reference:

| Field | Type | Notes |
|---|---|---|
| `model` | `string` | key into `ctx.db.$client[model]` — the db client is expected to expose `findMany`/`findFirst`/`create`/`update`/`delete` methods on it, matching Prisma's model-client shape |
| `scope` | `string` | optional, same as `RouteConfig.scope` |
| `schema.create` / `schema.update` | validator schema | optional, applied as the `body` schema for the `create`/`update` routes |
| `only` | `('list' \| 'get' \| 'create' \| 'update' \| 'delete')[]` | optional, default all five |
| `roles` | `Partial<Record<action, string[]>>` | optional, per-action role restriction |
| `hooks.beforeCreate` / `.afterCreate` / `.beforeUpdate` / `.afterUpdate` / `.beforeDelete` / `.afterDelete` | see below | optional |

Generates `GET` (list), `GET /:id` (get), `POST` (create), `PATCH /:id` (update), and `DELETE /:id` (delete) — all scope-aware (scope is applied to the `where` clause on every action, including `update`/`delete`, and a missing record scoped-out of view returns `404`).

`beforeCreate`/`beforeUpdate` receive `(ctx, data)` and can return a modified payload (or a `Promise` of one) to merge in server-side fields like `createdBy`; `afterCreate`/`afterUpdate`/`afterDelete` receive `(ctx, record)` for side effects like publishing an event. `beforeDelete` receives `(ctx, record)` before the delete runs.

**The generated `list` route is not paginated** — it's a plain `findMany({ where: ctx.scope })` with no `limit`/`offset`/sort applied. For a paginated or sortable list, drop down to `app.route()` for that one endpoint and read `limit`/`offset`/`sort` off `ctx.query` yourself (validated with the same schema tools as any other route); the two mix freely with `app.resource()` for the rest.

Drop down to `app.route` the moment you need something the shorthand doesn't cover — the two mix freely.

### Introspection

```ts
app.routes()
// RouteConfig[] — every field shown in the reference table above, for every registered route
```

Useful for permission audits, docs, and catching a route you forgot to protect. `app.diagnostics()` additionally exposes `{ routes, scopeMap, scopeAudit }` (the underlying data `doctor` checks run against).

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

`CorsOptions` reference:

| Field | Type | Notes |
|---|---|---|
| `origin` | `(string \| RegExp)[] \| '*'` | required in explicit form; a string is matched exactly, a `RegExp` via `.test(origin)` |
| `credentials` | `boolean` | optional |
| `methods` | `string[]` | optional |
| `allowedHeaders` | `string[]` | optional |
| `exposedHeaders` | `string[]` | optional |
| `maxAge` | `number` | optional, seconds |

`'dev'` resolves to `{ origin: '*', credentials: true, methods: [...], allowedHeaders: [...] }` and refuses to start when `NODE_ENV=production`. `'strict'` resolves to `{ origin: [], credentials: false, methods: [...] }` — i.e. denies every origin until you list some. Wildcard origin plus credentials (`{ origin: '*', credentials: true }`) is the single most common CORS mistake, and it's blocked outright (thrown at `createApp()` time) rather than silently ignored, in both the explicit form and internally in the `'dev'` preset's own construction.

---

## Middleware

Your own, at any level:

```ts
import { logger, helmet } from '@api-kickstart/api-kickstart/middleware'

createApp({ middleware: [logger(), helmet()] })            // global
app.group({ middleware: [auditTrail()] }, /* ... */)       // group
app.route({ middleware: [captureRawBody()], /* ... */ })   // single route
```

Signature is framework-independent:

```ts
type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>
```

Handlers write their result to `ctx.response.body`; middleware can read and rewrite it, and can set response headers and status directly, because they run in an onion — code after `await next()` executes once everything inside has finished:

```ts
const timing = async (ctx, next) => {
  const start = Date.now()
  await next()
  ctx.response.headers['x-response-time'] = `${Date.now() - start}ms`
}
```

Existing Express middleware still works — pass it through `adapt()` (from the `/express` subpath specifically; the other framework adapters don't export an equivalent, since their native middleware isn't `(req, res, next)`-shaped):

```ts
import { adapt } from '@api-kickstart/api-kickstart/express'
middleware: [adapt(someExpressMiddleware)]
```

### Built-ins reference

All imported from `@api-kickstart/api-kickstart/middleware`, all real implementations — none of these are stubs.

| Factory | Options | Notes |
|---|---|---|
| `requestId()` | `{ header?: string }` (default `'x-request-id'`) | stamps `ctx.requestId` onto the given response header |
| `logger()` | `{ logBody?: boolean }` | structured request/response logging via `ctx.logger`; logs `request.start`, `request.complete` (with `status`, `durationMs`), or `request.error` |
| `helmet()` | `{ hsts?: boolean; frameguard?: boolean; noSniff?: boolean; referrerPolicy?: string }` (all default `true` except `referrerPolicy: 'no-referrer'`) | sets `x-content-type-options`, `x-frame-options`, `strict-transport-security`, `referrer-policy`, `x-dns-prefetch-control`, `x-download-options` |
| `compression({ threshold? })` | `threshold` default `1024` bytes | gzips a JSON-serializable `ctx.response.body` over the threshold, via `node:zlib`, only when the client sends `accept-encoding: gzip`; skips `Buffer` bodies (already handled elsewhere, e.g. binary downloads) |
| `bodyLimit({ maxBytes })` | `maxBytes` **required** | throws `PayloadTooLarge` (413) if `ctx.body`'s serialized byte size exceeds it |
| `timeout({ duration })` | `duration` **required**, e.g. `'10s'` | throws `RequestTimeout` (408) if the rest of the chain doesn't finish in time |
| `idempotency({ header?, ttlMs?, store? })` | `header` default `'idempotency-key'`, `ttlMs` default 24h, `store?: IdempotencyStore` | replays the stored response for a repeated key instead of re-running the handler |
| `rateLimit({ window, max, keyGenerator?, store? })` | `window`/`max` **required**, `keyGenerator` defaults to client IP | throws `TooManyRequests` (429) past the limit within the window |
| `cache({ ttlMs?, keyGenerator?, store? })` | `ttlMs` default 60s | GET-only response cache, sets `x-cache: HIT`/`MISS` |
| `csrf({ cookieName?, headerName?, safeMethods?, cookie? })` | see below | double-submit-cookie CSRF check |
| `auditLog({ sink?, action?, resource?, metadata?, skip? })` | see [Audit logging](#audit-logging) | structured "who did what" records |

```ts
import { requestId, logger, rateLimit, compression, helmet, bodyLimit, timeout, idempotency, cache, csrf } from '@api-kickstart/api-kickstart/middleware'

createApp({
  middleware: [
    requestId(),
    logger(),
    helmet(),
    compression({ threshold: 1024 }),
    bodyLimit({ maxBytes: 1_000_000 }),
    csrf(),
  ],
})

app.route({
  method: 'GET',
  path: '/catalog',
  auth: false,
  middleware: [cache({ ttlMs: 30_000 })],
  handler: async (ctx) => { /* ... */ },
})
```

`rateLimit`, `timeout`, and `idempotency` are also available as per-route shorthands — set them on `app.route({...})` and the matching middleware is wired in automatically (see the [route config reference](#route-config-reference)):

```ts
app.route({
  method: 'POST',
  path: '/orders',
  rateLimit: { window: '1m', max: 10 },
  timeout: '10s',
  idempotent: true,
  handler: async (ctx) => { /* ... */ },
})
```

`rateLimit`, `idempotency`, and `cache` each accept a `store` option (`RateLimitStore` / `IdempotencyStore` / `CacheStore`) — the in-memory default (`memoryRateLimitStore`/`memoryIdempotencyStore`/`memoryCacheStore`, all exported alongside their middleware from `/middleware`) is fine for a single instance. For anything running more than one instance behind a load balancer, see [Redis-backed stores](#redis-backed-stores-and-lock).

`csrf()` implements the double-submit-cookie pattern. `CsrfOptions`: `{ cookieName?: string /* default 'csrf_token' */; headerName?: string /* default 'x-csrf-token' */; safeMethods?: string[] /* default ['GET','HEAD','OPTIONS'] */; cookie?: { secure?: boolean /* default true */; sameSite?: 'strict'|'lax'|'none' /* default 'lax' */; path?: string /* default '/' } }`. On a safe method it issues the cookie if the client doesn't already have one; on any other method it requires the header to match the cookie, or responds `403` (`Forbidden`). It's for cookie/session-based auth — bearer-token APIs (the default `jwt()` setup) aren't vulnerable to CSRF and don't need it.

### Audit logging

Structured "who did what" records — distinct from `scopeAudit`, which is about catching a handler that forgot to apply its scope filter, not about producing a compliance trail:

```ts
import { auditLog } from '@api-kickstart/api-kickstart/middleware'

createApp({
  middleware: [
    auditLog({
      sink: { record: (entry) => db.auditLog.create({ data: entry }) },   // default: ctx.logger.info
      action: (ctx) => `${ctx.method.toLowerCase()}:${ctx.path}`,
      resource: (ctx) => (ctx.params as { id?: string })?.id,
      skip: (ctx) => ctx.path === '/health',
    }),
  ],
})
```

`AuditLogOptions`: `{ sink?: AuditSink; action?: (ctx) => string | undefined; resource?: (ctx) => string | undefined; metadata?: (ctx) => Record<string, unknown> | undefined; skip?: (ctx) => boolean }`. `AuditSink` is just `{ record(entry: AuditEntry): Promise<void> | void }`.

Each `AuditEntry` carries `timestamp`, `requestId`, `userId` (`ctx.user?.id ?? null`), `method`, `path`, `status`, and whatever `action`/`resource`/`metadata` you derive from `ctx`. It records after the handler runs — on success or on a thrown `AppError` (mapped to that error's status; anything else records as `500`) — so both outcomes land in the trail.

**What it doesn't cover:** auth failures, role/permission failures, and `scopeAudit` violations all happen in `dispatch()` before or after the middleware chain runs, so they never reach `auditLog`. If you need those in the trail too, log them at the strategy/authorize level, or from `doctor`-adjacent tooling — this middleware only sees requests that reach a route's handler.

---

## Request context

Everything a handler needs, in one object:

```ts
interface Context<TUser = AuthenticatedUser> {
  method: string
  path: string
  user: TUser | null
  body: unknown
  query: unknown
  params: unknown
  headers: Record<string, string | string[] | undefined>
  files: Record<string, UploadedFile[]>
  scope: ScopeFilter
  db: unknown
  broker: BrokerAdapter | null
  storage: StorageAdapter | null
  logger: Logger
  requestId: string
  raw: { req: unknown; res: unknown }
  response: { status: number; headers: Record<string, string>; body: unknown }
}
```

| Field | Notes |
|---|---|
| `ctx.method` / `ctx.path` | `'GET'`, `'POST'`, ...; the matched route's raw path, e.g. `'/orders/:id'` |
| `ctx.user` | authenticated user, typed as `TUser`, `null` if `auth: false` or no strategy matched |
| `ctx.body` / `ctx.query` / `ctx.params` | validated (and typed, with Zod/Valibot/TypeBox) — or multipart's non-file fields for `ctx.body` |
| `ctx.files` | `UploadedFile[]` per field name, for multipart requests |
| `ctx.scope` | row-level filter for this user, see [Scope](#scope-row-level-filtering) |
| `ctx.db` | the configured `DbAdapter`, or `undefined` if none |
| `ctx.broker` | the configured `BrokerAdapter`, or `null` |
| `ctx.storage` | the configured `StorageAdapter`, or `null` |
| `ctx.logger` | logger with `requestId` already bound — see [Logging](#logging) |
| `ctx.requestId` | unique per request |
| `ctx.raw.req` / `ctx.raw.res` | underlying framework request/response objects — the escape hatch |
| `ctx.response` | `{ status, headers, body }` — mutate directly (used by middleware running after `next()`), or just `return` your result from the handler and let dispatch fill it in |

`ctx.logger` defaults to a thin `console`-based logger. Swap it for structured, production-grade logging with [`/pino`](#logging):

```ts
import { pinoLogger } from '@api-kickstart/api-kickstart/pino'

createApp({ logger: pinoLogger({ pinoOptions: { level: 'info' } }) })
```

### Anywhere else in your code

Backed by `AsyncLocalStorage`, so you don't have to thread `user` through every layer:

```ts
import { currentUser, currentRequestId } from '@api-kickstart/api-kickstart/context'

// deep inside a service or model hook
const user = currentUser()
const requestId = currentRequestId()
```

This is what makes audit logging painless — your model hooks can record *who* changed something without every function signature growing a `userId` parameter.

---

## Errors

Throw; the error handler formats it.

```ts
import { NotFound, Forbidden, Conflict, BadRequest } from '@api-kickstart/api-kickstart/errors'

if (!order) throw new NotFound('Order not found')
if (order.locked) throw new Conflict('Order is locked', { orderId: order.id })
```

Every `AppError` subclass takes `(message?, details?)` and is available from `/errors`:

| Class | Status | Code | Default message |
|---|---|---|---|
| `BadRequest` | 400 | `BAD_REQUEST` | "Bad request" |
| `Unauthorized` | 401 | `UNAUTHORIZED` | "Unauthorized" |
| `Forbidden` | 403 | `FORBIDDEN` | "Forbidden" |
| `NotFound` | 404 | `NOT_FOUND` | "Not found" |
| `Conflict` | 409 | `CONFLICT` | "Conflict" |
| `ValidationError` | 422 | `VALIDATION_ERROR` | "Request validation failed" (takes `details` as its only/first argument) |
| `RequestTimeout` | 408 | `REQUEST_TIMEOUT` | "Request timed out" |
| `PayloadTooLarge` | 413 | `PAYLOAD_TOO_LARGE` | "Payload too large" |
| `TooManyRequests` | 429 | `TOO_MANY_REQUESTS` | "Too many requests" |
| `InternalError` | 500 | `INTERNAL_ERROR` | "Internal server error" (no `details` argument) |

All of them extend the base `AppError` (`code: string`, `status: number`, `details?: unknown`), also exported if you want to build your own subclass or catch broadly with `instanceof AppError`.

`SchemaValidationError` (separate from the above — it's what validator adapters throw, and gets converted into the `422 VALIDATION_ERROR` response shown in [Validation](#validation)) takes an array of `{ path: string; message: string }`.

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

Unknown (non-`AppError`) errors become a generic `500 INTERNAL_ERROR` with the details logged, never returned. Stack traces are included in the response only when `NODE_ENV !== 'production'`.

Adapter-specific errors are normalized: a Prisma unique-constraint violation, a Mongo duplicate key, and a Postgres `23505` all surface as `CONFLICT`. You stop writing per-database error mapping — see each database's section below for exactly which codes map to which error.

---

## Database adapters

The adapter's job is small: give the app a client, translate scope filters into that database's query dialect, and normalize errors.

```ts
interface DbAdapter {
  client: unknown
  translateScope(filter: ScopeFilter): unknown
  normalizeError(err: unknown): Error | null
  transaction?<T>(fn: (tx: unknown) => Promise<T>): Promise<T>
  healthcheck?(): Promise<boolean>
  close?(): Promise<void>
}
```

| Adapter | Subpath | Databases | Underlying library |
|---|---|---|---|
| [pg](#pg) | `/pg` | raw `node-postgres` | `pg` |
| [Prisma](#prisma) | `/prisma` | Postgres, MySQL, SQLite, SQL Server, CockroachDB, MongoDB | none (duck-typed) |
| [Drizzle](#drizzle) | `/drizzle` | Postgres, MySQL, SQLite, Turso, Neon, PlanetScale | `drizzle-orm` |
| [Mongoose](#mongoose) | `/mongoose` | MongoDB | `mongoose` |
| [Knex](#knex) | `/knex` | Postgres, MySQL, SQLite, Oracle, SQL Server | `knex` |
| [TypeORM](#typeorm) | `/typeorm` | most SQL databases | `typeorm` |
| [Sequelize](#sequelize) | `/sequelize` | Postgres, MySQL, MariaDB, SQLite, SQL Server | `sequelize` |
| [MongoDB driver](#mongodb-driver) | `/mongodb` | MongoDB, no ODM | `mongodb` |

### pg

```ts
import { pg } from '@api-kickstart/api-kickstart/pg'
import { pgOutboxStore } from '@api-kickstart/api-kickstart/pg'

db: pg({ connectionString: env.DATABASE_URL })   // a PoolConfig, or pass an existing Pool directly: pg(existingPool)
```

`pg(configOrPool: PoolConfig | Pool): DbAdapter`. `client` is the `Pool`. `translateScope` returns `PgScopeQuery = { where: string; values: unknown[] }` — a parameterized `WHERE` clause with quoted identifiers (e.g. `"status" = $1 AND "authorId" = $2`), or `{ where: 'true', values: [] }` for an empty filter. `transaction` runs explicit `BEGIN`/`COMMIT`/`ROLLBACK` on a checked-out client. `healthcheck` runs `SELECT 1`. `close` calls `pool.end()`.

Error normalization: `23505` → `Conflict`, `23503` → `BadRequest('Foreign key constraint violation')`, `23502` → `BadRequest('Not-null constraint violation')`.

Also exports `pgOutboxStore(pool, options?)` — see [Transactional outbox](#transactional-outbox).

### Prisma

```ts
import { prisma } from '@api-kickstart/api-kickstart/prisma'

db: prisma(new PrismaClient())
```

`prisma(client: PrismaLikeClient): DbAdapter` — the client type is **structurally duck-typed** (`$transaction`, `$disconnect`, optional `$queryRaw`, plus an open index signature for model accessors), so `@prisma/client` isn't bundled at all — see [Install](#install) — any object shaped like a `PrismaClient` works. `transaction` delegates to `client.$transaction(fn)`. `healthcheck` runs `` client.$queryRaw`SELECT 1` `` if present, else always returns `true`. `close` calls `client.$disconnect()`.

Error normalization: Prisma code `P2002` → `Conflict('Unique constraint violation')`.

### Drizzle

```ts
import { drizzle } from '@api-kickstart/api-kickstart/drizzle'
import { scopeToWhere } from '@api-kickstart/api-kickstart/drizzle'

db: drizzle(drizzleDb)
```

`drizzle(client: DrizzleLikeDb): DbAdapter` — `client` just needs a `transaction<T>(fn)` method. Also exports `scopeToWhere(table, filter): SQL | undefined`, which converts a `ScopeFilter` into a drizzle `and(eq(...), ...)` where-clause — since `translateScope` on this adapter is a passthrough, use `scopeToWhere` directly in your own queries: `db.select().from(orders).where(scopeToWhere(orders, ctx.scope))`.

Error normalization is Postgres-code-shaped (`23505`/`23503`/`23502`, same mapping as `pg`), so it's best suited to Drizzle's Postgres driver. Uses: `drizzle-orm` (`^0.33.0`).

### Mongoose

```ts
import { mongoose } from '@api-kickstart/api-kickstart/mongoose'

db: mongoose(connection)
```

`mongoose(connection: Connection): DbAdapter`. `transaction` uses `connection.startSession()` + `session.withTransaction(fn)`. `healthcheck` checks `connection.readyState === 1`. `close` calls `connection.close()`.

Error normalization: Mongo duplicate-key code `11000` → `Conflict('Unique constraint violation')`.

### Knex

```ts
import { knex } from '@api-kickstart/api-kickstart/knex'
import { knexOutboxStore } from '@api-kickstart/api-kickstart/knex'

db: knex(knexClient)
```

`knex(client: Knex): DbAdapter`. `healthcheck` runs `client.raw('select 1')`. `close` calls `client.destroy()`. Works with any Knex-supported dialect, including `better-sqlite3` for tests.

Error normalization is cross-dialect: unique-violation codes `23505` (Postgres) / `ER_DUP_ENTRY` (MySQL) / `SQLITE_CONSTRAINT` (SQLite) all → `Conflict`; FK codes `23503` (Postgres) / `ER_NO_REFERENCED_ROW_2` (MySQL) → `BadRequest`.

Also exports `knexOutboxStore(client, options?)` — see [Transactional outbox](#transactional-outbox).

### TypeORM

```ts
import { typeorm } from '@api-kickstart/api-kickstart/typeorm'

db: typeorm(dataSource)
```

`typeorm(dataSource: DataSource): DbAdapter`. `transaction` delegates to `dataSource.transaction(fn)` (`fn` receives an `EntityManager`). `healthcheck` runs `dataSource.query('SELECT 1')`. `close` calls `dataSource.destroy()`.

Error normalization inspects the driver error code: Postgres `23505` or MySQL `ER_DUP_ENTRY` → `Conflict`. Uses: `typeorm` (`^0.3.20`), `reflect-metadata` (`^0.2.2`, required by TypeORM's decorators).

### Sequelize

```ts
import { sequelize } from '@api-kickstart/api-kickstart/sequelize'

db: sequelize(sequelizeInstance)
```

`sequelize(client: Sequelize): DbAdapter`. `transaction` delegates to `client.transaction(fn)`. `healthcheck` calls `client.authenticate()`. `close` calls `client.close()`.

Error normalization is by error class name: `SequelizeUniqueConstraintError` → `Conflict`, `SequelizeForeignKeyConstraintError` → `BadRequest`, `SequelizeValidationError` → `BadRequest(err.message)`.

### MongoDB driver

```ts
import { mongodb } from '@api-kickstart/api-kickstart/mongodb'
import { mongodbOutboxStore } from '@api-kickstart/api-kickstart/mongodb'

db: mongodb(mongoClient, { dbName: 'myapp' })
```

`mongodb(client: MongoClient, options?: { dbName?: string }): DbAdapter` — the raw driver, no ODM. `client` on the returned adapter is the resolved `Db` (`client.db(dbName)`), not the `MongoClient` itself. `transaction` uses `client.startSession()` + `session.withTransaction(fn)`. `healthcheck` pings via `db.command({ ping: 1 })`. `close` calls the original `MongoClient.close()`.

Error normalization: duplicate-key code `11000` → `Conflict`.

Also exports `mongodbOutboxStore(db, options?)` — see [Transactional outbox](#transactional-outbox).

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

If the adapter's database doesn't support transactions, this throws at startup rather than silently running without one (i.e. don't implement `transaction` at all on a custom adapter if there's nothing sensible to do — a missing method is a clear error, not a silent no-op).

### Writing your own database adapter

Implement the `DbAdapter` interface shown at the top of this section. A conformance suite is published so you can verify yours:

```ts
import { runDbConformance } from '@api-kickstart/api-kickstart/testing'
runDbConformance(() => myAdapter())
```

It checks that `client` is set, `translateScope`/`normalizeError` are functions with the right return shapes, and throws a descriptive `Error` (not a test-framework assertion) the moment something's missing — call it inside your own test file's `it()`/`test()` block.

---

## Message brokers

Optional. Skip the import and nothing broker-related is loaded.

```ts
interface BrokerAdapter {
  publish(topic: string, message: unknown, opts?: Record<string, unknown>): Promise<void>
  consume?(opts: BrokerConsumeOptions): void
  close?(): Promise<void>
}

interface BrokerConsumeOptions {
  topic: string
  group?: string
  concurrency?: number
  onMessage: (message: unknown, meta: { topic: string; attempt: number }) => Promise<void>
}
```

| Adapter | Subpath | Broker | Outbox support | Underlying library |
|---|---|---|---|---|
| [RabbitMQ](#rabbitmq) | `/rabbitmq` | AMQP 0-9-1 | yes | `amqplib` |
| [Kafka](#kafka) | `/kafka` | Kafka, Redpanda | yes | `kafkajs` |
| [Redis Streams](#redis-streams) | `/redis-stream` | Redis Streams | no | `ioredis` |
| [BullMQ](#bullmq) | `/bullmq` | BullMQ (Redis) | no | `bullmq` |
| [AWS SQS](#aws-sqs) | `/sqs` | AWS SQS | no | `@aws-sdk/client-sqs` |
| [NATS](#nats) | `/nats` | NATS, JetStream-compatible core pub/sub | no | `nats` |
| [MQTT](#mqtt) | `/mqtt` | MQTT | no | `mqtt` |
| [Google Cloud Pub/Sub](#google-cloud-pubsub) | `/pubsub` | Google Cloud Pub/Sub | no | `@google-cloud/pubsub` |
| [In-memory](#in-memory-tests) | `/memory` | in-process, for tests | no | none |

### RabbitMQ

```ts
import { rabbitmq } from '@api-kickstart/api-kickstart/rabbitmq'

broker: rabbitmq({ url: env.AMQP_URL, exchange: 'app' })
```

`RabbitmqOptions`: `{ url: string /* required */; exchange?: string /* default '' — empty publishes directly to a queue by name via sendToQueue instead of through an exchange */; exchangeType?: 'topic' | 'direct' | 'fanout' /* default 'topic' */; outbox?: OutboxStore; attemptHeader?: string /* default 'x-attempt' */ }`.

When `exchange` is set, it's asserted durable and messages are `channel.publish(exchange, topic, payload, { persistent: true })`; otherwise `channel.sendToQueue(topic, payload, { persistent: true })`. `consume` sets `channel.prefetch(concurrency ?? 1)`, derives the queue name as `` `${topic}.${group}` `` when a `group` is given, asserts it durable, binds it to the exchange (if any) with `topic` as the routing key, and acks on success / nacks (no requeue) on a thrown error.

### Kafka

```ts
import { kafka } from '@api-kickstart/api-kickstart/kafka'

broker: kafka({ brokers: ['kafka:9092'], clientId: 'my-api', groupId: 'my-api-group' })
```

`KafkaOptions`: `{ brokers: string[] /* required */; clientId?: string /* default 'api-kickstart' */; groupId?: string /* default 'api-kickstart', used when consumeOptions.group isn't set */; outbox?: OutboxStore }`. Consumer concurrency maps to `partitionsConsumedConcurrently`; subscribes with `fromBeginning: false`; message `attempt` is always `1` (Kafka doesn't track delivery attempts natively).

### Redis Streams

```ts
import { redisStream } from '@api-kickstart/api-kickstart/redis-stream'

broker: redisStream({ url: env.REDIS_URL, consumerGroup: 'my-api' })
```

`RedisStreamOptions`: `{ url?: string /* default 'redis://localhost:6379' */; consumerGroup?: string /* default 'api-kickstart', used when consumeOptions.group isn't set */; blockTimeoutMs?: number /* default 5000 — XREADGROUP BLOCK duration */; payloadField?: string /* default 'payload' */ }`. `publish` does `XADD topic * <payloadField> <json>`. `consume` creates the consumer group via `XGROUP CREATE ... MKSTREAM` (idempotent — swallows "already exists"), generates a unique consumer name, then loops `XREADGROUP ... BLOCK`, `XACK`-ing each message after a successful `onMessage`, until `close()`.

### BullMQ

```ts
import { bullmq } from '@api-kickstart/api-kickstart/bullmq'

broker: bullmq({ connection: { host: env.REDIS_HOST, port: 6379 } })
```

`BullmqOptions`: `{ connection: ConnectionOptions /* required — BullMQ's ioredis-shaped connection config */ }`. `publish` calls `Queue.add(topic, message)` (one `Queue` created/cached per topic). `consume` spins up a `Worker` with `concurrency: consumeOptions.concurrency ?? 1`; `attempt` is `job.attemptsMade + 1`. `close()` closes all workers then all queues.

### AWS SQS

```ts
import { sqs } from '@api-kickstart/api-kickstart/sqs'

broker: sqs({ region: 'us-east-1' })

// topic is the queue URL, not a logical name
await ctx.broker.publish('https://sqs.us-east-1.amazonaws.com/123456789012/orders', order)
```

`SqsOptions`: `{ region?: string; clientConfig?: SQSClientConfig; waitTimeSeconds?: number /* default 10 — long-poll wait time */ }`. **`publish`/`consume`'s `topic` argument is the SQS Queue URL itself**, not a logical topic name — SQS has no separate topic/queue-name concept here. `consume` long-polls in a loop, clamping `MaxNumberOfMessages` to `min(concurrency ?? 1, 10)` (SQS's hard per-poll cap), and deletes the message after a successful `onMessage`; `attempt` comes from SQS's `ApproximateReceiveCount`.

### NATS

```ts
import { nats } from '@api-kickstart/api-kickstart/nats'

broker: nats({ servers: ['nats://localhost:4222'] })
```

`NatsOptions`: `{ servers: string | string[] /* required */ }`. Connection is established lazily (memoized) on first use. `consume`'s `group` maps to NATS queue-group semantics. `attempt` is always `1`.

### MQTT

```ts
import { mqtt } from '@api-kickstart/api-kickstart/mqtt'

broker: mqtt({ url: 'mqtt://broker.example.com' })
```

`MqttOptions`: `{ url: string /* required */ }`. Connects immediately on factory call. `consume` stores one handler per topic — calling `consume()` again for the same topic **replaces** the previous handler rather than fanning out to both. `attempt` is always `1`.

### Google Cloud Pub/Sub

```ts
import { pubsub } from '@api-kickstart/api-kickstart/pubsub'

broker: pubsub({ projectId: env.GCP_PROJECT_ID })
```

`PubsubOptions`: `{ projectId?: string; clientConfig?: ClientConfig }`. `consume` derives the subscription name as `` `${topic}-${group}` `` when `group` is set, else just `topic` — **the matching Pub/Sub subscription resource must already exist** with that exact name (this adapter doesn't create subscriptions). Messages are JSON-parsed, `msg.ack()`'d after a successful `onMessage`, `msg.nack()`'d on a thrown error; `attempt` comes from `msg.deliveryAttempt ?? 1`.

### In-memory (tests)

```ts
import { memoryBroker } from '@api-kickstart/api-kickstart/memory'

broker: memoryBroker({ deliverOnPublish: true })   // default true
```

`MemoryBrokerOptions`: `{ deliverOnPublish?: boolean /* default true */ }`. Returns a `MemoryBrokerAdapter` — a `BrokerAdapter` extended with a `published: { topic; message }[]` array recording everything ever published, for assertions in tests. Unlike `mqtt`'s single-handler-per-topic, multiple `consume()` calls for the same topic all get delivered (fan-out). Nothing extra to install — this is also what `@api-kickstart/api-kickstart/testing`'s `memoryBroker()` re-exports for use in `createTestApp()`. See [Testing](#testing).

### Publishing

```ts
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
  handler: async (ctx) => {
    ctx.message        // validated payload
    ctx.attempt        // per-adapter delivery-attempt counter, see each adapter's section above
    ctx.db             // same clients as HTTP handlers
    ctx.logger
  },
})
```

`ConsumeOptions`: `{ topic: string; group?: string; schema?: unknown; concurrency?: number; handler: (ctx) => Promise<void> }`. Consumers get the same context, validation, error normalization, and logging as HTTP routes. One mental model for both.

### Transactional outbox

The hard part of publishing events: the database commits, then the broker call fails, and the event is gone forever.

```ts
import { pgOutboxStore } from '@api-kickstart/api-kickstart/pg'
import { rabbitmq } from '@api-kickstart/api-kickstart/rabbitmq'

const outbox = pgOutboxStore(pgPool)

broker: rabbitmq({ url: env.AMQP_URL, outbox })
```

With an `outbox` store configured, `publish(topic, message, { tx })` writes a row to the outbox table instead of talking to the broker directly — pass the transaction's `tx` object so the insert commits atomically with the rest of your write:

```ts
handler: async (ctx) => {
  return ctx.db.transaction(async (tx) => {
    const order = await tx.order.create({ data: ctx.body })
    await ctx.broker.publish('order.created', order, { tx })
    return order
  })
}
```

A background relay (started automatically once `outbox` is set, stopped by `broker.close()`) polls for unpublished rows and delivers them for real, with at-least-once semantics — that means consumers **must be idempotent**. The relay defaults to a 2-second poll interval and a batch size of 20 (`OutboxRelayOptions { intervalMs?, batchSize? }`, internal to `startOutboxRelay` — the broker adapters above use the defaults).

The `OutboxStore` interface:

```ts
interface OutboxStore {
  save(entry: { topic: string; message: unknown }, tx?: unknown): Promise<void>
  listPending(limit: number): Promise<OutboxEntry[]>   // OutboxEntry: { id, topic, message, createdAt }
  markPublished(id: string): Promise<void>
}
```

Three implementations ship out of the box, each with a matching `{ tableName?/collectionName?, ensureTable?/ensureIndexes? }` options bag (all default to auto-creating the underlying table/collection/indexes lazily on first use):

- `pgOutboxStore(pool, options?)` — `@api-kickstart/api-kickstart/pg`, table default `_api_kickstart_outbox`
- `knexOutboxStore(client, options?)` — `@api-kickstart/api-kickstart/knex`, works against Postgres/MySQL/SQLite/anything Knex supports, table default `_api_kickstart_outbox`
- `mongodbOutboxStore(db, options?)` — `@api-kickstart/api-kickstart/mongodb`, collection default `_api_kickstart_outbox`, with a compound index on `{ publishedAt: 1, createdAt: 1 }`

Only `rabbitmq()` and `kafka()` accept the `outbox` option today — the other six broker adapters don't wire it in. Implementing `OutboxStore` against another database and passing it to `rabbitmq`/`kafka`'s `outbox` option plugs the same mechanism into it; to use the outbox pattern with a different broker adapter, call `startOutboxRelay(store, publishFn)` (also exported from the root subpath) yourself.

### Writing your own broker adapter

Implement the `BrokerAdapter` interface shown at the top of this section — only `publish` is required; `consume`/`close` are optional.

### Graceful shutdown

```ts
import { gracefulShutdown } from '@api-kickstart/api-kickstart'

app.listen(port)
gracefulShutdown(app, { drainTimeoutMs: 10_000, closeTimeoutMs: 10_000 })
```

`GracefulShutdownOptions`: `{ signals?: NodeJS.Signals[] /* default ['SIGTERM','SIGINT'] */; drainTimeoutMs?: number /* default 10000 */; closeTimeoutMs?: number /* default 10000 */; exitProcess?: boolean /* default true */; onShutdownStart?: () => void; onShutdownComplete?: () => void }`. Returns the `shutdown()` function itself, if you want to trigger it manually instead of only on a signal.

On a configured signal, in order: stop accepting new HTTP requests (in-flight ones still get a response, via `app.drain()`) → wait for in-flight requests to finish, up to `drainTimeoutMs` (`app.waitForInFlight()`) → close the framework, broker, and database, up to `closeTimeoutMs` (`app.close()`) → `process.exit(0)` unless `exitProcess: false`. Getting this order wrong is how requests get cut off mid-response.

---

## Storage

For persisting uploaded files (see [File uploads](#file-uploads)) or any other blob somewhere durable. Optional — skip the import and nothing storage-related is loaded.

```ts
interface StorageAdapter {
  put(key: string, data: Buffer, meta?: { contentType?: string; size?: number }): Promise<void>
  get(key: string): Promise<Buffer | null>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, options?: { expiresInSeconds?: number }): Promise<string>
}
```

```ts
import { s3Storage } from '@api-kickstart/api-kickstart/s3'

const app = createApp({
  storage: s3Storage({ bucket: env.UPLOADS_BUCKET, region: env.AWS_REGION }),
})

app.route({
  method: 'POST',
  path: '/avatars',
  auth: true,
  handler: async (ctx) => {
    const file = ctx.files.avatar[0]
    const key = `avatars/${ctx.user.id}`
    await ctx.storage.put(key, file.data, { contentType: file.contentType })
    return { url: await ctx.storage.getSignedUrl(key, { expiresInSeconds: 300 }) }
  },
})
```

`S3StorageOptions` reference:

| Field | Type | Notes |
|---|---|---|
| `bucket` | `string` | **required** |
| `client` | `S3Client` | optional pre-built client; if omitted, one is constructed from the fields below |
| `region` | `string` | optional |
| `endpoint` | `string` | optional — set this **and** `forcePathStyle: true` for non-AWS S3-compatible services (MinIO, R2, DigitalOcean Spaces, ...) |
| `forcePathStyle` | `boolean` | optional, see above |
| `credentials` | `{ accessKeyId: string; secretAccessKey: string }` | optional |

`put()` sets `ContentType`/`ContentLength` from `meta`. `get()` returns `null` specifically when the object doesn't exist (S3's `NoSuchKey` error), and rethrows any other error. `getSignedUrl()` presigns via `@aws-sdk/s3-request-presigner`, `expiresInSeconds` defaulting to `900` (15 minutes). Uses: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` (both `^3.635.0`).

### Writing your own storage adapter

Implement the `StorageAdapter` interface shown above to target something else (local disk, GCS, Azure Blob); there's nothing S3-specific in how core uses it.

---

## Logging

```ts
interface Logger {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  child(bindings: Record<string, unknown>): Logger
}
```

The default `logger` (used if you don't configure one) is a thin `console`-based implementation. Swap in structured, production-grade logging:

```ts
import { pinoLogger } from '@api-kickstart/api-kickstart/pino'

createApp({ logger: pinoLogger({ pinoOptions: { level: 'info' } }) })
```

`PinoLoggerOptions`: `{ instance?: PinoInstance /* pre-built pino Logger, takes precedence */; pinoOptions?: PinoOptions /* pino's own LoggerOptions, used only when instance isn't supplied */ }`. `child(bindings)` calls the underlying pino instance's `.child()` and re-wraps the result, so child loggers (e.g. `ctx.logger` with `requestId` bound in) also satisfy the `Logger` interface. Uses: `pino` (`^9.4.0`).

### Writing your own logger

Implement the `Logger` interface shown above to wire in Winston, Bunyan, or a remote logging service — anything with `debug`/`info`/`warn`/`error`/`child` (or a thin wrapper providing them) works.

---

## Redis-backed stores and lock

The in-memory defaults for `rateLimit`, `idempotency`, `cache`, and `session` (and the lock used by `app.schedule()`) are fine for a single instance. For anything running more than one instance behind a load balancer, `@api-kickstart/api-kickstart/redis` provides real Redis-backed implementations of all five:

```ts
import { redisRateLimitStore, redisIdempotencyStore, redisCacheStore, redisSessionStore, redisLock } from '@api-kickstart/api-kickstart/redis'
import { rateLimit, idempotency, cache } from '@api-kickstart/api-kickstart/middleware'
import { session } from '@api-kickstart/api-kickstart/auth'

const redisOptions = { url: env.REDIS_URL }

middleware: [
  rateLimit({ window: '1m', max: 100, store: redisRateLimitStore('1m', redisOptions) }),
  idempotency({ store: redisIdempotencyStore(redisOptions) }),
  cache({ store: redisCacheStore(redisOptions) }),
]

session({ store: redisSessionStore(redisOptions) })
```

Shared `RedisStoreOptions` (every factory below accepts this bag): `{ url?: string /* default 'redis://localhost:6379', ignored if redis is given */; redis?: Redis /* pre-built ioredis client */; keyPrefix?: string /* default 'kickstart:' */ }`.

| Factory | Implements | Signature | Notes |
|---|---|---|---|
| `redisCacheStore(options?)` | `CacheStore` | `(options: RedisStoreOptions = {}) => CacheStore` | keys namespaced `<prefix>cache:<key>`, `SET ... PX <ttlMs>` |
| `redisIdempotencyStore(options?)` | `IdempotencyStore` | `(options: RedisStoreOptions = {}) => IdempotencyStore` | keys `<prefix>idempotency:<key>` |
| `redisRateLimitStore(window, options?)` | `RateLimitStore` | `(window: string, options: RedisStoreOptions = {}) => RateLimitStore` | **note the required leading `window` argument** (e.g. `'1m'`) — the only one of the five that isn't options-only; `INCR` + `PEXPIRE` only on the first hit (fixed-window counter) |
| `redisSessionStore(options?)` | `SessionStore` | `(options: RedisStoreOptions = {}) => SessionStore` | keys `<prefix>session:<sid>`; `set()` with an already-past `expiresAt` deletes instead of writing |
| `redisLock(options?)` | `Lock` | `(options: RedisStoreOptions = {}) => Lock` | `acquire` = atomic `SET key token PX ttlMs NX`; `release` runs a Lua script that only deletes if the caller's token still matches — safe against releasing a lock you no longer hold |

`Lock` interface (also relevant to [Scheduled tasks](#scheduled-tasks)):

```ts
interface Lock {
  acquire(key: string, ttlMs: number): Promise<boolean>
  release(key: string): Promise<void>
}
```

Uses `ioredis` (`^5.4.1`) for the whole `/redis` subpath — the same one used by [Redis Streams](#redis-streams).

---

## Webhooks

HMAC-SHA256 signing and verification, for receiving webhooks from a provider and for signing your own outbound ones — the same pattern Stripe and GitHub use:

```ts
import { signWebhook, verifyWebhook, WebhookSignatureError } from '@api-kickstart/api-kickstart'

// sending
const body = JSON.stringify({ event: 'order.created', orderId: order.id })
const signature = signWebhook(body, { secret: env.WEBHOOK_SECRET })
await fetch(subscriberUrl, { method: 'POST', body, headers: { 'x-signature': signature } })

// receiving
app.route({
  method: 'POST',
  path: '/webhooks/inbound',
  auth: false,
  handler: async (ctx) => {
    const rawBody = JSON.stringify(ctx.body)
    try {
      verifyWebhook(rawBody, ctx.headers['x-signature'] as string, { secret: env.WEBHOOK_SECRET })
    } catch (err) {
      if (err instanceof WebhookSignatureError) throw new Unauthorized('Invalid webhook signature')
      throw err
    }
    // ctx.body is now trusted
  },
})
```

`signWebhook(payload, { secret, timestamp? })` — `timestamp` defaults to `Date.now()`, returns `t=<timestamp>,v1=<hex hmac>`. `verifyWebhook(payload, signatureHeader, { secret, toleranceSeconds? })` — `toleranceSeconds` defaults to `300` (5 minutes); throws `WebhookSignatureError` for a malformed header, a timestamp outside the tolerance window, or a signature mismatch. Comparison is constant-time (`timingSafeEqual`).

---

## Framework adapters

```ts
interface FrameworkAdapter {
  name: string
  onRequest(handler: DispatchHandler): void
  listen(port: number, cb?: () => void): unknown
  handler(): unknown
  close?(): Promise<void>
}
```

| Adapter | Subpath | Framework | Underlying library |
|---|---|---|---|
| [Express](#express) | `/express` | Express 4 and 5 | `express` |
| [Fastify](#fastify) | `/fastify` | Fastify 4 and 5 | `fastify` |
| [Hono](#hono) | `/hono` | Hono — Node, Bun, Deno, Cloudflare Workers | `hono` |
| [Koa](#koa) | `/koa` | Koa | `koa` |
| [NestJS](#nestjs) | `/nest` | NestJS module | `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs` |
| [Node `http`](#node-http) | `/http` | Node's built-in `http`, no framework | none |

Same route definitions across all of them. Switching frameworks means changing one import.

### Express

```ts
import { express, adapt } from '@api-kickstart/api-kickstart/express'

framework: express()                          // or: express({ app: existingExpressApp })
middleware: [adapt(someExpressMiddleware)]    // wraps native (req, res, next) middleware
```

`express(options?: { app?: Express }): FrameworkAdapter`. If you don't pass `app`, one is created internally. Also exports `adapt(middleware: RequestHandler)` — wraps a native Express middleware into api-kickstart's `Middleware` signature by reaching into `ctx.raw.req`/`ctx.raw.res`.

Already have an Express app? Mount instead of replacing:

```ts
const existing = express()
existing.use('/v2', app.handler())
```

### Fastify

```ts
import { fastify } from '@api-kickstart/api-kickstart/fastify'

framework: fastify()   // or: fastify({ app: existingFastifyInstance })
```

`fastify(options?: { app?: FastifyInstance }): FrameworkAdapter`. `listen()` binds to host `0.0.0.0`.

### Hono

```ts
import { hono } from '@api-kickstart/api-kickstart/hono'

framework: hono()   // or: hono({ app: existingHonoApp })
```

`hono(options?: { app?: Hono }): FrameworkAdapter`. Runs on Node via `@hono/node-server` (bundled as a regular dependency of the package, so it's always installed — no separate `npm install` needed for it specifically). Works equally on Bun, Deno, and Cloudflare Workers when you drive `app.handler()` yourself instead of calling `.listen()`.

### Koa

```ts
import { koa } from '@api-kickstart/api-kickstart/koa'

framework: koa()   // or: koa({ app: existingKoaApp })
```

`koa(options?: { app?: Koa }): FrameworkAdapter`. Uses `koa-bodyparser` internally (also a regular dependency, always installed).

### NestJS

```ts
import { nest } from '@api-kickstart/api-kickstart/nest'

framework: nest()   // takes no options
```

`nest(): FrameworkAdapter`. Importing this adapter has the side effect of importing `'reflect-metadata'`, required for Nest's decorators. Internally builds a `NestExpressApplication` via `NestFactory.create(KickstartModule, { logger: false, bodyParser: false })` and mounts a catch-all controller that forwards every request into api-kickstart's own dispatch — Nest's own routing/decorators/DI aren't used for your `app.route()` definitions, only as the HTTP transport. Uses: `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs` (and transitively `express`, since Nest's platform-express mounts it).

### Node `http`

```ts
import { http } from '@api-kickstart/api-kickstart/http'

framework: http()   // or: http({ server: existingHttpServer })
```

`http(options?: { server?: Server }): FrameworkAdapter`. Zero framework dependency — built entirely on Node's built-in `node:http`. The lightest option if you don't need Express/Fastify/Koa's ecosystem.

### Writing your own framework adapter

Implement the `FrameworkAdapter` interface shown at the top of this section — `onRequest` receives the single dispatch handler `(req: RequestLike, raw: RawRequest) => Promise<DispatchResult>` to call on every incoming request; translate your framework's native request into `RequestLike` (`{ method, path, headers, cookies, rawQuery, rawBody }`) and its response from `DispatchResult` (`{ status, body, headers? }`).

---

## Configuration

Environment variables, validated at boot:

```ts
import { env } from '@api-kickstart/api-kickstart/env'
import { z } from 'zod'

export const config = env({
  NODE_ENV:     z.enum(['development', 'test', 'production']),
  PORT:         z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET:   z.string().min(32),
  AMQP_URL:     z.string().url().optional(),
})
```

`env<S>(schema: S, source: Record<string, string | undefined> = process.env)` — `schema` is a plain object whose values are anything with a `.parse(value)` method, so any Zod (or Zod-shaped) schema works directly; the return type is inferred from each field's parse return type. Missing or malformed variables throw `EnvValidationError` (with an `issues: { key, message }[]` array) at startup with a readable list of what's wrong — not at 2am when the first request touches that code path.

The `env:example` CLI command reads that same schema from a config file and generates a `.env.example` from it:

```ts
// api-kickstart.config.mjs
export { config as envSchema } from './src/env.js'
```

```bash
npx api-kickstart env:example              # reads ./api-kickstart.config.mjs by default
npx api-kickstart env:example --config ./config/app.mjs --out .env.sample
```

---

## OpenAPI generation

Because routes are data, the spec is free:

```ts
app.openapi({
  info: { title: 'My API', version: '1.0.0', description: 'optional' },
  servers: [{ url: 'https://api.example.com' }],
  json: '/openapi.json',  // raw spec as JSON
  serve: '/docs',         // a real interactive docs page (Scalar), pointed at `json`
})
```

`OpenApiOptions`: `{ info: { title: string; version: string; description?: string }; servers?: { url: string }[]; serve?: string; json?: string }`.

`serve` renders an actual HTML page — [Scalar](https://scalar.com)'s API reference UI, loaded from its CDN script and pointed at `json` via `data-url`. If you configure `serve` without `json`, the spec is embedded directly into the page instead, so you still get interactive docs without exposing a separate raw-JSON endpoint.

Paths, parameters, path-parameter names, auth requirements (`security`), tags, and summaries are derived from what you already declared on each route (`RouteConfig.tags`/`.summary`/`.auth`/`.roles`) — no decorators, no JSDoc comments, no second source of truth that drifts.

**Request and response schemas** are included too, when the configured validator supports it — all five validator adapters do, each via the mechanism noted in its section above: [Zod](#zod) (`zod-to-json-schema`), [TypeBox](#typebox) (already is JSON Schema), [Joi](#joi) (`joi-to-json`), [Yup](#yup) (`@sodaru/yup-to-json-schema`), and [Valibot](#valibot) (`@valibot/to-json-schema`):

```ts
app.route({
  method: 'POST',
  path: '/orders',
  body: z.object({ sku: z.string(), qty: z.number().int().positive() }),
  response: z.object({ id: z.string(), total: z.number() }),
  handler: async (ctx) => { /* ... */ },
})
```

...produces a real `requestBody` and `200` response schema in the spec, plus one `in: query` parameter per property for a `query` schema — regardless of which of the five you use.

---

## Health & metrics

```ts
app.health({
  path: '/health',                                    // default
  checks: { redis: async () => redis.ping().then(() => true).catch(() => false) },
})

app.metrics('/metrics')   // Prometheus text format, path defaults to '/metrics'
```

`HealthCheckOptions`: `{ path?: string /* default '/health' */; checks?: Record<string, () => Promise<boolean>> }`. `/health` runs `db.healthcheck()` (if a `db` adapter is configured and implements it) plus every custom check, and returns `200 { status: 'ok', checks: {...} }` or `503 { status: 'degraded', checks: {...} }` — point your load balancer or orchestrator's liveness probe at it.

`app.metrics(path?)` — `path` defaults to `/metrics`. Exposes per-route request counts, cumulative duration, and 5xx error counts as Prometheus text-format counters `api_kickstart_requests_total`, `api_kickstart_request_duration_ms_sum`, and `api_kickstart_errors_total`, each labeled by `route`. Scrape it with Prometheus, or point any compatible collector at it.

---

## Scheduled tasks

Recurring work that isn't tied to an incoming request or a queue message — cache warmups, cleanup sweeps, digest emails:

```ts
app.schedule('expire-sessions', { interval: '1h', runImmediately: true }, async () => {
  await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
})
```

`ScheduleOptions`: `{ interval: string /* required, duration string */; runImmediately?: boolean; onError?: (err: unknown, name: string) => void; lock?: Lock; lockTtlMs?: number }`.

This is `setInterval` under the hood, running in-process — not a cron-expression parser. What it does give you: errors in the handler are caught (routed to `onError` if provided, else logged) instead of crashing the process, and every scheduled task is stopped automatically by `app.close()`.

Running more than one instance? Pass a `lock` so only one instance actually runs the handler each tick, instead of all of them:

```ts
import { redisLock } from '@api-kickstart/api-kickstart/redis'

app.schedule(
  'expire-sessions',
  { interval: '1h', runImmediately: true, lock: redisLock({ url: env.REDIS_URL }) },
  async () => {
    await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } })
  },
)
```

Every instance's timer fires on the same cadence; whichever one wins the `SET NX PX` race for that tick runs the handler, the rest skip it silently. The lock's TTL defaults to the task's `interval` (override with `lockTtlMs`) and is released right after the handler finishes — including when it throws — so a slow or crashed instance can't hold the cluster hostage past one interval. Without `lock`, it's `setInterval`, once per instance, same as before. `lock` accepts any `Lock` implementation, not just `redisLock` — see [Redis-backed stores](#redis-backed-stores-and-lock).

---

## Testing

```ts
import { createTestApp, memoryBroker, runDbConformance } from '@api-kickstart/api-kickstart/testing'

const app = createTestApp({
  ...config,
  broker: memoryBroker(),
})

const res = await app.inject({
  method: 'GET',
  path: '/orders',
  headers: { 'x-custom': '1' },
  query: { status: 'open' },
  body: undefined,
  as: { id: 'u1', role: 'staff' },   // skip real login
})

expect(res.status).toBe(200)
expect(app.broker.published).toContainEqual(
  expect.objectContaining({ topic: 'order.created' })
)
```

`createTestApp(options: CreateAppOptions): App` is a thin alias for `createApp` — same options, named differently for intent at the call site.

`app.inject(request: InjectRequest): Promise<InjectResult>` — `InjectRequest = { method: string; path: string; headers?: Record<string, string>; query?: Record<string, unknown>; body?: unknown; as?: AuthenticatedUser }`, `InjectResult = { status: number; body: unknown; headers: Record<string, string> }`. `as` builds a valid authenticated context directly, so tests don't need to hit a login endpoint or construct a real token.

`memoryBroker()` (re-exported here from [`/memory`](#in-memory-tests)) records everything published in `.published` for assertions.

`runDbConformance(factory: () => DbAdapter): void` checks a `DbAdapter` implementation's basic shape — see [Writing your own database adapter](#writing-your-own-database-adapter).

---

## CLI

Every command reads a config file — `api-kickstart.config.mjs` in the current directory by default, or `--config <path>`:

```ts
// api-kickstart.config.mjs
import { createApp } from '@api-kickstart/api-kickstart'
import { config as envSchema } from './src/env.js'

export const app = createApp({ /* ... */ })
export { envSchema }
```

`app` can also be a function (sync or async) returning an `App`, if constructing it has side effects you'd rather defer.

```bash
npx api-kickstart doctor                              # run the production checklist, exit 1 on any failure
npx api-kickstart env:example                          # write .env.example from envSchema
npx api-kickstart env:example --out .env.sample         # custom output path
npx api-kickstart routes                               # print every registered route: method, path, auth, roles, scope
npx api-kickstart openapi:generate                     # write the app's already-registered OpenAPI spec to openapi.json
npx api-kickstart openapi:generate --path /docs.json --out ./dist/openapi.json
npx api-kickstart <command> --config ./path/to/config.mjs
```

| Command | What it does |
|---|---|
| `doctor` | runs the [production checklist](#production-checklist) against your `App`, exits `1` if any check fails |
| `env:example` | writes a `.env.example` derived from `envSchema` exported by your config file |
| `routes` | prints every registered route (method, path, auth, roles, scope) from `app.routes()` |
| `openapi:generate` | fetches the OpenAPI JSON your app already serves (via `app.openapi({ json })`) and writes it to disk |

`openapi:generate` doesn't rebuild the spec — it calls the route your app already registered via `app.openapi({ json: '...' })` and writes the response to disk, so `--path` must match whatever path you passed there (default `/openapi.json`, matching `openapi()`'s own default). Running `npx api-kickstart` with no command, or an unrecognized one, prints the usage line above.

---

## Production checklist

`npx api-kickstart doctor` checks these against a running `App` (point it at a config file — see [CLI](#cli)):

- [ ] `JWT_SECRET` is at least 32 bytes and not a placeholder value (checked against `changeme`, `secret`, `your-secret-here`, `example`) — only runs if `JWT_SECRET` is set in the environment at all
- [ ] Every route has either `auth: true` or an explicit `auth: false`
- [ ] Every scoped resource defines at least one role
- [ ] `scopeAudit` is not left at `'off'`
- [ ] Every route whose path matches `/login/i` has `rateLimit` configured
- [ ] A `SIGTERM` handler is registered (call `gracefulShutdown(app)` before `app.listen()`)

Enforced structurally, so `doctor` doesn't need to check them — `createApp()` throws at startup instead:

- [ ] `cors: 'dev'` is refused when `NODE_ENV=production`
- [ ] `cors: { origin: '*', credentials: true }` is refused outright
- [ ] Refresh tokens rotate on every use, and reuse revokes the whole token family — there's no toggle to turn this off

Not yet automated — verify these yourself:

- [ ] Response validation passes across your test suite (`response` schemas run automatically outside `NODE_ENV=production`)
- [ ] Broker consumers are idempotent when an outbox is enabled (see [Transactional outbox](#transactional-outbox))
- [ ] Passwords are stored via `hashPassword()`, never plain text (`doctor` has no way to inspect your database)
- [ ] `csrf()` is in the middleware chain for any route reachable via cookie/session auth (bearer-token routes don't need it)
- [ ] A non-default `RefreshStore`/`SessionStore`/rate-limit-etc. store is configured if you run more than one instance (the built-in defaults are in-memory per process — see [Redis-backed stores](#redis-backed-stores-and-lock))
- [ ] `app.resource()`'s generated `list` action has no built-in pagination — add it yourself for any table that can grow large (see [CRUD shorthand](#crud-shorthand))

---

## FAQ

**Isn't this just a framework?**
It composes your framework rather than replacing it. Routes stay data, `ctx.raw` exposes the underlying objects, and you can mount it on part of an existing app. If you delete it, you're left with ordinary Express or Fastify code, not a rewrite.

**Why not Passport, Better Auth, or Auth.js?**
Use them if they fit. They handle authentication well and stop there. This covers the rest of the day-one setup — validation, scope, errors, database, broker — and its distinctive piece is **row-level scope**, which none of them address.

**Do I have to use all of it?**
No. Every option is optional. Use it for auth and scope only, or as a broker consumer runner with no HTTP at all.

**Do I have to install every adapter's dependency?**
No — see [Install](#install). Every adapter's underlying library ships bundled with the package; `npm install @api-kickstart/api-kickstart` is the only install step, for anything you use.

**Is it safe to write my own auth?**
Not the cryptography, and this package doesn't. `jose` handles JWT signing/verification, `node:crypto`'s `scrypt` handles password hashing. What's here is the wiring around them, which is where most real bugs live.

**How does this handle multi-tenancy?**
Scope is the mechanism. Define `tenantId` filters per resource and enable `scopeAudit: 'throw'` in CI so an unscoped query can never reach production.

**Does `app.resource()` paginate large tables?**
No, not out of the box — see the note in [CRUD shorthand](#crud-shorthand). Use `app.route()` for that one endpoint if you need it.

**What about migrations?**
Out of scope. Use your ORM's migration tool.

**Is this a monorepo of separate packages?**
No — everything (core engine plus all 31 adapters) ships as one npm package, `@api-kickstart/api-kickstart`, with adapters exposed as subpath imports. See [Repository layout](#repository-layout).

---

## Repository layout

Everything ships as a single published package, `@api-kickstart/api-kickstart`, but the source stays organized by concern:

- `packages/core/src` — the core engine (routing, context, auth strategies, authorization, CORS, errors, env, testing, OpenAPI), split into focused modules (`router.ts`, `group.ts`, `resource.ts`, `authorize.ts`, `cors.ts`, `openapi.ts`, `health.ts`, `metrics.ts`, `lifecycle.ts`, `outbox.ts`, `webhooks.ts`, `doctor.ts`, `env.ts`, `context.ts`, `errors.ts`, `types.ts`, `testing.ts`, `auth/*`, `builtins/*`, `cli/*`) rather than one file.
- `packages/core/src/adapters/<name>` — one directory per adapter (framework, database, broker, validator, storage, logger), each exposed as its own subpath export (`@api-kickstart/api-kickstart/<name>`) in `packages/core/package.json`'s `exports` map. Each wraps its underlying library's real client and, where it has more than one concern, splits into `index.ts` (the factory), `types.ts` (options), and `errors.ts` (error-code normalization to `AppError` subclasses).
- `examples/blog-api` — a runnable reference app (JWT auth, row-level scope, `resource()`, in-memory `DbAdapter`, zero external services) — see [its README](./examples/blog-api/README.md).

Every adapter is a working implementation, not a placeholder — see the [Roadmap](#roadmap) for what's still open.

Tests run with `vitest` (`npm test`), linting with `eslint` (`npm run lint`), and CI runs both plus `build`/`typecheck` on every push and PR — see [CONTRIBUTING.md](./CONTRIBUTING.md) for the full workflow, including how to add a new adapter and how changesets/versioning work.

---

## Roadmap

- [x] Core: routing, context, roles/permissions/scope, CORS, errors, env, resource(), OpenAPI generation
- [x] Auth strategies: JWT (HS/RS/ES, with refresh rotation), session, API key, basic, OIDC (discovery, PKCE, JWKS)
- [x] Framework adapters: Express, Fastify, native `http`, Hono, Koa, NestJS
- [x] Database adapters: `pg`, Prisma, Drizzle, Mongoose, Knex, TypeORM, Sequelize, MongoDB
- [x] Broker adapters: in-memory, RabbitMQ, Kafka, Redis Streams, BullMQ, SQS, NATS, MQTT, Pub/Sub
- [x] Validator adapters: Zod, Joi, Yup, Valibot, TypeBox
- [x] Built-in middleware: `requestId`, `logger`, `rateLimit`, `bodyLimit`, `timeout`, `idempotency`, `helmet`, `compression`, `cache`, `csrf`, `auditLog`, plus `rateLimit`/`timeout`/`idempotent` as route-level shorthands
- [x] `gracefulShutdown(app)` — drain in-flight requests, then close framework/broker/db on `SIGTERM`
- [x] `npx api-kickstart doctor` / `env:example` / `routes` / `openapi:generate` CLI
- [x] Transactional outbox — `OutboxStore` + `startOutboxRelay`; `pgOutboxStore`, `knexOutboxStore`, and `mongodbOutboxStore` implementations, wired into `rabbitmq()`/`kafka()`
- [x] Runtime `scopeAudit` — detects a scoped route's handler never reading `ctx.scope` at all, and warns/throws
- [x] OpenAPI request/response schema introspection for every validator adapter
- [x] `app.health()` / `app.metrics()` — liveness checks and Prometheus-format metrics
- [x] `multipart/form-data` parsing on every framework adapter, no extra dependency
- [x] `/pino` — structured logger, swaps in for the default console logger
- [x] `hashPassword()` / `verifyPassword()` — scrypt-based, no extra dependency
- [x] `/redis` — Redis-backed `rateLimit`/`idempotency`/`cache`/`session` stores plus a distributed `Lock`, for running behind a load balancer
- [x] `/s3` — `StorageAdapter` for S3-compatible object storage (AWS S3, MinIO, R2), exposed on `ctx.storage`
- [x] `signWebhook()` / `verifyWebhook()` — HMAC-SHA256 with timestamp tolerance, constant-time comparison
- [x] `auditLog()` — structured "who did what" middleware, pluggable sink
- [x] `openapi({ serve })` renders a real interactive docs page (Scalar), not just the raw JSON spec again
- [x] `app.schedule({ lock })` — `redisLock` runs a scheduled task once per cluster instead of once per instance
- [x] Consolidated from 30 separately published packages into one (`@api-kickstart/api-kickstart`) with adapters as bundled subpath exports — one `npm install`, no picking adapters up front
- [x] `/patterns` — named registry of common regex patterns (email, UUID, semver, JWT, ...), extensible with your own custom named patterns via `register()`
- [ ] `scopeAudit` can't verify a handler that reads `ctx.scope` but doesn't actually apply it to the query it runs — only "never touched it at all" is detectable without per-adapter query interception
- [ ] `app.resource()`'s generated `list` action has no pagination, sorting, or filtering beyond the scope filter
- [ ] `apiKey()` has no built-in rate limiting — compose it with the `rateLimit` middleware/route option yourself

Every adapter and built-in listed above as done is a real implementation, not a placeholder. Contributions welcome, especially on the items still open.

---

## License

MIT — see [LICENSE](./LICENSE). Found a security vulnerability? See [SECURITY.md](./SECURITY.md) instead of opening a public issue.

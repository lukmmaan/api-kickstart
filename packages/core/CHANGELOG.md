# @api-kickstart/core

## 1.6.0

### Minor Changes

- Add four new `Lock` implementations alongside the existing `redisLock`, so `app.schedule({ lock })` (or any other "only one caller should run this" scenario) can pick a backend without pulling in Redis:
  
  - `pgLock(pool, options?)` from `/pg` — a lazily-created Postgres lease table.
  - `knexLock(client, options?)` from `/knex` — the same lease-table strategy, portable across every SQL dialect knex supports (mysql, sqlite, mssql, ...).
  - `mongodbLock(db, options?)` from `/mongodb` — an upsert-on-expiry lock document, using MongoDB's own duplicate-key error to detect a still-held lock.
  - `memoryLock()` from `/memory` — an in-process lock backed by a module-level `Map`, no external dependency, for local dev/tests or a single-instance deployment.
  
  All five implementations share the same `Lock` interface (`acquire(key, ttlMs): Promise<boolean>`, `release(key): Promise<void>`) and the same acquire-token-based release safety: a caller can only release a lock it's still holding, so a slow release after the TTL expired can't evict whoever re-acquired the key next.

## 1.5.0

### Minor Changes

- Add UTC support to `/dates`: `formatDateUTC(date, pattern)` and `formatDateAsUTC(date, formatName)` format a `Date` using its UTC fields (year, month, day, hour, day-of-week, and a `+00:00`/`+0000` offset for `Z`/`ZZ`) instead of the process's local time.
  
  `formatDateForDb` now defaults to UTC output for every dialect (previously `mysql`/`postgres`/`sqlite`/`mssql`/`oracle` used local server time, which silently produced different strings depending on where the process ran; `mongodb` was already UTC via `toISOString()`). Pass `{ utc: false }` to keep the old local-time behavior.

## 1.4.0

### Minor Changes

- Add `@api-kickstart/api-kickstart/i18n` — `createI18n({ locales, defaultLocale, dictionaries, detect?, queryParam?, cookieName?, headerName? })` returns a middleware that detects the client's locale from a query param, cookie, or the `Accept-Language` header (with proper `q=` quality-value parsing and region-to-base-language fallback, e.g. `id-ID` matches a configured `id`), falling back to `defaultLocale` when nothing matches. Detected locale is available anywhere in the request via `currentLocale()` (AsyncLocalStorage-backed, same pattern as `currentUser()`). Includes a dictionary-based `t(key, params?, locale?)` translator with dot-path keys, `{param}` interpolation, and automatic fallback to the default locale's dictionary for missing keys. `createTranslator()` exposes the same translation logic standalone, for broker consumers/CLI scripts/scheduled tasks with no HTTP request to detect a locale from.

## 1.3.0

### Minor Changes

- Expand `@api-kickstart/api-kickstart/patterns` from 15 to 112 built-in named regex patterns, covering identifiers/text-case, character classes, IDs (UUID variants, nanoid, MongoDB ObjectId), network (IPv4/IPv6 + CIDR, MAC address, port), colors, security/tokens (JWT, base64/32/58, hashes, bcrypt), dates & times, phone/postal/geo, finance/identity (card networks, IBAN, SSN, ISBN), dev-ecosystem (semver, npm package names, Docker tags, git hashes), and more. Add `@api-kickstart/api-kickstart/dates` — a token-based `formatDate()` (date-fns/dayjs-style tokens), 18 named format presets via `formatDateAs()`, and `formatDateForDb()` producing the date/timestamp string format each of MySQL, Postgres, SQLite, MongoDB, MSSQL, and Oracle expect.

## 1.2.0

### Minor Changes

- Add `@api-kickstart/api-kickstart/patterns` — a named registry of common regex patterns (`email`, `url`, `uuid`, `slug`, `alphanumeric`, `username`, `hexColor`, `ipv4`, `ipv6`, `isoDate`, `isoDateTime`, `semver`, `jwt`, `base64`, `phone`), usable with any validator's own pattern support (Zod, Joi, Yup, Valibot, TypeBox). The default `patterns` registry is extensible with `patterns.register(name, regex)` for your own custom named patterns, and `createPatternRegistry()` creates an isolated registry when you don't want to mutate the shared default.

## 1.1.2

### Patch Changes

- Add `engines.node` (`>=20`, matching the CI matrix) and `publishConfig.access: "public"` so publishing a scoped package doesn't require passing `--access public` by hand. Include `CHANGELOG.md` in the published tarball (it existed on disk but wasn't in `files`, so it never actually shipped).

## 1.1.1

### Patch Changes

- Add `keywords`, `homepage`, `repository`, `bugs`, and `author` to package.json. These were missing entirely, which hurts npm search ranking and quality scoring (npms.io) and means the npm package page had no link back to the GitHub repo.

## 1.1.0

### Minor Changes

- Every adapter's underlying library (`express`, `pg`, `zod`, `pino`, all 30+ of them) is now a regular `dependency` instead of an optional peer dependency. `npm install @api-kickstart/api-kickstart` is now the only install step — no more separately installing the framework/database/broker/validator library for each adapter you use. This makes `node_modules` significantly larger (everything is installed regardless of which subpaths you actually import), which is the explicit tradeoff for a single-command install. `@prisma/client` remains the one exception, since it has to be generated against your own schema.

## 1.0.1

### Patch Changes

- Include the repository's README (and LICENSE) in the published npm package, so it renders on the npm package page. Previously the package had no README at all, since `packages/core` never had its own copy.

## 1.0.0

### Major Changes

- Consolidated every adapter (frameworks, databases, brokers, validators, storage, and logging) into `@api-kickstart/core` as subpath exports (`@api-kickstart/core/express`, `@api-kickstart/core/pg`, `@api-kickstart/core/zod`, and so on) instead of 29 separately published packages. Install one package; each adapter's underlying library is now an optional peer dependency. The previously published `@api-kickstart/<adapter>` packages are unaffected and continue to work, but are no longer maintained — new features and fixes land only in `@api-kickstart/core`.

## 0.2.0

### Minor Changes

- 9a99c91: OpenAPI schema introspection for Joi, Yup, and Valibot (closing the last validator-adapter gap — every validator now produces real request/response schemas). `@api-kickstart/valibot` bumps its `valibot` peer dependency to `^1.4.0` (breaking) to use the official `@valibot/to-json-schema` converter.
  
  `knexOutboxStore` and `mongodbOutboxStore` — transactional outbox support beyond `pg`, against any Knex-supported database and against MongoDB.
  
  `signWebhook()` / `verifyWebhook()` — HMAC-SHA256 webhook signing and verification with timestamp tolerance.
  
  `auditLog()` middleware — structured "who did what" records with a pluggable sink, distinct from `scopeAudit`.
  
  `openapi({ serve })` now renders a real interactive Scalar docs page instead of the raw spec JSON again.
  
  `app.schedule({ lock })` plus `redisLock()` in `@api-kickstart/redis` — run a scheduled task once per cluster instead of once per instance.
- b0b69b7: Add password hashing (`hashPassword`/`verifyPassword`), a `StorageAdapter` interface with a real `@api-kickstart/s3` implementation exposed on `ctx.storage`, `csrf()` double-submit-cookie middleware, `@api-kickstart/redis` Redis-backed `rateLimit`/`idempotency`/`cache`/`session` stores for multi-instance deployments, `npx api-kickstart routes` / `openapi:generate` CLI commands, and `app.schedule()` for interval-based in-process recurring tasks.

### Patch Changes

- 3dacc42: Add a permanent vitest test suite, ESLint, CI, a runnable example app, and changesets tooling to the monorepo. Also fixes empty catch blocks flagged by lint in the outbox relay and the redis-stream/sqs consumer loops (errors are now explicitly discarded instead of silently swallowed with no trace in source).

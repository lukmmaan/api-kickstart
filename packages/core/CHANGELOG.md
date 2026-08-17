# @api-kickstart/core

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

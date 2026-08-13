---
"api-kickstart": minor
"@kickstart/joi": minor
"@kickstart/yup": minor
"@kickstart/valibot": major
"@kickstart/knex": minor
"@kickstart/mongodb": minor
"@kickstart/redis": minor
---

OpenAPI schema introspection for Joi, Yup, and Valibot (closing the last validator-adapter gap — every validator now produces real request/response schemas). `@kickstart/valibot` bumps its `valibot` peer dependency to `^1.4.0` (breaking) to use the official `@valibot/to-json-schema` converter.

`knexOutboxStore` and `mongodbOutboxStore` — transactional outbox support beyond `pg`, against any Knex-supported database and against MongoDB.

`signWebhook()` / `verifyWebhook()` — HMAC-SHA256 webhook signing and verification with timestamp tolerance.

`auditLog()` middleware — structured "who did what" records with a pluggable sink, distinct from `scopeAudit`.

`openapi({ serve })` now renders a real interactive Scalar docs page instead of the raw spec JSON again.

`app.schedule({ lock })` plus `redisLock()` in `@kickstart/redis` — run a scheduled task once per cluster instead of once per instance.

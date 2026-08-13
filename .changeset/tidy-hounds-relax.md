---
"api-kickstart": minor
"@kickstart/redis": minor
"@kickstart/s3": minor
---

Add password hashing (`hashPassword`/`verifyPassword`), a `StorageAdapter` interface with a real `@kickstart/s3` implementation exposed on `ctx.storage`, `csrf()` double-submit-cookie middleware, `@kickstart/redis` Redis-backed `rateLimit`/`idempotency`/`cache`/`session` stores for multi-instance deployments, `npx api-kickstart routes` / `openapi:generate` CLI commands, and `app.schedule()` for interval-based in-process recurring tasks.

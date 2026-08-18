---
"@api-kickstart/api-kickstart": minor
---

Extend the `init`/`add` scaffold wizard with three more independently skippable, multi-select prompts covering more of the package's built-in modules:

- **Ops endpoints** — any combination of `app.health()`, `app.metrics()`, and a full `app.openapi({...})` call, added to `app.ts`.
- **Production essentials** — generates `config/lock.ts` with the distributed lock matching your database adapter (`pgLock`/`knexLock`/`mongodbLock`, falling back to `memoryLock`), wires `gracefulShutdown(app)` into `index.ts`, and adds a real `app.schedule('example-job', ...)` block to `app.ts`.
- **Security middleware** — any combination of `requestId`, `logger`, `helmet`, `compression`, `rateLimit`, `bodyLimit`, `timeout`, `idempotency`, and `csrf` from `@api-kickstart/api-kickstart/middleware`, added to `app.ts`'s middleware array with real default options, in a canonical order regardless of pick order.

Also adds `promptMultiChoice` to the CLI prompt helpers for these multi-select prompts.

---
"api-kickstart": patch
"@kickstart/redis-stream": patch
"@kickstart/sqs": patch
---

Add a permanent vitest test suite, ESLint, CI, a runnable example app, and changesets tooling to the monorepo. Also fixes empty catch blocks flagged by lint in the outbox relay and the redis-stream/sqs consumer loops (errors are now explicitly discarded instead of silently swallowed with no trace in source).

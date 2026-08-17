# Contributing

## Repository structure

Everything ships as a single npm package, `@api-kickstart/api-kickstart`. The workspace is:

- `packages/core` — the only published package. `packages/core/src` holds the core engine (routing, context, auth, authorization, CORS, errors, env, testing, OpenAPI); `packages/core/src/adapters/<name>` holds one directory per adapter (framework, database, broker, validator, storage, logger), each exposed as a subpath export (`@api-kickstart/api-kickstart/<name>`) in `packages/core/package.json`'s `exports` map.
- `examples/*` — runnable reference apps, not published. `examples/blog-api` is the current one.

Adapters typically split into `index.ts` (the factory function), `types.ts` (options), and `errors.ts` (mapping the underlying library's errors to `AppError` subclasses) once there's more than one concern to separate.

Every adapter's underlying library (`express`, `pg`, `zod`, ...) is a regular `dependency` of `@api-kickstart/api-kickstart` — bundled so `npm install @api-kickstart/api-kickstart` is the only install step consumers need, for any adapter they use. Prisma is the one exception (see the README's [Install](./README.md#install) section) since `@prisma/client` has to be generated against the consumer's own schema.

## Setup

```sh
npm install
```

## Common commands

Run from the repo root:

```sh
npm run build       # builds packages/core
npm run typecheck   # builds packages/core, then typechecks everything --if-present
npm run lint        # eslint across packages/*/src and examples/*/src
npm test            # vitest run, across packages/core/src/**/*.test.ts
npm run test:watch  # vitest in watch mode
```

## Code style

- No comments, anywhere. Names should make the code self-explanatory; if a name can't do that, restructure rather than annotate.
- No `any`. If a type is genuinely unknown at a boundary, model it with `unknown` and narrow explicitly.
- Every route declares `auth: true` or `auth: false` explicitly — never leave it implicit.
- Don't add abstractions, options, or fallbacks the current adapter doesn't need. Match the existing adapters' shape rather than inventing a new pattern.

ESLint (`npm run lint`) enforces the mechanical parts of this (no unused vars, no empty blocks, consistent type-only imports). It won't catch the rest — code review does.

## Adding a new adapter

1. Copy the shape of an existing adapter of the same kind (a `DbAdapter` from `packages/core/src/adapters/pg`, a `BrokerAdapter` from `packages/core/src/adapters/rabbitmq`, a `FrameworkAdapter` from `packages/core/src/adapters/fastify`, a `Validator` from `packages/core/src/adapters/zod`) as your starting reference — implement the interface for real against the underlying library, don't stub it.
2. Create `packages/core/src/adapters/<name>/`, add its underlying library to `dependencies` in `packages/core/package.json` (so consumers get it automatically — see [Repository structure](#repository-structure) above), and add a `./​<name>` entry to its `exports` map pointing at `./dist/adapters/<name>/index.{js,d.ts}`.
3. Inside the adapter, import from core with relative paths (`../../index.js`, `../../errors.js`, `../../auth/index.js`, `../../builtins/index.js`) — not the package's own name.
4. Normalize the underlying library's errors to the `AppError` subclasses in `../../errors.js` where it has recoverable, typed error codes worth distinguishing.
5. Add it to the relevant README table/section.
6. Run `npm install && npm run build && npm run typecheck && npm run lint` from the root before opening a PR.
7. Add tests. `packages/core/src/app.test.ts` and the adapter tests in `packages/core/src/adapters/express`, `packages/core/src/adapters/http`, `packages/core/src/adapters/zod`, and `packages/core/src/adapters/memory` show the pattern: unit-test pure logic directly, and for framework adapters, spin up the real adapter with `createApp()` and hit it with `fetch()` against a real listening port rather than mocking the framework.

## Testing

Vitest resolves `.js`-suffixed relative imports (the NodeNext convention this codebase uses) straight to the sibling `.ts` source files, so tests import from source, not from `dist/`. Test files (`*.test.ts`) and `test-helpers.ts` are excluded from `packages/core/tsconfig.json`'s build (`exclude`), so nothing test-related ships in `dist/`.

For an integration-style test against a full `App`, use `app.inject()` (see `packages/core/src/testing.ts` and `packages/core/src/app.test.ts`) — it drives `dispatch()` directly and accepts an `as: user` override to skip real authentication.

## Changesets

Every PR that changes published behavior needs a changeset:

```sh
npx changeset
```

Pick `@api-kickstart/api-kickstart`, the semver bump, and write a one-line summary — it becomes the changelog entry. `examples/*` is excluded from versioning (see `.changeset/config.json`).

Maintainers run `npm run version` to apply pending changesets to `package.json`/`CHANGELOG.md`, and `npm run release` to build and publish.

## Example app

`examples/blog-api` is meant to run with zero external setup (in-memory `DbAdapter`, no real database or broker). If you add a feature to core that's easy to demonstrate, prefer extending this example over writing new prose in the README.

```sh
npm run dev --workspace=@examples/blog-api
```

## CI

`.github/workflows/ci.yml` runs `build`, `typecheck`, `lint`, and `test` on every push and pull request against Node 20 and 22. All four must pass before merge.

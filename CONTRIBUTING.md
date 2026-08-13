# Contributing

## Monorepo structure

npm workspaces, two globs:

- `packages/*` — `api-kickstart` itself (`packages/core`) plus one package per adapter, published as `@kickstart/<name>` (e.g. `@kickstart/express`, `@kickstart/pg`, `@kickstart/zod`).
- `examples/*` — runnable reference apps, not published. `examples/blog-api` is the current one.

Every package has its own `package.json`, `tsconfig.json` (extending the root `tsconfig.base.json`), and `src/` tree. Adapters typically split into `index.ts` (the factory function), `types.ts` (options), and `errors.ts` (mapping the underlying library's errors to `AppError` subclasses) once there's more than one concern to separate.

## Setup

```sh
npm install
```

This installs and links every workspace package, so `@kickstart/express` resolving `import ... from 'api-kickstart'` picks up `packages/core` directly.

## Common commands

Run from the repo root:

```sh
npm run build       # builds packages/core first, then everything else --if-present
npm run typecheck   # same order, --noEmit
npm run lint        # eslint across packages/*/src and examples/*/src
npm test            # vitest run, across packages/*/src/**/*.test.ts
npm run test:watch  # vitest in watch mode
```

`build` and `typecheck` build `api-kickstart` first because every adapter package depends on its compiled `dist/` output for types.

## Code style

- No comments, anywhere. Names should make the code self-explanatory; if a name can't do that, restructure rather than annotate.
- No `any`. If a type is genuinely unknown at a boundary, model it with `unknown` and narrow explicitly.
- Every route declares `auth: true` or `auth: false` explicitly — never leave it implicit.
- Don't add abstractions, options, or fallbacks the current adapter doesn't need. Match the existing adapters' shape rather than inventing a new pattern.

ESLint (`npm run lint`) enforces the mechanical parts of this (no unused vars, no empty blocks, consistent type-only imports). It won't catch the rest — code review does.

## Adding a new adapter

1. Copy the shape of an existing adapter of the same kind (a `DbAdapter` from `packages/pg`, a `BrokerAdapter` from `packages/rabbitmq`, a `FrameworkAdapter` from `packages/fastify`, a `Validator` from `packages/zod`) as your starting reference — implement the interface for real against the underlying library, don't stub it.
2. Give it its own `package.json` (name `@kickstart/<name>`), `tsconfig.json` extending `../../tsconfig.base.json`, and add it to the relevant README section and the `packages/*` workspace glob (already covered — no change needed there).
3. Normalize the underlying library's errors to the `AppError` subclasses in `api-kickstart/errors` where it has recoverable, typed error codes worth distinguishing.
4. Run `npm install && npm run build && npm run typecheck && npm run lint` from the root before opening a PR.
5. Add tests. `packages/core/src/app.test.ts` and the adapter tests in `packages/express`, `packages/http`, `packages/zod`, and `packages/memory` show the pattern: unit-test pure logic directly, and for framework adapters, spin up the real adapter with `createApp()` and hit it with `fetch()` against a real listening port rather than mocking the framework.

## Testing

Vitest resolves `.js`-suffixed relative imports (the NodeNext convention this codebase uses) straight to the sibling `.ts` source files, so tests import from source, not from `dist/`. Test files (`*.test.ts`) and `test-helpers.ts` are excluded from each package's `tsconfig.json` build (`exclude`), so nothing test-related ships in `dist/`.

For an integration-style test against a full `App`, use `app.inject()` (see `packages/core/src/testing.ts` and `packages/core/src/app.test.ts`) — it drives `dispatch()` directly and accepts an `as: user` override to skip real authentication.

## Changesets

Every PR that changes a published package's behavior needs a changeset:

```sh
npx changeset
```

Pick the affected package(s), the semver bump, and write a one-line summary — it becomes the changelog entry. `examples/*` is excluded from versioning (see `.changeset/config.json`).

Maintainers run `npm run version` to apply pending changesets to `package.json`/`CHANGELOG.md`, and `npm run release` to build and publish.

## Example app

`examples/blog-api` is meant to run with zero external setup (in-memory `DbAdapter`, no real database or broker). If you add a feature to core that's easy to demonstrate, prefer extending this example over writing new prose in the README.

```sh
npm run dev --workspace=@examples/blog-api
```

## CI

`.github/workflows/ci.yml` runs `build`, `typecheck`, `lint`, and `test` on every push and pull request against Node 20 and 22. All four must pass before merge.

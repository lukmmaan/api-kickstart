# blog-api

A runnable reference app built on `api-kickstart`. No external services required — auth, database, and everything else run in-memory.

Demonstrates:

- `jwt()` auth with `useAuthRoutes()` (login/refresh/logout/me)
- Row-level scope: `admin` sees everything, `author` sees only their own posts, `reader` sees only published posts
- `resource()` generating CRUD routes on top of an in-memory `DbAdapter`
- `zod()` request validation
- `app.health()`, `app.metrics()`, `app.openapi()`

## Run

```sh
npm install
npm run dev --workspace=@examples/blog-api
```

The server listens on `http://localhost:3000` (override with `PORT`).

Seeded users (`username`/`password`):

- `admin` / `admin123` (role: `admin`)
- `alice` / `alice123` (role: `author`)
- `bob` / `bob123` (role: `author`)
- `reader` / `reader123` (role: `reader`)

## Try it

```sh
curl -X POST http://localhost:3000/auth/login \
  -H "content-type: application/json" \
  -d '{"username":"alice","password":"alice123"}'
```

Use the returned `accessToken` as a bearer token against `/posts`, `/auth/me`, `/health`, `/metrics`, and `/openapi.json`.

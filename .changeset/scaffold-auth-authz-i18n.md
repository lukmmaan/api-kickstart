---
"@api-kickstart/api-kickstart": minor
---

The `init` project-structure scaffold now generates authentication, authorization, and i18n setup too, not just CRUD modules. Three new questions round out the scaffold flow, each independently skippable:

- **Authentication** — JWT, API key, or both. JWT scaffolds `config/auth.ts` with an in-memory user list (runs with zero setup — `admin` / `admin123`) and wires `app.useAuthRoutes()` for real `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` routes. API key scaffolds an in-memory key map instead. Picking both generates both and combines them into a single `auth` array.
- **Authorization** — generates `config/roles.ts` with a real `RoleHierarchy` (`admin` → `editor` → `viewer`) and adds `auth: true, roles: ['admin', 'editor']` to every resource's create route.
- **Internationalization** — generates `config/i18n.ts` with a real two-locale (`en`/`id`) dictionary via `createI18n()`, wired into `app.ts`'s middleware.

All three are real, working code — not stubs — verified by generating every combination across all 7 database adapters, all 5 validators, and all 6 frameworks, and type-checking the result against the real installed libraries.

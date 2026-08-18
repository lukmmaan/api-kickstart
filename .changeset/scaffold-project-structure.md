---
"@api-kickstart/api-kickstart": minor
---

`npx api-kickstart init` now asks one more question after installing your stack: whether to scaffold a starting project structure. Pick **Layered** (`config/`, `models/`, `services/`, `controllers/`, `routes/` — grouped by type) or **Modular by feature** (`modules/<resource>/` — model, service, controller, and routes together), then name one or more resources — `users, posts, comments` — and it writes one real, working module per name, wired up for the framework, database, and validator you just picked. Each module is a full list + create flow already registered on `app.route()`, with adapter-correct queries for whichever of the 7 database adapters you chose (or an in-memory store if you picked none). `config/`, `app.ts`, and a starter `middleware/requestTimer.middleware.ts` are generated once and shared across every module. Press enter to skip it, and it never overwrites a file that already exists.

---
"@api-kickstart/api-kickstart": minor
---

`npx api-kickstart init` now asks one more question after installing your stack: whether to scaffold a starting project structure. Pick **Layered** (`config/`, `models/`, `services/`, `controllers/`, `routes/` — grouped by type) or **Modular by feature** (`modules/<resource>/` — model, service, controller, and routes together), name your first resource, and it writes real, working files wired up for the framework, database, and validator you just picked — a full list + create flow already registered on `app.route()`, with adapter-correct queries for whichever of the 7 database adapters you chose (or an in-memory store if you picked none). Press enter to skip it, and it never overwrites a file that already exists.

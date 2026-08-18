---
"@api-kickstart/api-kickstart": minor
---

The `init` project-structure scaffold now asks for each resource's fields too, instead of generating the same generic `{ id, title, createdAt }` shape for everything. After naming your resources, it asks per resource: `Fields for users — name:type, comma-separated (types: string, number, boolean):`. Those exact fields drive the generated content — the TS interface, the database query (adapter-correct for whichever of the 7 you picked), the validator schema (whichever of the 5 you picked), and the controller's body cast — so `users` and `posts` scaffolded in the same run end up with genuinely different, correct code instead of both getting a placeholder `title` field. Leaving a fields answer blank keeps today's minimal path alive with a single `name: string` field.

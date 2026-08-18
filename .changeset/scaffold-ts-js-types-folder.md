---
"@api-kickstart/api-kickstart": minor
---

The `init` project-structure scaffold now asks TypeScript or JavaScript, right after picking a theme. JavaScript generates plain `.js` files with every `import type`, interface, and type annotation stripped — not just the extension, the actual content changes — verified by syntax-checking every generated file. TypeScript (still the default) additionally gets a real `types/` folder: each resource's hand-written interface (`src/types/users.types.ts`, `src/types/posts.types.ts`, or inside `modules/<resource>/` for the Modular theme) now lives in its own file and gets imported by the model instead of being declared inline — for the database adapters where the interface is hand-rolled (`pg`, `knex`, `mongodb`, `typeorm`, `sequelize`, and the in-memory fallback). Mongoose and Drizzle don't get a types file, since their ORM already infers real types and a second hand-written one would risk drifting out of sync.

import { describe, expect, it } from 'vitest'
import {
  findTheme,
  parseFields,
  parseResourceList,
  PROJECT_THEMES,
  resourceNames,
  type ScaffoldChoice,
  type ScaffoldResource,
} from './scaffold.js'

describe('resourceNames', () => {
  it('derives singular/plural/Pascal forms from a plain plural word', () => {
    expect(resourceNames('posts')).toEqual({
      plural: 'posts',
      singular: 'post',
      Pascal: 'Post',
      PascalPlural: 'Posts',
    })
  })

  it('handles hyphenated multi-word resource names', () => {
    const names = resourceNames('user-profiles')
    expect(names.plural).toBe('user-profiles')
    expect(names.singular).toBe('user-profile')
    expect(names.Pascal).toBe('UserProfile')
  })

  it('handles words ending in -ies', () => {
    expect(resourceNames('categories').singular).toBe('category')
  })

  it('sanitizes free-text input and falls back to "items" when empty', () => {
    expect(resourceNames('  My Cool Resource!! ').plural).toBe('my-cool-resource')
    expect(resourceNames('   ').plural).toBe('items')
  })
})

describe('parseResourceList', () => {
  it('splits, trims, and drops empty entries from a comma-separated answer', () => {
    expect(parseResourceList('users, posts ,  , comments')).toEqual(['users', 'posts', 'comments'])
  })

  it('dedupes repeated names', () => {
    expect(parseResourceList('users, users, Users')).toEqual(['users', 'Users'])
  })

  it('returns an empty array for a blank answer', () => {
    expect(parseResourceList('   ')).toEqual([])
  })

  it('handles a single resource with no commas', () => {
    expect(parseResourceList('users')).toEqual(['users'])
  })
})

describe('parseFields', () => {
  it('parses name:type pairs', () => {
    expect(parseFields('name:string, age:number, isAdmin:boolean')).toEqual([
      { name: 'name', type: 'string' },
      { name: 'age', type: 'number' },
      { name: 'isAdmin', type: 'boolean' },
    ])
  })

  it('defaults a bare name (no ":type") to string', () => {
    expect(parseFields('email')).toEqual([{ name: 'email', type: 'string' }])
  })

  it('defaults an unrecognized type to string', () => {
    expect(parseFields('data:json')).toEqual([{ name: 'data', type: 'string' }])
  })

  it('sanitizes invalid characters out of field names', () => {
    expect(parseFields('full name:string')).toEqual([{ name: 'fullname', type: 'string' }])
  })

  it('drops a field whose name is empty after sanitizing', () => {
    expect(parseFields('!!!:string, email:string')).toEqual([{ name: 'email', type: 'string' }])
  })

  it('dedupes repeated field names, keeping the first', () => {
    expect(parseFields('name:string, name:number')).toEqual([{ name: 'name', type: 'string' }])
  })

  it('falls back to a single name:string field for a blank answer', () => {
    expect(parseFields('   ')).toEqual([{ name: 'name', type: 'string' }])
  })
})

describe('findTheme', () => {
  it('finds a theme by id', () => {
    expect(findTheme('layered')?.id).toBe('layered')
    expect(findTheme('modular')?.id).toBe('modular')
  })

  it('returns undefined for an unknown id', () => {
    expect(findTheme('not-a-theme')).toBeUndefined()
  })
})

function resource(input: string, fieldsAnswer = 'title:string'): ScaffoldResource {
  return { input, fields: parseFields(fieldsAnswer) }
}

function baseChoice(overrides: Partial<ScaffoldChoice> = {}): ScaffoldChoice {
  return {
    frameworkId: 'express',
    databaseId: 'pg',
    validatorId: 'zod',
    resources: [resource('posts')],
    authId: 'none',
    authorization: false,
    i18n: false,
    language: 'ts',
    opsEndpoints: [],
    productionEssentials: false,
    securityMiddleware: [],
    ...overrides,
  }
}

describe('layered theme generate()', () => {
  const theme = findTheme('layered')!

  it('produces the expected file list when a database and validator are picked', () => {
    const files = theme.generate(baseChoice())
    const paths = files.map((f) => f.path).sort()
    expect(paths).toEqual(
      [
        'src/config/env.ts',
        'src/config/database.ts',
        'src/middleware/requestTimer.middleware.ts',
        'src/types/posts.types.ts',
        'src/models/posts.model.ts',
        'src/services/posts.service.ts',
        'src/controllers/posts.controller.ts',
        'src/routes/posts.routes.ts',
        'src/routes/index.ts',
        'src/app.ts',
        'src/index.ts',
      ].sort(),
    )
  })

  it('wires the chosen framework, validator, db, and middleware into app.ts', () => {
    const files = theme.generate(baseChoice())
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`import { express } from '@api-kickstart/api-kickstart/express'`)
    expect(app).toContain(`import { zod } from '@api-kickstart/api-kickstart/zod'`)
    expect(app).toContain(`import { db } from './config/database.js'`)
    expect(app).toContain(`import { requestTimer } from './middleware/requestTimer.middleware.js'`)
    expect(app).toContain('framework: express()')
    expect(app).toContain('validator: zod()')
    expect(app).toContain('db,')
    expect(app).toContain('middleware: [requestTimer],')
  })

  it('generates a real Middleware-typed request timer', () => {
    const files = theme.generate(baseChoice())
    const middleware = files.find((f) => f.path === 'src/middleware/requestTimer.middleware.ts')!.contents
    expect(middleware).toContain(`import type { Middleware } from '@api-kickstart/api-kickstart'`)
    expect(middleware).toContain('export const requestTimer: Middleware = async (ctx, next) => {')
    expect(middleware).toContain('await next()')
  })

  it('reflects the user-specified fields in the types file, model query, and create signature', () => {
    const files = theme.generate(
      baseChoice({ resources: [resource('users', 'name:string, age:number, isAdmin:boolean')] }),
    )
    const types = files.find((f) => f.path === 'src/types/users.types.ts')!.contents
    expect(types).toContain('name: string')
    expect(types).toContain('age: number')
    expect(types).toContain('isAdmin: boolean')
    const model = files.find((f) => f.path === 'src/models/users.model.ts')!.contents
    expect(model).toContain(`import type { User } from '../types/users.types.js'`)
    expect(model).toContain('SELECT id, name, age, isAdmin, created_at AS "createdAt" FROM users')
    expect(model).toContain(
      'export async function createUser(data: { name: string; age: number; isAdmin: boolean }): Promise<User> {',
    )
    expect(model).toContain('[data.name, data.age, data.isAdmin]')
  })

  it('reflects the same fields in the validator schema and controller body cast', () => {
    const files = theme.generate(
      baseChoice({ resources: [resource('users', 'name:string, age:number')], validatorId: 'zod' }),
    )
    const routes = files.find((f) => f.path === 'src/routes/users.routes.ts')!.contents
    expect(routes).toContain('const createUserSchema = z.object({ name: z.string(), age: z.number() })')
    const controller = files.find((f) => f.path === 'src/controllers/users.controller.ts')!.contents
    expect(controller).toContain('const body = ctx.body as { name: string; age: number }')
  })

  it('omits config/database.ts and the db wiring when no database is chosen', () => {
    const files = theme.generate(baseChoice({ databaseId: 'none' }))
    expect(files.find((f) => f.path === 'src/config/database.ts')).toBeUndefined()
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).not.toContain('db.js')
    expect(app).not.toContain('db,')
    const model = files.find((f) => f.path === 'src/models/posts.model.ts')!.contents
    expect(model).toContain('const store = new Map')
  })

  it('omits the schema declaration and body key when no validator is chosen', () => {
    const files = theme.generate(baseChoice({ validatorId: 'none' }))
    const routes = files.find((f) => f.path === 'src/routes/posts.routes.ts')!.contents
    expect(routes).not.toContain('Schema =')
    expect(routes).not.toContain('body:')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).not.toContain('validator:')
  })

  it('generates working code for every supported database adapter', () => {
    const dbIds = ['pg', 'knex', 'mongodb', 'mongoose', 'typeorm', 'sequelize', 'drizzle', 'none']
    for (const databaseId of dbIds) {
      const files = theme.generate(baseChoice({ databaseId }))
      const model = files.find((f) => f.path === 'src/models/posts.model.ts')!.contents
      expect(model).toContain('listPosts')
      expect(model).toContain('createPost')
    }
  })

  it('generates working code for every supported validator', () => {
    const validatorIds = ['zod', 'joi', 'yup', 'valibot', 'typebox', 'none']
    for (const validatorId of validatorIds) {
      const files = theme.generate(baseChoice({ validatorId }))
      const routes = files.find((f) => f.path === 'src/routes/posts.routes.ts')!.contents
      expect(routes).toContain('createPostHandler')
      expect(routes).toContain('listPostsHandler')
    }
  })

  it('generates one module per resource, each with its own fields, and wires every one into routes/index.ts', () => {
    const files = theme.generate(
      baseChoice({
        resources: [
          resource('users', 'name:string, email:string'),
          resource('posts', 'title:string, views:number'),
        ],
      }),
    )
    const paths = files.map((f) => f.path)
    for (const plural of ['users', 'posts']) {
      expect(paths).toContain(`src/models/${plural}.model.ts`)
    }
    const usersTypes = files.find((f) => f.path === 'src/types/users.types.ts')!.contents
    expect(usersTypes).toContain('email: string')
    const postsTypes = files.find((f) => f.path === 'src/types/posts.types.ts')!.contents
    expect(postsTypes).toContain('views: number')
    expect(postsTypes).not.toContain('email')

    const routesIndex = files.find((f) => f.path === 'src/routes/index.ts')!.contents
    expect(routesIndex).toContain(`import './users.routes.js'`)
    expect(routesIndex).toContain(`import './posts.routes.js'`)
  })

  it('dedupes resources that normalize to the same plural slug, keeping the first fields', () => {
    const files = theme.generate(
      baseChoice({
        resources: [resource('Users', 'name:string'), resource('users', 'email:string')],
      }),
    )
    const modelFiles = files.filter((f) => f.path === 'src/models/users.model.ts')
    expect(modelFiles).toHaveLength(1)
    const typesFiles = files.filter((f) => f.path === 'src/types/users.types.ts')
    expect(typesFiles).toHaveLength(1)
    expect(typesFiles[0].contents).toContain('name: string')
    expect(typesFiles[0].contents).not.toContain('email')
  })

  it('falls back to a single "users" module with a default field when no resources are given', () => {
    const files = theme.generate(baseChoice({ resources: [] }))
    expect(files.map((f) => f.path)).toContain('src/models/users.model.ts')
    const types = files.find((f) => f.path === 'src/types/users.types.ts')!.contents
    expect(types).toContain('name: string')
  })

  it('omits config/auth.ts, roles.ts, and i18n.ts, and their app.ts wiring, when all three are skipped', () => {
    const files = theme.generate(baseChoice())
    expect(files.find((f) => f.path === 'src/config/auth.ts')).toBeUndefined()
    expect(files.find((f) => f.path === 'src/config/roles.ts')).toBeUndefined()
    expect(files.find((f) => f.path === 'src/config/i18n.ts')).toBeUndefined()
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).not.toContain('auth.js')
    expect(app).not.toContain('roles.js')
    expect(app).not.toContain('i18n.js')
    expect(app).not.toContain('useAuthRoutes')
    const routes = files.find((f) => f.path === 'src/routes/posts.routes.ts')!.contents
    expect(routes).toContain('auth: false,')
    expect(routes).not.toContain('roles:')
  })

  it('scaffolds a jwt-only auth config and wires useAuthRoutes', () => {
    const files = theme.generate(baseChoice({ authId: 'jwt' }))
    const auth = files.find((f) => f.path === 'src/config/auth.ts')!.contents
    expect(auth).toContain(`import { hashPassword, jwt, verifyPassword } from '@api-kickstart/api-kickstart/auth'`)
    expect(auth).toContain('export const auth = jwt({')
    expect(auth).not.toContain('apiKey')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`import { auth } from './config/auth.js'`)
    expect(app).toContain('auth,')
    expect(app).toContain(
      `app.useAuthRoutes({ login: '/auth/login', refresh: '/auth/refresh', logout: '/auth/logout', me: '/auth/me' })`,
    )
  })

  it('scaffolds an apiKey-only auth config and does not wire useAuthRoutes', () => {
    const files = theme.generate(baseChoice({ authId: 'apiKey' }))
    const auth = files.find((f) => f.path === 'src/config/auth.ts')!.contents
    expect(auth).toContain(`import { apiKey } from '@api-kickstart/api-kickstart/auth'`)
    expect(auth).toContain('export const auth = apiKey({')
    expect(auth).not.toContain('jwt(')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).not.toContain('useAuthRoutes')
  })

  it('scaffolds both strategies as an array and wires useAuthRoutes', () => {
    const files = theme.generate(baseChoice({ authId: 'both' }))
    const auth = files.find((f) => f.path === 'src/config/auth.ts')!.contents
    expect(auth).toContain('const jwtAuth = jwt({')
    expect(auth).toContain('const apiKeyAuth = apiKey({')
    expect(auth).toContain('export const auth = [jwtAuth, apiKeyAuth]')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain('useAuthRoutes')
  })

  it('scaffolds a role hierarchy and enforces roles on the create route when authorization is on', () => {
    const files = theme.generate(baseChoice({ authorization: true }))
    const roles = files.find((f) => f.path === 'src/config/roles.ts')!.contents
    expect(roles).toContain(`import type { RoleHierarchy } from '@api-kickstart/api-kickstart'`)
    expect(roles).toContain('admin:')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`import { roleHierarchy } from './config/roles.js'`)
    expect(app).toContain('roleHierarchy,')
    const routes = files.find((f) => f.path === 'src/routes/posts.routes.ts')!.contents
    expect(routes).toContain('auth: true,')
    expect(routes).toContain(`roles: ['admin', 'editor'],`)
    // the GET route stays public even with authorization on
    expect(routes).toContain(`auth: false,\n  handler: listPostsHandler,`)
  })

  it('scaffolds an i18n config with dictionaries and wires its middleware into app.ts', () => {
    const files = theme.generate(baseChoice({ i18n: true }))
    const i18nFile = files.find((f) => f.path === 'src/config/i18n.ts')!.contents
    expect(i18nFile).toContain(`import { createI18n } from '@api-kickstart/api-kickstart/i18n'`)
    expect(i18nFile).toContain('dictionaries:')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`import { i18n } from './config/i18n.js'`)
    expect(app).toContain('middleware: [requestTimer, i18n.middleware],')
  })

  it('combines auth, authorization, and i18n together in one app.ts', () => {
    const files = theme.generate(baseChoice({ authId: 'both', authorization: true, i18n: true }))
    const paths = files.map((f) => f.path)
    expect(paths).toContain('src/config/auth.ts')
    expect(paths).toContain('src/config/roles.ts')
    expect(paths).toContain('src/config/i18n.ts')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain('auth,')
    expect(app).toContain('roleHierarchy,')
    expect(app).toContain('middleware: [requestTimer, i18n.middleware],')
    expect(app).toContain('useAuthRoutes')
  })
})

describe('modular theme generate()', () => {
  const theme = findTheme('modular')!

  it('groups everything for the resource under modules/<resource>/', () => {
    const files = theme.generate(baseChoice())
    const paths = files.map((f) => f.path).sort()
    expect(paths).toEqual(
      [
        'src/config/env.ts',
        'src/config/database.ts',
        'src/middleware/requestTimer.middleware.ts',
        'src/modules/posts/posts.types.ts',
        'src/modules/posts/posts.model.ts',
        'src/modules/posts/posts.service.ts',
        'src/modules/posts/posts.controller.ts',
        'src/modules/posts/posts.routes.ts',
        'src/modules/index.ts',
        'src/app.ts',
        'src/index.ts',
      ].sort(),
    )
  })

  it('uses same-directory relative imports between the module files', () => {
    const files = theme.generate(baseChoice())
    const service = files.find((f) => f.path === 'src/modules/posts/posts.service.ts')!.contents
    expect(service).toContain(`from './posts.model.js'`)
    const controller = files.find((f) => f.path === 'src/modules/posts/posts.controller.ts')!.contents
    expect(controller).toContain(`from './posts.service.js'`)
    const routes = files.find((f) => f.path === 'src/modules/posts/posts.routes.ts')!.contents
    expect(routes).toContain(`from '../../app.js'`)
    expect(routes).toContain(`from './posts.controller.js'`)
  })

  it('points the model at the shared config two levels up, and the types file in the same module folder', () => {
    const files = theme.generate(baseChoice())
    const model = files.find((f) => f.path === 'src/modules/posts/posts.model.ts')!.contents
    expect(model).toContain(`from '../../config/database.js'`)
    expect(model).toContain(`import type { Post } from './posts.types.js'`)
  })

  it('generates one module folder per resource, each with its own fields', () => {
    const files = theme.generate(
      baseChoice({ resources: [resource('users', 'name:string'), resource('posts', 'title:string')] }),
    )
    const paths = files.map((f) => f.path)
    expect(paths).toContain('src/modules/users/users.model.ts')
    expect(paths).toContain('src/modules/posts/posts.model.ts')
    const modulesIndex = files.find((f) => f.path === 'src/modules/index.ts')!.contents
    expect(modulesIndex).toContain(`import './users/users.routes.js'`)
    expect(modulesIndex).toContain(`import './posts/posts.routes.js'`)
  })
})

describe('language: js', () => {
  const theme = findTheme('layered')!

  it('uses .js file extensions for every generated file and generates no types folder', () => {
    const files = theme.generate(baseChoice({ language: 'js' }))
    for (const file of files) {
      expect(file.path.endsWith('.js')).toBe(true)
    }
    expect(files.find((f) => f.path.includes('.types.'))).toBeUndefined()
  })

  it('strips TS-only syntax from the model, controller, and middleware', () => {
    const files = theme.generate(baseChoice({ language: 'js' }))
    const model = files.find((f) => f.path === 'src/models/posts.model.js')!.contents
    expect(model).not.toContain('import type')
    expect(model).not.toContain(': Promise<')
    expect(model).not.toContain(' as Pool')
    expect(model).not.toContain('interface ')

    const controller = files.find((f) => f.path === 'src/controllers/posts.controller.js')!.contents
    expect(controller).not.toContain('import type')
    expect(controller).not.toContain(': Context')
    expect(controller).not.toContain(' as {')

    const middleware = files.find((f) => f.path === 'src/middleware/requestTimer.middleware.js')!.contents
    expect(middleware).not.toContain('import type')
    expect(middleware).not.toContain(': Middleware')
    expect(middleware).toContain('export const requestTimer = async (ctx, next) => {')
  })

  it('still uses the exact user-specified fields, just without type annotations', () => {
    const files = theme.generate(
      baseChoice({ language: 'js', resources: [resource('users', 'name:string, age:number')] }),
    )
    const model = files.find((f) => f.path === 'src/models/users.model.js')!.contents
    expect(model).toContain('SELECT id, name, age, created_at AS "createdAt" FROM users')
    expect(model).toContain('export async function createUser(data) {')
    expect(model).toContain('[data.name, data.age]')
  })

  it('strips the RoleHierarchy annotation from roles.js and the Context annotation everywhere', () => {
    const files = theme.generate(baseChoice({ language: 'js', authorization: true }))
    const roles = files.find((f) => f.path === 'src/config/roles.js')!.contents
    expect(roles).not.toContain('import type')
    expect(roles).not.toContain(': RoleHierarchy')
    expect(roles).toContain('export const roleHierarchy = {')
  })

  it('generates working JS for every supported database adapter, with no leftover TS syntax', () => {
    const dbIds = ['pg', 'knex', 'mongodb', 'mongoose', 'typeorm', 'sequelize', 'drizzle', 'none']
    for (const databaseId of dbIds) {
      const files = theme.generate(baseChoice({ language: 'js', databaseId }))
      const model = files.find((f) => f.path === 'src/models/posts.model.js')!.contents
      expect(model).toContain('listPosts')
      expect(model).toContain('createPost')
      expect(model).not.toContain('import type')
      expect(model).not.toContain('interface ')
      expect(model).not.toMatch(/:\s*(Promise|string|number|boolean)\b/)
    }
  })
})

describe('types folder', () => {
  const theme = findTheme('layered')!

  it('is generated for db adapters with a hand-rolled interface (pg, knex, mongodb, typeorm, sequelize, none)', () => {
    for (const databaseId of ['pg', 'knex', 'mongodb', 'typeorm', 'sequelize', 'none']) {
      const files = theme.generate(baseChoice({ databaseId }))
      expect(files.find((f) => f.path === 'src/types/posts.types.ts')).toBeDefined()
    }
  })

  it('is not generated for mongoose or drizzle, which rely on ORM-inferred types', () => {
    for (const databaseId of ['mongoose', 'drizzle']) {
      const files = theme.generate(baseChoice({ databaseId }))
      expect(files.find((f) => f.path === 'src/types/posts.types.ts')).toBeUndefined()
    }
  })

  it('uses the mongodb-specific _id/Date shape', () => {
    const files = theme.generate(baseChoice({ databaseId: 'mongodb' }))
    const types = files.find((f) => f.path === 'src/types/posts.types.ts')!.contents
    expect(types).toContain('_id: unknown')
    expect(types).toContain('createdAt: Date')
  })

  it('is never generated in JS mode', () => {
    const files = theme.generate(baseChoice({ language: 'js' }))
    expect(files.find((f) => f.path.includes('.types.'))).toBeUndefined()
  })
})

describe('ops endpoints', () => {
  const theme = findTheme('layered')!

  it('adds no ops statements or blank separator when none are chosen', () => {
    const files = theme.generate(baseChoice())
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).not.toContain('app.health()')
    expect(app).not.toContain('app.metrics()')
    expect(app).not.toContain('app.openapi(')
  })

  it('adds app.health() and app.metrics() in canonical order regardless of selection order', () => {
    const files = theme.generate(baseChoice({ opsEndpoints: ['metrics', 'health'] }))
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app.indexOf('app.health()')).toBeLessThan(app.indexOf('app.metrics()'))
  })

  it('adds a full app.openapi({...}) block when openapi is chosen', () => {
    const files = theme.generate(baseChoice({ opsEndpoints: ['openapi'] }))
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`app.openapi({`)
    expect(app).toContain(`info: { title: 'API', version: '1.0.0' },`)
    expect(app).toContain(`json: '/openapi.json',`)
    expect(app).toContain(`serve: '/docs',`)
  })
})

describe('production essentials', () => {
  const theme = findTheme('layered')!

  it('generates no lock.ts and no gracefulShutdown wiring when off', () => {
    const files = theme.generate(baseChoice())
    expect(files.find((f) => f.path === 'src/config/lock.ts')).toBeUndefined()
    const index = files.find((f) => f.path === 'src/index.ts')!.contents
    expect(index).not.toContain('gracefulShutdown')
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).not.toContain('app.schedule(')
  })

  it('generates lock.ts, wires gracefulShutdown into index.ts, and adds a schedule block to app.ts', () => {
    const files = theme.generate(baseChoice({ productionEssentials: true }))
    const lock = files.find((f) => f.path === 'src/config/lock.ts')!.contents
    expect(lock).toContain(`import { pgLock } from '@api-kickstart/api-kickstart/pg'`)
    expect(lock).toContain('export const lock = pgLock(db.client as Pool)')

    const index = files.find((f) => f.path === 'src/index.ts')!.contents
    expect(index).toContain(`import { gracefulShutdown } from '@api-kickstart/api-kickstart'`)
    expect(index).toContain('gracefulShutdown(app)')

    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`import { lock } from './config/lock.js'`)
    expect(app).toContain(`app.schedule('example-job', { interval: '5m', lock }, async () => {`)
    expect(app).toContain(`console.log('running example-job')`)
  })

  it('picks the matching lock factory per database adapter, falling back to memoryLock', () => {
    const cases: [string, string][] = [
      ['pg', 'pgLock'],
      ['knex', 'knexLock'],
      ['mongodb', 'mongodbLock'],
      ['mongoose', 'memoryLock'],
      ['none', 'memoryLock'],
    ]
    for (const [databaseId, factory] of cases) {
      const files = theme.generate(baseChoice({ databaseId, productionEssentials: true }))
      const lock = files.find((f) => f.path === 'src/config/lock.ts')!.contents
      expect(lock).toContain(`export const lock = ${factory}(`)
    }
  })

  it('strips TS-only cast syntax from lock.js in JS mode', () => {
    const files = theme.generate(baseChoice({ language: 'js', productionEssentials: true }))
    const lock = files.find((f) => f.path === 'src/config/lock.js')!.contents
    expect(lock).not.toContain('import type')
    expect(lock).not.toContain(' as Pool')
    expect(lock).toContain('export const lock = pgLock(db.client)')
  })
})

describe('security middleware', () => {
  const theme = findTheme('layered')!

  it('adds no security import or middleware entries when none are chosen', () => {
    const files = theme.generate(baseChoice())
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).not.toContain('@api-kickstart/api-kickstart/middleware')
    expect(app).toContain('middleware: [requestTimer],')
  })

  it('adds a combined import and factory calls in canonical order regardless of selection order', () => {
    const files = theme.generate(baseChoice({ securityMiddleware: ['csrf', 'helmet', 'requestId'] }))
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(
      `import { requestId, helmet, csrf } from '@api-kickstart/api-kickstart/middleware'`,
    )
    expect(app).toContain('middleware: [requestTimer, requestId(), helmet(), csrf()],')
  })

  it('uses real default option values for rateLimit, bodyLimit, and timeout', () => {
    const files = theme.generate(baseChoice({ securityMiddleware: ['rateLimit', 'bodyLimit', 'timeout'] }))
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`rateLimit({ window: '1m', max: 100 })`)
    expect(app).toContain(`bodyLimit({ maxBytes: 1_000_000 })`)
    expect(app).toContain(`timeout({ duration: '30s' })`)
  })

  it('combines with i18n middleware in the right order', () => {
    const files = theme.generate(baseChoice({ securityMiddleware: ['logger'], i18n: true }))
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain('middleware: [requestTimer, logger(), i18n.middleware],')
  })
})

describe('PROJECT_THEMES', () => {
  it('exposes exactly the layered and modular themes', () => {
    expect(PROJECT_THEMES.map((t) => t.id)).toEqual(['layered', 'modular'])
  })
})

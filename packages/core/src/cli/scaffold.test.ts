import { describe, expect, it } from 'vitest'
import { findTheme, PROJECT_THEMES, resourceNames, type ScaffoldChoice } from './scaffold.js'

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

describe('findTheme', () => {
  it('finds a theme by id', () => {
    expect(findTheme('layered')?.id).toBe('layered')
    expect(findTheme('modular')?.id).toBe('modular')
  })

  it('returns undefined for an unknown id', () => {
    expect(findTheme('not-a-theme')).toBeUndefined()
  })
})

function baseChoice(overrides: Partial<ScaffoldChoice> = {}): ScaffoldChoice {
  return { frameworkId: 'express', databaseId: 'pg', validatorId: 'zod', resource: 'posts', ...overrides }
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

  it('wires the chosen framework, validator, and db into app.ts', () => {
    const files = theme.generate(baseChoice())
    const app = files.find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain(`import { express } from '@api-kickstart/api-kickstart/express'`)
    expect(app).toContain(`import { zod } from '@api-kickstart/api-kickstart/zod'`)
    expect(app).toContain(`import { db } from './config/database.js'`)
    expect(app).toContain('framework: express()')
    expect(app).toContain('validator: zod()')
    expect(app).toContain('db,')
  })

  it('generates real pg queries in the model when database is pg', () => {
    const files = theme.generate(baseChoice({ databaseId: 'pg' }))
    const model = files.find((f) => f.path === 'src/models/posts.model.ts')!.contents
    expect(model).toContain('export async function listPosts')
    expect(model).toContain('export async function createPost')
    expect(model).toContain('FROM posts')
    expect(model).toContain(`db.client as Pool`)
  })

  it('generates a zod schema in routes and wires it into the POST route', () => {
    const files = theme.generate(baseChoice({ validatorId: 'zod' }))
    const routes = files.find((f) => f.path === 'src/routes/posts.routes.ts')!.contents
    expect(routes).toContain(`import { z } from 'zod'`)
    expect(routes).toContain('const createPostSchema = z.object({ title: z.string().min(1) })')
    expect(routes).toContain('body: createPostSchema,')
    expect(routes).toContain(`path: '/posts'`)
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

  it('points the model at the shared config two levels up', () => {
    const files = theme.generate(baseChoice())
    const model = files.find((f) => f.path === 'src/modules/posts/posts.model.ts')!.contents
    expect(model).toContain(`from '../../config/database.js'`)
  })
})

describe('PROJECT_THEMES', () => {
  it('exposes exactly the layered and modular themes', () => {
    expect(PROJECT_THEMES.map((t) => t.id)).toEqual(['layered', 'modular'])
  })
})

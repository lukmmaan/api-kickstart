import { NotFound } from './errors.js'
import type { App } from './index.js'
import type { Context } from './types.js'

export type ResourceAction = 'list' | 'get' | 'create' | 'update' | 'delete'

export interface ResourceHooks {
  beforeCreate?: (ctx: Context, data: unknown) => Promise<unknown> | unknown
  afterCreate?: (ctx: Context, record: unknown) => Promise<void> | void
  beforeUpdate?: (ctx: Context, data: unknown) => Promise<unknown> | unknown
  afterUpdate?: (ctx: Context, record: unknown) => Promise<void> | void
  beforeDelete?: (ctx: Context, record: unknown) => Promise<void> | void
  afterDelete?: (ctx: Context, record: unknown) => Promise<void> | void
}

export interface ResourceOptions {
  model: string
  scope?: string
  schema?: { create?: unknown; update?: unknown }
  only?: ResourceAction[]
  roles?: Partial<Record<ResourceAction, string[]>>
  hooks?: ResourceHooks
}

interface ModelClient {
  findMany(args: { where: unknown }): Promise<unknown[]>
  findFirst(args: { where: unknown }): Promise<unknown>
  create(args: { data: unknown }): Promise<unknown>
  update(args: { where: unknown; data: unknown }): Promise<unknown>
  delete(args: { where: unknown }): Promise<unknown>
}

function getModel(app: App, model: string): ModelClient {
  const db = app.db
  if (!db) throw new Error('resource() requires a db adapter to be configured on createApp()')
  const client = db.client as Record<string, ModelClient>
  const modelClient = client[model]
  if (!modelClient) throw new Error(`db client has no model "${model}"`)
  return modelClient
}

export function registerResource(app: App, basePath: string, options: ResourceOptions): void {
  const actions = options.only ?? (['list', 'get', 'create', 'update', 'delete'] satisfies ResourceAction[])

  if (actions.includes('list')) {
    app.route({
      method: 'GET',
      path: basePath,
      auth: true,
      roles: options.roles?.list,
      scope: options.scope,
      handler: async (ctx) => getModel(app, options.model).findMany({ where: ctx.scope }),
    })
  }

  if (actions.includes('get')) {
    app.route({
      method: 'GET',
      path: `${basePath}/:id`,
      auth: true,
      roles: options.roles?.get,
      scope: options.scope,
      handler: async (ctx) => {
        const id = (ctx.params as { id: string }).id
        const record = await getModel(app, options.model).findFirst({ where: { ...ctx.scope, id } })
        if (!record) throw new NotFound()
        return record
      },
    })
  }

  if (actions.includes('create')) {
    app.route({
      method: 'POST',
      path: basePath,
      auth: true,
      roles: options.roles?.create,
      body: options.schema?.create,
      handler: async (ctx) => {
        let data = ctx.body
        if (options.hooks?.beforeCreate) data = await options.hooks.beforeCreate(ctx, data)
        const record = await getModel(app, options.model).create({ data })
        if (options.hooks?.afterCreate) await options.hooks.afterCreate(ctx, record)
        return record
      },
    })
  }

  if (actions.includes('update')) {
    app.route({
      method: 'PATCH',
      path: `${basePath}/:id`,
      auth: true,
      roles: options.roles?.update,
      scope: options.scope,
      body: options.schema?.update,
      handler: async (ctx) => {
        const id = (ctx.params as { id: string }).id
        const existing = await getModel(app, options.model).findFirst({ where: { ...ctx.scope, id } })
        if (!existing) throw new NotFound()
        let data = ctx.body
        if (options.hooks?.beforeUpdate) data = await options.hooks.beforeUpdate(ctx, data)
        const record = await getModel(app, options.model).update({ where: { id }, data })
        if (options.hooks?.afterUpdate) await options.hooks.afterUpdate(ctx, record)
        return record
      },
    })
  }

  if (actions.includes('delete')) {
    app.route({
      method: 'DELETE',
      path: `${basePath}/:id`,
      auth: true,
      roles: options.roles?.delete,
      scope: options.scope,
      handler: async (ctx) => {
        const id = (ctx.params as { id: string }).id
        const existing = await getModel(app, options.model).findFirst({ where: { ...ctx.scope, id } })
        if (!existing) throw new NotFound()
        if (options.hooks?.beforeDelete) await options.hooks.beforeDelete(ctx, existing)
        await getModel(app, options.model).delete({ where: { id } })
        if (options.hooks?.afterDelete) await options.hooks.afterDelete(ctx, existing)
        return { success: true }
      },
    })
  }
}

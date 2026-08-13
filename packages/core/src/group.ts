import { joinPaths } from './router.js'
import type { App } from './index.js'
import type { Middleware, RouteConfig } from './types.js'

export interface GroupOptions {
  prefix?: string
  auth?: boolean | string | string[]
  roles?: string[]
  permissions?: string[]
  scope?: string
  middleware?: Middleware[]
}

function mergeGroupConfig(group: GroupOptions, config: RouteConfig): RouteConfig {
  return {
    ...config,
    path: joinPaths(group.prefix, config.path),
    auth: config.auth ?? group.auth,
    roles: config.roles ?? group.roles,
    permissions: config.permissions ?? group.permissions,
    scope: config.scope ?? group.scope,
    middleware: [...(group.middleware ?? []), ...(config.middleware ?? [])],
  }
}

export class GroupBuilder {
  constructor(private app: App, private options: GroupOptions) {}

  route(config: RouteConfig): this {
    this.app.route(mergeGroupConfig(this.options, config))
    return this
  }

  group(options: GroupOptions, fn: (group: GroupBuilder) => void): this {
    const merged: GroupOptions = {
      prefix: joinPaths(this.options.prefix, options.prefix),
      auth: options.auth ?? this.options.auth,
      roles: options.roles ?? this.options.roles,
      permissions: options.permissions ?? this.options.permissions,
      scope: options.scope ?? this.options.scope,
      middleware: [...(this.options.middleware ?? []), ...(options.middleware ?? [])],
    }
    fn(new GroupBuilder(this.app, merged))
    return this
  }
}

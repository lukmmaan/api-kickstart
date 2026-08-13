import { resolveCorsOptions, type CorsConfig, type CorsOptions } from './cors.js'
import { defaultLogger } from './logger.js'
import type { PermissionMap, RoleHierarchy, ScopeMap } from './authorize.js'
import type { AuthStrategy, BrokerAdapter, DbAdapter, FrameworkAdapter, Logger, Middleware, StorageAdapter, Validator } from './types.js'

export interface CreateAppOptions {
  framework: FrameworkAdapter
  validator?: Validator
  db?: DbAdapter
  broker?: BrokerAdapter
  storage?: StorageAdapter
  auth?: AuthStrategy | AuthStrategy[]
  cors?: CorsConfig
  middleware?: Middleware[]
  roleHierarchy?: RoleHierarchy
  permissions?: PermissionMap
  scope?: ScopeMap
  scopeAudit?: 'off' | 'warn' | 'throw'
  logger?: Logger
}

export interface ResolvedAppConfig {
  strategies: AuthStrategy[]
  corsOptions: CorsOptions | null
  logger: Logger
  roleHierarchy: RoleHierarchy
  permissionMap: PermissionMap
  scopeMap: ScopeMap
  scopeAudit: 'off' | 'warn' | 'throw'
}

export function resolveAppConfig(options: CreateAppOptions): ResolvedAppConfig {
  return {
    strategies: Array.isArray(options.auth) ? options.auth : options.auth ? [options.auth] : [],
    corsOptions: resolveCorsOptions(options.cors ?? 'off', process.env.NODE_ENV),
    logger: options.logger ?? defaultLogger(),
    roleHierarchy: options.roleHierarchy ?? {},
    permissionMap: options.permissions ?? {},
    scopeMap: options.scope ?? {},
    scopeAudit: options.scopeAudit ?? 'off',
  }
}

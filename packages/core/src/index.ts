import { randomUUID } from 'node:crypto'
import { buildCorsHeaders, type CorsOptions } from './cors.js'
import { checkPermissions, checkRoles, resolveScope, type PermissionMap, type RoleHierarchy, type ScopeMap } from './authorize.js'
import { resolveAppConfig, type CreateAppOptions } from './config.js'
import { runWithContext } from './context.js'
import { Forbidden, NotFound, SchemaValidationError, Unauthorized, ValidationError, formatError } from './errors.js'
import { GroupBuilder, type GroupOptions } from './group.js'
import { runMiddlewareChain } from './middleware.js'
import { buildOpenApiSpec, type OpenApiOptions } from './openapi.js'
import { registerResource, type ResourceOptions } from './resource.js'
import { compilePath, type CompiledRoute } from './router.js'
import type { JwtAuthStrategy } from './auth/jwt.js'
import type {
  AuthenticatedUser,
  AuthStrategy,
  BrokerAdapter,
  ConsumeOptions,
  Context,
  DbAdapter,
  DispatchResult,
  Logger,
  RawRequest,
  RequestLike,
  RouteConfig,
} from './types.js'

export * from './types.js'
export { AppError, BadRequest, Conflict, Forbidden, InternalError, NotFound, SchemaValidationError, Unauthorized, ValidationError } from './errors.js'
export type { CorsConfig, CorsOptions } from './cors.js'
export type { PermissionMap, RoleHierarchy, ScopeMap, ScopeResolver } from './authorize.js'
export type { CreateAppOptions, ResolvedAppConfig } from './config.js'
export type { ResourceOptions, ResourceHooks, ResourceAction } from './resource.js'
export type { OpenApiOptions, OpenApiInfo } from './openapi.js'
export { GroupBuilder, type GroupOptions } from './group.js'

export interface AuthRoutesConfig {
  login?: string
  refresh?: string
  logout?: string
  me?: string
}

export interface InjectRequest {
  method: string
  path: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
  body?: unknown
  as?: AuthenticatedUser
}

export interface InjectResult {
  status: number
  body: unknown
  headers: Record<string, string>
}

export class App {
  private compiledRoutes: CompiledRoute[] = []
  private strategies: AuthStrategy[]
  private corsOptions: CorsOptions | null
  private logger: Logger
  private roleHierarchy: RoleHierarchy
  private permissionMap: PermissionMap
  private scopeMap: ScopeMap
  private testUserOverride: AuthenticatedUser | null = null

  constructor(private options: CreateAppOptions) {
    const resolved = resolveAppConfig(options)
    this.strategies = resolved.strategies
    this.corsOptions = resolved.corsOptions
    this.logger = resolved.logger
    this.roleHierarchy = resolved.roleHierarchy
    this.permissionMap = resolved.permissionMap
    this.scopeMap = resolved.scopeMap
    this.options.framework.onRequest((req, raw) => this.dispatch(req, raw))
  }

  get db(): DbAdapter | null {
    return this.options.db ?? null
  }

  get broker(): BrokerAdapter | null {
    return this.options.broker ?? null
  }

  route(config: RouteConfig): this {
    const { regex, keys } = compilePath(config.path)
    this.compiledRoutes.push({ config, regex, keys })
    return this
  }

  group(options: GroupOptions, fn: (group: GroupBuilder) => void): this {
    fn(new GroupBuilder(this, options))
    return this
  }

  resource(basePath: string, options: ResourceOptions): this {
    registerResource(this, basePath, options)
    return this
  }

  routes(): RouteConfig[] {
    return this.compiledRoutes.map((r) => r.config)
  }

  useAuthRoutes(config: AuthRoutesConfig): this {
    const strategy = this.strategies.find((s) => s.name === 'jwt') as JwtAuthStrategy | undefined
    if (!strategy) {
      throw new Error('useAuthRoutes() requires a jwt() auth strategy to be configured on createApp()')
    }

    if (config.login) {
      this.route({
        method: 'POST',
        path: config.login,
        auth: false,
        handler: async (ctx) => {
          if (!strategy.verifyCredentials) {
            throw new Error('jwt() was not configured with verifyCredentials; useAuthRoutes login cannot work without it')
          }
          const credentials = ctx.body as { username: string; password: string }
          const user = await strategy.verifyCredentials(credentials)
          if (!user) throw new Unauthorized('Invalid credentials')
          return strategy.issueTokenPair(user)
        },
      })
    }

    if (config.refresh) {
      this.route({
        method: 'POST',
        path: config.refresh,
        auth: false,
        handler: async (ctx) => {
          const body = ctx.body as { refreshToken: string }
          return strategy.refresh(body.refreshToken)
        },
      })
    }

    if (config.logout) {
      this.route({
        method: 'POST',
        path: config.logout,
        auth: false,
        handler: async (ctx) => {
          const body = ctx.body as { refreshToken: string }
          await strategy.revoke(body.refreshToken)
          return { success: true }
        },
      })
    }

    if (config.me) {
      this.route({
        method: 'GET',
        path: config.me,
        auth: true,
        handler: async (ctx) => ctx.user,
      })
    }

    return this
  }

  consume(options: ConsumeOptions): this {
    const broker = this.options.broker
    if (!broker) throw new Error('consume() requires a broker adapter to be configured on createApp()')
    if (!broker.consume) throw new Error('this broker adapter does not support consuming')

    broker.consume({
      topic: options.topic,
      group: options.group,
      concurrency: options.concurrency,
      onMessage: async (rawMessage, meta) => {
        const requestId = randomUUID()
        const message = options.schema && this.options.validator
          ? this.options.validator.parse(options.schema, rawMessage, 'message')
          : rawMessage
        const logger = this.logger.child({ requestId, topic: meta.topic })
        const ctx: Context & { message: unknown; attempt: number } = {
          user: null,
          body: undefined,
          query: undefined,
          params: undefined,
          headers: {},
          scope: {},
          db: this.options.db?.client ?? null,
          broker: this.options.broker ?? null,
          logger,
          requestId,
          raw: { req: rawMessage, res: null },
          message,
          attempt: meta.attempt,
        }
        await runWithContext({ user: null, requestId }, () => options.handler(ctx))
      },
    })

    return this
  }

  openapi(options: OpenApiOptions): this {
    const spec = buildOpenApiSpec(this.routes(), options)
    const paths = [options.json, options.serve].filter((p): p is string => Boolean(p))
    for (const path of paths) {
      this.route({ method: 'GET', path, auth: false, handler: async () => spec })
    }
    return this
  }

  listen(port: number, cb?: () => void): unknown {
    return this.options.framework.listen(port, cb)
  }

  handler(): unknown {
    return this.options.framework.handler()
  }

  async close(): Promise<void> {
    await this.options.framework.close?.()
    await this.options.broker?.close?.()
    await this.options.db?.close?.()
  }

  async inject(request: InjectRequest): Promise<InjectResult> {
    const req = this.buildInjectRequest(request)

    this.testUserOverride = request.as ?? null
    try {
      const result = await this.dispatch(req, { req: null, res: null })
      return { status: result.status, body: result.body, headers: result.headers ?? {} }
    } finally {
      this.testUserOverride = null
    }
  }

  private buildInjectRequest(request: InjectRequest): RequestLike {
    return {
      method: request.method,
      path: request.path,
      headers: request.headers ?? {},
      cookies: {},
      rawQuery: request.query ?? {},
      rawBody: request.body,
    }
  }

  private matchRoute(method: string, path: string): { compiled: CompiledRoute; params: Record<string, string> } | null {
    for (const compiled of this.compiledRoutes) {
      if (compiled.config.method !== method) continue
      const match = compiled.regex.exec(path)
      if (!match) continue
      const params: Record<string, string> = {}
      compiled.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(match[i + 1])
      })
      return { compiled, params }
    }
    return null
  }

  private async authenticate(config: RouteConfig, req: RequestLike, raw: RawRequest): Promise<AuthenticatedUser | null> {
    if (this.testUserOverride) return this.testUserOverride
    if (!config.auth) return null

    let candidates = this.strategies
    if (typeof config.auth === 'string') {
      candidates = this.strategies.filter((s) => s.name === config.auth)
    } else if (Array.isArray(config.auth)) {
      candidates = this.strategies.filter((s) => (config.auth as string[]).includes(s.name))
    }
    if (candidates.length === 0) {
      throw new Unauthorized('No matching auth strategy configured for this route')
    }

    for (const strategy of candidates) {
      const user = await strategy.authenticate({ headers: req.headers, cookies: req.cookies, raw })
      if (user) return user
    }
    throw new Unauthorized()
  }

  private validate(schema: unknown, value: unknown, path: string): unknown {
    if (!schema) return value
    if (!this.options.validator) {
      throw new Error(`Route declares a "${path}" schema but no validator was configured on createApp()`)
    }
    try {
      return this.options.validator.parse(schema, value, path)
    } catch (err) {
      if (err instanceof SchemaValidationError) {
        throw new ValidationError(err.issues)
      }
      throw err
    }
  }

  async dispatch(req: RequestLike, raw: RawRequest): Promise<DispatchResult> {
    const requestIdHeader = req.headers['x-request-id']
    const requestId = (Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader) || randomUUID()
    const includeStack = process.env.NODE_ENV !== 'production'
    const originHeader = req.headers.origin
    const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader

    try {
      if (req.method === 'OPTIONS' && this.corsOptions) {
        return { status: 204, body: null, headers: buildCorsHeaders(this.corsOptions, origin) }
      }

      const matched = this.matchRoute(req.method, req.path)
      if (!matched) {
        throw new NotFound('Route not found')
      }
      const { compiled, params } = matched
      const config = compiled.config

      const user = await this.authenticate(config, req, raw)

      if (config.roles) {
        if (!user) throw new Unauthorized()
        checkRoles(user, config.roles, this.roleHierarchy)
      }
      if (config.permissions) {
        if (!user) throw new Unauthorized()
        checkPermissions(user, config.permissions, this.permissionMap)
      }

      let scope = {}
      if (config.scope) {
        if (!user) throw new Unauthorized()
        scope = await resolveScope(user, config.scope, this.scopeMap)
      }

      const validatedParams = config.params ? this.validate(config.params, params, 'params') : params
      const validatedQuery = this.validate(config.query, req.rawQuery, 'query')
      const validatedBody = this.validate(config.body, req.rawBody, 'body')
      const validatedHeaders = config.headers ? this.validate(config.headers, req.headers, 'headers') : req.headers

      const logger = this.logger.child({ requestId })

      const ctx: Context = {
        user,
        body: validatedBody,
        query: validatedQuery,
        params: validatedParams,
        headers: validatedHeaders as Record<string, string | string[] | undefined>,
        scope,
        db: this.options.db?.client ?? null,
        broker: this.options.broker ?? null,
        logger,
        requestId,
        raw,
      }

      if (config.load) {
        const record = await runWithContext({ user, requestId }, () => (config.load as NonNullable<RouteConfig['load']>)(ctx))
        if (record === null || record === undefined) {
          throw new NotFound()
        }
        if (config.can) {
          const allowed = await config.can(ctx, record)
          if (!allowed) throw new Forbidden()
        }
      } else if (config.can) {
        const allowed = await config.can(ctx, null)
        if (!allowed) throw new Forbidden()
      }

      const middlewareChain = [...(this.options.middleware ?? []), ...(config.middleware ?? [])]
      const runHandler = () => runWithContext({ user, requestId }, () => config.handler(ctx))
      const result = await runMiddlewareChain(middlewareChain, ctx, runHandler)

      if (config.response && process.env.NODE_ENV !== 'production') {
        this.validate(config.response, result, 'response')
      }

      const headers = this.corsOptions ? buildCorsHeaders(this.corsOptions, origin) : {}
      headers['x-request-id'] = requestId
      return { status: 200, body: result, headers }
    } catch (err) {
      const formatted = formatError(err, requestId, includeStack)
      const headers = this.corsOptions ? buildCorsHeaders(this.corsOptions, origin) : {}
      headers['x-request-id'] = requestId
      this.logger.error({ requestId, err })
      return { status: formatted.status, body: formatted.body, headers }
    }
  }
}

export function createApp(options: CreateAppOptions): App {
  return new App(options)
}

import { randomUUID } from 'node:crypto'
import { idempotency, parseDurationMs, rateLimit, timeout } from './builtins/index.js'
import { buildCorsHeaders, type CorsOptions } from './cors.js'
import { checkPermissions, checkRoles, resolveScope, type PermissionMap, type RoleHierarchy, type ScopeMap } from './authorize.js'
import { resolveAppConfig, type CreateAppOptions } from './config.js'
import { runWithContext } from './context.js'
import { Forbidden, NotFound, SchemaValidationError, Unauthorized, ValidationError, formatError } from './errors.js'
import { GroupBuilder, type GroupOptions } from './group.js'
import { runHealthChecks, type HealthCheckOptions } from './health.js'
import { MetricsCollector } from './metrics.js'
import { runMiddlewareChain } from './middleware.js'
import { isMultipart, parseMultipart } from './multipart.js'
import { buildOpenApiSpec, buildScalarHtml, type OpenApiOptions } from './openapi.js'
import { registerResource, type ResourceOptions } from './resource.js'
import { compilePath, type CompiledRoute } from './router.js'
import { auditedScope, ScopeAuditError } from './scopeAudit.js'
import type { JwtAuthStrategy } from './auth/jwt.js'
import type {
  AuthenticatedUser,
  AuthStrategy,
  BrokerAdapter,
  ConsumeOptions,
  Context,
  DbAdapter,
  DispatchResult,
  Lock,
  Logger,
  RawRequest,
  RequestLike,
  RouteConfig,
  StorageAdapter,
  UploadedFile,
} from './types.js'

export * from './types.js'
export {
  AppError,
  BadRequest,
  Conflict,
  Forbidden,
  InternalError,
  NotFound,
  PayloadTooLarge,
  RequestTimeout,
  SchemaValidationError,
  TooManyRequests,
  Unauthorized,
  ValidationError,
} from './errors.js'
export type { CorsConfig, CorsOptions } from './cors.js'
export type { PermissionMap, RoleHierarchy, ScopeMap, ScopeResolver } from './authorize.js'
export type { CreateAppOptions, ResolvedAppConfig } from './config.js'
export type { ResourceOptions, ResourceHooks, ResourceAction } from './resource.js'
export { buildOpenApiSpec, buildScalarHtml, type OpenApiOptions, type OpenApiInfo } from './openapi.js'
export { GroupBuilder, type GroupOptions } from './group.js'
export { gracefulShutdown, type GracefulShutdownOptions } from './lifecycle.js'
export { runDoctorChecks, type DoctorCheck } from './doctor.js'
export { startOutboxRelay, type OutboxEntry, type OutboxRelayOptions, type OutboxStore } from './outbox.js'
export { type HealthCheckOptions, type HealthCheckResult } from './health.js'
export { MetricsCollector, type RouteMetrics } from './metrics.js'
export { ScopeAuditError } from './scopeAudit.js'
export { isMultipart, parseMultipart, type ParsedMultipart } from './multipart.js'
export { parseCookieHeader } from './cookies.js'
export { signWebhook, verifyWebhook, WebhookSignatureError, type SignWebhookOptions, type VerifyWebhookOptions } from './webhooks.js'

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

export interface AppDiagnostics {
  routes: RouteConfig[]
  scopeMap: ScopeMap
  scopeAudit: 'off' | 'warn' | 'throw'
}

export interface ScheduleOptions {
  interval: string
  runImmediately?: boolean
  onError?: (err: unknown, name: string) => void
  lock?: Lock
  lockTtlMs?: number
}

export class App {
  private compiledRoutes: CompiledRoute[] = []
  private strategies: AuthStrategy[]
  private corsOptions: CorsOptions | null
  private logger: Logger
  private roleHierarchy: RoleHierarchy
  private permissionMap: PermissionMap
  private scopeMap: ScopeMap
  private scopeAudit: 'off' | 'warn' | 'throw'
  private testUserOverride: AuthenticatedUser | null = null
  private draining = false
  private inFlightRequests = 0
  private metricsCollector: MetricsCollector | null = null
  private scheduledTimers: NodeJS.Timeout[] = []

  constructor(private options: CreateAppOptions) {
    const resolved = resolveAppConfig(options)
    this.strategies = resolved.strategies
    this.corsOptions = resolved.corsOptions
    this.logger = resolved.logger
    this.roleHierarchy = resolved.roleHierarchy
    this.permissionMap = resolved.permissionMap
    this.scopeMap = resolved.scopeMap
    this.scopeAudit = resolved.scopeAudit
    this.options.framework.onRequest((req, raw) => this.dispatch(req, raw))
  }

  get db(): DbAdapter | null {
    return this.options.db ?? null
  }

  get broker(): BrokerAdapter | null {
    return this.options.broker ?? null
  }

  get storage(): StorageAdapter | null {
    return this.options.storage ?? null
  }

  route(config: RouteConfig): this {
    const autoMiddleware = []
    if (config.rateLimit) autoMiddleware.push(rateLimit(config.rateLimit))
    if (config.timeout) autoMiddleware.push(timeout({ duration: config.timeout }))
    if (config.idempotent) autoMiddleware.push(idempotency())

    const effectiveConfig = autoMiddleware.length > 0
      ? { ...config, middleware: [...autoMiddleware, ...(config.middleware ?? [])] }
      : config

    const { regex, keys } = compilePath(effectiveConfig.path)
    this.compiledRoutes.push({ config: effectiveConfig, regex, keys })
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

  diagnostics(): AppDiagnostics {
    return {
      routes: this.routes(),
      scopeMap: this.scopeMap,
      scopeAudit: this.scopeAudit,
    }
  }

  health(options: HealthCheckOptions = {}): this {
    const path = options.path ?? '/health'
    const customChecks = options.checks ?? {}
    this.route({
      method: 'GET',
      path,
      auth: false,
      handler: async (ctx) => {
        const result = await runHealthChecks(this.options.db?.healthcheck?.bind(this.options.db), customChecks)
        ctx.response.status = result.status === 'ok' ? 200 : 503
        return result
      },
    })
    return this
  }

  metrics(path = '/metrics'): this {
    this.metricsCollector = this.metricsCollector ?? new MetricsCollector()
    const collector = this.metricsCollector
    this.route({
      method: 'GET',
      path,
      auth: false,
      handler: async (ctx) => {
        ctx.response.headers['content-type'] = 'text/plain; version=0.0.4; charset=utf-8'
        return Buffer.from(collector.toPrometheus())
      },
    })
    return this
  }

  schedule(name: string, options: ScheduleOptions, handler: () => Promise<void> | void): this {
    const intervalMs = parseDurationMs(options.interval)
    const lockKey = `schedule:${name}`
    const lockTtlMs = options.lockTtlMs ?? intervalMs

    const run = async () => {
      let acquired = true
      try {
        if (options.lock) {
          acquired = await options.lock.acquire(lockKey, lockTtlMs)
          if (!acquired) return
        }
        await handler()
      } catch (err) {
        if (options.onError) {
          options.onError(err, name)
        } else {
          this.logger.error({ task: name, err })
        }
      } finally {
        if (options.lock && acquired) {
          await options.lock.release(lockKey)
        }
      }
    }

    if (options.runImmediately) void run()
    this.scheduledTimers.push(setInterval(() => void run(), intervalMs))
    return this
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
          method: 'MESSAGE',
          path: `/${options.topic}`,
          user: null,
          body: undefined,
          query: undefined,
          params: undefined,
          headers: {},
          files: {},
          scope: {},
          db: this.options.db?.client ?? null,
          broker: this.options.broker ?? null,
          storage: this.options.storage ?? null,
          logger,
          requestId,
          raw: { req: rawMessage, res: null },
          response: { status: 200, headers: {}, body: undefined },
          message,
          attempt: meta.attempt,
        }
        await runWithContext({ user: null, requestId }, () => options.handler(ctx))
      },
    })

    return this
  }

  openapi(options: OpenApiOptions): this {
    const spec = buildOpenApiSpec(this.routes(), options, this.options.validator)

    if (options.json) {
      this.route({ method: 'GET', path: options.json, auth: false, handler: async () => spec })
    }

    if (options.serve) {
      const html = buildScalarHtml(options.info.title, options.json, spec)
      this.route({
        method: 'GET',
        path: options.serve,
        auth: false,
        handler: async (ctx) => {
          ctx.response.headers['content-type'] = 'text/html; charset=utf-8'
          return Buffer.from(html)
        },
      })
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
    for (const timer of this.scheduledTimers) clearInterval(timer)
    this.scheduledTimers = []
    await this.options.framework.close?.()
    await this.options.broker?.close?.()
    await this.options.db?.close?.()
  }

  drain(): void {
    this.draining = true
  }

  async waitForInFlight(timeoutMs: number): Promise<void> {
    const start = Date.now()
    while (this.inFlightRequests > 0) {
      if (Date.now() - start >= timeoutMs) return
      await new Promise((resolve) => setTimeout(resolve, 50))
    }
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
    const dispatchStart = Date.now()
    let routeLabel = 'unmatched'

    if (this.draining) {
      return {
        status: 503,
        body: { error: { code: 'SERVICE_UNAVAILABLE', message: 'Server is shutting down', requestId } },
        headers: { 'x-request-id': requestId, connection: 'close' },
      }
    }

    this.inFlightRequests += 1
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
      routeLabel = `${config.method} ${config.path}`

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
      let scopeAccessed = false
      if (config.scope) {
        if (!user) throw new Unauthorized()
        const resolvedScope = await resolveScope(user, config.scope, this.scopeMap)
        scope = this.scopeAudit !== 'off' ? auditedScope(resolvedScope, () => { scopeAccessed = true }) : resolvedScope
      }

      const contentTypeHeader = req.headers['content-type']
      const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : contentTypeHeader
      let rawBody: unknown = req.rawBody
      let files: Record<string, UploadedFile[]> = {}
      if (isMultipart(contentType) && Buffer.isBuffer(req.rawBody)) {
        const multipart = parseMultipart(req.rawBody, contentType as string)
        rawBody = multipart.fields
        files = multipart.files
      }

      const validatedParams = config.params ? this.validate(config.params, params, 'params') : params
      const validatedQuery = this.validate(config.query, req.rawQuery, 'query')
      const validatedBody = this.validate(config.body, rawBody, 'body')
      const validatedHeaders = config.headers ? this.validate(config.headers, req.headers, 'headers') : req.headers

      const logger = this.logger.child({ requestId })

      const ctx: Context = {
        method: req.method,
        path: req.path,
        user,
        body: validatedBody,
        query: validatedQuery,
        params: validatedParams,
        headers: validatedHeaders as Record<string, string | string[] | undefined>,
        files,
        scope,
        db: this.options.db?.client ?? null,
        broker: this.options.broker ?? null,
        storage: this.options.storage ?? null,
        logger,
        requestId,
        raw,
        response: { status: 200, headers: {}, body: undefined },
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
      const runHandler = async () => {
        ctx.response.body = await runWithContext({ user, requestId }, () => config.handler(ctx))
      }
      await runMiddlewareChain(middlewareChain, ctx, runHandler)

      if (config.scope && this.scopeAudit !== 'off' && !scopeAccessed) {
        const message = `Route ${config.method} ${config.path} declares scope: "${config.scope}" but the handler never read ctx.scope`
        if (this.scopeAudit === 'throw') {
          throw new ScopeAuditError(message)
        }
        this.logger.warn({ requestId, route: routeLabel, message, stack: new Error(message).stack })
      }

      if (config.response && process.env.NODE_ENV !== 'production') {
        this.validate(config.response, ctx.response.body, 'response')
      }

      const headers = this.corsOptions ? buildCorsHeaders(this.corsOptions, origin) : {}
      Object.assign(headers, ctx.response.headers)
      headers['x-request-id'] = requestId
      this.metricsCollector?.record(routeLabel, Date.now() - dispatchStart, ctx.response.status)
      return { status: ctx.response.status, body: ctx.response.body, headers }
    } catch (err) {
      const formatted = formatError(err, requestId, includeStack)
      const headers = this.corsOptions ? buildCorsHeaders(this.corsOptions, origin) : {}
      headers['x-request-id'] = requestId
      this.logger.error({ requestId, err })
      this.metricsCollector?.record(routeLabel, Date.now() - dispatchStart, formatted.status)
      return { status: formatted.status, body: formatted.body, headers }
    } finally {
      this.inFlightRequests -= 1
    }
  }
}

export function createApp(options: CreateAppOptions): App {
  return new App(options)
}

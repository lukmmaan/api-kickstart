export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface ScopeFilter {
  [key: string]: unknown
}

export interface AuthenticatedUser {
  id: string
  role?: string
  [key: string]: unknown
}

export interface RawRequest {
  req: unknown
  res: unknown
}

export interface RequestLike {
  method: string
  path: string
  headers: Record<string, string | string[] | undefined>
  cookies: Record<string, string>
  rawQuery: Record<string, unknown>
  rawBody: unknown
}

export interface DispatchResult {
  status: number
  body: unknown
  headers?: Record<string, string>
}

export interface Logger {
  debug(...args: unknown[]): void
  info(...args: unknown[]): void
  warn(...args: unknown[]): void
  error(...args: unknown[]): void
  child(bindings: Record<string, unknown>): Logger
}

export interface Context<TUser = AuthenticatedUser> {
  user: TUser | null
  body: unknown
  query: unknown
  params: unknown
  headers: Record<string, string | string[] | undefined>
  scope: ScopeFilter
  db: unknown
  broker: BrokerAdapter | null
  logger: Logger
  requestId: string
  raw: RawRequest
}

export interface AuthenticateArgs {
  headers: Record<string, string | string[] | undefined>
  cookies: Record<string, string>
  raw: RawRequest
}

export interface AuthStrategy {
  name: string
  authenticate(args: AuthenticateArgs): Promise<AuthenticatedUser | null>
}

export interface ValidationIssue {
  path: string
  message: string
}

export class SchemaValidationError extends Error {
  issues: ValidationIssue[]
  constructor(issues: ValidationIssue[]) {
    super('Schema validation failed')
    this.name = 'SchemaValidationError'
    this.issues = issues
  }
}

export interface Validator {
  name: string
  parse(schema: unknown, value: unknown, path: string): unknown
}

export interface DbAdapter {
  client: unknown
  translateScope(filter: ScopeFilter): unknown
  normalizeError(err: unknown): Error | null
  transaction?<T>(fn: (tx: unknown) => Promise<T>): Promise<T>
  healthcheck?(): Promise<boolean>
  close?(): Promise<void>
}

export interface BrokerMessageMeta {
  topic: string
  attempt: number
}

export interface BrokerConsumeOptions {
  topic: string
  group?: string
  concurrency?: number
  onMessage: (message: unknown, meta: BrokerMessageMeta) => Promise<void>
}

export interface BrokerAdapter {
  publish(topic: string, message: unknown, opts?: Record<string, unknown>): Promise<void>
  consume?(opts: BrokerConsumeOptions): void
  close?(): Promise<void>
}

export interface ConsumeOptions {
  topic: string
  group?: string
  schema?: unknown
  concurrency?: number
  handler: (ctx: Context & { message: unknown; attempt: number }) => Promise<void>
}

export type DispatchHandler = (req: RequestLike, raw: RawRequest) => Promise<DispatchResult>

export interface FrameworkAdapter {
  name: string
  onRequest(handler: DispatchHandler): void
  listen(port: number, cb?: () => void): unknown
  handler(): unknown
  close?(): Promise<void>
}

export type Middleware = (ctx: Context, next: () => Promise<void>) => Promise<void>

export interface RouteConfig {
  method: HttpMethod
  path: string
  auth?: boolean | string | string[]
  roles?: string[]
  permissions?: string[]
  scope?: string
  params?: unknown
  query?: unknown
  body?: unknown
  headers?: unknown
  response?: unknown
  load?: (ctx: Context) => Promise<unknown>
  can?: (ctx: Context, record: unknown) => Promise<boolean> | boolean
  handler: (ctx: Context) => Promise<unknown>
  middleware?: Middleware[]
  rateLimit?: { window: string; max: number }
  timeout?: string
  idempotent?: boolean
  tags?: string[]
  summary?: string
}

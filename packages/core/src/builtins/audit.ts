import { AppError } from '../errors.js'
import type { Context, Middleware } from '../types.js'

export interface AuditEntry {
  timestamp: string
  requestId: string
  userId: string | null
  method: string
  path: string
  status: number
  action?: string
  resource?: string
  metadata?: Record<string, unknown>
}

export interface AuditSink {
  record(entry: AuditEntry): Promise<void> | void
}

export interface AuditLogOptions {
  sink?: AuditSink
  action?: (ctx: Context) => string | undefined
  resource?: (ctx: Context) => string | undefined
  metadata?: (ctx: Context) => Record<string, unknown> | undefined
  skip?: (ctx: Context) => boolean
}

function buildEntry(ctx: Context, status: number, options: AuditLogOptions): AuditEntry {
  return {
    timestamp: new Date().toISOString(),
    requestId: ctx.requestId,
    userId: ctx.user?.id ?? null,
    method: ctx.method,
    path: ctx.path,
    status,
    action: options.action?.(ctx),
    resource: options.resource?.(ctx),
    metadata: options.metadata?.(ctx),
  }
}

async function record(ctx: Context, entry: AuditEntry, options: AuditLogOptions): Promise<void> {
  if (options.sink) {
    await options.sink.record(entry)
  } else {
    ctx.logger.info({ audit: entry })
  }
}

export function auditLog(options: AuditLogOptions = {}): Middleware {
  return async (ctx, next) => {
    if (options.skip?.(ctx)) {
      await next()
      return
    }

    try {
      await next()
    } catch (err) {
      const status = err instanceof AppError ? err.status : 500
      await record(ctx, buildEntry(ctx, status, options), options)
      throw err
    }

    await record(ctx, buildEntry(ctx, ctx.response.status, options), options)
  }
}

import type { Middleware } from '../types.js'

export interface RequestLoggerOptions {
  logBody?: boolean
}

export function logger(options: RequestLoggerOptions = {}): Middleware {
  return async (ctx, next) => {
    const start = Date.now()
    ctx.logger.info({
      requestId: ctx.requestId,
      method: ctx.method,
      path: ctx.path,
      body: options.logBody ? ctx.body : undefined,
      event: 'request.start',
    })

    try {
      await next()
      ctx.logger.info({
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        status: ctx.response.status,
        durationMs: Date.now() - start,
        event: 'request.complete',
      })
    } catch (err) {
      ctx.logger.error({
        requestId: ctx.requestId,
        method: ctx.method,
        path: ctx.path,
        durationMs: Date.now() - start,
        err,
        event: 'request.error',
      })
      throw err
    }
  }
}

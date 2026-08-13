import type { Middleware } from '../types.js'

export interface RequestIdOptions {
  header?: string
}

export function requestId(options: RequestIdOptions = {}): Middleware {
  const header = options.header ?? 'x-request-id'

  return async (ctx, next) => {
    ctx.response.headers[header] = ctx.requestId
    await next()
  }
}

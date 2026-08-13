import type { Middleware } from '../types.js'

export interface HelmetOptions {
  hsts?: boolean
  frameguard?: boolean
  noSniff?: boolean
  referrerPolicy?: string
}

export function helmet(options: HelmetOptions = {}): Middleware {
  const hsts = options.hsts ?? true
  const frameguard = options.frameguard ?? true
  const noSniff = options.noSniff ?? true
  const referrerPolicy = options.referrerPolicy ?? 'no-referrer'

  return async (ctx, next) => {
    await next()
    if (noSniff) ctx.response.headers['x-content-type-options'] = 'nosniff'
    if (frameguard) ctx.response.headers['x-frame-options'] = 'DENY'
    if (hsts) ctx.response.headers['strict-transport-security'] = 'max-age=15552000; includeSubDomains'
    ctx.response.headers['referrer-policy'] = referrerPolicy
    ctx.response.headers['x-dns-prefetch-control'] = 'off'
    ctx.response.headers['x-download-options'] = 'noopen'
  }
}

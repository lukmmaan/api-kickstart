import { gzipSync } from 'node:zlib'
import type { Context, Middleware } from '../types.js'

export interface CompressionOptions {
  threshold?: number
}

const DEFAULT_THRESHOLD_BYTES = 1024

function acceptsGzip(ctx: Context): boolean {
  const value = ctx.headers['accept-encoding']
  const header = Array.isArray(value) ? value.join(',') : value
  return Boolean(header?.includes('gzip'))
}

export function compression(options: CompressionOptions = {}): Middleware {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD_BYTES

  return async (ctx, next) => {
    await next()

    if (Buffer.isBuffer(ctx.response.body)) return
    if (!acceptsGzip(ctx)) return

    const serialized = JSON.stringify(ctx.response.body)
    if (serialized === undefined || Buffer.byteLength(serialized) < threshold) return

    ctx.response.body = gzipSync(Buffer.from(serialized))
    ctx.response.headers['content-encoding'] = 'gzip'
    ctx.response.headers['content-type'] = 'application/json'
  }
}

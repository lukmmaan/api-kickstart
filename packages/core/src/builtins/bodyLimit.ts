import { PayloadTooLarge } from '../errors.js'
import type { Middleware } from '../types.js'

export interface BodyLimitOptions {
  maxBytes: number
}

function byteSize(value: unknown): number {
  if (value === undefined || value === null) return 0
  if (typeof value === 'string') return Buffer.byteLength(value, 'utf8')
  if (Buffer.isBuffer(value)) return value.length
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

export function bodyLimit(options: BodyLimitOptions): Middleware {
  return async (ctx, next) => {
    const size = byteSize(ctx.body)
    if (size > options.maxBytes) {
      throw new PayloadTooLarge(`Request body exceeds ${options.maxBytes} bytes`, { size, maxBytes: options.maxBytes })
    }
    await next()
  }
}

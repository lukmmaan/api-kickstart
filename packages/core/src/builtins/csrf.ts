import { randomBytes } from 'node:crypto'
import { safeCompare } from '../auth/apiKey.js'
import { parseCookieHeader } from '../cookies.js'
import { Forbidden } from '../errors.js'
import type { Context, Middleware } from '../types.js'

export interface CsrfOptions {
  cookieName?: string
  headerName?: string
  safeMethods?: string[]
  cookie?: {
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
    path?: string
  }
}

const DEFAULT_COOKIE_NAME = 'csrf_token'
const DEFAULT_HEADER_NAME = 'x-csrf-token'
const DEFAULT_SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

function buildSetCookie(name: string, value: string, options: CsrfOptions['cookie']): string {
  const parts = [`${name}=${value}`, `Path=${options?.path ?? '/'}`, `SameSite=${options?.sameSite ?? 'lax'}`]
  if (options?.secure ?? true) parts.push('Secure')
  return parts.join('; ')
}

function headerValue(ctx: Context, name: string): string | undefined {
  const value = ctx.headers[name]
  return Array.isArray(value) ? value[0] : value
}

export function csrf(options: CsrfOptions = {}): Middleware {
  const cookieName = options.cookieName ?? DEFAULT_COOKIE_NAME
  const headerName = options.headerName ?? DEFAULT_HEADER_NAME
  const safeMethods = new Set((options.safeMethods ?? DEFAULT_SAFE_METHODS).map((m) => m.toUpperCase()))

  return async (ctx, next) => {
    const cookieHeader = headerValue(ctx, 'cookie')
    const existingToken = parseCookieHeader(cookieHeader)[cookieName]
    const token = existingToken ?? randomBytes(32).toString('hex')

    if (!existingToken) {
      ctx.response.headers['set-cookie'] = buildSetCookie(cookieName, token, options.cookie)
    }

    if (!safeMethods.has(ctx.method.toUpperCase())) {
      const submitted = headerValue(ctx, headerName)
      if (!existingToken || !submitted || !safeCompare(submitted, existingToken)) {
        throw new Forbidden('CSRF token missing or invalid')
      }
    }

    await next()
  }
}

import { createHash, timingSafeEqual } from 'node:crypto'
import type { AuthenticatedUser, AuthStrategy } from '../types.js'

export interface ApiKeyOptions {
  from?: string
  resolve: (key: string) => Promise<AuthenticatedUser | null>
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function apiKey(options: ApiKeyOptions): AuthStrategy {
  const [kind, name] = (options.from ?? 'header:x-api-key').split(':')

  return {
    name: 'apiKey',
    async authenticate(args) {
      let key: string | undefined
      if (kind === 'header' && name) {
        const value = args.headers[name]
        key = Array.isArray(value) ? value[0] : value
      }
      if (!key) return null
      const user = await options.resolve(key)
      return user ?? null
    },
  }
}

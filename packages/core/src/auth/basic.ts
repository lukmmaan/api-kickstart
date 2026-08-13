import type { AuthenticatedUser, AuthStrategy } from '../types.js'

export interface BasicAuthOptions {
  verify: (username: string, password: string) => Promise<AuthenticatedUser | boolean | null>
  allowInsecure?: boolean
}

function decodeBasicHeader(header: string): { username: string; password: string } | null {
  if (!header.toLowerCase().startsWith('basic ')) return null
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8')
  const separatorIndex = decoded.indexOf(':')
  if (separatorIndex === -1) return null
  return { username: decoded.slice(0, separatorIndex), password: decoded.slice(separatorIndex + 1) }
}

export function basic(options: BasicAuthOptions): AuthStrategy {
  return {
    name: 'basic',
    async authenticate(args) {
      const protoHeader = args.headers['x-forwarded-proto']
      const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader
      if (proto !== 'https' && !options.allowInsecure) {
        throw new Error('basic auth refuses to run over plain HTTP; pass allowInsecure: true to override')
      }
      const authHeader = args.headers.authorization
      const value = Array.isArray(authHeader) ? authHeader[0] : authHeader
      if (!value) return null
      const credentials = decodeBasicHeader(value)
      if (!credentials) return null
      const result = await options.verify(credentials.username, credentials.password)
      if (!result) return null
      if (result === true) return { id: credentials.username }
      return result
    },
  }
}

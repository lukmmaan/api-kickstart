import { randomUUID } from 'node:crypto'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { Unauthorized } from '../errors.js'
import type { AuthenticateArgs, AuthenticatedUser, AuthStrategy } from '../types.js'
import { memoryRefreshStore, type RefreshStore } from './refresh-store.js'

export interface JwtOptions {
  secret: string
  algorithm?: 'HS256'
  accessTtl?: string
  refreshTtl?: string
  issuer?: string
  audience?: string
  from?: string[]
  resolveUser: (payload: JWTPayload) => Promise<AuthenticatedUser | null>
  isRevoked?: (payload: JWTPayload) => Promise<boolean>
  verifyCredentials?: (credentials: { username: string; password: string }) => Promise<AuthenticatedUser | null>
  refreshStore?: RefreshStore
}

export interface TokenPair {
  accessToken: string
  refreshToken: string
}

export interface JwtAuthStrategy extends AuthStrategy {
  issueTokenPair(user: AuthenticatedUser): Promise<TokenPair>
  refresh(refreshToken: string): Promise<TokenPair>
  revoke(refreshToken: string): Promise<void>
  verifyCredentials?: JwtOptions['verifyCredentials']
}

function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl)
  if (!match) throw new Error(`Invalid TTL: "${ttl}"`)
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 } as const
  return Number(match[1]) * multipliers[match[2] as keyof typeof multipliers]
}

function extractToken(args: AuthenticateArgs, from: string[]): string | null {
  for (const source of from) {
    const [kind, name] = source.split(':')
    if (kind === 'header' && name) {
      const value = args.headers[name]
      const header = Array.isArray(value) ? value[0] : value
      if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7)
    }
    if (kind === 'cookie' && name) {
      const value = args.cookies[name]
      if (value) return value
    }
  }
  return null
}

export function jwt(options: JwtOptions): JwtAuthStrategy {
  const algorithm = options.algorithm ?? 'HS256'
  const accessTtl = options.accessTtl ?? '15m'
  const refreshTtl = options.refreshTtl ?? '30d'
  const from = options.from ?? ['header:authorization']
  const store = options.refreshStore ?? memoryRefreshStore()
  const secretKey = new TextEncoder().encode(options.secret)

  async function sign(payload: JWTPayload, ttl: string, jti: string): Promise<string> {
    let builder = new SignJWT(payload)
      .setProtectedHeader({ alg: algorithm })
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + ttlToSeconds(ttl))
      .setJti(jti)
    if (options.issuer) builder = builder.setIssuer(options.issuer)
    if (options.audience) builder = builder.setAudience(options.audience)
    return builder.sign(secretKey)
  }

  async function verify(token: string): Promise<JWTPayload> {
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [algorithm],
      issuer: options.issuer,
      audience: options.audience,
    })
    return payload
  }

  async function issueTokenPair(user: AuthenticatedUser, familyId: string = randomUUID()): Promise<TokenPair> {
    const accessJti = randomUUID()
    const refreshJti = randomUUID()
    const accessToken = await sign({ sub: user.id, role: user.role }, accessTtl, accessJti)
    const refreshToken = await sign({ sub: user.id, familyId }, refreshTtl, refreshJti)
    await store.save({ jti: refreshJti, familyId, userId: user.id, used: false })
    return { accessToken, refreshToken }
  }

  return {
    name: 'jwt',
    verifyCredentials: options.verifyCredentials,

    async authenticate(args) {
      const token = extractToken(args, from)
      if (!token) return null
      let payload: JWTPayload
      try {
        payload = await verify(token)
      } catch {
        return null
      }
      if (options.isRevoked && (await options.isRevoked(payload))) return null
      return options.resolveUser(payload)
    },

    async issueTokenPair(user) {
      return issueTokenPair(user)
    },

    async refresh(refreshToken) {
      let payload: JWTPayload
      try {
        payload = await verify(refreshToken)
      } catch {
        throw new Unauthorized('Invalid refresh token')
      }
      const jti = payload.jti
      const familyId = payload.familyId as string | undefined
      if (!jti || !familyId) throw new Unauthorized('Invalid refresh token')
      if (await store.isRevokedFamily(familyId)) throw new Unauthorized('Refresh token revoked')
      const record = await store.get(jti)
      if (!record) throw new Unauthorized('Refresh token revoked')
      if (record.used) {
        await store.revokeFamily(familyId)
        throw new Unauthorized('Refresh token reuse detected, token family revoked')
      }
      await store.markUsed(jti)
      const user = await options.resolveUser({ sub: payload.sub })
      if (!user) throw new Unauthorized('User not found')
      return issueTokenPair(user, familyId)
    },

    async revoke(refreshToken) {
      let payload: JWTPayload
      try {
        payload = await verify(refreshToken)
      } catch {
        return
      }
      const familyId = payload.familyId as string | undefined
      if (familyId) await store.revokeFamily(familyId)
    },
  }
}

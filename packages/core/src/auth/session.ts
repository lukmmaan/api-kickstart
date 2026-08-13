import { randomUUID } from 'node:crypto'
import { DEFAULT_SESSION_COOKIE_NAME, DEFAULT_SESSION_TTL, TTL_UNIT_MILLISECONDS } from '../constants.js'
import type { AuthenticatedUser, AuthStrategy } from '../types.js'

export interface SessionRecord {
  userId: string
  data: AuthenticatedUser
  expiresAt: number
}

export interface SessionStore {
  get(sid: string): Promise<SessionRecord | null>
  set(sid: string, record: SessionRecord): Promise<void>
  destroy(sid: string): Promise<void>
}

export function memoryStore(): SessionStore {
  const sessions = new Map<string, SessionRecord>()
  return {
    async get(sid) {
      const record = sessions.get(sid)
      if (!record) return null
      if (record.expiresAt < Date.now()) {
        sessions.delete(sid)
        return null
      }
      return record
    },
    async set(sid, record) {
      sessions.set(sid, record)
    },
    async destroy(sid) {
      sessions.delete(sid)
    },
  }
}

export interface SessionOptions {
  store: SessionStore
  cookieName?: string
  ttl?: string
  rolling?: boolean
  cookie?: {
    httpOnly?: boolean
    secure?: boolean
    sameSite?: 'strict' | 'lax' | 'none'
  }
}

export interface SessionAuthStrategy extends AuthStrategy {
  cookieName: string
  create(user: AuthenticatedUser): Promise<string>
  destroy(sid: string): Promise<void>
}

function ttlToMs(ttl: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(ttl)
  if (!match) throw new Error(`Invalid TTL: "${ttl}"`)
  return Number(match[1]) * TTL_UNIT_MILLISECONDS[match[2] as keyof typeof TTL_UNIT_MILLISECONDS]
}

export function session(options: SessionOptions): SessionAuthStrategy {
  const cookieName = options.cookieName ?? DEFAULT_SESSION_COOKIE_NAME
  const ttl = ttlToMs(options.ttl ?? DEFAULT_SESSION_TTL)

  return {
    name: 'session',
    cookieName,

    async authenticate(args) {
      const sid = args.cookies[cookieName]
      if (!sid) return null
      const record = await options.store.get(sid)
      if (!record) return null
      if (options.rolling) {
        await options.store.set(sid, { ...record, expiresAt: Date.now() + ttl })
      }
      return record.data
    },

    async create(user) {
      const sid = randomUUID()
      await options.store.set(sid, { userId: user.id, data: user, expiresAt: Date.now() + ttl })
      return sid
    },

    async destroy(sid) {
      await options.store.destroy(sid)
    },
  }
}

import { Conflict } from 'api-kickstart/errors'
import type { DbAdapter, ScopeFilter } from 'api-kickstart'

export interface PrismaLikeClient {
  $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T>
  $disconnect(): Promise<void>
  $queryRaw?(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown>
  [key: string]: unknown
}

export function prisma(client: PrismaLikeClient): DbAdapter {
  return {
    client,

    translateScope(filter: ScopeFilter): ScopeFilter {
      return filter
    },

    normalizeError(err) {
      if (!(err instanceof Error)) return null
      const code = (err as Error & { code?: string }).code
      if (code === 'P2002') return new Conflict('Unique constraint violation', { code })
      return null
    },

    async transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      return client.$transaction(fn)
    },

    async healthcheck() {
      try {
        if (client.$queryRaw) {
          await client.$queryRaw`SELECT 1`
        }
        return true
      } catch {
        return false
      }
    },

    async close() {
      await client.$disconnect()
    },
  }
}

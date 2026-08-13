import { AsyncLocalStorage } from 'node:async_hooks'
import type { AuthenticatedUser } from './types.js'

interface StoredContext {
  user: AuthenticatedUser | null
  requestId: string
}

const storage = new AsyncLocalStorage<StoredContext>()

export function runWithContext<T>(ctx: StoredContext, fn: () => T): T {
  return storage.run(ctx, fn)
}

export function currentUser(): AuthenticatedUser | null {
  return storage.getStore()?.user ?? null
}

export function currentRequestId(): string | null {
  return storage.getStore()?.requestId ?? null
}

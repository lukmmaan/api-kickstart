import { AppError } from './errors.js'
import type { ScopeFilter } from './types.js'

export class ScopeAuditError extends AppError {
  constructor(message: string, details?: unknown) {
    super('SCOPE_AUDIT_VIOLATION', 500, message, details)
    this.name = 'ScopeAuditError'
  }
}

export function auditedScope(scope: ScopeFilter, onAccess: () => void): ScopeFilter {
  return new Proxy(scope, {
    get(target, prop, receiver) {
      onAccess()
      return Reflect.get(target, prop, receiver)
    },
    has(target, prop) {
      onAccess()
      return Reflect.has(target, prop)
    },
    ownKeys(target) {
      onAccess()
      return Reflect.ownKeys(target)
    },
  })
}

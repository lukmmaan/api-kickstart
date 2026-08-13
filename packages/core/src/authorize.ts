import { Forbidden } from './errors.js'
import type { AuthenticatedUser, ScopeFilter } from './types.js'

export type ScopeResolver = (user: AuthenticatedUser) => ScopeFilter | Promise<ScopeFilter>
export type ScopeMap = Record<string, Record<string, ScopeResolver>>
export type PermissionMap = Record<string, string[]>
export type RoleHierarchy = Record<string, string[]>

function expandRoles(role: string, hierarchy: RoleHierarchy): Set<string> {
  const result = new Set<string>([role])
  const queue = [role]
  while (queue.length > 0) {
    const current = queue.shift() as string
    for (const included of hierarchy[current] ?? []) {
      if (!result.has(included)) {
        result.add(included)
        queue.push(included)
      }
    }
  }
  return result
}

export function checkRoles(user: AuthenticatedUser, required: string[], hierarchy: RoleHierarchy): void {
  const role = String(user.role ?? '')
  const effective = expandRoles(role, hierarchy)
  if (!required.some((r) => effective.has(r))) {
    throw new Forbidden('Insufficient role')
  }
}

function matchesPermission(granted: string, required: string): boolean {
  if (granted === '*') return true
  const [grantedResource, grantedAction] = granted.split(':')
  const [requiredResource, requiredAction] = required.split(':')
  const resourceMatches = grantedResource === '*' || grantedResource === requiredResource
  const actionMatches = grantedAction === '*' || grantedAction === requiredAction
  return resourceMatches && actionMatches
}

export function checkPermissions(user: AuthenticatedUser, required: string[], permissions: PermissionMap): void {
  const role = String(user.role ?? '')
  const granted = permissions[role] ?? []
  const ok = required.every((perm) => granted.some((g) => matchesPermission(g, perm)))
  if (!ok) {
    throw new Forbidden('Insufficient permissions')
  }
}

export async function resolveScope(user: AuthenticatedUser, resource: string, scopeMap: ScopeMap): Promise<ScopeFilter> {
  const resourceMap = scopeMap[resource]
  if (!resourceMap) {
    throw new Forbidden(`No scope configured for resource "${resource}"`)
  }
  const role = String(user.role ?? '')
  const resolver = resourceMap[role]
  if (!resolver) {
    throw new Forbidden(`Role "${role}" has no access to "${resource}"`)
  }
  return resolver(user)
}

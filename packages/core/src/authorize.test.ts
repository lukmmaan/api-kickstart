import { describe, expect, it } from 'vitest'
import { checkPermissions, checkRoles, resolveScope, type PermissionMap, type RoleHierarchy, type ScopeMap } from './authorize.js'
import { Forbidden } from './errors.js'
import type { AuthenticatedUser } from './types.js'

describe('checkRoles', () => {
  const hierarchy: RoleHierarchy = { admin: ['editor'], editor: ['viewer'] }

  it('allows a user whose role is directly required', () => {
    const user: AuthenticatedUser = { id: '1', role: 'viewer' }
    expect(() => checkRoles(user, ['viewer'], hierarchy)).not.toThrow()
  })

  it('allows a user whose role inherits the required role', () => {
    const user: AuthenticatedUser = { id: '1', role: 'admin' }
    expect(() => checkRoles(user, ['viewer'], hierarchy)).not.toThrow()
  })

  it('throws Forbidden when the role has no path to the requirement', () => {
    const user: AuthenticatedUser = { id: '1', role: 'viewer' }
    expect(() => checkRoles(user, ['admin'], hierarchy)).toThrow(Forbidden)
  })
})

describe('checkPermissions', () => {
  const permissions: PermissionMap = {
    admin: ['*'],
    editor: ['posts:write', 'posts:read'],
    viewer: ['posts:read'],
  }

  it('allows a wildcard grant to satisfy any requirement', () => {
    const user: AuthenticatedUser = { id: '1', role: 'admin' }
    expect(() => checkPermissions(user, ['posts:delete'], permissions)).not.toThrow()
  })

  it('allows an exact resource:action match', () => {
    const user: AuthenticatedUser = { id: '1', role: 'editor' }
    expect(() => checkPermissions(user, ['posts:write'], permissions)).not.toThrow()
  })

  it('throws Forbidden when a required permission is missing', () => {
    const user: AuthenticatedUser = { id: '1', role: 'viewer' }
    expect(() => checkPermissions(user, ['posts:write'], permissions)).toThrow(Forbidden)
  })

  it('requires every listed permission, not just one', () => {
    const user: AuthenticatedUser = { id: '1', role: 'viewer' }
    expect(() => checkPermissions(user, ['posts:read', 'posts:write'], permissions)).toThrow(Forbidden)
  })
})

describe('resolveScope', () => {
  const scopeMap: ScopeMap = {
    posts: {
      admin: () => ({}),
      author: (user) => ({ authorId: user.id }),
    },
  }

  it('resolves a scope filter for the user role', async () => {
    const user: AuthenticatedUser = { id: '42', role: 'author' }
    await expect(resolveScope(user, 'posts', scopeMap)).resolves.toEqual({ authorId: '42' })
  })

  it('throws Forbidden for a resource with no scope configuration', async () => {
    const user: AuthenticatedUser = { id: '1', role: 'admin' }
    await expect(resolveScope(user, 'comments', scopeMap)).rejects.toThrow(Forbidden)
  })

  it('throws Forbidden when the role has no resolver for the resource', async () => {
    const user: AuthenticatedUser = { id: '1', role: 'stranger' }
    await expect(resolveScope(user, 'posts', scopeMap)).rejects.toThrow(Forbidden)
  })
})

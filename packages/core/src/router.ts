import type { RouteConfig } from './types.js'

export interface CompiledRoute {
  config: RouteConfig
  regex: RegExp
  keys: string[]
}

export function compilePath(path: string): { regex: RegExp; keys: string[] } {
  const keys: string[] = []
  const pattern = path
    .split('/')
    .map((segment) => {
      if (segment.startsWith(':')) {
        keys.push(segment.slice(1))
        return '([^/]+)'
      }
      return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    })
    .join('/')
  return { regex: new RegExp(`^${pattern}$`), keys }
}

export function joinPaths(...parts: (string | undefined)[]): string {
  const joined = parts.filter(Boolean).join('/')
  const normalized = joined.replace(/\/+/g, '/')
  return normalized === '' ? '/' : normalized
}

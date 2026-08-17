import { BUILTIN_PATTERNS } from './constants.js'

export class UnknownPatternError extends Error {
  constructor(name: string) {
    super(`No pattern registered under "${name}". Register it with patterns.register(name, regex) first, or use a literal RegExp in your schema instead.`)
    this.name = 'UnknownPatternError'
  }
}

export interface PatternRegistry {
  get(name: string): RegExp
  has(name: string): boolean
  register(name: string, pattern: RegExp): void
  list(): string[]
}

export function createPatternRegistry(seed: Record<string, RegExp> = {}): PatternRegistry {
  const store = new Map<string, RegExp>(Object.entries(seed))

  return {
    get(name) {
      const pattern = store.get(name)
      if (!pattern) throw new UnknownPatternError(name)
      return pattern
    },
    has(name) {
      return store.has(name)
    },
    register(name, pattern) {
      store.set(name, pattern)
    },
    list() {
      return [...store.keys()].sort()
    },
  }
}

export const patterns: PatternRegistry = createPatternRegistry(BUILTIN_PATTERNS)

import { describe, expect, it } from 'vitest'
import { dedupePackages, findCategory, resolvePackages, STACK_CATEGORIES } from './stack.js'

describe('STACK_CATEGORIES', () => {
  it('every category has at least two choices and a non-empty question', () => {
    for (const category of STACK_CATEGORIES) {
      expect(category.choices.length).toBeGreaterThanOrEqual(2)
      expect(category.question.length).toBeGreaterThan(0)
    }
  })

  it('choice ids are unique within each category', () => {
    for (const category of STACK_CATEGORIES) {
      const ids = category.choices.map((c) => c.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('category ids are unique across the whole registry', () => {
    const ids = STACK_CATEGORIES.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('findCategory', () => {
  it('finds a category by id', () => {
    expect(findCategory('framework')?.label).toBe('Framework')
  })

  it('returns undefined for an unknown id', () => {
    expect(findCategory('does-not-exist')).toBeUndefined()
  })
})

describe('resolvePackages', () => {
  it('resolves the packages for the chosen choice ids', () => {
    const category = findCategory('framework')!
    expect(resolvePackages(category, ['express'])).toEqual([{ name: 'express', range: '^4.19.0 || ^5.0.0' }])
  })

  it('ignores unknown choice ids', () => {
    const category = findCategory('framework')!
    expect(resolvePackages(category, ['not-a-real-choice'])).toEqual([])
  })

  it('supports multiple choices for multi-select categories, deduped by package name', () => {
    const category = findCategory('broker')!
    const packages = resolvePackages(category, ['redis', 'bullmq'])
    expect(packages.map((p) => p.name)).toEqual(['ioredis', 'bullmq'])
  })

  it('returns an empty array for a choice with no packages (e.g. plain http)', () => {
    const category = findCategory('framework')!
    expect(resolvePackages(category, ['http'])).toEqual([])
  })
})

describe('dedupePackages', () => {
  it('keeps the first occurrence and drops later duplicates by name', () => {
    const packages = dedupePackages([
      { name: 'zod', range: '^3.23.0' },
      { name: 'zod', range: '^4.0.0' },
      { name: 'pino', range: '^9.4.0' },
    ])
    expect(packages).toEqual([
      { name: 'zod', range: '^3.23.0' },
      { name: 'pino', range: '^9.4.0' },
    ])
  })
})

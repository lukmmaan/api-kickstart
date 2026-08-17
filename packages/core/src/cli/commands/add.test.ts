import { describe, expect, it, vi } from 'vitest'
import { runAddCommand } from './add.js'

describe('add command', () => {
  it('exits 1 with a helpful message for an unknown category', async () => {
    const errors: string[] = []
    vi.spyOn(console, 'error').mockImplementation((line: string) => { errors.push(line) })

    const exitCode = await runAddCommand(['not-a-real-category'])

    expect(exitCode).toBe(1)
    expect(errors.join('\n')).toContain('unknown category "not-a-real-category"')
    expect(errors.join('\n')).toContain('framework')
    vi.restoreAllMocks()
  })

  it('falls back to needing an interactive terminal for a known category (no TTY in tests)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const exitCode = await runAddCommand(['logging'])

    expect(exitCode).toBe(1)
    vi.restoreAllMocks()
  })
})

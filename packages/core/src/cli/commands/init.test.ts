import { describe, expect, it, vi } from 'vitest'
import { runInitCommand } from './init.js'

describe('init command', () => {
  it('exits 1 when there is no interactive terminal (as in a test run/CI)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const exitCode = await runInitCommand([])

    expect(exitCode).toBe(1)
    vi.restoreAllMocks()
  })
})

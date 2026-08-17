import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { detectPackageManager, installArgs, installPackages, packageSpecs } from './install.js'

vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }))

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kickstart-install-test-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('detectPackageManager', () => {
  it('defaults to npm when no lockfile is present', () => {
    expect(detectPackageManager(dir)).toBe('npm')
  })

  it('detects pnpm from pnpm-lock.yaml', () => {
    writeFileSync(join(dir, 'pnpm-lock.yaml'), '')
    expect(detectPackageManager(dir)).toBe('pnpm')
  })

  it('detects yarn from yarn.lock', () => {
    writeFileSync(join(dir, 'yarn.lock'), '')
    expect(detectPackageManager(dir)).toBe('yarn')
  })

  it('detects bun from bun.lockb', () => {
    writeFileSync(join(dir, 'bun.lockb'), '')
    expect(detectPackageManager(dir)).toBe('bun')
  })
})

describe('installArgs', () => {
  it('uses "install" for npm', () => {
    expect(installArgs('npm', ['express@^4.19.0'])).toEqual(['install', 'express@^4.19.0'])
  })

  it('uses "add" for yarn/pnpm/bun', () => {
    expect(installArgs('yarn', ['express@^4.19.0'])).toEqual(['add', 'express@^4.19.0'])
    expect(installArgs('pnpm', ['express@^4.19.0'])).toEqual(['add', 'express@^4.19.0'])
    expect(installArgs('bun', ['express@^4.19.0'])).toEqual(['add', 'express@^4.19.0'])
  })
})

describe('packageSpecs', () => {
  it('formats name@range for each package', () => {
    expect(packageSpecs([{ name: 'zod', range: '^3.23.0' }, { name: 'pino', range: '^9.4.0' }])).toEqual([
      'zod@^3.23.0',
      'pino@^9.4.0',
    ])
  })
})

describe('installPackages', () => {
  it('returns true without spawning anything when there are no packages', async () => {
    const { spawnSync } = await import('node:child_process')
    expect(installPackages([], dir)).toBe(true)
    expect(spawnSync).not.toHaveBeenCalled()
  })

  it('spawns the detected package manager with the right args and returns true on success', async () => {
    const { spawnSync } = await import('node:child_process')
    vi.mocked(spawnSync).mockReturnValue({ status: 0 } as ReturnType<typeof spawnSync>)

    const ok = installPackages([{ name: 'express', range: '^4.19.0' }], dir)

    expect(ok).toBe(true)
    expect(spawnSync).toHaveBeenCalledWith(
      'npm',
      ['install', 'express@^4.19.0'],
      expect.objectContaining({ cwd: dir }),
    )
  })

  it('returns false when the install exits non-zero', async () => {
    const { spawnSync } = await import('node:child_process')
    vi.mocked(spawnSync).mockReturnValue({ status: 1 } as ReturnType<typeof spawnSync>)

    expect(installPackages([{ name: 'express', range: '^4.19.0' }], dir)).toBe(false)
  })
})

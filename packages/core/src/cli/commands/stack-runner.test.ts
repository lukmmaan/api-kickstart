import { describe, expect, it, vi } from 'vitest'
import type { Questioner } from '../prompt.js'
import { findCategory } from '../stack.js'
import { runStackWizard } from './stack-runner.js'

function fakeQuestioner(answers: string[]): Questioner & { close: () => void } {
  let i = 0
  return {
    async question() {
      const answer = answers[i] ?? ''
      i += 1
      return answer
    },
    close: vi.fn(),
  }
}

describe('runStackWizard', () => {
  it('errors and exits 1 when not interactive', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const exitCode = await runStackWizard([findCategory('framework')!], '/tmp', { isInteractive: false })
    expect(exitCode).toBe(1)
    vi.restoreAllMocks()
  })

  it('walks every category, resolves packages, and installs them', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const install = vi.fn().mockReturnValue(true)
    const prompter = fakeQuestioner(['1', '1'])

    const exitCode = await runStackWizard(
      [findCategory('framework')!, findCategory('validation')!],
      '/some/project',
      { prompter, isInteractive: true, install },
    )

    expect(exitCode).toBe(0)
    expect(prompter.close).toHaveBeenCalled()
    expect(install).toHaveBeenCalledWith(
      [
        { name: 'express', range: '^4.19.0 || ^5.0.0' },
        { name: 'zod', range: '^3.23.0' },
        { name: 'zod-to-json-schema', range: '^3.23.5' },
      ],
      '/some/project',
    )
    vi.restoreAllMocks()
  })

  it('skips installing and returns 0 when nothing was picked', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const install = vi.fn().mockReturnValue(true)
    const prompter = fakeQuestioner(['', ''])

    const exitCode = await runStackWizard([findCategory('framework')!], '/some/project', {
      prompter,
      isInteractive: true,
      install,
    })

    expect(exitCode).toBe(0)
    expect(install).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('returns 1 when the install step fails', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const install = vi.fn().mockReturnValue(false)
    const prompter = fakeQuestioner(['1'])

    const exitCode = await runStackWizard([findCategory('framework')!], '/some/project', {
      prompter,
      isInteractive: true,
      install,
    })

    expect(exitCode).toBe(1)
    vi.restoreAllMocks()
  })

  it('dedupes packages shared across categories (e.g. reflect-metadata from nest and typeorm)', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const install = vi.fn().mockReturnValue(true)
    const prompter = fakeQuestioner(['5', '6']) // nest, typeorm

    await runStackWizard([findCategory('framework')!, findCategory('database')!], '/some/project', {
      prompter,
      isInteractive: true,
      install,
    })

    const installedNames = (install.mock.calls[0][0] as { name: string }[]).map((p) => p.name)
    expect(installedNames.filter((n) => n === 'reflect-metadata')).toHaveLength(1)
    vi.restoreAllMocks()
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { Questioner } from '../prompt.js'
import { runScaffoldWizard } from './scaffold-runner.js'

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

describe('runScaffoldWizard', () => {
  it('does nothing when not interactive', async () => {
    const write = vi.fn()
    const exitCode = await runScaffoldWizard({}, '/some/project', { isInteractive: false, write })
    expect(exitCode).toBe(0)
    expect(write).not.toHaveBeenCalled()
  })

  it('skips scaffolding and writes nothing when the user presses enter', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn()
    const prompter = fakeQuestioner([''])

    const exitCode = await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(prompter.close).toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('generates and writes files for the chosen theme, resource, and stack selections', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: ['src/app.ts'], skipped: [] })
    const prompter = fakeQuestioner(['1', 'widgets']) // layered theme, resource name

    const selections = { framework: ['fastify'], database: ['mongodb'], validation: ['joi'] }
    const exitCode = await runScaffoldWizard(selections, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(write).toHaveBeenCalledTimes(1)
    const [files, cwd] = write.mock.calls[0]
    expect(cwd).toBe('/some/project')
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/models/widgets.model.ts')
    const app = (files as { path: string; contents: string }[]).find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain('fastify()')
    vi.restoreAllMocks()
  })

  it('generates one module per comma-separated resource name', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    const prompter = fakeQuestioner(['1', 'users, posts, comments'])

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/models/users.model.ts')
    expect(paths).toContain('src/models/posts.model.ts')
    expect(paths).toContain('src/models/comments.model.ts')
    vi.restoreAllMocks()
  })

  it('defaults the resources to "users" when left blank', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    const prompter = fakeQuestioner(['2', '']) // modular theme, blank resource answer

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/modules/users/users.model.ts')
    vi.restoreAllMocks()
  })

  it('reports skipped files without failing', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((line: string) => { logs.push(line) })
    const write = vi.fn().mockReturnValue({ written: ['src/app.ts'], skipped: ['src/index.ts'] })
    const prompter = fakeQuestioner(['1', 'posts'])

    const exitCode = await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(logs.join('\n')).toContain('src/index.ts')
    vi.restoreAllMocks()
  })
})

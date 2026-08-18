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

  it('skips scaffolding and writes nothing when the user presses enter on the theme question', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn()
    const prompter = fakeQuestioner([''])

    const exitCode = await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(prompter.close).toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('generates and writes files using the chosen theme, resource fields, and stack selections', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: ['src/app.ts'], skipped: [] })
    // theme=1 (layered), language=blank (defaults ts), resources="widgets", fields, auth/authorization/i18n skipped
    const prompter = fakeQuestioner(['1', '', 'widgets', 'label:string, qty:number', '', '', ''])

    const selections = { framework: ['fastify'], database: ['mongodb'], validation: ['joi'] }
    const exitCode = await runScaffoldWizard(selections, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(write).toHaveBeenCalledTimes(1)
    const [files, cwd] = write.mock.calls[0]
    expect(cwd).toBe('/some/project')
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/models/widgets.model.ts')
    const types = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/types/widgets.types.ts',
    )!.contents
    expect(types).toContain('label: string')
    expect(types).toContain('qty: number')
    const app = (files as { path: string; contents: string }[]).find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain('fastify()')
    vi.restoreAllMocks()
  })

  it('generates plain .js files with no types folder when JavaScript is picked', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    // theme=1, language=2 (JavaScript), resources="widgets", fields, auth/authorization/i18n skipped
    const prompter = fakeQuestioner(['1', '2', 'widgets', 'label:string', '', '', ''])

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/models/widgets.model.js')
    expect(paths.some((p) => p.includes('.types.'))).toBe(false)
    expect(paths.every((p) => p.endsWith('.js'))).toBe(true)
    const model = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/models/widgets.model.js',
    )!.contents
    expect(model).not.toContain('import type')
    vi.restoreAllMocks()
  })

  it('prompts for fields once per comma-separated resource name, each independently', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    // theme=1, language blank, resources="users, posts", fields(users), fields(posts), auth/authorization/i18n skipped
    const prompter = fakeQuestioner(['1', '', 'users, posts', 'name:string', 'title:string, views:number', '', '', ''])

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const usersTypes = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/types/users.types.ts',
    )!.contents
    expect(usersTypes).toContain('name: string')
    expect(usersTypes).not.toContain('views')
    const postsTypes = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/types/posts.types.ts',
    )!.contents
    expect(postsTypes).toContain('title: string')
    expect(postsTypes).toContain('views: number')
    vi.restoreAllMocks()
  })

  it('defaults the resource to "users" and the field to name:string when everything is left blank', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    // modular theme, language blank, blank resource answer, blank fields answer, auth/authorization/i18n skipped
    const prompter = fakeQuestioner(['2', '', '', '', '', '', ''])

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/modules/users/users.model.ts')
    const types = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/modules/users/users.types.ts',
    )!.contents
    expect(types).toContain('name: string')
    vi.restoreAllMocks()
  })

  it('wires jwt auth, authorization, and i18n when all three are answered yes', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    // theme=1, language blank, resources="users", fields default, auth=1 (jwt), authorization=1 (yes), i18n=1 (yes)
    const prompter = fakeQuestioner(['1', '', 'users', '', '1', '1', '1'])

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/config/auth.ts')
    expect(paths).toContain('src/config/roles.ts')
    expect(paths).toContain('src/config/i18n.ts')
    const app = (files as { path: string; contents: string }[]).find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain('useAuthRoutes')
    expect(app).toContain('roleHierarchy,')
    expect(app).toContain('i18n.middleware')
    vi.restoreAllMocks()
  })

  it('skips auth, authorization, and i18n entirely when all three are left blank', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    const prompter = fakeQuestioner(['1', '', 'users', '', '', '', ''])

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).not.toContain('src/config/auth.ts')
    expect(paths).not.toContain('src/config/roles.ts')
    expect(paths).not.toContain('src/config/i18n.ts')
    vi.restoreAllMocks()
  })

  it('reports skipped files without failing', async () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logs.push(line)
    })
    const write = vi.fn().mockReturnValue({ written: ['src/app.ts'], skipped: ['src/index.ts'] })
    const prompter = fakeQuestioner(['1', '', 'posts', 'title:string', '', '', ''])

    const exitCode = await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(logs.join('\n')).toContain('src/index.ts')
    vi.restoreAllMocks()
  })
})

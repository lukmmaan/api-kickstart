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
    // theme=1 (layered), resources="widgets", fields for widgets="label:string, qty:number"
    const prompter = fakeQuestioner(['1', 'widgets', 'label:string, qty:number'])

    const selections = { framework: ['fastify'], database: ['mongodb'], validation: ['joi'] }
    const exitCode = await runScaffoldWizard(selections, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(write).toHaveBeenCalledTimes(1)
    const [files, cwd] = write.mock.calls[0]
    expect(cwd).toBe('/some/project')
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/models/widgets.model.ts')
    const model = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/models/widgets.model.ts',
    )!.contents
    expect(model).toContain('label: string')
    expect(model).toContain('qty: number')
    const app = (files as { path: string; contents: string }[]).find((f) => f.path === 'src/app.ts')!.contents
    expect(app).toContain('fastify()')
    vi.restoreAllMocks()
  })

  it('prompts for fields once per comma-separated resource name, each independently', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    // theme=1, resources="users, posts", fields(users)="name:string", fields(posts)="title:string, views:number"
    const prompter = fakeQuestioner(['1', 'users, posts', 'name:string', 'title:string, views:number'])

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const usersModel = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/models/users.model.ts',
    )!.contents
    expect(usersModel).toContain('name: string')
    expect(usersModel).not.toContain('views')
    const postsModel = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/models/posts.model.ts',
    )!.contents
    expect(postsModel).toContain('title: string')
    expect(postsModel).toContain('views: number')
    vi.restoreAllMocks()
  })

  it('defaults the resource to "users" and the field to name:string when everything is left blank', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const write = vi.fn().mockReturnValue({ written: [], skipped: [] })
    const prompter = fakeQuestioner(['2', '', '']) // modular theme, blank resource answer, blank fields answer

    await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    const [files] = write.mock.calls[0]
    const paths = (files as { path: string }[]).map((f) => f.path)
    expect(paths).toContain('src/modules/users/users.model.ts')
    const model = (files as { path: string; contents: string }[]).find(
      (f) => f.path === 'src/modules/users/users.model.ts',
    )!.contents
    expect(model).toContain('name: string')
    vi.restoreAllMocks()
  })

  it('reports skipped files without failing', async () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logs.push(line)
    })
    const write = vi.fn().mockReturnValue({ written: ['src/app.ts'], skipped: ['src/index.ts'] })
    const prompter = fakeQuestioner(['1', 'posts', 'title:string'])

    const exitCode = await runScaffoldWizard({}, '/some/project', { prompter, isInteractive: true, write })

    expect(exitCode).toBe(0)
    expect(logs.join('\n')).toContain('src/index.ts')
    vi.restoreAllMocks()
  })
})

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runRoutesCommand } from './commands/routes.js'
import { runOpenapiGenerateCommand } from './commands/openapi-generate.js'

const coreDistIndexUrl = new URL('../../dist/index.js', import.meta.url).href

let dir: string
let configPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'kickstart-cli-test-'))
  configPath = join(dir, 'api-kickstart.config.mjs')
  writeFileSync(
    configPath,
    `
import { createApp } from '${coreDistIndexUrl}'

function fakeFramework() {
  let handler = null
  return {
    name: 'fake',
    onRequest(h) { handler = h },
    listen() { return null },
    handler() { return handler },
    async close() {},
  }
}

export const app = createApp({ framework: fakeFramework() })
app.route({ method: 'GET', path: '/ping', auth: false, handler: async () => ({ pong: true }) })
app.route({ method: 'POST', path: '/login', auth: false, rateLimit: { window: '1m', max: 5 }, handler: async () => ({}) })
app.route({ method: 'GET', path: '/admin', auth: true, roles: ['admin'], handler: async () => ({}) })
app.openapi({ info: { title: 'Test API', version: '1.0.0' }, json: '/openapi.json' })
`,
  )
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('routes command', () => {
  it('exits 0 and prints every registered route', async () => {
    const logs: string[] = []
    vi.spyOn(console, 'log').mockImplementation((line: string) => {
      logs.push(line)
    })

    const exitCode = await runRoutesCommand(['--config', configPath])

    expect(exitCode).toBe(0)
    const output = logs.join('\n')
    expect(output).toContain('GET')
    expect(output).toContain('/ping')
    expect(output).toContain('/admin')
    expect(output).toContain('admin')
    expect(output).toContain('4 route(s)')

    vi.restoreAllMocks()
  })
})

describe('openapi:generate command', () => {
  it('writes the already-registered OpenAPI spec to a file', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const outPath = join(dir, 'openapi.json')

    const exitCode = await runOpenapiGenerateCommand(['--config', configPath, '--out', outPath])

    expect(exitCode).toBe(0)
    expect(existsSync(outPath)).toBe(true)
    const spec = JSON.parse(readFileSync(outPath, 'utf8'))
    expect(spec.info).toEqual({ title: 'Test API', version: '1.0.0' })
    expect(spec.paths).toHaveProperty('/ping')
    expect(spec.paths).toHaveProperty('/admin')

    vi.restoreAllMocks()
  })

  it('exits 1 with an error when the given path was never registered', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const exitCode = await runOpenapiGenerateCommand(['--config', configPath, '--path', '/does-not-exist'])

    expect(exitCode).toBe(1)

    vi.restoreAllMocks()
  })
})

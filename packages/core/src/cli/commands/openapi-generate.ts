import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractFlag } from '../flags.js'
import { loadConfig, resolveApp } from '../config.js'

export async function runOpenapiGenerateCommand(args: string[]): Promise<number> {
  const configPath = extractFlag(args, '--config')
  const specPath = extractFlag(args, '--path') ?? '/openapi.json'
  const outPath = extractFlag(args, '--out') ?? 'openapi.json'
  const config = await loadConfig(configPath)
  const app = await resolveApp(config)

  const result = await app.inject({ method: 'GET', path: specPath })
  if (result.status !== 200) {
    console.error(
      `openapi:generate: GET ${specPath} returned ${result.status}. Did you call app.openapi({ json: '${specPath}' }) in your config? Use --path to point at a different route.`,
    )
    return 1
  }

  const fullPath = resolve(process.cwd(), outPath)
  writeFileSync(fullPath, `${JSON.stringify(result.body, null, 2)}\n`)
  console.log(`Wrote OpenAPI spec to ${outPath}`)
  return 0
}

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractFlag } from '../flags.js'
import { loadConfig } from '../config.js'

function placeholderFor(entry: { parse(value: unknown): unknown }): string {
  try {
    const parsed = entry.parse(undefined)
    return parsed === undefined ? '' : String(parsed)
  } catch {
    return ''
  }
}

export async function runEnvExampleCommand(args: string[]): Promise<number> {
  const configPath = extractFlag(args, '--config')
  const outPath = extractFlag(args, '--out') ?? '.env.example'
  const config = await loadConfig(configPath)

  if (!config.envSchema) {
    console.error('env:example: config must export "envSchema" (the object passed to env())')
    return 1
  }

  const lines = Object.keys(config.envSchema).map((key) => `${key}=${placeholderFor(config.envSchema![key])}`)
  const fullPath = resolve(process.cwd(), outPath)
  writeFileSync(fullPath, `${lines.join('\n')}\n`)
  console.log(`Wrote ${lines.length} variable(s) to ${outPath}`)
  return 0
}

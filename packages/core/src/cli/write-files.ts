import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { ScaffoldFile } from './scaffold.js'

export interface WriteResult {
  written: string[]
  skipped: string[]
}

/** Writes each file relative to cwd, creating directories as needed. Never overwrites a file that already exists. */
export function writeScaffoldFiles(files: ScaffoldFile[], cwd: string): WriteResult {
  const written: string[] = []
  const skipped: string[] = []

  for (const file of files) {
    const fullPath = resolve(cwd, file.path)
    if (existsSync(fullPath)) {
      skipped.push(file.path)
      continue
    }
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, file.contents)
    written.push(file.path)
  }

  return { written, skipped }
}
